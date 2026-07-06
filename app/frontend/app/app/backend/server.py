from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
class ScoreCreate(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=20)
    score: int = Field(..., ge=0)


class Score(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_name: str
    score: int
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Space Escape Runner API"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.post("/scores", response_model=Score)
async def create_score(payload: ScoreCreate):
    name = payload.player_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="player_name cannot be empty")

    score_obj = Score(player_name=name, score=payload.score)
    doc = score_obj.model_dump()
    await db.scores.insert_one(doc)
    return score_obj


@api_router.get("/scores/top", response_model=List[Score])
async def get_top_scores(limit: int = 5):
    limit = max(1, min(limit, 50))
    cursor = db.scores.find({}, {"_id": 0}).sort("score", -1).limit(limit)
    scores = await cursor.to_list(length=limit)
    return [Score(**s) for s in scores]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
