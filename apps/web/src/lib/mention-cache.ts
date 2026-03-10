import { Profile } from '@/types';

// Global cache for ALL system profiles
let globalProfilesCache = new Map<string, Profile>();
let isCacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;

/**
 * Adds a profile to the mention cache
 * @param profile - The profile to cache
 */
export function addToMentionCache(profile: Profile) {
	if (profile.userName && profile.walletAddress) {
		globalProfilesCache.set(profile.userName.toLowerCase(), profile);
	}
}

/**
 * Adds multiple profiles to the mention cache
 * @param profiles - Array of profiles to cache
 */
export function addProfilesToMentionCache(profiles: Profile[]) {
	profiles.forEach((profile) => {
		addToMentionCache(profile);
	});
}

/**
 * Gets all cached profiles
 * @returns Array of all cached profiles
 */
export function getCachedProfiles(): Profile[] {
	return Array.from(globalProfilesCache.values());
}

/**
 * Gets a specific profile from cache by username
 * @param username - The username to look for
 * @returns The profile if found, undefined otherwise
 */
export function getCachedProfile(username: string): Profile | undefined {
	return globalProfilesCache.get(username.toLowerCase());
}

/**
 * Clears the mention cache
 */
export function clearMentionCache() {
	globalProfilesCache.clear();
	isCacheLoaded = false;
	cacheLoadPromise = null;
}

/**
 * Loads all system profiles into the global cache
 */
export async function loadAllProfilesToCache(): Promise<void> {
	if (isCacheLoaded) {
		return;
	}

	if (cacheLoadPromise) {
		return cacheLoadPromise;
	}

	cacheLoadPromise = (async () => {
		try {
			// Import getProfiles dynamically to avoid circular dependencies
			const { getProfiles } = await import('@/apihandler/Profile');
			const allProfiles = await getProfiles();

			// Handle the API response structure: {success: true, profiles: Array}
			const profiles = allProfiles?.profiles || allProfiles;

			if (profiles && Array.isArray(profiles)) {
				// Add all profiles to the global cache
				profiles.forEach((profile: any) => {
					if (profile.userName && profile.walletAddress) {
						globalProfilesCache.set(profile.userName.toLowerCase(), profile);
					}
				});
				isCacheLoaded = true;
			}
		} catch (error) {
			console.error('Error loading all profiles to cache:', error);
			isCacheLoaded = false;
		}
	})();

	return cacheLoadPromise;
}

/**
 * Gets all cached profiles (loads them if not already loaded)
 */
export async function getAllCachedProfiles(): Promise<Profile[]> {
	await loadAllProfilesToCache();
	return getCachedProfiles();
}

/**
 * Check if cache is loaded
 */
export function isCacheReady(): boolean {
	return isCacheLoaded;
}
