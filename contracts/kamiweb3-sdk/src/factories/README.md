# Contract Factories

This directory contains factory classes responsible for deploying new instances of the KAMI smart contracts or attaching to existing ones.

## Files

-   `KAMI721CFactory.ts` - Factory for ERC721C contract deployment and attachment
-   `KAMI721ACFactory.ts` - Factory for ERC721AC contract deployment and attachment
-   `KAMI1155CFactory.ts` - Factory for ERC1155C contract deployment and attachment

## Features

-   **Standard Deployment**: Deploy standard (non-upgradeable) contracts
-   **Upgradeable Deployment**: Deploy upgradeable contracts using Transparent Proxy pattern
-   **Contract Attachment**: Attach to existing deployed contracts
-   **Ethers v6 Compatible**: All factories use ethers v6 types and imports
-   **Type Safe**: Full TypeScript support with proper type definitions
