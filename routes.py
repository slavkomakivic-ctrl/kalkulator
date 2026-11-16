from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from psycopg2.errors import UniqueViolation
from database import kursor, konekcija
from models import Korisnik
from auth import hesuj_lozinku, provjeri_lozinku, napravi_token
from auth_dependency import trenutni_korisnik

router = APIRouter()

@router.post("/registracija")
def registruj_korisnika(korisnik: Korisnik):
    hash_lozinke = hesuj_lozinku(korisnik.lozinka)
    try:
        kursor.execute(
            "INSERT INTO korisnici (korisnicko_ime, lozinka_hash) VALUES (%s, %s)",
            (korisnik.korisnicko_ime, hash_lozinke)
        )
        konekcija.commit()
    except UniqueViolation:
        konekcija.rollback()
        raise HTTPException(status_code=409, detail="Korisnicko ime je vec zauzeto.")
    except Exception:
        konekcija.rollback()
        raise
    token = napravi_token(korisnik.korisnicko_ime)
    return {
        "poruka": f"Registrovan korisnik: {korisnik.korisnicko_ime}",
        "access_token": token,
        "token_type": "bearer"
    }

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        kursor.execute(
            "SELECT lozinka_hash FROM korisnici WHERE korisnicko_ime = %s",
            (form_data.username,)
        )
        red = kursor.fetchone()

        if red is None:
            raise HTTPException(status_code=401, detail="Pogresno korisnicko ime ili lozinka")

        hash_iz_baze = red[0]

        if not provjeri_lozinku(form_data.password, hash_iz_baze):
            raise HTTPException(status_code=401, detail="Pogresno korisnicko ime ili lozinka")

        token = napravi_token(form_data.username)
        return {"access_token": token, "token_type": "bearer"}
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom prijave: {e}")

@router.get("/provjeri_prijavu")
def provjeri_prijavu(korisnik: str = Depends(trenutni_korisnik)):
    return {"korisnicko_ime": korisnik}