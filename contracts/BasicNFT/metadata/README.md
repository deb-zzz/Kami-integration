# NFT Metadata Templates

This directory contains JSON metadata templates for your KAMI NFT collection. These files follow the [OpenSea metadata standards](https://docs.opensea.io/docs/metadata-standards) and can be used as starting points for your NFT metadata.

## Files

-   **`template.json`** - Basic template with common metadata fields
-   **`example-1.json`** - KAMI Warrior example with animation support
-   **`example-2.json`** - KAMI Mage example with detailed attributes
-   **`example-3.json`** - KAMI Guardian example with defensive traits

## Required Fields

### Essential Fields

-   `name` - The name of your NFT
-   `description` - A detailed description of your NFT
-   `image` - URL to the image file (PNG, GIF, MP4, etc.)

### Optional Fields

-   `external_url` - URL to the project website
-   `animation_url` - URL to animation file (MP4, WebM, etc.)
-   `attributes` - Array of trait objects
-   `properties` - Additional properties and files
-   `collection` - Collection information

## Attributes Structure

Attributes define the traits and properties of your NFT:

```json
{
	"trait_type": "Rarity",
	"value": "Legendary"
}
```

### Common Trait Types

-   **Rarity**: Common, Uncommon, Rare, Epic, Legendary, Mythic
-   **Class**: Warrior, Mage, Guardian, Archer, Assassin
-   **Background**: Forest, Volcanic, Mystical, Ocean, Sky
-   **Element**: Fire, Water, Earth, Air, Arcane, Shadow
-   **Power Level**: Numeric value (1-100)
-   **Generation**: Numeric value (1, 2, 3, etc.)

## Usage

1. **Copy a template**: Choose the template that best fits your NFT concept
2. **Customize the content**: Update the name, description, and attributes
3. **Upload your assets**: Host your images and animations on IPFS or a web server
4. **Update URLs**: Replace example URLs with your actual asset URLs
5. **Deploy metadata**: Upload the JSON file to IPFS or your web server
6. **Mint NFT**: Use the metadata URL when calling the `mint()` function

## Example Usage in Contract

```javascript
// When minting an NFT, use the metadata URL
const metadataURL = 'https://ipfs.io/ipfs/QmYourMetadataHash';
await basicNFT.mint(metadataURL, tokenId);
```

## IPFS Integration

For decentralized storage, consider using IPFS:

1. Upload your metadata JSON to IPFS
2. Get the IPFS hash (e.g., `QmYourHash`)
3. Use the IPFS URL: `https://ipfs.io/ipfs/QmYourHash`

## Best Practices

1. **Consistent naming**: Use consistent naming conventions across your collection
2. **Unique attributes**: Ensure each NFT has unique trait combinations
3. **High-quality images**: Use high-resolution images (at least 512x512)
4. **Descriptive text**: Write engaging descriptions that tell a story
5. **Rarity distribution**: Plan your rarity distribution carefully
6. **Test metadata**: Always test your metadata URLs before minting

## Validation

You can validate your metadata using:

-   [OpenSea's metadata validator](https://docs.opensea.io/docs/metadata-standards)
-   [NFT metadata validator tools](https://nft-metadata-validator.vercel.app/)

## Support

For questions about metadata standards, refer to:

-   [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
-   [ERC-721 Metadata JSON Schema](https://eips.ethereum.org/EIPS/eip-721)
