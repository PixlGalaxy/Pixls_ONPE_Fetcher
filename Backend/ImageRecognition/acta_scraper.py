import csv
import http.client
import json
import logging
import os
import re
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

logger = logging.getLogger(__name__)

# ── URLs ──────────────────────────────────────────────────────────────────────

BASE_URL   = "https://resultadoelectoral.onpe.gob.pe"
ACTAS_PAGE = f"{BASE_URL}/main/actas"
API_BASE   = f"{BASE_URL}/presentacion-backend"

AMB_PERU   = 1
AMB_ABROAD = 2

ACTAS_PAGE_SIZE = 500

ELECTION_FOLDERS: Dict[int, str] = {
    10: "PRESIDENCIAL",
    15: "SENADORES_DEU",
    13: "SENADORES_DEM",
    14: "DIPUTADOS",
    12: "PARLAMENTO_ANDINO",
}

# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class ArchivoRef:
    file_id:     str
    tipo:        int
    description: str
    s3_name:     str


@dataclass
class DownloadState:
    session_date:     str = ""
    completed_keys:   List[str] = field(default_factory=list)
    total_downloaded: int = 0
    total_skipped:    int = 0
    total_errors:     int = 0
    last_updated:     str = ""

    def is_done(self, key: str) -> bool:
        return key in self.completed_keys

    def mark_done(self, key: str) -> None:
        if key not in self.completed_keys:
            self.completed_keys.append(key)


# ── Main class ────────────────────────────────────────────────────────────────

class ActaScraper:
    def __init__(
        self,
        output_dir: Path,
        headless:    bool  = True,
        rate_limit:  float = 0.25,
        max_retries: int   = 3,
    ):
        self.output_dir  = Path(output_dir)
        self.headless    = headless
        self.rate_limit  = rate_limit
        self.max_retries = max_retries

        self.session_date = datetime.now().strftime("%Y-%m-%d_%H%M")

        self.driver:  Optional[webdriver.Chrome] = None
        self._session = requests.Session()
        self.state:   DownloadState = DownloadState(session_date=self.session_date)

        self._state_path = self.output_dir / "download_state.json"
        self._log_path   = self.output_dir / "download_log.csv"
        self._csv_handle = None
        self._csv_writer = None
        self._lock       = threading.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def setup(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._open_log()
        self._load_state()
        self._build_driver()
        self._warm_up()

    def cleanup(self) -> None:
        if self._csv_handle:
            self._csv_handle.close()
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None

    # ── Selenium driver ───────────────────────────────────────────────────────

    def _build_driver(self) -> None:
        opts = Options()
        chrome_bin = os.environ.get("CHROME_BIN")
        if chrome_bin:
            opts.binary_location = chrome_bin
        if self.headless:
            opts.add_argument("--headless=new")
        opts.add_argument("--window-size=1920,1080")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        self.driver = webdriver.Chrome(options=opts)
        self.driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
        )
        self.driver.set_script_timeout(120)
        logger.info("WebDriver ready.")

    def _warm_up(self) -> None:
        logger.info("Opening ONPE session: %s", ACTAS_PAGE)
        self.driver.get(ACTAS_PAGE)
        time.sleep(4)
        self._sync_session_cookies()
        logger.info("Session ready (date: %s).", self.session_date)

    def _sync_session_cookies(self) -> None:
        self._session.cookies.clear()
        for c in self.driver.get_cookies():
            self._session.cookies.set(c["name"], c["value"])

    # ── State and log ─────────────────────────────────────────────────────────

    def _load_state(self) -> None:
        if not self._state_path.exists():
            return
        with open(self._state_path, encoding="utf-8") as f:
            data = json.load(f)
        self.state = DownloadState(**data)
        if self.state.session_date:
            self.session_date = self.state.session_date
        logger.info(
            "State loaded: %d locations completed, %d files (session %s).",
            len(self.state.completed_keys),
            self.state.total_downloaded,
            self.session_date,
        )

    def _save_state(self) -> None:
        self.state.last_updated = datetime.now().isoformat()
        with open(self._state_path, "w", encoding="utf-8") as f:
            json.dump(asdict(self.state), f, indent=2, ensure_ascii=False)

    def _open_log(self) -> None:
        exists = self._log_path.exists()
        self._csv_handle = open(self._log_path, "a", newline="", encoding="utf-8")
        self._csv_writer = csv.writer(self._csv_handle)
        if not exists:
            self._csv_writer.writerow([
                "timestamp", "session", "scope", "level1", "level2", "level3",
                "election", "mesa", "acta_type", "file_id",
                "local_path", "filename", "status",
            ])

    def _log_dl(
        self,
        scope: str, n1: str, n2: str, n3: str,
        election: str, mesa: str, acta_type: str, file_id: str,
        local_path: str, filename: str, status: str,
    ) -> None:
        with self._lock:
            self._csv_writer.writerow([
                datetime.now().isoformat(), self.session_date,
                scope, n1, n2, n3, election, mesa, acta_type, file_id,
                local_path, filename, status,
            ])
            self._csv_handle.flush()

    # ── API: browser-based fetch ──────────────────────────────────────────────

    def _api_get(self, url: str) -> Optional[dict | list]:
        for attempt in range(1, self.max_retries + 1):
            try:
                result = self.driver.execute_async_script("""
                    const [url, done] = arguments;
                    fetch(url, {credentials: 'include'})
                        .then(r => r.text())
                        .then(t => done({ok: true, body: t}))
                        .catch(e => done({ok: false, error: String(e)}));
                """, url)
                if not result:
                    raise ValueError("No response from script")
                if not result.get("ok"):
                    raise ValueError(result.get("error", "fetch error"))
                return json.loads(result["body"])
            except json.JSONDecodeError as e:
                logger.warning("JSON error (%d/%d) %s: %s", attempt, self.max_retries, url, e)
            except Exception as e:
                logger.warning("Fetch error (%d/%d) %s: %s", attempt, self.max_retries, url, e)
            time.sleep(2 ** attempt)
        logger.error("Permanent failure: %s", url)
        return None

    BATCH_CHUNK = 80

    def _api_batch_get(self, urls: List[str]) -> List[Optional[dict]]:
        if not urls:
            return []

        results: List[Optional[dict]] = [None] * len(urls)

        for start in range(0, len(urls), self.BATCH_CHUNK):
            chunk = urls[start : start + self.BATCH_CHUNK]
            for attempt in range(1, self.max_retries + 1):
                try:
                    raw = self.driver.execute_async_script("""
                        const [urls, done] = arguments;
                        Promise.all(
                            urls.map(url =>
                                fetch(url, {credentials: 'include'})
                                    .then(r => r.text())
                                    .catch(() => null)
                            )
                        ).then(texts => done(texts));
                    """, chunk)
                    if raw is None:
                        raise ValueError("Promise.all did not respond")
                    for i, text in enumerate(raw):
                        if text:
                            try:
                                results[start + i] = json.loads(text)
                            except json.JSONDecodeError:
                                results[start + i] = None
                    break
                except Exception as e:
                    logger.warning("Batch error chunk[%d:%d] attempt %d: %s",
                                   start, start + len(chunk), attempt, e)
                    time.sleep(2 ** attempt)

        return results

    def _extract_data(self, resp) -> Optional[dict | list]:
        if resp is None:
            return None
        if isinstance(resp, list):
            return resp
        if isinstance(resp, dict):
            if "data" in resp:
                return resp["data"]
            return resp
        return None

    def _extract_list(self, resp) -> List[dict]:
        d = self._extract_data(resp)
        if isinstance(d, list):
            return d
        if isinstance(d, dict):
            for key in ("content", "items", "actas", "result", "resultados"):
                if isinstance(d.get(key), list):
                    return d[key]
        return []

    # ── Geography: Peru ───────────────────────────────────────────────────────

    def get_departments(self) -> List[Dict]:
        elec_id = next(iter(ELECTION_FOLDERS))
        url = f"{API_BASE}/ubigeos/departamentos?idEleccion={elec_id}&idAmbitoGeografico={AMB_PERU}"
        resp = self._api_get(url)
        items = self._extract_list(resp)
        logger.debug("Departments: %d", len(items))
        return items

    def get_provinces(self, dep_ubigeo: str) -> List[Dict]:
        elec_id = next(iter(ELECTION_FOLDERS))
        url = (
            f"{API_BASE}/ubigeos/provincias"
            f"?idEleccion={elec_id}"
            f"&idAmbitoGeografico={AMB_PERU}"
            f"&idUbigeoDepartamento={dep_ubigeo}"
        )
        resp = self._api_get(url)
        return self._extract_list(resp)

    def get_districts(self, prov_ubigeo: str) -> List[Dict]:
        elec_id = next(iter(ELECTION_FOLDERS))
        url = (
            f"{API_BASE}/ubigeos/distritos"
            f"?idEleccion={elec_id}"
            f"&idAmbitoGeografico={AMB_PERU}"
            f"&idUbigeoProvincia={prov_ubigeo}"
        )
        resp = self._api_get(url)
        return self._extract_list(resp)

    # ── Geography: Abroad ─────────────────────────────────────────────────────

    def get_abroad_countries(self) -> List[Dict]:
        elec_id = next(iter(ELECTION_FOLDERS))
        url = (
            f"{API_BASE}/ubigeos/paises"
            f"?idEleccion={elec_id}"
            f"&idAmbitoGeografico={AMB_ABROAD}"
        )
        resp = self._api_get(url)
        items = self._extract_list(resp)
        if items:
            return items

        url2 = (
            f"{API_BASE}/ubigeos/continentes"
            f"?idEleccion={elec_id}"
            f"&idAmbitoGeografico={AMB_ABROAD}"
        )
        resp2 = self._api_get(url2)
        return self._extract_list(resp2)

    def get_abroad_cities(self, country_ubigeo: str) -> List[Dict]:
        elec_id = next(iter(ELECTION_FOLDERS))
        url = (
            f"{API_BASE}/ubigeos/ciudades"
            f"?idEleccion={elec_id}"
            f"&idAmbitoGeografico={AMB_ABROAD}"
            f"&idUbigeoReferencia={country_ubigeo}"
        )
        resp = self._api_get(url)
        return self._extract_list(resp)

    # ── Actas: listing and detail ─────────────────────────────────────────────

    @staticmethod
    def _ubigeo_to_int(ubigeo: str) -> int:
        return int(ubigeo)

    def get_acta_ids_by_election(self, ubigeo: str, amb: int = AMB_PERU) -> Dict[int, List[int]]:
        ubigeo_int = self._ubigeo_to_int(ubigeo)
        result: Dict[int, List[int]] = {}
        pagina = 0

        while True:
            url = (
                f"{API_BASE}/actas"
                f"?pagina={pagina}&tamanio={ACTAS_PAGE_SIZE}"
                f"&idAmbitoGeografico={amb}"
                f"&idUbigeo={ubigeo_int}"
            )
            resp = self._api_get(url)
            if resp is None:
                break

            data = self._extract_data(resp)
            content = []
            total_paginas = 1

            if isinstance(data, dict):
                content = data.get("content", [])
                total_paginas = data.get("totalPaginas", 1)
            elif isinstance(data, list):
                content = data

            for item in content:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                id_elec = item.get("idEleccion", 0)
                if id_elec in ELECTION_FOLDERS:
                    result.setdefault(id_elec, []).append(item["id"])

            pagina += 1
            if pagina >= total_paginas:
                break

        total = sum(len(v) for v in result.values())
        logger.debug("Actas ubigeo=%s: %d total (%s)", ubigeo, total,
                     {ELECTION_FOLDERS[k]: len(v) for k, v in result.items()})
        return result

    def get_acta_archivos(self, acta_id: int) -> Tuple[str, List[ArchivoRef]]:
        url = f"{API_BASE}/actas/{acta_id}"
        resp = self._api_get(url)
        if resp is None:
            return "", []

        detail = self._extract_data(resp)
        if not isinstance(detail, dict):
            return "", []

        codigo_mesa = detail.get("codigoMesa") or detail.get("descripcionMesa") or str(acta_id)
        archivos_raw = detail.get("archivos") or []

        archivos = []
        for a in archivos_raw:
            if not isinstance(a, dict) or not a.get("id"):
                continue
            archivos.append(ArchivoRef(
                file_id=a["id"],
                tipo=a.get("tipo", 0),
                description=a.get("descripcion", "UNKNOWN"),
                s3_name=a.get("nombre", ""),
            ))
        return codigo_mesa, archivos

    def get_s3_url(self, file_id: str) -> Optional[str]:
        url = f"{API_BASE}/actas/file?id={file_id}"
        resp = self._api_get(url)
        if resp is None:
            return None
        if isinstance(resp, dict):
            s3 = resp.get("data") or resp.get("url") or resp.get("link")
            return str(s3) if s3 else None
        return None

    # ── Download ──────────────────────────────────────────────────────────────

    def download_from_s3(self, s3_url: str, dest_path: Path) -> bool:
        parsed = urllib.parse.urlparse(s3_url)
        path_qs = parsed.path + ("?" + parsed.query if parsed.query else "")
        req_headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Host": parsed.netloc,
        }
        for attempt in range(1, self.max_retries + 1):
            conn = None
            try:
                conn = http.client.HTTPSConnection(parsed.netloc, timeout=60)
                conn.request("GET", path_qs, headers=req_headers)
                resp = conn.getresponse()
                if resp.status == 200:
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(dest_path, "wb") as f:
                        while chunk := resp.read(16384):
                            f.write(chunk)
                    return True
                if resp.status == 403:
                    body = resp.read(200).decode("utf-8", errors="replace").replace("\n", " ")
                    logger.warning("S3 403 — %s", body[:120])
                    return False
                logger.warning("S3 HTTP %d attempt %d/%d", resp.status, attempt, self.max_retries)
            except Exception as e:
                logger.warning("S3 error attempt %d: %s", attempt, e)
            finally:
                if conn:
                    conn.close()
            time.sleep(2 ** attempt)
        return False

    def _download_via_browser(self, s3_url: str, dest_path: Path) -> bool:
        try:
            result = self.driver.execute_async_script("""
                const [url, done] = arguments;
                fetch(url, {mode: 'cors'})
                    .then(r => {
                        if (!r.ok) { done({ok: false, status: r.status}); return; }
                        return r.arrayBuffer();
                    })
                    .then(buf => {
                        if (!buf) return;
                        const bytes = Array.from(new Uint8Array(buf));
                        done({ok: true, bytes: bytes});
                    })
                    .catch(e => done({ok: false, error: String(e)}));
            """, s3_url)
            if not result or not result.get("ok"):
                logger.warning("Browser download failed: %s", result)
                return False
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_path, "wb") as f:
                f.write(bytes(result["bytes"]))
            return True
        except Exception as exc:
            logger.warning("Browser download error: %s", exc)
            return False

    # ── Location pipeline ─────────────────────────────────────────────────────

    DOWNLOAD_WORKERS = 50

    def process_location(
        self,
        scope: str,
        n1: str, n2: str, n3: str,
        ubigeo: str,
        dest_base: Path,
        amb: int = AMB_PERU,
    ) -> int:
        key = f"{scope}/{n1}/{n2}/{n3}"
        if self.state.is_done(key):
            self.state.total_skipped += 1
            return 0

        actas_by_election = self.get_acta_ids_by_election(ubigeo, amb)
        total_actas = sum(len(v) for v in actas_by_election.values())
        summary = "  ".join(
            f"{ELECTION_FOLDERS[k]}:{len(v)}"
            for k, v in sorted(actas_by_election.items())
        )
        logger.info("  %d actas [%s] — %s", total_actas, summary, key)

        flat_ids: List[Tuple[int, int]] = [
            (acta_id, id_elec)
            for id_elec, acta_ids in actas_by_election.items()
            for acta_id in acta_ids
        ]
        detail_urls = [f"{API_BASE}/actas/{acta_id}" for acta_id, _ in flat_ids]
        detail_resps = self._api_batch_get(detail_urls)

        pending_files = []
        for (acta_id, id_eleccion), resp in zip(flat_ids, detail_resps):
            if resp is None:
                continue
            detail = self._extract_data(resp)
            if not isinstance(detail, dict):
                continue
            codigo_mesa  = detail.get("codigoMesa") or detail.get("descripcionMesa") or str(acta_id)
            archivos_raw = detail.get("archivos") or []
            elec_folder  = ELECTION_FOLDERS[id_eleccion]
            dest_elec    = dest_base / elec_folder

            for a in archivos_raw:
                if not isinstance(a, dict) or not a.get("id"):
                    continue
                arch = ArchivoRef(
                    file_id=a["id"], tipo=a.get("tipo", 0),
                    description=a.get("descripcion", "UNKNOWN"),
                    s3_name=a.get("nombre", ""),
                )
                filename  = self._build_filename(codigo_mesa, arch)
                dest_path = dest_elec / filename
                json_path = dest_path.with_suffix(".json")
                if not json_path.exists():
                    self._save_acta_json(
                        json_path, detail, id_eleccion, elec_folder,
                        codigo_mesa, arch, scope, n1, n2, n3,
                    )
                pending_files.append((id_eleccion, elec_folder, codigo_mesa, arch, dest_path, filename))

        need_url: List[int] = []
        tasks: List[Tuple] = []

        for idx, (id_elec, elec_folder, mesa, arch, dest_path, filename) in enumerate(pending_files):
            if dest_path.exists():
                self._log_dl(scope, n1, n2, n3, elec_folder, mesa,
                             arch.description, arch.file_id, str(dest_path), filename, "SKIP")
            else:
                need_url.append(idx)

        s3_urls_raw = self._api_batch_get(
            [f"{API_BASE}/actas/file?id={pending_files[i][3].file_id}" for i in need_url]
        )

        for idx, resp in zip(need_url, s3_urls_raw):
            _, elec_folder, mesa, arch, dest_path, filename = pending_files[idx]
            s3_url = None
            if isinstance(resp, dict):
                s3_url = resp.get("data") or resp.get("url") or resp.get("link")
                s3_url = str(s3_url) if s3_url else None
            if not s3_url:
                self._log_dl(scope, n1, n2, n3, elec_folder, mesa,
                             arch.description, arch.file_id, "", filename, "NO_URL")
                with self._lock:
                    self.state.total_errors += 1
                continue
            tasks.append((s3_url, dest_path, elec_folder, mesa,
                          arch.description, arch.file_id, filename))

        if not tasks:
            self.state.mark_done(key)
            self._save_state()
            return 0

        def _do_download(task):
            s3_url, dest_path = task[0], task[1]
            ok = self.download_from_s3(s3_url, dest_path)
            return ok, task

        downloaded  = 0
        retry_tasks = []

        with ThreadPoolExecutor(max_workers=self.DOWNLOAD_WORKERS) as pool:
            futures = {pool.submit(_do_download, t): t for t in tasks}
            for future in as_completed(futures):
                ok, task = future.result()
                _, dest_path, elec_folder, mesa, description, file_id, filename = task
                if ok:
                    self._log_dl(scope, n1, n2, n3, elec_folder, mesa,
                                 description, file_id, str(dest_path), filename, "OK")
                    with self._lock:
                        downloaded += 1
                        self.state.total_downloaded += 1
                else:
                    retry_tasks.append(task)

        for task in retry_tasks:
            _, dest_path, elec_folder, mesa, description, file_id, filename = task
            s3_url2 = self.get_s3_url(file_id)
            ok = False
            if s3_url2:
                ok = self.download_from_s3(s3_url2, dest_path)
                if not ok:
                    ok = self._download_via_browser(s3_url2, dest_path)
            status = "OK" if ok else "ERROR"
            self._log_dl(scope, n1, n2, n3, elec_folder, mesa,
                         description, file_id, str(dest_path), filename, status)
            if ok:
                downloaded += 1
                self.state.total_downloaded += 1
            else:
                self.state.total_errors += 1

        self.state.mark_done(key)
        self._save_state()
        return downloaded

    def _build_filename(self, codigo_mesa: str, arch: ArchivoRef) -> str:
        mesa = self._safe_name(codigo_mesa)
        tipo = self._safe_name(arch.description)
        return f"{mesa}_{tipo}.pdf"

    # ── Geographic enumeration ────────────────────────────────────────────────

    def enumerate_peru_districts(self) -> List[Tuple[str, str, str, str, str, str]]:
        result = []
        departments = self.get_departments()
        for dep in departments:
            dep_ubi, dep_name = dep["ubigeo"], dep["nombre"]
            for prov in self.get_provinces(dep_ubi):
                prov_ubi, prov_name = prov["ubigeo"], prov["nombre"]
                for dist in self.get_districts(prov_ubi):
                    result.append((dep_name, dep_ubi, prov_name, prov_ubi,
                                   dist["nombre"], dist["ubigeo"]))
        return result

    # ── Main loop: Peru ───────────────────────────────────────────────────────

    def run_peru(self) -> None:
        logger.info("=== Starting Peru download (session %s) ===", self.session_date)

        logger.info("Enumerating Peru geography...")
        districts = self.enumerate_peru_districts()
        if not districts:
            logger.error("No districts found. Aborting Peru.")
            return

        total = len(districts)
        already_done = sum(
            1 for (dn, _, pn, _, dist_n, _) in districts
            if self.state.is_done(f"Peru/{dn}/{pn}/{dist_n}")
        )
        pending = total - already_done

        logger.info(
            "Total districts: %d  |  Already done: %d  |  Pending: %d",
            total, already_done, pending,
        )

        start_ts   = time.monotonic()
        done_count = 0

        for dep_name, _, prov_name, _, dist_name, dist_ubi in districts:
            key = f"Peru/{dep_name}/{prov_name}/{dist_name}"
            if self.state.is_done(key):
                continue

            logger.info(
                "[%d/%d] %s > %s > %s",
                already_done + done_count + 1, total,
                dep_name, prov_name, dist_name,
            )

            dist_start = time.monotonic()
            dest = self._session_base("Peru", dep_name, prov_name, dist_name)
            n = self.process_location("Peru", dep_name, prov_name, dist_name, dist_ubi, dest)

            done_count += 1
            elapsed   = time.monotonic() - start_ts
            avg_secs  = elapsed / done_count
            remaining = pending - done_count
            eta_secs  = int(avg_secs * remaining)
            eta_str   = str(timedelta(seconds=eta_secs))
            dist_secs = time.monotonic() - dist_start

            logger.info(
                "    -> %d files in %.1fs  |  %d/%d pending  |  ETA: %s  |  Total downloaded: %d",
                n, dist_secs, remaining, pending, eta_str, self.state.total_downloaded,
            )

        logger.info("=== Peru complete. Total: %d ===", self.state.total_downloaded)

    # ── Main loop: Abroad ─────────────────────────────────────────────────────

    def run_abroad(self) -> None:
        logger.info("=== Starting Abroad download (session %s) ===", self.session_date)

        countries = self.get_abroad_countries()
        if not countries:
            logger.warning("No countries/continents found for Abroad.")
            return

        logger.info("%d countries/continents.", len(countries))

        for country in countries:
            ctry_ubi  = country.get("ubigeo", "")
            ctry_name = country.get("nombre", "UNKNOWN")
            logger.info("  > %s (%s)", ctry_name, ctry_ubi)

            cities = self.get_abroad_cities(ctry_ubi)
            if not cities:
                if ctry_ubi:
                    dest = self._session_base("Abroad", "GLOBAL", ctry_name, "GENERAL")
                    n = self.process_location(
                        "Abroad", "GLOBAL", ctry_name, "GENERAL", ctry_ubi, dest,
                        amb=AMB_ABROAD,
                    )
                    logger.info("    %d files.", n)
                continue

            for city in cities:
                city_ubi  = city.get("ubigeo", "")
                city_name = city.get("nombre", "UNKNOWN")
                logger.info("    > %s (%s)", city_name, city_ubi)

                dest = self._session_base("Abroad", "GLOBAL", ctry_name, city_name)
                n = self.process_location(
                    "Abroad", "GLOBAL", ctry_name, city_name, city_ubi, dest,
                    amb=AMB_ABROAD,
                )
                logger.info("    [OK] %d files.", n)

        logger.info("=== Abroad complete. Total: %d ===", self.state.total_downloaded)

    # ── Discovery mode ────────────────────────────────────────────────────────

    def discover_page(self) -> None:
        logger.info("--- DISCOVERY MODE ---")

        elec_id = next(iter(ELECTION_FOLDERS))
        for label, url in [
            ("departments",   f"{API_BASE}/ubigeos/departamentos?idEleccion={elec_id}&idAmbitoGeografico={AMB_PERU}"),
            ("abroad/paises", f"{API_BASE}/ubigeos/paises?idEleccion={elec_id}&idAmbitoGeografico={AMB_ABROAD}"),
            ("abroad/contin", f"{API_BASE}/ubigeos/continentes?idEleccion={elec_id}&idAmbitoGeografico={AMB_ABROAD}"),
        ]:
            r = self._api_get(url)
            items = self._extract_list(r)
            logger.info("%-20s: %d items  (%s)", label, len(items), url)
            if items:
                logger.info("  Sample: %s", json.dumps(items[:2], ensure_ascii=False))

        html_path = self.output_dir / "page_source.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(self.driver.page_source)
        logger.info("HTML saved: %s", html_path)
        logger.info("--- End discovery ---")

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _save_acta_json(
        self,
        json_path: Path,
        detail: dict,
        id_eleccion: int,
        elec_folder: str,
        codigo_mesa: str,
        arch: ArchivoRef,
        scope: str,
        n1: str,
        n2: str,
        n3: str,
    ) -> None:
        _SPECIAL = {"80", "81", "82"}  # blank, null, impugned

        parties = []
        special = {}
        for p in detail.get("detalle") or detail.get("participantes") or detail.get("candidatos") or []:
            if not isinstance(p, dict):
                continue
            codigo = str(p.get("ccodigo", ""))
            entry = {
                "party":    p.get("descripcion") or p.get("nombre"),
                "party_id": p.get("nagrupacionPolitica") or p.get("id"),
                "code":     codigo,
                "position": p.get("nposicion"),
                "votes":    p.get("nvotos") if p.get("nvotos") is not None else p.get("votos"),
            }
            if codigo in _SPECIAL:
                special[p.get("descripcion", codigo)] = entry["votes"]
            else:
                parties.append(entry)

        totals = {
            "registered_voters": detail.get("totalElectoresHabiles"),
            "votes_cast":        detail.get("totalAsistentes") or detail.get("totalVotosEmitidos"),
            "valid_votes":       detail.get("totalVotosValidos"),
            "blank_votes":       special.get("VOTOS EN BLANCO"),
            "null_votes":        special.get("VOTOS NULOS"),
            "challenged_votes":  special.get("VOTOS IMPUGNADOS"),
            "participation_pct": detail.get("porcentajeParticipacionCiudadana"),
        }

        payload = {
            "meta": {
                "election":        elec_folder,
                "election_id":     id_eleccion,
                "scope":           f"{scope}/{n1}/{n2}/{n3}",
                "department":      n1,
                "province":        n2,
                "district":        n3,
                "mesa_code":       codigo_mesa,
                "acta_type":       arch.description,
                "acta_status":     detail.get("descripcionEstadoActa"),
                "acta_status_code":detail.get("codigoEstadoActa"),
                "counting_status": detail.get("estadoComputo"),
                "voting_center":   detail.get("nombreLocalVotacion"),
                "file_id":         arch.file_id,
                "saved_at":        datetime.now().isoformat(),
            },
            "parties": parties,
            "totals":  totals,
            "raw":     detail,
        }
        try:
            json_path.parent.mkdir(parents=True, exist_ok=True)
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
        except Exception as exc:
            logger.warning("Could not save acta JSON %s: %s", json_path, exc)

    def _session_base(self, *parts: str) -> Path:
        p = self.output_dir / self.session_date
        for part in parts:
            p = p / self._safe_name(part)
        return p

    @staticmethod
    def _safe_name(name: str) -> str:
        name = (name or "UNKNOWN").strip()
        name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
        name = re.sub(r"\s+", "_", name)
        return name.upper() or "UNKNOWN"
