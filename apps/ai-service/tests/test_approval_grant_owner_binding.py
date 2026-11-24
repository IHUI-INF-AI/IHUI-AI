# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""D158 owner-binding:前缀放行规则主体绑定回归(修复"批准即全局放行"的越权敞口)。

敞口(提交面 0316692a31 实证):
- approval_persistence._SCHEMA_DDL 只有 scope/cache_key/kind,无主体列;
- llm.py 写入面 `_persist_grant_rule` 落 normalize_exec_key(argv前缀) 无主体;
- llm.py 命中面 `_exec_prefix_grant_hits` 用无主体键查 check ⇒ A 批准的
  `git push` 前缀使 B 同样操作 90 天内免弹窗。

判据(每条注明正反方向):
1. 跨主体阳性对照 —— A 落规则,B 命中出口 False(= 未发出放行,弹窗保持);
2. 反向对照 —— 同主体命中 True;
3. 缺主体 —— 不写入且不命中(fail-closed),本次批准仍执行(断言落库无新行);
4. 存量无主体行 —— 对任何具主判定永不放行、面板不可见、他人撤销不动它;
5. 列表端点只回本人规则;
6. 撤销端点:他人/裸键撤销 = no-op 且原规则存活,本人撤销生效;
7. 系统级主体(system-worker)与 UUID 主体互不命中;
8. 键空间不碰撞 + scoped_cache_key 空主体抛错;
9. 源码级锁 —— "算主体键"实现只有一份。
"""

from __future__ import annotations

import asyncio
import importlib
import inspect
from types import SimpleNamespace

import pytest

from app.services import approval_persistence as ap


@pytest.fixture()
def mod():
    m = importlib.import_module("app.routers.llm")
    return m


@pytest.fixture()
def db(tmp_path, monkeypatch):
    """独立 SQLite(与既有 approval_persistence 测试同法,绝不触生产库)。"""
    monkeypatch.setattr(ap, "_DB_PATH", tmp_path / "approval_grants_test.db")
    ap.close()
    yield ap
    ap.close()


def _entry(argv):
    return {"grant_rule": {"kind": "exec_prefix", "tokens": 2}, "argv": argv}


# ---------- 1 阳性对照 + 2 反向对照 + 5 列表 + 6 撤销:共享一组站点 ----------

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"


def test_同主体命中_跨主体不放行(mod, db):
    """修复存在的全部理由:B 喂 A 批准过的命令 ⇒ 未发出放行;同主体 ⇒ 命中。"""
    argv = ["git", "push", "origin"]
    # 落规则必须走**生产写入口**(`_persist_grant_rule`),不得手搭键:手搭会测到"自己造的键空间",
    # 与生产按 `grant_rule.tokens` 截断出来的键不同形 —— 本票第一版就在这里存了 3-token 全 argv,
    # 然后断言 `git push --force` 命中,红的是测试而不是判据(前缀语义下它本就不该命中)。
    mod._persist_grant_rule(_entry(argv), "run_command", "sess-A", A)
    # 同一条锁的另一半:写入侧算出的键必须就是命中侧用的那个键(两侧共用 `_scoped_exec_prefix_key`)。
    assert db.check(mod._scoped_exec_prefix_key(A, ["git", "push"]), "exec_prefix") is not None

    # 反方向(修复的靶心):B 主体判同命令 —— 不得放行(调用方据此保持弹窗)。
    # 仅断言 False 不够 ⇒ 同键直查 storage 层:属于 B 的那个键必须无授权。
    assert mod._exec_prefix_grant_hits(argv, B) is False
    assert db.check(db.scoped_cache_key(B, db.normalize_exec_key(argv)), "exec_prefix") is None
    # 更彻底:"未发出放行"是集合性质 —— 当前 db 里不存在任何可被 B 命中的键。
    for n in (1, 2, 3):
        assert db.check(db.scoped_cache_key(B, db.normalize_exec_key(argv[:n])), "exec_prefix") is None

    # 正方向:别把修复做成永远不命中 —— 同主体同前缀必须命中。
    assert mod._exec_prefix_grant_hits(["git", "push", "--force"], A) is True

    # 列表端点(经 fake Request 直调,同仓既有先例):只回 A 自己的规则。
    resp = asyncio.run(mod.list_approval_grants(SimpleNamespace(state=SimpleNamespace(user_id=A))))
    assert resp["ok"] is True
    # 期望值必须取**生产算键出口**的结果(按 grant_rule.tokens 截断成 2-token 前缀),
    # 不是 normalize_exec_key(全 argv) —— 后者正是本票第一版造出假失败的那把自造尺子。
    assert [g["cacheKey"] for g in resp["grants"]] == [
        mod._scoped_exec_prefix_key(A, ["git", "push"])
    ]
    # B 的面板看不到 A 的规则
    resp_b = asyncio.run(mod.list_approval_grants(SimpleNamespace(state=SimpleNamespace(user_id=B))))
    assert resp_b["ok"] is True and resp_b["grants"] == []


def test_撤销归属闸_他人键与裸键均no_op_本人键生效(mod, db):
    key_a = db.scoped_cache_key(A, db.normalize_exec_key(["git", "push"]))
    db.grant("always", key_a, "exec_prefix", ttl_days=90)

    def _revoke(uid, k):
        req = SimpleNamespace(
            state=SimpleNamespace(user_id=uid),
            query_params={"cache_key": k, "kind": "exec_prefix"},
        )
        return asyncio.run(mod.revoke_approval_grant(req))

    assert _revoke(B, key_a)["ok"] is True          # 无存在性探针
    assert db.check(key_a, "exec_prefix") is not None   # 但 A 的规则未被撤销
    bare = db.normalize_exec_key(["git", "push"])
    assert _revoke(A, bare)["ok"] is True            # 存量裸键经面板不可撤(语义变更,见报告)
    assert db.check(bare, "exec_prefix") is None     # 裸键本就未登记(幂等 ok)
    assert _revoke(A, key_a)["ok"] is True
    assert db.check(key_a, "exec_prefix") is None    # 本人撤销生效


def test_system_worker主体与普通主体互不命中(mod, db):
    key_w = db.scoped_cache_key("system-worker", db.normalize_exec_key(["git", "push"]))
    db.grant("always", key_w, "exec_prefix", ttl_days=90)
    assert mod._exec_prefix_grant_hits(["git", "push"], "system-worker") is True
    assert mod._exec_prefix_grant_hits(["git", "push"], A) is False


# ---------- 3 缺主体:不写、不命中、批准不被打断 ----------

def test_缺主体不落规则且命中侧永不放行(mod, db):
    before = db.stats()["total"]
    mod._persist_grant_rule(_entry(["git", "push"]), "run_command", "s1", None)
    mod._persist_grant_rule(_entry(["git", "push"]), "run_command", "s1", "   ")
    assert db.stats()["total"] == before  # 未落库;不抛异常 ⇒ 本次已批准的执行不被打断
    assert mod._exec_prefix_grant_hits(["git", "push"], None) is False

    db.grant("always", db.scoped_cache_key(A, db.normalize_exec_key(["git", "push"])), "exec_prefix", ttl_days=90)
    assert mod._exec_prefix_grant_hits(["git", "push"], None) is False
    assert mod._exec_prefix_grant_hits(["git", "push"], A) is True


# ---------- 4 存量行语义:无主体裸行 = 不可信,永不放行、不可见、不可经面板撤 ----------

def test_存量无主体行对具主判定永不放行(mod, db):
    bare = db.normalize_exec_key(["git", "push"])
    db.grant("always", bare, "exec_prefix", ttl_days=90)  # 模拟修复前 D158 落库的行
    assert mod._exec_prefix_grant_hits(["git", "push", "--force"], A) is False
    assert db.split_scoped_key(bare)[0] is None
    resp = asyncio.run(mod.list_approval_grants(SimpleNamespace(state=SimpleNamespace(user_id=A))))
    assert resp["grants"] == []


# ---------- 8 键空间不碰撞 + 空主体拒绝 ----------

def test_键空间不碰撞且空主体不落规则(db):
    bare = db.normalize_exec_key(["git", "push"])
    scoped = db.scoped_cache_key(A, bare)
    db.grant("always", scoped, "exec_prefix", ttl_days=90)
    assert db.check(scoped, "exec_prefix") is not None
    assert db.check(bare, "exec_prefix") is None  # 裸键查不到绑定键(反向亦成立)
    with pytest.raises(ValueError):
        db.scoped_cache_key("", bare)


# ---------- 9 源码级锁:"算主体键"的实现只许一份 ----------

def test_算主体键的第二处实现不得被重新引入(mod):
    src = inspect.getsource(mod)
    # 直接调 grant/check 且键来自 normalize_exec_key 的旧裸键形态,不得在 llm.py 任何位置重现
    assert 'grant("always", cache_key, "exec_prefix"' in src  # 唯一写点在 _persist_grant_rule 内
    legacy = [
        ln for ln in src.splitlines()
        if "normalize_exec_key" in ln and ("_ap.check(" in ln or "_ap.grant(" in ln)
    ]
    assert legacy == []
    # 主体段拼接只许住在 approval_persistence 一处;llm.py 不得自己抄分隔符逻辑
    assert "\x1e" not in src
    ap_src = inspect.getsource(ap)
    assert ap_src.count("def scoped_cache_key") == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
