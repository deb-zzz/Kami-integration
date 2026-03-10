const { ethers } = require('hardhat');

async function main() {
	console.log('=== NFT Contract Interaction Example ===\n');

	// Get signers
	const [deployer, user1] = await ethers.getSigners();
	console.log('Deployer:', deployer.address);
	console.log('User1:', user1.address);

	// Deploy contracts fresh for this interaction
	console.log('\n=== Deploying Contracts ===');
	const PaymentToken = await ethers.getContractFactory('PaymentToken');
	const BasicNFT = await ethers.getContractFactory('BasicNFT');

	// Deploy PaymentToken
	const paymentToken = await PaymentToken.deploy('KAMI Token', 'KAMI', 18, ethers.parseEther('1000000'));
	await paymentToken.waitForDeployment();
	console.log('PaymentToken deployed to:', await paymentToken.getAddress());

	// Deploy BasicNFT
	const basicNFT = await BasicNFT.deploy('KAMI NFT Collection', 'KAMINFT', await paymentToken.getAddress(), 18, ethers.parseEther('10'));
	await basicNFT.waitForDeployment();
	console.log('BasicNFT deployed to:', await basicNFT.getAddress());

	console.log('\n=== Contract Information ===');
	console.log('Payment Token:', await paymentToken.name(), `(${await paymentToken.symbol()})`);
	console.log('NFT Collection:', await basicNFT.name(), `(${await basicNFT.symbol()})`);
	console.log('Mint Price:', ethers.formatEther(await basicNFT.mintPrice()), 'KAMI tokens');

	// Check balances
	console.log('\n=== Initial Balances ===');
	const deployerBalance = await paymentToken.balanceOf(deployer.address);
	const user1Balance = await paymentToken.balanceOf(user1.address);
	console.log('Deployer KAMI balance:', ethers.formatEther(deployerBalance));
	console.log('User1 KAMI balance:', ethers.formatEther(user1Balance));

	// Transfer some tokens to user1 if they don't have enough
	const mintPrice = await basicNFT.mintPrice();
	if (user1Balance < mintPrice) {
		console.log('\n=== Transferring tokens to User1 ===');
		const transferAmount = ethers.parseEther('100');
		await paymentToken.transfer(user1.address, transferAmount);
		console.log('Transferred 100 KAMI tokens to User1');
	}

	// User1 approves the NFT contract to spend tokens (enough for 2 mints)
	console.log('\n=== User1 approving NFT contract ===');
	const approvalAmount = mintPrice * 2n; // Approve for 2 mints
	await paymentToken.connect(user1).approve(await basicNFT.getAddress(), approvalAmount);
	console.log('User1 approved NFT contract to spend', ethers.formatEther(approvalAmount), 'KAMI tokens');

	// User1 mints an NFT with specific ID
	console.log('\n=== User1 minting NFT with specific ID ===');
	const tokenId = 5; // Use a different ID to avoid conflicts
	const tokenURI = 'https://ipfs.io/ipfs/QmExampleHash1'; // Example IPFS URL - use metadata templates from metadata/ directory
	await basicNFT.connect(user1).mint(tokenURI, tokenId);
	console.log(`User1 minted NFT with ID ${tokenId} and URI: ${tokenURI}`);

	// Check NFT ownership
	console.log('\n=== NFT Ownership Check ===');
	const owner = await basicNFT.ownerOf(tokenId);
	const retrievedURI = await basicNFT.tokenURI(tokenId);
	console.log(`NFT ${tokenId} owner:`, owner);
	console.log(`NFT ${tokenId} URI:`, retrievedURI);

	// User1 mints another NFT with auto-incrementing ID
	console.log('\n=== User1 minting NFT with auto-incrementing ID ===');
	const autoTokenURI = 'https://ipfs.io/ipfs/QmExampleHash2'; // Example IPFS URL
	await basicNFT.connect(user1).mintWithAutoId(autoTokenURI);
	console.log(`User1 minted NFT with auto-incrementing ID and URI: ${autoTokenURI}`);

	// Check next token ID
	const nextTokenId = await basicNFT.getNextTokenId();
	console.log('Next token ID that will be minted:', nextTokenId.toString());

	// Check final balances
	console.log('\n=== Final Balances ===');
	const finalDeployerBalance = await paymentToken.balanceOf(deployer.address);
	const finalUser1Balance = await paymentToken.balanceOf(user1.address);
	console.log('Deployer KAMI balance:', ethers.formatEther(finalDeployerBalance));
	console.log('User1 KAMI balance:', ethers.formatEther(finalUser1Balance));

	console.log('\n=== Interaction Complete ===');
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
