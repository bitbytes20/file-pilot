const sharedConfig = require('@filepilot/config/eslint');

module.exports = {
  ...sharedConfig,
  root: true,
  parserOptions: {
    ...sharedConfig.parserOptions,
    tsconfigRootDir: __dirname,
  },
};
