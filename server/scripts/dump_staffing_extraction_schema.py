"""Write `prompts/schemas/staffing_extraction.output.schema.json` from Pydantic."""

from __future__ import annotations

from pathlib import Path

from app.schemas.staffing_extraction import dump_staffing_extraction_schema_json


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    out = repo_root / "prompts" / "schemas" / "staffing_extraction.output.schema.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dump_staffing_extraction_schema_json() + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(repo_root)}")


if __name__ == "__main__":
    main()
