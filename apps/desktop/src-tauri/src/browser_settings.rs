// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 浏览器内存策略的持久化设置(2026-10-25 立)。
//!
//! 为什么单开一个文件:标签上限与空闲休眠阈值此前是**写死的常量 + 环境变量**,
//! 环境变量只在启动进程时能设,普通用户改不了 —— 等于"世界上只有验收脚本能调"。
//! 现在落成 `<app_config_dir>/browser-settings.json`,并且**读取发生在每次判定时**
//! (不是启动时抓一次),所以改完下一轮维护就会用新值,不必重启。
//!
//! 三层优先级(高 → 低):环境变量 `IHUI_TAB_IDLE_DISCARD_SECS` > 设置文件 > 内置默认。
//! 环境变量保留是为了验收脚本能给出确定的时间窗,不受用户设置干扰。
//!
//! 与 `desktop_prefs.rs` 同一套做法:纯函数(normalize / 读取 / 写入)与 AppHandle
//! 薄壳分开,测试只喂路径与结构体,不依赖运行中的 app。

use crate::IpcError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

/// 停靠浏览器(工作区面板)标签上限的允许区间。
pub const DOCK_TABS_RANGE: std::ops::RangeInclusive<u32> = 4..=12;
/// 独立窗口标签上限的允许区间。
pub const TABS_RANGE: std::ops::RangeInclusive<u32> = 4..=16;
/// 空闲休眠阈值的允许区间(秒);0 = 关闭空闲休眠(只冻结、不销毁)。
pub const IDLE_SECS_RANGE: std::ops::RangeInclusive<u32> = 60..=86_400;

/// 浏览器内存策略。每个字段都有默认值,默认值只由下面手写的 `impl Default` 决定
/// (字段级 `serde(default)` 会取类型自己的 Default,那是本仓记过的坑)。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct BrowserSettings {
    /// 停靠档同时存在的标签数上限(默认 6)。
    pub max_dock_tabs: u32,
    /// 独立窗口同时存在的标签数上限(默认 12)。
    pub max_tabs: u32,
    /// 隐藏标签安静满这么多秒就休眠丢弃;`0` = 关闭空闲休眠(默认 900 = 15 分钟)。
    pub idle_discard_secs: u32,
}

impl Default for BrowserSettings {
    fn default() -> Self {
        Self { max_dock_tabs: 6, max_tabs: 12, idle_discard_secs: 900 }
    }
}

/// `set_browser_settings` 的入参:每档都是 `Option`,缺失 = 不改这一档。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct BrowserSettingsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_dock_tabs: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tabs: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idle_discard_secs: Option<u32>,
}

impl BrowserSettingsPatch {
    pub fn merge_into(self, base: BrowserSettings) -> BrowserSettings {
        BrowserSettings {
            max_dock_tabs: self.max_dock_tabs.unwrap_or(base.max_dock_tabs),
            max_tabs: self.max_tabs.unwrap_or(base.max_tabs),
            idle_discard_secs: self.idle_discard_secs.unwrap_or(base.idle_discard_secs),
        }
    }
}

/// 把越界值夹回允许区间(不报错:设置项这类"填错了也要能用"的字段,夹住比拒绝好,
/// 但必须喊一声,否则用户看到的是"我填了 100 却只开 16 个标签"的无声落差)。
pub fn normalize_settings(s: BrowserSettings) -> BrowserSettings {
    let mut out = s;
    if !DOCK_TABS_RANGE.contains(&out.max_dock_tabs) {
        let clamped = out.max_dock_tabs.clamp(*DOCK_TABS_RANGE.start(), *DOCK_TABS_RANGE.end());
        log::warn!(
            "[browser-settings] max_dock_tabs={} 越界,夹到 {clamped}(允许 {:?})",
            out.max_dock_tabs,
            DOCK_TABS_RANGE
        );
        out.max_dock_tabs = clamped;
    }
    if !TABS_RANGE.contains(&out.max_tabs) {
        let clamped = out.max_tabs.clamp(*TABS_RANGE.start(), *TABS_RANGE.end());
        log::warn!(
            "[browser-settings] max_tabs={} 越界,夹到 {clamped}(允许 {:?})",
            out.max_tabs,
            TABS_RANGE
        );
        out.max_tabs = clamped;
    }
    if out.idle_discard_secs != 0 && !IDLE_SECS_RANGE.contains(&out.idle_discard_secs) {
        let clamped = out.idle_discard_secs.clamp(*IDLE_SECS_RANGE.start(), *IDLE_SECS_RANGE.end());
        log::warn!(
            "[browser-settings] idle_discard_secs={} 越界,夹到 {clamped}(允许 0 或 {:?})",
            out.idle_discard_secs,
            IDLE_SECS_RANGE
        );
        out.idle_discard_secs = clamped;
    }
    out
}

pub const SETTINGS_FILE_NAME: &str = "browser-settings.json";

pub fn settings_path_in(config_dir: &Path) -> PathBuf {
    config_dir.join(SETTINGS_FILE_NAME)
}

/// 读 + 归一。缺失/损坏一律回默认(不做半份抢救)。
pub fn load_settings_from(path: &Path) -> BrowserSettings {
    let raw = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(_) => return normalize_settings(BrowserSettings::default()),
    };
    // BOM 剥离:与 desktop_prefs 同一处教训(非 Rust 写手会留 U+FEFF,serde_json 见 BOM 即失败)
    let body = raw.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&raw);
    match serde_json::from_slice::<BrowserSettings>(body) {
        Ok(parsed) => normalize_settings(parsed),
        Err(e) => {
            log::warn!(
                "[browser-settings] {} 解析失败({e}),整份回退默认值",
                path.display()
            );
            normalize_settings(BrowserSettings::default())
        }
    }
}

pub fn save_settings_to(path: &Path, s: &BrowserSettings) -> Result<(), IpcError> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| IpcError::from_io("create_dir_all", dir, e))?;
    }
    let bytes =
        serde_json::to_vec_pretty(s).map_err(|e| IpcError::internal(format!("serialize: {e}")))?;
    std::fs::write(path, bytes).map_err(|e| IpcError::from_io("write", path, e))
}

// ================== 进程内唯一真值 ==================

/// 生效中的设置。`init` 之前是默认值 —— 早于 setup 的调用不会 panic,只会拿到默认档。
static CURRENT: std::sync::OnceLock<std::sync::RwLock<BrowserSettings>> =
    std::sync::OnceLock::new();

fn cell() -> &'static std::sync::RwLock<BrowserSettings> {
    CURRENT.get_or_init(|| std::sync::RwLock::new(BrowserSettings::default()))
}

/// 启动时调用一次:把设置文件读进进程。
pub fn init(app: &tauri::AppHandle) {
    let loaded = match app.path().app_config_dir() {
        Ok(dir) => load_settings_from(&settings_path_in(dir.as_path())),
        Err(e) => {
            log::warn!("[browser-settings] app_config_dir 取不到({e}),本次用默认设置");
            normalize_settings(BrowserSettings::default())
        }
    };
    *cell().write().unwrap_or_else(|e| e.into_inner()) = loaded;
}

/// 当前生效值(每次判定都读,改完立即生效)。
pub fn current() -> BrowserSettings {
    *cell().read().unwrap_or_else(|e| e.into_inner())
}

/// 合并 patch → 归一 → 落盘 → 更新进程内真值。落盘失败也要更新内存值?
/// **不**:写不进盘的值重启就消失,界面会显示"改过了",那是最糟的形态 —— 直接报错,
/// 让调用方看到失败。
pub fn apply(
    app: &tauri::AppHandle,
    patch: BrowserSettingsPatch,
) -> Result<BrowserSettings, IpcError> {
    let next = normalize_settings(patch.merge_into(current()));
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| IpcError::internal(format!("app_config_dir: {e}")))?;
    save_settings_to(&settings_path_in(dir.as_path()), &next)?;
    *cell().write().unwrap_or_else(|e| e.into_inner()) = next;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("ihui-browser-settings-{}-{}", std::process::id(), tag));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn defaults_are_the_documented_values() {
        let d = BrowserSettings::default();
        assert_eq!(d.max_dock_tabs, 6);
        assert_eq!(d.max_tabs, 12);
        assert_eq!(d.idle_discard_secs, 900);
        assert_eq!(normalize_settings(d), d, "默认值必须已经是归一后的形态");
    }

    #[test]
    fn out_of_range_is_clamped_not_rejected() {
        let got = normalize_settings(BrowserSettings {
            max_dock_tabs: 1,
            max_tabs: 99,
            idle_discard_secs: 5,
        });
        assert_eq!(got.max_dock_tabs, 4);
        assert_eq!(got.max_tabs, 16);
        assert_eq!(got.idle_discard_secs, 60);
    }

    #[test]
    fn zero_idle_secs_means_disabled_and_is_legal() {
        // 0 是"关闭空闲休眠"的合法档,不得被夹成 60 —— 夹了就等于用户关不掉。
        let got = normalize_settings(BrowserSettings { idle_discard_secs: 0, ..Default::default() });
        assert_eq!(got.idle_discard_secs, 0);
    }

    #[test]
    fn missing_file_uses_defaults_and_partial_json_keeps_other_defaults() {
        let dir = scratch_dir("partial");
        let path = settings_path_in(&dir);
        assert_eq!(load_settings_from(&path), BrowserSettings::default());

        std::fs::write(&path, br#"{"max_dock_tabs":8}"#).expect("write partial");
        let loaded = load_settings_from(&path);
        assert_eq!(loaded.max_dock_tabs, 8);
        // 未填的档取默认,不是 u32::default()=0(否则 max_tabs 会变成 4)
        assert_eq!(loaded.max_tabs, 12);
        assert_eq!(loaded.idle_discard_secs, 900);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn round_trip_and_bom_tolerance() {
        let dir = scratch_dir("roundtrip");
        let path = settings_path_in(&dir);
        let wanted = BrowserSettings { max_dock_tabs: 5, max_tabs: 8, idle_discard_secs: 120 };
        save_settings_to(&path, &wanted).expect("save");
        assert_eq!(load_settings_from(&path), wanted);

        let mut bytes = vec![0xEFu8, 0xBB, 0xBF];
        bytes.extend_from_slice(std::fs::read(&path).expect("re-read").as_slice());
        std::fs::write(&path, &bytes).expect("write bom");
        assert_eq!(load_settings_from(&path), wanted);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn patch_none_leaves_field_alone() {
        let merged = BrowserSettingsPatch { max_tabs: Some(10), ..Default::default() }
            .merge_into(BrowserSettings::default());
        assert_eq!(merged.max_tabs, 10);
        assert_eq!(merged.max_dock_tabs, 6);
        assert_eq!(merged.idle_discard_secs, 900);
        assert_eq!(serde_json::to_string(&BrowserSettingsPatch::default()).unwrap(), "{}");
    }
}
