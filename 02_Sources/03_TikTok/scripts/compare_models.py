#!/usr/bin/env python3
"""large-v3-turbo と medium で同じ動画3本を文字起こしし、
速度と内容の差を比較するための使い捨てテストスクリプト。
本番のdata/フォルダには一切書き込まない(/tmp配下で完結)。
"""
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import transcribe

URLS = [
    "https://www.tiktok.com/@eigyou.inui/video/7627056286793747733",
    "https://www.tiktok.com/@eigyou.inui/video/7626963238902697237",
    "https://www.tiktok.com/@eigyou.inui/video/7621747639519841557",
]
MODELS = {
    "turbo": "mlx-community/whisper-large-v3-turbo",
    "medium": "mlx-community/whisper-medium-mlx",
}

TMP_DIR = Path("/tmp/whisper_compare")
TMP_DIR.mkdir(exist_ok=True)


def download(url: str) -> Path:
    subprocess.run(
        [
            "yt-dlp", "-f", "bestaudio/best", "-x", "--audio-format", "wav",
            "-o", str(TMP_DIR / "%(id)s.%(ext)s"), "--no-playlist", url,
        ],
        check=True,
    )
    video_id = url.rstrip("/").split("/")[-1]
    return TMP_DIR / f"{video_id}.wav"


def main() -> None:
    import mlx_whisper

    audio_paths = []
    for url in URLS:
        print(f"ダウンロード中: {url}")
        audio_paths.append(download(url))

    results = {}
    for label, model in MODELS.items():
        print(f"\n=== {label} ({model}) ===")
        results[label] = []
        for audio_path in audio_paths:
            t0 = time.time()
            r = mlx_whisper.transcribe(str(audio_path), path_or_hf_repo=model, language="ja")
            elapsed = time.time() - t0
            text = r["text"].strip()
            results[label].append((elapsed, text))
            print(f"{audio_path.stem}: {elapsed:.1f}秒")

    print("\n\n========== 比較結果 ==========")
    for i, audio_path in enumerate(audio_paths):
        print(f"\n--- 動画: {audio_path.stem} ---")
        for label in MODELS:
            elapsed, text = results[label][i]
            print(f"\n[{label}] {elapsed:.1f}秒")
            print(text)

    print("\n\n========== 合計時間 ==========")
    for label in MODELS:
        total = sum(e for e, _ in results[label])
        print(f"{label}: 合計{total:.1f}秒(3本平均{total/3:.1f}秒/本)")


if __name__ == "__main__":
    main()
