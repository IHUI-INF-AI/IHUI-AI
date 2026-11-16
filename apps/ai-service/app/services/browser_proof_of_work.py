# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""改状态动作的截图内嵌交付闸 — 复现 Codex 26.1111 proof-of-work 行为规范。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-browser-capability-spec.md`` §4.3
api-use-behavior(明文逐字直读 ``tab/api-use-behavior.md``)::

    "Proof of work":完成改变网站状态的动作后,截图必须内嵌进回复
    (Markdown 图片语法),"只贴在工具输出里不算"——面向用户的可验证交付闸。

对照 IHUI 缺口
--------------
- ``screenshot_service`` 只管 SSRF 守卫 + 截图生成,**没有"改状态后必须内嵌截图"
  的交付验收闸**;
- 截图可能只出现在工具输出/结构化结果里,用户在可见回复里看不到 ⇒ 不可验证。

设计要点(纯函数,零 IO)
------------------------
1. **状态改变动作分类** ``is_state_changing_action``:提交表单/发消息/发评论/
   购买/加购/点赞/关注/删改/开关设置/上传 = 改状态(须 proof-of-work);
   导航 goto/reload/滚动/截图/读取/搜索 = 读取(不须);
2. **内嵌判定** ``is_screenshot_embedded``:可见回复须含 Markdown 图片语法
   ``![](url)`` 或 HTML ``<img src>``,且指向截图 artifact —— **仅工具输出含不算**;
3. **交付闸** ``check_proof_of_work``:改状态动作 + 截图存在 + 已内嵌 = 通过;
   改状态但未内嵌 = 拒(定向说明"须内嵌进可见回复,仅工具输出不算")。

与既有层的关系
--------------
- 只做"是否须内嵌 + 是否已内嵌"判定,不生成截图(那是 ``screenshot_service``)、
  不改回复注入(那是渲染层);调用方据判定决定放行/补内嵌;
- 与 ``browser_confirmation_policy``(动作确认)、``browser_audit_trail``(改动账)
  互补:确认=动作前,审计=改动后存账,proof-of-work=交付闸。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ── 改状态动作类型(对齐 Codex "改变网站状态"语义) ───────────────────────────

STATE_CHANGING_ACTIONS: frozenset[str] = frozenset(
    {
        "form_submit",  # 提交表单
        "send_message",  # 发消息
        "post_comment",  # 发评论/发帖
        "purchase",  # 购买/结算
        "add_to_cart",  # 加购
        "like",  # 点赞/收藏
        "follow",  # 关注/订阅
        "delete",  # 删除
        "edit",  # 编辑/改
        "toggle_setting",  # 开关设置/改配置
        "upload",  # 上传(改目标站状态)
        "create",  # 新建资源(文档/仓库/记录)
        "invite",  # 邀请/授权他人
        "submit_application",  # 提交申请/订单
    }
)

# 读取类动作(明确不须 proof-of-work)
READ_ONLY_ACTIONS: frozenset[str] = frozenset(
    {
        "navigate",  # goto
        "reload",  # 刷新
        "scroll",  # 滚动
        "screenshot",  # 截图本身
        "read",  # 读取内容
        "search",  # 参数化搜索
        "snapshot",  # DOM 快照
        "history",  # 查历史
        "click_read",  # 点进查看(不改状态)
    }
)


@dataclass(frozen=True)
class ProofOfWorkDecision:
    """proof-of-work 交付闸判定(纯函数入出参)。"""

    is_state_changing: bool  # 是否改网站状态(须 proof-of-work)
    requires_embed: bool  # 是否须内嵌截图进可见回复
    is_embedded: bool  # 可见回复是否已内嵌截图
    passed: bool  # 交付闸是否通过
    detail: str  # 说明(非空)


# Markdown 图片语法:![](...) 或 ![alt](url)
_MD_IMAGE = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)")
# HTML img 标签
_HTML_IMG = re.compile(r"<img\b[^>]*\bsrc\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)


def is_state_changing_action(action: str) -> bool:
    """判定动作是否改变网站状态(改状态 ⇒ 须 proof-of-work 截图)。"""
    key = (action or "").strip().lower()
    if key in STATE_CHANGING_ACTIONS:
        return True
    if key in READ_ONLY_ACTIONS:
        return False
    # 未命中封闭集:按启发式,含"submit/post/purchase/delete/edit/upload/create"
    # 词根视作改状态(宁多判不少判 —— 失效方向是多要一张截图,不是漏验证)
    roots = ("submit", "post", "purchase", "delete", "edit", "upload", "create", "buy", "checkout")
    return any(r in key for r in roots)


def is_screenshot_embedded(*, visible_reply: str, screenshot_url: str | None) -> bool:
    """判定可见回复是否内嵌了指向该截图的图片(仅工具输出含不算)。

    可见回复须含 Markdown 图片 ``![](url)`` 或 HTML ``<img src=url>``,且 src
    指向 ``screenshot_url``(同一引用)。``screenshot_url`` 缺失即未内嵌。
    """
    if not screenshot_url or not (visible_reply or "").strip():
        return False
    needle = screenshot_url.strip()

    def _matched(pattern: re.Pattern[str]) -> bool:
        return any(m.group(1).strip() == needle for m in pattern.finditer(visible_reply))

    return _matched(_MD_IMAGE) or _matched(_HTML_IMG)


def check_proof_of_work(
    *,
    action: str,
    screenshot_url: str | None = None,
    visible_reply: str = "",
) -> ProofOfWorkDecision:
    """proof-of-work 交付闸:改状态动作须把截图内嵌进可见回复(纯函数)。

    参数:
        action: 动作类型(见 ``STATE_CHANGING_ACTIONS`` / ``READ_ONLY_ACTIONS``
            或自由文本,启发式兜底)。
        screenshot_url: 本步截图的引用 URL(artifact 地址)。
        visible_reply: 面向用户的可见回复文本(含工具输出不算)。
    """
    changing = is_state_changing_action(action)
    if not changing:
        return ProofOfWorkDecision(
            is_state_changing=False,
            requires_embed=False,
            is_embedded=False,
            passed=True,  # 读取类动作不须 proof-of-work,恒通过
            detail=f"动作 {action!r} 不改网站状态,不须 proof-of-work 截图。",
        )

    # 改状态 ⇒ 须内嵌
    if not screenshot_url:
        return ProofOfWorkDecision(
            is_state_changing=True,
            requires_embed=True,
            is_embedded=False,
            passed=False,
            detail="改状态动作须 proof-of-work 截图,但无截图引用。请先截图再交付。",
        )

    embedded = is_screenshot_embedded(visible_reply=visible_reply, screenshot_url=screenshot_url)
    if not embedded:
        return ProofOfWorkDecision(
            is_state_changing=True,
            requires_embed=True,
            is_embedded=False,
            passed=False,
            detail=(
                "改状态动作的截图只贴在工具输出里不算:须用 Markdown 图片语法"
                f" ![]({screenshot_url}) 内嵌进可见回复,面向用户可验证。"
            ),
        )
    return ProofOfWorkDecision(
        is_state_changing=True,
        requires_embed=True,
        is_embedded=True,
        passed=True,
        detail="改状态动作已把截图内嵌进可见回复,proof-of-work 通过。",
    )


__all__ = [
    "STATE_CHANGING_ACTIONS",
    "READ_ONLY_ACTIONS",
    "ProofOfWorkDecision",
    "is_state_changing_action",
    "is_screenshot_embedded",
    "check_proof_of_work",
]
