# Stage 1: Build the Vite React frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/vitereact
COPY vitereact/package*.json ./
RUN npm ci --legacy-peer-deps
COPY vitereact ./
# Set production API URL for the launchpulse.ai subdomain
RUN sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://project-build-a-production-ready-w.launchpulse.ai|g' .env 2>/dev/null || true
RUN sed -i 's|VITE_BACKEND_URL=.*|VITE_BACKEND_URL=https://project-build-a-production-ready-w.launchpulse.ai|g' .env 2>/dev/null || true
RUN echo 'VITE_API_BASE_URL=https://project-build-a-production-ready-w.launchpulse.ai' > .env.production.local && echo 'VITE_BACKEND_URL=https://project-build-a-production-ready-w.launchpulse.ai' >> .env.production.local
RUN npm run build
# Ensure build output is in /app/vitereact/build (handle both dist/ and public/ outputs)
RUN if [ -d "dist" ]; then mv dist build; elif [ -d "public" ]; then mv public build; fi

# Stage 2: Production image with backend
FROM node:20-slim
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --production

# Copy backend source
COPY backend ./

# Clear FRONTEND_URL from .env so Cloud Run env var takes precedence
RUN sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=|g' .env 2>/dev/null || true

# Copy frontend build (normalized to /build in frontend stage)
COPY --from=frontend-build /app/vitereact/build ./public

# Cloud Run uses PORT env var (defaults to 8080)
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3   CMD curl -f http://localhost:$PORT/api/health || exit 1

CMD ["sh", "-c", "node initdb.js 2>/dev/null || true && npx tsx server.ts"]
