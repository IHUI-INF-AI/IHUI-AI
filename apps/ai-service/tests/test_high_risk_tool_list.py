# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D143(用户 2026-09-28 批"清理+补齐"):高危内置清单必须**自洽且盖住真不可逆面**。

立因(逐条量过,不是推测):
  - 旧 16 名里有 6 个在 `_TOOLS` 注册面不存在(file_batch_edit / edit_file / create_file /
    delete_file / computer_key_type / computer_screenshot)—— 名单里的幽灵名唯一作用是把
    "表看起来盖住了这类操作"变成错觉(本仓"把没判写成判过了"同型);
  - 真不可逆的 edu 资金/外发工具(edu_create_refund / edu_approve_refund / edu_reject_refund /
    edu_create_payment_record / edu_send_fee_reminder / edu_send_fee_reminder_batch)不在表内;
  - 任意出网取数 fetch_url 也不在表内(票面写的 api_endpoint_call 是幻影 —— 注册表 0 命中,
    已记入 V4 §十一 勘误表,勿再引用)。
"""

from __future__ import annotations

import importlib


def _load():
    # 延迟导入:模块导入顺序不影响判定
    mcp = importlib.import_module("app.services.mcp_server")
    loop = importlib.import_module("app.services.agent_loop_v2")
    return mcp, loop


def _registered_names(mcp) -> set[str]:
    return {t.name for t in mcp._TOOLS}


def test_高危表内每个名字都必须在工具注册面存在():
    """名单里出现注册表没有的名字 ⇒ 幽灵名。它不拦截任何调用,只制造"已覆盖"的错觉。"""
    mcp, loop = _load()
    registered = _registered_names(mcp)
    ghosts = sorted(
        n for n in loop._DEFAULT_HIGH_RISK_TOOLS
        if not n.startswith(loop._HIGH_RISK_PREFIXES) and n not in registered
    )
    assert ghosts == [], (
        f"内置高危表里有 {len(ghosts)} 个注册表不存在的幽灵名(注册面共 {len(registered)} 名): {ghosts}\n"
        f"修法只有两条:改成本名,或确属不存在就删 —— 不得留着制造覆盖错觉"
    )


def test_资金不可逆与对外发信必须判高危():
    """退款/记账/批量催缴是动账与外发,漏标等于把不可逆操作放进免审批通道。"""
    _, loop = _load()
    must = [
        "edu_create_refund",
        "edu_approve_refund",
        "edu_reject_refund",
        "edu_create_payment_record",
        "edu_send_fee_reminder",
        "edu_send_fee_reminder_batch",
    ]
    missing = [n for n in must if not loop._matches_high_risk_name(n)]
    assert missing == [], f"资金/外发工具未判高危: {missing}"


def test_任意出网取数必须判高危():
    """fetch_url 是注册面真实存在的任意 URL 取数工具(审批按参数预览自决的前提是先拦下来)。"""
    _, loop = _load()
    assert loop._matches_high_risk_name("fetch_url"), (
        "fetch_url 未判高危 —— 任意出网取数必须先进审批门;票面的 api_endpoint_call 是幻影名,别按它改"
    )


def test_幽灵名被清后等价真名仍在():
    """清掉 computer_key_type / computer_screenshot 后,真身必须仍被 computer_ 前缀覆盖。"""
    _, loop = _load()
    for n in ("computer_keyboard_type", "computer_screenshot_screen"):
        assert loop._matches_high_risk_name(n), f"{n} 应被 computer_ 前缀判高危"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
