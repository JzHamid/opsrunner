# OpsRunner - Agent Instructions

This is a real automation product project for Jazhem Hamid.

## Goal
Build OpsRunner into a secure internal operations platform for requests, tasks, approvals, clients, workflow execution, and audit history.

The existing focused task runner and n8n integration are the working foundation of the platform and must remain functional throughout the expansion.

## Product Positioning
OpsRunner is not a tutorial, not a template, and not a portfolio mockup. Present it as a small internal automation product for running repeatable operational tasks.

## Tech Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- n8n Cloud
- n8n webhook
- Server-side API route
- Vercel deployment

Do not add AI unless a future phase explicitly approves it. AI must never become a requirement for the core product.

## Approved Platform Phases

Implement one checkpoint at a time. Do not combine checkpoints without explicit approval.

### Phase 1A - Contract Tests
- Add focused contract tests only.
- Do not implement Supabase.
- Do not move routes.
- Do not redesign the UI.

### Phase 1B - Supabase Foundation
- Add Supabase packages and browser/server clients.
- Add the tenancy migration, RLS policies, seed data, and generated types.
- Do not add authentication screens or protect routes yet.
- Limit the schema to profiles, organizations, and organization memberships.
- Keep profiles self-only and do not expose an organization member directory.
- Do not add `proxy.ts`, service-role handling, or authorization via `getSession()`.

## Phase 1C Authentication Scope

Phase 1C adds invite-only authentication and secure session handling.

Build only:

- Supabase SSR session refresh
- invite-only magic-link login
- authentication confirmation
- sign-out
- verified user helpers
- authenticated and unauthenticated route handling
- no-access state
- authentication tests

Do not add:

- public signup
- password signup
- organization management UI
- application sidebar
- route movement for the task runner
- requests, tasks, approvals, or clients
- AI providers
- n8n workflow changes

## Authentication Rules

- Authentication is invite-only.
- Public login must not create new users.
- Use `shouldCreateUser: false`.
- Use magic-link authentication.
- Use `/auth/confirm` for token-hash verification.
- Use `@supabase/ssr` for browser and server clients.
- Use `proxy.ts` for cookie/session refresh.
- Use `getClaims()` for verified identity checks.
- Do not trust `getSession()` for authorization.
- Create Supabase clients per request on the server.
- Do not store server clients in module-level state.
- Do not add a service-role or secret key.
- Do not authorize from user metadata.
- Authenticated users without an active organization membership must go to `/no-access`.
- Avoid redirect loops between `/`, `/login`, and `/no-access`.

## Authentication UI Rules

Keep authentication screens sleek and low cognitive load.

Prefer:

- one focused form
- short supporting copy
- clear success and error states
- calm product styling
- no marketing-heavy landing page
- no dense card layouts

Avoid:

- public signup language
- excessive instructions
- social login buttons unless explicitly added later
- unnecessary navigation
- crowded layouts

### Phase 1D - Protected Workspace
- Add the organization-aware application shell.
- Move the existing runner into its protected route without redesigning it.
- Protect `/api/run-task` with a verified user and active organization membership.
- Add n8n webhook secret validation without changing the webhook path or response contract.

## Phase 1D Authorization Rules

- Resolve `/` to the authenticated user's first active organization at
  `/org/[organizationSlug]/run`.
- Reauthorize organization routes in Server Components through verified claims,
  RLS, and an active membership. Do not rely on proxy authorization alone.
- Treat client-supplied organization slugs only as lookup hints. Derive trusted
  organization IDs and user IDs on the server.
- Authorize `/api/run-task` inside the route handler because `/api/*` remains
  excluded from proxy redirects.
- Send `X-OpsRunner-Secret` to n8n from
  `N8N_OPSRUNNER_WEBHOOK_SECRET`. Never expose or log that secret.
- Return the same not-found behavior for unknown, inactive, and
  cross-organization route access so organization existence is not disclosed.

## Architecture Decisions

- Use organization-scoped memberships and roles.
- In Phase 1, profile access is self-only. Do not expose an organization member directory.
- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Supabase.
- Use `APP_URL` only on the server for authentication email redirects.
- Keep `N8N_OPSRUNNER_WEBHOOK_URL` server-side.
- Keep `N8N_OPSRUNNER_WEBHOOK_SECRET` server-side.
- Do not add a Supabase secret key or service-role key.
- Preserve the current task types, `/api/run-task`, n8n contract, fallback handling, and deterministic output behavior.
- Preserve the current runner UI until a redesign is explicitly approved.

## Frontend Design Direction
Create a sleek, low-cognitive-load product interface.

Avoid:
- Dense dashboards
- Too many cards
- Too much helper text
- Excessive badges
- Showing every technical detail at once
- Generic AI SaaS styling
- Cramming everything into one screen

Prefer:
- One primary action per screen
- Short labels
- Clear hierarchy
- Strong spacing
- Calm premium visual style
- Progressive disclosure
- Details hidden behind drawers, tabs, or accordions
- Clean loading, empty, success, and error states

The UI should feel like a real product, not a tutorial, not a template, and not a portfolio mockup.

## Security Rules
- Never expose n8n webhook URLs on the client.
- Never expose the n8n webhook authentication secret on the client.
- Use server-side API routes for webhook calls.
- Store webhook URLs in environment variables.
- Never create users from the public magic-link login flow.
- Never expose Supabase secret or service-role credentials.
- Do not expose `APP_URL` through a `NEXT_PUBLIC_` variable.
- Enforce organization isolation with RLS and verified active memberships.
- Do not commit .env.local.
- Add .env.example.
- Do not log secrets.

## Build Rules
- Work in phases.
- Do not overbuild.
- Keep the first version simple and working.
- Run npm run lint and npm run build after changes.
- Fix all errors before summarizing.
