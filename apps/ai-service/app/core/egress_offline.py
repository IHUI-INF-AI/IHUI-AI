# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""离线沙箱 WFP filter 构造器 —— 复现 Codex network_rule=Offline 范式。

来源：Codex Desktop 26.1106.6628.0 沙箱二进制取证。
Codex 在 Windows 用 Windows Filtering Platform (WFP) 实现 network_rule=Offline，
策略：permitLocal / blockSubnets(全网段) / blockDns / blockIcmp / fallbackBlock /
blockSubnetsOverridesPermittedAddresses。

本模块复现**纯声明层**：只构造 WFP filter 配置 dict + 校验声明一致性，
绝不调用 netsh / WFP API / 起任何网络进程（调用方自行决定如何投给 OS 层）。
"""

from __future__ import annotations

import ipaddress
from typing import Any


def build_offline_filter() -> dict[str, Any]:
    """生成 offline WFP filter 声明：全网段封堵 + DNS/ICMP/LMNR/WS-Discovery 全禁。

    与 Codex WFP filter 的语义对齐：
    - action = "Block", direction = "Outbound", layer = "ALE_AUTH_CONNECT_V4/V6"
    - blockSubnets 列出 IPv4 + IPv6 全空间
    - blockSubnetsOverridesPermittedAddresses = true（permitted 只能豁免，不能翻案）
    - 协议层封堵：UDP/53 DNS、UDP/5353 mDNS、UDP/5355 LLNR、UDP/3702 WS-Discovery、ICMP 全部
    - fallback = Block（规则引擎失效时也阻断）
    """
    return {
        "name": "IHUI-OFFLINE-EGRESS",
        "description": "离线沙箱：阻断一切出站连接（Codex Offline 范式复现）",
        "action": "Block",
        "direction": "Outbound",
        "layer": ["ALE_AUTH_CONNECT_V4", "ALE_AUTH_CONNECT_V6"],
        "blockSubnets": [
            "0.0.0.0/0",
            "::/0",
        ],
        "blockSubnetsOverridesPermittedAddresses": True,
        "blockDns": True,
        "blockIcmp": True,
        "blockLlnr": True,
        "blockWsDiscovery": True,
        "blockMdns": True,
        "fallbackBlock": True,
    }


def validate_offline_config(config: dict[str, Any]) -> dict[str, Any]:
    """校验 offline filter 配置声明一致性。

    判据：
    - action 必须 Block、direction 必须 Outbound（离线只能拒，不能放）
    - blockSubnets 必须覆盖 0.0.0.0/0 或 ::/0（否则有泄露面）
    - permittedAddresses 若有，每一项必须在 blockSubnets 覆盖范围内
    - blockDns / blockIcmp / fallbackBlock 至少一个为 True

    返回：{valid: bool, reason: str, details: dict}
    """
    issues: list[str] = []
    details: dict[str, Any] = {}

    # action / direction 硬性
    if config.get("action") != "Block":
        issues.append(f"action 必须为 Block，实际={config.get('action')!r}")
    if config.get("direction") != "Outbound":
        issues.append(f"direction 必须为 Outbound，实际={config.get('direction')!r}")

    # blockSubnets 必须覆盖全空间
    subnets_raw = config.get("blockSubnets", [])
    subnets: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for s in subnets_raw:
        try:
            subnets.append(ipaddress.ip_network(s, strict=False))
        except ValueError as exc:
            issues.append(f"blockSubnets 无效 CIDR {s!r}: {exc}")
    covers_v4 = any(n.version == 4 and n.prefixlen == 0 for n in subnets)
    covers_v6 = any(n.version == 6 and n.prefixlen == 0 for n in subnets)
    if not (covers_v4 or covers_v6):
        issues.append("blockSubnets 未覆盖 0.0.0.0/0 或 ::/0（存在泄露面）")
    details["covers_v4_all"] = covers_v4
    details["covers_v6_all"] = covers_v6

    # permittedAddresses 越界检查
    permitted_raw = config.get("permittedAddresses", [])
    for addr_raw in permitted_raw:
        try:
            addr = ipaddress.ip_address(addr_raw)
        except ValueError as exc:
            issues.append(f"permittedAddresses 无效 IP {addr_raw!r}: {exc}")
            continue
        covered = any(addr in n for n in subnets)
        if not covered:
            issues.append(
                f"permittedAddresses {addr_raw} 不在 blockSubnets 覆盖范围内（越界，"
                "与 Codex Offline 范式不符）"
            )

    # 三项阻断至少一个开
    hard_blocks = ["blockDns", "blockIcmp", "fallbackBlock"]
    if not any(config.get(k) for k in hard_blocks):
        issues.append("blockDns / blockIcmp / fallbackBlock 至少一项需为 True")

    details["subnet_count"] = len(subnets)
    details["permitted_count"] = len(permitted_raw)

    return {
        "valid": not issues,
        "reason": "OK" if not issues else "; ".join(issues),
        "details": details,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
