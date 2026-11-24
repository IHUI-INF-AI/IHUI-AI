// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
//! `wfp_ffi` 单测 —— 钉住 GUID 编码与条件构造语义。
//!
//! 这些测试是"静态接线没写错"的机器证据。对齐 AGENTS.md「每个事实都有判据」：
//! GUID 逐字节对齐两个独立来源的取证值，条件构造覆盖 V4/V6/主机名三态与决策映射。

use crate::wfp_ffi::{
    build_conditions_for_spec, FWP_ACTION_BLOCK, FWP_ACTION_PERMIT, IPPROTO_TCP, IPPROTO_UDP,
    FWPM_CONDITION_IP_PROTOCOL, FWPM_CONDITION_IP_REMOTE_ADDRESS,
    FWPM_LAYER_ALE_AUTH_CONNECT_V4, FWPM_LAYER_ALE_AUTH_CONNECT_V6, FilterAction,
    FilterConditionValue,
};

/// GUID 编码：Data1 用小端序列化后应还原成标准大端写法。
#[test]
fn guid_encoding_matches_authoritative_values() {
    // IP_PROTOCOL 是交叉验证锚点（对侧二进制 ⇄ fwpmu.h 逐字节吻合）
    let g = FWPM_CONDITION_IP_PROTOCOL;
    assert_eq!((g.Data1, g.Data2, g.Data3), (0x3971ef2b, 0x623e, 0x4f9a));
    assert_eq!(g.Data4, [0x8c, 0xb1, 0x6e, 0x79, 0xb8, 0x06, 0xb9, 0xa7]);

    // IP_REMOTE_ADDRESS
    let g = FWPM_CONDITION_IP_REMOTE_ADDRESS;
    assert_eq!((g.Data1, g.Data2, g.Data3), (0xb235ae9a, 0x1d64, 0x49b8));
    assert_eq!(g.Data4, [0xa4, 0x4c, 0x5f, 0xf3, 0xd9, 0x09, 0x50, 0x45]);

    // Layer V4 —— 注意权威前缀是 c38d57d1，不是早先误记的 c38ac9c4
    let g = FWPM_LAYER_ALE_AUTH_CONNECT_V4;
    assert_eq!((g.Data1, g.Data2, g.Data3), (0xc38d57d1, 0x05a7, 0x4c33));
    assert_eq!(g.Data4, [0x90, 0x4f, 0x7f, 0xbc, 0xee, 0xe6, 0x0e, 0x82]);

    // Layer V6
    let g = FWPM_LAYER_ALE_AUTH_CONNECT_V6;
    assert_eq!((g.Data1, g.Data2, g.Data3), (0x4a72393b, 0x319f, 0x44bc));
    assert_eq!(g.Data4, [0x84, 0xc3, 0xba, 0x54, 0xdc, 0xb3, 0xb6, 0xb4]);
}

/// 条件构造：IPv4 host ⇒ 远端地址(/32) + 协议，层 V4。
#[test]
fn conditions_for_ipv4_host() {
    use crate::policy::{FilterSpec, Host, NetworkProtocol};
    let spec = FilterSpec {
        rule: crate::policy::RuleId("r1".into()),
        host: Host::Ip("203.0.113.7".parse().unwrap()),
        protocol: NetworkProtocol::Https,
        decision: crate::policy::Decision::Forbidden,
    };
    let (conds, layer) = build_conditions_for_spec(&spec).expect("IP host 必有条件");
    assert_eq!(layer, FWPM_LAYER_ALE_AUTH_CONNECT_V4);
    assert_eq!(conds.len(), 2);
    // 首条件 = 远端地址，值 /32
    assert_eq!(conds[0].field_key, FWPM_CONDITION_IP_REMOTE_ADDRESS);
    assert_eq!(
        conds[0].value,
        FilterConditionValue::V4AddrMask(u32::from_be_bytes([203, 0, 113, 7]), 0xffff_ffff)
    );
    // 次条件 = 协议，HTTPS 走 TCP(6)
    assert_eq!(conds[1].field_key, FWPM_CONDITION_IP_PROTOCOL);
    assert_eq!(conds[1].value, FilterConditionValue::Uint8(IPPROTO_TCP));
}

/// 条件构造：IPv6 host ⇒ 远端地址(/128) + 协议，层 V6。
#[test]
fn conditions_for_ipv6_host() {
    use crate::policy::{FilterSpec, Host, NetworkProtocol};
    let spec = FilterSpec {
        rule: crate::policy::RuleId("r2".into()),
        host: Host::Ip("2001:db8::1".parse().unwrap()),
        protocol: NetworkProtocol::Socks5Udp,
        decision: crate::policy::Decision::Forbidden,
    };
    let (conds, layer) = build_conditions_for_spec(&spec).expect("IP host 必有条件");
    assert_eq!(layer, FWPM_LAYER_ALE_AUTH_CONNECT_V6);
    let octets: [u8; 16] = "2001:db8::1".parse::<std::net::Ipv6Addr>().unwrap().octets();
    assert_eq!(conds[0].value, FilterConditionValue::V6AddrMask(octets, 128));
    // UDP 承载
    assert_eq!(conds[1].value, FilterConditionValue::Uint8(IPPROTO_UDP));
}

/// 条件构造：主机名 host ⇒ None（本层不解析 DNS，显式不做）。
#[test]
fn conditions_for_hostname_returns_none() {
    use crate::policy::{FilterSpec, Host, NetworkProtocol};
    let spec = FilterSpec {
        rule: crate::policy::RuleId("r3".into()),
        host: Host::Name("example.com".into()),
        protocol: NetworkProtocol::Https,
        decision: crate::policy::Decision::Forbidden,
    };
    assert!(
        build_conditions_for_spec(&spec).is_none(),
        "主机名不做 DNS 解析，必须返回 None 而不是编出一个条件"
    );
}

/// 决策 → 动作映射：Allow ⇒ Permit，其余三态全 ⇒ Block。
#[test]
fn action_from_decision_blocks_all_non_allow() {
    assert_eq!(FilterAction::from_decision(crate::policy::Decision::Allow), FilterAction::Permit);
    assert_eq!(
        FilterAction::from_decision(crate::policy::Decision::Prompt),
        FilterAction::Block
    );
    assert_eq!(
        FilterAction::from_decision(crate::policy::Decision::PromptUser),
        FilterAction::Block
    );
    assert_eq!(
        FilterAction::from_decision(crate::policy::Decision::Forbidden),
        FilterAction::Block
    );
}

/// 动作常量值与 SDK 一致（PERMIT 0x1001 / BLOCK 0x1000）。
#[test]
fn action_constants_match_sdk() {
    assert_eq!(FilterAction::Permit.as_u32(), 0x1001);
    assert_eq!(FilterAction::Block.as_u32(), 0x1000);
    assert_ne!(FWP_ACTION_PERMIT, FWP_ACTION_BLOCK, "PERMIT 与 BLOCK 不得相等，否则放行会误伤成阻断");
}

/// FWP_DATA_* 常量锚定到 SDK fwptypes.h 字面值。
///
/// 这条防的是"常量定义本身写错"——上面的编码测试断言 `ev.data_type == FWP_DATA_UINT8`
/// 两边引用同一常量，若有人把常量值改错，两边一起变、测试仍绿（等价变异盲区）。
/// 故此处用字面值硬编码锚定。这些值来自 SDK `fwptypes.h` 的 `FWP_DATA_TYPE` 枚举
/// （EMPTY=0, UINT8=3, V4_ADDR_MASK=9, V6_ADDR_MASK=10）。
#[test]
fn fwp_data_type_constants_anchored_to_sdk_literals() {
    assert_eq!(FWP_DATA_UINT8, 3);
    assert_eq!(FWP_DATA_V4_ADDR_MASK, 9);
    assert_eq!(FWP_DATA_V6_ADDR_MASK, 10);
    assert_eq!(FWP_MATCH_EQUAL, 0);
}

/// 边界：本模块不导出"会真正安装 filter"的安全包装。
///
/// 判据：条件构造只产出中性数据（`FilterCondition` / `FilterAction`），
/// 不返回任何引擎 handle、不落盘、不改系统状态。若将来有人加了会真调
/// `FwpmEngineOpen0` / `FwpmFilterAdd0` 的 pub fn，本测试所在模块应同步补一条
/// 「安装必须门禁在 is_effective()==false」的判据。当前以
/// "条件构造对主机名返回 None（不编造）+ 动作只产出常量"作为行为代理。
#[test]
fn module_only_produces_inert_data() {
    use crate::policy::{FilterSpec, Host, NetworkProtocol};
    // 主机名不编造条件（证明不会"半成品当全成品"）
    let name_spec = FilterSpec {
        rule: crate::policy::RuleId("x".into()),
        host: Host::Name("h".into()),
        protocol: NetworkProtocol::Https,
        decision: crate::policy::Decision::Forbidden,
    };
    assert!(build_conditions_for_spec(&name_spec).is_none());
    // IP host 产出的也只是数据，不是 handle
    let ip_spec = FilterSpec {
        rule: crate::policy::RuleId("y".into()),
        host: Host::Ip("203.0.113.9".parse().unwrap()),
        protocol: NetworkProtocol::Https,
        decision: crate::policy::Decision::Forbidden,
    };
    let (conds, layer) = build_conditions_for_spec(&ip_spec).unwrap();
    assert_eq!(conds.len(), 2);
    assert_eq!(layer, FWPM_LAYER_ALE_AUTH_CONNECT_V4);
}

// ── 组装层测试 ──────────────────────────────────────────────────────────

use crate::wfp_ffi::{
    build_condition_value, build_filter_assembly, AssemblyError, EncodedConditionValue,
    FWP_DATA_UINT8, FWP_DATA_V4_ADDR_MASK, FWP_DATA_V6_ADDR_MASK, FWP_MATCH_EQUAL,
};
use crate::policy::{Decision, FilterSpec, NetworkProtocol, RuleId};

fn v4_spec(host: &str, decision: Decision) -> FilterSpec {
    FilterSpec {
        rule: RuleId("r".into()),
        host: crate::policy::Host::Ip(host.parse().unwrap()),
        protocol: NetworkProtocol::Https,
        decision,
    }
}

/// build_condition_value：UINT8 ⇒ FWP_DATA_UINT8(3) + 1 字节。
#[test]
fn condition_value_uint8_encoding() {
    let ev = build_condition_value(&FilterConditionValue::Uint8(IPPROTO_TCP)).unwrap();
    assert_eq!(ev, EncodedConditionValue {
        data_type: FWP_DATA_UINT8,
        byte_len: 1,
        bytes: { let mut b = [0u8; 8]; b[0] = IPPROTO_TCP; b },
    });
    assert_eq!(ev.data_type, FWP_DATA_UINT8);
    assert_eq!(ev.byte_len, 1);
    assert_eq!(ev.padded()[0], IPPROTO_TCP);
}

/// build_condition_value：V4 地址掩码 ⇒ FWP_DATA_V4_ADDR_MASK(9) + 8 字节（addr+mask 小端）。
#[test]
fn condition_value_v4_addrmask_encoding() {
    let ev = build_condition_value(&FilterConditionValue::V4AddrMask(0x0a00_0001, 0xffff_ff00)).unwrap();
    assert_eq!(ev.data_type, FWP_DATA_V4_ADDR_MASK);
    assert_eq!(ev.byte_len, 8);
    // addr 小端
    assert_eq!(&ev.bytes[..4], &0x0a00_0001u32.to_le_bytes());
    // mask 小端
    assert_eq!(&ev.bytes[4..8], &0xffff_ff00u32.to_le_bytes());
}

/// build_condition_value：V6 ⇒ None（需指针间接，显式不做）。
#[test]
fn condition_value_v6_returns_none() {
    assert!(build_condition_value(&FilterConditionValue::V6AddrMask([0u8; 16], 128)).is_none());
}

/// build_filter_assembly：V4 specs 按层+动作分组，条件正确。
#[test]
fn assembly_groups_v4_by_layer_and_action() {
    let specs = vec![
        v4_spec("203.0.113.7", Decision::Forbidden),
        v4_spec("203.0.113.8", Decision::Forbidden),
    ];
    let asm = build_filter_assembly(&specs).unwrap();
    assert_eq!(asm.len(), 1, "同层同动作应合并为一组");
    let a = &asm[0];
    assert_eq!(a.layer, FWPM_LAYER_ALE_AUTH_CONNECT_V4);
    assert_eq!(a.action, FilterAction::Block);
    // 两条 spec × 每条 2 条件（远端地址 + 协议）= 4
    assert_eq!(a.conditions.len(), 4);
}

/// build_filter_assembly：同层不同动作拆成两组（一个 filter 只有一个 action）。
#[test]
fn assembly_splits_by_action() {
    let specs = vec![
        v4_spec("203.0.113.7", Decision::Allow),
        v4_spec("203.0.113.8", Decision::Forbidden),
    ];
    let asm = build_filter_assembly(&specs).unwrap();
    assert_eq!(asm.len(), 2, "Allow 与 Block 必须拆成两个 filter");
    let actions: Vec<_> = asm.iter().map(|a| a.action).collect();
    assert!(actions.contains(&FilterAction::Permit));
    assert!(actions.contains(&FilterAction::Block));
}

/// build_filter_assembly：主机名 host ⇒ HostnameNeedsDnsResolution（不静默跳过）。
#[test]
fn assembly_rejects_hostname_with_dns_error() {
    let specs = vec![FilterSpec {
        rule: RuleId("r".into()),
        host: crate::policy::Host::Name("example.com".into()),
        protocol: NetworkProtocol::Https,
        decision: Decision::Forbidden,
    }];
    assert_eq!(
        build_filter_assembly(&specs),
        Err(AssemblyError::HostnameNeedsDnsResolution {
            rule: RuleId("r".into()),
            host: "example.com".into(),
        })
    );
}

/// build_filter_assembly：V6 host ⇒ ConditionNotEncodableWithoutIndirection（显式不做）。
#[test]
fn assembly_rejects_v6_without_indirection() {
    let specs = vec![v4_spec("2001:db8::1", Decision::Forbidden)];
    assert_eq!(
        build_filter_assembly(&specs),
        Err(AssemblyError::ConditionNotEncodableWithoutIndirection {
            rule: RuleId("r".into()),
        })
    );
}

/// 空输入 ⇒ 空装配（不报错）。
#[test]
fn assembly_empty_input_yields_empty() {
    assert!(build_filter_assembly(&[]).unwrap().is_empty());
}
