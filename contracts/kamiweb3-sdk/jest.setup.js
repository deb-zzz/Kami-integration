// Jest setup file to handle BigInt serialization
if (typeof BigInt !== 'undefined') {
	// Override BigInt.prototype.toJSON to return a string representation
	BigInt.prototype.toJSON = function () {
		return this.toString();
	};
}

// Add custom serializer for better error messages
expect.addSnapshotSerializer({
	test: (val) => typeof val === 'bigint',
	print: (val) => `BigInt(${val.toString()})`,
});

// Handle BigInt in error messages
const originalError = Error;
global.Error = class extends originalError {
	constructor(message, ...args) {
		if (typeof message === 'string') {
			// Replace BigInt values in error messages with string representations
			message = message.replace(/(\d+n)/g, (match) => `"${match}"`);
		}
		super(message, ...args);
	}
};

// Mock console methods to reduce noise in tests
global.console = {
	...console,
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};
