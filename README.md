# EventPilot — AI-Powered Event Management Assistant

EventPilot converts an Event Manager’s planning conversations into a live, actionable event operations dashboard. Rather than keeping chat as a separate source of notes, it turns updates into tasks, deadlines, dependencies, risks, and next steps.

## 1. Approach to solving the problem

Event Managers receive fragmented updates: a vendor becomes unavailable, a venue is confirmed, travelling guests need rooms, or a transport supplier has insufficient capacity. EventPilot uses a **conversation-to-operations** approach:

```text
Manager's message
        ↓
AI extraction and planning rules
        ↓
Structured tasks + risks + recommendations
        ↓
MongoDB event plan
        ↓
Live dashboard for decisions and execution
```

For example, this update:

```text
The transportation vendor can only provide vehicles for 150 people.
```

For a 200-person corporate event becomes:

```text
Risk: Transportation shortfall: 50 seats
Severity: Critical

Task: Resolve transportation capacity shortfall
Priority: Urgent
Status: Blocked

Suggested action: Secure additional vehicles or split arrivals.
```

### Product capabilities

- Conversational updates are converted to structured event operations data.
- Tasks capture category, assignee, priority, status, due date, and dependency.
- Risks are proactively flagged for vendor unavailability, capacity shortfalls, overdue work, and unowned workstreams.
- Duplicate AI actions are reconciled so a repeat update updates the current plan instead of creating duplicate work.
- Wedding and Corporate Outing demos are separate events, selectable from the dashboard header.
- The dashboard prioritizes what needs a manager’s decision, not only a chat transcript.

## 2. Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | Next.js, React, CSS | Responsive event dashboard and conversational interface |
| Backend | Node.js, Express.js | REST API and application business logic |
| Database | MongoDB, Mongoose | Events, tasks, risks, users, and conversation persistence |
| Authentication | JWT, bcryptjs | Protected manager accounts and event-level data isolation |
| AI | OpenAI-compatible API or local planner | Conversation extraction into JSON tasks and risks |
| Deployment option | Docker Compose | Local container-based API, web app, and MongoDB setup |

The backend follows MVC architecture:

```text
models/       MongoDB schema definitions
controllers/  Request handling and business workflow
routes/       API endpoints
services/     AI extraction and proactive risk detection
middleware/   JWT authentication and error handling
config/       Database connection
```

## 3. Dashboard design

The dashboard is designed as an Event Manager’s control centre.

- **Plan progress** — completed versus total tasks.
- **Needs attention** — urgent, overdue, and blocked work.
- **Risks that need a call** — critical issues requiring a decision.
- **Priority actions** — the actionable execution queue, with ownership and dependencies.
- **Key milestones** — event run-of-show and deadline visibility.
- **AI panel** — plain-language updates from the Event Manager.

This makes the chat interface the input method, while the dashboard remains the source of truth for execution.

## 4. Setup instructions

### Prerequisites

- Node.js 20 or newer
- MongoDB Community Server running locally on port `27017`

### Run MongoDB

If MongoDB is installed through Homebrew:

```bash
brew services start mongodb-community@8.0
```

Verify the service is running:

```bash
brew services list
```

### Run the application

From the project root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
npm install --prefix backend
npm install --prefix frontend
```

Start the backend in one terminal:

```bash
npm run dev --prefix backend
```

Expected output:

```text
MongoDB connected: 127.0.0.1/eventpilot
EventPilot API listening on :5001
```

Start the frontend in another terminal:

```bash
npm run dev --prefix frontend
```

Open [http://localhost:3000](http://localhost:3000).

The app creates a demo account plus separate Wedding and Corporate Outing plans automatically. Use the event selector at the top to switch between them.

### Optional OpenAI configuration

The app works without an API key using its local planning extractor. To use OpenAI, add these values to `backend/.env`:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
```

### Docker option

If Docker is installed:

```bash
docker compose up --build
```

## 5. Example prompts for testing

### Wedding plan

```text
The photographer is unavailable for the Reception.
```

Expected: a critical photography risk and an urgent, blocked task to source a Reception photographer.

```text
Around 150 guests will be travelling from outside the city. Please arrange accommodation and airport transfers.
```

Expected: accommodation and airport-transfer tasks for 150 travelling guests.

### Corporate outing plan

First select **Vertex Team Offsite 2026**, then enter:

```text
The transportation vendor has informed us that they can only provide vehicles for 150 people.
```

Expected: a critical transport shortfall of 50 seats and an urgent blocked task.

## 6. Key assumptions and design decisions

1. **One source of truth:** Tasks and risks are stored as structured data, rather than existing only in chat messages. Original messages are retained in the conversation history for auditability.

2. **AI suggests; the manager decides:** AI creates recommendations and flags risks, but the Event Manager can review, complete, or change task status on the dashboard.

3. **Safe local fallback:** An OpenAI key is optional. The local planning service recognizes the main event-management scenarios so the project is demonstrable offline and does not fail when an AI provider is unavailable.

4. **Explainable automation:** Every generated risk includes a human-readable explanation and recommended action. The goal is operational assistance, not a black-box score.

5. **Separate event plans:** Wedding and Corporate Outing scenarios use separate event records. A 150-seat vehicle capacity means different shortfalls for a 400-guest wedding and a 200-employee outing.

6. **Prevent duplicate actions:** Matching task/risk logic normalizes wording such as `decor` and `décor`, and reconciles repeated vendor or transportation updates.

7. **Security scope:** JWT protects API routes and records are queried by owner. The demo frontend uses local storage for simplicity; production should use HTTPS, secure HTTP-only cookies, rate limiting, managed MongoDB backups, and secret management.

## 7. API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an Event Manager account |
| `POST` | `/api/auth/login` | Receive a JWT |
| `GET/POST` | `/api/events` | List or create owned events |
| `POST` | `/api/events/demo` | Create Wedding or Corporate demo plans |
| `GET` | `/api/dashboard/event/:eventId` | Fetch dashboard data |
| `GET/POST` | `/api/tasks/event/:eventId` | List or create tasks |
| `PATCH` | `/api/tasks/:taskId` | Update task status/details |
| `GET/POST` | `/api/chat/event/:eventId`, `/api/chat` | Read conversation or process an AI update |
