# AGENTS.md

## Cursor Cloud specific instructions

This repository is a **documents-and-data project**, not a software application. It
contains the deliverables for the LIKEPASS / Recruit (Hot Pepper Beauty) quotation
review project:

- Markdown analysis reports and quotation templates (`*.md`)
- Order/quotation data (`order_list.csv`, `order_list_utf8.csv`)
- Source quotation PDFs (`247｜...pdf`, `248｜...pdf`)

There is intentionally **no build, run, lint, or test step**, and **no dependency
manifest** (no `package.json`, `requirements.txt`, `pyproject.toml`, `Makefile`, etc.).
The `.gitignore` lists Node/Python patterns, but no code exists in the repo.

Practical notes for working here:

- Nothing needs to be installed; there is no dev server or service to start.
- The primary content is Japanese-language (UTF-8). Prefer `order_list_utf8.csv`
  when parsing programmatically. Both CSVs have 37 rows (1 header + 36) and 34 columns.
- To sanity-check the data assets, parse a CSV (e.g. `python3 -c "import csv; print(len(list(csv.reader(open('order_list_utf8.csv')))))"`)
  and confirm the PDFs start with the `%PDF-` magic bytes.
