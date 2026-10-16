# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""展示名派生与存量自愈测试(2026-10-16 李总定档:手机 > 邮箱 > 账户名 > 用户名)。

背景:手机优先定档(645789cdbed)之前的旧捕获把 UUID 编码存进 name,存量账号
不会重新捕获 ⇒ 名字永不变好。服务端在 list_accounts 链路按优先级从 JWT
claims(+ device_map.nickname 兜底)重取名并落库。

覆盖:
- extract_display_name:四平台 claim 形态、优先级、UUID 值跳过、兜底、None;
- uuid_shaped_name:各旧编码形态判定;
- _heal_uuid_names:命中即修/好名不动/取不到静默(monkeypatch,不连 PG)。
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any

import pytest

from app.services import checkin_store
from app.services.checkin_engine import extract_display_name, uuid_shaped_name


def _b64(obj: Any) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode("utf-8")).decode().rstrip("=")


def make_jwt(payload: dict[str, Any]) -> str:
    return f"{_b64({'alg': 'none'})}.{_b64(payload)}.sig"


def _future_exp() -> int:
    return int(time.time()) + 86400


# ---------------------------------------------------------------------------
# extract_display_name
# ---------------------------------------------------------------------------


class TestExtractDisplayName:
    def test_trae_top_level_phone(self):
        """TRAE JWT payload 顶层 phone(桌面端实证字段)。"""
        jwt = make_jwt({"phone": "18643389808", "sub": "uid-x", "exp": _future_exp()})
        assert extract_display_name(jwt) == "18643389808"

    def test_trae_nested_data_phone(self):
        """TRAE 偶发把身份嵌 data 里。"""
        jwt = make_jwt({"data": {"phone": "13900000000", "id": "u1"}, "exp": _future_exp()})
        assert extract_display_name(jwt) == "13900000000"

    def test_keycloak_email(self):
        """WorkBuddy/Qoder 的 Keycloak 风格 JWT:email。"""
        jwt = make_jwt({"sub": "uid", "email": "a@aizhs.top", "exp": _future_exp()})
        assert extract_display_name(jwt) == "a@aizhs.top"

    def test_phone_beats_email(self):
        """手机 > 邮箱:两者都在时取手机。"""
        jwt = make_jwt({"email": "a@aizhs.top", "phone": "18643389808", "exp": _future_exp()})
        assert extract_display_name(jwt) == "18643389808"

    def test_username_beats_nickname(self):
        """账户名 > 用户名:username 与 nickname 并存时取 username。"""
        jwt = make_jwt(
            {"nickname": "智汇AI", "username": "lichunchuan", "exp": _future_exp()}
        )
        assert extract_display_name(jwt) == "lichunchuan"

    def test_nickname_when_no_higher_priority(self):
        jwt = make_jwt({"nickname": "智汇AI", "exp": _future_exp()})
        assert extract_display_name(jwt) == "智汇AI"

    def test_uuid_valued_claim_skipped(self):
        """claim 值是 UUID 形态 ⇒ 那不是展示名,继续往低优先级找。"""
        jwt = make_jwt(
            {"phone": "019f17c6-0eca-7510-a4f5-5b22e8305ed4", "nickname": "智汇AI"}
        )
        assert extract_display_name(jwt) == "智汇AI"

    def test_device_map_nickname_fallback(self):
        """非 JWT(cookie 串)⇒ device_map.nickname 兜底。"""
        assert extract_display_name("cookie-string-not-jwt", {"nickname": "网页账号"}) == "网页账号"

    def test_device_map_account_phone_highest(self):
        """device_map.account(tc 捕获落库的完整 profile)⇒ 手机号优先。

        TRAE JWT payload 只有 data.id 无身份字段,手机号只能从这里取(2026-10-16 李总报障)。
        """
        dm = {
            "account": {"username": "智汇AI", "email": "a@aizhs.top", "phone": "18643389808"},
            "nickname": "智汇AI",
        }
        assert extract_display_name("not-a-jwt", dm) == "18643389808"

    def test_device_map_account_beats_jwt_payload(self):
        """account 与 JWT payload 都有时,account(捕获侧真值)优先。"""
        jwt = make_jwt({"email": "jwt@aizhs.top"})
        dm = {"account": {"phone": "18643389808"}}
        assert extract_display_name(jwt, dm) == "18643389808"

    def test_device_map_account_username_only(self):
        """account 无手机/邮箱时取账户名。"""
        dm = {"account": {"username": "lichunchuan", "nickname": "智汇AI"}}
        assert extract_display_name("not-a-jwt", dm) == "lichunchuan"

    def test_device_map_nickname_uuid_skipped(self):
        """兜底值是 UUID 也不给(返回 None,调用方保持原名)。"""
        jwt = "cookie-string"
        dm = {"nickname": "14f939c3-889b-4ea2-88b7-ca4582f3b435"}
        assert extract_display_name(jwt, dm) is None

    def test_none_when_nothing_usable(self):
        assert extract_display_name("") is None
        assert extract_display_name("not.a.jwt") is None
        assert extract_display_name("not.a.jwt", {}) is None

    def test_opaque_token_returns_none(self):
        """Qoder 现役 token 是 opaque 非 JWT(真机实证)⇒ None,保持原状。"""
        assert extract_display_name("opaque_token_abc123") is None
        assert extract_display_name("opaque_token_abc123", {"uid": "u1"}) is None


# ---------------------------------------------------------------------------
# uuid_shaped_name
# ---------------------------------------------------------------------------


class TestUuidShapedName:
    @pytest.mark.parametrize(
        "name",
        [
            "14f939c3-889b-4ea2-88b7-ca4582f3b435",
            "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4",
            "WorkBuddy-14f939c3-889b-4ea2-88b7-ca4582f3b435",
            "本机-14f939c3-889b-4ea2-88b7-ca4582f3b435",
            "Qoder-pro-019f17c6-0eca-7510-a4f5-5b22e8305ed4",
        ],
    )
    def test_uuid_shaped(self, name):
        assert uuid_shaped_name(name) is True

    @pytest.mark.parametrize(
        "name",
        ["18643389808", "a@aizhs.top", "智汇AI", "主账号", "", None, "Qoder-本机"],
    )
    def test_not_uuid_shaped(self, name):
        assert uuid_shaped_name(name) is False


# ---------------------------------------------------------------------------
# _heal_uuid_names(monkeypatch,不连 PG)
# ---------------------------------------------------------------------------


class TestHealUuidNames:
    @pytest.fixture
    def heal_env(self, monkeypatch):
        """假 _decrypt_jwt + 假 update_account_name,捕获得到的名字。"""
        state: dict[str, Any] = {"decrypted": {}, "renamed": []}

        def fake_decrypt(blob):
            return state["decrypted"].get(blob, "")

        async def fake_update(account_id, owner, name):
            state["renamed"].append((account_id, name))
            return True

        monkeypatch.setattr(checkin_store, "_decrypt_jwt", fake_decrypt)
        monkeypatch.setattr(checkin_store, "update_account_name", fake_update)
        return state

    async def test_uuid_name_gets_healed(self, heal_env):
        heal_env["decrypted"]["enc1"] = make_jwt({"phone": "18643389808"})
        rows = [{"id": 7, "jwt_enc": "enc1"}]
        accounts = [{"id": 7, "name": "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4", "device_map": {}}]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "18643389808"
        assert heal_env["renamed"] == [(7, "18643389808")]

    async def test_good_name_untouched(self, heal_env):
        heal_env["decrypted"]["enc1"] = make_jwt({"phone": "18643389808"})
        rows = [{"id": 7, "jwt_enc": "enc1"}]
        accounts = [{"id": 7, "name": "智汇AI", "device_map": {}}]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "智汇AI"
        assert heal_env["renamed"] == []

    async def test_unparseable_token_silent(self, heal_env):
        """opaque token 解不出 ⇒ 静默保持原名,不改写不报错。"""
        heal_env["decrypted"]["enc1"] = "opaque_token"
        rows = [{"id": 7, "jwt_enc": "enc1"}]
        accounts = [{"id": 7, "name": "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4", "device_map": {}}]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4"
        assert heal_env["renamed"] == []

    async def test_web_cookie_mode_nickname_fallback(self, heal_env):
        """网页 Cookie 模式:jwt 非 JWT,device_map.nickname 兜底自愈。"""
        heal_env["decrypted"]["enc1"] = "cookie=abc; token=def"
        rows = [{"id": 9, "jwt_enc": "enc1"}]
        accounts = [
            {
                "id": 9,
                "name": "14f939c3-889b-4ea2-88b7-ca4582f3b435",
                "device_map": {"login_type": "web", "uid": "14f939c3-889b-4ea2-88b7-ca4582f3b435", "nickname": "李总WorkBuddy"},
            }
        ]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "李总WorkBuddy"
        assert heal_env["renamed"] == [(9, "李总WorkBuddy")]

    async def test_update_miss_keeps_row_name(self, heal_env, monkeypatch):
        """update 未命中行(并发删号等)⇒ 不回写内存名。"""

        async def fake_update_miss(account_id, owner, name):
            return False

        monkeypatch.setattr(checkin_store, "update_account_name", fake_update_miss)
        heal_env["decrypted"]["enc1"] = make_jwt({"phone": "18643389808"})
        rows = [{"id": 7, "jwt_enc": "enc1"}]
        accounts = [{"id": 7, "name": "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4", "device_map": {}}]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4"

    async def test_bad_ciphertext_does_not_break_list(self, heal_env, monkeypatch):
        """跨机密钥遗留的坏密文:单账号解密失败必须跳过,不打挂整表(2026-10-16 加固)。

        实测生产存在此形态(A 机加密写库、B 机解密读库,密钥不一致)。若这里抛异常,
        GET /accounts 会 500、整页签到不可用。
        """
        def fake_decrypt_raises(blob):
            raise ValueError("JWT 密文解密失败(密钥不匹配或密文损坏)")

        monkeypatch.setattr(checkin_store, "_decrypt_jwt", fake_decrypt_raises)
        rows = [{"id": 3, "jwt_enc": "bad1"}, {"id": 4, "jwt_enc": "bad2"}]
        accounts = [
            {"id": 3, "name": "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4", "device_map": {}},
            {"id": 4, "name": "14f939c3-889b-4ea2-88b7-ca4582f3b435", "device_map": {}},
        ]
        # 不抛异常即通过(坏密文账号保持原名,其余账号照常返回)
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"].startswith("Qoder-")
        assert accounts[1]["name"].startswith("14f939c3")

    async def test_heal_db_error_swallowed(self, heal_env, monkeypatch):
        """自愈落库失败(DB 抖动)不得反噬列表读取。"""
        heal_env["decrypted"]["enc1"] = make_jwt({"phone": "18643389808"})

        async def fake_update_raises(account_id, owner, name):
            raise RuntimeError("db down")

        monkeypatch.setattr(checkin_store, "update_account_name", fake_update_raises)
        rows = [{"id": 7, "jwt_enc": "enc1"}]
        accounts = [{"id": 7, "name": "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4", "device_map": {}}]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "Qoder-019f17c6-0eca-7510-a4f5-5b22e8305ed4"

    async def test_duplicate_name_falls_back_to_platform_suffix(self, heal_env, monkeypatch):
        """同名冲突(同手机号多平台各一账号)⇒ 退化为「手机号·平台」,保可区分。

        实测生产:id=20 WorkBuddy 与 id=22 Qoder 同为 18643389808 ⇒ 唯一约束
        (owner_user_id,name) 拒写,若不退化则自愈永久卡住。
        """
        calls: list[tuple[int, str]] = []

        async def fake_update(account_id, owner, name):
            calls.append((account_id, name))
            if name == "18643389808":
                err = ValueError("duplicate key value violates unique constraint")
                err.sqlstate = "23505"  # type: ignore[attr-defined]
                raise err
            return True

        monkeypatch.setattr(checkin_store, "update_account_name", fake_update)
        heal_env["decrypted"]["enc1"] = make_jwt({"phone": "18643389808"})
        rows = [{"id": 20, "jwt_enc": "enc1"}]
        accounts = [
            {
                "id": 20,
                "name": "14f939c3-889b-4ea2-88b7-ca4582f3b435",
                "platform": "workbuddy",
                "device_map": {},
            }
        ]
        await checkin_store._heal_uuid_names("owner-1", rows, accounts)
        assert accounts[0]["name"] == "18643389808·WorkBuddy"
        assert calls == [(20, "18643389808"), (20, "18643389808·WorkBuddy")]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


def test_trae_masked_mobile_from_account():
    """TRAE account.nonPlainTextMobile = 客户端脱敏手机号("186******08")⇒ 取为展示名。

    真机实证:TRAE 本地无明文手机号,打码串即其"手机号"形态(2026-10-16 李总报障)。
    """
    dm = {
        "account": {"username": "智汇AI", "email": "", "nonPlainTextMobile": "186******08"},
        "nickname": "智汇AI",
    }
    assert extract_display_name("not-a-jwt", dm) == "186******08"
