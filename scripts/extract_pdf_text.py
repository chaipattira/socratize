#!/usr/bin/env python3
"""Extract text from a PDF file using pypdf, output to stdout."""
import sys
from pypdf import PdfReader


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: extract_pdf_text.py <pdf_file>", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    try:
        reader = PdfReader(path)
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)
        sys.exit(1)

    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append(f"--- Page {i + 1} ---\n{text.strip()}")

    if not pages:
        print("(no text content found in PDF)", file=sys.stderr)
        sys.exit(1)

    print("\n\n".join(pages))


if __name__ == "__main__":
    main()
