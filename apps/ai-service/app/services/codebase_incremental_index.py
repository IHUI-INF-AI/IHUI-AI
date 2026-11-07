# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""事件驱动增量索引入口(goal-b49 Z8,2026-11-05 立)。

全量路径(`index_repository`)每轮做的是**全仓枚举 + 逐文件读内容算 sha256**:
Merkle 只免掉"变更集外文件"的切片/embedding/写入,读盘与枚举面仍是 O(全仓)。
本入口消费 file_watcher 的去抖变更批,只处理受影响路径;批的读盘半区拆在
`codebase_incremental_scan`(归位/ignore/hash,零写零落盘),本档负责快照闸、
别名存续、删除清理与写回落盘。判据面全部复用 `codebase_indexer` 的既有实现
(§0.6 零第二把尺)⇒ 同一变更集下,增量轮与全量轮落进索引的行集与快照逐字等值
(正向对照钉在 tests/test_incremental_watcher_pipeline.py)。

- 快照 absent/corrupt/truncated ⇒ 增量**拒绝判定**(未判定出声并点名,§0.3),
  交回 `index_repository(incremental=True)` 冷启动/收敛兜底;
- 改名/别名族的近同判定仍归全量路径(增量只判增/改/删三格);别名存续/复活
  的清理判据与全量同形。
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from pathlib import Path

from .codebase_incremental_scan import scan_incremental_batch
from .codebase_indexer import (
    _DOC_EXTS,
    _EXT_TO_LANG,
    _WRITE_BATCH_SIZE,
    SNAPSHOT_STATE_ABSENT,
    SNAPSHOT_STATE_CORRUPT,
    SNAPSHOT_STATE_LEGACY,
    SNAPSHOT_STATE_OK,
    SNAPSHOT_STATE_TRUNCATED,
    SUMMARY_SYMBOL_TYPES,
    CodebaseIndexer,
    CodeChunk,
    IndexResult,
    _default_repo_id,
    _extract_document_markdown,
    _merkle_root,
    classify_fs_path,
)
from .codebase_symbol_catalog import FileEntry, entry_from_chunks, merge_catalog
from .dir_rhash import diff_dir_rhash, dir_rhash_map

#: 可做增量判定的快照档(ok 自证通过;legacy 内容可用但无自证 —— 与全量路径同判)。
_USABLE_STATES: frozenset[str] = frozenset({SNAPSHOT_STATE_OK, SNAPSHOT_STATE_LEGACY})
#: 拒绝增量、必须走全量兜底的档(§0.3:取不到自证输入 ⇒ 不判,也不冒充"没有变更")。
_REFUSED_STATES: frozenset[str] = frozenset(
    {SNAPSHOT_STATE_ABSENT, SNAPSHOT_STATE_CORRUPT, SNAPSHOT_STATE_TRUNCATED}
)


async def index_changed_paths(
    indexer: CodebaseIndexer,
    repo_path: str,
    changed_paths: Sequence[str],
    repo_id: str | None = None,
    api_token: str | None = None,
    internal_user_id: str | None = None,
) -> IndexResult:
    """消费一批 watcher 变更路径,只重算受影响条目并写回同一份快照。

    Args:
        indexer: `codebase_indexer` 单例(判据与写通道都从它走,不复制)。
        repo_path: 仓库根(事件里的路径落在其内才属本仓增量面)。
        changed_paths: 去抖批(FileWatcherEvent.paths),绝对路径字符串。
        repo_id / api_token / internal_user_id: 与全量路径同参同义。

    三态纪律:空批/形态不合 ⇒ 未判定并点名;快照档不可自证 ⇒ 未判定 + 交回全量;
    其余每一格(重索引/零成本跳过/删除清理)都在 IndexResult 上可数。
    """
    root = Path(repo_path).resolve()
    root_kind = classify_fs_path(root)
    if root_kind == "unread":
        return IndexResult(
            repo_id=repo_id or "",
            errors=[f"仓库路径读不到,不能把它说成不存在或不是目录: {repo_path}"],
        )
    if root_kind != "dir":
        return IndexResult(repo_id=repo_id or "", errors=[f"仓库路径不存在或不是目录: {repo_path}"])

    repo_id = repo_id or _default_repo_id(root)
    result = IndexResult(repo_id=repo_id)
    if not changed_paths:
        result.errors.append(
            "changed_paths 为空 ⇒ 本轮未判定(不得读成「没有变更」;watcher 应只在拿到真实路径批时下发)"
        )
        return result

    # --- 快照闸:不可自证的档 ⇒ 未判定,交回全量兜底(本轮零写零删) ---
    snapshot = indexer._load_snapshot_read(repo_id, root)
    result.snapshot_state = snapshot.state
    result.snapshot_detail = snapshot.detail
    if snapshot.state in _REFUSED_STATES:
        detail = f"({snapshot.detail})" if snapshot.detail else ""
        result.errors.append(
            f"快照档 {snapshot.state}{detail} ⇒ 增量判定不可用(未判定):"
            "请调 index_repository(incremental=True) 冷启动/收敛,本轮零写零删"
        )
        return result

    scan = scan_incremental_batch(root, snapshot.files, snapshot.fingerprints, changed_paths)
    result.files_scanned = len(scan.rels)
    result.errors.extend(scan.malformed)
    result.errors.extend(scan.read_errors)
    if scan.out_of_scope:
        result.errors.append(f"{scan.out_of_scope} 条事件路径不在本仓({root})⇒ 增量面不判它们(跨仓需另立订阅)")
    result.files_unchanged = scan.unchanged
    result.files_ignored = scan.files_ignored
    result.ignored_by = scan.ignored_by
    result.files_tracked_ignored_kept = scan.tracked_ignored_kept
    result.tracked_ignored_kept = scan.tracked_ignored_kept_paths
    result.ignore_notes = scan.ignore_notes
    new_hashes = scan.new_hashes
    new_fingerprints = scan.new_fingerprints
    to_reindex = list(scan.to_reindex)

    # --- 别名存续/失效(与全量同判据:新路径仍在 ∧ 源路径没复活;源路径下的行保住) ---
    live_aliases: dict[str, str] = {}
    for new_path, source in snapshot.aliases.items():
        if new_path in new_hashes and source not in new_hashes:
            live_aliases[new_path] = source
    changed_rels_now = {rel for _p, rel, _l, _c in to_reindex}
    dropped_alias_sources: set[str] = set()
    for target, source in list(live_aliases.items()):
        if target in changed_rels_now:
            live_aliases.pop(target)
            if source not in new_hashes:
                dropped_alias_sources.add(source)
    protected_sources = set(live_aliases.values())
    deleted_paths = [rel for rel in sorted(scan.deleted_candidates) if rel in snapshot.files and rel not in protected_sources]
    deleted_paths += [src for src in sorted(dropped_alias_sources) if src not in deleted_paths]

    # --- 源路径复活 ⇒ 别名作废,目标强制按真实路径重嵌入(两枚文件不得共用同一批行) ---
    for new_path, source in snapshot.aliases.items():
        if new_path not in new_hashes or source not in new_hashes or new_path in changed_rels_now:
            continue
        lang = _EXT_TO_LANG.get(Path(new_path).suffix.lower())
        revived = root / Path(*new_path.split("/"))
        if lang is not None and revived.is_file():
            to_reindex.append((revived, new_path, lang, None))
            result.errors.append(
                f"改名别名失效:{new_path} 的源路径重新出现 ⇒ 本轮重新索引该路径"
                "(两枚文件不得共用同一批切片)"
            )

    # --- 目录前像差分(只读回执,与全量同一函数;不参与任何删/留决策) ---
    cur_dir_rhashes = dir_rhash_map(new_hashes)
    if snapshot.state in _USABLE_STATES:
        dir_diff = diff_dir_rhash(snapshot.dir_rhashes, cur_dir_rhashes)
        result.dir_rhash_note = dir_diff.as_note()
        result.dirs_moved = [
            {"newPath": new_path, "oldPath": old_path} for new_path, old_path in sorted(dir_diff.moved.items())
        ]

    result.merkle_root = _merkle_root(new_hashes)
    if deleted_paths:
        result.files_deleted = await indexer._delete_files_from_api(
            repo_id, deleted_paths, api_token, internal_user_id
        )

    # --- 切片(函数层 + 模块层)+ 架构层:全部走全量路径同一批方法 ---
    all_chunks: list[CodeChunk] = []
    layer_inputs: list[tuple[str, str, int]] = []
    #: 变更文件的目录条目(2026-11-06):未变文件沿用上一轮目录,与全量路径同判据。
    changed_entries: dict[str, FileEntry] = {}
    for path, rel, lang, pre_text in to_reindex:
        try:
            if pre_text is None:
                if path.suffix.lower() in _DOC_EXTS:
                    content = await asyncio.to_thread(_extract_document_markdown, path)
                else:
                    content = path.read_text(encoding="utf-8", errors="replace")
            else:
                content = pre_text
            file_chunks = indexer._chunk_by_ast(content, lang)
            for c in file_chunks:
                c.file_path = rel
            all_chunks.extend(file_chunks)
            result.files_indexed += 1
            layer_inputs.append((rel, lang, len(file_chunks)))
            changed_entries[rel] = entry_from_chunks(
                rel, lang, file_chunks, exclude_symbol_types=SUMMARY_SYMBOL_TYPES
            )
            module_chunk = indexer._build_module_summary_chunks(rel, lang, file_chunks)
            if module_chunk:
                all_chunks.append(module_chunk)
        except Exception as e:  # noqa: BLE001 - 与全量同形:单文件失败记 error 续批
            result.errors.append(f"{path}: {e}")

    symbol_count_by_rel = {rel: count for rel, _lang, count in layer_inputs}
    all_visible: list[tuple[str, str, int]] = [
        (rel, _EXT_TO_LANG.get(Path(rel).suffix.lower(), "") or "", symbol_count_by_rel.get(rel, 0))
        for rel in new_hashes
    ]
    if to_reindex or deleted_paths:
        all_chunks.extend(indexer._build_architecture_summary_chunks(all_visible))

    # --- 文件/符号目录:变更文件重建、删除文件摘除、未变文件沿用(2026-11-06) ---
    prev_catalog = snapshot.catalog if snapshot.state in _USABLE_STATES else None
    catalog = merge_catalog(prev_catalog, changed_entries, deleted_paths, aliases=live_aliases)
    for rel in new_hashes:
        if rel not in catalog.files:
            catalog.files[rel] = FileEntry(rel, _EXT_TO_LANG.get(Path(rel).suffix.lower()), ())

    result.chunks_created = len(all_chunks)
    if not all_chunks:
        indexer._save_snapshot(
            repo_id, root, new_hashes,
            fingerprints=new_fingerprints, aliases=live_aliases, dir_rhashes=cur_dir_rhashes,
            catalog=catalog,
        )
        return result

    result.chunks_vectorized = await indexer._generate_embeddings_batch(all_chunks)
    for i in range(0, len(all_chunks), _WRITE_BATCH_SIZE):
        batch = all_chunks[i : i + _WRITE_BATCH_SIZE]
        try:
            await indexer._write_to_api(repo_id, batch, api_token, internal_user_id)
        except Exception as e:  # noqa: BLE001 - 与全量同形:批次失败点名,快照照常收敛
            result.errors.append(f"写入批次 {i}-{i + len(batch)} 失败: {e}")

    indexer._save_snapshot(
        repo_id, root, new_hashes,
        fingerprints=new_fingerprints, aliases=live_aliases, dir_rhashes=cur_dir_rhashes,
        catalog=catalog,
    )
    return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
