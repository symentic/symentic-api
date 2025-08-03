import { Request, Response, NextFunction } from 'express';

export interface ProfileValidationSchema {
  businessId: string;
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  description?: string;
  tags?: string[];
  expertise?: string[];
  userType?: string;
  source?: string;
  consent?: {
    given: boolean;
    method: string;
    timestamp: string;
  };
  enrichments?: Array<{
    agent: string;
    date: string;
    detail: string;
  }>;
  slackProfile?: {
    displayName?: string;
    isAdmin?: boolean;
    isOwner?: boolean;
    profilePictureUrl?: string;
    realName?: string;
    slackUserId?: string;
    statusText?: string;
    timezone?: string;
    title?: string;
  };
  interactionCount?: number;
}

// Validation middleware for profile creation
export const validateCreateProfile = (req: Request, res: Response, next: NextFunction) => {
  const { businessId, userId } = req.body;

  // Required fields
  if (!businessId) {
    return res.status(400).json({ error: 'businessId is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Validate businessId format (should be alphanumeric)
  if (!/^[a-zA-Z0-9_-]+$/.test(businessId)) {
    return res.status(400).json({ error: 'businessId must be alphanumeric with underscores or hyphens' });
  }

  // Validate userId format
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return res.status(400).json({ error: 'userId must be alphanumeric with underscores or hyphens' });
  }

  // Validate email format if provided
  if (req.body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
  }

  // Validate arrays if provided
  if (req.body.tags && !Array.isArray(req.body.tags)) {
    return res.status(400).json({ error: 'tags must be an array' });
  }

  if (req.body.expertise && !Array.isArray(req.body.expertise)) {
    return res.status(400).json({ error: 'expertise must be an array' });
  }

  // Validate userType if provided
  if (req.body.userType && !['internal', 'external'].includes(req.body.userType)) {
    return res.status(400).json({ error: 'userType must be either "internal" or "external"' });
  }

  // Validate source if provided
  if (req.body.source && typeof req.body.source !== 'string') {
    return res.status(400).json({ error: 'source must be a string' });
  }

  // Validate consent if provided
  if (req.body.consent) {
    if (typeof req.body.consent !== 'object') {
      return res.status(400).json({ error: 'consent must be an object' });
    }
    if (typeof req.body.consent.given !== 'boolean') {
      return res.status(400).json({ error: 'consent.given must be a boolean' });
    }
    if (req.body.consent.method && typeof req.body.consent.method !== 'string') {
      return res.status(400).json({ error: 'consent.method must be a string' });
    }
  }

  // Validate enrichments if provided
  if (req.body.enrichments) {
    if (!Array.isArray(req.body.enrichments)) {
      return res.status(400).json({ error: 'enrichments must be an array' });
    }
    for (const enrichment of req.body.enrichments) {
      if (!enrichment.agent || !enrichment.date || !enrichment.detail) {
        return res.status(400).json({ error: 'each enrichment must have agent, date, and detail fields' });
      }
    }
  }

  // Validate slackProfile if provided
  if (req.body.slackProfile) {
    if (typeof req.body.slackProfile !== 'object') {
      return res.status(400).json({ error: 'slackProfile must be an object' });
    }
    if (req.body.slackProfile.isAdmin !== undefined && typeof req.body.slackProfile.isAdmin !== 'boolean') {
      return res.status(400).json({ error: 'slackProfile.isAdmin must be a boolean' });
    }
    if (req.body.slackProfile.isOwner !== undefined && typeof req.body.slackProfile.isOwner !== 'boolean') {
      return res.status(400).json({ error: 'slackProfile.isOwner must be a boolean' });
    }
  }

  // Validate interactionCount if provided
  if (req.body.interactionCount !== undefined) {
    if (!Number.isInteger(req.body.interactionCount) || req.body.interactionCount < 0) {
      return res.status(400).json({ error: 'interactionCount must be a non-negative integer' });
    }
  }

  next();
};

// Validation middleware for profile updates
export const validateUpdateProfile = (req: Request, res: Response, next: NextFunction) => {
  const { businessId, userId } = req.params;

  // Validate URL parameters
  if (!businessId || !userId) {
    return res.status(400).json({ error: 'businessId and userId are required in URL' });
  }

  // Validate businessId format
  if (!/^[a-zA-Z0-9_-]+$/.test(businessId)) {
    return res.status(400).json({ error: 'businessId must be alphanumeric with underscores or hyphens' });
  }

  // Validate userId format
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return res.status(400).json({ error: 'userId must be alphanumeric with underscores or hyphens' });
  }

  // Validate email format if provided in update
  if (req.body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
  }

  // Validate arrays if provided
  if (req.body.tags && !Array.isArray(req.body.tags)) {
    return res.status(400).json({ error: 'tags must be an array' });
  }

  if (req.body.expertise && !Array.isArray(req.body.expertise)) {
    return res.status(400).json({ error: 'expertise must be an array' });
  }

  // Validate userType if provided
  if (req.body.userType && !['internal', 'external'].includes(req.body.userType)) {
    return res.status(400).json({ error: 'userType must be either "internal" or "external"' });
  }

  // Validate additional fields for updates (same as create)
  if (req.body.source && typeof req.body.source !== 'string') {
    return res.status(400).json({ error: 'source must be a string' });
  }

  if (req.body.consent) {
    if (typeof req.body.consent !== 'object') {
      return res.status(400).json({ error: 'consent must be an object' });
    }
    if (typeof req.body.consent.given !== 'boolean') {
      return res.status(400).json({ error: 'consent.given must be a boolean' });
    }
  }

  if (req.body.enrichments) {
    if (!Array.isArray(req.body.enrichments)) {
      return res.status(400).json({ error: 'enrichments must be an array' });
    }
    for (const enrichment of req.body.enrichments) {
      if (!enrichment.agent || !enrichment.date || !enrichment.detail) {
        return res.status(400).json({ error: 'each enrichment must have agent, date, and detail fields' });
      }
    }
  }

  if (req.body.slackProfile && typeof req.body.slackProfile !== 'object') {
    return res.status(400).json({ error: 'slackProfile must be an object' });
  }

  if (req.body.interactionCount !== undefined) {
    if (!Number.isInteger(req.body.interactionCount) || req.body.interactionCount < 0) {
      return res.status(400).json({ error: 'interactionCount must be a non-negative integer' });
    }
  }

  // Prevent updating immutable fields
  if (req.body.businessId || req.body.userId || req.body.createdAt || req.body.firstSeen || req.body.PK || req.body.SK || req.body.GSI1PK || req.body.id) {
    return res.status(400).json({ error: 'businessId, userId, createdAt, firstSeen, PK, SK, GSI1PK, and id cannot be updated' });
  }

  next();
};

// Validation middleware for URL parameters
export const validateProfileParams = (req: Request, res: Response, next: NextFunction) => {
  const { businessId, userId } = req.params;

  if (!businessId || !userId) {
    return res.status(400).json({ error: 'businessId and userId are required' });
  }

  // Validate businessId format
  if (!/^[a-zA-Z0-9_-]+$/.test(businessId)) {
    return res.status(400).json({ error: 'businessId must be alphanumeric with underscores or hyphens' });
  }

  // Validate userId format
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return res.status(400).json({ error: 'userId must be alphanumeric with underscores or hyphens' });
  }

  next();
};

// Validation middleware for query parameters
export const validateQueryParams = (req: Request, res: Response, next: NextFunction) => {
  const { limit, userType } = req.query;

  // Validate limit if provided
  if (limit) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({ error: 'limit must be a number between 1 and 1000' });
    }
  }

  // Validate userType if provided
  if (userType && !['internal', 'external'].includes(userType as string)) {
    return res.status(400).json({ error: 'userType must be either "internal" or "external"' });
  }

  next();
};