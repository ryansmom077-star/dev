# Copilot Instructions for Unknown.cc Forum

## Architecture Overview

This is a **monorepo** with a Vite Vue 3 frontend and Express.js backend:
- **Frontend** (root dir): Vue 3 + Vite + Vue Router, runs on port 5173
- **Backend** (`server/` dir): Express + lowdb (JSON database), runs on port 3000
- **Database**: JSON-based persistence at `server/db.json` with schema: `uidCounter`, `forumStatus`, `ranks`, `roles`, `forumCategories`, `forums`, `users`, `threads`, `posts`, `keys`, `accountLogs`
- **Auth**: JWT tokens (stored in localStorage), supports 2FA via email
- **Deployment**: Frontend → Netlify, Backend → Render (with persistent disk at `/var/data` for `db.json`)

## Dev Setup & Commands

**Start both servers** (recommended in separate terminals):
```bash
# Terminal 1 - Backend
cd server
npm install
npm run dev  # Uses nodemon for hot reload, port 3000

# Terminal 2 - Frontend  
npm install
npm run dev  # Vite dev server, port 5173
```

**Environment configuration**:
- Frontend: Use `VITE_API_BASE` env var (e.g., `VITE_API_BASE=https://api.example.com npm run build`)
- Backend: Config at `server/config.json` - set `adminIps` (auto-staff on register), SMTP for email
- Default API route: `http://localhost:3000/api` during local dev

## Key Patterns & Conventions

### API Endpoints
- All endpoints follow `/api/{resource}` pattern (e.g., `/api/threads`, `/api/admin/users`)
- Most require `authMiddleware` (validates JWT), many require `staffMiddleware`
- Response format: `{ error: "msg" }` on failure, `{ data: {...} }` or route-specific on success
- HTTP methods: POST for mutating actions, GET for reads, DELETE for removal, PUT for updates

### Frontend Authentication Flow
1. Login → `/api/auth/login` → returns `token` + `user` object + `requiresTwoFa` flag
2. On 2FA required: show code input, POST to `/api/auth/2fa/confirm-login` with `tempToken`
3. Store token & user in localStorage: `localStorage.setItem('token', data.token)`
4. **Auto sign-in**: If `localStorage.remember` exists + valid token, auto-populate user (see `main.js`)
5. **Route guards**: `router.beforeEach()` checks `requiresAuth`, `requiresStaff`, `requiresForumAccess` meta

### API Base URL Resolution
- Frontend: `src/lib/apiBase.js` exports `API_BASE`
- Logic: Use `VITE_API_BASE` env var if set, else infer from `window.location` (same host, port 3000)
- All fetch calls: `fetch(\`${API_BASE}/api/...\`)`

### Database Access
- Backend directly modifies `db.data` (lowdb format), then calls `await db.write()`
- User creation: Generate `nanoid()` for ID, bcrypt password, add to `db.data.users`
- Forum structure: Categories → Forums → Threads → Posts (1-to-many relationships via IDs)

### Middleware Pattern (Backend)
```javascript
// authMiddleware: Validates JWT, sets req.user
// staffMiddleware: Requires role in ['admin', 'manager'] or roles array
// forumAccessMiddleware: Checks !user.accessRevoked
app.post('/api/endpoint', authMiddleware, staffMiddleware, async (req, res) => { ... })
```

### Admin IP Auto-Elevation
- Config at `server/config.json`: `adminIps` array
- On register/login: If client IP in list → set `staffRole: 'admin'` automatically
- Used for development/testing (add your IP to become staff)

## Project-Specific Details

### User & Role System
- **User fields**: `id`, `username`, `email`, `passwordHash`, `role`, `staffRole`, `roles`, `accessRevoked`, `twoFaEnabled`, `twoFaSecret`
- **Role types**: Single `role` field (legacy) + `staffRole` ('admin', 'manager') + `roles` array (role IDs)
- **Staff check in frontend**: `user?.staffRole === 'admin' || user?.staffRole === 'manager' || user?.roles?.includes('role_admin')`

### Forum Structure
- **Categories**: `{ id, name, color }`
- **Forums**: `{ id, name, description, categoryId }`
- **Threads**: `{ id, title, authorId, forumId, createdAt, updatedAt }`
- **Posts**: `{ id, content, authorId, threadId, createdAt, updatedAt }`

### Email Integration
- Optional SMTP config in `server/config.json`
- If SMTP missing: emails fallback to `console.log` (see `sendEmail()`)
- Email templates use HTML + plain text (helper functions: `formatEmail()`, `formatPasswordResetEmail()`)

### Authentication-Related Endpoints
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Auth + optional 2FA redirect
- `POST /api/auth/2fa/confirm-login` - Verify 2FA code
- `POST /api/auth/reset/request` - Send password reset email
- `POST /api/auth/reset/confirm` - Complete password reset

### Admin Panel Features (Vue views + Backend)
- User management: Ban/unban, change staff role, create users
- Key generation: Invite keys for forum access (with usage limits)
- Role management: Create/edit/delete custom roles with permissions
- Forum control: Toggle forum open/closed status
- Thread/post moderation: Delete threads or posts
- Account logs: Audit trail via `accountLogs` in db

## Important Implementation Notes

1. **localStorageToken handling**: Check both localStorage and cookies; JWT has 2 dots (heuristic in `main.js`)
2. **Stripe integration**: Referenced in backend but not fully implemented in visible code
3. **Nodemailer**: Used for 2FA codes, password resets—configure SMTP or codes log to console
4. **"remember me"**: Sets localStorage key `remember='1'`; cleared on logout
5. **2FA temporary token**: Valid only once; prevents reuse of old confirmations
6. **Post ordering**: No explicit sorting in data model; order by array position or add timestamp
7. **Error handling frontend**: Most components use try/catch with `error.value` ref for UI messages
8. **CORS**: Backend enables CORS (see express setup); include `credentials: 'include'` in fetch for cookies

## File Structure Reference

- `src/views/` - Main Vue pages (Home, Forums, Thread, Admin, etc.)
- `src/router.js` - Route definitions + auth guards
- `src/lib/apiBase.js` - API URL resolution
- `server/index.js` - All backend endpoints & middleware (~1840 lines)
- `server/db.json` - Persistent database
- `server/config.json` - Admin IPs, SMTP settings
- `vite.config.js` - Frontend build config (Vite + Vue plugin)
