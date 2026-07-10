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

### Phase 1C - Authentication
- Add invite-only magic-link authentication.
- Add session refresh, login, confirmation, sign-out, and no-access handling.
- Public login must use `shouldCreateUser: false` and must not create users.
- Verify token hashes through `/auth/confirm`; do not use a generic `/auth/callback` route.
- Send authenticated users without an active membership to `/no-access`.

### Phase 1D - Protected Workspace
- Add the organization-aware application shell.
- Move the existing runner into its protected route without redesigning it.
- Protect `/api/run-task` with a verified user and active organization membership.
- Add n8n webhook secret validation without changing the webhook path or response contract.

## Architecture Decisions

- Use organization-scoped memberships and roles.
- In Phase 1, profile access is self-only. Do not expose an organization member directory.
- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Supabase.
- Keep `N8N_OPSRUNNER_WEBHOOK_URL` server-side.
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
- Use server-side API routes for webhook calls.
- Store webhook URLs in environment variables.
- Never create users from the public magic-link login flow.
- Never expose Supabase secret or service-role credentials.
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
