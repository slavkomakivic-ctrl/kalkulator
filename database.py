import threading
from dotenv import load_dotenv
import psycopg2
import os

class ThreadLocalCursor:
    """Daje svakom threadu zaseban cursor i konekciju."""

    def __init__(self, konekcija):
        self.konekcija = konekcija
        self.lokalni_podaci = threading.local()

    def _cursor(self):
        konekcija = self.konekcija._konekcija()
        if getattr(self.lokalni_podaci, "konekcija", None) is not konekcija:
            self.lokalni_podaci.konekcija = konekcija
            self.lokalni_podaci.kursor = konekcija.cursor()
        return self.lokalni_podaci.kursor

    def execute(self, *args, **kwargs):
        kursor = self._cursor()
        try:
            kursor.execute("SELECT 1")
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            self.konekcija._ponovno_povezi()
            kursor = self._cursor()
            kursor.execute("SELECT 1")
        return kursor.execute(*args, **kwargs)

    def __getattr__(self, naziv):
        return getattr(self._cursor(), naziv)


class ThreadLocalConnection:
    def __init__(self, factory):
        self.factory = factory
        self.lokalni_podaci = threading.local()

    def _konekcija(self):
        konekcija = getattr(self.lokalni_podaci, "konekcija", None)
        if konekcija is None or konekcija.closed:
            konekcija = self.factory()
            self.lokalni_podaci.konekcija = konekcija
        return konekcija

    def _ponovno_povezi(self):
        konekcija = getattr(self.lokalni_podaci, "konekcija", None)
        if konekcija is not None and not konekcija.closed:
            konekcija.close()
        self.lokalni_podaci.konekcija = self.factory()

    def __getattr__(self, naziv):
        return getattr(self._konekcija(), naziv)


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def _nova_konekcija():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        dbname="kalkulator_db",
        user="postgres",
        password=os.getenv("SIFRA"),
        host=os.getenv("DB_HOST", "localhost"),
        port="5432",
    )


konekcija = ThreadLocalConnection(_nova_konekcija)
kursor = ThreadLocalCursor(konekcija)


def inicijalizuj_tabele():
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
    konekcija.close()
