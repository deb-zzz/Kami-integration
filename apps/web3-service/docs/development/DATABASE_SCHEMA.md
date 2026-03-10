# KAMI Platform Web3 Service - Database Schema

## Table of Contents

1. [Overview](#overview)
2. [Core Models](#core-models)
3. [User Management](#user-management)
4. [Project & Product Management](#project--product-management)
5. [Blockchain & Transactions](#blockchain--transactions)
6. [Social Features](#social-features)
7. [E-commerce](#e-commerce)
8. [Administration](#administration)
9. [Relationships](#relationships)
10. [Indexes](#indexes)

## Overview

The KAMI Platform database schema is designed to support a comprehensive NFT marketplace with gasless operations, multi-chain support, and social features. The schema uses PostgreSQL with Prisma ORM for type-safe database operations.

### Key Design Principles

-   **Normalization**: Proper database normalization to avoid data redundancy
-   **Relationships**: Well-defined relationships between entities
-   **Indexing**: Strategic indexing for optimal query performance
-   **Constraints**: Data integrity through proper constraints
-   **Extensibility**: Schema designed for future enhancements

The schema lives in the git submodule `kami-platform-v1-schema/prisma/schema.prisma`. See [Architecture](./ARCHITECTURE.md) for system design and [README](../../README.md) for project overview and API list.

## Core Models

### User Management

#### user

Primary user model storing wallet addresses and profile information.

```sql
model user {
  walletAddress String  @id
  userName      String  @unique
  tagLine       String?
  description   String? @db.Text
  firstName     String?
  lastName      String?
  avatarUrl     String?
  bannerUrl     String?
  idNumber      String?
  createdAt     Int
  updatedAt     Int?

  -- NFT Information
  nftAddresses String?
  nftTokenId   Int?
  tbaAddresses String?

  -- Social Media Links
  fbUrl        String?
  instagramUrl String?
  xUrl         String?
  linkedInUrl  String?
  farcasterId  String?
  youtubeUrl   String?
  telegramUrl  String?

  -- Daily Preferences
  todaysFilm     String?
  todaysMusic    String?
  todaysGame     String?
  todaysFood     String?
  todaysBeverage String?
  todaysArt      String?

  -- Profile Settings
  showSpotlight Boolean @default(false)
  pinnedPostId Int?

  -- Relationships
  assets             asset[]
  project            project[]       @relation("Owner")
  logs               logs[]          @relation("Primary")
  relatedLogs        logs[]          @relation("Secondary")
  likedBy            like[]          @relation("likedBy")
  likes              like[]          @relation("likes")
  follows            follow[]        @relation("followedBy")
  followedBy         follow[]        @relation("following")
  tippedBy           tip[]           @relation("tippedBy")
  tipped             tip[]           @relation("tipped")
  playlist           playlist[]
  subscriptions      subscription[]  @relation("subscriber")
  referral           referral[]
  affiliate          affiliate[]
  cartItems          cartItems[]
  vouchers           voucher[]
  postsCreated       post[]          @relation("postCreatedBy")
  postsReposted      post[]          @relation("postPostedBy")
  comments           comment[]       @relation("comments")
  bookmarks          post[]          @relation("bookmarked")
  tags               tag[]
  product            product[]
  ownedSubscriptions subscription[]  @relation("subscriptionOwner")
  collections        collection[]    @relation("collectionOwner")
  postsShareed       post[]          @relation("postsShared")
  collectionsShared  collection[]    @relation("collectionsShared")
  productsShared     product[]       @relation("productsShared")
  collectionFollower collection[]    @relation("collectionFollowers")
  collaborations     collaborators[]
  notifications      notifications[] @relation("Notifications")
  buyerOrders        order[]         @relation("buyerOrders")
  sellerOrders       order[]         @relation("sellerOrders")
  checkouts          checkout[]
}
```

#### account

Blockchain account information for multi-chain support.

```sql
model account {
  walletAddress String      @id
  chainId       String?
  pk            String
  email         String?
  phone         String?
  createdAt     Int
  updatedAt     Int?
  blockchain    blockchain? @relation(fields: [chainId], references: [chainId])

  @@unique([walletAddress, chainId])
}
```

## Project & Product Management

### project

Project management for NFT collections and creative works.

```sql
model project {
  id                Int             @id @default(autoincrement())
  walletAddress     String
  name              String
  description       String?
  mediaUrl          String?
  whiteboardUrl     String?
  status            ProjectStatus   @default(Create)
  categoryId        Int?
  royaltyPercentage Float?
  draft             Json?
  createdAt         Int
  updatedAt         Int?

  -- Relationships
  user              user            @relation("Owner", fields: [walletAddress], references: [walletAddress])
  assets            asset[]
  voucher           voucher[]
  attachment        attachment[]
  product           product[]
  collection        collection?
  category          categories?     @relation(fields: [categoryId], references: [id])
  collaborators     collaborators[]

  @@unique([walletAddress, name])
}

enum ProjectStatus {
  Create
  Monitize
  Bundle
  Publish
}
```

### collection

NFT collection contracts deployed on blockchain.

```sql
model collection {
  collectionId       Int          @id @default(autoincrement())
  projectId          Int          @unique
  name               String
  symbol             String
  description        String?
  avatarUrl          String?
  bannerUrl          String?
  chainId            String
  contractAddress    String?      @unique
  contractType       ContractType @default(ERC721C)
  ownerWalletAddress String
  createdAt          Int

  -- Relationships
  owner       user          @relation("collectionOwner", fields: [ownerWalletAddress], references: [walletAddress])
  products    product[]
  likes       like[]
  followers   user[]        @relation("collectionFollowers")
  shares      user[]        @relation("collectionsShared")
  vouchers    voucher[]
  asset       asset[]
  attachment  attachment[]
  postContent postContent[]
  project     project       @relation(fields: [projectId], references: [id])
  trending    trending?
}

enum ContractType {
  ERC721AC
  ERC721C
  ERC1155C
  ERC20
}
```

### product

Product definitions for NFTs and digital assets.

```sql
model product {
  id                 Int             @id @default(autoincrement())
  name               String
  description        String?
  type               ProductType     @default(Standard)
  price              Decimal?
  availableQuantity  Int             @default(1)
  ownerWalletAddress String
  canSubscribe       Boolean         @default(false)
  subscriptionValue  Decimal?
  forSale            Boolean         @default(true)
  audience           ProductAudience @default(Public)
  consumerAction     ConsumerAction  @default(Buy)
  whitelist          Json?
  spotlight          Boolean         @default(false)

  projectId    Int
  collectionId Int?
  createdAt    Int

  -- Relationships
  owner        user           @relation(fields: [ownerWalletAddress], references: [walletAddress])
  tags         tag[]
  likes        like[]
  follows      follow[]
  asset        asset?
  voucher      voucher?
  playlistItem playlistItem[]
  tip          tip[]
  affiliate    affiliate[]
  cartItems    cartItems[]
  subscribers  subscription[]
  project      project        @relation(fields: [projectId], references: [id])
  shares       user[]         @relation("productsShared")
  collection   collection?    @relation(fields: [collectionId], references: [collectionId])
  bundle       attachment[]
  postContent  postContent[]
  trending     trending?
  orderItem    orderItem[]
}

enum ProductType {
  Standard  // ERC721C
  Claimable // ERC721AC
  Series    // ERC1155C
}

enum ProductAudience {
  Public
  Private
  Whitelist
}

enum ConsumerAction {
  Buy
  Subscribe
  Rent
  Claim
  None
}
```

### asset

Individual NFT assets minted on blockchain.

```sql
model asset {
  id                Int          @id @default(autoincrement())
  walletAddress     String
  chainId           String?
  contractAddress   String
  tokenId           String
  metadata          Json?
  metadataURI       String?
  mediaUrl          String?
  animationUrl      String?
  availableQuantity Int          @default(1)
  projectId         Int?
  productId         Int?         @unique
  collectionId      Int?
  tbaAddress        String?
  thumbnailUrl      String?
  contractType      ContractType @default(ERC721C)
  createdAt         Int
  tags              tag[]

  -- Relationships
  user              user         @relation(fields: [walletAddress], references: [walletAddress])
  project           project?     @relation(fields: [projectId], references: [id])
  product           product?     @relation(fields: [productId], references: [id])
  collection        collection?  @relation(fields: [collectionId], references: [collectionId])

  @@unique([walletAddress, contractAddress, tokenId])
}
```

### voucher

Lazy minting vouchers for gasless NFT creation.

```sql
model voucher {
  id              Int          @id @default(autoincrement())
  walletAddress   String
  contractAddress String?
  tokenId         String
  mediaUrl        String?
  animationUrl    String?
  metadata        Json
  projectId       Int?
  productId       Int?         @unique
  collectionId    Int?
  contractType    ContractType @default(ERC721C)
  createdAt       Int
  tags            tag[]
  trending        trending?

  -- Relationships
  user            user         @relation(fields: [walletAddress], references: [walletAddress])
  project         project?     @relation(fields: [projectId], references: [id])
  product         product?     @relation(fields: [productId], references: [id])
  collection      collection?  @relation(fields: [collectionId], references: [collectionId])
}
```

## Blockchain & Transactions

### blockchain

Supported blockchain networks configuration.

```sql
model blockchain {
  chainId       String          @id
  name          String
  logoUrl       String?
  rpcUrl        String
  createdAt     Int             @default(dbgenerated("extract(epoch from now())::int"))
  updatedAt     Int             @default(dbgenerated("extract(epoch from now())::int"))
  paymentTokens payment_token[]
  transaction   transaction[]
  account       account[]
}
```

### payment_token

Payment tokens supported on each blockchain.

```sql
model payment_token {
  id              Int        @id @default(autoincrement())
  chainId         String
  contractAddress String
  name            String
  symbol          String
  decimals        Int
  logoUrl         String?
  createdAt       Int        @default(dbgenerated("extract(epoch from now())::int"))
  updatedAt       Int        @default(dbgenerated("extract(epoch from now())::int"))
  blockchain      blockchain @relation(fields: [chainId], references: [chainId])
}
```

### transaction

Blockchain transaction records.

```sql
model transaction {
  hash             String              @id
  chainId          String
  from             String
  to               String
  value            String
  valueFormatted   String
  gasLimit         String
  gasPrice         String
  gasUsed          String?
  blockNumber      Int?
  blockHash        String?
  transactionIndex Int?
  status           Int?
  nonce            Int
  data             String
  type             Web3TransactionType @default(Deploy721C)
  timestamp        BigInt
  blockchain       blockchain          @relation(fields: [chainId], references: [chainId])
}

enum Web3TransactionType {
  Deploy721C
  Deploy721AC
  Deploy1155C
  Mint721C
  Mint721AC
  Mint1155C
  Burn721C
  Burn721AC
  Burn1155C
  Buy
  Rent
  EndRental
  ExtendRental
  SetPrice
  SetTokenURI
  SetRoyaltyReceivers
}
```

### platform

Platform contract addresses for gasless operations.

```sql
model platform {
  chainId                         String @id
  simpleAccountAddress            String
  contractDeployerAddress         String
  platformFundingWalletAddress    String
  platformFundingWalletPrivateKey String
  platformAddress                 String
  kamiNFTCoreLibraryAddress       String
  kamiPlatformLibraryAddress      String
  kamiRoyaltyLibraryAddress       String
  kamiRentalLibraryAddress        String
  kamiTransferLibraryAddress      String
  createdAt                       Int    @default(dbgenerated("extract(epoch from now())::int"))
  updatedAt                       Int    @default(dbgenerated("extract(epoch from now())::int"))
}
```

## Social Features

### post

Social media posts and content.

```sql
model post {
  id               Int           @id @default(autoincrement())
  parentPostId     Int?
  createdByAddress String
  createdAt        Int
  postedByAddress  String
  postedAt         Int
  views            Int           @default(0)
  caption          String?
  status           PostStatus    @default(Published)

  -- Relationships
  createdBy        user          @relation("postCreatedBy", fields: [createdByAddress], references: [walletAddress])
  postedBy         user          @relation("postPostedBy", fields: [postedByAddress], references: [walletAddress])
  content          postContent[]
  comments         comment[]     @relation("comments")
  likes            like[]
  sharedBy         user[]        @relation("postsShared")
  savedBy          user[]        @relation("bookmarked")
  affiliate        affiliate[]
  trending         trending?
  parentPost       post?         @relation("childPosts", fields: [parentPostId], references: [id])
  childPosts       post[]        @relation("childPosts")
  user             user[]        @relation("pinnedPost")
}

enum PostStatus {
  Draft
  Published
}
```

### like

Like system for posts, products, and collections.

```sql
model like {
  id                     Int         @id @default(autoincrement())
  fromWalletAddress      String
  toWalletAddress        String
  entityType             EntityType
  postId                 Int?
  productId              Int?
  createdAt              Int

  -- Relationships
  fromUser               user        @relation("likedBy", fields: [fromWalletAddress], references: [walletAddress])
  toUser                 user?       @relation("likes", fields: [toWalletAddress], references: [walletAddress])
  post                   post?       @relation(fields: [postId], references: [id])
  product                product?    @relation(fields: [productId], references: [id])
  collection             collection? @relation(fields: [collectionCollectionId], references: [collectionId])
  collectionCollectionId Int?
  comment                comment?    @relation(fields: [commentId], references: [id])
  commentId              Int?
}

enum EntityType {
  Asset
  Project
  User
  Post
  Repost
  Collection
  Comment
  ReplyToComment
  Product
  Playlist
  Voucher
  Subscription
  Transaction
  Referral
  Affiliate
  Like
  Follow
  Tip
  InviteCollaborator
  Collaborate
  QueryCollaboratorMonitization
  Tag
}
```

### follow

Follow system for users and products.

```sql
model follow {
  id                Int        @id @default(autoincrement())
  fromWalletAddress String
  toWalletAddress   String
  entityType        EntityType
  productId         Int?
  createdAt         Int

  -- Relationships
  fromUser          user       @relation("followedBy", fields: [fromWalletAddress], references: [walletAddress])
  toUser            user       @relation("following", fields: [toWalletAddress], references: [walletAddress])
  product           product?   @relation(fields: [productId], references: [id])

  @@unique([fromWalletAddress, toWalletAddress, entityType])
}
```

### tip

Tipping system for creators and content.

```sql
model tip {
  id                Int        @id @default(autoincrement())
  fromWalletAddress String
  toWalletAddress   String
  entityType        EntityType
  productId         Int?
  value             Decimal    @default(0)
  createdAt         Int

  -- Relationships
  fromUser          user       @relation("tippedBy", fields: [fromWalletAddress], references: [walletAddress])
  toUser            user       @relation("tipped", fields: [toWalletAddress], references: [walletAddress])
  product           product?   @relation(fields: [productId], references: [id])
}
```

## E-commerce

### checkout

Checkout sessions for purchasing NFTs.

```sql
model checkout {
  id                String              @default(uuid()) /// PK: Checkout unique ID
  userWalletAddress String              @map("user_wallet_address") /// FK: References user performing the checkout
  subtotal          Decimal             @default(0) @map("subtotal") /// Sum of orders total before the charges
  totalCharges      Decimal             @default(0) @map("total_charges") /// Total amount of charges applied to the checkout
  totalAmount       Decimal             @default(0) @map("total_amount") /// Final total amount after charges to pay at checkout
  createdAt         BigInt              @map("create_at") /// UNIX timestamp of checkout creation
  checkoutCharges   checkoutCharge[]
  orders            order[]
  user              user                @relation(fields: [userWalletAddress], references: [walletAddress], map: "fk_checkout_user")
  transactions      walletTransaction[]

  @@id([id], map: "pk_checkout")
  @@map("checkout")
}
```

### order

Order management for purchases.

```sql
model order {
  id                String      @default(uuid()) /// PK: Order unique ID
  checkoutId        String      @map("checkout_id") /// FK: References checkout the orders created from
  paymentId         String?     @map("payment_id") /// Optional FK: References Transaction once ID is created
  paymentType       PaymentType @map("payment_type") /// Enum indicator which payment type used
  currency          String?     @map("currency") /// Fiat currency or crypto token based on payment type
  fromWalletAddress String      @map("from_wallet_address") /// FK: References buyer user the order belongs to
  toWalletAddress   String      @map("to_wallet_address") /// FK: References seller user to receive the payment
  status            OrderStatus @default(New) @map("status") /// Status of order
  amount            Decimal     @default(0) @map("amount") /// Total amount of the order
  createdAt         BigInt      @map("created_at") /// UNIX timestamp of order creation
  updatedAt         BigInt?     @map("updated_at") /// UNIX timestamp of last order update
  orderItems        orderItem[]
  buyer             user        @relation(name: "buyerOrders", fields: [fromWalletAddress], references: [walletAddress], map: "fk_orders_user_buyer")
  seller            user        @relation(name: "sellerOrders", fields: [toWalletAddress], references: [walletAddress], map: "fk_orders_user_seller")
  checkout          checkout    @relation(fields: [checkoutId], references: [id], map: "fk_orders_checkout")

  @@id([id], map: "pk_orders")
  @@map("orders") // Adjusted to avoid postgresql reserved keywords
}

enum OrderStatus {
  New       @map("new")
  Pending   @map("pending")
  Paid      @map("paid")
  Completed @map("completed")
  Cancelled @map("cancelled")
  Failed    @map("failed")
}

enum PaymentType {
  Crypto @map("crypto")
  Fiat   @map("fiat")
}
```

### orderItem

Individual items within orders.

```sql
model orderItem {
  id             String          @default(uuid()) /// PK: Order Item unique ID
  orderId        String          @map("order_id") /// FK: References Order the item belongs to
  productId      Int             @map("product_id") /// FK: References Product for details
  checkoutAction CheckoutActions @map("checkout_action") /// Checkout action type of item
  unitPrice      Decimal         @map("unit_price") /// Snapshot of item unit price at checkout
  quantity       Int             @map("quantity") /// Order quantity of item.
  subtotal       Decimal         @default(0) @map("subtotal") /// Subtotal of item = unitPrice * quantity
  order          order           @relation(fields: [orderId], references: [id], map: "fk_orderItem_order", onDelete: Cascade)
  product        product         @relation(fields: [productId], references: [id], map: "fk_orderItem_product")

  @@id([id], map: "pk_order_item")
  @@map("order_item")
}

enum CheckoutActions {
  None
  BuyAndTransfer
  BuyAndMint
  BuyService
  Rent
}
```

## Administration

### administrator

Administrator accounts for platform management.

```sql
model administrator {
  email               String     @map("email") /// PK: Unique Identifier (Email address of admin user)
  name                String?    @map("name") /// Name of admin user
  passwordHash        String     @default("") @map("password_hash") /// Encrypted password of admin user
  roleId              String     @default("default") @map("role_id") /// FK: References Role of admin user
  status              String     @default("active") @map("status") /// Current status of admin user
  failedLoginAttempts Int        @default(0) @map("failed_login_attempts")
  createdAt           Int        @default(0) @map("created_at") /// UNIX timestamp of admin user creation
  updatedAt           Int        @default(0) @map("updated_at") /// UNIX timestamp of last admin user update
  deletedAt           Int?       @map("deleted_at") /// UNIX timestamp of admin user deletion
  lockedAt            Int?       @map("locked_at") /// UNIX timestamp of admin user account got locked
  lastLoginAt         Int?       @map("last_login_at") /// UNIX timestamp of admin user last login
  role                role       @relation(fields: [roleId], references: [id], map: "fk_administrators_role")
  currenciesUpdated   currency[]

  @@id([email], map: "pk_administrator")
  @@unique([email], map: "uk_administrator_email")
  @@index([status, deletedAt], name: "idx_administrator_status_deleted")
  @@map("administrator")
}
```

### role

Role-based access control for administrators.

```sql
model role {
  id                String           @map("id") /// Machine-readable ID
  name              String           @map("name") /// Human-readable name
  description       String?          @map("description") /// Optional: description about role
  isSystemGenerated Boolean          @default(false) @map("is_system_generated") /// Flag indicate system/user-defined role
  createdAt         Int              @map("created_at") /// UNIX timestamp of role creation
  updatedAt         Int              @map("updated_at") /// UNIX timestamp of last role update
  permissionRoles   permissionRole[]
  administrators    administrator[]

  @@id([id], map: "pk_roles")
  @@map("roles")
}
```

## Relationships

### Key Relationships

```
user (1) ──→ (many) project
project (1) ──→ (1) collection
collection (1) ──→ (many) product
product (1) ──→ (1) asset
product (1) ──→ (1) voucher
user (1) ──→ (many) checkout
checkout (1) ──→ (many) order
order (1) ──→ (many) orderItem
user (1) ──→ (many) post
post (1) ──→ (many) comment
user (1) ──→ (many) like
user (1) ──→ (many) follow
user (1) ──→ (many) tip
```

### Many-to-Many Relationships

-   **user ↔ product** (shares, likes, follows)
-   **user ↔ collection** (follows, shares)
-   **user ↔ post** (likes, shares, bookmarks)
-   **product ↔ tag** (categorization)
-   **asset ↔ tag** (categorization)
-   **voucher ↔ tag** (categorization)

## Indexes

### Primary Indexes

-   All `@id` fields are automatically indexed
-   All `@unique` fields are automatically indexed

### Custom Indexes

-   `idx_administrator_status_deleted` on `administrator(status, deletedAt)`
-   `idx_checkout_id` on `walletTransaction(checkoutId)`

### Composite Indexes

-   `[walletAddress, contractAddress, tokenId]` on `asset`
-   `[walletAddress, name]` on `project`
-   `[walletAddress, chainId]` on `account`
-   `[fromWalletAddress, toWalletAddress, entityType]` on `follow`
-   `[type, tag]` on `tag`
-   `[productId, order]` on `attachment`

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Database**: PostgreSQL with Prisma ORM
