const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "ethara-ai-taskmanager-db.json");
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const emptyDb = {
  counters: { users: 0, projects: 0, tasks: 0 },
  users: [],
  projects: [],
  projectMembers: [],
  tasks: []
};

function readDb() {
  if (!fs.existsSync(DB_FILE)) writeDb(emptyDb);
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function now() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashPassword(password, salt).split(":")[1]));
}

function b64url(input) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

function signToken(user) {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ id: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 7 * 86400 });
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = String(token || "").split(".");
  if (!header || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function clean(value) {
  return String(value || "").trim();
}

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
}

function currentUser(req, db) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  if (!payload) return null;
  return db.users.find((user) => user.id === payload.id) || null;
}

function isProjectMember(db, projectId, userId) {
  return db.projectMembers.find((member) => member.projectId === projectId && member.userId === userId);
}

function canSeeProject(db, user, projectId) {
  return user.role === "admin" || Boolean(isProjectMember(db, projectId, user.id));
}

function decorateTask(db, task) {
  const project = db.projects.find((item) => item.id === task.projectId);
  const assignee = db.users.find((item) => item.id === task.assigneeId);
  const today = new Date().toISOString().slice(0, 10);
  const displayStatus = task.status !== "done" && task.dueDate < today ? "overdue" : task.status;
  return {
    ...task,
    project_name: project?.name || "Unknown project",
    assignee_name: assignee?.name || "",
    display_status: displayStatus
  };
}

function seed() {
  const db = JSON.parse(JSON.stringify(emptyDb));
  const dateOffset = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const addUser = (name, email, role) => {
    const user = { id: ++db.counters.users, name, email, passwordHash: hashPassword("password123"), role, createdAt: now() };
    db.users.push(user);
    return user;
  };
  const admin = addUser("Shreya Shrivastava", "shreya@ethara.ai", "admin");
  const aarav = addUser("Aarav Mehta", "aarav@ethara.ai", "member");
  const ananya = addUser("Ananya Rao", "ananya@ethara.ai", "member");
  const kabir = addUser("Kabir Sharma", "kabir@ethara.ai", "member");
  const project = { id: ++db.counters.projects, name: "Ethara AI Workspace", description: "Coordinate internal tasks, client dashboards, reviews, and team delivery timelines.", status: "active", ownerId: admin.id, createdAt: now() };
  db.projects.push(project);
  db.projectMembers.push(
    { projectId: project.id, userId: admin.id, role: "admin" },
    { projectId: project.id, userId: aarav.id, role: "member" },
    { projectId: project.id, userId: ananya.id, role: "member" },
    { projectId: project.id, userId: kabir.id, role: "member" }
  );
  const addTask = (title, description, assigneeId, status, priority, dueDate) => {
    db.tasks.push({ id: ++db.counters.tasks, projectId: project.id, title, description, assigneeId, status, priority, dueDate, createdBy: admin.id, createdAt: now(), updatedAt: now() });
  };
  addTask("Finalize Ethara AI task board", "Review dashboard sections, role permissions, and task workflow before submission.", aarav.id, "in_progress", "high", dateOffset(3));
  addTask("Check client dashboard copy", "Proofread labels, empty states, and project descriptions for a clean presentation.", ananya.id, "todo", "high", dateOffset(-1));
  addTask("Prepare weekly planning notes", "Collect updates and pending items for the Ethara AI team review.", kabir.id, "review", "medium", dateOffset(5));
  writeDb(db);
  console.log("Seed complete. Login with shreya@ethara.ai / password123");
}

function routeStatic(req, res) {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const filePath = urlPath === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  const type =
    ext === ".js" ? "text/javascript" :
    ext === ".css" ? "text/css" :
    [".jpg", ".jpeg"].includes(ext) ? "image/jpeg" :
    ext === ".png" ? "image/png" :
    "text/html";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

async function routeApi(req, res) {
  const db = readDb();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const body = ["POST", "PATCH"].includes(req.method) ? await readBody(req) : {};
  const user = currentUser(req, db);

  if (req.method === "OPTIONS") return send(res, 200, {});
  if (url.pathname === "/api/health") return send(res, 200, { ok: true });

  if (url.pathname === "/api/auth/signup" && req.method === "POST") {
    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "member";
    if (name.length < 2) return send(res, 400, { message: "Name must be at least 2 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { message: "Valid email required" });
    if (password.length < 6) return send(res, 400, { message: "Password must be at least 6 characters" });
    if (db.users.some((item) => item.email === email)) return send(res, 409, { message: "Email already registered" });
    const next = { id: ++db.counters.users, name, email, passwordHash: hashPassword(password), role, createdAt: now() };
    db.users.push(next);
    writeDb(db);
    return send(res, 201, { token: signToken(next), user: publicUser(next) });
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const found = db.users.find((item) => item.email === clean(body.email).toLowerCase());
    if (!found || !verifyPassword(String(body.password || ""), found.passwordHash)) return send(res, 401, { message: "Invalid email or password" });
    return send(res, 200, { token: signToken(found), user: publicUser(found) });
  }

  if (!user) return send(res, 401, { message: "Authentication required" });

  if (url.pathname === "/api/me") return send(res, 200, { user: publicUser(user) });
  if (url.pathname === "/api/users") return send(res, 200, { users: db.users.map(publicUser).sort((a, b) => a.name.localeCompare(b.name)) });

  if (url.pathname === "/api/dashboard") {
    const projects = db.projects
      .filter((project) => canSeeProject(db, user, project.id))
      .map((project) => ({
        ...project,
        member_count: db.projectMembers.filter((member) => member.projectId === project.id).length,
        task_count: db.tasks.filter((task) => task.projectId === project.id).length
      }));
    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = db.tasks.filter((task) => projectIds.has(task.projectId)).map((task) => decorateTask(db, task));
    return send(res, 200, {
      projects,
      tasks,
      stats: {
        projects: projects.length,
        tasks: tasks.length,
        overdue: tasks.filter((task) => task.display_status === "overdue").length,
        done: tasks.filter((task) => task.status === "done").length
      }
    });
  }

  if (url.pathname === "/api/projects" && req.method === "POST") {
    if (user.role !== "admin") return send(res, 403, { message: "Admin access required" });
    const name = clean(body.name);
    const description = clean(body.description);
    if (name.length < 3) return send(res, 400, { message: "Project name must be at least 3 characters" });
    const project = { id: ++db.counters.projects, name, description, status: "active", ownerId: user.id, createdAt: now() };
    db.projects.push(project);
    db.projectMembers.push({ projectId: project.id, userId: user.id, role: "admin" });
    for (const userId of new Set((body.memberIds || []).map(Number))) {
      if (db.users.some((item) => item.id === userId) && userId !== user.id) db.projectMembers.push({ projectId: project.id, userId, role: "member" });
    }
    writeDb(db);
    return send(res, 201, { project });
  }

  if (parts[1] === "projects" && parts[2] && req.method === "GET") {
    const projectId = Number(parts[2]);
    if (!canSeeProject(db, user, projectId)) return send(res, 403, { message: "Project access denied" });
    const project = db.projects.find((item) => item.id === projectId);
    const members = db.projectMembers.filter((member) => member.projectId === projectId).map((member) => ({ ...publicUser(db.users.find((item) => item.id === member.userId)), project_role: member.role }));
    const tasks = db.tasks.filter((task) => task.projectId === projectId).map((task) => decorateTask(db, task));
    return send(res, 200, { project, members, tasks });
  }

  if (parts[1] === "projects" && parts[3] === "members" && req.method === "POST") {
    const projectId = Number(parts[2]);
    const membership = isProjectMember(db, projectId, user.id);
    if (user.role !== "admin" && membership?.role !== "admin") return send(res, 403, { message: "Project admin access required" });
    const userId = Number(body.userId);
    if (!db.users.some((item) => item.id === userId)) return send(res, 400, { message: "Valid user id required" });
    db.projectMembers = db.projectMembers.filter((member) => !(member.projectId === projectId && member.userId === userId));
    db.projectMembers.push({ projectId, userId, role: body.role === "admin" ? "admin" : "member" });
    writeDb(db);
    return send(res, 201, { message: "Member added" });
  }

  if (url.pathname === "/api/tasks" && req.method === "POST") {
    const projectId = Number(body.projectId);
    if (!canSeeProject(db, user, projectId)) return send(res, 403, { message: "Project access denied" });
    const title = clean(body.title);
    const dueDate = clean(body.dueDate);
    const status = ["todo", "in_progress", "review", "done"].includes(body.status) ? body.status : "todo";
    const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
    const assigneeId = body.assigneeId ? Number(body.assigneeId) : null;
    if (title.length < 3) return send(res, 400, { message: "Task title must be at least 3 characters" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return send(res, 400, { message: "Due date must be YYYY-MM-DD" });
    if (assigneeId && !isProjectMember(db, projectId, assigneeId)) return send(res, 400, { message: "Assignee must belong to the project" });
    const task = { id: ++db.counters.tasks, projectId, title, description: clean(body.description), assigneeId, status, priority, dueDate, createdBy: user.id, createdAt: now(), updatedAt: now() };
    db.tasks.push(task);
    writeDb(db);
    return send(res, 201, { task: decorateTask(db, task) });
  }

  if (parts[1] === "tasks" && parts[2] && req.method === "PATCH") {
    const task = db.tasks.find((item) => item.id === Number(parts[2]));
    if (!task) return send(res, 404, { message: "Task not found" });
    const membership = isProjectMember(db, task.projectId, user.id);
    const canEdit = user.role === "admin" || membership?.role === "admin" || task.assigneeId === user.id || task.createdBy === user.id;
    if (!canEdit) return send(res, 403, { message: "Task access denied" });
    if (body.title !== undefined) task.title = clean(body.title);
    if (body.description !== undefined) task.description = clean(body.description);
    if (body.assigneeId !== undefined) task.assigneeId = body.assigneeId ? Number(body.assigneeId) : null;
    if (["todo", "in_progress", "review", "done"].includes(body.status)) task.status = body.status;
    if (["low", "medium", "high"].includes(body.priority)) task.priority = body.priority;
    if (body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) task.dueDate = body.dueDate;
    task.updatedAt = now();
    writeDb(db);
    return send(res, 200, { task: decorateTask(db, task) });
  }

  if (parts[1] === "tasks" && parts[2] && req.method === "DELETE") {
    const taskIndex = db.tasks.findIndex((item) => item.id === Number(parts[2]));
    if (taskIndex === -1) return send(res, 404, { message: "Task not found" });
    const task = db.tasks[taskIndex];
    const membership = isProjectMember(db, task.projectId, user.id);
    if (user.role !== "admin" && membership?.role !== "admin" && task.createdBy !== user.id) return send(res, 403, { message: "Task delete access denied" });
    db.tasks.splice(taskIndex, 1);
    writeDb(db);
    return send(res, 200, { message: "Task deleted" });
  }

  send(res, 404, { message: "Route not found" });
}

if (process.argv.includes("--seed") || !fs.existsSync(DB_FILE)) seed();

http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) routeApi(req, res).catch((error) => send(res, 500, { message: error.message }));
  else routeStatic(req, res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`ETHARA AI TASK MANAGER running at http://127.0.0.1:${PORT}`);
  console.log("Demo login: shreya@ethara.ai / password123");
});
