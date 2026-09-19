# EventPilot

EventPilot turns an event manager’s conversational updates into a live operations dashboard: tasks, dependencies, deadlines, operational risks, milestones, and action prompts are all kept in sync.

## What is implemented

- An event control centre with progress, risk, budget, task, and milestone views.
- A conversational AI command panel. Messages are persisted, converted into structured work, and return an explainable manager-facing response.
- Rules for operational risks: vendor unavailability, transport-capacity gaps, unowned workstreams, and overdue tasks.
- An optional OpenAI provider plus a capable offline extraction engine for local demos and predictable fallback behavior.
- JWT authentication and data isolation by event owner.
- MVC backend: `models`, `controllers`, `routes`, `services`, `middleware`, and `config` are cleanly separated.
- A one-click seeded wedding event so the interface is immediately demonstrable. Try: “The transportation vendor can only provide vehicles for 350 people.”

## Run locally

Prerequisites: Node 20+ and a running MongoDB instance.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
npm install --prefix backend
npm install --prefix frontend
npm run dev --prefix backend
npm run dev --prefix frontend
```

Open `http://localhost:3000`. The web app creates a local demo account and event on first launch. MongoDB should be available at the URI in `backend/.env`.

Or, with Docker installed:

```bash
docker compose up --build
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an event manager account |
| `POST` | `/api/auth/login` | Receive a JWT |
| `GET/POST` | `/api/events` | List or create owned events |
| `POST` | `/api/events/demo` | Create the showcase wedding event |
| `GET` | `/api/dashboard/event/:eventId` | Fetch the aggregated control centre |
| `GET/POST` | `/api/tasks/event/:eventId` | List or add a task |
| `PATCH` | `/api/tasks/:taskId` | Update task state/details |
| `GET/POST` | `/api/chat/event/:eventId`, `/api/chat` | Read conversation or process an AI update |

## AI design

`backend/services/aiPlanningService.js` is the single conversion boundary between unstructured conversation and planning data. With `OPENAI_API_KEY`, it asks an LLM for a constrained JSON plan; if the provider is unavailable or not configured, it uses the local event-planning extractor. Every extracted task and risk is stored separately from the original message, preserving an audit trail and keeping dashboard calculations deterministic.

For production, place the API behind HTTPS, use an HTTP-only cookie or a secure token vault rather than local storage, put rate limiting around `/api/chat`, and use a managed MongoDB service with backups. The environment variables are already separated for a natural AWS/GCP deployment.
