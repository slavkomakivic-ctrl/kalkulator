from fastapi import APIRouter, HTTPException, Depends
from psycopg2.errors import UniqueViolation
from psycopg2.extras import Json
from database import kursor, konekcija
from models import Kalkulacija
from auth_dependency import trenutni_profil

router = APIRouter()

def prikaz_liste_podataka(datum, profil_id):
    kursor.execute("""
        SELECT datum, podaci FROM kalkulacija
        WHERE profil_id = %s AND datum = %s
        ORDER BY datum ASC
        LIMIT 1
    """, (profil_id, datum))
    redovi = kursor.fetchall()
    if redovi is None:
            raise HTTPException(status_code=404, detail="Nema unosa podataka za vas profil")
    lista_podataka = []
    for red in redovi:
        lista_podataka.append({"datum": red[0], "podaci": red[1]})
    return lista_podataka

@router.post("/unos")
def unos_podataka(kalk: Kalkulacija, profil_id: int = Depends(trenutni_profil)):
    try:
        podatak = Json(kalk.model_dump(mode="json", exclude={"datum"}, exclude_none=True))
        kursor.execute("""
            INSERT INTO kalkulacija (profil_id, datum, podaci) VALUES (%s, %s, %s)
        """, (profil_id, kalk.datum, podatak))
        konekcija.commit()
        return {"poruka": f"Podaci uneseni za datum: {kalk.datum}"}
    except UniqueViolation:
        konekcija.rollback()
        raise HTTPException(status_code=409, detail="Podaci za taj datum već postoje")
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom unosa podataka: {e}")

@router.post("/unos/pregled")
def pregled_podataka(kalk: Kalkulacija, profil_id: int = Depends(trenutni_profil)):
    try:
        podatak = Json(kalk.model_dump(mode="json", exclude={"datum"}, exclude_none=True))
        kursor.execute("""
            INSERT INTO kalkulacija (profil_id, datum, podaci) VALUES (%s, %s, %s)
        """, (profil_id, kalk.datum, podatak))
        return {"poruka": f"Podaci pripremljeni za unos za datum: {kalk.datum}"}
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="Podaci za taj datum već postoje")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Greska prilikom pripreme podataka: {e}")

@router.get("/prikaz_unesenih_podataka/{datum}")
def uneseni_podaci(datum: str, profil_id: int = Depends(trenutni_profil)):
    try:
        lista_podataka = prikaz_liste_podataka(datum, profil_id)
        return {"lista": lista_podataka}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Greska prilikom pripreme podataka: {e}")