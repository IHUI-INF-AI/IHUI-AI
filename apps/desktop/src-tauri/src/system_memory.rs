// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! B3-04 提交内存余量预判(2026-11-23;只读,零副作用)。
//!
//! 病灶:本仓起大任务/编译/批量写之前没有任何"这台机器现在撑不撑得住"的读数。取证件在
//! 系统提交内存(commit limit = 物理 + 页面文件)上先判再动手,失败时能给出"是机器没余量"而不是
//! "任务自己崩了"。
//!
//! 判据四条:
//! - 四态封闭:`ok` / `tight` / `critical` / `unjudged`;
//! - **取不到不冒充**:读数缺失、提交上限为 0 一律 `unjudged` 并点名原因,绝不当成"有余量";
//! - 请求本身超余量 ⇒ 直接 `critical`(不等到"剩多少百分比"那一档);
//! - 分档看**扣掉请求之后**的余量占比(15% 起紧、5% 起急),阈值常量可单点调整。

use serde::Serialize;

/// 余量占比低于此值 ⇒ tight(百分比,整数运算,避免浮点判等)。
pub const TIGHT_REMAINING_PCT: u64 = 15;
/// 余量占比低于此值 ⇒ critical。
pub const CRITICAL_REMAINING_PCT: u64 = 5;

/// 一次系统内存读数(字节)。`*_commit_*` 来自系统提交限额(物理 + 页面文件)。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MemoryReading {
    pub total_physical_bytes: u64,
    pub avail_physical_bytes: u64,
    pub total_commit_bytes: u64,
    pub avail_commit_bytes: u64,
}

/// 一次预判的结论(可直接穿过 Tauri 边界)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryReport {
    /// `ok` / `tight` / `critical` / `unjudged`
    pub state: String,
    /// 判定依据或未判定原因(不含用户数据)。
    pub reason: String,
    /// 原始读数;取不到时为 `None`(前端据此能区分"没读"与"读了但紧")。
    pub reading: Option<MemoryReading>,
    /// 本次要申请的量(字节)。
    pub requested_bytes: u64,
    /// 扣掉请求之后仍可用的提交内存(字节);未判定时为 0。
    pub headroom_bytes: u64,
}

fn report(
    state: &str,
    reason: impl Into<String>,
    reading: Option<MemoryReading>,
    requested_bytes: u64,
    headroom_bytes: u64,
) -> MemoryReport {
    MemoryReport {
        state: state.to_string(),
        reason: reason.into(),
        reading,
        requested_bytes,
        headroom_bytes,
    }
}

/// 纯判据:读数 + 请求量 → 四态。`None` 与"提交上限为 0"都落未判定(不冒充有余量)。
pub fn classify_pressure(reading: Option<MemoryReading>, requested_bytes: u64) -> MemoryReport {
    let Some(reading) = reading else {
        return report("unjudged", "read-failed", None, requested_bytes, 0);
    };
    if reading.total_commit_bytes == 0 {
        // 提交上限读成 0 只可能是读数坏了(Windows 上恒 > 0);按 0 算会把一切都判成 critical。
        return report(
            "unjudged",
            "commit-limit-unknown",
            Some(reading),
            requested_bytes,
            0,
        );
    }
    let avail = reading.avail_commit_bytes;
    if requested_bytes > avail {
        return report(
            "critical",
            "request-exceeds-commit",
            Some(reading),
            requested_bytes,
            avail,
        );
    }
    let headroom = avail - requested_bytes;
    let remaining_pct = remaining_pct(headroom, reading.total_commit_bytes);
    let (state, reason) = if remaining_pct < CRITICAL_REMAINING_PCT {
        ("critical", "commit-exhausted")
    } else if remaining_pct < TIGHT_REMAINING_PCT {
        ("tight", "commit-low")
    } else {
        ("ok", "commit-sufficient")
    };
    report(state, reason, Some(reading), requested_bytes, headroom)
}

/// 余量占提交上限的百分比(整数;u128 中间量防大数相乘溢出)。
fn remaining_pct(headroom_bytes: u64, total_commit_bytes: u64) -> u64 {
    if total_commit_bytes == 0 {
        return 0;
    }
    ((headroom_bytes as u128) * 100 / (total_commit_bytes as u128)) as u64
}

/// 现读 + 预判(唯一执行入口)。
pub fn probe_pressure(requested_bytes: u64) -> MemoryReport {
    classify_pressure(read_memory(), requested_bytes)
}

/// Windows 读取实现:一次 `GlobalMemoryStatusEx`,失败返 `None`(由判据落未判定)。
#[cfg(windows)]
pub fn read_memory() -> Option<MemoryReading> {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

    let mut status = MEMORYSTATUSEX {
        dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
        dwMemoryLoad: 0,
        ullTotalPhys: 0,
        ullAvailPhys: 0,
        ullTotalPageFile: 0,
        ullAvailPageFile: 0,
        ullTotalVirtual: 0,
        ullAvailVirtual: 0,
        ullAvailExtendedVirtual: 0,
    };
    // SAFETY: `status.dwLength` 已按结构体实际尺寸填好,指针指向本栈帧有效变量;
    // 该 API 只写入该结构,不保留指针。
    if unsafe { GlobalMemoryStatusEx(&mut status) }.is_err() {
        return None;
    }
    Some(MemoryReading {
        total_physical_bytes: status.ullTotalPhys,
        avail_physical_bytes: status.ullAvailPhys,
        total_commit_bytes: status.ullTotalPageFile,
        avail_commit_bytes: status.ullAvailPageFile,
    })
}

/// 非 Windows:没有等价读数,如实返 `None`(判据层会给 `unjudged` + `read-failed`)。
#[cfg(not(windows))]
pub fn read_memory() -> Option<MemoryReading> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reading(total_commit: u64, avail_commit: u64) -> MemoryReading {
        MemoryReading {
            total_physical_bytes: total_commit,
            avail_physical_bytes: avail_commit,
            total_commit_bytes: total_commit,
            avail_commit_bytes: avail_commit,
        }
    }

    #[test]
    fn missing_reading_is_unjudged_not_ok() {
        let report = classify_pressure(None, 0);
        assert_eq!(report.state, "unjudged");
        assert_eq!(report.reason, "read-failed");
        assert!(report.reading.is_none(), "没读到就别编一份读数出来");
    }

    #[test]
    fn zero_commit_limit_is_unjudged() {
        let report = classify_pressure(Some(reading(0, 0)), 1024);
        assert_eq!(report.state, "unjudged");
        assert_eq!(report.reason, "commit-limit-unknown");
        assert_eq!(report.reading, Some(reading(0, 0)));
    }

    #[test]
    fn plenty_of_headroom_is_ok() {
        let report = classify_pressure(Some(reading(100, 60)), 0);
        assert_eq!(report.state, "ok");
        assert_eq!(report.reason, "commit-sufficient");
        assert_eq!(report.headroom_bytes, 60);
    }

    #[test]
    fn request_larger_than_available_is_critical() {
        let report = classify_pressure(Some(reading(100, 10)), 20);
        assert_eq!(report.state, "critical");
        assert_eq!(report.reason, "request-exceeds-commit");
        assert_eq!(report.headroom_bytes, 10, "超出时余量如实报可用的那点");
    }

    #[test]
    fn request_eating_into_headroom_downgrades_state() {
        // 余量 30 / 上限 100,请求 27 ⇒ 扣完剩 3%(< 5%) ⇒ critical
        let report = classify_pressure(Some(reading(100, 30)), 27);
        assert_eq!(report.state, "critical");
        assert_eq!(report.reason, "commit-exhausted");
        assert_eq!(report.headroom_bytes, 3);
    }

    #[test]
    fn tight_threshold_is_strictly_less_than() {
        // 余量 15% ⇒ ok(阈值是"低于")
        assert_eq!(classify_pressure(Some(reading(100, 15)), 0).state, "ok");
        // 余量 10% ⇒ tight
        let tight = classify_pressure(Some(reading(100, 10)), 0);
        assert_eq!(tight.state, "tight");
        assert_eq!(tight.reason, "commit-low");
        // 余量 5% ⇒ tight;4% ⇒ critical
        assert_eq!(classify_pressure(Some(reading(100, 5)), 0).state, "tight");
        assert_eq!(
            classify_pressure(Some(reading(100, 4)), 0).state,
            "critical"
        );
    }

    #[test]
    fn headroom_never_underflows() {
        // requested == avail 是合法边界:余量 0 ⇒ critical,而不是减法 panic
        let report = classify_pressure(Some(reading(100, 10)), 10);
        assert_eq!(report.state, "critical");
        assert_eq!(report.headroom_bytes, 0);
    }

    #[test]
    fn real_read_reports_four_fields_on_windows() {
        // 只在真机上跑的读面:能读到就必须四字段齐全且提交上限 > 0(否则判据会拒判)
        if let Some(reading) = read_memory() {
            assert!(reading.total_commit_bytes > 0, "真机提交上限不可能为 0");
            assert!(reading.avail_commit_bytes <= reading.total_commit_bytes);
            assert!(reading.total_physical_bytes > 0);
            let report = classify_pressure(Some(reading), 0);
            assert_ne!(report.state, "unjudged");
        }
        // 非 Windows 返回 None 是预期,不在这里判失败
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
