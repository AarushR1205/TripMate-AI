from pathlib import Path
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from backend import run_travel_agent

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"

app = FastAPI(
    title="TripMate AI",
    description="AI-powered multi-agent travel planning application",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not FRONTEND_DIR.exists():
    raise RuntimeError(f"Frontend directory not found: {FRONTEND_DIR}")

if not INDEX_FILE.exists():
    raise RuntimeError(f"Frontend index.html not found: {INDEX_FILE}")

app.mount(
    "/frontend",
    StaticFiles(directory=FRONTEND_DIR),
    name="frontend",
)


class TravelRequest(BaseModel):
    message: str = Field(..., min_length=3, max_length=8000, description="User travel request")
    thread_id: str | None = Field(default=None, description="Existing LangGraph conversation thread ID",)

class TravelResponse(BaseModel):
    thread_id: str
    answer: str
    flight_results: str = ""
    hotel_results: str = ""
    itinerary: str = ""
    llm_calls: int = 0


@app.get("/")
def root():
    return FileResponse(INDEX_FILE)

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "TripMate AI",
        "version": "1.0.0",
    }

@app.get("/api")
def api_info():
    return {
        "application": "TripMate AI",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "frontend": "/",
            "chat": "/api/chat",
            "new_session": "/api/new-session",
            "health": "/health",
            "docs": "/docs",
        },
    }


@app.get("/api/new-session")
def new_session():
    thread_id = f"user_{uuid.uuid4().hex}"
    return {"thread_id": thread_id}

@app.post("/api/chat", response_model=TravelResponse)
def travel_chat(request: TravelRequest):
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="Travel request cannot be empty.",
        )

    try:
        result = run_travel_agent(user_input=user_message, thread_id=request.thread_id)
        return TravelResponse(
            thread_id=result.get("thread_id", request.thread_id or ""),
            answer=result.get("answer", ""),
            flight_results=result.get("flight_results", ""),
            hotel_results=result.get("hotel_results", ""),
            itinerary=result.get("itinerary", "",),
            llm_calls=result.get("llm_calls", 0),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        print(f"[TripMate AI ERROR] {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=500,
            detail=(f"TripMate AI could not process your request. Error: {str(exc)}"),
        ) from exc
