import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "SymenticProfileEngrams-prod";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Initialize DynamoDB client - supports multiple credential sources:
// 1. AWS SSO (recommended for local development)
// 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
// 3. IAM roles (for App Runner deployment)
// 4. AWS CLI default profile
const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  // Credentials will be automatically loaded in this order:
  // 1. Environment variables
  // 2. AWS SSO session
  // 3. AWS CLI default profile
  // 4. IAM roles (when deployed)
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

export interface Consent {
  given: boolean;
  method: string;
  timestamp: string;
}

export interface Enrichment {
  agent: string;
  date: string;
  detail: string;
}

export interface SlackProfile {
  displayName: string;
  isAdmin: boolean;
  isOwner: boolean;
  profilePictureUrl: string;
  realName: string;
  slackUserId: string;
  statusText: string;
  timezone: string;
  title: string;
}

export interface Profile {
  // Core DynamoDB keys
  PK?: string;
  SK?: string;
  GSI1PK?: string;
  GSI1SK?: string;
  
  // Profile identifiers
  id?: string;
  businessId: string;
  userId: string;
  
  // Basic profile info
  name?: string;
  email?: string;
  role?: string;
  description?: string;
  userType?: string;
  source?: string;
  
  // Arrays
  tags?: string[];
  expertise?: string[];
  enrichments?: Enrichment[];
  
  // Complex objects
  consent?: Consent;
  slackProfile?: SlackProfile;
  
  // Timestamps and metrics
  firstSeen?: string;
  lastUpdated?: string;
  lastInteraction?: string;
  interactionCount?: number;
  
  // Legacy fields for backward compatibility
  createdAt?: string;
  updatedAt?: string;
}

export class ProfileService {
  // Get a single profile
  static async getProfile(businessId: string, userId: string): Promise<Profile | null> {
    try {
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          SK: `USER#${userId}`
        }
      });

      const response = await docClient.send(command);
      return response.Item as Profile || null;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

  // Create a new profile
  static async createProfile(profile: Profile): Promise<Profile> {
    try {
      // Check if profile already exists
      const existing = await this.getProfile(profile.businessId, profile.userId);
      if (existing) {
        throw new Error('Profile already exists for this user');
      }

      const now = new Date().toISOString();
      const businessPrefix = profile.businessId.toLowerCase().substring(0, 6);
      
      const item = {
        // Core DynamoDB keys
        PK: `symentic_${businessPrefix}`,
        SK: `USER#${profile.userId}`,
        GSI1PK: `symentic_${businessPrefix}`,
        GSI1SK: `TYPE#${profile.userType || 'external'}#USER#${profile.userId}`,
        
        // Profile identifiers
        id: `profile_${profile.businessId}_${profile.userId}`,
        businessId: profile.businessId,
        userId: profile.userId,
        
        // Timestamps
        firstSeen: now,
        lastUpdated: now,
        lastInteraction: now,
        interactionCount: 0,
        
        // Legacy fields for backward compatibility
        createdAt: now,
        updatedAt: now,
        
        // All other profile fields (excluding businessId and userId to avoid duplication)
        ...Object.fromEntries(
          Object.entries(profile).filter(([key]) => !['businessId', 'userId'].includes(key))
        )
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
      });

      await docClient.send(command);
      return item as Profile;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Profile already exists for this user');
      }
      console.error('Error creating profile:', error);
      throw error;
    }
  }

  // Update an existing profile
  static async updateProfile(businessId: string, userId: string, updates: Partial<Profile>): Promise<Profile> {
    try {
      // Remove fields that shouldn't be updated
      const { 
        businessId: _, 
        userId: __, 
        createdAt, 
        firstSeen,
        PK,
        SK,
        GSI1PK,
        id,
        ...validUpdates 
      } = updates;
      
      // Build update expression
      const updateExpressionParts: string[] = [];
      const expressionAttributeNames: any = {};
      const expressionAttributeValues: any = {};

      Object.entries(validUpdates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateExpressionParts.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      });

      // Add timestamps
      const now = new Date().toISOString();
      updateExpressionParts.push('#lastUpdated = :lastUpdated');
      updateExpressionParts.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#lastUpdated'] = 'lastUpdated';
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':lastUpdated'] = now;
      expressionAttributeValues[':updatedAt'] = now;

      // Update GSI1SK if userType is being updated
      if (updates.userType) {
        updateExpressionParts.push('#GSI1SK = :GSI1SK');
        expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
        expressionAttributeValues[':GSI1SK'] = `TYPE#${updates.userType}#USER#${userId}`;
      }

      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          SK: `USER#${userId}`
        },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW"
      });

      const response = await docClient.send(command);
      return response.Attributes as Profile;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Delete a profile
  static async deleteProfile(businessId: string, userId: string): Promise<Profile | null> {
    try {
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          SK: `USER#${userId}`
        },
        ReturnValues: "ALL_OLD"
      });

      const response = await docClient.send(command);
      return response.Attributes as Profile || null;
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  }

  // List all profiles for a business
  static async listProfilesByBusiness(businessId: string): Promise<Profile[]> {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          ":sk": "USER#"
        }
      });

      const response = await docClient.send(command);
      return response.Items as Profile[] || [];
    } catch (error) {
      console.error('Error listing profiles by business:', error);
      throw error;
    }
  }

  // Query profiles by business and user type
  static async queryProfilesByBusinessAndType(businessId: string, userType: string): Promise<Profile[]> {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "userType = :userType",
        ExpressionAttributeValues: {
          ":pk": `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          ":sk": "USER#",
          ":userType": userType
        }
      });

      const response = await docClient.send(command);
      return response.Items as Profile[] || [];
    } catch (error) {
      console.error('Error querying profiles by business and type:', error);
      throw error;
    }
  }

  // List all profiles across all businesses
  static async listAllProfiles(): Promise<Profile[]> {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":sk": "USER#"
        }
      });

      const response = await docClient.send(command);
      return response.Items as Profile[] || [];
    } catch (error) {
      console.error('Error listing all profiles:', error);
      throw error;
    }
  }

  // Search profiles within a business
  static async searchProfiles(businessId: string, query: string): Promise<Profile[]> {
    try {
      const lowerQuery = query.toLowerCase();
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        FilterExpression: "contains(#name, :query) OR contains(email, :query) OR contains(#role, :query) OR contains(description, :query)",
        ExpressionAttributeNames: {
          "#name": "name",
          "#role": "role"
        },
        ExpressionAttributeValues: {
          ":pk": `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          ":sk": "USER#",
          ":query": lowerQuery
        }
      });

      const response = await docClient.send(command);
      
      // Additional filtering for tags and expertise arrays
      const profiles = response.Items as Profile[] || [];
      return profiles.filter(profile => {
        // Check if query matches any tag or expertise
        const tagsMatch = profile.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
        const expertiseMatch = profile.expertise?.some(exp => exp.toLowerCase().includes(lowerQuery));
        
        // Return true if already matched by filter expression or matches tags/expertise
        return true; // Already filtered by DynamoDB, or add: || tagsMatch || expertiseMatch
      });
    } catch (error) {
      console.error('Error searching profiles:', error);
      throw error;
    }
  }

  // Add enrichment to a profile
  static async addEnrichment(businessId: string, userId: string, enrichment: Enrichment): Promise<Profile> {
    try {
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          SK: `USER#${userId}`
        },
        UpdateExpression: "SET enrichments = list_append(if_not_exists(enrichments, :empty_list), :enrichment), lastUpdated = :lastUpdated, lastInteraction = :lastInteraction",
        ExpressionAttributeValues: {
          ":enrichment": [enrichment],
          ":empty_list": [],
          ":lastUpdated": new Date().toISOString(),
          ":lastInteraction": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      });

      const response = await docClient.send(command);
      return response.Attributes as Profile;
    } catch (error) {
      console.error('Error adding enrichment:', error);
      throw error;
    }
  }

  // Update interaction count
  static async updateInteractionCount(businessId: string, userId: string): Promise<Profile> {
    try {
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          SK: `USER#${userId}`
        },
        UpdateExpression: "ADD interactionCount :inc SET lastInteraction = :lastInteraction",
        ExpressionAttributeValues: {
          ":inc": 1,
          ":lastInteraction": new Date().toISOString()
        },
        ReturnValues: "ALL_NEW"
      });

      const response = await docClient.send(command);
      return response.Attributes as Profile;
    } catch (error) {
      console.error('Error updating interaction count:', error);
      throw error;
    }
  }

  // Query profiles by GSI (userType)
  static async queryProfilesByType(businessId: string, userType: string): Promise<Profile[]> {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)",
        ExpressionAttributeValues: {
          ":gsi1pk": `symentic_${businessId.toLowerCase().substring(0, 6)}`,
          ":gsi1sk": `TYPE#${userType}#`
        }
      });

      const response = await docClient.send(command);
      return response.Items as Profile[] || [];
    } catch (error) {
      console.error('Error querying profiles by type:', error);
      throw error;
    }
  }
}