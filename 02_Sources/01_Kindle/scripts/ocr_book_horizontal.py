#!/usr/bin/env python3
"""
横書きのKindleスクリーンショットをmacOS Vision(横書き対応)でOCRし、
data/<本のタイトル>/本文.md にページ区切り付きでまとめるスクリプト。
縦書き本には ocr_book.py (tesseract jpn_vert) を使うこと。

使い方:
    python3 ocr_book_horizontal.py <本のタイトル>
"""
import sys
from pathlib import Path

import Vision
import Quartz
from Foundation import NSURL

BASE_DIR = Path(__file__).parent.parent


def ocr_page(image_path: Path) -> str:
    url = NSURL.fileURLWithPath_(str(image_path))
    img_source = Quartz.CGImageSourceCreateWithURL(url, None)
    cg_image = Quartz.CGImageSourceCreateImageAtIndex(img_source, 0, None)

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["ja-JP", "en-US"])
    request.setUsesLanguageCorrection_(True)
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    handler.performRequests_error_([request], None)
    results = request.results()
    if not results:
        return ""
    lines = []
    for r in results:
        candidate = r.topCandidates_(1)[0]
        lines.append(candidate.string())
    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) < 2:
        print("使い方: python3 ocr_book_horizontal.py <本のタイトル>")
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
            text = ocr_page(f)
            out.write(f"## {f.stem}\n\n{text}\n\n")
            if i % 20 == 0 or i == len(files):
                print(f"  {i}/{len(files)} 完了")

    print(f"完了: {out_path}")


if __name__ == "__main__":
    main()
