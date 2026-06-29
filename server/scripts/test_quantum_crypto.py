#!/usr/bin/env python3
"""P2-40 量子加密 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import quantum_crypto as qc


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_kem_algorithms(self):
        for a in ["kyber512", "kyber768", "kyber1024"]:
            self.assertIn(a, qc.KEM_ALGORITHMS)

    def test_signature_algorithms(self):
        for a in ["dilithium2", "dilithium3", "dilithium5", "falcon512", "sphincs"]:
            self.assertIn(a, qc.SIGNATURE_ALGORITHMS)

    def test_key_states(self):
        for s in ["active", "rotating", "retired", "compromised"]:
            self.assertIn(s, qc.KEY_STATES)

    def test_hybrid_modes(self):
        for m in ["post_quantum_only", "classical_only", "hybrid"]:
            self.assertIn(m, qc.HYBRID_MODES)

    def test_rotation_triggers(self):
        for t in ["manual", "scheduled", "policy", "incident"]:
            self.assertIn(t, qc.ROTATION_TRIGGERS)


class TestGenerateKeypair(unittest.TestCase):
    def test_kyber512(self):
        kid = qc.generate_keypair("k-" + _u(), "kyber512")
        self.assertIsInstance(kid, str)

    def test_kyber768(self):
        kid = qc.generate_keypair("k-" + _u(), "kyber768")
        self.assertIsInstance(kid, str)

    def test_kyber1024(self):
        kid = qc.generate_keypair("k-" + _u(), "kyber1024")
        self.assertIsInstance(kid, str)

    def test_dilithium2(self):
        kid = qc.generate_keypair("k-" + _u(), "dilithium2")
        self.assertIsInstance(kid, str)

    def test_dilithium3(self):
        kid = qc.generate_keypair("k-" + _u(), "dilithium3")
        self.assertIsInstance(kid, str)

    def test_dilithium5(self):
        kid = qc.generate_keypair("k-" + _u(), "dilithium5")
        self.assertIsInstance(kid, str)

    def test_falcon(self):
        kid = qc.generate_keypair("k-" + _u(), "falcon512")
        self.assertIsInstance(kid, str)

    def test_sphincs(self):
        kid = qc.generate_keypair("k-" + _u(), "sphincs")
        self.assertIsInstance(kid, str)

    def test_invalid_algorithm(self):
        kid = qc.generate_keypair("k-" + _u(), "INVALID")
        self.assertIsInstance(kid, str)

    def test_with_purpose(self):
        kid = qc.generate_keypair("k-" + _u(), "kyber768", purpose="signature")
        self.assertIsInstance(kid, str)

    def test_with_expires(self):
        kid = qc.generate_keypair("k-" + _u(), "kyber768", expires_in_days=30)
        self.assertIsInstance(kid, str)


class TestRotateKey(unittest.TestCase):
    def test_rotate_manual(self):
        old = "k-" + _u()
        qc.generate_keypair(old, "kyber768")
        new = qc.rotate_key(old, "manual")
        self.assertTrue(new.startswith(old))

    def test_rotate_scheduled(self):
        old = "k-" + _u()
        qc.generate_keypair(old, "kyber768")
        new = qc.rotate_key(old, "scheduled")
        self.assertIsInstance(new, str)

    def test_rotate_policy(self):
        old = "k-" + _u()
        qc.generate_keypair(old, "kyber768")
        new = qc.rotate_key(old, "policy")
        self.assertIsInstance(new, str)

    def test_rotate_incident(self):
        old = "k-" + _u()
        qc.generate_keypair(old, "kyber768")
        new = qc.rotate_key(old, "incident")
        self.assertIsInstance(new, str)

    def test_rotate_nonexistent(self):
        new = qc.rotate_key("nonexistent-" + _u())
        self.assertEqual(new, "")

    def test_rotate_invalid_trigger(self):
        old = "k-" + _u()
        qc.generate_keypair(old, "kyber768")
        new = qc.rotate_key(old, "INVALID")
        self.assertIsInstance(new, str)


class TestRetireKey(unittest.TestCase):
    def test_retire_existing(self):
        kid = "k-" + _u()
        qc.generate_keypair(kid, "kyber768")
        ok = qc.retire_key(kid)
        self.assertTrue(ok)

    def test_retire_nonexistent(self):
        ok = qc.retire_key("nonexistent-" + _u())
        self.assertFalse(ok)


class TestHybridEncrypt(unittest.TestCase):
    def test_encrypt_hybrid(self):
        s = "k-" + _u()
        r = "k-" + _u()
        qc.generate_keypair(s, "kyber768")
        qc.generate_keypair(r, "kyber768")
        result = qc.hybrid_encrypt("secret", s, r, "hybrid")
        self.assertIn("message_id", result)

    def test_encrypt_pq_only(self):
        s = "k-" + _u()
        r = "k-" + _u()
        qc.generate_keypair(s, "kyber768")
        qc.generate_keypair(r, "kyber768")
        result = qc.hybrid_encrypt("secret", s, r, "post_quantum_only")
        self.assertEqual(result["mode"], "post_quantum_only")

    def test_encrypt_classical_only(self):
        s = "k-" + _u()
        r = "k-" + _u()
        qc.generate_keypair(s, "kyber768")
        qc.generate_keypair(r, "kyber768")
        result = qc.hybrid_encrypt("secret", s, r, "classical_only")
        self.assertEqual(result["mode"], "classical_only")

    def test_encrypt_invalid_mode(self):
        s = "k-" + _u()
        r = "k-" + _u()
        qc.generate_keypair(s, "kyber768")
        qc.generate_keypair(r, "kyber768")
        result = qc.hybrid_encrypt("secret", s, r, "INVALID")
        self.assertEqual(result["mode"], "hybrid")

    def test_encrypt_no_sender(self):
        r = "k-" + _u()
        qc.generate_keypair(r, "kyber768")
        result = qc.hybrid_encrypt("secret", "nonexistent", r)
        self.assertIn("error", result)

    def test_encrypt_no_recipient(self):
        s = "k-" + _u()
        qc.generate_keypair(s, "kyber768")
        result = qc.hybrid_encrypt("secret", s, "nonexistent")
        self.assertIn("error", result)


class TestCreateRotationPolicy(unittest.TestCase):
    def test_create(self):
        pid = qc.create_rotation_policy("p-" + _u(), "policy-1", 30, "scheduled")
        self.assertIsInstance(pid, str)

    def test_create_default(self):
        pid = qc.create_rotation_policy("p-" + _u(), "policy-2")
        self.assertIsInstance(pid, str)

    def test_create_all_triggers(self):
        for t in qc.ROTATION_TRIGGERS:
            pid = qc.create_rotation_policy("p-" + _u(), f"pol-{t}", 90, t)
            self.assertIsInstance(pid, str)

    def test_create_invalid_trigger(self):
        pid = qc.create_rotation_policy("p-" + _u(), "p", 90, "INVALID")
        self.assertIsInstance(pid, str)


class TestBenchmark(unittest.TestCase):
    def test_benchmark_kyber(self):
        result = qc.benchmark_algorithm("kyber768")
        self.assertIn("keygen_ms", result)
        self.assertIn("encrypt_ms", result)
        self.assertIn("decrypt_ms", result)
        self.assertIn("sign_ms", result)
        self.assertIn("verify_ms", result)

    def test_benchmark_dilithium(self):
        result = qc.benchmark_algorithm("dilithium3")
        self.assertIn("algorithm", result)

    def test_benchmark_all_kem(self):
        for a in qc.KEM_ALGORITHMS:
            result = qc.benchmark_algorithm(a)
            self.assertEqual(result["algorithm"], a)

    def test_benchmark_all_sig(self):
        for a in qc.SIGNATURE_ALGORITHMS:
            result = qc.benchmark_algorithm(a)
            self.assertEqual(result["algorithm"], a)


class TestGetKeyInfo(unittest.TestCase):
    def test_get_existing(self):
        kid = "k-" + _u()
        qc.generate_keypair(kid, "kyber768")
        info = qc.get_key_info(kid)
        self.assertIsNotNone(info)
        self.assertEqual(info["algorithm"], "kyber768")
        self.assertEqual(info["state"], "active")

    def test_get_nonexistent(self):
        info = qc.get_key_info("nonexistent-" + _u())
        self.assertIsNone(info)


class TestGetOverview(unittest.TestCase):
    def test_overview(self):
        result = qc.get_overview()
        self.assertIn("total_keys", result)
        self.assertIn("active_keys", result)
        self.assertIn("encrypted_messages", result)

    def test_overview_with_data(self):
        kid = "k-" + _u()
        qc.generate_keypair(kid, "kyber768")
        result = qc.get_overview()
        self.assertGreaterEqual(result["total_keys"], 1)


class TestCLICommands(unittest.TestCase):
    def test_cmd_overview(self):
        try:
            qc.cmd_overview([])
        except SystemExit:
            pass

    def test_cmd_keygen(self):
        try:
            qc.cmd_keygen(["cli-" + _u(), "kyber768"])
        except SystemExit:
            pass

    def test_cmd_rotate(self):
        kid = "cli-" + _u()
        qc.generate_keypair(kid, "kyber768")
        try:
            qc.cmd_rotate([kid, "manual"])
        except SystemExit:
            pass

    def test_cmd_retire(self):
        kid = "cli-" + _u()
        qc.generate_keypair(kid, "kyber768")
        try:
            qc.cmd_retire([kid])
        except SystemExit:
            pass

    def test_cmd_encrypt(self):
        s = "cli-" + _u()
        r = "cli-" + _u()
        qc.generate_keypair(s, "kyber768")
        qc.generate_keypair(r, "kyber768")
        try:
            qc.cmd_encrypt([s, r, "msg", "hybrid"])
        except SystemExit:
            pass

    def test_cmd_policy(self):
        try:
            qc.cmd_policy(["cli-" + _u(), "name", "30", "scheduled"])
        except SystemExit:
            pass

    def test_cmd_benchmark(self):
        try:
            qc.cmd_benchmark(["kyber768"])
        except SystemExit:
            pass

    def test_cmd_key_info(self):
        kid = "cli-" + _u()
        qc.generate_keypair(kid, "kyber768")
        try:
            qc.cmd_key_info([kid])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10200/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_overview_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10200/api/overview", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("total_keys", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
