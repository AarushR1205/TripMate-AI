# TripMate AI

TripMate AI is an AI-powered travel planning assistant that turns a short prompt into a structured trip plan. It combines live flight data, hotel discovery, and itinerary generation in a single workflow to help travelers explore destinations, compare routes, and plan practical trips faster.

## Overview

The application is built as a FastAPI backend with a LangGraph multi-agent orchestration layer. A user submits a travel request through the web interface, and the system:

- researches flights using live aviation data
- looks up accommodation ideas through Tavily search
- synthesizes a day-by-day itinerary with an LLM
- returns a polished markdown travel response for the user

This makes TripMate useful for both quick trip inspiration and more actionable planning prompts such as destination research, route matching, budget-aware itineraries, and travel summaries.

## Key Features

- AI-generated trip planning with a conversational web interface
- Live flight lookup using AviationStack integration
- Hotel and destination research with Tavily search
- Location parsing for cities, countries, and IATA codes
- Multi-agent workflow using LangGraph for flight, hotel, and itinerary steps
- Persistent conversation threads via PostgreSQL-backed graph checkpointing
- Responsive frontend built with static HTML, JavaScript, and Tailwind CSS

## Tech Stack

- Python 3.13+
- FastAPI
- LangGraph
- LangChain + Groq integration
- PostgreSQL for checkpoint persistence
- Tavily for travel research
- AviationStack for live flight data
- airportsdata and pycountry for airport and location resolution
- Tailwind CSS + vanilla JavaScript for the frontend

## Project Structure

- `backend.py` — FastAPI application and travel chat API
- `main.py` — LangGraph orchestration and agent graph setup
- `tools.py` — flight parsing, airport resolution, and external API helpers
- `frontend/` — static web app and UI assets
- `src/tripmate_ai/` — package entry point
- `requirements.txt` and `pyproject.toml` — Python dependencies and project metadata

## Getting Started

### Prerequisites

- Python 3.13 or newer
- PostgreSQL database URL for LangGraph checkpointing
- API keys for Groq, Tavily, and AviationStack

### 1. Clone and install dependencies

```bash
git clone https://github.com/AarushR1205/TripMate-AI.git
cd TripMate-AI
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

You can also use `uv` if preferred:

```bash
uv sync
```

### 2. Configure environment variables

Create a `.env` file in the project root with the following variables:

```env
DATABASE_URL=your_postgres_connection_string
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
AVIATIONSTACK_API_KEY=your_aviationstack_api_key
DEFAULT_ORIGIN_IATA=IND
```

Notes:

- `DATABASE_URL` should point to a PostgreSQL instance that LangGraph can use for checkpoints.
- If you're using a hosted Postgres service, ensure SSL is enabled as required by the provider.
- `DEFAULT_ORIGIN_IATA` is used as the fallback origin airport for location-based flight searches.

### 3. Run the app

Start the FastAPI server:

```bash
uvicorn backend:app --host 0.0.0.0 --port 8000 --reload
```

Then open:

```text
http://localhost:8000
```

The application serves the frontend at the root route and exposes the API under `/api`.

## API

### Health check

```bash
GET /health
```

### New session

```bash
GET /api/new-session
```

Returns a `thread_id` for a new travel planning session.

### Chat request

```bash
POST /api/chat
```

Request body:

```json
{
  "message": "Plan a 4-day trip to Tokyo with a mid-range budget",
  "thread_id": "user_123"
}
```

Response includes:

- `thread_id`
- `answer`
- `flight_results`
- `hotel_results`
- `itinerary`
- `llm_calls`

## Example Prompts

- "Plan a 5-day trip to Bali with a budget of $1200"
- "Flights from Delhi to Paris for next month"
- "Create a romantic weekend itinerary in Kyoto"
- "Find good hotel options in Dubai under a moderate budget"

## Architecture Summary

The backend uses a stateful graph workflow:

1. User request enters the FastAPI API.
2. The travel graph runs the flight agent.
3. Hotel research is fetched via Tavily.
4. The itinerary agent composes a practical plan using flight and hotel context.
5. A final response node creates a polished markdown output.
6. LangGraph checkpoints the conversation state in Postgres.

## Notes

- Flight search is live but may not include exact pricing information because the source API mainly provides schedule and status data.
- The system is optimized for travel research and itinerary generation rather than direct booking checkout.
- The generated responses are best treated as planning guidance that should be validated before booking.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
f