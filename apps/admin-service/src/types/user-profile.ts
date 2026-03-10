// User Profile API Response Types

export type UserProfileResponse = {
	success: boolean;
	profile: UserProfile;
};

export type UserProfile = {
	walletAddress: string;
	userName: string;
	tagLine: string | null;
	description: string | null;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
	idNumber: string | null;
	createdAt: number;
	updatedAt: number | null;

	// Account Info
	account: {
		email: string | null;
		phone: string | null;
		createdAt: number | null;
		updatedAt: number | null;
	};

	// NFT & TBA
	nft: {
		nftAddresses: string | null;
		nftTokenId: number | null;
		tbaAddresses: string | null;
	};

	// Socials
	social: {
		fbUrl: string | null;
		instagramUrl: string | null;
		xUrl: string | null;
		linkedInUrl: string | null;
		farcasterId: string | null;
		youtubeUrl: string | null;
		telegramUrl: string | null;
	};

	// Today's Pick
	todays: {
		film: string | null;
		music: string | null;
		game: string | null;
		food: string | null;
		beverage: string | null;
		art: string | null;
	};

	// Pinned Post
	pinnedPost: {
		id: number;
		caption: string | null;
		createdAt: number;
	} | null;

	// Tags
	tags: Array<{
		id: number;
		type: string;
		tag: string;
	}>;

	// Counts
	counts: {
		// Content
		assets: number;
		project: number;
		product: number;
		collections: number;
		postsCreated: number;
		comments: number;
		vouchers: number;

		// Social
		likes: number;
		likedBy: number;
		follows: number;
		followedBy: number;

		// Subscriptions
		subscriptions: number;
		ownedSubscriptions: number;

		// Cart
		cartItems: number;

		// Notications
		notifications: number;
	};

	// Financials
	financials: {
		tipsReceived: {
			count: number;
			total: number;
		};
		tipsGiven: {
			count: number;
			total: number;
		};
		buyerOrders: {
			count: number;
			total: number;
		};
		sellerOrders: {
			count: number;
			total: number;
		};
	};

	// Whitelist
	whitelist: {
		status: boolean;
		id: number | null;
		createdAt: number | null;
	};
};

export type UserProfileErrorResponse = {
	error: string;
};
