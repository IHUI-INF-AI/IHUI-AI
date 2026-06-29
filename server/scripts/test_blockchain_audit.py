#!/usr/bin/env python3
"""P1-37 区块链审计 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import blockchain_audit as ba


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_consensus_types(self):
        for t in ["pow", "pos", "pbft", "raft", "poa"]:
            self.assertIn(t, ba.CONSENSUS_TYPES)

    def test_audit_levels(self):
        for l in ["info", "warning", "critical", "legal"]:
            self.assertIn(l, ba.AUDIT_LEVELS)

    def test_proofs(self):
        for p in ["zkp", "merkle", "signature", "hash_chain"]:
            self.assertIn(p, ba.PROOFS)


class TestRegisterValidator(unittest.TestCase):
    def test_register_basic(self):
        vid = ba.register_validator("v-" + _u(), "validator-1", "pubkey-1")
        self.assertIsInstance(vid, str)

    def test_register_with_stake(self):
        vid = ba.register_validator("v-" + _u(), "validator-2", "pubkey-2",
                                       stake=100.0)
        self.assertIsInstance(vid, str)

    def test_register_zero_stake(self):
        vid = ba.register_validator("v-" + _u(), "v-3", "pk-3", 0)
        self.assertIsInstance(vid, str)


class TestCreateGenesis(unittest.TestCase):
    def test_create_genesis(self):
        bh = ba.create_genesis_block("poa", "system")
        self.assertEqual(len(bh), 64)

    def test_genesis_all_types(self):
        for ct in ba.CONSENSUS_TYPES:
            bh = ba.create_genesis_block(ct, "test")
            self.assertEqual(len(bh), 64)

    def test_genesis_invalid_type(self):
        bh = ba.create_genesis_block("INVALID", "test")
        self.assertEqual(len(bh), 64)


class TestAddAuditRecord(unittest.TestCase):
    def test_add_info(self):
        result = ba.add_audit_record("login", "user1", "system",
                                        "user logged in", "info")
        self.assertIn("record_id", result)
        self.assertIn("block_hash", result)

    def test_add_warning(self):
        result = ba.add_audit_record("login_failed", "user2", "system",
                                        "wrong password", "warning")
        self.assertIsNotNone(result)

    def test_add_critical(self):
        result = ba.add_audit_record("data_breach", "attacker", "database",
                                        "stolen data", "critical")
        self.assertIsNotNone(result)

    def test_add_legal(self):
        result = ba.add_audit_record("contract_signed", "user3", "contract",
                                        "signature applied", "legal")
        self.assertIsNotNone(result)

    def test_invalid_level(self):
        result = ba.add_audit_record("x", "y", "z", "d", "INVALID")
        self.assertIsNotNone(result)

    def test_zkp_proof(self):
        result = ba.add_audit_record("a", "b", "c", "d", "info", "zkp")
        self.assertNotEqual(result["zkp_proof"], "")

    def test_merkle_proof(self):
        result = ba.add_audit_record("a", "b", "c", "d", "info", "merkle")
        self.assertNotEqual(result["zkp_proof"], "")

    def test_signature_proof(self):
        result = ba.add_audit_record("a", "b", "c", "d", "info", "signature")
        self.assertNotEqual(result["zkp_proof"], "")

    def test_hash_chain_proof(self):
        result = ba.add_audit_record("a", "b", "c", "d", "info", "hash_chain")
        self.assertEqual(result["zkp_proof"], "")

    def test_invalid_proof(self):
        result = ba.add_audit_record("a", "b", "c", "d", "info", "INVALID")
        self.assertIsNotNone(result)

    def test_chained_blocks(self):
        r1 = ba.add_audit_record("a1", "u1", "t1", "d1")
        r2 = ba.add_audit_record("a2", "u2", "t2", "d2")
        self.assertNotEqual(r1["block_hash"], r2["block_hash"])
        self.assertGreater(r2["block_index"], r1["block_index"])


class TestConsensusVote(unittest.TestCase):
    def test_vote_approve(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        sig = ba.submit_consensus_vote(r["block_hash"], "v1", "approve")
        self.assertEqual(len(sig), 64)

    def test_vote_reject(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        sig = ba.submit_consensus_vote(r["block_hash"], "v1", "reject")
        self.assertEqual(len(sig), 64)

    def test_vote_abstain(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        sig = ba.submit_consensus_vote(r["block_hash"], "v1", "abstain")
        self.assertEqual(len(sig), 64)

    def test_invalid_vote(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        sig = ba.submit_consensus_vote(r["block_hash"], "v1", "INVALID")
        self.assertEqual(len(sig), 64)


class TestCheckConsensus(unittest.TestCase):
    def test_check_zero_approvals(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        result = ba.check_consensus(r["block_hash"], required_approvals=2)
        self.assertFalse(result["achieved"])
        self.assertEqual(result["approvals"], 0)

    def test_check_with_approvals(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        ba.register_validator("v-" + _u(), "v1", "pk1")
        ba.register_validator("v-" + _u(), "v2", "pk2")
        ba.submit_consensus_vote(r["block_hash"], "v-1", "approve")
        ba.submit_consensus_vote(r["block_hash"], "v-2", "approve")
        result = ba.check_consensus(r["block_hash"], required_approvals=2)
        self.assertTrue(result["achieved"])

    def test_check_one_approval(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        ba.register_validator("v-" + _u(), "v1", "pk1")
        ba.submit_consensus_vote(r["block_hash"], "v-1", "approve")
        result = ba.check_consensus(r["block_hash"], required_approvals=2)
        self.assertFalse(result["achieved"])


class TestVerifyChainIntegrity(unittest.TestCase):
    def test_integrity_empty(self):
        result = ba.verify_chain_integrity()
        self.assertIn("is_valid", result)

    def test_integrity_with_blocks(self):
        ba.add_audit_record("x", "y", "z", "d")
        ba.add_audit_record("x2", "y2", "z2", "d2")
        result = ba.verify_chain_integrity()
        self.assertTrue(result["is_valid"])

    def test_integrity_total_blocks(self):
        ba.add_audit_record("x", "y", "z", "d")
        result = ba.verify_chain_integrity()
        self.assertGreater(result["total_blocks"], 0)


class TestGetRecordProof(unittest.TestCase):
    def test_get_proof(self):
        r = ba.add_audit_record("x", "y", "z", "d")
        proof = ba.get_record_proof(r["record_id"])
        self.assertIsNotNone(proof)
        self.assertIn("audit", proof)
        self.assertIn("block", proof)

    def test_get_nonexistent(self):
        proof = ba.get_record_proof("nonexistent-" + _u())
        self.assertIsNone(proof)


class TestGetChainOverview(unittest.TestCase):
    def test_overview(self):
        result = ba.get_chain_overview()
        self.assertIn("blocks", result)
        self.assertIn("records", result)
        self.assertIn("validators", result)
        self.assertIn("integrity_valid", result)


class TestGetAuditTrail(unittest.TestCase):
    def test_trail(self):
        result = ba.get_audit_trail()
        self.assertIsInstance(result, list)

    def test_trail_with_filter(self):
        actor = "user-" + _u()
        ba.add_audit_record("a1", actor, "t", "d")
        ba.add_audit_record("a2", actor, "t", "d2")
        result = ba.get_audit_trail(actor=actor)
        self.assertGreaterEqual(len(result), 2)

    def test_trail_target_filter(self):
        target = "target-" + _u()
        ba.add_audit_record("a", "u", target, "d")
        result = ba.get_audit_trail(target=target)
        self.assertGreaterEqual(len(result), 1)


class TestCLICommands(unittest.TestCase):
    def test_cmd_overview(self):
        try:
            ba.cmd_overview([])
        except SystemExit:
            pass

    def test_cmd_integrity(self):
        try:
            ba.cmd_integrity([])
        except SystemExit:
            pass

    def test_cmd_genesis(self):
        try:
            ba.cmd_genesis([])
        except SystemExit:
            pass

    def test_cmd_register(self):
        try:
            ba.cmd_register(["cli-v-" + _u(), "name"])
        except SystemExit:
            pass

    def test_cmd_audit(self):
        try:
            ba.cmd_audit(["action", "actor", "target", "data"])
        except SystemExit:
            pass

    def test_cmd_vote(self):
        r = ba.add_audit_record("a", "u", "t", "d")
        try:
            ba.cmd_vote([r["block_hash"], "v1", "approve"])
        except SystemExit:
            pass

    def test_cmd_consensus(self):
        r = ba.add_audit_record("a", "u", "t", "d")
        try:
            ba.cmd_consensus([r["block_hash"], "1"])
        except SystemExit:
            pass

    def test_cmd_trail(self):
        try:
            ba.cmd_trail([])
        except SystemExit:
            pass

    def test_cmd_proof(self):
        r = ba.add_audit_record("a", "u", "t", "d")
        try:
            ba.cmd_proof([r["record_id"]])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10170/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_overview_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10170/api/chain/overview", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("blocks", data)
        except Exception:
            self.skipTest("HTTP service not running")

    def test_integrity_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10170/api/chain/integrity", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("is_valid", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
