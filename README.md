# AI GitHub Debugging Assistant

A production-ready AI-powered tool that analyzes software errors in GitHub repositories and automatically generates fixes as pull requests.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│                    Next.js + TypeScript                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                    BACKEND API (Node/Express)                    │
│    Auth │ Repos │ Indexing │ Analysis │ PR Creation              │
└────┬────────────┬──────────────────────────┬────────────────────┘
     │            │                          │
     ▼            ▼                          ▼
┌─────────┐  ┌─────────┐            ┌───────────────┐
│ MongoDB │  │ GitHub  │            │  AI Engine    │
│   DB    │  │   API   │            │ (FastAPI/Py)  │
└─────────┘  └─────────┘            └───────┬───────┘
                                            │
                              ┌─────────────┴──────────┐
                              ▼                        ▼
                        ┌──────────┐          ┌──────────────┐
                        │  Chroma  │          │  GPT-4.1 /   │
                        │ VectorDB │          │  DeepSeek    │
                        └──────────┘          └──────────────┘
```

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd ai-github-debugger

# 2. Set environment variables
cp .env.example .env
# Fill in your GitHub OAuth, OpenAI, MongoDB credentials

# 3. Start with Docker Compose
docker-compose up --build
```

## Services

| Service     | Port | Description                        |
|-------------|------|------------------------------------|
| Frontend    | 3000 | Next.js UI                         |
| Backend     | 4000 | Node/Express API                   |
| AI Engine   | 8000 | Python FastAPI service             |
| ChromaDB    | 8001 | Vector database                    |
| MongoDB     | 27017| Primary database                   |

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, Monaco Editor
- **Backend**: Node.js, Express.js, MongoDB/Mongoose
- **AI Engine**: Python, FastAPI, LangChain, OpenAI GPT-4.1
- **Vector DB**: ChromaDB
- **Auth**: GitHub OAuth
