# FinanceLog

A personal finance app that turns your PDF statements into a queryable, dashboardable ledger, hosted end-to-end on Cloudflare.

- **Upload** PDF bank or credit-card statements.
- Statements are SHA-256 hashed on the worker so **duplicate PDFs never get processed twice**.
- **[Mistral](https://mistral.ai)** OCRs each page and extracts a strict JSON object: statement metadata, APRs, minimum payment, credit limit, and every line-item transaction.
- Everything persists to **Cloudflare D1** (SQL) and the raw PDF is stored in **Cloudflare R2**.
- A single Cloudflare Worker serves both the React SPA (Berry MUI template) **and** the API from one origin, behind a single HTTP Basic Auth password.

---

## Architecture

```
                           HTTP Basic Auth (SITE_PASSWORD)
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────┐
   │              Cloudflare Worker (financelog)          │
   │                                                      │
   │   [assets] ──▶ vite/dist (React SPA, Berry UI)       │
   │   /api/*  ──▶  D1 (SQL) + R2 (PDFs) + Mistral API    │
   └──────────────────────────────────────────────────────┘
```

- `vite/` — React 19 + MUI 7 + SWR frontend. Builds to `vite/dist`.
- `worker/` — Cloudflare Worker. Serves the SPA via the Assets binding, runs the API, and gates everything with Basic Auth.

---

## One-time Cloudflare setup

```bash
cd worker
npm install

# 1. D1
npx wrangler d1 create financelog
# Paste the returned database_id into worker/wrangler.toml

# 2. R2
npx wrangler r2 bucket create financelog-statements

# 3. Apply the schema to the remote DB
npm run db:init:remote

# 4. Secrets
npx wrangler secret put SITE_PASSWORD    # the Basic Auth password
npx wrangler secret put MISTRAL_API_KEY  # your Mistral key
```

> **Set `SITE_PASSWORD` to the password you want to use.** The Worker
> enforces this on every request before anything else runs, so without
> it no one can hit the SPA, the API, or the PDFs in R2.

---

## Deploy

```bash
cd worker
npm run deploy
```

`npm run deploy` first runs `vite build` (so the latest SPA ends up in
`vite/dist`), then runs `wrangler deploy`, which uploads both the worker
and the static assets. You get a single URL like
`https://financelog.<your-subdomain>.workers.dev`.

Open it in your browser. You'll see the native HTTP Basic Auth prompt —
username can be anything, password is whatever you set
`SITE_PASSWORD` to.

### Redeploying

Any time you change either the worker or the frontend:

```bash
cd worker && npm run deploy
```

---

## Local development

You can run the two halves independently while iterating:

```bash
# terminal 1 — the worker (uses .dev.vars for secrets)
cd worker
cp .dev.vars.example .dev.vars   # fill in MISTRAL_API_KEY, optional SITE_PASSWORD
npm run db:init                  # seed the local D1
npm run dev                      # http://localhost:8787

# terminal 2 — the Vite dev server (auto-reloads on edits)
cd vite
yarn install                     # or npm install
yarn start                       # http://localhost:3000
```

`vite.config.mjs` proxies `/api/*` from the dev server to
`http://localhost:8787`, so the SPA calls the worker without any CORS
or hostname juggling. If you leave `SITE_PASSWORD` unset in `.dev.vars`
the auth gate is skipped locally.

To test the production bundle end-to-end (SPA served by the worker,
auth on), build the frontend and run the worker on its own:

```bash
cd vite && yarn build
cd ../worker && npm run dev
# http://localhost:8787 — browser prompts for the password
```

---

## Endpoints

| Method | Path                         | Purpose                                                 |
|--------|------------------------------|---------------------------------------------------------|
| GET    | `/api/health`                | Liveness check (unauthenticated)                        |
| GET    | `/api/summary`               | Totals, monthly cashflow, category breakdown, upcoming  |
| POST   | `/api/statements/upload`     | multipart/form-data `file` — hash, dedupe, extract      |
| GET    | `/api/statements`            | List all statements                                     |
| GET    | `/api/statements/:id`        | One statement + its transactions                        |
| GET    | `/api/statements/:id/pdf`    | Stream the original PDF from R2                         |
| DELETE | `/api/statements/:id`        | Remove statement, transactions, and R2 object           |
| GET    | `/api/transactions`          | Unified ledger. Filters: `q`, `category`, `from`, `to`  |
| GET    | `/api/accounts`              | Known accounts                                          |
| GET    | `/api/categories`            | Category usage counts                                   |

All paths except `/api/health` require HTTP Basic Auth matching
`SITE_PASSWORD`. For `curl`/scripting you can either send
`-u any:<password>` or pass it as a Bearer token:

```bash
curl -u x:yourpassword https://financelog.<you>.workers.dev/api/summary
curl -H "Authorization: Bearer yourpassword" https://financelog.<you>.workers.dev/api/summary
```

---

## How duplicate detection works

On upload the worker:
1. Reads the PDF bytes and computes `sha256(bytes)`.
2. Looks up `statements.pdf_hash` (which has a `UNIQUE` constraint).
3. If it's already there, responds `409 Conflict` with the existing row and skips everything else — **no Mistral tokens are spent**.
4. Otherwise it stores the PDF at `statements/<sha256>.pdf` in R2 and runs extraction.

R2 keys use the hash too, so the object store is automatically de-duplicated.

## How extraction works

`worker/src/mistral.js` runs a two-step pipeline:

1. **OCR** — `POST /v1/ocr` with `mistral-ocr-latest`. Returns clean markdown for every page.
2. **Structured extraction** — `POST /v1/chat/completions` with `mistral-large-latest` and `response_format: json_object`. A system prompt + an explicit JSON schema force the model to return the statement fields and every transaction. Direction is normalized so positive amounts are always money out.

Swap models (e.g. `mistral-small-latest` to save cost) via `MISTRAL_MODEL` / `MISTRAL_OCR_MODEL` in `wrangler.toml`.

## Schema

See `worker/schema.sql`. Tables: `accounts`, `statements`, `transactions`. Every transaction links back to its statement, so deleting a statement cascades to its line items.

---

## Pages

- **Overview** — totals, 12-month cashflow area chart, category donut, upcoming payments, account list with live APR / credit-limit info.
- **Upload PDFs** — drag-and-drop queue. Duplicates are called out inline.
- **Transactions** — unified ledger. Search, filter by category, date range. Running totals and net at the top.
- **Statements** — every imported statement with details dialog, link to the original PDF in R2, and a delete button.
- **Settings** — sign out (clears cached Basic Auth creds), advanced API host override.

## Costs & limits

- **Cloudflare D1 / R2 / Workers / Assets** — free tiers are plenty for a personal finance log.
- **Mistral** — OCR + chat call per unique statement. A typical 2-page credit card PDF runs well under $0.01 on `mistral-large-latest`; the dedupe step means you only pay once per unique PDF.
- **Max upload size** — the worker refuses anything larger than 25 MB.

## Development tips

- `wrangler d1 execute financelog --command="select * from statements"` is the fastest way to inspect what the extractor did.
- Each row's `raw_extraction_json` stores a truncated OCR excerpt + the extracted JSON — great for debugging a misparsed statement.
- Reset everything with `npm run db:reset` in `worker/`.
- **Forgot / want to change the password?** Re-run `wrangler secret put SITE_PASSWORD` and redeploy. Use the "Sign out" button in Settings to clear your browser's cached credentials.

---

This repository started from the [Berry Free React Admin template](https://github.com/codedthemes/berry-free-react-admin-template); see `remix/` for the (untouched) remix variant.
