export default {
  '*.{js,jsx,ts,tsx,cjs,mjs,json,md,yml,yaml}': ['pnpm exec prettier --write'],
  '*.{ts,tsx,js,jsx,cjs,mjs}': ['pnpm exec eslint --max-warnings=0'],
};
