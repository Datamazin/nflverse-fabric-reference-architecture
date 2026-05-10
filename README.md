# NFL Fabric Acquisition

Python package for fetching full-league nflverse data with `nflreadpy` and writing
source-preserving raw Parquet files for Microsoft Fabric Lakehouse ingestion.

```bash
python acquire_nflverse.py \
  --start-season 1999 \
  --end-season 2025 \
  --out ./nflverse_local \
  --cache ./nflverse_local/cache/nflreadpy \
  --force
```

The implementation follows the local acquisition milestone in
`docs/nfl_fabric_nflreadpy_codex_plan.md`, with the acquisition window extended
to the available `nflreadpy` play-by-play range, 1999 through the 2025 NFL
season.
