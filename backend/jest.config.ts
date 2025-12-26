module.exports = {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": [
    "<rootDir>"
  ],
  "testMatch": [
    "**/__tests__/**/*.ts",
    "**/*.test.ts"
  ],
  "collectCoverageFrom": [
    "server.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 75,
      "lines": 80,
      "statements": 80
    }
  },
  "setupFilesAfterEnv": [
    "<rootDir>/jest.setup.ts"
  ],
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1"
  },
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "testTimeout": 30000,
  "verbose": true,
  "forceExit": true,
  "clearMocks": true,
  "resetMocks": true,
  "restoreMocks": true
};