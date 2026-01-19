#!/usr/bin/env bash
# =============================================================================
# Quarterly Rollover Script
# =============================================================================
# Performs local quarterly rollover operations:
#   1. Creates final tag for previous quarter
#   2. Merges previous quarter to main
#   3. Creates new quarter release branch
#   4. Optionally merges planning branch if exists
#
# Usage:
#   ./quarterly-rollover.sh <previous-quarter> <new-quarter>
#
# Example:
#   ./quarterly-rollover.sh q1-2025 q2-2025
#
# Note: This script performs git operations locally. For CI/CD automation,
# use the GitHub Actions workflows instead:
#   - quarterly-snapshot.yml  (creates Structurizr branches + git tag)
#   - start-quarter.yml       (creates git branches)
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# =============================================================================
# Argument Validation
# =============================================================================
usage() {
    echo "Usage: $0 <previous-quarter> <new-quarter>"
    echo ""
    echo "Arguments:"
    echo "  previous-quarter   The quarter being completed (e.g., q1-2025)"
    echo "  new-quarter        The quarter being started (e.g., q2-2025)"
    echo ""
    echo "Example:"
    echo "  $0 q1-2025 q2-2025"
    echo ""
    echo "This script will:"
    echo "  1. Create a final tag for the previous quarter"
    echo "  2. Merge the previous quarter release branch to main"
    echo "  3. Create a new release branch for the new quarter"
    echo "  4. Merge any existing planning branch for the new quarter"
    exit 1
}

if [ $# -ne 2 ]; then
    usage
fi

PREVIOUS_QUARTER="$1"
NEW_QUARTER="$2"

# Validate quarter format (qN-YYYY)
if ! [[ "$PREVIOUS_QUARTER" =~ ^q[1-4]-[0-9]{4}$ ]]; then
    error "Invalid previous quarter format: $PREVIOUS_QUARTER (expected: qN-YYYY)"
fi

if ! [[ "$NEW_QUARTER" =~ ^q[1-4]-[0-9]{4}$ ]]; then
    error "Invalid new quarter format: $NEW_QUARTER (expected: qN-YYYY)"
fi

# =============================================================================
# Pre-flight Checks
# =============================================================================
info "Performing pre-flight checks..."

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    error "Not in a git repository"
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    error "You have uncommitted changes. Please commit or stash them first."
fi

# Fetch latest from origin
info "Fetching latest from origin..."
git fetch origin

# Check if previous quarter release branch exists
PREV_RELEASE="release/$PREVIOUS_QUARTER"
if ! git ls-remote --exit-code --heads origin "$PREV_RELEASE" >/dev/null 2>&1; then
    error "Previous quarter release branch does not exist: $PREV_RELEASE"
fi

# Check if new quarter release branch already exists
NEW_RELEASE="release/$NEW_QUARTER"
if git ls-remote --exit-code --heads origin "$NEW_RELEASE" >/dev/null 2>&1; then
    error "New quarter release branch already exists: $NEW_RELEASE"
fi

success "Pre-flight checks passed"

# =============================================================================
# Step 1: Tag Previous Quarter
# =============================================================================
echo ""
info "Step 1: Creating final tag for $PREVIOUS_QUARTER"

TAG_NAME="${PREVIOUS_QUARTER}-final"

# Check if tag already exists
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    warning "Tag $TAG_NAME already exists, skipping tag creation"
else
    git checkout "$PREV_RELEASE"
    git pull origin "$PREV_RELEASE"
    git tag -a "$TAG_NAME" -m "Final quarterly snapshot: $PREVIOUS_QUARTER"
    success "Created tag: $TAG_NAME"
fi

# =============================================================================
# Step 2: Merge to Main
# =============================================================================
echo ""
info "Step 2: Merging $PREV_RELEASE to main"

git checkout main
git pull origin main
git merge "$PREV_RELEASE" -m "Merge $PREVIOUS_QUARTER release to main"

success "Merged $PREV_RELEASE to main"

# =============================================================================
# Step 3: Create New Quarter Release Branch
# =============================================================================
echo ""
info "Step 3: Creating release branch for $NEW_QUARTER"

git checkout -b "$NEW_RELEASE"

success "Created branch: $NEW_RELEASE"

# =============================================================================
# Step 4: Merge Planning Branch (if exists)
# =============================================================================
echo ""
info "Step 4: Checking for planning branch..."

PLANNING_BRANCH="planning/$NEW_QUARTER"
if git ls-remote --exit-code --heads origin "$PLANNING_BRANCH" >/dev/null 2>&1; then
    info "Found planning branch: $PLANNING_BRANCH"
    git fetch origin "$PLANNING_BRANCH"
    git merge "origin/$PLANNING_BRANCH" -m "Merge $NEW_QUARTER planning into release"
    success "Merged planning branch"
else
    info "No planning branch found: $PLANNING_BRANCH (skipping)"
fi

# =============================================================================
# Push Changes
# =============================================================================
echo ""
info "Pushing changes to origin..."

read -p "Ready to push changes to origin? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Push tag
    git push origin "$TAG_NAME" 2>/dev/null || warning "Tag $TAG_NAME may already exist on remote"

    # Push main
    git checkout main
    git push origin main

    # Push new release branch
    git checkout "$NEW_RELEASE"
    git push -u origin "$NEW_RELEASE"

    success "All changes pushed to origin"
else
    warning "Changes not pushed. You are on branch: $NEW_RELEASE"
    echo ""
    echo "To push manually, run:"
    echo "  git push origin $TAG_NAME"
    echo "  git push origin main"
    echo "  git push -u origin $NEW_RELEASE"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=============================================="
echo "Quarterly Rollover Complete"
echo "=============================================="
echo ""
echo "Previous Quarter: $PREVIOUS_QUARTER"
echo "  - Tag created:    $TAG_NAME"
echo "  - Merged to:      main"
echo ""
echo "New Quarter: $NEW_QUARTER"
echo "  - Release branch: $NEW_RELEASE"
echo "  - You are now on: $(git branch --show-current)"
echo ""
echo "Next Steps:"
echo "  1. Run 'Quarterly Snapshot' workflow to create Structurizr branches"
echo "  2. Continue development on $NEW_RELEASE"
echo "  3. Create planning/${NEW_QUARTER/q/q$(( ${NEW_QUARTER:1:1} + 1 ))}-${NEW_QUARTER:3} for future planning"
echo ""
echo "To access historical architecture:"
echo "  Git:        git checkout $TAG_NAME"
echo "  Structurizr: http://localhost:20000/workspace/{id}/$PREVIOUS_QUARTER"
