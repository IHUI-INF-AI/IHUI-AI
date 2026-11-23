// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 沙箱能力探测 IPC 薄壳 —— **只放 `#[tauri::command]` + wire DTO**，不碰判定逻辑。
//!
//! 为什么需要这条命令：`sandbox_sdk` 的三态门如果没有真实入口，就是「判据层装了、
//! 没有人用」—— 本仓 2026-11-14 第八轮已经吃过这个亏（13 条判据、零生产 importer）。
//! 这条命令就是那个入口：前端在起终端 / 执行命令前先问一次，拿到
//! `supported` / 原因码 / 未判定原因，再决定要不要起进程。
//!
//! 探测本身**只读**（不 spawn 任何子进程），但会 `init` → `is_supported` → `uninit`：
//! 判定必须来自真实初始化结果，不能靠「平台是 Windows ⇒ 一定支持」的假定。

use serde::Serialize;

use crate::sandbox_sdk::{backend_for, TIER_JOB_OBJECT, TIER_MICRO_VM};

/// 能力探测回执。`state` 是唯一的判定口径（`supported` / 原因码 / `probe_*`）；
/// `supported` 只是它的布尔投影，两者不会打架。
#[derive(Debug, Serialize)]
pub struct CapabilityReply {
    /// 调用方请求的形态（原样回显，便于前端对齐）。
    pub requested_tier: String,
    /// 实际解析到的形态（未知请求会回落到作业级并给出 `unknown_tier:*` 原因）。
    pub tier: String,
    pub state: String,
    pub supported: bool,
    /// 拒绝原因（`supported=false` 时至少一条）。
    pub reasons: Vec<String>,
}

/// 探测某个形态的沙箱能力。
#[tauri::command]
pub fn sandbox_capability(requested_tier: String) -> CapabilityReply {
    match backend_for(&requested_tier) {
        Ok(mut backend) => {
            // init 失败不直接判死：state 由 is_supported 给（它才是判定源）。
            let _ = backend.init();
            let state = backend.is_supported();
            let tier = backend.tier().to_string();
            backend.uninit();
            CapabilityReply {
                requested_tier,
                tier,
                state: state.code().to_string(),
                supported: state.is_supported(),
                reasons: Vec::new(),
            }
        }
        Err(refusal) => CapabilityReply {
            requested_tier,
            tier: refusal.tier.to_string(),
            state: refusal.state.code().to_string(),
            supported: false,
            reasons: refusal.reasons,
        },
    }
}

/// 形态常量对外暴露一份（前端只认这两个字符串，不自己拼）。
#[tauri::command]
pub fn sandbox_tiers() -> Vec<&'static str> {
    vec![TIER_JOB_OBJECT, TIER_MICRO_VM]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
