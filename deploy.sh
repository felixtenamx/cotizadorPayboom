#!/usr/bin/env bash
# deploy.sh — Sube cambios locales a GitHub y despliega al VPS de Hostinger.
# Uso:
#   ./deploy.sh                     # commit con mensaje automático (timestamp)
#   ./deploy.sh "mi mensaje"        # commit con mensaje custom
#   ./deploy.sh --skip-commit       # sólo redeploya el VPS (sin git push)

set -euo pipefail

# ---------- Configuración ----------
VPS_SSH="root@2.25.137.18"
VPS_PATH="/var/www/cotizador"
PM2_APP="cotizador"
# -----------------------------------

# Colores para output
if [ -t 1 ]; then
  BOLD=$'\033[1m'; RESET=$'\033[0m'
  GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; BLUE=$'\033[34m'
else
  BOLD=""; RESET=""; GREEN=""; YELLOW=""; RED=""; BLUE=""
fi

step()  { echo ""; echo "${BOLD}${BLUE}==>${RESET}${BOLD} $*${RESET}"; }
ok()    { echo "${GREEN}✓${RESET} $*"; }
warn()  { echo "${YELLOW}!${RESET} $*"; }
fail()  { echo "${RED}✗${RESET} $*" >&2; exit 1; }

# Ir a la carpeta del script (por si lo llaman desde otro lado)
cd "$(dirname "$0")"

# Verifica que estamos en el proyecto correcto
[ -f package.json ] || fail "No encuentro package.json aquí. ¿Estás en la carpeta app/?"

# ---------- Parseo de argumentos ----------
SKIP_COMMIT=false
COMMIT_MSG=""
for arg in "$@"; do
  case "$arg" in
    --skip-commit) SKIP_COMMIT=true ;;
    -h|--help)
      echo "Uso: ./deploy.sh [mensaje-de-commit | --skip-commit]"
      exit 0 ;;
    *) COMMIT_MSG="$arg" ;;
  esac
done

if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="Deploy $(date '+%Y-%m-%d %H:%M')"
fi

# ---------- Paso 1: Git ----------
if [ "$SKIP_COMMIT" = false ]; then
  step "Paso 1/3 — Commit y push a GitHub"

  if git diff --quiet && git diff --cached --quiet; then
    warn "No hay cambios sin commitear. Salto commit y sólo hago push por si tienes commits locales sin subir."
  else
    git add .
    git commit -m "$COMMIT_MSG"
    ok "Commit creado: $COMMIT_MSG"
  fi

  git push
  ok "Push a GitHub completo"
else
  warn "Salto commit/push (--skip-commit)"
fi

# ---------- Paso 2: SSH deploy ----------
step "Paso 2/3 — Deploy en el VPS ($VPS_SSH)"

ssh -T -o StrictHostKeyChecking=accept-new "$VPS_SSH" bash <<REMOTE
set -euo pipefail

cd "$VPS_PATH"
echo "→ git pull"
git pull --ff-only

echo "→ npm install (por si hay deps nuevas)"
npm install --no-audit --no-fund --loglevel=error

echo "→ npm run build"
npm run build

echo "→ pm2 restart $PM2_APP"
pm2 restart "$PM2_APP" --update-env

echo "→ pm2 status:"
pm2 status "$PM2_APP"
REMOTE

ok "Deploy en VPS completo"

# ---------- Paso 3: Verificación ----------
step "Paso 3/3 — Verificando app"

# HEAD contra el dominio; espera hasta 15s a que responda
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 https://cotizador.tena.solutions/login || echo "000")
  case "$HTTP_CODE" in
    200|307|308) ok "https://cotizador.tena.solutions responde ($HTTP_CODE)" ;;
    000)         warn "No pude alcanzar el dominio (timeout). Revisa manualmente." ;;
    5*)          fail "El dominio devolvió $HTTP_CODE. Revisa 'pm2 logs cotizador' en el VPS." ;;
    *)           warn "Respuesta HTTP $HTTP_CODE — revisa manualmente." ;;
  esac
else
  warn "curl no disponible en Mac (raro). Revisa https://cotizador.tena.solutions a mano."
fi

echo ""
echo "${GREEN}${BOLD}Deploy completo.${RESET} Abre https://cotizador.tena.solutions y prueba tus cambios."
