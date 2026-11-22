# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""插件完整性收据(遵循统一工程规范)行为钉子。

钉可判定且可定位(逐条 verdict)/集合一致(孤儿·缺失两测)/fail-closed(清单坏判 invalid)
三轴,逐项反向变异:改条件必须翻转结论。
"""

from __future__ import annotations

import hashlib

import pytest

from app.core.plugin_receipt import (
    DiskPlugin,
    PluginVerdict,
    check_plugins,
    parse_receipt,
    scan_disk_plugins,
)

# 两个插件的干净登记(digests 任意但格式合法的 64hex)
_H_A = "a" * 64
_H_B = "b" * 64


def _receipt(entries, *, algorithm="RSA_PKCS1_SHA256", key_id="k1"):
    return {
        "algorithm": algorithm,
        "environment": "production",
        "key_id": key_id,
        "plugins": entries,
    }


def _disk(names_bytes):
    """由 {名: 字节} 造磁盘探测结果(sha256 用真实哈希以支撑 verify_hash=True)。"""
    out = {}
    for n, b in names_bytes.items():
        data = b if isinstance(b, bytes) else b.encode()
        out[n] = DiskPlugin(plugin=n, sha256=hashlib.sha256(data).hexdigest(), archive_bytes=len(data))
    return out


# ---- 1. 可判定且可定位 ----


def test_all_ok_when_disk_matches_manifest():
    r = _receipt([
        {"plugin": "browser", "sha256": _H_A, "archive_bytes": 10},
        {"plugin": "latex", "sha256": _H_B, "archive_bytes": 20},
    ])
    disk = {"browser": DiskPlugin("browser", _H_A, 10), "latex": DiskPlugin("latex", _H_B, 20)}
    res = check_plugins(r, disk)
    assert res.ok is True
    assert all(e.verdict is PluginVerdict.OK for e in res.entries)


def test_tampered_hash_is_flagged_not_skipped():
    r = _receipt([{"plugin": "browser", "sha256": _H_A, "archive_bytes": 10}])
    disk = {"browser": DiskPlugin("browser", "c" * 64, 10)}  # 内容被改
    res = check_plugins(r, disk)
    assert res.ok is False
    assert res.entries[0].verdict is PluginVerdict.TAMPERED


def test_missing_entry_detected():
    r = _receipt([{"plugin": "browser", "sha256": _H_A, "archive_bytes": 10}])
    res = check_plugins(r, {})  # 磁盘空
    assert res.ok is False
    assert res.entries[0].verdict is PluginVerdict.MISSING


def test_size_mismatch_detected():
    r = _receipt([{"plugin": "browser", "sha256": _H_A, "archive_bytes": 10}])
    disk = {"browser": DiskPlugin("browser", _H_A, 999)}  # 尺寸不符
    res = check_plugins(r, disk)
    assert res.entries[0].verdict is PluginVerdict.SIZE_MISMATCH


# ---- 2. 集合一致 ----


def test_extra_disk_plugin_is_orphan():
    r = _receipt([{"plugin": "browser", "sha256": _H_A, "archive_bytes": 10}])
    disk = {
        "browser": DiskPlugin("browser", _H_A, 10),
        "rogue": DiskPlugin("rogue", _H_B, 5),  # 清单未登记
    }
    res = check_plugins(r, disk)
    assert res.ok is False
    rogue = [e for e in res.entries if e.plugin == "rogue"]
    assert rogue and rogue[0].verdict is PluginVerdict.EXTRA


# ---- 3. fail-closed ----


def test_invalid_sha256_format_is_invalid_entry():
    r = _receipt([{"plugin": "browser", "sha256": "not-hex", "archive_bytes": 10}])
    res = check_plugins(r, {"browser": DiskPlugin("browser", _H_A, 10)})
    assert res.ok is False
    assert res.entries[0].verdict is PluginVerdict.INVALID_ENTRY


def test_negative_archive_bytes_is_invalid_entry():
    r = _receipt([{"plugin": "browser", "sha256": _H_A, "archive_bytes": -1}])
    res = check_plugins(r, {"browser": DiskPlugin("browser", _H_A, 10)})
    assert res.entries[0].verdict is PluginVerdict.INVALID_ENTRY


def test_verify_hash_false_skips_digest_compare():
    # 轻量探活:尺寸对、sha256 不比 → 仍 OK
    r = _receipt([{"plugin": "browser", "sha256": _H_A, "archive_bytes": 10}])
    disk = {"browser": DiskPlugin("browser", "c" * 64, 10)}  # hash 不符但跳过
    res = check_plugins(r, disk, verify_hash=False)
    assert res.entries[0].verdict is PluginVerdict.OK


# ---- 反向变异:解析层 fail-closed ----


def test_parse_receipt_rejects_non_dict():
    with pytest.raises(ValueError):
        parse_receipt([1, 2, 3])


def test_parse_receipt_rejects_plugins_not_list():
    with pytest.raises(ValueError):
        parse_receipt({"plugins": "nope"})


def test_parse_receipt_rejects_entry_missing_name():
    with pytest.raises(ValueError):
        parse_receipt({"plugins": [{"sha256": _H_A, "archive_bytes": 1}]})


# ---- 4. scan_disk_plugins 确定性 ----


def test_scan_disk_plugins_deterministic(tmp_path):
    (tmp_path / "p1").mkdir()
    (tmp_path / "p1" / "b.txt").write_bytes(b"BBB")
    (tmp_path / "p1" / "a.txt").write_bytes(b"AAA")  # 目录序与写入序不同
    a = scan_disk_plugins(tmp_path, plugin_dirs=["p1"])
    b = scan_disk_plugins(tmp_path, plugin_dirs=["p1"])
    assert a["p1"].sha256 == b["p1"].sha256
    assert a["p1"].archive_bytes == 6


def test_scan_disk_plugins_missing_root_empty(tmp_path):
    assert scan_disk_plugins(tmp_path / "nope") == {}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
