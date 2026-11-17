from datetime import date
from enum import Enum
from pydantic import BaseModel, Field, NonNegativeFloat, NonNegativeInt, PositiveFloat, field_validator

class Korisnik(BaseModel):
    korisnicko_ime: str = Field(min_length=1, max_length=30)
    lozinka: str = Field(min_length=1, max_length=50)

class ProfilKorisnika(BaseModel):
    ime: str = Field(min_length=1, max_length=30)
    prezime: str = Field(min_length=1, max_length=30)

class Opcija(str, Enum):
    kilometar = "kilometar"
    dnevnica = "dnevnica"
    procenat = "procenat"
    fiks = "fiks"
    cekanje = "cekanje"
    stranka = "stranka"
    godisnji = "godisnji"
    bolovanje = "bolovanje"
    bonus = "bonus"

class Konfiguracija(BaseModel):
    cijene: dict[Opcija, PositiveFloat]
    vazi_od: date = Field(default_factory=date.today)

    @field_validator("cijene")
    @classmethod
    def postavi_nominalnu_cijenu_bonusa(cls, cijene: dict[Opcija, float]) -> dict[Opcija, float]:
        if Opcija.bonus in cijene:
            cijene = cijene.copy()
            cijene[Opcija.bonus] = 1.0
        return cijene

class VrstaDana(str, Enum):
    radni = "radni"
    godisnji = "godisnji"
    bolovanje = "bolovanje"

class Tura(BaseModel):
    iznos: NonNegativeFloat
    opis: str = Field(default="", max_length=100)

class Unos(BaseModel):
    kilometar: NonNegativeInt | None = None
    ture: list[Tura] | None = None
    cekanje: NonNegativeInt | None = None
    stranka: NonNegativeInt | None = None
    bonus: NonNegativeInt | None = None

class Kalkulacija(BaseModel):
    datum: date = Field(default_factory=date.today)
    vrsta_dana: VrstaDana = VrstaDana.radni
    unos: Unos