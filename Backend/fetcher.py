import json
import logging
import os
import time
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException

from config import (
    ELECTIONS,
    ONPE_MAIN_PAGE,
    ONPE_TOTALES_URL,
    ONPE_PARTICIPANTES_URL,
    ABROAD_FILTER,
    GEO_FILTER,
    SELENIUM_HEADLESS,
    SELENIUM_MAX_RETRIES,
    SELENIUM_PAGE_LOAD_WAIT,
)

logger = logging.getLogger(__name__)


# ── Selenium driver (module-level singleton) ───────────────────────────────

_driver: Optional[webdriver.Chrome] = None


def _build_driver() -> webdriver.Chrome:
    opts = Options()
    chrome_bin = os.environ.get("CHROME_BIN")
    if chrome_bin:
        opts.binary_location = chrome_bin
    if SELENIUM_HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    driver = webdriver.Chrome(options=opts)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
    )
    return driver


def get_driver() -> webdriver.Chrome:
    """Return the module-level Selenium driver, creating it if necessary."""
    global _driver
    if _driver is None:
        logger.info("Initialising Selenium WebDriver…")
        _driver = _build_driver()
        _warm_up(_driver)
    return _driver


def _warm_up(driver: webdriver.Chrome) -> None:
    """Navigate to the ONPE main page to obtain valid cookies/session."""
    logger.info("Warming up: loading ONPE main page…")
    driver.get(ONPE_MAIN_PAGE)
    time.sleep(SELENIUM_PAGE_LOAD_WAIT)
    logger.info("Warm-up complete.")


def close_driver() -> None:
    """Quit the Selenium driver gracefully."""
    global _driver
    if _driver is not None:
        # Suppress noisy urllib3 retry warnings during quit
        _urllib3_logger = logging.getLogger("urllib3.connectionpool")
        _prev_level = _urllib3_logger.level
        _urllib3_logger.setLevel(logging.ERROR)
        try:
            _driver.quit()
        except Exception:
            pass
        finally:
            _urllib3_logger.setLevel(_prev_level)
        _driver = None
        logger.info("Selenium WebDriver closed.")


# ── Low-level browser fetch ────────────────────────────────────────────────

_FETCH_SCRIPT = """
const url = arguments[0];
const callback = arguments[arguments.length - 1];
fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json, text/plain, */*" },
    credentials: "include"
})
.then(async res => {
    const text = await res.text();
    callback({ status: res.status, contentType: res.headers.get("content-type"), body: text });
})
.catch(err => callback({ error: String(err) }));
"""


def _browser_fetch(url: str, max_retries: int = SELENIUM_MAX_RETRIES) -> dict:
    """
    Execute a fetch() call from inside the browser context.
    Returns the parsed JSON body on success.
    Raises RuntimeError on permanent failure.
    """
    driver = get_driver()

    for attempt in range(1, max_retries + 1):
        try:
            result = driver.execute_async_script(_FETCH_SCRIPT, url)
        except WebDriverException as exc:
            logger.warning("WebDriver error on attempt %d/%d: %s", attempt, max_retries, exc)
            # Re-warm the session and retry
            try:
                _warm_up(driver)
            except Exception:
                pass
            time.sleep(2 ** attempt)
            continue

        if "error" in result:
            logger.warning("fetch() error attempt %d/%d: %s", attempt, max_retries, result["error"])
            time.sleep(2 ** attempt)
            continue

        status = result.get("status")
        if status != 200:
            if status == 204:
                raise RuntimeError(f"HTTP 204 (no national data) for {url}")
            logger.warning("HTTP %s attempt %d/%d for %s", status, attempt, max_retries, url)
            if attempt == 1:
                _warm_up(driver)
            else:
                time.sleep(2 ** attempt)
            continue

        content_type = result.get("contentType") or ""
        if "application/json" not in content_type:
            logger.warning(
                "Non-JSON content-type '%s' attempt %d/%d for %s",
                content_type, attempt, max_retries, url,
            )
            _warm_up(driver)
            time.sleep(2 ** attempt)
            continue

        try:
            return json.loads(result["body"])
        except json.JSONDecodeError as exc:
            logger.warning("JSON parse error attempt %d/%d: %s", attempt, max_retries, exc)
            time.sleep(2 ** attempt)

    raise RuntimeError(f"ONPE API failed after {max_retries} retries: {url}")


# ── URL builders ───────────────────────────────────────────────────────────

def _totales_url(election_id: int, extra_params: str) -> str:
    return f"{ONPE_TOTALES_URL}?idEleccion={election_id}&{extra_params}"


def _participantes_url(election_id: int, extra_params: str) -> str:
    return f"{ONPE_PARTICIPANTES_URL}?idEleccion={election_id}&{extra_params}"


# ── Public API ─────────────────────────────────────────────────────────────

def fetch_national_totales_only(election_key: str) -> dict:
    cfg = ELECTIONS[election_key]
    eid = cfg["id"]
    params = cfg["national_filter"]
    totales = _browser_fetch(_totales_url(eid, params))
    return totales.get("data", {})


def fetch_national(election_key: str) -> dict:
    """
    Fetch national totals + candidates for *election_key*.

    Returns:
        {
          "totales": {...},      # raw ONPE totales.data
          "participantes": [...] # raw ONPE participantes.data
        }
    """
    cfg = ELECTIONS[election_key]
    eid = cfg["id"]
    params = cfg["national_filter"]

    totales = _browser_fetch(_totales_url(eid, params))
    participantes = _browser_fetch(_participantes_url(eid, params))

    return {
        "totales": totales.get("data", {}),
        "participantes": participantes.get("data", []),
    }


def fetch_geographic(
    election_key: str,
    filter_type: str,
    ubigeo: str,
) -> dict:
    """
    Fetch totals + candidates filtered by geography.

    filter_type: "region" | "province" | "district"
    ubigeo:      6-digit INEI code, e.g. "140000" for Lima
    """
    cfg = ELECTIONS[election_key]
    eid = cfg["id"]

    if filter_type not in GEO_FILTER:
        raise ValueError(f"Invalid filter_type '{filter_type}'. Use: {list(GEO_FILTER)}")

    param_prefix = GEO_FILTER[filter_type]
    params = f"{param_prefix}={ubigeo}"

    totales = _browser_fetch(_totales_url(eid, params))
    participantes = _browser_fetch(_participantes_url(eid, params))

    return {
        "totales": totales.get("data", {}),
        "participantes": participantes.get("data", []),
    }


def fetch_abroad(election_key: str) -> dict:
    """
    Fetch totals + candidates for the exterior (extranjero) district.
    Falls back to the abroad_election_id if configured.
    """
    cfg = ELECTIONS[election_key]
    abroad_eid = cfg.get("abroad_election_id") or cfg["id"]

    totales = _browser_fetch(_totales_url(abroad_eid, ABROAD_FILTER))
    participantes = _browser_fetch(_participantes_url(abroad_eid, ABROAD_FILTER))

    return {
        "totales": totales.get("data", {}),
        "participantes": participantes.get("data", []),
    }
