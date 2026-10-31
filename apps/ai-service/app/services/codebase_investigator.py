# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-11(2026-10-31 立):CodebaseInvestigator 等价专职工具 —— 只读代码库调查。

对标 Qoder CN 的 CodebaseInvestigator(S2-agent-sdk §5/§10-11)与 Trae ckg 的
"查知识不动东西"语义,但超越轴在**可证明的只读**:对方取证只证到工具存在,本仓版
由测试直接断言"调查全程零写盘/零派生进程/零索引变更/零本模块自发的网络调用"。

组合的既有出口(§0.6 单一真相源,本模块不复写任何检索/切片/评分判据):
- 词法腿:rg_fallback_parity.enumerate_code_files / search_file_contents
  (默认 prefer_rg=False ⇒ 不派生 rg 子进程;降级原委由 provenance 带出)
- 语义腿:codebase_indexer.search(只读检索;绝不调用 index_repository/index_file/懒索引)
- Wiki 腿:repo_wiki_engine._load_disk(只读磁盘缓存;绝不触发 ensure_wiki 的生成/写盘)

三态诚实(AGENTS.md §0.3):
- 语义出口失败与零命中同为空列表 ⇒ 一律落 empty_ambiguous「未判定」,不得冒充"查过了没有";
- 枚举到 0 个候选文件 ⇒ 判死不记绿;
- 身份未注入(__user_id 缺失)⇒ 语义腿 skipped_missing_identity,点名缺哪个输入。

鉴权(§5):身份只取承载层注入的 __user_id/__user_role(LLM 不可控),
客户端自报的 user_id/userId 等形状一律忽略;语义检索按归属隔离由 api 侧执行。

证据锚点(§1):每条结论必须带 path + 内容锚点(命中行原文或 needle 逐字/切片前缀),
行号只作辅助指针,禁止以行号或短 sha 作为唯一证据。
"""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from .rg_fallback_parity import ContentScanResult, EnumerationProvenance

TOOL_NAME = "investigate_codebase"

#: 调查意图为空的显式失败形(不是"未判定",是入参非法)
CONFIDENCE_OBSERVED = "observed"
CONFIDENCE_INFERRED = "inferred"
CONFIDENCE_UNKNOWN = "unknown"

_DEFAULT_MAX_RESULTS = 20
_MAX_RESULTS_CAP = 100
#: 词法腿枚举的有界上限(与懒索引护栏同量级,防止一次调查走穿巨仓)
_ENUMERATE_CAP = 5000
_ANCHOR_CHARS = 120
_PREVIEW_CHARS = 160


@dataclass(frozen=True)
class InvestigatorDeps:
    """四条检索出口的注入面 —— 生产默认走 build_default_deps(),测试注入假出口。"""

    enumerate_files: Callable[
        [Path], tuple[list[str], EnumerationProvenance]
    ]
    content_search: Callable[..., ContentScanResult]
    semantic_search: Callable[..., Awaitable[list[dict[str, Any]]]]
    wiki_cache_read: Callable[[str], dict[str, Any] | None]


def build_default_deps() -> InvestigatorDeps:
    """生产默认出口:全部 import 既有检索件,本模块零新栈。

    延迟导入 codebase_indexer / repo_wiki_engine:避免把 llm_gateway 等重依赖
    压进只走词法腿的调用路径(也是测试不触网/不触库的结构性保证)。
    """

    def _enumerate(root: Path) -> tuple[list[str], EnumerationProvenance]:
        from .codebase_indexer import _IGNORED_DIRS, _EXT_TO_LANG
        from .rg_fallback_parity import enumerate_code_files

        suffixes = tuple(sorted(_EXT_TO_LANG.keys()))
        paths, prov = enumerate_code_files(
            root,
            ignored_dirs=_IGNORED_DIRS,
            suffixes=suffixes,
            max_files=_ENUMERATE_CAP,
            prefer_rg=False,
        )
        return paths, prov

    async def _semantic(
        query: str,
        *,
        user_id: str | None,
        top_k: int,
        repo_id: str | None = None,
    ) -> list[dict[str, Any]]:
        from .codebase_indexer import codebase_indexer

        return await codebase_indexer.search(
            query, repo_id=repo_id, top_k=top_k, internal_user_id=user_id
        )

    def _wiki_cache(workspace_path: str) -> dict[str, Any] | None:
        from . import repo_wiki_engine

        # namespace 契约与 ensure_wiki 主链路一致(通常 = workspace_path 本身)
        return repo_wiki_engine._load_disk(workspace_path, workspace_path)

    from .rg_fallback_parity import search_file_contents

    return InvestigatorDeps(
        enumerate_files=_enumerate,
        content_search=search_file_contents,
        semantic_search=_semantic,
        wiki_cache_read=_wiki_cache,
    )


def _anchor_text(root: Path, rel_posix: str, line_no: int) -> str:
    """取命中行原文作内容锚点(行号只是取址辅助,锚点本体是逐字文本)。"""
    try:
        with open(
            os.path.join(str(root), rel_posix.replace("/", os.sep)),
            encoding="utf-8",
            errors="ignore",
        ) as fh:
            for i, ln in enumerate(fh, start=1):
                if i == line_no:
                    text = ln.strip()
                    if text:
                        return text[:_ANCHOR_CHARS]
                    break
    except OSError:
        pass
    return ""


def _top_module(rel_posix: str) -> str:
    seg = rel_posix.split("/", 1)[0]
    return seg if "/" in rel_posix else rel_posix


def _finding(
    statement: str,
    confidence: str,
    leg: str,
    anchors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "statement": statement,
        "confidence": confidence,
        "leg": leg,
        "anchors": anchors or [],
    }


def _invalid_intent_result(intent_raw: str, path: str) -> dict[str, Any]:
    return {
        "tool": TOOL_NAME,
        "ok": False,
        "status": "invalid_intent",
        "intent": intent_raw,
        "query": "",
        "path": path,
        "findings": [
            _finding(
                "调查意图为空,未发起任何检索",
                CONFIDENCE_UNKNOWN,
                "input",
                [],
            )
        ],
        "legs": {},
        "missing_inputs": ["intent(非空调查意图字符串)"],
        "read_only": True,
    }


async def investigate_codebase(
    arguments: dict[str, Any],
    *,
    deps: InvestigatorDeps | None = None,
) -> dict[str, Any]:
    """只读代码库调查主入口(主席接线即注册为本工具的 handler)。

    Args:
        arguments: 工具入参。
            intent: str 必填,调查意图(逐字记录进结果)。
            query: str 可选,词法检索 needle;缺省用 intent(长句多半零命中,
                但那是可验证的零,不冒充未查过)。
            path: str 可选,调查根目录,默认 "."。
            max_results: int 可选,每腿命中上限,默认 20,封顶 100。
            use_semantic: bool 可选,默认 True;语义腿仍受身份注入约束。
            include_wiki: bool 可选,默认 True;只读已生成的 wiki 缓存。
            __user_id / __user_role: 仅认承载层注入,客户端自报一律不读。
        deps: 检索出口注入面,默认 build_default_deps()。

    Returns:
        dict: {"tool","ok","status"(ok|empty_confirmed|unjudged|invalid_intent),
        "intent","query","path","findings"[{statement,confidence∈
        observed|inferred|unknown,leg,anchors[{path,symbol,content_anchor,line}]}],
        "legs"{lexical,semantic,wiki},"missing_inputs","read_only":True,"message"}
    """
    intent = str(arguments.get("intent") or "").strip()
    path_raw = str(arguments.get("path") or ".")
    if not intent:
        return _invalid_intent_result(intent, path_raw)

    query = str(arguments.get("query") or intent).strip()
    try:
        max_results = int(arguments.get("max_results") or _DEFAULT_MAX_RESULTS)
    except (TypeError, ValueError):
        max_results = _DEFAULT_MAX_RESULTS
    max_results = max(1, min(max_results, _MAX_RESULTS_CAP))
    use_semantic = bool(arguments.get("use_semantic", True))
    include_wiki = bool(arguments.get("include_wiki", True))
    # §5:身份只认宿主注入键;arguments["user_id"] 这类模型可填形状结构上不读
    user_id = str(arguments.get("__user_id") or "").strip() or None

    resolved_deps = deps if deps is not None else build_default_deps()
    root = Path(path_raw).resolve()

    legs: dict[str, dict[str, Any]] = {}
    findings: list[dict[str, Any]] = []
    missing_inputs: list[str] = []

    if not root.exists() or not root.is_dir():
        return {
            "tool": TOOL_NAME,
            "ok": False,
            "status": "unjudged",
            "intent": intent,
            "query": query,
            "path": path_raw,
            "findings": [
                _finding(
                    f"调查根不可达:{path_raw},本轮所有腿均未判定",
                    CONFIDENCE_UNKNOWN,
                    "input",
                    [],
                )
            ],
            "legs": {
                "lexical": {"status": "undetermined", "reason": "根目录不存在或不是目录"},
                "semantic": {"status": "not_attempted"},
                "wiki": {"status": "not_attempted"},
            },
            "missing_inputs": [f"path(现值 {path_raw} 不是可读取目录)"],
            "read_only": True,
        }

    # ---- 腿 1:词法(既有 rg_fallback_parity 出口,默认不起 rg 子进程) ----
    files: list[str] = []
    enum_prov: EnumerationProvenance | None = None
    enumerate_failed = False
    try:
        files, enum_prov = resolved_deps.enumerate_files(root)
    except Exception as exc:  # 出口坏了要点名,不得洗成"没有"
        enumerate_failed = True
        legs["lexical"] = {"status": "failed", "reason": f"枚举出口异常: {exc}"[:200]}
        missing_inputs.append("词法枚举通道(rg_fallback_parity.enumerate_code_files 可用)")
    else:
        if enum_prov is None:
            legs["lexical"] = {"status": "undetermined", "reason": "枚举未返回 provenance"}
            missing_inputs.append("枚举 provenance(通道自证信息缺失)")
        elif not files:
            # §0.3:枚举到 0 个候选判死不记绿
            legs["lexical"] = {
                "status": "undetermined",
                "enumerated_files": 0,
                "engine": enum_prov.engine,
                "reason": "枚举到 0 个代码文件候选(目标目录为空或被全量忽略)",
            }
            missing_inputs.append("词法候选文件集(枚举结果为 0,无法区分空仓与过滤过严)")
        else:
            legs["lexical"] = {
                "status": "enumerated",
                "enumerated_files": len(files),
                "engine": enum_prov.engine,
                "degraded_reason": enum_prov.degraded_reason,
            }

    if not enumerate_failed and files:
        try:
            scan: ContentScanResult = resolved_deps.content_search(
                root,
                files=files,
                needle=query,
                max_results=max_results,
                prefer_rg=False,
            )
        except Exception as exc:
            legs["lexical"]["status"] = "failed"
            legs["lexical"]["reason"] = f"内容检索出口异常: {exc}"[:200]
            missing_inputs.append("词法内容检索通道(search_file_contents 未返回结论)")
            scan = ContentScanResult()
        legs["lexical"]["scanned_files"] = scan.scanned_files
        legs["lexical"]["truncated"] = scan.truncated
        legs["lexical"]["unparsed_lines"] = scan.unparsed_lines
        if scan.hits:
            legs["lexical"]["status"] = "hits"
            legs["lexical"]["hit_files"] = len(scan.hits)
            for hit in scan.hits:
                first_line = hit.line_numbers[0] if hit.line_numbers else 0
                text = _anchor_text(root, hit.path, first_line)
                anchor = {
                    "path": hit.path,
                    "symbol": None,
                    # 读不到行时退回 needle 逐字:仍可在该文件内复验,不裸用行号当证据
                    "content_anchor": text or query,
                    "line": first_line or None,
                    "hit_lines": hit.line_numbers[:5],
                }
                findings.append(
                    _finding(
                        f"词法命中: `{query}` 出现在 {hit.path}"
                        f"(共 {len(hit.line_numbers)} 处)",
                        CONFIDENCE_OBSERVED,
                        "lexical",
                        [anchor],
                    )
                )
        elif legs["lexical"]["status"] != "failed":
            if scan.unparsed_lines:
                # 命中为 0 但有行解析不出来 ⇒ 通道不可信,不得判"确实没有"
                legs["lexical"]["status"] = "undetermined"
                legs["lexical"]["reason"] = (
                    f"{scan.unparsed_lines} 行解析不出行号且零命中,通道不可信"
                )
                missing_inputs.append("可信的词法命中通道(unparsed_lines>0 且 hits=0)")
            else:
                # python 通道逐字读过整个枚举集 ⇒ 集内零命中是"验证过的空",可如实报
                legs["lexical"]["status"] = "empty_verified"

    # ---- 腿 2:语义(codebase_indexer.search,只读;身份缺失即跳过,不发匿名查询) ----
    if not use_semantic:
        legs["semantic"] = {"status": "disabled_by_request"}
    elif not user_id:
        legs["semantic"] = {
            "status": "skipped_missing_identity",
            "reason": "__user_id 未由承载层注入;api 侧检索按归属隔离,匿名查询必 401,不发起",
        }
        missing_inputs.append("__user_id(承载层注入的调用者身份)")
    else:
        try:
            chunks = await resolved_deps.semantic_search(
                query, user_id=user_id, top_k=max_results
            )
        except Exception as exc:
            legs["semantic"] = {
                "status": "failed",
                "reason": f"语义检索超时或异常: {exc}"[:200],
            }
            missing_inputs.append("语义检索通道可用(codebase_indexer.search 未返回结论)")
        else:
            if chunks:
                legs["semantic"] = {"status": "hits", "count": len(chunks)}
                for ch in chunks[:max_results]:
                    fp = str(ch.get("filePath") or ch.get("file_path") or "")
                    if not fp:
                        continue
                    sym = str(ch.get("symbolName") or ch.get("symbol_name") or "") or None
                    content = str(ch.get("content", ""))
                    anchor = {
                        "path": fp.replace("\\", "/"),
                        "symbol": sym,
                        "content_anchor": content[:_ANCHOR_CHARS].strip(),
                        "line": None,
                        "preview": content[:_PREVIEW_CHARS],
                    }
                    findings.append(
                        _finding(
                            f"语义命中: {fp}"
                            + (f"(符号 {sym})" if sym else "")
                            + " 的切片与意图相关(hybrid 检索)",
                            CONFIDENCE_OBSERVED,
                            "semantic",
                            [anchor],
                        )
                    )
            else:
                # 该出口失败与零命中同为空列表(实测契约),不可区分 ⇒ 未判定,不记绿
                legs["semantic"] = {
                    "status": "empty_ambiguous",
                    "reason": (
                        "codebase_indexer.search 对『未索引/检索失败/确实无命中』"
                        "三种情形一律返回空列表,本工具无从区分 ⇒ 判未判定,"
                        "不得据此断言代码库中不存在相关内容"
                    ),
                }
                missing_inputs.append(
                    "语义检索的可判别回包(空列表无法区分未索引/失败/无命中)"
                )
                findings.append(
                    _finding(
                        "语义通道未给出可判读结论(空列表为三态混合),该维度未知",
                        CONFIDENCE_UNKNOWN,
                        "semantic",
                        [],
                    )
                )

    # ---- 腿 3:Repo Wiki(只读缓存;生成会写盘+出网,只读契约下绝不触发) ----
    if not include_wiki:
        legs["wiki"] = {"status": "disabled_by_request"}
    else:
        try:
            cache = resolved_deps.wiki_cache_read(str(root))
        except Exception as exc:
            legs["wiki"] = {"status": "failed", "reason": f"wiki 缓存读取异常: {exc}"[:200]}
            missing_inputs.append("Repo Wiki 缓存读取通道")
        else:
            entries = cache.get("files") if isinstance(cache, dict) else None
            if isinstance(entries, dict) and entries:
                legs["wiki"] = {"status": "hits", "entries": len(entries)}
                for rel in sorted(entries.keys())[:5]:
                    info = entries[rel] or {}
                    summary = str(info.get("summary", ""))
                    if not summary:
                        continue
                    findings.append(
                        _finding(
                            f"Repo Wiki 缓存含 {rel} 的既有摘要(由先前 wiki 链路生成)",
                            CONFIDENCE_OBSERVED,
                            "wiki",
                            [
                                {
                                    "path": rel,
                                    "symbol": None,
                                    "content_anchor": summary[:_ANCHOR_CHARS],
                                    "line": None,
                                }
                            ],
                        )
                    )
            else:
                legs["wiki"] = {
                    "status": "no_cache",
                    "reason": "Repo Wiki 未生成;本工具只读,不触发生成(生成会写盘+调 LLM)",
                }
                findings.append(
                    _finding(
                        f"{root.name or path_raw} 的项目百科维度未知(无缓存,未触发生成)",
                        CONFIDENCE_UNKNOWN,
                        "wiki",
                        [],
                    )
                )

    # ---- 聚合推断:跨模块共现(只基于命中分布,不新写评分/AST 判据) ----
    obs_paths = [
        str(a.get("path", ""))
        for f in findings
        if f["confidence"] == CONFIDENCE_OBSERVED
        for a in f["anchors"]
    ]
    modules = sorted({_top_module(p) for p in obs_paths if p})
    if len(modules) >= 2:
        findings.append(
            _finding(
                f"`{query}` 横跨 {len(modules)} 个顶层模块({', '.join(modules[:8])})"
                "共现 —— 跨模块耦合线索由命中分布推断得出,未经调用图证实",
                CONFIDENCE_INFERRED,
                "aggregate",
                [
                    {
                        "path": p,
                        "symbol": None,
                        "content_anchor": query,
                        "line": None,
                    }
                    for p in sorted(obs_paths)[:8]
                ],
            )
        )

    observed_count = sum(
        1 for f in findings if f["confidence"] == CONFIDENCE_OBSERVED
    )
    untrustworthy = [
        name
        for name, leg in legs.items()
        if leg.get("status")
        in ("undetermined", "empty_ambiguous", "failed", "skipped_missing_identity")
    ]
    if observed_count > 0:
        status = "ok"
    elif untrustworthy:
        status = "unjudged"
    else:
        status = "empty_confirmed"

    ok = status in ("ok", "empty_confirmed")
    message = {
        "ok": f"调查完成:{observed_count} 条观察级结论",
        "empty_confirmed": "各启用腿均给出可信的空结论(词法已验证集内零命中)",
        "unjudged": "未判定:以下输入/通道缺口未闭合 —— " + "; ".join(untrustworthy),
        "invalid_intent": "调查意图为空",
    }[status]

    return {
        "tool": TOOL_NAME,
        "ok": ok,
        "status": status,
        "intent": intent,
        "query": query,
        "path": path_raw,
        "findings": findings,
        "legs": legs,
        "missing_inputs": missing_inputs,
        "read_only": True,
        "message": message,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
