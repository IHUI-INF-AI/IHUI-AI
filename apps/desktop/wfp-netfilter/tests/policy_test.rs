// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 策略编译层测试 —— 遵循统一工程规范。

use ihui_wfp_netfilter::{
    compile_rules, CompileError, Decision, InstallPlan, NetworkProtocol, NetworkRule, RuleId,
};

fn rid(s: &str) -> RuleId {
    RuleId(s.to_string())
}

fn rule(id: &str, host: &str, proto: NetworkProtocol, dec: Decision) -> NetworkRule {
    NetworkRule {
        id: rid(id),
        host: host.to_string(),
        protocol: proto,
        decision: dec,
        justification: "测试用理由".to_string(),
    }
}

// ---------- 一、协议值域恰好四个（与对侧按行为规格）----------

#[test]
fn protocol_domain_is_exactly_four() {
    let wire = ["http", "https", "socks5_tcp", "socks5_udp"];
    for w in wire {
        let p = NetworkProtocol::parse(w).unwrap_or_else(|| panic!("{w} 应可解析"));
        assert_eq!(p.as_str(), w);
    }
    for bad in ["ftp", "tcp", "udp", "socks4", "", "HTTPX"] {
        assert!(
            NetworkProtocol::parse(bad).is_none(),
            "{bad} 不应被接受（对侧只认四个精确值）"
        );
    }
}

#[test]
fn protocol_parse_is_case_and_trim_tolerant() {
    // 本模块的宽松归一（对侧未取证到同样行为，已在文档注明）
    assert_eq!(
        NetworkProtocol::parse("  HTTPS \n"),
        Some(NetworkProtocol::Https)
    );
    assert_eq!(
        NetworkProtocol::parse("SOCKS5_TCP"),
        Some(NetworkProtocol::Socks5Tcp)
    );
}

#[test]
fn socks5_udp_is_the_only_udp_carrier() {
    assert!(NetworkProtocol::Socks5Udp.is_udp());
    assert!(!NetworkProtocol::Socks5Tcp.is_udp());
    assert!(!NetworkProtocol::Https.is_udp());
}

// ---------- 二、决策四值 + wire 编码 ----------

#[test]
fn decision_domain_is_four_and_forbidden_encodes_as_deny() {
    assert_eq!(Decision::parse("allow"), Some(Decision::Allow));
    assert_eq!(Decision::parse("prompt"), Some(Decision::Prompt));
    assert_eq!(Decision::parse("prompt_user"), Some(Decision::PromptUser));
    assert_eq!(Decision::parse("forbidden"), Some(Decision::Forbidden));
    assert_eq!(Decision::parse("deny"), Some(Decision::Forbidden));

    // 对侧 wire：forbidden → deny
    assert_eq!(Decision::Forbidden.as_wire(), "deny");
    assert_eq!(Decision::PromptUser.as_wire(), "prompt_user");
}

#[test]
fn decision_parse_never_defaults() {
    for bad in ["", "bogus", "ALLOWISH", "denies"] {
        assert!(Decision::parse(bad).is_none(), "{bad} 不应回落默认值");
    }
}

#[test]
fn prompt_and_prompt_user_both_block() {
    assert!(Decision::Prompt.blocks_traffic());
    assert!(Decision::PromptUser.blocks_traffic());
    assert!(Decision::Forbidden.blocks_traffic());
    assert!(!Decision::Allow.blocks_traffic());
}

// ---------- 三、host 五条校验（对侧原文对应）----------

#[test]
fn host_empty_is_refused() {
    let r = rule("r1", "   ", NetworkProtocol::Https, Decision::Allow);
    match compile_rules(&[r]) {
        Err(CompileError::EmptyHost { rule }) => assert_eq!(rule.0, "r1"),
        other => panic!("期望 EmptyHost，得到 {other:?}"),
    }
}

#[test]
fn host_with_whitespace_is_refused() {
    let r = rule(
        "r1",
        "a.example b.example",
        NetworkProtocol::Https,
        Decision::Allow,
    );
    match compile_rules(&[r]) {
        Err(CompileError::HostContainsWhitespace { .. }) => {}
        other => panic!("期望 HostContainsWhitespace，得到 {other:?}"),
    }
}

#[test]
fn host_wildcard_is_refused() {
    // 对侧原文：network_rule host must be a specific host; wildcards are not allowed
    for raw in ["*.example.com", "a.*.com", "a?.example.com"] {
        let r = rule("r1", raw, NetworkProtocol::Https, Decision::Allow);
        match compile_rules(&[r]) {
            Err(CompileError::HostWildcardNotAllowed { .. }) => {}
            other => panic!("{raw} 期望 HostWildcardNotAllowed，得到 {other:?}"),
        }
    }
}

#[test]
fn host_with_scheme_or_path_is_refused() {
    // 对侧原文：without scheme or path
    for raw in ["https://a.example", "a.example/path", "a.example\\x"] {
        let r = rule("r1", raw, NetworkProtocol::Https, Decision::Allow);
        match compile_rules(&[r]) {
            Err(CompileError::HostHasSchemeOrPath { .. }) => {}
            other => panic!("{raw} 期望 HostHasSchemeOrPath，得到 {other:?}"),
        }
    }
}

#[test]
fn bracketed_ipv6_is_accepted_and_unbracketed_too() {
    let p = compile_rules(&[rule("v6", "[::1]", NetworkProtocol::Https, Decision::Allow)]).unwrap();
    assert_eq!(p.specs[0].host.canonical(), "::1");

    let p2 = compile_rules(&[rule("v6", "2001:db8::1", NetworkProtocol::Https, Decision::Allow)])
        .unwrap();
    assert_eq!(p2.specs[0].host.canonical(), "2001:db8::1");
}

#[test]
fn invalid_bracketed_ipv6_is_refused() {
    let r = rule("r1", "[not-an-ip]", NetworkProtocol::Https, Decision::Allow);
    match compile_rules(&[r]) {
        Err(CompileError::InvalidBracketedIpv6 { .. }) => {}
        other => panic!("期望 InvalidBracketedIpv6，得到 {other:?}"),
    }
    let r2 = rule("r1", "[::1", NetworkProtocol::Https, Decision::Allow);
    match compile_rules(&[r2]) {
        Err(CompileError::InvalidBracketedIpv6 { .. }) => {}
        other => panic!("未闭合方括号期望 InvalidBracketedIpv6，得到 {other:?}"),
    }
}

#[test]
fn invalid_hostname_is_refused() {
    for raw in ["-bad.example", "bad-.example", "a..b", "_x.example"] {
        let r = rule("r1", raw, NetworkProtocol::Https, Decision::Allow);
        match compile_rules(&[r]) {
            Err(CompileError::HostNotHostnameOrIp { .. }) => {}
            other => panic!("{raw} 期望 HostNotHostnameOrIp，得到 {other:?}"),
        }
    }
}

#[test]
fn hostname_is_lowercased_and_trailing_dot_stripped() {
    let p = compile_rules(&[rule(
        "r1",
        "Registry.NPMJS.org.",
        NetworkProtocol::Https,
        Decision::Allow,
    )])
    .unwrap();
    assert_eq!(p.specs[0].host.canonical(), "registry.npmjs.org");
}

// ---------- 四、justification 非空 ----------

#[test]
fn empty_justification_is_refused() {
    let mut r = rule("r1", "a.example", NetworkProtocol::Https, Decision::Allow);
    r.justification = "   ".to_string();
    match compile_rules(&[r]) {
        Err(CompileError::EmptyJustification { .. }) => {}
        other => panic!("期望 EmptyJustification，得到 {other:?}"),
    }
}

// ---------- 五、去重与冲突 ----------

#[test]
fn identical_rules_are_deduped_and_traced() {
    let rules = vec![
        rule("r1", "a.example", NetworkProtocol::Https, Decision::Forbidden),
        rule("r2", "a.example", NetworkProtocol::Https, Decision::Forbidden),
        rule("r3", "b.example", NetworkProtocol::Https, Decision::Allow),
    ];
    let plan = compile_rules(&rules).unwrap();
    assert_eq!(plan.specs.len(), 2, "同 host+protocol+decision 应去重");
    assert_eq!(plan.deduped.len(), 1);
    assert_eq!(plan.deduped[0].0, "r2");
}

#[test]
fn conflicting_decision_is_refused_not_silently_overridden() {
    let rules = vec![
        rule("r1", "a.example", NetworkProtocol::Https, Decision::Allow),
        rule("r2", "a.example", NetworkProtocol::Https, Decision::Forbidden),
    ];
    match compile_rules(&rules) {
        Err(CompileError::ConflictingDecision {
            host,
            protocol,
            first,
            second,
        }) => {
            assert_eq!(host, "a.example");
            assert_eq!(protocol, NetworkProtocol::Https);
            assert_eq!(first, Decision::Allow);
            assert_eq!(second, Decision::Forbidden);
        }
        other => panic!("期望 ConflictingDecision，得到 {other:?}"),
    }
}

#[test]
fn same_host_different_protocol_is_not_a_conflict() {
    let rules = vec![
        rule("r1", "a.example", NetworkProtocol::Http, Decision::Allow),
        rule("r2", "a.example", NetworkProtocol::Https, Decision::Forbidden),
    ];
    let plan = compile_rules(&rules).unwrap();
    assert_eq!(plan.specs.len(), 2);
}

// ---------- 六、幂等：摘要稳定 ----------

#[test]
fn plan_digest_is_order_independent() {
    let a = vec![
        rule("r1", "a.example", NetworkProtocol::Https, Decision::Forbidden),
        rule("r2", "b.example", NetworkProtocol::Http, Decision::Allow),
    ];
    let mut b = a.clone();
    b.reverse();
    let pa = compile_rules(&a).unwrap();
    let pb = compile_rules(&b).unwrap();
    assert_eq!(pa.plan_digest, pb.plan_digest, "输入顺序不应影响摘要");
}

#[test]
fn plan_digest_changes_when_decision_changes() {
    let a = compile_rules(&[rule(
        "r1",
        "a.example",
        NetworkProtocol::Https,
        Decision::Allow,
    )])
    .unwrap();
    let b = compile_rules(&[rule(
        "r1",
        "a.example",
        NetworkProtocol::Https,
        Decision::Forbidden,
    )])
    .unwrap();
    assert_ne!(
        a.plan_digest, b.plan_digest,
        "决策变了摘要必须变，否则幂等判定会漏"
    );
}

#[test]
fn rule_id_rename_does_not_change_digest() {
    let a = compile_rules(&[rule(
        "r1",
        "a.example",
        NetworkProtocol::Https,
        Decision::Allow,
    )])
    .unwrap();
    let b = compile_rules(&[rule(
        "renamed",
        "a.example",
        NetworkProtocol::Https,
        Decision::Allow,
    )])
    .unwrap();
    assert_eq!(
        a.plan_digest, b.plan_digest,
        "改名不该改语义摘要（RuleId 不参与摘要）"
    );
}

#[test]
fn empty_rule_set_yields_empty_plan() {
    let plan = compile_rules(&[]).unwrap();
    assert!(plan.specs.is_empty());
    assert_eq!(plan.blocking_count(), 0);
    assert_eq!(plan.allowing_count(), 0);
}

// ---------- 七、计数语义 ----------

#[test]
fn blocking_count_includes_prompt_and_prompt_user() {
    let rules = vec![
        rule("a", "a.example", NetworkProtocol::Https, Decision::Allow),
        rule("b", "b.example", NetworkProtocol::Https, Decision::Prompt),
        rule(
            "c",
            "c.example",
            NetworkProtocol::Https,
            Decision::PromptUser,
        ),
        rule(
            "d",
            "d.example",
            NetworkProtocol::Https,
            Decision::Forbidden,
        ),
    ];
    let plan: InstallPlan = compile_rules(&rules).unwrap();
    assert_eq!(plan.blocking_count(), 3);
    assert_eq!(plan.allowing_count(), 1);
}

// ---------- 八、失败方向恒定（§0.10）----------

#[test]
fn any_bad_rule_fails_the_whole_plan() {
    let rules = vec![
        rule("good", "a.example", NetworkProtocol::Https, Decision::Allow),
        rule("bad", "*.wild.com", NetworkProtocol::Https, Decision::Allow),
    ];
    assert!(
        compile_rules(&rules).is_err(),
        "有一条坏规则必须整体失败，不得跳过坏规则继续（否则 deny 会静默失效）"
    );
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
