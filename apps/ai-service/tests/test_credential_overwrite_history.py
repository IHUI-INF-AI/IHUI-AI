# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""「登录态导入覆盖已有凭据 ⇒ 可回滚」回归(2026-09-27 立)。

立因是当轮一次**真实破坏且无法弥补**:`detect_login_from_profile` 把 CSDN 库里那份仍可连通的
38 字段密文换成从用户 Chrome 读到的 11 字段失效集 —— 因为**密文没有备份**,覆盖落地即不可回滚。

同一天已把「该不该覆盖」收口(`should_overwrite_existing_credentials` + `verify_login_candidate`,
另有 `test_login_import_verify_before_write.py` 钉住)。本文件钉的是**不同层**的另一半:
「已经覆盖了以后能不能恢复」—— 写新密文之前,把库里那一份旧密文压进 `extra.credentialsHistory`。

三条设计事实必须被测到(缺一条就等于没测):
1. **别人的键逐字还在**:`extra` 是共享列,本函数只增/换自己那一个键,绝不"清掉重建";
2. **失效方向 = 宁可少一层保险,也不弄坏原写入**:旧 extra 读不懂(坏 JSON / 不是对象)时退回
   不带历史的原写入,但**必须喊 error**(不得静默);
3. **阳性对照**:旧密文是哨兵串时,历史里必须**取回那枚哨兵** —— 证明"可回滚"真被覆盖,
   而不是只证明了"没崩"。

测试不连 DB / 不联网 / 不真加密:桩掉鉴权外的全部 IO(`get_db_conn` 取连接、`encrypt` 加密),
隔离标准照 `test_scan_login_import_domain_filter.py::_run_import`。密文一律用哨兵串。
"""
from __future__ import annotations

import asyncio
import json
import pathlib
from typing import Any

import app.core.db as core_db
import app.services.publish.credential_history as ch
import app.services.publish.credentials_crypto as crypto
import app.services.scan_login as svc
from app.services.publish.credential_history import (
    _MIN_MEANINGFUL_ENC_LEN,
    CREDENTIALS_HISTORY_KEY,
    CREDENTIALS_HISTORY_MAX,
)
from app.services.publish.credential_history import (
    build_credentials_history_extra as build,
)

# ---------------------------------------------------------------------------
# 纯函数层:给定「旧 extra + 旧密文 + 本次来源」⇒ 新 extra / 降级标记
# ---------------------------------------------------------------------------


def _first_entry(plan: Any) -> dict[str, Any]:
    assert plan.extra is not None, "本次应当建立历史"
    history = plan.extra[CREDENTIALS_HISTORY_KEY]
    assert isinstance(history, list) and history, "历史里必须有东西"
    entry = history[0]
    assert isinstance(entry, dict)
    return entry


# 1) 三种"空 extra"形态都正常建历史;第四种(合法对象但含别人的键)必须保住别人的键
def test_history_created_from_each_empty_extra_shape() -> None:
    for raw in (None, "", "   ", "{}"):
        plan = build(raw, "ENC-OLD-1", "画像导入并校验通过", at="2026-09-27 11:00:00")
        assert plan.extra is not None, f"raw={raw!r} 应建立历史"
        assert plan.degraded is False, f"raw={raw!r} 不该被判降级"
        assert plan.note == "", f"raw={raw!r} 不该有异常说明"
        assert list(plan.extra) == [CREDENTIALS_HISTORY_KEY], f"raw={raw!r} 键集不符"
        assert _first_entry(plan)["enc"] == "ENC-OLD-1", f"raw={raw!r} 取不回旧密文"


def test_foreign_keys_in_extra_survive_verbatim() -> None:
    """"别人的键"用四种形态各测一次:标量 / 嵌套对象 / 数组 / 非 ASCII 值。"""
    others = {
        "groupId": "g-77",
        "profile": {"nick": "李春川", "level": 3},
        "tags": [{"name": "主号"}, {"name": "备号"}],
        "note": "别人写的中文说明,不得被改写",
    }
    raw = json.dumps(others, ensure_ascii=False)
    plan = build(raw, "ENC-OLD-1", "扫码登录成功", at="2026-09-27 11:00:00")
    assert plan.extra is not None and not plan.degraded
    # 逐字还在:除自己那一键外,整个对象与输入**全等**(不是"键名还在")
    assert {k: v for k, v in plan.extra.items() if k != CREDENTIALS_HISTORY_KEY} == others
    assert plan.extra == {**others, CREDENTIALS_HISTORY_KEY: [{
        "enc": "ENC-OLD-1",
        "at": "2026-09-27 11:00:00",
        "reason": "扫码登录成功",
    }]}


def test_input_extra_object_is_not_mutated() -> None:
    """纯函数不得原地改入参 —— 否则调用方手上那份"覆盖前镜像"会被悄悄写脏。"""
    others: dict[str, Any] = {"groupId": "g-77"}
    snapshot = json.dumps(others, ensure_ascii=False, sort_keys=True)
    plan = build(others, "ENC-OLD-1", "x", at="2026-09-27 11:00:00")
    assert json.dumps(others, ensure_ascii=False, sort_keys=True) == snapshot
    assert plan.extra is not None and plan.extra is not others


# 2) 旧 extra 是合法 JSON 但**不是对象** ⇒ 降级为不带历史的原写入
def test_valid_json_but_not_an_object_degrades() -> None:
    for raw in ("[]", '[{"a": 1}]', '"x"', "123", "true", "null"):
        plan = build(raw, "ENC-OLD-1", "x", at="2026-09-27 11:00:00")
        assert plan.extra is None, f"raw={raw!r} 不得写回 extra(读不懂别人的键)"
        assert plan.degraded is True, f"raw={raw!r} 必须被标成降级,供 DB 侧喊 error"
        assert plan.note, f"raw={raw!r} 降级必须带可诊断说明"


# 3) 旧 extra 是坏 JSON ⇒ 同上降级
def test_malformed_json_degrades() -> None:
    for raw in ("{", "{不是json", "groupId=g-77", '["a",'):
        plan = build(raw, "ENC-OLD-1", "x", at="2026-09-27 11:00:00")
        assert plan.extra is None, f"raw={raw!r} 坏 JSON 不得被当成空对象重写"
        assert plan.degraded is True, f"raw={raw!r} 必须标降级"
        assert plan.note


# 4) 已有 3 条历史时再覆盖 ⇒ 仍只 3 条、丢最旧、新条目在最前
def test_history_is_bounded_and_newest_first() -> None:
    # 存储约定是**新在前**(与本函数的产出一致),所以存量按 GEN-3 最新来排
    prior = [
        {"enc": "ENC-GEN-3", "at": "2026-09-26 10:00:00", "reason": "r3"},
        {"enc": "ENC-GEN-2", "at": "2026-09-25 10:00:00", "reason": "r2"},
        {"enc": "ENC-GEN-1", "at": "2026-09-24 10:00:00", "reason": "r1"},
    ]
    raw = json.dumps({CREDENTIALS_HISTORY_KEY: prior, "groupId": "g-77"}, ensure_ascii=False)
    plan = build(raw, "ENC-GEN-4", "画像导入并校验通过", at="2026-09-27 11:00:00")
    assert plan.extra is not None and not plan.degraded
    history = plan.extra[CREDENTIALS_HISTORY_KEY]
    assert len(history) == CREDENTIALS_HISTORY_MAX == 3
    assert [e["enc"] for e in history] == ["ENC-GEN-4", "ENC-GEN-3", "ENC-GEN-2"], \
        "新条目必须在最前、丢的是最旧那一条"
    assert plan.extra["groupId"] == "g-77", "截断历史时不得顺手抹掉别人的键"


# 5) 旧密文空/过短 ⇒ 不压垃圾条目,而且**不算异常**(不降级、不喊错)
def test_empty_or_short_previous_credential_pushes_nothing() -> None:
    for prev in (None, "", "a", "ab", 123, b"ENC", ["ENC-OLD-1"]):
        plan = build('{"groupId": "g-77"}', prev, "x", at="2026-09-27 11:00:00")
        assert plan.extra is None, f"prev={prev!r} 不许往历史里塞垃圾条目"
        assert plan.degraded is False, f"prev={prev!r} 库里本来就没东西,不是故障"
        assert plan.note and not plan.degraded


def test_min_length_agrees_with_the_existing_credentials_predicate() -> None:
    """判"库里有没有凭据"的 SQL 与判"有没有可留的旧密文"的常量必须同形。

    两处各写一份宽严必然漂移(本仓最高频失效型),所以把 SQL 侧的字面量钉在这里当第二把尺子。
    """
    src = (pathlib.Path(__file__).resolve().parents[1] / "app" / "services" / "scan_login.py")
    body = src.read_text(encoding="utf-8")
    anchor = "async def _existing_account_row"
    tail = body[body.index(anchor) + len(anchor):]
    predicate = tail[: tail.index("async def ")]
    assert "credentials_enc IS NOT NULL" in predicate
    assert "length(credentials_enc) > 2" in predicate, "SQL 判据变了必须同步改常量"
    assert _MIN_MEANINGFUL_ENC_LEN == 3, "> 2 等价于 len >= 3"


# 6) 来源说明:空白/缺失一律落成"未知来源",不得留空串
def test_reason_never_empty() -> None:
    for src in (None, "", "   "):
        assert _first_entry(build(None, "ENC-OLD-1", src, at="t"))["reason"] == "未知来源"
    assert _first_entry(build(None, "ENC-OLD-1", "  画像导入 ", at="t"))["reason"] == "画像导入"
    # 非字符串来源(调用方传了 None 之外的脏值)不得抛,要落成文本
    assert _first_entry(build(None, "ENC-OLD-1", 0, at="t"))["reason"] == "未知来源"


# 7) 阳性对照:哨兵旧密文必须能从历史里取回(这才是"可回滚")
def test_positive_control_sentinel_is_recoverable_from_history() -> None:
    plan = build('{"groupId": "g-77"}', "ENC-OLD-1", "画像导入并校验通过", at="2026-09-27 11:00:00")
    assert plan.extra is not None
    # 走一遍"落库 → 读回"的 JSON 往返,断言的是**产物里**取回哨兵,不是内存对象里的
    restored = json.loads(json.dumps(plan.extra, ensure_ascii=False))
    assert restored[CREDENTIALS_HISTORY_KEY][0]["enc"] == "ENC-OLD-1"
    assert restored["groupId"] == "g-77"


# ---------------------------------------------------------------------------
# DB 侧:桩掉连接与加密,只看它发出哪条 SQL、带什么参数、喊不喊
# ---------------------------------------------------------------------------


class _Recorder:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.infos: list[str] = []

    def error(self, msg: str, *a: Any, **k: Any) -> None:
        self.errors.append(str(msg))

    def warning(self, msg: str, *a: Any, **k: Any) -> None:
        pass

    def info(self, msg: str, *a: Any, **k: Any) -> None:
        self.infos.append(str(msg))

    def debug(self, msg: str, *a: Any, **k: Any) -> None:
        pass

    def exception(self, msg: str, *a: Any, **k: Any) -> None:
        self.errors.append(str(msg))


class _FakeConn:
    """只记录、不落任何真实数据。按 SQL 片段分流三条语句。"""

    def __init__(self, find_row: dict[str, Any] | None, preimage: dict[str, Any] | None,
                 preimage_raises: bool = False) -> None:
        self._find_row = find_row
        self._preimage = preimage
        self._preimage_raises = preimage_raises
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchvals: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchrow_sqls: list[str] = []

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_sqls.append(sql)
        if "WHERE id=$1" in sql:
            if self._preimage_raises:
                raise RuntimeError("column \"extra\" does not exist")
            return self._preimage
        return self._find_row

    async def fetchval(self, sql: str, *args: Any) -> int:
        self.fetchvals.append((sql, args))
        return 987654

    async def execute(self, sql: str, *args: Any) -> None:
        self.executed.append((sql, args))

    async def close(self) -> None:
        pass


#: `_run_save` 的"未指定 find_row"哨兵(不能用 None —— None 就是"库里没有这一行",
#: 那正是 INSERT 分支要测的那一格)
_NO_ROW_ARG = object()


def _run_save(
    *,
    find_row: Any = _NO_ROW_ARG,
    preimage: dict[str, Any] | None = None,
    preimage_raises: bool = False,
) -> dict[str, Any]:
    """直调 `_save_account_to_db`,替换全部 IO 依赖(取连接 + 加密),不落任何真实数据。"""
    row: dict[str, Any] | None = {"id": 12} if find_row is _NO_ROW_ARG else find_row
    conn = _FakeConn(row, preimage, preimage_raises)
    recorder = _Recorder()

    async def _fake_get_db_conn() -> _FakeConn:
        return conn

    def _fake_encrypt(creds: dict[str, str]) -> str:
        assert creds == {"z_c0": "leakcheck-new-value"}, "加密出口入参不符,测试桩失效"
        return "ENC-NEW"

    originals = (core_db.get_db_conn, crypto.encrypt, ch.logger)
    core_db.get_db_conn = _fake_get_db_conn  # type: ignore[assignment]
    crypto.encrypt = _fake_encrypt  # type: ignore[assignment]
    ch.logger = recorder  # type: ignore[assignment]
    try:
        account_id = asyncio.run(svc._save_account_to_db(
            "u-test-0001", "zhihu", {"z_c0": "leakcheck-new-value"}, "知乎",
            verify_msg="画像导入并校验通过",
        ))
    finally:
        core_db.get_db_conn, crypto.encrypt, ch.logger = originals
    return {
        "account_id": account_id,
        "conn": conn,
        "errors": recorder.errors,
    }


def test_update_writes_new_credential_and_history_in_one_statement() -> None:
    out = _run_save(preimage={"credentials_enc": "ENC-OLD-1",
                              "extra": '{"groupId": "g-77", "note": "别人的中文说明"}'})
    conn: _FakeConn = out["conn"]
    assert out["account_id"] == 12
    assert len(conn.executed) == 1, "覆盖必须是**一条** UPDATE:先清 extra 再写会留空窗并抹掉别人的键"
    sql, args = conn.executed[0]
    assert "credentials_enc=$1" in sql and "extra=$5::jsonb" in sql, sql
    assert args[0] == "ENC-NEW" and args[2] == 12 and args[3] == "画像导入并校验通过"
    written = json.loads(args[4])
    assert written["groupId"] == "g-77" and written["note"] == "别人的中文说明"
    assert written[CREDENTIALS_HISTORY_KEY][0]["enc"] == "ENC-OLD-1", "旧密文必须能从产物里取回"
    assert written[CREDENTIALS_HISTORY_KEY][0]["reason"] == "画像导入并校验通过"
    assert out["errors"] == [], "正常路径不该喊错"
    # 新密文与旧密文都不得出现在日志里
    blob = " ".join(out["errors"] + [s for s, _ in conn.executed])
    assert "ENC-OLD-1" not in blob


def test_unreadable_extra_degrades_to_original_write_and_shouts_error() -> None:
    for bad in ('["a"]', "{不是json", "5"):
        out = _run_save(preimage={"credentials_enc": "ENC-OLD-1", "extra": bad})
        conn: _FakeConn = out["conn"]
        assert len(conn.executed) == 1, f"extra={bad!r}"
        sql, args = conn.executed[0]
        assert "extra=" not in sql, f"extra={bad!r} 降级后不得再写 extra 列"
        assert len(args) == 4, f"extra={bad!r} 参数个数应与原写入一致"
        assert out["errors"], f"extra={bad!r} 降级发生了却没人喊(§5e 失败必须响)"
        assert any("回滚历史" in e for e in out["errors"]), f"extra={bad!r} 日志未点名回滚历史"
        assert out["account_id"] == 12, "少一层保险不得让整个导入失败"


def test_missing_column_degrades_without_failing_the_import() -> None:
    """极旧库/列取不到这一格:`_load_overwrite_preimage` 自己吞异常 ⇒ 原写入照做。"""
    out = _run_save(preimage_raises=True)
    conn: _FakeConn = out["conn"]
    assert out["account_id"] == 12, "读不到镜像不得毁掉用户导入"
    assert len(conn.executed) == 1 and "extra=" not in conn.executed[0][0]
    assert any("回滚历史" in e for e in out["errors"])
    assert all("does not exist" not in e for e in out["errors"]), \
        "异常消息不得进日志(可能带列内容),只准报类型名"


def test_empty_stored_credential_writes_no_history_and_stays_silent() -> None:
    """库里那份本来就是空的 ⇒ 不压条目,**且不是故障**:不得刷 error。

    与上一条成对 —— 把"没有可留的东西"和"准备失败"混成一格,日志就当不起"失败必须响"。
    """
    for prev in (None, "", "ab"):
        out = _run_save(preimage={"credentials_enc": prev, "extra": '{"groupId": "g-77"}'})
        conn: _FakeConn = out["conn"]
        assert len(conn.executed) == 1 and "extra=" not in conn.executed[0][0], f"prev={prev!r}"
        assert out["errors"] == [], f"prev={prev!r} 不该被判成异常"
        assert out["account_id"] == 12


def test_third_generation_keeps_only_three_in_db_path() -> None:
    existing = {
        CREDENTIALS_HISTORY_KEY: [
            {"enc": "ENC-GEN-2", "at": "t2", "reason": "r2"},
            {"enc": "ENC-GEN-1", "at": "t1", "reason": "r1"},
        ],
        "groupId": "g-77",
    }
    out = _run_save(preimage={"credentials_enc": "ENC-GEN-3",
                              "extra": json.dumps(existing, ensure_ascii=False)})
    written = json.loads(out["conn"].executed[0][1][4])
    assert [e["enc"] for e in written[CREDENTIALS_HISTORY_KEY]] == [
        "ENC-GEN-3", "ENC-GEN-2", "ENC-GEN-1",
    ]
    assert written["groupId"] == "g-77"


def test_insert_branch_is_untouched() -> None:
    """首建分支语义一字未动:不发镜像查询,也不写 extra。"""
    out = _run_save(find_row=None)
    conn: _FakeConn = out["conn"]
    assert conn.executed == [], "首建走 fetchval,不该有 UPDATE"
    assert len(conn.fetchvals) == 1
    sql, _args = conn.fetchvals[0]
    assert "INSERT INTO publish_accounts" in sql and "extra" not in sql
    assert not any("WHERE id=$1" in s for s in conn.fetchrow_sqls), "首建不必读镜像"
    assert out["account_id"] == 987654 and out["errors"] == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
