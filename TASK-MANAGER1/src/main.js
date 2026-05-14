const API = "/api";

const icons = {
  spark: "✦",
  folder: "▣",
  tasks: "☑",
  warning: "!",
  done: "✓",
  shield: "◆",
  plus: "+",
  users: "●"
};

const statusLabels = {
  all: "All",
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
  overdue: "Overdue"
};

let state = {
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  dashboard: { projects: [], tasks: [], stats: {} },
  users: [],
  selectedId: null,
  filter: "all",
  error: ""
};

async function request(path, options = {}) {
  const token = localStorage.getItem("ttm_token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function html(strings, ...values) {
  return strings.reduce((out, part, index) => out + part + (values[index] ?? ""), "");
}

function optionList(items, selected = "") {
  return items.map((item) => `<option value="${item.id}" ${String(item.id) === String(selected) ? "selected" : ""}>${item.name} (${item.role || "member"})</option>`).join("");
}

function setUser(user, token) {
  localStorage.setItem("ttm_user", JSON.stringify(user));
  localStorage.setItem("ttm_token", token);
  state.user = user;
  render();
  loadDashboard();
}

function logout() {
  localStorage.removeItem("ttm_user");
  localStorage.removeItem("ttm_token");
  state = { ...state, user: null, dashboard: { projects: [], tasks: [], stats: {} }, users: [], selectedId: null };
  render();
}

function authScreen(mode = "login") {
  return html`
    <main class="auth-shell">
      <section class="auth-visual">
        <div>
          <span class="brand-mark">${icons.spark} ETHARA AI</span>
          <h1>ETHARA AI<br /><span>TASK MANAGER</span></h1>
          <p>A calm workspace for organising people, projects, assignments, and deadlines with role-based access for every team member.</p>
        </div>
        <div class="auth-board">
          <div class="mini-task"><span>Ethara AI website tasks</span><strong>In progress</strong></div>
          <div class="mini-task"><span>Client dashboard review</span><strong>Overdue</strong></div>
          <div class="mini-task"><span>Team planning notes</span><strong>Review</strong></div>
        </div>
        <footer class="made-by">Made by Shreya Shrivastava</footer>
      </section>
      <section class="auth-panel">
        <div class="segmented">
          <button class="${mode === "login" ? "active" : ""}" data-auth-mode="login">Login</button>
          <button class="${mode === "signup" ? "active" : ""}" data-auth-mode="signup">Signup</button>
        </div>
        <form id="auth-form" data-mode="${mode}">
          ${mode === "signup" ? `
            <label>Name<input name="name" autocomplete="name" required /></label>
            <label>Role<select name="role"><option value="member">Member</option><option value="admin">Admin</option></select></label>
          ` : ""}
          <label>Email<input name="email" type="email" value="shreya@ethara.ai" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" value="password123" autocomplete="current-password" required /></label>
          ${state.error ? `<p class="error">${state.error}</p>` : ""}
          <button class="primary">${mode === "login" ? "Login" : "Create account"}</button>
        </form>
      </section>
    </main>
  `;
}

function stat(icon, label, value, tone) {
  return `<section class="stat ${tone}"><span class="stat-icon">${icon}</span><span>${label}</span><strong>${value || 0}</strong></section>`;
}

function dashboardScreen() {
  const { projects, tasks, stats } = state.dashboard;
  const selected = projects.find((project) => project.id === state.selectedId) || projects[0];
  const visibleTasks = tasks.filter((task) => {
    const projectMatch = !selected || task.projectId === selected.id;
    const filterMatch = state.filter === "all" || task.display_status === state.filter || task.status === state.filter;
    return projectMatch && filterMatch;
  });

  return html`
    <main class="app-shell">
      <aside class="sidebar">
        <div class="logo">${icons.spark} ETHARA AI<br /><span>TASK MANAGER</span></div>
        <nav>
          ${projects.map((project) => `
            <button class="${selected?.id === project.id ? "active" : ""}" data-project="${project.id}">
              <span>${icons.folder}</span><span>${project.name}</span><small>${project.task_count}</small>
            </button>
          `).join("")}
        </nav>
        <button class="logout" id="logout">⇠ Logout</button>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">${state.user.role === "admin" ? "Admin workspace" : "Member workspace"}</p>
            <h1>${selected?.name || "Team dashboard"}</h1>
            <p>${selected?.description || "Create projects and assign the first tasks."}</p>
          </div>
          <div class="profile">${icons.shield} ${state.user.name}<span>${state.user.role}</span></div>
        </header>
        ${state.error ? `<p class="error">${state.error}</p>` : ""}
        <div class="stats-row">
          ${stat(icons.folder, "Projects", stats.projects, "blue")}
          ${stat(icons.tasks, "Tasks", stats.tasks, "green")}
          ${stat(icons.warning, "Overdue", stats.overdue, "red")}
          ${stat(icons.done, "Done", stats.done, "gray")}
        </div>
        <section class="main-grid">
          <div class="task-zone">
            <div class="section-title">
              <h2>Tasks</h2>
              <div class="filters">
                ${Object.keys(statusLabels).map((key) => `<button class="${state.filter === key ? "active" : ""}" data-filter="${key}">${statusLabels[key]}</button>`).join("")}
              </div>
            </div>
            <div class="kanban">
              ${visibleTasks.map(taskCard).join("") || `<div class="empty">No tasks match this view.</div>`}
            </div>
          </div>
          <aside class="right-rail">
            ${accessPanel()}
            ${state.user.role === "admin" ? projectForm() : ""}
            ${taskForm(selected)}
            ${teamPanel()}
          </aside>
        </section>
      </section>
      <footer class="app-footer">Made by Shreya Shrivastava</footer>
    </main>
  `;
}

function taskCard(task) {
  const canEdit = state.user.role === "admin" || task.assigneeId === state.user.id || task.createdBy === state.user.id;
  return html`
    <article class="task-card ${task.display_status}">
      <div class="task-top">
        <span class="pill ${task.display_status}">${statusLabels[task.display_status]}</span>
        <span class="priority ${task.priority}">${task.priority}</span>
      </div>
      <h3>${task.title}</h3>
      <p>${task.description || "No description"}</p>
      <div class="task-meta">
        <span>◷ ${task.dueDate}</span>
        <span>${icons.users} ${task.assignee_name || "Unassigned"}</span>
      </div>
      ${canEdit ? `
        <div class="task-actions">
          <select data-task-status="${task.id}" title="Update task status">
            ${["todo", "in_progress", "review", "done"].map((item) => `<option value="${item}" ${task.status === item ? "selected" : ""}>${statusLabels[item]}</option>`).join("")}
          </select>
          ${state.user.role === "admin" ? `
            <select data-task-assignee="${task.id}" title="Reassign task">
              <option value="">Unassigned</option>
              ${optionList(state.users, task.assigneeId)}
            </select>
          ` : `<span class="locked-control">Assigned access</span>`}
        </div>
      ` : `<div class="locked-control full">View only for your role</div>`}
    </article>
  `;
}

function accessPanel() {
  const isAdmin = state.user.role === "admin";
  return html`
    <section class="access-panel ${isAdmin ? "admin" : "member"}">
      <div>
        <span class="access-kicker">${isAdmin ? "Admin access" : "Member access"}</span>
        <h2>${isAdmin ? "Full team control" : "Focused task workspace"}</h2>
      </div>
      <ul>
        ${isAdmin ? `
          <li>Create projects and add team members</li>
          <li>Assign and reassign any project task</li>
          <li>Edit every task across visible projects</li>
        ` : `
          <li>View projects where you are a member</li>
          <li>Create tasks inside your project workspace</li>
          <li>Update tasks assigned to you or created by you</li>
        `}
      </ul>
    </section>
  `;
}

function projectForm() {
  return html`
    <form class="composer" id="project-form">
      <h2>${icons.folder} New project</h2>
      <input name="name" placeholder="Project name" required />
      <textarea name="description" placeholder="Project description"></textarea>
      <select name="memberIds" multiple>${optionList(state.users)}</select>
      <button class="primary">${icons.plus} Create project</button>
    </form>
  `;
}

function taskForm(selected) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return html`
    <form class="composer" id="task-form">
      <h2>${icons.tasks} New task</h2>
      <select name="projectId" required>
        <option value="">Choose project</option>
        ${state.dashboard.projects.map((project) => `<option value="${project.id}" ${selected?.id === project.id ? "selected" : ""}>${project.name}</option>`).join("")}
      </select>
      <input name="title" placeholder="Task title" required />
      <textarea name="description" placeholder="Task details"></textarea>
      <div class="form-grid">
        <select name="assigneeId"><option value="">Unassigned</option>${optionList(state.users)}</select>
        <select name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select>
        <input type="date" name="dueDate" value="${tomorrow}" required />
      </div>
      <button class="primary">${icons.plus} Create task</button>
    </form>
  `;
}

function teamPanel() {
  return html`
    <section class="team-panel">
      <h2>${icons.users} Team</h2>
      ${state.users.map((member) => `
        <div class="member" data-initial="${member.name.slice(0, 1).toUpperCase()}">
          <span>${member.name}</span>
          <small>${member.email}</small>
          <b>${member.role}</b>
        </div>
      `).join("")}
    </section>
  `;
}

function render() {
  document.getElementById("root").innerHTML = state.user ? dashboardScreen() : authScreen();
}

async function loadDashboard() {
  if (!state.user) return;
  try {
    const [me, dashboard, users] = await Promise.all([request("/me"), request("/dashboard"), request("/users")]);
    state.user = me.user;
    localStorage.setItem("ttm_user", JSON.stringify(me.user));
    state.dashboard = dashboard;
    state.users = users.users;
    state.selectedId = state.selectedId || dashboard.projects[0]?.id || null;
    state.error = "";
  } catch (error) {
    state.error = error.message;
  }
  render();
}

document.addEventListener("click", (event) => {
  const mode = event.target.closest("[data-auth-mode]")?.dataset.authMode;
  if (mode) {
    state.error = "";
    document.getElementById("root").innerHTML = authScreen(mode);
  }
  const projectId = event.target.closest("[data-project]")?.dataset.project;
  if (projectId) {
    state.selectedId = Number(projectId);
    render();
  }
  const filter = event.target.closest("[data-filter]")?.dataset.filter;
  if (filter) {
    state.filter = filter;
    render();
  }
  if (event.target.closest("#logout")) logout();
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    if (form.id === "auth-form") {
      const data = await request(`/auth/${form.dataset.mode}`, { method: "POST", body: JSON.stringify(values) });
      setUser(data.user, data.token);
    }
    if (form.id === "project-form") {
      values.memberIds = [...form.elements.memberIds.selectedOptions].map((option) => Number(option.value));
      await request("/projects", { method: "POST", body: JSON.stringify(values) });
      await loadDashboard();
    }
    if (form.id === "task-form") {
      await request("/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          projectId: Number(values.projectId),
          assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
          status: "todo"
        })
      });
      await loadDashboard();
    }
  } catch (error) {
    state.error = error.message;
    render();
  }
});

document.addEventListener("change", async (event) => {
  const statusId = event.target.dataset.taskStatus;
  const assigneeId = event.target.dataset.taskAssignee;
  try {
    if (statusId) await request(`/tasks/${statusId}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) });
    if (assigneeId) await request(`/tasks/${assigneeId}`, { method: "PATCH", body: JSON.stringify({ assigneeId: event.target.value ? Number(event.target.value) : null }) });
    if (statusId || assigneeId) await loadDashboard();
  } catch (error) {
    state.error = error.message;
    render();
  }
});

render();
loadDashboard();
