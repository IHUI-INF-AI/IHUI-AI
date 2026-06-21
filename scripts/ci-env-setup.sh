#!/usr/bin/env bash
# CI env setup script (suggestion 3: companion to scripts/ci-env-setup.ps1)
# Target: GitHub Actions ubuntu-latest runner (bash, not PowerShell)
# For Windows runners use: scripts/ci-env-setup.ps1
#
# Usage (in .github/workflows/*.yml):
#   - name: Setup CI env
#     run: bash scripts/ci-env-setup.sh
#   - name: Run e2e
#     run: cd client && npm run test:e2e
#
# Env override examples (all optional):
#   BACKEND_PORT=9000 PREVIEW_PORT=4096 bash scripts/ci-env-setup.sh
#   SKIP_PORT_CLEAN=1 HEALTH_TIMEOUT=120 bash scripts/ci-env-setup.sh
#
# Exit codes:
#   0  - success
#   10 - python3 not found
#   11 - dependency install failed
#   12 - backend startup / health failed
#   13 - client build / vite preview failed

set -uo pipefail

# Resolve script directory (portable across bash 3.2 macOS and bash 5.x linux)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---- Defaults (mirrors client/config/ports.ts) ----
# Single source of truth reminder: update BOTH this file and client/config/ports.ts
DEFAULT_BACKEND_PORT=8000
DEFAULT_PREVIEW_PORT=4173
DEFAULT_DEPRECATED_PORT=18000

# ---- Port resolution: CLI/env > default ----
BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
PREVIEW_PORT="${PREVIEW_PORT:-$DEFAULT_PREVIEW_PORT}"
DEPRECATED_PORT="${DEPRECATED_PORT:-$DEFAULT_DEPRECATED_PORT}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
SKIP_PORT_CLEAN="${SKIP_PORT_CLEAN:-0}"
SKIP_DEPS_INSTALL="${SKIP_DEPS_INSTALL:-0}"

# ---- Logging helpers ----
step()  { printf "\033[36m[ci-env]\033[0m %s\n" "$1"; }
ok()    { printf "\033[32m[ci-env]\033[0m %s\n" "$1"; }
warn()  { printf "\033[33m[ci-env]\033[0m %s\n" "$1"; }
err()   { printf "\033[31m[ci-env]\033[0m %s\n" "$1" 1>&2; }
die()   { err "$1"; exit "${2:-1}"; }

# ---- Step 0: preflight ----
step "Preflight check"
if ! command -v python3 >/dev/null 2>&1; then
  err "python3 not found"
  exit 10
fi
if ! command -v node >/dev/null 2>&1; then
  err "node not found"
  exit 10
fi
if ! command -v pnpm >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
  err "pnpm/npm not found"
  exit 10
fi
ok "python3=$(command -v python3)"
ok "node=$(command -v node)"
ok "frontend_bin=$(command -v pnpm || command -v npm)"

# ---- Step 1: install Python deps ----
if [ "$SKIP_DEPS_INSTALL" != "1" ]; then
  step "Step 1: install Python deps (server/requirements.txt)"
  if ! python3 -m pip install -q -r "$ROOT_DIR/server/requirements.txt"; then
    err "pip install failed"
    exit 11
  fi
  ok "python deps installed"
else
  step "Step 1: skip pip install (SKIP_DEPS_INSTALL=1)"
fi

# ---- Step 1b: install Node deps ----
if [ "$SKIP_DEPS_INSTALL" != "1" ]; then
  step "Step 1b: install Node deps (client/)"
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$ROOT_DIR/client" && pnpm install --frozen-lockfile) || die "pnpm install failed" 11
  else
    (cd "$ROOT_DIR/client" && npm ci) || die "npm ci failed" 11
  fi
  ok "node deps installed"
else
  step "Step 1b: skip node install (SKIP_DEPS_INSTALL=1)"
fi

# ---- Step 2: write .env ----
step "Step 2: write .env (.env.ci)"
ENV_FILE="${CI_ENV_FILE:-$ROOT_DIR/.env.ci}"
cat > "$ENV_FILE" <<EOF
ENV=ci
AUTO_CREATE_SCHEMA=1
PORT=$BACKEND_PORT
CORS_ALLOW_ORIGINS=http://127.0.0.1:$PREVIEW_PORT,http://localhost:$PREVIEW_PORT
EOF
# Source env into current process
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
ok ".env written: $ENV_FILE"

# ---- Step 3: clean legacy ports (unless skipped) ----
if [ "$SKIP_PORT_CLEAN" != "1" ]; then
  step "Step 3: clean legacy ports (18000)"
  for port in "$DEPRECATED_PORT" "$BACKEND_PORT" "$PREVIEW_PORT"; do
    pids=$(ss -ltnp 2>/dev/null | awk -v p=":$port$" '$4 ~ p {print $0}' | grep -oP 'pid=\K[0-9]+' | sort -u)
    for pid in $pids; do
      warn "killing pid $pid on port $port"
      kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 1
    for pid in $pids; do
      kill -KILL "$pid" 2>/dev/null || true
    done
  done
else
  step "Step 3: skip port clean (SKIP_PORT_CLEAN=1)"
fi

# ---- Step 4: start backend ----
step "Step 4: start backend (port $BACKEND_PORT)"
BACKEND_LOG="$ROOT_DIR/server/logs/uvicorn_ci.log"
mkdir -p "$ROOT_DIR/server/logs"
nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --log-level warning \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$ROOT_DIR/logs/ci-backend.pid"
ok "Backend PID $BACKEND_PID, log $BACKEND_LOG"

# Wait for port to be ready
ready=0
for i in $(seq 1 "$HEALTH_TIMEOUT"); do
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":$BACKEND_PORT\$"; then
    ready=1; break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  err "Backend did not listen on $BACKEND_PORT within ${HEALTH_TIMEOUT}s"
  tail -n 20 "$BACKEND_LOG" 1>&2
  exit 12
fi
ok "Backend listening on $BACKEND_PORT"

# Health check
if ! curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:$BACKEND_PORT/api/health"; then
  err "Backend health check failed"
  tail -n 20 "$BACKEND_LOG" 1>&2
  exit 12
fi
ok "Backend health OK"

# ---- Step 5: build client ----
step "Step 5: build client for preview"
(
  cd "$ROOT_DIR/client"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm build || exit 1
  else
    npm run build || exit 1
  fi
) || die "client build failed" 13
ok "client built"

# ---- Step 6: start vite preview ----
step "Step 6: start vite preview (port $PREVIEW_PORT)"
PREVIEW_LOG="$ROOT_DIR/client/logs/vite_preview_ci.log"
mkdir -p "$ROOT_DIR/client/logs"
nohup npx vite preview --port "$PREVIEW_PORT" --host 127.0.0.1 \
  > "$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!
echo "$PREVIEW_PID" > "$ROOT_DIR/logs/ci-preview.pid"
ok "Vite preview PID $PREVIEW_PID, log $PREVIEW_LOG"

ready=0
for i in $(seq 1 30); do
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE ":$PREVIEW_PORT\$"; then
    ready=1; break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  err "Vite preview did not listen on $PREVIEW_PORT within 30s"
  tail -n 20 "$PREVIEW_LOG" 1>&2
  exit 13
fi
ok "Vite preview listening on $PREVIEW_PORT"

# ---- Done ----
ok "================ CI ENV READY ================"
ok "Backend:  http://127.0.0.1:$BACKEND_PORT"
ok "Preview:  http://127.0.0.1:$PREVIEW_PORT"
ok "================================================"
ok "Next: cd client && npm run test:e2e"
ok "Cleanup: kill \$(cat logs/ci-backend.pid) \$(cat logs/ci-preview.pid)"
exit 0
