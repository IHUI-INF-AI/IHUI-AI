# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #75 后半(懒索引护栏复评)的**取证量算仪** —— 只读仓库,零网络、零生产库。

它存在的理由:`mcp_server._LAZY_INDEX_MAX_FILES = 2000` 从立那一天起就没有依据
(2026-09-07 随手定的字面量),而票面要求"对 10 万文件级 monorepo 复评"。复评需要
**量到的数**,不是更大的猜测。本脚本把护栏真正该守的两条成本轴分开量:

  轴 A 枚举成本(本票前半已把 rg 换进来)—— `enumerate_with_rg` / `enumerate_with_walk`
        在受控规模树与真仓上的墙钟/CPU 时间;
  轴 B 下游每文件成本 —— `index_repository` 里**本地可测**的那部分
        (读文件 + sha256 + 切片),以及**只数不计时**的 embedding 批量数
        (`_generate_embeddings_batch` 会打真实 LLM API,`_write_to_api` 会打
         apps/api → 生产库,二者按 §5 测试隔离铁律**一律不调用**,详见下文 UNMEASURED)。

三条纪律(都是本仓踩过才写进来的):

1. **不碰仓库**:只读 `G:\\IHUI-AI`(或 `--repo` 指定),一个字节都不写;受控规模的树
   造在**与工作树同盘**的 `DevEnv/Temp` 下并带 `ihui-v75-calib-` 前缀,结束时按前缀
   自证清干净(§26 反残留那一型:只看一个字面名会漏掉 `…-try2` 这类派生名)。
2. **外推假设写明**:树是合成的(每文件行数/字节数固定),真仓文件的行密度不同,
   所以"每文件成本"按 `--sample` 从真仓**真实文件**上量,合成树只用于量枚举的规模标度。
   两个口径分开报,不得拿合成数当真仓数。
3. **"量不到"不写成"通过"**:embedding/DB 延迟、tree-sitter 可用性这类**本机不成立**
   的条件一律进 `UNMEASURED` 清单并打印原因。护栏常量只建立在量到的轴上。

用法:
    .venv/Scripts/python.exe scripts/measure_lazy_index_guardrail.py
    .venv/Scripts/python.exe scripts/measure_lazy_index_guardrail.py --json
    .venv/Scripts/python.exe scripts/measure_lazy_index_guardrail.py --scales 2000,10000 --no-real-repo
"""

from __future__ import annotations

import argparse
import gc
import hashlib
import json
import os
import random
import shutil
import statistics
import sys
import time
import tracemalloc
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Final

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# 控制台代码页是 GBK 时,中文与 ⇒ 这类字符会把 print 直接打死(实测:本脚本第一版
# 就死在 UnicodeEncodeError 上)。取证脚本的输出**必须**比机器码页更硬,否则拿不到数:
# 一律把 stdout/stderr 重配成 UTF-8,不可编码时降级替换而不是抛错。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):  # 非 tty / 已被替换的流:原样跑,不因此放弃量算
        pass

from app.services import rg_fallback_parity as rgp  # noqa: E402
from app.services.codebase_indexer import (  # noqa: E402
    _EXT_TO_LANG,
    _IGNORED_DIRS,
    EMBEDDING_BATCH_SIZE,
    MAX_FILES_PER_INDEX,
    codebase_indexer,
)

CALIB_PREFIX: Final[str] = "ihui-v75-calib-"
#: 默认量程含 **100,000** 档:票面写的是"10 万文件级复评",而工作区的文件数
#: 不是可重跑的载体(实测同一命令在不同检出上读到 13,092 / 43,551 / 244,765)。
#: 所以"10 万级"这条**必须在受控构造的树上量**,这一档就是它的载体。
DEFAULT_SCALES: Final[tuple[int, ...]] = (2_000, 10_000, 50_000, 100_000)
#: 每个合成文件的行数(≈ 真仓代码文件的中位密度,见 --sample 的真仓中位数对照)
LINES_PER_SYNTH_FILE: Final[int] = 60
#: 真仓取样文件数(轴 B 每文件成本的样本;太少会被单个大文件拽偏)
REAL_SAMPLE_FILES: Final[int] = 1_200


# ---------------------------------------------------------------------------
# 结构
# ---------------------------------------------------------------------------


@dataclass
class Sample:
    """一次测量的一个样本(墙钟 + CPU)。"""

    wall_s: float
    cpu_s: float


@dataclass
class ScaleRow:
    """一个受控规模下所有通道的读数。"""

    files: int
    bytes_per_file: int
    rg: list[Sample] = field(default_factory=list)
    walk: list[Sample] = field(default_factory=list)
    probe_limited: list[Sample] = field(default_factory=list)
    #: 枚举结果集的 Python 侧峰值内存(字节)—— 量的是护栏能控住的那一维
    peak_set_bytes: int = 0
    counted_by_rg: int = 0
    counted_by_walk: int = 0
    channels_agree: bool = False

    @staticmethod
    def _median(rows: list[Sample], attr: str) -> float:
        return statistics.median([getattr(s, attr) for s in rows]) if rows else 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "files": self.files,
            "bytes_per_file": self.bytes_per_file,
            "rg_median_wall_s": round(ScaleRow._median(self.rg, "wall_s"), 4),
            "rg_median_cpu_s": round(ScaleRow._median(self.rg, "cpu_s"), 4),
            "rg_all_wall_s": [round(s.wall_s, 4) for s in self.rg],
            "walk_median_wall_s": round(ScaleRow._median(self.walk, "wall_s"), 4),
            "walk_median_cpu_s": round(ScaleRow._median(self.walk, "cpu_s"), 4),
            "walk_all_wall_s": [round(s.wall_s, 4) for s in self.walk],
            "probe_at_max_files_median_wall_s": round(ScaleRow._median(self.probe_limited, "wall_s"), 4),
            "speedup_walk_over_rg": round(
                (ScaleRow._median(self.walk, "wall_s") / max(ScaleRow._median(self.rg, "wall_s"), 1e-9)), 2
            ),
            "peak_set_mb": round(self.peak_set_bytes / (1024 * 1024), 2),
            "bytes_per_counted_file": round(self.peak_set_bytes / max(self.counted_by_rg, 1)),
            "counted_by_rg": self.counted_by_rg,
            "counted_by_walk": self.counted_by_walk,
            "channels_agree": self.channels_agree,
        }


@dataclass
class PerFileCost:
    """轴 B:每文件本地成本 + 切片产出。"""

    files: int
    total_bytes: int
    total_lines: int
    total_wall_s: float
    total_cpu_s: float
    chunks: int
    errors: int

    @property
    def ms_per_file(self) -> float:
        return (self.total_wall_s * 1000.0) / max(self.files, 1)

    @property
    def cpu_ms_per_file(self) -> float:
        return (self.total_cpu_s * 1000.0) / max(self.files, 1)

    @property
    def chunks_per_file(self) -> float:
        return self.chunks / max(self.files, 1)

    @property
    def embed_batches_per_file(self) -> float:
        return self.chunks_per_file / EMBEDDING_BATCH_SIZE


# ---------------------------------------------------------------------------
# 夹具树(合成,规模受控)
# ---------------------------------------------------------------------------


def _scratch_parent(repo_root: Path) -> Path:
    """与工作树**同盘**的临时落点;不得是 C 盘(§26),也不得在仓库树内。"""
    drive = os.path.splitdrive(str(repo_root))[0] or "C:"
    cand = Path(drive + os.sep) / "DevEnv" / "Temp"
    if not cand.is_dir() or str(cand).upper().startswith("C:"):
        raise SystemExit(
            f"没有可用的同盘临时落点(需 <盘>:\\DevEnv\\Temp,且不得是系统盘)。实得: {cand}"
        )
    assert repo_root not in cand.resolve().parents, "夹具落在仓库树内会被自己的扫描吃到"
    cand.mkdir(parents=True, exist_ok=True)
    return cand


def build_tree(root: Path, files: int) -> int:
    """造 N 个 .py 文件的受控树,返回平均字节数。

    目录扇出固定 100 —— 不这么铺的话 NTFS 单目录几万条目会让**遍历**成本里掺进
    目录项查找,那就不是"文件数标度"而是"目录退化"的读数了。
    """
    rng = random.Random(20260927)  # 定种子:两次运行的树形状一致,读数才可比
    body = "".join(
        f"def f{i}():\n    return {i}  # {'x' * rng.randint(10, 40)}\n" for i in range(LINES_PER_SYNTH_FILE // 3)
    )
    total = 0
    for idx in range(files):
        sub = root / f"d{(idx // 100) % 400:04d}"
        sub.mkdir(parents=True, exist_ok=True)
        data = f"# calib {idx}\n{body}".encode()
        (sub / f"c{idx:07d}.py").write_bytes(data)
        total += len(data)
    return total // max(files, 1)


def measure_enumeration(root: Path, files: int) -> ScaleRow:
    """轴 A:受控规模下的两条枚举通道 + 护栏实际会付的那次有界探测。"""
    row = ScaleRow(files=files, bytes_per_file=0)
    reps = 3 if files <= 10_000 else 1
    for _ in range(reps):
        row.rg.append(_timed(lambda: rgp.enumerate_with_rg(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES)))
    for _ in range(reps):
        row.walk.append(
            _timed(lambda: rgp.enumerate_with_walk(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES))
        )
    # 护栏探测:上限=索引硬上限,不得为拿分母而全树走完(那正是本票要修的形状)
    for _ in range(reps):
        row.probe_limited.append(
            _timed(
                lambda: rgp.enumerate_code_files(
                    root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES, max_files=MAX_FILES_PER_INDEX
                )
            )
        )
    rg_paths, _ = rgp.enumerate_with_rg(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES)
    py_paths, _ = rgp.enumerate_with_walk(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES)
    row.counted_by_rg = len(rg_paths)
    row.counted_by_walk = len(py_paths)
    row.channels_agree = rg_paths == py_paths
    row.bytes_per_file = build_tree_bytes_probe(root)
    # Python 侧峰值内存:量 `enumerate_code_files` 的返回结构本身。
    # 刻意不量整进程 RSS —— 解释器与已导入模块占的是常数,护栏改变不了它,
    # 拿 RSS 当"索引内存量级"会把基线算进结论(实测差一个数量级)。
    gc.collect()
    tracemalloc.start()
    base, _cur = tracemalloc.get_traced_memory()
    big, _ = rgp.enumerate_with_rg(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES)
    _peak, _now = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    row.peak_set_bytes = max(_peak - base, 0)
    del big
    return row


def build_tree_bytes_probe(root: Path) -> int:
    """平均字节数(量一次即够,取前 200 个文件)。"""
    sizes: list[int] = []
    for dirpath, _dirs, fnames in os.walk(root):
        for f in fnames:
            sizes.append(os.path.getsize(os.path.join(dirpath, f)))
            if len(sizes) >= 200:
                return sum(sizes) // len(sizes)
    return sum(sizes) // max(len(sizes), 1)


def _timed(fn: Callable[[], object]) -> Sample:
    """墙钟 + CPU 双读数。

    分开报是因为这块盘上的目录枚举是 I/O 主导(§rg_fallback_parity 里并行被否证
    那一格就是墙钟/CPU 背离的直接证据):只看 CPU 会把"卡在盘上"读成"没成本"。
    """
    w0, c0 = time.perf_counter(), time.process_time()
    fn()
    return Sample(wall_s=time.perf_counter() - w0, cpu_s=time.process_time() - c0)


_SUFFIXES: Final[tuple[str, ...]] = tuple(_EXT_TO_LANG.keys())


# ---------------------------------------------------------------------------
# 轴 B:每文件本地成本(真仓真实文件,只读)
# ---------------------------------------------------------------------------


def measure_per_file_local_cost(paths: list[Path]) -> PerFileCost:
    """复刻 `index_repository` 里**本地**的两段(读+hash / 切片),不调 embed、不写库。

    与生产的差异如实登记:生产还会 ① 比对 Merkle 快照(每文件一次 dict 查找,可忽略)
    ② `_generate_embeddings_batch`(网络 + 计费,UNMEASURED)③ `_write_to_api`(生产库,
    禁止)。所以这里量到的是**下界**,拿它当全成本会低估 —— 结论方向因此保守,可接受。
    """
    cost = PerFileCost(files=0, total_bytes=0, total_lines=0, total_wall_s=0.0, total_cpu_s=0.0, chunks=0, errors=0)
    t0, c0 = time.perf_counter(), time.process_time()
    for p in paths:
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            cost.errors += 1
            continue
        if not content.strip():
            continue
        hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()
        chunks = codebase_indexer._chunk_by_ast(content, _EXT_TO_LANG.get(p.suffix.lower(), ""))
        cost.files += 1
        cost.total_bytes += len(content)
        cost.total_lines += content.count("\n") + 1
        cost.chunks += len(chunks)
    cost.total_wall_s = time.perf_counter() - t0
    cost.total_cpu_s = time.process_time() - c0
    return cost


def sample_real_files(root: Path, n: int) -> list[Path]:
    """从真仓取**确定序**的样本(排序后等距抽,避免"先到访顺序"带来的目录偏置)。"""
    all_files, _ = rgp.enumerate_code_files(
        root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES, max_files=None
    )
    rels = sorted(all_files)
    if len(rels) <= n:
        picked = rels
    else:
        step = len(rels) / n
        picked = [rels[int(i * step)] for i in range(n)]
    out: list[Path] = []
    for rel in picked:
        ap = root / rel
        if ap.is_file():
            out.append(ap)
    return out


# ---------------------------------------------------------------------------
# 真仓读数
# ---------------------------------------------------------------------------


def measure_real_repo(root: Path, sample_files: int) -> dict[str, Any]:
    t0, c0 = time.perf_counter(), time.process_time()
    rg_all, rg_prov = rgp.enumerate_with_rg(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES)
    rg_wall = time.perf_counter() - t0
    rg_cpu = time.process_time() - c0
    t0, c0 = time.perf_counter(), time.process_time()
    walk_all, _wp = rgp.enumerate_with_walk(root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES)
    walk_wall = time.perf_counter() - t0
    walk_cpu = time.process_time() - c0
    t0 = time.perf_counter()
    bounded, _bp = rgp.enumerate_code_files(
        root, ignored_dirs=_IGNORED_DIRS, suffixes=_SUFFIXES, max_files=MAX_FILES_PER_INDEX
    )
    bounded_wall = time.perf_counter() - t0
    # 旧护栏真正读到的分母(= _collect_code_files 的长度),与新探测逐项对照
    old_denominator = len(codebase_indexer._collect_code_files(root))
    per_file = measure_per_file_local_cost(sample_real_files(root, sample_files))
    return {
        "repo_root": str(root),
        "enumerated_true_code_files": len(rg_all),
        "rg_wall_s": round(rg_wall, 3),
        "rg_cpu_s": round(rg_cpu, 3),
        "rg_degraded": rg_prov.degraded_reason,
        "walk_wall_s": round(walk_wall, 3),
        "walk_cpu_s": round(walk_cpu, 3),
        "speedup_walk_over_rg": round(walk_wall / max(rg_wall, 1e-9), 2),
        "channels_agree": rg_all == walk_all,
        "symmetric_difference": len(rg_all ^ walk_all),
        "bounded_probe_at_MAX_FILES_PER_INDEX": {
            "returned": len(bounded),
            "wall_s": round(bounded_wall, 3),
            "is_saturated": len(bounded) >= MAX_FILES_PER_INDEX,
        },
        "old_guardrail_denominator_len_collect_code_files": old_denominator,
        "per_file_local_cost": asdict(per_file)
        | {
            "local_wall_ms_per_file": round(per_file.ms_per_file, 3),
            "local_cpu_ms_per_file": round(per_file.cpu_ms_per_file, 3),
            "chunks_per_file": round(per_file.chunks_per_file, 3),
            "embedding_batches_per_file": round(per_file.embed_batches_per_file, 5),
        },
    }


# ---------------------------------------------------------------------------
# 推导
# ---------------------------------------------------------------------------


def _channel_samples(row: ScaleRow, channel: str) -> list[Sample]:
    """按名字取一条通道的样本集(显式分支,不 getattr —— 打错字要当场炸,不要静默空表)。"""
    if channel == "rg":
        return row.rg
    if channel == "walk":
        return row.walk
    if channel == "probe_limited":
        return row.probe_limited
    raise ValueError(f"未知通道: {channel!r}")


def enumeration_slope_ms_per_file(rows: list[ScaleRow], channel: str) -> float:
    """枚举的**边际**每文件成本(ms/file),取最小/最大规模两点连线。

    为什么用量程端点而不是单点:单点读数把"进程启动 + 目录打开"的常数摊进每文件成本,
    在 2,000 文件那档能差出一个数量级(实测),那会让阈值算得比应有的更严。
    边际值才是"多一个文件多花多少钱",也正是护栏要用的换算系数。
    """
    usable = [r for r in rows if _channel_samples(r, channel)]
    if len(usable) < 2:
        return 0.0
    lo, hi = usable[0], usable[-1]
    lo_w = lo._median(_channel_samples(lo, channel), "wall_s")
    hi_w = hi._median(_channel_samples(hi, channel), "wall_s")
    denom = hi.files - lo.files
    return ((hi_w - lo_w) * 1000.0) / denom if denom > 0 else 0.0


def derive(
    real: dict[str, Any], rows: list[ScaleRow], budget_s: float, embed_batch_budget: int
) -> dict[str, Any]:
    """把量到的数折成护栏常量,并把**没量到**的那一格显式留在 UNMEASURED。

    本函数是 `mcp_server.lazy_index_file_limits()` 的**独立复现**:同一条公式在这里
    用**本次真仓读数**再算一遍,与代码里那组登记常量推出的派生阈值并排打印。
    ⚠️ 二者**不要求相等,也没有任何测试把它们钉成相等**(此前这里写着"由
    `tests/test_lazy_index_guardrail_v75.py` 的常量对账用例钉住"——那句是失实的,该文件
    里不存在这条用例,2026-09-27 落地时现读推翻)。原因就写在下面 UNMEASURED 那一格里:
    共享工作区的墙钟是**区间不是标量**(本机当日 8 路代理在打盘),用"复跑必须等值"当判据
    等于把一台门的红绿交给当时的机器负载 —— 那正是本仓反复登记的"判据锚定机器瞬时状态"那一型。
    测试面钉的是**与机器无关**的那几条:三条轴的公式形状、取最小值的binding、预算份额、
    以及"任何拒绝都必须带 reason"(全部走构造面)。常量的复评出口是**人**跑本脚本并连带
    更新登记依据,不是让 CI 替人判定"今天的机器比昨天快"。
    刻意不复用生产函数(复用就只是复读,量错了也照样一致),但公式形状必须同形。
    """
    cost = real["per_file_local_cost"]
    ms_per_file = float(cost["local_wall_ms_per_file"])
    chunks_per_file = float(cost["chunks_per_file"])
    batches_per_file = chunks_per_file / EMBEDDING_BATCH_SIZE
    synthetic_rg = enumeration_slope_ms_per_file(rows, "rg")
    synthetic_walk = enumeration_slope_ms_per_file(rows, "walk")
    # 阈值按**劣通道**成立:rg 只是常态,不是保证(部署机/服务身份解析不到 rg 时走
    # python-walk)。按 rg 的成本定档 = 在最坏那一档上重新变成无证据的猜测。
    # 取真仓摊薄值而不是合成树斜率:合成树是 60 行小文件,摊薄值偏乐观。
    total = int(real["enumerated_true_code_files"]) or 1
    real_enum_rg = float(real["rg_wall_s"]) * 1000.0 / total
    real_enum_walk = float(real["walk_wall_s"]) * 1000.0 / total
    worst_enum = max(real_enum_rg, real_enum_walk)
    per_file_total_ms = ms_per_file + worst_enum
    files_by_local = int(budget_s * 1000 // max(per_file_total_ms, 1e-9))
    files_by_batches = int(embed_batch_budget // max(batches_per_file, 1e-9))
    axes = {
        "files_by_local_wall_budget": files_by_local,
        "files_by_embedding_batch_budget": files_by_batches,
        "files_by_index_hard_cap": MAX_FILES_PER_INDEX,
    }
    suggested = max(1, min(axes.values()))
    binding = min(axes, key=lambda k: axes[k])
    return {
        "budget_assumptions": {
            "local_wall_budget_seconds": budget_s,
            "embedding_batch_budget": embed_batch_budget,
            "channel_used_for_enumeration_cost": "真仓劣通道(python-walk)摊薄值 —— 阈值必须对降级通道也成立",
        },
        "measured": {
            "local_wall_ms_per_file": ms_per_file,
            "chunks_per_file": chunks_per_file,
            "embedding_batches_per_file": round(batches_per_file, 5),
            "real_enum_ms_per_file_ripgrep": round(real_enum_rg, 5),
            "real_enum_ms_per_file_python_walk": round(real_enum_walk, 5),
            "synthetic_slope_ms_per_file_ripgrep": round(synthetic_rg, 5),
            "synthetic_slope_ms_per_file_python_walk": round(synthetic_walk, 5),
            "per_file_total_ms_for_budget": round(per_file_total_ms, 4),
        },
        "limits_from_each_axis": axes,
        "binding_axis": binding,
        "suggested_lazy_index_max_files": suggested,
        "note": "取三条轴的最小值;任何一条都不得被读成'仓库上限'",
    }


#: embedding 批量预算:**这是策略选择,不是测量结果** —— 一次懒索引发生在用户等
#: 一次工具调用的路径上,按"不超过几百次上游调用"定的档;它的**换算系数**
#: (每文件多少 batch)才是量出来的。两者必须分开登记,否则下次有人把预算当实测引用。
_EMBED_BATCH_BUDGET: Final[int] = 300


def production_guardrail_snapshot() -> dict[str, Any]:
    """读 `mcp_server` 里**已入库的**护栏常量与派生阈值,与本次量算并排打印。

    为什么量算脚本要自己回头看代码:复评的产物就是那几个常量,而"常量"与"支撑它的
    那次测量"一旦分叉,账面什么都看不出来(本仓那一型记过太多次:登记表过期、
    清单腐烂、锚点漂移)。这里只读不改;拿不到就如实报"未对照",绝不假装一致。
    """
    try:
        from app.services import mcp_server as ms
    except Exception as e:  # noqa: BLE001 - 对照拿不到只是少一栏,不该让量算失败
        return {"available": False, "reason": f"{type(e).__name__}: {e}"}
    limits = ms.lazy_index_file_limits(
        index_hard_cap=MAX_FILES_PER_INDEX, embedding_batch_size=EMBEDDING_BATCH_SIZE
    )
    return {
        "available": True,
        "local_ms_per_file": ms._LAZY_INDEX_LOCAL_MS_PER_FILE,
        "enum_worst_ms_per_file": ms._LAZY_INDEX_ENUM_WORST_MS_PER_FILE,
        "chunks_per_file": ms._LAZY_INDEX_CHUNKS_PER_FILE,
        "budget_seconds": ms._LAZY_INDEX_LOCAL_BUDGET_SECONDS,
        "embed_batch_budget": ms._LAZY_INDEX_EMBED_BATCH_BUDGET,
        "derived_max_files": limits.max_files,
        "binding_axis": limits.binding_axis,
    }


def print_report(
    scales: list[ScaleRow],
    real: dict[str, Any] | None,
    derived: dict[str, Any] | None,
    prod: dict[str, Any] | None,
) -> None:
    print("=" * 78)
    print("V3 #75 后半 · 懒索引护栏量算(只读仓库;合成树造在同盘 DevEnv/Temp)")
    binary = rgp.resolve_rg_binary()
    print(f"python={sys.version.split()[0]}  platform={sys.platform}  "
          f"rg={binary.path or '无'}  (出处={binary.source};部署进程若不在此 PATH 上则走降级通道)")
    print(f"tree_sitter_available={codebase_indexer._tree_sitter_available} "
          f"(False ⇒ 生产同样走正则/固定行切片,故本读数即生产路径)")
    print("=" * 78)
    print("\n[轴 A] 受控规模枚举(合成树,每文件 ≈ 固定行数)")
    print(f"{'files':>8} | {'rg s':>7} | {'walk s':>8} | {'x':>5} | {'探测(≤上限) s':>13} | {'集合峰值 MB':>11}")
    for r in scales:
        d = r.as_dict()
        print(
            f"{d['files']:>8} | {d['rg_median_wall_s']:>7.3f} | {d['walk_median_wall_s']:>8.3f} | "
            f"{d['speedup_walk_over_rg']:>5.2f} | {d['probe_at_max_files_median_wall_s']:>13.3f} | "
            f"{d['peak_set_mb']:>11.2f}   一致={d['channels_agree']} "
            f"bytes/file={d['bytes_per_file']} 每文件集合≈{d['bytes_per_counted_file']}B"
        )
    if real is not None:
        print("\n[轴 A'] 真仓(只读)")
        for k in (
            "enumerated_true_code_files",
            "rg_wall_s",
            "walk_wall_s",
            "speedup_walk_over_rg",
            "channels_agree",
            "symmetric_difference",
            "old_guardrail_denominator_len_collect_code_files",
        ):
            print(f"  {k} = {real[k]}")
        print(f"  有界探测 = {real['bounded_probe_at_MAX_FILES_PER_INDEX']}")
        print("\n[轴 B] 每文件本地成本(真仓样本)")
        for k, v in real["per_file_local_cost"].items():
            print(f"  {k} = {v}")
    if derived is not None:
        print("\n[推导] 护栏常量")
        print(json.dumps(derived, ensure_ascii=False, indent=2))
    if prod is not None:
        print("\n[对账] mcp_server 里已入库的常量(本脚本回头看代码)")
        if not prod.get("available"):
            print(f"  未对照:{prod.get('reason')}")
        else:
            for k, v in prod.items():
                if k == "available":
                    continue
                print(f"  {k} = {v}")
            if derived is not None:
                same = int(prod["derived_max_files"]) == int(derived["suggested_lazy_index_max_files"])
                ratio = derived["suggested_lazy_index_max_files"] / max(int(prod["derived_max_files"]), 1)
                print(
                    f"  ⇒ 本次复跑建议 {derived['suggested_lazy_index_max_files']} / 代码登记 {prod['derived_max_files']}"
                    f"(比值 {ratio:.2f}×)"
                    + (
                        ""
                        if same
                        else "  ← 差值只说明**本次机器负载与登记那次不同**,不构成'代码错了'的判据;"
                        " 若要改常量,须在**空闲机**上复跑并同步改上面的三条轴与登记依据(带日期),"
                        " 不得拿单次负载读数追数(那等于把 2026-09-07 那个无依据字面量换个来源重犯一遍)"
                    )
                )
    print("\n[UNMEASURED] 本机量不到、因此不得进结论的项:")
    for line in _UNMEASURED:
        print("  - " + line)


_UNMEASURED: list[str] = [
    "embedding 单次批量调用的墙钟延迟与费用(_generate_embeddings_batch 打真实 LLM API,按约束不调)",
    "indexChunks 写入 HTTP + 生产 PostgreSQL 的延迟(_write_to_api 会写生产库,§5 测试隔离铁律禁止)",
    "tree-sitter AST 切片成本(本机 venv 未装 tree_sitter;量到的是降级切片的成本)",
    "冷/热缓存分离(共享工作区有并发代理在打盘,墙钟是区间不是标量;脚本以中位数并报全部样本)",
    "外推假设的边界:受控树是合成文件(固定行数/字节数),**只**用于量枚举随文件数的标度;"
    "每文件下游成本(读+hash+切片)另在真仓真实文件样本上量,两个口径不得互推",
    "部署进程的 rg 可达性:本次用的是当前 shell PATH 上解析到的二进制(出处见首行), "
    "服务身份/CI 上若解析不到则走 python-walk 降级通道 —— 阈值必须对**降级通道**也成立",
]


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def _repo_root_from(argv_repo: str) -> Path:
    cand = Path(argv_repo).resolve() if argv_repo else Path.cwd().resolve()
    while not (cand / "pnpm-workspace.yaml").is_file() and cand.parent != cand:
        cand = cand.parent
    if not (cand / "pnpm-workspace.yaml").is_file():
        raise SystemExit("找不到 monorepo 根(pnpm-workspace.yaml),拒绝在未知目录上量算")
    return cand


def _cleanup(parent: Path) -> list[str]:
    removed: list[str] = []
    for p in sorted(parent.iterdir()):
        if not p.name.startswith(CALIB_PREFIX):
            continue
        if p.is_symlink() or (p.is_dir() and os.path.islink(p)):
            p.unlink()  # 重解析点只能断链,递归删会穿透到真实目标(§26 那一型)
            continue
        shutil.rmtree(str(p), ignore_errors=True)
        removed.append(p.name)
    return removed


def main() -> int:
    ap = argparse.ArgumentParser(description="V3 #75 懒索引护栏取证量算(只读仓库)")
    ap.add_argument("--repo", default="", help="monorepo 根(默认自 cwd 向上找 pnpm-workspace.yaml)")
    ap.add_argument("--scales", default=",".join(str(s) for s in DEFAULT_SCALES), help="逗号分隔的文件规模")
    ap.add_argument("--sample", type=int, default=REAL_SAMPLE_FILES, help="真仓每文件成本的取样文件数")
    ap.add_argument(
        "--budget-seconds",
        type=float,
        default=30.0,
        help="懒索引允许的本地墙钟预算(默认 30 = mcp_server.MCP_GLOBAL_TIMEOUT 120 × 1/4)",
    )
    ap.add_argument("--embed-batch-budget", type=int, default=_EMBED_BATCH_BUDGET, help="允许的 embedding 批量数上限")
    ap.add_argument("--no-real-repo", action="store_true", help="跳过真仓(只量合成规模)")
    ap.add_argument("--json", action="store_true", help="输出机器可读 JSON")
    ap.add_argument("--keep-fixtures", action="store_true", help="不清理合成树(调试用;默认清)")
    args = ap.parse_args()

    root = _repo_root_from(args.repo)
    parent = _scratch_parent(root)
    scales = [int(s) for s in str(args.scales).split(",") if s.strip()]
    rows: list[ScaleRow] = []
    real: dict[str, Any] | None = None
    derived: dict[str, Any] | None = None
    prod: dict[str, Any] | None = None
    try:
        for n in scales:
            d = parent / f"{CALIB_PREFIX}{n}"
            if d.exists():
                shutil.rmtree(str(d), ignore_errors=True)
            d.mkdir(parents=True)
            build_tree(d, n)
            rows.append(measure_enumeration(d, n))
        if not args.no_real_repo:
            real = measure_real_repo(root, args.sample)
            derived = derive(real, rows, args.budget_seconds, args.embed_batch_budget)
            prod = production_guardrail_snapshot()
    finally:
        removed = [] if args.keep_fixtures else _cleanup(parent)
    if args.json:
        print(
            json.dumps(
                {
                    "scales": [r.as_dict() for r in rows],
                    "real_repo": real,
                    "derived": derived,
                    "in_code_constants": prod,
                    "unmeasured": _UNMEASURED,
                    "fixtures_cleaned": removed if not args.keep_fixtures else [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print_report(rows, real, derived, prod)
        print(f"\n清理的合成树: {removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
