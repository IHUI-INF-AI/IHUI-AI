# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器动作确认分级 — 复现 Codex 26.1111 Agent Confirmations Policy(2026-11-15 取证)。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-confirmation-policy-and-cdp.md``(R11f,明文直读
``cloud/confirmations.md``)+ ``cua-browser-safety-and-tab-lifecycle.md``(R11g,
不可信内容模型)。这是**行为/设计对照复现**,不粘专有源码、不破解许可证。

对照 IHUI 缺口
--------------
- ``tool_approval_descriptor._classify_scope`` 把所有 ``browser_*`` 一律归 ``network``
  ⇒ Codex 按语义分**四档摩擦**,粒度完全不同;
- ``prompt_guard`` 是**字符串级**注入检测("ignore instructions"正则),而 Codex 信任边界
  是**来源信任模型**(非用户内容不可给指令/权限)—— 二者正交,本模块补来源模型。

设计要点(纯函数,零 IO,不改审批主链)
--------------------------------------
1. **指令信任边界**:用户亲撰 = 有效意图(高风险也算,不是注入);第三方内容(粘贴/网页/
   PDF/工具输出)= 潜在恶意,绝不自带许可;**模糊指令非概括性预授权**。
2. **读取 vs 传输二分**:只有"传输"(提交表单/发消息/上传/改 sharing/打敏感数据进表单/
   访问 URL 内嵌敏感数据)才触发确认;"读取"恒允许。
3. **17 类风险 × 四档摩擦**(Codex 编号语义已逐条展开):handoff-required / always-confirm /
   pre-approval-ok / no-confirmation。
4. **敏感数据判定 + 确认卫生**:传敏感数据须点明具体数据+目的地,初始预批准不够。

与既有层的关系
--------------
- 通用审批描述符(``tool_approval_descriptor``)只判工具类别 scope,不知道"这一步是否传输
  敏感数据""是否第三方内容授权"—— 本模块给浏览器动作补这层语义判定;
- 与 ``cdp_method_gate``(CDP 命令白名单)、``network_approval``(网络出口)互补,不重叠。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ── 四档摩擦级别(对标 Codex A.3,语义已逐条展开) ─────────────────────────────

FRICTION_HANDOFF = "handoff_required"
FRICTION_ALWAYS_CONFIRM = "always_confirm"
FRICTION_PRE_APPROVAL_OK = "pre_approval_ok"
FRICTION_NONE = "none"

FRICTION_TIERS: tuple[str, ...] = (
    FRICTION_HANDOFF,
    FRICTION_ALWAYS_CONFIRM,
    FRICTION_PRE_APPROVAL_OK,
    FRICTION_NONE,
)

# ── 17 类风险分类学(Codex 内部分类号,语义逐条展开) ─────────────────────────

RISK_DELETE_DATA = "delete_data"  # [1] 删除数据(云+本地)
RISK_ACCOUNT_PERMISSION = "account_permission"  # [2.x] 网络权限/账号/持久访问/存凭据
RISK_IDENTITY_VERIFY = "identity_verify"  # [3.x] cookie 同意/年龄验证/登录
RISK_CAPTCHA = "captcha"  # [4] 解 CAPTCHA
RISK_THIRD_PARTY_WARNING = "third_party_warning"  # [5] 接受第三方"are you sure?"
RISK_UPLOAD = "upload"  # [6] 上传文件(出站)
RISK_DOWNLOAD = "download"  # [7] 下载文件(入站)
RISK_INSTALL_SOFTWARE = "install_software"  # [8.x] 安装/运行新获软件/扩展
RISK_REPRESENTATIVE_COMMS = "representative_comms"  # [9] 代表性通信(消息/评论/表单)
RISK_SUBSCRIPTION = "subscription"  # [10] 订阅/退订通知
RISK_FINANCIAL = "financial"  # [11] 金融交易
RISK_FILE_MANAGEMENT = "file_management"  # [12] 本地/同云内移动重命名(非传输)
RISK_SYSTEM_SETTINGS = "system_settings"  # [13] 改本地系统设置(VPN/OS 安全)
RISK_TRANSMIT_SENSITIVE = "transmit_sensitive"  # [14] 传输敏感数据
RISK_BYPASS_BARRIER = "bypass_barrier"  # [15] 绕过浏览器/网络安全屏障/paywall
RISK_MODEL_CODE_IN_TOOL = "model_code_in_tool"  # [16] 把模型代码输入工具/OS
RISK_MEDICAL = "medical"  # [17] 医疗行为

RISK_CATEGORIES: tuple[str, ...] = (
    RISK_DELETE_DATA,
    RISK_ACCOUNT_PERMISSION,
    RISK_IDENTITY_VERIFY,
    RISK_CAPTCHA,
    RISK_THIRD_PARTY_WARNING,
    RISK_UPLOAD,
    RISK_DOWNLOAD,
    RISK_INSTALL_SOFTWARE,
    RISK_REPRESENTATIVE_COMMS,
    RISK_SUBSCRIPTION,
    RISK_FINANCIAL,
    RISK_FILE_MANAGEMENT,
    RISK_SYSTEM_SETTINGS,
    RISK_TRANSMIT_SENSITIVE,
    RISK_BYPASS_BARRIER,
    RISK_MODEL_CODE_IN_TOOL,
    RISK_MEDICAL,
)

# 17 类 → 四档摩擦(Codex A.3 逐条)
_CATEGORY_FRICTION: dict[str, str] = {
    # ① 必须交接
    RISK_BYPASS_BARRIER: FRICTION_HANDOFF,
    # ② 动作时必确认(即便已预批准)
    RISK_DELETE_DATA: FRICTION_ALWAYS_CONFIRM,
    RISK_ACCOUNT_PERMISSION: FRICTION_ALWAYS_CONFIRM,
    RISK_CAPTCHA: FRICTION_ALWAYS_CONFIRM,
    RISK_INSTALL_SOFTWARE: FRICTION_ALWAYS_CONFIRM,
    RISK_REPRESENTATIVE_COMMS: FRICTION_ALWAYS_CONFIRM,
    RISK_SUBSCRIPTION: FRICTION_ALWAYS_CONFIRM,
    RISK_FINANCIAL: FRICTION_ALWAYS_CONFIRM,
    RISK_SYSTEM_SETTINGS: FRICTION_ALWAYS_CONFIRM,
    RISK_MEDICAL: FRICTION_ALWAYS_CONFIRM,
    RISK_TRANSMIT_SENSITIVE: FRICTION_ALWAYS_CONFIRM,
    # ③ 预批准有效(否则当"必确认")
    RISK_IDENTITY_VERIFY: FRICTION_PRE_APPROVAL_OK,
    RISK_THIRD_PARTY_WARNING: FRICTION_PRE_APPROVAL_OK,
    RISK_UPLOAD: FRICTION_PRE_APPROVAL_OK,
    RISK_FILE_MANAGEMENT: FRICTION_PRE_APPROVAL_OK,
    RISK_MODEL_CODE_IN_TOOL: FRICTION_PRE_APPROVAL_OK,
    # ④ 无需确认(恒允许)
    RISK_DOWNLOAD: FRICTION_NONE,
}

# ── 敏感数据类别(Codex A.2 / safety-A,逐条) ────────────────────────────────

SENSITIVE_DATA_CLASSES: tuple[str, ...] = (
    "contact_info",  # 联系方式
    "personal_details",  # 个人/职业详情
    "photos_of_person",  # 关于某人的照片文件
    "legal_medical_hr",  # 法律医疗 HR 信息
    "telemetry",  # 遥测(浏览历史/内存/app 日志)
    "identity_document",  # 身份标识(SSN/护照)
    "biometric",  # 生物特征
    "financial",  # 财务
    "credential",  # 密码/OTP/API key
    "precise_location",  # 精确位置/IP/住址
)


# ── 指令信任来源(不可信内容模型第一性) ─────────────────────────────────────

TRUST_USER_AUTHORED = "user_authored"  # 用户亲撰 = 有效意图
TRUST_THIRD_PARTY = "third_party_content"  # 粘贴/网页/PDF/工具输出 = 潜在恶意
TRUST_TOOL_DIRECTIVE = "tool_or_webmcp_directive"  # WebMCP/工具指令 = 不自带授权

# 模糊指令(非概括性预授权)特征词
_AMBIGUOUS_PREAUTH_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bdo everything\b", re.IGNORECASE),
    re.compile(r"\breply to (all|every)\b", re.IGNORECASE),
    re.compile(r"\bfill (the|this) form\b", re.IGNORECASE),
    re.compile(r"\bhandle it all\b", re.IGNORECASE),
    re.compile(r"\bcomplete the (todo|task) link\b", re.IGNORECASE),
)


@dataclass(frozen=True)
class BrowserConfirmationDecision:
    """浏览器动作的确认分级决策(纯函数入出参,键恒齐)。"""

    category: str  # 17 类风险之一;无命中 = ""(unknown)
    friction: str  # 四档摩擦之一;unknown 动作 = FRICTION_NONE
    is_transmission: bool  # 是否传输用户数据(读取 vs 传输二分)
    involves_sensitive_data: bool  # 是否涉敏感数据
    trust_source: str  # 指令信任来源
    requires_confirmation: bool  # 综合判定:是否须确认
    confirmation_detail: str | None  # 须确认时的"具体数据+目的地"要求说明
    reason: str  # 判定理由(非空)


def classify_trust_source(text: str, *, is_user_authored: bool) -> str:
    """判定指令信任来源(纯函数)。

    用户亲撰 → user_authored(有效意图,高风险也算);否则若来自工具/WebMCP 指令
    → tool_or_webmcp_directive;其余第三方内容 → third_party_content。
    """
    if is_user_authored:
        return TRUST_USER_AUTHORED
    lowered = (text or "").lower()
    if "webmcp" in lowered or "tool instruction" in lowered or "tool output says" in lowered:
        return TRUST_TOOL_DIRECTIVE
    return TRUST_THIRD_PARTY


def is_ambiguous_preauthorization(text: str) -> bool:
    """模糊指令不是概括性预授权(Codex A.1:"do everything in this todo link" 等)。"""
    return any(p.search(text or "") for p in _AMBIGUOUS_PREAUTH_PATTERNS)


def classify_sensitive_data(text: str) -> tuple[bool, list[str]]:
    """判定文本是否涉敏感数据,返回 (是否涉, 命中类别列表)。

    纯关键词/正则启发式,宁多判不少判(失效方向是多确认一次,不是漏一次)。
    """
    lowered = (text or "").lower()
    hits: list[str] = []
    patterns: dict[str, re.Pattern[str]] = {
        "contact_info": re.compile(r"\b(email|phone|电话|邮箱|联系方式)\b"),
        "identity_document": re.compile(r"\b(ssn|passport|护照|身份证|social security)\b"),
        "credential": re.compile(r"\b(password|passwd|otp|api[_ ]?key|token|密码|验证码|认证码)\b"),
        "financial": re.compile(r"\b(credit card|card number|bank|invoice|支付|银行卡|信用卡)\b"),
        "biometric": re.compile(r"\b(fingerprint|face id|指纹|人脸|生物识别)\b"),
        "precise_location": re.compile(r"\b(gps|latitude|longitude|精确位置|住址|home address)\b"),
        "legal_medical_hr": re.compile(r"\b(diagnosis|prescription|病历|处方|诊断|薪资|salary|hr record)\b"),
        "telemetry": re.compile(r"\b(browsing history|浏览历史|app log|遥测|telemetry)\b"),
        "photos_of_person": re.compile(r"\b(photo of|照片|自拍|selfie)\b"),
    }
    for cls, pat in patterns.items():
        if pat.search(lowered):
            hits.append(cls)
    return (bool(hits), hits)


def classify_browser_action(
    *,
    action: str,
    target: str = "",
    payload_text: str = "",
    trust_source: str = TRUST_USER_AUTHORED,
    pre_approved: bool = False,
) -> BrowserConfirmationDecision:
    """把一次浏览器动作归为确认分级决策(纯函数)。

    参数:
        action: 动作类型(见 ``RISK_CATEGORIES`` 或自由文本,未命中归 unknown);
        target: 目标站点/账号/路径(用于"具体目的地"要求);
        payload_text: 涉及的数据文本(用于敏感数据判定);
        trust_source: 指令信任来源(见 ``classify_trust_source``);
        pre_approved: 用户初始 prompt 是否已预批准。
    """
    action_key = (action or "").strip().lower()
    category = action_key if action_key in RISK_CATEGORIES else ""
    involves_sensitive, _hits = classify_sensitive_data(payload_text or "")
    # 打敏感数据进表单 = 传输;URL 内嵌敏感数据也算传输(Codex A.2)
    target_has_sensitive, _t = classify_sensitive_data(target or "")
    involves_sensitive = involves_sensitive or target_has_sensitive

    # 传输判定:有明确 category 且非"恒允许读取类"即为传输;敏感数据触碰恒算传输
    is_transmission = category not in ("", RISK_DOWNLOAD, RISK_IDENTITY_VERIFY) or involves_sensitive

    if category:
        friction = _CATEGORY_FRICTION[category]
    elif involves_sensitive:
        # 未命中 17 类但涉敏感数据 → 按传输敏感数据档(动作时确认)
        category = RISK_TRANSMIT_SENSITIVE
        friction = FRICTION_ALWAYS_CONFIRM
    else:
        friction = FRICTION_NONE

    # 综合判定:handoff/always-confirm 恒须确认;pre-approval-ok 仅未预批准时确认
    requires_confirmation = friction in (
        FRICTION_HANDOFF,
        FRICTION_ALWAYS_CONFIRM,
    ) or (friction == FRICTION_PRE_APPROVAL_OK and not pre_approved)

    # 确认卫生:传敏感数据须点明具体数据 + 具体目的地,初始预批准不够(Codex A.4)
    confirmation_detail: str | None = None
    if requires_confirmation and (category == RISK_TRANSMIT_SENSITIVE or involves_sensitive):
        confirmation_detail = (
            "传输敏感数据须点明:具体数据类别 + 具体目的地(站点/账号),"
            "初始 prompt 的预批准不够,动作时须再确认"
        )

    reason = (
        f"category={category or 'unknown'} friction={friction} "
        f"transmission={is_transmission} sensitive={involves_sensitive} "
        f"trust={trust_source} pre_approved={pre_approved}"
    )
    return BrowserConfirmationDecision(
        category=category,
        friction=friction,
        is_transmission=is_transmission,
        involves_sensitive_data=involves_sensitive,
        trust_source=trust_source,
        requires_confirmation=requires_confirmation,
        confirmation_detail=confirmation_detail,
        reason=reason,
    )


__all__ = [
    "FRICTION_TIERS",
    "FRICTION_HANDOFF",
    "FRICTION_ALWAYS_CONFIRM",
    "FRICTION_PRE_APPROVAL_OK",
    "FRICTION_NONE",
    "RISK_CATEGORIES",
    "SENSITIVE_DATA_CLASSES",
    "TRUST_USER_AUTHORED",
    "TRUST_THIRD_PARTY",
    "TRUST_TOOL_DIRECTIVE",
    "BrowserConfirmationDecision",
    "classify_trust_source",
    "is_ambiguous_preauthorization",
    "classify_sensitive_data",
    "classify_browser_action",
]
