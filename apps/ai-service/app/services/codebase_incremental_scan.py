# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""增量变更批的预扫(goal-b49 Z8 拆分的"只读判据"半区,2026-11-05 立)。

纯读盘:事件路径归位 → ignore 剪枝(全量同一函数)→ hash 判定(全量同算法)→
批结构。不触快照读写、不写库、不判别名 —— 那些在 `codebase_incremental_index`。
拆分目的写进导出集锁(见 test_incremental_watcher_pipeline):本档公开出口只有
BatchScan 与 scan_incremental_batch 两件,判据只有从 codebase_indexer Import 的
那几把尺,防"第二把尺"回潮(§0.6)。
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

from .codebase_indexer import (
    _DOC_EXTS,
    _EXT_TO_LANG,
    _file_content_hash,
    apply_index_ignore_rules,
)
from .rename_detect import compute_simhash, fingerprint_hex


@dataclass
class BatchScan:
    """批扫描结构:入口模块的唯一输入。畸形/读失败/仓外条**点名携带**,不静默吞。"""

    rels: list[str] = field(default_factory=list)
    abs_by_rel: dict[str, Path] = field(default_factory=dict)
    #: 合并后的快照草稿(prev 副本 + 批内更新 − 删除候选)。
    new_hashes: dict[str, str] = field(default_factory=dict)
    new_fingerprints: dict[str, str] = field(default_factory=dict)
    deleted_candidates: set[str] = field(default_factory=set)
    #: (绝对路径, 相对路径, 语言, 预读文本|None=None 留给切片步读)。
    to_reindex: list[tuple[Path, str, str, str | None]] = field(default_factory=list)
    malformed: list[str] = field(default_factory=list)
    read_errors: list[str] = field(default_factory=list)
    out_of_scope: int = 0
    unchanged: int = 0
    files_ignored: int = 0
    ignored_by: list[str] = field(default_factory=list)
    tracked_ignored_kept: int = 0
    tracked_ignored_kept_paths: list[str] = field(default_factory=list)
    ignore_notes: list[str] = field(default_factory=list)


def scan_incremental_batch(
    root: Path,
    prev_hashes: dict[str, str],
    prev_fingerprints: dict[str, str],
    changed_paths: Sequence[str],
) -> BatchScan:
    """把事件路径按盘上实况扫成批结构(零写零落盘;每格判据与全量路径同源)。"""
    scan = BatchScan(
        new_hashes=dict(prev_hashes),
        new_fingerprints=dict(prev_fingerprints),
    )
    # --- 归位:repo 外/形态不合逐条点名 ---
    for raw in changed_paths:
        if not isinstance(raw, str) or not raw.strip():
            scan.malformed.append(f"事件路径形态不合({raw!r})⇒ 该条弃判点名,批内其余条不受影响")
            continue
        resolved = Path(raw).resolve()
        try:
            rel = str(resolved.relative_to(root)).replace("\\", "/")
        except ValueError:
            scan.out_of_scope += 1
            continue
        if rel not in scan.abs_by_rel:
            scan.rels.append(rel)
            scan.abs_by_rel[rel] = resolved

    # --- 盘上不在 ⇒ 删除候选(只在快照里的才有行要清;误报的新路径事件无事可做) ---
    present: list[str] = []
    for rel in scan.rels:
        if scan.abs_by_rel[rel].is_file():
            present.append(rel)
        elif rel in prev_hashes:
            scan.deleted_candidates.add(rel)

    # --- ignore 剪枝:与全量同一个函数(跟踪但被忽略 ⇒ 保留并点名的口径也同源) ---
    kept = present
    if present:
        kept, ignore_report = apply_index_ignore_rules(present, root)
        scan.files_ignored = ignore_report.files_ignored
        scan.ignored_by = ignore_report.ignored_by
        scan.tracked_ignored_kept = ignore_report.tracked_kept
        scan.tracked_ignored_kept_paths = ignore_report.tracked_kept_paths
        scan.ignore_notes = list(ignore_report.errors)
        kept_set = set(kept)
        scan.deleted_candidates.update(rel for rel in present if rel not in kept_set and rel in prev_hashes)

    # --- hash 判定(与全量逐字同算法:doc 扩展名按原始字节,文本按内容+指纹) ---
    for rel in kept:
        path = scan.abs_by_rel[rel]
        lang = _EXT_TO_LANG.get(Path(rel).suffix.lower())
        if lang is None:
            if rel in prev_hashes:
                scan.deleted_candidates.add(rel)
            continue
        text: str | None = None
        fingerprint: str | None = None
        try:
            if path.suffix.lower() in _DOC_EXTS:
                content_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            else:
                text = path.read_text(encoding="utf-8", errors="replace")
                if not text.strip():
                    if rel in prev_hashes:
                        scan.deleted_candidates.add(rel)
                    continue
                content_hash = _file_content_hash(text)
                fingerprint = fingerprint_hex(compute_simhash(text))
        except Exception as e:  # noqa: BLE001 - 与全量同形:单文件错误记录不拖垮批
            scan.read_errors.append(f"{path}: {e}")
            continue
        if prev_hashes.get(rel) == content_hash:
            scan.unchanged += 1
            continue
        scan.new_hashes[rel] = content_hash
        if fingerprint is not None:
            scan.new_fingerprints[rel] = fingerprint
        else:
            scan.new_fingerprints.pop(rel, None)
        scan.to_reindex.append((path, rel, lang, text))

    for rel in scan.deleted_candidates:
        scan.new_hashes.pop(rel, None)
        scan.new_fingerprints.pop(rel, None)
    return scan
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
