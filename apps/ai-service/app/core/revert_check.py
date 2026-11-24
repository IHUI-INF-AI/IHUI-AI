# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""快照回退的独立一致性闸(round 8 能力复现 / 席位 A,2026-11-14 立)。

立因
----
对照 Trae ``RevertCheck`` 的行为:回退是**覆盖在途改动**的破坏性操作,执行前要独立确认
「目标检查点」与「当前工作区」是否一致,不一致就得挡下来。本仓现读只有
``apps/web/src/components/ai/checkpoint-impact.ts`` 的 ``pickRevertCheckpoint`` 负责
「选哪个回退点」(前者),**没有**独立的「一致性校验」闸(后者)。把两件事揉在一起,
或把「取不到输入」读成「一致」,都等于静默放行一次会冲掉用户未保存改动的回退。

判据(本模块只做后者,不碰前者)
------------------------------
三档 verdict:
- ``consistent``:两面逐文件一致 ⇒ 放行(``allow=True``, ``judged=True``);
- ``diverged``  :存在差异 ⇒ 显式阻断(``allow=False``)并产出结构化差异清单
  ``changed`` / ``added`` / ``removed``;
- ``unjudged``  :输入取不到或形状不认 ⇒ **阻断**(``allow=False``, ``judged=False``),
  ``reason`` 点名具体原因(§0.3「没判绝不写成判过」:不记绿、也不冒红)。

失效方向:任何不确定一律阻断,绝不静默覆盖在途改动(§0.10:失败是「多要一次定向说明」,
不是「多放一次跳门」)。``judged`` 是显式的「是否真做过比较」位:**空 diff + judged=False
等于未判定,不是零差异**;零差异只认 ``judged=True 且 verdict=consistent``。

刻意不做什么
------------
1. **不碰选点**:哪个 checkpoint 是回退目标由 ``pickRevertCheckpoint`` 决定。本模块不挑、
   不改、不复制它的判据(§0.6 单一真相源),只接收「已经选好的目标快照」;快照里额外的
   ``checkpoint_id`` / ``created_at`` 等元数据一概忽略,不参与判定。
2. **不抛异常、不返回异常文本**:一律返回结构化 verdict dict;认不出的形状也是数据,不是异常。
3. **不做 IO**:快照/工作区由调用方读好后以纯数据传入;本函数不读盘、不联网、不碰时钟。
4. **不把空 dict 当成取不到,也不把取不到当成空 dict**:``files={}`` 是「零文件」这一已判定
   状态;「读不到」必须由调用方显式传 ``None`` / 缺字段,不得用 ``{}`` 冒充
   (呼应 G-814423「读不到 ≠ 空文件」)。
5. **策略关闭不等于放行**:``policy.enabled=False`` 时本闸不出判定 ⇒ ``unjudged`` 阻断,
   要求调用方显式定向说明,绝不当成一次跳门。

一轴超越(对照 Trae ``RevertCheck`` 只有选点)
--------------------------------------------
除「一致 / 不一致」结论外,额外输出:结构化差异清单(changed/added/removed)、判据来源
(``criterion``,指明是哪条规则、哪一版产出的 verdict)、可审计 verdict
(``verdict`` + ``allow`` + ``judged`` + ``reason`` 同帧留痕);并把「取不到输入 / 策略不可用」
也钉成阻断(``unjudged``)而非放行。

输入契约
--------
``target_snapshot`` / ``current_workspace``: ``Mapping``,必须含键 ``files``:
``Mapping[str, str]``(路径 → 文件内容)。``policy``: ``Mapping``,必须含键 ``enabled``: ``bool``。
"""

from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum

__all__ = [
    "REVERT_CHECK_CRITERION",
    "RevertVerdict",
    "evaluate_revert_check",
]


class RevertVerdict(StrEnum):
    """一致性闸三档 verdict 的唯一真相源(wire 值 = 成员值)。"""

    CONSISTENT = "consistent"
    DIVERGED = "diverged"
    UNJUDGED = "unjudged"


#: 判据来源标识:随 verdict 一起回传,使结论可审计(哪条规则、哪一版产出)。
REVERT_CHECK_CRITERION = "app.core.revert_check/v1:snapshot-workspace-consistency"


def _empty_diff() -> dict[str, list[str]]:
    """零差异清单(已判定的「无差异」,不是「未判定」)。"""
    return {"changed": [], "added": [], "removed": []}


def _read_files(obj: object, label: str) -> tuple[dict[str, str], str]:
    """取一个面的 ``files`` 映射;返回 ``(files, reason)``,``reason`` 非空即形状不认。

    纯校验,零 IO。空映射 ``{}`` 是合法的「零文件」(已判定),不是取不到 —— 呼应
    G-814423「读不到 ≠ 空文件」:调用方必须把「读不到」显式传成 ``None`` / 缺字段,
    不得用 ``{}`` 冒充。成功时 ``reason`` 为空串,失败时 ``files`` 为 ``{}``。
    """
    if obj is None:
        return {}, f"{label} 取不到(None)"
    if not isinstance(obj, Mapping):
        return {}, f"{label} 形状不认:不是映射(实际 {type(obj).__name__})"
    if "files" not in obj:
        return {}, f"{label} 缺字段 files"
    files = obj["files"]
    if not isinstance(files, Mapping):
        return {}, f"{label}.files 形状不认:不是映射(实际 {type(files).__name__})"
    result: dict[str, str] = {}
    for path, content in files.items():
        if not isinstance(path, str):
            return {}, f"{label}.files 形状不认:存在非字符串路径"
        if not isinstance(content, str):
            return {}, (
                f"{label}.files[{path!r}] 形状不认:内容不是字符串"
                f"(实际 {type(content).__name__})"
            )
        result[path] = content
    return result, ""


def _read_policy(policy: object) -> str:
    """校验 policy;返回空串表示「闸可用」,否则返回点名原因(一律按未判定处理)。"""
    if policy is None:
        return "policy 取不到(None)"
    if not isinstance(policy, Mapping):
        return f"policy 形状不认:不是映射(实际 {type(policy).__name__})"
    if "enabled" not in policy:
        return "policy 缺字段 enabled"
    enabled = policy["enabled"]
    if not isinstance(enabled, bool):
        return f"policy.enabled 形状不认:不是布尔(实际 {type(enabled).__name__})"
    if not enabled:
        return (
            "一致性闸策略未启用(enabled=False):本闸不出判定,按未判定阻断;"
            "需调用方显式定向说明,不得据此放行(§0.10 不是跳门)"
        )
    return ""


def _verdict(
    state: RevertVerdict,
    *,
    judged: bool,
    allow: bool,
    reason: str,
    diff: dict[str, list[str]],
) -> dict[str, object]:
    """统一构造可审计 verdict(单一出口,保证三档字段同形)。"""
    return {
        "verdict": state.value,
        "judged": judged,
        "allow": allow,
        "reason": reason,
        "criterion": REVERT_CHECK_CRITERION,
        "diff": diff,
    }


def evaluate_revert_check(
    target_snapshot: object,
    current_workspace: object,
    policy: object,
) -> dict[str, object]:
    """判断「目标检查点」与「当前工作区」是否一致(纯函数,返回结构化 verdict)。

    判据能不能成立:先过策略,再过两个面的形状。**任一关不认 ⇒ 未判定(阻断)**,
    绝不落到比较 —— 这是 §0.3 / §0.10 的落点。三面都认了,才做逐文件比较(纯数据)。
    ``diff`` 的三类:``changed`` 两侧都有但内容不同、``added`` 工作区在途新增、
    ``removed`` 工作区在途删除;三者皆空才放行。排序保证 verdict 可复现、可审计。
    """
    # 策略关:关掉/坏掉一律按未判定,不是跳门。
    policy_reason = _read_policy(policy)
    if policy_reason:
        return _verdict(
            RevertVerdict.UNJUDGED,
            judged=False,
            allow=False,
            reason=policy_reason,
            diff=_empty_diff(),
        )

    # 形状关:目标快照。
    snapshot, snap_reason = _read_files(target_snapshot, "target_snapshot")
    if snap_reason:
        return _verdict(
            RevertVerdict.UNJUDGED,
            judged=False,
            allow=False,
            reason=snap_reason,
            diff=_empty_diff(),
        )

    # 形状关:当前工作区。
    workspace, ws_reason = _read_files(current_workspace, "current_workspace")
    if ws_reason:
        return _verdict(
            RevertVerdict.UNJUDGED,
            judged=False,
            allow=False,
            reason=ws_reason,
            diff=_empty_diff(),
        )

    # 能到这里:两面形状都认(成功时 files 必为 dict),才做一致性比较。
    snap_paths = set(snapshot)
    ws_paths = set(workspace)
    changed = sorted(p for p in snap_paths & ws_paths if snapshot[p] != workspace[p])
    added = sorted(ws_paths - snap_paths)
    removed = sorted(snap_paths - ws_paths)
    if not (changed or added or removed):
        return _verdict(
            RevertVerdict.CONSISTENT,
            judged=True,
            allow=True,
            reason=f"目标快照与当前工作区逐文件一致(共 {len(snap_paths)} 个文件),放行",
            diff=_empty_diff(),
        )
    return _verdict(
        RevertVerdict.DIVERGED,
        judged=True,
        allow=False,
        reason=(
            "目标检查点与当前工作区不一致:回退将覆盖在途改动,阻断"
            f"(changed={len(changed)} added={len(added)} removed={len(removed)})"
        ),
        diff={"changed": changed, "added": added, "removed": removed},
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
