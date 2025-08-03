import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

// Error handling middleware
export const errorHandler = (error: ApiError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  // Handle specific AWS DynamoDB errors
  if (error.name === 'ResourceNotFoundException') {
    return res.status(404).json({
      error: 'Resource not found',
      message: 'The requested resource does not exist',
      code: 'RESOURCE_NOT_FOUND'
    });
  }

  if (error.name === 'ConditionalCheckFailedException') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'The operation could not be completed due to a conflict',
      code: 'CONDITIONAL_CHECK_FAILED'
    });
  }

  if (error.name === 'ValidationException') {
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message,
      code: 'VALIDATION_ERROR'
    });
  }

  if (error.name === 'ProvisionedThroughputExceededException') {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Request rate exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  if (error.name === 'ItemCollectionSizeLimitExceededException') {
    return res.status(413).json({
      error: 'Item too large',
      message: 'The item collection is too large',
      code: 'ITEM_TOO_LARGE'
    });
  }

  if (error.name === 'AccessDeniedException' || error.name === 'UnauthorizedException') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to perform this action',
      code: 'ACCESS_DENIED'
    });
  }

  // Handle custom application errors
  if (error.message === 'Profile already exists for this user') {
    return res.status(409).json({
      error: 'Profile already exists',
      message: error.message,
      code: 'PROFILE_EXISTS'
    });
  }

  if (error.message === 'Profile not found') {
    return res.status(404).json({
      error: 'Profile not found',
      message: error.message,
      code: 'PROFILE_NOT_FOUND'
    });
  }

  // Handle JSON parsing errors
  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON',
      code: 'INVALID_JSON'
    });
  }

  // Use custom status code if provided, otherwise default to 500
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  res.status(statusCode).json({
    error: message,
    message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// Async error wrapper to catch promise rejections
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND'
  });
};