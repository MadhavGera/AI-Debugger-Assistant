#!/usr/bin/env bash
# ============================================================
# AI GitHub Debugger — Deployment Script
# Usage: ./deploy.sh [dev|prod|stop|logs|status]
# ============================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
PROD_OVERRIDE="docker-compose.prod.yml"
PROJECT_NAME="ai-debugger"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

check_env() {
  if [ ! -f .env ]; then
    warn ".env not found. Copying from .env.example..."
    cp .env.example .env
    err "Please fill in your credentials in .env before deploying."
  fi

  required_vars=("GITHUB_CLIENT_ID" "GITHUB_CLIENT_SECRET" "OPENAI_API_KEY" "NEXTAUTH_SECRET" "JWT_SECRET")
  for var in "${required_vars[@]}"; do
    if [ -z "${!var:-}" ]; then
      err "Required env var $var is not set in .env"
    fi
  done
  log "Environment variables verified"
}

cmd_dev() {
  info "Starting development environment..."
  check_env
  docker compose -p $PROJECT_NAME -f $COMPOSE_FILE up --build "$@"
}

cmd_prod() {
  info "Starting production environment..."
  check_env
  docker compose -p $PROJECT_NAME \
    -f $COMPOSE_FILE \
    -f $PROD_OVERRIDE \
    up -d --build --remove-orphans
  log "Production stack started"
  cmd_status
}

cmd_stop() {
  info "Stopping all services..."
  docker compose -p $PROJECT_NAME down
  log "All services stopped"
}

cmd_logs() {
  service="${2:-}"
  docker compose -p $PROJECT_NAME logs -f --tail=100 $service
}

cmd_status() {
  echo ""
  echo "  Service Status"
  echo "  ─────────────────────────────────────"
  docker compose -p $PROJECT_NAME ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "  Access points:"
  echo "    Frontend:  http://localhost:3000"
  echo "    Backend:   http://localhost:4000/health"
  echo "    AI Engine: http://localhost:8000/health"
  echo "    ChromaDB:  http://localhost:8001"
  echo ""
}

cmd_reset() {
  warn "This will DELETE all data. Press Ctrl+C to cancel."
  sleep 5
  docker compose -p $PROJECT_NAME down -v --remove-orphans
  log "All data volumes removed"
}

cmd_help() {
  echo ""
  echo "  AI GitHub Debugger — Deploy Script"
  echo ""
  echo "  Usage: ./deploy.sh <command>"
  echo ""
  echo "  Commands:"
  echo "    dev      Start in development mode (with live reload)"
  echo "    prod     Start in production mode (detached)"
  echo "    stop     Stop all services"
  echo "    logs     Tail logs (optional: service name)"
  echo "    status   Show service status"
  echo "    reset    ⚠️  Delete all data and stop containers"
  echo "    help     Show this help"
  echo ""
}

case "${1:-help}" in
  dev)    cmd_dev "${@:2}" ;;
  prod)   cmd_prod ;;
  stop)   cmd_stop ;;
  logs)   cmd_logs "$@" ;;
  status) cmd_status ;;
  reset)  cmd_reset ;;
  *)      cmd_help ;;
esac
