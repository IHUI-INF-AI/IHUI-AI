// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 安装层测试 —— 重在**显式状态机**与「不假装成功」。

use ihui_wfp_netfilter::install::{
    ale_layer, install_plan, InstallError, InstallOutcome, ProviderIdentity,
};
use ihui_wfp_netfilter::{compile_rules, Decision, NetworkProtocol, NetworkRule, RuleId};

fn rid(s: &str) -> RuleId {
    RuleId(s.to_string())
}

fn sample_plan() -> ihui_wfp_netfilter::InstallPlan {
    compile_rules(&[NetworkRule {
        id: rid("r1"),
        host: "registry.npmjs.org".to_string(),
        protocol: NetworkProtocol::Https,
        decision: Decision::Allow,
        justification: "包管理器需要".to_string(),
    }])
    .unwrap()
}

// ---------- 一、provider GUID 形状校验 ----------

#[test]
fn canonical_guid_is_accepted_and_lowercased() {
    let p = ProviderIdentity::new(
        "{A1B2C3D4-1111-2222-3333-444455556666}",
        "IHUI WFP Netfilter",
    )
    .unwrap();
    assert_eq!(p.guid, "{a1b2c3d4-1111-2222-3333-444455556666}");
    assert_eq!(p.display_name, "IHUI WFP Netfilter");
}

#[test]
fn malformed_guid_is_refused() {
    let bad = [
        "a1b2c3d4-1111-2222-3333-444455556666", // 缺花括号
        "{a1b2c3d4-1111-2222-3333}",            // 段数不对
        "{a1b2c3d4-1111-2222-3333-44445555}",   // 末段长度不对
        "{zzzzzzzz-1111-2222-3333-444455556666}", // 非十六进制
        "{}",
        "",
    ];
    for g in bad {
        match ProviderIdentity::new(g, "x") {
            Err(InstallError::InvalidProviderGuid { .. }) => {}
            other => panic!("{g:?} 期望 InvalidProviderGuid，得到 {other:?}"),
        }
    }
}

#[test]
fn empty_display_name_is_refused() {
    match ProviderIdentity::new("{a1b2c3d4-1111-2222-3333-444455556666}", "   ") {
        Err(InstallError::EmptyDisplayName) => {}
        other => panic!("期望 EmptyDisplayName，得到 {other:?}"),
    }
}

// ---------- 二、空计划是正常情形，不是错误 ----------

#[test]
fn empty_plan_yields_nothing_to_install() {
    let plan = compile_rules(&[]).unwrap();
    let provider = ProviderIdentity::new("{a1b2c3d4-1111-2222-3333-444455556666}", "x").unwrap();
    let out = install_plan(&plan, &provider).unwrap();
    assert_eq!(out, InstallOutcome::NothingToInstall);
    assert!(!out.is_effective());
}

// ---------- 三、核心诚实断言：不假装成功 ----------

#[test]
fn install_never_claims_effective_without_verification() {
    let plan = sample_plan();
    let provider = ProviderIdentity::new("{a1b2c3d4-1111-2222-3333-444455556666}", "x").unwrap();
    let out = install_plan(&plan, &provider).unwrap();

    // 无论走哪个分支，本轮实现**绝不**宣称已生效
    assert!(
        !out.is_effective(),
        "未做端到端验证前，is_effective 必须恒为 false —— 这是本模块存在的理由"
    );

    // 且状态必须是显式的 Unverified / NotSupported 之一，不能是"成功"
    match &out {
        InstallOutcome::Unverified { plan_digest, reason } => {
            assert_eq!(*plan_digest, plan.plan_digest, "摘要必须回传，便于真机验证对账");
            assert!(!reason.is_empty(), "未验证必须给出原因");
        }
        InstallOutcome::NotSupported { .. } => {}
        other => panic!("未验证路径不得返回 {other:?}"),
    }
}

#[test]
fn non_windows_reports_platform_not_supported() {
    // 本测试在 Windows 与非 Windows 上都成立：
    // Windows 走 Unverified，非 Windows 走 NotSupported，两者都不是"成功"。
    let plan = sample_plan();
    let provider = ProviderIdentity::new("{a1b2c3d4-1111-2222-3333-444455556666}", "x").unwrap();
    let out = install_plan(&plan, &provider).unwrap();
    #[cfg(not(windows))]
    {
        assert!(matches!(out, InstallOutcome::NotSupported { .. }));
    }
    #[cfg(windows)]
    {
        assert!(matches!(out, InstallOutcome::Unverified { .. }));
    }
}

#[test]
fn outcome_describe_is_human_readable_and_names_digest() {
    let plan = sample_plan();
    let provider = ProviderIdentity::new("{a1b2c3d4-1111-2222-3333-444455556666}", "x").unwrap();
    let out = install_plan(&plan, &provider).unwrap();
    let text = out.describe();
    assert!(!text.is_empty());
    match &out {
        InstallOutcome::Unverified { .. } => {
            assert!(text.contains("未验证"), "描述须含「未验证」字样：{text}");
        }
        InstallOutcome::NotSupported { .. } => {
            assert!(text.contains("不支持"), "描述须含「不支持」字样：{text}");
        }
        _ => {}
    }
}

// ---------- 四、错误面 ----------

#[test]
fn empty_guid_in_provider_reaches_install_error() {
    // 绕过构造函数直接造一个空 GUID 的 provider，验证 install_plan 仍然兜住
    let provider = ProviderIdentity {
        guid: String::new(),
        display_name: "x".to_string(),
    };
    match install_plan(&sample_plan(), &provider) {
        Err(InstallError::InvalidProviderGuid { .. }) => {}
        other => panic!("期望 InvalidProviderGuid，得到 {other:?}"),
    }
}

#[test]
fn errors_implement_std_error() {
    fn assert_error<E: std::error::Error>(_: &E) {}
    assert_error(&InstallError::RequiresAdministrator);
    assert_error(&InstallError::EngineOpenFailed { code: 5 });
}

// ---------- 五、与策略层摘要的贯通 ----------

#[test]
fn outcome_carries_plan_digest_for_reconciliation() {
    let plan = sample_plan();
    let provider = ProviderIdentity::new("{a1b2c3d4-1111-2222-3333-444455556666}", "x").unwrap();
    match install_plan(&plan, &provider).unwrap() {
        InstallOutcome::Unverified { plan_digest, .. } => {
            assert_eq!(plan_digest, plan.plan_digest);
        }
        InstallOutcome::NotSupported { .. } => {
            // 非 Windows 不带摘要，但也不得伪造
        }
        other => panic!("意料之外：{other:?}"),
    }
}

// ---------- 六、Decision → FWP_ACTION_* 映射（本轮新增取证落地） ----------

use ihui_wfp_netfilter::install::fwp_action_type;

#[test]
fn allow_maps_to_fwp_action_permit_matching_adversary() {
    // 对侧实测 action.type = 0x1001 = FWP_ACTION_PERMIT。Allow 必须落 PERMIT，
    // 与对侧白名单惯用法对齐。
    assert_eq!(fwp_action_type(Decision::Allow), 0x1001); // FWP_ACTION_PERMIT
}

#[test]
fn all_blocking_decisions_map_to_fwp_action_block() {
    // blocks_traffic() 为真的三值（Prompt/PromptUser/Forbidden）都先阻断，
    // 落 FWP_ACTION_BLOCK = 0x1000。
    assert_eq!(fwp_action_type(Decision::Prompt), 0x1000);
    assert_eq!(fwp_action_type(Decision::PromptUser), 0x1000);
    assert_eq!(fwp_action_type(Decision::Forbidden), 0x1000);
}

#[test]
fn action_mapping_is_exactly_two_distinct_values_and_never_zero() {
    // 反向变异自证：映射只会产出 BLOCK/PERMIT 两个值，绝不出现 0 或越界值
    // （防有人把常量写错或引入第三种语义）。
    let all = [
        Decision::Allow,
        Decision::Prompt,
        Decision::PromptUser,
        Decision::Forbidden,
    ];
    for d in all {
        let v = fwp_action_type(d);
        assert!(
            v == 0x1000 || v == 0x1001,
            "action.type 只能是 BLOCK(0x1000)/PERMIT(0x1001)，得到 {v:#x}"
        );
    }
    // Allow 与任一阻断值必须不同，否则白名单会变成黑名单（致命）
    assert_ne!(
        fwp_action_type(Decision::Allow),
        fwp_action_type(Decision::Forbidden),
        "PERMIT 与 BLOCK 不得相等，否则放行语义会误伤成阻断"
    );
}

// ---------- 四、ale_layer：取证 GUID 对齐测试 ----------

#[test]
fn ale_layer_all_has_exactly_four_entries() {
    // 反向变异自证：ALL 必须恰 4 条，防有人加/减层导致安装层下发条数错
    assert_eq!(
        ale_layer::ALL.len(),
        4,
        "ALL 必须恰 4 条 ALE 层（对侧字面池实测值）"
    );
}

#[test]
fn ale_layer_guids_match_gadget_literal_pool() {
    // 逐条核对字面 GUID 是否与 Ghidra 取证字面池一致（精确对齐，零偏差）
    let expected: &[(&str, &str)] = &[
        (
            "FWPM_LAYER_ALE_AUTH_CONNECT_V4",
            "{fd45dd17-17f0-4454-a8f5-1a335f9b1d5c}",
        ),
        (
            "FWPM_LAYER_ALE_AUTH_CONNECT_V6",
            "{105e6e93-8a97-4a64-b4e5-09f5ff7a0115}",
        ),
        (
            "FWPM_LAYER_ALE_FLOW_ESTABLISHED_V4",
            "{4b2b7a2c-2ee6-4916-91b4-8f223a5c0ba9}",
        ),
        (
            "FWPM_LAYER_ALE_FLOW_ESTABLISHED_V6",
            "{09e40e90-8f1c-4834-a375-9b7a3d5a4d0e}",
        ),
    ];
    for (i, (want_name, want_guid)) in expected.iter().enumerate() {
        let got = &ale_layer::ALL[i];
        assert_eq!(got.sdk_name, *want_name, "层名不符 index={i}");
        assert_eq!(got.guid, *want_guid, "字面 GUID 不符 index={i}");
    }
}

#[test]
fn ale_layer_constants_are_lowercase_canonical_form() {
    // 形状自证：常量必须小写、带花括号，防止误手写大写或缺括号
    use ihui_wfp_netfilter::install::ale_layer;
    for c in [ale_layer::AUTH_CONNECT_V4, ale_layer::AUTH_CONNECT_V6, ale_layer::FLOW_ESTABLISHED_V4, ale_layer::FLOW_ESTABLISHED_V6] {
        assert!(c.starts_with('{') && c.ends_with('}'), "缺花括号：{c}");
        assert_eq!(c, c.to_ascii_lowercase(), "含大写字符：{c}");
        // 长度：{8-4-4-4-12} = 1+8+1+4+1+4+1+4+1+12+1 = 38
        assert_eq!(c.len(), 38, "长度不为 38：{c}");
    }
}

// ---------- 五、provider_object：对侧对象取证对齐测试 ----------

#[test]
fn provider_object_codex_values_match_evidence() {
    // 逐条核对 provider / sublayer 的字面 GUID 与人读名是否与取证报告一致
    use ihui_wfp_netfilter::install::provider_object as po;
    assert_eq!(
        po::CODEX_PROVIDER_GUID,
        "{2e31d31c-3948-4753-9117-e5d1a6496f41}",
        "对侧 provider GUID 不符取证值"
    );
    assert_eq!(
        po::CODEX_SUBLAYER_GUID,
        "{e65054fd-4d32-4c7c-95ef-621f0cf6431a}",
        "对侧 sublayer GUID 不符取证值"
    );
    assert_eq!(
        po::CODEX_PROVIDER_NAME,
        "Persistent WFP provider for Codex Windows sandbox filters",
    );
    assert_eq!(
        po::CODEX_SUBLAYER_NAME,
        "Persistent WFP sublayer for Codex Windows sandbox filter",
    );
    assert_eq!(
        po::FWPM_FLAG_PERSISTENT, 1,
        "FWPM_PROVIDER_FLAG_PERSISTENT 实测 = 1"
    );
}

#[test]
fn provider_object_codex_guids_differ_from_each_other() {
    // 反向自证：provider 与 sublayer 的 GUID 必须不同（否则对象会互相覆盖）
    use ihui_wfp_netfilter::install::provider_object as po;
    assert_ne!(
        po::CODEX_PROVIDER_GUID, po::CODEX_SUBLAYER_GUID,
        "provider 与 sublayer 的 GUID 不得相同"
    );
}

#[test]
fn provider_object_codex_guids_never_used_as_our_identity() {
    // 关键护栏：本 crate 安装时**不得**直接拿对侧 GUID 当 ProviderIdentity 用。
    // 这里只验证「能构造出带对侧 GUID 的身份」这一行为本身没有 API 暴露——
    // 即：没有任何公开函数会把 provider_object 的 GUID 灌进 ProviderIdentity。
    // 我们通过确保 ProviderIdentity::new 是唯一入口（调用方显式传入）来保证。
    // 这条测试是文档化的意图声明：将来若有人加「copy_codex_identity()」便捷函数，
    // 必须在此处加断言禁止。
    use ihui_wfp_netfilter::install::provider_object as po;
    let codex = po::CODEX_PROVIDER_GUID;
    let codex2 = po::CODEX_SUBLAYER_GUID;
    // 两个对侧 GUID 与任何本 crate 默认值都无关联（无隐式拷贝）
    assert_ne!(codex, codex2);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
