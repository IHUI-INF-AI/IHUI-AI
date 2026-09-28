# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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


def test_detection_key_and_registration_key_share_one_source() -> None:
    """调度器的联动检测键 必须与 browser_factory 登记绑定用的键**逐字同形**。

    此前一处传数据库行 id(`"12"`)、一处传适配器派生键(`csdn_db12`)⇒ 两个键空间永不相交,
    联动检测对被检账号永远查不到它自己的绑定,这道防护在正常发布路径上等于没生效。
    行 id 已是稳定锚点,所以"带不带凭证"都该算出同一个键 —— 这条就是那两个调用点的公共地基。
    """
    for platform in ("csdn", "zhihu", "juejin", "xiaohongshu"):
        assert resolve_account_id(platform, {"UserName": "whoever"}, 12) == resolve_account_id(
            platform, {}, 12
        ), f"{platform}: 检测键与登记键不同源 = 联动判定形同虚设"


def test_scheduler_uses_identity_key_for_linkage_check() -> None:
    """源码锁:调度器不得再把行 id 字符串直接喂给联动检测(那是上面那条分裂的另一半)。

    2026-09-27 改写法时同步改锁(否则就是"改了被审代码没改审它的正则"那一型 —— 锁会恒红，
    而下一个人只会把锁削掉)：判据从"整串字面量等值"换成"第一个实参必须是 identity_key"，
    因为调用现在多带了一个 `owner_of=` 归属解析器。两条负向断言一字未松。
    """
    root = pathlib.Path(__file__).resolve().parents[1] / "app" / "services" / "publish"
    src = (root / "scheduler.py").read_text(encoding="utf-8")
    assert re.search(r"async_check_device_linkage\(\s*identity_key\b", src), (
        "联动检测的首个实参必须是同源算出的 identity_key"
    )
    assert "async_check_device_linkage(account_id_str)" not in src
    assert "async_check_device_linkage(account_id_str," not in src
    # 归属作用域是这条链的承重墙：摘掉它，"一个人运营十几个平台账号"会重新每次发布自我冷却 1h
    assert re.search(r"async_check_device_linkage\(\s*identity_key\s*,\s*owner_of=", src), (
        "调度器必须把归属解析器传给联动检测"
    )


#: 两类"自己算身份键"的形状。第一类是本次修的 `md5(首个凭证值)`;
#: 第二类是 2026-09-27 复扫时新抓到的 `account_id=f"{self.platform_id}_{credentials.get(...)}"`
#: —— 旧锁只写了第一类的字面量,所以第二型(haokan 两处)一路绿灯进来,
#: 且它的 `'default'` 兜底会让**所有没填 account_id 的该号共用同一张脸**(跨号联动)。
SECOND_SOURCE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "首个凭证值哈希",
        re.compile(r"md5\(str\(first"),
    ),
    (
        "把平台 id 与凭证值内联拼成键",
        re.compile("""account_id\\s*=\\s*f["'][^"']*\\{[^}]*platform_id"""),
    ),
)


def test_second_source_patterns_have_positive_proof() -> None:
    """每条模式必须命中自己那一型的真实旧文本 —— 否则模式可以是张死表而本锁一路报绿。

    这是本仓反复登记的失效型:名单驱动的反残留锁只做反向证明(拦到坏值才红),
    从没证明名单里某一条真能命中。
    """
    samples = {
        "首个凭证值哈希": '        return f"{self.platform_id}_{hashlib.md5(str(first).encode()).hexdigest()[:16]}"',
        "把平台 id 与凭证值内联拼成键": '                    account_id=f"{self.platform_id}_{credentials.get(\'account_id\', \'default\')}",',
    }
    for name, pattern in SECOND_SOURCE_PATTERNS:
        assert pattern.search(samples[name]), f"模式「{name}」命中不了它自己那一型 = 死表"
    # 合法形态不得被误伤(否则守门会把"委托唯一出口"也判成违规,逼人删锁)
    for legit in (
        "                    account_id=self.account_identity(credentials),",
        "                account_id=account_id,",
    ):
        for name, pattern in SECOND_SOURCE_PATTERNS:
            assert not pattern.search(legit), f"模式「{name}」误伤了合法形态: {legit}"
    # 只拼平台 id(不拼凭证)同样必须被拦:那会让**同一平台所有账号共用一张脸**,
    # 与 haokan 那个 `'default'` 兜底是同一个失效面,不是"至少不含凭证"的豁免理由。
    assert SECOND_SOURCE_PATTERNS[1][1].search('account_id=f"{self.platform_id}",'), (
        "整平台共用一键的形态不得放过"
    )


def test_no_second_implementation_left_in_publish_package() -> None:
    """禁止第二份真相:发布包内不得再出现自己算身份键的实现(两类形状同锁)。

    判源码文本而非行为,因为这类漂移的表现是"某平台的键又开始轮换",
    而那时没有任何行为断言会红(与本仓守门 70/76/81 同型教训)。
    """
    root = pathlib.Path(__file__).resolve().parents[1] / "app" / "services" / "publish"
    scanned = [py for py in root.rglob("*.py") if py.name != "account_identity.py"]
    assert scanned, "一个 .py 都没扫到 = 判据失明,不是通过"
    offenders = [
        f"{py.name}: {name}"
        for py in scanned
        for name, pattern in SECOND_SOURCE_PATTERNS
        if pattern.search(py.read_text(encoding="utf-8"))
    ]
    assert not offenders, f"这些文件又自己算身份键了: {offenders}"
