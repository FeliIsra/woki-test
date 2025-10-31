const { resolve } = require('path');

const rootDir = __dirname;

/** @type {import('jest').Config} */
module.exports = {
  rootDir,
  collectCoverage: true,
  coverageDirectory: resolve(rootDir, 'coverage'),
  coverageReporters: ['lcov', 'text', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 0.8,
      functions: 0.8,
      lines: 0.8,
      statements: 0.8
    }
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  roots: ['<rootDir>/test'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  testMatch: ['**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-tests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
