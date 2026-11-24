// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 版本指针状态机（Launcher 与桌面壳共用的唯一真相源）。
//!
//! 设计约束：
//! - `state.json` 是切换真相源；`versions/<ver>/ihui-app.exe` 是载荷。
//! - 写入必须原子：临时文件 + MoveFileEx(REPLACE_EXISTING)，并保留 `.bak`。
//! - 跨进程写入用 `state.lock` 文件锁（Launcher 与壳都可能改 pending）。
//! - 版本号只允许 `[0-9A-Za-z.-]{1,64}`，禁止路径穿越。

use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const STATE_FILE: &str = "state.json";
pub const STATE_BAK: &str = "state.json.bak";
pub const STATE_TMP: &str = "state.json.tmp";
pub const STATE_LOCK: &str = "state.lock";
pub const SCHEMA: u32 = 1;
pub const VERSIONS_DIR: &str = "versions";
pub const APP_EXE: &str = "ihui-app.exe";

/// 一次启动时的切换结果（用于日志/事件；不是持久状态）。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Switch {
    pub from: String,
    pub to: String,
}

/// 自动回滚结果。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Rollback {
    pub from: String,
    pub to: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    pub schema: u32,
    pub current: String,
    #[serde(default)]
    pub previous: Option<String>,
    #[serde(default)]
    pub pending: Option<String>,
    #[serde(default)]
    pub fail_count: u32,
    #[serde(default)]
    pub last_good_at: u64,
    /// 被判定启动失败、已从 current 退下的版本（保留目录用于诊断）。
    #[serde(default)]
    pub bad: Option<String>,
}

impl State {
    pub fn new(current: impl Into<String>) -> Self {
        Self {
            schema: SCHEMA,
            current: current.into(),
            previous: None,
            pending: None,
            fail_count: 0,
            last_good_at: 0,
            bad: None,
        }
    }

    /// 读取 state.json；损坏（含 schema 非法）时回落到 `.bak`，两者都不可用才报错。
    pub fn load(root: &Path) -> io::Result<Self> {
        let primary = read_json(&root.join(STATE_FILE)).and_then(validate_schema);
        match primary {
            Ok(state) => Ok(state),
            Err(primary_err) => match read_json(&root.join(STATE_BAK)).and_then(validate_schema) {
                Ok(state) => Ok(state),
                Err(_) => Err(primary_err),
            },
        }
    }

    /// 首次安装/状态丢失时，从 `versions/` 里挑最高版本作为 current。
    /// 只在 state.json 真的不存在时启用；损坏状态必须报错，绝不能静默重置 pending。
    pub fn load_or_bootstrap(root: &Path) -> io::Result<Self> {
        match Self::load(root) {
            Ok(state) => Ok(state),
            Err(err) if err.kind() == io::ErrorKind::NotFound => {
                let versions = list_payload_versions(root)?;
                let highest = versions
                    .into_iter()
                    .max_by(|a, b| compare_versions(a, b))
                    .ok_or_else(|| {
                        io::Error::new(
                            io::ErrorKind::NotFound,
                            format!(
                                "{} 下没有任何可启动版本（缺 ihui-app.exe），无法引导",
                                root.join(VERSIONS_DIR).display()
                            ),
                        )
                    })?;
                let state = Self::new(highest);
                // 装进 Program Files 等只读目录时，首次引导可能写不了 state；
                // 仍应把版本交出去启动，下一次启动再次引导即可，不能直接判死。
                let _ = state.save(root);
                Ok(state)
            }
            Err(err) => Err(err),
        }
    }

    pub fn save(&self, root: &Path) -> io::Result<()> {
        let _lock = StateLock::acquire(root)?;
        let tmp = root.join(STATE_TMP);
        let text = serde_json::to_vec_pretty(self)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        {
            let mut f = File::create(&tmp)?;
            f.write_all(&text)?;
            f.sync_all()?;
        }
        let current = root.join(STATE_FILE);
        if current.exists() {
            // .bak 只用于可读恢复；失败不影响主写入。
            let _ = fs::copy(&current, root.join(STATE_BAK));
        }
        replace_file(&tmp, &current)
    }

    /// 启动时把 pending 切为 current。返回 Some 表示真的发生了切换。
    /// pending 目录不存在或版本号非法时不切（由调用方清理 pending）。
    pub fn begin_launch(&mut self) -> Option<Switch> {
        let pending = self.pending.clone()?;
        if pending == self.current || !is_safe_version(&pending) {
            self.pending = None;
            return None;
        }
        let from = std::mem::replace(&mut self.current, pending.clone());
        self.previous = Some(from.clone());
        self.pending = None;
        self.fail_count = 0;
        self.bad = None;
        Some(Switch { from, to: pending })
    }

    /// 壳进程活过健康窗口：记账成功，清空连续失败计数。
    pub fn mark_healthy(&mut self) {
        self.fail_count = 0;
        self.last_good_at = now_secs();
    }

    /// 启动即崩：累计失败；连续两次且有 previous 时切回 previous。
    pub fn mark_failure(&mut self) -> Option<Rollback> {
        self.fail_count = self.fail_count.saturating_add(1);
        if self.fail_count < 2 {
            return None;
        }
        let previous = self.previous.take()?;
        let from = std::mem::replace(&mut self.current, previous.clone());
        self.pending = None;
        self.bad = Some(from.clone());
        self.fail_count = 0;
        Some(Rollback { from, to: previous })
    }

    /// 起进程直接失败（exe 缺失/权限拒绝）时立即回滚，不走“两次崩溃”计数：
    /// 连进程都拉不起来，重试同一个版本没有意义。
    pub fn rollback_now(&mut self) -> Option<Rollback> {
        let previous = self.previous.take()?;
        let from = std::mem::replace(&mut self.current, previous.clone());
        self.pending = None;
        self.bad = Some(from.clone());
        self.fail_count = 0;
        Some(Rollback { from, to: previous })
    }

    /// 用户主动退回上一版（设置页入口）；下一次启动生效。
    pub fn request_manual_rollback(&mut self) -> bool {
        let Some(previous) = self.previous.clone() else {
            return false;
        };
        self.pending = Some(previous);
        true
    }
}

/// 版本目录路径；版本号非法时返回 None（调用方不得拼接未知输入）。
pub fn version_dir(root: &Path, version: &str) -> Option<PathBuf> {
    if !is_safe_version(version) {
        return None;
    }
    Some(root.join(VERSIONS_DIR).join(version))
}

/// 载荷 exe 路径；版本号非法时返回 None。
pub fn app_exe(root: &Path, version: &str) -> Option<PathBuf> {
    version_dir(root, version).map(|dir| dir.join(APP_EXE))
}

pub fn is_safe_version(version: &str) -> bool {
    if version.is_empty() || version.len() > 64 {
        return false;
    }
    if !version
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
    {
        return false;
    }
    version != "." && version != ".." && !version.starts_with('.')
}

/// 列出 `versions/` 下所有合法版本目录名。
pub fn list_versions(root: &Path) -> io::Result<Vec<String>> {
    let dir = root.join(VERSIONS_DIR);
    let entries = fs::read_dir(&dir)?;
    let mut out = Vec::new();
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if is_safe_version(&name) {
            out.push(name);
        }
    }
    Ok(out)
}

/// 只列出真的含 `ihui-app.exe` 的版本：bootstrap/自愈绝不能挑到半截 `.tmp` 目录。
pub fn list_payload_versions(root: &Path) -> io::Result<Vec<String>> {
    Ok(list_versions(root)?
        .into_iter()
        // `versions/<ver>.tmp-<pid>-<ts>` 是 stage 解压中的半成品；即使它已经有
        // ihui-app.exe，也绝不能当成可启动版本被 bootstrap 挑中。
        .filter(|version| !version.contains(".tmp-"))
        .filter(|version| app_exe(root, version).map(|p| p.is_file()).unwrap_or(false))
        .collect())
}

/// 清理不再需要的版本目录：保留 current / previous / pending / bad。
/// 被占用（例如旧进程还在跑）的目录删不掉只记日志，不报错。
pub fn cleanup_versions(root: &Path, state: &State) -> io::Result<Vec<String>> {
    let mut keep = Vec::new();
    keep.push(state.current.clone());
    if let Some(v) = &state.previous {
        keep.push(v.clone());
    }
    if let Some(v) = &state.pending {
        keep.push(v.clone());
    }
    if let Some(v) = &state.bad {
        keep.push(v.clone());
    }
    let mut removed = Vec::new();
    for version in list_versions(root)? {
        if keep.iter().any(|k| k == &version) {
            continue;
        }
        let Some(dir) = version_dir(root, &version) else {
            continue;
        };
        match fs::remove_dir_all(&dir) {
            Ok(()) => removed.push(version),
            Err(_) => { /* 运行中的旧版本/杀软占用：下轮再清 */ }
        }
    }
    Ok(removed)
}

/// 简化版本比较：数字段按数值，其余按字典序；足以在 bootstrap 时挑最高版本。
pub fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    let mut ai = a.split(|c| c == '.' || c == '-');
    let mut bi = b.split(|c| c == '.' || c == '-');
    loop {
        match (ai.next(), bi.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => {
                let ord = match (x.parse::<u64>(), y.parse::<u64>()) {
                    (Ok(nx), Ok(ny)) => nx.cmp(&ny),
                    _ => x.cmp(y),
                };
                if ord != Ordering::Equal {
                    return ord;
                }
            }
        }
    }
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> io::Result<T> {
    let text = fs::read(path)?;
    let value: T =
        serde_json::from_slice(&text).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    Ok(value)
}

fn validate_schema(state: State) -> io::Result<State> {
    if state.schema != SCHEMA {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("unsupported state schema: {}", state.schema),
        ));
    }
    if !is_safe_version(&state.current) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("illegal current version: {}", state.current),
        ));
    }
    Ok(state)
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

struct StateLock {
    file: File,
}

impl StateLock {
    fn acquire(root: &Path) -> io::Result<Self> {
        let path = root.join(STATE_LOCK);
        let file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .open(path)?;
        file.lock_exclusive()?;
        Ok(Self { file })
    }
}

impl Drop for StateLock {
    fn drop(&mut self) {
        let _ = self.file.unlock();
    }
}

#[cfg(windows)]
fn replace_file(from: &Path, to: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    let from = wide(from);
    let to = wide(to);
    let ok = unsafe {
        MoveFileExW(
            from.as_ptr(),
            to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(from: &Path, to: &Path) -> io::Result<()> {
    fs::rename(from, to)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write_state(root: &Path, state: &State) {
        state.save(root).unwrap();
    }

    #[test]
    fn save_load_roundtrip() {
        let dir = tempdir().unwrap();
        let mut state = State::new("0.1.93");
        state.pending = Some("0.1.94".into());
        write_state(dir.path(), &state);
        assert!(!dir.path().join(STATE_BAK).exists());
        write_state(dir.path(), &state);
        assert!(dir.path().join(STATE_BAK).exists());
        let loaded = State::load(dir.path()).unwrap();
        assert_eq!(loaded, state);
    }

    #[test]
    fn invalid_primary_falls_back_to_bak() {
        let dir = tempdir().unwrap();
        let state = State::new("0.1.93");
        write_state(dir.path(), &state);
        write_state(dir.path(), &state);
        assert!(dir.path().join(STATE_BAK).exists());
        // 主文件能解析但 schema 非法：必须像损坏文件一样回退 .bak，而不是判死。
        fs::write(
            dir.path().join(STATE_FILE),
            br#"{"schema":2,"current":"0.1.94","previous":null,"pending":null,"fail_count":0,"last_good_at":0,"bad":null}"#,
        )
        .unwrap();
        let loaded = State::load(dir.path()).unwrap();
        assert_eq!(loaded, state);
    }
    #[test]
    fn version_compare_is_numeric_not_lexical() {
        use std::cmp::Ordering;
        assert_eq!(compare_versions("0.1.10", "0.1.9"), Ordering::Greater);
        assert_eq!(compare_versions("0.1.9", "0.1.10"), Ordering::Less);
        assert_eq!(compare_versions("0.1.93", "0.1.93"), Ordering::Equal);
        assert_eq!(compare_versions("0.2.0", "0.1.99"), Ordering::Greater);
    }

    #[test]
    fn switch_pending_moves_current_to_previous() {
        let mut state = State::new("0.1.93");
        state.pending = Some("0.1.94".into());
        let switched = state.begin_launch().unwrap();
        assert_eq!(switched.from, "0.1.93");
        assert_eq!(switched.to, "0.1.94");
        assert_eq!(state.current, "0.1.94");
        assert_eq!(state.previous.as_deref(), Some("0.1.93"));
        assert!(state.pending.is_none());
        assert_eq!(state.fail_count, 0);
    }

    #[test]
    fn invalid_pending_is_dropped_without_switch() {
        let mut state = State::new("0.1.93");
        state.pending = Some("../evil".into());
        assert!(state.begin_launch().is_none());
        assert_eq!(state.current, "0.1.93");
        assert!(state.previous.is_none());
        assert!(state.pending.is_none());
    }

    #[test]
    fn two_failures_roll_back_once() {
        let mut state = State::new("0.1.94");
        state.previous = Some("0.1.93".into());
        assert!(state.mark_failure().is_none());
        let rollback = state.mark_failure().unwrap();
        assert_eq!(rollback.from, "0.1.94");
        assert_eq!(rollback.to, "0.1.93");
        assert_eq!(state.current, "0.1.93");
        assert_eq!(state.bad.as_deref(), Some("0.1.94"));
        assert!(state.previous.is_none());
        assert!(state.mark_failure().is_none());
    }

    #[test]
    fn rollback_now_ignores_failure_count() {
        let mut state = State::new("0.1.94");
        state.previous = Some("0.1.93".into());
        state.pending = Some("0.1.95".into());
        let rollback = state.rollback_now().unwrap();
        assert_eq!(rollback.to, "0.1.93");
        assert_eq!(state.current, "0.1.93");
        assert_eq!(state.bad.as_deref(), Some("0.1.94"));
        assert!(state.pending.is_none());
        assert!(state.previous.is_none());
    }

    #[test]
    fn healthy_resets_failure_count() {
        let mut state = State::new("0.1.94");
        state.previous = Some("0.1.93".into());
        state.mark_failure();
        state.mark_healthy();
        assert_eq!(state.fail_count, 0);
        assert!(state.mark_failure().is_none());
        assert_eq!(state.current, "0.1.94");
    }

    #[test]
    fn manual_rollback_sets_pending() {
        let mut state = State::new("0.1.94");
        state.previous = Some("0.1.93".into());
        assert!(state.request_manual_rollback());
        assert_eq!(state.pending.as_deref(), Some("0.1.93"));
        let switched = state.begin_launch().unwrap();
        assert_eq!(switched.to, "0.1.93");
    }

    #[test]
    fn version_paths_reject_traversal() {
        let dir = tempdir().unwrap();
        assert!(version_dir(dir.path(), "../x").is_none());
        assert!(version_dir(dir.path(), "..").is_none());
        assert!(version_dir(dir.path(), ".").is_none());
        assert!(app_exe(dir.path(), "a/b").is_none());
        assert!(version_dir(dir.path(), "0.1.94").is_some());
    }

    #[test]
    fn bootstrap_picks_highest_version() {
        let dir = tempdir().unwrap();
        for v in ["0.1.9", "0.1.10", "0.1.2"] {
            fs::create_dir_all(version_dir(dir.path(), v).unwrap()).unwrap();
            fs::write(app_exe(dir.path(), v).unwrap(), b"fake").unwrap();
        }
        // 半截 .tmp 目录即使名字更大也不能被引导选中。
        fs::create_dir_all(version_dir(dir.path(), "0.1.99").unwrap()).unwrap();
        let state = State::load_or_bootstrap(dir.path()).unwrap();
        assert_eq!(state.current, "0.1.10");
        assert!(dir.path().join(STATE_FILE).exists());
    }

    #[test]
    fn cleanup_keeps_current_previous_pending_bad() {
        let dir = tempdir().unwrap();
        for v in ["0.1.90", "0.1.91", "0.1.92", "0.1.93", "0.1.94"] {
            fs::create_dir_all(version_dir(dir.path(), v).unwrap()).unwrap();
        }
        let mut state = State::new("0.1.94");
        state.previous = Some("0.1.93".into());
        state.pending = Some("0.1.95".into());
        state.bad = Some("0.1.92".into());
        fs::create_dir_all(version_dir(dir.path(), "0.1.95").unwrap()).unwrap();
        let removed = cleanup_versions(dir.path(), &state).unwrap();
        assert_eq!(removed, vec!["0.1.90".to_string(), "0.1.91".to_string()]);
        for v in ["0.1.92", "0.1.93", "0.1.94", "0.1.95"] {
            assert!(version_dir(dir.path(), v).unwrap().exists());
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
