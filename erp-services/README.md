# ERP Portal — Unified Authentication Gateway

Tanzania Port Authority · Multi-system single-login portal

---

## Overview

The ERP portal provides a **single login entry point** for all TPA systems.
A user signs in once and is automatically routed to the system(s) their
account exists in — no need to remember separate URLs or login pages.

```
User → ERP Portal Login → Authenticate via Default System (URA)
                        → Fan-out lookup across all registered systems
                        → 1 match  → auto-redirect with token
                        → 2+ matches → system picker → redirect with token
```

---

## Repository Structure

```
erp-services/               ← Node.js/Express backend (port 4500)
erp-frontend/               ← React/TypeScript frontend (port 4173)
child-erp-endpoint/
  ura/                      ← Files to add to URA Security System
  icdv/                     ← Files to add to ICDV Management
  proj/                     ← Same as icdv/ (different path prefix)
  mgmt/                     ← Files to add to Management System
```

---

## 1 · ERP Services Backend

### Setup

```bash
cd erp-services
npm install
cp .env.example .env        # fill in your values
```

### .env

```env
NODE_ENV=development
PORT=4500

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=erp_portal_db

JWT_SECRET=change_this_to_a_long_random_string
JWT_ACCESS_EXPIRATION_MINUTES=60
JWT_REFRESH_EXPIRATION_DAYS=7
```

### Database

```bash
mysql -u root -p < src/config/migration.sql
```

This creates the `erp_portal_db` database and seeds the four default
software profiles. **Before deploying**, update the `erp_secret` values
in the seed data — or update them via the admin UI after first login.

### Run

```bash
npm run dev     # development (nodemon)
npm start       # production
```

### API Endpoints

| Method | Path                                | Auth                  | Description                                       |
| ------ | ----------------------------------- | --------------------- | ------------------------------------------------- |
| POST   | `/api/v1/auth/validate-credentials` | —                     | Step 1: proxy to default system                   |
| POST   | `/api/v1/auth/send-otp`             | —                     | Step 2: proxy to default system                   |
| POST   | `/api/v1/auth/verify-otp`           | —                     | Step 3: verify + fan-out + return matched systems |
| POST   | `/api/v1/auth/login`                | —                     | Direct login (non-OTP path)                       |
| GET    | `/api/v1/profiles`                  | ERP JWT (super_admin) | List all profiles                                 |
| POST   | `/api/v1/profiles`                  | ERP JWT (super_admin) | Create profile                                    |
| PATCH  | `/api/v1/profiles/:id`              | ERP JWT (super_admin) | Update profile                                    |
| PATCH  | `/api/v1/profiles/:id/set-default`  | ERP JWT (super_admin) | Change default system                             |
| DELETE | `/api/v1/profiles/:id`              | ERP JWT (super_admin) | Delete profile                                    |
| GET    | `/api/v1/health`                    | —                     | Health check                                      |

### Changing the Default System

The default system is the one used for authentication (credentials + OTP).
Currently URA Security System is the default.

To change it via SQL:

```sql
UPDATE software_profiles SET is_default = 0;
UPDATE software_profiles SET is_default = 1 WHERE name = 'ICDV Management';
```

Or via the admin UI: Login → `/admin` → "Set Default" button on any profile.

Only one profile can be default at a time — the DB trigger enforces this.

---

## 2 · ERP Frontend

### Setup

```bash
cd erp-frontend
npm install
cp .env.example .env
```

### .env

```env
VITE_ERP_API_URL=http://localhost:4500/api/v1
```

### Run

```bash
npm run dev     # port 4173
npm run build
```

### Login Flow (UI)

1. User enters username/email + password
2. If OTP required → choose email or SMS → enter 6-digit code
3. ERP backend fans out to all systems, returns matches
4. **1 match** → 3-second countdown then auto-redirect
5. **2+ matches** → system picker card list → user clicks one → redirect

### Admin UI (`/admin`)

Available to users with `super_admin` role (from the default system).
Allows full CRUD on software profiles:

- Add a new child system
- Edit URLs, icons, descriptions
- Rotate the `erp_secret`
- Activate / deactivate a system
- Change which system is the default

---

## 3 · Child System Integration

Each child system needs **3 files added** and **1 line in the router**.

### URA Security System

**Copy these files:**

| Source                                           | Destination in URA                  |
| ------------------------------------------------ | ----------------------------------- |
| `child-erp-endpoint/ura/erpSecret.middleware.js` | `src/middlewares/erpSecret.js`      |
| `child-erp-endpoint/ura/erp.controller.js`       | `src/controllers/erp.controller.js` |
| `child-erp-endpoint/ura/erp.routes.js`           | `src/routes/erp.routes.js`          |

**Add to `src/routes/index.js`:**

```js
router.use("/erp", require("./erp.routes"));
```

**Add to `.env`:**

```env
ERP_SECRET=CHANGE_THIS_URA_SECRET_BEFORE_DEPLOY
```

> Must match the `erp_secret` stored for URA in the ERP database.

---

### ICDV Management

**Copy these files:**

| Source                                            | Destination in ICDV             |
| ------------------------------------------------- | ------------------------------- |
| `child-erp-endpoint/icdv/erpSecret.middleware.js` | `middlewares/erpSecret.js`      |
| `child-erp-endpoint/icdv/erp.controller.js`       | `controllers/erp.controller.js` |
| `child-erp-endpoint/icdv/erp.route.js`            | `routes/v1/erp.route.js`        |

**Add to `routes/v1/index.js`:**

```js
router.use("/erp", require("./erp.route"));
```

**Add to `.env`:**

```env
ERP_SECRET=CHANGE_THIS_ICDV_SECRET_BEFORE_DEPLOY
```

---

### Project Management

Same files as ICDV but placed under `src/`:

| Source                                            | Destination in Project Mgmt         |
| ------------------------------------------------- | ----------------------------------- |
| `child-erp-endpoint/icdv/erpSecret.middleware.js` | `src/middlewares/erpSecret.js`      |
| `child-erp-endpoint/icdv/erp.controller.js`       | `src/controllers/erp.controller.js` |
| `child-erp-endpoint/icdv/erp.route.js`            | `src/routes/v1/erp.route.js`        |

**Add to `src/routes/v1/index.js`:**

```js
router.use("/erp", require("./erp.route"));
```

**The `enrichUser` function** in `erp.controller.js` tries to join the
`icdvs` table — this table does not exist in Project Management.
Remove the `enrichUser` call and the `icdv_id`/`icdv_name` fields from
`SAFE_USER_FIELDS` in that copy.

**Add to `.env`:**

```env
ERP_SECRET=CHANGE_THIS_PROJ_SECRET_BEFORE_DEPLOY
```

---

### Management System

**Copy these files:**

| Source                               | Destination in Mgmt System |
| ------------------------------------ | -------------------------- |
| `child-erp-endpoint/mgmt/erpCtrl.js` | `Controllers/erpCtrl.js`   |
| `child-erp-endpoint/mgmt/erpRt.js`   | `Routes/erpRt.js`          |

**Add to `server.js`:**

```js
const erpRoutes = require("./Routes/erpRt");
App.use("/api/erp", erpRoutes);
```

**The Management System uses `/api/erp/lookup-user`** (no `/v1/`).
Update the `api_base_url` lookup endpoint in `erp-services` proxy.service.js
if you want a consistent path — or keep as-is since the ERP backend calls
the path set per-profile in the DB.

**Add to `.env` (or set in the process environment):**

```env
ERP_SECRET=CHANGE_THIS_MGMT_SECRET_BEFORE_DEPLOY
```

> **Note:** The Management System does not currently use `.env` files.
> You can add `dotenv` or set `ERP_SECRET` directly in `process.env`
> via PM2 ecosystem config or system environment variables.

---

## 4 · Child Frontend Token Handler

When the ERP portal redirects to a child app it appends:

```
http://localhost:5173/?token=xxx&refreshToken=yyy
```

The child frontend must detect and store these tokens on startup.

**Add the hook file:**

Copy `erp-frontend/src/hooks/useErpTokenHandler.ts` into each child
frontend at `src/hooks/useErpTokenHandler.ts`.

**Use it in `App.tsx`** (inside `<AuthProvider>`):

```tsx
import { useErpTokenHandler } from "./hooks/useErpTokenHandler";

// Add this component just inside AuthProvider:
function ErpInit() {
  useErpTokenHandler();
  return null;
}

// Inside your router/app tree:
<AuthProvider>
  <ErpInit /> {/* ← add this */}
  <Router>...</Router>
</AuthProvider>;
```

The hook reads `?token=` from the URL, stores it under `access_token`
and `refresh_token` in localStorage (the same keys `AuthContext` reads),
cleans the URL, then reloads so `AuthContext` picks up the new tokens
and the user lands on the dashboard already authenticated.

---

## 5 · Secret Key Management

Each child system has its **own unique secret**. This means:

- Rotating one system's secret does not affect others
- If one system is compromised, the others remain protected
- Update via the admin UI → Edit Profile → new `erp_secret` value
- Then update the child system's `.env` `ERP_SECRET` and restart it

**Generating a strong secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6 · Port Reference

| Service                | Default Port           |
| ---------------------- | ---------------------- |
| ERP Services (backend) | `4500`                 |
| ERP Portal (frontend)  | `4173`                 |
| Management System      | `8686`                 |
| URA Security System    | `3001` (set in `.env`) |
| ICDV Management        | `3002` (set in `.env`) |
| Project Management     | `3003` (set in `.env`) |

---

## 7 · PM2 Deployment

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "erp-services",
      cwd: "./erp-services",
      script: "src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4500,
        DB_HOST: "127.0.0.1",
        DB_NAME: "erp_portal_db",
        // ... other env vars
      },
    },
  ],
};
```

---

## 8 · Security Notes

- The `x-erp-secret` header is **never logged** by child systems
- All `/erp/*` routes return `401` with no detail if the secret is wrong
- The ERP backend rate-limits auth routes: 30 requests per 15 minutes per IP
- ERP portal JWT (`erpToken`) is separate from child system tokens —
  it only grants access to the ERP admin routes, not child system resources
- Never commit `.env` files — use `.env.example` as a template
