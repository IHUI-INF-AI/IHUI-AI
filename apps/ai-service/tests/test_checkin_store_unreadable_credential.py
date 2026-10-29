# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""坏密文不得打死整轮(2026-10-29 实测缺陷的镜像锁)。

立因:签到侧 Fernet 主密钥文件被误删后,17 行里 16 行解不开,而取数是"逐行解密、
任一行抛 ⇒ 整轮 0 执行",主窗口/Qoder 窗口/积分快照全部静默不跑,能签的号也签不上。
本文件钉四件事:①坏行只摘自己;②好行照常带出解密后的 jwt;③缺席必须留声(不静默);
④属主列只在快照面回。零 DB、零上游:喂假行给纯函数。
"""

from typing import Any

import pytest

from app.services import checkin_store


class _Row(dict[str, Any]):
    """asyncpg Record 的最小替身:只用到下标取值。"""


class _LoggerSpy:
    def __init__(self) -> None:
        self.warnings: list[str] = []

    def warning(self, msg: str, *args: Any, **kwargs: Any) -> None:
        self.warnings.append(msg % args if args and "%" in msg else str(msg))

    def __getattr__(self, _name: str) -> Any:
        return lambda *_a, **_k: None


@pytest.fixture()
def spy(monkeypatch: pytest.MonkeyPatch) -> _LoggerSpy:
    """让 2 号行的密文解不开,并把模块级 logger 换成留声记录器。"""
    logger = _LoggerSpy()

    def fake_decrypt(blob: bytes) -> str:
        if blob == b"blob-2":
            raise ValueError("JWT 密文解密失败(密钥不匹配或数据损坏)")
        return f"jwt-for-{blob.decode()}"

    monkeypatch.setattr(checkin_store, "_decrypt_jwt", fake_decrypt)
    monkeypatch.setattr(checkin_store, "logger", logger)
    return logger


def _mk_row(account_id: int, name: str, platform: str, *, owner: bool = False) -> _Row:
    row = _Row(
        {
            "id": account_id,
            "name": name,
            "jwt_enc": f"blob-{account_id}".encode(),
            "platform": platform,
            "device_map": {"k": 1},
        }
    )
    if owner:
        row["owner_user_id"] = "someone"
    return row


def test_bad_row_only_skips_itself(spy: _LoggerSpy) -> None:
    rows = [_mk_row(1, "好号A", "qoder"), _mk_row(2, "坏号B", "qoder"), _mk_row(3, "好号C", "trae")]

    out = checkin_store._accounts_from_rows(rows)

    assert [r["id"] for r in out] == [1, 3], "坏行只能摘自己,好行不得被连坐"
    assert out[0]["jwt"] == "jwt-for-blob-1"
    assert any("坏号B" in w for w in spy.warnings), "缺席必须留声:跳过的那枚要能被追责"


def test_all_bad_rows_yields_empty_and_shouts(spy: _LoggerSpy) -> None:
    out = checkin_store._accounts_from_rows([_mk_row(2, "坏号B", "qoder")])

    assert out == [], "唯一一枚解不开 ⇒ 本轮无账号,但不许抛"
    assert any("解不开" in w for w in spy.warnings)


def test_clean_batch_stays_silent(spy: _LoggerSpy) -> None:
    out = checkin_store._accounts_from_rows([_mk_row(1, "好号A", "qoder")])

    assert len(out) == 1
    assert spy.warnings == [], "反向牙:没有坏行却报『解不开』= 谎报,本门自己先红"


def test_with_owner_flag_controls_column(spy: _LoggerSpy) -> None:
    rows = [_mk_row(1, "好号A", "qoder", owner=True)]

    plain = checkin_store._accounts_from_rows(rows)
    full = checkin_store._accounts_from_rows(rows, with_owner=True)

    assert "owner_user_id" not in plain[0], "调度器面不得多出属主列"
    assert full[0]["owner_user_id"] == "someone", "快照面必须带回属主列"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
