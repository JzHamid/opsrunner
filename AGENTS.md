# OpsRunner - Agent Instructions

This is a real automation product project for Jazhem Hamid.

## Goal
Build OpsRunner, a clean internal task runner for triggering approved n8n workflows from a focused web interface.

## Product Positioning
OpsRunner is not a tutorial, not a template, and not a portfolio mockup. Present it as a small internal automation product for running repeatable operational tasks.

## Tech Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- n8n Cloud
- n8n webhook
- Server-side API route
- Optional AI provider through n8n
- Vercel deployment

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
- Do not commit .env.local.
- Add .env.example.
- Do not log secrets.

## Build Rules
- Work in phases.
- Do not overbuild.
- Keep the first version simple and working.
- Run npm run lint and npm run build after changes.
- Fix all errors before summarizing.