#!/usr/bin/env python3
"""P0-45 零信任安全 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import zero_trust as zt


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_trust_levels(self):
        for t in ["untrusted", "low", "medium", "high", "critical"]:
            self.assertIn(t, zt.TRUST_LEVELS)

    def test_decisions(self):
        for d in ["allow", "deny", "challenge", "step_up"]:
            self.assertIn(d, zt.ACCESS_DECISIONS)

    def test_verification_types(self):
        for v in ["identity", "device", "location", "behavior", "risk_score"]:
            self.assertIn(v, zt.VERIFICATION_TYPES)


class TestIdentity(unittest.TestCase):
    def test_issue_basic(self):
        iid = zt.issue_identity("spiffe://default/svc-" + _u())
        self.assertIsInstance(iid, str)

    def test_issue_with_trust(self):
        iid = zt.issue_identity("spiffe://default/svc-" + _u(), trust_level="high")
        self.assertIsInstance(iid, str)

    def test_issue_invalid_trust(self):
        iid = zt.issue_identity("spiffe://default/svc-" + _u(), trust_level="invalid")
        self.assertIsInstance(iid, str)

    def test_issue_no_prefix(self):
        iid = zt.issue_identity("svc-" + _u())
        self.assertIsInstance(iid, str)


class TestRevoke(unittest.TestCase):
    def test_revoke_existing(self):
        sid = "spiffe://default/svc-" + _u()
        zt.issue_identity(sid)
        result = zt.revoke_identity(sid, "test")
        self.assertTrue(result)

    def test_revoke_nonexistent(self):
        result = zt.revoke_identity("spiffe://default/nonexistent-" + _u())
        self.assertFalse(result)


class TestPolicy(unittest.TestCase):
    def test_create_allow(self):
        pid = zt.create_policy("pol-" + _u(), "*", "/api", "read", "allow")
        self.assertIsInstance(pid, str)

    def test_create_deny(self):
        pid = zt.create_policy("pol-" + _u(), "*", "/admin", "write", "deny")
        self.assertIsInstance(pid, str)

    def test_create_invalid_effect(self):
        pid = zt.create_policy("pol-" + _u(), "*", "/api", "read", "invalid")
        self.assertIsInstance(pid, str)

    def test_create_with_conditions(self):
        pid = zt.create_policy("pol-" + _u(), "*", "/api", "read", "allow",
                                conditions={"mfa": True})
        self.assertIsInstance(pid, str)


class TestEvaluate(unittest.TestCase):
    def test_allow_high_trust(self):
        sid = "spiffe://default/svc-" + _u()
        zt.issue_identity(sid, trust_level="high")
        result = zt.evaluate_access(sid, "/api/data", verifications=["identity", "device"])
        self.assertEqual(result["decision"], "allow")

    def test_deny_no_identity(self):
        result = zt.evaluate_access("spiffe://default/nonexistent-" + _u(), "/api")
        self.assertEqual(result["decision"], "deny")

    def test_deny_revoked(self):
        sid = "spiffe://default/svc-" + _u()
        zt.issue_identity(sid)
        zt.revoke_identity(sid)
        result = zt.evaluate_access(sid, "/api")
        self.assertEqual(result["decision"], "deny")

    def test_step_up(self):
        sid = "spiffe://default/svc-" + _u()
        zt.issue_identity(sid, trust_level="low")
        result = zt.evaluate_access(sid, "/admin", verifications=[])
        self.assertEqual(result["decision"], "step_up")

    def test_with_source_ip(self):
        sid = "spiffe://default/svc-" + _u()
        zt.issue_identity(sid, trust_level="high")
        result = zt.evaluate_access(sid, "/api", source_ip="10.0.0.1",
                                      verifications=["identity"])
        self.assertIn("decision", result)


class TestDevice(unittest.TestCase):
    def test_register(self):
        did = zt.register_device("dev-" + _u())
        self.assertIsInstance(did, str)

    def test_register_with_type(self):
        did = zt.register_device("dev-" + _u(), "phone")
        self.assertIsInstance(did, str)

    def test_register_with_fp(self):
        did = zt.register_device("dev-" + _u(), "laptop", "fp123")
        self.assertIsInstance(did, str)


class TestVerification(unittest.TestCase):
    def test_record_pass(self):
        vid = zt.record_verification("spiffe://default/svc-" + _u(), "identity", True)
        self.assertIsInstance(vid, str)

    def test_record_fail(self):
        vid = zt.record_verification("spiffe://default/svc-" + _u(), "device", False)
        self.assertIsInstance(vid, str)

    def test_invalid_type(self):
        vid = zt.record_verification("spiffe://default/svc-" + _u(), "invalid", True)
        self.assertIsInstance(vid, str)


class TestRotation(unittest.TestCase):
    def test_rotate(self):
        sid = "spiffe://default/svc-" + _u()
        zt.issue_identity(sid)
        hid = zt.rotate_key(sid, "scheduled")
        self.assertIsInstance(hid, str)

    def test_rotate_nonexistent(self):
        hid = zt.rotate_key("spiffe://default/nonexistent-" + _u())
        self.assertIsInstance(hid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = zt.get_security_report()
        self.assertIn("total_identities", report)
        self.assertIn("revoked_identities", report)
        self.assertIn("denied_count", report)
        self.assertIn("step_up_count", report)
        self.assertIn("total_policies", report)
        self.assertIn("total_devices", report)


class TestFingerprint(unittest.TestCase):
    def test_fingerprint(self):
        fp = zt._fingerprint(b"test")
        self.assertEqual(len(fp), 32)

    def test_fingerprint_consistent(self):
        fp1 = zt._fingerprint(b"test")
        fp2 = zt._fingerprint(b"test")
        self.assertEqual(fp1, fp2)


if __name__ == "__main__":
    unittest.main()
