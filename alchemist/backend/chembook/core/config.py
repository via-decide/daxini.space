from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "output"
STATE_DB = OUTPUT_DIR / "chembook.sqlite3"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
