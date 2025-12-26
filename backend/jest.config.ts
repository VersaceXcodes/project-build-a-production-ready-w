export default {
  "preset": "ts-jest/presets/default-esm",
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
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  "extensionsToTreatAsEsm": [".ts"],
  "transform": {
    "^.+\\.ts$": ["ts-jest", { "useESM": true }]
  },
  "testTimeout": 30000,
  "verbose": true,
  "forceExit": true,
  "clearMocks": true,
  "resetMocks": true,
  "restoreMocks": true
};