# Stride deployment

This repo can be hosted with:

- Vercel for the React frontend
- Azure App Service for the Node.js backend
- Azure Container Apps for the Python CV service
- MongoDB Atlas for the database

## 1. Frontend on Vercel

Project root:

- `Frontend/Stride`

Build settings:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Vercel environment variables:

- `VITE_API_URL=https://<your-backend>.azurewebsites.net`
- `VITE_GOOGLE_CLIENT_ID=<your Google OAuth client id>`
- `VITE_AZURE_STORAGE_ACCOUNT_NAME=<storage account name>`
- `VITE_AZURE_STORAGE_CONTAINER_NAME=<blob container name>`

Notes:

- `vercel.json` is included so React Router deep links work.
- Add your Vercel production domain to Azure Blob Storage CORS.

## 2. Backend on Azure App Service

App root:

- `Backend`

Recommended runtime:

- Node.js 20 LTS

Startup:

- Azure can use `npm start`

App Service environment variables:

- `NODE_ENV=production`
- `PORT=8080`
- `MONGODB_URI=<your Atlas connection string>`
- `DB_NAME=stride`
- `JWT_SECRET=<long random secret>`
- `GOOGLE_CLIENT_ID=<your Google OAuth client id>`
- `GROQ_API_KEY=<your Groq API key>`
- `CV_SERVICE_URL=https://<your-container-app>.<region>.azurecontainerapps.io`
- `AZURE_STORAGE_CONNECTION_STRING=<your Azure Storage connection string>`
- `AZURE_STORAGE_CONTAINER_NAME=<blob container name>`
- `AZURE_UPLOAD_SAS_EXPIRY_HOURS=1`
- `AZURE_CDN_BASE_URL=<optional CDN base URL>`
- `EMAIL_SERVICE=gmail`
- `EMAIL_HOST=smtp.gmail.com`
- `EMAIL_PORT=587`
- `EMAIL_SECURE=false`
- `EMAIL_USER=<smtp username>`
- `EMAIL_PASS=<smtp password or app password>`
- `EMAIL_FROM=Stride <<your-email>>`
- `CORS_ORIGINS=https://<your-vercel-app>.vercel.app,https://<your-custom-domain>`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`
- `COOKIE_DOMAIN=`

Notes:

- Backend now exposes `GET /health` for health checks.
- Cross-site auth cookies require `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none` in production because Vercel and App Service are different origins.

## 3. Python CV service on Azure Container Apps

Service root:

- `Backend/stride-cv`

Files included:

- `Dockerfile`
- `.dockerignore`

Container settings:

- Target port: `8000`
- Ingress: enabled
- Health probe path: `/health`

Environment variables:

- `PORT=8000`

Deploy outline:

1. Build and push the container image from `Backend/stride-cv`.
2. Create an Azure Container App using that image.
3. Enable external ingress on port `8000`.
4. Copy the public Container Apps URL into backend `CV_SERVICE_URL`.

## 4. MongoDB Atlas

Use your Atlas SRV connection string in backend `MONGODB_URI`.

Examples:

- With db in the URI already: `mongodb+srv://user:pass@cluster.mongodb.net/stride?retryWrites=true&w=majority`
- Without db in the URI: `mongodb+srv://user:pass@cluster.mongodb.net`

The backend now supports either pattern. If the URI already contains a database name, it will use that as-is.

## 5. Azure Blob Storage CORS

Add allowed origins for direct browser uploads:

- `http://localhost:5173`
- `https://<your-vercel-app>.vercel.app`
- `https://<your-custom-domain>`

Allow methods:

- `GET`
- `PUT`
- `HEAD`
- `OPTIONS`

Allow headers:

- `*`

Expose headers:

- `ETag`
- `x-ms-request-id`
- `x-ms-version`

## 6. Recommended deploy order

1. Create MongoDB Atlas and copy the connection string.
2. Deploy the Python CV service to Azure Container Apps.
3. Deploy the Node backend to Azure App Service with the Container App URL.
4. Deploy the React frontend to Vercel with the App Service URL.
5. Add the Vercel domain to backend `CORS_ORIGINS` and Blob Storage CORS.
