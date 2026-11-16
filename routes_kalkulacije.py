from fastapi import APIRouter, HTTPException, Query, Depends
from database import kursor, konekcija
from models import Opcija
from auth_dependency import trenutni_profil

router = APIRouter()

def kalkulacija_za_dan(podaci: dict, cijene: dict):
    vrsta = podaci["vrsta_dana"]

    if vrsta != "radni":                    # godisnji ili bolovanje
        iznos = cijene.get(vrsta, 0)
        return {vrsta: iznos}, iznos

    unos = podaci.get("unos", {})
    procenat = cijene.get("procenat", 0)

    iznosi = {k: unos[k] * cijene[k] for k in unos if k in cijene}
    
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
    od: str = Query(..., description="Početni datum u formatu YYYY-MM-DD"),
    do: str = Query(..., description="Krajnji datum u formatu YYYY-MM-DD"), 
    profil_id: int = Depends(trenutni_profil)
    ):
    try:
        kursor.execute("""
            SELECT datum, podaci from kalkulacija
            WHERE profil_id = %s AND datum >= %s AND datum <= %s
            ORDER BY datum ASC
        """, (profil_id, od, do))
        redovi = kursor.fetchall()
        if not redovi:
                raise HTTPException(status_code=404, detail="Nema unosa podataka za trazeni period")
        else:
            lista_podataka = []
            for red in redovi:
                lista_podataka.append({"datum": red[0], "podaci": red[1]})
            odgovor = []
            for linija in lista_podataka:
                datum = linija["datum"]
                iznos, ukupno = obracun_za_dan(profil_id,datum)
                odgovor.append({
                    "datum": datum,
                    "vrsta_dana": linija["podaci"].get("vrsta_dana", "radni"),
                    "iznos": iznos,
                    "ukupno": ukupno,
                })
            ukupni_iznos = 0
            obracunatih_dana = 0
            for o in odgovor:
                ukupni_iznos += o["ukupno"]
                obracunatih_dana += 1

        return {"odgovor": odgovor, "obracunatih_dana": obracunatih_dana, "ukupni_zbir": round(ukupni_iznos, 2)}       
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