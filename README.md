# OpsRunner

OpsRunner is a focused internal task runner for approved business workflows.
It gives operators a clean web interface while keeping n8n execution behind a
server-side Next.js API route.

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` with:

```bash
N8N_OPSRUNNER_WEBHOOK_URL=
```

The webhook URL is read only by the server-side route. Do not expose it in
client code.

## Checks

```bash
npm run lint
npm run build
```
