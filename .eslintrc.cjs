module.exports = {
  root: true,
  parserOptions: {
    project: './tsconfig.json'
  },
  extends: ['next/core-web-vitals', 'plugin:testing-library/react', 'prettier'],
  rules: {
    'testing-library/no-node-access': 'off',
    'testing-library/no-container': 'off'
  }
};
