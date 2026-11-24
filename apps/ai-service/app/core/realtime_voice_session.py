# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""实时语音会话的帧级可追溯准入判据（round 9「能力复现」实现席 E）。

立因（观察 / 推断 / 未知 三分，AGENTS.md §0.12）：
    · 观察（机主派单给定 + 本仓现状）：对照 Qoder / Trae 一类工具具备「实时语音
      流式会话」能力；本仓 `realtime_voice` 相关命名零命中，app/core 只有
      voice_barge_in.py 的段间断音判据、realtime_context.py 的上下文件，
      缺「会话状态准入 + 帧级可追溯」这一层。
    · 推断：对照的流式能力以「能连续收发帧」为卖点，但外部无法逐帧证明
      「这次输出动作基于哪一轮帧读数、写入是否原子、放行是否漏判」。
      该推断未经二进制取证，仅作为要超越的对立面。
    · 未知 / 未判定：本席未对 Qoder / Trae 二进制做 REA / 反编译实测取证
      （不在本席工具面，且硬边界只允许新建本席名下 2 个文件）；对照内部实现层
      判 unjudged，不冒充取证。本模块只复现可观察的行为契约（帧准入 → 逐帧
      可回放）并钉死测试，不粘对方专有源码 / 不碰凭据（§0.12 红线）。

本模块边界（docstring 明写）：**只做会话状态准入判据**——不处理音频编解码、
不做 VAD / TTS、不读系统时钟、不联网、不落盘；帧指纹等读数一律由采集侧传入，
本模块只比较、只判定、只返回结构化 verdict。刻意不引入任何时间源 / IO，
保证两个函数都是确定性的纯函数。

判据（全部机器判据，单一真相源 = evaluate_frame 一份，§0.6 不复制已有判据）：
    V1 frame_shape   帧形状：frame 带 frame_sha256（合法指纹）/ seq（int）/ kind（str）
    V2 current_round 「当轮帧读数」可读：session 带 state / current_frame_sha256
                     （合法指纹）/ ttl（int）。取不到一律 unjudged 阻断而非放行
                     （§0.3，亦是一轴超越的核心）
    V3 policy_shape  policy 带 registered_kinds / output_kinds / transitions
    V4 kind_known    frame.kind 必须在 registered_kinds 内（未登记 ⇒ denied）
    V5 ttl_window    seq 必须落在会话存活窗口内（0 <= seq <= ttl），越界 ⇒ denied
                     「超过 ttl」。TTL 以帧序号为量纲，刻意不引入墙钟。
    V6 state_legal   (session.state, frame.kind) 必须在 transitions 内（非法转移 ⇒
                     denied，例如 closed 后又收到 audio 帧）
    V7 use_then_act  「先用后动」：仅输出类 kind（barge_in / commit）适用，其
                     frame_sha256 必须等于当轮 current_frame_sha256；指纹不符 ⇒
                     unjudged 并拒绝写入。输入类帧（audio / vad）不触发此维。
    账本级（append_frame，判据只此一份，不另写）：
    V8 seq_strict    seq 严格 = 上一行 seq + 1 且未在账中出现（重复 seq / seq 断档
                     ⇒ denied）；配合 V5 使「序号 / TTL 单调」可回放。

四态结构化 verdict：accepted（输入帧准入）/ barged_in（输出类动作先用后动通过）/
denied（判据明确违规）/ unjudged（形状不认 / 取不到 / 指纹不符，§0.3）。
每个 verdict 带 reason（点名）+ tier（判定所处层：frame/session/policy/action/
ledger/stream）+ direction（§0.10 失效方向恒为「多要一次定向说明」而非放行）
+ checks（逐维判据）+ seq / kind。

刻意不做什么：
    · 不复制已有判据：回放直接复用 evaluate_frame，不另写一份同形判据（§0.6）；
      sha 指纹合型校验只有 _is_fingerprint 一份（刻意不用正则、用集合包含，
      与本仓别处同形工具区分；这是形状守卫，不是判据）。
    · 不原地改 ledger：失败返回**入参原对象**、不留半行；成功返回新账本。
    · 不做 IO / 不落盘 / 不算 sha256 / 不读时钟 / 不联网（本席边界）。
    · 不写对方专有源码、反编译伪代码、任何凭据（§0.12 红线）。

一轴超越（对照只有流式能力）：
    把「帧指纹溯源 + 先用后动 + 序号 / TTL 单调 + 原子写入 + 可回放」钉成机器判据，
    且**取不到当轮帧读数一律阻断而非放行**——对照流式会话无法逐帧给出这些
    「这次输出基于哪一轮、为何放行、写入是否原子」的可审计证据。账本行自带
    seq / kind / frame_sha256 / verdict / reason / state / current_frame_sha256 /
    ttl / ttl_remaining，可逐行重建 frame + session 用同一份判据回放复核。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

# 四态 verdict（结构化；§0.3 取不到输入 ⇒ unjudged，绝不静默放行）
ACCEPTED = "accepted"
BARGED_IN = "barged_in"
DENIED = "denied"
UNJUDGED = "unjudged"

# 只有这两态会真正落一行；其余一律阻断、账本不动。
_WRITABLE = frozenset({ACCEPTED, BARGED_IN})

# 轨迹行必备字段（回放据此核对；实际行另带上下文，见 append_frame）
ROW_FIELDS: tuple[str, ...] = ("seq", "kind", "frame_sha256", "verdict", "reason")

# sha256 指纹合型校验的**唯一**实现（§0.6）：64 位小写 hex。
_HEX = frozenset("0123456789abcdef")


def _is_fingerprint(value: Any) -> bool:
    """帧指纹是否合型（64 位小写 hex）；非法 ⇒ 当轮读数视为取不到。"""
    return isinstance(value, str) and len(value) == 64 and all(ch in _HEX for ch in value)


def _kind_set(value: Any) -> frozenset[str] | None:
    """policy 里的 kind 集合合型归一；str 刻意不算集合（避免把单字符当多值）。"""
    if isinstance(value, (frozenset, set, list, tuple)):
        return frozenset(value)
    return None


def _verdict(
    status: str,
    *,
    reason: str,
    tier: str,
    checks: dict[str, bool],
    seq: Any,
    kind: Any,
    direction: str = "",
) -> dict[str, Any]:
    """构造结构化 verdict：状态 + 点名原因 + 判定层 + 定向说明 + 逐维判据。

    direction 让 §0.10「失效方向 = 多要一次定向说明」成为可测字段：
    writable 两态为空串，其余档必须说清要补哪一次说明，而不是放它过门。
    """
    return {
        "verdict": status,
        "reason": reason,
        "tier": tier,
        "direction": direction,
        "checks": dict(checks),
        "seq": seq,
        "kind": kind,
    }


def evaluate_frame(frame: Any, session: Any, policy: Any) -> dict[str, Any]:
    """单帧自洽判据（不依赖账本）：这一帧能否基于当轮帧读数被准入 / 写入。

    立因：流式会话的「先用后动」必须是机器判据，不能靠提示词约定。输入类帧
    自带身份指纹；输出类动作（barge_in / commit）必须把 frame_sha256 溯源到
    当轮 session.current_frame_sha256——证明「先读了这一轮、再动作」。
    取不到当轮读数 / 形状不认 / 指纹不符 ⇒ unjudged（§0.3），绝不静默放行。

    判据 V1~V7（见模块 docstring）。短路返回首个不成立维度；checks 记录已判到
    的每一维。刻意不判 seq 单调——那需要账本，由 append_frame 补判（§0.6
    同一判据只写一份）。

    纯函数：不改 frame / session / policy，返回全新 dict。
    """
    checks: dict[str, bool] = {}
    seq = frame.get("seq") if isinstance(frame, Mapping) else None
    kind = frame.get("kind") if isinstance(frame, Mapping) else None
    fp = frame.get("frame_sha256") if isinstance(frame, Mapping) else None

    # V1 帧形状（§0.3：形状不认 / 缺指纹 ⇒ unjudged）
    if not _is_fingerprint(fp):
        checks["frame_shape"] = False
        if isinstance(frame, Mapping) and "frame_sha256" not in frame:
            why = "缺指纹：frame 未带 frame_sha256"
        else:
            why = "帧形状不认：frame_sha256 非合法 64 位 sha256 指纹"
        return _verdict(
            UNJUDGED,
            reason=why,
            tier="frame",
            checks=checks,
            seq=seq,
            kind=kind,
            direction="需一次定向说明：补 frame 的 frame_sha256（采集侧算好的本帧 sha256）",
        )
    if (
        not isinstance(seq, int)
        or isinstance(seq, bool)
        or seq < 0
        or not isinstance(kind, str)
        or not kind
    ):
        checks["frame_shape"] = False
        return _verdict(
            UNJUDGED,
            reason="帧形状不认：seq 需为非负 int、kind 需为非空 str",
            tier="frame",
            checks=checks,
            seq=seq,
            kind=kind,
            direction="需一次定向说明：补 frame 的 seq（非负 int）与 kind（非空 str）",
        )
    checks["frame_shape"] = True

    # V2 当轮帧读数可读（§0.3 + 一轴超越：取不到一律阻断而非放行）
    if isinstance(session, Mapping):
        anchor = session.get("current_frame_sha256")
        state = session.get("state")
        ttl = session.get("ttl")
    else:
        anchor = state = ttl = None
    if (
        not _is_fingerprint(anchor)
        or not isinstance(state, str)
        or not state
        or not isinstance(ttl, int)
        or isinstance(ttl, bool)
        or ttl < 0
    ):
        checks["current_round"] = False
        return _verdict(
            UNJUDGED,
            reason="取不到当轮帧读数：session 缺合法 current_frame_sha256 / state / ttl",
            tier="session",
            checks=checks,
            seq=seq,
            kind=kind,
            direction=(
                "需一次定向说明：先取当轮帧读数（current_frame_sha256）"
                "并补齐 session 的 state / ttl"
            ),
        )
    checks["current_round"] = True

    # V3 policy 形状
    registered = _kind_set(policy.get("registered_kinds")) if isinstance(policy, Mapping) else None
    outputs = _kind_set(policy.get("output_kinds")) if isinstance(policy, Mapping) else None
    transitions = policy.get("transitions") if isinstance(policy, Mapping) else None
    if (
        registered is None
        or outputs is None
        or not outputs <= registered
        or not isinstance(transitions, Mapping)
    ):
        checks["policy_shape"] = False
        return _verdict(
            UNJUDGED,
            reason=(
                "policy 形状不认：缺 registered_kinds / output_kinds / transitions，"
                "或 output_kinds 非 registered_kinds 子集"
            ),
            tier="policy",
            checks=checks,
            seq=seq,
            kind=kind,
            direction="需一次定向说明：补齐 policy 的注册 kind 集、输出类 kind 集与状态转移表",
        )
    checks["policy_shape"] = True

    # V4 未登记 kind
    if kind not in registered:
        checks["kind_known"] = False
        return _verdict(
            DENIED,
            reason=f"未登记 kind：{kind!r} 不在 policy.registered_kinds 内",
            tier="policy",
            checks=checks,
            seq=seq,
            kind=kind,
            direction="需一次定向说明：确认该 kind 的语义并在 policy 登记后再发送",
        )
    checks["kind_known"] = True

    # V5 超过 ttl（TTL 以帧序号为量纲，刻意不引入墙钟）
    if seq > ttl:
        checks["ttl_window"] = False
        return _verdict(
            DENIED,
            reason=f"超过 ttl：帧序号 seq={seq} 越过会话存活窗口上界 ttl={ttl}",
            tier="session",
            checks=checks,
            seq=seq,
            kind=kind,
            direction="需一次定向说明：会话窗口已耗尽，需新建会话（重新给定 ttl）而非继续追加帧",
        )
    checks["ttl_window"] = True

    # V6 状态机非法转移（如 closed 后又收到 audio 帧）
    allowed = _kind_set(transitions.get(state))
    if allowed is None or kind not in allowed:
        checks["state_legal"] = False
        return _verdict(
            DENIED,
            reason=f"状态机非法转移：state={state!r} 不接受 kind={kind!r}",
            tier="policy",
            checks=checks,
            seq=seq,
            kind=kind,
            direction="需一次定向说明：该状态下不允许此 kind，需先做合法的状态跃迁或新建会话",
        )
    checks["state_legal"] = True

    # V7 先用后动（输出类动作专属；反向变异验证锚点：临时禁用下一行守卫后测试须转红）
    if kind in outputs:
        if fp != anchor:
            checks["use_then_act"] = False
            return _verdict(
                UNJUDGED,
                reason=(
                    "先用后动：输出类动作的 frame_sha256 与当轮 current_frame_sha256 不符，"
                    "动作未溯源到本轮帧读数"
                ),
                tier="action",
                checks=checks,
                seq=seq,
                kind=kind,
                direction=(
                    "需一次定向说明：重取当轮帧读数，"
                    "令输出动作的 frame_sha256 盖当轮指纹后再动作"
                ),
            )
        checks["use_then_act"] = True
        return _verdict(
            BARGED_IN,
            reason="先用后动通过：输出类动作溯源到当轮帧指纹",
            tier="action",
            checks=checks,
            seq=seq,
            kind=kind,
        )

    # 输入类帧：先用后动不适用（无违规即通过），记 True 便于逐维审计
    checks["use_then_act"] = True
    return _verdict(
        ACCEPTED,
        reason="帧准入：形状 / 当轮读数 / 登记 / ttl 窗口 / 状态机全过",
        tier="stream",
        checks=checks,
        seq=seq,
        kind=kind,
    )


def append_frame(
    ledger: Sequence[dict[str, Any]],
    frame: Any,
    session: Any,
    policy: Any,
) -> tuple[Sequence[dict[str, Any]], dict[str, Any]]:
    """把一帧追加进会话账；不可变风格：失败返回**原 ledger**、不留半行。

    立因：流式会话无法证明「写入是原子的」。本函数先过 evaluate_frame（判据唯一
    一份，§0.6），单帧不过直接返回入参原对象；单帧过了才补判账本级 V8
    （seq 严格单调 + 无重复）。任一维失败都返回同一个 ledger 引用，绝不留下
    「判了一半、写了一半」的半行。

    成功返回新账本（新 list，不改入参）+ 对应 verdict；轨迹行含
    seq / kind / frame_sha256 / verdict / reason 及回放所需的上下文
    （state / current_frame_sha256 / ttl / ttl_remaining），可逐行回放审计。
    """
    base = evaluate_frame(frame, session, policy)
    if base["verdict"] not in _WRITABLE:
        return ledger, base  # 失败：原对象返回，不留半行

    checks = dict(base["checks"])
    seq = frame["seq"]

    # V8 序号 / TTL 单调：seq 严格 = 上一行 + 1 且未在账中出现
    last_seq = ledger[-1]["seq"] if ledger else 0
    seen_seqs = {row["seq"] for row in ledger}
    if seq in seen_seqs:
        checks["seq_strict"] = False
        return ledger, _verdict(
            DENIED,
            reason=f"重复 seq：帧序号 {seq} 已在账中出现，疑似重放",
            tier="ledger",
            checks=checks,
            seq=seq,
            kind=frame["kind"],
            direction="需一次定向说明：按账面续号发送新帧，不得复用旧序号",
        )
    if seq != last_seq + 1:
        checks["seq_strict"] = False
        return ledger, _verdict(
            DENIED,
            reason=f"seq 断档：本帧 seq={seq}，期望 {last_seq + 1}",
            tier="ledger",
            checks=checks,
            seq=seq,
            kind=frame["kind"],
            direction="需一次定向说明：按账面续号补帧，不得跳号",
        )
    checks["seq_strict"] = True

    row = {
        "seq": seq,
        "kind": frame["kind"],
        "frame_sha256": frame["frame_sha256"],
        "verdict": base["verdict"],
        "reason": base["reason"],
        "tier": base["tier"],
        "state": session["state"],
        "current_frame_sha256": session["current_frame_sha256"],
        "ttl": session["ttl"],
        "ttl_remaining": session["ttl"] - seq,  # TTL 单调：随 seq 严格递减且 >= 0
    }
    new_ledger = [*ledger, row]
    return new_ledger, _verdict(
        base["verdict"],
        reason=base["reason"],
        tier=base["tier"],
        checks=checks,
        seq=seq,
        kind=frame["kind"],
    )


__all__ = [
    "ACCEPTED",
    "BARGED_IN",
    "DENIED",
    "UNJUDGED",
    "ROW_FIELDS",
    "evaluate_frame",
    "append_frame",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
