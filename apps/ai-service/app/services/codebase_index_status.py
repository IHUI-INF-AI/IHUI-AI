# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""索引的失效/过期判定与"按需刷新"(2026-11-06,能力缺口「代码库索引」)。

为什么单独一档
--------------
Merkle 快照(Merkle/)本身就是"上一轮索引长什么样"的前像,但它只被索引流程内部
消费:`search()` 直接打远端 API、`auto_context` 只调 `search()` —— **没有任何
调用方能在检索前回答"这份索引还配得上盘上的代码吗"**。于是会出现两种安静的错误:
旧内容当新内容注入,或者明明没变却重跑一遍 embedding(两件事在响应上都看不出来)。

本模块给出可判定的三档结论 + 一个刷新动作:

- `fresh`    : 快照与盘上逐文件 hash 一致(且未过 TTL);
- `stale`    : 有文件增/删/改,或文件读不到 ⇒ **具体点名**,刷新只重算漂移文件;
- `expired`  : 超过 TTL(`IHUI_INDEX_FRESHNESS_TTL_S`)⇒ 需整轮收敛(增量口径,
               未变文件仍零 embedding);
- `unknown`  : 快照不可自证(corrupt/truncated)、枚举不完整、或超出有界校验上限
               ⇒ **判不出就明说判不出**,绝不冒充 fresh;
- `absent`   : 这仓从来没有快照 ⇒ 必须先建。

刷新链(`ensure_fresh`)
---------------------
`stale` ⇒ `index_changed_paths`(只重算漂移文件);其余非 fresh 档 ⇒
`index_repository(incremental=True)` 兜底(它自己会判坏档并收敛)。
代码出域同意闸(`code_index_consent`)在这里**必须先判**:未同意 ⇒ 一次远端调用
都不发,结论写 `consent-required`;本地目录补齐(`rebuild_catalog`)零远端,不需要同意。

有界性:校验上限 `IHUI_INDEX_FRESHNESS_MAX_FILES`(默认 2000)。超出上限时结论是
`unknown` 而不是 fresh —— "没全查"与"全查过且没变"必须长得不一样。
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

from .code_index_consent import has_consent
from .codebase_incremental_index import index_changed_paths
from .codebase_indexer import (
    SNAPSHOT_STATE_ABSENT,
    SNAPSHOT_STATE_CORRUPT,
    SNAPSHOT_STATE_LEGACY,
    SNAPSHOT_STATE_SKIPPED,
    SNAPSHOT_STATE_TRUNCATED,
    CodebaseIndexer,
    IndexResult,
    _default_repo_id,
    classify_fs_path,
    codebase_indexer,
    file_index_digest,
)

logger = logging.getLogger(__name__)

#: 结论词表(单源:实现、端点、用例都从这里取)。
FRESHNESS_FRESH = "fresh"
FRESHNESS_STALE = "stale"
FRESHNESS_EXPIRED = "expired"
FRESHNESS_UNKNOWN = "unknown"
FRESHNESS_ABSENT = "absent"
FRESHNESS_STATES: tuple[str, ...] = (
    FRESHNESS_FRESH,
    FRESHNESS_STALE,
    FRESHNESS_EXPIRED,
    FRESHNESS_UNKNOWN,
    FRESHNESS_ABSENT,
)

#: 目录能力档(与 `Catalog.state` 同词表)。
CATALOG_OK = "ok"
CATALOG_PARTIAL = "partial"
CATALOG_ABSENT = "absent"

#: 有界校验的默认文件数上限。
DEFAULT_MAX_CHECK_FILES = 2000
#: TTL(秒)。**默认 0 = 不按时间判过期**,只有显式配置才启用。
#: 理由:embedding 模型/切片规则不变时,时间本身不使索引失效;把它默认打开会让
#: 每次部署后都重跑一遍索引。运维需要"至少每周收敛一轮"时显式设
#: `IHUI_INDEX_FRESHNESS_TTL_S=604800`。
DEFAULT_TTL_S = 0.0
MAX_FRESHNESS_ENV = "IHUI_INDEX_FRESHNESS_MAX_FILES"
FRESHNESS_TTL_ENV = "IHUI_INDEX_FRESHNESS_TTL_S"

#: 样例清单截断(总数以计数字段为准,样例只用于人工定位)。
_SAMPLE_LIMIT = 20


def _max_check_files(default: int | None = None) -> int:
    if default is not None:
        return max(default, 1)
    raw = os.environ.get(MAX_FRESHNESS_ENV, "").strip()
    if raw:
        try:
            return max(int(raw), 1)
        except ValueError:
            logger.warning("%s=%r 不是整数,回落默认 %d", MAX_FRESHNESS_ENV, raw, DEFAULT_MAX_CHECK_FILES)
    return DEFAULT_MAX_CHECK_FILES


def _ttl_seconds() -> float:
    raw = os.environ.get(FRESHNESS_TTL_ENV, "").strip()
    if raw:
        try:
            return max(float(raw), 0.0)
        except ValueError:
            logger.warning("%s=%r 不是数字,回落默认 %s", FRESHNESS_TTL_ENV, raw, DEFAULT_TTL_S)
    return DEFAULT_TTL_S


def _snapshot_age_seconds(indexer: CodebaseIndexer, repo_id: str, root: Path, now: float) -> float | None:
    try:
        mtime = indexer._snapshot_path(repo_id, root).stat().st_mtime
    except OSError:
        return None
    return max(now - mtime, 0.0)


@dataclass
class FreshnessReport:
    """一次"索引还配不配得上盘上代码"的判定结论(所有字段都可回传,无一格只在日志)。"""

    repo_id: str
    root: str
    state: str
    detail: str = ""
    snapshot_state: str = ""
    snapshot_detail: str | None = None
    catalog_state: str = CATALOG_ABSENT
    catalog_files: int = 0
    catalog_symbols: int = 0
    total_files: int = 0
    checked_files: int = 0
    max_files: int = DEFAULT_MAX_CHECK_FILES
    changed_count: int = 0
    missing_count: int = 0
    added_count: int = 0
    unread_count: int = 0
    #: 需要重算的路径(已删除的也在内):`ensure_fresh` 直接拿它当增量批。
    changed_paths: list[str] = field(default_factory=list)
    changed_sample: list[str] = field(default_factory=list)
    missing_sample: list[str] = field(default_factory=list)
    unread_sample: list[str] = field(default_factory=list)
    ttl_s: float = DEFAULT_TTL_S
    snapshot_age_s: float | None = None

    def __post_init__(self) -> None:
        if self.state not in FRESHNESS_STATES:
            raise ValueError(f"结论 {self.state!r} 不在 FRESHNESS_STATES 里")

    def to_dict(self) -> dict[str, object]:
        return {
            "repo_id": self.repo_id,
            "root": self.root,
            "state": self.state,
            "detail": self.detail,
            "snapshot_state": self.snapshot_state,
            "snapshot_detail": self.snapshot_detail,
            "catalog_state": self.catalog_state,
            "catalog_files": self.catalog_files,
            "catalog_symbols": self.catalog_symbols,
            "total_files": self.total_files,
            "checked_files": self.checked_files,
            "max_files": self.max_files,
            "changed_count": self.changed_count,
            "missing_count": self.missing_count,
            "added_count": self.added_count,
            "unread_count": self.unread_count,
            "changed_sample": list(self.changed_sample),
            "missing_sample": list(self.missing_sample),
            "unread_sample": list(self.unread_sample),
            "ttl_s": self.ttl_s,
            "snapshot_age_s": self.snapshot_age_s,
        }


def resolve_repo_id(root: Path, indexer: CodebaseIndexer | None = None) -> str:
    """给某个根目录找它**实际的** repo_id。

    索引可由 `index_codebase` 指定任意 repo_id 建立,此时默认 id
    (`local-<路径 hash16>`)下没有快照。按快照文件名里的根路径指纹反查:
    默认 id 的快照存在就优先用它;否则取同根最新的那一份;都没有 ⇒ 返回默认 id
    (调用方后续会拿到 absent,而不是凭空造一份"有索引"的结论)。
    """
    resolved = Path(root).resolve()
    idx = indexer or codebase_indexer
    default = _default_repo_id(resolved)
    if idx._snapshot_path(default, resolved).exists():
        return default
    suffix = hashlib.sha256(str(resolved).encode()).hexdigest()[:12]
    try:
        candidates = sorted(
            idx._snapshot_path(default, resolved).parent.glob(f"*-{suffix}.merkle.json*"),
            key=lambda p: p.stat().st_mtime_ns,
            reverse=True,
        )
    except OSError:
        candidates = []
    if candidates:
        repo_id, _, _tail = candidates[0].name.partition(f"-{suffix}.merkle.json")
        if repo_id:
            return repo_id
    return default


def _sample(paths: list[str]) -> list[str]:
    return paths[:_SAMPLE_LIMIT]


def check_freshness(
    repo_path: str,
    *,
    repo_id: str | None = None,
    indexer: CodebaseIndexer | None = None,
    max_files: int | None = None,
    ttl_s: float | None = None,
    now: float | None = None,
) -> FreshnessReport:
    """判定某仓索引相对盘上代码的新鲜度(同步函数,异步调用方请 `to_thread`)。"""
    idx = indexer or codebase_indexer
    resolved = Path(repo_path).resolve()
    clock = time.time() if now is None else now
    limit = _max_check_files(max_files)
    ttl = _ttl_seconds() if ttl_s is None else max(ttl_s, 0.0)

    def _report(state: str, detail: str, **kwargs: object) -> FreshnessReport:
        report = FreshnessReport(
            repo_id=repo_id or "",
            root=str(resolved),
            state=state,
            detail=detail,
            max_files=limit,
            ttl_s=ttl,
        )
        for key, value in kwargs.items():
            setattr(report, key, value)
        return report

    if classify_fs_path(resolved) != "dir":
        return _report(FRESHNESS_UNKNOWN, f"仓库路径读不到或不是目录: {resolved}")
    repo_id = repo_id or resolve_repo_id(resolved, idx)
    snapshot = idx._load_snapshot_read(repo_id, resolved)
    catalog = snapshot.catalog
    catalog_state = catalog.state if catalog is not None else CATALOG_ABSENT
    catalog_files = len(catalog.files) if catalog is not None else 0
    catalog_symbols = catalog.symbol_count if catalog is not None else 0
    age = _snapshot_age_seconds(idx, repo_id, resolved, clock)

    common: dict[str, object] = {
        "repo_id": repo_id,
        "snapshot_state": snapshot.state,
        "snapshot_detail": snapshot.detail,
        "catalog_state": catalog_state,
        "catalog_files": catalog_files,
        "catalog_symbols": catalog_symbols,
        "snapshot_age_s": age,
    }
    if snapshot.state == SNAPSHOT_STATE_ABSENT:
        return _report(
            FRESHNESS_ABSENT,
            "这仓没有索引快照 ⇒ 必须先建索引,谈不上新鲜度",
            **common,
        )
    if snapshot.state in (
        SNAPSHOT_STATE_CORRUPT,
        SNAPSHOT_STATE_TRUNCATED,
        SNAPSHOT_STATE_SKIPPED,
    ):
        return _report(
            FRESHNESS_UNKNOWN,
            f"快照档不可自证({snapshot.state}: {snapshot.detail or '无原委'})⇒ 判不出是否最新",
            **common,
        )

    files, _prov, _ignore = idx.collect_code_files_with_provenance(resolved)
    total = len(files)
    if total > limit:
        return _report(
            FRESHNESS_UNKNOWN,
            f"仓库文件数 {total} 超出有界校验上限 {limit}({MAX_FRESHNESS_ENV})⇒ 没全查,不判 fresh",
            total_files=total,
            checked_files=0,
            **common,
        )

    added: list[str] = []
    changed: list[str] = []
    unread: list[str] = []
    present: set[str] = set()
    for file_path, _language in files:
        rel_path = str(file_path.relative_to(resolved)).replace("\\", "/")
        present.add(rel_path)
        digest, read_error = file_index_digest(file_path)
        if read_error is not None:
            unread.append(rel_path)
            continue
        if digest is None:
            # 空内容文件按索引口径**不进索引**;若快照里曾有它,这就是一次真实变更。
            if rel_path in snapshot.files:
                changed.append(rel_path)
            continue
        if rel_path not in snapshot.files:
            added.append(rel_path)
        elif snapshot.files[rel_path] != digest:
            changed.append(rel_path)
    missing = [rel for rel in snapshot.files if rel not in present]

    drift = added + changed + missing
    counts: dict[str, object] = {
        "total_files": total,
        "checked_files": total,
        "changed_count": len(changed),
        "added_count": len(added),
        "missing_count": len(missing),
        "unread_count": len(unread),
        "changed_paths": drift,
        "changed_sample": _sample(drift),
        "missing_sample": _sample(missing),
        "unread_sample": _sample(unread),
        **common,
    }
    parts: list[str] = []
    if drift:
        parts.append(
            f"盘上漂移 {len(drift)} 个(改 {len(changed)} / 增 {len(added)} / 删 {len(missing)})"
        )
    if unread:
        parts.append(f"{len(unread)} 个文件读不到(未判定)")
    if snapshot.state == SNAPSHOT_STATE_LEGACY:
        parts.append("快照为 legacy 档(内容可用但无自证)")
    if ttl > 0.0 and age is not None and age > ttl:
        return _report(
            FRESHNESS_EXPIRED,
            "；".join([f"快照已 {age:.0f}s,超过 TTL {ttl:.0f}s"] + parts),
            **counts,
        )
    if drift:
        return _report(FRESHNESS_STALE, "；".join(parts), **counts)
    if unread:
        return _report(FRESHNESS_UNKNOWN, "；".join(parts), **counts)
    if catalog_state != CATALOG_OK:
        return _report(
            FRESHNESS_STALE,
            "；".join([f"文件未变但目录能力是 {catalog_state}(需本地补齐)"] + parts),
            **counts,
        )
    return _report(FRESHNESS_FRESH, "；".join(parts) or "快照与盘上逐文件一致", **counts)


@dataclass
class RefreshOutcome:
    """一次刷新的完整回执:前后判定 + 走了哪条路 + 为什么没走另一条。"""

    repo_id: str
    action: str
    detail: str
    before: FreshnessReport
    after: FreshnessReport
    consented: bool
    index_result: IndexResult | None = None
    catalog_result: IndexResult | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "repo_id": self.repo_id,
            "action": self.action,
            "detail": self.detail,
            "consented": self.consented,
            "before": self.before.to_dict(),
            "after": self.after.to_dict(),
            "index_result": _index_result_dict(self.index_result),
            "catalog_result": _index_result_dict(self.catalog_result),
        }


def _index_result_dict(result: IndexResult | None) -> dict[str, object] | None:
    if result is None:
        return None
    return {
        "repo_id": result.repo_id,
        "files_scanned": result.files_scanned,
        "files_indexed": result.files_indexed,
        "files_deleted": result.files_deleted,
        "chunks_created": result.chunks_created,
        "chunks_vectorized": result.chunks_vectorized,
        "snapshot_state": result.snapshot_state,
        "snapshot_detail": result.snapshot_detail,
        "errors": list(result.errors),
    }


async def ensure_fresh(
    repo_path: str,
    *,
    repo_id: str | None = None,
    user_id: str | None = None,
    force: bool = False,
    max_files: int | None = None,
    ttl_s: float | None = None,
    indexer: CodebaseIndexer | None = None,
    consent_check: bool | None = None,
) -> RefreshOutcome:
    """让索引追上盘上代码;不新鲜才动,动了会给出"只重算哪些"的回执。

    Args:
        force: 即使判 fresh 也收敛一轮(增量口径,未变文件零 embedding)。
        consent_check: 允许调用方显式给"是否已同意出域"(端点可传同一次判定结果);
                       `None` ⇒ 现场判 `has_consent(user_id)`。
    """
    idx = indexer or codebase_indexer
    resolved = Path(repo_path).resolve()
    before = check_freshness(
        str(resolved), repo_id=repo_id, indexer=idx, max_files=max_files, ttl_s=ttl_s
    )
    consented = has_consent(user_id) if consent_check is None else consent_check
    action = "none"
    detail = "索引已是 fresh,无需刷新"
    index_result: IndexResult | None = None
    catalog_result: IndexResult | None = None
    notes: list[str] = []
    repo_id = before.repo_id or repo_id or ""

    # 只缺目录(文件未漂移)时是**纯本地补齐**:零远端,不受出域同意闸约束。
    catalog_gap_only = (
        before.state == FRESHNESS_STALE
        and before.changed_count == 0
        and before.added_count == 0
        and before.missing_count == 0
        and before.unread_count == 0
        and before.catalog_state != CATALOG_OK
    )
    needs_remote = force or before.state in (
        FRESHNESS_ABSENT,
        FRESHNESS_STALE,
        FRESHNESS_EXPIRED,
        FRESHNESS_UNKNOWN,
    )
    if catalog_gap_only:
        action = "catalog-only"
        detail = f"文件未漂移、目录为 {before.catalog_state} ⇒ 本地补齐目录(零远端)"
        catalog_result = idx.rebuild_catalog(str(resolved), repo_id=repo_id)
    elif needs_remote and not consented:
        action = "consent-required"
        detail = "未同意代码出域 ⇒ 一次远端调用都不发(索引保持原状,结论在此具名)"
    elif needs_remote:
        if before.state == FRESHNESS_STALE and before.changed_paths:
            abs_paths = [str(resolved / rel) for rel in before.changed_paths]
            index_result = await index_changed_paths(
                idx,
                str(resolved),
                abs_paths,
                repo_id=repo_id,
                internal_user_id=user_id,
            )
            action = "incremental"
            detail = (
                f"只重算 {before.changed_count + before.added_count + before.missing_count} 个漂移路径"
            )
            if any("未判定" in err for err in index_result.errors):
                notes.append("增量档拒绝了这批判定,回落全量(增量口径)")
                index_result = await idx.index_repository(
                    str(resolved),
                    repo_id=repo_id,
                    incremental=True,
                    internal_user_id=user_id,
                )
                action = "full"
                detail = "增量判据未判定,走全量(未变文件仍零 embedding)"
        else:
            index_result = await idx.index_repository(
                str(resolved),
                repo_id=repo_id,
                incremental=True,
                internal_user_id=user_id,
            )
            action = "full"
            detail = (
                f"{before.state} ⇒ 整轮收敛(增量口径:未变文件零 embedding)"
                if before.state != FRESHNESS_ABSENT
                else "首次建索引"
            )

    after = check_freshness(
        str(resolved), repo_id=repo_id, indexer=idx, max_files=max_files, ttl_s=ttl_s
    )
    if (
        after.state == FRESHNESS_FRESH
        and after.catalog_state != CATALOG_OK
        and catalog_result is None
    ):
        notes.append(f"文件已 fresh 但目录为 {after.catalog_state} ⇒ 本地补齐目录(零远端)")
        catalog_result = idx.rebuild_catalog(str(resolved), repo_id=repo_id)
        if action == "none":
            action = "catalog-only"
        after = check_freshness(
            str(resolved), repo_id=repo_id, indexer=idx, max_files=max_files, ttl_s=ttl_s
        )
    if notes:
        detail = f"{detail}；" + "；".join(notes)
    return RefreshOutcome(
        repo_id=repo_id,
        action=action,
        detail=detail,
        before=before,
        after=after,
        consented=consented,
        index_result=index_result,
        catalog_result=catalog_result,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
