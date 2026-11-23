# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""积分倍数推断跨语言一致性钉(2026-11-23 立)。

与 TS 侧 ``packages/shared/src/constants/__tests__/points-multiplier-rules.test.ts``
读同一份共享语料 ``points-multiplier-corpus.json``:Python 解释器
(:mod:`app.services.points_multiplier_inference`)必须对每条样本算出与 TS 侧
同一个倍数。规则源只有 ``points-multiplier-rules.json`` 一处,两端数据模块都由
``scripts/gen-points-multiplier-rules.mjs`` 派生;本文件同时钉住生成物与源同步。

本测试零 DB / Redis 依赖:不导入 ``app.main``、不触数据库连接池,纯函数 + 一次
本地 node 派生器 ``--check`` 子进程。
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from app.services.points_multiplier_inference import infer_points_multiplier

HERE = Path(__file__).resolve().parent
# tests → ai-service → apps → 仓库根(不写死盘符,按测试文件位置向上解析)。
REPO_ROOT = HERE.parents[2]
CORPUS_PATH = (
    REPO_ROOT
    / "packages"
    / "shared"
    / "src"
    / "constants"
    / "points-multiplier-corpus.json"
)
RULES_GENERATOR = REPO_ROOT / "scripts" / "gen-points-multiplier-rules.mjs"


def _load_corpus() -> list[tuple[str, float]]:
    """读取共享语料,归一化为 ``(model_id, 期望倍数)`` 列表。"""
    data = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    return [(str(model_id), float(expected)) for model_id, expected in data["cases"]]


CORPUS: list[tuple[str, float]] = _load_corpus()


@pytest.mark.parametrize("model_id, expected", CORPUS)
def test_corpus_matches_ts_side(model_id: str, expected: float) -> None:
    """共享语料逐条对齐:Python 推断结果必须等于语料期望值(= TS 侧口径)。"""
    assert infer_points_multiplier(model_id) == expected


def test_generated_artifacts_in_sync_with_json_source() -> None:
    """生成物(Python 数据模块 + TS 数据模块)必须与共享 JSON 源同步。

    跑派生器 ``--check``;漂移时脚本按文件打印 ``DRIFT`` 行,失败信息原样带出,
    可直接看出是哪个生成物漂了。
    """
    proc = subprocess.run(
        ["node", str(RULES_GENERATOR), "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, (
        "规则生成物与共享 JSON 源漂移(哪个文件见下列 DRIFT 行):\n"
        f"--- stdout ---\n{proc.stdout}\n--- stderr ---\n{proc.stderr}"
    )


def test_empty_string_falls_back_to_economy() -> None:
    """空串(或缺省 model_id)落默认档 1.0,不抛异常。"""
    assert infer_points_multiplier("") == 1.0


def test_case_insensitive() -> None:
    """大小写不敏感:大写输入与小写输入判同一档。"""
    assert infer_points_multiplier("GPT-5.4") == infer_points_multiplier("gpt-5.4") == 10.0
    assert (
        infer_points_multiplier("Claude-3-Opus")
        == infer_points_multiplier("claude-3-opus")
        == 30.0
    )


def test_gemini_mini_keyword_excluded() -> None:
    """``gemini`` 尾部含 ``mini`` 子串,exclusion 后 ``mini`` 对 gemini 不作数。

    否则 ``gemini-2.5-pro`` 会被经济档 ``mini`` 误拉到 1.0;正确口径是 gemini+pro
    落高级档 10.0。反向对照:非 gemini 型号的 ``mini`` 仍判经济档 1.0。
    """
    assert infer_points_multiplier("gemini-2.5-pro") == 10.0
    assert infer_points_multiplier("gemini-1.5-pro") == 10.0
    assert infer_points_multiplier("gpt-4o-mini") == 1.0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
