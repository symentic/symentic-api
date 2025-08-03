import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { profilesRouter } from './routes/profiles';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/profiles', profilesRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    table: process.env.DYNAMODB_TABLE_NAME || "SymenticProfileEngrams-prod",
    region: process.env.AWS_REGION || "us-east-1",
    version: '1.0.0'
  });
});

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Symentic API server running on http://localhost:${PORT}`);
  console.log(`📊 DynamoDB Table: ${process.env.DYNAMODB_TABLE_NAME || "SymenticProfileEngrams-prod"}`);
  console.log(`🌍 AWS Region: ${process.env.AWS_REGION || "us-east-1"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});