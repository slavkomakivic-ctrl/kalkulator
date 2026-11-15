from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from auth import TAJNI_KLJUC, ALGORITAM
from database import kursor

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def trenutni_korisnik(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, TAJNI_KLJUC, algorithms=[ALGORITAM])
        korisnicko_ime = payload.get("sub")
        if korisnicko_ime is None:
            raise HTTPException(status_code=401, detail="Nevazeci token")
        return korisnicko_ime
    except JWTError:
        raise HTTPException(status_code=401, detail="Nevazeci token")

def trenutni_profil(korisnik: str = Depends(trenutni_korisnik)) -> int:
    kursor.execute(
        "SELECT id FROM profil_korisnika WHERE korisnicko_ime = %s", (korisnik,)
    )
    red = kursor.fetchone()
    if red is None:
        raise HTTPException(status_code=404, detail="Profil ne postoji")
    return red[0]