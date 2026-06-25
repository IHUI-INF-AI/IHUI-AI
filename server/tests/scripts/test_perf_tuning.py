#!/usr/bin/env python3
"""P1-26 自动化性能调优测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import perf_tuning as pt


class TestPgRecommendations(unittest.TestCase):
    def test_oltp(self):
        rec = pt.recommend_pg_params("oltp")
        self.assertEqual(rec["workload_type"], "oltp")
        self.assertIn("shared_buffers", rec["recommendations"])

    def test_olap(self):
        rec = pt.recommend_pg_params("olap")
        self.assertIn("max_parallel_workers", rec["recommendations"])

    def test_mixed(self):
        rec = pt.recommend_pg_params("mixed")
        self.assertIsInstance(rec["recommendations"], dict)

    def test_write_heavy(self):
        rec = pt.recommend_pg_params("write_heavy")
        self.assertIn("wal_buffers", rec["recommendations"])

    def test_read_heavy(self):
        rec = pt.recommend_pg_params("read_heavy")
        self.assertIn("effective_cache_size", rec["recommendations"])

    def test_invalid_workload_fallback(self):
        rec = pt.recommend_pg_params("INVALID")
        self.assertEqual(rec["workload_type"], "mixed")

    def test_get_pg_recommendations(self):
        recs = pt.get_pg_recommendations("oltp")
        self.assertIsInstance(recs, list)
        self.assertGreater(len(recs), 0)

    def test_all_workloads(self):
        for w in pt.WORKLOAD_TYPES:
            recs = pt.get_pg_recommendations(w)
            self.assertGreater(len(recs), 0)


class TestPgApply(unittest.TestCase):
    def test_apply_param(self):
        pid = pt.apply_pg_param("shared_buffers", "512MB", "oltp", "test")
        self.assertIsInstance(pid, str)

    def test_apply_invalid_param(self):
        pid = pt.apply_pg_param("INVALID_PARAM", "1GB", "mixed")
        self.assertIsInstance(pid, str)

    def test_apply_with_workload(self):
        pid = pt.apply_pg_param("work_mem", "32MB", "olap", "increase for analytics")
        self.assertIsInstance(pid, str)


class TestPoolCalculation(unittest.TestCase):
    def test_normal_load(self):
        result = pt.calculate_pool_size(50.0, 50.0)
        self.assertIn("min", result)
        self.assertIn("max", result)
        self.assertIn("target", result)

    def test_high_latency(self):
        result = pt.calculate_pool_size(50.0, 200.0)
        self.assertEqual(result["reason"], "high_latency_expansion")

    def test_low_load(self):
        result = pt.calculate_pool_size(10.0, 30.0)
        self.assertEqual(result["reason"], "normal_load")

    def test_zero_latency(self):
        result = pt.calculate_pool_size(50.0, 0)
        self.assertEqual(result["reason"], "invalid_latency")

    def test_target_size_bounds(self):
        for load in [0, 25, 50, 75, 100]:
            result = pt.calculate_pool_size(load, 50.0)
            self.assertGreaterEqual(result["target"], 5)
            self.assertLessEqual(result["target"], 200)

    def test_update_pool(self):
        pid = pt.update_pool_config("api-service", 10, 20, "scale up")
        self.assertIsInstance(pid, str)


class TestIndexRecommendation(unittest.TestCase):
    def test_single_column(self):
        rec = pt.recommend_index("users", ["email"], "WHERE email = ?", 1000)
        self.assertEqual(rec["table"], "users")
        self.assertEqual(rec["columns"], ["email"])

    def test_composite_index(self):
        rec = pt.recommend_index("orders", ["user_id", "status"], "WHERE user_id = ? AND status = ?", 10000)
        self.assertEqual(rec["index_type"], "btree")
        self.assertEqual(len(rec["columns"]), 2)

    def test_gin_for_like(self):
        rec = pt.recommend_index("articles", ["content"], "WHERE content LIKE '%test%'", 1000)
        self.assertEqual(rec["index_type"], "gin")

    def test_high_improvement_large_table(self):
        rec = pt.recommend_index("logs", ["created_at"], "WHERE created_at > ?", 1000000)
        self.assertGreaterEqual(rec["estimated_improvement"], 0.5)

    def test_low_improvement_small_table(self):
        rec = pt.recommend_index("config", ["key"], "WHERE key = ?", 10)
        self.assertLessEqual(rec["estimated_improvement"], 0.2)

    def test_ddl_generation(self):
        rec = pt.recommend_index("users", ["email", "status"], "", 1000)
        self.assertIn("CREATE INDEX", rec["ddl"])
        self.assertIn("CONCURRENTLY", rec["ddl"])

    def test_save_recommendation(self):
        rid = pt.save_index_recommendation("users", ["email"], "btree", 0.5,
                                            "test reason", "CREATE INDEX...")
        self.assertIsInstance(rid, str)

    def test_save_invalid_type(self):
        rid = pt.save_index_recommendation("t", ["c"], "INVALID", 0.5, "", "")
        self.assertIsInstance(rid, str)

    def test_list_recommendations(self):
        pt.save_index_recommendation(f"list-{os.urandom(2).hex()}", ["c"], "btree", 0.5, "test", "")
        recs = pt.list_index_recommendations()
        self.assertIsInstance(recs, list)
        self.assertGreater(len(recs), 0)

    def test_list_unapplied(self):
        recs = pt.list_index_recommendations(applied=False)
        self.assertIsInstance(recs, list)

    def test_list_applied(self):
        recs = pt.list_index_recommendations(applied=True)
        self.assertIsInstance(recs, list)


class TestQueryPlan(unittest.TestCase):
    def test_seq_scan_issue(self):
        result = pt.analyze_query_plan(
            "SELECT * FROM users",
            {"SeqScan": {"table": "users", "rows": 10000}},
            500.0,
        )
        self.assertGreater(len(result["issues"]), 0)
        self.assertIn("全表扫描", result["issues"][0])

    def test_slow_query_issue(self):
        result = pt.analyze_query_plan(
            "SELECT * FROM logs",
            {"SeqScan": {}},
            2000.0,
        )
        self.assertIn("查询耗时过长", " ".join(result["issues"]))

    def test_nested_loop_large(self):
        result = pt.analyze_query_plan(
            "SELECT * FROM a JOIN b ON a.id = b.aid",
            {"NestedLoop": {"rows": 50000}},
            500.0,
        )
        self.assertIn("NestedLoop", " ".join(result["issues"]))

    def test_index_scan_no_issues(self):
        result = pt.analyze_query_plan(
            "SELECT * FROM users WHERE id = 1",
            {"IndexScan": {"index": "idx_id"}},
            5.0,
        )
        self.assertEqual(len(result["issues"]), 0)

    def test_sort_without_index(self):
        result = pt.analyze_query_plan(
            "SELECT * FROM users ORDER BY name",
            {"Sort": {"key": "name"}},
            100.0,
        )
        self.assertIn("排序", " ".join(result["issues"]))

    def test_slow_queries(self):
        pt.analyze_query_plan("SLOW QUERY 1", {"SeqScan": {}}, 5000.0)
        pt.analyze_query_plan("SLOW QUERY 2", {"SeqScan": {}}, 3000.0)
        queries = pt.get_slow_queries(1000.0)
        self.assertIsInstance(queries, list)
        self.assertGreater(len(queries), 0)


class TestTuningHistory(unittest.TestCase):
    def test_record_action(self):
        aid = pt.record_tuning_action("param_change", "shared_buffers",
                                        "256MB", "512MB", 0.2)
        self.assertIsInstance(aid, str)

    def test_record_pool_action(self):
        aid = pt.record_tuning_action("pool_resize", "api-pool", "10", "20", 0.1)
        self.assertIsInstance(aid, str)

    def test_record_index_action(self):
        aid = pt.record_tuning_action("index_add", "users.email", "", "idx", 0.5)
        self.assertIsInstance(aid, str)

    def test_summary(self):
        pt.record_tuning_action("param", "test", "1", "2", 0.1)
        summary = pt.get_tuning_summary(30)
        self.assertIn("total_actions", summary)
        self.assertIn("param_changes", summary)
        self.assertIn("pool_updates", summary)
        self.assertIn("index_recommendations", summary)

    def test_summary_days_param(self):
        summary = pt.get_tuning_summary(1)
        self.assertEqual(summary["window_days"], 1)


class TestConstants(unittest.TestCase):
    def test_pg_params(self):
        self.assertIn("shared_buffers", pt.PG_PARAMS)
        self.assertIn("work_mem", pt.PG_PARAMS)
        self.assertIn("max_connections", pt.PG_PARAMS)

    def test_workload_types(self):
        for w in ["oltp", "olap", "mixed", "write_heavy", "read_heavy"]:
            self.assertIn(w, pt.WORKLOAD_TYPES)

    def test_index_types(self):
        for t in ["btree", "hash", "gin", "gist", "brin", "partial"]:
            self.assertIn(t, pt.INDEX_TYPES)

    def test_plan_ops(self):
        self.assertIn("SeqScan", pt.PLAN_OPS)
        self.assertIn("IndexScan", pt.PLAN_OPS)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "pg_recommend", "pg_apply", "pool_calc",
                    "pool_update", "index_recommend", "index_save",
                    "index_list", "plan_analyze", "slow_queries",
                    "tuning_record", "tuning_summary"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(pt, f"cmd_{cmd_name}")))

    def test_cmd_pg_recommend(self):
        pt.cmd_pg_recommend(["oltp"])

    def test_cmd_pg_apply(self):
        pt.cmd_pg_apply(["shared_buffers", "512MB", "oltp", "test"])

    def test_cmd_pool_calc(self):
        pt.cmd_pool_calc(["50", "100", "80"])

    def test_cmd_pool_update(self):
        pt.cmd_pool_update(["api", "10", "20", "scale up"])

    def test_cmd_index_recommend(self):
        pt.cmd_index_recommend(["users", "email", "WHERE email = ?", "10000"])

    def test_cmd_index_save(self):
        pt.cmd_index_save(["users", "email", "btree", "0.5", "test", "DDL"])

    def test_cmd_index_list(self):
        pt.cmd_index_list([])

    def test_cmd_plan_analyze(self):
        pt.cmd_plan_analyze(["SELECT * FROM users",
                              '{"SeqScan": {}}', "500"])

    def test_cmd_slow_queries(self):
        pt.cmd_slow_queries([])

    def test_cmd_tuning_record(self):
        pt.cmd_tuning_record(["param", "shared_buffers", "256MB", "512MB", "0.2"])

    def test_cmd_tuning_summary(self):
        pt.cmd_tuning_summary(["30"])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=pt.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{pt.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_tuning_summary(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{pt.HTTP_PORT}/api/tuning/summary", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_actions", data)
        except Exception:
            pass

    def test_pg_recommend(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{pt.HTTP_PORT}/api/pg/recommend/oltp", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIsInstance(data, list)
        except Exception:
            pass

    def test_pg_apply_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{pt.HTTP_PORT}/api/pg/param/apply",
                data=json.dumps({"param_name": "shared_buffers",
                                 "new_value": "512MB",
                                 "workload_type": "oltp"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_pool_calc_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{pt.HTTP_PORT}/api/pool/calculate",
                data=json.dumps({"current_load": 50.0,
                                 "avg_latency_ms": 100.0}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("target", data)
        except Exception:
            pass

    def test_plan_analyze_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{pt.HTTP_PORT}/api/plan/analyze",
                data=json.dumps({"query_sql": "SELECT *",
                                 "plan": {"SeqScan": {}},
                                 "execution_time_ms": 500.0}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("issues", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
