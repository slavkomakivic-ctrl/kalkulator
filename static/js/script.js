import { inicijalizujPregled, prikaziPregledPerioda } from "./period.js?v=10";
import "./unos.js?v=10";

const sekcijaPrijave = document.getElementById("sekcija-prijava");
const sekcijaRegistracije = document.getElementById("registracija");
const sekcijaProfila = document.getElementById("sekcija-profil");
const sekcijaKonfiguracije = document.getElementById("sekcija-konfiguracija");
const sekcijaPerioda = document.getElementById("sekcija-obracun-perioda");
const porukaPerioda = document.getElementById("poruka-perioda");
const linkRegistracije = document.getElementById("link-registracija");
const linkPrijave = document.getElementById("link-prijava");
const authLayout = document.getElementById("auth-layout");

function sakrijAutentifikaciju() {
    authLayout.hidden = true;
    document.body.classList.remove("auth-mode");
}

function postaviAuthTab(prijavaAktivna) {
    sekcijaPrijave.hidden = !prijavaAktivna;
    sekcijaRegistracije.hidden = prijavaAktivna;
    linkPrijave.classList.toggle("aktivan", prijavaAktivna);
    linkPrijave.setAttribute("aria-selected", String(prijavaAktivna));
    linkRegistracije.classList.toggle("aktivan", !prijavaAktivna);
    linkRegistracije.setAttribute("aria-selected", String(!prijavaAktivna));
}

if (sekcijaPrijave && sekcijaRegistracije && linkRegistracije && linkPrijave) {
    linkRegistracije.addEventListener("click", (dogadjaj) => {
        dogadjaj.preventDefault();
        postaviAuthTab(false);
        document.getElementById("poruka").textContent = "";
        document.getElementById("poruka-registracije").textContent = "";
        document.getElementById("registraciono_korisnicko_ime").focus();
    });

    linkPrijave.addEventListener("click", (dogadjaj) => {
        dogadjaj.preventDefault();
        postaviAuthTab(true);
        document.getElementById("poruka").textContent = "";
        document.getElementById("poruka-registracije").textContent = "";
        document.getElementById("korisnicko_ime").focus();
    });
}

document.querySelectorAll("[data-password-toggle]").forEach((dugme) => {
    const polje = document.getElementById(dugme.dataset.passwordToggle);
    dugme.addEventListener("click", () => {
        const prikaziLozinku = polje.type === "password";
        polje.type = prikaziLozinku ? "text" : "password";
        dugme.setAttribute("aria-pressed", String(prikaziLozinku));
        dugme.setAttribute("aria-label", prikaziLozinku ? "Sakrij lozinku" : "Prikaži lozinku");
    });
});

function prikaziKonfiguracijuProfila() {
    sakrijAutentifikaciju();
    sekcijaPrijave.hidden = true;
    sekcijaRegistracije.hidden = true;
    sekcijaProfila.hidden = false;
    document.getElementById("ime").focus();
}

function postaviRezimKonfiguracije(novaKonfiguracija) {
    document.getElementById("naslov-konfiguracije").textContent =
        novaKonfiguracija ? "Nova konfiguracija" : "Konfiguracija profila";
    document.querySelector('#forma-konfiguracija button[type="submit"]').textContent =
        novaKonfiguracija ? "Dodaj konfiguraciju" : "Sačuvaj konfiguraciju";
    document.getElementById("dugme-odustani-konfiguracije").hidden = !novaKonfiguracija;
}

function prikaziFormuKonfiguracije() {
    sakrijAutentifikaciju();
    sekcijaProfila.hidden = true;
    sekcijaKonfiguracije.hidden = false;
    postaviRezimKonfiguracije(false);
    sekcijaKonfiguracije.querySelector('[data-opcija]').focus();
}

async function proveriProfilIPokaziSledeciKorak(token) {
    const odgovor = await fetch("/provjeri_profil", {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const rezultat = await odgovor.json().catch(() => ({}));

    if (!odgovor.ok) {
        const greska = new Error(rezultat.detail || "Nije moguće proveriti profil.");
        greska.status = odgovor.status;
        throw greska;
    }

    if (typeof rezultat.profil_postoji !== "boolean") {
        throw new Error("Server nije vratio ispravan status profila.");
    }

    if (!rezultat.profil_postoji) {
        sekcijaPrijave.hidden = true;
        sekcijaRegistracije.hidden = true;
        sekcijaProfila.hidden = true;
        sekcijaKonfiguracije.hidden = true;
        prikaziKonfiguracijuProfila();
        return;
    }

    const odgovorKonfiguracije = await fetch("/provjeri_konfiguraciju", {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const statusKonfiguracije = await odgovorKonfiguracije.json().catch(() => ({}));

    if (!odgovorKonfiguracije.ok) {
        const greska = new Error(statusKonfiguracije.detail || "Nije moguće proveriti konfiguraciju.");
        greska.status = odgovorKonfiguracije.status;
        throw greska;
    }

    if (typeof statusKonfiguracije.konfiguracija_postoji !== "boolean") {
        throw new Error("Server nije vratio ispravan status konfiguracije.");
    }

    sekcijaPrijave.hidden = true;
    sekcijaRegistracije.hidden = true;
    sekcijaProfila.hidden = true;
    sekcijaKonfiguracije.hidden = true;

    if (statusKonfiguracije.konfiguracija_postoji) {
        prikaziPregledPerioda();
        await inicijalizujPregled();
    } else {
        prikaziFormuKonfiguracije();
    }
}

const formaPrijave = document.getElementById("forma-prijava");

if (formaPrijave) {
    const porukaPrijave = document.getElementById("poruka");
    const dugmePrijave = formaPrijave.querySelector('button[type="submit"]');

    formaPrijave.addEventListener("submit", async (dogadjaj) => {
        dogadjaj.preventDefault();
        porukaPrijave.textContent = "Prijavljujem...";
        dugmePrijave.disabled = true;

        const podaci = new URLSearchParams();
        podaci.append("username", document.getElementById("korisnicko_ime").value);
        podaci.append("password", document.getElementById("lozinka").value);

        try {
            const odgovor = await fetch("/login", {
                method: "POST",
                body: podaci
            });
            const rezultat = await odgovor.json().catch(() => ({}));

            if (!odgovor.ok) {
                porukaPrijave.textContent = `Greška: ${rezultat.detail || "Neuspješna prijava."}`;
                return;
            }

            if (!rezultat.access_token) {
                porukaPrijave.textContent = "Greška: server nije vratio token za prijavu.";
                return;
            }

            sessionStorage.removeItem("token");
            localStorage.setItem("token", rezultat.access_token);
            await proveriProfilIPokaziSledeciKorak(rezultat.access_token);
        } catch (greska) {
            porukaPrijave.textContent = `Greška: ${greska.message || "Greška u komunikaciji sa serverom."}`;
        } finally {
            dugmePrijave.disabled = false;
        }
    });
}

const formaRegistracije = document.getElementById("forma-registracija");

if (formaRegistracije) {
    const porukaRegistracije = document.getElementById("poruka-registracije");
    const dugmeRegistracije = formaRegistracije.querySelector('button[type="submit"]');

    formaRegistracije.addEventListener("submit", async (dogadjaj) => {
        dogadjaj.preventDefault();
        const lozinka = document.getElementById("registraciona_lozinka").value;
        const ponovljenaLozinka = document.getElementById("ponovljena_lozinka").value;

        if (lozinka !== ponovljenaLozinka) {
            porukaRegistracije.textContent = "Unete šifre se ne podudaraju.";
            return;
        }

        porukaRegistracije.textContent = "Registrujem...";
        dugmeRegistracije.disabled = true;

        try {
            const odgovor = await fetch("/registracija", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    korisnicko_ime: document.getElementById("registraciono_korisnicko_ime").value,
                    lozinka
                })
            });
            const rezultat = await odgovor.json().catch(() => ({}));

            if (!odgovor.ok) {
                porukaRegistracije.textContent = `Greška: ${rezultat.detail || "Neuspješna registracija."}`;
                return;
            }

            if (!rezultat.access_token) {
                porukaRegistracije.textContent = "Greška: server nije vratio token za prijavu.";
                return;
            }

            sessionStorage.removeItem("token");
            localStorage.setItem("token", rezultat.access_token);
            await proveriProfilIPokaziSledeciKorak(rezultat.access_token);
        } catch (greska) {
            porukaRegistracije.textContent = `Greška: ${greska.message || "Greška u komunikaciji sa serverom."}`;
        } finally {
            dugmeRegistracije.disabled = false;
        }
    });
}

const formaProfila = document.getElementById("forma-profil");

if (formaProfila) {
    const porukaProfila = document.getElementById("poruka-profila");
    const dugmeProfila = formaProfila.querySelector('button[type="submit"]');

    formaProfila.addEventListener("submit", async (dogadjaj) => {
        dogadjaj.preventDefault();
        porukaProfila.textContent = "Čuvam profil...";
        dugmeProfila.disabled = true;

        try {
            const odgovor = await fetch("/profil", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    ime: document.getElementById("ime").value,
                    prezime: document.getElementById("prezime").value
                })
            });
            const rezultat = await odgovor.json().catch(() => ({}));

            if (!odgovor.ok) {
                porukaProfila.textContent = `Greška: ${rezultat.detail || "Profil nije sačuvan."}`;
                return;
            }

            porukaProfila.textContent = "Profil je uspešno sačuvan.";
            prikaziFormuKonfiguracije();
        } catch (greska) {
            porukaProfila.textContent = "Greška u komunikaciji sa serverom.";
        } finally {
            dugmeProfila.disabled = false;
        }
    });
}

const formaKonfiguracije = document.getElementById("forma-konfiguracija");

if (formaKonfiguracije) {
    const porukaKonfiguracije = document.getElementById("poruka-konfiguracije");
    const dugmeKonfiguracije = formaKonfiguracije.querySelector('button[type="submit"]');
    const dugmeOdustaniKonfiguracije = document.getElementById("dugme-odustani-konfiguracije");
    const dugmeIzmijeniKonfiguraciju = document.getElementById("dugme-izmijeni-konfiguraciju");
    const poljeVaziOd = document.getElementById("vazi-od");
    const opcije = formaKonfiguracije.querySelectorAll("[data-opcija]");

    function danasnjiDatum() {
        const danas = new Date();
        const mjesec = String(danas.getMonth() + 1).padStart(2, "0");
        const dan = String(danas.getDate()).padStart(2, "0");
        return `${danas.getFullYear()}-${mjesec}-${dan}`;
    }

    function sljedeciSlobodanDatum(konfiguracije, pocetniDatum) {
        const zauzetiDatumi = new Set(
            konfiguracije.map((stavka) => String(stavka.vazi_od).slice(0, 10))
        );
        const datum = new Date(`${pocetniDatum}T00:00:00`);
        const formatiraj = () =>
            `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`;

        while (zauzetiDatumi.has(formatiraj())) {
            datum.setDate(datum.getDate() + 1);
        }
        return formatiraj();
    }

    dugmeIzmijeniKonfiguraciju.addEventListener("click", async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            document.getElementById("poruka-perioda").textContent = "Greška: prijavite se ponovo.";
            return;
        }

        dugmeIzmijeniKonfiguraciju.disabled = true;
        document.getElementById("poruka-perioda").textContent = "Učitavam konfiguraciju...";
        try {
            const odgovor = await fetch("/konfiguracije", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const rezultat = await odgovor.json().catch(() => ({}));
            if (!odgovor.ok) {
                throw new Error(rezultat.detail || "Konfiguracija nije učitana.");
            }
            if (!Array.isArray(rezultat.konfiguracije)) {
                throw new Error("Server nije vratio ispravnu listu konfiguracija.");
            }

            const datumDanas = danasnjiDatum();
            const konfiguracija = rezultat.konfiguracije
                .filter((stavka) => String(stavka.vazi_od).slice(0, 10) <= datumDanas)
                .sort((a, b) => String(b.vazi_od).localeCompare(String(a.vazi_od)))[0];
            if (!konfiguracija || !konfiguracija.cijene) {
                throw new Error("Nema važeće konfiguracije za izmjenu.");
            }

            formaKonfiguracije.reset();
            for (const opcija of opcije) {
                const nazivOpcije = opcija.dataset.opcija;
                const dostupna = Object.hasOwn(konfiguracija.cijene, nazivOpcije);
                const kontejnerCijene = opcija.closest("div").querySelector("[data-cijena-container]");
                const poljeCijene = kontejnerCijene.querySelector("[data-cijena]");
                opcija.checked = dostupna;
                kontejnerCijene.hidden = !dostupna;
                poljeCijene.disabled = !dostupna;
                poljeCijene.required = dostupna;
                poljeCijene.value = dostupna ? String(konfiguracija.cijene[nazivOpcije]) : "";
            }
            poljeVaziOd.value = sljedeciSlobodanDatum(rezultat.konfiguracije, datumDanas);
            postaviRezimKonfiguracije(true);
            sekcijaPerioda.hidden = true;
            sekcijaKonfiguracije.hidden = false;
            porukaPerioda.textContent = "";
            porukaKonfiguracije.textContent =
                `Izbori i cijene su preuzeti iz konfiguracije važeće od ${String(konfiguracija.vazi_od).slice(0, 10)}.`;
            poljeVaziOd.focus();
        } catch (greska) {
            document.getElementById("poruka-perioda").textContent =
                `Greška: ${greska.message || "Konfiguracija nije učitana."}`;
        } finally {
            dugmeIzmijeniKonfiguraciju.disabled = false;
        }
    });

    dugmeOdustaniKonfiguracije.addEventListener("click", () => {
        postaviRezimKonfiguracije(false);
        porukaKonfiguracije.textContent = "";
        sekcijaKonfiguracije.hidden = true;
        prikaziPregledPerioda();
    });

    opcije.forEach((opcija) => {
        opcija.addEventListener("change", () => {
            const poljeCijene = opcija.closest("div").querySelector("[data-cijena-container]");
            const unosCijene = poljeCijene.querySelector("[data-cijena]");
            poljeCijene.hidden = !opcija.checked;
            unosCijene.disabled = !opcija.checked;
            unosCijene.required = opcija.checked;

            if (!opcija.checked) {
                unosCijene.value = "";
            }
        });
    });

    formaKonfiguracije.addEventListener("submit", async (dogadjaj) => {
        dogadjaj.preventDefault();
        porukaKonfiguracije.textContent = "";
        const cijene = {};

        for (const opcija of opcije) {
            if (!opcija.checked) {
                continue;
            }

            const unosCijene = opcija.closest("div").querySelector("[data-cijena]");
            const cijena = unosCijene.valueAsNumber;
            if (!Number.isFinite(cijena) || cijena <= 0) {
                unosCijene.focus();
                porukaKonfiguracije.textContent = "Unesite cijenu veću od nule za svaku izabranu opciju.";
                return;
            }

            cijene[opcija.dataset.opcija] = cijena;
        }

        if (Object.keys(cijene).length === 0) {
            porukaKonfiguracije.textContent = "Izaberite barem jednu opciju.";
            return;
        }

        const vaziOd = document.getElementById("vazi-od").value;
        if (!vaziOd) {
            document.getElementById("vazi-od").focus();
            porukaKonfiguracije.textContent = "Unesite datum od kojeg konfiguracija važi.";
            return;
        }

        const token = localStorage.getItem("token");
        if (!token) {
            porukaKonfiguracije.textContent = "Greška: prijavite se ponovo.";
            return;
        }

        porukaKonfiguracije.textContent = "Čuvam konfiguraciju...";
        dugmeKonfiguracije.disabled = true;

        try {
            const odgovor = await fetch("/konfiguracija", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    cijene,
                    vazi_od: vaziOd
                })
            });
            const rezultat = await odgovor.json().catch(() => ({}));

            if (!odgovor.ok) {
                porukaKonfiguracije.textContent = `Greška: ${rezultat.detail || "Konfiguracija nije sačuvana."}`;
                return;
            }

            porukaKonfiguracije.textContent = "Konfiguracija je uspješno sačuvana.";
            postaviRezimKonfiguracije(false);
            prikaziPregledPerioda();
            await inicijalizujPregled();
        } catch (greska) {
            porukaKonfiguracije.textContent = "Greška u komunikaciji sa serverom.";
        } finally {
            dugmeKonfiguracije.disabled = false;
        }
    });
}

function odjaviKorisnika() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    formaPrijave.reset();
    formaRegistracije.reset();
    document.getElementById("poruka").textContent = "";
    document.getElementById("poruka-registracije").textContent = "";
    document.getElementById("sekcija-profil").hidden = true;
    document.getElementById("sekcija-konfiguracija").hidden = true;
    document.getElementById("sekcija-obracun-perioda").hidden = true;
    document.getElementById("sekcija-unos").hidden = true;
    document.getElementById("dijalog-pregled-unosa").close();
    authLayout.hidden = false;
    document.body.classList.add("auth-mode");
    postaviAuthTab(true);
    document.getElementById("korisnicko_ime").focus();
}

document.getElementById("dugme-odjava").addEventListener("click", odjaviKorisnika);

function obnoviSacuvaniToken() {
    const trajniToken = localStorage.getItem("token");
    const token = trajniToken || sessionStorage.getItem("token");
    if (token && !trajniToken) {
        localStorage.setItem("token", token);
    }
    sessionStorage.removeItem("token");
    return token;
}

const sacuvaniToken = obnoviSacuvaniToken();
if (sacuvaniToken) {
    const dugmePrijave = formaPrijave.querySelector('button[type="submit"]');
    const porukaPrijave = document.getElementById("poruka");
    dugmePrijave.disabled = true;
    porukaPrijave.textContent = "Provjeravam postojeću sesiju...";

    proveriProfilIPokaziSledeciKorak(sacuvaniToken).catch((greska) => {
        if (greska.status === 401 || greska.status === 403) {
            localStorage.removeItem("token");
            sessionStorage.removeItem("token");
            porukaPrijave.textContent = "Sesija je istekla. Prijavite se ponovo.";
            return;
        }
        porukaPrijave.textContent =
            `Sesiju nije moguće provjeriti: ${greska.message || "Greška u komunikaciji sa serverom."}`;
    }).finally(() => {
        dugmePrijave.disabled = false;
    });
}
