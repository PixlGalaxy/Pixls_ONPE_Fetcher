# 1: Frontend Build
FROM node:24-alpine AS build-frontend
WORKDIR /app/frontend
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY Frontend/ ./
RUN npm run build

# 2: Final Image - Python + Nginx
FROM python:3.12-alpine
WORKDIR /app

# Install Nginx
RUN apk add --no-cache nginx && rm -rf /var/cache/apk/*

# Copy Frontend build to Nginx
COPY --from=build-frontend /app/frontend/dist /usr/share/nginx/html

# Copy Nginx Config
COPY nginx.conf /etc/nginx/nginx.conf

# Install Python dependencies
COPY Backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy Backend
COPY Backend/ /app/backend/

EXPOSE 5000

CMD ["sh", "-c", "cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 & nginx -g 'daemon off;'"]
