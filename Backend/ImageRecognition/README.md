# ONPE Actas Downloader

Bulk downloader for ONPE electoral tally sheets (actas). Downloads all election types across Peru's full geographic hierarchy (department -> province -> district) and abroad voting locations, organized by election type subfolder.

## Requirements

- Python 3.11+
- Google Chrome
- ChromeDriver (matching Chrome version)

```bash
pip install selenium requests
```

## Usage

```bash
# Full download (Peru + Abroad)
python -m Backend.ImageRecognition.run_download --output-dir Backend/Actas_Data

# Peru only
python -m Backend.ImageRecognition.run_download --peru-only

# Abroad only
python -m Backend.ImageRecognition.run_download --abroad-only

# Show browser (useful for debugging)
python -m Backend.ImageRecognition.run_download --no-headless

# Verbose logging
python -m Backend.ImageRecognition.run_download --verbose
```

Resume is automatic: the scraper picks up where it left off using `Backend/Actas_Data/download_state.json`.

## Output structure

```
Backend/Actas_Data/
  download_state.json          # resume state
  download_log.csv             # per-file download log
  <YYYY-MM-DD_HHMM>/
    Peru/
      <DEPARTMENT>/
        <PROVINCE>/
          <DISTRICT>/
            PRESIDENCIAL/
              <mesa>_<type>.pdf
            SENADORES_DEU/
            SENADORES_DEM/
            DIPUTADOS/
            PARLAMENTO_ANDINO/
    Abroad/
      GLOBAL/
        <COUNTRY>/
          <CITY>/
            PRESIDENCIAL/
            ...
```

## Election types

| Folder | Election |
|--------|----------|
| `PRESIDENCIAL` | President (id 10) |
| `SENADORES_DEU` | Senate – Single Electoral District (id 15) |
| `SENADORES_DEM` | Senate – Multiple Electoral Districts (id 13) |
| `DIPUTADOS` | Deputies (id 14) |
| `PARLAMENTO_ANDINO` | Andean Parliament (id 12) |

## How it works

All ONPE API endpoints require a live browser session. The scraper:

1. Opens Chrome and navigates to the ONPE results page to establish a session
2. Uses `Promise.all` batch fetches (up to 80 concurrent) via `execute_async_script` to pull acta details
3. Downloads PDFs from S3 pre-signed URLs using 50 parallel threads (no ONPE cookies needed for S3)
4. Retries expired S3 URLs serially on the main browser thread

## Log file columns

`download_log.csv`: `timestamp`, `session`, `scope`, `level1`, `level2`, `level3`, `election`, `mesa`, `acta_type`, `file_id`, `local_path`, `filename`, `status`

Status values: `OK`, `SKIP` (already on disk), `NO_URL`, `ERROR`
