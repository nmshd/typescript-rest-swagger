set -e

npm ci
npm run build
npx license-check
npx better-npm-audit audit
