# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #75 回归:`file_search` / 索引枚举层换 ripgrep 的**两通道语义对账**。

四条判据各自的落点:
 1. 枚举更快 —— `test_real_repo_enumeration_is_faster_than_serial_walk`(真仓前/后读数)
 2. 10 万文件级 —— 同一用例的**与规模无关的不变量**(枚举没被内部上限截断 + 被 git
    跟踪的代码文件一个都不漏)。原先断言的是"枚举到 ≥100,000 个文件",2026-09-27
    复评时换掉了:那个数量的是**当时那台共享工作区**的在飞文件量(同一命令当日读到
    43,551,而 `git ls-files` 只有 13,092 条跟踪路径)—— 锚在机器状态上的判据,
    换台机就恒不可能成立。受控构造的规模读数(2k/10k/50k/100k)由
    `scripts/measure_lazy_index_guardrail.py` 承载,可重跑。
 3. 降级路径与 rg 路径**同一结果集** —— `test_two_channels_agree_*` /
    `test_content_channel_parity_*` / `test_forced_degradation_is_recorded_*`
 4. 护栏复评 —— `test_lazy_index_guardrail_sees_same_denominator`(护栏读的是枚举分母,
    换通道不得改变它看到的数字)。**阈值本身**已于 2026-09-27 复评:改成"三条成本轴
    取最小值"的派生阈值 —— 判据在 `tests/test_lazy_index_guardrail_v75.py`,依据与常量
    在 `mcp_server.py` 的懒索引护栏段,取证脚本 `scripts/measure_lazy_index_guardrail.py`。
    旧文本说"依据写在 codebase_indexer 的注释里",那句已过期:该处注释仍在描述已被删除
    的 `_LAZY_INDEX_MAX_FILES = 2000`,而 codebase_indexer.py 在本票的禁改清单内,
    所以只在这里登记,不替它改(主会话可一并把那段注释指过来)。

三条写法纪律(本仓踩过,故立此):
 - 测试**不得内联一份判据副本**,一律调 `app.services.rg_fallback_parity` 的生产出口(§22c)。
 - 夹具**不得落 C 盘**(§26:活 TEMP 可能钉在 `C:\\Users\\...\\AppData\\Local\\Temp`,
   服务身份更是 `C:\\Windows\\Temp`),锚定到与工作树同盘的 `DevEnv/Temp`。
 - 反残留判据按**前缀枚举父目录**,不得只判一个字面名(§26 同一型)。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import rg_fallback_parity as rgp  # noqa: E402
from app.services.codebase_indexer import (  # noqa: E402
    _EXT_TO_LANG,
    _IGNORED_DIRS,
    MAX_FILES_PER_INDEX,
    codebase_indexer,
)

FIXTURE_PREFIX = "ihui-v75-"


# ---------------------------------------------------------------------------
# 夹具落点与反残留
# ---------------------------------------------------------------------------


def _scratch_parent() -> Path:
    """临时夹具父目录:优先工作树**同盘**的 DevEnv/Temp,绝不落 C 盘。"""
    drive = os.path.splitdrive(str(Path.cwd()))[0] or "C:"
    same_disk = Path(drive + os.sep) / "DevEnv" / "Temp"
    candidate = same_disk if same_disk.is_dir() else Path(sys.tempdir if hasattr(sys, "tempdir") else "")
    if not str(candidate):
        candidate = Path(os.path.dirname(os.path.abspath(__file__)))
    # 判据:落点盘符不得是系统盘(§26 的junction 管不了身份那一型)
    assert not str(candidate).upper().startswith("C:"), f"夹具落点不得在 C 盘: {candidate}"
    candidate.mkdir(parents=True, exist_ok=True)
    return candidate


@pytest.fixture()
def repo_fixture(tmp_path: Path) -> Path:
    """受控小夹具:覆盖三类实测踩过的形态。

    - 点开头目录(rg 默认不收,`--hidden` 才收)
    - 大写扩展名(rg `-g *.py` 收不到,必须把扩展名判定收到一份 Python 实现里)
    - 忽略目录(rg 无尾斜杠的 `-g !node_modules` 会连同名文件一起排掉)
    - 无扩展名文件 / 非白名单扩展名(两侧都不得收)
    """
    root = tmp_path / "repo"
    files = {
        "a/x.py": "import os\n# token: a.*b here\ndef hello():\n    return 'a.*b'\n",
        "a/Y.PY": "def Upper():\n    return 1\n",
        "a/sub/deep.py": "def deep():\n    pass\n",
        ".hidden/z.py": "def hidden():\n    pass\n",
        "node_modules/w.py": "def dep():\n    pass\n",
        "dist/built.ts": "export const q = 1;\n",
        "docs/n.md": "# title\n",
        "LICENSE": "text",
        "bin/noext": "raw",
        "a/img.png": "binary-ish",
    }
    for rel, body in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
    return root


def _legacy_collect(root: Path) -> set[str]:
    """被替换掉的**旧实现**的逐字复刻,只作对账基准用(不是生产判据)。

    这里允许"抄一份",因为它抄的是 HEAD 里那个已被替换的旧算法,作用正是
    证明新算法与它等价 —— 与 §22c 禁止的那种"测试里抄一份当前判据"相反:
    当前判据一律从 `rgp.*` 生产出口取。
    """
    out: set[str] = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIRS]
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext in _EXT_TO_LANG:
                out.add(os.path.relpath(os.path.join(dirpath, fname), str(root)).replace("\\", "/"))
    return out


# ---------------------------------------------------------------------------
# 判据 3:两条枚举通道同一结果集
# ---------------------------------------------------------------------------


def test_two_channels_agree_on_fixture(repo_fixture: Path) -> None:
    """ripgrep 通道与串行 Python 通道在受控夹具上**集合相等**。"""
    diff = rgp.compare_enumerations(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    assert diff.consistent, f"两通道结果集分叉(=第二份真相):{diff.summary} rg_only={diff.rg_only} py_only={diff.py_only}"
    # 阳性对照:夹具里那些"容易被漏"的形态必须真被两边都收到,
    # 否则两边一致地漏掉同一批文件也是绿的。
    assert diff.rg_count >= 5, diff.summary
    rg_paths, _ = rgp.enumerate_with_rg(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    assert ".hidden/z.py" in rg_paths, "点开头目录被漏(--hidden 失效)"
    assert "a/Y.PY" in rg_paths, "大写扩展名被漏(扩展名判定回潮到 rg glob 侧)"
    assert "node_modules/w.py" not in rg_paths, "忽略目录未剪枝"
    assert "dist/built.ts" not in rg_paths, "忽略目录未剪枝"
    assert "LICENSE" not in rg_paths and "bin/noext" not in rg_paths, "非白名单扩展名被收"


def test_new_channel_equals_replaced_legacy_walk(repo_fixture: Path) -> None:
    """换通道不得改变**被替换掉的旧实现**看到的那批文件(回归护栏)。"""
    legacy = _legacy_collect(repo_fixture)
    new_paths, prov = rgp.enumerate_code_files(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    assert set(new_paths) == legacy, f"与旧实现集合不等: {set(new_paths) ^ legacy}"
    assert prov.degraded_reason is None or prov.engine != rgp.ENGINE_RIPGREP


# ---------------------------------------------------------------------------
# 判据 3(后半):降级必须留痕,且结果与 rg 路径同集
# ---------------------------------------------------------------------------


def test_forced_degradation_is_recorded_and_equivalent(repo_fixture: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """无 rg(人为断供)时:engine 必须是 python-walk、原因必须写出来、结果集不得变。"""
    monkeypatch.setenv(rgp.ENV_DISABLE_RG, "1")
    degraded_paths, dprov = rgp.enumerate_code_files(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    assert dprov.engine == rgp.ENGINE_PYTHON_WALK, "降级后仍自称 ripgrep = 假账"
    assert dprov.degraded_reason, "降级必须带可诊断原因,不得静默"
    normal_paths, _ = rgp.enumerate_code_files(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    assert degraded_paths == normal_paths, "降级通道与 rg 通道结果集不等 = 第二份真相"


def test_missing_binary_degrades_without_claiming_rg(monkeypatch: pytest.MonkeyPatch, repo_fixture: Path) -> None:
    """ripgrep 根本不存在时不得抛错、不得谎称用了 rg(§5e"失败必须响"同一条禁令)。"""
    monkeypatch.setenv("PATH", str(repo_fixture))
    monkeypatch.delenv("IHUI_RIPGREP_PATH", raising=False)
    binary = rgp.resolve_rg_binary()
    paths, prov = rgp.enumerate_with_rg(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), rg=binary
    )
    if binary.path == "":
        assert prov.degraded_reason and paths == set()
        full, fprov = rgp.enumerate_code_files(
            repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
        )
        assert fprov.engine == rgp.ENGINE_PYTHON_WALK
        assert fprov.degraded_reason and full, "无 rg 时也要给出完整结果集"


# ---------------------------------------------------------------------------
# 判据 3(再后半):内容检索两通道逐行号等价
# ---------------------------------------------------------------------------


def test_content_channel_parity_including_regex_metacharacters(repo_fixture: Path) -> None:
    """字面量子串语义下,含正则元字符的 query 两侧命中与**行号**必须逐字相同。

    若 rg 侧漏了 `-F`, `a.*b` 会被当正则解释成"匹配任意跨字符序列",两侧命中集
    立刻分叉 —— 本票点名的"正则方言差异"就是这一格。
    """
    files, _ = rgp.enumerate_code_files(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    for needle in ("a.*b", "hello", "DEF", "[token", "return '"):
        via_rg = rgp.search_file_contents(
            repo_fixture, files=files, needle=needle, max_results=20, prefer_rg=True
        )
        via_py = rgp.search_file_contents(
            repo_fixture, files=files, needle=needle, max_results=20, prefer_rg=False
        )
        a = sorted((h.path, h.line_numbers) for h in via_rg.hits)
        b = sorted((h.path, h.line_numbers) for h in via_py.hits)
        assert a == b, f"needle={needle!r} rg={a} py={b}"
        if via_rg.provenance is not None:
            assert via_rg.provenance.degraded_reason is None, (
                f"needle={needle!r} rg 通道静默降级:{via_rg.provenance.degraded_reason}"
            )
        assert via_rg.unparsed_lines == 0, "有命中行解析不出来 —— 通道不可信却仍报结果"


def test_content_channel_actually_uses_rg_on_real_hits(repo_fixture: Path) -> None:
    """反向对照:确有命中时 engine 必须是 ripgrep。

    没有这条,上面那个 parity 用例在"rg 恒 0 命中 + py 恒 0 命中"的坏状态下也会全绿
    (实测第一版就是这样:忘了传 `-n`,行号全解析失败,rg 一条不报而两侧'一致')。
    """
    files, _ = rgp.enumerate_code_files(
        repo_fixture, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    res = rgp.search_file_contents(repo_fixture, files=files, needle="hello", max_results=20)
    assert res.hits, "夹具里 hello 应有命中"
    assert res.provenance is not None and res.provenance.engine == rgp.ENGINE_RIPGREP
    assert all(h.line_numbers for h in res.hits), "命中却拿不到行号 ⇒ rg 通道输出形态没对上"


# ---------------------------------------------------------------------------
# 判据 4:懒索引护栏读到的分母不得因换通道而变
# ---------------------------------------------------------------------------


def test_lazy_index_guardrail_sees_same_denominator(repo_fixture: Path) -> None:
    """`_collect_code_files` 是兄弟护栏(`_LAZY_INDEX_MAX_FILES`)唯一的分母来源。

    护栏阈值 2000 在本仓之外、归口其持有者,但**它看到的数字必须与换通道前一致**;
    否则一次枚举改造就会悄悄改变"要不要索引"这个产品行为。
    """
    via_entry = codebase_indexer._collect_code_files(repo_fixture)
    with_prov, prov = codebase_indexer.collect_code_files_with_provenance(repo_fixture)
    legacy = _legacy_collect(repo_fixture)
    assert {p.relative_to(repo_fixture).as_posix() for p, _ in via_entry} == legacy
    assert {p.relative_to(repo_fixture).as_posix() for p, _ in with_prov} == legacy
    assert prov.engine in (rgp.ENGINE_RIPGREP, rgp.ENGINE_PYTHON_WALK)
    # 索引上限的复评事实登记在 codebase_indexer 注释里,这里把它钉成可断言的数:
    assert MAX_FILES_PER_INDEX == 5000, "改动上限必须与本票的实测依据同批落,不得顺手调"


def test_index_result_carries_traversal_provenance(repo_fixture: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """返回体必须带 engine 与耗时 —— 降级要能在响应里看得见,不得只在日志里。

    全程零网络、零生产库:写库与 embedding 两个出口都被就地替换成 async 桩,
    Merkle 快照改指夹具目录(`_MERKLE_SNAPSHOT_DIR` 是**导入期**求值的模块常量,
    所以必须 patch 那个名字,改 env 是无效的 —— 这是 §5 测试隔离铁律的同一类坑)。
    """
    import asyncio

    async def _fake_embeddings(_chunks: object) -> int:
        return 0

    async def _fake_write(*_a: object, **_k: object) -> dict[str, object]:
        return {}

    import app.services.codebase_indexer as ci

    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", repo_fixture / ".ihui-index-cache")
    monkeypatch.setattr(codebase_indexer, "_generate_embeddings_batch", _fake_embeddings)
    monkeypatch.setattr(codebase_indexer, "_write_to_api", _fake_write)

    res = asyncio.run(codebase_indexer.index_repository(str(repo_fixture), incremental=False))
    assert res.traversal_engine in (rgp.ENGINE_RIPGREP, rgp.ENGINE_PYTHON_WALK)
    assert res.traversal_duration_s >= 0.0
    assert res.traversal_files_seen > 0
    assert res.files_scanned > 0


# ---------------------------------------------------------------------------
# 判据 1 + 2:真仓规模与前/后读数
# ---------------------------------------------------------------------------


def _repo_root() -> Path | None:
    for cand in (Path.cwd(), Path(__file__).resolve().parents[3]):
        if (cand / "pnpm-workspace.yaml").is_file() and (cand / "apps").is_dir():
            return cand
    return None


def _tracked_code_files(root: Path) -> set[str]:
    """被 git **跟踪**、且命中本索引白名单、且不在忽略目录里的路径集合。

    为什么需要它:下面那条真仓用例原先断言"枚举到 ≥100,000 个文件",而那个数
    量的是**当时那台共享工作区**(node_modules/.venv/构建产物全在盘上 = 244,765)。
    2026-09-27 复评时同一命令在本机工作树读到 43,551、`git ls-files` 只有 13,092
    (其中命中扩展名白名单 10,649)⇒ 那条断言在干净检出上**永远不可能成立**,
    它锚的是机器状态而不是代码性质(AGENTS:"判据不得锚定仓库瞬时状态")。
    换成"跟踪的代码文件一个都不许漏"这条与规模无关的不变量,严格更强。
    """
    import subprocess

    out = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=str(root),
        capture_output=True,
        check=False,
    )
    if out.returncode != 0:
        return set()
    paths = {p.decode("utf-8", errors="replace").replace("\\", "/") for p in out.stdout.split(b"\0") if p}
    kept: set[str] = set()
    for rel in paths:
        parts = rel.split("/")
        if any(seg in _IGNORED_DIRS for seg in parts[:-1]):
            continue
        if rgp._suffix_of(parts[-1]) in _EXT_TO_LANG:
            kept.add(rel)
    return kept


def test_real_repo_enumeration_is_faster_than_serial_walk() -> None:
    """在真 monorepo 上给出前(串行 os.walk)/后(ripgrep)两组读数并断言更快。

    三条口径如实交代:
    - 差集只允许落在 `.ihui-agent/**`(并行代理的在飞临时物)与**符号链接文件**
      (rg 默认不收链接文件,而 os.walk 会列它;`--follow` 会带来 §26 的递归穿透风险,
      刻意不加)。任何落在此之外的分叉都算两通道不一致。
    - 耗时是共享机器上的量测,有其他代理在飞写入会抖;断言用"rg 严格快于串行",
      不钉绝对秒数 —— 绝对数写进交付报告,不写进判据(否则下次机器一慢就恒红)。
    - **规模断言与仓库状态解耦**:断的是"跟踪的代码文件全覆盖 + 没被内部上限截断",
      而不是"这台机器的工作区今天有几个文件"。"10 万文件级"由
      `scripts/measure_lazy_index_guardrail.py` 在**受控构造**的 2k/10k/50k/100k 树上量,
      那是可重跑的载体;工作区实际文件数是报告里的一个数,不是判据。
    """
    root = _repo_root()
    if root is None:
        pytest.fail("找不到 monorepo 根 —— 本用例的断言对象就是真仓,缺根即失败,不得静默通过")
    t0 = time.perf_counter()
    rg_paths, rprov = rgp.enumerate_with_rg(root, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG))
    rg_elapsed = time.perf_counter() - t0
    t0 = time.perf_counter()
    legacy = _legacy_collect(root)
    serial_elapsed = time.perf_counter() - t0

    assert rprov.degraded_reason is None, f"真仓上 rg 通道降级了:{rprov.degraded_reason}"
    assert rg_elapsed < serial_elapsed, (
        f"未变快:ripgrep {rg_elapsed:.2f}s vs 串行 os.walk {serial_elapsed:.2f}s"
    )
    # (1) 规模不变量一:**没有内部截断**。索引面的 MAX_FILES_PER_INDEX=5000 曾把
    #     护栏的分母做成饱和值(V3 #75 后半修的就是这一格),枚举面不得再犯同一个错。
    assert len(rg_paths) > 5_000, f"枚举数被截断了?只拿到 {len(rg_paths)} 个"
    # (2) 规模不变量二:被跟踪的代码文件一个都不许漏(与机器上有多少在飞文件无关)。
    tracked = _tracked_code_files(root)
    assert tracked, "拿不到 git 跟踪清单 —— 这条判据不得对着空集自证通过"
    missing = tracked - rg_paths
    for p in sorted(missing):
        # 唯一放过的情形:该路径确实已不在盘上(别人刚删、尚未提交)或是链接
        assert not (root / p).exists() or (root / p).is_symlink(), f"跟踪的代码文件被枚举漏了: {p}"
    divergent = (rg_paths - legacy) | (legacy - rg_paths)
    for p in divergent:
        in_agent_tmp = p.startswith(".ihui-agent/")
        is_link = os.path.islink(os.path.join(str(root), p.replace("/", os.sep)))
        assert in_agent_tmp or is_link, f"两通道在非在飞/非链接路径上分叉: {p}"
    print(
        f"[V75] files={len(rg_paths)} (legacy {len(legacy)}; tracked-code {len(tracked)}) "
        f"ripgrep={rg_elapsed:.3f}s serial={serial_elapsed:.3f}s "
        f"speedup={serial_elapsed / max(rg_elapsed, 1e-9):.1f}x divergent={len(divergent)}"
    )


def test_scratch_parent_is_never_on_system_drive() -> None:
    """夹具落点判据(§26):不得落 C 盘,且不得落在仓库树内。"""
    parent = _scratch_parent()
    assert not str(parent).upper().startswith("C:")
    assert Path.cwd() not in parent.resolve().parents, "夹具落在仓库树内会被自己的扫描吃到"


def test_no_fixture_left_behind() -> None:
    """反残留:按**前缀枚举父目录**,而不是只判一个字面名。"""
    parent = _scratch_parent()
    leftovers = sorted(p.name for p in parent.iterdir() if p.name.startswith(FIXTURE_PREFIX))
    assert not leftovers, f"夹具残留未清:{leftovers}"
    # 顺手确认 shutil 的递归删除没被 junction 穿透(§26 那一型):父目录本身仍在
    assert parent.is_dir()


def test_subprocess_carries_no_window_flag_on_windows() -> None:
    """派生子进程必须禁窗口(守门 52 同一条禁令,Python 侧要自己带)。"""
    if sys.platform != "win32":
        assert rgp._creation_flags_no_window() == 0
        return
    assert rgp._creation_flags_no_window() == 0x08000000
    src = (Path(__file__).resolve().parents[1] / "app" / "services" / "rg_fallback_parity.py").read_text(
        encoding="utf-8"
    )
    # 反向锁:每个 subprocess.run 都必须带 creationflags,漏一处就是回潮
    assert src.count("subprocess.run(") == src.count("creationflags=_creation_flags_no_window()"), (
        "存在未带 creationflags 的 subprocess.run ⇒ Windows 上会弹窗"
    )


def test_rg_binary_probe_reports_source() -> None:
    """rg 可用性判定的现读结果必须可打印、可追溯(供报告与排障)。"""
    binary = rgp.resolve_rg_binary()
    assert binary.source, "必须给出解析出处,不得只回一个布尔"
    if binary.path:
        probe = subprocess.run(
            [binary.path, "--version"],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=rgp._creation_flags_no_window(),
            check=False,
        )
        assert probe.returncode == 0 and "ripgrep" in probe.stdout
    else:
        # 没有 rg 也要有出路:降级通道必须真能跑出结果集
        paths, prov = rgp.enumerate_code_files(
            Path(__file__).resolve().parent, ignored_dirs=_IGNORED_DIRS, suffixes=(".py",)
        )
        assert prov.engine == rgp.ENGINE_PYTHON_WALK and prov.degraded_reason
        assert any(p.endswith(".py") for p in paths)


async def _call_file_search(root: str, pattern: str) -> dict:
    from app.services.mcp_server import _tool_file_search

    return await _tool_file_search({"path": root, "pattern": pattern, "query": "", "max_results": 200})


def test_tool_channel_parity_two_channels_return_same_file_set(tmp_path, monkeypatch):
    """V3 #75 接线段的判据:**工具级**两通道结果集必须等价。

    枚举层等价 ≠ 工具等价 —— 接线时把"跳二进制的黑名单"误当成"只要代码的白名单",
    枚举层的对账一点也不会红,而 file_search 会静默搜不到 .md/.json。这条测的就是那一格。
    """
    import asyncio

    for rel, body in (
        ("a.py", "x = 1\n"),
        ("notes.md", "hello\n"),
        ("conf.json", "{}\n"),
        ("sub/c.py", "y = 2\n"),
        ("big.png", "\x89PNG\r\n"),  # 黑名单扩展名:两通道都必须排除它
    ):
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")

    root = str(tmp_path.resolve())
    rg_res = asyncio.run(_call_file_search(root, "*"))
    assert rg_res["ok"] is True

    monkeypatch.setattr(rgp, "rg_is_disabled_by_env", lambda: True)
    walk_res = asyncio.run(_call_file_search(root, "*"))

    rg_paths = {m["path"] for m in rg_res["matches"]}
    walk_paths = {m["path"] for m in walk_res["matches"]}
    assert rg_paths == walk_paths, f"两通道结果集分叉: 只在rg={rg_paths - walk_paths} 只在walk={walk_paths - rg_paths}"
    # 黑名单语义被保住:二进制扩展名两通道都不许出现,而三个源码扩展名必须都在
    assert not any(p.endswith(".png") for p in rg_paths), rg_paths
    assert {"a.py", "notes.md", "conf.json"} <= rg_paths, rg_paths
    # 通道身份必须在响应里可读,降级不得静默
    assert rg_res["enum_engine"] != walk_res["enum_engine"], (rg_res["enum_engine"], walk_res["enum_engine"])
    assert walk_res["enum_degraded"], "强制降级没在响应里留原因"


def test_tool_fuzzy_branch_uses_same_enumeration(tmp_path):
    """模糊分支与非模糊分支共用一次枚举(原先各写一遍 os.walk)。"""
    import asyncio

    (tmp_path / "widget.py").write_text("z = 1\n", encoding="utf-8")
    res = asyncio.run(_call_file_search(str(tmp_path.resolve()), "*.py"))
    fuzzy = asyncio.run(
        _call_file_search_arg(str(tmp_path.resolve()), "*.py", "widg", True)
    )
    assert any(m["path"] == "widget.py" for m in res["matches"])
    assert fuzzy["fuzzy"] is True and any(m["path"] == "widget.py" for m in fuzzy["matches"])
    assert fuzzy["enum_engine"], "模糊分支没带枚举通道身份"


async def _call_file_search_arg(root: str, pattern: str, query: str, fuzzy: bool) -> dict:
    from app.services.mcp_server import _tool_file_search

    return await _tool_file_search(
        {"path": root, "pattern": pattern, "query": query, "fuzzy": fuzzy, "max_results": 50}
    )


def cleanup_fixtures() -> None:
    """供 -s 手动清理(不在 fixture 链上,避免被误当成判据)。"""
    parent = _scratch_parent()
    for p in parent.iterdir():
        if p.name.startswith(FIXTURE_PREFIX):
            shutil.rmtree(str(p), ignore_errors=True)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
