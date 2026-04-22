import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Backend.ImageRecognition.acta_scraper import ActaScraper


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    fmt = "%(asctime)s [%(levelname)s] %(name)s — %(message)s"
    logging.basicConfig(
        level=level,
        format=fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("acta_download.log", encoding="utf-8"),
        ],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ONPE Electoral Actas Downloader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--output-dir",
        default="Backend/Actas_Data",
        help="Output directory for actas (default: Backend/Actas_Data)",
    )
    parser.add_argument(
        "--peru-only",
        action="store_true",
        help="Download only Peru actas (skip Abroad)",
    )
    parser.add_argument(
        "--abroad-only",
        action="store_true",
        help="Download only Abroad actas",
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Discovery mode: inspect the page and report without downloading",
    )
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="Show the browser window (useful for debugging)",
    )
    parser.add_argument(
        "--rate-limit",
        type=float,
        default=0.25,
        help="Minimum seconds between downloads (default: 0.25)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose logging (DEBUG level)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    setup_logging(args.verbose)

    logger = logging.getLogger("run_download")

    output_dir = Path(args.output_dir).resolve()
    logger.info("Output directory: %s", output_dir)
    logger.info("Headless: %s | Rate limit: %s s", not args.no_headless, args.rate_limit)

    scraper = ActaScraper(
        output_dir=output_dir,
        headless=not args.no_headless,
        rate_limit=args.rate_limit,
    )

    try:
        scraper.setup()

        if args.discover:
            scraper.discover_page()
            logger.info("Discovery complete. Check the log and Backend/data/actas/raw/page_source.html")
            return 0

        if args.abroad_only:
            scraper.run_abroad()
        elif args.peru_only:
            scraper.run_peru()
        else:
            scraper.run_peru()
            scraper.run_abroad()

        logger.info(
            "Download complete. Total: %d downloaded, %d errors, %d skipped.",
            scraper.state.total_downloaded,
            scraper.state.total_errors,
            scraper.state.total_skipped,
        )
        return 0

    except KeyboardInterrupt:
        logger.info("Interrupted by user. State saved for resume.")
        scraper._save_state()
        return 1
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
        scraper._save_state()
        return 2
    finally:
        scraper.cleanup()


if __name__ == "__main__":
    sys.exit(main())
