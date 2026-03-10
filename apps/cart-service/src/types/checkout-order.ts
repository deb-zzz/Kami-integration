type Collection = {
    collectionId: number;
    name: string;
    items: any[];
    total: number;
}

type Seller = {
    walletAddress: string;
    userName: string;
    collections?: Record<number, Collection>;
    total: number;
}

export type SellerGroupedCheckoutItems = Record<string, Seller>
