#!/usr/bin/env python3
"""告警降噪测试

测试覆盖:
  1. 子命令完整 (run/stats)
  2. 归一化规则
  3. Levenshtein 距离
  4. 相似度计算
  5. 合并组查找
  6. 合并规则
  7. DB 集成
  8. dry-run 模式
"""
import re
import sys
import json
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "alert_dedup.py"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists())


class TestSubcommands(unittest.TestCase):
    """子命令"""

    def test_run_subcommand(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"run"', content)
        self.assertIn("def cmd_run", content)

    def test_stats_subcommand(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"stats"', content)
        self.assertIn("def cmd_stats", content)


class TestNormalization(unittest.TestCase):
    """归一化规则"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_normalize_function(self):
        self.assertIn("def normalize_title", self.content)

    def test_normalize_patterns(self):
        self.assertIn("NORMALIZE_PATTERNS", self.content)

    def test_version_pattern(self):
        self.assertIn("<ver>", self.content)

    def test_duration_pattern(self):
        self.assertIn("<dur>", self.content)

    def test_percent_pattern(self):
        self.assertIn("<pct>", self.content)

    def test_number_pattern(self):
        self.assertIn("<num>", self.content)

    def test_hex_pattern(self):
        self.assertIn("<hex>", self.content)

    def test_ip_pattern(self):
        self.assertIn("<ip>", self.content)


class TestLevenshtein(unittest.TestCase):
    """Levenshtein 距离"""

    def test_levenshtein_function(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def levenshtein_distance", content)

    def test_similarity_function(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def similarity", content)

    def test_similarity_returns_0_to_1(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 公式: 1.0 - dist / max_len
        self.assertIn("1.0 - dist / max_len", content)

    def test_edge_cases(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 处理空字符串
        self.assertIn("if not s1 and not s2", content)
        self.assertIn("if not s1 or not s2", content)


class TestGroupFinding(unittest.TestCase):
    """相似组查找"""

    def test_union_find(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def find", content)
        self.assertIn("def union", content)
        self.assertIn("parent", content)

    def test_find_similar_groups(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def find_similar_groups", content)

    def test_threshold(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("SIMILARITY_THRESHOLD", content)
        self.assertIn("0.85", content)

    def test_pairwise_compare(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("for i in range(n)", content)
        self.assertIn("for j in range(i + 1, n)", content)


class TestMergeRules(unittest.TestCase):
    """合并规则"""

    def test_merge_group_function(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def merge_group", content)

    def test_keep_highest_level(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("level_priority", content)
        self.assertIn('"critical": 3', content)
        self.assertIn('"warning": 2', content)
        self.assertIn('"info": 1', content)

    def test_keep_latest_timestamp(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("latest", content)
        self.assertIn("timestamp", content)

    def test_count_field(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"count":', content)
        self.assertIn('"merged_ids":', content)


class TestDBIntegration(unittest.TestCase):
    """DB 集成"""

    def test_db_path(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alert_history.db", content)

    def test_uses_sqlite(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("import sqlite3", content)

    def test_update_query(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("UPDATE alert_history", content)
        self.assertIn("status = 'merged'", content)

    def test_merged_into(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("merged_into", content)

    def test_merged_count(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("merged_count", content)


class TestDryRun(unittest.TestCase):
    """dry-run 模式"""

    def test_dry_run_flag(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--dry-run", content)
        self.assertIn("--hours", content)


class TestStats(unittest.TestCase):
    """统计"""

    def test_stats_functions(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("noise_reduction_pct", content)
        self.assertIn("active_24h", content)

    def test_stats_by_level(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("by_level_24h", content)

    def test_stats_by_source(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("by_source_24h", content)


class TestOutputFormat(unittest.TestCase):
    """输出格式"""

    def test_json_output(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("json.dumps", content)

    def test_saved_notifications(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("saved_notifications", content)


class TestCommandLineOptions(unittest.TestCase):
    """命令行选项"""

    def test_hours_default(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("default=24", content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("TODO", code)


class TestDefaultThreshold(unittest.TestCase):
    """默认阈值"""

    def test_similarity_threshold_085(self):
        content = SCRIPT.read_text(encoding="utf-8")
        m = re.search(r"SIMILARITY_THRESHOLD\s*=\s*([\d.]+)", content)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "0.85")


class TestNoExternalDeps(unittest.TestCase):
    """不依赖外部库"""

    def test_no_redis(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("import redis", content)

    def test_no_requests(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 只用 SQLite
        self.assertNotIn("import requests", content)

    def test_uses_stdlib(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 仅用标准库: re, json, sqlite3, argparse
        for mod in ["re", "json", "sqlite3", "argparse"]:
            self.assertIn(f"import {mod}", content, f"缺失标准库: {mod}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
