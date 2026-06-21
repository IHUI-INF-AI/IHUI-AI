#!/usr/bin/env python3
"""P2-52 脑机接口监控 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bci_monitor as bci


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_signals(self):
        for s in ["eeg", "emg", "eog", "ecog", "fnirs"]:
            self.assertIn(s, bci.SIGNAL_TYPES)

    def test_decoders(self):
        for d in ["motor", "speech", "visual", "emotion", "attention"]:
            self.assertIn(d, bci.DECODER_TYPES)

    def test_bands(self):
        for b in ["delta", "theta", "alpha", "beta", "gamma"]:
            self.assertIn(b, bci.BANDS)


class TestDevice(unittest.TestCase):
    def test_register_eeg(self):
        did = bci.register_device("dev-" + _u(), "eeg")
        self.assertIsInstance(did, str)

    def test_register_all_signals(self):
        for s in bci.SIGNAL_TYPES:
            did = bci.register_device("dev-" + _u(), s)
            self.assertIsInstance(did, str)

    def test_register_invalid(self):
        did = bci.register_device("dev-" + _u(), "invalid")
        self.assertIsInstance(did, str)

    def test_register_with_subject(self):
        did = bci.register_device("dev-" + _u(), "eeg", subject_id="S001")
        self.assertIsInstance(did, str)


class TestSample(unittest.TestCase):
    def test_record(self):
        sid = bci.record_sample("dev1", 0, 10.5, 10.0, "alpha")
        self.assertIsInstance(sid, str)

    def test_record_all_bands(self):
        for band in bci.BANDS:
            sid = bci.record_sample("dev1", 0, 10.5, 10.0, band)
            self.assertIsInstance(sid, str)

    def test_record_invalid_band(self):
        sid = bci.record_sample("dev1", 0, 10.5, 10.0, "invalid")
        self.assertIsInstance(sid, str)

    def test_random(self):
        result = bci.generate_random_sample("dev1")
        self.assertIn("band", result)
        self.assertIn("freq", result)
        self.assertIn("amp", result)


class TestDecoder(unittest.TestCase):
    def test_create_motor(self):
        did = bci.create_decoder("dec-" + _u(), "motor")
        self.assertIsInstance(did, str)

    def test_create_all_types(self):
        for d in bci.DECODER_TYPES:
            did = bci.create_decoder("dec-" + _u(), d)
            self.assertIsInstance(did, str)

    def test_create_invalid(self):
        did = bci.create_decoder("dec-" + _u(), "invalid")
        self.assertIsInstance(did, str)

    def test_create_with_params(self):
        did = bci.create_decoder("dec-" + _u(), "speech", "model.pth", 0.95, 50.0)
        self.assertIsInstance(did, str)


class TestDecoding(unittest.TestCase):
    def test_record(self):
        eid = bci.record_decoding("dev1", "dec1", "move_right", 0.85, 25.0)
        self.assertIsInstance(eid, str)

    def test_record_minimal(self):
        eid = bci.record_decoding("dev1", "dec1")
        self.assertIsInstance(eid, str)


class TestFeedback(unittest.TestCase):
    def test_record(self):
        fid = bci.record_feedback("S001", "alpha", 10.0, 9.5)
        self.assertIsInstance(fid, str)

    def test_record_all_bands(self):
        for b in bci.BANDS:
            fid = bci.record_feedback("S001", b, 10.0, 9.0)
            self.assertIsInstance(fid, str)

    def test_record_invalid_band(self):
        fid = bci.record_feedback("S001", "invalid", 10.0, 9.0)
        self.assertIsInstance(fid, str)


class TestSession(unittest.TestCase):
    def test_start(self):
        sid = bci.start_session("S001")
        self.assertIsInstance(sid, str)

    def test_end(self):
        sid = bci.start_session("S001")
        ok = bci.end_session(sid, 100, 0.75)
        self.assertTrue(ok)

    def test_end_nonexistent(self):
        ok = bci.end_session("nonexistent-" + _u(), 0, 0)
        self.assertFalse(ok)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = bci.get_bci_report()
        self.assertIn("total_devices", report)
        self.assertIn("connected_devices", report)
        self.assertIn("total_samples", report)
        self.assertIn("active_decoders", report)
        self.assertIn("decoding_events", report)
        self.assertIn("total_sessions", report)


if __name__ == "__main__":
    unittest.main()
