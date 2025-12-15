#!/bin/bash
# =============================================================================
# LivChat Production Deploy Script
# =============================================================================
#
# Deploy completo para produção incluindo migrations e seeds.
#
# Uso:
#   ./scripts/deploy-prod.sh [comando]
#
# Comandos:
#   all       - Deploy completo (default)
#   migrate   - Apenas migrations
#   seed      - Apenas seeds
#   ast       - Deploy AST para fly.io
#   partykit  - Deploy PartyKit
#   check     - Verifica pré-requisitos
#
# =============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$ROOT_DIR/app"
AST_DIR="$ROOT_DIR/ast"
PARTYKIT_DIR="$APP_DIR/partykit"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

confirm() {
    read -p "$1 [y/N]: " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

# =============================================================================
# Check Prerequisites
# =============================================================================

check_prerequisites() {
    log_step "Verificando pré-requisitos"

    local missing=0

    # Check bun
    if command -v bun &> /dev/null; then
        log_success "bun $(bun --version)"
    else
        log_error "bun não encontrado"
        missing=1
    fi

    # Check uv
    if command -v uv &> /dev/null; then
        log_success "uv $(uv --version 2>&1 | head -1)"
    else
        log_error "uv não encontrado"
        missing=1
    fi

    # Check flyctl (optional - only needed for AST deploy)
    if command -v flyctl &> /dev/null; then
        log_success "flyctl $(flyctl version 2>&1 | head -1)"
    else
        log_warn "flyctl não encontrado (necessário para deploy AST)"
        log_info "  Instale com: curl -L https://fly.io/install.sh | sh"
    fi

    # Check npx/partykit
    if command -v npx &> /dev/null; then
        log_success "npx disponível"
    else
        log_error "npx não encontrado"
        missing=1
    fi

    # Check env files
    if [[ -f "$APP_DIR/.env.prod" ]]; then
        log_success ".env.prod encontrado"
    else
        log_error ".env.prod não encontrado em app/"
        missing=1
    fi

    if [[ $missing -eq 1 ]]; then
        log_error "Pré-requisitos não atendidos"
        exit 1
    fi

    log_success "Todos os pré-requisitos OK"
}

# =============================================================================
# Database Migrations
# =============================================================================

run_migrations() {
    log_step "Executando Migrations (Drizzle)"

    cd "$APP_DIR"

    # Backup current .env
    if [[ -f .env ]]; then
        cp .env .env.backup
    fi

    # Use production database
    log_info "Usando DATABASE_URL de .env.prod"
    export DATABASE_URL=$(grep "^DATABASE_URL=" .env.prod | cut -d'"' -f2)

    if [[ -z "$DATABASE_URL" ]]; then
        log_error "DATABASE_URL não encontrada em .env.prod"
        exit 1
    fi

    log_info "Executando migrations..."
    bun run db:migrate

    log_success "Migrations concluídas"

    # Restore .env
    if [[ -f .env.backup ]]; then
        mv .env.backup .env
    fi
}

# =============================================================================
# Seed Database
# =============================================================================

run_seeds() {
    log_step "Executando Seeds"

    # --- App Seed (LivChat/Drizzle) ---
    log_info "Seed: LivChat (app)"
    cd "$APP_DIR"

    # Use production database
    export DATABASE_URL=$(grep "^DATABASE_URL=" .env.prod | cut -d'"' -f2)

    bun run scripts/seed-ivy.ts || log_warn "Seed app pode já existir"

    # --- AST Seed (PostgresStore) ---
    log_info "Seed: AST (PostgresStore)"
    cd "$AST_DIR"

    # Set production database for AST
    export POSTGRES_HOST="ep-soft-pine-acc7zl9c-pooler.sa-east-1.aws.neon.tech"
    export POSTGRES_USER="neondb_owner"
    export POSTGRES_PASSWORD="npg_rsmze8k7vnSg"
    export POSTGRES_PORT="5432"
    export POSTGRES_DB="neondb"

    # Run seed (will prompt if already exists)
    echo "y" | uv run python scripts/seed_ivy.py || log_warn "Seed AST pode já existir"

    log_success "Seeds concluídos"
}

# =============================================================================
# Deploy AST to Fly.io
# =============================================================================

deploy_ast() {
    log_step "Deploy AST para Fly.io"

    # Check flyctl
    if ! command -v flyctl &> /dev/null; then
        log_error "flyctl não encontrado"
        log_info "Instale com: curl -L https://fly.io/install.sh | sh"
        exit 1
    fi

    cd "$AST_DIR"

    # Check if fly.toml exists
    if [[ ! -f fly.toml ]]; then
        log_error "fly.toml não encontrado em ast/"
        log_info "Execute: flyctl launch --no-deploy"
        exit 1
    fi

    # Deploy
    log_info "Fazendo deploy..."
    flyctl deploy --ha=false

    log_success "AST deployed"

    # Show URL
    flyctl status
}

# =============================================================================
# Deploy PartyKit
# =============================================================================

deploy_partykit() {
    log_step "Deploy PartyKit"

    cd "$PARTYKIT_DIR"

    # Set production AST URL
    log_info "Configurando AST_URL para produção..."

    # PartyKit uses environment variables from their dashboard
    # or via npx partykit deploy with --var flags

    npx partykit deploy

    log_success "PartyKit deployed"
}

# =============================================================================
# Full Deploy
# =============================================================================

deploy_all() {
    log_step "Deploy Completo para Produção"

    echo ""
    echo "Este script irá:"
    echo "  1. Executar migrations no banco de produção"
    echo "  2. Executar seeds (idempotentes)"
    echo "  3. Deploy AST para Fly.io"
    echo "  4. Deploy PartyKit"
    echo ""
    echo "Vercel faz auto-deploy no push para main."
    echo ""

    if ! confirm "Continuar com o deploy?"; then
        log_warn "Deploy cancelado"
        exit 0
    fi

    check_prerequisites
    run_migrations
    run_seeds
    deploy_ast
    deploy_partykit

    log_step "Deploy Completo!"

    echo ""
    echo "Serviços:"
    echo "  App:      https://livchat.ai (Vercel - auto deploy)"
    echo "  AST:      https://livchat-ast.fly.dev"
    echo "  PartyKit: https://livchat-ivy.partykit.dev"
    echo "  WuzAPI:   https://wuz.livchat.ai"
    echo ""
    log_success "Todos os serviços deployed com sucesso!"
}

# =============================================================================
# Show Help
# =============================================================================

show_help() {
    echo "LivChat Production Deploy Script"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos:"
    echo "  all       Deploy completo (default)"
    echo "  check     Verifica pré-requisitos"
    echo "  migrate   Executa apenas migrations"
    echo "  seed      Executa apenas seeds"
    echo "  ast       Deploy apenas AST"
    echo "  partykit  Deploy apenas PartyKit"
    echo "  help      Mostra esta ajuda"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    local cmd="${1:-all}"

    case "$cmd" in
        all)
            deploy_all
            ;;
        check)
            check_prerequisites
            ;;
        migrate)
            check_prerequisites
            run_migrations
            ;;
        seed)
            check_prerequisites
            run_seeds
            ;;
        ast)
            check_prerequisites
            deploy_ast
            ;;
        partykit)
            check_prerequisites
            deploy_partykit
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Comando desconhecido: $cmd"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
