# Dutch Blitz Room Manager 🃏⚡️

A full-stack, real-time multiplayer scoring application built for the fast-paced card game Dutch Blitz. 

This project was engineered to handle live state synchronization across multiple clients, persistent relational data storage, and dynamic AI-generated content. It serves as a comprehensive demonstration of modern web architecture, bridging a React-based frontend with an asynchronous Python backend.

## 🚀 Key Features

* **Real-Time Multiplayer Engine:** Utilizes WebSockets for bidirectional, zero-latency communication. When one player updates a score, all connected clients in the "Room" update instantly.
* **State Synchronization Protocol:** Handles "late-joiner" scenarios. If a new player joins an active room, the application queries existing clients to broadcast the authoritative game rules and state, ensuring complete decentralization and sync.
* **AI Match Commentator:** Integrates the OpenAI API to analyze final game statistics (JSON payloads) and dynamically generate a customized, humorous esports-style match recap.
* **PostgreSQL Integration:** Robust relational database architecture managed via SQLAlchemy ORM, utilizing connection pooling (Supavisor) for reliable cloud performance.
* **Mobile-First Gaming UI:** A sleek, responsive, dark-mode interface built with Tailwind CSS, featuring forced lowercase inputs, real-time online player counters, and dynamic scoring toggles (Manual vs. Auto-math).

## 🛠 Tech Stack

**Frontend**
* **Framework:** Next.js (React)
* **Styling:** Tailwind CSS
* **Hosting:** Vercel

**Backend**
* **Framework:** Python / FastAPI
* **Concurrency:** Asynchronous ASGI (Uvicorn) & WebSockets
* **AI/LLM Integration:** OpenAI API (`gpt-3.5-turbo`)
* **Hosting:** Render

**Database & Infrastructure**
* **Database:** PostgreSQL (Hosted on Supabase)
* **ORM:** SQLAlchemy
* **Adapter:** Psycopg2-binary

## 🧠 Engineering Highlights
* **CORS & Security:** Configured secure cross-origin resource sharing middleware to bridge the Next.js frontend with the FastAPI backend across different deployment domains.
* **Graceful Error Handling:** Implemented API quota limit handling for the LLM integration, ensuring the server remains stable even if AI generation fails.
* **Optimized Rendering:** Addressed React `StrictMode` stale state closures using `useRef` hooks to guarantee game-winning conditions trigger accurately across network renders.

---

## 💻 Local Development Setup

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/isaacmateosv/dutch-blitz-pj.git
cd dutch-blitz-pj
\`\`\`

### 2. Backend Setup (FastAPI)
\`\`\`bash
cd dutch-blitz-api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
\`\`\`
*Create a `.env` file in the `dutch-blitz-api` folder with your credentials:*
\`\`\`text
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[pooler-url]:5432/postgres
\`\`\`
*Start the server:*
\`\`\`bash
uvicorn main:app --reload
\`\`\`

### 3. Frontend Setup (Next.js)
Open a new terminal window:
\`\`\`bash
cd dutch-blitz-ui
npm install
npm run dev
\`\`\`
*Visit `http://localhost:3000` in your browser.*

---

## ⚖️ License

**Non-Commercial Open Source License (NC-OSL) Version 1.0**
*dutch-blitz-pj © 2026 by Isaac Mateo Sarzosa Valencia is licensed under NC-OSL 1.0*

You are free to **Share** (copy and redistribute the material in any medium or format) and **Adapt** (remix, transform, and build upon the material) under the following terms:

* **Attribution:** You must give appropriate credit, provide a link to the license, and indicate if changes were made.
* **NonCommercial:** You may not use the material for commercial purposes (including selling the software or using it in a commercial product/service).
* **ShareAlike:** If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

**No Warranties:** The Software is provided "AS IS", without warranty of any kind. 

*For the complete legal code and footnotes, please consult the `LICENSE.md` file included in this repository.*
