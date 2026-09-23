#!/usr/bin/env python3
"""02_Sources/02_X/data/配下の全アカウントのposts.jsonを読み込み、
構成タイプ(対比型/短文型/箇条書き型/会話例型/番号リスト型/問いかけ型/その他)で
機械分類し、頻度集計と層化サンプリングを行う(archive-pattern-analysisスキルのSTEP1・STEP2)。

使い方:
    python3 classify_archive.py                  # 全件の構成分布を表示
    python3 classify_archive.py --sample 200      # 層化サンプルをJSON出力(件数指定可)
"""
import json
import re
import sys
import random
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[4]  # sb-mac/
X_DATA_DIR = ROOT / "02_Sources" / "02_X" / "data"


def load_all_posts() -> list[dict]:
    posts = []
    for account_dir in sorted(X_DATA_DIR.glob("@*")):
        posts_file = account_dir / "posts.json"
        if not posts_file.exists():
            continue
        data = json.loads(posts_file.read_text())
        account = account_dir.name.lstrip("@")
        for item in data:
            text = item.get("text", "")
            if text:
                posts.append({"account": account, "text": text, "id": item.get("id", "")})
    return posts


def classify_structure(text: str) -> str:
    t = text.strip()
    lines = [l for l in t.split("\n") if l.strip()]
    bullet_count = sum(1 for l in lines if l.strip().startswith(("・", "-", "*")))
    box_count = t.count("■") + t.count("◾")
    quote_count = t.count("「") + t.count("『")
    has_taihi_words = bool(re.search(r"モテる.{0,5}モテない|成功.{0,5}失敗|できる男.{0,5}できない男", t))
    has_question = t.rstrip().endswith(("?", "？")) or bool(re.search(r"^[^\n]{0,30}[?？]", t))
    has_beforeafter = bool(re.search(r"[Bb]efore|[Aa]fter|以前は.{0,10}今は|昔は.{0,10}今は", t))
    numbered = bool(re.search(r"[①②③④⑤⑥⑦⑧⑨⑩]", t)) or bool(re.search(r"^\s*[1-9][\.\)]", t, re.M))

    if box_count >= 2 and bullet_count >= 2:
        return "対比型(■2つ以上+箇条書き)"
    if has_taihi_words:
        return "対比型(モテる/モテない等の対比ワード)"
    if box_count == 1 and bullet_count >= 2:
        return "単一■見出し+箇条書き(片側のみ)"
    if quote_count >= 4:
        return "会話例型(セリフ多数)"
    if has_beforeafter:
        return "Before/After型"
    if numbered:
        return "番号リスト型"
    if bullet_count >= 3:
        return "箇条書き型(対比・見出し無し)"
    if has_question:
        return "問いかけ型"
    if bullet_count == 0 and len(t) > 200:
        return "ストーリー・長文型"
    if bullet_count == 0 and len(t) <= 200:
        return "短文型"
    return "その他"


def build_stratified_sample(posts: list[dict], target_total: int = 200, seed: int = 42) -> list[dict]:
    """構成タイプごとに比例配分し、少数派タイプは最低件数を確保する層化サンプル。
    文字数が上位5%の外れ値も追加で含める(通常のテーマ・切り口分類から漏れやすい投稿を拾うため)。"""
    by_structure: dict[str, list[dict]] = defaultdict(list)
    for p in posts:
        by_structure[p["structure"]].append(p)

    total = len(posts)
    rng = random.Random(seed)
    sample: list[dict] = []
    for structure, pool in by_structure.items():
        proportional = max(5, round(target_total * len(pool) / total))
        n = min(proportional, len(pool))
        sample.extend(rng.sample(pool, n))

    lengths = sorted(p["length"] for p in posts)
    p95 = lengths[int(len(lengths) * 0.95)]
    long_outliers = [p for p in posts if p["length"] > p95 and p not in sample]
    rng.shuffle(long_outliers)
    sample.extend(long_outliers[:10])

    return sample


def main() -> None:
    posts = load_all_posts()
    for p in posts:
        p["structure"] = classify_structure(p["text"])
        p["length"] = len(p["text"])

    print(f"総投稿数: {len(posts)}")
    counts = Counter(p["structure"] for p in posts)
    print("\n=== 構成タイプ別件数 ===")
    for k, v in counts.most_common():
        print(f"{k}: {v}件 ({v / len(posts) * 100:.1f}%)")

    if "--sample" in sys.argv:
        idx = sys.argv.index("--sample")
        target = int(sys.argv[idx + 1]) if len(sys.argv) > idx + 1 and sys.argv[idx + 1].isdigit() else 200
        sample = build_stratified_sample(posts, target_total=target)
        out_path = Path(__file__).resolve().parent / "_sample_output.json"
        out_path.write_text(
            json.dumps(
                [{"id": p["id"], "account": p["account"], "structure": p["structure"], "text": p["text"]} for p in sample],
                ensure_ascii=False,
                indent=1,
            )
        )
        print(f"\n層化サンプル {len(sample)}件 -> {out_path}")


if __name__ == "__main__":
    main()
