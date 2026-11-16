from fastapi import FastAPI
from fastapi.testclient import TestClient

import routes_unos as modul
from auth_dependency import trenutni_profil


class KursorZabranjen:
    def execute(self, *args, **kwargs):
        raise AssertionError("Pregled unosa ne smije mijenjati bazu")


def test_pregled_unosa_vraca_podatke_bez_upisa(monkeypatch):
    app = FastAPI()
    app.include_router(modul.router)
    app.dependency_overrides[trenutni_profil] = lambda: 1
    monkeypatch.setattr(modul, "kursor", KursorZabranjen())
    klijent = TestClient(app)

    odgovor = klijent.post("/unos/pregled", json={
        "datum": "2026-11-15",
        "vrsta_dana": "radni",
        "unos": {
            "kilometar": 42,
            "cekanje": 2,
            "stranka": 3,
            "bonus": 0,
            "ture": [{"opis": "Centar", "iznos": 125.5}]
        }
    })

    assert odgovor.status_code == 200
    pregled = odgovor.json()["pregled"]
    assert pregled["datum"] == "2026-11-15"
    assert pregled["unos"]["kilometar"] == 42
    assert pregled["unos"]["ture"] == [{"opis": "Centar", "iznos": 125.5}]
