# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""KnowledgeFS —— 把 codebase 语义索引投影成只读虚拟文件系统(2026-10-31 G2 立)。

对齐(`docs/benchmark-evidence/2026-10/trae-rea-20261031/T2-trae-periphery.md` §1.4/§8-G2):
Trae CN 的 ckg 模块(39.6MB Go+CGO 原生服务,端口 50000)把代码知识挂载成一套
`Cfs*` 虚拟文件系统(gRPC 21 枚消息:mount/read/write/stat/search/listdir/mkdir/
rename/remove/resolve/health/listmounts),agent 用文件语义就能拿到索引结果。

本仓对位物:把 apps/api `codebase_chunks` 三层切片(函数/模块/架构,见
codebase_indexer.py 头注)按 `/repo/<repoId>/<filePath>#<symbolName>` 投影成
**只读**虚拟路径。超越轴:①**可证明的只读** —— 写面(write/mkdir/rename/
remove)刻意不做,索引写入方只有索引器;②**归属隔离** —— 每次调用都带
internal_user_id 走 api 侧 _ownerScope fail-closed(对侧取证未证到逐用户隔离);
③**三态诚实** —— 身份缺失/路径不存在/上游不可用三个失败方向各给显式状态,不冒绿。

身份头构造单源 = codebase_indexer._internal_auth_headers(§0.6:本模块零复制
该判据);语义检索单源 = codebase_indexer.search(hybrid 由 api 侧裁决)。
路径数据源 = GET /api/v1/codebase/repo/:repoId/chunks(2026-10-31 同批新增,
见 v1-codebase-search.ts);内容数据源 = GET /api/v1/codebase/repo/:repoId/file。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from .codebase_indexer import codebase_indexer

logger = logging.getLogger(__name__)

_VFS_ROOT = "/repo/"
_MISSING_IDENTITY: dict[str, Any] = {
    "status": "skipped_missing_identity",
    "detail": "internal_user_id 未注入:知识文件系统按归属隔离,拒绝无身份查询",
}


@dataclass(frozen=True)
class VPathRef:
    """解析后的虚拟路径(§1 证据锚点:路径即地址,不靠行号)。"""

    repo_id: str
    file_path: str
    symbol_name: str | None  # None = 文件级(聚合)


def vpath_of(repo_id: str, file_path: str, symbol_name: str | None = None) -> str:
    """切片元数据 → 虚拟路径(纯函数)。"""
    fp = (file_path or "").lstrip("/")
    base = f"{_VFS_ROOT}{repo_id}/{fp}"
    return f"{base}#{symbol_name}" if symbol_name else base


def parse_vpath(path: str) -> VPathRef | None:
    """虚拟路径 → VPathRef;非法形态返回 None(调用方落 path_invalid,不猜)。"""
    if not isinstance(path, str) or not path.startswith(_VFS_ROOT):
        return None
    rest = path[len(_VFS_ROOT):]
    if not rest or rest.startswith("/"):
        return None
    symbol_name: str | None = None
    if "#" in rest:
        rest, symbol_name = rest.split("#", 1)
        if not symbol_name:
            return None
    repo_id, _, file_path = rest.partition("/")
    if not repo_id or not file_path or file_path.endswith("/"):
        return None
    if "//" in file_path or not all(seg for seg in file_path.split("/")):
        return None
    return VPathRef(repo_id=repo_id, file_path=file_path, symbol_name=symbol_name)


def parse_vdir(prefix: str) -> tuple[str, str] | None:
    """list 场景的路径前缀解析 → (repo_id, rel_dir);rel_dir 允许为空(挂载根)。

    与 parse_vpath 分开:list 的合法面(`/repo/<repoId>/`)对 read/stat 是
    非法的 —— 两把尺子各管各的合法面,不互相迁就。
    """
    if not isinstance(prefix, str) or not prefix.startswith(_VFS_ROOT):
        return None
    rest = prefix[len(_VFS_ROOT):].rstrip("/")
    if not rest or "//" in rest or "#" in rest or not all(seg for seg in rest.split("/")):
        return None
    repo_id, _, rel_dir = rest.partition("/")
    return (repo_id, rel_dir)


def group_entries(
    rows: list[dict[str, Any]],
    rel_dir: str,
) -> list[dict[str, str]]:
    """路径行 → 指定相对目录下的单层条目(dir/file;纯函数,可测)。

    rel_dir = "" 表示挂载根。同一段既有更深层文件又有自身是文件的行时,
    一段同时报 dir 与 file 两条(真实文件系统同形,不算冲突)。
    """
    dirs: dict[str, None] = {}
    files: dict[str, None] = {}
    prefix = f"{rel_dir}/" if rel_dir else ""
    for row in rows:
        fp = str(row.get("filePath") or "").lstrip("/")
        if not fp or (rel_dir and not fp.startswith(prefix)):
            continue
        tail = fp[len(prefix):]
        if not tail:
            continue
        if "/" in tail:
            dirs[f"{tail.split('/', 1)[0]}/"] = None
        else:
            files[tail] = None
    entries = [
        {"type": "dir", "name": name} for name in sorted(dirs)
    ]
    entries += [
        {"type": "file", "name": name} for name in sorted(files)
    ]
    return entries


class KnowledgeFS:
    """只读虚拟文件系统出口(list/read/stat/search)。"""

    def __init__(self) -> None:
        # 单源复用:base url 与身份头都取自 codebase_indexer(§0.6 零第二份)
        self._indexer = codebase_indexer

    def _headers(
        self, internal_user_id: str | None, api_token: str | None
    ) -> dict[str, str]:
        return self._indexer._internal_auth_headers(api_token, internal_user_id)

    async def _fetch_path_index(
        self,
        repo_id: str,
        internal_user_id: str | None,
        api_token: str | None,
    ) -> list[dict[str, Any]] | None:
        """取路径投影元数据;上游失败返回 None(调用方落 upstream_unavailable)。"""
        url = f"{self._indexer._api_base_url}/api/v1/codebase/repo/{repo_id}/chunks"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers(internal_user_id, api_token))
            if resp.status_code >= 400:
                logger.warning("knowledge_fs 路径清单失败 %s: HTTP %s", repo_id, resp.status_code)
                return None
            payload = resp.json() or {}
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("knowledge_fs 路径清单异常 %s: %s", repo_id, e)
            return None
        return list(payload.get("data") or [])

    async def _fetch_file_chunks(
        self,
        repo_id: str,
        file_path: str,
        internal_user_id: str | None,
        api_token: str | None,
    ) -> list[dict[str, Any]] | None:
        url = (
            f"{self._indexer._api_base_url}/api/v1/codebase/repo/{repo_id}/file"
            f"?path={httpx.QueryParams({'path': file_path})['path']}"
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers(internal_user_id, api_token))
            if resp.status_code >= 400:
                logger.warning("knowledge_fs 文件聚合失败 %s: HTTP %s", file_path, resp.status_code)
                return None
            payload = resp.json() or {}
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("knowledge_fs 文件聚合异常 %s: %s", file_path, e)
            return None
        return list((payload.get("data") or {}).get("chunks") or [])

    async def list_dir(
        self,
        prefix: str,
        internal_user_id: str | None,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """列目录(prefix 必须是 /repo/<repoId>/ 或其子目录)。"""
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        parsed = parse_vdir(prefix)
        if parsed is None:
            return {"status": "path_invalid", "detail": f"list 需要 /repo/<repoId>/[dir/] 形态,得到: {prefix!r}"}
        repo_id, rel_dir = parsed
        rows = await self._fetch_path_index(repo_id, internal_user_id, api_token)
        if rows is None:
            return {"status": "upstream_unavailable", "detail": "api 侧路径清单不可用"}
        entries = group_entries(rows, rel_dir)
        if not entries and rel_dir:
            mounted = group_entries(rows, "")
            if not mounted:
                return {"status": "path_missing", "detail": f"repo {repo_id} 无索引切片(可能未建索引)"}
            return {"status": "path_missing", "detail": f"目录不存在: {prefix!r}"}
        return {
            "status": "ok",
            "path": f"{_VFS_ROOT}{repo_id}/{rel_dir}".rstrip("/") + "/",
            "entries": entries,
            "total_rows": len(rows),
        }

    async def stat(
        self,
        path: str,
        internal_user_id: str | None,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """路径元数据(切片数/行范围/语言/符号类型;不回内容)。"""
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        ref = parse_vpath(path)
        if ref is None:
            return {"status": "path_invalid", "detail": f"路径形态非法: {path!r}"}
        rows = await self._fetch_path_index(ref.repo_id, internal_user_id, api_token)
        if rows is None:
            return {"status": "upstream_unavailable", "detail": "api 侧路径清单不可用"}
        hit = [r for r in rows if str(r.get("filePath") or "").lstrip("/") == ref.file_path]
        if not hit:
            return {"status": "path_missing", "detail": f"文件不在索引内: {path!r}"}
        if ref.symbol_name is not None:
            hit = [r for r in hit if r.get("symbolName") == ref.symbol_name]
            if not hit:
                return {"status": "path_missing", "detail": f"符号不在索引内: {path!r}"}
        return {
            "status": "ok",
            "path": path,
            "chunks": len(hit),
            "line_start": min(int(r.get("lineStart") or 0) for r in hit),
            "line_end": max(int(r.get("lineEnd") or 0) for r in hit),
            "language": next((r.get("language") for r in hit if r.get("language")), None),
            "symbol_types": sorted({str(r.get("symbolType")) for r in hit if r.get("symbolType")}),
        }

    async def read(
        self,
        path: str,
        internal_user_id: str | None,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """读内容。文件级 = 全部切片按行序诚实拼接(带分片头,不假装是原文件)。"""
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        ref = parse_vpath(path)
        if ref is None:
            return {"status": "path_invalid", "detail": f"路径形态非法: {path!r}"}
        chunks = await self._fetch_file_chunks(ref.repo_id, ref.file_path, internal_user_id, api_token)
        if chunks is None:
            return {"status": "upstream_unavailable", "detail": "api 侧文件切片不可用"}
        if not chunks:
            return {"status": "path_missing", "detail": f"文件不在索引内(或为空): {path!r}"}
        if ref.symbol_name is not None:
            chunks = [c for c in chunks if c.get("symbolName") == ref.symbol_name]
            if not chunks:
                return {"status": "path_missing", "detail": f"符号不在索引内: {path!r}"}
        parts = [
            f"# ---- chunk {i + 1}/{len(chunks)}: {c.get('symbolName') or c.get('symbolType') or 'fixed'}"
            f" (L{c.get('lineStart')}-L{c.get('lineEnd')}) ----\n{c.get('content') or ''}"
            for i, c in enumerate(chunks)
        ]
        return {
            "status": "ok",
            "path": vpath_of(ref.repo_id, ref.file_path, ref.symbol_name),
            "chunks": len(chunks),
            "content": "\n\n".join(parts),
        }

    async def search(
        self,
        query: str,
        internal_user_id: str | None,
        repo_id: str | None = None,
        top_k: int = 8,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """语义检索 → 虚拟路径投影(检索判据单源 = codebase_indexer.search)。"""
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        try:
            hits = await self._indexer.search(
                query,
                repo_id=repo_id,
                top_k=max(1, min(int(top_k), 50)),
                api_token=api_token,
                internal_user_id=internal_user_id,
            )
        except Exception as e:  # noqa: BLE001 — 检索出口异常按上游不可用落态
            logger.warning("knowledge_fs search 异常: %s", e)
            return {"status": "upstream_unavailable", "detail": f"语义检索出口异常: {e}"}
        if not hits:
            return {
                "status": "empty_ambiguous",
                "detail": "零命中或检索出口不可用,二者同形 ⇒ 未判定(AGENTS.md §0.3)",
                "results": [],
            }
        results = [
            {
                "path": vpath_of(
                    str(h.get("repoId") or repo_id or ""),
                    str(h.get("file_path") or h.get("filePath") or ""),
                    h.get("symbol_name") or h.get("symbolName"),
                ),
                "score": h.get("score"),
                "line_start": h.get("line_start") or h.get("lineStart"),
                "line_end": h.get("line_end") or h.get("lineEnd"),
                "preview": (str(h.get("content") or "")[:200]),
            }
            for h in hits
        ]
        return {"status": "ok", "query": query, "results": results}

    async def _fetch_index_state(
        self,
        repo_id: str,
        internal_user_id: str | None,
        api_token: str | None,
        max_age_ms: int,
    ) -> dict[str, Any] | None:
        """取索引状态与重建判据;上游失败返回 None(调用方落 upstream_unavailable)。"""
        qs = httpx.QueryParams({"maxAgeMs": str(max_age_ms)})
        url = f"{self._indexer._api_base_url}/api/v1/codebase/repo/{repo_id}/index-state?{qs}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers(internal_user_id, api_token))
            if resp.status_code >= 400:
                logger.warning("knowledge_fs 索引状态失败 %s: HTTP %s", repo_id, resp.status_code)
                return None
            payload = resp.json() or {}
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("knowledge_fs 索引状态异常 %s: %s", repo_id, e)
            return None
        data = payload.get("data") or {}
        if not isinstance(data, dict) or not data.get("decision"):
            # 响应缺 decision 字段 = 判据没答上来 ⇒ 按未判定处理,不把空串当 reuse-fresh
            return None
        return dict(data)

    async def index_state(
        self,
        repo_id: str,
        internal_user_id: str | None,
        api_token: str | None = None,
        max_age_ms: int = 0,
    ) -> dict[str, Any]:
        """索引状态与重建判据(P0-8 第六批,2026-11-23;`needsRebuild` 的生产消费方)。

        `max_age_ms` 缺省 0 = **不按时间判过期**(只看有没有状态、指纹变没变)。
        想按窗口判过期由调用方显式给出 —— 窗口是运维口径,不给默认值冒充。
        """
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        if not repo_id:
            return {"status": "invalid_argument", "detail": "repo_id 必填"}
        bounded = max(0, int(max_age_ms))
        data = await self._fetch_index_state(repo_id, internal_user_id, api_token, bounded)
        if data is None:
            return {"status": "upstream_unavailable", "detail": "api 侧索引状态不可用,重建判据未判定"}
        return {
            "status": "ok",
            "repo_id": repo_id,
            "decision": data["decision"],
            "current_fingerprint": data.get("currentFingerprint"),
            "state": data.get("state"),
            "max_age_ms": bounded,
        }

    async def _fetch_symbol_definitions(
        self,
        repo_id: str,
        name: str,
        internal_user_id: str | None,
        api_token: str | None,
        limit: int,
    ) -> list[dict[str, Any]] | None:
        """取实体表里该符号的定义簇;上游失败返回 None(调用方落 upstream_unavailable)。"""
        qs = httpx.QueryParams({"name": name, "limit": str(limit)})
        url = f"{self._indexer._api_base_url}/api/v1/codebase/repo/{repo_id}/entities?{qs}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers(internal_user_id, api_token))
            if resp.status_code >= 400:
                logger.warning("knowledge_fs 实体清单失败 %s: HTTP %s", repo_id, resp.status_code)
                return None
            payload = resp.json() or {}
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("knowledge_fs 实体清单异常 %s: %s", repo_id, e)
            return None
        return list((payload.get("data") or {}).get("entities") or [])

    async def list_symbols(
        self,
        repo_id: str,
        name: str,
        internal_user_id: str | None,
        api_token: str | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        """按符号名查**跨文件**定义位置(P0-8 第四批,2026-11-23;实体表的读面消费方)。

        为什么需要它(与 ckg 的差别):`read`/`stat` 拿的是**一条已知路径**上的内容,
        agent 在"这个函数到底定义在哪个文件"这一步没有入口。对侧 cfs 的 resolve 只
        解析路径形态;这里的输入是**符号名本身**,输出是同名符号在仓库里**所有**定义
        位置 —— 跨文件的簇是这一层独有的信息,单文件切片给不出。

        空集的三因三分(不合并成一个"没找到"):
        - 实体表有行 ⇒ `ok`;
        - 实体表空且路径清单也空 ⇒ `path_missing`(没建索引);
        - 实体表空但路径清单有切片 ⇒ `catalog_missing`(索引早于实体表,重建可补),
          与"符号确实不存在"同形,故在 detail 里点明这条判据是二义的(§0.3)。

        2026-11-23 第六批:这一支额外读一次索引状态(`evaluateRebuild` 判据),把
        "为什么需要重建"(指纹变了 / 超窗 / 无状态)写进 detail;状态取不到时该读数
        标未判定,**不改**三因三分本身的结论。
        """
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        if not repo_id:
            return {"status": "invalid_argument", "detail": "repo_id 必填"}
        symbol = (name or "").strip()
        if not symbol:
            return {"status": "invalid_argument", "detail": "name 必填(符号名逐字相等,不做模糊匹配)"}
        bounded = max(1, min(int(limit), 200))
        rows = await self._fetch_symbol_definitions(
            repo_id, symbol, internal_user_id, api_token, bounded
        )
        if rows is None:
            return {"status": "upstream_unavailable", "detail": "api 侧实体清单不可用"}
        if rows:
            return {
                "status": "ok",
                "repo_id": repo_id,
                "name": symbol,
                "count": len(rows),
                "definitions": [
                    {
                        "path": vpath_of(repo_id, str(r.get("filePath") or ""), symbol),
                        "file_path": str(r.get("filePath") or ""),
                        "line_start": r.get("lineStart"),
                        "line_end": r.get("lineEnd"),
                        "kind": r.get("kind"),
                    }
                    for r in rows
                ],
            }
        # 空集有两种因(未建索引 / 索引早于实体表)。先问路径清单区分,不把两种因都写成"没找到"。
        chunks = await self._fetch_path_index(repo_id, internal_user_id, api_token)
        if chunks is None:
            return {
                "status": "upstream_unavailable",
                "detail": "api 侧路径清单不可用,空集归因未判定",
            }
        if not chunks:
            return {
                "status": "path_missing",
                "detail": f"repo {repo_id} 无索引切片(可能未建索引)",
            }
        # 只在这一支多发一次请求(P0-8 第六批):有切片却查不到实体时,索引状态能回答
        # "是配置指纹变了/过期了,还是压根没记录过"——三者对收信人的动作完全不同
        # (重建 / 不用重建 / 先补索引状态)。
        idx = await self.index_state(repo_id, internal_user_id, api_token)
        out: dict[str, Any] = {
            "status": "catalog_missing",
            "detail": (
                "repo 有切片但实体表无该符号:或索引建立于实体表之前(重建索引可补齐),"
                "或该符号确实不存在 —— 二者同形,故本态不作断言"
            ),
            "repo_id": repo_id,
            "name": symbol,
        }
        if idx.get("status") == "ok":
            decision = str(idx["decision"])
            out["index_state"] = {
                "decision": decision,
                "state": idx.get("state"),
                "current_fingerprint": idx.get("current_fingerprint"),
            }
            if decision != "reuse-fresh":
                # 判据说该重建 ⇒ 把"为什么该重建"写进原委,收信人不用再自己去查一遍
                out["detail"] += f";索引状态判据:{decision} ⇒ 需要重建索引"
        else:
            # 取不到状态 ⇒ 这条读数标未判定;原有三因三分的结论保持不变(不混档)
            out["index_state"] = {"status": idx.get("status"), "detail": "索引状态未判定"}
        return out

    async def _fetch_import_edges(
        self,
        repo_id: str,
        internal_user_id: str | None,
        api_token: str | None,
        params: dict[str, str],
        limit: int,
    ) -> list[dict[str, Any]] | None:
        """取边表行;上游失败返回 None(调用方落 upstream_unavailable)。"""
        qs = httpx.QueryParams({**params, "limit": str(limit)})
        url = f"{self._indexer._api_base_url}/api/v1/codebase/repo/{repo_id}/edges?{qs}"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=self._headers(internal_user_id, api_token))
            if resp.status_code >= 400:
                logger.warning("knowledge_fs 边清单失败 %s: HTTP %s", repo_id, resp.status_code)
                return None
            payload = resp.json() or {}
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("knowledge_fs 边清单异常 %s: %s", repo_id, e)
            return None
        return list((payload.get("data") or {}).get("edges") or [])

    async def list_imports(
        self,
        repo_id: str,
        target: str,
        internal_user_id: str | None,
        api_token: str | None = None,
        direction: str = "from",
        limit: int = 50,
    ) -> dict[str, Any]:
        """按名字查导入边(P0-8 第八批,2026-11-23;边表的读面消费方)。

        `direction` 只有两档,语义不同:
        - `from`(缺省):这个**文件**导入了谁 —— 输入是仓库相对路径,按 filePath 查;
        - `to`:谁导入了这个**名字** —— 输入是 import 名字原文,按 toName 查。

        两档不做"智能猜测"(猜路径还是名字会把两件事混成一件)。

        空集归因:
        - 边表有行 ⇒ `ok`;
        - 边表空且路径清单也空 ⇒ `path_missing`(没建索引);
        - 边表空但有切片 ⇒ `catalog_missing`。**这一档比实体面多一层二义**:边只覆盖
          python 风格 import 行(TS 的 `import {x} from 'm'` 不匹配既有正则),所以
          "有切片无边"既可能是索引早于边表,也可能是该仓库全是 TS —— detail 必须
          把这层写清,不能断言"没有导入关系"。
        """
        if not internal_user_id:
            return dict(_MISSING_IDENTITY)
        if not repo_id:
            return {"status": "invalid_argument", "detail": "repo_id 必填"}
        if direction not in ("from", "to"):
            return {"status": "invalid_argument", "detail": "direction 只支持 from / to"}
        tgt = (target or "").strip()
        if not tgt:
            return {
                "status": "invalid_argument",
                "detail": "target 必填(名字逐字相等,不做模糊匹配)",
            }
        bounded = max(1, min(int(limit), 200))
        params = {("filePath" if direction == "from" else "toName"): tgt, "kind": "import"}
        rows = await self._fetch_import_edges(
            repo_id, internal_user_id, api_token, params, bounded
        )
        if rows is None:
            return {"status": "upstream_unavailable", "detail": "api 侧边清单不可用"}
        if rows:
            return {
                "status": "ok",
                "repo_id": repo_id,
                "target": tgt,
                "direction": direction,
                "count": len(rows),
                "edges": [
                    {
                        "path": vpath_of(
                            repo_id,
                            str(r.get("filePath") or ""),
                            str(r.get("toName") or ""),
                        ),
                        "file_path": str(r.get("filePath") or ""),
                        "line": r.get("line"),
                        "kind": r.get("kind"),
                        "from_name": r.get("fromName"),
                        "to_name": r.get("toName"),
                    }
                    for r in rows
                ],
            }
        chunks = await self._fetch_path_index(repo_id, internal_user_id, api_token)
        if chunks is None:
            return {
                "status": "upstream_unavailable",
                "detail": "api 侧路径清单不可用,空集归因未判定",
            }
        if not chunks:
            return {
                "status": "path_missing",
                "detail": f"repo {repo_id} 无索引切片(可能未建索引)",
            }
        return {
            "status": "catalog_missing",
            "detail": (
                "repo 有切片但边表无该记录:或索引建立于边表之前(重建索引可补齐),"
                "或该仓库的导入行不匹配既有抽取正则(当前只覆盖 python 风格 import,"
                "TS/JS 的 import {x} from 'm' 不产边) —— 二者同形,故本态不作断言"
            ),
            "repo_id": repo_id,
            "target": tgt,
            "direction": direction,
        }


knowledge_fs = KnowledgeFS()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
