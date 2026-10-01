// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端「行为偏好」的单一真相源(2026-09-28 立,用户批准的托盘/关窗/启动/角标设置)。
//!
//! 为什么单开一个文件:`DesktopPrefs` 的**判定**(两条不变量 + 关窗去向决策)必须能在
//! 没有运行中的 app 的情况下被真跑测试覆盖 —— 把 `#[tauri::command]` 混进来的话,这些判据
//! 就只能等整条 tauri 事件循环跑起来才谈得上验证,而本仓最高频的失效型正是
//! 「判据写了、没人跑得动,于是它对着空气报绿」(见 git_channel_ipc.rs 同样的分层理由)。
//! 因此本文件把**纯函数**(`normalize_prefs` / `decide_close_action` / `*_from` / `*_to`)
//! 与**薄壳**(取 `app_config_dir` 的两个 AppHandle 包装)分开,测试只喂路径与结构体。
//!
//! 落点:`<app_config_dir>/desktop-behavior.json`,snake_case,与既有
//! `tray-settings.json`(`lib.rs` 的 `TraySettings`)同一套持久化先例。
//!
//! ⚠️ `show_tray_icon` 与既有的 `get_tray_always_visible` / `set_tray_always_visible`
//! 是**两件事**:那一条说的是 Windows 通知区「图标是否常驻(注册表 IsPromoted)」,
//! 本字段说的是「托盘图标到底存不存在」。不得合并、不得改名互相顶替。

// G-715:桌面 IPC 的错误身份档定义在 crate 根(lib.rs),这里只引它,不开第二份档位表。
use crate::IpcError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

/// 关闭窗口时的去向。JSON 里就是 `"hide"` / `"quit"` / `"ask"` 三个小写字面量。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseBehavior {
    /// 隐藏到托盘(托盘不存在时这个去向无处可去,由不变量 1 归一成 Quit)。
    Hide,
    /// 直接退出进程。
    Quit,
    /// 每次问用户(前端弹确认框,再经 `resolve_close_choice` 回答)。
    Ask,
}

/// 托盘图标**左键单击**的语义。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TraySingleClick {
    /// 弹托盘菜单(tauri 的 `show_menu_on_left_click` 默认即 true,所以这一档 = 现状)。
    Menu,
    /// 左键改为显示/隐藏主窗口的开关,菜单只由右键唤出。
    ToggleWindow,
}

/// `decide_close_action` 的结论。
///
/// 刻意与 `CloseBehavior` 分家:配置里写着 `ask` 而此刻**没有托盘**,结论就不是「问」
/// (问了也没有意义 —— 隐藏要去的地方不存在)。用一个新类型,调用方无法把两者混为一谈。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseDecision {
    Hide,
    Quit,
    Ask,
}

/// 托盘菜单项的**唯一**登记表:id、本地化标签下标、分隔符分组。
///
/// 一张表同时喂三处,不得再抄第二份:
/// - `default_tray_menu_items()`(默认值)
/// - `normalize_prefs` 的「未知 id 丢弃」判据
/// - `build_tray`(lib.rs)按 id 取标签 + 按 group 变化插分隔符
#[derive(Debug, Clone, Copy)]
pub struct TrayMenuItem {
    pub id: &'static str,
    /// `tray_menu_labels()` 的下标(0..=6,顺序与历史 7 项一致)。
    pub label_index: usize,
    /// 分组号:相邻两项分组不同 ⇒ 中间有一条分隔线(复刻历史形态)。
    pub group: u8,
}

pub const TRAY_MENU_ITEMS: [TrayMenuItem; 7] = [
    TrayMenuItem { id: "new_chat", label_index: 0, group: 0 },
    TrayMenuItem { id: "show", label_index: 1, group: 1 },
    TrayMenuItem { id: "hide", label_index: 2, group: 1 },
    TrayMenuItem { id: "theme", label_index: 3, group: 2 },
    TrayMenuItem { id: "settings", label_index: 4, group: 2 },
    TrayMenuItem { id: "update", label_index: 5, group: 2 },
    TrayMenuItem { id: "quit", label_index: 6, group: 3 },
];

/// 「退出」这一项的 id:不变量 2 要求菜单里永远有它(否则用户没法从托盘退进程)。
pub const TRAY_MENU_QUIT_ID: &str = "quit";

/// 按 id 查登记项(归一化之后一定查得到,因为未知 id 已被丢弃)。
pub fn tray_menu_item(id: &str) -> Option<TrayMenuItem> {
    TRAY_MENU_ITEMS.iter().copied().find(|item| item.id == id)
}

/// 默认菜单项列表由登记表导出 —— 不是第二份手抄的名字。
pub fn default_tray_menu_items() -> Vec<String> {
    TRAY_MENU_ITEMS.iter().map(|item| item.id.to_string()).collect()
}

/// 桌面端行为偏好。**每个字段都有默认值**,且默认值只由下面手写的 `impl Default` 决定。
///
/// 序列化侧用**容器级** `#[serde(default)]`:字段缺失时取 `Default::default()` 里
/// **该字段**的值。写成字段级 `#[serde(default)]` 会改取「字段类型自己的 Default」,
/// 于是 `show_tray_icon` 缺失 ⇒ `false`、`unread_badge` 缺失 ⇒ `false` —— 即 lib.rs
/// `TraySettings`(:594 那条注释)记过的「派生 Default 把默认开关静默关掉」同一型。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopPrefs {
    /// 托盘图标是否存在。
    pub show_tray_icon: bool,
    /// 点窗口关闭按钮时的去向。
    pub close_behavior: CloseBehavior,
    /// 启动时直接进后台(不弹主窗口)。
    pub launch_minimized: bool,
    /// 托盘左键单击的语义。
    pub tray_single_click: TraySingleClick,
    /// 有未读消息时在任务栏图标上画小红点。
    pub unread_badge: bool,
    /// 托盘菜单里有哪些项(顺序即菜单顺序)。
    pub tray_menu_items: Vec<String>,
}

/// 手写 Default:见上面那段 —— bool 的派生 Default 是 false,会把两个默认「开」的开关
/// 静默关掉(照抄 lib.rs :594-600 的教训,不是审美)。
impl Default for DesktopPrefs {
    fn default() -> Self {
        Self {
            show_tray_icon: true,
            close_behavior: CloseBehavior::Ask,
            launch_minimized: false,
            tray_single_click: TraySingleClick::Menu,
            unread_badge: true,
            tray_menu_items: default_tray_menu_items(),
        }
    }
}

/// `set_desktop_prefs` 的入参:每档都是 `Option`,缺失 = 「不改这一档」。
///
/// 这里字段级/容器级的 `#[serde(default)]` 语义一致(都是 `None`),所以两种写法都对;
/// 取容器级 + `skip_serializing_if`,回包/日志里只出现调用方真填了的键。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DesktopPrefsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_tray_icon: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub close_behavior: Option<CloseBehavior>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch_minimized: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tray_single_click: Option<TraySingleClick>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unread_badge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tray_menu_items: Option<Vec<String>>,
}

impl DesktopPrefsPatch {
    /// patch 覆盖到已存盘偏好之上(纯合并,**不做归一** —— 归一只有一个出口)。
    pub fn merge_into(self, base: DesktopPrefs) -> DesktopPrefs {
        DesktopPrefs {
            show_tray_icon: self.show_tray_icon.unwrap_or(base.show_tray_icon),
            close_behavior: self.close_behavior.unwrap_or(base.close_behavior),
            launch_minimized: self.launch_minimized.unwrap_or(base.launch_minimized),
            tray_single_click: self.tray_single_click.unwrap_or(base.tray_single_click),
            unread_badge: self.unread_badge.unwrap_or(base.unread_badge),
            tray_menu_items: self.tray_menu_items.unwrap_or(base.tray_menu_items),
        }
    }
}

/// 不变量的**唯一**落点:加载、写入、关窗判定三条路径都过这里。
/// 两处各写一遍必然漂移(本仓「两处算同一件事」记过多次),所以只有这一份。
pub fn normalize_prefs(prefs: DesktopPrefs) -> DesktopPrefs {
    let mut prefs = prefs;

    // 不变量 1:没有托盘就没有「隐藏到托盘」,这一组合是自我矛盾的 ⇒ 归一成 Quit。
    // 必须喊出来:静默改用户的设置,下次他只会看见「设置没生效」。
    if !prefs.show_tray_icon && prefs.close_behavior == CloseBehavior::Hide {
        log::warn!(
            "[desktop-prefs] 不变量:show_tray_icon=false 时 close_behavior=hide 无处可藏,\
             已按 quit 处理(要保留隐藏语义请先把托盘打开)"
        );
        prefs.close_behavior = CloseBehavior::Quit;
    }

    // 不变量 2:菜单必须留得下「退出」,且只认登记表里的 id。
    let mut kept: Vec<String> = Vec::with_capacity(prefs.tray_menu_items.len());
    for id in prefs.tray_menu_items {
        if tray_menu_item(&id).is_some() {
            kept.push(id);
        } else {
            log::warn!("[desktop-prefs] 丢弃未知托盘菜单项 id: {id}(不在 TRAY_MENU_ITEMS 登记表里)");
        }
    }
    if !kept.iter().any(|id| id == TRAY_MENU_QUIT_ID) {
        log::warn!(
            "[desktop-prefs] tray_menu_items 里没有 {TRAY_MENU_QUIT_ID},已补到末尾(托盘必须留得下退出出口)"
        );
        kept.push(TRAY_MENU_QUIT_ID.to_string());
    }
    prefs.tray_menu_items = kept;

    prefs
}

/// 关窗去向的唯一判定:先归一,再按配置映射;`ask` 但托盘不在 ⇒ 直接 Quit。
///
/// `tray_present` 取的是**运行时事实**(`app.tray_by_id("main").is_some()`)而不是
/// `show_tray_icon`:托盘创建可能整个失败(build_tray 返回 Err),那时 prefs 里仍是 true,
/// 而「隐藏」真的无处可去。
pub fn decide_close_action(prefs: &DesktopPrefs, tray_present: bool) -> CloseDecision {
    let normalized = normalize_prefs(prefs.clone());
    match normalized.close_behavior {
        CloseBehavior::Hide => CloseDecision::Hide,
        CloseBehavior::Quit => CloseDecision::Quit,
        CloseBehavior::Ask => {
            if tray_present {
                CloseDecision::Ask
            } else {
                // 不许问:没有托盘就没有「隐藏」这一支,弹框里给两个选项而其中一个做不到,
                // 比不给选项更糟。选 Quit 并写明原因(本仓禁的是静默无终态,不是终态本身)。
                log::warn!(
                    "[desktop-prefs] close_behavior=ask 但托盘图标不在 ⇒ 不问,直接 quit\
                     (隐藏到托盘无处可去)"
                );
                CloseDecision::Quit
            }
        }
    }
}

/// 偏好文件名(不含目录,便于测试与 lib.rs 共用同一个名字)。
pub const PREFS_FILE_NAME: &str = "desktop-behavior.json";

pub fn prefs_path_in(config_dir: &Path) -> PathBuf {
    config_dir.join(PREFS_FILE_NAME)
}

/// 读 + 归一。缺失/损坏一律回退 `DesktopPrefs::default()`(再走一遍归一,保证内存里
/// 不存在违规形态 —— 默认值本身也必须是归一后的)。
pub fn load_prefs_from(path: &Path) -> DesktopPrefs {
    let raw = match std::fs::read(path) {
        Ok(bytes) => bytes,
        // 首次运行没有这个文件属正常形态,不报警(但也不得把"没读到"当成"读到了空的")。
        Err(_) => return normalize_prefs(DesktopPrefs::default()),
    };
    // BOM 只剥这一个:Windows 侧任何非 Rust 的写手(PowerShell 5.1 的 `-Encoding utf8`、记事本)
    // 都会在文件头留 U+FEFF,而 serde_json 见 BOM 即整份解析失败 ⇒ 用户的全部偏好静默回退默认值。
    // 本票的真机采样就撞上过一次:五轮读数全成 vis=1,看着像"开关失效",其实是量具换了编码。
    let body = raw.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&raw);
    match serde_json::from_slice::<DesktopPrefs>(body) {
        Ok(parsed) => normalize_prefs(parsed),
        Err(e) => {
            log::warn!(
                "[desktop-prefs] {} 解析失败({e}),整份回退默认值(不做半份抢救:键名已经不可信)",
                path.display()
            );
            normalize_prefs(DesktopPrefs::default())
        }
    }
}

/// 写盘(目录不存在则创建)。失败返回**带身份档**的原因,由调用方决定喊多大声 —— 不得吞。
///
/// G-715(2026-09-30):此前返回 `String`,于是"目录不可写(权限)"与"序列化失败(内部缺陷)"
/// 在日志与任何上游出口上完全同形。现在档名由 `IpcError::from_io` 按 `ErrorKind` 给出 ——
/// 归类只看 kind,不看 io 的文案(Windows 的报错措辞随系统语言变,按文案猜档就是本票要消灭的形态)。
pub fn save_prefs_to(path: &Path, prefs: &DesktopPrefs) -> Result<(), IpcError> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| IpcError::from_io("create_dir_all", dir, e))?;
    }
    let bytes =
        serde_json::to_vec_pretty(prefs).map_err(|e| IpcError::internal(format!("serialize: {e}")))?;
    std::fs::write(path, bytes).map_err(|e| IpcError::from_io("write", path, e))
}

// ================== 老用户迁移判据(纯函数)==================

/// 是否把 `launch_minimized` 从 false 迁成 true。三条**同时**成立才迁:
/// ① 偏好文件此前不存在(= "启动后进后台"这个开关上线后的首次启动);
/// ② 当前值为 false(不覆盖用户已明确选过的答案);
/// ③ 本次命令行带着 `--minimized`(它由 autostart 插件写死,只有"开机自启"这一条路会带)。
///
/// 立因:旧版没有开关时,开机自启一律最小化到托盘。新默认值是 false,不做迁移的话,
/// 装过自启的老用户升级后开机突然弹一个窗口 —— 用户报回来的会是"故障",不是"新默认档"。
/// 反向也要成立:手动双击不带该参数 ⇒ 绝不迁移(否则首启就被藏进后台,像程序没启动)。
pub fn should_migrate_launch_minimized(
    prefs_absent_before: bool,
    current: bool,
    argv_has_minimized: bool,
) -> bool {
    prefs_absent_before && !current && argv_has_minimized
}

// ================== AppHandle 薄壳(lib.rs 只用这三条)==================

pub fn desktop_prefs_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| prefs_path_in(dir.as_path()))
}

pub fn load_desktop_prefs(app: &tauri::AppHandle) -> DesktopPrefs {
    match desktop_prefs_path(app) {
        Some(path) => load_prefs_from(&path),
        None => {
            log::warn!("[desktop-prefs] app_config_dir 取不到,本次用默认偏好(未读盘)");
            normalize_prefs(DesktopPrefs::default())
        }
    }
}

/// `app_config_dir` 取不到属宿主内部缺陷(不是策略拒绝)⇒ internal 档,与 io 失败分得开。
pub fn save_desktop_prefs(app: &tauri::AppHandle, prefs: &DesktopPrefs) -> Result<(), IpcError> {
    let path = desktop_prefs_path(app)
        .ok_or_else(|| IpcError::internal("app_config_dir unavailable"))?;
    save_prefs_to(&path, prefs)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 临时目录:走系统 TEMP(本仓 §26 的口径是「用 `$env:TEMP`/`os.tmpdir()` 而非硬编码盘符」),
    /// 名字带 pid 防并发测试互踩,用例结束即删。
    fn scratch_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ihui-desktop-prefs-{}-{}", std::process::id(), tag));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    fn prefs(show_tray_icon: bool, close_behavior: CloseBehavior) -> DesktopPrefs {
        DesktopPrefs {
            show_tray_icon,
            close_behavior,
            ..DesktopPrefs::default()
        }
    }

    // ── 1. 默认值:两条默认「开」的开关必须是 true(派生 Default 会静默关掉它们) ──

    #[test]
    fn defaults_are_the_documented_values() {
        let d = DesktopPrefs::default();
        assert!(d.show_tray_icon, "show_tray_icon 默认必须是 true");
        assert_eq!(d.close_behavior, CloseBehavior::Ask);
        assert!(!d.launch_minimized);
        assert_eq!(d.tray_single_click, TraySingleClick::Menu);
        assert!(d.unread_badge, "unread_badge 默认必须是 true");
        // 负向对照:默认列表不是空表(空表会被归一成"只剩 quit",那与默认档不同形)
        assert_eq!(d.tray_menu_items, default_tray_menu_items());
        assert_eq!(d.tray_menu_items.len(), 7);
    }

    #[test]
    fn default_prefs_survive_normalize_unchanged() {
        // 默认值必须已经是归一后的形态:否则"读到默认"与"归一后"两个读数会分叉。
        assert_eq!(normalize_prefs(DesktopPrefs::default()), DesktopPrefs::default());
    }

    // ── 2. serde:缺失文件 / 损坏文件 / 部分键 ──

    #[test]
    fn missing_file_falls_back_to_defaults() {
        let dir = scratch_dir("missing");
        let loaded = load_prefs_from(&prefs_path_in(&dir));
        assert_eq!(loaded, DesktopPrefs::default());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults() {
        let dir = scratch_dir("corrupt");
        let path = prefs_path_in(&dir);
        std::fs::write(&path, b"{ this is not json ").expect("write corrupt");
        assert_eq!(load_prefs_from(&path), DesktopPrefs::default());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 这条是「容器级 serde(default) + 手写 Default」这套组合的全部理由:
    /// 只填一个键时,**其余**键必须取默认值里的那一份,而不是字段类型的 Default。
    #[test]
    fn partial_json_keeps_other_fields_defaults_not_type_defaults() {
        let dir = scratch_dir("partial");
        let path = prefs_path_in(&dir);
        std::fs::write(&path, br#"{"close_behavior":"quit"}"#).expect("write partial");
        let loaded = load_prefs_from(&path);
        assert_eq!(loaded.close_behavior, CloseBehavior::Quit, "填了的那档要生效");
        // 负向对照:bool 的字段类型 Default 是 false —— 若写成字段级 serde(default) 这里就会红。
        assert!(loaded.show_tray_icon, "未填的 show_tray_icon 必须是默认 true(不是 bool::default)");
        assert!(loaded.unread_badge, "未填的 unread_badge 必须是默认 true(不是 bool::default)");
        assert_eq!(loaded.tray_menu_items, default_tray_menu_items());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn round_trip_saved_file_reads_back_identical() {
        let dir = scratch_dir("roundtrip");
        let path = prefs_path_in(&dir);
        let wanted = prefs(false, CloseBehavior::Ask);
        save_prefs_to(&path, &wanted).expect("save");
        assert_eq!(load_prefs_from(&path), wanted);
        // 落盘字节必须是 snake_case 的文档形态(前端与人工都会照这个读)
        let text = std::fs::read_to_string(&path).expect("read back");
        for key in [
            "show_tray_icon",
            "close_behavior",
            "launch_minimized",
            "tray_single_click",
            "unread_badge",
            "tray_menu_items",
        ] {
            assert!(text.contains(key), "JSON 里缺少 snake_case 键 {key}");
        }
        assert!(text.contains("\"ask\""), "close_behavior 要序列化成小写字面量");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── 3. 不变量 1:无托盘 + hide ⇒ quit(正反成对) ──

    #[test]
    fn invariant1_no_tray_with_hide_becomes_quit() {
        let normalized = normalize_prefs(prefs(false, CloseBehavior::Hide));
        assert_eq!(normalized.close_behavior, CloseBehavior::Quit);
        assert!(!normalized.show_tray_icon);
    }

    #[test]
    fn invariant1_does_not_touch_legal_combinations() {
        // 反面对照:三样都不该被改 —— 判据过宽会把用户 settings 里"看起来对"的那一档改掉。
        for (show, behavior) in [
            (true, CloseBehavior::Hide),
            (true, CloseBehavior::Quit),
            (true, CloseBehavior::Ask),
            (false, CloseBehavior::Quit),
            (false, CloseBehavior::Ask),
        ] {
            let normalized = normalize_prefs(prefs(show, behavior));
            assert_eq!(normalized.close_behavior, behavior, "(show={show}) 不该改 close_behavior");
        }
    }

    // ── 4. 不变量 2:菜单必须含 quit,未知 id 丢弃(正反成对) ──

    #[test]
    fn invariant2_appends_missing_quit_and_drops_unknown() {
        let input = DesktopPrefs {
            tray_menu_items: vec!["show".into(), "bogus_item".into(), "hide".into()],
            ..DesktopPrefs::default()
        };
        let normalized = normalize_prefs(input);
        assert_eq!(
            normalized.tray_menu_items,
            vec!["show".to_string(), "hide".to_string(), "quit".to_string()],
            "未知项要被丢掉、quit 补到末尾、其余顺序不变"
        );
    }

    #[test]
    fn invariant2_leaves_a_legal_menu_untouched() {
        // 反面对照:已经含 quit 的列表不得被再加一遍(重复项会在菜单里长出两个「退出」)。
        let input = DesktopPrefs {
            tray_menu_items: vec!["quit".into(), "new_chat".into()],
            ..DesktopPrefs::default()
        };
        let normalized = normalize_prefs(input);
        assert_eq!(normalized.tray_menu_items, vec!["quit".to_string(), "new_chat".to_string()]);
        assert_eq!(normalized.tray_menu_items.iter().filter(|id| *id == "quit").count(), 1);
    }

    #[test]
    fn invariant2_empty_list_still_ends_up_quit_only() {
        // 空表不是一种"合法但不含 quit"的例外:它同样只被补出 quit。
        let input = DesktopPrefs { tray_menu_items: Vec::new(), ..DesktopPrefs::default() };
        let normalized = normalize_prefs(input);
        assert_eq!(normalized.tray_menu_items, vec!["quit".to_string()]);
    }

    #[test]
    fn every_default_menu_id_resolves_against_the_registry() {
        // 登记表与默认值必须互证(否则 label_index 漂了没人喊)。
        for id in default_tray_menu_items() {
            let item = tray_menu_item(&id).unwrap_or_else(|| panic!("默认项 {id} 不在登记表里"));
            assert!(item.label_index < 7, "{id} 的标签下标越界");
        }
        assert!(tray_menu_item("not_a_real_id").is_none());
    }

    // ── 5. decide_close_action:行为 × 托盘在/不在 的表 ──

    #[test]
    fn decide_close_action_table() {
        let cases: &[(bool, CloseBehavior, bool, CloseDecision)] = &[
            // (show_tray_icon, close_behavior, tray_present, expected)
            (true, CloseBehavior::Hide, true, CloseDecision::Hide),
            (true, CloseBehavior::Hide, false, CloseDecision::Hide),
            (true, CloseBehavior::Quit, true, CloseDecision::Quit),
            (true, CloseBehavior::Quit, false, CloseDecision::Quit),
            (true, CloseBehavior::Ask, true, CloseDecision::Ask),
            (true, CloseBehavior::Ask, false, CloseDecision::Quit),
            // 归一先发生:hide + 无托盘 ⇒ quit,与"托盘确实不在"这个事实同向
            (false, CloseBehavior::Hide, false, CloseDecision::Quit),
            // show_tray_icon=false 而 tray_present=true(用户刚把开关关掉、托盘还没拆掉):
            // 归一仍然判 quit —— 配置组合本身是矛盾的,不以运行时事实赦免它。
            (false, CloseBehavior::Hide, true, CloseDecision::Quit),
            (false, CloseBehavior::Ask, true, CloseDecision::Ask),
            (false, CloseBehavior::Ask, false, CloseDecision::Quit),
        ];
        for (show, behavior, tray, expected) in cases {
            let got = decide_close_action(&prefs(*show, *behavior), *tray);
            assert_eq!(
                got, *expected,
                "show_tray_icon={show} close_behavior={behavior:?} tray_present={tray}"
            );
        }
    }

    #[test]
    fn decide_is_the_normalized_view_of_itself() {
        // 归一是幂等的:判定路径被走两次(先 set 再 decide)不得再改结论。
        let once = normalize_prefs(prefs(false, CloseBehavior::Hide));
        let twice = normalize_prefs(once.clone());
        assert_eq!(once, twice);
        assert_eq!(
            decide_close_action(&twice, true),
            decide_close_action(&once, true)
        );
    }

    // ── 6. patch 合并语义:None = 不改 ──

    #[test]
    fn patch_none_leaves_the_field_alone_and_some_overwrites() {
        let merged = DesktopPrefsPatch {
            close_behavior: Some(CloseBehavior::Hide),
            ..DesktopPrefsPatch::default()
        }
        .merge_into(DesktopPrefs::default());
        assert_eq!(merged.close_behavior, CloseBehavior::Hide);
        assert!(merged.show_tray_icon, "未填的档必须保持原值");
        assert_eq!(merged.tray_menu_items, default_tray_menu_items());
    }

    #[test]
    fn patch_is_normalized_by_the_same_single_exit() {
        // 正例:把托盘关掉 + 用户此刻要 hide ⇒ 归一必须当场改判 quit(调用方不需要重算)。
        let merged = DesktopPrefsPatch {
            show_tray_icon: Some(false),
            close_behavior: Some(CloseBehavior::Hide),
            ..DesktopPrefsPatch::default()
        }
        .merge_into(DesktopPrefs::default());
        assert_eq!(
            normalize_prefs(merged).close_behavior,
            CloseBehavior::Quit,
            "set 路径与 load 路径必须给同一个答案"
        );
    }

    #[test]
    fn empty_patch_serializes_without_any_keys() {
        // skip_serializing_if 的兑现:空 patch 回包得是 {},否则前端读到一堆 null。
        assert_eq!(serde_json::to_string(&DesktopPrefsPatch::default()).unwrap(), "{}");
    }

    #[test]
    fn migrate_launch_minimized_fires_only_on_the_legacy_autostart_first_run() {
        // 正例:老用户(此前没有偏好文件)开机自启(带 --minimized)⇒ 迁,保住旧表现。
        assert!(should_migrate_launch_minimized(true, false, true));
    }

    #[test]
    fn migrate_launch_minimized_refuses_all_three_non_legacy_shapes() {
        // 反例三条各一条:文件已存在(用户已经选过 / 已迁过)、当前已是 true、手动启动不带参数。
        assert!(!should_migrate_launch_minimized(false, false, true), "偏好文件已在 ⇒ 绝不覆盖既有选择");
        assert!(!should_migrate_launch_minimized(true, true, true), "已是 true ⇒ 不必迁(幂等)");
        assert!(
            !should_migrate_launch_minimized(true, false, false),
            "不带 --minimized(手动双击)⇒ 迁了就是把窗口藏起来,像程序没启动"
        );
    }

    // ── 编码陷阱:非 Rust 写手留下的 BOM 不得让整份偏好静默回退默认值 ──

    #[test]
    fn bom_prefixed_file_still_loads_the_users_values() {
        let dir = scratch_dir("bom-ok");
        let path = dir.join("desktop-behavior.json");
        let wanted = prefs(false, CloseBehavior::Quit);
        let mut bytes = vec![0xEFu8, 0xBB, 0xBF];
        bytes.extend_from_slice(serde_json::to_string(&wanted).expect("serialize").as_bytes());
        std::fs::write(&path, &bytes).expect("write bom prefs");
        assert_eq!(load_prefs_from(&path), wanted);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn bom_prefixed_garbage_still_falls_back_to_defaults() {
        // 剥 BOM 不等于放宽判据:内容坏照样整份回默认(负向对照,防"为容编码把判据削穿")。
        let dir = scratch_dir("bom-bad");
        let path = dir.join("desktop-behavior.json");
        let mut bytes = vec![0xEFu8, 0xBB, 0xBF];
        bytes.extend_from_slice(b"{ not json");
        std::fs::write(&path, &bytes).expect("write broken prefs");
        assert_eq!(load_prefs_from(&path), DesktopPrefs::default());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
