# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ripgrep / 串行遍历双通道枚举与内容检索 + **两通道结果对账**(PROJECT_PLAN V3 #75)。

为什么要有这个模块
------------------
`file_search` 与语义索引的枚举层原先是**纯 Python 串行 `os.walk`**,把整棵 monorepo
走一遍要 5.6-9.9s(真仓实测 244,765 个代码文件,共享工作区上有 6 个并发代理在打盘,
所以这是一个区间而不是一个数)。本模块把枚举换成 ripgrep(同批中位数 1.63s,
实测 **3.4-6.2 倍**);拿不到 rg 时退回**串行** `os.walk` —— 并行遍历这一条路
被本票实测否证了,数据与原因写在 `enumerate_with_walk()` 的 docstring 里。

不可妥协的一条(V3 #75 判据 3)
--------------------------------
两条通道**必须是同一份语义**。本仓最恨的就是"第二份真相",所以:

- 传给 rg 的过滤参数与 Python 通道的剪枝规则**同源于** `build_rg_file_args()`
  的两个入参(`ignored_dirs` / `suffixes`),不在两处各写一遍。
- `enumerate_code_files()` 的返回值带 `EnumerationProvenance`,**降级必须留痕**:
  engine 字段如实写 "python-walk" 并带 `degraded_reason`,不得用 rg 的名义报告
  一次纯 Python 扫描。
- `compare_enumerations()` 是两通道对账的唯一实现,测试与运行时自检共用它,
  禁止在测试里再抄一份判据(§22c)。

已知的一处语义差异(实测,不是猜的)
------------------------------------
`os.walk(followlinks=False)`(默认)**不**进入符号链接目录,但**会**把符号链接文件
列进 `filenames`;ripgrep 默认两者都跳过。真仓实测差异集恰好 1 项:
`.ihui-agent/tmp/isdirect-probe/link/probe.mjs`(一个链接文件)。
不加 `--follow` 的理由:加了会顺着链接目录递归,而 §26 记过"junction 被递归穿透"
把改道机制变成自毁机制的那一型;链接**文件**少列一个不构成检索语义破损。
对账函数把这一型差异归入 `symlink_only`,**如实计数、不判为不一致**。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

#: rg 进程超时(秒)。守门 80 那条"热路径 git 调用必须带 timeout"是同一条理由:
#: 没有超时的派生调用会把一次挂起变成整条链路无界等待。
_RG_TIMEOUT_SECONDS: Final[float] = 120.0

#: 并行遍历的线程数上限。**保留仅为说明它不该被用** —— 见
#: `enumerate_with_walk()` 的实测否证表(两版线程池实现都比串行慢一个数量级)。
#: 想再试并行的人请先复现那张表,不要直接接进降级通道。
_PARALLEL_WALK_MAX_WORKERS: Final[int] = 8

#: 引擎标识(出现在返回体与日志里,是"降级留痕"的载体)。
ENGINE_RIPGREP: Final[str] = "ripgrep"
ENGINE_PYTHON_WALK: Final[str] = "python-walk"

#: 环境变量强制降级为 Python 通道 —— 供 A/B 对账与应急使用,不是静默开关:
#: 一旦置位,provenance.engine 就是 python-walk 且 reason 明确写 "forced-by-env"。
ENV_DISABLE_RG: Final[str] = "IHUI_DISABLE_RIPGREP_ENUMERATION"


@dataclass(frozen=True)
class RgBinary:
    """解析到的 ripgrep 可执行文件与其出处。"""

    path: str
    source: str  # "env:IHUI_RIPGREP_PATH" / "path" / "none"


@dataclass
class EnumerationProvenance:
    """一次枚举用了哪条通道、为什么 —— **降级不得静默**。"""

    engine: str
    duration_s: float
    counted: int
    rg_source: str = ""
    degraded_reason: str | None = None
    #: rg 通道跑了但被判不可信(输出解析异常等)而回退 Python 时,原委记这里。
    fallback_detail: str | None = None


@dataclass
class EnumerationDiff:
    """两通道对账结论。`consistent` 才是"同一份语义"的判据。"""

    rg_count: int
    py_count: int
    rg_only: tuple[str, ...]
    py_only: tuple[str, ...]
    #: 仅因"链接文件 rg 默认不收"造成的差异,归到这一格如实计数(见模块 docstring)。
    symlink_only: tuple[str, ...]
    rg_elapsed_s: float
    py_elapsed_s: float

    @property
    def consistent(self) -> bool:
        """语义一致 = 非链接类的双向差集都为空。"""
        return not self.rg_only and not self.py_only

    @property
    def summary(self) -> str:
        speedup = (self.py_elapsed_s / self.rg_elapsed_s) if self.rg_elapsed_s > 0 else float("inf")
        return (
            f"ripgrep={self.rg_count} python={self.py_count} "
            f"rg_only={len(self.rg_only)} py_only={len(self.py_only)} "
            f"symlink_only={len(self.symlink_only)} "
            f"elapsed {self.rg_elapsed_s:.3f}s vs {self.py_elapsed_s:.3f}s (x{speedup:.1f})"
        )


# ---------------------------------------------------------------------------
# rg 可用性解析(判据 ①PATH → ②仓内/工具链自带 → ③降级)
# ---------------------------------------------------------------------------


def resolve_rg_binary() -> RgBinary:
    """定位 ripgrep 可执行文件。

    顺序:① `IHUI_RIPGREP_PATH` 显式指定(部署机/CI 用绝对路径,不赌 PATH);
    ② PATH 上的 `rg`。**没有第 ③ 档内置副本** —— 本票禁止为跑通而下载第三方二进制,
    所以拿不到就是拿不到,调用方走降级通道并如实留痕。
    """
    if rg_is_disabled_by_env():
        return RgBinary(path="", source="disabled-by-env")
    override = (os.environ.get("IHUI_RIPGREP_PATH") or "").strip()
    if override:
        if Path(override).is_file():
            return RgBinary(path=override, source="env:IHUI_RIPGREP_PATH")
        return RgBinary(path="", source="env:IHUI_RIPGREP_PATH(missing)")
    found = shutil.which("rg") or shutil.which("rg.exe")
    if found:
        return RgBinary(path=found, source="path")
    return RgBinary(path="", source="none")


def rg_is_disabled_by_env() -> bool:
    raw = (os.environ.get(ENV_DISABLE_RG) or "").strip().lower()
    return bool(raw) and raw not in {"0", "false", "no"}


# ---------------------------------------------------------------------------
# 参数构造:两通道共用的**唯一**一份过滤语义
# ---------------------------------------------------------------------------


def build_rg_file_args(
    *,
    ignored_dirs: frozenset[str] | set[str],
) -> list[str]:
    """把"剪枝目录"翻成 rg `--files` 的参数。

    **扩展名过滤刻意不在这里做**,两个实测理由:
    1. rg 的 `-g '*.py'` 在本机(ripgrep 15.0.0 / Windows)对大写扩展名不敏感化
       **失败**:实测 `a/Y.PY` 被 Python 通道收到、被带 `-g *.py` 的 rg 漏掉,而加
       `--ignore-case` 也修不好(glob 匹配与内容匹配是两套大小写规则)。
    2. 更根本的:扩展名白名单只要写两处就必然与 `_EXT_TO_LANG` 漂移(本仓记过最多次
       的失败型就是"两处算同一件事")。所以 rg 只做**目录剪枝**(它快的那部分),
       扩展名判定由 `normalize_suffixes()` + `_matches_suffix()` 一份实现喂两条通道。

    必须带的 flag(少一个就是两套答案,均实测):
    - `--no-ignore`:否则 rg 按 `.gitignore` 收文件,而 `os.walk` 不看 gitignore。
      真仓实测带与不带是 12,919 vs 244,746 文件 —— 差 19 倍,这不是快慢而是两套答案。
    - `--hidden`:rg 默认跳过点开头目录而 `os.walk` 不跳;真仓实测这一条吃掉 23 万
      多个文件(`.cxx-modules-staging/**` 那一整片 CMake 产物)。
    - 目录剪枝 glob **必须带尾斜杠**。不带斜杠的写法会连同名文件一起排除,
      语义与 `os.walk` 的 `d not in _IGNORED_DIRS` 不同。
    """
    return [
        "--files",
        "--no-ignore",
        "--hidden",
        *(x for d in sorted(ignored_dirs) for x in ("-g", f"!{d}/")),
    ]


def normalize_suffixes(suffixes: tuple[str, ...] | list[str] | frozenset[str] | None) -> frozenset[str] | None:
    """扩展名白名单归一(小写 + 带点)—— 两条通道共用的唯一一份实现。

    `None` = **不按扩展名过滤**(调用方自带黑名单语义,如 `file_search` 跳二进制而非"只要代码")。
    这一档必须存在而不是在调用方再写一遍过滤:否则两条通道的扩展名判定又会各算一次,
    本模块存在的理由(枚举面只有一份实现)就被自己推翻。
    """
    if suffixes is None:
        return None
    return frozenset(s.lower() if s.startswith(".") else f".{s.lower()}" for s in suffixes)


def _suffix_of(name: str) -> str:
    dot = name.rfind(".")
    return "" if dot <= 0 else name[dot:].lower()


def _matches_suffix(name: str, suffix_set: frozenset[str] | None) -> bool:
    if suffix_set is None:
        return True
    return _suffix_of(name) in suffix_set


# ---------------------------------------------------------------------------
# 通道 A:ripgrep
# ---------------------------------------------------------------------------


def _creation_flags_no_window() -> int:
    """Windows 下派生控制台程序必须禁窗口(§5b 守门 52 同一条禁令)。

    机器级 windowsHide 钩子只覆盖独立 node.exe,**Python 侧的 subprocess 得自己带**。
    """
    return 0x08000000 if sys.platform == "win32" else 0


def enumerate_with_rg(
    root: Path,
    *,
    ignored_dirs: frozenset[str] | set[str],
    suffixes: tuple[str, ...] | list[str] | frozenset[str] | None,
    rg: RgBinary | None = None,
    max_files: int | None = None,
) -> tuple[set[str], EnumerationProvenance]:
    """用 ripgrep 枚举匹配扩展名的代码文件,返回**相对 root 的 posix 路径集合**。"""
    binary = rg or resolve_rg_binary()
    t0 = time.perf_counter()
    if not binary.path:
        return (
            set(),
            EnumerationProvenance(
                engine=ENGINE_RIPGREP,
                duration_s=time.perf_counter() - t0,
                counted=0,
                rg_source=binary.source,
                degraded_reason=f"ripgrep 不可用(解析结果 source={binary.source}),本结果不可用于对账",
            ),
        )
    # 让 rg 以 root 为 cwd 输出**相对路径**:省掉每行一次 os.path.relpath/normpath。
    # 实测这处优化决定成败 —— 逐行 relpath 时 24.4 万文件的枚举要 7.96s(比 Python
    # 串行遍历 9.33s 只快 1.2 倍),改成相对直出后回到亚秒级。
    argv = [binary.path, *build_rg_file_args(ignored_dirs=ignored_dirs), "."]
    suffix_set = normalize_suffixes(suffixes)
    try:
        proc = subprocess.run(  # noqa: S603 - argv 全为受控字面量 + 已解析的二进制绝对路径
            argv,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=_RG_TIMEOUT_SECONDS,
            creationflags=_creation_flags_no_window(),
            cwd=str(root),
            check=False,
        )
    except subprocess.TimeoutExpired:
        return (
            set(),
            EnumerationProvenance(
                engine=ENGINE_RIPGREP,
                duration_s=time.perf_counter() - t0,
                counted=0,
                rg_source=binary.source,
                degraded_reason=f"ripgrep 超时 >{_RG_TIMEOUT_SECONDS}s",
            ),
        )
    except OSError as e:
        return (
            set(),
            EnumerationProvenance(
                engine=ENGINE_RIPGREP,
                duration_s=time.perf_counter() - t0,
                counted=0,
                rg_source=binary.source,
                degraded_reason=f"ripgrep 派生失败: {e}",
            ),
        )

    # rg 退出码约定:0=有匹配, 1=无匹配(不是错误), >=2 才是真失败。
    # 把 1 当错误会让空目录/无命中这一**合法**场景被误判成"通道坏了"并触发降级。
    if proc.returncode not in (0, 1):
        return (
            set(),
            EnumerationProvenance(
                engine=ENGINE_RIPGREP,
                duration_s=time.perf_counter() - t0,
                counted=0,
                rg_source=binary.source,
                degraded_reason=f"ripgrep 退出码 {proc.returncode}: {(proc.stderr or '')[:200]}",
            ),
        )

    paths: set[str] = set()
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        # cwd=root ⇒ rg 直出相对路径;只做分隔符归一,不再逐行 relpath。
        rel = line.strip().replace("\\", "/")
        # 搜 "." 时 rg 会输出 `./a/x.py` 这种带前缀形态,不剥掉就会与 Python 通道的
        # `a/x.py` **整体错配**(实测差集 489,510 = 全集,即两条通道"看起来全不一样",
        # 而两边各自都自洽 —— 这是最难发现的一类假绿)。
        while rel.startswith("./"):
            rel = rel[2:]
        if not rel or rel == ".":
            continue
        # 扩展名判定走**同一份** _matches_suffix(不在 rg 侧再写一遍 glob),
        # 否则"两条通道同一结果集"要靠两个实现碰巧一致 —— 那正是本仓最高频的失效型。
        if not _matches_suffix(rel.rsplit("/", 1)[-1], suffix_set):
            continue
        paths.add(rel)
        if max_files is not None and len(paths) >= max_files:
            break
    return (
        paths,
        EnumerationProvenance(
            engine=ENGINE_RIPGREP,
            duration_s=time.perf_counter() - t0,
            counted=len(paths),
            rg_source=binary.source,
        ),
    )


def _to_rel_posix(raw: str, root: Path) -> str:
    """把 rg 输出的一行规整成"相对 root 的 posix 路径"。

    rg 的输出绝对性取决于调用时传的是绝对 root(本模块始终传 `str(root)` 绝对路径),
    但 Windows 下反斜杠与盘符大小写仍需归一 —— 不对这一维做归一,对账会把
    **同一批文件**读成双向差集。
    """
    p = raw.strip().strip('"')
    try:
        ap = Path(p) if os.path.isabs(p) else root / p
        rel = os.path.relpath(os.path.normpath(str(ap)), str(root))
    except ValueError:
        # Windows:跨盘符 relpath 抛 ValueError,原样返回并交给上层判差集
        rel = p
    return rel.replace("\\", "/")


# ---------------------------------------------------------------------------
# 通道 B:串行 Python 遍历(rg 不可用时的降级,也是语义基准)
# ---------------------------------------------------------------------------


def enumerate_with_walk(
    root: Path,
    *,
    ignored_dirs: frozenset[str] | set[str],
    suffixes: tuple[str, ...] | list[str] | frozenset[str] | None,
    max_files: int | None = None,
) -> tuple[set[str], EnumerationProvenance]:
    """串行 `os.walk` 遍历 —— 降级通道刻意**沿用被替换掉的那个算法**。

    为什么不做成"并行遍历"(票面给的另一条路):**实测否证**。
    在 `G:\\IHUI-AI\\apps\\`(13,059 个代码文件)三 reps 中位数:

    | 通道                              | 耗时              |
    | --------------------------------- | ----------------- |
    | ripgrep                           | **0.311s**        |
    | 串行 os.walk                      | **1.231s**        |
    | 线程池并行遍历(每层栅栏版)      | ~11s(全仓实测)  |
    | 线程池并行遍历(连续提交版)      | **17.450s**       |

    两版并行实现都比串行**慢一个数量级**(连续提交版慢 14 倍)——目录枚举在这块
    盘上是 I/O 串行主导,线程池只添同步开销;而 `wait(FIRST_COMPLETED)` 对着一个
    会涨到几万个 future 的集合每次都要全量同步,直接把它变成 O(N²)。
    所以本票的结论是:**加速来自 ripgrep,并行遍历是走了死路**;降级通道必须
    至少不比被替换的实现慢,故用回 `os.walk`。留这段数字是为了让下一个人不必
    再花两小时重新发明同一个错误。

    与 `os.walk(followlinks=False)` 的既有语义逐字对齐(它就是原实现),因此
    接入既有调用方不需要任何"新通道"分支。
    """
    t0 = time.perf_counter()
    suffix_set = normalize_suffixes(suffixes)
    results: set[str] = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ignored_dirs]
        for fname in filenames:
            if not _matches_suffix(fname, suffix_set):
                continue
            results.add(_to_rel_posix(os.path.join(dirpath, fname), root))
            if max_files is not None and len(results) >= max_files:
                return (
                    results,
                    EnumerationProvenance(
                        engine=ENGINE_PYTHON_WALK,
                        duration_s=time.perf_counter() - t0,
                        counted=len(results),
                    ),
                )
    return (
        results,
        EnumerationProvenance(
            engine=ENGINE_PYTHON_WALK,
            duration_s=time.perf_counter() - t0,
            counted=len(results),
        ),
    )




# ---------------------------------------------------------------------------
# 统一出口:先 rg,降级串行遍历,**并留痕**
# ---------------------------------------------------------------------------


def enumerate_code_files(
    root: Path,
    *,
    ignored_dirs: frozenset[str] | set[str],
    suffixes: tuple[str, ...] | list[str] | frozenset[str] | None,
    max_files: int | None = None,
    prefer_rg: bool = True,
) -> tuple[list[str], EnumerationProvenance]:
    """枚举代码文件 → (相对 posix 路径列表(稳定排序), provenance)。

    返回**稳定排序**是契约的一部分:调用方(`_collect_code_files`)按序截断
    `max_files`,无序集合会让同一棵树两次枚举给出不同文件子集 —— 那会让
    Merkle 快照与懒索引护栏在轮次之间无谓抖动。
    """
    rg: RgBinary | None = None
    if prefer_rg and not rg_is_disabled_by_env():
        rg = resolve_rg_binary()
    if rg is not None and rg.path:
        paths, prov = enumerate_with_rg(
            root, ignored_dirs=ignored_dirs, suffixes=suffixes, rg=rg, max_files=max_files
        )
        if prov.degraded_reason is None:
            return sorted(paths), prov
        # rg 跑了但坏了:降级,**且把原委带进 provenance**,不得只换个 engine 名。
        fallback_detail = prov.degraded_reason
    else:
        fallback_detail = (
            "IHUI_DISABLE_RIPGREP_ENUMERATION 置位(人为强制降级,用于 A/B 对账)"
            if rg_is_disabled_by_env()
            else f"ripgrep 未解析到可执行文件(source={(rg.source if rg else 'not-probed')})"
        )

    paths, prov = enumerate_with_walk(
        root, ignored_dirs=ignored_dirs, suffixes=suffixes, max_files=max_files
    )
    prov.degraded_reason = fallback_detail
    prov.fallback_detail = fallback_detail
    return sorted(paths), prov


@dataclass(frozen=True)
class SizeProbe:
    """一次**有界**规模探测的结论 —— 精确值与下界在类型上分开,不得混成一个整数。

    `is_lower_bound=True` 的含义是"数到 `limit` 就收手了,真实规模未知且不小于此"。
    护栏据此把"仓库大到索引不完"与"这次不该顺手做"分成两条不同的轴:把下界当精确值
    用,就会把 874 文件的小仓报成"巨仓"(第一版即此错,已由测试钉住)。
    """

    count: int
    is_lower_bound: bool
    limit: int
    duration_s: float
    engine: str
    degraded_reason: str | None = None

    def describe(self) -> str:
        """给人和模型看的一句话规模 —— 下界必须带"至少",否则读不出可信度。"""
        n = f"至少 {self.count}" if self.is_lower_bound else str(self.count)
        return f"{n} 个代码文件"


def probe_code_file_count(
    root: Path,
    *,
    ignored_dirs: frozenset[str] | set[str],
    suffixes: tuple[str, ...] | list[str] | frozenset[str] | None,
    limit: int,
) -> SizeProbe:
    """数"这棵树有多大",但**最多数到 `limit` 就停**,并如实报是精确值还是下界。

    走的是 `enumerate_code_files` 这同一条枚举出口(先 rg、降级留痕),所以探测读到
    的规模与实际索引读到的**必然同形** —— 另写一份遍历就是第二个真相,两条通道对
    "有多少文件"答不同值时护栏结论会随通道跳变。

    探测本身有界(`max_files` 一到即返回),所以"问一句多大"不会变成走一遍全树。
    """
    if limit < 1:
        raise ValueError(
            f"limit 必须 ≥ 1,收到 {limit}:limit=0 会让任何目录都被判成下界 ⇒ 护栏恒判超限"
        )
    paths, prov = enumerate_code_files(
        root, ignored_dirs=ignored_dirs, suffixes=suffixes, max_files=limit
    )
    counted = len(paths)
    return SizeProbe(
        count=counted,
        is_lower_bound=counted >= limit,
        limit=limit,
        duration_s=prov.duration_s,
        engine=prov.engine,
        degraded_reason=prov.degraded_reason,
    )


# ---------------------------------------------------------------------------
# 对账:判据 3 的唯一实现(测试与运行时共用)
# ---------------------------------------------------------------------------


def compare_enumerations(
    root: Path,
    *,
    ignored_dirs: frozenset[str] | set[str],
    suffixes: tuple[str, ...] | list[str] | frozenset[str] | None,
) -> EnumerationDiff:
    """同一 query(枚举意图)跑两条通道,给出逐项差集。

    这是"两条路径同一结果集"的**尺子本体**;任何一侧改了过滤语义,这里必红。
    测试必须调用它,禁止在测试里内联一份判据副本(§22c)。
    """
    rg_paths, rg_prov = enumerate_with_rg(root, ignored_dirs=ignored_dirs, suffixes=suffixes)
    py_paths, py_prov = enumerate_with_walk(root, ignored_dirs=ignored_dirs, suffixes=suffixes)
    rg_only = rg_paths - py_paths
    py_only_raw = py_paths - rg_paths
    # py_only 里"其实是链接文件"的那一归入 symlink_only:rg 默认不收链接文件,
    # 这是文档化的差异,不是语义破损。判定用 islink(),不猜。
    symlink_only = {p for p in py_only_raw if _is_link_file(root, p)}
    return EnumerationDiff(
        rg_count=len(rg_paths),
        py_count=len(py_paths),
        rg_only=tuple(sorted(rg_only)),
        py_only=tuple(sorted(py_only_raw - symlink_only)),
        symlink_only=tuple(sorted(symlink_only)),
        rg_elapsed_s=rg_prov.duration_s,
        py_elapsed_s=py_prov.duration_s,
    )


def _is_link_file(root: Path, rel_posix: str) -> bool:
    try:
        return os.path.islink(os.path.join(str(root), rel_posix.replace("/", os.sep)))
    except OSError:
        return False


# ---------------------------------------------------------------------------
# 内容检索:同一份 query 的两条通道(file_search 用的那一层)
# ---------------------------------------------------------------------------


@dataclass
class ContentHit:
    """一条内容命中。`line_numbers` 升序、去重,两条通道必须逐字同形。"""

    path: str
    line_numbers: list[int]
    size: int = 0


@dataclass
class ContentScanResult:
    hits: list[ContentHit] = field(default_factory=list)
    provenance: EnumerationProvenance | None = None
    scanned_files: int = 0
    truncated: bool = False
    #: rg 输出里解析不出行号的行数。必须显式带出 —— 静默丢弃会把"通道坏了"
    #: 伪装成"就是没命中"(实测踩过:全部命中被丢光而报告一切正常)。
    unparsed_lines: int = 0


def _python_content_match_one(
    abs_path: str, needle_lower: str, max_lines: int
) -> tuple[list[int], int] | None:
    """纯 Python 内容匹配(基准语义):**子串、忽略大小写、不要求词边界**。

    与既有 `file_search` 的实现保持一致:整读 + `content.lower()` 包含判断,
    再逐行取命中行号。返回 None = 不命中或读不了(OSError/解码按 errors=ignore 容错)。
    """
    try:
        with open(abs_path, encoding="utf-8", errors="ignore") as f:  # noqa: PTH123 - 热路径要的是快,不必再过 Path
            content = f.read()
    except OSError:
        return None
    if needle_lower not in content.lower():
        return None
    lines = content.splitlines()
    numbers: list[int] = []
    for i, ln in enumerate(lines):
        if needle_lower in ln.lower():
            numbers.append(i + 1)
            if len(numbers) >= max_lines:
                break
    return (numbers, len(content))


def search_file_contents(
    root: Path,
    *,
    files: list[str],
    needle: str,
    max_results: int,
    max_lines_per_file: int = 10,
    prefer_rg: bool = True,
) -> ContentScanResult:
    """在给定文件集里做内容检索,rg 优先、Python 兜底,**两条通道结果集等价**。

    等价性靠三点实现,不靠"看起来差不多":
    1. 匹配语义固定为**不区分大小写的字面量子串** —— rg 侧用 `-F`(固定字符串)+
       `-i`,绝不用正则方言(否则 `.` `*` `[` 在两条通道含义不同,这正是本票
       点名的"include/exclude/大小写/正则方言差异")。
    2. 文件集由调用方给定(同一份枚举),rg 用 `--` 显式接文件列表而不是自己再枚举一遍。
    3. 命中行号来自 rg 的 `path:lineno:` 输出,与 Python 逐行扫描同一个编号基准(1-based)。
    """
    if not needle:
        return ContentScanResult()
    t0 = time.perf_counter()
    rg = resolve_rg_binary() if prefer_rg and not rg_is_disabled_by_env() else None
    if rg is not None and rg.path:
        res = _search_with_rg(root, rg, files, needle, max_results, max_lines_per_file, t0)
        if res.provenance is not None and res.provenance.degraded_reason is None:
            return res
        reason = res.provenance.degraded_reason if res.provenance else "unknown"
    else:
        reason = "ripgrep 未解析到可执行文件或已被 env 关闭"
    py = _search_with_python(root, files, needle, max_results, max_lines_per_file, t0, reason)
    return py


def _search_with_rg(
    root: Path,
    rg: RgBinary,
    files: list[str],
    needle: str,
    max_results: int,
    max_lines: int,
    t0: float,
) -> ContentScanResult:
    per_file: dict[str, list[int]] = {}
    order: list[str] = []
    unparsed = 0
    for chunk_start in range(0, len(files), 200):
        chunk = files[chunk_start : chunk_start + 200]
        argv = [
            rg.path,
            "--no-heading",
            "--with-filename",
            "-n",  # **行号必须显式要**:`--no-heading` 下 rg 默认不输出行号,少了这个
            # flag 的每一行都会解析失败 ⇒ 命中被丢光而报告看起来像"就是没匹配"。
            # 本模块第一版就中过这条(实测 rg=0 / python=4),由 T3 对账用例逼出。
            "-i",  # 忽略大小写:与 Python 通道的 needle.lower() + ln.lower() 同义
            "-F",  # 固定字符串:关掉正则方言这一整类差异
            "--color",
            "never",
            "--",
            needle,
            *chunk,
        ]
        try:
            proc = subprocess.run(  # noqa: S603 - argv 受控
                argv,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=_RG_TIMEOUT_SECONDS,
                creationflags=_creation_flags_no_window(),
                cwd=str(root),
                check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as e:
            return ContentScanResult(
                provenance=EnumerationProvenance(
                    engine=ENGINE_RIPGREP,
                    duration_s=time.perf_counter() - t0,
                    counted=0,
                    rg_source=rg.source,
                    degraded_reason=f"ripgrep 内容检索失败,已降级 Python 通道: {e}",
                )
            )
        if proc.returncode not in (0, 1):
            return ContentScanResult(
                provenance=EnumerationProvenance(
                    engine=ENGINE_RIPGREP,
                    duration_s=time.perf_counter() - t0,
                    counted=0,
                    rg_source=rg.source,
                    degraded_reason=f"ripgrep 内容检索退出码 {proc.returncode}",
                )
            )
        # 输出形如 <path>:<lineno>:<content>。这里**必须**配上面的 cwd=root + 相对路径:
        # 绝对路径在 Windows 上带盘符冒号(`G:\...`),左侧第一个 ':' 是盘符而不是
        # 分隔符,行号会解析失败并**静默丢掉全部命中**(实测 rg=0 / python=4 就是这么来的)。
        # 解析不出行号的行不静默丢弃,计入 unparsed 如实报数。
        for line in proc.stdout.splitlines():
            first = line.find(":")
            second = line.find(":", first + 1)
            if first < 0 or second < 0:
                unparsed += 1
                continue
            raw_path = line[:first]
            lineno_txt = line[first + 1 : second]
            if not lineno_txt.isdigit():
                unparsed += 1
                continue
            rel = raw_path.replace("\\", "/")
            numbers = per_file.get(rel)
            if numbers is None:
                numbers = []
                per_file[rel] = numbers
                order.append(rel)
            numbers.append(int(lineno_txt))
        if len(order) >= max_results:
            break
    hits: list[ContentHit] = []
    for rel in order[:max_results]:
        nums = sorted(set(per_file[rel]))
        hits.append(ContentHit(path=rel, line_numbers=nums[:max_lines], size=0))
    truncated = len(order) > max_results
    # 有行没解析出来、又一条没命中 ⇒ rg 通道的结果不可信(极可能就是输出形态变了),
    # 判 degraded 让上层回落 Python 并留痕 —— 不得把"看不见"洗成"确实没有"。
    unparsed_reason = (
        f"ripgrep 输出有 {unparsed} 行解析不出行号且命中为 0,通道不可信"
        if (unparsed and not hits)
        else None
    )
    return ContentScanResult(
        hits=hits,
        scanned_files=len(files),
        truncated=truncated,
        unparsed_lines=unparsed,
        provenance=EnumerationProvenance(
            engine=ENGINE_RIPGREP,
            duration_s=time.perf_counter() - t0,
            counted=len(hits),
            rg_source=rg.source,
            degraded_reason=unparsed_reason,
        ),
    )


def _search_with_python(
    root: Path,
    files: list[str],
    needle: str,
    max_results: int,
    max_lines: int,
    t0: float,
    reason: str | None,
) -> ContentScanResult:
    needle_lower = needle.lower()
    hits: list[ContentHit] = []
    for rel in files:
        if len(hits) >= max_results:
            break
        got = _python_content_match_one(os.path.join(str(root), rel.replace("/", os.sep)), needle_lower, max_lines)
        if got is None:
            continue
        numbers, size = got
        hits.append(ContentHit(path=rel, line_numbers=numbers, size=size))
    return ContentScanResult(
        hits=hits,
        scanned_files=len(files),
        truncated=len(hits) >= max_results,
        provenance=EnumerationProvenance(
            engine=ENGINE_PYTHON_WALK,
            duration_s=time.perf_counter() - t0,
            counted=len(hits),
            degraded_reason=reason,
        ),
    )


__all__ = [
    "ENGINE_PYTHON_WALK",
    "ENGINE_RIPGREP",
    "ENV_DISABLE_RG",
    "ContentHit",
    "ContentScanResult",
    "EnumerationDiff",
    "EnumerationProvenance",
    "RgBinary",
    "SizeProbe",
    "build_rg_file_args",
    "compare_enumerations",
    "normalize_suffixes",
    "enumerate_code_files",
    "enumerate_with_walk",
    "enumerate_with_rg",
    "probe_code_file_count",
    "resolve_rg_binary",
    "search_file_contents",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
