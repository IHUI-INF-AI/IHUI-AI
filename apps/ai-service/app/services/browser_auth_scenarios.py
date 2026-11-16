# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器登录 handoff 特殊场景 — 统一实现 26.1111 browserAuth §7 清单余项。

设计依据
--------
``内部规格`` §1 硬红线 /
§2 生命周期 / §7 复现清单(明文 371 行 browserAuth.md 按行为规格)::

    QR 码场景: browserAuth.request({origin, fields:[], qr_code:true}),
      Browser-client 安全捕获解码可见 QR;绝不自己 inspect/print/copy/重建
      其目标 URL。例外:可信原生移动 handoff 错误显式给出已验证 HTTPS 登录 URL
      才展示。
    数字匹配挑战: 告知用户精确的非秘密数字/匹配细节("Tap 37 on your phone");
      是 emoji/图标就描述视觉线索,绝不发明数字或把图转成数字码。
    未知结果: 关掉的 popup / 空白页 / spinner / 缺失或陈旧 tab / 超时 =
      未知结果(既非失败也非成功证据)。
    硬红线: 先看有没有可安装插件能完成任务(优先插件);不用 browserAuth 注册
      新账号;CAPTCHA 不属 browserAuth。

对照 IHUI 缺口
--------------
``browser_auth_handoff`` 只做了状态机 + 消毒 + 诊断,未落这些**特殊场景判据**:
QR 目标 URL 隔离、数字匹配只报非秘密数字、未知结果归一、前置门(插件/注册/CAPTCHA)。

设计要点(纯函数,零 IO)
------------------------
1. **QR handoff** ``handle_qr_handoff``:client 解码,模型只知"已捕获",禁碰
   目标 URL;仅可信原生 handoff 显式给出已验证 HTTPS URL 才展示;
2. **数字匹配** ``build_matching_challenge``:只回非秘密数字/视觉线索文本,
   禁发明数字/图转数字码;
3. **未知结果** ``classify_auth_outcome_evidence``:spinner/空白/陈旧/超时
   → unknown(非成功非失败);
4. **前置门** ``check_auth_preflight``:有插件→建议插件;要注册→走 manual
   handoff;CAPTCHA→不属本能力(走主 skill)。

与既有层关系
--------------
- 与 ``browser_auth_handoff``(状态机/消毒/诊断)互补:本模块补特殊场景与前置门;
- 输出皆纯判定,不含凭据值,模型面只见非秘密线索。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

# ── QR 码安全 handoff ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class QrHandoffOutcome:
    """QR 登录 handoff 结果(client 解码,模型禁碰目标 URL)。"""

    captured: bool  # client 是否安全捕获解码 QR
    show_login_url: bool  # 是否向模型/用户展示登录 URL
    login_url: str | None  # 仅可信原生 handoff 例外才非 None;否则 None
    detail: str


def handle_qr_handoff(
    *,
    client_captured: bool,
    trusted_native_error_url: str | None = None,
) -> QrHandoffOutcome:
    """QR 登录:client 解码;模型禁 inspect/copy/重建目标 URL(纯函数)。

    参数 trusted_native_error_url:仅当可信原生移动 handoff **错误**显式给出
    已验证 HTTPS 登录 URL 时才传入(例外),否则 None。
    """
    if not client_captured:
        return QrHandoffOutcome(
            captured=False,
            show_login_url=False,
            login_url=None,
            detail="QR 未被 client 安全捕获,不展示任何 URL,重试捕获。",
        )
    # 例外:可信原生 handoff 错误显式给出已验证 HTTPS 登录 URL 才展示
    if trusted_native_error_url and trusted_native_error_url.lower().startswith("https://"):
        return QrHandoffOutcome(
            captured=True,
            show_login_url=True,
            login_url=trusted_native_error_url,
            detail="可信原生 handoff 错误显式给出已验证 HTTPS 登录 URL,展示该 URL(唯一例外)。",
        )
    return QrHandoffOutcome(
        captured=True,
        show_login_url=False,
        login_url=None,
        detail=(
            "QR 已由 client 安全捕获解码;模型不 inspect/print/copy/重建其目标 URL,"
            "继续走可见页面校验。"
        ),
    )


# ── 数字匹配挑战 ───────────────────────────────────────────────────────────


class ChallengeKind(StrEnum):
    """匹配挑战形态。"""

    NUMBER = "number"  # 精确数字匹配("Tap 37 on your phone")
    EMOJI = "emoji"  # 视觉线索("Tap the 🥶 emoji")


@dataclass(frozen=True)
class MatchingChallenge:
    """可向用户复述的匹配挑战(只含非秘密数字/视觉线索)。"""

    kind: str  # ``ChallengeKind`` 之一
    user_instruction: str  # 可安全展示的指令文本
    invented_number: bool  # 是否发明了数字(恒 False,违规守卫)
    detail: str


def build_matching_challenge(
    *,
    kind: str,
    number: int | None = None,
    visual_cue: str | None = None,
) -> MatchingChallenge | None:
    """构造数字/视觉匹配挑战(只回非秘密线索,禁发明数字/图转数字码)。

    - NUMBER:须给页面实际显示的非秘密 number;number is None → 拒(不发明);
    - EMOJI:须给 visual_cue 描述;转不出数字码,恒按视觉线索复述。
    """
    k = (kind or "").strip().lower()
    if k == ChallengeKind.NUMBER.value:
        if number is None:
            return MatchingChallenge(
                kind=ChallengeKind.NUMBER.value,
                user_instruction="",
                invented_number=False,
                detail="页面未显示明确匹配数字:不发明数字,要求重看可见页面。",
            )
        return MatchingChallenge(
            kind=ChallengeKind.NUMBER.value,
            user_instruction=f"在手机上点按数字 {number} 完成匹配。",
            invented_number=False,
            detail=f"只复述页面显示的非秘密数字 {number},不猜测、不转换。",
        )
    if k == ChallengeKind.EMOJI.value:
        if not visual_cue:
            return MatchingChallenge(
                kind=ChallengeKind.EMOJI.value,
                user_instruction="",
                invented_number=False,
                detail="未给视觉线索描述:不把图转成数字码,要求重看可见页面。",
            )
        return MatchingChallenge(
            kind=ChallengeKind.EMOJI.value,
            user_instruction=f"在手机上点按{visual_cue}。",
            invented_number=False,
            detail="按视觉线索复述,不发明数字、不把图转成数字码。",
        )
    return None


# ── 未知结果判定 ───────────────────────────────────────────────────────────


class OutcomeEvidence(StrEnum):
    """认证结果的可见证据分类。"""

    POSITIVE_LOGIN = "positive_login"  # 新鲜目标域页面显示正向登录信号
    KNOWN_FAILURE = "known_failure"  # 站点明确报错
    UNKNOWN = "unknown"  # spinner/空白/陈旧/超时/关掉的 popup


@dataclass(frozen=True)
class OutcomeEvidenceDecision:
    """认证结果证据判定(既不误报成功也不误报失败)。"""

    evidence: str  # ``OutcomeEvidence`` 之一
    report_success: bool
    report_failure: bool
    detail: str


def classify_auth_outcome_evidence(
    *,
    spinner_visible: bool = False,
    blank_page: bool = False,
    stale_or_missing_tab: bool = False,
    timed_out: bool = False,
    popup_closed: bool = False,
    site_error_visible: bool = False,
    fresh_positive_login_signal: bool = False,
) -> OutcomeEvidenceDecision:
    """按新鲜可见证据分类认证结果(纯函数)。

    Codex §2.5:"关掉的 popup / 空白页 / spinner / 缺失或陈旧 tab / 超时 =
    未知结果(既非失败也非成功证据)"。仅新鲜正向登录信号才报成功。
    """
    if spinner_visible or blank_page or stale_or_missing_tab or timed_out or popup_closed:
        return OutcomeEvidenceDecision(
            evidence=OutcomeEvidence.UNKNOWN.value,
            report_success=False,
            report_failure=False,
            detail="spinner/空白/陈旧 tab/超时/关掉的 popup = 未知结果:不误报成功也不误报失败。",
        )
    if fresh_positive_login_signal:
        return OutcomeEvidenceDecision(
            evidence=OutcomeEvidence.POSITIVE_LOGIN.value,
            report_success=True,
            report_failure=False,
            detail="新鲜目标域页面显示正向登录信号:报成功。",
        )
    if site_error_visible:
        return OutcomeEvidenceDecision(
            evidence=OutcomeEvidence.KNOWN_FAILURE.value,
            report_success=False,
            report_failure=True,
            detail="站点可见报错:报失败(仅当站点明确报错才报)。",
        )
    return OutcomeEvidenceDecision(
        evidence=OutcomeEvidence.UNKNOWN.value,
        report_success=False,
        report_failure=False,
        detail="无正向信号也无明确报错:按未知处理,不猜。",
    )


# ── 前置门(插件优先 / 禁注册 / CAPTCHA 不属) ────────────────────────────────


class PreflightDecision(StrEnum):
    """browserAuth 前置门判定。"""

    PROCEED = "proceed"  # 可走 browserAuth
    USE_PLUGIN = "use_plugin"  # 有可安装插件能完成 → 建议插件而非 browserAuth
    MANUAL_HANDOFF = "manual_handoff"  # 注册新账号 → 走 manual handoff
    NOT_CAPTCHA = "not_captcha"  # CAPTCHA → 不属本能力,走主 skill


@dataclass(frozen=True)
class PreflightOutcome:
    """前置门结果。"""

    decision: str  # ``PreflightDecision`` 之一
    proceed_with_browser_auth: bool
    detail: str


def check_auth_preflight(
    *,
    installable_plugin_available: bool,
    is_registration: bool = False,
    is_captcha: bool = False,
) -> PreflightOutcome:
    """browserAuth 前置门(纯函数):插件优先 > 禁注册 > CAPTCHA 不属。"""
    if is_captcha:
        return PreflightOutcome(
            PreflightDecision.NOT_CAPTCHA.value,
            False,
            "CAPTCHA 不属登录凭据能力:走主 Browser skill 的 CAPTCHA 指引,禁用本能力。",
        )
    if is_registration:
        return PreflightOutcome(
            PreflightDecision.MANUAL_HANDOFF.value,
            False,
            "不用 browserAuth 注册新账号:走 manual handoff 让用户自己完成。",
        )
    if installable_plugin_available:
        return PreflightOutcome(
            PreflightDecision.USE_PLUGIN.value,
            False,
            "有可安装插件能完成任务:优先建议装插件而非走 browserAuth(硬红线 1)。",
        )
    return PreflightOutcome(
        PreflightDecision.PROCEED.value, True, "无插件、非注册、非 CAPTCHA:可走 browserAuth。"
    )


__all__ = [
    "QrHandoffOutcome",
    "handle_qr_handoff",
    "ChallengeKind",
    "MatchingChallenge",
    "build_matching_challenge",
    "OutcomeEvidence",
    "OutcomeEvidenceDecision",
    "classify_auth_outcome_evidence",
    "PreflightDecision",
    "PreflightOutcome",
    "check_auth_preflight",
]
