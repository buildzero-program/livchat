#!/bin/bash
# LivChat Dev Environment
# Usage: ./dev.sh [start|stop|status|logs]

LIVCHAT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$LIVCHAT_DIR/app"
AST_DIR="$LIVCHAT_DIR/ast"
PARTYKIT_DIR="$APP_DIR/partykit"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_port() {
    ss -tlnp 2>/dev/null | grep -q ":$1 " && echo "up" || echo "down"
}

status() {
    echo -e "\n${YELLOW}LivChat Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    ast_status=$(check_port 9000)
    partykit_status=$(check_port 1999)
    nextjs_status=$(check_port 3000)

    [[ "$ast_status" == "up" ]] && echo -e "AST (9000):      ${GREEN}● Running${NC}" || echo -e "AST (9000):      ${RED}○ Stopped${NC}"
    [[ "$partykit_status" == "up" ]] && echo -e "PartyKit (1999): ${GREEN}● Running${NC}" || echo -e "PartyKit (1999): ${RED}○ Stopped${NC}"
    [[ "$nextjs_status" == "up" ]] && echo -e "Next.js (3000):  ${GREEN}● Running${NC}" || echo -e "Next.js (3000):  ${RED}○ Stopped${NC}"

    echo ""
}

start() {
    echo -e "${YELLOW}Starting LivChat...${NC}\n"

    # AST
    echo "→ Starting AST (Docker)..."
    cd "$AST_DIR" && docker compose up -d 2>&1 | grep -v "^$"

    # PartyKit
    echo "→ Starting PartyKit..."
    cd "$PARTYKIT_DIR" && nohup npm run dev > /tmp/livchat-partykit.log 2>&1 &

    # Next.js
    echo "→ Starting Next.js..."
    cd "$APP_DIR" && nohup bun dev > /tmp/livchat-nextjs.log 2>&1 &

    sleep 3
    status

    echo -e "Logs: ${YELLOW}./dev.sh logs${NC}"
    echo -e "App:  ${GREEN}http://localhost:3000${NC}\n"
}

stop() {
    echo -e "${YELLOW}Stopping LivChat...${NC}\n"

    # Stop Next.js
    pkill -f "next-server" 2>/dev/null && echo "→ Next.js stopped" || echo "→ Next.js not running"

    # Stop PartyKit
    pkill -f "partykit" 2>/dev/null && echo "→ PartyKit stopped" || echo "→ PartyKit not running"

    # Stop AST
    cd "$AST_DIR" && docker compose down 2>&1 | grep -v "^$"
    echo "→ AST stopped"

    echo ""
}

logs() {
    echo -e "${YELLOW}Choose log to view:${NC}"
    echo "1) Next.js"
    echo "2) PartyKit"
    echo "3) AST"
    read -p "> " choice

    case $choice in
        1) tail -f /tmp/livchat-nextjs.log ;;
        2) tail -f /tmp/livchat-partykit.log ;;
        3) cd "$AST_DIR" && docker compose logs -f ;;
        *) echo "Invalid choice" ;;
    esac
}

case "${1:-start}" in
    start)  start ;;
    stop)   stop ;;
    status) status ;;
    logs)   logs ;;
    restart) stop && sleep 2 && start ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|restart}"
        exit 1
        ;;
esac
