# test_obracun.py
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import routes_kalkulacije as modul            # promijeni u ime svog fajla s rutama
from auth_dependency import trenutni_profil


class LazniKursor:
    def __init__(self, jedan=None, svi=None, greska=None):
        self.jedan = list(jedan or [])   # redom, za svaki fetchone()
        self.svi = list(svi or [])       # redom, za svaki fetchall()
        self.greska = greska

    def execute(self, *args, **kwargs):
        if self.greska:
            raise self.greska

    def fetchone(self):
        return self.jedan.pop(0) if self.jedan else None

    def fetchall(self):
        return self.svi.pop(0) if self.svi else []


class LaznaKonekcija:
    def __init__(self):
        self.rollback_pozvan = False

    def rollback(self):
        self.rollback_pozvan = True


@pytest.fixture
def klijent(monkeypatch):
    app = FastAPI()
    app.include_router(modul.router)
    app.dependency_overrides[trenutni_profil] = lambda: 1
    return TestClient(app)


def postavi(monkeypatch, kursor):
    monkeypatch.setattr(modul, "kursor", kursor)
    konekcija = LaznaKonekcija()
    monkeypatch.setattr(modul, "konekcija", konekcija)
    return konekcija


# --- tačka 6: prazan period ---
def test_period_bez_unosa_vraca_404(klijent, monkeypatch):
    postavi(monkeypatch, LazniKursor(svi=[[]]))      # fetchall() -> []
    r = klijent.get("/obracun_za_period?od=2026-11-01&do=2026-11-30")
    assert r.status_code == 404


def test_fiksna_plata_se_dodaje_za_cijeli_mjesec_bez_dnevnih_unosa(klijent, monkeypatch):
    postavi(monkeypatch, LazniKursor(svi=[
        [],
        [({"fiks": 1800}, date(2026, 11, 1))],
    ]))
    r = klijent.get("/obracun_za_period?od=2026-11-01&do=2026-11-30")

    assert r.status_code == 200
    assert r.json()["odgovor"] == []
    assert r.json()["fiksni_iznos"] == 1800
    assert r.json()["ukupni_zbir"] == 1800


def test_fiksna_plata_se_dodaje_na_dnevne_zarade(klijent, monkeypatch):
    godisnji_unos = {"vrsta_dana": "godisnji"}
    cijene_dnevnog_unosa = {"godisnji": 50}
    postavi(monkeypatch, LazniKursor(
        svi=[
            [(date(2026, 11, 12), godisnji_unos)],
            [({"fiks": 1800}, date(2026, 11, 1))],
        ],
        jedan=[(godisnji_unos,), (cijene_dnevnog_unosa,)],
    ))
    r = klijent.get("/obracun_za_period?od=2026-11-01&do=2026-11-30")

    assert r.status_code == 200
    assert r.json()["odgovor"][0]["ukupno"] == 50
    assert r.json()["fiksni_iznos"] == 1800
    assert r.json()["ukupni_zbir"] == 1850


def test_fiksna_plata_se_ne_dodaje_za_djelimican_mjesec(klijent, monkeypatch):
    postavi(monkeypatch, LazniKursor(svi=[[]]))
    r = klijent.get("/obracun_za_period?od=2026-11-01&do=2026-11-15")

    assert r.status_code == 404


def test_period_vise_mjeseci_uzima_samo_potpune_mjesece():
    assert modul.puni_mjeseci_u_periodu(
        date(2026, 11, 15), date(2027, 1, 10)
    ) == [date(2026, 12, 1)]


# --- tačka 7: od i do su obavezni ---
def test_period_bez_od_do_vraca_422(klijent, monkeypatch):
    postavi(monkeypatch, LazniKursor())
    r = klijent.get("/obracun_za_period")
    assert r.status_code == 422


# --- tačka 8: 404 ne smije postati 500 ---
def test_dan_bez_unosa_vraca_404_a_ne_500(klijent, monkeypatch):
    postavi(monkeypatch, LazniKursor(jedan=[None]))
    r = klijent.get("/obracun_za_dan/2026-11-12")
    assert r.status_code == 404


def test_dan_bez_konfiguracije_vraca_404(klijent, monkeypatch):
    podaci = ({"vrsta_dana": "radni"},)
    postavi(monkeypatch, LazniKursor(jedan=[podaci, None]))
    r = klijent.get("/obracun_za_dan/2026-11-12")
    assert r.status_code == 404


# prava greška i dalje daje 500 i rollback
def test_prava_greska_daje_500_i_rollback(klijent, monkeypatch):
    konekcija = postavi(monkeypatch, LazniKursor(greska=RuntimeError("pala baza")))
    r = klijent.get("/obracun_za_dan/2026-11-12")
    assert r.status_code == 500
    assert konekcija.rollback_pozvan


# sretan put: popravke nisu pokvarile obračun
def test_period_s_jednim_radnim_danom(klijent, monkeypatch):
    podaci = {"vrsta_dana": "radni",
              "unos": {"kilometar": 100, "ture": [{"iznos": 1000}]}}
    cijene = {"kilometar": 0.2, "procenat": 10, "dnevnica": 45}
    postavi(monkeypatch, LazniKursor(
        svi=[[(date(2026, 11, 12), podaci)]],
        jedan=[(podaci,), (cijene,)],
    ))
    r = klijent.get("/obracun_za_period?od=2026-11-01&do=2026-11-30")
    assert r.status_code == 200
    assert r.json()["ukupni_zbir"] == pytest.approx(165)   # 20 + 100 + 45
    assert r.json()["odgovor"][0]["vrsta_dana"] == "radni"

def test_godisnji_uzima_cijenu_godisnjeg():
    iznosi, ukupno = modul.kalkulacija_za_dan({"vrsta_dana": "godisnji"}, {"godisnji": 50})
    assert ukupno == 50


def test_dodaci_koriste_nominalnu_cijenu_jedan():
    iznosi, ukupno = modul.kalkulacija_za_dan(
        {"vrsta_dana": "radni", "unos": {"bonus": 30}},
        {"bonus": 25},
    )
    assert iznosi["bonus"] == 30
    assert ukupno == 30


def test_konfiguracija_normalizuje_cijenu_dodataka():
    from models import Konfiguracija, Opcija

    konfiguracija = Konfiguracija(
        cijene={"bonus": 25},
        vazi_od=date(2026, 11, 1),
    )

    assert konfiguracija.cijene[Opcija.bonus] == 1