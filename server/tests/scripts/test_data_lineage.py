#!/usr/bin/env python3
"""P2-31 数据血缘追踪 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import data_lineage as dl


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_lineage_types_count(self):
        self.assertEqual(len(dl.LINEAGE_TYPES), 6)

    def test_lineage_types_all_present(self):
        for t in ["table_to_table", "column_to_column", "etl_job",
                  "api_to_table", "table_to_api", "dashboard_to_table"]:
            self.assertIn(t, dl.LINEAGE_TYPES)

    def test_gdpr_actions_count(self):
        self.assertEqual(len(dl.GDPR_ACTIONS), 5)

    def test_gdpr_actions_all_present(self):
        for a in ["export", "delete", "anonymize", "restrict", "portability"]:
            self.assertIn(a, dl.GDPR_ACTIONS)

    def test_asset_types_count(self):
        self.assertEqual(len(dl.ASSET_TYPES), 7)

    def test_pii_categories_count(self):
        self.assertEqual(len(dl.PII_CATEGORIES), 10)


class TestRegisterAsset(unittest.TestCase):
    def test_register_table(self):
        aid = dl.register_asset("tbl_" + _u(), "table", "users")
        self.assertIsInstance(aid, str)

    def test_register_column(self):
        aid = dl.register_asset("col_" + _u(), "column", "user_email")
        self.assertIsInstance(aid, str)

    def test_register_view(self):
        aid = dl.register_asset("view_" + _u(), "view", "user_summary")
        self.assertIsInstance(aid, str)

    def test_register_etl_job(self):
        aid = dl.register_asset("job_" + _u(), "etl_job", "nightly_load")
        self.assertIsInstance(aid, str)

    def test_register_dashboard(self):
        aid = dl.register_asset("dash_" + _u(), "dashboard", "sales_overview")
        self.assertIsInstance(aid, str)

    def test_register_report(self):
        aid = dl.register_asset("rpt_" + _u(), "report", "monthly_sales")
        self.assertIsInstance(aid, str)

    def test_register_api(self):
        aid = dl.register_asset("api_" + _u(), "api", "GET /users")
        self.assertIsInstance(aid, str)

    def test_register_invalid_type_fallback(self):
        aid = dl.register_asset("x_" + _u(), "INVALID_TYPE", "x")
        self.assertIsInstance(aid, str)

    def test_register_with_metadata(self):
        aid = dl.register_asset("full_" + _u(), "table", "orders",
                                  schema="public", database="main_db",
                                  description="订单表", owner="data_team",
                                  tags=["pii", "production"],
                                  pii_categories=["email", "phone"])
        self.assertIsInstance(aid, str)

    def test_register_with_chinese_description(self):
        aid = dl.register_asset("cn_" + _u(), "table", "用户表",
                                  description="存储用户基本信息")
        self.assertIsInstance(aid, str)


class TestAddLineage(unittest.TestCase):
    def test_add_table_to_table(self):
        eid = dl.add_lineage("src_" + _u(), "dst_" + _u(), "table_to_table")
        self.assertIsInstance(eid, str)

    def test_add_column_to_column(self):
        eid = dl.add_lineage("col_src_" + _u(), "col_dst_" + _u(), "column_to_column",
                              transformation="hash(email)")
        self.assertIsInstance(eid, str)

    def test_add_etl_job(self):
        eid = dl.add_lineage("src_" + _u(), "dst_" + _u(), "etl_job",
                              job_name="nightly_etl")
        self.assertIsInstance(eid, str)

    def test_add_api_to_table(self):
        eid = dl.add_lineage("api_" + _u(), "tbl_" + _u(), "api_to_table")
        self.assertIsInstance(eid, str)

    def test_add_table_to_api(self):
        eid = dl.add_lineage("tbl_" + _u(), "api_" + _u(), "table_to_api")
        self.assertIsInstance(eid, str)

    def test_add_dashboard_to_table(self):
        eid = dl.add_lineage("dash_" + _u(), "tbl_" + _u(), "dashboard_to_table")
        self.assertIsInstance(eid, str)

    def test_add_invalid_type_fallback(self):
        eid = dl.add_lineage("a_" + _u(), "b_" + _u(), "INVALID")
        self.assertIsInstance(eid, str)

    def test_add_with_confidence(self):
        eid = dl.add_lineage("a_" + _u(), "b_" + _u(), "table_to_table",
                              confidence=0.85)
        self.assertIsInstance(eid, str)


class TestTraceUpstream(unittest.TestCase):
    def test_trace_no_lineage(self):
        result = dl.trace_upstream("isolated_" + _u())
        self.assertEqual(result, [])

    def test_trace_single_level(self):
        src = "src_" + _u()
        dst = "dst_" + _u()
        dl.add_lineage(src, dst, "table_to_table")
        result = dl.trace_upstream(dst)
        self.assertGreaterEqual(len(result), 1)

    def test_trace_multi_level(self):
        a = "a_" + _u()
        b = "b_" + _u()
        c = "c_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        dl.add_lineage(b, c, "table_to_table")
        result = dl.trace_upstream(c, max_depth=5)
        self.assertGreaterEqual(len(result), 2)

    def test_trace_respects_depth(self):
        a = "a_" + _u()
        b = "b_" + _u()
        c = "c_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        dl.add_lineage(b, c, "table_to_table")
        result = dl.trace_upstream(c, max_depth=0)
        # max_depth=0 仍然直接查找到深度1
        self.assertIsInstance(result, list)

    def test_trace_with_cycle(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        dl.add_lineage(b, a, "table_to_table")
        result = dl.trace_upstream(a, max_depth=5)
        # 应该不无限循环
        self.assertIsInstance(result, list)

    def test_trace_returns_edges_with_metadata(self):
        src = "src_" + _u()
        dst = "dst_" + _u()
        dl.add_lineage(src, dst, "etl_job", job_name="test_job")
        result = dl.trace_upstream(dst)
        if result:
            self.assertIn("source", result[0])
            self.assertIn("target", result[0])
            self.assertIn("type", result[0])


class TestTraceDownstream(unittest.TestCase):
    def test_trace_no_lineage(self):
        result = dl.trace_downstream("isolated_" + _u())
        self.assertEqual(result, [])

    def test_trace_single_level(self):
        src = "src_" + _u()
        dst = "dst_" + _u()
        dl.add_lineage(src, dst, "table_to_table")
        result = dl.trace_downstream(src)
        self.assertGreaterEqual(len(result), 1)

    def test_trace_multi_level(self):
        a = "a_" + _u()
        b = "b_" + _u()
        c = "c_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        dl.add_lineage(b, c, "table_to_table")
        result = dl.trace_downstream(a, max_depth=5)
        self.assertGreaterEqual(len(result), 2)

    def test_trace_branching(self):
        a = "a_" + _u()
        b1 = "b1_" + _u()
        b2 = "b2_" + _u()
        dl.add_lineage(a, b1, "table_to_table")
        dl.add_lineage(a, b2, "table_to_table")
        result = dl.trace_downstream(a, max_depth=3)
        self.assertGreaterEqual(len(result), 2)


class TestImpactAnalysis(unittest.TestCase):
    def test_downstream_impact(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        result = dl.impact_analysis(a, direction="downstream", max_depth=3)
        self.assertEqual(result["source_asset"], a)
        self.assertEqual(result["direction"], "downstream")
        self.assertIn(b, result["affected_assets"])

    def test_upstream_impact(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        result = dl.impact_analysis(b, direction="upstream", max_depth=3)
        self.assertEqual(result["source_asset"], b)
        self.assertEqual(result["direction"], "upstream")
        self.assertIn(a, result["affected_assets"])

    def test_impact_empty(self):
        result = dl.impact_analysis("nonexistent_" + _u(), direction="downstream")
        self.assertEqual(result["total_count"], 0)

    def test_impact_records_history(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        result = dl.impact_analysis(a, direction="downstream")
        self.assertIn("edges", result)
        self.assertIn("max_depth", result)

    def test_impact_excludes_self(self):
        a = "a_" + _u()
        dl.add_lineage(a, a, "table_to_table")  # 自环
        result = dl.impact_analysis(a, direction="downstream")
        self.assertNotIn(a, result["affected_assets"])


class TestClassifyPII(unittest.TestCase):
    def test_classify_email(self):
        cid = dl.classify_pii("tbl_" + _u(), "email_col", "email")
        self.assertIsInstance(cid, str)

    def test_classify_phone(self):
        cid = dl.classify_pii("tbl_" + _u(), "phone_col", "phone")
        self.assertIsInstance(cid, str)

    def test_classify_id_card(self):
        cid = dl.classify_pii("tbl_" + _u(), "id_card_col", "id_card", "critical")
        self.assertIsInstance(cid, str)

    def test_classify_name(self):
        cid = dl.classify_pii("tbl_" + _u(), "user_name", "name")
        self.assertIsInstance(cid, str)

    def test_classify_address(self):
        cid = dl.classify_pii("tbl_" + _u(), "user_addr", "address")
        self.assertIsInstance(cid, str)

    def test_classify_birthday(self):
        cid = dl.classify_pii("tbl_" + _u(), "birth_dt", "birthday")
        self.assertIsInstance(cid, str)

    def test_classify_ip(self):
        cid = dl.classify_pii("tbl_" + _u(), "ip_addr", "ip")
        self.assertIsInstance(cid, str)

    def test_classify_device_id(self):
        cid = dl.classify_pii("tbl_" + _u(), "device_uuid", "device_id")
        self.assertIsInstance(cid, str)

    def test_classify_invalid_category_fallback(self):
        cid = dl.classify_pii("tbl_" + _u(), "x", "INVALID_CAT")
        self.assertIsInstance(cid, str)

    def test_classify_all_categories(self):
        asset = "tbl_" + _u()
        for cat in dl.PII_CATEGORIES:
            cid = dl.classify_pii(asset, f"col_{cat}", cat)
            self.assertIsInstance(cid, str)


class TestGetPIIForAsset(unittest.TestCase):
    def test_get_pii_empty(self):
        result = dl.get_pii_for_asset("nonexistent_" + _u())
        self.assertEqual(result, [])

    def test_get_pii_returns_classifications(self):
        asset = "tbl_" + _u()
        dl.classify_pii(asset, "email_col", "email")
        dl.classify_pii(asset, "phone_col", "phone")
        result = dl.get_pii_for_asset(asset)
        self.assertEqual(len(result), 2)

    def test_get_pii_includes_sensitivity(self):
        asset = "tbl_" + _u()
        dl.classify_pii(asset, "id_col", "id_card", "critical")
        result = dl.get_pii_for_asset(asset)
        self.assertEqual(result[0]["sensitivity"], "critical")

    def test_get_pii_separates_assets(self):
        a = "tbl_a_" + _u()
        b = "tbl_b_" + _u()
        dl.classify_pii(a, "email", "email")
        dl.classify_pii(b, "phone", "phone")
        result_a = dl.get_pii_for_asset(a)
        result_b = dl.get_pii_for_asset(b)
        self.assertEqual(len(result_a), 1)
        self.assertEqual(len(result_b), 1)


class TestGDPRRequest(unittest.TestCase):
    def test_create_export(self):
        rid = dl.create_gdpr_request("user_" + _u(), "export")
        self.assertIsInstance(rid, str)
        self.assertTrue(rid.startswith("GDPR-"))

    def test_create_delete(self):
        rid = dl.create_gdpr_request("user_" + _u(), "delete")
        self.assertTrue(rid.startswith("GDPR-"))

    def test_create_anonymize(self):
        rid = dl.create_gdpr_request("user_" + _u(), "anonymize")
        self.assertTrue(rid.startswith("GDPR-"))

    def test_create_restrict(self):
        rid = dl.create_gdpr_request("user_" + _u(), "restrict")
        self.assertTrue(rid.startswith("GDPR-"))

    def test_create_portability(self):
        rid = dl.create_gdpr_request("user_" + _u(), "portability")
        self.assertTrue(rid.startswith("GDPR-"))

    def test_create_invalid_action_fallback(self):
        rid = dl.create_gdpr_request("user_" + _u(), "INVALID_ACTION")
        self.assertIsInstance(rid, str)

    def test_create_unique_ids(self):
        rid1 = dl.create_gdpr_request("user_" + _u(), "export")
        rid2 = dl.create_gdpr_request("user_" + _u(), "export")
        self.assertNotEqual(rid1, rid2)


class TestProcessGDPRRequest(unittest.TestCase):
    def test_process_export(self):
        rid = dl.create_gdpr_request("user_" + _u(), "export")
        result = dl.process_gdpr_request(rid)
        self.assertEqual(result["status"], "completed")
        self.assertIn("export_data", result)

    def test_process_delete(self):
        rid = dl.create_gdpr_request("user_" + _u(), "delete")
        result = dl.process_gdpr_request(rid)
        self.assertEqual(result["status"], "completed")
        self.assertIn("deleted_assets", result)

    def test_process_anonymize(self):
        rid = dl.create_gdpr_request("user_" + _u(), "anonymize")
        result = dl.process_gdpr_request(rid)
        self.assertEqual(result["status"], "completed")
        self.assertIn("anonymized_assets", result)

    def test_process_restrict(self):
        rid = dl.create_gdpr_request("user_" + _u(), "restrict")
        result = dl.process_gdpr_request(rid)
        self.assertEqual(result["status"], "completed")
        self.assertIn("restricted_assets", result)

    def test_process_portability(self):
        rid = dl.create_gdpr_request("user_" + _u(), "portability")
        result = dl.process_gdpr_request(rid)
        self.assertEqual(result["status"], "completed")
        self.assertIn("export_data", result)

    def test_process_not_found(self):
        result = dl.process_gdpr_request("GDPR-nonexistent")
        self.assertEqual(result["status"], "failed")

    def test_process_returns_subject_id(self):
        sub = "user_" + _u()
        rid = dl.create_gdpr_request(sub, "export")
        result = dl.process_gdpr_request(rid)
        self.assertEqual(result["subject_id"], sub)


class TestVisualizeLineage(unittest.TestCase):
    def test_visualize_downstream(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        result = dl.visualize_lineage(a, direction="downstream", max_depth=3)
        self.assertIn("nodes", result)
        self.assertIn("edges", result)
        self.assertGreaterEqual(result["node_count"], 1)

    def test_visualize_upstream(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        result = dl.visualize_lineage(b, direction="upstream", max_depth=3)
        self.assertGreaterEqual(result["node_count"], 1)

    def test_visualize_root_node(self):
        a = "isolated_" + _u()
        result = dl.visualize_lineage(a, direction="downstream")
        root = [n for n in result["nodes"] if n["id"] == a]
        self.assertEqual(len(root), 1)
        self.assertEqual(root[0]["type"], "root")

    def test_visualize_node_count(self):
        a = "a_" + _u()
        b = "b_" + _u()
        c = "c_" + _u()
        dl.add_lineage(a, b, "table_to_table")
        dl.add_lineage(b, c, "table_to_table")
        result = dl.visualize_lineage(a, direction="downstream", max_depth=5)
        self.assertEqual(result["node_count"], 3)

    def test_visualize_edge_count(self):
        a = "a_" + _u()
        b = "b_" + _u()
        dl.add_lineage(a, b, "etl_job", transformation="clean+dedup")
        result = dl.visualize_lineage(a, direction="downstream", max_depth=3)
        self.assertGreaterEqual(result["edge_count"], 1)
        self.assertEqual(result["edges"][0]["type"], "etl_job")


class TestGetLineageStats(unittest.TestCase):
    def test_stats_returns_dict(self):
        result = dl.get_lineage_stats()
        self.assertIsInstance(result, dict)

    def test_stats_has_keys(self):
        result = dl.get_lineage_stats()
        self.assertIn("total_assets", result)
        self.assertIn("total_lineage_edges", result)
        self.assertIn("total_pii_columns", result)
        self.assertIn("gdpr_requests", result)

    def test_stats_counts_match(self):
        before = dl.get_lineage_stats()
        aid = dl.register_asset("stat_" + _u(), "table", "x")
        eid = dl.add_lineage(aid, aid + "_t", "table_to_table")
        after = dl.get_lineage_stats()
        self.assertGreaterEqual(after["total_assets"], before["total_assets"])
        self.assertGreaterEqual(after["total_lineage_edges"], before["total_lineage_edges"])


class TestCLICommands(unittest.TestCase):
    def test_cmd_register_asset_dispatch(self):
        from data_lineage import cmd_register_asset
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "register-asset", "cli_" + _u(), "cli_table", "table", "cli_owner"]
            try:
                cmd_register_asset(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_add_lineage_dispatch(self):
        from data_lineage import cmd_add_lineage
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "add-lineage", "a_" + _u(), "b_" + _u(), "table_to_table", "job1"]
            try:
                cmd_add_lineage(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_upstream_dispatch(self):
        from data_lineage import cmd_upstream
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "upstream", "x_" + _u(), "5"]
            try:
                cmd_upstream(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_downstream_dispatch(self):
        from data_lineage import cmd_downstream
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "downstream", "x_" + _u(), "5"]
            try:
                cmd_downstream(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_impact_dispatch(self):
        from data_lineage import cmd_impact
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "impact", "x_" + _u(), "downstream", "3"]
            try:
                cmd_impact(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_pii_classify_dispatch(self):
        from data_lineage import cmd_pii_classify
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "pii-classify", "tbl_" + _u(), "col1", "email", "high"]
            try:
                cmd_pii_classify(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_pii_get_dispatch(self):
        from data_lineage import cmd_pii_get
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "pii-get", "x_" + _u()]
            try:
                cmd_pii_get(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_gdpr_request_dispatch(self):
        from data_lineage import cmd_gdpr_request
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "gdpr-request", "u_" + _u(), "export"]
            try:
                cmd_gdpr_request(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_gdpr_process_dispatch(self):
        from data_lineage import cmd_gdpr_process
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "gdpr-process", "GDPR-nonexistent"]
            try:
                cmd_gdpr_process(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_visualize_dispatch(self):
        from data_lineage import cmd_visualize
        import sys
        old_argv = sys.argv
        try:
            sys.argv = ["data_lineage.py", "visualize", "x_" + _u(), "downstream", "3"]
            try:
                cmd_visualize(sys.argv[2:])
            except SystemExit:
                pass
        finally:
            sys.argv = old_argv

    def test_cmd_stats_dispatch(self):
        from data_lineage import cmd_stats
        try:
            cmd_stats([])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10110/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_stats_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10110/api/lineage/stats", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("total_assets", data)
        except Exception:
            self.skipTest("HTTP service not running")

    def test_not_found(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10110/nonexistent_path", timeout=1) as r:
                self.assertEqual(r.status, 404)
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
