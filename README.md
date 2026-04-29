# Stride

AI-powered sports biomechanics feedback platform that turns a training video into measurable movement analysis and coach-style guidance.

Built as a full-stack system with:
- React frontend (`Frontend/Stride`)
- Node.js API backend (`Backend`)
- Python computer-vision microservice (`Backend/stride-cv`)

## Resume Snapshot (Quantitative)

- Built and integrated **3 production deployable services** (frontend + API + CV engine)
- Implemented **15 authenticated/public REST endpoints** in the Node backend (+ health check)
- Implemented **2 CV endpoints** in FastAPI (`/health`, `/analyze`)
- Shipped **7 end-user routes/screens** in React
- Wrote/organized **48 source files** (`.js/.jsx/.py`) with ~**4,162 LOC**
- Designed motion analytics across **6 tracked joint-angle streams** (left/right knee, hip, elbow)
- Added movement classification across **5 classes** (`squat`, `jump`, `sprint`, `throw`, `unknown`)
- Added secure auth flows: **email OTP**, **password login**, **Google OAuth**, **JWT cookie sessions**

## What This Project Does

Stride lets an athlete:
1. Sign up/login (OTP/password/Google).
2. Upload a sports video directly to Azure Blob Storage using SAS URLs.
3. Trigger analysis for that video.
4. Run pose extraction + biomechanics metric generation in a Python CV service.
5. Store analysis, movement segments, and injury flags in MongoDB.
6. Generate AI feedback plus follow-up prompts.
7. Ask follow-up coaching questions tied to each analysis session.

## End-to-End Flow

1. **Auth**
- User authenticates via `/auth/*`.
- Backend issues `httpOnly` JWT cookie (30-day expiry).

2. **Direct Video Upload**
- Frontend asks backend for a signed upload URL (`/files/generate-upload-url`).
- Browser uploads video to Azure Blob in chunked mode with retry/backoff.
- Frontend calls `/files/complete-upload` to validate blob + persist metadata.

3. **Analysis Pipeline**
- Frontend calls `/analysis/analyze` with `videoId`.
- Backend generates temporary read SAS URL and calls Python CV service.
- CV service decodes stream (PyAV with FFmpeg fallback), runs MediaPipe pose, computes metrics.
- Backend stores metrics + movement segments + AI feedback in MongoDB.

4. **Feedback + Coach Chat**
- Frontend loads `/analysis/record/:analysisId` and `/coach/history/:analysisId`.
- User asks questions via `/coach/ask`.
- Backend uses LLM responses + stores Q/A history + generated follow-up suggestions.

## Core Features Implemented

### 1. Authentication & Session Security
- OTP registration with email verification + expiry handling.
- Password login with bcrypt-hashed credentials.
- Google OAuth login using `google-auth-library`.
- Cookie-based auth middleware for protected routes.

### 2. Cloud-Native Video Upload
- SAS URL generation with scoped blob permissions.
- Per-user blob path ownership validation.
- Upload metadata persistence (`filename`, `sport`, size, MIME type, blobName, CDN URL).
- Duplicate filename prevention per user via DB uniqueness constraints.

### 3. Biomechanics & Motion Intelligence
- Frame-level landmark extraction using MediaPipe.
- Joint-angle, velocity, acceleration, jerk, COM, symmetry, and stability signals.
- Segment-based movement detection and confidence scoring.
- Structured movement phases (e.g., squat descent/bottom/ascent, jump takeoff/landing).

### 4. AI Feedback Layer
- Automatic coaching report generation from raw metrics.
- Prompt suggestions generated from detected injury/movement flags.
- Conversational follow-up coach per analysis session with persisted chat history.

### 5. UX & Product Flows
- Landing page + onboarding.
- Upload progress UI + recovery from pending uploads.
- Analysis records history with time-relative labels.
- Feedback screen with metric tiles, formatted feedback text, and chat-like coach interface.

## API Surface

### Backend (`Express`)

**Auth**
- `POST /auth/register/request-otp`
- `POST /auth/register/verify-otp`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`

**Files**
- `POST /files/generate-upload-url`
- `POST /files/complete-upload`
- `GET /files/getVideo`

**Analysis**
- `POST /analysis/analyze`
- `GET /analysis/all`
- `GET /analysis/record/:analysisId`
- `GET /analysis/:videoId`
- `DELETE /analysis/:videoId`

**Coach**
- `POST /coach/ask`
- `GET /coach/history/:analysisId`

**Health**
- `GET /health`

### CV Service (`FastAPI`)
- `GET /health`
- `POST /analyze`

## Data Model (MongoDB Collections)

- `users`: account + OAuth linkage
- `otp_requests`: temporary OTP records with TTL-style expiry handling
- `files`: uploaded video metadata
- `analysis`: metrics, movement segments, feedback, injury flags
- `chat`: coach Q/A history per analysis

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Axios, React Router
- **Backend:** Node.js, Express, Mongoose, JWT, bcrypt, Nodemailer
- **CV/AI:** Python FastAPI, MediaPipe, NumPy, SciPy, PyAV, FFmpeg
- **Cloud:** Azure Blob Storage (direct browser upload with SAS), optional Azure CDN
- **LLM:** Groq (`llama-3.1-8b-instant`) for feedback + coach responses
- **Database:** MongoDB Atlas

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Stride

cd Backend && npm install
cd ../Frontend/Stride && npm install
cd ../../Backend/stride-cv && pip install -r requirements.txt
```

### 2. Run services

Terminal 1:
```bash
cd Backend/stride-cv
uvicorn main:app --host 0.0.0.0 --port 8000
```

Terminal 2:
```bash
cd Backend
npm run dev
```

Terminal 3:
```bash
cd Frontend/Stride
npm run dev
```

### 3. Environment variables

Use `DEPLOYMENT.md` as the source of truth. Key required values include:
- `MONGODB_URI`, `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GROQ_API_KEY`
- `CV_SERVICE_URL`
- `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME`
- frontend: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`

## Deployment Targets

- Frontend: **Vercel**
- Backend API: **Azure App Service**
- CV service: **Azure Container Apps** (Dockerized)
- Database: **MongoDB Atlas**

Detailed deployment and CORS guidance is documented in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Suggested Resume Bullets

- Built an AI biomechanics analysis platform that converts uploaded sports videos into joint-angle, symmetry, stability, and movement-phase diagnostics using MediaPipe + FastAPI + Node.js.
- Engineered a secure cloud upload pipeline (Azure Blob SAS + chunked client upload + backend validation) with retry logic and per-user blob ownership controls.
- Implemented end-to-end coaching workflow: CV inference, metrics persistence, LLM-generated feedback, and conversational follow-up assistant with stored session history.

