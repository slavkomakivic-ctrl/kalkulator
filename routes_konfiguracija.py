from fastapi import APIRouter, HTTPException, Depends
from psycopg2.errors import UniqueViolation
from psycopg2.extras import Json
from models import ProfilKorisnika, Konfiguracija
from database import kursor, konekcija
from auth_dependency import trenutni_korisnik, trenutni_profil

router = APIRouter()

def kljucevi_opcija(profil_id: int = Depends(trenutni_profil)):
    try:
        kursor.execute("""
            SELECT cijene FROM konfiguracija
            WHERE profil_id = %s
            ORDER BY vazi_od DESC
            LIMIT 1
        """, (profil_id,))
        rezultat = kursor.fetchone()
        if rezultat:
            kljucevi_opcija = list(rezultat[0].keys())
            return {"kljucevi_opcija": kljucevi_opcija}
        else:
            raise HTTPException(status_code=404, detail="Nema konfiguracija za taj profil")
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom dohvata ključeva opcija: {e}")

@router.post("/profil")
def kreiraj_profil(profil: ProfilKorisnika, korisnik: str = Depends(trenutni_korisnik)):
    try:
        kursor.execute(
            "INSERT INTO profil_korisnika (korisnicko_ime, ime, prezime) VALUES (%s, %s, %s)",
            (korisnik, profil.ime, profil.prezime)
        )
        konekcija.commit()
        return {"poruka": f"Profil kreiran za korisnika: {korisnik}"}
    except UniqueViolation:
        konekcija.rollback()
        raise HTTPException(status_code=409, detail="Profil već postoji")
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom kreiranja profila: {e}")

@router.get("/provjeri_profil")
def provjeri_postojanje_profila(korisnik: str = Depends(trenutni_korisnik)):
    try:
        kursor.execute(
            "SELECT ime, prezime FROM profil_korisnika WHERE korisnicko_ime = %s",
            (korisnik,)
        )
        profil = kursor.fetchone()
        postoji = bool(
            profil and profil[0] and profil[0].strip() and profil[1] and profil[1].strip()
        )
        return {"profil_postoji": postoji}
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom provjere profila: {e}")

@router.get("/provjeri_konfiguraciju")
def provjeri_postojanje_vazece_konfiguracije(profil_id: int = Depends(trenutni_profil)):
    try:
        kursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM konfiguracija
                WHERE profil_id = %s AND vazi_od <= CURRENT_DATE
            )
        """, (profil_id,))
        return {"konfiguracija_postoji": kursor.fetchone()[0]}
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom provjere konfiguracije: {e}")

@router.post("/konfiguracija")
def konfiguracija_kalkulatora(konfiguracija: Konfiguracija, profil_id: int = Depends(trenutni_profil)):
    if "vazi_od" not in konfiguracija.model_fields_set:
        raise HTTPException(status_code=422, detail="Datum početka važenja konfiguracije je obavezan.")

    try:
        kursor.execute("""
            INSERT INTO konfiguracija (profil_id, cijene, vazi_od) VALUES (%s, %s, %s)
        """, (profil_id, Json(konfiguracija.cijene), konfiguracija.vazi_od))
        konekcija.commit()
        return {"poruka": f"Konfiguracija kreirana."}
    except UniqueViolation:
        konekcija.rollback()
        raise HTTPException(status_code=409, detail="Konfiguracija s tim datumom početka već postoji")
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom kreiranja konfiguracije: {e}")

@router.get("/stavke_za_unos")
def prikazi_stavke_za_unos(profil_id: int = Depends(trenutni_profil)):
    kljucevi = kljucevi_opcija(profil_id)
    return {"kljucevi": kljucevi}

@router.get("/profili")
def prikazi_profile():
    kursor.execute("SELECT ime, prezime, korisnicko_ime FROM profil_korisnika")
    profili = kursor.fetchall()
    return {"profili": profili}

@router.get("/konfiguracije")
def prikazi_konfiguracije(profil_id: int = Depends(trenutni_profil)):
    try:
        kursor.execute("SELECT ime, prezime FROM profil_korisnika WHERE id = %s", (profil_id,))
        profil = kursor.fetchone()
        kursor.execute("""
            SELECT cijene, vazi_od FROM konfiguracija
            WHERE profil_id = %s
            ORDER BY vazi_od DESC
        """, (profil_id,))

        konfiguracije = [
            {"cijene": cijene, "vazi_od": vazi_od}
            for cijene, vazi_od in kursor.fetchall()
        ]
        return {
            "ime": profil[0], 
            "prezime": profil[1], 
            "konfiguracije": konfiguracije
        }
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom dohvata konfiguracija: {e}")

@router.put("/konfiguracija/{vazi_od}")
def azuriraj_konfiguraciju(vazi_od: str, konfiguracija: Konfiguracija, profil_id: int = Depends(trenutni_profil)):
    try:
        kursor.execute("""
            UPDATE konfiguracija
            SET cijene = %s
            WHERE profil_id = %s AND vazi_od = %s
        """, (Json(konfiguracija.cijene), profil_id, vazi_od))
        if kursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Konfiguracija nije pronađena")
        konekcija.commit()
        return {"poruka": f"Konfiguracija ažurirana."}
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom ažuriranja konfiguracije: {e}")

