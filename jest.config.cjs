const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './'
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/test-utils/(.*)$': '<rootDir>/src/test-utils/$1',
    '\\.(css|scss|sass)$': 'identity-obj-proxy'
  },
  coveragePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/']
};

module.exports = createJestConfig(customJestConfig);
