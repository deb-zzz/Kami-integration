const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distCjsDir = path.join(__dirname, '..', 'dist-cjs');
const distEsDir = path.join(__dirname, '..', 'dist-es');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

// Helper function to copy all files from source to dest, renaming files appropriately
function copyAndRenameFiles(srcDir, destDir, suffix) {
	if (!fs.existsSync(srcDir)) {
		return;
	}

	const files = fs.readdirSync(srcDir);
	
	for (const file of files) {
		const srcPath = path.join(srcDir, file);
		const stat = fs.statSync(srcPath);
		
		if (stat.isFile()) {
			if (file === 'index.js') {
				// Rename index.js to index.{suffix}.js
				const destPath = path.join(destDir, `index.${suffix}.js`);
				fs.copyFileSync(srcPath, destPath);
				
				// Update require/import paths in the file
				let content = fs.readFileSync(destPath, 'utf8');
				if (suffix === 'cjs') {
					// For CommonJS, update require paths to use .cjs.js extension
					content = content.replace(/require\(['"]\.\/(\w+)['"]\)/g, (match, moduleName) => {
						if (moduleName !== 'index') {
							return `require("./${moduleName}.cjs.js")`;
						}
						return match;
					});
				} else if (suffix === 'esm') {
					// For ESM, update import paths to use .esm.js extension
					content = content.replace(/from ['"]\.\/(\w+)['"]/g, (match, moduleName) => {
						if (moduleName !== 'index') {
							return `from "./${moduleName}.esm.js"`;
						}
						return match;
					});
				}
				fs.writeFileSync(destPath, content, 'utf8');
			} else if (file === 'index.d.ts') {
				// Copy index.d.ts as-is (only from CJS build)
				if (suffix === 'cjs') {
					const destPath = path.join(destDir, 'index.d.ts');
					fs.copyFileSync(srcPath, destPath);
				}
			} else if (file.endsWith('.d.ts')) {
				// Copy all other .d.ts files without suffix (only from CJS build)
				// Type definitions are the same for both CJS and ESM
				if (suffix === 'cjs') {
					const destPath = path.join(destDir, file);
					fs.copyFileSync(srcPath, destPath);
				}
			} else if (file.endsWith('.js')) {
				// Copy all other .js files with suffix
				const baseName = file.replace('.js', '');
				const destPath = path.join(destDir, `${baseName}.${suffix}.js`);
				fs.copyFileSync(srcPath, destPath);
			}
		}
	}
}

// Copy CommonJS build
copyAndRenameFiles(distCjsDir, distDir, 'cjs');

// Copy ESM build
copyAndRenameFiles(distEsDir, distDir, 'esm');

// Clean up temp directories
if (fs.existsSync(distCjsDir)) {
	fs.rmSync(distCjsDir, { recursive: true, force: true });
}
if (fs.existsSync(distEsDir)) {
	fs.rmSync(distEsDir, { recursive: true, force: true });
}

console.log('Build outputs processed successfully');

