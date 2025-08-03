import express from 'express';
import cors from 'cors';
import { Router } from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize DynamoDB client with environment credentials
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN
  } : undefined
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "SymenticProfileEngrams-prod";

// Profile routes
const profilesRouter = Router();

// Query endpoint with name and tag support
profilesRouter.get('/query', async (req, res) => {
  try {
    const { businessId, name, tags, userType, limit = '100' } = req.query;
    
    let filterExpressions: string[] = [];
    let expressionAttributeValues: any = {};
    let expressionAttributeNames: any = {};

    // Always filter for user profiles
    filterExpressions.push("begins_with(SK, :sk)");
    expressionAttributeValues[":sk"] = "USER#";

    // Name search
    if (name) {
      const queryName = (name as string).toLowerCase();
      filterExpressions.push("(contains(#name, :name) OR contains(email, :email) OR contains(#role, :role))");
      expressionAttributeValues[":name"] = name;
      expressionAttributeValues[":email"] = name;
      expressionAttributeValues[":role"] = name;
      expressionAttributeNames["#name"] = "name";
      expressionAttributeNames["#role"] = "role";
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filterExpressions.push("attribute_exists(tags)");
      
      const tagConditions = tagArray.map((tag, index) => {
        expressionAttributeValues[`:tag${index}`] = tag;
        return `contains(tags, :tag${index})`;
      });
      
      if (tagConditions.length > 0) {
        filterExpressions.push(`(${tagConditions.join(" OR ")})`);
      }
    }

    // User type filter
    if (userType) {
      filterExpressions.push("userType = :userType");
      expressionAttributeValues[":userType"] = userType;
    }

    let command;
    if (businessId) {
      // Use Query for specific business
      command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
        ExpressionAttributeValues: {
          ...expressionAttributeValues,
          ":pk": `symentic_${(businessId as string).toLowerCase().substring(0, 6)}`
        },
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        Limit: parseInt(limit as string)
      });
    } else {
      // Use Scan for all businesses
      command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        Limit: parseInt(limit as string)
      });
    }

    const response = await docClient.send(command);
    res.json({
      profiles: response.Items || [],
      count: response.Count || 0,
      scannedCount: response.ScannedCount || 0
    });
  } catch (error) {
    console.error('Error querying profiles:', error);
    res.status(500).json({ error: 'Failed to query profiles', details: error });
  }
});

// List all profiles
profilesRouter.get('/', async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":sk": "USER#"
      },
      Limit: 100
    });

    const response = await docClient.send(command);
    res.json({
      profiles: response.Items || [],
      count: response.Count || 0
    });
  } catch (error) {
    console.error('Error listing profiles:', error);
    res.status(500).json({ error: 'Failed to list profiles', details: error });
  }
});

app.use('/api/profiles', profilesRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    table: TABLE_NAME,
    region: process.env.AWS_REGION || "us-east-1"
  });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`DynamoDB Table: ${TABLE_NAME}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || "us-east-1"}`);
});