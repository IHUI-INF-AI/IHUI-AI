# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""凭据覆盖历史的「三写点全接线 + 唯一出口」回归(2026-09-27 立)。

背景:「覆盖已有凭据前先把旧密文压进有界历史」机制落地时只接了**一个**写点
(`scan_login._save_account_to_db`)。现网还有两处同样在无条件覆盖 `credentials_enc`:
- `cookie_refresh_daemon.refresh_single` —— 保活守护把平台轮换后的新 cookie 写回凭证,
  这一条恰好就是"刷新 token"那个动作本身;
- `PUT /publish/accounts/{account_id}`(`app/routers/publish.py`)—— 前台编辑整体覆盖。

本文件钉两件事:

1. **行为面**:三条路径各自跑通三格 —— 旧密文进了历史 / 别人的 extra 键逐字保住 /
   历史准备失败时退回不含 extra 的原语句并喊 error。全部桩 conn,不连库、不真加密
   (§5 测试隔离铁律),密文一律哨兵串,报告里不落任何真实凭据。
2. **源码面锁**(判据住在 `audit_write_site_discipline`,输入是「(相对路径, 文本)」清单,
   可用构造面喂 —— 变异对照不改生产代码):
   - 字面量 `"credentialsHistory"` 在 `app/**` 里**只许出现在唯一出口** credential_history.py,
     且其定义行(`CREDENTIALS_HISTORY_KEY = "credentialsHistory"`)全仓恰好一次;
   - 写 `credentials_enc=$…` 的 UPDATE 语句**只许出现在唯一出口**;
   - 三个写点必须都在 `await apply_credentials_update(`;
   - 覆盖面自证:枚举到 0 个文件 / 调用点少于 3 处 ⇒ 判"扫不到不算通过",不静默放行;
   - 变异对照:把任一写点退回裸 UPDATE ⇒ 锁必须翻红。
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import re
from types import SimpleNamespace
from typing import Any

import app.core.db as core_db
import app.routers.publish as pub
import app.services.publish.cookie_refresh_daemon as cd
import app.services.publish.credential_history as ch
import app.services.publish.credentials_crypto as crypto
import app.services.scan_login as svc
from app.services.publish.credential_history import CREDENTIALS_HISTORY_KEY

# ---------------------------------------------------------------------------
# 桩基建:一个按 SQL 片段分流的假连接,只记录、不落任何真实数据
# ---------------------------------------------------------------------------


class _Recorder:
    def __init__(self) -> None:
        self.errors: list[str] = []

    def error(self, msg: str, *a: Any, **k: Any) -> None:
        self.errors.append(str(msg))

    def warning(self, msg: str, *a: Any, **k: Any) -> None:
        pass

    def info(self, msg: str, *a: Any, **k: Any) -> None:
        pass

    def debug(self, msg: str, *a: Any, **k: Any) -> None:
        pass

    def exception(self, msg: str, *a: Any, **k: Any) -> None:
        self.errors.append(str(msg))


class _FakeConn:
    """分流五类 SQL:找行 / 镜像读 / 首建 INSERT / UPDATE(execute)/ UPDATE(fetchrow RETURNING)。"""

    def __init__(
        self,
        *,
        find_row: dict[str, Any] | None = None,
        preimage: dict[str, Any] | None = None,
        preimage_raises: bool = False,
        full_row: dict[str, Any] | None = None,
    ) -> None:
        self._find_row = find_row if find_row is not None else {"id": 12}
        self._preimage = preimage
        self._preimage_raises = preimage_raises
        self._full_row = full_row or _account_row()
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchvals: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchrow_sqls: list[str] = []

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_sqls.append(sql)
        if "credentials_enc, extra" in sql:
            if self._preimage_raises:
                raise RuntimeError('column "extra" does not exist')
            return self._preimage
        if "SELECT * FROM publish_accounts" in sql or "SELECT credentials_enc FROM" in sql:
            return self._full_row
        if "UPDATE publish_accounts" in sql:
            return self._full_row
        return self._find_row

    async def fetchval(self, sql: str, *args: Any) -> int:
        self.fetchvals.append((sql, args))
        return 987654

    async def execute(self, sql: str, *args: Any) -> None:
        self.executed.append((sql, args))

    async def close(self) -> None:
        pass


def _account_row(**over: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": 12,
        "user_id": "u-test-0001",
        "platform": "zhihu",
        "display_name": "知乎",
        "status": "active",
        "credentials_enc": "ENC-STORED",
        "last_verified_at": None,
        "last_verify_msg": None,
        "extra": None,
        "created_at": None,
        "updated_at": None,
    }
    row.update(over)
    return row


#: 三条路径共用的"别人已经住在 extra 里的键" —— 逐字保住是每格的固定断言
_FOREIGN: dict[str, Any] = {"groupId": "g-77", "note": "别人的中文说明"}


def _written_extra(args: tuple[Any, ...]) -> dict[str, Any]:
    """从 UPDATE 参数里取最后一段 JSON 作为落库的 extra(参数末尾必是它,见出口拼装顺序)。"""
    return json.loads(args[-1])


# ---------------------------------------------------------------------------
# 路径 1:扫码/画像导入落库(scan_login._save_account_to_db)
# ---------------------------------------------------------------------------


def _run_scan_login_save(conn: _FakeConn, recorder: _Recorder) -> int:
    async def _fake_get_db_conn() -> _FakeConn:
        return conn

    def _fake_encrypt(creds: dict[str, str]) -> str:
        assert creds == {"z_c0": "new-value"}, "加密出口入参不符,测试桩失效"
        return "ENC-NEW"

    originals = (core_db.get_db_conn, crypto.encrypt, ch.logger)
    core_db.get_db_conn = _fake_get_db_conn  # type: ignore[assignment]
    crypto.encrypt = _fake_encrypt  # type: ignore[assignment]
    ch.logger = recorder  # type: ignore[assignment]
    try:
        return asyncio.run(svc._save_account_to_db(
            "u-test-0001", "zhihu", {"z_c0": "new-value"}, "知乎",
            verify_msg="画像导入并校验通过",
        ))
    finally:
        core_db.get_db_conn, crypto.encrypt, ch.logger = originals


def test_scan_login_site_old_credential_enters_history_and_foreign_keys_survive() -> None:
    conn = _FakeConn(preimage={"credentials_enc": "ENC-OLD-1",
                               "extra": json.dumps(_FOREIGN, ensure_ascii=False)})
    rec = _Recorder()
    assert _run_scan_login_save(conn, rec) == 12
    assert len(conn.executed) == 1, "覆盖必须是一条 UPDATE"
    sql, args = conn.executed[0]
    assert "credentials_enc=$1" in sql and "extra=$" in sql
    written = _written_extra(args)
    assert written[CREDENTIALS_HISTORY_KEY][0]["enc"] == "ENC-OLD-1"
    assert written[CREDENTIALS_HISTORY_KEY][0]["reason"] == "画像导入并校验通过"
    assert {k: v for k, v in written.items() if k != CREDENTIALS_HISTORY_KEY} == _FOREIGN
    assert rec.errors == []


def test_scan_login_site_degrades_to_original_statement() -> None:
    conn = _FakeConn(preimage={"credentials_enc": "ENC-OLD-1", "extra": "{不是json"})
    rec = _Recorder()
    assert _run_scan_login_save(conn, rec) == 12, "少一层保险不得毁掉导入"
    sql, _args = conn.executed[0]
    assert "extra=" not in sql
    assert any("回滚历史" in e for e in rec.errors)


# ---------------------------------------------------------------------------
# 路径 2:保活守护轮换回写(cookie_refresh_daemon.refresh_single)
# ---------------------------------------------------------------------------


def _run_daemon_refresh(conn: _FakeConn, recorder: _Recorder) -> None:
    async def _fake_get_db_conn() -> _FakeConn:
        return conn

    def _fake_decrypt(enc: str) -> dict[str, str]:
        assert enc == "ENC-STORED"
        return {"z_c0": "old-cookie"}

    def _fake_encrypt(creds: dict[str, str]) -> str:
        assert creds == {"z_c0": "new-cookie"}, "回写的合并集不符,测试桩失效"
        return "ENC-ROTATED"

    daemon = cd.CookieRefreshDaemon()
    originals = (cd.get_db_conn, crypto.decrypt, crypto.encrypt,
                 cd.CookieRefreshDaemon._visit_and_check, ch.logger, cd.logger)
    cd.get_db_conn = _fake_get_db_conn  # type: ignore[assignment]
    crypto.decrypt = _fake_decrypt  # type: ignore[assignment]
    crypto.encrypt = _fake_encrypt  # type: ignore[assignment]
    cd.CookieRefreshDaemon._visit_and_check = staticmethod(  # type: ignore[method-assign]
        lambda platform, login_url, credentials: (True, {"z_c0": "new-cookie"})
    )
    ch.logger = recorder  # type: ignore[assignment]
    cd.logger = recorder  # type: ignore[assignment]
    try:
        result = asyncio.run(daemon.refresh_single(12, "zhihu"))
    finally:
        (cd.get_db_conn, crypto.decrypt, crypto.encrypt,
         cd.CookieRefreshDaemon._visit_and_check, ch.logger, cd.logger) = originals
    assert result.success, f"保活结论应为成功,实得:{result.message}"


def test_daemon_site_old_credential_enters_history_and_foreign_keys_survive() -> None:
    conn = _FakeConn(preimage={"credentials_enc": "ENC-STORED",
                               "extra": json.dumps(_FOREIGN, ensure_ascii=False)})
    rec = _Recorder()
    _run_daemon_refresh(conn, rec)
    # 2026-09-29 起保活成功还会**另外**发一条 `last_verified_at` 健康度戳
    # (`cookie_refresh_daemon._stamp_verified`),它与凭证回写是两件事,不该被算进
    # "回写被拆成了几条"。本用例命名的那条不变量是:**凭证回写必须是一条 UPDATE,
    # 且密文与 extra 同语句** ⇒ 按"这条语句动没动 credentials_enc"筛。
    # 筛而不是数总条数并没有变弱:真把回写拆成两条(先写密文、再补 extra)时,
    # 两条都会命中 credentials_enc ⇒ 这里读到 2 ⇒ 照样红。
    write_backs = [e for e in conn.executed if "credentials_enc=" in e[0]]
    assert len(write_backs) == 1, "回写必须是一条 UPDATE(密文与 extra 同语句)"
    sql, args = write_backs[0]
    assert "credentials_enc=$1" in sql and "extra=$" in sql
    assert args[0] == "ENC-ROTATED" and args[1] == 12
    written = _written_extra(args)
    assert written[CREDENTIALS_HISTORY_KEY][0]["enc"] == "ENC-STORED", \
        "保活覆盖同样要留得回上一份密文"
    assert written[CREDENTIALS_HISTORY_KEY][0]["reason"] == "Cookie 保活轮换回写"
    assert {k: v for k, v in written.items() if k != CREDENTIALS_HISTORY_KEY} == _FOREIGN
    assert rec.errors == []


def test_daemon_site_degrades_to_original_statement() -> None:
    conn = _FakeConn(preimage={"credentials_enc": "ENC-STORED", "extra": "5"})
    rec = _Recorder()
    _run_daemon_refresh(conn, rec)
    sql, args = conn.executed[0]
    assert "extra=" not in sql, "降级 ⇒ 退回不含 extra 的原语句"
    assert args == ("ENC-ROTATED", 12), "降级后的参数集必须就是原写入那一份"
    assert any("回滚历史" in e for e in rec.errors), "降级不得静默(§5e 失败必须响)"


# ---------------------------------------------------------------------------
# 路径 3:前台编辑 PUT /publish/accounts/{account_id}
# ---------------------------------------------------------------------------


def _run_put(
    conn: _FakeConn,
    recorder: _Recorder,
    body: pub.AccountUpdate,
) -> dict[str, Any]:
    async def _fake_get_conn() -> _FakeConn:
        return conn

    async def _no_ensure(_conn: Any) -> None:
        return None

    def _fake_encrypt(creds: dict[str, Any]) -> str:
        assert creds == {"z_c0": "typed-by-user"}
        return "ENC-TYPED"

    request = SimpleNamespace(state=SimpleNamespace(user_id="u-test-0001"))
    originals = (pub._get_conn, pub._ensure_accounts_table, pub.encrypt, ch.logger)
    pub._get_conn = _fake_get_conn  # type: ignore[assignment]
    pub._ensure_accounts_table = _no_ensure  # type: ignore[assignment]
    pub.encrypt = _fake_encrypt  # type: ignore[assignment]
    ch.logger = recorder  # type: ignore[assignment]
    try:
        out: dict[str, Any] = asyncio.run(pub.update_account(12, body, request))  # type: ignore[arg-type]
    finally:
        pub._get_conn, pub._ensure_accounts_table, pub.encrypt, ch.logger = originals
    return out


def test_put_site_old_credential_enters_history_and_foreign_keys_survive() -> None:
    conn = _FakeConn(preimage={"credentials_enc": "ENC-STORED",
                               "extra": json.dumps(_FOREIGN, ensure_ascii=False)})
    rec = _Recorder()
    out = _run_put(conn, rec, pub.AccountUpdate(credentials={"z_c0": "typed-by-user"}))
    assert out["code"] == 0
    assert len(conn.executed) == 1, "只改凭据时不得再发第二条 UPDATE"
    sql, args = conn.executed[0]
    assert "credentials_enc=$1" in sql and "extra=$" in sql
    assert args[0] == "ENC-TYPED"
    written = _written_extra(args)
    assert written[CREDENTIALS_HISTORY_KEY][0]["enc"] == "ENC-STORED"
    assert written[CREDENTIALS_HISTORY_KEY][0]["reason"] == "前台编辑凭据"
    assert {k: v for k, v in written.items() if k != CREDENTIALS_HISTORY_KEY} == _FOREIGN
    assert rec.errors == []


def test_put_site_merge_extra_lands_on_top_of_history() -> None:
    """凭据 + extra 同传:extra 由出口一条语句落 —— 调用方新键覆盖、历史与别人的键都在,
    且客户端回传的旧历史键不得盖掉本轮刚压进去的那一条。"""
    stale = {**_FOREIGN, CREDENTIALS_HISTORY_KEY: [{"enc": "ENC-STALE", "at": "t0", "reason": "r"}]}
    conn = _FakeConn(preimage={"credentials_enc": "ENC-STORED",
                               "extra": json.dumps(stale, ensure_ascii=False)})
    rec = _Recorder()
    _run_put(conn, rec, pub.AccountUpdate(
        credentials={"z_c0": "typed-by-user"},
        extra={"groupId": "g-88", CREDENTIALS_HISTORY_KEY: []},
    ))
    assert len(conn.executed) == 1
    _sql, args = conn.executed[0]
    written = _written_extra(args)
    assert written[CREDENTIALS_HISTORY_KEY][0]["enc"] == "ENC-STORED", \
        "回传的空历史不得把本轮历史抹掉"
    assert written["groupId"] == "g-88", "调用方给的新键按覆盖语义生效"
    assert written["note"] == _FOREIGN["note"]


def test_put_site_degrades_to_original_statement() -> None:
    conn = _FakeConn(preimage={"credentials_enc": "ENC-STORED", "extra": "[1,2]"})
    rec = _Recorder()
    out = _run_put(conn, rec, pub.AccountUpdate(credentials={"z_c0": "typed-by-user"}))
    assert out["code"] == 0
    sql, _args = conn.executed[0]
    assert "extra=" not in sql
    assert any("回滚历史" in e for e in rec.errors)


def test_put_extra_only_path_keeps_direct_write_and_touches_nothing_else() -> None:
    """只改 extra(没动凭据)⇒ 库里没有本轮会被盖掉的旧密文,维持原直写语义,不走出口。"""
    conn = _FakeConn()
    rec = _Recorder()
    out = _run_put(conn, rec, pub.AccountUpdate(extra={"groupId": "g-88"}))
    assert out["code"] == 0
    assert len(conn.executed) == 0  # 该路径是 fetchrow RETURNING,不是 execute
    assert any("extra=$" in s for s in conn.fetchrow_sqls)
    assert rec.errors == []


# ---------------------------------------------------------------------------
# 源码面锁:唯一出口的字面量/UPDATE 独占 + 三写点真接线(可喂构造面 ⇒ 变异对照)
# ---------------------------------------------------------------------------

_APP_DIR = pathlib.Path(__file__).resolve().parents[1] / "app"
_EXIT_REL = "services/publish/credential_history.py"
_EXPECTED_SITES = frozenset({
    "services/scan_login.py",
    "services/publish/cookie_refresh_daemon.py",
    "routers/publish.py",
})
_KEY_DEF_RE = re.compile(r'^CREDENTIALS_HISTORY_KEY\s*=\s*"credentialsHistory"', re.M)
_ENC_WRITE_RE = re.compile(r"credentials_enc\s*=\s*\$")
_CALL_RE = re.compile(r"await apply_credentials_update\(")


def audit_write_site_discipline(
    files: list[tuple[str, str]],
) -> dict[str, list[str]]:
    """对「(相对 app/ 的路径, 文本)」清单跑三条锁,返回违规清单(空 = 合规)。

    刻意做成纯函数:变异对照不改生产代码,只在测试里构造退化文本喂它。
    """
    bad: dict[str, list[str]] = {
        "literal_outside_exit": [],
        "enc_update_outside_exit": [],
        "exit_missing_from_sites": [],
        "key_def_count_wrong": [],
    }
    if not files:
        bad["literal_outside_exit"].append("<覆盖面自证:枚举到 0 个源文件,判据失明>")
        return bad
    callers: set[str] = set()
    key_defs = 0
    for rel, text in files:
        is_exit = rel == _EXIT_REL
        if "credentialsHistory" in text and not is_exit:
            bad["literal_outside_exit"].append(rel)
        key_defs += len(_KEY_DEF_RE.findall(text))
        if _ENC_WRITE_RE.search(text) and not is_exit:
            bad["enc_update_outside_exit"].append(rel)
        if _CALL_RE.search(text):
            callers.add(rel)
    if _EXIT_REL not in [rel for rel, _t in files]:
        bad["literal_outside_exit"].append("<唯一出口文件本身不见了>")
    missing = _EXPECTED_SITES - callers
    if missing:
        bad["exit_missing_from_sites"] = sorted(missing)
    if key_defs != 1:
        bad["key_def_count_wrong"].append(f"CREDENTIALS_HISTORY_KEY 定义行现测 {key_defs} 次,要求恰好 1")
    return bad


def _collect_app_python() -> list[tuple[str, str]]:
    files: list[tuple[str, str]] = []
    for p in sorted(_APP_DIR.rglob("*.py")):
        if "__pycache__" in p.parts:
            continue
        files.append((p.relative_to(_APP_DIR).as_posix(), p.read_text(encoding="utf-8")))
    return files


def test_real_repo_passes_all_three_locks_with_full_coverage() -> None:
    files = _collect_app_python()
    # 覆盖面自证:写点必须真被枚举到 —— 扫到 0 个文件 / 少一个写点都算判据失明,不算通过
    assert len(files) > 50, f"app/** 枚举到 {len(files)} 个文件,覆盖面异常"
    found = {rel for rel, _t in files if _CALL_RE.search(_t)}
    assert found >= _EXPECTED_SITES, f"写点未被枚举到:{_EXPECTED_SITES - found}"
    violations = audit_write_site_discipline(files)
    assert violations == {k: [] for k in violations}, json.dumps(violations, ensure_ascii=False)


def test_mutation_bare_update_rejects_and_lock_turns_red() -> None:
    """变异对照:把保活守护退回裸 UPDATE(只在构造文本里,不改生产代码)⇒ 锁必须点名。"""
    files = _collect_app_python()
    degenerated = (
        "services/publish/cookie_refresh_daemon.py",
        'def _x(conn, account_id, enc):\n'
        '    conn.execute("UPDATE publish_accounts SET credentials_enc=$1, '
        'updated_at=now() WHERE id=$2", enc, account_id)\n',
    )
    mutated = [degenerated if rel == degenerated[0] else (rel, text) for rel, text in files]
    violations = audit_write_site_discipline(mutated)
    assert degenerated[0] in violations["enc_update_outside_exit"], \
        "写点退回裸 UPDATE 而锁没红 —— 这把尺子是瞎的"
    assert degenerated[0] in violations["exit_missing_from_sites"]


def test_mutation_literal_reintroduction_turns_red() -> None:
    """变异对照:第二个文件再写一次字面量 ⇒ 锁必须红。"""
    files = _collect_app_python()
    mutated = files + [("routers/some_other.py", 'k = "credentialsHistory"\n')]
    assert "routers/some_other.py" in audit_write_site_discipline(mutated)["literal_outside_exit"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
