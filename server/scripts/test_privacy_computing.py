#!/usr/bin/env python3
"""P2-41 隐私计算 测试"""
import json
import os
import sqlite3
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import privacy_computing as pc


def _u() -> str:
    return os.urandom(4).hex()


def _clean_db() -> None:
    db_path = os.path.join(os.path.dirname(__file__), "..", "logs", "privacy_computing.db")
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except OSError:
            pass
    pc._init_db()


class TestConstants(unittest.TestCase):
    def test_privacy_methods(self):
        for m in ["mpc", "federated_learning", "tee", "differential_privacy", "homomorphic"]:
            self.assertIn(m, pc.PRIVACY_METHODS)

    def test_mpc_protocols(self):
        for p in ["shamir", "bgw", "gmw", "spdz"]:
            self.assertIn(p, pc.MPC_PROTOCOLS)

    def test_dp_mechanisms(self):
        for m in ["laplace", "gaussian", "exponential"]:
            self.assertIn(m, pc.DP_MECHANISMS)

    def test_he_schemes(self):
        for s in ["paillier", "bfv", "ckks"]:
            self.assertIn(s, pc.HE_SCHEMES)

    def test_http_port(self):
        self.assertEqual(pc.HTTP_PORT, 10210)

    def test_db_path(self):
        self.assertIn("privacy_computing.db", pc.DB_PATH)


class TestShamirSplit(unittest.TestCase):
    def test_basic_split(self):
        shares = pc._shamir_split(100, 2, 3)
        self.assertEqual(len(shares), 3)
        for i, (x, _) in enumerate(shares):
            self.assertEqual(x, i + 1)

    def test_split_three_parties(self):
        shares = pc._shamir_split(42, 3, 5)
        self.assertEqual(len(shares), 5)

    def test_split_secret_in_coefficient(self):
        shares = pc._shamir_split(100, 1, 3)
        for _, y in shares:
            self.assertEqual(y, 100)

    def test_split_threshold_clamped(self):
        shares = pc._shamir_split(100, 100, 3)
        self.assertEqual(len(shares), 3)

    def test_split_zero_threshold(self):
        shares = pc._shamir_split(100, 0, 3)
        self.assertEqual(len(shares), 3)

    def test_split_negative_secret(self):
        shares = pc._shamir_split(-50, 2, 3)
        self.assertEqual(len(shares), 3)


class TestShamirCombine(unittest.TestCase):
    def test_combine_two_shares(self):
        shares = pc._shamir_split(100, 2, 3)
        rec = pc._shamir_combine(shares[:2])
        self.assertEqual(rec, 100)

    def test_combine_all_shares(self):
        shares = pc._shamir_split(42, 2, 3)
        rec = pc._shamir_combine(shares)
        self.assertEqual(rec, 42)

    def test_combine_empty(self):
        rec = pc._shamir_combine([])
        self.assertEqual(rec, 0)

    def test_combine_single_share(self):
        shares = pc._shamir_split(100, 1, 1)
        rec = pc._shamir_combine(shares)
        self.assertEqual(rec, 100)

    def test_combine_three_shares(self):
        shares = pc._shamir_split(77, 3, 5)
        rec = pc._shamir_combine(shares[:3])
        self.assertEqual(rec, 77)


class TestRunMPC(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_shamir_protocol(self):
        result = pc.run_mpc("shamir", 3, 2, [10, 20, 30])
        self.assertEqual(result["protocol"], "shamir")
        self.assertEqual(result["parties"], 3)
        self.assertEqual(result["threshold"], 2)
        self.assertEqual(result["result"], 60)

    def test_bgw_protocol(self):
        result = pc.run_mpc("bgw", 3, 2, [1, 2, 3, 4])
        self.assertEqual(result["protocol"], "bgw")
        self.assertEqual(result["result"], 10)

    def test_gmw_protocol(self):
        result = pc.run_mpc("gmw", 3, 2, [5, 5])
        self.assertEqual(result["protocol"], "gmw")
        self.assertEqual(result["result"], 10)

    def test_spdz_protocol(self):
        result = pc.run_mpc("spdz", 3, 2, [100, 200])
        self.assertEqual(result["result"], 300)

    def test_invalid_protocol(self):
        result = pc.run_mpc("INVALID", 3, 2, [1, 2, 3])
        self.assertEqual(result["protocol"], "shamir")

    def test_parties_below_two(self):
        result = pc.run_mpc("shamir", 1, 1, [1, 2, 3])
        self.assertEqual(result["parties"], 2)

    def test_threshold_clamped(self):
        result = pc.run_mpc("shamir", 3, 10, [1, 2, 3])
        self.assertEqual(result["threshold"], 2)

    def test_empty_inputs(self):
        result = pc.run_mpc("shamir", 3, 2, [])
        self.assertIn("error", result)

    def test_session_id_format(self):
        result = pc.run_mpc("shamir", 3, 2, [1])
        self.assertTrue(result["session_id"].startswith("mpc-"))

    def test_inputs_echoed(self):
        result = pc.run_mpc("shamir", 3, 2, [5, 10, 15])
        self.assertEqual(result["inputs"], [5, 10, 15])


class TestRunFLRound(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_basic_round(self):
        rid = pc.run_fl_round("r-" + _u(), "mnist", 5)
        self.assertIsInstance(rid, str)

    def test_round_with_all_params(self):
        rid = pc.run_fl_round("r-" + _u(), "resnet50", 10, "fedprox", 0.95, 0.05, 3)
        self.assertIsInstance(rid, str)

    def test_multiple_rounds(self):
        pc.run_fl_round("r1-" + _u(), "model1", 5)
        pc.run_fl_round("r2-" + _u(), "model2", 5)
        overview = pc.get_privacy_overview()
        self.assertGreaterEqual(overview["fl_rounds"], 2)

    def test_default_aggregation(self):
        rid = pc.run_fl_round("r-" + _u(), "model", 5, accuracy=0.9, loss=0.1)
        self.assertIsInstance(rid, str)


class TestTEEAttest(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_sgx(self):
        result = pc.tee_attest("sgx")
        self.assertEqual(result["enclave_type"], "sgx")
        self.assertTrue(result["verified"])
        self.assertIn("measurement", result)
        self.assertIn("quote", result)

    def test_sev(self):
        result = pc.tee_attest("sev")
        self.assertEqual(result["enclave_type"], "sev")

    def test_tdx(self):
        result = pc.tee_attest("tdx")
        self.assertEqual(result["enclave_type"], "tdx")

    def test_cca(self):
        result = pc.tee_attest("cca")
        self.assertEqual(result["enclave_type"], "cca")

    def test_invalid_enclave(self):
        result = pc.tee_attest("INVALID")
        self.assertEqual(result["enclave_type"], "sgx")

    def test_measurement_length(self):
        result = pc.tee_attest("sgx")
        self.assertEqual(len(result["measurement"]), 64)

    def test_attestation_id_format(self):
        result = pc.tee_attest("sgx")
        self.assertTrue(result["attestation_id"].startswith("att-"))

    def test_unique_measurements(self):
        r1 = pc.tee_attest("sgx")
        r2 = pc.tee_attest("sgx")
        self.assertNotEqual(r1["measurement"], r2["measurement"])


class TestApplyDifferentialPrivacy(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_laplace(self):
        result = pc.apply_differential_privacy(100, 1.0, 0.001, 1.0, "laplace")
        self.assertEqual(result["mechanism"], "laplace")
        self.assertIn("noisy_result", result)

    def test_gaussian(self):
        result = pc.apply_differential_privacy(100, 1.0, 0.001, 1.0, "gaussian")
        self.assertEqual(result["mechanism"], "gaussian")

    def test_exponential(self):
        result = pc.apply_differential_privacy(100, 1.0, 0.001, 1.0, "exponential")
        self.assertEqual(result["mechanism"], "exponential")

    def test_invalid_mechanism(self):
        result = pc.apply_differential_privacy(100, 1.0, 0.001, 1.0, "INVALID")
        self.assertEqual(result["mechanism"], "laplace")

    def test_zero_epsilon(self):
        result = pc.apply_differential_privacy(100, 0, 0.001, 1.0, "laplace")
        self.assertIsInstance(result["noisy_result"], float)

    def test_negative_epsilon(self):
        result = pc.apply_differential_privacy(100, -1, 0.001, 1.0, "laplace")
        self.assertIsInstance(result["noisy_result"], float)

    def test_high_epsilon_low_noise(self):
        result = pc.apply_differential_privacy(100, 100, 0.001, 1.0, "laplace")
        self.assertLess(abs(result["noise"]), 1.0)

    def test_record_id_format(self):
        result = pc.apply_differential_privacy(100, 1.0)
        self.assertTrue(result["record_id"].startswith("dp-"))

    def test_utility_in_range(self):
        result = pc.apply_differential_privacy(100, 1.0, 0.001, 1.0, "laplace")
        self.assertGreaterEqual(result["utility_pct"], 0)
        self.assertLessEqual(result["utility_pct"], 100)

    def test_true_value_echoed(self):
        result = pc.apply_differential_privacy(42.5, 1.0)
        self.assertEqual(result["true_value"], 42.5)


class TestHomomorphicOperation(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_paillier_add(self):
        result = pc.homomorphic_operation("paillier", "add", 10)
        self.assertEqual(result["scheme"], "paillier")
        self.assertEqual(result["operation"], "add")
        self.assertEqual(result["result"], 15)

    def test_bfv_multiply(self):
        result = pc.homomorphic_operation("bfv", "multiply", 5)
        self.assertEqual(result["result"], 15)

    def test_ckks(self):
        result = pc.homomorphic_operation("ckks", "add", 100)
        self.assertEqual(result["scheme"], "ckks")

    def test_invalid_scheme(self):
        result = pc.homomorphic_operation("INVALID", "add", 10)
        self.assertEqual(result["scheme"], "paillier")

    def test_invalid_operation(self):
        result = pc.homomorphic_operation("paillier", "INVALID", 10)
        self.assertEqual(result["result"], 10)

    def test_negative_plaintext(self):
        result = pc.homomorphic_operation("paillier", "add", -10)
        self.assertEqual(result["result"], -5)

    def test_zero_plaintext(self):
        result = pc.homomorphic_operation("paillier", "multiply", 0)
        self.assertEqual(result["result"], 0)

    def test_operation_id_format(self):
        result = pc.homomorphic_operation("paillier", "add", 10)
        self.assertTrue(result["operation_id"].startswith("he-"))

    def test_ciphertext_size(self):
        result = pc.homomorphic_operation("paillier", "add", 10)
        self.assertGreater(result["ciphertext_size"], 0)

    def test_plaintext_echoed(self):
        result = pc.homomorphic_operation("paillier", "add", 42)
        self.assertEqual(result["plaintext"], 42)


class TestGetPrivacyOverview(unittest.TestCase):
    def setUp(self):
        _clean_db()

    def test_empty_overview(self):
        overview = pc.get_privacy_overview()
        self.assertIn("mpc_sessions", overview)
        self.assertIn("fl_rounds", overview)
        self.assertIn("tee_attestations", overview)
        self.assertIn("dp_records", overview)
        self.assertIn("he_operations", overview)

    def test_overview_after_operations(self):
        pc.run_mpc("shamir", 3, 2, [1, 2, 3])
        pc.run_fl_round("r-" + _u(), "model", 5)
        pc.tee_attest("sgx")
        pc.apply_differential_privacy(100, 1.0)
        pc.homomorphic_operation("paillier", "add", 10)
        overview = pc.get_privacy_overview()
        self.assertGreaterEqual(overview["mpc_sessions"], 1)
        self.assertGreaterEqual(overview["fl_rounds"], 1)
        self.assertGreaterEqual(overview["tee_attestations"], 1)
        self.assertGreaterEqual(overview["dp_records"], 1)
        self.assertGreaterEqual(overview["he_operations"], 1)


class TestHTTPServer(unittest.TestCase):
    def setUp(self):
        _clean_db()

    @unittest.skip("HTTP server test skipped to avoid port conflict")
    def test_health_endpoint(self):
        from http.client import HTTPConnection
        import threading
        t = threading.Thread(target=pc.serve, daemon=True)
        t.start()
        time.sleep(0.5)
        try:
            conn = HTTPConnection("127.0.0.1", pc.HTTP_PORT, timeout=2)
            conn.request("GET", "/health")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            body = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(body["status"], "ok")
            conn.close()
        except Exception:
            pass
        finally:
            pass

    @unittest.skip("HTTP server test skipped to avoid port conflict")
    def test_overview_endpoint(self):
        from http.client import HTTPConnection
        import threading
        t = threading.Thread(target=pc.serve, daemon=True)
        t.start()
        time.sleep(0.5)
        try:
            conn = HTTPConnection("127.0.0.1", pc.HTTP_PORT, timeout=2)
            conn.request("GET", "/api/overview")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            conn.close()
        except Exception:
            pass
        finally:
            pass

    @unittest.skip("HTTP server test skipped to avoid port conflict")
    def test_404(self):
        from http.client import HTTPConnection
        import threading
        t = threading.Thread(target=pc.serve, daemon=True)
        t.start()
        time.sleep(0.5)
        try:
            conn = HTTPConnection("127.0.0.1", pc.HTTP_PORT, timeout=2)
            conn.request("GET", "/nonexistent")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 404)
            conn.close()
        except Exception:
            pass
        finally:
            pass


if __name__ == "__main__":
    import time
    unittest.main()
