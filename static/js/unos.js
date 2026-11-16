import {
    formatirajIznos,
    prikaziPregledPerioda,
    ucitajObracunZaPeriod
} from "./period.js?v=10";

const sekcijaPerioda = document.getElementById("sekcija-obracun-perioda");
const sekcijaUnosa = document.getElementById("sekcija-unos");
const formaUnosa = document.getElementById("forma-unos");
const poljeDatuma = document.getElementById("datum-unosa");
const radioVrsteDana = formaUnosa.querySelectorAll('input[name="vrsta-dana"]');
const poljeRadnogDana = document.getElementById("stavke-radnog-dana");
const poljeOpcija = formaUnosa.querySelectorAll("[data-unos-opcija]");
const porukaKonfiguracije = document.getElementById("poruka-unosa-konfiguracije");
const porukaUnosa = document.getElementById("poruka-unosa");
const dugmePregled = document.getElementById("dugme-pregled-unosa");
const dijalogPregleda = document.getElementById("dijalog-pregled-unosa");
const sadrzajPregleda = document.getElementById("sadrzaj-pregleda-unosa");
const porukaPotvrde = document.getElementById("poruka-potvrde-unosa");
const dugmePotvrdi = document.getElementById("dugme-potvrdi-unos");
const listaTura = document.getElementById("lista-tura");

let konfiguracije = [];
let konfiguracijaZaDatum = null;
let unosNaPotvrdi = null;
let datumUnosaZaIzmjenu = null;

function danasnjiDatum() {
    const danas = new Date();
    const godina = danas.getFullYear();
    const mjesec = String(danas.getMonth() + 1).padStart(2, "0");
    const dan = String(danas.getDate()).padStart(2, "0");
    return `${godina}-${mjesec}-${dan}`;
}

function azurirajRazlikuKilometara() {
    const pocetni = document.getElementById("kilometri-pocetni");
    const zavrsni = document.getElementById("kilometri-zavrsni");
    const razlika = document.getElementById("razlika-kilometara");
    const pocetniBroj = pocetni.valueAsNumber;
    const zavrsniBroj = zavrsni.valueAsNumber;

    razlika.value = Number.isFinite(pocetniBroj) && Number.isFinite(zavrsniBroj)
        ? String(Math.max(0, zavrsniBroj - pocetniBroj))
        : "0";
    zavrsni.min = Number.isFinite(pocetniBroj) ? String(pocetniBroj) : "0";
}

function azurirajPoljeOpcije(opcija) {
    const checkbox = formaUnosa.querySelector(`[data-opcija-ukljuci="${opcija}"]`);
    const unos = formaUnosa.querySelector(`[data-vrijednost-opcije="${opcija}"]`);
    const kontejner = formaUnosa.querySelector(`[data-unos-opcija="${opcija}"] [data-vrijednost-container]`);
    const ukljuceno = checkbox.checked;
    kontejner.hidden = !ukljuceno;
    unos.disabled = !ukljuceno;
    unos.required = ukljuceno;

    if (!ukljuceno) {
        unos.value = "";
    }
}

function napraviTuru(redniBroj) {
    const red = document.createElement("div");
    red.dataset.tura = "";

    const labelaNaziva = document.createElement("label");
    labelaNaziva.textContent = `Naziv ture ${redniBroj} (opcionalno)`;
    const naziv = document.createElement("input");
    naziv.type = "text";
    naziv.maxLength = 100;
    naziv.dataset.turaOpis = "";
    labelaNaziva.append(naziv);

    const labelaIznosa = document.createElement("label");
    labelaIznosa.textContent = `Iznos ture ${redniBroj} (EUR)`;
    const iznos = document.createElement("input");
    iznos.type = "number";
    iznos.min = "0";
    iznos.step = "any";
    iznos.required = false;
    iznos.dataset.turaIznos = "";
    labelaIznosa.append(iznos);

    const obrisi = document.createElement("button");
    obrisi.type = "button";
    obrisi.textContent = "Obriši turu";
    obrisi.addEventListener("click", () => {
        if (listaTura.children.length > 1) {
            red.remove();
            osvjeziTure();
        }
    });

    red.append(labelaNaziva, labelaIznosa, obrisi);
    return red;
}

function osvjeziTure() {
    const ture = Array.from(listaTura.querySelectorAll("[data-tura]"));
    ture.forEach((tura, index) => {
        const [labelaNaziva, labelaIznosa] = tura.querySelectorAll("label");
        labelaNaziva.firstChild.textContent = `Naziv ture ${index + 1} (opcionalno)`;
        labelaIznosa.firstChild.textContent = `Iznos ture ${index + 1} (EUR)`;
        tura.querySelector("button").disabled = ture.length === 1;
    });
}

function resetujTure() {
    listaTura.replaceChildren(napraviTuru(1));
    osvjeziTure();
}

function postaviVrstuDana() {
    const odabranaVrsta = formaUnosa.querySelector('input[name="vrsta-dana"]:checked').value;
    poljeRadnogDana.hidden = odabranaVrsta !== "radni";
}

function sakrijOpcijeBezKonfiguracije() {
    poljeRadnogDana.hidden = true;
    for (const vrsta of ["godisnji", "bolovanje"]) {
        const radio = formaUnosa.querySelector(`input[name="vrsta-dana"][value="${vrsta}"]`);
        radio.disabled = true;
        radio.closest("[data-vrsta-dana]").hidden = true;
    }
    formaUnosa.querySelector('input[name="vrsta-dana"][value="radni"]').checked = true;

    for (const wrapper of poljeOpcija) {
        wrapper.hidden = true;
        for (const kontrola of wrapper.querySelectorAll("input")) {
            kontrola.disabled = true;
            kontrola.required = false;
            if (kontrola.type === "checkbox") {
                kontrola.checked = false;
            } else {
                kontrola.value = "";
            }
        }
    }
}

function odaberiKonfiguracijuZaDatum() {
    const datum = poljeDatuma.value;
    konfiguracijaZaDatum = konfiguracije
        .filter((konfiguracija) => String(konfiguracija.vazi_od).slice(0, 10) <= datum)
        .sort((a, b) => String(b.vazi_od).localeCompare(String(a.vazi_od)))[0] || null;

    if (!konfiguracijaZaDatum) {
        porukaKonfiguracije.textContent = "Za ovaj datum ne postoji važeća konfiguracija cijena.";
        sakrijOpcijeBezKonfiguracije();
        document.getElementById("izbor-vrste-dana").disabled = true;
        document.getElementById("dugme-pregled-unosa").disabled = true;
        return;
    }

    porukaKonfiguracije.textContent = "";
    document.getElementById("izbor-vrste-dana").disabled = false;
    document.getElementById("dugme-pregled-unosa").disabled = false;

    for (const wrapper of poljeOpcija) {
        const opcija = wrapper.dataset.unosOpcija;
        const dostupna = Object.hasOwn(konfiguracijaZaDatum.cijene, opcija);
        wrapper.hidden = !dostupna;

        if (opcija === "kilometar") {
            const pocetni = document.getElementById("kilometri-pocetni");
            const zavrsni = document.getElementById("kilometri-zavrsni");
            pocetni.required = dostupna;
            zavrsni.required = dostupna;
            pocetni.disabled = !dostupna;
            zavrsni.disabled = !dostupna;
            continue;
        }

        if (opcija === "procenat") {
            for (const unos of wrapper.querySelectorAll("input")) {
                unos.disabled = !dostupna;
                unos.required = dostupna && unos.hasAttribute("data-tura-iznos");
            }
            if (dostupna && listaTura.children.length === 0) {
                resetujTure();
            }
            continue;
        }

        const checkbox = wrapper.querySelector(`[data-opcija-ukljuci="${opcija}"]`);
        const unos = wrapper.querySelector(`[data-vrijednost-opcije="${opcija}"]`);
        wrapper.querySelector("[data-vrijednost-container]").hidden = true;
        checkbox.checked = false;
        checkbox.disabled = !dostupna;
        unos.value = "";
        unos.disabled = true;
        unos.required = false;
    }

    for (const vrsta of ["godisnji", "bolovanje"]) {
        const radio = formaUnosa.querySelector(`input[name="vrsta-dana"][value="${vrsta}"]`);
        const cijena = konfiguracijaZaDatum.cijene[vrsta];
        const dostupna = Object.hasOwn(konfiguracijaZaDatum.cijene, vrsta)
            && Number.isFinite(Number(cijena))
            && Number(cijena) > 0;
        radio.closest("[data-vrsta-dana]").hidden = !dostupna;
        radio.disabled = !dostupna;
        if (radio.disabled && radio.checked) {
            formaUnosa.querySelector('input[name="vrsta-dana"][value="radni"]').checked = true;
        }
    }

    postaviVrstuDana();
    azurirajRazlikuKilometara();
}

async function ucitajKonfiguracije() {
    const token = localStorage.getItem("token");
    if (!token) {
        throw new Error("Prijavite se ponovo.");
    }

    const odgovor = await fetch("/konfiguracije", {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const rezultat = await odgovor.json().catch(() => ({}));

    if (!odgovor.ok) {
        throw new Error(rezultat.detail || "Nije moguće učitati konfiguracije.");
    }

    if (!Array.isArray(rezultat.konfiguracije)) {
        throw new Error("Server nije vratio ispravnu listu konfiguracija.");
    }

    konfiguracije = rezultat.konfiguracije;
}

function prikaziPar(parent, naziv, vrijednost, novcaniIznos = false) {
    const stavka = document.createElement("p");
    const labela = document.createElement("strong");
    labela.textContent = `${naziv}: `;
    const tekstVrijednosti = novcaniIznos ? formatirajIznos(vrijednost) : String(vrijednost);
    stavka.append(labela, document.createTextNode(tekstVrijednosti));
    parent.append(stavka);
}

function prikaziPregled(pregled, kilometri) {
    sadrzajPregleda.replaceChildren();
    prikaziPar(sadrzajPregleda, "Datum", pregled.datum);
    document.getElementById("naslov-pregleda-unosa").textContent =
        datumUnosaZaIzmjenu ? "Provjerite izmjenu unosa" : "Provjerite unete podatke";
    dugmePotvrdi.textContent = datumUnosaZaIzmjenu ? "Sačuvaj izmjenu" : "Potvrdi unos";

    const naziviDana = {
        radni: "Radni dan",
        godisnji: "Godišnji",
        bolovanje: "Bolovanje"
    };
    prikaziPar(sadrzajPregleda, "Vrsta dana", naziviDana[pregled.vrsta_dana] || pregled.vrsta_dana);

    if (pregled.vrsta_dana !== "radni") {
        return;
    }

    const podaci = pregled.unos || {};
    if (kilometri) {
        prikaziPar(sadrzajPregleda, "Početni kilometri", kilometri.pocetni);
        prikaziPar(sadrzajPregleda, "Završni kilometri", kilometri.zavrsni);
        prikaziPar(sadrzajPregleda, "Pređena razdaljina", podaci.kilometar);
    }
    for (const [opcija, naziv] of [
        ["cekanje", "Sati čekanja"],
        ["stranka", "Broj stranaka"],
        ["bonus", "Količina bonusa"]
    ]) {
        if (Object.hasOwn(podaci, opcija)) {
            prikaziPar(sadrzajPregleda, naziv, podaci[opcija]);
        }
    }
    if (Array.isArray(podaci.ture)) {
        podaci.ture.forEach((tura, index) => {
            const naziv = tura.opis ? `${index + 1}. tura (${tura.opis})` : `${index + 1}. tura`;
            prikaziPar(sadrzajPregleda, naziv, tura.iznos, true);
        });
    }
}

function napraviPodatkeZaSlanje() {
    const datum = poljeDatuma.value;
    const vrstaDana = formaUnosa.querySelector('input[name="vrsta-dana"]:checked').value;
    const podaci = { datum, vrsta_dana: vrstaDana, unos: {} };

    if (vrstaDana !== "radni") {
        return { podaci, kilometri: null };
    }

    const kilometriWrapper = formaUnosa.querySelector('[data-unos-opcija="kilometar"]');
    let kilometri = null;
    if (!kilometriWrapper.hidden) {
        const pocetni = document.getElementById("kilometri-pocetni").valueAsNumber;
        const zavrsni = document.getElementById("kilometri-zavrsni").valueAsNumber;
        if (!Number.isInteger(pocetni) || !Number.isInteger(zavrsni) || zavrsni < pocetni) {
            throw new Error("Završni kilometri moraju biti veći ili jednaki početnim.");
        }
        podaci.unos.kilometar = zavrsni - pocetni;
        kilometri = { pocetni, zavrsni };
    }

    for (const opcija of ["cekanje", "stranka", "bonus"]) {
        const wrapper = formaUnosa.querySelector(`[data-unos-opcija="${opcija}"]`);
        if (wrapper.hidden) {
            continue;
        }
        const checkbox = wrapper.querySelector(`[data-opcija-ukljuci="${opcija}"]`);
        if (checkbox.checked) {
            podaci.unos[opcija] = wrapper.querySelector(`[data-vrijednost-opcije="${opcija}"]`).valueAsNumber;
        } else if (opcija === "bonus") {
            podaci.unos.bonus = 0;
        }
    }

    const procenatWrapper = formaUnosa.querySelector('[data-unos-opcija="procenat"]');
    if (!procenatWrapper.hidden) {
        const ture = Array.from(listaTura.querySelectorAll("[data-tura]")).map((red) => ({
            opis: red.querySelector("[data-tura-opis]").value.trim(),
            iznos: red.querySelector("[data-tura-iznos]").valueAsNumber
        }));
        if (ture.length === 0 || ture.some((tura) => !Number.isFinite(tura.iznos) || tura.iznos < 0)) {
            throw new Error("Unesite iznos za najmanje jednu turu.");
        }
        podaci.unos.ture = ture;
    }

    return { podaci, kilometri };
}

async function posaljiZaPregled(podaci, kilometri) {
    const token = localStorage.getItem("token");
    if (!token) {
        throw new Error("Prijavite se ponovo.");
    }

    const odgovor = await fetch("/unos/pregled", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(podaci)
    });
    const rezultat = await odgovor.json().catch(() => ({}));

    if (!odgovor.ok) {
        throw new Error(rezultat.detail || "Pregled unosa nije uspio.");
    }
    if (!rezultat.pregled) {
        throw new Error("Server nije vratio podatke za pregled.");
    }

    unosNaPotvrdi = rezultat.pregled;
    prikaziPregled(unosNaPotvrdi, kilometri);
    porukaPotvrde.textContent = "";
    dugmePotvrdi.disabled = false;
    if (!dijalogPregleda.open) {
        dijalogPregleda.showModal();
    }
}

async function sacuvajUnos() {
    if (!unosNaPotvrdi) {
        porukaPotvrde.textContent = "Nema podataka za čuvanje.";
        return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
        porukaPotvrde.textContent = "Prijavite se ponovo.";
        return;
    }

    porukaPotvrde.textContent = "Čuvam unos...";
    dugmePotvrdi.disabled = true;
    try {
        const putanja = datumUnosaZaIzmjenu
            ? `/unos/${encodeURIComponent(datumUnosaZaIzmjenu)}`
            : "/unos";
        const odgovor = await fetch(putanja, {
            method: datumUnosaZaIzmjenu ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(unosNaPotvrdi)
        });
        const rezultat = await odgovor.json().catch(() => ({}));

        if (!odgovor.ok) {
            porukaPotvrde.textContent = `Greška: ${rezultat.detail || "Unos nije sačuvan."}`;
            return;
        }

        const datum = unosNaPotvrdi.datum;
        dijalogPregleda.close();
        unosNaPotvrdi = null;
        datumUnosaZaIzmjenu = null;
        poljeDatuma.disabled = false;
        document.getElementById("napomena-kilometara-izmjena").hidden = true;
        document.getElementById("datum-od").value = datum;
        document.getElementById("datum-do").value = datum;
        document.querySelectorAll(".dugme-period").forEach((dugme) => dugme.classList.remove("aktivan"));
        prikaziPregledPerioda();
        const prikazUspio = await ucitajObracunZaPeriod(datum, datum);
        if (!prikazUspio) {
            document.getElementById("poruka-perioda").textContent =
                "Unos je sačuvan, ali prikaz obračuna nije uspio. Pokušajte ponovo.";
        }
    } catch (greska) {
        porukaPotvrde.textContent = `Greška: ${greska.message || "Greška u komunikaciji sa serverom."}`;
    } finally {
        dugmePotvrdi.disabled = false;
    }
}

async function otvoriFormuUnosa() {
    datumUnosaZaIzmjenu = null;
    sekcijaPerioda.hidden = true;
    sekcijaUnosa.hidden = false;
    sekcijaUnosa.querySelector("h1").textContent = "Unos novog podatka";
    formaUnosa.reset();
    poljeDatuma.disabled = false;
    poljeDatuma.value = danasnjiDatum();
    resetujTure();
    postaviVrstuDana();
    document.getElementById("napomena-kilometara-izmjena").hidden = true;
    document.getElementById("dugme-pregled-unosa").textContent = "OK";
    document.getElementById("dugme-pregled-unosa").disabled = true;
    porukaUnosa.textContent = "";
    try {
        await ucitajKonfiguracije();
        odaberiKonfiguracijuZaDatum();
        poljeDatuma.focus();
    } catch (greska) {
        konfiguracije = [];
        konfiguracijaZaDatum = null;
        sakrijOpcijeBezKonfiguracije();
        porukaKonfiguracije.textContent = `Greška: ${greska.message || "Konfiguracije nisu učitane."}`;
        document.getElementById("izbor-vrste-dana").disabled = true;
    }
}

async function otvoriFormuZaIzmjenu(datum) {
    sekcijaPerioda.hidden = true;
    sekcijaUnosa.hidden = false;
    sekcijaUnosa.querySelector("h1").textContent = "Izmjena unosa";
    datumUnosaZaIzmjenu = datum;
    formaUnosa.reset();
    poljeDatuma.value = datum;
    poljeDatuma.disabled = true;
    resetujTure();
    document.getElementById("napomena-kilometara-izmjena").hidden = true;
    document.getElementById("dugme-pregled-unosa").textContent = "Pregled izmjene";
    document.getElementById("dugme-pregled-unosa").disabled = true;
    porukaUnosa.textContent = "";

    try {
        await ucitajKonfiguracije();
        odaberiKonfiguracijuZaDatum();
        if (!konfiguracijaZaDatum) {
            return;
        }

        const token = localStorage.getItem("token");
        const odgovor = await fetch(`/prikaz_unesenih_podataka/${encodeURIComponent(datum)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const rezultat = await odgovor.json().catch(() => ({}));
        if (!odgovor.ok) {
            throw new Error(rezultat.detail || "Postojeći unos nije učitan.");
        }
        if (!Array.isArray(rezultat.lista) || rezultat.lista.length !== 1) {
            throw new Error("Server nije vratio ispravan unos za izabrani datum.");
        }

        popuniFormuZaIzmjenu(rezultat.lista[0].podaci);
        document.getElementById("dugme-pregled-unosa").disabled = false;
        document.getElementById("dugme-pregled-unosa").focus();
    } catch (greska) {
        document.getElementById("dugme-pregled-unosa").disabled = true;
        porukaUnosa.textContent = `Greška: ${greska.message || "Unos nije učitan."}`;
    }
}

function popuniFormuZaIzmjenu(podaci) {
    if (!podaci || !["radni", "godisnji", "bolovanje"].includes(podaci.vrsta_dana)) {
        throw new Error("Sačuvani unos ima neispravnu vrstu dana.");
    }

    formaUnosa.querySelector(`input[name="vrsta-dana"][value="${podaci.vrsta_dana}"]`).checked = true;
    postaviVrstuDana();
    if (podaci.vrsta_dana !== "radni") {
        return;
    }

    const unos = podaci.unos || {};
    for (const opcija of ["cekanje", "stranka", "bonus"]) {
        if (!Object.hasOwn(unos, opcija) || Number(unos[opcija]) <= 0) {
            continue;
        }
        const checkbox = formaUnosa.querySelector(`[data-opcija-ukljuci="${opcija}"]`);
        if (checkbox.disabled) {
            throw new Error(`Opcija "${opcija}" nije dostupna u konfiguraciji za ovaj datum.`);
        }
        checkbox.checked = true;
        azurirajPoljeOpcije(opcija);
        formaUnosa.querySelector(`[data-vrijednost-opcije="${opcija}"]`).value = unos[opcija];
    }

    if (Object.hasOwn(unos, "kilometar")) {
        if (formaUnosa.querySelector('[data-unos-opcija="kilometar"]').hidden) {
            throw new Error("Kilometraža nije dostupna u konfiguraciji za ovaj datum.");
        }
        document.getElementById("kilometri-pocetni").value = "0";
        document.getElementById("kilometri-zavrsni").value = String(unos.kilometar);
        document.getElementById("napomena-kilometara-izmjena").hidden = false;
        azurirajRazlikuKilometara();
    }

    if (Array.isArray(unos.ture) && formaUnosa.querySelector('[data-unos-opcija="procenat"]').hidden) {
        throw new Error("Ture nisu dostupne u konfiguraciji za ovaj datum.");
    }
    if (Array.isArray(unos.ture)) {
        listaTura.replaceChildren();
        unos.ture.forEach((tura, index) => {
            const red = napraviTuru(index + 1);
            red.querySelector("[data-tura-opis]").value = tura.opis || "";
            red.querySelector("[data-tura-iznos]").value = String(tura.iznos);
            listaTura.append(red);
        });
        osvjeziTure();
    }
}

document.getElementById("dugme-novi-unos").addEventListener("click", otvoriFormuUnosa);
document.addEventListener("izmijeni-dnevni-unos", (dogadjaj) => {
    otvoriFormuZaIzmjenu(dogadjaj.detail.datum);
});

document.getElementById("dugme-odustani-unosa").addEventListener("click", () => {
    if (dijalogPregleda.open) {
        dijalogPregleda.close();
    }
    unosNaPotvrdi = null;
    datumUnosaZaIzmjenu = null;
    poljeDatuma.disabled = false;
    prikaziPregledPerioda();
});

poljeDatuma.addEventListener("change", odaberiKonfiguracijuZaDatum);
radioVrsteDana.forEach((radio) => radio.addEventListener("change", postaviVrstuDana));

for (const opcija of ["cekanje", "stranka", "bonus"]) {
    formaUnosa.querySelector(`[data-opcija-ukljuci="${opcija}"]`).addEventListener("change", () => {
        azurirajPoljeOpcije(opcija);
    });
}

document.getElementById("kilometri-pocetni").addEventListener("input", azurirajRazlikuKilometara);
document.getElementById("kilometri-zavrsni").addEventListener("input", azurirajRazlikuKilometara);
document.getElementById("dugme-dodaj-turu").addEventListener("click", () => {
    listaTura.append(napraviTuru(listaTura.children.length + 1));
    osvjeziTure();
});
document.getElementById("dugme-izmeni-unos").addEventListener("click", () => {
    dijalogPregleda.close();
});
dugmePotvrdi.addEventListener("click", sacuvajUnos);

formaUnosa.addEventListener("submit", async (dogadjaj) => {
    dogadjaj.preventDefault();
    porukaUnosa.textContent = "";

    if (!konfiguracijaZaDatum) {
        porukaKonfiguracije.textContent = "Za ovaj datum ne postoji važeća konfiguracija cijena.";
        return;
    }

    try {
        const { podaci, kilometri } = napraviPodatkeZaSlanje();
        porukaUnosa.textContent = "Pripremam pregled...";
        dugmePregled.disabled = true;
        await posaljiZaPregled(podaci, kilometri);
    } catch (greska) {
        porukaUnosa.textContent = `Greška: ${greska.message || "Unos nije validan."}`;
    } finally {
        dugmePregled.disabled = false;
    }
});

resetujTure();
