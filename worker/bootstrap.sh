#!/usr/bin/env bash
# FinanceLog one-shot bootstrap.
#
# This script uses *your* local wrangler login to provision everything
# the worker needs on Cloudflare and then deploys the app. It's safe to
# re-run: existing resources are detected and reused.
#
# Usage:
#   cd worker
#   ./bootstrap.sh
#
# Requirements:
#   - Node 18+
#   - You've already run `npx wrangler login` in a browser once
#   - A Mistral API key ready to paste

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

WRANGLER_TOML="$HERE/wrangler.toml"
D1_NAME="financelog"
R2_BUCKET="financelog-statements"

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
info()  { printf '  • %s\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn()  { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()   { printf '\033[31mfatal:\033[0m %s\n' "$*" >&2; exit 1; }

wrangler() {
  npx --yes wrangler "$@"
}

ensure_logged_in() {
  bold "1/6  Verifying Cloudflare login"
  if ! wrangler whoami >/dev/null 2>&1; then
    warn "Not logged in. Running 'wrangler login' — a browser window will open."
    wrangler login
  fi
  local email
  email="$(wrangler whoami 2>/dev/null | sed -n 's/.*\([A-Za-z0-9._%+-]*@[A-Za-z0-9.-]*\).*/\1/p' | head -n1 || true)"
  ok "Logged in${email:+ as $email}"
}

ensure_d1() {
  bold "2/6  Provisioning D1 database '$D1_NAME'"

  local existing_id
  existing_id="$(wrangler d1 list --json 2>/dev/null \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);const m=a.find(x=>x.name==="'"$D1_NAME"'");if(m)console.log(m.uuid||m.id||"")}catch(e){}})' \
    || true)"

  if [ -z "$existing_id" ]; then
    info "Creating D1 database…"
    local create_out
    create_out="$(wrangler d1 create "$D1_NAME" 2>&1)"
    echo "$create_out"
    existing_id="$(printf '%s' "$create_out" \
      | grep -Eo '"?database_id"?[[:space:]]*[:=][[:space:]]*"?[a-f0-9-]{36}"?' \
      | grep -Eo '[a-f0-9-]{36}' | head -n1)"
    [ -z "$existing_id" ] && die "Could not parse database_id from wrangler output"
  else
    ok "D1 database already exists ($existing_id)"
  fi

  # Patch wrangler.toml with the real database_id if needed.
  if grep -q 'REPLACE_WITH_YOUR_D1_ID' "$WRANGLER_TOML"; then
    info "Writing database_id into wrangler.toml"
    # Portable in-place sed (macOS & Linux).
    sed -i.bak "s/REPLACE_WITH_YOUR_D1_ID/$existing_id/" "$WRANGLER_TOML"
    rm -f "$WRANGLER_TOML.bak"
    ok "wrangler.toml updated"
  else
    # Make sure the id that's there matches.
    if ! grep -q "database_id = \"$existing_id\"" "$WRANGLER_TOML"; then
      warn "wrangler.toml has a database_id that doesn't match $existing_id — leaving it alone."
    else
      ok "wrangler.toml already has database_id=$existing_id"
    fi
  fi
}

ensure_r2() {
  bold "3/6  Provisioning R2 bucket '$R2_BUCKET'"
  if wrangler r2 bucket list 2>/dev/null | grep -q "^$R2_BUCKET\b\|[[:space:]]$R2_BUCKET[[:space:]]\|\"$R2_BUCKET\""; then
    ok "R2 bucket already exists"
  else
    info "Creating R2 bucket…"
    if wrangler r2 bucket create "$R2_BUCKET" 2>&1 | tee /tmp/financelog-r2.log \
       && ! grep -qi 'error' /tmp/financelog-r2.log; then
      ok "R2 bucket created"
    else
      if grep -qi 'already exists' /tmp/financelog-r2.log; then
        ok "R2 bucket already exists"
      else
        die "R2 bucket creation failed — see output above"
      fi
    fi
  fi
}

apply_schema() {
  bold "4/6  Applying D1 schema"
  wrangler d1 execute "$D1_NAME" --remote --file="$HERE/schema.sql"
  ok "Schema applied to remote D1"
}

set_secrets() {
  bold "5/6  Setting secrets"

  # SITE_PASSWORD
  if [ -n "${SITE_PASSWORD:-}" ]; then
    printf '%s' "$SITE_PASSWORD" | wrangler secret put SITE_PASSWORD
    ok "SITE_PASSWORD set (from env var)"
  else
    printf '  Enter SITE_PASSWORD (Basic Auth password for the whole site): '
    stty -echo 2>/dev/null || true
    read -r pw
    stty echo 2>/dev/null || true
    printf '\n'
    [ -z "$pw" ] && die "SITE_PASSWORD cannot be empty"
    printf '%s' "$pw" | wrangler secret put SITE_PASSWORD
    ok "SITE_PASSWORD set"
  fi

  # MISTRAL_API_KEY
  if [ -n "${MISTRAL_API_KEY:-}" ]; then
    printf '%s' "$MISTRAL_API_KEY" | wrangler secret put MISTRAL_API_KEY
    ok "MISTRAL_API_KEY set (from env var)"
  else
    printf '  Enter MISTRAL_API_KEY: '
    stty -echo 2>/dev/null || true
    read -r key
    stty echo 2>/dev/null || true
    printf '\n'
    [ -z "$key" ] && die "MISTRAL_API_KEY cannot be empty"
    printf '%s' "$key" | wrangler secret put MISTRAL_API_KEY
    ok "MISTRAL_API_KEY set"
  fi
}

deploy() {
  bold "6/6  Building frontend & deploying worker"
  ( cd "$HERE/../vite" && \
    (command -v yarn >/dev/null 2>&1 && yarn install --immutable 2>/dev/null) \
      || npm install --no-audit --no-fund )
  ( cd "$HERE/../vite" && \
    (command -v yarn >/dev/null 2>&1 && yarn build) \
      || npm run build )
  wrangler deploy
  ok "Deployed"
}

main() {
  bold "== FinanceLog bootstrap =="
  ensure_logged_in
  ensure_d1
  ensure_r2
  apply_schema
  set_secrets
  deploy
  echo
  bold "All set. Your worker is live — open the URL above and sign in with the password you just entered."
}

main "$@"
