# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""run_workflow — 多节点 agent 工作流 + 入参级续跑缓存(2026-11-02 立)。

对标外部程序 Workflow/RunWorkflow 工具的核心语义(resume_from_run_id):
入参未变的节点瞬时回缓存、不重跑;只有入参变化或上游失败的节点才真执行。

判据单源(AGENTS §0.6,本层零复算):
- 节点入参身份键 = `task_executors.compute_idempotency_key`(全仓唯一 hash 出口,
  以 `workflow_node/<agent>` 作 task_type 隔离命名空间,不自己再算一份);
- 续跑存储 = `task_executors.CheckpointStore`/`Checkpoint`(单元级 is_done/mark_done);
- 默认 agent 分派 = `task_executors.execute_task`(与 run_in_background/DAG 共用
  的全仓唯一分派出口,"工具面能跑的类型"与"DAG 面能跑的类型"结构上不分叉)。

纪律:
- run 归属主体只由承载层显式入参 `principal` 传入并持久化在 payload["__run__"];
  续跑逐字节比对,不一致一律拒绝(WORKFLOW_FORBIDDEN)且零节点执行 —— 不从被操作
  记录反推主体、不信客户端自报(AGENTS §5 认证不等于授权)。
- 脚本非法 / run 不存在 / 主体缺失 ⇒ 显式未判定错误码,零执行、零落盘;
  绝不猜"当作缓存命中/未命中"(失效方向 = 多要一次说明,不多放一次跳门)。
- 不做并发调度、不做可视化、不加数据库迁移(最小可回退档)。
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable, Mapping
from typing import Any, Final

from .task_executors import (
    CheckpointStore,
    compute_idempotency_key,
    execute_task,
    get_checkpoint_store,
)

logger = logging.getLogger(__name__)

#: 节点执行体注入缝:(agent, arguments, 已完成节点结果, 主体) -> 结果对象。
NodeCall = Callable[[str, dict[str, Any], dict[str, Any], str], Awaitable[dict[str, Any]]]

RUN_KEY_PREFIX: Final[str] = "workflow_run:"
RUN_MARKER: Final[str] = "__run__"

ERR_SCRIPT_INVALID: Final[str] = "WORKFLOW_SCRIPT_INVALID"
ERR_RUN_NOT_FOUND: Final[str] = "WORKFLOW_RUN_NOT_FOUND"
ERR_PRINCIPAL_REQUIRED: Final[str] = "WORKFLOW_PRINCIPAL_REQUIRED"
ERR_FORBIDDEN: Final[str] = "WORKFLOW_FORBIDDEN"


def _undetermined(error_code: str, detail: str) -> dict[str, Any]:
    """未判定回执的唯一形态:零执行、run_id 为空、错误码点名 —— 不猜任何一档。"""
    return {
        "ok": False,
        "errorCode": error_code,
        "error": detail,
        "run_id": None,
        "status": "undetermined",
        "executed": [],
        "cached": [],
        "skipped": {},
        "failed": {},
        "results": {},
    }


def _validate_script(raw: Any) -> tuple[list[dict[str, Any]], str | None]:
    """校验节点声明并按拓扑序返回(Kahn)。任一不过 ⇒ 返回原因,调用方落未判定。"""
    if not isinstance(raw, list) or not raw:
        return [], "nodes 必须是非空数组"
    nodes: dict[str, dict[str, Any]] = {}
    for item in raw:
        if not isinstance(item, Mapping):
            return [], "每个节点必须是对象"
        nid = str(item.get("id") or "").strip()
        agent = str(item.get("agent") or "").strip()
        if not nid or not agent:
            return [], "每个节点必须带非空 id 与 agent"
        if nid in nodes:
            return [], f"节点 id 重复: {nid}"
        deps_raw = item.get("depends_on") or []
        if not isinstance(deps_raw, list):
            return [], f"节点 {nid} 的 depends_on 必须是数组"
        args_raw = item.get("arguments") or {}
        if not isinstance(args_raw, Mapping):
            return [], f"节点 {nid} 的 arguments 必须是对象"
        nodes[nid] = {
            "id": nid,
            "agent": agent,
            "arguments": {str(k): v for k, v in args_raw.items()},
            "depends_on": [str(dep) for dep in deps_raw],
        }
    for node in nodes.values():
        for dep in node["depends_on"]:
            if dep not in nodes:
                return [], f"节点 {node['id']} 依赖不存在的节点 {dep}"
            if dep == node["id"]:
                return [], f"节点 {node['id']} 依赖自身"
    ordered: list[dict[str, Any]] = []
    remaining = dict(nodes)
    placed: set[str] = set()
    while remaining:
        ready = sorted(nid for nid, n in remaining.items() if all(d in placed for d in n["depends_on"]))
        if not ready:
            return [], "工作流脚本存在环,无法拓扑排序"
        for nid in ready:
            ordered.append(remaining.pop(nid))
            placed.add(nid)
    return ordered, None


def _node_key(agent: str, arguments: dict[str, Any]) -> str:
    """节点入参身份键 —— 复用全仓唯一幂等键出口,不第二份 hash 判据(§0.6)。"""
    return compute_idempotency_key(f"workflow_node/{agent}", arguments)


async def _dispatch_agent(
    agent: str, arguments: dict[str, Any], _upstream: dict[str, Any], principal: str
) -> dict[str, Any]:
    """默认节点执行体:走 `execute_task` 唯一分派出口(agent 即已注册 task_type)。"""
    return await execute_task(agent, arguments, user_id=principal)


async def run_workflow(
    nodes: Any,
    *,
    principal: str,
    resume_from_run_id: str | None = None,
    node_call: NodeCall | None = None,
    store: CheckpointStore | None = None,
) -> dict[str, Any]:
    """执行一段工作流脚本;`resume_from_run_id` 下入参未变的节点瞬时回缓存不重跑。"""
    uid = str(principal or "").strip()
    if not uid:
        return _undetermined(ERR_PRINCIPAL_REQUIRED, "run 归属主体必须由承载层显式传入,不得为空")
    ordered, err = _validate_script(nodes)
    if err is not None:
        return _undetermined(ERR_SCRIPT_INVALID, err)

    st = store or get_checkpoint_store()
    if resume_from_run_id is not None and str(resume_from_run_id).strip():
        run_id = str(resume_from_run_id).strip()
        cp = st.load(RUN_KEY_PREFIX + run_id)
        meta = cp.payload.get(RUN_MARKER)
        if not isinstance(meta, Mapping) or meta.get("run_id") != run_id:
            return _undetermined(ERR_RUN_NOT_FOUND, f"run {run_id} 不存在:不猜缓存,零节点执行")
        if str(meta.get("owner_user_id") or "") != uid:
            return _undetermined(ERR_FORBIDDEN, "run 归属其他主体,拒绝跨租户续跑(零节点执行)")
    else:
        run_id = uuid.uuid4().hex
        cp = st.load(RUN_KEY_PREFIX + run_id)
        # 归属登记先落盘:中途崩溃的 run 也能被同主体续跑(主体只认显式入参)。
        cp.payload[RUN_MARKER] = {"run_id": run_id, "owner_user_id": uid}
        st.save(cp)

    call = node_call or _dispatch_agent
    results: dict[str, Any] = {}
    executed: list[str] = []
    cached: list[str] = []
    skipped: dict[str, str] = {}
    failed: dict[str, str] = {}

    for node in ordered:
        nid = str(node["id"])
        key = _node_key(str(node["agent"]), node["arguments"])
        if any(dep not in results for dep in node["depends_on"]):
            skipped[nid] = "upstream_did_not_produce_result"
            continue
        artifact = cp.payload.get(nid) if cp.is_done(nid) else None
        if isinstance(artifact, Mapping) and artifact.get("node_key") == key:
            # 入参未变 ⇒ 瞬时回缓存,执行计数不增(本工具对齐语义的核心一格)。
            results[nid] = artifact.get("result")
            cached.append(nid)
            continue
        try:
            outcome = await call(node["agent"], node["arguments"], results, uid)
        except Exception as exc:  # noqa: BLE001 - 失败节点不 mark_done,下次续跑必重算
            failed[nid] = f"{type(exc).__name__}: {exc}"
            continue
        if not isinstance(outcome, dict):
            failed[nid] = f"节点返回值非对象: {type(outcome).__name__}"
            continue
        results[nid] = outcome
        executed.append(nid)
        cp.done.discard(nid)  # 入参变过 ⇒ 旧完成记录作废,重执行成功后重新标记
        cp.mark_done(nid, artifact={"node_key": key, "result": outcome})

    status = "partial" if (failed and results) else ("failed" if failed else "success")
    if failed:
        logger.warning("run_workflow %s 有 %d 个节点失败,可用 resume_from_run_id=%s 续跑", status, len(failed), run_id)
    return {
        "ok": not failed,
        "run_id": run_id,
        "status": status,
        "executed": executed,
        "cached": cached,
        "skipped": skipped,
        "failed": failed,
        "results": results,
        "resume_hint": f"resume_from_run_id={run_id} 可续跑(入参未变节点回缓存)",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
