#!/usr/bin/env python3
"""TikTok動画のURLを渡すと、音声のみダウンロード→文字起こしを行い、
data/@アカウント名/transcripts/ に文字起こしMarkdownを保存する(02_X/data/@アカウント名/ と同じ構成)。

使い方:
    python3 transcribe.py <TikTokのURL> [<URL2> ...]
    python3 transcribe.py --file urls.txt  (1行1URLのリストファイル。大量処理向け)
"""
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
TMP_DIR = DATA_DIR / "_tmp"
WHISPER_MODEL = "mlx-community/whisper-large-v3-turbo"

MIN_FREE_MB = 800  # これを下回ったら次の動画に進む前に待機する
CHUNK_SIZE = 10  # --file実行時、何本ごとにプロセスを立て直すか


def free_memory_mb() -> float:
    out = subprocess.check_output(["vm_stat"]).decode()
    page_size = 16384
    for line in out.splitlines():
        if line.startswith("Pages free:"):
            free_pages = int(line.split()[-1].rstrip("."))
            return free_pages * page_size / 1024 / 1024
    return float("inf")


def wait_for_memory(min_mb: float = MIN_FREE_MB, check_interval: int = 10) -> None:
    """空きメモリが少ない時は、OOM killされる前に自分から待機する。"""
    waited = False
    while (free_mb := free_memory_mb()) < min_mb:
        if not waited:
            print(f"メモリ不足のため待機中(空き約{free_mb:.0f}MB < {min_mb}MB)...")
            waited = True
        time.sleep(check_interval)
    if waited:
        print("メモリに余裕ができたので再開します。")


def download_audio(url: str) -> tuple[dict, Path]:
    """yt-dlpで音声のみをダウンロードし、メタデータと音声ファイルパスを返す。
    動画全体ではなく音声トラックだけを取得するので、ダウンロード時間・
    ディスクI/Oが少なく済む。"""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "yt-dlp",
            "-f",
            "bestaudio/best",
            "-x",
            "--audio-format",
            "wav",
            "-o",
            str(TMP_DIR / "%(id)s.%(ext)s"),
            "--write-info-json",
            "--no-playlist",
            url,
        ],
        check=True,
    )
    info_path = next(TMP_DIR.glob("*.info.json"))
    info = json.loads(info_path.read_text())
    info_path.unlink()
    video_id = info.get("id", "unknown")
    audio_path = TMP_DIR / f"{video_id}.wav"
    return info, audio_path


def transcribe(audio_path: Path) -> str:
    import mlx_whisper

    result = mlx_whisper.transcribe(
        str(audio_path), path_or_hf_repo=WHISPER_MODEL, language="ja"
    )
    return result["text"].strip()


def save_transcript(account_dir: Path, info: dict, text: str) -> Path:
    transcripts_dir = account_dir / "transcripts"
    transcripts_dir.mkdir(parents=True, exist_ok=True)
    video_id = info.get("id", "unknown")
    out_path = transcripts_dir / f"{video_id}.md"
    frontmatter = "\n".join(
        [
            "---",
            f"video_id: {video_id}",
            f"url: {info.get('webpage_url', '')}",
            f"uploader: {info.get('uploader', '')}",
            f"title: {(info.get('description') or info.get('title') or '').splitlines()[0][:80]}",
            f"upload_date: {info.get('upload_date', '')}",
            f"fetched_at: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "---",
        ]
    )
    body = f"{frontmatter}\n\n## 概要欄\n{info.get('description', '')}\n\n## 文字起こし\n{text}\n"
    out_path.write_text(body, encoding="utf-8")
    return out_path


def update_manifest(account_dir: Path, info: dict) -> None:
    manifest_path = account_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    video_id = info.get("id", "unknown")
    entry = {
        "file": f"transcripts/{video_id}.md",
        "video_url": info.get("webpage_url", ""),
        "title": (info.get("description") or info.get("title") or "").splitlines()[0][:80],
        "upload_date": info.get("upload_date", ""),
    }
    manifest = [e for e in manifest if e.get("file") != entry["file"]]
    manifest.append(entry)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def already_done(account_dir: Path, video_id: str) -> bool:
    return (account_dir / "transcripts" / f"{video_id}.md").exists()


def process(url: str) -> None:
    video_id_hint = url.rstrip("/").split("/")[-1].split("?")[0]
    for account_dir in DATA_DIR.glob("@*"):
        if already_done(account_dir, video_id_hint):
            print(f"スキップ(処理済み): {url}")
            return

    wait_for_memory()

    print(f"[1/3] 音声ダウンロード中: {url}")
    info, audio_path = download_audio(url)
    video_id = info.get("id", "unknown")
    uploader = info.get("uploader", "unknown")
    account_dir = DATA_DIR / f"@{uploader}"

    if already_done(account_dir, video_id):
        print(f"スキップ(処理済み): {url}")
        audio_path.unlink(missing_ok=True)
        return

    print("[2/3] 文字起こし中...")
    text = transcribe(audio_path)
    audio_path.unlink(missing_ok=True)

    print("[3/3] 保存中...")
    out_path = save_transcript(account_dir, info, text)
    update_manifest(account_dir, info)
    print(f"完了: {out_path}")


def run_batch(urls: list[str]) -> None:
    # CHUNK_SIZE本ごとにプロセスを立て直す(毎回立て直すとモデル再読み込みが
    # 遅く、ずっと同じプロセスだとメモリが蓄積してOOM killされるため、
    # 両者のバランスを取っている)
    total = len(urls)
    done = 0
    for i in range(0, total, CHUNK_SIZE):
        chunk = urls[i : i + CHUNK_SIZE]
        print(f"=== {done + 1}〜{done + len(chunk)}/{total} 本目のチャンクを処理 ===")
        wait_for_memory()
        result = subprocess.run([sys.executable, __file__, *chunk])
        if result.returncode != 0:
            print("このチャンクでエラーが発生しましたが、次に進みます。")
        done += len(chunk)


def main() -> None:
    if len(sys.argv) < 2:
        print("使い方: python3 transcribe.py <TikTokのURL> [<URL2> ...]")
        print("      python3 transcribe.py --file urls.txt  (1行1URLのリストファイル)")
        sys.exit(1)

    if sys.argv[1] == "--file":
        urls = [
            line.strip()
            for line in Path(sys.argv[2]).read_text().splitlines()
            if line.strip()
        ]
        run_batch(urls)
        return

    for url in sys.argv[1:]:
        process(url)


if __name__ == "__main__":
    main()
