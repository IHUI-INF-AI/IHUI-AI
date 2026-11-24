// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 长任务防休眠(wake lock)——事前防线,owner 引用计数在前端,本模块只做平台能力面。
//!
//! 病灶:AI 长命令/长流式生成/视频生成期间,用户锁屏或系统休眠会切断 WS/SSE 与
//! 容器/SSH 通道,上一轮已修"唤醒后假连接态"的**事后恢复**,这里补**事前防线**
//! (对齐竞品 powerSaveBlocker.start/stop/isStarted + startWakelockForOwner 语义)。
//!
//! 判据三条:
//! - 能力三态:`supported` / `unsupported` / `failed`,取不到如实报,绝不冒充已持锁;
//! - 幂等:重复 activate / 重复 release 不重复调用系统 API;
//! - owner 引用计数刻意放前端 `Map<ownerId, handle>`:本模块只接一个 bool 开关,
//!   避免 Rust 侧维护跨页面生命周期的 owner 表(页面刷新后前端 Map 自然清空)。
//!
//! Windows 复用已引入的 `winapi` 0.3 `winbase` feature 里的
//! `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)`,不新增依赖。

use std::sync::atomic::{AtomicBool, Ordering};

static ACTIVE: AtomicBool = AtomicBool::new(false);

/// 一次设置穿回前端的报告(可直接跨 Tauri 边界)。
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepPreventionReport {
    /// true = 已向系统声明保持唤醒;false = 未持锁(含未判定/失败)
    pub active: bool,
    /// `supported` / `unsupported` / `failed`
    pub state: String,
    /// 判定依据或未判定原因(不含用户数据)
    pub reason: String,
    /// `win32` / `platform`
    pub source: String,
}

fn report(active: bool, state: &str, reason: impl Into<String>, source: &str) -> SleepPreventionReport {
    SleepPreventionReport {
        active,
        state: state.to_string(),
        reason: reason.into(),
        source: source.to_string(),
    }
}

/// 纯判据:平台 + 系统调用结果 → 三态报告。夹具可直接注入,不依赖 OS。
pub fn classify_sleep_prevention(platform: &str, call_ok: bool, requested: bool) -> SleepPreventionReport {
    if platform != "windows" {
        return report(false, "unsupported", "unsupported-platform", "platform");
    }
    if !call_ok {
        return report(false, "failed", "SetThreadExecutionState-failed", "win32");
    }
    report(requested, "supported", "ok", "win32")
}

/// 真正向 OS 声明/撤销保持唤醒。返回系统调用是否成功。
fn set_native(active: bool) -> bool {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winbase::SetThreadExecutionState;
        // winapi 0.3 的 winbase 未导出这两个常量（部分 feature 组合下缺失）；
        // 数值与 Win32 SDK 的 EXECUTION_STATE 定义一致，直接本地固化避免依赖特性漂移。
        const ES_CONTINUOUS: u32 = 0x8000_0000;
        const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;
        let flags = if active {
            ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        } else {
            ES_CONTINUOUS
        };
        // SAFETY: 纯系统调用,无指针参数、无缓冲区生命周期问题。
        unsafe { SetThreadExecutionState(flags) != 0 }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = active;
        false
    }
}

/// Tauri command:幂等地设置保持唤醒。`classify` 用真实平台,失败时 ACTIVE 不翻。
pub fn set_sleep_prevention(active: bool) -> SleepPreventionReport {
    if ACTIVE.load(Ordering::SeqCst) == active {
        return classify_sleep_prevention(std::env::consts::OS, cfg!(target_os = "windows"), active);
    }
    let ok = set_native(active);
    if ok {
        ACTIVE.store(active, Ordering::SeqCst);
    }
    classify_sleep_prevention(std::env::consts::OS, ok, active)
}

/// 仅供测试/进程退出兜底:强制清标志(不调系统 API,避免测试间互相污染)。
#[cfg(test)]
pub fn reset_for_tests() {
    ACTIVE.store(false, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_three_states() {
        assert_eq!(classify_sleep_prevention("windows", true, true).state, "supported");
        assert_eq!(classify_sleep_prevention("windows", false, true).state, "failed");
        assert_eq!(classify_sleep_prevention("linux", true, true).state, "unsupported");
    }

    #[test]
    fn failure_never_claims_active() {
        let failed = classify_sleep_prevention("windows", false, true);
        assert!(!failed.active, "调用失败绝不能冒充已持锁");
        let unsupported = classify_sleep_prevention("macos", true, true);
        assert!(!unsupported.active, "非 Windows 绝不能冒充已持锁");
    }

    #[test]
    fn release_report_is_not_active() {
        let released = classify_sleep_prevention("windows", true, false);
        assert!(!released.active);
        assert_eq!(released.state, "supported");
    }
}
