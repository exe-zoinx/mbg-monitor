# =============================================================================
# MBG Monitor - Multi-stage Dockerfile
# Builds: Frontend (Vite React) + Worker (Cloudflare Wrangler)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./frontend/
COPY vite.config.js ./

# Build frontend
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production - Serve Frontend with Nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Copy built frontend assets
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Stage 3: Base dependencies (for development)
# NOTE: Uses node:20-slim (Debian/glibc) because Cloudflare's workerd binary
# requires glibc and does not work on Alpine/musl.
# -----------------------------------------------------------------------------
FROM node:20-slim AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including wrangler from package.json)
RUN npm install --legacy-peer-deps

# -----------------------------------------------------------------------------
# Stage 4: Worker Development (for local testing with wrangler dev)
# -----------------------------------------------------------------------------
FROM deps AS worker-dev

# Copy worker source
COPY worker/ ./worker/

# Expose wrangler dev port
EXPOSE 8787 8788

CMD ["sh", "-c", "echo 'Worker ready. Run: wrangler dev --config worker/wrangler.toml' && tail -f /dev/null"]

# -----------------------------------------------------------------------------
# Stage 5: Full Development Environment (Frontend + Worker)
# -----------------------------------------------------------------------------
FROM deps AS dev

# Copy source code
COPY frontend/ ./frontend/
COPY worker/ ./worker/
COPY vite.config.js ./

# Expose ports: frontend (5173), worker (8787), api (8788)
EXPOSE 5173 8787 8788

# Start both frontend server and worker dev
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 & npx wrangler dev --config worker/wrangler.toml --ip 0.0.0.0 & wait"]