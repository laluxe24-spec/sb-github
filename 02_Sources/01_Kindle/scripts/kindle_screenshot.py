#!/usr/bin/env python3
"""
Kindleアプリのウィンドウを自動でスクリーンショットしながら
次のページへ進めていくスクリプト。ページが変化しなくなったら
(=最終ページに到達したら)自動で停止するので、通常はページ数の
上限を気にする必要はない。

使い方:
    python3 kindle_screenshot.py [本のタイトル] [ページ数上限]

    例) 「嫌われる勇気」をキャプチャする場合(ページ数上限は省略でよい)
    python3 kindle_screenshot.py 嫌われる勇気

    例) 上限を明示したい場合(通常は不要)
    python3 kindle_screenshot.py 嫌われる勇気 5000

    出力先は ../data/<本のタイトル>/screenshots/ に保存される。
    本のタイトルを省略した場合は ../data/untitled/screenshots/ になる。

必要なパッケージ:
    pip3 install pyobjc-framework-Quartz

必要な権限(システム設定 > プライバシーとセキュリティ):
    - 画面収録(Screen Recording)
        ターミナル(またはPythonを実行しているアプリ)に許可が必要。
        許可していないと screencapture が真っ黒/空の画像を保存する。
    - アクセシビリティ(Accessibility)
        System Events 経由でキー入力を送るために必要。
        ターミナルに許可を与える。
"""

import hashlib
import subprocess
import sys
import time
from collections import deque
from pathlib import Path

import Quartz

RECOVERY_CLICK_MAX = 3  # スタック検出時、あきらめる前に試す「クリックしてフォーカスを外す」回数

# Kindleアプリの候補名(環境によって表示名が異なるため複数チェック)
APP_NAME_CANDIDATES = ["Kindle", "Amazon Kindle"]

DATA_ROOT = Path(__file__).parent.parent / "data"
# 実際のページ数はスクリプトが自動検出して止まるため、これは「万一検出に
# 失敗した場合の安全装置」としての上限に過ぎない。よほど長い本でない限り
# 気にする必要はない。
DEFAULT_NUM_PAGES = 5000
WAIT_SECONDS = 1.5  # ページ送り後の待機時間(1〜2秒)

KEY_CODE_RIGHT = 124  # 右矢印
KEY_CODE_LEFT = 123   # 左矢印


def parse_args() -> tuple[int, str]:
    num_pages = DEFAULT_NUM_PAGES
    book_name = "untitled"
    for arg in sys.argv[1:]:
        if arg.isdigit():
            num_pages = int(arg)
        else:
            book_name = arg
    return num_pages, book_name


def find_kindle_window():
    """Quartzで画面上のウィンドウ一覧からKindleのウィンドウを探す。
    座標は固定せず、毎回最新のウィンドウ情報を取得する。
    見つかった場合は (windowID, オーナー名) を返す。見つからない場合は None。
    """
    window_list = Quartz.CGWindowListCopyWindowInfo(
        Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID
    )
    for w in window_list:
        owner = w.get("kCGWindowOwnerName", "") or ""
        if any(name.lower() in owner.lower() for name in APP_NAME_CANDIDATES):
            bounds = w.get("kCGWindowBounds", {})
            # あまりに小さいウィンドウ(メニューバー項目など)は除外
            if bounds.get("Width", 0) > 200 and bounds.get("Height", 0) > 200:
                return w["kCGWindowNumber"], owner
    return None


def find_kindle_window_with_bounds():
    """find_kindle_windowと同様だが、ウインドウのbounds(座標)も一緒に返す。
    リンクページでのフォーカス回復クリックに使う。"""
    window_list = Quartz.CGWindowListCopyWindowInfo(
        Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID
    )
    for w in window_list:
        owner = w.get("kCGWindowOwnerName", "") or ""
        if any(name.lower() in owner.lower() for name in APP_NAME_CANDIDATES):
            bounds = w.get("kCGWindowBounds", {})
            if bounds.get("Width", 0) > 200 and bounds.get("Height", 0) > 200:
                return w["kCGWindowNumber"], owner, bounds
    return None


def activate_app(owner_name: str) -> None:
    # 一部のアプリ(Kindleなど)は Standard Suite の "activate" に対応していないため、
    # System Events 経由で frontmost を切り替える方が確実。
    script = (
        f'tell application "System Events" to set frontmost of '
        f'(first process whose name is "{owner_name}") to true'
    )
    subprocess.run(["osascript", "-e", script], check=True)


def send_key(key_code: int) -> None:
    script = f'tell application "System Events" to key code {key_code}'
    subprocess.run(["osascript", "-e", script], check=True)


def capture_window(window_id: int, out_path: Path) -> None:
    """指定したウィンドウIDだけをスクリーンショットする。
    -l でウィンドウIDを指定するので、座標やウィンドウサイズが
    変わっても正しくそのウィンドウだけをキャプチャできる。
    """
    subprocess.run(
        ["screencapture", "-x", "-o", "-l", str(window_id), str(out_path)],
        check=True,
    )


def file_md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def click_neutral_point(bounds) -> None:
    """目次などのリンク付きページで矢印キーがページ送りとして効かなくなる
    (リンク要素にフォーカスが移ってしまう)ことがあるため、ウインドウ左上の
    余白(本文やリンクが無い場所)を一度クリックしてフォーカスを外す。"""
    x = bounds.get("X", 0) + 50
    y = bounds.get("Y", 0) + 383
    down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (x, y), Quartz.kCGMouseButtonLeft)
    up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (x, y), Quartz.kCGMouseButtonLeft)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
    time.sleep(0.05)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)


def main() -> None:
    num_pages, book_name = parse_args()

    book_dir = DATA_ROOT / book_name
    output_dir = book_dir / "screenshots"
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = book_dir / "capture.log"
    log_file = open(log_path, "a", encoding="utf-8")

    def log(msg: str) -> None:
        print(msg)
        log_file.write(msg + "\n")
        log_file.flush()

    log(f"=== キャプチャ開始: 本={book_name} 上限ページ数={num_pages} ===")

    found = find_kindle_window()
    if not found:
        log("Kindleのウィンドウが見つかりませんでした。Kindleアプリを起動し、ウィンドウを表示してから再実行してください。")
        sys.exit(1)

    _, owner_name = found
    log(f"Kindleアプリを検出しました: {owner_name}")
    activate_app(owner_name)
    time.sleep(0.5)

    next_key_code = KEY_CODE_RIGHT
    key_switched = False
    recent_hashes = deque(maxlen=8)  # 短い周期のループ(アニメ等)も検出するため直近8枚を記憶
    stuck_count = 0
    recovery_attempts = 0
    reached_end = False
    window_lost = False

    for i in range(1, num_pages + 1):
        found = find_kindle_window_with_bounds()
        if not found:
            log("Kindleのウィンドウが見つからなくなりました。処理を中断します。")
            window_lost = True
            break
        window_id, _, window_bounds = found

        out_path = output_dir / f"{i:04d}.png"
        capture_window(window_id, out_path)
        current_hash = file_md5(out_path)
        log(f"[{i}/{num_pages}] 保存: {out_path.name}")

        if current_hash in recent_hashes:
            stuck_count += 1
        else:
            stuck_count = 0
            recovery_attempts = 0

        if stuck_count == 1 and not key_switched:
            log("  -> 右矢印キーではページが変わりませんでした。左矢印キーに切り替えます。")
            next_key_code = KEY_CODE_LEFT
            key_switched = True
        elif stuck_count >= 3:
            if recovery_attempts < RECOVERY_CLICK_MAX:
                recovery_attempts += 1
                log(f"  -> ページが変化しません。目次などでリンクにフォーカスが移った可能性があるため、"
                    f"余白をクリックしてフォーカスを外し再試行します。({recovery_attempts}/{RECOVERY_CLICK_MAX})")
                click_neutral_point(window_bounds)
                time.sleep(0.3)
            else:
                log("  -> クリックによる回復を試みても変化しませんでした。最終ページに到達したとみなして終了します。")
                out_path.unlink()
                log(f"  -> 重複した最終ページ {out_path.name} を削除しました。")
                reached_end = True
                break

        recent_hashes.append(current_hash)

        send_key(next_key_code)
        time.sleep(WAIT_SECONDS)
    else:
        # for-else: breakされずにループが最後まで回った = 上限に到達したが
        # 最終ページを検出できなかった(本が上限より長い可能性がある)
        log(f"  -> 警告: 上限の{num_pages}ページに到達しましたが、最終ページを検出できませんでした。")
        log(f"     本がまだ続いている可能性があります。ページ数上限を増やして再実行してください。")

    log("完了しました。")
    log_file.close()


if __name__ == "__main__":
    main()
