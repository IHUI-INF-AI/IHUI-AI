#!/usr/bin/env python3
"""P1-46 边缘 AI 联邦推理 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import edge_federation as ef


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_statuses(self):
        for s in ["online", "offline", "training", "inferring", "syncing"]:
            self.assertIn(s, ef.NODE_STATUSES)

    def test_methods(self):
        for m in ["fedavg", "fedprox", "fednova", "secure_agg"]:
            self.assertIn(m, ef.AGGREGATION_METHODS)

    def test_model_statuses(self):
        for s in ["draft", "training", "ready", "deploying", "deprecated"]:
            self.assertIn(s, ef.MODEL_STATUSES)


class TestNode(unittest.TestCase):
    def test_register_basic(self):
        nid = ef.register_node("node-" + _u())
        self.assertIsInstance(nid, str)

    def test_register_with_gpu(self):
        nid = ef.register_node("node-" + _u(), gpu=True)
        self.assertIsInstance(nid, str)

    def test_register_with_region(self):
        nid = ef.register_node("node-" + _u(), region="us-west")
        self.assertIsInstance(nid, str)


class TestHeartbeat(unittest.TestCase):
    def test_heartbeat_existing(self):
        nid = "node-" + _u()
        ef.register_node(nid)
        result = ef.heartbeat(nid, "online")
        self.assertTrue(result)

    def test_heartbeat_nonexistent(self):
        result = ef.heartbeat("node-" + _u())
        self.assertFalse(result)

    def test_heartbeat_invalid_status(self):
        nid = "node-" + _u()
        ef.register_node(nid)
        result = ef.heartbeat(nid, "invalid")
        self.assertTrue(result)


class TestModel(unittest.TestCase):
    def test_create_basic(self):
        mid = ef.create_model("model-" + _u(), "1.0")
        self.assertIsInstance(mid, str)

    def test_create_with_size(self):
        mid = ef.create_model("model-" + _u(), "2.0", size_mb=128.5)
        self.assertIsInstance(mid, str)

    def test_update_status(self):
        name = "model-" + _u()
        ef.create_model(name, "1.0")
        result = ef.update_model_status(name, "1.0", "ready", 0.95)
        self.assertTrue(result)

    def test_update_invalid_status(self):
        name = "model-" + _u()
        ef.create_model(name, "1.0")
        result = ef.update_model_status(name, "1.0", "invalid")
        self.assertTrue(result)


class TestTraining(unittest.TestCase):
    def test_start_round(self):
        rid = ef.start_training_round("model-" + _u(), 1)
        self.assertIsInstance(rid, str)

    def test_start_with_method(self):
        rid = ef.start_training_round("model-" + _u(), 1, method="fedprox")
        self.assertIsInstance(rid, str)

    def test_start_with_nodes(self):
        rid = ef.start_training_round("model-" + _u(), 1, nodes=["n1", "n2"])
        self.assertIsInstance(rid, str)

    def test_invalid_method(self):
        rid = ef.start_training_round("model-" + _u(), 1, method="invalid")
        self.assertIsInstance(rid, str)

    def test_submit_gradient(self):
        rid = ef.start_training_round("model-" + _u(), 1)
        gid = ef.submit_gradient(rid, "node1", 100, 0.5)
        self.assertIsInstance(gid, str)

    def test_complete_round(self):
        rid = ef.start_training_round("model-" + _u(), 1)
        ok = ef.complete_training_round(rid, 0.95, 0.05)
        self.assertTrue(ok)


class TestAggregate(unittest.TestCase):
    def test_aggregate_empty(self):
        result = ef.aggregate_gradients("nonexistent")
        self.assertEqual(result["node_count"], 0)

    def test_aggregate_with_data(self):
        rid = ef.start_training_round("model-" + _u(), 1)
        ef.submit_gradient(rid, "n1", 100, 0.5)
        ef.submit_gradient(rid, "n2", 200, 0.3)
        result = ef.aggregate_gradients(rid, "fedavg")
        self.assertEqual(result["node_count"], 2)

    def test_aggregate_method(self):
        rid = ef.start_training_round("model-" + _u(), 1)
        ef.submit_gradient(rid, "n1", 100, 0.5)
        result = ef.aggregate_gradients(rid, "secure_agg")
        self.assertEqual(result["method"], "secure_agg")

    def test_aggregate_invalid_method(self):
        result = ef.aggregate_gradients("x", "invalid")
        self.assertEqual(result["method"], "fedavg")


class TestInference(unittest.TestCase):
    def test_record(self):
        iid = ef.record_inference("node1", "model-a", "input-data", "label1", 0.95, 15.5)
        self.assertIsInstance(iid, str)

    def test_record_minimal(self):
        iid = ef.record_inference("node1", "model-a", "input")
        self.assertIsInstance(iid, str)


class TestNodeMetric(unittest.TestCase):
    def test_record(self):
        mid = ef.record_node_metric("node1", 50.0, 60.0, 100)
        self.assertIsInstance(mid, str)

    def test_record_minimal(self):
        mid = ef.record_node_metric("node1")
        self.assertIsInstance(mid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = ef.get_federation_report()
        self.assertIn("total_nodes", report)
        self.assertIn("online_nodes", report)
        self.assertIn("total_models", report)
        self.assertIn("ready_models", report)
        self.assertIn("training_rounds", report)
        self.assertIn("completed_rounds", report)
        self.assertIn("total_inferences", report)


if __name__ == "__main__":
    unittest.main()
