# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""schema_check "枚举到 0 张表判无法判定"口径的单元测试。

锁定 decide_exit_code / log_report 的 0 表行为:扫描器失效(枚举到 0 张表)时
不得记绿 —— CLI 退出码必须非 0(2),日志必须点名"无法判定"。
同形判据参照:守门 117/157 的"枚举到 0 判死"。

测试覆盖:
- decide_exit_code:ok / error / inconclusive(0 表)三分支
- log_report:0 表时输出 ERROR"无法判定"(而非旧行为 WARNING"未扫描到")
"""

from __future__ import annotations

import logging

import pytest

from app.core.schema_check import (
    _SCHEMA_DIR,
    check_schema,
    decide_exit_code,
    log_report,
    parse_ts_table_fields,
)


class TestDecideExitCode:
    """退出码决策三分支。"""

    def test_ok_result_returns_zero(self):
        """有表、关键字段齐全 ⇒ 0(记绿)。"""
        result = {
            "ok": True,
            "total_tables": 13,
            "critical_missing": [],
            "tables": {},
        }
        assert decide_exit_code(result) == 0

    def test_error_result_returns_one(self):
        """有表但关键字段缺失 ⇒ 1。"""
        result = {
            "ok": False,
            "total_tables": 13,
            "critical_missing": ["ai_model_config.api_key_enc"],
            "tables": {},
        }
        assert decide_exit_code(result) == 1

    def test_zero_tables_returns_two_not_green(self):
        """枚举到 0 张表 ⇒ 2(无法判定),即便 result['ok'] 为 True 也不记绿。

        这是本测试的立票点:旧行为 `0 if result['ok'] else 1` 在扫描器失效时
        (total_tables=0 且无 error)会静默返回 0 记绿。
        """
        result = {
            "ok": True,  # 旧行为下这是"绿"——正是要堵的假阴性
            "total_tables": 0,
            "critical_missing": [],
            "tables": {},
        }
        assert decide_exit_code(result) == 2
        assert decide_exit_code(result) != 0

    def test_missing_total_tables_key_counts_as_zero(self):
        """total_tables 键缺失(畸形结果) ⇒ 按无法判定处理(fail-closed)。"""
        result = {"ok": True, "critical_missing": [], "tables": {}}
        assert decide_exit_code(result) == 2


class TestLogReportZeroTables:
    """log_report 的 0 表行为:ERROR"无法判定",不是 WARNING。"""

    def test_zero_tables_logs_error_not_warning(self, caplog: pytest.LogCaptureFixture):
        result = {
            "tables": {},
            "total_tables": 0,
            "schema_dir": "(not found)",
        }
        with caplog.at_level(logging.INFO, logger="app.core.schema_check"):
            log_report(result)
        errors = [r for r in caplog.records if r.levelno == logging.ERROR]
        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert any("无法判定" in r.getMessage() for r in errors), (
            "0 表必须以 ERROR 点名'无法判定'"
        )
        assert not any("未扫描到" in r.getMessage() for r in warnings), (
            "旧行为(WARNING'未扫描到任何 SQL 表引用')已废弃:那是记绿前的最后一句"
        )

    def test_nonzero_tables_does_not_trigger_inconclusive(self, caplog: pytest.LogCaptureFixture):
        """有表时不得误报'无法判定'。"""
        result = {
            "tables": {
                "ai_model_config": {
                    "exists": True,
                    "in_ts_schema": True,
                    "expected_source": "ts_schema",
                    "missing": [],
                    "extra": [],
                    "mismatched": {},
                    "critical_missing": [],
                }
            },
            "total_tables": 1,
            "schema_dir": "/tmp/schema",
        }
        with caplog.at_level(logging.INFO, logger="app.core.schema_check"):
            log_report(result)
        assert not any("无法判定" in r.getMessage() for r in caplog.records)


class TestMissingCriticalColumnFixture:
    """验收草案 ② 的可跑断言(免真库 fixture):

    "代码引用一个不存在的列(迁移未应用 ⇒ DB 缺列)" ⇒ check_schema 红,
    且 log 点名"关键字段缺失(查询会失败)"、退出码 1。
    用 FakePool 顶掉真 DB:对 ai_model_config 返回"全部期望列减去关键列
    api_key_enc"的 actual —— 正是迁移链缺一列时他人机器上的形态。
    """

    class FakeConn:
        def __init__(self, columns_by_table):
            self._cols = columns_by_table

        async def fetch(self, sql: str, table_name: str):
            cols = self._cols.get(table_name, {})
            return [
                {"column_name": name, "data_type": dtype, "udt_name": dtype}
                for name, dtype in cols.items()
            ]

    class FakePool:
        def __init__(self, conn):
            self._conn = conn

        def acquire(self):
            pool = self

            class _Ctx:
                async def __aenter__(self):
                    return pool._conn

                async def __aexit__(self, *exc):
                    return False

            return _Ctx()

    @pytest.mark.asyncio
    async def test_missing_critical_column_turns_red(self, caplog: pytest.LogCaptureFixture):
        expected = parse_ts_table_fields(_SCHEMA_DIR, "ai_model_config")
        assert expected, "ai_model_config 必须在 TS schema 中有定义(fixture 前提)"
        broken = {k: v for k, v in expected.items() if k != "api_key_enc"}
        conn = self.FakeConn({"ai_model_config": broken})
        result = await check_schema(pool=self.FakePool(conn))
        assert result["ok"] is False, "缺关键列必须红(迁移未应用 ⇒ 查询 500 的机器形态)"
        assert "ai_model_config.api_key_enc" in result["critical_missing"]
        assert decide_exit_code(result) == 1
        with caplog.at_level(logging.INFO, logger="app.core.schema_check"):
            log_report(result)
        assert any(
            "关键字段缺失(查询会失败)" in r.getMessage()
            for r in caplog.records
            if r.levelno == logging.ERROR
        ), "必须点名'关键字段缺失(查询会失败)'"
        assert any(
            "api_key_enc" in r.getMessage() for r in caplog.records if r.levelno == logging.ERROR
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
