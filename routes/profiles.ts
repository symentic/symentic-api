import { Router } from 'express';
import { ExistingEngramProfileService } from '../../services/existingEngramProfileService';
import { ProfileQueryService } from '../services/profileQueryService';

export const profilesRouter = Router();

profilesRouter.get('/', async (req, res) => {
  try {
    const { businessId, name, tags, userType } = req.query;

    if (!businessId && !name && !tags) {
      // Use the ProfileQueryService which has proper Amplify auth
      const result = await ProfileQueryService.listAllProfiles({ limit: 1000 });
      return res.json({ profiles: result.profiles, count: result.count });
    }

    if (businessId && !name && !tags) {
      const profiles = userType 
        ? await ExistingEngramProfileService.queryProfilesByBusinessAndType(businessId as string, userType as string)
        : await ExistingEngramProfileService.listProfilesByBusiness(businessId as string);
      return res.json({ profiles, count: profiles.length });
    }

    let profiles = businessId 
      ? await ExistingEngramProfileService.listProfilesByBusiness(businessId as string)
      : await ExistingEngramProfileService.listAllProfiles();

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
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

profilesRouter.get('/query', async (req, res) => {
  try {
    const { businessId, name, tags, userType, limit, lastKey } = req.query;

    const queryParams = {
      businessId: businessId as string,
      userType: userType as string,
      limit: limit ? parseInt(limit as string) : 100,
      lastEvaluatedKey: lastKey ? JSON.parse(lastKey as string) : undefined
    };

    let result;

    if (name && tags) {
      const tagArray = Array.isArray(tags) ? tags as string[] : [tags as string];
      result = await ProfileQueryService.queryByNameAndTags(name as string, tagArray, queryParams);
    } else if (name) {
      result = await ProfileQueryService.queryByName(name as string, queryParams);
    } else if (tags) {
      const tagArray = Array.isArray(tags) ? tags as string[] : [tags as string];
      result = await ProfileQueryService.queryByTags(tagArray, queryParams);
    } else {
      return res.status(400).json({ error: 'Either name or tags parameter is required' });
    }

    res.json({
      profiles: result.profiles,
      count: result.count,
      nextKey: result.lastEvaluatedKey ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64') : null
    });
  } catch (error) {
    console.error('Error querying profiles:', error);
    res.status(500).json({ error: 'Failed to query profiles' });
  }
});

profilesRouter.get('/search', async (req, res) => {
  try {
    const { q, businessId } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    let profiles = businessId 
      ? await ExistingEngramProfileService.searchProfiles(businessId as string, q as string)
      : await ExistingEngramProfileService.listAllProfiles();

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
  } catch (error) {
    console.error('Error searching profiles:', error);
    res.status(500).json({ error: 'Failed to search profiles' });
  }
});

profilesRouter.get('/:businessId/:userId', async (req, res) => {
  try {
    const { businessId, userId } = req.params;
    const profile = await ExistingEngramProfileService.getProfile(businessId, userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

profilesRouter.post('/', async (req, res) => {
  try {
    const profile = await ExistingEngramProfileService.createProfile(req.body);
    res.status(201).json(profile);
  } catch (error: any) {
    console.error('Error creating profile:', error);
    if (error.message === 'Profile already exists for this user') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

profilesRouter.put('/:businessId/:userId', async (req, res) => {
  try {
    const { businessId, userId } = req.params;
    const profile = await ExistingEngramProfileService.updateProfile(businessId, userId, req.body);
    res.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

profilesRouter.delete('/:businessId/:userId', async (req, res) => {
  try {
    const { businessId, userId } = req.params;
    const deletedProfile = await ExistingEngramProfileService.deleteProfile(businessId, userId);
    
    if (!deletedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted successfully', profile: deletedProfile });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});