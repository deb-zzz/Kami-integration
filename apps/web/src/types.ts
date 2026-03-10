import { PaymentType } from './types/cart-types';

export type Profile = {
	_count: {
		cartItems: number;
		followedBy: number;
		likedBy: 1;
		shares: number;
	};
	avatarUrl: string;
	bannerUrl: string;
	createdAt: number;
	firstName: string;
	idNumber: number;
	lastName: string;
	nftAddresses: string;
	nftTokenId: number;
	tbaAddresses: string;
	userName: string;
	walletAddress: string;
	tagLine: string;
	description: string;
	tags: Tag[];
	todaysArt: string;
	todaysBeverage: string;
	todaysFilm: string;
	todaysFood: string;
	todaysGame: string;
	todaysMusic: string;
	xUrl: string;
	linkedInUrl: string;
	instagramUrl: string;
	telegramUrl: string;
	youtubeUrl: string;
	fbUrl: string;
	counts: {
		likes: number;
		follows: number;
		shares: number;
		cartItems: number;
	};

	updatedAt?: number;
	farcasterId?: null;
	collections?: CollectionType[];
	collaboratedProjects?: null;
	followedBy?: [
		{
			id: number;
			fromWalletAddress: string;
			toWalletAddress: string;
			entityType: string;
			productId: number | null;
			createdAt: number;
		},
	];
	showSpotlight: boolean;
};
export type ProfileProduct = Profile & {
	product: ProductType[];
	assets: AssetType[];
};
export type ProfileCreate = {
	firstName?: string;
	lastName?: string;
	userName: string;
	walletAddress: string;

	avatarUrl?: string;
	bannerUrl?: string;
	tagLine?: string;
	description?: string;

	todaysArt?: string;
	todaysBeverage?: string;
	todaysFilm?: string;
	todaysFood?: string;
	todaysGame?: string;
	todaysMusic?: string;

	xUrl?: string;
	linkedInUrl?: string;
	instagramUrl?: string;
	fbUrl?: string;
};

export type ProfileEdit = {
	avatarUrl?: string;
	bannerUrl?: string;
	firstName?: string;
	lastName?: string;
	tagLine?: string | null;
	description?: string | null;

	todaysArt?: string;
	todaysBeverage?: string;
	todaysFilm?: string;
	todaysFood?: string;
	todaysGame?: string;
	todaysMusic?: string;

	xUrl?: string;
	linkedInUrl?: string;
	instagramUrl?: string;
	fbUrl?: string;
	telegramUrl?: string;
	youtubeUrl?: string;

	// idNumber?: number;
	// nftAddresses?: string;
	// nftTokenId?: number;
	// tbaAddresses?: string;
	// userName: string;
	// walletAddress: string;
};

export type Tag = {
	createdAt?: number;
	id?: number;
	tag: string;
	type: 'Skill' | 'Interest' | 'Others';
};

export type TodaysStatus = {
	todaysArt: string;
	todaysBeverage: string;
	todaysFilm: string;
	todaysFood: string;
	todaysGame: string;
	todaysMusic: string;
};

export type ProjectType = {
	name: string;
	date: number;
	scrapbook: Scrapbook[];
	isPublished?: boolean;
};

export type Scrapbook = {
	type: string;
	completed: boolean;
};

export type LazyNFT = {
	walletAddress: string;
	collectionId?: number;
	newCollection?: CollectionType;
	price: number;
	tokenId: string;
	projectId: number;
	quantity?: number;
	metadata: Metadata;
	spotlight?: boolean;
	type: 'Standard' | 'Claimable' | 'Series';
	audience?: 'Public' | 'Private' | 'Whitelist';
	consumerAction?: 'Buy' | 'Subscribe' | 'Rent' | 'Claim' | 'None';
};

// export type CreateCollectionBody = {
// 	name: string; // Name of the collection
// 	symbol: string; // Symbol representing the collection
// 	description: string; // Description of the collection
// 	projectId: number; // ID of the associated project
// 	avatarUrl?: string; // Optional URL for the collection's avatar image
// 	bannerUrl?: string; // Optional URL for the collection's banner image
// 	type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
// 	chainId?: string;
// };

export type VoucherContextType = {
	category?: string;
	createType?: 'new' | 'exist';
	projectTitle?: string;
	projectCategory?: string;
	projectId?: number;
	collectionId?: number;
	walletAddress?: string;
	collection?: {
		name?: string;
		symbol?: string;
		description?: string;
		type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
		chainId?: string;
	};
	newCollection?: CollectionType;
	price?: number;
	tokenId?: string;
	quantity?: number;
	spotlight?: boolean;
	metadata?: VoucherMetadata;
	type?: 'Standard' | 'Claimable' | 'Series';
	audience?: 'Public' | 'Private' | 'Whitelist';
	consumerAction?: 'Buy' | 'Subscribe' | 'Rent' | 'Claim' | 'None';

	id?: number;
	contractAddress?: string | null;
	mediaUrl?: string;
	mediaFile?: File;
	coverUrl?: string;
	coverFile?: File;
	animationUrl?: string | null;
	productId?: number;
	contractType?: string;
	createdAt?: number;
	tags?: Tag[];
	currency?: string;
	chainId?: string;
};

export type AssetType = {
	category?: string;
	createType?: 'new' | 'exist';
	projectTitle?: string;
	projectCategory?: string;
	projectId?: number;
	collectionId?: number;
	walletAddress?: string;
	collection?: {
		name?: string;
		symbol?: string;
		description?: string;
		type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
		chainId?: string;
	};
	price?: string;
	tokenId?: string;
	quantity?: number;
	spotlight?: boolean;
	metadata?: VoucherMetadata;
	type?: 'Standard' | 'Claimable' | 'Series';
	audience?: 'Public' | 'Private' | 'Whitelist';
	consumerAction?: 'Buy' | 'Subscribe' | 'Rent' | 'Claim' | 'None';
	contractType?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
	id?: number;
	contractAddress?: string | null;
	mediaUrl?: string;
	mediaFile?: File;
	coverUrl?: string;
	coverFile?: File;
	animationUrl?: string | null;
	productId?: number;
	createdAt?: number;
	tags?: Tag[];
	currency?: string;
	chainId?: string;
	likedByMe?: boolean;
	likes?: number;
	maxQuantity?: number;
	availableQuantity?: number;
	ownerWalletAddress?: string;
	canSubscribe?: boolean;
	subscriptionValue?: string;
	user?: {
		userName: string;
		walletAddress: string;
	};
};

export type VoucherMetadata = {
	name?: string;
	contract_address?: string;
	token_id?: string;
	description?: string;
	image?: string;
	animation_url?: string;
	attributes?: {
		trait_type: string;
		value: string;
	}[];
	properties?: {
		bundle?: {
			uri?: string;
			category?: string;
			type?: string;
			name?: string;
			description?: string;
			ownerDescription?: string;
			assetCover?: string;
			assetCoverFile?: File;
			uriFile?: File;
			// oldItem?: number;
		}[];
		creators?: {
			address?: string;
			name?: string;
			share?: number;
		}[];
		project_creator?: {
			address?: string;
			name?: string;
		};
	};
};

export type Metadata = {
	name: string;
	contract_address?: string;
	token_id?: string;
	description: string;
	image: string;
	animation_url?: string;
	attributes?: {
		trait_type: string;
		value: string;
	}[];
	properties?: {
		bundle?: {
			uri: string;
			type: string;
			name?: string;
			description?: string;
		}[];
		creators?: {
			address: string;
			name?: string;
			share: number;
		}[];
		project_creator?: {
			address: string;
			name?: string;
		};
	};
};

export type FeedType = {
	id: number;
	likes: number;
	likedByMe: boolean;
	repost: boolean;
	shares: number;
	views: number;
	createdAt: number;
	postedAt: number;
	reposts: number;
	content: FeedContent[];
	comments: FeedComment[];
	createdBy: FeedPost;
	postedBy: FeedPost;
	parentPostId: number;
	parentPost: ParentPost;
	caption: string;
	chainId: string;
};

type ParentPost = {
	id: number;
	parentPostId: number;
	productId: number;
	createdByAddress: string;
	createdAt: number;
	postedByAddress: string;
	postedAt: number;
	views: number;
	caption: string;
	status: string;
};

export type FollowingType = {
	followedUserAvatarUrl: string;
	followedUserName: string;
	followedWalletAddress: string;
	posts: FeedType[];
};
export type ExploreType = {
	id: number;
	name: string;
	description: string;
	collectionId: number;
	createdAt: number;
	price: string;
	availableQuantity: number;
	projectId: number;
	mediaUrl: string;
	aspectRatio: number;
	filetype: string;
	animationUrl?: string;
	animationUrlType?: string;
};

export type FeedPost = {
	firstName: string;
	lastName: string;
	avatarUrl: null;
	userName: string;
	walletAddress: string;
};

export type FeedContent = {
	id: number;
	collectionId: number;
	productId: number;
	postId: number;
	collection: CollectionType;
	product: {
		id: 1;
		name: string;
		description: string;
		type: string;
		price: string;
		availableQuantity: 1;
		ownerWalletAddress: string;
		canSubscribe: boolean;
		subscriptionValue: string;
		audience: string;
		consumerAction: string;
		whitelist: null;
		spotlight: boolean;
		projectId: number;
		collectionId: number;
		createdAt: number;
		asset: VoucherContextType[] | null;
		voucher: VoucherContextType;
	};
};

export type FeedComment = {
	id: number | null;
	postId: number;
	createdByAddress: string;
	createdAt?: number;
	comment: string;
	createdByUser: FeedCommentCreator;
	likes: number | 0;
	replyToCommentId: number | null;
	likedByMe: boolean;
	replies: FeedComment[];
};

type FeedCommentCreator = {
	walletAddress: string;
	userName: string;
	avatarUrl: string;
	createdAt: number;
	updatedAt?: number;
};

export type CollaboratorType = {
	id: number;
	projectId: number;
	userWalletAddress: string;
	status: string;
	invitedAt: number;
	respondedAt: number;
	acknowledgedAt: number;
	primaryShare: number;
	secondaryShare: number;
	writeAccess: boolean;
	userProfile: Profile;
	role: string;
	primaryStatus?: string;
	secondaryStatus?: string;
};

export type AllProjectType = {
	id: number;
	walletAddress?: string;
	name: string;
	category?: {
		createdAt: number;
		description: string;
		id: number;
		name: string;
		updatedAt: number;
	};
	user: Profile;
	categoryId?: number;
	description: string;
	mediaUrl?: string | null;
	whiteboardUrl?: string | null;
	status?: string;
	createdAt?: number;
	draft?: string;
	collaborators?: CollaboratorType[];
	collection?: {
		collectionId: number;
		projectId: number;
		name: string;
		symbol: string;
		description: string;
		avatarUrl: string | null;
		bannerUrl: string | null;
		contractAddress: string | null;
		contractType: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
		ownerWalletAddress: string;
		createdAt: number;
		products: ProjectProduct[];
		_count: {
			vouchers: number;
			asset: number;
		};
		chainId: string;
	};
	ownedByMe?: boolean;
	isPublished?: boolean;
	royaltyPercentage?: number | null;
};

type ProjectProduct = {
	id: number;
	name: string;
	description: string;
	type: string;
	price: string;
	availableQuantity: number;
	ownerWalletAddress: string;
	canSubscribe: boolean;
	subscriptionValue: string;
	projectId: number;
	collectionId: number;
	createdAt: number;
	currency?: string;
};

export type ContentType = {
	collectionId?: number;
	productId?: number;
	imageURl: string;
	postId?: number;
	assetId?: number;
};

export type ProductType = {
	id: number;
	name: string;
	description: string;
	price: string;
	availableQuantity: number;
	ownerWalletAddress: string;
	canSubscribe: boolean;
	subscriptionValue: string;
	type?: 'Standard' | 'Claimable' | 'Series';
	audience?: 'Public' | 'Private' | 'Whitelist';
	consumerAction?: 'Buy' | 'Subscribe' | 'Rent' | 'Claim' | 'None';
	whitelist: null;
	spotlight: boolean;
	projectId: number;
	collectionId: number;
	createdAt: number;
	asset: AssetType[] | null;
	voucher: VoucherContextType;
	bundle?: BundleType[];
	collection: CollectionType;
	likes: number;
	owner: Profile;
	tags: Tag[];
	shares: number;
	tip: number;
	mentions: Mention[];
	likedBy: string[];
	productId?: number;
	imageUrl: string;
	traits?: Traits[];
	likedByMe?: boolean;
	collaborators?: Collaborators[];
	creator?: Creator;
	animationUrl?: string;
	project?: AllProjectType;
	currency?: string;
	metadata?: VoucherMetadata;
	maxQuantity?: number;
};

type Collaborators = {
	userProfile: Creator;
	userWalletAddress?: string;
	status: string;
};
export type Creator = {
	walletAddress?: string;
	userName: string;
	avatarUrl: string;
	description: string;
	tagLine?: string;
};

export type Mention = {
	postId: number;
	caption: string;
	likes: number;
	likedByMe: boolean;
	shares: number;
	reposts: number;
	numComments: number;
	creatorWalletAddress: string;
	postedBy: {
		walletAddress: string;
		userName: string;
		avatarUrl: string;
	};
};

export type CollectionType = {
	collectionId: number;
	projectId: number;
	name: string;
	symbol: string;
	description: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
	contractAddress: string | null;
	contractType: string;
	ownerWalletAddress: string;
	createdAt: number;
	products: ProductType[];
	_count?: {
		vouchers: number;
		asset: number;
	};
	owner?: Profile;
	likedByMe: boolean;
	likes: number;
	category?: string;
	collaborators?: Collaborators[];
	chainId?: string;
	type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
};

export type BundleType = {
	url: string;
	type?: string;
	name: string;
	description?: string;
	id?: number;
	coverUrl?: string;
};

export type MetaDataBundleType = {
	uri?: string;
	category?: string;
	type?: string;
	name?: string;
	description?: string;
	ownerDescription?: string;
	assetCover?: string;
	assetCoverFile?: File;
	uriFile?: File;
};
export type Traits = {
	trait_type: string;
	value: string;
};

export type NotificationType = {
	id: number;
	walletAddress: string;
	createdAt: number;
	message: string;
	readAt?: number;
};

export type NotificationPayload = {
	postId?: number;
	projectId?: number;
	productId?: number;
	collectionId?: number;
	projectName?: string;
	walletAddress: string;
	message?: string;
	from: {
		avatarUrl: string;
		userName: string;
		description: string;
		walletAddress?: string;
	};
	collection?: {
		name?: string;
		avatarUrl?: string;
	};
	product?: {
		name?: string;
		avatarUrl?: string;
	};
};

export type NotificationMessage = {
	topic: string;
	payload: NotificationPayload;
	message: string;
};

/**
 * Order notification payload structure
 * Sent via service worker push notifications when order status changes
 */
export interface OrderNotificationPayload {
	checkoutId: string;
	walletAddress: string;
	from: {
		avatarUrl: string | null;
		userName: string | null;
	};
}

/**
 * Order notification message structure
 * Message format: "Your order {checkoutId} has been delivered with status: {status}"
 * Possible statuses: "Failed", "Partial Success", "Success"
 */
export interface OrderNotificationMessage {
	topic: 'order';
	payload: OrderNotificationPayload;
	message: string;
}

/**
 * Extracted order status from notification message
 */
export type OrderNotificationStatus = 'success' | 'partial' | 'failed';

export enum NotificationEntityType {
	Project = 'Project',
	User = 'User',
	Post = 'Post',
	Collection = 'Collection',
	Product = 'Product',
	Playlist = 'Playlist',
	Collaborate = 'Collaborate',
}

export enum NotificationEntitySubType {
	Created = 'Created',
	Updated = 'Updated',
	Deleted = 'Deleted',
	Minted = 'Minted',
	Burned = 'Burned',
	Transferred = 'Transferred',
	CartCheckout = 'CartCheckout',
	Purchased = 'Purchased',
	Subscribed = 'Subscribed',
	Unsubscribed = 'Unsubscribed',
	Liked = 'Liked',
	Unliked = 'Unliked',
	Followed = 'Followed',
	Unfollowed = 'Unfollowed',
	Invited = 'Invited',
	Accepted = 'Accepted',
	Rejected = 'Rejected',
	Removed = 'Removed',
	Withdrawn = 'Withdrawn',
	Replied = 'Replied',
	Shared = 'Shared',
	Commented = 'Commented',
	Posted = 'Posted',
	Reposted = 'Reposted',
	AddedTo = 'AddedTo',
	RemovedFrom = 'RemovedFrom',
	Published = 'Published',
	SetPrice = 'SetPrice',
	SetQuantity = 'SetQuantity',
	SetAudience = 'SetAudience',
	SetConsumerAction = 'SetConsumerAction',
	SetRoyaltyPercentage = 'SetRoyaltyPercentage',
	SetRoyaltyRecipient = 'SetRoyaltyRecipient',
	SetTransferRecipient = 'SetTransferRecipient',
	SetSpotlight = 'SetSpotlight',
	UnsetSpotlight = 'UnsetSpotlight',
	AddedToCart = 'AddedToCart',
	RemovedFromCart = 'RemovedFromCart',
	CheckedOut = 'CheckedOut',
	Rented = 'Rented',
	Returned = 'Returned',
	Claimed = 'Claimed',
	Redeemed = 'Redeemed',
	Expired = 'Expired',
	Refunded = 'Refunded',
	Cancelled = 'Cancelled',
	Completed = 'Completed',
	Failed = 'Failed',
	Succeeded = 'Succeeded',
	Pending = 'Pending',
	Confirmed = 'Confirmed',
	Settled = 'Settled',
	Tipped = 'Tipped',
	Tagged = 'Tagged',
	RemovedTag = 'RemovedTag',
}

export type ActivityType = {
	notification: {
		createdAt: number;
		entityId?: string | null | number;
		entitySubType?: NotificationEntitySubType | null;
		entityType?: NotificationEntityType | null;
		id: number;
		notificationType: 'Notification' | 'Activity';
		profile: {
			avatarUrl: string;
			userName: string;
			walletAddress: string;
		};
		readAt?: null | string;
		walletAddress: string;
		message: string;
	};
	activityTime: string;
	activityText: string;
	category?: 'Social' | 'Collaboration' | 'Marketplace';
};

export type SocialPost = {
	id: number;
	createdAt: number;
	products: {
		productId: number;
		name: string;
		description: string;
		imageUrl: string;
		audience: string;
		collection: {
			collectionId: number;
			name: string;
		};
		trait: Traits[];
	}[];
	comment: FeedComment[];
	likes: number;
	shares: number;
	numComments?: number;
	likedByMe: boolean;
	isRepost: boolean;
	reposts: number;
	caption: string;
	postedBy: {
		avatarUrl: string;
		tagLine: string;
		userName: string;
	};
};

export type FollowersType = {
	followerWalletAddress: string;
	followerUserName: string;
	followerUserAvatarUrl: string;
};

export type CollectionCreateType = {
	type?: 'ERC721AC' | 'ERC721C' | 'ERC1155C' | 'ERC20';
	name: string;
	symbol: string;
	description: string;
	avatarUrl: string | null;
	bannerUrl: string | null;
};

export type PlatformFeeType = {
	id: string;
	typeId: string;
	description: string;
	location: 'Publish' | 'Checkout';
	currency?: string;
	fixedAmount: number;
	percentage: number;
	createdAt: number;
	updatedAt: number;
	chargeType: {
		id: string;
		name: string;
		createdAt: number;
		updatedAt: number;
	};
};

export const enum CurrencyType {
	USDC = 'USDC',
	ETH = 'ETH',
	KAMI = 'KAMI',
	KVT = 'KVT',
}

export type Wallet = {
	type: CurrencyType;
	balance: number;
	value: number;
	icon: string;
	walletAddress: string;
};

export interface Recipient {
	userName: string;
	walletAddress: string;
	avatarUrl: string | null;
}

export interface WalletTransactionResponse {
	success: boolean;
	data: CryptoTransaction[];
	message: string;
}

export interface CryptoTransaction {
	hash: string;
	chainId: string;
	checkoutId: string | null;
	type: string;
	from: string;
	to: string;
	total_amount?: number | string | null;
	value: string;
	valueFormatted: string;
	gasLimit: string;
	gasPrice: string;
	gasUsed: string;
	blockNumber: number;
	blockHash: string;
	transactionIndex: number;
	status: number | null;
	nonce: number;
	data: string;
	timestamp: string;
	tokenData: TokenDatum[];
}

export interface TokenDatum {
	contractAddress: string;
	tokenType: string;
	tokenSymbol: string;
	tokenDecimals: number;
	tokenName: string;
	fromAddress: string;
	toAddress: string;
	tokenAmount: string;
	tokenAmountFormatted: string;
	batch: boolean;
}

export interface WalletBalanceResponse {
	success: boolean;
	data: WalletBalance;
	message: string;
}

export interface WalletBalance {
	address: string;
	ethBalance: string;
	usdcBalance: string;
	ethBalanceFormatted: string;
	usdcBalanceFormatted: string;
}

export interface BlockchainResponse {
	success: boolean;
	data: Blockchain;
	message: string;
}

export interface BlockchainsResponse {
	success: boolean;
	data: Blockchain[];
	message: string;
}

export interface Blockchain {
	chainId: string;
	name: string;
	logoUrl: string;
	rpcUrl: string;
	createdAt: number;
	paymentTokens: PaymentToken[];
}

export interface PaymentToken {
	id: number;
	chainId: string;
	contractAddress: string;
	name: string;
	symbol: string;
	decimals: number;
	logoUrl: string;
	createdAt: number;
}

export interface Currency {
	symbol: string;
	name: string;
	type: PaymentType;
	isActive: boolean;
	createdAt: number;
	updatedAt: number | null;
	updatedBy: string | null;
	deletedAt: number | null;
}

export interface EstimateGasResponse {
	success: boolean;
	data?: {
		estimatedGas: string;
	};
	error?: string;
	message: string;
}

export interface TransferResponse {
	success: boolean;
	data?: CryptoTransferData;
	error?: string;
	message: string;
}

export interface CryptoTransferData {
	hash: string;
	from: string;
	to: string;
	value: string;
	valueFormatted: string;
	gasLimit: string;
	gasPrice: string;
	gasUsed: string;
	blockNumber: number;
	blockHash: string;
	transactionIndex: number;
	status: number;
	nonce: number;
	data: string;
}
