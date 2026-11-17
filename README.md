# Kalkulator za vozača

Web aplikacija za vozače kamiona za evidenciju dnevnih aktivnosti i pregled obračunate zarade. Aplikacija podržava korisničke profile, konfiguraciju načina obračuna i pregled rezultata za izabrani period.

## Mogućnosti

- Registracija, prijava i odjava korisnika.
- Čuvanje sesije pomoću JWT tokena.
- Profil korisnika sa imenom i prezimenom.
- Konfiguracija cijena i načina obračuna koji važe od izabranog datuma.
- Evidencija radnih dana, godišnjeg odmora i bolovanja.
- Unos kilometraže, dnevnica, procenata od tura, čekanja, stranaka i dodataka.
- Izmjena i brisanje dnevnih unosa.
- Pregled obračuna i statistike za izabrani period.
- Mjesečna fiksna plata: dodaje se za svaki cijeli kalendarski mjesec obuhvaćen periodom. Za djelimične mjesece se ne obračunava.
- Prilagođen prikaz za telefone i računare.

## Tehnologije

- Python 3.12
- FastAPI i Uvicorn
- PostgreSQL
- HTML, CSS i JavaScript
- Docker Compose za lokalno pokretanje aplikacije i baze

## Struktura projekta

```text
.
├── main.py
├── auth.py
├── auth_dependency.py
├── database.py
├── models.py
├── routes.py
├── routes_konfiguracija.py
├── routes_unos.py
├── routes_kalkulacije.py
├── init.sql
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── static/
│   ├── index.html
│   ├── css/
│   ├── icons/
│   └── js/
└── test_*.py
```

## Lokalno pokretanje

Potrebni su Docker i Docker Compose.

1. Napravi `.env` fajl u korijenu projekta. Taj fajl je namjerno isključen iz Git-a.
2. Dodaj vrijednosti:

   ```dotenv
   SIFRA=izaberi_jaku_lozinku_za_postgres
   TAJNI_KLJUC=ovdje_stavi_dugacak_nasumican_kljuc
   ```

   Nasumičan JWT ključ možeš napraviti lokalno sa:

   ```powershell
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. Pokreni aplikaciju i bazu:

   ```powershell
   docker compose up --build
   ```

4. Otvori aplikaciju na [http://localhost:8000](http://localhost:8000). FastAPI dokumentacija dostupna je na [http://localhost:8000/docs](http://localhost:8000/docs).

Za zaustavljanje servisa pritisni `Ctrl+C`, a zatim po potrebi pokreni:

```powershell
docker compose down
```

PostgreSQL podaci čuvaju se u Docker volumenu i ostaju sačuvani nakon zaustavljanja kontejnera.

## Konfiguracija okruženja

| Varijabla | Namjena |
| --- | --- |
| `SIFRA` | Lozinka PostgreSQL korisnika `postgres`. |
| `TAJNI_KLJUC` | Tajni ključ kojim se potpisuju JWT tokeni. U produkciji mora biti nasumičan i privatan. |
| `DB_HOST` | Adresa PostgreSQL servera. Docker Compose je postavlja na `db`; van Dockera je podrazumijevano `localhost`. |
| `DATABASE_URL` | Opcionalna puna PostgreSQL konekcija. Ako je postavljena, ima prednost nad pojedinačnim DB postavkama. |

Pri prvom kreiranju PostgreSQL baze, `init.sql` kreira bazu `kalkulator_db`. Aplikacija zatim kreira potrebne tabele ako već ne postoje.

## Testovi

Testovi se mogu pokrenuti unutar aplikacionog kontejnera dok su servisi pokrenuti:

```powershell
docker compose exec app pytest -q
```

## Deploy

Prije javnog deploya:

- Postavi `TAJNI_KLJUC` i DB lozinku kroz siguran sistem za environment varijable hostinga; ne objavljuj ih u Git-u.
- Koristi PostgreSQL instancu sa trajnim skladištem i redovnim backupom.
- Obezbijedi HTTPS za javnu aplikaciju.
- Ograniči CORS dozvoljene izvore na stvarne domene aplikacije umjesto otvorenog wildcard podešavanja.
- Podesi port i komandu za pokretanje prema zahtjevima hosting platforme.

PWA manifest i service worker, kao ni Capacitor Android projekat, još nisu dio trenutne konfiguracije repozitorijuma.