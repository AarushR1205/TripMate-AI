# TripMate AI

TripMate AI is an AI-powered travel planner. Describe a trip in plain language and it will gather flight information, research hotels, create an itinerary, and return a structured recommendation.

## What It Does

- Finds flight information using AviationStack and airport data.
- Researches hotel options using Tavily web search.
- Generates itineraries and recommendations with Groq.
- Stores LangGraph conversation checkpoints in PostgreSQL.
- Serves a browser interface and a FastAPI API from the same application.

## Quick Start

### Requirements

- Python 3.12 or newer
- PostgreSQL database accessible from the application
- API keys for Groq, Tavily, and AviationStack
- `uv` or `pip`

### 1. Configure environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
AVIATIONSTACK_API_KEY=your_aviationstack_api_key
DATABASE_URL=postgresql://user:password@host:5432/database
DEFAULT_ORIGIN_IATA=IND
```

`GROQ_API_KEY` and `DATABASE_URL` are required at startup. If `DATABASE_URL` does not specify `sslmode`, the application adds `sslmode=require`.

Keep `.env` private and never commit real credentials.

### 2. Install dependencies

With `uv`:

```bash
uv sync
```

With `pip` on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

With `pip` on Windows Command Prompt:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Start the server

Run this command from the project root:

```bash
uvicorn main:app --reload
```

Then open:

- Application: <http://127.0.0.1:8000/>
- API documentation: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

## How It Works

`POST /api/chat` runs the following workflow:

1. Receive the user's travel request.
2. Find matching flight information.
3. Search for hotel suggestions.
4. Generate a practical, budget-aware itinerary.
5. Combine the research into a Markdown response.
6. Save the conversation state in PostgreSQL using `thread_id`.

## API Reference

### `GET /api/new-session`

Creates a conversation thread:

```json
{
  "thread_id": "user_<generated-id>"
}
```

### `POST /api/chat`

Request body:

```json
{
  "message": "Plan a five-day trip to Tokyo from Delhi",
  "thread_id": "user_existing-thread-id"
}
```

`thread_id` is optional. The message must be between 3 and 8000 characters.

Example request:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Plan a five-day trip to Tokyo from Delhi"}'
```

The response contains the final answer plus the individual research results:

```json
{
  "thread_id": "user_<generated-id>",
  "answer": "## Trip Summary\n...",
  "flight_results": "...",
  "hotel_results": "...",
  "itinerary": "...",
  "llm_calls": 4
}
```

Other endpoints:

- `GET /` serves the frontend.
- `GET /health` returns service status.
- `GET /api` returns application and endpoint information.

## Project Structure

```text
.
├── backend.py             # LangGraph workflow and PostgreSQL checkpointer
├── main.py                # FastAPI app and HTTP endpoints
├── tools.py               # Flight and web-search integrations
├── frontend/
│   ├── index.html         # Browser interface
│   └── script.js          # Frontend behavior and API calls
├── src/tripmate_ai/       # Package entry point
├── requirements.txt       # pip dependencies
└── pyproject.toml         # Project metadata and uv dependencies
```

## Important Limitations

- AviationStack may provide flight data without ticket prices.
- Hotel results are web-search suggestions, not confirmed bookings or availability.
- Itineraries and budgets are AI-generated recommendations and should be verified before booking.
- Flight route matching may not recognize every city name or route.
- External services are called sequentially, so response times depend on the network and provider limits.

## Troubleshooting

### Startup reports a missing key

Check that `.env` is in the project root and includes `GROQ_API_KEY` and `DATABASE_URL`.

### PostgreSQL connection fails

Check the database URL, credentials, network access, and SSL settings. The application uses SSL by default when `sslmode` is omitted.

### No flight results appear

Check `AVIATIONSTACK_API_KEY` and try recognizable city or airport names. Results depend on the provider's current data.

### The browser cannot connect

Confirm that Uvicorn is running on port `8000` and open the application through <http://127.0.0.1:8000/> rather than as a local HTML file.

## Development Notes

The repository currently has no automated tests. Before production use, add tests for request validation, airport and route parsing, mocked provider responses, and the `/api/chat` workflow.

For production deployments, restrict CORS origins, avoid exposing detailed internal errors, and configure the frontend API URL instead of relying on the local address.