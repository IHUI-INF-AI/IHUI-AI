# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到「今日已签到」幂等码的唯一判据(单源,2026-11-01 立)。

各平台都用各自业务码表达「今天已经签过了」(客户端/同设备先签了一步,本次是
重复请求)。这**不是失败**,是幂等成功态:不得落冷却、不得累加连击计数、
不得计入失败率。落库形状与 status 预检命中时**完全一致**
(ok=True / status="already" / action="skip_already"),即「今日已签」在系统里
只有一个形状 —— 不发明第二套语义。

码值来源(逐平台实测,非推测):
- trae      : claim 响应**顶层 code=9095**,HTTP 200,message「当前设备今日已经
              签到,请明日再来哦～」。2026-10-30/31、11-01 本机 uid
              2345730760515203 连续三日记录实证(此前被 classify_error 归为
              BusinessError ⇒ 每条红记录 + 顺带 300s 立即冷却)。
- workbuddy : daily-checkin 响应**顶层 code=10001**,**HTTP 400**,msg「今天已签到,
              请明天再来」。2026-10-17 生产实测 ⇒ 判据必须放在 HTTP>=400 之前。
- minimax   : claim 响应 **data.claim_result=2**(今日已领),2026-10-15 本机真
              token 实测。

未收录(未取证,不猜):
- qoder:领取幂等由 claimStatus=="CLAIMED"(字符串枚举,不是码值)表达,判据在
  checkin_qoder._claimable_campaigns,不经本模块。

调用方契约:只传**「已签标志位」本身**,不要传该平台的错误码 —— 例如 minimax
传 data.claim_result 而非响应顶层 code。bool 一律不算(True == 1 会误命中小码值)。
HTTP 层的信任前提由各引擎自己把关(trae 要求 2xx、workbuddy 允许 400),
本模块只回答「这枚码值是不是已签标志」。
"""

from __future__ import annotations

from typing import Any, Final

# 平台名与 checkin_accounts.platform 列取值一致
PLATFORM_TRAE: Final = "trae"
PLATFORM_WORKBUDDY: Final = "workbuddy"
PLATFORM_MINIMAX: Final = "minimax"

# 平台 → 「今日已签到」标志位取值集合(唯一真源,引擎侧不得再直写码值)
ALREADY_CHECKED_IN_CODES: Final[dict[str, frozenset[int]]] = {
    PLATFORM_TRAE: frozenset({9095}),
    PLATFORM_WORKBUDDY: frozenset({10001}),
    PLATFORM_MINIMAX: frozenset({2}),
}


def is_already_checked_in(platform: str, marker: Any) -> bool:
    """``marker`` 是否表示该平台「今日已签到」(幂等成功态)。

    只认 int(排除 bool);未登记的平台/类型一律 False —— 判不了就是判不了,
    绝不把未知码当已签。
    """
    if isinstance(marker, bool) or not isinstance(marker, int):
        return False
    return marker in ALREADY_CHECKED_IN_CODES.get(platform, frozenset())
