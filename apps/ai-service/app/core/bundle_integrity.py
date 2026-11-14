# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 bundle 完整性 ``bundle_integrity`` —— 防孤儿 + 签名校验(2026-11-15 立)。

来源(逆向 T3§H / T4§H)
------------------------------
- Trae 插件市场:"每个插件经 Trae 官方审查,安装前审查权限" ⇒ 引入物要有来源把关。
- Kiro hooks 主动拦截:引入面要能被"拦在前面"而不是事后补救。
- Augment:引入要可核对(引用闭环)。

本仓缺口(现读 external_runtime_import.py 确认)
-----------------------------------------------
- ``parse_external_bundle`` 只做形状校验:**不查引用是否指向存在的父条目**(孤儿)。
  比如 automations 里某任务引用 `capability_id="cap-x"`,而 capabilities 维没有
  cap-x ⇒ 导入后成孤儿,运行时才炸。
- **无 bundle 签名校验**:任何人可伪造 source / 内容,没有 HMAC 完整性把关。

=> 本模块补两件:**① 孤儿引用检测**(引用必须指向同 bundle 内存在的父);
**② HMAC-SHA256 签名校验**(发送方用共享密钥对 payload 签名,导入前验签)。

设计纪律
--------
- 防孤儿是**结构不变量**:同 bundle 内引用必须闭环。跨 bundle 引用一律视为孤儿
  (fail-closed),除非将来显式支持(现不支持,不冒绿)。
- 签名用 HMAC(共享密钥),密钥**不进代码、不进日志**,从环境/注入取;缺失即拒绝。
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass, field
from typing import Any

# 各维里"引用父 id"的字段名(指向同 bundle 另一维的条目)
# 形如 (子维, 引用字段, 父维)
_REFERENCE_EDGES: tuple[tuple[str, str, str], ...] = (
    ("automations", "capability_id", "capabilities"),
    ("capabilities", "memory_id", "memory"),
)


@dataclass
class IntegrityResult:
    """完整性校验结果(纯数据,可审计)。"""

    valid: bool
    problems: list[str] = field(default_factory=list)
    orphan_refs: list[str] = field(default_factory=list)  # "automations[0].capability_id -> cap-x"

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "problems": self.problems,
            "orphan_refs": self.orphan_refs,
        }


def check_orphan_refs(bundle: dict[str, Any]) -> IntegrityResult:
    """校验同 bundle 内的引用是否闭环(孤儿检测)。

    规则:子维条目里 ``引用字段`` 指向的 id,**必须在父维已存在**;不存在 ⇒ 孤儿。
    跨 bundle 引用(引用的 id 不在任何维)一律孤儿 —— 现不支持跨 bundle。

    Returns:
        ``IntegrityResult``。valid=False 表示存在孤儿或结构问题(不阻断列出全部)。
    """
    problems: list[str] = []
    orphans: list[str] = []
    namespaces = bundle.get("namespaces")
    if not isinstance(namespaces, dict):
        return IntegrityResult(
            valid=False,
            problems=["bundle.namespaces 不是对象,无法做引用校验"],
        )

    # 先建各维的 id 集合
    ids_by_ns: dict[str, set[str]] = {}
    for ns, block in namespaces.items():
        s: set[str] = set()
        if isinstance(block, dict) and isinstance(block.get("items"), list):
            for item in block["items"]:
                if isinstance(item, dict):
                    item_id = item.get("id")
                    if isinstance(item_id, str) and item_id:
                        s.add(item_id)
        ids_by_ns[ns] = s

    # 逐条边查引用
    for child_ns, ref_field, parent_ns in _REFERENCE_EDGES:
        child_block = namespaces.get(child_ns)
        if not (isinstance(child_block, dict) and isinstance(child_block.get("items"), list)):
            continue
        parent_ids = ids_by_ns.get(parent_ns, set())
        for idx, item in enumerate(child_block["items"]):
            if not isinstance(item, dict):
                continue
            ref = item.get(ref_field)
            if ref is None:
                continue  # 不引用 ⇒ 非孤儿
            if not isinstance(ref, str) or not ref:
                problems.append(f"{child_ns}[{idx}].{ref_field} 不是非空字符串: {ref!r}")
                continue
            if ref not in parent_ids:
                orphans.append(f"{child_ns}[{idx}].{ref_field} -> {ref}(父维 {parent_ns} 无此 id)")

    valid = not problems and not orphans
    return IntegrityResult(valid=valid, problems=problems, orphan_refs=orphans)


# ---------------------------------------------------------------------------
# HMAC-SHA256 签名校验
# ---------------------------------------------------------------------------

def _canonical_payload_bytes(payload: dict[str, Any]) -> bytes:
    """规范化 payload(排序键、紧凑分隔)⇒ 签名稳定,与 dict 插入序无关。"""
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def sign_bundle(payload: dict[str, Any], secret: bytes) -> str:
    """对 payload 计算 HMAC-SHA256 签名(十六进制)。发送方用。

    secret 为共享密钥,**不进日志、不进产物**。
    """
    return hmac.new(secret, _canonical_payload_bytes(payload), hashlib.sha256).hexdigest()


@dataclass
class SignatureResult:
    ok: bool
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "reason": self.reason}


def verify_bundle_signature(
    payload: dict[str, Any],
    signature: str,
    secret: bytes | None,
) -> SignatureResult:
    """验签(fail-closed)。

    - secret 缺失(None/空)⇒ 拒绝("密钥未配置"是多要一次定向说明,不是跳门);
    - signature 非字符串 ⇒ 拒绝;
    - HMAC 比对用 ``hmac.compare_digest`` 防时序攻击。

    payload **不含 signature 字段本身**(签名只覆盖业务内容)。
    """
    if not secret:
        return SignatureResult(ok=False, reason="签名密钥未配置,拒绝(fail-closed)")
    if not isinstance(signature, str) or not signature:
        return SignatureResult(ok=False, reason="签名缺失或非字符串")
    expected = sign_bundle(payload, secret)
    if not hmac.compare_digest(expected, signature):
        return SignatureResult(ok=False, reason="签名不匹配(payload 或密钥不符)")
    return SignatureResult(ok=True, reason="签名验证通过")


# ---------------------------------------------------------------------------
# 单元测试(纯逻辑)
# ---------------------------------------------------------------------------


def _bundle(namespaces: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        "specVersion": 1,
        "source": "test",
        "namespaces": {k: {"items": v} for k, v in namespaces.items()},
    }


def test_no_orphan_when_refs_resolve() -> None:
    b = _bundle({
        "capabilities": [{"id": "cap-x"}],
        "automations": [{"id": "t1", "capability_id": "cap-x"}],
    })
    r = check_orphan_refs(b)
    assert r.valid is True
    assert r.orphan_refs == []


def test_orphan_detected_when_parent_missing() -> None:
    b = _bundle({
        "capabilities": [],
        "automations": [{"id": "t1", "capability_id": "cap-x"}],
    })
    r = check_orphan_refs(b)
    assert r.valid is False
    assert len(r.orphan_refs) == 1
    assert "cap-x" in r.orphan_refs[0]


def test_memory_reference_edge_checked() -> None:
    b = _bundle({
        "memory": [],
        "capabilities": [{"id": "c1", "memory_id": "mem-1"}],
    })
    r = check_orphan_refs(b)
    assert r.valid is False
    assert any("mem-1" in o for o in r.orphan_refs)


def test_missing_ref_field_is_not_orphan() -> None:
    b = _bundle({"automations": [{"id": "t1"}]})
    r = check_orphan_refs(b)
    assert r.valid is True


def test_namespaces_not_dict_fails_closed() -> None:
    r = check_orphan_refs({"namespaces": "nope"})
    assert r.valid is False
    assert r.problems


def test_sign_and_verify_roundtrip() -> None:
    payload = {"namespaces": {"capabilities": {"items": [{"id": "c1"}]}}}
    sig = sign_bundle(payload, b"k3y")
    r = verify_bundle_signature(payload, sig, b"k3y")
    assert r.ok is True


def test_verify_fails_on_wrong_secret() -> None:
    payload = {"a": 1}
    sig = sign_bundle(payload, b"k3y")
    r = verify_bundle_signature(payload, sig, b"other")
    assert r.ok is False


def test_verify_fails_on_tampered_payload() -> None:
    payload = {"a": 1}
    sig = sign_bundle(payload, b"k3y")
    payload["a"] = 2  # 篡改
    r = verify_bundle_signature(payload, sig, b"k3y")
    assert r.ok is False


def test_verify_fails_closed_when_secret_missing() -> None:
    payload = {"a": 1}
    sig = sign_bundle(payload, b"k3y")
    r = verify_bundle_signature(payload, sig, None)
    assert r.ok is False
    assert "密钥未配置" in r.reason


def test_signature_is_deterministic_regardless_of_key_order() -> None:
    p1 = {"a": 1, "b": 2}
    p2 = {"b": 2, "a": 1}
    assert sign_bundle(p1, b"k") == sign_bundle(p2, b"k")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
