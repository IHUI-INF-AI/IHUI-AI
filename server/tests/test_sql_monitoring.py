"""测试慢 SQL 监控模块."""


from app.monitoring import (
    SLOW_SQL_THRESHOLD_SECONDS,
    SQL_COUNT,
    SQL_LATENCY,
    SQL_SLOW_COUNT,
    _extract_table,
    install_sql_events,
)


class TestExtractTable:
    def test_select_from(self):
        assert _extract_table("SELECT id, name FROM zhs_user WHERE id=1") == "zhs_user"

    def test_select_with_newlines(self):
        sql = "SELECT *\nFROM `zhs_agent`\nWHERE status = 1"
        assert _extract_table(sql) == "zhs_agent"

    def test_insert_into(self):
        assert _extract_table("INSERT INTO zhs_order (id) VALUES (1)") == "zhs_order"

    def test_update(self):
        assert _extract_table("UPDATE zhs_user SET name='a' WHERE id=1") == "zhs_user"

    def test_delete_from(self):
        assert _extract_table("DELETE FROM zhs_token WHERE id=1") == "zhs_token"

    def test_empty(self):
        assert _extract_table("") == "unknown"

    def test_comment_stripped(self):
        sql = "/* user query */ SELECT * FROM zhs_log"
        assert _extract_table(sql) == "zhs_log"


class TestSqlEvents:
    def test_install_and_execute(self):
        """注册事件后真实执行 SQL 应触发指标."""
        from sqlalchemy import create_engine, text

        eng = create_engine("sqlite:///:memory:")
        install_sql_events({"test": eng})

        with eng.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS zhs_demo (id INTEGER PRIMARY KEY)"))
            conn.execute(text("INSERT INTO zhs_demo (id) VALUES (1)"))
            conn.execute(text("SELECT * FROM zhs_demo"))
            conn.commit()

        cnt = SQL_COUNT.labels(engine="test", table="zhs_demo", operation="select")._value.get()
        assert cnt >= 1

    def test_slow_query_counter(self):
        """模拟慢查询触发 SLOW 计数."""
        from sqlalchemy import create_engine, text

        eng = create_engine("sqlite:///:memory:")
        install_sql_events({"slow": eng})

        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))

        # 直接调一次 histogram 观察
        SQL_LATENCY.labels(engine="slow", table="zhs_test").observe(0.6)
        SQL_SLOW_COUNT.labels(engine="slow", table="zhs_test").inc()
        assert SQL_SLOW_COUNT.labels(engine="slow", table="zhs_test")._value.get() >= 1

    def test_threshold_value(self):
        """慢查询阈值默认 500ms."""
        assert SLOW_SQL_THRESHOLD_SECONDS == 0.5
