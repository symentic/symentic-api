import { Router, Request, Response } from 'express';
import { ProfileService } from '../services/profileService';
import { validateCreateProfile, validateUpdateProfile, validateProfileParams, validateQueryParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

export const profilesRouter = Router();

profilesRouter.get('/', validateQueryParams, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, name, tags, userType } = req.query;

    if (!businessId && !name && !tags) {
      const profiles = await ProfileService.listAllProfiles();
      return res.json({ profiles, count: profiles.length });
    }

    if (businessId && !name && !tags) {
      const profiles = userType 
        ? await ProfileService.queryProfilesByBusinessAndType(businessId as string, userType as string)
        : await ProfileService.listProfilesByBusiness(businessId as string);
      return res.json({ profiles, count: profiles.length });
    }

    let profiles = businessId 
      ? await ProfileService.listProfilesByBusiness(businessId as string)
      : await ProfileService.listAllProfiles();

    if (name) {
      const searchQuery = (name as string).toLowerCase();
      profiles = profiles.filter(profile => 
        profile.name?.toLowerCase().includes(searchQuery) ||
        profile.email?.toLowerCase().includes(searchQuery) ||
        profile.role?.toLowerCase().includes(searchQuery)
      );
    }

    if (tags) {
      const queryTags = Array.isArray(tags) ? tags : [tags];
      const lowerCaseTags = queryTags.map(tag => (tag as string).toLowerCase());
      
      profiles = profiles.filter(profile => {
        if (!profile.tags || profile.tags.length === 0) return false;
        const profileTags = profile.tags.map((tag: string) => tag.toLowerCase());
        return lowerCaseTags.some(queryTag => 
          profileTags.some((profileTag: string) => profileTag.includes(queryTag))
        );
      });
    }

    res.json({ profiles, count: profiles.length });
}));

profilesRouter.get('/query', validateQueryParams, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, name, tags, userType, limit, lastKey } = req.query;

    const queryParams = {
      businessId: businessId as string,
      userType: userType as string,
      limit: limit ? parseInt(limit as string) : 100,
      lastEvaluatedKey: lastKey ? JSON.parse(lastKey as string) : undefined
    };

    // Simple implementation using ProfileService instead of ProfileQueryService
    let profiles = businessId 
      ? await ProfileService.listProfilesByBusiness(businessId as string)
      : await ProfileService.listAllProfiles();

    if (name) {
      const searchQuery = (name as string).toLowerCase();
      profiles = profiles.filter(profile => 
        profile.name?.toLowerCase().includes(searchQuery) ||
        profile.email?.toLowerCase().includes(searchQuery) ||
        profile.role?.toLowerCase().includes(searchQuery)
      );
    }

    if (tags) {
      const queryTags = Array.isArray(tags) ? tags : [tags];
      const lowerCaseTags = queryTags.map(tag => (tag as string).toLowerCase());
      
      profiles = profiles.filter(profile => {
        if (!profile.tags || profile.tags.length === 0) return false;
        const profileTags = profile.tags.map((tag: string) => tag.toLowerCase());
        return lowerCaseTags.some(queryTag => 
          profileTags.some((profileTag: string) => profileTag.includes(queryTag))
        );
      });
    }

    if (userType) {
      profiles = profiles.filter(profile => profile.userType === userType);
    }

    // Simple pagination
    const startIndex = 0; // Could implement with lastKey if needed
    const endIndex = Math.min(startIndex + queryParams.limit, profiles.length);
    const paginatedProfiles = profiles.slice(startIndex, endIndex);

    res.json({
      profiles: paginatedProfiles,
      count: paginatedProfiles.length,
      nextKey: null // Simplified - could implement proper pagination later
    });
}));

profilesRouter.get('/search', asyncHandler(async (req: Request, res: Response) => {
    const { q, businessId } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    let profiles = businessId 
      ? await ProfileService.searchProfiles(businessId as string, q as string)
      : await ProfileService.listAllProfiles();

    if (!businessId) {
      const query = (q as string).toLowerCase();
      profiles = profiles.filter(profile => 
        profile.name?.toLowerCase().includes(query) ||
        profile.email?.toLowerCase().includes(query) ||
        profile.role?.toLowerCase().includes(query) ||
        profile.description?.toLowerCase().includes(query) ||
        profile.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
        profile.expertise?.some((exp: string) => exp.toLowerCase().includes(query))
      );
    }

    res.json({ profiles, count: profiles.length });
}));

profilesRouter.get('/:businessId/:userId', validateProfileParams, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, userId } = req.params;
    const profile = await ProfileService.getProfile(businessId, userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
}));

profilesRouter.post('/', validateCreateProfile, asyncHandler(async (req: Request, res: Response) => {
    const profile = await ProfileService.createProfile(req.body);
    res.status(201).json(profile);
}));

profilesRouter.put('/:businessId/:userId', validateUpdateProfile, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, userId } = req.params;
    const profile = await ProfileService.updateProfile(businessId, userId, req.body);
    res.json(profile);
}));

profilesRouter.delete('/:businessId/:userId', validateProfileParams, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, userId } = req.params;
    const deletedProfile = await ProfileService.deleteProfile(businessId, userId);
    
    if (!deletedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted successfully', profile: deletedProfile });
}));

// Add enrichment to a profile
profilesRouter.post('/:businessId/:userId/enrichments', validateProfileParams, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, userId } = req.params;
    const { agent, date, detail } = req.body;

    if (!agent || !date || !detail) {
      return res.status(400).json({ error: 'agent, date, and detail are required' });
    }

    const enrichment = { agent, date, detail };
    const updatedProfile = await ProfileService.addEnrichment(businessId, userId, enrichment);
    res.json(updatedProfile);
}));

// Update interaction count
profilesRouter.post('/:businessId/:userId/interactions', validateProfileParams, asyncHandler(async (req: Request, res: Response) => {
    const { businessId, userId } = req.params;
    const updatedProfile = await ProfileService.updateInteractionCount(businessId, userId);
    res.json(updatedProfile);
}));

// Query profiles by user type using GSI
profilesRouter.get('/by-type/:businessId/:userType', asyncHandler(async (req: Request, res: Response) => {
    const { businessId, userType } = req.params;
    
    if (!['internal', 'external'].includes(userType)) {
      return res.status(400).json({ error: 'userType must be either "internal" or "external"' });
    }

    const profiles = await ProfileService.queryProfilesByType(businessId, userType);
    res.json({ profiles, count: profiles.length });
}));