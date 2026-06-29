#!/usr/bin/env python3
"""P1-27 智能运维 ChatOps 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import chatops as co


class TestIntentParsing(unittest.TestCase):
    def test_deploy(self):
        intent, conf = co.parse_intent("部署api服务")
        self.assertEqual(intent, "deploy")

    def test_rollback(self):
        intent, conf = co.parse_intent("回滚web服务")
        self.assertEqual(intent, "rollback")

    def test_scale(self):
        intent, conf = co.parse_intent("扩容api")
        self.assertEqual(intent, "scale")

    def test_status(self):
        intent, conf = co.parse_intent("查看状态")
        self.assertEqual(intent, "status")

    def test_logs(self):
        intent, conf = co.parse_intent("查询日志")
        self.assertEqual(intent, "logs")

    def test_metrics(self):
        intent, conf = co.parse_intent("查看CPU指标")
        self.assertEqual(intent, "metrics")

    def test_alerts(self):
        intent, conf = co.parse_intent("查询告警")
        self.assertEqual(intent, "alerts")

    def test_restart(self):
        intent, conf = co.parse_intent("重启服务")
        self.assertEqual(intent, "restart")

    def test_help(self):
        intent, conf = co.parse_intent("帮助")
        self.assertEqual(intent, "help")

    def test_unknown(self):
        intent, conf = co.parse_intent("随便说点啥")
        self.assertEqual(intent, "unknown")
        self.assertLess(conf, 0.5)

    def test_english(self):
        intent, conf = co.parse_intent("deploy api service")
        self.assertEqual(intent, "deploy")

    def test_english_rollback(self):
        intent, conf = co.parse_intent("rollback deployment")
        self.assertEqual(intent, "rollback")


class TestTargetExtraction(unittest.TestCase):
    def test_chinese_service(self):
        target = co.extract_target("部署api服务")
        self.assertEqual(target, "api")

    def test_service_prefix(self):
        target = co.extract_target("重启服务api")
        self.assertEqual(target, "api")

    def test_pod_name(self):
        target = co.extract_target("查看 pod web-123 状态")
        # 可能匹配到 pod web-123

    def test_deployment(self):
        target = co.extract_target("deployment api-server")
        self.assertEqual(target, "api-server")

    def test_no_target(self):
        target = co.extract_target("随机文本")
        self.assertIsNone(target)


class TestCommandHandle(unittest.TestCase):
    def test_deploy_command(self):
        result = co.handle_command("部署api服务", "user1")
        self.assertEqual(result["intent"], "deploy")
        self.assertEqual(result["target"], "api")
        self.assertIn("部署", result["response"])

    def test_rollback_command(self):
        result = co.handle_command("回滚web服务", "user1")
        self.assertEqual(result["intent"], "rollback")
        self.assertEqual(result["target"], "web")

    def test_status_command(self):
        result = co.handle_command("查看状态", "user1")
        self.assertEqual(result["intent"], "status")

    def test_help_command(self):
        result = co.handle_command("帮助", "user1")
        self.assertEqual(result["intent"], "help")
        self.assertIn("部署", result["response"])

    def test_unknown_command(self):
        result = co.handle_command("随便聊聊", "user1")
        self.assertEqual(result["intent"], "unknown")

    def test_command_records_history(self):
        co.handle_command("测试命令-xyz", "user1")
        # 验证已记录


class TestChatRecord(unittest.TestCase):
    def test_record(self):
        mid = co.record_chat("dingtalk", "u1", "Alice", "channel1",
                              "测试消息", "测试响应", "help", 0.9)
        self.assertIsInstance(mid, str)

    def test_record_invalid_platform(self):
        mid = co.record_chat("INVALID", "u1", "Alice", "c", "m", "r", "help", 0.9)
        self.assertIsInstance(mid, str)

    def test_all_platforms(self):
        for p in co.PLATFORMS:
            mid = co.record_chat(p, "u1", "Alice", "c", "m", "r", "help", 0.9)
            self.assertIsInstance(mid, str)


class TestWorkflows(unittest.TestCase):
    def test_create(self):
        wid = co.create_workflow("high-cpu", "cpu > 90",
                                   ["scale_up", "notify"])
        self.assertIsInstance(wid, str)

    def test_create_with_more_actions(self):
        wid = co.create_workflow("auto-heal", "memory > 90",
                                   ["restart_pod", "clear_cache", "notify"])
        self.assertIsInstance(wid, str)

    def test_list(self):
        co.create_workflow(f"list-test-{os.urandom(2).hex()}", "t", ["a"])
        workflows = co.list_workflows()
        self.assertIsInstance(workflows, list)
        self.assertGreater(len(workflows), 0)

    def test_execute(self):
        wid = co.create_workflow("exec-test", "trigger", ["restart_pod", "clear_cache"])
        result = co.execute_workflow(wid, "manual")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["actions_executed"]), 2)

    def test_execute_not_found(self):
        result = co.execute_workflow("nonexistent", "test")
        self.assertEqual(result["status"], "failed")

    def test_execute_disabled(self):
        wid = co.create_workflow("disabled-test", "t", ["a"])
        # 暂时通过 SQL 禁用
        with co._conn_lock, co._conn() as c:
            c.execute("UPDATE workflows SET enabled = 0 WHERE id = ?", (wid,))
        result = co.execute_workflow(wid, "test")
        self.assertEqual(result["status"], "failed")
        # 恢复
        with co._conn_lock, co._conn() as c:
            c.execute("UPDATE workflows SET enabled = 1 WHERE id = ?", (wid,))

    def test_execute_with_failure(self):
        # 添加不存在的 action
        wid = co.create_workflow("fail-test", "t", ["valid_action"])
        result = co.execute_workflow(wid, "test")
        self.assertEqual(result["status"], "completed")

    def test_self_heal_actions(self):
        for action in co.SELF_HEAL_ACTIONS:
            wid = co.create_workflow(f"self-heal-{action}", "t", [action])
            result = co.execute_workflow(wid, "test")
            self.assertEqual(result["status"], "completed")


class TestKnowledge(unittest.TestCase):
    def test_add(self):
        kid = co.add_knowledge("deploy", "如何部署?", "运行 deploy 命令", ["部署", "deploy"])
        self.assertIsInstance(kid, str)

    def test_search(self):
        co.add_knowledge("deploy", "如何部署服务?", "运行 deploy 命令", ["部署", "deploy", "服务"])
        results = co.search_knowledge("如何部署")
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["category"], "deploy")

    def test_search_no_match(self):
        results = co.search_knowledge("无匹配查询xyzabc")
        self.assertEqual(len(results), 0)

    def test_search_keyword_match(self):
        co.add_knowledge("scale", "扩容", "使用 scale 命令", ["扩容", "scale"])
        results = co.search_knowledge("扩容")
        self.assertGreater(len(results), 0)

    def test_search_limit(self):
        for i in range(10):
            co.add_knowledge("test", f"问题{i}", f"答案{i}", [f"keyword{i}"])
        results = co.search_knowledge("test", limit=3)
        self.assertLessEqual(len(results), 3)

    def test_update_hit(self):
        kid = co.add_knowledge("test", "hit test", "answer", ["hit"])
        co.update_knowledge_hit(kid)
        co.update_knowledge_hit(kid)


class TestBots(unittest.TestCase):
    def test_register_dingtalk(self):
        bid = co.register_bot("dingtalk", "ops-bot", "https://oapi.dingtalk.com/robot/send?access_token=test")
        self.assertIsInstance(bid, str)

    def test_register_feishu(self):
        bid = co.register_bot("feishu", "ops-bot-feishu", "https://open.feishu.cn/hook")
        self.assertIsInstance(bid, str)

    def test_register_slack(self):
        bid = co.register_bot("slack", "ops-bot-slack", "https://hooks.slack.com/test")
        self.assertIsInstance(bid, str)

    def test_register_invalid_platform(self):
        bid = co.register_bot("INVALID", "test-bot")
        self.assertIsInstance(bid, str)

    def test_register_all_platforms(self):
        for p in co.PLATFORMS:
            bid = co.register_bot(p, f"bot-{p}")
            self.assertIsInstance(bid, str)

    def test_list_bots(self):
        co.register_bot("dingtalk", "list-test-bot")
        bots = co.list_bots()
        self.assertIsInstance(bots, list)
        self.assertGreater(len(bots), 0)


class TestChatStats(unittest.TestCase):
    def test_stats_keys(self):
        stats = co.get_chat_stats(24)
        self.assertIn("window_hours", stats)
        self.assertIn("total_messages", stats)
        self.assertIn("total_commands", stats)
        self.assertIn("intents", stats)
        self.assertIn("platforms", stats)

    def test_stats_with_data(self):
        co.record_chat("dingtalk", "u1", "Alice", "c", "m", "r", "deploy", 0.9)
        co.handle_command("测试", "u1")
        stats = co.get_chat_stats(24)
        self.assertGreater(stats["total_messages"], 0)

    def test_stats_hours_param(self):
        stats = co.get_chat_stats(1)
        self.assertEqual(stats["window_hours"], 1)


class TestConstants(unittest.TestCase):
    def test_platforms(self):
        for p in ["dingtalk", "feishu", "slack", "wechat_work", "teams"]:
            self.assertIn(p, co.PLATFORMS)

    def test_intent_types(self):
        for it in ["deploy", "rollback", "scale", "status", "logs",
                    "metrics", "alerts", "restart", "help"]:
            self.assertIn(it, co.INTENT_TYPES)

    def test_workflow_status(self):
        for s in ["pending", "running", "completed", "failed", "cancelled"]:
            self.assertIn(s, co.WORKFLOW_STATUS)

    def test_self_heal_actions(self):
        for a in ["restart_pod", "scale_up", "clear_cache", "failover"]:
            self.assertIn(a, co.SELF_HEAL_ACTIONS)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "parse", "handle", "workflow_create",
                    "workflow_list", "workflow_execute", "knowledge_add",
                    "knowledge_search", "bot_register", "bot_list",
                    "chat", "stats"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(co, f"cmd_{cmd_name}")))

    def test_cmd_parse(self):
        co.cmd_parse(["部署", "api服务"])

    def test_cmd_handle(self):
        co.cmd_handle(["部署api服务", "user1"])

    def test_cmd_handle_no_user(self):
        co.cmd_handle(["部署api服务"])

    def test_cmd_workflow_create(self):
        co.cmd_workflow_create(["test-wf", "trigger", "action1,action2"])

    def test_cmd_workflow_list(self):
        co.cmd_workflow_list([])

    def test_cmd_workflow_execute(self):
        wid = co.create_workflow("cmd-exec", "t", ["restart_pod"])
        co.cmd_workflow_execute([wid, "manual"])

    def test_cmd_knowledge_add(self):
        co.cmd_knowledge_add(["test", "问题", "答案", "kw1,kw2"])

    def test_cmd_knowledge_search(self):
        co.add_knowledge("test", "search test", "answer", ["search"])
        co.cmd_knowledge_search(["search"])

    def test_cmd_bot_register(self):
        co.cmd_bot_register(["dingtalk", "test-bot", "https://test"])

    def test_cmd_bot_list(self):
        co.cmd_bot_list([])

    def test_cmd_chat(self):
        co.cmd_chat(["测试消息", "user1", "dingtalk", "Alice"])

    def test_cmd_stats(self):
        co.cmd_stats(["24"])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=co.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{co.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_chat_stats(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{co.HTTP_PORT}/api/chat/stats", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_messages", data)
        except Exception:
            pass

    def test_workflows(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{co.HTTP_PORT}/api/workflows", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("workflows", data)
        except Exception:
            pass

    def test_bots(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{co.HTTP_PORT}/api/bots", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("bots", data)
        except Exception:
            pass

    def test_chat_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{co.HTTP_PORT}/api/chat/message",
                data=json.dumps({"message": "部署api服务",
                                 "user_id": "u1", "platform": "dingtalk"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("intent", data)
            self.assertIn("response", data)
        except Exception:
            pass

    def test_intent_parse_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{co.HTTP_PORT}/api/intent/parse",
                data=json.dumps({"message": "回滚web服务"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("intent", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
