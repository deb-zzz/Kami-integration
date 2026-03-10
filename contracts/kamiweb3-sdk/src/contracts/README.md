# Contract Wrappers

This directory contains TypeScript classes that wrap the `ethers.js` Contract instances. Each wrapper provides type-safe methods corresponding to the public functions of the underlying Solidity smart contract.

## Files

-   `KAMI721CWrapper.ts` - ERC721C contract wrapper with royalties and rentals
-   `KAMI721ACWrapper.ts` - ERC721AC contract wrapper (ERC721A-based) with claim functionality
-   `KAMI1155CWrapper.ts` - ERC1155C contract wrapper with multi-token support

## Features

-   **Ethers v6 Compatible**: All wrappers use ethers v6 types and imports
-   **Type Safe**: Full TypeScript support with proper type definitions
-   **Error Handling**: Comprehensive error handling for contract operations
-   **Gas Optimization**: Efficient method calls with proper overrides support
