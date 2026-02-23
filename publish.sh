#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}📦 Current version: ${CURRENT_VERSION}${NC}"

# Determine bump type (default: patch)
BUMP_TYPE=${1:-patch}

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo -e "${RED}❌ Invalid bump type: ${BUMP_TYPE}${NC}"
  echo "Usage: ./publish.sh [patch|minor|major]"
  exit 1
fi

# Bump version (--no-git-tag-version to avoid auto git tag)
NEW_VERSION=$(npm version "$BUMP_TYPE" --no-git-tag-version)
echo -e "${GREEN}🔼 Bumped version to: ${NEW_VERSION}${NC}"

# Build
echo -e "${YELLOW}🔨 Building...${NC}"
yarn build

# Publish
echo -e "${YELLOW}🚀 Publishing to npm...${NC}"
npm publish

# Git commit & tag
echo -e "${YELLOW}📝 Committing and tagging...${NC}"
git add package.json
git commit -m "chore: release ${NEW_VERSION}"
git tag "${NEW_VERSION}"
git push && git push --tags

echo -e "${GREEN}✅ Published ${NEW_VERSION} successfully!${NC}"
