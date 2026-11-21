# AGENTS.md — Meridian Global Accounts

Autonomous development instructions for any AI coding agent working in this
repository. Read this file and `PROJECT_STATUS.md` **before** making any change.

> Methodology sources (inspected and adapted, not blindly executed):
> - https://github.com/CodeAlive-AI/ai-driven-development — plan-mode gate, bug-fix
>   protocol, pragmatic verification, STRIDE threat modelling, hallucination guards.
> - https://github.com/shihabshahrier/softco — phase discipline, L0-L5 verification
>   ladder, fix-mode scope rules, security/database rule sets, memory contract.
> - https://github.com/dzhng/skills — spec slicing at API seams, pass-based
>   implementation, decisions ledger, code-review closeout, file-size ratchet.
>
> The strongest capabilities of all three are combined below into one workflow.

## 1. Project purpose and boundaries

Meridian Global Accounts is a multi-currency **platform account** product for the
European market (default presentation currency: EUR). It is NOT a bank and must
never imply regulated banking. Real money movement only ever happens through an
appropriately licensed financial partner; until such a partner is configured,
deposits stay `PENDING` and **no payment may ever be manufactured as successful**.

- Approved visual design: **Design 02 — Hong Kong International Fintech**
  (reference implementation: `prototype/customer/hongkong/` and
  `prototype/admin/hongkong/`). Preserve its visual identity, layout, branding,
  navigation and UX. Do not switch to another design because it is easier.
- Market positioning: European customers. Nigeria, NGN and Nigerian payment
  providers are out of scope. Do not hardcode any country, currency, tax or
  regulatory assumption — the operating jurisdiction is a documented open
  requirement (see `PROJECT_STATUS.md`).
- Architecture: React 18 via CDN + Babel Standalone in HTML entry files (no
  Next.js, no frontend build step for the initial implementation); Node.js +
  TypeScript + Express backend on Oracle Cloud VM; Supabase PostgreSQL;
  Supabase Auth; Twilio SMS; Cloudflare Pages + Cloudflare DNS.

## 2. Repository map

```
/                     AGENTS.md, PROJECT_STATUS.md, IMPLEMENTATION_PLAN.md,
                      ARCHITECTURE.md, DATABASE_DESIGN.md, API_SPECIFICATION.md,
                      SECURITY_REVIEW.md, CHANGELOG.md, TEST_REPORT.md,
                      DEPLOYMENT_GUIDE.md
prototype/            The original three-design frontend prototype (preserved,
                      read-only reference for the approved design)
frontend/             Production frontend — React 18 CDN + Babel Standalone
  index.html          Public site home (static page, links to other public pages)
  app.html            Customer application SPA (React CDN)
  admin.html          Administrator console SPA (React CDN)
  assets/             theme.css (design system carried over from Design 02), images
  js/                 classic scripts, no modules: config, services, components, views
backend/              Node.js + TypeScript + Express REST API (Oracle Cloud VM)
  src/                config, middleware, routes, services, utils
  migrations/         Supabase PostgreSQL SQL migrations (forward-only)
  tests/              Vitest unit + integration tests
.github/workflows/    GitHub Pages deployment of the prototype (design reference)
```

## 3. The development cycle (every task)

Work in **passes**. One pass = one coherent, reviewable unit of work. A pass is
a commit checkpoint, not a stopping point.

1. **Recall first.** Read `PROJECT_STATUS.md` and this file. They record the
   architecture, current status, known gotchas and the exact continuation point.
2. **Declare the mode** in one sentence before touching anything:
   `extend` (new feature), `fix` (defect), `audit` (review), `infra` (config/deploy).
3. **Investigate before planning.** Read the code you will touch and the code
   next to it. Grep before using any symbol; read before editing any file.
   Never plan from memory of an API — confirm it exists in this codebase or in
   the pinned documentation for the exact version in use.
4. **Plan the pass** (small enough to audit): intended outcome, files to touch,
   test plan, rollback note. If new evidence contradicts the plan mid-pass,
   stop and re-plan instead of patching around the contradiction.
5. **Implement.** Stay inside the declared file set. No drive-by refactors,
   no "while I'm here" edits. If the pass genuinely needs to grow the file set,
   say so and why first.
6. **Verify** (see the ladder in section 5). Never weaken a test, skip a check,
   broaden a suppression or relax a type to get green output. A red check means
   the code, the test or the specification is wrong — find out which.
7. **Review the change list** before committing: read `git status` /
   `git diff --stat` line by line; scratch files, one-off probes and debug notes
   never enter a commit.
8. **Update `PROJECT_STATUS.md`** (what was done, what was verified and how,
   what remains, exact next task) and record any decision made where a spec or
   instruction was silent in the decisions ledger section of `PROJECT_STATUS.md`.
9. **Commit** with a conventional message (`feat:`, `fix:`, `chore:`, `docs:`,
   `test:`, `refactor:`) referencing the pass.
10. **Continue** to the next unfinished task. Only stop for the conditions in
    section 7 or a genuine external blocker.

## 4. Non-negotiable engineering rules

1. **Never claim work is complete without verification evidence.** State what
   ran, what it established, and what was NOT verified. Never say "should work".
2. **Never manufacture financial results.** No fake payment success, no balance
   edits, no fabricated ledger entries — in code, seeds or tests presented as
   production behaviour.
3. **Authorization is enforced server-side, always.** Client-side checks are UX
   only. Deny by default: an endpoint without an explicit policy returns 403.
   Every authorization check runs on every action, not just login.
4. **Secrets never enter the repository, logs or chat output.** Only
   `.env.example` (with placeholder values) is committed. If a secret leaks:
   rotate immediately, invalidate exposed copies, audit access, write a post-mortem.
5. **Fix protocol** (for any defect): reproduce it and watch it fail before
   touching code; name the root cause explicitly (file + line + invariant
   violated); declare the file scope and stay inside it; apply the minimum fix;
   add or update the test that would have caught it; re-run the original failing
   scenario against the running system, not just the new test; report diff +
   root cause + test name. Then grep the codebase for the same flaw in sibling
   modules, and audit why the testing system let it through.
6. **Database rules:** money amounts are `numeric(19,4)` (or minor-unit bigint
   where a provider requires it) — never floats; phone numbers stored E.164
   text; timestamps are `timestamptz`; every table has a purpose; every index
   serves a named query; migrations are forward-only, expand-then-contract for
   renames; test RLS by querying as a different user.
7. **Frontend rules:** every screen implements four states — loading (skeleton),
   empty (with a primary action), error (with a next step), populated. Styles
   reference `frontend/assets/theme.css` tokens only — no hardcoded colors or
   one-off spacing. The design system of Design 02 is the contract; visual
   changes require comparing against the prototype.
8. **TypeScript backend rules:** no `any` in new code; functions stay under ~50
   lines; parse, don't validate — invariants are guaranteed at construction;
   request bodies are schema-validated (Zod) at the boundary.
9. **File-size ratchet:** no new source file exceeds ~600 lines; when one must
   grow past it, split by concept in the same pass.
10. **Hallucination guards:** grep-before-use; read-before-edit;
    typecheck-before-commit (`npm run typecheck` in `backend/`); docs for THIS
    version, not docs in general; when uncertain, run it — do not reason about
    what code will do; schema-validate external responses.

## 5. Verification ladder

A claim of "done" must cite the level reached. Minimum levels:

| Level | Proof | Minimum required for |
|-------|-------|----------------------|
| L0 | lint + type-check clean, `node --check` for classic scripts | any code change |
| L1 | unit tests green (paste the pass count) | any module |
| L2 | process boots clean, `/health` returns 200 | backend changes |
| L3 | behavior observed: real endpoint call + database row seen | claiming a backend feature done |
| L4 | user flow observed in a real browser against the running system | claiming a frontend feature done |
| L5 | deployed and verified on target infrastructure | claiming a release |

If the environment cannot reach the required level (missing credential, no
external service), say so explicitly and mark the item `blocked: <reason>` in
`PROJECT_STATUS.md`. Never imply verification that did not happen.

For changes touching authentication, authorization, payments, data migrations,
public APIs, concurrency, infrastructure, security or privacy, additionally:
STRIDE-threat-model the new surface and record the six decisions (mitigated /
accepted / deferred, each with an owner and a code pointer) in
`SECURITY_REVIEW.md`.

## 6. Testing policy

- Test the contract, not the implementation detail. A test names the promise it
  protects and the realistic defect that turns it red.
- Route: state the contract → name the oracle (requirement, not current
  behaviour) → derive cases from failure mechanisms → choose the cheapest level
  that still contains the mechanism (unit → integration → e2e) → show that the
  check can fail.
- Authorization tests go through the server with two different users.
- Migration tests apply real migrations to an isolated environment with
  representative rows.
- Uniqueness/atomicity tests use a real database engine.
- Never: compute `expected` with the code under test; write a test where only
  mocks execute; use fixed sleeps or retry-until-green; skip a flaky test
  instead of fixing it.

## 7. Stop conditions — pause and ask the repository owner

Stop and request a human decision (do not proceed autonomously) when:

- A change touches money movement, payment-provider contracts or ledger logic.
- A migration is destructive (drop column/table, rename, type change) on data
  that may exist outside development.
- A change alters authentication, authorization or RLS policies.
- A choice locks in a vendor or changes monthly cost materially.
- Production DNS, production databases or the Oracle VM would be modified.
- More than one third-party SaaS would be added in a single pass.
- Repository push credentials are required (never push without authorization).

Everything else proceeds autonomously, recording decisions in the ledger.

## 8. Commands (canonical)

```bash
# Backend (from backend/)
npm install
npm run dev            # start API with ts-node + watch
npm run build          # compile TypeScript to dist/
npm run typecheck      # tsc --noEmit
npm test               # Vitest unit + integration suite
npm run lint           # ESLint

# Frontend (no build step) — serve statically
cd frontend && python3 -m http.server 4173
# app:      http://localhost:4173/app.html
# admin:    http://localhost:4173/admin.html
# syntax check classic scripts: node --check js/**/*.js (see frontend/check.sh)

# Prototype (design reference)
cd prototype && python3 -m http.server 4174

# Database migrations (Supabase project required — see DEPLOYMENT_GUIDE.md)
# Apply via Supabase SQL editor or: supabase db push (project-linked)
```

## 9. Environment variables

Backend (`backend/.env`, never committed; see `backend/.env.example`):
`PORT`, `NODE_ENV`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`, `RATE_LIMIT_*`, `LOG_LEVEL`.

Frontend (`frontend/js/config.js`, non-secret values only):
`API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. The Supabase anon/publishable
key is public by design; the Supabase service-role key is server-side only and
must never appear in `frontend/`.

## 10. Continuity contract

- Update `PROJECT_STATUS.md` at the end of every pass: completed work, files
  changed, tests executed and their results, known defects, blockers, exact
  next task, and the decisions ledger.
- The handoff test: a fresh session reading `AGENTS.md` + `PROJECT_STATUS.md`
  must be able to take the next action with zero questions. If it could not,
  the memory is incomplete — fix it before stopping.
- Persist decisions and their *why*, gotchas discovered, and anything a fresh
  session would re-learn the hard way. Do not persist what the code already says.
- Never commit secrets. Never force-push. Never rewrite history on `main`.
- Work happens on the `development` branch (or feature branches off it);
  `main` receives merges only.
