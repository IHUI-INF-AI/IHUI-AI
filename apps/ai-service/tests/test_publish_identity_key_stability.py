# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""反风控身份键唯一出口 `resolve_account_id` 的回归锁。

立论(用户实测症状「刷新 token 没几次就风控我」):身份键决定画像目录名 + 由它派生的
UA/视口/地理位置/Canvas 种子 + device_graph 绑定归属。旧实现是 `md5(首个凭证值)`,而
`cookie_refresh_daemon.refresh_single` 会把平台轮换后的新 cookie 值**写回凭证**(其注释原文:
"平台在访问时可能轮换 cookie 值(如 z_c0)")⇒ 每次保活/刷新都让账号换一张脸,旧脸仍留在
图谱里与新生共用同一出口 IP ⇒ 联动判定 100/100 ⇒ 自动冷却 1h。

所以本文件判的不是"键算得对不对",而是**"凭证值轮换后键必须不动"**这条不变量。
"""

from __future__ import annotations

import pathlib
import re

from app.services.publish.anti_risk.account_identity import resolve_account_id


def test_rotated_credentials_keep_same_key_when_db_id_given() -> None:
    """核心不变量:传了行 id 时,凭证里任何值怎么轮换,键都不变。"""
    before = {"z_c0": "old-value", "_xsrf": "a", "d_c0": "x"}
    after = {"z_c0": "rotated-by-platform", "_xsrf": "b", "d_c0": "y", "new_cookie": "added"}
    assert resolve_account_id("zhihu", before, 5) == "zhihu_db5"
    assert resolve_account_id("zhihu", after, 5) == "zhihu_db5", "轮换后换脸就是本 bug 本体"


def test_db_id_wins_over_stable_field_and_accepts_int_or_str() -> None:
    """行 id 优先于凭证内任何字段;int 与 str 形态同键(两处传入类型不一致也不许分叉)。"""
    creds = {"UserName": "lichunchuan1", "account_id": "whatever"}
    assert resolve_account_id("csdn", creds, 12) == "csdn_db12"
    assert resolve_account_id("csdn", creds, "12") == "csdn_db12"


def test_distinct_accounts_get_distinct_keys() -> None:
    assert resolve_account_id("juejin", {"sessionid": "s"}, 13) != resolve_account_id(
        "juejin", {"sessionid": "s"}, 14
    )


def test_stable_identity_field_survives_cookie_rotation_without_db_id() -> None:
    """没传行 id 时退化到「不轮换的身份字段」,且其它 cookie 轮换不影响键。"""
    a = {"UserName": "lichunchuan1", "UserToken": "token-1"}
    b = {"UserName": "lichunchuan1", "UserToken": "token-2-rotated"}
    assert resolve_account_id("csdn", a) == resolve_account_id("csdn", b)


def test_legacy_fallback_is_used_and_loudly_warned() -> None:
    """兜底档必须**喊出来**:静默换脸才是这一型难归因的原因。

    键形态含 `legacy-`,便于从图谱/目录名一眼看出该号缺稳定锚点。
    注意本仓日志是 structlog,`get_logger` 返回的不是 stdlib Logger —— 挂
    `logging.Handler` 只会静默收到 0 条,从而把"有告警"误判成"没告警";
    所以取证必须用 structlog 自己的 capture_logs。
    """
    from structlog.testing import capture_logs

    with capture_logs() as events:
        key = resolve_account_id("zhihu", {"z_c0": "only-rotating-thing"})
    assert key.startswith("zhihu_legacy-")
    warns = [e for e in events if e.get("log_level") == "warning"]
    assert warns, f"兜底档没有任何 warning 事件: {events}"
    assert any(
        "换脸" in str(e.get("event")) + str(e.get("warn") or "") or "换脸" in str(e) for e in warns
    ), "兜底档不告警 = 本 bug 回到静默形态"


def test_legacy_key_changes_when_credentials_rotate() -> None:
    """反向对照:兜底档**确实**会随轮换漂移 —— 证明上一条测的是行为而不是恒等式。"""
    from structlog.testing import capture_logs

    with capture_logs():
        k1 = resolve_account_id("zhihu", {"z_c0": "v1"})
        k2 = resolve_account_id("zhihu", {"z_c0": "v2"})
    assert k1 != k2


def test_no_second_implementation_left_in_publish_package() -> None:
    """禁止第二份真相:发布包内不得再出现"首个凭证值哈希"这种键算法。

    判源码文本而非行为,因为这类漂移的表现是"某平台的键又开始轮换",
    而那时没有任何行为断言会红(与本仓守门 70/76/81 同型教训)。
    """
    root = pathlib.Path(__file__).resolve().parents[1] / "app" / "services" / "publish"
    bad = re.compile(r"md5\(str\(first")
    offenders = [
        py.name
        for py in root.rglob("*.py")
        if py.name != "account_identity.py" and bad.search(py.read_text(encoding="utf-8"))
    ]
    assert not offenders, f"这些文件又自己算身份键了: {offenders}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
