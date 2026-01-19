#!/usr/bin/env bash
#
# GitHub Actions Self-Hosted Runner Setup Guide
#
# This script provides step-by-step instructions for setting up
# a self-hosted runner for the Structurizr DevOps pipeline.
#
# Usage: ./setup-runner.sh

set -euo pipefail

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================"
echo "GitHub Actions Self-Hosted Runner Setup"
echo -e "========================================${NC}"
echo ""

echo -e "${GREEN}Step 1: Prerequisites${NC}"
echo "--------------------------------------"
echo "Ensure you have the following installed:"
echo "  - nerdctl (container runtime)"
echo "  - curl"
echo "  - jq (optional, for JSON parsing)"
echo ""

echo -e "${GREEN}Step 2: Pre-pull Container Images${NC}"
echo "--------------------------------------"
echo "Run these commands to pull required images:"
echo ""
echo "  nerdctl pull structurizr/cli:latest"
echo "  nerdctl pull structurizr/lite:latest"
echo "  nerdctl pull structurizr/onpremises:latest"
echo ""

echo -e "${GREEN}Step 3: Download the Runner${NC}"
echo "--------------------------------------"
echo "1. Go to your GitHub organization settings:"
echo "   https://github.com/organizations/Helms-AI/settings/actions/runners/new"
echo ""
echo "2. Or for a specific repository:"
echo "   https://github.com/Helms-AI/structurizr-devops/settings/actions/runners/new"
echo ""
echo "3. Select your OS (Linux/macOS/Windows)"
echo ""
echo "4. Follow the download instructions provided by GitHub"
echo ""

echo -e "${GREEN}Step 4: Configure the Runner${NC}"
echo "--------------------------------------"
echo "When configuring, use these settings:"
echo ""
echo "  Name: structurizr-runner-01"
echo "  Labels: self-hosted,structurizr,nerdctl"
echo "  Work folder: _work (default)"
echo ""
echo "Example configuration command:"
echo ""
echo "  ./config.sh --url https://github.com/Helms-AI \\"
echo "              --token YOUR_TOKEN \\"
echo "              --name structurizr-runner-01 \\"
echo "              --labels self-hosted,structurizr,nerdctl \\"
echo "              --work _work"
echo ""

echo -e "${GREEN}Step 5: Install as Service (Optional)${NC}"
echo "--------------------------------------"
echo "For automatic startup on boot:"
echo ""
echo "Linux/macOS:"
echo "  sudo ./svc.sh install"
echo "  sudo ./svc.sh start"
echo ""
echo "To check status:"
echo "  sudo ./svc.sh status"
echo ""

echo -e "${GREEN}Step 6: Verify Runner${NC}"
echo "--------------------------------------"
echo "1. Check runner status in GitHub:"
echo "   https://github.com/Helms-AI/structurizr-devops/settings/actions/runners"
echo ""
echo "2. Runner should show as 'Idle' when ready"
echo ""
echo "3. Test with a push to any branch"
echo ""

echo -e "${YELLOW}Security Considerations${NC}"
echo "--------------------------------------"
echo "- Only use self-hosted runners on private repositories"
echo "  or repositories you fully control"
echo ""
echo "- The runner has access to your local network"
echo "  (needed for localhost:20000 On-Premises)"
echo ""
echo "- Consider running in a dedicated VM or container"
echo ""

echo -e "${GREEN}Step 7: Environment Variables${NC}"
echo "--------------------------------------"
echo "Set these as GitHub Secrets (not runner env vars):"
echo ""
echo "  STRUCTURIZR_URL"
echo "  STRUCTURIZR_MAIN_WORKSPACE_ID"
echo "  STRUCTURIZR_MAIN_WORKSPACE_KEY"
echo "  STRUCTURIZR_MAIN_WORKSPACE_SECRET"
echo "  STRUCTURIZR_TEAM_A_WORKSPACE_ID"
echo "  STRUCTURIZR_TEAM_A_WORKSPACE_KEY"
echo "  STRUCTURIZR_TEAM_A_WORKSPACE_SECRET"
echo "  STRUCTURIZR_TEAM_B_WORKSPACE_ID"
echo "  STRUCTURIZR_TEAM_B_WORKSPACE_KEY"
echo "  STRUCTURIZR_TEAM_B_WORKSPACE_SECRET"
echo ""

echo -e "${GREEN}Quick Test Commands${NC}"
echo "--------------------------------------"
echo "After setup, verify nerdctl works:"
echo ""
echo "  nerdctl run --rm structurizr/cli:latest version"
echo ""
echo "Verify container network access:"
echo ""
echo "  curl http://localhost:20000/health"
echo ""

echo -e "${BLUE}========================================"
echo "Setup guide complete!"
echo -e "========================================${NC}"
