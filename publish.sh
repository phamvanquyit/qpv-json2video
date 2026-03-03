#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Parse current version parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Calculate version options
VER_KEEP="${MAJOR}.${MINOR}.${PATCH}"
VER_PATCH="${MAJOR}.${MINOR}.$((PATCH + 1))"
VER_MINOR="${MAJOR}.$((MINOR + 1)).0"
VER_MAJOR="$((MAJOR + 1)).0.0"

# Show menu
echo ""
echo -e "${BOLD}📦 Current version: ${YELLOW}${CURRENT_VERSION}${NC}"
echo ""
echo -e "${CYAN}Chọn version để publish:${NC}"
echo ""
echo -e "  ${BOLD}1)${NC} ${YELLOW}${VER_KEEP}${NC}   — giữ nguyên"
echo -e "  ${BOLD}2)${NC} ${GREEN}${VER_PATCH}${NC}   — patch  (bug fix)"
echo -e "  ${BOLD}3)${NC} ${GREEN}${VER_MINOR}${NC}     — minor  (tính năng mới, tương thích ngược)"
echo -e "  ${BOLD}4)${NC} ${RED}${VER_MAJOR}${NC}       — major  (breaking change)"
echo ""
read -rp "Nhập lựa chọn [1-4]: " CHOICE

case "$CHOICE" in
  1) NEW_VERSION="$VER_KEEP" ;;
  2) NEW_VERSION="$VER_PATCH" ;;
  3) NEW_VERSION="$VER_MINOR" ;;
  4) NEW_VERSION="$VER_MAJOR" ;;
  *)
    echo -e "${RED}❌ Lựa chọn không hợp lệ.${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✔ Version được chọn: ${BOLD}${NEW_VERSION}${NC}"
echo ""

# Confirm
read -rp "Xác nhận publish v${NEW_VERSION} lên npm? [y/N]: " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo -e "${YELLOW}⚠ Đã hủy.${NC}"
  exit 0
fi

# Set version in package.json (nếu khác version hiện tại)
if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
  npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version > /dev/null
  echo -e "${GREEN}🔼 Bumped version to: v${NEW_VERSION}${NC}"
fi

# Build
echo -e "${YELLOW}🔨 Building...${NC}"
yarn build

# Publish
echo -e "${YELLOW}🚀 Publishing to npm...${NC}"
npm publish

# Git commit & tag
echo -e "${YELLOW}📝 Committing and tagging...${NC}"
git add package.json CHANGELOG.md
git commit -m "chore: release v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push && git push --tags

echo ""
echo -e "${GREEN}✅ Published v${NEW_VERSION} successfully!${NC}"
