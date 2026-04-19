"""
Configuration constants for the ONPE Election Data Backend.
"""
from pathlib import Path

# ── Base paths ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

# ── ONPE API ───────────────────────────────────────────────────────────────
ONPE_BASE_URL = "https://resultadoelectoral.onpe.gob.pe"
ONPE_MAIN_PAGE = f"{ONPE_BASE_URL}/main/resumen"
ONPE_API_BASE = f"{ONPE_BASE_URL}/presentacion-backend/resumen-general"

ONPE_TOTALES_URL = f"{ONPE_API_BASE}/totales"
ONPE_PARTICIPANTES_URL = f"{ONPE_API_BASE}/participantes"

ELECTIONS = {
    "presidential": {
        "id": 10,
        "label": "Fórmula Presidencial",
        "national_filter": "tipoFiltro=eleccion",
        "abroad_election_id": 14,
        "skip_national": False,
    },
    "senate_national": {
        "id": 15,
        "label": "Cámara de Senadores – DEU (Nacional)",
        "national_filter": "tipoFiltro=eleccion",
        "abroad_election_id": None,
        "skip_national": False,
    },
    "senate_regional": {
        "id": 13,
        "label": "Cámara de Senadores – DEM (Regional)",
        "national_filter": "tipoFiltro=eleccion",
        "abroad_election_id": None,
        "skip_national": True,   
    },
    "deputies": {
        "id": 14,
        "label": "Cámara de Diputados",
        "national_filter": "tipoFiltro=eleccion",
        "abroad_election_id": None,
        "skip_national": True,   
    },
    "parlamento_andino": {
        "id": 12,
        "label": "Parlamento Andino",
        "national_filter": "tipoFiltro=eleccion",
        "abroad_election_id": None,
        "skip_national": False,
    },
}

# ── Departments / Regions ────────────────
DEPARTMENTS = {
    1:  "AMAZONAS",
    2:  "ANCASH",
    3:  "APURIMAC",
    4:  "AREQUIPA",
    5:  "AYACUCHO",
    6:  "CAJAMARCA",
    7:  "CUSCO",
    8:  "HUANCAVELICA",
    9:  "HUANUCO",
    10: "ICA",
    11: "JUNIN",
    12: "LA LIBERTAD",
    13: "LAMBAYEQUE",
    14: "LIMA",
    15: "LORETO",
    16: "MADRE DE DIOS",
    17: "MOQUEGUA",
    18: "PASCO",
    19: "PIURA",
    20: "PUNO",
    21: "SAN MARTIN",
    22: "TACNA",
    23: "TUMBES",
    24: "CALLAO",
    25: "UCAYALI",
}

def dep_ubigeo(dep_id: int) -> str:
    """Return the 6-digit ubigeo for a department."""
    return f"{dep_id:02d}0000"

# ── Abroad (exterior) filter params ───────────────────────────────────────
ABROAD_FILTER = "tipoFiltro=distrito_electoral&idDistritoElectoral=15&idAmbitoGeografico=1"

# ── Geographic filter type strings ────────────────────────────────────────
GEO_FILTER = {
    "region":   "tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&idUbigeoDepartamento",
    "province": "tipoFiltro=ubigeo_nivel_02&idAmbitoGeografico=2&idUbigeoProvincia",
    "district": "tipoFiltro=ubigeo_nivel_03&idAmbitoGeografico=3&idUbigeoDistrito",
}

# ── Scheduler settings ─────────────────────────────────────────────────────
POLL_INTERVAL_SECONDS = 60      
POLL_JITTER_SECONDS = 15       
MIN_PCT_CHANGE_TO_SAVE = 0.0001

# ── Selenium settings ──────────────────────────────────────────────────────
SELENIUM_HEADLESS = True
SELENIUM_MAX_RETRIES = 5
SELENIUM_PAGE_LOAD_WAIT = 3          
