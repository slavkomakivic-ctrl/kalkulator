from pathlib import Path
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import database

BASE_DIR = Path(__file__).parent

from routes import router as auth_router
from routes_konfiguracija import router as konfiguracija_router
from routes_unos import router as unos_router
from routes_kalkulacije import router as kalk_router

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    database.inicijalizuj_tabele()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(konfiguracija_router)
app.include_router(unos_router)
app.include_router(kalk_router)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/", include_in_schema=False)
def pocetna():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.get("/login", include_in_schema=False)
def login():
    return FileResponse(BASE_DIR / "static" / "login.html")