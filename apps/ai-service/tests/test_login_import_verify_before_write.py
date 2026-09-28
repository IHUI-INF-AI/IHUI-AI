# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""登录态导入路径的「先验后写」回归锁(2026-09-27 立)。

立因是当轮一次**真实破坏**:按旧顺序跑 `detect_login_from_profile` 恢复 CSDN 登录态,
它先把用户 Chrome 里那份**已过期**的 cookie 集 upsert 进 `publish_accounts` id=12,
把人手里那份仍可连通(`verify=True / 'connected as lichunchuan1'`)的 38 字段密文换成
11 字段失效集(新集还少了 `UserSecret`),而账面写的是 `'扫码登录成功'`。
**密文无备份 ⇒ 不可回滚** —— 这不是"探测没成功",是探测把可用状态毁掉了。

所以本文件锁两件事:
1. 裁决函数 `should_overwrite_existing_credentials` 的语义(已有凭据 ⇒ 未验过不覆盖);
2. 两个生产者(画像导入 / 粘贴导入)必须**先 verify 再决定写不写**,且不得再硬写 `'扫码登录成功'`。
"""

from __future__ import annotations

import pathlib
import re

from app.services.scan_login import should_overwrite_existing_credentials as decide

PUBLISH_DIR = pathlib.Path(__file__).resolve().parents[1] / "app"


def test_decision_table() -> None:
    """五格判完:没有凭据时失败也照落(净新增,毁不掉东西);有凭据时**只有"验过且通过"才授权覆盖**。

    `None`(判不出:无适配器 / Playwright 没装 / 校验自身抛异常)与 `False`(已证伪)
    都**不**授权 —— 机器状态不是用户凭据的证据,拿"工具坏了"去毁用户的登录态是反的。
    """
    assert decide(existing=False, verified=False) is True, "首建失败也要落,否则用户永远导不进"
    assert decide(existing=False, verified=None) is True
    assert decide(existing=False, verified=True) is True
    assert decide(existing=True, verified=True) is True, "验过的候选覆盖旧值正是重登录的语义"
    assert decide(existing=True, verified=False) is False, "把可用凭据换成已证伪的集合 = 破坏"
    assert decide(existing=True, verified=None) is False, "判不出 ≠ 可以覆盖(依赖坏了不许毁数据)"


def test_profile_import_verifies_before_writing() -> None:
    """源码锁:画像导入必须走"先 verify → 再裁决 → 才 upsert",且顺序不可倒。"""
    src = (PUBLISH_DIR / "services/scan_login.py").read_text(encoding="utf-8")
    body = src[src.index("async def detect_login_from_profile") :]
    i_verify = body.index("verify_login_candidate(")
    i_decide = body.index("should_overwrite_existing_credentials(")
    i_save = body.index("_save_account_to_db(")
    assert i_verify < i_decide < i_save, "顺序倒回来就是本次事故本体(先覆盖后验证)"
    assert "existing_kept" in body, "拒绝覆盖时必须在返回体里明写'原凭据保留',否则用户以为已更新"


def test_paste_import_verifies_before_writing() -> None:
    """源码锁:粘贴口同型(它最容易产出"名字齐但值已过期"的集合)。"""
    src = (PUBLISH_DIR / "routers/scan_login.py").read_text(encoding="utf-8")
    i_verify = src.index("verify_login_candidate(\n        body.platform")
    i_decide = src.index("should_overwrite_existing_credentials(")
    i_save = src.index("_save_account_to_db(\n        user_id, body.platform")
    assert i_verify < i_decide < i_save


def test_row_id_is_passed_into_the_verification_call() -> None:
    """校验必须拿到**行 id**当身份锚点 —— 不拿就退到「凭证首个值哈希」，
    而那正是"每次刷新换一张脸"的成因(见 anti_risk/account_identity.py)。

    两条路径各断一次:只在一处注入的修法会留下另一半(本仓最高频失效型)。
    """
    svc = (PUBLISH_DIR / "services/scan_login.py").read_text(encoding="utf-8")
    router = (PUBLISH_DIR / "routers/scan_login.py").read_text(encoding="utf-8")
    for label, src in (("画像导入", svc[svc.index("async def detect_login_from_profile") :]), ("粘贴导入", router)):
        at = src.index("verify_login_candidate(")
        # 取"调用起点之后一段"而不是"到第一个 ) 为止" —— 实参里就有 .get("id")，
        # 按第一个右括号切会把判据要看的字面量 itself 切掉(本仓踩过:判据切在自己的括号上)。
        call = src[at : at + 220]
        assert '.get("id")' in call, f"{label}的校验调用没把行 id 传进去:{call[:160]}"
        assert "existing_row" in src[:at], (
            f"{label}必须先取行、再喂校验:查两遍就是在两把尺子之间留竞态窗口"
        )


def test_both_paths_share_one_verify_implementation() -> None:
    """两条路径必须调**同一个**校验出口:各自 `get_adapter().verify_credentials()` 就是第二份实现。"""
    svc = (PUBLISH_DIR / "services/scan_login.py").read_text(encoding="utf-8")
    router = (PUBLISH_DIR / "routers/scan_login.py").read_text(encoding="utf-8")
    profile_body = svc[svc.index("async def detect_login_from_profile") :]
    assert "adapter.verify_credentials(" not in profile_body, "画像导入不得自己拼校验"
    assert "adapter.verify_credentials(" not in router, "粘贴导入不得自己拼校验"
    assert svc.count("async def verify_login_candidate(") == 1


def test_no_hardcoded_success_message_left_at_write_sites() -> None:
    """写库调用不得再无条件带上那句"扫码登录成功"。

    唯一允许的默认值住在 `_save_account_to_db` 的签名里(扫码/CDP 两条真扫码成功路径复用),
    两条**非扫码**导入路径必须显式传 `verify_msg` —— 否则账面又是"成功"而 verify 红。
    """
    svc = (PUBLISH_DIR / "services/scan_login.py").read_text(encoding="utf-8")
    router = (PUBLISH_DIR / "routers/scan_login.py").read_text(encoding="utf-8")
    assert "verify_msg: str = \"扫码登录成功\"" in svc, "默认值应在唯一写出口签名里,一处而已"
    assert svc.count('last_verify_msg=\'扫码登录成功\'') == 0, "SQL 里不得再写死那句"
    # 画像导入与粘贴导入两处调用都必须带 verify_msg=
    calls = re.findall(r"_save_account_to_db\((?:[^()]|\([^()]*\))*\)", router, flags=re.S)
    assert calls and all("verify_msg=" in c for c in calls), f"粘贴口有调用没带真实结论: {calls}"


def test_decision_helper_is_the_only_callee() -> None:
    """两条路径共用**一个**裁决点:禁止各写一份 if(那必然漂移)。"""
    svc = (PUBLISH_DIR / "services/scan_login.py").read_text(encoding="utf-8")
    router = (PUBLISH_DIR / "routers/scan_login.py").read_text(encoding="utf-8")
    assert svc.count("def should_overwrite_existing_credentials(") == 1
    assert router.count("should_overwrite_existing_credentials(") == 1, "路由里只调用,不再实现一遍"
