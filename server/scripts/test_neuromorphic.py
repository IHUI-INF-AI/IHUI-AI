#!/usr/bin/env python3
"""P2-50 神经形态计算监控 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import neuromorphic as nm


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_chips(self):
        for c in ["loihi", "truenorth", "akida", "spinnaker", "dynap"]:
            self.assertIn(c, nm.CHIP_TYPES)

    def test_neurons(self):
        for n in ["lif", "izhikevich", "hodgkin_huxley", "adaptive_lif", "srnn"]:
            self.assertIn(n, nm.NEURON_MODELS)

    def test_learning(self):
        for r in ["stdp", "stdp_triplet", "hebbian", "anti_hebbian", "bcm"]:
            self.assertIn(r, nm.LEARNING_RULES)


class TestChip(unittest.TestCase):
    def test_register_loihi(self):
        cid = nm.register_chip("chip-" + _u(), "loihi", 128)
        self.assertIsInstance(cid, str)

    def test_register_all_chips(self):
        for c in nm.CHIP_TYPES:
            cid = nm.register_chip("chip-" + _u(), c, 64)
            self.assertIsInstance(cid, str)

    def test_register_invalid(self):
        cid = nm.register_chip("chip-" + _u(), "invalid", 64)
        self.assertIsInstance(cid, str)

    def test_register_with_neurons(self):
        cid = nm.register_chip("chip-" + _u(), "loihi", 128, 100000, 1000000)
        self.assertIsInstance(cid, str)


class TestSpike(unittest.TestCase):
    def test_record(self):
        sid = nm.record_spike("chip1", "n1", 25.0, 0)
        self.assertIsInstance(sid, str)

    def test_record_with_core(self):
        sid = nm.record_spike("chip1", "n1", 20.0, 5)
        self.assertIsInstance(sid, str)


class TestNetwork(unittest.TestCase):
    def test_create_lif(self):
        nid = nm.create_network("net-" + _u(), "chip1", "lif", "stdp", 3)
        self.assertIsInstance(nid, str)

    def test_create_all_neurons(self):
        for n in nm.NEURON_MODELS:
            nid = nm.create_network("net-" + _u(), "chip1", n, "stdp", 1)
            self.assertIsInstance(nid, str)

    def test_create_invalid_neuron(self):
        nid = nm.create_network("net-" + _u(), "chip1", "invalid", "stdp", 1)
        self.assertIsInstance(nid, str)

    def test_create_invalid_learning(self):
        nid = nm.create_network("net-" + _u(), "chip1", "lif", "invalid", 1)
        self.assertIsInstance(nid, str)


class TestMetric(unittest.TestCase):
    def test_record(self):
        nm.register_chip("chip-" + _u(), "loihi")
        mid = nm.record_chip_metric("chip1", 1000, 50, 100, 30.0)
        self.assertIsInstance(mid, str)

    def test_record_minimal(self):
        mid = nm.record_chip_metric("chip1")
        self.assertIsInstance(mid, str)


class TestLearning(unittest.TestCase):
    def test_record(self):
        nid = nm.create_network("net-" + _u(), "chip1", "lif", "stdp", 3)
        lid = nm.record_learning(nid, 1, 0.85, 0.15, 1000)
        self.assertIsInstance(lid, str)

    def test_record_multiple(self):
        nid = nm.create_network("net-" + _u(), "chip1", "lif", "stdp", 3)
        for e in range(5):
            lid = nm.record_learning(nid, e, 0.8 + e * 0.02, 0.2 - e * 0.02, 1000)
            self.assertIsInstance(lid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = nm.get_neuromorphic_report()
        self.assertIn("total_chips", report)
        self.assertIn("active_chips", report)
        self.assertIn("total_spikes", report)
        self.assertIn("total_networks", report)
        self.assertIn("total_neurons", report)


if __name__ == "__main__":
    unittest.main()
