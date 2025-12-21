#!/bin/sh
# =============================================================================
# LivChat App - Docker Entrypoint
# =============================================================================
# Runs database migrations before starting the server
# Similar to WuzAPI's initializeSchema() and AST's .setup()
# =============================================================================

set -e

echo "=================================================="
echo "LivChat App - Starting..."
echo "=================================================="

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "[1/2] Running database migrations..."

  # Run the TypeScript migration script
  bun run scripts/db-setup.ts || {
    echo "    WARNING: Migrations failed (may already be applied)"
    echo "    Continuing anyway..."
  }

  echo "    Done!"
else
  echo "[1/2] No DATABASE_URL set, skipping migrations"
fi

echo "[2/2] Starting Next.js server..."
echo "=================================================="

# Start the Next.js server
exec bun server.js
