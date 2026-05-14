# Ethara AI Task Manager

A lightweight, full-stack team task manager built with vanilla JavaScript and Node.js — no frameworks, no dependencies. Supports multi-user authentication, role-based access control, project management, and real-time task tracking with overdue detection.

> Built for small teams that need a clean, focused workspace without the overhead of heavy tooling.

🔗 **Live Demo:** [task-manager-production-0a85.up.railway.app](https://task-manager-production-0a85.up.railway.app/)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, CSS, HTML |
| Backend | Node.js (built-in `http` module) |
| Auth | Custom JWT (HMAC-SHA256, no libraries) |
| Database | JSON flat-file (zero setup) |
| Deployment | Railway |

---

## Features

- **Authentication** — Signup/login with signed JWT tokens, 7-day expiry
- **Role-based access** — Admin and Member roles with separate permissions
- **Projects** — Create projects, manage members, track progress
- **Tasks** — Create, assign, update status and priority, set due dates
- **Overdue detection** — Tasks past their due date are automatically flagged
- **Zero dependencies** — Pure Node.js, nothing to install

---

## Getting Started

### Prerequisites

- Node.js v18 or higher

### Run locally

```bash
git clone https://github.com/shreyasrivastava-afk/Task-Manager.git
cd Task-Manager
node server/index.js
```

Then open [http://localhost:5000](http://localhost:5000) in your browser.

The database is auto-created and seeded on first run at `server/data/ethara-ai-taskmanager-db.json`.

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | shreya@ethara.ai | password123 |
| Member | pushkar@ethara.ai | password123 |

---

## Project Structure

```
Task-Manager/
├── assets/             # Static assets (logo, images)
├── server/
│   ├── index.js        # Express-style HTTP server, all API routes
│   └── data/           # Auto-generated JSON database (gitignored)
├── src/
│   ├── main.js         # Frontend app logic and rendering
│   └── styles.css      # All styles
├── index.html          # App entry point
├── Procfile            # Railway start command
└── package.json
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login and receive a token |
| GET | `/api/me` | Get current user info |

### Projects
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/projects` | Create a project (Admin only) |
| GET | `/api/projects/:id` | Get project with tasks and members |
| POST | `/api/projects/:id/members` | Add a member to a project |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | Get all projects and tasks for current user |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

All protected endpoints require an `Authorization: Bearer <token>` header.

---

## Deployment

This project is deployed on [Railway](https://railway.app). The `Procfile` tells Railway to run:

```
web: node server/index.js
```

The `PORT` environment variable is automatically picked up from Railway's settings.

---

## Notes

- The JSON database is ephemeral on Railway — data resets on each redeploy. For persistent storage, swap `writeDb`/`readDb` in `server/index.js` with a proper database (PostgreSQL, MongoDB, etc.)
- Passwords are hashed with PBKDF2 (100,000 iterations, SHA-256)
- JWT signatures use HMAC-SHA256 — set a strong `JWT_SECRET` environment variable in production
