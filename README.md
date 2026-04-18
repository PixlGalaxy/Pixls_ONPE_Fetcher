# PIXL's ONPE Fetcher

A real-time election results dashboard for the 2026 Peruvian general elections. The system continuously polls the official ONPE API, stores snapshots, runs probabilistic predictions, and serves an interactive web interface with an AI chat assistant.

## Overview

The application is a full-stack monorepo composed of a Python FastAPI backend and a React TypeScript frontend. Both are packaged together in a single Docker image served through Nginx on port 5000.

## Repository Structure

```
Pixls_ONPE_Fetcher/
├── Backend/                  # Python FastAPI application
├── Frontend/                 # React + TypeScript SPA
├── Dockerfile                # Multi-stage build (Node -> Alpine Python + Nginx)
├── nginx.conf                # Reverse proxy configuration
└── .github/
    ├── workflows/
    │   └── docker-build.yml  # CI/CD pipeline (GHCR)
    ├── dependabot.yml
    └── CODEOWNERS
```

## Tech Stack

| Layer       | Technology                              |
|-------------|------------------------------------------|
| Frontend    | React 19, TypeScript, Vite, TailwindCSS 4 |
| Backend     | Python 3.12, FastAPI, Uvicorn, Selenium  |
| AI          | Ollama (local LLM + embeddings), RAG     |
| Deployment  | Docker, Nginx, GitHub Container Registry |

## Running Locally

### Prerequisites

- Node.js 20+
- Python 3.12+
- Google Chrome or Chromium installed

### Backend

```bash
cd Backend
python -m venv venv
source venv/bin/activate  
pip install -r requirements.txt
cp .env.example .env           # fill in OLLAMA_URL and model names to use AI Chat
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd Frontend
npm install
cp .env.example .env.local 
npm run dev                
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8000`.

## Docker Deployment

Build and run the production image (frontend + backend + Nginx on port 5000):

```bash
docker build -t onpe-fetcher .
docker run -p 5000:5000 onpe-fetcher
```

The CI/CD pipeline in `.github/workflows/docker-build.yml` automatically builds and pushes the image to GitHub Container Registry on every push to `main`.

## Available Elections

The system tracks five election types:

- `presidential` — National presidential race
- `senate_national` — National senate seats
- `senate_regional` — Regional senate seats
- `deputies` — Congressional deputies
- `parlamento_andino` — Andean Parliament

Each election has its own folder under `Backend/data/` with current results, history snapshots, geographic breakdowns, and prediction data.

## Developers

PixlGalaxy
