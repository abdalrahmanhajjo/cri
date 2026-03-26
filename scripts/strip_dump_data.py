"""Strip pg_dump data sections to produce schema-only SQL."""
import re
import sys

def main():
    inp = sys.argv[1] if len(sys.argv) > 1 else "dump.sql"
    out = sys.argv[2] if len(sys.argv) > 2 else "schema_only.sql"

    with open(inp, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    result = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        s = line.strip()

        if s.startswith("\\restrict") or s.startswith("\\unrestrict"):
            i += 1
            continue

        if s.startswith("-- Data for Name:"):
            i += 1
            while i < n:
                if lines[i].strip() == "\\.":
                    i += 1
                    break
                i += 1
            continue

        if "pg_catalog.setval(" in line and s.startswith("SELECT"):
            i += 1
            continue

        result.append(line)
        i += 1

    header = (
        "--\n"
        "-- Tripoli Explorer: PostgreSQL schema only (no data)\n"
        "-- COPY blocks, sequence setval, and \\restrict lines removed.\n"
        "--\n\n"
    )

    body = "".join(result)
    body = re.sub(
        r"^--\s*\n-- PostgreSQL database dump\s*\n--\s*\n",
        "",
        body,
        count=1,
    )

    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.write(body)

    print(f"Wrote {out} ({len(result)} lines kept from {n})")

if __name__ == "__main__":
    main()
