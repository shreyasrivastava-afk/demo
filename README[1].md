# ETHARA AI TASK MANAGER

A full-stack Team Task Manager with authentication, project/team management, task assignment, status tracking, deadline handling, and role-based access control.

## Features

- Signup and login with signed auth tokens
- Admin and member roles
- Project creation and project membership
- Task creation, assignment, status changes, priorities, and due dates
- Automatic overdue display for unfinished tasks past their deadline
- REST API backed by a persisted document-style NoSQL JSON database
- Responsive dashboard UI

## Run

```powershell
node server/index.js
```

Then open:

```text
http://127.0.0.1:5000
```

## Demo Login

```text
Email: shreya@ethara.ai
Password: password123
```

Member demo:

```text
Email: aarav@ethara.ai
Password: password123
```

The database is stored at `server/data/ethara-ai-taskmanager-db.json`. If it is missing, the server creates and seeds it automatically.

## API Highlights

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/users`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/members`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
