# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""桌面操控可解释轨迹账（round 8「能力复现」实现席 D）。

取证立因（观察 / 推断 / 未知 三分，AGENTS.md §0.12）：
    · 观察（机主 2026-11-14 /goal 给定 + 本仓 src-tauri 现状）：
      对照程序 Trae 的 TraeRecordReplayRuntime.exe、Qoder 的 recordAndReplay 提供
      桌面操控「录制 → 回放」，产物是不透明二进制；本仓 apps/desktop/src-tauri
      已有一族 computer-use 键鼠/截屏命令（screenshot_screen / mouse_click /
      mouse_move / keyboard_type / mouse_scroll / keyboard_press / keyboard_hotkey，
      统一受 require_computer_control 门控），但没有任何逐步轨迹账。
    · 推断：对照二进制内部以私有序列化格式编码步骤序列，外部无法逐字段审计
      「这一步基于哪张截图、坐标从何而来、判定为何、写入是否原子」。该推断未经
      反编译验证，仅作为要超越的对立面。
    · 未知 / 未判定：本实现席未对本机 Trae/Qoder/WorkBuddy/DeepSeek Harness
      二进制做 REA / craft-anything deep 实测取证 —— 该取证面不在本席工具面，
      且硬边界只允许新建本席名下 2 个文件。故二进制内部结构层判 unjudged，
      不冒充取证；本模块只复现可观察的行为契约（录制 → 逐步回放）并钉死测试。

判据（全部为机器判据，不靠提示词；§0.6 单一真相源 = evaluate_step 一份）：
    C1 frame_available   当轮截图读数可取（current_frame 带合法 sha256 指纹）
    C2 step_nonempty     step 非空且带 action
    C3 has_sha           每步必须带 screenshot_sha256
    C4 coord_present     每步必须带 coord，且 coord 自带来源戳 frame_sha256
    C5 sha_matches_frame 「先用后动」：动作所依据的截图指纹必须是当轮
    C6 coord_traceable   坐标必须能溯源到当轮截图指纹（一轴超越的核心）
    C7 seq_continuous    seq 严格 = 账面行数 + 1（append_step 账本级）
    C8 sha_unique        当轮指纹未在账中出现过（append_step 账本级）

    三态 verdict：accepted / rejected / unjudged。取不到输入一律 unjudged 并
    点名原因（§0.3），绝不静默放行；失效方向恒为「多要一次定向说明」——
    verdict.needs_direction 结构化给出要补的那次说明（§0.10），而非放它过门。

刻意不做什么：
    · 不写对方专有源码原文 / 反编译伪代码 / 任何凭据（§0.12 红线）。
    · 不做 IO、不落盘、不算 sha256：本模块是纯判据，截图指纹由采集侧传入；
      持久化 / Tauri 命令接线属主会话单点收口，不在本席射程。
    · 不复制已有判据：回放审计直接复用 evaluate_step，不另写一份同形函数
      （§0.6）；sha256 合型校验只有 _is_sha256 一份。
    · 不原地改 ledger：失败返回**入参原对象**、不留半行；成功返回新账本。

一轴超越（对照录制产物不透明）：
    每行落 seq / action / coord / screenshot_sha256 / verdict，并让 coord 自带
    「来源戳」frame_sha256 绑定到当轮截图指纹 —— 逐步可溯源、可回放、写入原子
    （失败不留半行）。对照的二进制产物无法逐字段给出这些；「先用后动」在我方
    是 sha256 绑定的机器判据，不依赖提示词约定。
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

# 三态 verdict（结构化；§0.3 取不到输入 ⇒ unjudged）
ACCEPTED = "accepted"
REJECTED = "rejected"
UNJUDGED = "unjudged"

# 轨迹行必备字段（回放审计据此核对，单一真相源）
ROW_FIELDS: tuple[str, ...] = ("seq", "action", "coord", "screenshot_sha256", "verdict")

# sha256 指纹合型校验的**唯一**实现（§0.6，不复制）
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _is_sha256(value: Any) -> bool:
    """截图指纹是否合型（64 位小写 hex）。非法 ⇒ 当轮读数视为取不到。"""
    return isinstance(value, str) and _SHA256_RE.match(value) is not None


def _verdict(
    status: str,
    *,
    reason: str,
    checks: dict[str, bool],
    seq: Any,
    needs_direction: str = "",
) -> dict[str, Any]:
    """构造结构化 verdict：状态 + 点名原因 + 逐维判据 + 要补的定向说明。

    needs_direction 让 §0.10「失效方向 = 多要一次定向说明」成为可测字段：
    accepted 为空串，其余档必须说清要补哪一次说明，而不是放它过门。
    """
    return {
        "status": status,
        "accepted": status == ACCEPTED,
        "reason": reason,
        "needs_direction": needs_direction,
        "checks": dict(checks),
        "seq": seq,
    }


def evaluate_step(step: Any, current_frame: Any) -> dict[str, Any]:
    """单步自洽判据（不依赖账本）：step 能不能基于当轮截图读数写入。

    立因：桌面操控「先用后动」必须是机器判据，不能靠提示词约定。每步要声明
    它所依据的截图指纹（screenshot_sha256）以及坐标的来源戳
    （coord.frame_sha256）；两者都必须等于**当轮** current_frame 的指纹。
    取不到当轮读数 / 缺字段 / 坐标溯源不上 ⇒ unjudged 并点名原因（§0.3）。

    判据：C1~C6（见模块 docstring）。短路返回首个不成立维度；checks 记录
    已判到的每一维，便于逐维审计。刻意不判 seq / 去重 —— 那两维需要账本，
    由 append_step 在单步全过后补判（避免把同一判据写两份，§0.6）。

    纯函数：不改 step / current_frame，返回全新 dict。
    """
    checks: dict[str, bool] = {}
    seq = step.get("seq") if isinstance(step, Mapping) else None

    # C1 当轮截图读数可取（§0.3：取不到 ⇒ unjudged，绝不静默放行）
    frame_sha = (
        current_frame.get("screenshot_sha256")
        if isinstance(current_frame, Mapping)
        else None
    )
    if not _is_sha256(frame_sha):
        checks["frame_available"] = False
        return _verdict(
            UNJUDGED,
            reason="当轮截图读数取不到：current_frame 未带合法 screenshot_sha256 指纹",
            needs_direction="需一次定向说明：先执行 screenshot_screen 取当轮截图并计算其 sha256 作为 current_frame",
            checks=checks,
            seq=seq,
        )
    checks["frame_available"] = True

    # C2 step 非空且带 action
    if not isinstance(step, Mapping) or not step or not step.get("action"):
        checks["step_nonempty"] = False
        return _verdict(
            UNJUDGED,
            reason="空 step 或缺 action：无从判定",
            needs_direction="需一次定向说明：补全本步的 action 与参数后再写入",
            checks=checks,
            seq=seq,
        )
    checks["step_nonempty"] = True

    # C3 每步必须带 screenshot_sha256
    step_sha = step.get("screenshot_sha256")
    if not isinstance(step_sha, str) or not step_sha:
        checks["has_sha"] = False
        return _verdict(
            UNJUDGED,
            reason="缺 screenshot_sha256：本步没有声明所依据的截图读数",
            needs_direction="需一次定向说明：补上本步 screenshot_sha256（当轮截图指纹）",
            checks=checks,
            seq=seq,
        )
    checks["has_sha"] = True

    # C4 每步必须带 coord，且 coord 自带来源戳
    coord = step.get("coord")
    if not (
        isinstance(coord, Mapping)
        and "x" in coord
        and "y" in coord
        and "frame_sha256" in coord
    ):
        checks["coord_present"] = False
        return _verdict(
            UNJUDGED,
            reason="缺 coord 或坐标无来源戳 frame_sha256：坐标不知道从哪张截图读出",
            needs_direction="需一次定向说明：coord 需带 x/y 及 frame_sha256（该坐标出自哪一轮截图）",
            checks=checks,
            seq=seq,
        )
    checks["coord_present"] = True

    # C5 先用后动：动作所依据的截图必须是当轮，不能拿旧读数驱动动作
    if step_sha != frame_sha:
        checks["sha_matches_frame"] = False
        return _verdict(
            REJECTED,
            reason="先用后动：本步 screenshot_sha256 与当轮截图指纹不一致，动作未基于当轮读数",
            needs_direction="需一次定向说明：重取当轮截图读数后再决定动作，不得沿用上一轮指纹",
            checks=checks,
            seq=seq,
        )
    checks["sha_matches_frame"] = True

    # C6 坐标溯源（一轴超越核心判据；反向变异验证锚点：把下一行临时禁用后测试须转红）
    coord_sha = coord.get("frame_sha256")
    if coord_sha != frame_sha:
        checks["coord_traceable"] = False
        return _verdict(
            UNJUDGED,
            reason="坐标来源戳与当轮截图指纹不一致：坐标无法溯源到本轮读数",
            needs_direction="需一次定向说明：本步坐标从哪一轮截图读出；重取当轮并在 coord.frame_sha256 盖当轮指纹",
            checks=checks,
            seq=seq,
        )
    checks["coord_traceable"] = True

    return _verdict(
        ACCEPTED,
        reason="单步自洽：当轮读数可取、动作与坐标均溯源到当轮截图指纹",
        checks=checks,
        seq=seq,
    )


def append_step(
    ledger: Sequence[dict[str, Any]],
    step: Any,
    current_frame: Any,
) -> tuple[Sequence[dict[str, Any]], dict[str, Any]]:
    """把一步追加进轨迹账；不可变风格：失败返回**原 ledger**、不留半行。

    立因：录制产物不透明的对照无法证明「写入是原子的」。本函数先过
    evaluate_step（判据唯一一份，§0.6），单步不过直接返回入参原对象；单步
    过了才补判两维账本级判据（C7 序号连续 / C8 指纹未重复）。任一步失败都
    返回同一个 ledger 引用，绝不留下「判了一半、写了一半」的半行。

    成功返回新账本（新 list，不改入参）+ accepted verdict；轨迹行含
    seq / action / coord / screenshot_sha256 / verdict，可逐行回放审计。
    """
    base = evaluate_step(step, current_frame)
    if not base["accepted"]:
        return ledger, base  # 失败：原对象返回，不留半行

    checks = dict(base["checks"])
    seq = base["seq"]
    sha = step["screenshot_sha256"]

    # C7 序号连续：seq 必须严格等于账面行数 + 1（断档即拒，不补号、不静默续）
    expected_seq = len(ledger) + 1
    if seq != expected_seq:
        checks["seq_continuous"] = False
        return ledger, _verdict(
            REJECTED,
            reason=f"序号断档：本步 seq={seq!r}，期望 {expected_seq}",
            needs_direction="需一次定向说明：按账面续号补当轮步，不得跳号或复用旧号",
            checks=checks,
            seq=seq,
        )
    checks["seq_continuous"] = True

    # C8 指纹未重复：同一张当轮截图读数只能驱动一步（防重放旧读数）
    used_shas = {row.get("screenshot_sha256") for row in ledger}
    if sha in used_shas:
        checks["sha_unique"] = False
        return ledger, _verdict(
            REJECTED,
            reason="重复 screenshot_sha256：未重新取当轮截图读数就复用旧指纹",
            needs_direction="需一次定向说明：重取当轮截图生成新指纹后再记录下一步",
            checks=checks,
            seq=seq,
        )
    checks["sha_unique"] = True

    row = {
        "seq": seq,
        "action": step["action"],
        "coord": dict(step["coord"]),
        "screenshot_sha256": sha,
        "verdict": ACCEPTED,
        "frame_sha256": current_frame["screenshot_sha256"],
    }
    new_ledger = [*ledger, row]
    return new_ledger, _verdict(
        ACCEPTED,
        reason="写入成功：单步与账本判据全过，原子追加一行轨迹",
        checks=checks,
        seq=seq,
    )


def replay_audit(ledger: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """逐行回放审计：用每行自带的字段重建当轮读数，复用 evaluate_step 复核。

    立因：对照的二进制录制产物外部无法逐字段审计。我方每行都存够了
    seq/action/coord/screenshot_sha256/verdict，于是「可回放」可被机器判：
      · 行字段齐备、verdict 为 accepted、seq 严格 1..n、指纹两两不同；
      · 用行自身指纹重建 current_frame，把行当作 step 再喂 evaluate_step ——
        判据仍是那一份（§0.6），坐标来源戳一旦被篡改，C6 立即判 unjudged。

    刻意不另写一份「回放判据」：全部复用 evaluate_step，回放与写入同尺。
    """
    if not isinstance(ledger, (list, tuple)):
        return {
            "status": "inconsistent",
            "steps": 0,
            "replayed": 0,
            "first_failure": {"index": None, "seq": None, "reason": "ledger 不是序列，无法回放"},
        }
    seen_shas: set[Any] = set()
    for i, row in enumerate(ledger):
        expected = i + 1
        if not isinstance(row, Mapping):
            return _replay_fail(ledger, i, expected, "行不是 mapping")
        missing = [k for k in ROW_FIELDS if k not in row]
        if missing:
            return _replay_fail(ledger, i, expected, f"行缺字段 {missing}")
        if row.get("verdict") != ACCEPTED:
            return _replay_fail(ledger, i, expected, "行 verdict 非 accepted")
        if row.get("seq") != expected:
            return _replay_fail(ledger, i, expected, f"seq 断档：{row.get('seq')!r}")
        sha = row.get("screenshot_sha256")
        if sha in seen_shas:
            return _replay_fail(ledger, i, expected, "screenshot_sha256 重复")
        seen_shas.add(sha)
        # 用行自身字段重建当轮读数，复用唯一判据复核坐标溯源
        frame = {"seq": row["seq"], "screenshot_sha256": row["screenshot_sha256"]}
        step = {
            "seq": row["seq"],
            "action": row["action"],
            "coord": row["coord"],
            "screenshot_sha256": row["screenshot_sha256"],
        }
        verdict = evaluate_step(step, frame)
        if not verdict["accepted"]:
            return _replay_fail(
                ledger, i, expected, f"重放判据不通过：{verdict['reason']}"
            )
    return {
        "status": "consistent",
        "steps": len(ledger),
        "replayed": len(ledger),
        "first_failure": None,
    }


def _replay_fail(
    ledger: Sequence[dict[str, Any]], i: int, seq: int, reason: str
) -> dict[str, Any]:
    """回放不一致的结构化结论（点名第几行、为什么，不静默吞）。"""
    return {
        "status": "inconsistent",
        "steps": len(ledger),
        "replayed": i,
        "first_failure": {"index": i, "seq": seq, "reason": reason},
    }


__all__ = [
    "ACCEPTED",
    "REJECTED",
    "UNJUDGED",
    "ROW_FIELDS",
    "evaluate_step",
    "append_step",
    "replay_audit",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
