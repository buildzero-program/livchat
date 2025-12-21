#!/bin/bash
# =============================================================================
# LivChat - Deploy Script
# =============================================================================
# Deploys all services to production:
#   - AST -> Fly.io
#   - WuzAPI -> Fly.io
#   - App -> Vercel
#
# Usage:
#   ./scripts/deploy.sh           # Deploy all services
#   ./scripts/deploy.sh ast       # Deploy only AST
#   ./scripts/deploy.sh wuzapi    # Deploy only WuzAPI
#   ./scripts/deploy.sh app       # Deploy only App
#   ./scripts/deploy.sh partykit  # Deploy only PartyKit
#
# Requirements:
#   - flyctl (Fly.io CLI): curl -L https://fly.io/install.sh | sh
#   - vercel (Vercel CLI): bun add -g vercel
#   - Logged in: flyctl auth login && vercel login
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed"
        exit 1
    fi
}

# =============================================================================
# Deploy Functions
# =============================================================================

deploy_ast() {
    log_info "Deploying AST to Fly.io..."
    cd "$PROJECT_ROOT/ast"

    if [ ! -f "fly.toml" ]; then
        log_error "fly.toml not found in ast/"
        exit 1
    fi

    flyctl deploy --remote-only
    log_success "AST deployed to Fly.io"

    # Show URL
    log_info "AST URL: https://livchat-ast.fly.dev"
}

deploy_wuzapi() {
    log_info "Deploying WuzAPI to Fly.io..."
    cd "$PROJECT_ROOT/wuzapi"

    if [ ! -f "fly.toml" ]; then
        log_error "fly.toml not found in wuzapi/"
        exit 1
    fi

    flyctl deploy --remote-only
    log_success "WuzAPI deployed to Fly.io"

    # Show URL
    log_info "WuzAPI URL: https://wuzapi.fly.dev"
}

deploy_app() {
    log_info "Deploying App to Vercel..."
    cd "$PROJECT_ROOT/app"

    # Check for Vercel token in env
    if [ -n "$VERCEL_TOKEN" ]; then
        vercel deploy --prod --token="$VERCEL_TOKEN" --yes
    else
        # Interactive mode
        vercel deploy --prod --yes
    fi

    log_success "App deployed to Vercel"
}

deploy_partykit() {
    log_info "Deploying PartyKit..."
    cd "$PROJECT_ROOT/app"

    npx partykit deploy
    log_success "PartyKit deployed"
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo ""
    echo "=========================================="
    echo "  LivChat Deploy Script"
    echo "=========================================="
    echo ""

    # Check required tools
    check_command "flyctl"
    check_command "vercel"

    # Parse arguments
    SERVICE="$1"

    case "$SERVICE" in
        "ast")
            deploy_ast
            ;;
        "wuzapi")
            deploy_wuzapi
            ;;
        "app")
            deploy_app
            ;;
        "partykit")
            deploy_partykit
            ;;
        "")
            # Deploy all
            log_info "Deploying all services..."
            echo ""

            deploy_ast
            echo ""

            deploy_wuzapi
            echo ""

            deploy_app
            echo ""

            deploy_partykit
            echo ""

            log_success "All services deployed!"
            ;;
        *)
            log_error "Unknown service: $SERVICE"
            echo ""
            echo "Usage: $0 [ast|wuzapi|app|partykit]"
            exit 1
            ;;
    esac

    echo ""
    echo "=========================================="
    echo "  Deploy Complete!"
    echo "=========================================="
    echo ""
    echo "Services:"
    echo "  - App:     https://app.livchat.ai"
    echo "  - AST:     https://ast.livchat.ai"
    echo "  - WuzAPI:  https://wuz.livchat.ai"
    echo "  - PartyKit: https://livchat-ivy.pedrohnas0.partykit.dev"
    echo ""
}

main "$@"
