# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""权限授权两阶段提交(G-816005)。

上游出处:zcode `runtime/permission-full-access.ts` + `runtime/permission-grant-recovery.ts`
+ `runtime/helpers/permission-grant-resume.ts` + `tool/executor/approval-gate.ts`。

我方审批结算是"future 完成即结束",没有"已提交但未发布"这一中间态 ⇒
崩溃窗口里授权会半个生效(持久授权已写、会话内队列重放没做),或重试时
扩权(重新抓了一遍队列)。本模块补上三件事:

- receipt 幂等:同一 receipt 重放**同一事件**,绝不重抓队列(重抓即扩权);
- 范围快照钉死:queueItemIds 在提交时一次性抓取并钉进事件,replay 只认
  receipt 里那份;
- 已提交但未发布中间态:commit 后先登记 unpublishedPermissionGrants 再发布,
  崩溃(登记后、发布前)后由 recover 补齐发布,publish 按 event_id 去重,
  只补一次;resume 时坏 receipt 只 warn 跳过,不阻断历史。

另含 approval-gate 的裁决口径:预览钩子失败 ⇒ 仍走 ask,绝不允许把钩子
错误当裁决(不降为 allow / deny / proceed)。

接线说明:权威结算点在 agent_loop_v2(由他人持有,禁区格),本模块是独立
服务形态(同步 API,纯标准库),待该格解阻后由调用方注入持久 store 与
发布出口。
"""

from __future__ import annotations

import json
import logging
import threading
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

_logger = logging.getLogger(__name__)

RECEIPT_KIND = "permission-full-access"

GATE_ASK = "ask"
GATE_PROCEED = "proceed"


class QueueMutationBusyError(RuntimeError):
    """队列正在变更,拒绝授权提交(上游 "Queue mutation is busy; retry approval")。"""


class PermissionReceiptScopeError(RuntimeError):
    """receipt 的会话/交互与请求不符(上游 "Permission receipt scope mismatch")。"""


def receipt_id_for(session_id: str, interaction_id: str) -> str:
    """授权 receipt 的持久键(上游 `${sessionId}:permission-full-access:${interactionId}`)。"""
    return f"{session_id}:{RECEIPT_KIND}:{interaction_id}"


def canonical_event_bytes(event: Mapping[str, Any]) -> str:
    """事件的规范字节形态(重放断言"事件字节相同"用)。"""
    return json.dumps(event, sort_keys=True, ensure_ascii=False, default=str)


@dataclass
class PermissionGrantReceipt:
    """已提交授权的持久凭据:事件本体钉在里面(含 queueItemIds 快照)。"""

    receipt_id: str
    session_id: str
    interaction_id: str
    event: Any = field(default_factory=dict)


class InMemoryGrantStore:
    """receipt 持久化的最小实现(测试/开发用;生产可换 SQLite 落盘形态)。

    登记幂等:同 receipt_id 重复 save 原样保留第一笔(第二阶段提交的
    "已提交"一半不可被重放覆盖)。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._receipts: dict[tuple[str, str], PermissionGrantReceipt] = {}
        self._order: list[tuple[str, str]] = []

    def find_receipt(self, session_id: str, receipt_id: str) -> PermissionGrantReceipt | None:
        with self._lock:
            return self._receipts.get((session_id, receipt_id))

    def save_receipt(self, receipt: PermissionGrantReceipt) -> None:
        key = (receipt.session_id, receipt.receipt_id)
        with self._lock:
            if key in self._receipts:
                return
            self._receipts[key] = receipt
            self._order.append(key)

    def list_receipts(self, session_id: str) -> list[PermissionGrantReceipt]:
        with self._lock:
            return [
                self._receipts[key] for key in self._order if key[0] == session_id
            ]


@dataclass(frozen=True)
class UnpublishedPermissionGrant:
    """已提交未发布的恢复锚:不存第二份权限/队列,只记补发布的动作。"""

    interaction_id: str
    recover: Callable[[], str]


class PermissionGrantCommitter:
    """单会话的授权两阶段提交器(per-session 一实例,对标 runtime 侧)。"""

    def __init__(
        self,
        *,
        session_id: str,
        store: InMemoryGrantStore,
        fetch_queue_item_ids: Callable[[], Sequence[str]],
        build_event: Callable[[str, list[str]], Mapping[str, Any]],
        publish_event: Callable[[Mapping[str, Any]], None],
        apply_state: Callable[[Mapping[str, Any]], None] | None = None,
    ) -> None:
        self._session_id = session_id
        self._store = store
        self._fetch_queue_item_ids = fetch_queue_item_ids
        self._build_event = build_event
        self._publish_event = publish_event
        self._apply_state = apply_state
        self._busy = False
        self.unpublished_permission_grant: UnpublishedPermissionGrant | None = None
        self._applied_grants: set[str] = set()
        self._published_event_ids: set[str] = set()
        self.last_permission_grant_id: str | None = None

    @property
    def session_id(self) -> str:
        return self._session_id

    # ------------------------------------------------------------------
    # 第一阶段:提交(登记 receipt,范围快照钉死)
    # 第二阶段:发布(applied 一次性 + publish 去重;中间态可恢复)
    # ------------------------------------------------------------------
    def grant_full_access(self, interaction_id: str) -> str:
        """完全访问授权:返回已发布事件的 event_id。

        - 队列变更窗口(busy)拒绝提交;
        - 已有别的未发布授权 ⇒ 先补齐那一笔(不许半生效跨笔堆叠);
        - receipt 已存在 ⇒ 重放同一事件,不重抓队列;
        - 事务提交(登记 receipt)之后:先登记 unpublished 再发布 ——
          发布失败/崩溃时恢复锚已就位,发布成功才清锚。
        """
        if self._busy:
            raise QueueMutationBusyError("Queue mutation is busy; retry approval")
        if (
            self.unpublished_permission_grant is not None
            and self.unpublished_permission_grant.interaction_id != interaction_id
        ):
            self.recover_pending_permission_grant()
        self._busy = True
        try:
            receipt_id = receipt_id_for(self._session_id, interaction_id)
            saved = self._store.find_receipt(self._session_id, receipt_id)
            if saved is not None:
                if saved.session_id != self._session_id or saved.interaction_id != interaction_id:
                    raise PermissionReceiptScopeError("Permission receipt scope mismatch")
                event = saved.event
            else:
                # queueItemIds 把授权范围钉成快照:提交时抓一次,此后 replay 只认 receipt
                queue_item_ids = [str(item) for item in self._fetch_queue_item_ids()]
                event = dict(
                    self._build_event(interaction_id, queue_item_ids)
                )
                self._store.save_receipt(
                    PermissionGrantReceipt(
                        receipt_id=receipt_id,
                        session_id=self._session_id,
                        interaction_id=interaction_id,
                        event=event,
                    )
                )
            # 事务已提交:之后即使传输取消也必须完成内存和投影发布,不能制造半个授权
            self.unpublished_permission_grant = UnpublishedPermissionGrant(
                interaction_id=interaction_id,
                recover=lambda: self.grant_full_access(interaction_id),
            )
            self._apply_once(event, interaction_id)
            self._publish_once(event)
            self.unpublished_permission_grant = None
            return str(event["event_id"])
        finally:
            self._busy = False

    def recover_pending_permission_grant(self) -> str | None:
        """崩溃后重放发布:对已提交未发布的授权补齐内存与投影发布。"""
        grant = self.unpublished_permission_grant
        if grant is None:
            return None
        return grant.recover()

    def replay_committed_receipt(self, receipt: PermissionGrantReceipt) -> str:
        """重启侧恢复:对持久库里已提交的 receipt 补齐发布(publish 幂等)。"""
        if receipt.session_id != self._session_id:
            raise PermissionReceiptScopeError("Permission receipt scope mismatch")
        self.unpublished_permission_grant = UnpublishedPermissionGrant(
            interaction_id=receipt.interaction_id,
            recover=lambda: self.grant_full_access(receipt.interaction_id),
        )
        self._apply_once(receipt.event, receipt.interaction_id)
        self._publish_once(receipt.event)
        self.unpublished_permission_grant = None
        return str(receipt.event["event_id"])

    def restore_permission_grant_marker(self) -> str | None:
        """resume 时 receipt 只作辅助标记;格式损坏只 warn 跳过,不阻断历史恢复。"""
        receipts = self._store.list_receipts(self._session_id)
        if not receipts:
            return None
        last = receipts[-1]
        event = last.event
        if (
            not isinstance(event, Mapping)
            or not str(event.get("event_id") or "").strip()
            or last.session_id != self._session_id
            or not str(last.interaction_id or "").strip()
        ):
            _logger.warning(
                "Ignoring invalid permission grant marker during session resume "
                "(event=permission_grant_invalid, receipt_id=%s)",
                last.receipt_id,
            )
            return None
        self.last_permission_grant_id = last.interaction_id
        return last.interaction_id

    # ------------------------------------------------------------------
    # 内部:appliedGrants 一次性;publish 按 event_id 去重(只补一次)
    # ------------------------------------------------------------------
    def _apply_once(self, event: Mapping[str, Any], interaction_id: str) -> None:
        if interaction_id in self._applied_grants:
            return
        self._applied_grants.add(interaction_id)
        self.last_permission_grant_id = interaction_id
        if self._apply_state is not None:
            self._apply_state(event)

    def _publish_once(self, event: Mapping[str, Any]) -> None:
        event_id = str(event["event_id"])
        if event_id in self._published_event_ids:
            return
        # 发布失败(含崩溃注入)不记 published ⇒ 未发布态成立,恢复路径会重试
        self._publish_event(event)
        self._published_event_ids.add(event_id)


def recover_committed_permission_grants(
    store: InMemoryGrantStore, committer: PermissionGrantCommitter
) -> list[str]:
    """崩溃后重启:把持久库里已提交的授权逐笔补齐发布,且只补一次。"""
    return [committer.replay_committed_receipt(r) for r in store.list_receipts(committer.session_id)]


def resolve_tool_approval(
    prepare_approval: Callable[[], Any] | None,
) -> dict[str, Any]:
    """在权限服务已判定 ask 之后,调用工具自报的 prepareApproval 折叠本次 ask。

    方向是单向收窄:钩子只能把 ask 放行成 proceed 或给它补上预览,永远不能
    把 allow 变成 ask;钩子契约外的裁决值(allow/deny 等)一律不认,归 ask。

    Bug 预防(上游 approval-gate.ts):负责生成预览的钩子绝不能决定"用户是否
    被询问"。钩子抛错向执行侧 fail-open 等于静默运行未获批准的工具,所以
    这里 ask 照旧成立,只让预览降级 —— 钩子失败 ⇒ 仍走 ask,不得降为
    allow 或 deny。
    """
    if prepare_approval is None:
        return {"gate": GATE_ASK}
    try:
        gate = prepare_approval()
    except Exception as error:
        _logger.warning(
            "Tool approval preview failed; asking without a preview "
            "(event=tool.permission.approval_preview_failed, error=%s)",
            error,
        )
        return {"gate": GATE_ASK}
    verdict = gate.get("gate") if isinstance(gate, Mapping) else gate
    if verdict == GATE_PROCEED:
        return {"gate": GATE_PROCEED}
    if isinstance(gate, Mapping) and verdict == GATE_ASK and gate.get("display") is not None:
        return {"gate": GATE_ASK, "display": gate["display"]}
    return {"gate": GATE_ASK}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
