import psycopg2

from database import ThreadLocalConnection, ThreadLocalCursor


class LazniKursor:
    def __init__(self, konekcija):
        self.konekcija = konekcija
        self.upiti = []

    def execute(self, upit):
        if upit == "SELECT 1" and self.konekcija.pao:
            raise psycopg2.OperationalError("Konekcija je prekinuta")
        self.upiti.append(upit)


class LaznaKonekcija:
    def __init__(self, pao=False):
        self.pao = pao
        self.closed = 0
        self.kursor = LazniKursor(self)

    def cursor(self):
        return self.kursor

    def close(self):
        self.closed = 1


def test_kursor_se_ponovo_povezuje_nakon_prekinute_konekcije():
    stare_konekcije = LaznaKonekcija(pao=True)
    nova_konekcija = LaznaKonekcija()
    konekcije = iter([stare_konekcije, nova_konekcija])
    konekcija = ThreadLocalConnection(lambda: next(konekcije))
    kursor = ThreadLocalCursor(konekcija)

    kursor.execute("SELECT id FROM profil_korisnika")

    assert stare_konekcije.closed == 1
    assert nova_konekcija.kursor.upiti == [
        "SELECT 1",
        "SELECT id FROM profil_korisnika",
    ]


def test_tabele_se_inicijalizuju_pri_pokretanju_aplikacije(monkeypatch):
    from fastapi.testclient import TestClient

    import main

    pozivi = []
    monkeypatch.setattr(
        main.database,
        "inicijalizuj_tabele",
        lambda: pozivi.append(True),
    )

    with TestClient(main.app):
        pass

    assert pozivi == [True]
