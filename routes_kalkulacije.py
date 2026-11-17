from calendar import monthrange
from datetime import date

from fastapi import APIRouter, HTTPException, Query, Depends
from database import kursor, konekcija
from models import Opcija
from auth_dependency import trenutni_profil

router = APIRouter()


def puni_mjeseci_u_periodu(od: date, do: date) -> list[date]:
    mjeseci = []
    pocetak_mjeseca = date(od.year, od.month, 1)

    while pocetak_mjeseca <= do:
        zadnji_dan = date(
            pocetak_mjeseca.year,
            pocetak_mjeseca.month,
            monthrange(pocetak_mjeseca.year, pocetak_mjeseca.month)[1],
        )
        if pocetak_mjeseca >= od and zadnji_dan <= do:
            mjeseci.append(pocetak_mjeseca)

        if (pocetak_mjeseca.year, pocetak_mjeseca.month) == (do.year, do.month):
            break
        if pocetak_mjeseca.month == 12:
            pocetak_mjeseca = date(pocetak_mjeseca.year + 1, 1, 1)
        else:
            pocetak_mjeseca = date(
                pocetak_mjeseca.year, pocetak_mjeseca.month + 1, 1
            )

    return mjeseci


def fiksni_iznos_za_mjesece(profil_id: int, mjeseci: list[date]) -> float:
    if not mjeseci:
        return 0

    kursor.execute("""
        SELECT cijene, vazi_od FROM konfiguracija
        WHERE profil_id = %s AND vazi_od <= %s
        ORDER BY vazi_od DESC
    """, (profil_id, mjeseci[-1]))
    konfiguracije = kursor.fetchall()

    ukupno = 0.0
    for mjesec in mjeseci:
        konfiguracija = next(
            (
                cijene
                for cijene, vazi_od in konfiguracije
                if vazi_od <= mjesec
            ),
            None,
        )
        if konfiguracija:
            ukupno += float(konfiguracija.get("fiks", 0) or 0)

    return round(ukupno, 2)


def kalkulacija_za_dan(podaci: dict, cijene: dict):
    vrsta = podaci["vrsta_dana"]

    if vrsta != "radni":                    # godisnji ili bolovanje
        iznos = cijene.get(vrsta, 0)
        return {vrsta: iznos}, iznos

    unos = podaci.get("unos", {})
    procenat = cijene.get("procenat", 0)

    iznosi = {
        k: unos[k] * (1 if k == "bonus" else cijene[k])
        for k in unos
        if k in cijene
    }
    
    if procenat > 0:
        ture = unos["ture"]
        promet = [t["iznos"] for t in ture]
        iznosi["promet"] = (sum(promet) * procenat) / 100
        
    if "dnevnica" in cijene:
        iznosi["dnevnica"] = cijene["dnevnica"]
    

    return iznosi, sum(iznosi.values())

def obracun_za_dan(profil_id, datum):
    kursor.execute("""
        SELECT podaci FROM kalkulacija 
        WHERE profil_id = %s
        AND datum = %s
    """, (profil_id, datum))
    red = kursor.fetchone()
    if red is None:
        raise HTTPException(status_code=404, detail="Nema unosa podataka za taj datum")
    podaci = red[0]

    kursor.execute("""
        SELECT cijene FROM konfiguracija
        WHERE profil_id = %s AND vazi_od <= %s
        ORDER BY vazi_od DESC LIMIT 1
    """, (profil_id, datum))
    red = kursor.fetchone()
    if red is None:
        raise HTTPException(status_code=404, detail="Nema unosa validnih cijena za taj datum")
    cijene = red[0]

    iznos, ukupno = kalkulacija_za_dan(podaci, cijene)
    return iznos, ukupno

@router.get("/obracun_za_dan/{datum}")
def obracun(datum: str, profil_id: int = Depends(trenutni_profil)):
    try:
        iznos, ukupno = obracun_za_dan(profil_id, datum)  
        return {"iznosi": iznos, "ukupno": ukupno}  
    except HTTPException:
            raise
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom prikaza podataka: {e}")

@router.get("/obracun_za_period")
def obracun_za_period(
    od: date = Query(..., description="Početni datum u formatu YYYY-MM-DD"),
    do: date = Query(..., description="Krajnji datum u formatu YYYY-MM-DD"),
    profil_id: int = Depends(trenutni_profil)
    ):
    try:
        if od > do:
            raise HTTPException(status_code=422, detail="Početni datum ne može biti nakon krajnjeg datuma.")

        kursor.execute("""
            SELECT datum, podaci from kalkulacija
            WHERE profil_id = %s AND datum >= %s AND datum <= %s
            ORDER BY datum ASC
        """, (profil_id, od, do))
        redovi = kursor.fetchall()
        fiksni_iznos = fiksni_iznos_za_mjesece(
            profil_id, puni_mjeseci_u_periodu(od, do)
        )
        if not redovi and fiksni_iznos == 0:
            raise HTTPException(status_code=404, detail="Nema unosa podataka za trazeni period")

        odgovor = []
        for datum, podaci in redovi:
            iznos, ukupno = obracun_za_dan(profil_id, datum)
            odgovor.append({
                "datum": datum,
                "vrsta_dana": podaci.get("vrsta_dana", "radni"),
                "iznos": iznos,
                "ukupno": ukupno,
            })

        ukupni_iznos = sum(o["ukupno"] for o in odgovor) + fiksni_iznos
        return {
            "odgovor": odgovor,
            "obracunatih_dana": len(odgovor),
            "fiksni_iznos": fiksni_iznos,
            "ukupni_zbir": round(ukupni_iznos, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        konekcija.rollback()
        raise HTTPException(status_code=500, detail=f"Greska prilikom prikaza podataka: {e}")

@router.get("/test/")
def test_cekiranja(
    stavke: list[Opcija] = Query(default=[]),
):
  return {"cekirane_stavke": stavke}