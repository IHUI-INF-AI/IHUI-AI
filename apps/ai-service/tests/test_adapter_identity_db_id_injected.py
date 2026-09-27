# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌‌

"""「拿到适配器就必须注入行 id」的源码面锁(2026-09-27 立)。

背景:反风控身份键的唯一出口是 `anti_risk/account_identity.resolve_account_id(platform, credentials,
db_account_id)`。传了行 id ⇒ 键**永不**随 Cookie 轮换而变;没传 ⇒ 退到"凭证里第一个值的哈希",
而平台每次访问都可能轮换 Cookie、`cookie_refresh_daemon` 还会把新值写回凭证 ⇒ **每次保活都换一张脸**,
新旧脸共用同一出口 IP,联动判定打满 ⇒ 用户症状「刷新 token 没几次就风控我」。

今天已把适配器内部全部改成走唯一出口,但本仓最高频的失效型不是"算法错",而是
**"唯一出口存在,某些调用点根本没喂它参数"** —— 实测 `get_adapter()` 有 6 个生产落点,
只有 2 处注入 `db_account_id`(调度器与账号级 verify)。其余在 `account_groups` 的
**批量发布 / 批量验证** 里:循环把全部 active 账号连着验一遍,每个账号都是新脸 —— 比单账号更危险。
画像目录里现存的 `*_legacy-*` 就是这类没注入的路径产出的。

所以本文件不做行为断言,做**结构断言**:任何 `get_adapter(...)` 之后、在同一段代码里调用
了"会用身份键的方法"(publish / verify_credentials / …)之前,必须出现 `db_account_id =`。
只做存在性正向检查 ⇒ 判据不会因为"某个文件恰好没用到"而误红,也不会因为注释而假绿(先剥注释)。
"""

from __future__ import annotations

import pathlib
import re

APP = pathlib.Path(__file__).resolve().parents[1] / "app"

#: 会消费身份键的适配器方法(这些方法内部会走 account_identity → 起浏览器 → 落画像目录)
CONSUMING = re.compile(
    r"\.publish\(|\.verify_credentials\(|\.check_login\(|\.collect_metrics\(|\.verify_published\("
)
#: 取适配器实例
GET_ADAPTER = re.compile(r"get_adapter\(")
#: 注入行 id(必须出现在取适配器与消费之间)
INJECT = re.compile(r"\.db_account_id\s*=")

#: 从 get_adapter 到消费点之间最多看这么多行(跨函数不追,那是另一票)
WINDOW = 22


def _strip_comments(text: str) -> str:
    """只剥整行注释,不剥字符串(本判据的三个标识符都可能出现在字符串/正则里,但不会在字符串里被执行)。"""
    return "\n".join("" if ln.lstrip().startswith("#") else ln for ln in text.splitlines())


def find_uninjected_sites() -> list[str]:
    offenders: list[str] = []
    for py in sorted(APP.rglob("*.py")):
        if py.name == "base_adapter.py":
            continue  # get_adapter 的定义处
        lines = _strip_comments(py.read_text(encoding="utf-8")).splitlines()
        for i, line in enumerate(lines):
            if not GET_ADAPTER.search(line):
                continue
            window = lines[i + 1 : i + 1 + WINDOW]
            for off, nxt in enumerate(window):
                if CONSUMING.search(nxt):
                    if not any(INJECT.search(w) for w in window[:off]):
                        rel = py.relative_to(APP.parent)
                        offenders.append(f"{rel}:{i + 1} → 消费点 {nxt.strip()[:60]}")
                    break
    return offenders


def test_every_consuming_adapter_site_injects_db_account_id() -> None:
    offenders = find_uninjected_sites()
    assert not offenders, "这些落点取到适配器后直接消费身份键却没注入行 id:\n" + "\n".join(offenders)


def test_scanned_surface_is_not_empty() -> None:
    """零候选 = 判据失明,不是通过(本仓反复登记的失效型)。"""
    files = [p for p in APP.rglob("*.py") if p.name != "base_adapter.py"]
    assert files, "app/ 下一个 .py 都没扫到"
    # 数**出现次数**而不是"几个文件含该词" —— 按文件数会低估:同一文件里多个落点
    # (account_groups.py 一个文件就有 3 处)会被算成 1,阈值就永远追不上现实。
    occurrences = sum(
        len(GET_ADAPTER.findall(_strip_comments(p.read_text(encoding="utf-8")))) for p in files
    )
    assert occurrences >= 6, (
        f"只扫到 {occurrences} 处 get_adapter 调用,低于实测生产落点数(6)⇒ 本锁对新落点已失明"
    )


def test_positive_control_the_predicate_actually_fires() -> None:
    """判据必须能命中"没注入"那一型:用真文本构造一个删掉注入行的样本。"""
    sample = "\n".join(
        [
            "                adapter = get_adapter(row['platform'])",
            "                if adapter is None:",
            "                    continue",
            "                ok, msg = await adapter.verify_credentials(credentials)",
        ]
    )
    lines = _strip_comments(sample).splitlines()
    got = GET_ADAPTER.search(lines[0])
    assert got, "夹具第一行必须被识别为取适配器"
    window = lines[1:]
    consumed_at = next((i for i, l in enumerate(window) if CONSUMING.search(l)), None)
    assert consumed_at is not None, "消费点必须被识别"
    assert not any(INJECT.search(w) for w in window[:consumed_at]), "没注入的样本必须判红"

    # 反向对照:同一夹具加上注入行 ⇒ 判绿(否则本锁会咬掉所有正当写法)
    fixed = "\n".join(
        [
            "                adapter = get_adapter(row['platform'])",
            "                if adapter is None:",
            "                    continue",
            "                adapter.db_account_id = r['id']",
            "                ok, msg = await adapter.verify_credentials(credentials)",
        ]
    )
    flines = _strip_comments(fixed).splitlines()
    fwindow = flines[1:]
    fat = next(i for i, l in enumerate(fwindow) if CONSUMING.search(l))
    assert any(INJECT.search(w) for w in fwindow[:fat]), "注入了行 id 的正当写法不得判红"
