from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FT Mixer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api import mixer, emphasizer

app.include_router(mixer.router, prefix="/api/mixer", tags=["mixer"])
app.include_router(emphasizer.router, prefix="/api/emphasizer", tags=["emphasizer"])

@app.get("/")
def read_root():
    return {"status": "ok"}
