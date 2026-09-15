#!/usr/bin/env python3
"""
Kindleのスクリーンショット(縦書き)をtesseract(jpn_vertモデル)でOCRし、
data/<本のタイトル>/本文.md にページ区切り付きでまとめるスクリプト。

使い方:
    python3 ocr_book.py <本のタイトル>
"""
import re
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

# Kindle UI由来のノイズ行(タイトルバー、進捗表示など)を除去するパターン
NOISE_PATTERNS = [
    re.compile(r"^Kindle$"),
    re.compile(r"^\d+\s*%$"),
    re.compile(r"読書の速さを測定中"),
    re.compile(r"章を読み終えるまで"),
    re.compile(r"^\d+\s*ページ中の\d+\s*ページ目"),
    re.compile(r"に戻る$"),
]


def clean_text(raw: str, book_title: str) -> str:
    lines = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if any(p.search(line) for p in NOISE_PATTERNS):
            continue
        # 本のタイトルだけの行(毎ページのヘッダー)は除去
        if line.replace(" ", "").replace("　", "") == book_title:
            continue
        # 日本語の文字間に入る余計な半角/全角スペースを除去
        line = line.replace(" ", "").replace("　", "")
        lines.append(line)
    return "\n".join(lines)


def ocr_page(image_path: Path) -> str:
    result = subprocess.run(
        ["tesseract", str(image_path), "-", "-l", "jpn_vert", "--psm", "5"],
        capture_output=True,
        text=True,
    )
    return result.stdout


def main() -> None:
    if len(sys.argv) < 2:
        print("使い方: python3 ocr_book.py <本のタイトル>")
        sys.exit(1)
    book_title = sys.argv[1]

    screenshots_dir = BASE_DIR / "data" / book_title / "screenshots"
    if not screenshots_dir.exists():
        print(f"見つかりません: {screenshots_dir}")
        sys.exit(1)

    out_dir = BASE_DIR / "data" / book_title
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "本文.md"

    files = sorted(screenshots_dir.glob("*.png"))
    print(f"{len(files)}枚をOCRします...")

    with open(out_path, "w", encoding="utf-8") as out:
        out.write(f"# {book_title}\n\n")
        for i, f in enumerate(files, 1):
            raw = ocr_page(f)
            cleaned = clean_text(raw, book_title)
            out.write(f"## {f.stem}\n\n{cleaned}\n\n")
            if i % 20 == 0 or i == len(files):
                print(f"  {i}/{len(files)} 完了")

    print(f"完了: {out_path}")


if __name__ == "__main__":
    main()
