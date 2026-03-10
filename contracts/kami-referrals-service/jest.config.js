module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  testPathIgnorePatterns: ["/node_modules/", "/test/solidity/"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
  ],
  moduleFileExtensions: ["ts", "js", "json"],
  setupFilesAfterEnv: [],
};

