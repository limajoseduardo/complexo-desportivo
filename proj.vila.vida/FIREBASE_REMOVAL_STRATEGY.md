# Complexo Desportivo - Firebase Removal & Self-Hosted Migration Strategy

## Current State Analysis
- **Firebase Dependencies Identified**: 
  - Firebase Authentication
  - Firestore (real-time database)
  - Firebase Storage (for images)
  - Google Gemini AI API (will be removed)
  - Firebase Emulator (dev environment)

- **Project Structure**:
  - React 19 + Vite frontend
  - TypeScript types defined for complete sports facility management
  - No backend API yet (will be created with Node.js/Express)

## Migration Timeline: 3 Phases

### Phase 1: Backend Infrastructure & Database (Days 1-2)
**Status**: ✅ **COMPLETED** - All files ready in outputs folder

Files prepared:
- ✅ `docker-compose.yml` - 11-service production stack
- ✅ `init-db.sql` - Complete database schema (20+ tables)
- ✅ `server.ts` - Express API with JWT authentication
- ✅ `package.json` - All Node.js dependencies
- ✅ `Dockerfile-backend` - Multi-stage build configuration
- ✅ `nginx.conf` - Reverse proxy with SSL/TLS

**Next Actions**:
1. Transfer all deployment files to VM at `/opt/complexo-desportivo/`
2. Deploy docker-compose stack
3. Verify all services start successfully
4. Run database initialization

### Phase 2: Frontend Refactoring (Days 2-3)

#### 2a. Remove Firebase Dependencies

**Remove from package.json**:
```
- firebase
- @react-firebase/*
- firebase-admin
- @google-cloud/firestore
```

**Remove from source**:
1. Delete `src/config/firebase.ts` (or equivalent)
2. Delete any Firebase initialization code
3. Remove Firebase service imports from all components
4. Delete Firestore query files: `src/services/firestore/*`
5. Delete Firebase authentication files: `src/services/auth/firebase.ts`
6. Delete Firebase storage files: `src/services/storage/*`

**Remove environment variables**:
- Remove from `.env.example`:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIRESTORE_DATABASE_ID`
  - `VITE_USE_FIREBASE_EMULATOR`
  - `VITE_FIRESTORE_EMULATOR_HOST`
  - `VITE_FIRESTORE_EMULATOR_PORT`
  - `VITE_AUTH_EMULATOR_URL`
  - `GEMINI_API_KEY`

#### 2b. Add Local Authentication Service

Create `src/services/auth/localAuth.ts`:
```typescript
export const authenticate = async (email: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }
  throw new Error(data.error);
};
```

#### 2c. Create API Client Layer

Create `src/services/api/client.ts`:
```typescript
const API_BASE = process.env.VITE_API_URL || '/api';

export const apiClient = {
  get: async (url: string) => {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
    });
    return response.json();
  },
  
  post: async (url: string, data: any) => {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
```

#### 2d. Add New Environment Variables

Update `.env.example`:
```
VITE_API_URL=http://localhost:3001/api
VITE_BASE_URL=/
NODE_ENV=development
```

### Phase 3: API Endpoint Mapping (Days 3-4)

#### 3a. Authentication Endpoints
- ✅ `POST /api/auth/register` - User registration
- ✅ `POST /api/auth/login` - User login (JWT token)
- ✅ `POST /api/auth/logout` - Logout and token revocation
- ✅ `POST /api/auth/refresh` - Refresh expired token
- ✅ `POST /api/auth/forgot-password` - Password reset
- ✅ `POST /api/auth/reset-password` - Complete password reset

#### 3b. User Management Endpoints
- ✅ `GET /api/users/me` - Current user profile
- ✅ `PATCH /api/users/me` - Update user profile
- ✅ `GET /api/users/:id` - User details (by ID)
- ✅ `DELETE /api/users/:id` - User deletion (admin only)

#### 3c. Facilities Endpoints
- ✅ `GET /api/facilities` - List all facilities
- ✅ `GET /api/facilities/:id` - Facility details
- ✅ `POST /api/facilities` - Create facility (admin)
- ✅ `PUT /api/facilities/:id` - Update facility (admin)
- ✅ `DELETE /api/facilities/:id` - Delete facility (admin)

#### 3d. Classes (Modalidades) Endpoints
- ✅ `GET /api/classes` - List all classes
- ✅ `GET /api/classes/:id` - Class details
- ✅ `POST /api/classes` - Create class (professor/admin)
- ✅ `PUT /api/classes/:id` - Update class
- ✅ `DELETE /api/classes/:id` - Delete class

#### 3e. Class Sessions Endpoints
- ✅ `GET /api/classes/:classId/sessions` - Sessions for a class
- ✅ `POST /api/classes/:classId/sessions` - Create session
- ✅ `PUT /api/classes/sessions/:sessionId` - Update session
- ✅ `DELETE /api/classes/sessions/:sessionId` - Delete session

#### 3f. Class Registrations Endpoints
- ✅ `POST /api/classes/sessions/:sessionId/register` - Register for class
- ✅ `DELETE /api/classes/sessions/:sessionId/register/:registrationId` - Cancel registration
- ✅ `GET /api/users/me/registrations` - User's class registrations

#### 3g. Access Control & RFID Endpoints
- `POST /api/access/check-in` - Check-in with RFID
- `POST /api/access/check-out` - Check-out with RFID
- `GET /api/access/logs` - Access logs (admin)
- `GET /api/access/logs/:userId` - User access logs

#### 3h. Health Metrics Endpoints
- `POST /api/health-metrics` - Record health metric
- `GET /api/health-metrics` - User's metrics
- `GET /api/health-metrics/:id` - Specific metric details

#### 3i. Training Plans Endpoints
- `POST /api/training-plans` - Create training plan
- `GET /api/training-plans` - User's training plans
- `PUT /api/training-plans/:id` - Update plan
- `DELETE /api/training-plans/:id` - Delete plan

#### 3j. Exercises Endpoint
- `GET /api/exercises` - List all exercises
- `POST /api/exercises` - Add new exercise (admin/professor)

#### 3k. Meal Tracking Endpoints
- `POST /api/meals` - Log meal
- `GET /api/meals` - User's meals
- `PUT /api/meals/:id` - Update meal
- `DELETE /api/meals/:id` - Delete meal

#### 3l. Operational Logs (Pool Management)
- `POST /api/operational-logs` - Log pool maintenance
- `GET /api/operational-logs` - View logs (admin/staff)

### Phase 4: Frontend Component Updates (Days 4-5)

#### 4a. Update All Components Using Firebase

Search and replace patterns:
```typescript
// OLD: import { getFirestore, collection, getDocs } from "firebase/firestore"
// NEW: import { apiClient } from '@/services/api/client'

// OLD: const users = await getDocs(collection(db, "users"))
// NEW: const users = await apiClient.get('/users')

// OLD: await setDoc(doc(db, "users", userId), userData)
// NEW: await apiClient.post('/users/me', userData)
```

#### 4b. Update Authentication Flow

Components to update:
- Login page: Use new `localAuth` service
- Register page: Create user via `/api/auth/register`
- Profile page: Fetch from `/api/users/me`
- Protected routes: Check `localStorage.getItem('auth_token')`

#### 4c. Image Upload Replacement

- **Old**: Firebase Storage
- **New**: Backend file upload via `/api/upload`
- Store uploaded URLs in user_profiles.photo_url (PostgreSQL)

#### 4d. Real-time Updates

- **Old**: Firestore listeners
- **New**: 
  - Polling via `setInterval(apiClient.get(...), 5000)`
  - OR WebSocket connection for live updates
  - Consider Socket.io for real-time class enrollment

### Phase 5: Testing & Deployment (Days 5-6)

#### 5a. Local Testing
```bash
# Start Docker stack
docker-compose up -d

# Seed test data
npm run db:seed

# Run tests
npm run test

# Start frontend dev server
npm run dev

# Verify API endpoints
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

#### 5b. Deployment Steps
1. Update DNS: `buildlab.pt` → `192.168.1.107`
2. Configure SSL certificates with Let's Encrypt
3. Deploy via docker-compose to VM
4. Run smoke tests
5. Enable monitoring (Prometheus + Grafana)

### Phase 6: Monitoring & Optimization (Ongoing)

- ✅ Prometheus metrics collection (ready)
- ✅ Grafana dashboards (ready)
- ✅ ELK Stack for logging (ready)
- Health checks on all services
- Performance monitoring
- Error tracking

## Database Schema Mapping

The `init-db.sql` file includes all necessary tables:

| Firestore Collection | PostgreSQL Table | Status |
|---|---|---|
| users | users | ✅ |
| userProfiles | user_profiles | ✅ |
| facilities | facilities | ✅ |
| classes | classes | ✅ |
| classSessions | class_sessions | ✅ |
| classRegistrations | class_registrations | ✅ |
| rfidTags | rfid_tags | ✅ |
| accessLogs | access_logs | ✅ |
| healthMetrics | health_metrics | ✅ |
| meals | meals | ✅ |
| trainingPlans | training_plans | ✅ |
| exercises | exercises | ✅ |
| operationalLogs | operational_logs | ✅ |

## File Checklist

**Ready for Deployment** ✅
- [ ] `/opt/complexo-desportivo/docker-compose.yml`
- [ ] `/opt/complexo-desportivo/nginx.conf`
- [ ] `/opt/complexo-desportivo/Dockerfile-backend`
- [ ] `/opt/complexo-desportivo/src/server.ts`
- [ ] `/opt/complexo-desportivo/package.json`
- [ ] `/opt/complexo-desportivo/init-db.sql`

**To Create** 
- [ ] `.env.production` with secrets
- [ ] SSL certificates (Let's Encrypt)
- [ ] Database backup scripts
- [ ] Monitoring dashboards
- [ ] CI/CD pipeline

## Estimated Timeline

- **Phase 1**: 1-2 hours (infrastructure deployment)
- **Phase 2**: 2-3 hours (Firebase removal)
- **Phase 3**: 3-4 hours (additional API endpoints)
- **Phase 4**: 4-5 hours (component updates)
- **Phase 5**: 2-3 hours (testing & deployment)
- **Total**: ~16-20 hours of work

## Success Criteria

✅ All external dependencies removed
✅ 100% self-hosted solution
✅ Zero Firebase references in code
✅ All data stored in PostgreSQL
✅ JWT authentication working
✅ Domain buildlab.pt resolving to 192.168.1.107
✅ SSL/TLS certificates active
✅ All monitoring dashboards active
✅ Zero external API calls (except maybe NTP)

