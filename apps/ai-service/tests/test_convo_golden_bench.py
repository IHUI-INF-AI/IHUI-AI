# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# [IHUI-AI-PROVENANCE]

"""D127 对话黄金任务集的常驻回归测试。

题目集与判分标准住在 `bench/tasks_convo_golden.json` + `bench/fixtures{,_golden}/`,
**执行器是既有的 `bench.run_bench` / `bench.run_golden_e2e`**(D127 明令禁两套执行器,
本票只加题集与 `--tasks-file` 入口,不加新链)。本文件守四件事:

1. 结构:30 个任务、五类各 6、id 唯一、判分器只用既有四种(结构化断言,非 LLM 主观分);
2. 负向对照(本票最容易静默失效的一格):**初始态 fixture 里不得存在任何待检产物**。
   缺这一维时,题目可以"答案已经躺在初始目录里"而通过率一路报 100% ——
   任务有效性 与 通过率 在账面上完全同形;
3. 端到端:golden 执行器跑这套题必须 30/30,且 `--min-pass-rate 1.0` 时退出码 0;
   `--tasks-file` 指不到文件时必须大声失败(不得静默退回 tasks_v1);
4. 存续性:题集任何一份文件被 `.gitignore` 命中 = 干净检出上缺件(本机测试照绿)。

零网络、零 LLM、零数据库,纯本地文件与子进程断言(符合测试隔离铁律)。
"""

from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_SERVICE_ROOT.parents[1]
BENCH_ROOT = AI_SERVICE_ROOT / "bench"
TASKS_FILE = BENCH_ROOT / "tasks_convo_golden.json"

EXPECTED_CATEGORIES = {
    "convo-qa": 6,
    "convo-tools": 6,
    "convo-longtask": 6,
    "convo-multimodal": 6,
    "convo-review": 6,
}
# 判分器白名单 = bench/run_bench._CHECKERS 的四条(结构化断言,非 LLM 主观分)。
# 刻意不 import 那份字典:本测试要问的是"题集有没有绕过既有判据",
# 而 import 走磁盘 —— 题集与被 import 的实现不同面时,新增判据类型会被自己蒙过去。
ALLOWED_CHECKERS = {"file_contains", "file_not_contains", "pytest_file_exists", "pytest_pass"}


@pytest.fixture(scope="module")
def tasks() -> list[dict]:
    data = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
    items = data["tasks"] if isinstance(data, dict) else data
    assert isinstance(items, list) and items
    return items


def test_1_structure_tasks_and_categories(tasks: list[dict]) -> None:
    """30 个任务、五类各 6、id 唯一、判分器只用既有四种、每任务至少一条断言。"""
    assert len(tasks) == 30, f"任务数应为 30,实际 {len(tasks)}"
    cats = Counter(t["category"] for t in tasks)
    assert dict(cats) == EXPECTED_CATEGORIES, f"五类分布漂开: {dict(cats)}"
    ids = [t["id"] for t in tasks]
    assert len(set(ids)) == len(ids), "存在重复任务 id"

    for t in tasks:
        checks = t.get("checks") or []
        assert checks, f"{t['id']}: 没有任何判分断言"
        for c in checks:
            assert c["type"] in ALLOWED_CHECKERS, (
                f"{t['id']}: 判分器 {c['type']!r} 不在既有四种里 —— 新增判据要先改 run_bench 再改本名单"
            )
            assert c["params"].get("path"), f"{t['id']}: 检查缺 path"
            assert c["params"].get("substring"), f"{t['id']}: 检查缺 substring"
        assert t.get("instructions"), f"{t['id']}: 缺对话指令"
        assert t.get("allowed_tools"), f"{t['id']}: 缺 allowed_tools"


def test_2_initial_fixtures_have_no_products(tasks: list[dict]) -> None:
    """负向对照:初始态不得含任何待检产物;golden 态必须含全部检查目标。

    这一条替代"跑一遍 stub 看是否 0 通过" —— 它不依赖执行器行为,直接量题目集自身。
    """
    for t in tasks:
        init_dir = BENCH_ROOT / "fixtures" / t["fixture"]
        gold_dir = BENCH_ROOT / "fixtures_golden" / t["fixture"]
        assert init_dir.is_dir(), f"{t['id']}: 初始态 fixture 不存在 {init_dir}"
        assert gold_dir.is_dir(), f"{t['id']}: golden fixture 不存在 {gold_dir}"
        assert any(init_dir.rglob("*")), f"{t['id']}: 初始态为空目录(git 不跟踪空目录 ⇒ 换机必缺件)"

        for c in t["checks"]:
            rel = c["params"]["path"]
            assert not (init_dir / rel).exists(), (
                f"{t['id']}: 初始态已含产物 {rel} —— 这道题不做也能过,是无效任务"
            )
            assert (gold_dir / rel).is_file(), (
                f"{t['id']}: golden 缺产物 {rel} —— 红会来自 fixture 缺件而非判据"
            )


def test_3_fixture_dirs_do_not_collide_with_v1(tasks: list[dict]) -> None:
    """题集与 fixtures 目录一一对应,且 fixture 名不得复用既有 41 题的目录。"""
    names = [t["fixture"] for t in tasks]
    assert len(set(names)) == len(names), "多个任务共用同一 fixture"
    v1 = json.loads((BENCH_ROOT / "tasks_v1.json").read_text(encoding="utf-8"))
    v1_items = v1["tasks"] if isinstance(v1, dict) else v1
    clash = set(names) & {t["fixture"] for t in v1_items}
    assert not clash, f"与 tasks_v1 的 fixture 撞名(会互相改写答案): {sorted(clash)}"


def test_4_golden_executor_passes_all_thirty() -> None:
    """端到端:既有 golden 执行器跑这套题必须 30/30 且 CI 门禁放行。"""
    proc = subprocess.run(
        [
            sys.executable,
            "-X",
            "utf8",
            "-m",
            "bench.run_bench",
            "--executor",
            "golden",
            "--tasks-file",
            TASKS_FILE.name,
            "--min-pass-rate",
            "1.0",
            "--report",
            ".tmp-d127-pytest.md",
        ],
        cwd=AI_SERVICE_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    assert proc.returncode == 0, (
        f"golden 直评失败 rc={proc.returncode}\n{proc.stdout[-2000:]}\n{proc.stderr[-2000:]}"
    )
    assert "通过率 100.0%" in proc.stdout, proc.stdout[-2000:]


def test_5_tasks_file_flag_does_not_default_silently() -> None:
    """`--tasks-file` 指不到文件时必须大声失败。

    静默退回缺省集 = 把"跑新题集"悄悄变成"跑旧题集而账面没人知道",
    与"把没判写成判过了"是同一条禁令。
    """
    proc = subprocess.run(
        [
            sys.executable,
            "-X",
            "utf8",
            "-m",
            "bench.run_bench",
            "--executor",
            "golden",
            "--tasks-file",
            "definitely_missing_task_set.json",
        ],
        cwd=AI_SERVICE_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert proc.returncode != 0
    assert "definitely_missing_task_set.json" in (proc.stderr + proc.stdout), (
        "报错没点名所指路径 —— 调用方无法分辨'没跑到'与'跑错集'"
    )


def test_6_no_fixture_is_git_ignored(tasks: list[dict]) -> None:
    """题集任何一份文件被 `.gitignore` 命中 = 干净检出上缺件,而本机一切正常。

    实测两型:`app.log` 撞 ``*.log``(git add 直接失败)、输入目录 `data/` 撞 ``data/``
    规则(目录在而文件没入库,别人 clone 后 copytree 炸)。判法是问 git,
    不抄一份"什么会被忽略"(抄的那份必然腐烂)。

    **必须走字节管道**:Windows 上 `text=True` 会把 `\\n` 写成 `\\r\\n`,路径尾带 `\\r` 时
    ``*.log`` 永不命中 —— 守卫会静默把"被忽略"读成"没被忽略"。这条由同一次调用里的
    阳性对照钉住(它不存在于磁盘上,只为证明判据有牙)。
    """
    paths: list[str] = []
    for base in (BENCH_ROOT / "fixtures", BENCH_ROOT / "fixtures_golden"):
        for t in tasks:
            d = base / t["fixture"]
            paths += [str(f.relative_to(REPO_ROOT)) for f in sorted(d.rglob("*")) if f.is_file()]
    assert paths, "题集 fixture 一个文件都没枚举到"

    probe = "\n".join([*paths, "apps/ai-service/bench/fixtures/synthetic-probe/app.log"])
    r = subprocess.run(
        ["git", "check-ignore", "--stdin"],
        cwd=REPO_ROOT,
        input=probe.encode("utf-8"),
        capture_output=True,
        timeout=120,
    )
    hits = [x for x in r.stdout.decode("utf-8", "replace").splitlines() if x.strip()]
    assert any("synthetic-probe/app.log" in h for h in hits), (
        f"阳性对照没被点名 ⇒ 这条判据没牙(取径或编码漂了): {hits[:3]}"
    )
    real = [h for h in hits if "synthetic-probe" not in h]
    assert not real, f"题集文件被 .gitignore 命中,换机必缺件: {real}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
