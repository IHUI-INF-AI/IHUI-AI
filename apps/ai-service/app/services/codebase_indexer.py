# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""代码库语义索引器。

用 tree-sitter AST 解析代码 → 按符号(函数/类/方法/接口)切片 → 生成 embedding → 写入 codebase_chunks 表。
AST 解析失败时降级为固定行数切片(100 行/片,50 行重叠)。

2026-09-07 升级(对标 Cursor Merkle 增量同步 + CodeBuddy 三层语义索引):
- Merkle 增量同步:文件内容 sha256 快照持久化,重索引时只对变更文件
  重新切片+embedding(未变文件零成本跳过),删除文件同步清除旧切片
  (DELETE /api/v1/codebase/repo/:repoId/files)。快照根 hash =
  sha256(sorted(path:hash)),与 Cursor Merkle Tree 思想一致。
- 三层语义索引:函数层(符号切片,原有)+ 模块层(每文件摘要切片
  symbol_type=module_summary)+ 架构层(每顶层目录摘要切片
  symbol_type=architecture_summary)。合成切片走同一 embedding 通道,
  语义搜索自然命中"这个模块是干什么的/整体架构是什么"类查询。

依赖:
- tree-sitter + tree-sitter-language-pack(可选,未安装时降级为正则切片)
- llm_gateway.embed()(已存在,生成 1536 维向量)

使用方式:
    from app.services.codebase_indexer import codebase_indexer
    result = await codebase_indexer.index_repository("/path/to/repo", repo_id="my-repo")
    result = await codebase_indexer.search("用户认证逻辑", repo_id="my-repo")
"""

import asyncio
import copy
import hashlib
import json
import logging
import os
import re
import subprocess
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

from ..core.internal_ticket import internal_service_headers
from ..core.llm_gateway import llm_gateway
from . import rg_fallback_parity as _rgp
from .ignore_rules import (
    DEFAULT_IGNORE_FILENAMES,
    filter_paths,
    filter_paths_for_index,
    load_ignore_set,
    normalize_rel_path,
)
from .process_tree import CREATE_NO_WINDOW
from .rename_detect import (
    NEAR_STAGE_SKIPPED_NO_FINGERPRINTS,
    NEAR_STAGE_SKIPPED_TOO_MANY,
    RENAME_MAX_HAMMING,
    RenameReport,
    compute_simhash,
    detect_renames,
    fingerprint_hex,
)
from .rg_fallback_parity import EnumerationProvenance

logger = logging.getLogger(__name__)

# ---- anydoc 文档提取引擎(可选依赖)----
# 文档格式(docx/doc/pdf/pptx/ppt/xls/xlsx/odt/ods/odp/rtf/epub)为二进制容器,
# 直接 read_text 会产生乱码切片;经 anydoc 抽取为 Markdown 后再入索引。
# 未安装 anydoc 时不映射这些扩展名,保持原有行为(完全跳过)。
try:
    import anydoc as _anydoc

    _ANYDOC_OK: bool = True
except ImportError:  # pragma: no cover - 依赖缺失环境
    _anydoc = None  # type: ignore[assignment]
    _ANYDOC_OK = False

# 需经 anydoc 抽取的文档扩展名
_DOC_EXTS: frozenset[str] = frozenset({
    ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls",
    ".odt", ".ods", ".odp", ".rtf", ".epub", ".pdf",
})

# 支持的文件扩展名 → 语言映射
_EXT_TO_LANG: dict[str, str] = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".rb": "ruby",
    ".php": "php",
    ".vue": "vue",
    ".svelte": "svelte",
}

# Markdown 文档(纯文本,无需 anydoc)→ 以 "markdown" 语言走正则切片
_EXT_TO_LANG[".md"] = "markdown"
_EXT_TO_LANG[".markdown"] = "markdown"
# 二进制文档格式依赖 anydoc,仅在引擎可用时纳入索引收集
if _ANYDOC_OK:
    for _doc_ext in sorted(_DOC_EXTS):
        _EXT_TO_LANG[_doc_ext] = "markdown"


def _extract_document_markdown(path: Path) -> str:
    """anydoc 提取文档格式为 Markdown 文本(阻塞调用,异步上下文请经 asyncio.to_thread)。

    失败时抛异常,由调用方捕获并记入 result.errors(跳过该文件)。
    """
    if _anydoc is None:
        raise RuntimeError("anydoc 模块未安装, 无法索引文档格式")
    return _anydoc.to_markdown(str(path))

# 忽略目录
_IGNORED_DIRS: set[str] = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".turbo", ".cache", "coverage",
    ".mypy_cache", ".pytest_cache", ".ruff_cache", ".tox", "env",
    ".idea", ".vscode", "target", "eggs", ".eggs",
}

# 每个切片最大字符数(防 embedding 输入过长)
MAX_CHUNK_CHARS = 8000
# 固定行数切片参数(降级模式)
FIXED_CHUNK_LINES = 100
FIXED_CHUNK_OVERLAP = 50
# 单文件最大切片数(防超大文件拖慢索引)
MAX_CHUNKS_PER_FILE = 200
# 单次索引最大文件数(防仓库过大)
MAX_FILES_PER_INDEX = 5000
# embedding 批量大小(单次 API 调用)
EMBEDDING_BATCH_SIZE = 20
# 三层语义索引:文件含符号切片 ≥ 该阈值才生成模块层摘要切片(少文件无收益)
MODULE_SUMMARY_MIN_CHUNKS = 4
# 架构摘要:每个顶层目录一个合成切片;目录下文件数 ≥ 该阈值才生成
ARCH_SUMMARY_MIN_FILES = 3
# Merkle 快照目录(每 repo_id 一个 JSON;env CODEBASE_INDEX_CACHE_DIR 可覆盖)
_MERKLE_SNAPSHOT_DIR = Path(
    os.environ.get("CODEBASE_INDEX_CACHE_DIR", str(Path.home() / ".ihui" / "codebase-index"))
)


def _file_content_hash(content: str) -> str:
    """文件内容 sha256(Merkle 叶子节点 hash)。"""
    return hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()


def _merkle_root(file_hashes: dict[str, str]) -> str:
    """Merkle 根 hash = sha256(sorted("path:hash"))(与 Cursor Merkle Tree 思想一致)。
    任一文件增删改都会改变根 hash,重索引时可 O(1) 判断整仓是否变更。"""
    joined = "\n".join(f"{p}:{h}" for p, h in sorted(file_hashes.items()))
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


#: git 跟踪面探针的超时(秒)。派生调用必须有界,否则一次挂起会把整条索引链拖成无界等待。
GIT_TRACKED_TIMEOUT_S = 60.0


@dataclass
class IgnorePruneReport:
    """索引枚举过 ignore 规则之后的**回执**:剪了多少、谁判的、哪些"跟踪但被忽略"被保留。

    没有这张回执,"被剪"与"本来就没有"在 `IndexResult` 上长得一模一样 ——
    而这一格最容易静默的正是"我把你跟踪的文件吃了"。
    """

    files_ignored: int = 0
    ignored_by: list[str] = field(default_factory=list)
    tracked_kept: int = 0
    tracked_kept_paths: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def list_tracked_paths(root: Path) -> tuple[set[str] | None, str | None]:
    """git 跟踪面(相对 `root` 的 posix 路径)→ (集合, 未判定原委)。

    三态分立,绝不并桶:
    - **不是 git 工作树** ⇒ `(set(), None)`:这是**结论**("这棵树上没有已跟踪文件"),
      不是失败 —— 临时目录、导出的源码包都走这一档;
    - **git 不可用 / 超时 / ls-files 失败** ⇒ `(None, 原委)`:**未判定**。调用方据此
      一条都不剪(§0.3 与"失效方向只能是多留一份",不拿"没有跟踪文件"冒充判过的结果);
    - 正常 ⇒ (相对路径集合, None)。

    路径按 `root` 相对输出(`git -C <root> ls-files` 以 cwd 为基准),与枚举出口同形态。
    """
    try:
        probe = subprocess.run(  # noqa: S603 - argv 全为受控字面量
            ["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=GIT_TRACKED_TIMEOUT_S,
            creationflags=CREATE_NO_WINDOW,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, f"git 探针跑不动:{type(e).__name__}"
    if probe.returncode != 0:
        return set(), None
    try:
        listing = subprocess.run(  # noqa: S603 - argv 全为受控字面量
            ["git", "-C", str(root), "ls-files", "-z", "--cached"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=GIT_TRACKED_TIMEOUT_S,
            creationflags=CREATE_NO_WINDOW,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, f"git ls-files 跑不动:{type(e).__name__}"
    if listing.returncode != 0:
        return None, f"git ls-files 退出码 {listing.returncode}"
    return {normalize_rel_path(p) for p in (listing.stdout or "").split("\0") if p}, None


def apply_index_ignore_rules(
    rel_paths: list[str], root: Path
) -> tuple[list[str], IgnorePruneReport]:
    """索引枚举结果过一遍 ignore 规则 → (留下的相对路径, 剪枝回执)。

    ## 取舍口径:跟踪但被 `.gitignore` 覆盖的路径(P84 的前置,2026-11-01 定)

    **默认不剪,原样保留并逐条点名**(`IgnorePruneReport.tracked_kept*`)。理由三条:

    1. **这是 git 自己的语义**,不是让步:`.gitignore` 对**已跟踪**文件根本不生效
       (`git ls-files -i -c --exclude-standard` 正是用来找这种"跟踪却命中忽略"的别扭件,
       守门 236 的射程)。索引面照抄 `.gitignore`,等于替仓库裁决"这枚文件该从检索面消失",
       而它明明已被入库 —— 内容面丢失且**无痕迹**,正是本仓最恨的那一型失效。
    2. **失效方向必须偏"多留一份"**:误留一枚构建产物的代价是索引里多几条切片;
       误剪一枚已跟踪源码的代价是"搜不到、且没人知道它曾经在"。两者不可对称处理。
    3. **想真的剔掉,有过得去的出口**:索引专属的 `.aiignore` 命中照剪(它不对应任何 git
       语义,写它的人明确表达"这枚别进索引");这条留给了"我确实要它出索引"的正当诉求。

    跟踪面取不到(未判定)⇒ **一条都不剪**并把原委写进回执,由 `IndexResult` 透出。

    实现上是"先零 IO 探一次有没有得剪,剪到了才去问 git" —— 干净树上不会白跑一次
    `git ls-files`(monorepo 上那是上万条的进程与解析成本)。
    """
    report = IgnorePruneReport()
    ignore = load_ignore_set(root, filenames=DEFAULT_IGNORE_FILENAMES)
    report.errors.extend(f"ignore 规则读不动:{e}" for e in ignore.errors)
    if not ignore.rules:
        return list(rel_paths), report
    _probe_kept, probe_pruned = filter_paths(rel_paths, ignore)
    if not probe_pruned:
        return list(rel_paths), report
    tracked, track_err = list_tracked_paths(root)
    if track_err is not None:
        report.errors.append(
            f"跟踪面取不到({track_err})⇒ 本轮一条都不剪(未判定,按「多留一份」处理)"
        )
    kept, pruned, tracked_kept = filter_paths_for_index(rel_paths, ignore, tracked=tracked)
    report.files_ignored = len(pruned)
    seen: set[str] = set()
    for _path, where in pruned:
        if where not in seen and len(seen) < 12:
            seen.add(where)
            report.ignored_by.append(where)
    report.tracked_kept = len(tracked_kept)
    report.tracked_kept_paths = [p for p, _where in tracked_kept][:12]
    return kept, report


SNAPSHOT_SCHEMA_VERSION = 2
SNAPSHOT_STATE_OK = "ok"
SNAPSHOT_STATE_LEGACY = "legacy"
SNAPSHOT_STATE_ABSENT = "absent"
SNAPSHOT_STATE_CORRUPT = "corrupt"
SNAPSHOT_STATE_TRUNCATED = "truncated"
SNAPSHOT_STATE_SKIPPED = "skipped"
#: 档位清单单源:实现与用例都从这一行取,不另写第二份(§0.6)。
SNAPSHOT_STATES: tuple[str, ...] = (
    SNAPSHOT_STATE_OK,
    SNAPSHOT_STATE_LEGACY,
    SNAPSHOT_STATE_ABSENT,
    SNAPSHOT_STATE_CORRUPT,
    SNAPSHOT_STATE_TRUNCATED,
    SNAPSHOT_STATE_SKIPPED,
)


INDEX_LEASE_ACQUIRED = "acquired"
INDEX_LEASE_COALESCED = "coalesced-waited"
INDEX_LEASE_OVER_WINDOW = "over-window"
INDEX_LEASE_STATES: tuple[str, ...] = (
    INDEX_LEASE_ACQUIRED,
    INDEX_LEASE_COALESCED,
    INDEX_LEASE_OVER_WINDOW,
)
DEFAULT_INDEX_LEASE_WAIT_S = 60.0
#: 单仓飞行中索引表(单源):同仓后到调用**并到正在跑的那一轮**,而不是各跑一遍。
#: 取证对齐 Qoder 的 `startSync`/`refreshLock`/`endSync` 租约协议(T9 §4.2-5);
#: 本仓此前同一仓可以并发跑 N 轮全量索引(懒索引闸门 + `index_codebase` 两条路都会发起),
#: 每轮都是真金白银的 embedding,且两轮会抢同一枚临时快照文件名。
_INDEX_LEASES: dict[str, "asyncio.Task[IndexResult]"] = {}


def _lease_wait_seconds() -> float:
    raw = os.environ.get("IHUI_INDEX_LEASE_WAIT_S", "")
    if raw.strip():
        try:
            return max(float(raw), 0.0)
        except ValueError:
            logger.warning("IHUI_INDEX_LEASE_WAIT_S=%r 不是数字,回落默认 %s", raw, DEFAULT_INDEX_LEASE_WAIT_S)
    return DEFAULT_INDEX_LEASE_WAIT_S


@dataclass
class SnapshotRead:
    """一次快照读取的结论:能用的文件表 + 这份档能不能自证。"""

    files: dict[str, str]
    state: str
    detail: str | None = None
    #: 改名判定用的两枚附加表(P85,2026-11-01):
    #: `fingerprints` = 路径 → 64 bit simhash 的 hex;`aliases` = 新路径 → **仍在源路径下**
    #: 的那批切片的源路径(精确改名命中后不重嵌入、不删行,行留在原地下)。
    #: 两者都是**可缺省**的附加输入:缺了只降级为"本轮只判精确改名",不影响 `files`
    #: 的自证(自证仍是 fileCount + 重算 merkleRoot 那两把尺);形态坏才判坏档(见 `_snapshot_extras`)。
    fingerprints: dict[str, str] = field(default_factory=dict)
    aliases: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.state not in SNAPSHOT_STATES:
            raise ValueError(f"快照档位 {self.state!r} 不在 SNAPSHOT_STATES 里")


@dataclass
class CodeChunk:
    """代码切片。"""

    file_path: str
    line_start: int
    line_end: int
    content: str
    language: str | None = None
    symbol_name: str | None = None
    symbol_type: str | None = None
    # G7(2026-10-31):本切片向量来源('remote'|'local-hash');None = 未生成。
    # 随写面 payload 带给 api 侧落 embedding_provider 列,离线回落必须可识别不冒充。
    embedding_provider: str | None = None
    embedding: list[float] | None = None


@dataclass
class IndexResult:
    """索引结果。"""

    repo_id: str
    files_scanned: int = 0
    files_indexed: int = 0
    chunks_created: int = 0
    chunks_vectorized: int = 0
    errors: list[str] = field(default_factory=list)
    # 2026-09-07 Merkle 增量同步统计
    files_unchanged: int = 0  # 内容未变被跳过的文件数(零 embedding 成本)
    files_deleted: int = 0  # 已删除并同步清除切片的文件数
    merkle_root: str = ""  # 本轮快照根 hash(可跨轮比较 O(1) 判断整仓变更)
    # V75 判据 4:本轮**遍历出处**必须到端可见,不得只在日志里 —— 降级成 Python
    # 串行遍历与走 ripgrep 是两种成本完全不同的运行,响应上看不见就等于没降级过。
    traversal_engine: str = ""  # rg_fallback_parity.ENGINE_* 之一;"" = 没跑过枚举
    traversal_duration_s: float = 0.0  # 这一趟枚举的实际耗时
    traversal_files_seen: int = 0  # 通道自报的计数(触顶时 = 上限,不是全仓规模)
    traversal_degraded_reason: str | None = None  # 非 None = 走了回退通道,原委在此
    # 快照自证档(2026-11-01,对齐 T9「读到坏档不当没发生过」那一格):
    # ok/legacy/absent/corrupt/truncated/skipped 六档,端上必须看得见本轮站在哪一档。
    snapshot_state: str = ""
    snapshot_detail: str | None = None
    #: 租约档(acquired / coalesced-waited / over-window;"" = 没经过租约层)
    lock_state: str = ""
    lock_detail: str | None = None
    # P84(2026-11-01):索引枚举的 ignore 剪枝回执。`files_ignored` 只数**真剪掉**的;
    # "跟踪但被 .gitignore 覆盖 ⇒ 保留"单独计数并逐条点名,不许与"本来就没有"混在一起。
    files_ignored: int = 0
    ignored_by: list[str] = field(default_factory=list)
    files_tracked_ignored_kept: int = 0
    tracked_ignored_kept: list[str] = field(default_factory=list)
    ignore_notes: list[str] = field(default_factory=list)
    # P85(2026-11-01):改名判定。`files_renamed` = **精确改名**(同 content-hash,本轮
    # 不重嵌入、不清旧切片);`rename_candidates` 含近同候选(内容变过,仍按变更处理)。
    files_renamed: int = 0
    rename_candidates: list[dict[str, Any]] = field(default_factory=list)
    rename_note: str | None = None


def _snapshot_extras(
    parsed: dict[str, Any],
) -> tuple[dict[str, str], dict[str, str], str | None]:
    """读快照里的两枚附加表(指纹 / 改名别名)→ (指纹, 别名, 坏形态原委)。

    - **缺席**(旧版档、或这一轮没算过指纹)⇒ 空表,**不判坏档**:它们不参与
      `fileCount` / 重算 `merkleRoot` 这条自证链,缺了只降级"本轮只判精确改名";
    - **在场但形态坏** ⇒ 返回原委,由调用方判 `CORRUPT`(见 `_load_snapshot_read`
      里"别名一丢就等于静默丢内容"那条)。
    """
    fingerprints: dict[str, str] = {}
    aliases: dict[str, str] = {}
    raw_fp = parsed.get("simhashes")
    if raw_fp is not None:
        if not isinstance(raw_fp, dict):
            return {}, {}, "simhashes 字段形态不合"
        for key, value in raw_fp.items():
            if not isinstance(key, str) or not isinstance(value, str):
                return {}, {}, "simhashes 条目形态不合"
            fingerprints[key] = value
    raw_alias = parsed.get("aliases")
    if raw_alias is not None:
        if not isinstance(raw_alias, dict):
            return {}, {}, "aliases 字段形态不合"
        for key, value in raw_alias.items():
            if not isinstance(key, str) or not isinstance(value, str):
                return {}, {}, "aliases 条目形态不合"
            aliases[key] = value
    return fingerprints, aliases, None


def _resolve_alias_source(path: str, aliases: dict[str, str], *, limit: int = 16) -> str:
    """别名链归位:一直找到**真正持有切片行**的那枚路径(A→B 之后 B→C 的那条链)。

    链长有界且环路自停:坏档里出现 A→B→A 这种自指时,原样返回当前节点而不是死循环。
    """
    seen = {path}
    current = path
    while current in aliases and len(seen) <= limit:
        current = aliases[current]
        if current in seen:
            break
        seen.add(current)
    return current


class CodebaseIndexer:
    """代码库语义索引器。

    流程:
    1. 扫描仓库 → 收集代码文件
    2. 每个文件用 tree-sitter AST 切片(降级为固定行数切片)
    3. 批量调 llm_gateway.embed() 生成 1536 维向量
    4. 通过 API 端点 POST /api/v1/codebase/index 写入数据库
    """

    def __init__(self) -> None:
        self._tree_sitter_available = self._check_tree_sitter()
        self._api_base_url = os.environ.get(
            "API_SERVICE_URL", "http://localhost:8801"
        ).rstrip("/")

    def _internal_auth_headers(
        self,
        api_token: str | None,
        internal_user_id: str | None = None,
    ) -> dict[str, str]:
        """构造写入口鉴权头(2026-09-07 立)。

        优先级:
        1. api_token(用户 JWT,Bearer 认证)——Web/会话链路显式传入时使用
        2. 内部服务通道 —— MCP 工具/服务端触发索引时使用,与 api 侧
           internal-service-token 中间件契约一致;经 internal_ticket 唯一出口构造,
           dual 兼容窗内旧 x-internal-service-token 照发、x-internal-service-ticket
           短期票同带(主体 = internal_user_id,scope='codebase-index')。
        两者皆无 → 空 headers(写入会被 401 拒绝,调用方按错误降级处理)。
        """
        if api_token:
            return {"Authorization": f"Bearer {api_token}"}
        secret = os.environ.get("AI_CALLBACK_SECRET", "").strip()
        if (
            secret
            and internal_user_id
            and re.fullmatch(r"[a-zA-Z0-9-]{1,128}", internal_user_id)
        ):
            return internal_service_headers(
                internal_user_id, "codebase-index", legacy_token=secret
            )
        return {}

    def _check_tree_sitter(self) -> bool:
        """检查 tree-sitter 是否可用。"""
        try:
            import tree_sitter  # noqa: F401
            import tree_sitter_language_pack  # noqa: F401
            return True
        except ImportError:
            logger.info(
                "tree-sitter 未安装,代码切片将降级为正则模式。"
                "安装依赖:pip install tree-sitter tree-sitter-language-pack"
            )
            return False

    def _get_parser(self, language: str) -> Any:
        """获取 tree-sitter parser(语言不可用时返回 None)。"""
        if not self._tree_sitter_available:
            return None
        try:
            from tree_sitter import Language, Parser  # noqa: F401
            from tree_sitter_language_pack import get_language

            lang_map = {
                "typescript": "typescript",
                "tsx": "tsx",
                "javascript": "javascript",
                "jsx": "jsx",
                "python": "python",
                "go": "go",
                "rust": "rust",
                "java": "java",
                "c": "c",
                "cpp": "cpp",
                "csharp": "c_sharp",
                "ruby": "ruby",
                "php": "php",
            }
            ts_lang_name = lang_map.get(language)
            if not ts_lang_name:
                return None
            lang = get_language(ts_lang_name)
            parser = Parser()
            parser.language = lang
            return parser
        except Exception as e:
            logger.debug("获取 tree-sitter parser 失败(lang=%s): %s", language, e)
            return None

    # 符号节点类型 → (symbol_type, name_field)
    _SYMBOL_NODE_TYPES: dict[str, tuple[str, str]] = {
        # TypeScript / JavaScript
        "function_declaration": ("function", "name"),
        "function_signature": ("function", "name"),
        "method_definition": ("method", "name"),
        "class_declaration": ("class", "name"),
        "interface_declaration": ("interface", "name"),
        "type_alias_declaration": ("type", "name"),
        "enum_declaration": ("enum", "name"),
        "export_statement": ("module", "name"),
        # Python
        "function_definition": ("function", "name"),
        "class_definition": ("class", "name"),
        "decorated_definition": ("module", "name"),
        "method_declaration": ("method", "name"),
        "type_declaration": ("type", "name"),
        # Rust
        "function_item": ("function", "name"),
        "struct_item": ("class", "name"),
        "enum_item": ("enum", "name"),
        "trait_item": ("interface", "name"),
        "impl_item": ("method", "name"),
    }

    def _extract_symbol_name(self, node: Any, name_field: str) -> str | None:
        """从 AST 节点提取符号名。"""
        child = node.child_by_field_name(name_field)
        if child and child.text:
            return cast(str, child.text.decode("utf-8", errors="replace"))
        return None

    def _chunk_by_ast(self, content: str, language: str) -> list[CodeChunk]:
        """用 tree-sitter AST 切片代码。"""
        parser = self._get_parser(language)
        if not parser:
            return self._chunk_by_regex(content, language)

        try:
            tree = parser.parse(content.encode("utf-8"))
        except Exception as e:
            logger.debug("AST 解析失败(lang=%s): %s, 降级正则", language, e)
            return self._chunk_by_regex(content, language)

        content.splitlines()
        chunks: list[CodeChunk] = []

        def walk(node: Any) -> None:
            node_type = node.type
            if node_type in self._SYMBOL_NODE_TYPES:
                symbol_type, name_field = self._SYMBOL_NODE_TYPES[node_type]
                symbol_name = self._extract_symbol_name(node, name_field)
                start_line = node.start_point[0] + 1
                end_line = node.end_point[0] + 1
                # 提取切片内容
                start_idx = node.start_byte
                end_idx = node.end_byte
                chunk_content = content[start_idx:end_idx]
                if len(chunk_content) > MAX_CHUNK_CHARS:
                    chunk_content = chunk_content[:MAX_CHUNK_CHARS]
                if chunk_content.strip():
                    chunks.append(CodeChunk(
                        file_path="",  # 由调用方填充
                        line_start=start_line,
                        line_end=end_line,
                        content=chunk_content,
                        language=language,
                        symbol_name=symbol_name,
                        symbol_type=symbol_type,
                    ))
                # 不再递归子节点(已捕获整个符号)
                return
            for child in node.children:
                walk(child)

        walk(tree.root_node)

        # 若 AST 未提取到任何符号,降级为正则
        if not chunks:
            return self._chunk_by_regex(content, language)

        return chunks[:MAX_CHUNKS_PER_FILE]

    # 正则符号模式(降级模式,按语言)
    _REGEX_PATTERNS: dict[str, list[tuple[str, "re.Pattern[str]", str]]] = {
        "python": [
            ("function", re.compile(r"^\s*(?:async\s+def|def)\s+(\w+)", re.MULTILINE), "def"),
            ("class", re.compile(r"^\s*class\s+(\w+)", re.MULTILINE), "class"),
        ],
        "typescript": [
            ("function", re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", re.MULTILINE), "function"),
            ("class", re.compile(r"^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)", re.MULTILINE), "class"),
            ("interface", re.compile(r"^\s*(?:export\s+)?interface\s+(\w+)", re.MULTILINE), "interface"),
            ("type", re.compile(r"^\s*(?:export\s+)?type\s+(\w+)", re.MULTILINE), "type"),
        ],
        "javascript": [
            ("function", re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", re.MULTILINE), "function"),
            ("class", re.compile(r"^\s*(?:export\s+)?class\s+(\w+)", re.MULTILINE), "class"),
        ],
        "go": [
            ("function", re.compile(r"^\s*func\s+(\w+)", re.MULTILINE), "func"),
            ("method", re.compile(r"^\s*func\s+\([^)]+\)\s+(\w+)", re.MULTILINE), "func"),
            ("type", re.compile(r"^\s*type\s+(\w+)", re.MULTILINE), "type"),
        ],
        "rust": [
            ("function", re.compile(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)", re.MULTILINE), "fn"),
            ("class", re.compile(r"^\s*(?:pub\s+)?struct\s+(\w+)", re.MULTILINE), "struct"),
            ("interface", re.compile(r"^\s*(?:pub\s+)?trait\s+(\w+)", re.MULTILINE), "trait"),
            ("enum", re.compile(r"^\s*(?:pub\s+)?enum\s+(\w+)", re.MULTILINE), "enum"),
        ],
    }

    def _chunk_by_regex(self, content: str, language: str) -> list[CodeChunk]:
        """正则模式切片(降级方案)。

        先尝试按符号定义行切片(函数/类/接口),若无匹配则按固定行数切片。
        """
        lines = content.splitlines()
        chunks: list[CodeChunk] = []

        # 尝试符号级正则切片
        patterns = self._REGEX_PATTERNS.get(language, [])
        if patterns:
            symbol_starts: list[tuple[int, str, str]] = []  # (line_idx, symbol_name, symbol_type)
            for symbol_type, pattern, _ in patterns:
                for m in pattern.finditer(content):
                    sym_name = m.group(1)
                    line_idx = content.count("\n", 0, m.start())
                    symbol_starts.append((line_idx, sym_name, symbol_type))

            if symbol_starts:
                symbol_starts.sort(key=lambda x: x[0])
                for i, (start_idx, sym_name, sym_type) in enumerate(symbol_starts):
                    end_idx = (
                        symbol_starts[i + 1][0] - 1
                        if i + 1 < len(symbol_starts)
                        else len(lines) - 1
                    )
                    if end_idx < start_idx:
                        end_idx = start_idx
                    chunk_lines = lines[start_idx : end_idx + 1]
                    chunk_content = "\n".join(chunk_lines)
                    if len(chunk_content) > MAX_CHUNK_CHARS:
                        chunk_content = chunk_content[:MAX_CHUNK_CHARS]
                    if chunk_content.strip():
                        chunks.append(CodeChunk(
                            file_path="",
                            line_start=start_idx + 1,
                            line_end=end_idx + 1,
                            content=chunk_content,
                            language=language,
                            symbol_name=sym_name,
                            symbol_type=sym_type,
                        ))
                if chunks:
                    return chunks[:MAX_CHUNKS_PER_FILE]

        # 最终降级:固定行数切片(100 行/片,50 行重叠)
        total_lines = len(lines)
        if total_lines == 0:
            return []
        step = FIXED_CHUNK_LINES - FIXED_CHUNK_OVERLAP
        for start in range(0, total_lines, step):
            end = min(start + FIXED_CHUNK_LINES, total_lines)
            chunk_lines = lines[start:end]
            chunk_content = "\n".join(chunk_lines)
            if len(chunk_content) > MAX_CHUNK_CHARS:
                chunk_content = chunk_content[:MAX_CHUNK_CHARS]
            if chunk_content.strip():
                chunks.append(CodeChunk(
                    file_path="",
                    line_start=start + 1,
                    line_end=end,
                    content=chunk_content,
                    language=language,
                    symbol_name=None,
                    symbol_type="fixed",
                ))
            if end >= total_lines:
                break
        return chunks[:MAX_CHUNKS_PER_FILE]

    def collect_code_files_with_provenance(
        self, root: Path
    ) -> tuple[list[tuple[Path, str]], EnumerationProvenance, IgnorePruneReport]:
        """扫描仓库收集代码文件,并**把这一趟用了哪条通道带回来**。

        V75 判据 4:本方法是懒索引护栏(`MAX_FILES_PER_INDEX`)唯一的分母来源,也是
        `index_repository` 唯一的枚举入口 —— 枚举语义只许住在
        `rg_fallback_parity.enumerate_code_files` 一处,这里只做两件事:
        「相对 posix 路径 → (绝对 Path, language)」的还原,以及**枚举之后**过一遍
        `ignore_rules`(P84,2026-11-01)。

        为什么 ignore 剪枝必须挂在**枚举之后**而不是塞进 rg 参数:`ignore_rules` 是
        单一判定层,骨架装配(`repo_tree_render`)与索引面共用它 ⇒ 两通道(ripgrep /
        Python 遍历)对 ignore 的判断在结构上不可能不一致,不靠事后对账追。
        "跟踪但被 `.gitignore` 覆盖"这一型的取舍口径写在 `apply_index_ignore_rules`
        的 docstring 里(**默认保留并点名**,理由在那一处)。

        降级不静默:rg 通道跑了但坏了时,`provenance.degraded_reason` /
        `fallback_detail` 带原委,由 `index_repository` 透出到 `IndexResult` 上,
        所以"这次索引走的是 ripgrep 还是回退遍历"在响应里看得见,不必翻日志。
        剪枝同样不静默:剪了多少、谁判的、哪些被保留,全部落在第三个返回值上。
        """
        rel_paths, prov = _rgp.enumerate_code_files(
            root,
            ignored_dirs=_IGNORED_DIRS,
            suffixes=tuple(_EXT_TO_LANG),
            max_files=MAX_FILES_PER_INDEX,
        )
        kept_paths, ignore_report = apply_index_ignore_rules(rel_paths, root)
        collected: list[tuple[Path, str]] = []
        for rel in kept_paths:
            fname = rel.rsplit("/", 1)[-1]
            lang = _EXT_TO_LANG.get(os.path.splitext(fname)[1].lower())
            if not lang:
                # 枚举出口按 suffixes 白名单收过,理论上到不了这里;真到了就是两通道
                # 对扩展名的判定漂移了 —— 宁可丢这一条也不得给索引塞一个未知语言切片。
                logger.warning("枚举出口返回了白名单外的扩展名,已跳过: %s", rel)
                continue
            collected.append((root / Path(*rel.split("/")), lang))
        return collected, prov, ignore_report

    def _collect_code_files(self, root: Path) -> list[tuple[Path, str]]:
        """扫描仓库,收集代码文件 → [(file_path, language), ...]。

        本体已收口到 `collect_code_files_with_provenance`(V75):护栏分母与索引分母
        必须是同一个数,所以这里只剥掉 provenance 与剪枝回执,不保留第二份遍历实现。
        """
        collected, _prov, _ignore = self.collect_code_files_with_provenance(root)
        return collected

    async def _generate_embeddings_batch(
        self, chunks: list[CodeChunk]
    ) -> int:
        """批量生成 embedding,返回成功向量化的数量。"""
        vectorized = 0
        for i in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
            batch = chunks[i : i + EMBEDDING_BATCH_SIZE]
            tasks = [
                llm_gateway.embed(c.content[:MAX_CHUNK_CHARS])
                for c in batch
            ]
            try:
                embeddings = await asyncio.gather(*tasks, return_exceptions=True)
                for j, emb in enumerate(embeddings):
                    if isinstance(emb, list) and len(emb) == 1536:
                        batch[j].embedding = emb
                        batch[j].embedding_provider = "remote"
                        vectorized += 1
                    elif isinstance(emb, Exception):
                        # G7 本地回落档:远端失败(离线/欠费/限流)不再让向量面整批落空,
                        # 降级为本地确定性哈希向量并如实标注来源(local-hash)。
                        # 本模块的 `llm_gateway` 是**单例**(from ..core.llm_gateway import
                        # llm_gateway),embed_local_fallback / LOCAL_EMBEDDING_PROVIDER
                        # 都是它的成员 —— 别写成模块级访问(那会 AttributeError 被下面
                        # except 吞成"批量 embedding 失败",回落档看起来写了却从未生效)。
                        fallback = llm_gateway.embed_local_fallback(
                            batch[j].content[:MAX_CHUNK_CHARS]
                        )
                        batch[j].embedding = fallback
                        batch[j].embedding_provider = llm_gateway.LOCAL_EMBEDDING_PROVIDER
                        vectorized += 1
                        logger.debug(
                            "embedding 远端失败,已落本地回落档(chunk %s): %s",
                            batch[j].file_path,
                            emb,
                        )
            except Exception as e:
                logger.warning("批量 embedding 失败: %s", e)
        return vectorized

    async def _write_to_api(
        self,
        repo_id: str,
        chunks: list[CodeChunk],
        api_token: str | None = None,
        internal_user_id: str | None = None,
    ) -> dict[str, Any]:
        """通过 API 端点写入切片到数据库。"""
        import httpx

        url = f"{self._api_base_url}/api/v1/codebase/index"
        payload = {
            "repoId": repo_id,
            "chunks": [
                {
                    "filePath": c.file_path,
                    "lineStart": c.line_start,
                    "lineEnd": c.line_end,
                    "content": c.content,
                    "language": c.language,
                    "symbolName": c.symbol_name,
                    "symbolType": c.symbol_type,
                    "embeddingProvider": c.embedding_provider,
                    "embedding": c.embedding,
                }
                for c in chunks
            ],
        }
        # 2026-10-03 数据出域合规整改:**必须**把 internal_user_id 传进鉴权头,
        # 否则 X-User-Id 不会发出,api 侧取不到 req.userId → 拒绝写入无归属的索引
        # (codebase_chunks 存用户代码明文,无主行是该整改要消除的东西)。
        headers = self._internal_auth_headers(api_token, internal_user_id)

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"API 写入失败 HTTP {resp.status_code}: {resp.text[:200]}"
                )
            return cast(dict[str, Any], resp.json())

    async def _delete_files_from_api(
        self,
        repo_id: str,
        file_paths: list[str],
        api_token: str | None = None,
        internal_user_id: str | None = None,
    ) -> int:
        """批量删除已消失文件的旧切片(Merkle 增量同步,2026-09-07 立)。

        Returns:
            实际删除的切片数;端点不存在(旧版 api)时静默返回 0。
        """
        if not file_paths:
            return 0
        import httpx

        url = f"{self._api_base_url}/api/v1/codebase/repo/{repo_id}/files"
        # 2026-10-03:同写入路径,删除面也必须带归属(否则能删别人的索引)
        headers = self._internal_auth_headers(api_token, internal_user_id)
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.request(
                    "DELETE", url, json={"filePaths": file_paths}, headers=headers
                )
                if resp.status_code >= 400:
                    logger.warning(
                        "删除幽灵文件切片失败 HTTP %d: %s", resp.status_code, resp.text[:200]
                    )
                    return 0
                data = resp.json()
                inner = data.get("data", data) if isinstance(data, dict) else {}
                return int(inner.get("deleted", 0))
        except Exception as e:
            logger.warning("删除幽灵文件切片异常: %s", e)
            return 0

    # ==========================================================================
    # Merkle 快照持久化(2026-09-07 立)
    # ==========================================================================

    def _snapshot_path(self, repo_id: str, root: Path) -> Path:
        """快照文件路径:repo_id + 仓库绝对路径共同决定(同 repo_id 不同路径互不污染)。"""
        path_key = hashlib.sha256(str(root).encode()).hexdigest()[:12]
        return _MERKLE_SNAPSHOT_DIR / f"{repo_id}-{path_key}.merkle.json"

    def _load_snapshot_read(self, repo_id: str, root: Path) -> SnapshotRead:
        """读上轮 Merkle 快照,并**把"这份档能不能自证"一起带回来**。

        旧口径是"读不动/形态不合 ⇒ 返回空 dict",后果有两格都是安静的:
        ① 本轮退化成全量重索引(白烧 embedding),响应里看不出来;
        ② 更要紧的是 `deleted_paths = prev - new` 的分母也变成空 ⇒ **幽灵切片永不清理**,
           而端上读到的仍是"增量同步完成"。
        取证对齐目标:Qoder 读回快照时逐字段校验并**拒绝截断文件**(T9 §4.2-1,该格 Trae 未见同等出口)。
        本仓在此之上多一条:除声明的 `fileCount` 外,还要用 `files` **重算 merkleRoot** 与档内值对,
        所以"尾巴被削掉但字节数恰好凑得上"这一型也判得出来。
        """
        path = self._snapshot_path(repo_id, root)
        try:
            raw = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return SnapshotRead({}, SNAPSHOT_STATE_ABSENT)
        except OSError as e:
            return SnapshotRead({}, SNAPSHOT_STATE_CORRUPT, f"快照读不动: {type(e).__name__}")
        try:
            parsed = json.loads(raw)
        except Exception as e:
            return SnapshotRead({}, SNAPSHOT_STATE_CORRUPT, f"JSON 解析失败: {str(e)[:120]}")
        if not isinstance(parsed, dict):
            return SnapshotRead({}, SNAPSHOT_STATE_CORRUPT, "顶层不是对象")
        files = parsed.get("files")
        if not isinstance(files, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in files.items()
        ):
            return SnapshotRead({}, SNAPSHOT_STATE_CORRUPT, "files 字段形态不合")
        version = parsed.get("schemaVersion")
        fingerprints, aliases, extras_err = _snapshot_extras(parsed)
        if extras_err is not None:
            # 附加表形态坏 ⇒ 判坏档而不是"当没有":别名一丢,那条"行仍在源路径下"的记录
            # 就没了 ⇒ 下一轮会把源路径当"已删除"去清切片,改名后的文件从索引里静默消失。
            return SnapshotRead({}, SNAPSHOT_STATE_CORRUPT, extras_err)
        if version is None:
            # v1 老档:内容可用,但**没有自证凭据**。判 legacy,不冒充 ok。
            return SnapshotRead(
                cast(dict[str, str], files),
                SNAPSHOT_STATE_LEGACY,
                "旧版档无 schemaVersion/fileCount ⇒ 坏档无法自证,本轮起按 v2 重写",
                fingerprints,
                aliases,
            )
        if version != SNAPSHOT_SCHEMA_VERSION:
            return SnapshotRead({}, SNAPSHOT_STATE_CORRUPT, f"schemaVersion={version!r} 不在认得的档位里")
        declared_count = parsed.get("fileCount")
        if not isinstance(declared_count, int) or declared_count != len(files):
            return SnapshotRead(
                {},
                SNAPSHOT_STATE_TRUNCATED,
                f"声明 fileCount={declared_count!r} 与实际 {len(files)} 条不符 ⇒ 判截断",
            )
        declared_root = parsed.get("merkleRoot")
        recomputed = _merkle_root(files)
        if not isinstance(declared_root, str) or declared_root != recomputed:
            return SnapshotRead(
                {},
                SNAPSHOT_STATE_TRUNCATED,
                "merkleRoot 与 files 重算值不符 ⇒ 档被改写过或尾部缺失",
            )
        return SnapshotRead(
            cast(dict[str, str], files), SNAPSHOT_STATE_OK, None, fingerprints, aliases
        )

    def _save_snapshot(
        self,
        repo_id: str,
        root: Path,
        file_hashes: dict[str, str],
        *,
        fingerprints: dict[str, str] | None = None,
        aliases: dict[str, str] | None = None,
    ) -> None:
        """持久化本轮快照(原子写:先写逐轮唯一的临时件,再 replace 落位)。

        `fingerprints` / `aliases` 是**附加输入**(P85):前者供下一轮判近同改名,
        后者记录"精确改名后行仍留在源路径下"这件事。两者都不参与 `files` 的自证,
        所以旧版读侧只是不认这两枚键,不会把档判坏。
        """
        tmp: Path | None = None
        try:
            _MERKLE_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            path = self._snapshot_path(repo_id, root)
            tmp = path.with_name(f"{path.name}.{os.getpid()}-{uuid.uuid4().hex[:8]}.tmp")
            tmp.write_text(
                json.dumps(
                    {
                        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
                        "merkleRoot": _merkle_root(file_hashes),
                        "fileCount": len(file_hashes),
                        "files": file_hashes,
                        "simhashes": dict(fingerprints or {}),
                        "aliases": dict(aliases or {}),
                    },
                    ensure_ascii=False,
                    indent=0,
                ),
                encoding="utf-8",
            )
            tmp.replace(path)
            tmp = None
        except Exception as e:
            # 快照写失败不阻断本轮(下轮退化为全量索引),但**必须出声**:
            # 安静退化会让"这仓有索引"和"没有"在响应上长得一模一样(§0.3)。
            # 实测:八路并发写同一仓时,Windows 的瞬时文件锁会挡下其中一路的 replace。
            logger.warning("保存 Merkle 快照失败(%s): %s ⇒ 下轮退化为全量索引", repo_id, e)
        finally:
            # 落地失败也不能把临时件留在盘上:留在 snaps 目录里会被下一轮的 glob 误认成档案。
            if tmp is not None:
                try:
                    tmp.unlink(missing_ok=True)
                except OSError as cleanup_error:  # pragma: no cover - 锁仍未放
                    logger.warning("快照临时件清不掉 %s: %s", tmp, cleanup_error)

    # ==========================================================================
    # 三层语义索引:模块层 + 架构层合成切片(2026-09-07 立,对标 CodeBuddy)
    # ==========================================================================

    def _build_module_summary_chunks(
        self, rel_path: str, language: str, symbol_chunks: list[CodeChunk]
    ) -> CodeChunk | None:
        """模块层摘要切片:文件意图(头部 imports/常量)+ 符号清单。

        仅当文件符号切片数 ≥ MODULE_SUMMARY_MIN_CHUNKS 时生成
        (小文件其函数层切片已足够表达,摘要切片无检索收益)。
        """
        if len(symbol_chunks) < MODULE_SUMMARY_MIN_CHUNKS:
            return None
        symbols = [
            f"- {c.symbol_type}: {c.symbol_name} (L{c.line_start}-{c.line_end})"
            for c in symbol_chunks
            if c.symbol_name
        ]
        if not symbols:
            return None
        # 自包含语义摘要:符号清单 + 文件路径(利于 embedding 检索"模块是干什么的")
        content = (
            f"Module summary: {rel_path} ({language})\n"
            f"This module contains {len(symbols)} symbols:\n" + "\n".join(symbols)
        )
        if len(content) > MAX_CHUNK_CHARS:
            content = content[:MAX_CHUNK_CHARS]
        return CodeChunk(
            file_path=rel_path,
            line_start=1,
            line_end=max(c.line_end for c in symbol_chunks),
            content=content,
            language=language,
            symbol_name=Path(rel_path).name,
            symbol_type="module_summary",
        )

    def _build_architecture_summary_chunks(
        self, rel_paths: list[tuple[str, str, int]]
    ) -> list[CodeChunk]:
        """架构层摘要切片:每个含 ≥ARCH_SUMMARY_MIN_FILES 个源文件的目录一个合成切片。

        按文件实际父目录聚合(monorepo 下 apps/web 与 apps/api 是两个有意义
        的架构单元,按深度 1 聚合会把它们混成一团)。

        Args:
            rel_paths: [(rel_path, language, symbol_count), ...]
        Returns:
            架构摘要切片列表(symbol_type=architecture_summary)。
        """
        by_dir: dict[str, list[str]] = {}
        for rel_path, _lang, sym_count in rel_paths:
            directory = rel_path.rsplit("/", 1)[0] if "/" in rel_path else "(root)"
            by_dir.setdefault(directory, []).append(f"{rel_path} ({sym_count} symbols)")

        chunks: list[CodeChunk] = []
        for directory, files in sorted(by_dir.items()):
            if len(files) < ARCH_SUMMARY_MIN_FILES:
                continue
            content = (
                f"Architecture summary: directory '{directory}'\n"
                f"Contains {len(files)} indexed source files:\n"
                + "\n".join(files[:200])
            )
            if len(content) > MAX_CHUNK_CHARS:
                content = content[:MAX_CHUNK_CHARS]
            chunks.append(
                CodeChunk(
                    file_path=f"{directory}/",
                    line_start=1,
                    line_end=1,
                    content=content,
                    language=None,
                    symbol_name=directory,
                    symbol_type="architecture_summary",
                )
            )
        return chunks

    async def index_repository(
        self,
        repo_path: str,
        repo_id: str | None = None,
        api_token: str | None = None,
        incremental: bool = True,
        internal_user_id: str | None = None,
    ) -> IndexResult:
        """同仓单飞行索引(租约层):后到的调用并到正在跑的那一轮,而不是各跑一遍。

        对齐取证目标 Qoder 的带租约串行协议(`startSync` 拿 token、期间 `refreshLock`、
        收尾 `endSync` 必须见 `released`;T9 §4.2-5)。本仓此前**根本没有这一层**:
        懒索引闸门与 `index_codebase` 工具两条路都会发起整仓索引,同一仓并发时
        每轮都实打实花一遍 embedding,还会抢同一枚临时快照文件名。

        三条不安静失效的方向:
        - 并进去的那轮在响应上写 `lockState=coalesced-waited`,统计与那一轮同源;
        - 等过窗口仍没跑完 ⇒ 返回 `over-window` 且 `errors` 点名"本轮未开工",
          `files_indexed=0` 绝不被读成"没东西可索引"(§0.3);
        - 租约只在**在飞期间**合并,跑完即摘 ⇒ 不做"结果缓存",不存在拿到陈旧结果的通道。
        """
        key = f"{repo_id or '-'}|{Path(repo_path).resolve()}"
        running = _INDEX_LEASES.get(key)
        if running is not None and not running.done():
            wait_s = _lease_wait_seconds()
            try:
                shared = await asyncio.wait_for(asyncio.shield(running), timeout=wait_s)
            except TimeoutError:
                refused = IndexResult(repo_id=repo_id or "")
                refused.lock_state = INDEX_LEASE_OVER_WINDOW
                refused.lock_detail = f"等待同仓在飞轮次超过 {wait_s}s"
                refused.errors.append(
                    f"同仓索引正在飞行中({key})⇒ 本轮未开工,files_indexed=0 不得读成「没东西可索引」;"
                    "可调 IHUI_INDEX_LEASE_WAIT_S 或稍后重试"
                )
                return refused
            joined = copy.copy(shared)
            joined.errors = list(shared.errors)
            joined.lock_state = INDEX_LEASE_COALESCED
            joined.lock_detail = "本轮并入了先起跑的同仓索引,统计与那一轮同源"
            joined.errors.append(joined.lock_detail)
            return joined

        task = asyncio.create_task(
            self._index_repository_unleased(
                repo_path,
                repo_id=repo_id,
                api_token=api_token,
                incremental=incremental,
                internal_user_id=internal_user_id,
            )
        )
        _INDEX_LEASES[key] = task

        def _release(done: "asyncio.Task[IndexResult]") -> None:
            if _INDEX_LEASES.get(key) is done:
                _INDEX_LEASES.pop(key, None)

        task.add_done_callback(_release)
        try:
            out = await task
        finally:
            _release(task)
        out.lock_state = INDEX_LEASE_ACQUIRED
        return out

    async def _index_repository_unleased(
        self,
        repo_path: str,
        repo_id: str | None = None,
        api_token: str | None = None,
        incremental: bool = True,
        internal_user_id: str | None = None,
    ) -> IndexResult:
        """索引整个仓库(Merkle 增量同步,2026-09-07 起)。

        流程:
        1. 扫描仓库 → 计算每个代码文件的内容 sha256(Merkle 叶子);枚举后再过一遍 ignore 规则
           (P84;"跟踪但被忽略"默认保留并点名,口径见 `apply_index_ignore_rules`)
        2. 与上轮快照对比:未变文件零成本跳过(不切片/embedding/写入)
        3. 差集里先判改名(P85):同 content-hash ⇒ 不重嵌入、不清旧切片,行留在源路径下并
           记入快照别名;近同(汉明距离 ≤ 阈值)只作为候选报数,内容变过仍按变更重嵌入
        4. 其余变更文件重新切片 + embedding + 写入(indexChunks 自带先删旧后插新)
        5. 其余已删除文件 → DELETE /repo/:repoId/files 清除幽灵切片
        6. 三层语义索引:函数层(符号切片)+ 模块层 + 架构层(合成摘要切片)
        7. 持久化本轮快照(原子写;附指纹与改名别名)

        Args:
            repo_path: 仓库根目录绝对路径。
            repo_id: 仓库标识(为空时用路径 hash)。
            api_token: API JWT token(写入时鉴权用)。
            incremental: 是否启用 Merkle 增量(False 时全量重索引)。

        Returns:
            IndexResult 统计信息。
        """
        root = Path(repo_path).resolve()
        if not root.exists() or not root.is_dir():
            return IndexResult(
                repo_id=repo_id or "",
                errors=[f"仓库路径不存在或不是目录: {repo_path}"],
            )

        if not repo_id:
            path_hash = hashlib.sha256(str(root).encode()).hexdigest()[:16]
            repo_id = f"local-{path_hash}"

        result = IndexResult(repo_id=repo_id)
        files, traversal_prov, ignore_report = self.collect_code_files_with_provenance(root)
        result.files_scanned = len(files)
        # P84:剪枝回执随响应透出 —— "被剪"与"本来就没有"不许长得一样。
        result.files_ignored = ignore_report.files_ignored
        result.ignored_by = ignore_report.ignored_by
        result.files_tracked_ignored_kept = ignore_report.tracked_kept
        result.tracked_ignored_kept = ignore_report.tracked_kept_paths
        result.ignore_notes = ignore_report.errors
        # V75 判据 4:遍历出处与耗时随响应透出(降级不得只在日志里)。
        result.traversal_engine = traversal_prov.engine
        result.traversal_duration_s = traversal_prov.duration_s
        result.traversal_files_seen = traversal_prov.counted
        result.traversal_degraded_reason = traversal_prov.degraded_reason

        # --- Merkle 增量:计算本轮文件 hash 并与快照对比 ---
        snapshot = (
            self._load_snapshot_read(repo_id, root)
            if incremental
            else SnapshotRead({}, SNAPSHOT_STATE_SKIPPED)
        )
        prev_snapshot = snapshot.files
        prev_fingerprints = snapshot.fingerprints
        prev_aliases = snapshot.aliases if incremental else {}
        new_hashes: dict[str, str] = {}
        new_fingerprints: dict[str, str] = {}
        changed: list[tuple[Path, str, str]] = []  # [(abs_path, rel_path, language)]
        abs_by_rel: dict[str, Path] = {}
        lang_by_rel_input: dict[str, str] = {}
        for file_path, language in files:
            rel_path = str(file_path.relative_to(root)).replace("\\", "/")
            abs_by_rel[rel_path] = file_path
            lang_by_rel_input[rel_path] = language
            fingerprint: str | None = None
            try:
                if file_path.suffix.lower() in _DOC_EXTS:
                    # 文档格式:扫描轮仅读原始字节算 hash,昂贵的 anydoc 抽取留给切片轮
                    # (所以文档面这一轮不产指纹,近同改名对它们只走精确档)
                    content_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
                else:
                    content = file_path.read_text(encoding="utf-8", errors="replace")
                    if not content.strip():
                        continue
                    content_hash = _file_content_hash(content)
                    fingerprint = fingerprint_hex(compute_simhash(content))
            except Exception as e:
                result.errors.append(f"{file_path}: {e}")
                continue
            new_hashes[rel_path] = content_hash
            if incremental and prev_snapshot.get(rel_path) == content_hash:
                result.files_unchanged += 1
                # 内容没变 ⇒ 指纹必然同,沿用上一轮:指纹是 O(token×位宽) 的活,
                # 每轮全仓重算会把"增量"变成分钟级(这条若被删,增量轮会先慢一个数量级)。
                if prev_fingerprints.get(rel_path):
                    new_fingerprints[rel_path] = prev_fingerprints[rel_path]
                continue
            if fingerprint is not None:
                new_fingerprints[rel_path] = fingerprint
            changed.append((file_path, rel_path, language))

        # --- 改名别名:精确改名之后,那批切片**行仍留在源路径下**(P85) ---
        # 只保留"新路径还在、源路径没复活"的别名。源路径复活 ⇒ 两枚文件会共用同一批行,
        # 必须当场拆开:别名作废,新路径强制重新入索引(见下面 revived_targets)。
        live_aliases: dict[str, str] = {}
        revived_targets: list[str] = []
        for new_path, source in prev_aliases.items():
            if new_path not in new_hashes:
                continue
            if source in new_hashes:
                revived_targets.append(new_path)
                continue
            live_aliases[new_path] = source

        # 别名目标的内容变了 ⇒ 它得按**真实路径**重新入索引;留在源路径下的那批旧行
        # 同时必须清掉,否则同一份内容会在索引里出现两次(新旧路径各一份)。
        # 注意源路径**不在**上一轮快照里(改名那轮它就被换掉了),所以这里必须显式
        # 点名清理,不能指望那份 `prev - new` 的差集把它带出来。
        changed_rels_now = {rel for _p, rel, _l in changed}
        dropped_alias_sources: set[str] = set()
        for target, source in list(live_aliases.items()):
            if target in changed_rels_now:
                live_aliases.pop(target, None)
                if source not in new_hashes:
                    dropped_alias_sources.add(source)

        # 已删除文件:上轮快照有、本轮无 → 清除幽灵切片(别名源路径除外:那些行还活着)
        protected_sources: set[str] = set(live_aliases.values())
        deleted_paths = (
            [
                p
                for p in prev_snapshot
                if p not in new_hashes and p not in protected_sources
            ]
            if incremental
            else []
        )
        result.snapshot_state = snapshot.state
        result.snapshot_detail = snapshot.detail
        if incremental and snapshot.state in (SNAPSHOT_STATE_CORRUPT, SNAPSHOT_STATE_TRUNCATED):
            # 坏档派生的"已删除集"不可信:宁可这一轮不清幽灵切片,也不拿一份自证失败的档
            # 去删活文件的切片。上一轮这条是安静退化成 prev={} 的,于是"没清理"被读成"清理完了"。
            deleted_paths = []
            result.errors.append(
                f"快照自证失败({snapshot.state}:{snapshot.detail})⇒ 本轮跳过增量复用与幽灵切片清理,"
                "已按全量重索引,下轮好档自动恢复"
            )
        if dropped_alias_sources and incremental:
            deleted_paths = [
                *deleted_paths,
                *(p for p in sorted(dropped_alias_sources) if p not in deleted_paths),
            ]

        # --- 改名候选:同 content-hash 直判 + simhash 汉明距离候选(P85) ---
        rename_report = RenameReport()
        if incremental and deleted_paths and changed:
            removed_hashes = {p: prev_snapshot[p] for p in deleted_paths if p in prev_snapshot}
            added_hashes = {p: h for p, h in new_hashes.items() if p not in prev_snapshot}
            if removed_hashes and added_hashes:
                removed_fp = {
                    p: prev_fingerprints[p] for p in removed_hashes if p in prev_fingerprints
                }
                added_fp = {p: new_fingerprints[p] for p in added_hashes if p in new_fingerprints}
                rename_report = detect_renames(
                    removed_hashes,
                    added_hashes,
                    prev_fingerprints=removed_fp or None,
                    cur_fingerprints=added_fp or None,
                    max_hamming=RENAME_MAX_HAMMING,
                )
        alias_add: dict[str, str] = {}
        for rename in rename_report.exact:
            source = _resolve_alias_source(rename.old_path, prev_aliases)
            if source in new_hashes:
                # 行居所已被一枚真文件占住:这条不能靠"留行"复用,按变更处理(宁可多嵌入一次)
                continue
            alias_add[rename.new_path] = source
        if alias_add:
            changed = [c for c in changed if c[1] not in alias_add]
            # 改名链里被"换掉"的那些路径都不该进删除集:链条中段从没持有过行,
            # 真正持有行的那一枚由 `protected_sources` 保住(见下面)。
            renamed_sources = {
                *(r.old_path for r in rename_report.exact if r.new_path in alias_add),
                *alias_add.values(),
            }
            deleted_paths = [p for p in deleted_paths if p not in renamed_sources]
            live_aliases.update(alias_add)
            protected_sources.update(alias_add.values())
        if revived_targets:
            changed_rels = {rel for _p, rel, _l in changed}
            for rel in revived_targets:
                if rel in changed_rels or rel not in abs_by_rel:
                    continue
                changed.append((abs_by_rel[rel], rel, lang_by_rel_input[rel]))
                result.errors.append(
                    f"改名别名失效:{rel} 的源路径重新出现 ⇒ 本轮重新索引该路径"
                    "(两枚文件不得共用同一批切片)"
                )
        result.files_renamed = len(alias_add)
        result.rename_candidates = [
            {
                "oldPath": r.old_path,
                "newPath": r.new_path,
                "basis": r.basis,
                "hamming": r.hamming,
            }
            for r in rename_report.renames
        ]
        if rename_report.near_stage in (
            NEAR_STAGE_SKIPPED_NO_FINGERPRINTS,
            NEAR_STAGE_SKIPPED_TOO_MANY,
        ):
            result.rename_note = (
                f"近同改名判定本轮未做({rename_report.near_stage})⇒ 只判了精确改名,"
                "差集里剩下的仍按「删除 + 新增」处理"
            )
        if deleted_paths:
            result.files_deleted = await self._delete_files_from_api(
                repo_id, deleted_paths, api_token, internal_user_id
            )

        result.merkle_root = _merkle_root(new_hashes)

        # --- 变更文件切片(函数层)+ 三层合成切片(模块层/架构层) ---
        all_chunks: list[CodeChunk] = []
        layer_inputs: list[tuple[str, str, int]] = []  # (rel_path, language, symbol_count)
        for file_path, rel_path, language in changed:
            try:
                if file_path.suffix.lower() in _DOC_EXTS:
                    # 文档格式:经 anydoc 抽取 Markdown(线程池执行,避免阻塞事件循环);
                    # 失败则跳过该文件并记 error
                    content = await asyncio.to_thread(_extract_document_markdown, file_path)
                else:
                    content = file_path.read_text(encoding="utf-8", errors="replace")
                file_chunks = self._chunk_by_ast(content, language)
                for c in file_chunks:
                    c.file_path = rel_path
                all_chunks.extend(file_chunks)
                result.files_indexed += 1
                layer_inputs.append((rel_path, language, len(file_chunks)))
                module_chunk = self._build_module_summary_chunks(rel_path, language, file_chunks)
                if module_chunk:
                    all_chunks.append(module_chunk)
            except Exception as e:
                result.errors.append(f"{file_path}: {e}")

        # 架构层:对"全仓可见文件"生成(不只变更文件,保证架构切片始终最新)
        lang_by_rel = {
            str(f.relative_to(root)).replace("\\", "/"): l for f, l in files
        }
        symbol_count_by_rel = {r: s for r, _l, s in layer_inputs}
        all_visible: list[tuple[str, str, int]] = [
            (rel_path, lang_by_rel.get(rel_path, ""), symbol_count_by_rel.get(rel_path, 0))
            for rel_path in new_hashes
        ]
        arch_chunks = self._build_architecture_summary_chunks(all_visible)
        # 架构切片随变更批次写入(indexChunks 按 file_path 先删后插,幂等);
        # 零变更轮次跳过(内容必然与上轮一致,省 embedding 成本)
        if changed or deleted_paths or not incremental:
            all_chunks.extend(arch_chunks)

        result.chunks_created = len(all_chunks)
        if not all_chunks:
            self._save_snapshot(
                repo_id,
                root,
                new_hashes,
                fingerprints=new_fingerprints,
                aliases=live_aliases,
            )
            return result

        # 批量生成 embedding
        result.chunks_vectorized = await self._generate_embeddings_batch(all_chunks)

        # 分批写入 API(每批 100 条)
        BATCH_WRITE = 100
        for i in range(0, len(all_chunks), BATCH_WRITE):
            batch = all_chunks[i : i + BATCH_WRITE]
            try:
                await self._write_to_api(repo_id, batch, api_token, internal_user_id)
            except Exception as e:
                result.errors.append(f"写入批次 {i}-{i + len(batch)} 失败: {e}")

        # 持久化快照(下轮增量对比基准;附指纹与改名别名)
        self._save_snapshot(
            repo_id,
            root,
            new_hashes,
            fingerprints=new_fingerprints,
            aliases=live_aliases,
        )
        return result

    async def index_file(
        self,
        file_path: str,
        repo_id: str,
        language: str | None = None,
        api_token: str | None = None,
        internal_user_id: str | None = None,
    ) -> IndexResult:
        """索引单个文件(增量更新)。

        Args:
            file_path: 文件绝对路径。
            repo_id: 仓库标识。
            language: 编程语言(为空时按扩展名推断)。
            api_token: API JWT token。
            internal_user_id: 内部用户 ID(写入向量化 chunk 时隔离归属)。
        """
        path = Path(file_path).resolve()
        if not path.exists() or not path.is_file():
            return IndexResult(
                repo_id=repo_id,
                errors=[f"文件不存在: {file_path}"],
            )

        if not language:
            ext = path.suffix.lower()
            language = _EXT_TO_LANG.get(ext, "unknown")

        result = IndexResult(repo_id=repo_id, files_scanned=1)
        try:
            if path.suffix.lower() in _DOC_EXTS:
                # 文档格式:经 anydoc 抽取 Markdown 后入索引
                content = await asyncio.to_thread(_extract_document_markdown, path)
            else:
                content = path.read_text(encoding="utf-8", errors="replace")
            if not content.strip():
                return result
            chunks = self._chunk_by_ast(content, language)
            for c in chunks:
                c.file_path = str(path.name)
            result.chunks_created = len(chunks)
            result.files_indexed = 1
            if chunks:
                result.chunks_vectorized = await self._generate_embeddings_batch(chunks)
                await self._write_to_api(repo_id, chunks, api_token, internal_user_id)
        except Exception as e:
            result.errors.append(f"{file_path}: {e}")
        return result

    async def search(
        self,
        query: str,
        repo_id: str | None = None,
        language: str | None = None,
        top_k: int = 10,
        api_token: str | None = None,
        internal_user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """语义搜索代码片段(委托给 API 端点)。

        Args:
            query: 自然语言查询(如"用户认证逻辑")。
            repo_id: 限定仓库(为空则在调用者自己的全部索引内搜索)。
            language: 限定语言(如 typescript/python)。
            top_k: 返回 top-K 结果。
            api_token: API JWT token。
            internal_user_id: 内部通道用户身份(2026-10-03 新增,**检索面同样
                按归属隔离**)。api 侧从 X-User-Id 头取 req.userId 决定可见范围;
                不传则检索被拒(401)。这与写入面是同一条纪律 —— 只隔离写不隔离读,
                等于数据换个方向就又漏出去了。

        Returns:
            切片列表,每个含 file_path/line_start/line_end/content/symbol_name/symbol_type/score。
        """
        import httpx

        url = f"{self._api_base_url}/api/v1/codebase/search"
        payload: dict[str, Any] = {
            "query": query,
            "topK": top_k,
            # hybrid=向量+关键词 RRF 融合(服务端默认,显式声明契约,2026-09-07 立)
            "mode": "hybrid",
        }
        if repo_id:
            payload["repoId"] = repo_id
        if language:
            payload["language"] = language
        # 2026-10-03:检索面按归属隔离,身份必须带上(与写入面同一纪律)
        headers = self._internal_auth_headers(api_token, internal_user_id)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code >= 400:
                    logger.warning(
                        "语义搜索 API 失败 HTTP %d: %s",
                        resp.status_code,
                        resp.text[:200],
                    )
                    return []
                data = resp.json()
                # API 返回 { code, message, data: { chunks: [...] } }
                inner = data.get("data", data) if isinstance(data, dict) else {}
                return cast(list[dict[str, Any]], inner.get("chunks", []))
        except Exception as e:
            logger.warning("语义搜索失败: %s", e)
            return []


codebase_indexer = CodebaseIndexer()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
