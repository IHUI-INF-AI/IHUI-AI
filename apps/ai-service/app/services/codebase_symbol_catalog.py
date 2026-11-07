# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文件级 + 符号级代码库目录(2026-11-06,能力缺口「代码库索引」)。

为什么需要这一层
----------------
既有 `codebase_indexer` 的增量判据(Merkle 快照)只回答「哪些文件变了」,
检索面却只能走远端 `POST /api/v1/codebase/search`(向量/关键词,需要网络与
出域同意)。于是两件事在仓内是缺的:

1. **本地可用的文件/符号目录** —— agent 想"这个仓库里有没有 `foo` 这个函数、
   在哪个文件第几行"时,不必先发一次远端检索;
2. **目录随快照一起增量维护** —— 改了哪个文件就重建哪个文件的条目,没改的
   沿用上一轮,删掉的文件摘除;不另造第二份全量索引(§0.6)。

本模块是**纯结构**:目录的派生、序列化/校验、查找、按行取内容。
它不读写快照、不碰网络 —— 持久化与增量合并在 `codebase_indexer`,
过期/失效判定在 `codebase_index_status`。

与既有切片的关系
----------------
目录条目的唯一来源是 `CodeChunk`(文件路径/行区间/符号名/符号类型/语言)。
派生时用**调用方传入的** `exclude_symbol_types` 排除模块层/架构层合成摘要片
(那两类的 `symbol_name` 是文件名/目录名,不是真符号)。常量仍只有
`codebase_indexer.SUMMARY_SYMBOL_TYPES` 一处,本模块不复制默认值。
"""

from __future__ import annotations

import fnmatch
import re
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

#: 快照 payload 里的键(与 files/simhashes/aliases 同级)。
CATALOG_KEY = "symbolCatalog"
#: 目录形状版本。与 Merkle `SNAPSHOT_SCHEMA_VERSION` **分开**:目录缺席/旧版本
#: 只降级目录能力,不改判 Merkle 快照的可用性。
CATALOG_SCHEMA_VERSION = 1

#: 单条命中最多带多少字符正文(与 auto_context 的切片上限同量级,注入侧还有总预算)。
DEFAULT_MAX_CONTENT_CHARS = 2400
#: 文件级命中读前多少行(文件级检索只需要"这个文件长什么样"的开头)。
_FILE_LEVEL_HEAD_LINES = 40


class ChunkLike(Protocol):
    """`CodeChunk` 的结构契约(避免本模块 import indexer 造成环)。"""

    file_path: str
    line_start: int
    line_end: int
    language: str | None
    symbol_name: str | None
    symbol_type: str | None


@dataclass(frozen=True)
class SymbolEntry:
    """一个真符号(函数/类/方法/接口…)的定义位置。"""

    name: str
    kind: str
    line_start: int
    line_end: int
    language: str | None = None

    def to_payload(self) -> dict[str, object]:
        return {
            "name": self.name,
            "kind": self.kind,
            "lineStart": self.line_start,
            "lineEnd": self.line_end,
        }


@dataclass(frozen=True)
class FileEntry:
    """一个已被索引的文件:语言 + 其真符号清单(零符号文件也保留,供文件级查找)。"""

    path: str
    language: str | None
    symbols: tuple[SymbolEntry, ...] = ()

    @property
    def symbol_count(self) -> int:
        return len(self.symbols)


@dataclass(frozen=True)
class CatalogHit:
    """目录查找命中。形状与 `codebase_indexer.search()` 的切片向后兼容(只多键)。"""

    file_path: str
    line_start: int
    line_end: int | None
    symbol_name: str | None
    kind: str
    language: str | None
    score: float
    match: str
    alias_of: str | None = None
    content: str = ""
    content_note: str | None = None

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "content": self.content,
            "symbol_name": self.symbol_name,
            "symbol_type": self.kind,
            "language": self.language,
            "score": self.score,
            "match": self.match,
            "retrieval_leg": "local-catalog",
        }
        if self.alias_of is not None:
            payload["alias_of"] = self.alias_of
        if self.content_note is not None:
            payload["content_note"] = self.content_note
        return payload


@dataclass
class Catalog:
    """快照内的文件/符号目录。

    `complete` 是**能力自证**,不是装饰:False = 上一轮没有目录(旧档/首轮),
    本轮的未变文件没有逐一切片 ⇒ 目录只覆盖"这一轮重建过的那部分文件"。
    查找照常返回已有条目,但消费方必须能读到这一档,不得当成"全仓都查过"。
    """

    files: dict[str, FileEntry] = field(default_factory=dict)
    aliases: dict[str, str] = field(default_factory=dict)
    complete: bool = True

    @property
    def symbol_count(self) -> int:
        return sum(entry.symbol_count for entry in self.files.values())

    @property
    def state(self) -> str:
        if not self.files:
            return "absent"
        return "ok" if self.complete else "partial"

    def to_payload(self) -> dict[str, object]:
        return {
            "version": CATALOG_SCHEMA_VERSION,
            "complete": self.complete,
            "aliases": dict(self.aliases),
            "files": {
                path: {
                    "language": entry.language,
                    "symbols": [symbol.to_payload() for symbol in entry.symbols],
                }
                for path, entry in sorted(self.files.items())
            },
        }

    def iter_files(self) -> Iterator[tuple[str, FileEntry, str | None]]:
        """遍历查找面:真实文件 + 别名路径(别名路径指向仍持有切片的源路径)。"""
        for path, entry in self.files.items():
            yield path, entry, None
        for alias, source in self.aliases.items():
            if alias in self.files:
                continue  # 别名路径已被真文件占住 ⇒ 它有自己的条目,不重复
            source_entry = self.files.get(source)
            if source_entry is not None:
                yield alias, source_entry, source


def build_catalog(
    chunks: Iterable[ChunkLike],
    *,
    exclude_symbol_types: frozenset[str],
    pathless_symbol_types: frozenset[str] = frozenset(),
    language_by_path: Mapping[str, str | None] | None = None,
) -> Catalog:
    """从切片集合完整派生目录(全量路径用;`complete=True`)。

    Args:
        chunks: 本轮全部切片(函数层 + 合成摘要层均可,合成层会被排除)。
        exclude_symbol_types: 合成摘要片的 `symbol_type` 集(单源 = 调用方传入)。
        pathless_symbol_types: 挂在**目录**上的切片类型(架构层摘要):整片跳过,
            不产生文件条目。
        language_by_path: 文件 → 语言覆盖表(切片语言为空时回填)。
    """
    entries: dict[str, FileEntry] = {}
    for chunk in chunks:
        path = chunk.file_path
        if not path:
            continue
        if chunk.symbol_type in pathless_symbol_types:
            continue
        language = chunk.language
        if language is None and language_by_path is not None:
            language = language_by_path.get(path)
        seen = entries.get(path)
        symbols = list(seen.symbols) if seen is not None else []
        name = chunk.symbol_name
        kind = chunk.symbol_type
        if name and kind and kind not in exclude_symbol_types:
            symbol = SymbolEntry(
                name=name,
                kind=kind,
                line_start=chunk.line_start,
                line_end=chunk.line_end,
                language=language,
            )
            if symbol not in symbols:
                symbols.append(symbol)
        entries[path] = FileEntry(
            path=path,
            language=language if language is not None else (seen.language if seen else None),
            symbols=tuple(symbols),
        )
    return Catalog(files={path: _sort_entry(entry) for path, entry in entries.items()})


def entry_from_chunks(
    path: str,
    language: str | None,
    chunks: Iterable[ChunkLike],
    *,
    exclude_symbol_types: frozenset[str],
) -> FileEntry:
    """单个文件的目录条目(增量路径用:只重建变更文件的条目)。"""
    symbols: list[SymbolEntry] = []
    for chunk in chunks:
        name = chunk.symbol_name
        kind = chunk.symbol_type
        if not name or not kind or kind in exclude_symbol_types:
            continue
        symbol = SymbolEntry(
            name=name,
            kind=kind,
            line_start=chunk.line_start,
            line_end=chunk.line_end,
            language=chunk.language or language,
        )
        if symbol not in symbols:
            symbols.append(symbol)
    return _sort_entry(FileEntry(path=path, language=language, symbols=tuple(symbols)))


def _sort_entry(entry: FileEntry) -> FileEntry:
    """符号按 (行号, 名称) 排序:两路径(全量/增量)产出逐字等值,查找顺序也稳定。"""
    return FileEntry(
        path=entry.path,
        language=entry.language,
        symbols=tuple(sorted(entry.symbols, key=lambda s: (s.line_start, s.name, s.kind))),
    )


def merge_catalog(
    previous: Catalog | None,
    changed_entries: dict[str, FileEntry],
    removed_paths: Iterable[str],
    *,
    aliases: dict[str, str],
) -> Catalog:
    """增量维护目录:未变文件沿用上轮条目,变更文件重建,删除文件摘除。

    `previous is None` ⇒ `complete=False`:未变文件没有被本轮的切片覆盖,
    它们的条目确实缺席 —— 这一档必须能被消费方读到(见 `Catalog.complete`)。
    """
    files = dict(previous.files) if previous is not None else {}
    for path in removed_paths:
        files.pop(path, None)
    for path, entry in changed_entries.items():
        files[path] = _sort_entry(entry)
    return Catalog(
        files=files,
        aliases=dict(aliases),
        complete=bool(previous and previous.complete),
    )


def catalog_from_payload(raw: object) -> tuple[Catalog | None, str | None]:
    """解析快照里的目录键 → (目录, 坏形态原委)。

    - 缺席(None / 键不存在) ⇒ `(None, None)`:只降级为"没有目录",**不是坏档**;
    - 在场但形态不合 ⇒ `(None, 原委)`:调用方按既有纪律**点名**,不得静默当缺席。
    """
    if raw is None:
        return None, None
    if not isinstance(raw, dict):
        return None, "symbolCatalog 字段形态不合(不是对象)"
    version = raw.get("version")
    if isinstance(version, bool) or not isinstance(version, int) or version != CATALOG_SCHEMA_VERSION:
        return None, f"symbolCatalog version={version!r} 不在认得的档位里"
    complete = raw.get("complete", True)
    if not isinstance(complete, bool):
        return None, "symbolCatalog.complete 字段形态不合"
    raw_aliases = raw.get("aliases")
    aliases: dict[str, str] = {}
    if raw_aliases is not None:
        if not isinstance(raw_aliases, dict):
            return None, "symbolCatalog.aliases 字段形态不合"
        for alias, source in raw_aliases.items():
            if not isinstance(alias, str) or not isinstance(source, str):
                return None, "symbolCatalog.aliases 条目形态不合"
            aliases[alias] = source
    raw_files = raw.get("files")
    if raw_files is None:
        raw_files = {}
    if not isinstance(raw_files, dict):
        return None, "symbolCatalog.files 字段形态不合"
    files: dict[str, FileEntry] = {}
    for path, item in raw_files.items():
        if not isinstance(path, str) or not path:
            return None, "symbolCatalog.files 键形态不合"
        if not isinstance(item, dict):
            return None, f"symbolCatalog.files[{path}] 形态不合"
        language = item.get("language")
        if language is not None and not isinstance(language, str):
            return None, f"symbolCatalog.files[{path}].language 形态不合"
        raw_symbols = item.get("symbols")
        if not isinstance(raw_symbols, list):
            return None, f"symbolCatalog.files[{path}].symbols 形态不合"
        symbols: list[SymbolEntry] = []
        for raw_symbol in raw_symbols:
            if not isinstance(raw_symbol, dict):
                return None, f"symbolCatalog.files[{path}].symbols 条目形态不合"
            name = raw_symbol.get("name")
            kind = raw_symbol.get("kind")
            line_start = raw_symbol.get("lineStart")
            line_end = raw_symbol.get("lineEnd")
            if not isinstance(name, str) or not name:
                return None, f"symbolCatalog.files[{path}] 符号名形态不合"
            if not isinstance(kind, str) or not kind:
                return None, f"symbolCatalog.files[{path}] 符号类型形态不合"
            if (
                isinstance(line_start, bool)
                or not isinstance(line_start, int)
                or isinstance(line_end, bool)
                or not isinstance(line_end, int)
                or line_start < 1
                or line_end < line_start
            ):
                return None, f"symbolCatalog.files[{path}] 符号行区间形态不合"
            symbols.append(
                SymbolEntry(
                    name=name,
                    kind=kind,
                    line_start=line_start,
                    line_end=line_end,
                    language=language,
                )
            )
        files[path] = _sort_entry(
            FileEntry(path=path, language=language, symbols=tuple(symbols))
        )
    return Catalog(files=files, aliases=aliases, complete=complete), None


# ---------------------------------------------------------------------------
# 查找
# ---------------------------------------------------------------------------

_ASCII_WORD = re.compile(r"[A-Za-z0-9_]+")
_CAMEL_PART = re.compile(r"[A-Z][a-z0-9_]*|[a-z0-9_]+")


def _query_terms(query: str) -> list[str]:
    """查询 → 词项(小写 ascii 词 + camelCase 子词)。中文整句不产出词项,
    这是刻意的:符号名/路径是 ascii 命名空间,中文查询由语义腿负责,
    本地腿只做它能真判的那部分(判不出就不返回,而不是拿空结果冒充"没有")。"""
    terms: list[str] = []
    for word in _ASCII_WORD.findall(query or ""):
        lowered = word.lower()
        if len(lowered) >= 2 and lowered not in terms:
            terms.append(lowered)
        if len(word) > 2:
            for part in _CAMEL_PART.findall(word):
                sub = part.lower()
                if len(sub) >= 2 and sub not in terms:
                    terms.append(sub)
    phrase = (query or "").strip().lower()
    if len(phrase) >= 3 and phrase.isascii() and phrase not in terms:
        terms.insert(0, phrase)
    return terms


def _path_matches(
    path: str, *, path_glob: str | None, path_prefix: str | None
) -> bool:
    if path_prefix and not path.startswith(path_prefix.rstrip("/")):
        return False
    return not (path_glob and not fnmatch.fnmatch(path, path_glob))


def lookup(
    catalog: Catalog,
    query: str,
    *,
    kind: str | None = None,
    path_glob: str | None = None,
    path_prefix: str | None = None,
    max_results: int = 20,
) -> list[CatalogHit]:
    """在目录里查符号/文件(零 IO)。

    Args:
        kind: 只保留该符号类型(`"file"` = 只要文件级命中;None = 两者都参加)。
        path_glob / path_prefix: 路径限定(glob 与纯前缀,二者同时给时取交集)。
        max_results: 命中上限(按分数降序,同分按路径/行号稳定排序)。
    """
    terms = _query_terms(query)
    if not terms or max_results <= 0:
        return []
    kind_filter = (kind or "").strip().lower()
    hits: list[CatalogHit] = []
    for path, entry, alias_of in catalog.iter_files():
        if not _path_matches(path, path_glob=path_glob, path_prefix=path_prefix):
            continue
        lowered_path = path.lower()
        base = re.split(r"[/\\]", lowered_path)[-1]
        base_no_ext = base.rsplit(".", 1)[0] if "." in base else base
        file_score = 0.0
        for term in terms:
            if term == base_no_ext:
                file_score += 4.0
            elif term in base_no_ext:
                file_score += 2.0
            elif term in lowered_path:
                file_score += 1.0
        symbol_side: list[CatalogHit] = []
        for symbol in entry.symbols:
            symbol_kind = symbol.kind.lower()
            if kind_filter and kind_filter != "file" and symbol_kind != kind_filter:
                continue
            name = symbol.name.lower()
            symbol_score = 0.0
            for term in terms:
                if term == name:
                    symbol_score += 6.0
                elif term in name:
                    symbol_score += 2.5
            if symbol_score > 0.0:
                symbol_side.append(
                    CatalogHit(
                        file_path=path,
                        line_start=symbol.line_start,
                        line_end=symbol.line_end,
                        symbol_name=symbol.name,
                        kind=symbol.kind,
                        language=symbol.language or entry.language,
                        score=symbol_score + file_score * 0.5,
                        match="symbol-exact" if symbol_score >= 6.0 else "symbol-contains",
                        alias_of=alias_of,
                    )
                )
        if symbol_side:
            hits.extend(symbol_side)
            continue
        if kind_filter and kind_filter not in ("", "file"):
            continue  # 指定了符号类型但该文件没有匹配符号:不拿文件级命中顶替
        file_level_wanted = (
            kind_filter == "file" and file_score > 0.0
        ) or (not kind_filter and file_score >= 2.0)
        if file_level_wanted:
            hits.append(
                CatalogHit(
                    file_path=path,
                    line_start=1,
                    line_end=None,
                    symbol_name=None,
                    kind="file",
                    language=entry.language,
                    score=file_score,
                    match="file",
                    alias_of=alias_of,
                )
            )
    hits.sort(key=lambda h: (-h.score, h.file_path, h.line_start or 0))
    return hits[:max_results]


def read_hit_content(root: Path, hit: CatalogHit, *, max_chars: int = DEFAULT_MAX_CONTENT_CHARS) -> CatalogHit:
    """按命中的行区间读盘,产出可直接注入的正文(读不到 ⇒ 留具名 `content_note`)。"""
    path = root / hit.file_path
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return _replace_content(hit, "", f"命中文件读不到({type(exc).__name__})⇒ 索引可能已过期")
    lines = text.splitlines()
    start = max(hit.line_start - 1, 0)
    end = hit.line_end if hit.line_end is not None else min(len(lines), start + _FILE_LEVEL_HEAD_LINES)
    body = "\n".join(lines[start:end]).strip()
    if not body:
        return _replace_content(hit, "", "命中区间在盘上已是空内容 ⇒ 索引可能已过期")
    if len(body) > max_chars:
        body = body[:max_chars] + "\n…(截断)"
    return _replace_content(hit, body, None)


def _replace_content(hit: CatalogHit, content: str, note: str | None) -> CatalogHit:
    return CatalogHit(
        file_path=hit.file_path,
        line_start=hit.line_start,
        line_end=hit.line_end,
        symbol_name=hit.symbol_name,
        kind=hit.kind,
        language=hit.language,
        score=hit.score,
        match=hit.match,
        alias_of=hit.alias_of,
        content=content,
        content_note=note,
    )


def search_local_catalog(
    root: Path,
    catalog: Catalog,
    query: str,
    *,
    top_k: int = 10,
    kind: str | None = None,
    path_glob: str | None = None,
    max_content_chars: int = DEFAULT_MAX_CONTENT_CHARS,
) -> list[dict[str, object]]:
    """本地检索入口(查找 + 取正文)。命中形状与远端 `search()` 的切片向后兼容。"""
    hits = lookup(
        catalog,
        query,
        kind=kind,
        path_glob=path_glob,
        max_results=max(top_k, 0),
    )
    return [
        read_hit_content(root, hit, max_chars=max_content_chars).to_dict()
        for hit in hits
    ]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
