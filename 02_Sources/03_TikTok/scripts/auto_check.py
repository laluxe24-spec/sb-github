#!/usr/bin/env python3
"""TikTokの各アカウント(data/@アカウント名/)の新着動画を検出し、
transcribe.pyで自動的に文字起こしする(launchdによる日次実行を想定)。

新着かどうかは、プロフィールの新しい順の動画一覧のうち、
「動画ID = manifest.jsonに既に記録済みのID」に含まれないものを新着とみなす。
毎回プロフィール全体を舐めるのは無駄なので、直近PLAYLIST_LIMIT件だけ見る
(1日1回の実行なので、それを超える新着は通常発生しない想定)。
"""
import json
import subprocess
from pathlib import Path

import transcribe

DATA_DIR = transcribe.DATA_DIR
PLAYLIST_LIMIT = 30


def account_profile_url(account_dir: Path) -> str:
    handle = account_dir.name.lstrip("@")
    return f"https://www.tiktok.com/@{handle}"


def list_recent_video_urls(profile_url: str) -> list[str]:
    out = subprocess.run(
        [
            "yt-dlp",
            "--flat-playlist",
            "--playlist-end",
            str(PLAYLIST_LIMIT),
            "--print",
            "url",
            profile_url,
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def known_video_ids(account_dir: Path) -> set[str]:
    manifest_path = account_dir / "manifest.json"
    if not manifest_path.exists():
        return set()
    manifest = json.loads(manifest_path.read_text())
    ids = set()
    for entry in manifest:
        file = entry.get("file", "")
        if file.startswith("transcripts/") and file.endswith(".md"):
            ids.add(file[len("transcripts/") : -len(".md")])
    return ids


def main() -> None:
    total_new = 0
    for account_dir in sorted(DATA_DIR.glob("@*")):
        if not account_dir.is_dir():
            continue
        profile_url = account_profile_url(account_dir)
        print(f"=== {account_dir.name} の新着をチェック中 ===")
        try:
            urls = list_recent_video_urls(profile_url)
        except subprocess.CalledProcessError as e:
            print(f"動画一覧の取得に失敗: {e}")
            continue

        known_ids = known_video_ids(account_dir)
        new_urls = [
            u for u in urls if u.rstrip("/").split("/")[-1].split("?")[0] not in known_ids
        ]
        if not new_urls:
            print("新着なし")
            continue

        print(f"新着{len(new_urls)}本を処理します")
        transcribe.run_batch(new_urls)
        total_new += len(new_urls)

    print(f"完了。合計{total_new}本の新着を処理しました。")


if __name__ == "__main__":
    main()
