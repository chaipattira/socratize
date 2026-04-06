#!/usr/bin/env python3
"""Extract text from a .pptx file using markitdown, output to stdout."""
import sys
from markitdown import MarkItDown


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: extract_pptx_text.py <pptx_file>", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    try:
        md = MarkItDown()
        result = md.convert(path)
        text = result.text_content.strip()
    except Exception as e:
        print(f"Error reading pptx: {e}", file=sys.stderr)
        sys.exit(1)

    if not text:
        print("(no text content found in presentation)", file=sys.stderr)
        sys.exit(1)

    print(text)


if __name__ == "__main__":
    main()
