import threading
from dotenv import load_dotenv
import psycopg2
import os

class ThreadLocalCursor:
    """Daje svakom threadu zaseban cursor nad postojećom konekcijom."""

    def __init__(self, konekcija):
        self.konekcija = konekcija
        self.lokalni_podaci = threading.local()

    def _cursor(self):
        if not hasattr(self.lokalni_podaci, "kursor"):
            self.lokalni_podaci.kursor = self.konekcija.cursor()
        return self.lokalni_podaci.kursor

    def __getattr__(self, naziv):
        return getattr(self._cursor(), naziv)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    konekcija = psycopg2.connect(DATABASE_URL)
else:
    konekcija = psycopg2.connect(
        dbname="kalkulator_db",
        user="postgres",
        password= os.getenv("SIFRA"),
        host=os.getenv("DB_HOST", "localhost"),
        port="5432"
        )
kursor = ThreadLocalCursor(konekcija)

kursor.execute("""
    CREATE TABLE IF NOT EXISTS korisnici (
        id SERIAL PRIMARY KEY,
        korisnicko_ime TEXT UNIQUE,
        lozinka_hash TEXT
    )
""")

kursor.execute("""
    CREATE TABLE IF NOT EXISTS profil_korisnika (
        id SERIAL PRIMARY KEY,
        korisnicko_ime TEXT NOT NULL UNIQUE REFERENCES korisnici(korisnicko_ime),
        ime TEXT NOT NULL,
        prezime TEXT NOT NULL
    )
""")

kursor.execute("""
    CREATE TABLE IF NOT EXISTS konfiguracija (
        id SERIAL PRIMARY KEY,
        profil_id INTEGER NOT NULL REFERENCES profil_korisnika(id),
        cijene JSONB NOT NULL,
        vazi_od DATE NOT NULL DEFAULT CURRENT_DATE,
        UNIQUE (profil_id, vazi_od)
    )
""")

kursor.execute("""
    CREATE TABLE IF NOT EXISTS kalkulacija (
        id SERIAL PRIMARY KEY,
        profil_id INTEGER NOT NULL REFERENCES profil_korisnika(id),
        datum DATE NOT NULL,
        podaci JSONB NOT NULL,
        UNIQUE (profil_id, datum)
    )
""")
konekcija.commit()