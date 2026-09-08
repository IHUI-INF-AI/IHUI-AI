#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
#
# HumanEval 数据集下载与校验脚本。
#
# 数据集来源 (MIT License):
#   OpenAI HumanEval — https://github.com/openai/human-eval
#   License: MIT (https://github.com/openai/human-eval/blob/master/LICENSE)
#   字段: task_id, prompt, canonical_solution, test, entry_point
#   原始文件: data/HumanEval.jsonl (164 题)
#
# 本脚本仅下载/校验数据,不修改数据内容,遵守其 MIT 许可。
# 下载失败按镜像顺序重试: hf-mirror -> ghproxy -> raw.githubusercontent。

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
OUT_PATH = EVAL_DIR / "humaneval.jsonl"
EXPECTED_FIELDS = ("task_id", "prompt", "canonical_solution", "test", "entry_point")
EXPECTED_COUNT = 164

# 镜像顺序: 国内 hf-mirror -> ghproxy 代理 -> 官方 raw
MIRRORS = [
    "https://hf-mirror.com/datasets/openai_humaneval/resolve/main/test.jsonl",
    "https://ghproxy.com/https://raw.githubusercontent.com/openai/human-eval/main/data/HumanEval.jsonl",
    "https://raw.githubusercontent.com/openai/human-eval/main/data/HumanEval.jsonl",
]


def _fetch(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "IHUI-AI-humaneval-eval/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定可信镜像列表
        return resp.read()


def _fetch_from_pypi() -> bool:
    """兜底: 从 PyPI 官方 human-eval 分发包中提取同一份 MIT 数据集。

    openai/human-eval 仓库的 data/HumanEval.jsonl 经 PyPI ``human-eval`` 包
    (human_eval/data/HumanEval.jsonl.gz) 分发, 内容即为原始 164 题数据集。
    当上述镜像均不可达时(如本机仅开放 OpenRouter/PyPI 出口), 用 pip 下载
    该 wheel 并解压出数据集, 保证拿到的是官方同源数据。
    """
    import gzip
    import shutil
    import subprocess
    import tempfile
    import zipfile

    print("[download] 镜像均不可达, 改用 PyPI human-eval 包同源提取")
    tmpdir = tempfile.mkdtemp(prefix="he_pypi_")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pip", "download", "human-eval", "--no-deps", "-d", tmpdir],
            capture_output=True, text=True, timeout=180,
        )
        if proc.returncode != 0:
            print(f"[download] pip download 失败: {proc.stderr.strip()[:200]}")
            return False
        whl = next((p for p in Path(tmpdir).iterdir() if p.name.endswith(".whl")), None)
        if whl is None:
            print("[download] 未找到 human-eval wheel")
            return False
        with zipfile.ZipFile(whl) as z:
            gz_name = next((n for n in z.namelist() if n.endswith("HumanEval.jsonl.gz")), None)
            if gz_name is None:
                print("[download] wheel 内无 HumanEval.jsonl.gz")
                return False
            raw = gzip.decompress(z.read(gz_name))
        OUT_PATH.write_bytes(raw)
        print(f"[download] 已从 PyPI human-eval 包提取数据集 -> {OUT_PATH}")
        return True
    except Exception as exc:  # noqa: BLE001 - 兜底路径, 失败即放弃
        print(f"[download] PyPI 提取失败: {type(exc).__name__}: {exc}")
        return False
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def download() -> bool:
    for url in MIRRORS:
        try:
            print(f"[download] 尝试镜像: {url}")
            data = _fetch(url)
            if not data:
                print("[download] 返回空内容,跳过")
                continue
            OUT_PATH.write_bytes(data)
            print(f"[download] 已写入 {OUT_PATH} ({len(data)} bytes)")
            return True
        except Exception as exc:  # noqa: BLE001 - 镜像重试需要兜底
            print(f"[download] 失败: {type(exc).__name__}: {exc}")
    return _fetch_from_pypi()


def validate() -> int:
    if not OUT_PATH.exists():
        print("[validate] 数据集文件不存在")
        return 0
    lines = OUT_PATH.read_text(encoding="utf-8").splitlines()
    # 去除空行(末尾换行)
    lines = [ln for ln in lines if ln.strip()]
    if len(lines) != EXPECTED_COUNT:
        print(f"[validate] 行数异常: 期望 {EXPECTED_COUNT}, 实际 {len(lines)}")
        return 0
    task_ids: set[str] = set()
    for i, ln in enumerate(lines, 1):
        try:
            obj = json.loads(ln)
        except json.JSONDecodeError as exc:
            print(f"[validate] 第 {i} 行 JSON 解析失败: {exc}")
            return 0
        for f in EXPECTED_FIELDS:
            if f not in obj:
                print(f"[validate] 第 {i} 行缺少字段: {f} (task_id={obj.get('task_id')})")
                return 0
        if not isinstance(obj["task_id"], str) or not obj["task_id"].startswith("HumanEval/"):
            print(f"[validate] 第 {i} 行 task_id 异常: {obj.get('task_id')!r}")
            return 0
        if obj["task_id"] in task_ids:
            print(f"[validate] task_id 重复: {obj['task_id']}")
            return 0
        task_ids.add(obj["task_id"])
    print(f"[validate] 通过: {len(task_ids)} 题, 字段完整, task_id 唯一")
    return len(task_ids)


def main() -> int:
    if not download():
        print("[FATAL] 所有镜像下载失败, 停止。")
        return 2
    count = validate()
    if count != EXPECTED_COUNT:
        print(f"[FATAL] 校验未通过 (得到 {count} 题), 停止。")
        return 1
    print("[OK] 数据集就绪: scripts/evals/humaneval.jsonl")
    return 0


if __name__ == "__main__":
    sys.exit(main())
