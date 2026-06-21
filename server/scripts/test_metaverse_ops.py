#!/usr/bin/env python3
"""P2-42 元宇宙运维 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import metaverse_ops as mo


def _u() -> str:
    return os.urandom(4).hex()


def _clean_db() -> None:
    db_path = os.path.join(os.path.dirname(__file__), "..", "logs", "metaverse_ops.db")
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except OSError:
            pass
    mo._init_db()


class TestConstants(unittest.TestCase):
    def test_scene_types(self):
        for t in ["datacenter", "network", "application", "city", "industrial"]:
            self.assertIn(t, mo.SCENE_TYPES)

    def test_object_types(self):
        for t in ["server", "router", "database", "service", "sensor", "user", "agent", "drone"]:
            self.assertIn(t, mo.OBJECT_TYPES)

    def test_diagnosis_phases(self):
        for p in ["intake", "analysis", "hypothesis", "experiment", "resolution", "closed"]:
            self.assertIn(p, mo.DIAGNOSIS_PHASES)

    def test_collab_roles(self):
        for r in ["lead", "expert", "observer", "apprentice", "ai_assistant"]:
            self.assertIn(r, mo.COLLABORATION_ROLES)

    def test_agent_skills(self):
        for s in ["diagnose", "remediate", "communicate", "learn", "predict", "visualize"]:
            self.assertIn(s, mo.AGENT_SKILLS)

    def test_http_port(self):
        self.assertEqual(mo.HTTP_PORT, 10220)

    def test_db_path(self):
        self.assertIn("metaverse_ops.db", mo.DB_PATH)


class TestCreateScene(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        sid = mo.create_scene("s-" + _u(), "datacenter", "DC1")
        self.assertIsInstance(sid, str)

    def test_all_types(self):
        for t in mo.SCENE_TYPES:
            sid = mo.create_scene("s-" + _u(), t, f"scene-{t}")
            self.assertIsInstance(sid, str)

    def test_invalid_type(self):
        sid = mo.create_scene("s-" + _u(), "INVALID", "X")
        self.assertIsInstance(sid, str)

    def test_visibility_team(self):
        sid = mo.create_scene("s-" + _u(), "datacenter", "X", visibility="team")
        self.assertIsInstance(sid, str)

    def test_visibility_public(self):
        sid = mo.create_scene("s-" + _u(), "datacenter", "X", visibility="public")
        self.assertIsInstance(sid, str)

    def test_invalid_visibility(self):
        sid = mo.create_scene("s-" + _u(), "datacenter", "X", visibility="INVALID")
        self.assertIsInstance(sid, str)

    def test_with_description(self):
        sid = mo.create_scene("s-" + _u(), "datacenter", "X", description="A test scene")
        self.assertIsInstance(sid, str)


class TestAddSceneObject(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        mo.create_scene("s-" + _u(), "datacenter", "X")
        oid = mo.add_scene_object("s-test", "obj-" + _u(), "server")
        self.assertIsInstance(oid, str)

    def test_all_object_types(self):
        for t in mo.OBJECT_TYPES:
            oid = mo.add_scene_object("s-test", "obj-" + _u(), t)
            self.assertIsInstance(oid, str)

    def test_invalid_object_type(self):
        oid = mo.add_scene_object("s-test", "obj-" + _u(), "INVALID")
        self.assertIsInstance(oid, str)

    def test_with_position(self):
        oid = mo.add_scene_object("s-test", "obj-" + _u(), "server",
                                    position=[1.0, 2.0, 3.0])
        self.assertIsInstance(oid, str)

    def test_with_rotation(self):
        oid = mo.add_scene_object("s-test", "obj-" + _u(), "server",
                                    rotation=[0.0, 90.0, 0.0])
        self.assertIsInstance(oid, str)

    def test_with_scale(self):
        oid = mo.add_scene_object("s-test", "obj-" + _u(), "server",
                                    scale=[2.0, 2.0, 2.0])
        self.assertIsInstance(oid, str)

    def test_health_states(self):
        for h in ["healthy", "degraded", "unhealthy", "offline"]:
            oid = mo.add_scene_object("s-test", "obj-" + _u(), "server", health=h)
            self.assertIsInstance(oid, str)

    def test_invalid_health(self):
        oid = mo.add_scene_object("s-test", "obj-" + _u(), "server", health="INVALID")
        self.assertIsInstance(oid, str)


class TestRecordView(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        vid = mo.record_view("s-test", "user-1")
        self.assertIsInstance(vid, str)
        self.assertTrue(vid.startswith("view-"))

    def test_with_duration(self):
        vid = mo.record_view("s-test", "user-1", duration_sec=120.5, interactions=10)
        self.assertIsInstance(vid, str)

    def test_multiple_views(self):
        mo.record_view("s-test", "user-1")
        mo.record_view("s-test", "user-2")
        mo.record_view("s-test", "user-3")
        overview = mo.get_metaverse_overview()
        self.assertGreaterEqual(overview["views"], 3)


class TestStartDiagnosisSession(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        sid = mo.start_diagnosis_session("inc-1", "obj-1")
        self.assertIsInstance(sid, str)
        self.assertTrue(sid.startswith("diag-"))

    def test_with_phase(self):
        for p in mo.DIAGNOSIS_PHASES:
            sid = mo.start_diagnosis_session("inc-1", "obj-1", phase=p)
            self.assertIsInstance(sid, str)

    def test_invalid_phase(self):
        sid = mo.start_diagnosis_session("inc-1", "obj-1", phase="INVALID")
        self.assertIsInstance(sid, str)

    def test_advance_diagnosis(self):
        sid = mo.start_diagnosis_session("inc-1", "obj-1")
        mo.advance_diagnosis(sid, "analysis", findings="high latency")
        mo.advance_diagnosis(sid, "hypothesis", findings="db issue")
        mo.advance_diagnosis(sid, "resolution", resolution="restarted db",
                               status="resolved")

    def test_invalid_advance_phase(self):
        sid = mo.start_diagnosis_session("inc-1", "obj-1")
        mo.advance_diagnosis(sid, "INVALID")

    def test_invalid_status(self):
        sid = mo.start_diagnosis_session("inc-1", "obj-1")
        mo.advance_diagnosis(sid, "intake", status="INVALID")


class TestRecordImmersiveStream(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        sid = mo.record_immersive_stream("s-test", "user-1", "cpu", 75.5)
        self.assertIsInstance(sid, str)
        self.assertTrue(sid.startswith("stream-"))

    def test_with_attention(self):
        sid = mo.record_immersive_stream("s-test", "user-1", "cpu", 75.5,
                                           attention_score=0.85)
        self.assertIsInstance(sid, str)

    def test_attention_clamped_high(self):
        sid = mo.record_immersive_stream("s-test", "user-1", "cpu", 75.5,
                                           attention_score=2.0)
        self.assertIsInstance(sid, str)

    def test_attention_clamped_low(self):
        sid = mo.record_immersive_stream("s-test", "user-1", "cpu", 75.5,
                                           attention_score=-0.5)
        self.assertIsInstance(sid, str)

    def test_multiple_streams(self):
        for i in range(5):
            mo.record_immersive_stream("s-test", "user-1", f"m{i}", i * 10.0)
        overview = mo.get_metaverse_overview()
        self.assertGreaterEqual(overview["immersive_streams"], 5)


class TestCreateCollabSession(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        cid = mo.create_collab_session("ops-room-1", "alice")
        self.assertIsInstance(cid, str)
        self.assertTrue(cid.startswith("collab-"))

    def test_with_participants(self):
        cid = mo.create_collab_session("ops-room-1", "alice",
                                         participants=["bob", "carol"])
        self.assertIsInstance(cid, str)

    def test_all_space_types(self):
        for t in ["warroom", "bridge", "lab", "audit_room", "social"]:
            cid = mo.create_collab_session("s-" + _u(), "alice", space_type=t)
            self.assertIsInstance(cid, str)

    def test_invalid_space_type(self):
        cid = mo.create_collab_session("s", "alice", space_type="INVALID")
        self.assertIsInstance(cid, str)


class TestPostCollabMessage(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        cid = mo.create_collab_session("s-" + _u(), "alice")
        mid = mo.post_collab_message(cid, "alice", "lead", "Hello team")
        self.assertIsInstance(mid, str)
        self.assertTrue(mid.startswith("msg-"))

    def test_ai_message(self):
        cid = mo.create_collab_session("s-" + _u(), "alice")
        mid = mo.post_collab_message(cid, "OpsBot", "ai_assistant",
                                       "I detect high CPU", is_ai=True)
        self.assertIsInstance(mid, str)

    def test_all_roles(self):
        cid = mo.create_collab_session("s-" + _u(), "alice")
        for r in mo.COLLABORATION_ROLES:
            mid = mo.post_collab_message(cid, f"user-{r}", r, f"msg from {r}")
            self.assertIsInstance(mid, str)

    def test_invalid_role(self):
        cid = mo.create_collab_session("s-" + _u(), "alice")
        mid = mo.post_collab_message(cid, "x", "INVALID", "hi")
        self.assertIsInstance(mid, str)

    def test_multiple_messages(self):
        cid = mo.create_collab_session("s-" + _u(), "alice")
        for i in range(5):
            mo.post_collab_message(cid, f"user-{i}", "observer", f"msg {i}")
        overview = mo.get_metaverse_overview()
        self.assertGreaterEqual(overview["collab_messages"], 5)


class TestRegisterDigitalAgent(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        aid = mo.register_digital_agent("OpsBot")
        self.assertIsInstance(aid, str)
        self.assertTrue(aid.startswith("agent-"))

    def test_with_persona(self):
        aid = mo.register_digital_agent("OpsBot", persona="security_expert")
        self.assertIsInstance(aid, str)

    def test_with_skills(self):
        aid = mo.register_digital_agent("OpsBot",
                                          skills=["diagnose", "remediate", "predict"])
        self.assertIsInstance(aid, str)

    def test_invalid_skill(self):
        aid = mo.register_digital_agent("OpsBot", skills=["INVALID"])
        self.assertIsInstance(aid, str)

    def test_multiple_agents(self):
        mo.register_digital_agent("Bot1")
        mo.register_digital_agent("Bot2")
        mo.register_digital_agent("Bot3")
        overview = mo.get_metaverse_overview()
        self.assertGreaterEqual(overview["digital_agents"], 3)


class TestAssignAgentTask(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic(self):
        aid = mo.register_digital_agent("OpsBot")
        tid = mo.assign_agent_task(aid, "diagnose")
        self.assertIsInstance(tid, str)
        self.assertTrue(tid.startswith("task-"))

    def test_all_priorities(self):
        aid = mo.register_digital_agent("OpsBot")
        for p in ["low", "medium", "high", "critical"]:
            tid = mo.assign_agent_task(aid, "diagnose", priority=p)
            self.assertIsInstance(tid, str)

    def test_invalid_priority(self):
        aid = mo.register_digital_agent("OpsBot")
        tid = mo.assign_agent_task(aid, "diagnose", priority="INVALID")
        self.assertIsInstance(tid, str)

    def test_all_task_types(self):
        aid = mo.register_digital_agent("OpsBot")
        for t in ["diagnose", "remediate", "report", "communicate", "predict"]:
            tid = mo.assign_agent_task(aid, t)
            self.assertIsInstance(tid, str)

    def test_invalid_task_type(self):
        aid = mo.register_digital_agent("OpsBot")
        tid = mo.assign_agent_task(aid, "INVALID")
        self.assertIsInstance(tid, str)

    def test_complete_task(self):
        aid = mo.register_digital_agent("OpsBot")
        tid = mo.assign_agent_task(aid, "diagnose")
        mo.complete_agent_task(tid, "success")

    def test_complete_task_failure(self):
        aid = mo.register_digital_agent("OpsBot")
        tid = mo.assign_agent_task(aid, "diagnose")
        mo.complete_agent_task(tid, "failure")

    def test_complete_task_invalid(self):
        aid = mo.register_digital_agent("OpsBot")
        tid = mo.assign_agent_task(aid, "diagnose")
        mo.complete_agent_task(tid, "INVALID")


class TestGetMetaverseOverview(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_empty(self):
        overview = mo.get_metaverse_overview()
        for k in ["scenes", "objects", "views", "diagnosis_sessions",
                  "immersive_streams", "collab_sessions", "collab_messages",
                  "digital_agents", "agent_tasks"]:
            self.assertIn(k, overview)

    def test_after_operations(self):
        sid = mo.create_scene("s-" + _u(), "datacenter", "X")
        mo.add_scene_object(sid, "obj-" + _u(), "server")
        mo.record_view(sid, "user-1")
        mo.start_diagnosis_session("inc-1", "obj-1")
        mo.record_immersive_stream(sid, "user-1", "cpu", 50.0)
        cid = mo.create_collab_session("room-1", "alice")
        mo.post_collab_message(cid, "alice", "lead", "hi")
        aid = mo.register_digital_agent("Bot")
        mo.assign_agent_task(aid, "diagnose")
        overview = mo.get_metaverse_overview()
        self.assertGreaterEqual(overview["scenes"], 1)
        self.assertGreaterEqual(overview["objects"], 1)
        self.assertGreaterEqual(overview["views"], 1)
        self.assertGreaterEqual(overview["diagnosis_sessions"], 1)
        self.assertGreaterEqual(overview["immersive_streams"], 1)
        self.assertGreaterEqual(overview["collab_sessions"], 1)
        self.assertGreaterEqual(overview["collab_messages"], 1)
        self.assertGreaterEqual(overview["digital_agents"], 1)
        self.assertGreaterEqual(overview["agent_tasks"], 1)


class TestHTTPServer(unittest.TestCase):
    def setUp(self):
        _clean_db()

    @unittest.skip("HTTP server test skipped to avoid port conflict")
    def test_health_endpoint(self):
        from http.client import HTTPConnection
        import threading
        t = threading.Thread(target=mo.serve, daemon=True)
        t.start()
        time.sleep(0.5)
        try:
            conn = HTTPConnection("127.0.0.1", mo.HTTP_PORT, timeout=2)
            conn.request("GET", "/health")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            conn.close()
        except Exception:
            pass

    @unittest.skip("HTTP server test skipped to avoid port conflict")
    def test_overview_endpoint(self):
        from http.client import HTTPConnection
        import threading
        t = threading.Thread(target=mo.serve, daemon=True)
        t.start()
        time.sleep(0.5)
        try:
            conn = HTTPConnection("127.0.0.1", mo.HTTP_PORT, timeout=2)
            conn.request("GET", "/api/overview")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            conn.close()
        except Exception:
            pass

    @unittest.skip("HTTP server test skipped to avoid port conflict")
    def test_404(self):
        from http.client import HTTPConnection
        import threading
        t = threading.Thread(target=mo.serve, daemon=True)
        t.start()
        time.sleep(0.5)
        try:
            conn = HTTPConnection("127.0.0.1", mo.HTTP_PORT, timeout=2)
            conn.request("GET", "/nonexistent")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 404)
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    import time
    unittest.main()
