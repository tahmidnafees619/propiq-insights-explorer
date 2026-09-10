"""Load the King County dataset into the application database.

Usage:
    python scripts/seed_db.py                 # seed if empty
    python scripts/seed_db.py --force         # wipe and reload
    python scripts/seed_db.py --limit 5000    # partial load, for a quick start

Reads data/raw/kc_house_data.csv, derives the columns the stats endpoints
aggregate over (`year_sold`, `month_sold`, `house_age`, `was_renovated`), and
inserts everything in batches.

Until this runs, the API serves the curated demo dataset instead, so the
dashboard works on a fresh clone either way.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import func, select

# Allow `python scripts/seed_db.py` from the backend root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal, create_tables, engine
from app.models.property import Property

BASE_DIR = Path(__file__).resolve().parents[1]
CSV_PATH = BASE_DIR / "data" / "raw" / "kc_house_data.csv"
BATCH_SIZE = 2_000

REQUIRED_COLUMNS = {
    "price", "bedrooms", "bathrooms", "sqft_living", "sqft_lot", "floors",
    "waterfront", "view", "condition", "grade", "sqft_above", "sqft_basement",
    "yr_built", "yr_renovated", "zipcode", "lat", "long",
    "sqft_living15", "sqft_lot15",
}


def load_csv(path: Path, limit: int | None = None) -> pd.DataFrame:
    """Read and clean the raw dataset."""
    if not path.exists():
        raise SystemExit(
            f"Dataset not found at {path}\n\n"
            "Download the King County House Sales dataset and save it as:\n"
            f"  {path}\n\n"
            "Until then the API serves its built-in demo dataset, so the "
            "dashboard still works."
        )

    df = pd.read_csv(path)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise SystemExit(f"CSV is missing required columns: {sorted(missing)}")

    before = len(df)
    df = df.dropna(subset=["price"])
    df = df[df["price"] > 0]
    df = df.drop_duplicates(subset=["id", "date"], keep="last")
    # Same known data-entry error the training script excludes.
    df = df[df["bedrooms"].between(1, 15)]

    print(f"Read {before:,} rows -> {len(df):,} after cleaning")

    if limit:
        df = df.head(limit)
        print(f"Limited to {len(df):,} rows")

    return df.reset_index(drop=True)


def to_records(df: pd.DataFrame) -> list[dict]:
    """Map CSV rows onto Property columns, deriving the sale-date fields."""
    sold = pd.to_datetime(df["date"], format="%Y%m%dT%H%M%S", errors="coerce")

    frame = pd.DataFrame({
        "price": df["price"].astype(float),
        "bedrooms": df["bedrooms"].astype(int),
        "bathrooms": df["bathrooms"].astype(float),
        "sqft_living": df["sqft_living"].astype(float),
        "sqft_lot": df["sqft_lot"].astype(float),
        "floors": df["floors"].astype(float),
        "waterfront": df["waterfront"].astype(int),
        "view": df["view"].astype(int),
        "condition": df["condition"].astype(int),
        "grade": df["grade"].astype(int),
        "sqft_above": df["sqft_above"].astype(float),
        "sqft_basement": df["sqft_basement"].astype(float),
        "yr_built": df["yr_built"].astype(int),
        "yr_renovated": df["yr_renovated"].fillna(0).astype(int),
        # Preserve leading zeros: a ZIP code is an identifier, not a number.
        "zipcode": df["zipcode"].astype(int).astype(str).str.zfill(5),
        "lat": df["lat"].astype(float),
        "long": df["long"].astype(float),
        "sqft_living15": df["sqft_living15"].astype(float),
        "sqft_lot15": df["sqft_lot15"].astype(float),
        "year_sold": sold.dt.year,
        "month_sold": sold.dt.month,
    })

    frame["house_age"] = (frame["year_sold"] - frame["yr_built"]).clip(lower=0)
    frame["was_renovated"] = (frame["yr_renovated"] > 0).astype(int)

    # A NaN sale date leaves these as floats; keep them nullable ints.
    for column in ("year_sold", "month_sold", "house_age"):
        frame[column] = frame[column].astype("Int64")

    return frame.to_dict(orient="records")


def seed(records: list[dict], force: bool) -> int:
    """Insert records in batches. Returns the number written."""
    create_tables()

    with SessionLocal() as session:
        existing = int(session.scalar(select(func.count(Property.id))) or 0)

        if existing and not force:
            print(
                f"Database already holds {existing:,} properties. "
                "Re-run with --force to replace them."
            )
            return 0

        if existing and force:
            print(f"Removing {existing:,} existing rows ...")
            session.query(Property).delete()
            session.commit()

        total = len(records)
        for start in range(0, total, BATCH_SIZE):
            batch = records[start:start + BATCH_SIZE]
            # Pandas returns pd.NA for nullable ints; SQLite needs None.
            session.bulk_insert_mappings(
                Property,
                [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in batch],
            )
            session.commit()
            print(f"  inserted {min(start + BATCH_SIZE, total):,} / {total:,}", end="\r")

        print()
        return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the PropIQ database.")
    parser.add_argument("--csv", type=Path, default=CSV_PATH, help="Path to kc_house_data.csv")
    parser.add_argument("--force", action="store_true", help="Replace existing rows")
    parser.add_argument("--limit", type=int, default=None, help="Only load the first N rows")
    args = parser.parse_args()

    print("PropIQ database seeding")
    print("-" * 60)
    print(f"Target: {engine.url}")

    df = load_csv(args.csv, args.limit)
    records = to_records(df)
    written = seed(records, args.force)

    print("-" * 60)
    if written:
        with SessionLocal() as session:
            count = int(session.scalar(select(func.count(Property.id))) or 0)
            avg = float(session.scalar(select(func.avg(Property.price))) or 0)
        print(f"Seeded {written:,} properties")
        print(f"Table now holds {count:,} rows, average price ${avg:,.0f}")
        print("The API will now serve live data instead of the demo dataset.")
    else:
        print("No changes made.")


if __name__ == "__main__":
    main()
