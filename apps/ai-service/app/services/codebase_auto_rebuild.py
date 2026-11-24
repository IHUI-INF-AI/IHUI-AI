# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自动重建的调度层(P0-8 第十三批,2026-11-23)。

## 这一步补的是什么

第十批给了"该重建哪些仓库"的清单,第十二批给了"仓库在哪"的路径登记面。
两条合起来仍然差最后一格:**谁来按下开始**。没有这一层,清单与路径只是给人看的账,
不会自己变成索引 —— 而用户对"自动重建"的原话是"都要解决完成"。

## 三条设计口径(都有理由,不是随手定的)

1. **缺省关闭**。整仓索引真花 embedding 钱,一次跑几个仓就是几百上千次调用。
   自动化能自己花钱的系统,默认必须是关的,开不开由部署侧一句话决定
   (`CODEBASE_AUTO_REBUILD=1`)。这也符合 §0.2「失效方向必须是多要一次定向说明」。
2. **未登记路径不猜**。候选里有 `localPath=null` 的,跳过并**点名**
   —— 不能静默跳过("跳过"与"没有"在台账上必须可区分,§0.3)。
3. **单仓失败不阻断后续**。一个仓库读不到(目录被删、权限不足)不该让其余仓也停;
   结果逐仓记录 `status`,失败的带 `error`,整体 run 不会抛。
"""

from __future__ import annotations

import os
from typing import Any

#: 总开关。缺省关闭:未设 / 空串 / 非 truthy 一律不跑。
AUTO_REBUILD_ENV = "CODEBASE_AUTO_REBUILD"
#: 单轮最多跑几个仓库。超过一律夹到这个上限 —— 自动化的花费必须有天花板。
AUTO_REBUILD_MAX_ENV = "CODEBASE_AUTO_REBUILD_MAX"
AUTO_REBUILD_MAX_REPOS_CAP = 10
AUTO_REBUILD_DEFAULT_MAX_REPOS = 3

_TRUTHY = frozenset({"1", "true", "yes", "on", "y", "t"})
_FALSY = frozenset({"0", "false", "no", "off", "n", "f", ""})


def auto_rebuild_enabled(raw: str | None) -> bool:
    """三态收成两态:**只认白名单真值**,其余(含未设、乱写)一律关。

    刻意不写成 `raw.lower() not in _FALSY` —— 那样 "enable"、"2" 之类会被读成开,
    而开关写错一个字符就把花费打开,是这条线里最不该有的失效方向。
    """
    if raw is None:
        return False
    return raw.strip().lower() in _TRUTHY


def auto_rebuild_limit(raw: str | None) -> int:
    """单轮上限。解析失败/非正数 ⇒ 缺省值(不是 0、不是无限)。"""
    if raw is None or not raw.strip():
        return AUTO_REBUILD_DEFAULT_MAX_REPOS
    try:
        value = int(raw.strip())
    except ValueError:
        return AUTO_REBUILD_DEFAULT_MAX_REPOS
    if value <= 0:
        return AUTO_REBUILD_DEFAULT_MAX_REPOS
    return min(value, AUTO_REBUILD_MAX_REPOS_CAP)


def plan_auto_rebuild(candidates: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    """从候选里挑出**这一轮真的要跑**的仓库。

    入参 `candidates` 是 API `/rebuild-candidates` 原样返回的项
    (`{repoId, decision, lastIndexedAtMs, localPath}`),顺序已是服务端的
    决策优先级(配置变了 > 从没索引过 > 过期),这里**保持顺序**不再重排 ——
    两处各排一次是双源,迟早漂移。

    返回三格,缺一格都会让台账读不懂:
    - `run`: 本轮要跑的 `{repoId, repoPath}` 列表;
    - `skipped_no_path`: 有候选但没登记路径(点名,修复入口是 `PUT /repos/:repoId/path`);
    - `skipped_over_limit`: 有路径但超出本轮上限(它们是下一轮的活,不是被丢弃)。
    """
    limit = max(1, min(int(limit), AUTO_REBUILD_MAX_REPOS_CAP))
    run: list[dict[str, str]] = []
    skipped_no_path: list[str] = []
    skipped_over_limit: list[str] = []
    for item in candidates:
        repo_id = str(item.get("repoId") or "").strip()
        if not repo_id:
            continue
        path = item.get("localPath")
        if not isinstance(path, str) or not path.strip():
            skipped_no_path.append(repo_id)
            continue
        if len(run) >= limit:
            skipped_over_limit.append(repo_id)
            continue
        run.append({"repoId": repo_id, "repoPath": path.strip()})
    return {
        "run": run,
        "skipped_no_path": skipped_no_path,
        "skipped_over_limit": skipped_over_limit,
    }


async def run_auto_rebuild(
    indexer: Any,
    candidates: list[dict[str, Any]],
    *,
    limit: int,
    api_token: str | None = None,
    internal_user_id: str | None = None,
    incremental: bool = True,
) -> dict[str, Any]:
    """按计划真跑。**单仓失败只记录不抛**,整体结果逐仓可读。

    `indexer` 走依赖注入(测试给定假实现即可;生产传 `CodebaseIndexer` 实例),
    这样这层不绑死 httpx / 不绑死 embedding 客户端。
    """
    plan = plan_auto_rebuild(candidates, limit)
    results: list[dict[str, Any]] = []
    for item in plan["run"]:
        repo_id = item["repoId"]
        try:
            outcome = await indexer.index_repository(
                item["repoPath"],
                repo_id=repo_id,
                api_token=api_token,
                incremental=incremental,
                internal_user_id=internal_user_id,
            )
            results.append(
                {
                    "repoId": repo_id,
                    "status": "ok",
                    "filesIndexed": getattr(outcome, "files_indexed", None),
                    "chunksIndexed": getattr(outcome, "chunks_indexed", None),
                    "errors": list(getattr(outcome, "errors", []) or []),
                }
            )
        except Exception as exc:  # noqa: BLE001 — 单仓失败必须降级成一行,不能炸整轮
            results.append(
                {
                    "repoId": repo_id,
                    "status": "failed",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
    failed = [r for r in results if r.get("status") == "failed"]
    return {
        "ran": len(results),
        "ok": len(results) - len(failed),
        "failed": len(failed),
        "results": results,
        "skipped_no_path": plan["skipped_no_path"],
        "skipped_over_limit": plan["skipped_over_limit"],
    }


async def auto_rebuild_if_enabled(
    indexer: Any,
    candidates: list[dict[str, Any]],
    *,
    env: Any = None,
    api_token: str | None = None,
    internal_user_id: str | None = None,
) -> dict[str, Any]:
    """装配入口:开关关着就**明确返回 skipped 与原因**,不留空白让调用方猜。"""
    env_map = os.environ if env is None else env
    if not auto_rebuild_enabled(env_map.get(AUTO_REBUILD_ENV)):
        return {
            "skipped": True,
            "reason": f"{AUTO_REBUILD_ENV} 未开启(缺省关闭:整仓索引会真实消耗 embedding 预算)",
            "candidates": len(candidates),
        }
    limit = auto_rebuild_limit(env_map.get(AUTO_REBUILD_MAX_ENV))
    out = await run_auto_rebuild(
        indexer,
        candidates,
        limit=limit,
        api_token=api_token,
        internal_user_id=internal_user_id,
    )
    out["skipped"] = False
    out["limit"] = limit
    return out
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
