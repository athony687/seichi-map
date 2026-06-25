import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
import anthropic

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


class SpotRequest(BaseModel):
    spot_name_en: str
    anime_title_en: str
    scene_description: str
    area: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-intro")
def generate_intro(spot: SpotRequest):
    prompt = (
        f"You are a friendly travel guide for anime fans visiting Japan. "
        f"Write exactly 2-3 short sentences in English introducing this anime pilgrimage spot to foreign tourists. "
        f"Be enthusiastic but concise. No headings, no bullet points, plain text only.\n\n"
        f"Spot: {spot.spot_name_en}\n"
        f"Anime: {spot.anime_title_en}\n"
        f"Scene: {spot.scene_description}\n"
        f"Area: {spot.area}"
    )
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"intro": message.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
