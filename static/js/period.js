const sekcijaPrijave = document.getElementById("sekcija-prijava");
const sekcijaRegistracije = document.getElementById("registracija");
const sekcijaProfila = document.getElementById("sekcija-profil");
const sekcijaKonfiguracije = document.getElementById("sekcija-konfiguracija");
const sekcijaPerioda = document.getElementById("sekcija-obracun-perioda");
const datumOd = document.getElementById("datum-od");
const datumDo = document.getElementById("datum-do");
const porukaPerioda = document.getElementById("poruka-perioda");

const naziviStavki = {
    kilometar: "Kilometar",
    dnevnica: "Dnevnica",
    procenat: "Procenat",
    fiks: "Fiksni iznos",
    cekanje: "Čekanje",
    stranka: "Stranka",
    godisnji: "Godišnji odmor",
    bolovanje: "Bolovanje",
    bonus_kilometri: "Bonus kilometri",
    bonus_promet: "Bonus na promet",
    bonus: "Dodaci",
    promet: "Promet"
};

function tokenKorisnika() {
    return localStorage.getItem("token");
}

export function formatirajIznos(iznos) {
    const formatiranIznos = Number(iznos || 0).toLocaleString("sr-RS", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${formatiranIznos}\u00a0€`;
}

function formatirajDatum(datum) {
    const poklapanje = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(datum));
    return poklapanje ? `${poklapanje[3]}.${poklapanje[2]}.${poklapanje[1]}.` : datum;
}

function formatirajDan(datum) {
    const poklapanje = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum));
    if (!poklapanje) {
        return "";
    }

    const godina = Number(poklapanje[1]);
    const mjesec = Number(poklapanje[2]) - 1;
    const dan = Number(poklapanje[3]);
    const datumObjekat = new Date(godina, mjesec, dan);
    if (
        datumObjekat.getFullYear() !== godina ||
        datumObjekat.getMonth() !== mjesec ||
        datumObjekat.getDate() !== dan
    ) {
        return "";
    }

    return ["NED", "PON", "UTO", "SRI", "ČET", "PET", "SUB"][datumObjekat.getDay()];
}

function datumLokalno(datum) {
    const godina = datum.getFullYear();
    const mjesec = String(datum.getMonth() + 1).padStart(2, "0");
    const dan = String(datum.getDate()).padStart(2, "0");
    return `${godina}-${mjesec}-${dan}`;
}

function rasponMjeseca(pomjeraj = 0) {
    const danas = new Date();
    const prviDan = new Date(danas.getFullYear(), danas.getMonth() + pomjeraj, 1);
    const zadnjiDan = new Date(danas.getFullYear(), danas.getMonth() + pomjeraj + 1, 0);
    return {
        od: datumLokalno(prviDan),
        do: datumLokalno(zadnjiDan),
        naziv: prviDan.toLocaleDateString("sr-Latn", { month: "long", year: "numeric" })
    };
}

function postaviRaspon(od, doDatuma, aktivniDugme = null) {
    datumOd.value = od;
    datumDo.value = doDatuma;
    document.querySelectorAll(".dugme-period").forEach((dugme) => {
        dugme.classList.toggle("aktivan", dugme === aktivniDugme);
    });
}

export function prikaziPregledPerioda() {
    sekcijaPrijave.hidden = true;
    sekcijaRegistracije.hidden = true;
    sekcijaProfila.hidden = true;
    sekcijaKonfiguracije.hidden = true;
    document.getElementById("auth-layout").hidden = true;
    document.body.classList.remove("auth-mode");
    document.getElementById("sekcija-unos").hidden = true;
    sekcijaPerioda.hidden = false;
}

export async function inicijalizujPregled() {
    const token = tokenKorisnika();
    if (!token) {
        porukaPerioda.textContent = "Greška: prijavite se ponovo.";
        return;
    }

    const tekuciMjesec = rasponMjeseca();
    postaviRaspon(tekuciMjesec.od, tekuciMjesec.do, document.getElementById("dugme-ovaj-mjesec"));
    const profilZahtjev = fetch("/konfiguracije", {
        headers: { "Authorization": `Bearer ${token}` }
    }).then(async (odgovor) => {
        const rezultat = await odgovor.json().catch(() => ({}));
        if (!odgovor.ok) {
            throw new Error(rezultat.detail || "Nije moguće učitati podatke profila.");
        }
        const imeIPrezime = [rezultat.ime, rezultat.prezime].filter(Boolean).join(" ").trim();
        document.getElementById("pozdrav-korisnika").textContent =
            imeIPrezime ? `Dobro došli, ${imeIPrezime}` : "Dobro došli";
    });

    const ucitavanje = await Promise.allSettled([
        profilZahtjev,
        ucitajObracunZaPeriod(tekuciMjesec.od, tekuciMjesec.do)
    ]);

    if (ucitavanje[0].status === "rejected") {
        porukaPerioda.textContent = `Greška: ${ucitavanje[0].reason.message || "Podaci profila nisu učitani."}`;
    }
}

async function dohvatiObracun(datumPocetka, datumZavrsetka) {
    const token = tokenKorisnika();
    if (!token) {
        throw new Error("Greška: prijavite se ponovo.");
    }

    const parametri = new URLSearchParams({ od: datumPocetka, do: datumZavrsetka });
    const odgovor = await fetch(`/obracun_za_period?${parametri}`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const rezultat = await odgovor.json().catch(() => ({}));

    if (odgovor.status === 404 && rezultat.detail === "Nema unosa podataka za trazeni period") {
        return { odgovor: [], obracunatih_dana: 0, ukupni_zbir: 0 };
    }
    if (!odgovor.ok) {
        throw new Error(rezultat.detail || "Podaci nisu učitani.");
    }
    if (!Array.isArray(rezultat.odgovor)) {
        throw new Error("Server nije vratio ispravan spisak podataka.");
    }
    return rezultat;
}

function napraviAkciju(tekst, klasa, akcija, datum) {
    const dugme = document.createElement("button");
    dugme.type = "button";
    dugme.className = klasa;
    dugme.dataset.akcija = akcija;
    dugme.dataset.datum = datum;
    dugme.setAttribute("aria-label", tekst);
    dugme.title = tekst;
    dugme.innerHTML = akcija === "izmijeni"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4h-9a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9"/><path stroke-linecap="round" stroke-linejoin="round" d="m16 5 3 3M8 16l1-4L18.6 2.4a2.1 2.1 0 0 1 3 3L12 15Z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 6V4h8v2m-9 0 1 14h8l1-14M10 11v5m4-5v5"/></svg>';
    return dugme;
}

function prikaziObracun(rezultat) {
    const redoviObracuna = document.getElementById("redovi-obracuna");
    const rezultatiPerioda = document.getElementById("rezultati-perioda");
    const tabelaWrapper = document.querySelector(".tabela-obracuna-wrapper");
    const prazanPeriod = document.getElementById("prazan-period");
    redoviObracuna.replaceChildren();

    for (const dnevniObracun of rezultat.odgovor) {
        const red = document.createElement("tr");
        const datum = String(dnevniObracun.datum).slice(0, 10);
        const celijaDatuma = document.createElement("td");
        const celijaStavki = document.createElement("td");
        const celijaUkupno = document.createElement("td");
        const celijaAkcija = document.createElement("td");
        const listaStavki = document.createElement("ul");
        const oznakaDana = document.createElement("span");
        const datumVrijednost = document.createElement("time");

        red.className = "red-obracuna";
        celijaDatuma.className = "celija-datum";
        oznakaDana.className = "oznaka-dana";
        oznakaDana.textContent = formatirajDan(datum);
        datumVrijednost.className = "vrijednost-datuma";
        datumVrijednost.dateTime = datum;
        datumVrijednost.textContent = formatirajDatum(datum);
        celijaDatuma.append(oznakaDana, datumVrijednost);
        celijaStavki.className = "celija-stavki";
        listaStavki.className = "lista-stavki";
        for (const [stavka, iznos] of Object.entries(dnevniObracun.iznos || {})) {
            if (Number(iznos) === 0) {
                continue;
            }

            const elementStavke = document.createElement("li");
            const tackaStavke = document.createElement("span");
            const tekstStavke = document.createElement("span");
            elementStavke.className = "oznaka-stavke";
            elementStavke.dataset.stavka = stavka;
            tackaStavke.className = "oznaka-stavke-tacka";
            tackaStavke.setAttribute("aria-hidden", "true");
            tekstStavke.textContent = `${naziviStavki[stavka] || stavka}: ${formatirajIznos(iznos)}`;
            elementStavke.append(tackaStavke, tekstStavke);
            listaStavki.append(elementStavke);
        }
        celijaStavki.append(listaStavki);
        celijaUkupno.textContent = formatirajIznos(dnevniObracun.ukupno);
        celijaUkupno.className = "iznos-ukupno";
        celijaAkcija.className = "celija-akcija";
        celijaAkcija.append(
            napraviAkciju("Izmijeni", "dugme-akcija dugme-izmijeni", "izmijeni", datum),
            napraviAkciju("Obriši", "dugme-akcija dugme-obrisi", "obrisi", datum)
        );
        red.append(celijaDatuma, celijaStavki, celijaUkupno, celijaAkcija);
        redoviObracuna.append(red);
    }

    document.getElementById("ukupno-perioda").textContent = formatirajIznos(rezultat.ukupni_zbir);
    document.getElementById("broj-prikazanih").textContent = String(rezultat.odgovor.length);
    tabelaWrapper.hidden = rezultat.odgovor.length === 0;
    prazanPeriod.hidden = rezultat.odgovor.length !== 0;
    rezultatiPerioda.hidden = false;
}

function prikaziStatistiku(rezultat, datumPocetka, datumZavrsetka) {
    const dnevniUnosi = rezultat.odgovor || [];
    const brojDana = Number(rezultat.obracunatih_dana) || dnevniUnosi.length;
    const ukupno = Number(rezultat.ukupni_zbir) || 0;
    document.getElementById("kpi-mjesec-zarada").textContent = formatirajIznos(ukupno);
    document.getElementById("kpi-mjesec-dani").textContent = String(brojDana);
    document.getElementById("kpi-prosjek-po-danu").textContent =
        formatirajIznos(brojDana ? ukupno / brojDana : 0);
    document.getElementById("kpi-mjesec-naziv").textContent =
        `${formatirajDatum(datumPocetka)} – ${formatirajDatum(datumZavrsetka)}`;

    const brojPoVrsti = { radni: 0, godisnji: 0, bolovanje: 0 };
    for (const dnevniUnos of dnevniUnosi) {
        const vrstaDana = dnevniUnos.vrsta_dana || "radni";
        if (Object.hasOwn(brojPoVrsti, vrstaDana)) {
            brojPoVrsti[vrstaDana] += 1;
        }
    }

    document.getElementById("kpi-broj-radnih").textContent = String(brojPoVrsti.radni);
    document.getElementById("kpi-broj-godisnjih").textContent = String(brojPoVrsti.godisnji);
    document.getElementById("kpi-broj-bolovanja").textContent = String(brojPoVrsti.bolovanje);
}

export async function ucitajObracunZaPeriod(datumPocetka, datumZavrsetka) {
    const rezultatiPerioda = document.getElementById("rezultati-perioda");
    const dugmePerioda = document.querySelector('#forma-perioda button[type="submit"]');
    porukaPerioda.textContent = "";
    rezultatiPerioda.hidden = true;

    if (!datumPocetka || !datumZavrsetka || datumPocetka > datumZavrsetka) {
        porukaPerioda.textContent = "Unesite ispravan period: početni datum ne može biti posle krajnjeg datuma.";
        return false;
    }

    if (dugmePerioda) {
        dugmePerioda.disabled = true;
    }
    porukaPerioda.textContent = "Učitavam podatke...";

    try {
        const rezultat = await dohvatiObracun(datumPocetka, datumZavrsetka);
        prikaziStatistiku(rezultat, datumPocetka, datumZavrsetka);
        prikaziObracun(rezultat);
        porukaPerioda.textContent = "";
        return true;
    } catch (greska) {
        porukaPerioda.textContent = `Greška: ${greska.message || "Greška u komunikaciji sa serverom."}`;
        return false;
    } finally {
        if (dugmePerioda) {
            dugmePerioda.disabled = false;
        }
    }
}

document.getElementById("forma-perioda").addEventListener("submit", async (dogadjaj) => {
    dogadjaj.preventDefault();
    document.querySelectorAll(".dugme-period").forEach((dugme) => dugme.classList.remove("aktivan"));
    await ucitajObracunZaPeriod(datumOd.value, datumDo.value);
});

document.getElementById("dugme-ovaj-mjesec").addEventListener("click", async (dogadjaj) => {
    const mjesec = rasponMjeseca();
    postaviRaspon(mjesec.od, mjesec.do, dogadjaj.currentTarget);
    await ucitajObracunZaPeriod(mjesec.od, mjesec.do);
});

document.getElementById("dugme-prosli-mjesec").addEventListener("click", async (dogadjaj) => {
    const mjesec = rasponMjeseca(-1);
    postaviRaspon(mjesec.od, mjesec.do, dogadjaj.currentTarget);
    await ucitajObracunZaPeriod(mjesec.od, mjesec.do);
});

document.getElementById("redovi-obracuna").addEventListener("click", async (dogadjaj) => {
    const dugme = dogadjaj.target.closest("button[data-akcija]");
    if (!dugme) {
        return;
    }

    const datum = dugme.dataset.datum;
    if (dugme.dataset.akcija === "izmijeni") {
        document.dispatchEvent(new CustomEvent("izmijeni-dnevni-unos", { detail: { datum } }));
        return;
    }

    if (!window.confirm(`Da li ste sigurni da želite obrisati unos za ${formatirajDatum(datum)}?`)) {
        return;
    }

    const token = tokenKorisnika();
    if (!token) {
        porukaPerioda.textContent = "Greška: prijavite se ponovo.";
        return;
    }
    dugme.disabled = true;
    try {
        const odgovor = await fetch(`/unos/${encodeURIComponent(datum)}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const rezultat = await odgovor.json().catch(() => ({}));
        if (!odgovor.ok) {
            throw new Error(rezultat.detail || "Unos nije obrisan.");
        }

        await ucitajObracunZaPeriod(datumOd.value, datumDo.value);
        porukaPerioda.textContent = "Unos je uspješno obrisan.";
    } catch (greska) {
        porukaPerioda.textContent = `Greška: ${greska.message || "Unos nije obrisan."}`;
        dugme.disabled = false;
    }
});
