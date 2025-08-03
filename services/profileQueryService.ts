import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchAuthSession } from 'aws-amplify/auth';

let docClient: DynamoDBDocumentClient | null = null;

async function getDocClient() {
  if (!docClient) {
    const session = await fetchAuthSession();
    const client = new DynamoDBClient({
      region: "us-east-1",
      credentials: session.credentials,
    });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true
      }
    });
  }
  return docClient;
}

const TABLE_NAME = "SymenticProfileEngrams-prod";

export interface ProfileQueryParams {
  businessId?: string;
  name?: string;
  tags?: string[];
  userType?: string;
  expertise?: string[];
  limit?: number;
  lastEvaluatedKey?: any;
}

export class ProfileQueryService {
  static async listAllProfiles(params: ProfileQueryParams = {}) {
    try {
      const docClient = await getDocClient();
      
      let filterExpressions: string[] = [];
      let expressionAttributeValues: any = {};

      filterExpressions.push("begins_with(SK, :sk)");
      expressionAttributeValues[":sk"] = "USER#";

      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: filterExpressions.join(" AND "),
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: params.limit || 1000,
        ExclusiveStartKey: params.lastEvaluatedKey
      });

      const response = await docClient.send(command);
      return {
        profiles: response.Items || [],
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: response.Count || 0
      };
    } catch (error) {
      console.error('Error listing all profiles:', error);
      throw error;
    }
  }
  static async queryByName(name: string, params: ProfileQueryParams = {}) {
    try {
      const docClient = await getDocClient();
      const queryName = name.toLowerCase();
      
      let filterExpressions: string[] = [];
      let expressionAttributeValues: any = {};
      let expressionAttributeNames: any = {};

      filterExpressions.push("begins_with(SK, :sk)");
      expressionAttributeValues[":sk"] = "USER#";

      filterExpressions.push("(contains(#name, :name) OR contains(email, :email) OR contains(#role, :role))");
      expressionAttributeValues[":name"] = name;
      expressionAttributeValues[":email"] = name;
      expressionAttributeValues[":role"] = name;
      expressionAttributeNames["#name"] = "name";
      expressionAttributeNames["#role"] = "role";

      if (params.businessId) {
        const command = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: filterExpressions.join(" AND "),
          ExpressionAttributeValues: {
            ...expressionAttributeValues,
            ":pk": `symentic_${params.businessId.toLowerCase().substring(0, 6)}`
          },
          ExpressionAttributeNames: expressionAttributeNames,
          Limit: params.limit || 100,
          ExclusiveStartKey: params.lastEvaluatedKey
        });

        const response = await docClient.send(command);
        return {
          profiles: response.Items || [],
          lastEvaluatedKey: response.LastEvaluatedKey,
          count: response.Count || 0
        };
      } else {
        const command = new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: filterExpressions.join(" AND "),
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
          Limit: params.limit || 100,
          ExclusiveStartKey: params.lastEvaluatedKey
        });

        const response = await docClient.send(command);
        return {
          profiles: response.Items || [],
          lastEvaluatedKey: response.LastEvaluatedKey,
          count: response.Count || 0
        };
      }
    } catch (error) {
      console.error('Error querying profiles by name:', error);
      throw error;
    }
  }

  static async queryByTags(tags: string[], params: ProfileQueryParams = {}) {
    try {
      const docClient = await getDocClient();
      const lowerCaseTags = tags.map(tag => tag.toLowerCase());
      
      let filterExpressions: string[] = [];
      let expressionAttributeValues: any = {};
      let expressionAttributeNames: any = {};

      filterExpressions.push("begins_with(SK, :sk)");
      expressionAttributeValues[":sk"] = "USER#";

      filterExpressions.push("attribute_exists(tags)");
      
      const tagConditions = lowerCaseTags.map((tag, index) => {
        expressionAttributeValues[`:tag${index}`] = tag;
        return `contains(tags, :tag${index})`;
      });
      
      if (tagConditions.length > 0) {
        filterExpressions.push(`(${tagConditions.join(" OR ")})`);
      }

      if (params.userType) {
        filterExpressions.push("userType = :userType");
        expressionAttributeValues[":userType"] = params.userType;
      }

      if (params.businessId) {
        const command = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: filterExpressions.join(" AND "),
          ExpressionAttributeValues: {
            ...expressionAttributeValues,
            ":pk": `symentic_${params.businessId.toLowerCase().substring(0, 6)}`
          },
          Limit: params.limit || 100,
          ExclusiveStartKey: params.lastEvaluatedKey
        });

        const response = await docClient.send(command);
        return {
          profiles: response.Items || [],
          lastEvaluatedKey: response.LastEvaluatedKey,
          count: response.Count || 0
        };
      } else {
        const command = new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: filterExpressions.join(" AND "),
          ExpressionAttributeValues: expressionAttributeValues,
          Limit: params.limit || 100,
          ExclusiveStartKey: params.lastEvaluatedKey
        });

        const response = await docClient.send(command);
        return {
          profiles: response.Items || [],
          lastEvaluatedKey: response.LastEvaluatedKey,
          count: response.Count || 0
        };
      }
    } catch (error) {
      console.error('Error querying profiles by tags:', error);
      throw error;
    }
  }

  static async queryByNameAndTags(name: string, tags: string[], params: ProfileQueryParams = {}) {
    try {
      const docClient = await getDocClient();
      const queryName = name.toLowerCase();
      const lowerCaseTags = tags.map(tag => tag.toLowerCase());
      
      let filterExpressions: string[] = [];
      let expressionAttributeValues: any = {};
      let expressionAttributeNames: any = {};

      filterExpressions.push("begins_with(SK, :sk)");
      expressionAttributeValues[":sk"] = "USER#";

      filterExpressions.push("(contains(#name, :name) OR contains(email, :email) OR contains(#role, :role))");
      expressionAttributeValues[":name"] = name;
      expressionAttributeValues[":email"] = name;
      expressionAttributeValues[":role"] = name;
      expressionAttributeNames["#name"] = "name";
      expressionAttributeNames["#role"] = "role";

      filterExpressions.push("attribute_exists(tags)");
      
      const tagConditions = lowerCaseTags.map((tag, index) => {
        expressionAttributeValues[`:tag${index}`] = tag;
        return `contains(tags, :tag${index})`;
      });
      
      if (tagConditions.length > 0) {
        filterExpressions.push(`(${tagConditions.join(" OR ")})`);
      }

      if (params.userType) {
        filterExpressions.push("userType = :userType");
        expressionAttributeValues[":userType"] = params.userType;
      }

      if (params.businessId) {
        const command = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          FilterExpression: filterExpressions.join(" AND "),
          ExpressionAttributeValues: {
            ...expressionAttributeValues,
            ":pk": `symentic_${params.businessId.toLowerCase().substring(0, 6)}`
          },
          ExpressionAttributeNames: expressionAttributeNames,
          Limit: params.limit || 100,
          ExclusiveStartKey: params.lastEvaluatedKey
        });

        const response = await docClient.send(command);
        return {
          profiles: response.Items || [],
          lastEvaluatedKey: response.LastEvaluatedKey,
          count: response.Count || 0
        };
      } else {
        const command = new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: filterExpressions.join(" AND "),
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
          Limit: params.limit || 100,
          ExclusiveStartKey: params.lastEvaluatedKey
        });

        const response = await docClient.send(command);
        return {
          profiles: response.Items || [],
          lastEvaluatedKey: response.LastEvaluatedKey,
          count: response.Count || 0
        };
      }
    } catch (error) {
      console.error('Error querying profiles by name and tags:', error);
      throw error;
    }
  }
}