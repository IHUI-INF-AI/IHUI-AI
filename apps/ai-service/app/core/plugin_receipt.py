# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""插件完整性收据(对标 Codex Desktop 26.1111 plugin-signatures,2026-11-15 逆向复现)。

为什么要有这一份:IHUI `bundle_integrity.py` 管的是**单个 bundle**的孤儿引用 +
HMAC-SHA256 签名(发送方/接收方共享密钥)。但 Codex 桌面端有一层**多插件清单完整性**:
一张 receipt.json 列出每个内置插件的 `sha256` + `archive_bytes` + 签发 `key_id`,
加载任一插件前逐项校验「磁盘上这份插件是不是签发时那一字节都不差的那一份」。
后果(若缺这层):
    - 单个插件被篡改/损坏/版本错配,宿主无从发现,直接加载执行(供应链风险);
    - 无法判定「清单里登记的插件」与「磁盘上实际存在的插件」集合是否一致
      (孤儿插件 / 缺失插件 / 多余插件);
    - 无法把「哪个插件坏了」定位到具体条目(缺逐项 verdict)。
(取证:`resources/plugin-signatures/openai-bundled/receipt.json` 字段
 `algorithm=RSA_PKCS1_SHA256` / `key_id` / `plugins[{plugin,sha256,archive_bytes}]`;
 `.codex-plugin/plugin.json` 用 hooks(Interrupt/SubagentStop/Stop→mcp_tool) 声明生命周期。
 本仓只复现「清单完整性 + 逐项校验」这一可判定范式,不实现 RSA 验签本身——
 那需私钥体系,属部署职责,与本仓 HMAC 层互补而非替代。)

超越轴(相对简单「全有全无」校验):
    - **可判定且可定位**:逐插件给 verdict(OK / 篡改 / 缺失 / 多余 / 尺寸错),不是一句"坏了";
    - **集合一致**:显式判「清单登记」vs「磁盘实际」的孤儿/缺失两侧;
    - **fail-closed**:清单元数据坏(非 dict / 缺字段 / sha256 非 64 hex)→ 该条判 invalid,不跳过。

显式不做:
    - 不做 RSA 验签(见上);不做插件加载/执行;不做 hooks 调度(本仓 hook_engine 已有);
    - 不做网络拉取比对(只比本地磁盘 vs 清单)。

纯逻辑层:吃「清单 dict + 磁盘探测函数」,吐逐项 verdict,**不做 IO 副作用**
(磁盘探测由调用方注入,可 mock 测试)。
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Final

# sha256 十六进制长度(64)与字符集校验:清单元数据坏要判 invalid,不静默跳过。
_SHA256_HEX_RE: Final[re.Pattern[str]] = re.compile(r"^[0-9a-f]{64}$")


class PluginVerdict(StrEnum):
    """一个插件条目的校验结论。"""

    OK = "ok"
    TAMPERED = "tampered"  # sha256 不匹配(内容被改/损坏/版本错配)
    MISSING = "missing"  # 清单登记但磁盘上找不到
    EXTRA = "extra"  # 磁盘上有但清单未登记(孤儿插件)
    SIZE_MISMATCH = "size-mismatch"  # 字节数不符(sha256 未算前的廉价预判)
    INVALID_ENTRY = "invalid-entry"  # 清单该条元数据坏(缺字段/sha256 非 64hex)


@dataclass(frozen=True)
class PluginReceiptEntry:
    """清单里一个插件的登记。"""

    plugin: str
    sha256: str
    archive_bytes: int


@dataclass(frozen=True)
class DiskPlugin:
    """磁盘上探测到的一个插件。"""

    plugin: str
    sha256: str
    archive_bytes: int


@dataclass
class PluginCheck:
    """单个插件校验结果。"""

    plugin: str
    verdict: PluginVerdict
    detail: str = ""

    def as_dict(self) -> dict[str, str]:
        return {"plugin": self.plugin, "verdict": self.verdict.value, "detail": self.detail}


@dataclass
class ReceiptCheckResult:
    """整张清单的校验结论。"""

    ok: bool  # 全部 OK 且无孤儿/缺失才 True
    entries: list[PluginCheck] = field(default_factory=list)
    algorithm: str = ""
    key_id: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "algorithm": self.algorithm,
            "keyId": self.key_id,
            "entries": [e.as_dict() for e in self.entries],
            "summary": {
                "total": len(self.entries),
                "ok": sum(1 for e in self.entries if e.verdict is PluginVerdict.OK),
                "failed": sum(1 for e in self.entries if e.verdict is not PluginVerdict.OK),
            },
        }


def parse_receipt(receipt: Any) -> tuple[list[PluginReceiptEntry], str, str]:
    """把 receipt.json 解析成条目列表 + algorithm + key_id。

    清单顶层坏(非 dict / plugins 非 list / 条目缺字段)→ 抛 ValueError(fail-closed),
    由调用方决定整批拒绝。单条 sha256 格式坏不在解析层判——留给校验层给 INVALID_ENTRY。
    """
    if not isinstance(receipt, dict):
        raise ValueError("receipt 必须是 dict")
    algorithm = str(receipt.get("algorithm", ""))
    key_id = str(receipt.get("key_id", ""))
    plugins = receipt.get("plugins")
    if not isinstance(plugins, list):
        raise ValueError("receipt.plugins 必须是 list")
    entries: list[PluginReceiptEntry] = []
    for raw in plugins:
        if not isinstance(raw, dict):
            raise ValueError("receipt.plugins 条目必须是 dict")
        name = raw.get("plugin")
        if not isinstance(name, str) or not name:
            raise ValueError("插件条目缺 plugin 名")
        entries.append(
            PluginReceiptEntry(
                plugin=name,
                sha256=str(raw.get("sha256", "")),
                archive_bytes=int(raw.get("archive_bytes", -1)),
            )
        )
    return entries, algorithm, key_id


def _hash_file(path: Path) -> tuple[str, int]:
    """读文件算 sha256 + 字节数。文件不存在由调用方在探测层处理。"""
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def check_plugins(
    receipt: Any,
    disk_plugins: dict[str, DiskPlugin],
    *,
    verify_hash: bool = True,
) -> ReceiptCheckResult:
    """校验「清单登记的插件」vs「磁盘实际插件」的一致性 + 逐条完整性。

    disk_plugins:磁盘探测结果(plugin 名 → sha256/bytes);由调用方扫描目录注入,
                  本模块不碰文件系统(纯逻辑可测)。
    verify_hash:  False 时跳过 sha256 比对(只做集合一致 + 尺寸预判),用于轻量探活。

    结论 ok=True 当且仅当:每条登记插件都 OK 且磁盘无孤儿(EXTRA)插件。
    """
    entries, algorithm, key_id = parse_receipt(receipt)
    checks: list[PluginCheck] = []
    seen_manifest: set[str] = set()

    for entry in entries:
        name = entry.plugin
        # 清单元数据自身校验(fail-closed:sha256 非 64hex 判 invalid,不跳过)
        if not _SHA256_HEX_RE.match(entry.sha256):
            checks.append(
                PluginCheck(name, PluginVerdict.INVALID_ENTRY, "清单 sha256 非 64 位十六进制")
            )
            seen_manifest.add(name)
            continue
        if entry.archive_bytes < 0:
            checks.append(PluginCheck(name, PluginVerdict.INVALID_ENTRY, "清单 archive_bytes 非法"))
            seen_manifest.add(name)
            continue

        seen_manifest.add(name)
        disk = disk_plugins.get(name)
        if disk is None:
            checks.append(PluginCheck(name, PluginVerdict.MISSING, "清单登记但磁盘缺失"))
            continue
        if disk.archive_bytes != entry.archive_bytes:
            checks.append(
                PluginCheck(
                    name,
                    PluginVerdict.SIZE_MISMATCH,
                    f"尺寸 {disk.archive_bytes} != 登记 {entry.archive_bytes}",
                )
            )
            continue
        if verify_hash and disk.sha256 != entry.sha256:
            checks.append(
                PluginCheck(name, PluginVerdict.TAMPERED, f"sha256 {disk.sha256[:12]}… != 登记 {entry.sha256[:12]}…")
            )
            continue
        checks.append(PluginCheck(name, PluginVerdict.OK))

    # 磁盘孤儿:有文件但清单未登记
    for name in sorted(set(disk_plugins) - seen_manifest):
        checks.append(PluginCheck(name, PluginVerdict.EXTRA, "磁盘存在但清单未登记"))

    ok = all(c.verdict is PluginVerdict.OK for c in checks) and len(checks) == len(entries)
    return ReceiptCheckResult(ok=ok, entries=checks, algorithm=algorithm, key_id=key_id)


def scan_disk_plugins(
    root: Path,
    *,
    plugin_dirs: list[str] | None = None,
) -> dict[str, DiskPlugin]:
    """扫描磁盘插件目录,算每个插件归档的 sha256 + 字节数(唯一 IO 入口,可被测试绕过)。

    约定:root 下每个子目录是一个插件,取其全部文件拼接哈希(确定性:按相对路径排序)。
    plugin_dirs:显式给定插件子目录名列表;缺省扫 root 下所有子目录。
    """
    result: dict[str, DiskPlugin] = {}
    if not root.is_dir():
        return result
    names = plugin_dirs if plugin_dirs is not None else sorted(
        p.name for p in root.iterdir() if p.is_dir()
    )
    for name in names:
        pdir = root / name
        if not pdir.is_dir():
            continue
        files = sorted(f for f in pdir.rglob("*") if f.is_file())
        hasher = hashlib.sha256()
        total = 0
        for f in files:
            data = f.read_bytes()
            hasher.update(f.relative_to(pdir).as_posix().encode("utf-8"))
            hasher.update(data)
            total += len(data)
        result[name] = DiskPlugin(plugin=name, sha256=hasher.hexdigest(), archive_bytes=total)
    return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
