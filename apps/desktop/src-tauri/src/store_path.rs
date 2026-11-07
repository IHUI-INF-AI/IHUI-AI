// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! plugin-store 路径边界守卫(P0:「远程 webview 可用 store:default 越出 AppData」)。
//!
//! ## 漏洞成因(上游事实)
//! `tauri-plugin-store` 2.4.4 的 `resolve_store_path` 实现是
//! `app.path().resolve(path, BaseDirectory::AppData)`;而 Tauri 的 `resolve_path`
//! 只是 `base_dir.push(path)`。`PathBuf::push` 有两个可越界语义:
//!   * 绝对路径会**整体替换**基目录 → 可指向任意文件;
//!   * `..` 原样保留 → 相对路径可逐级跳出 AppData。
//! 上游 plugin-store 的 permissions 没有 scope 定义,capability 只能做命令级授权,
//! **无法**给 `store:load` 加文件路径 scope;因此「只收窄 capability」堵不住绝对路径/`..`。
//!
//! ## 收口方式
//! 1. `capabilities/default.json` 移除 `store:default`:远程 webview 不再拥有任何 `store:*`
//!    命令(连 rid 都拿不到),上游那条未守卫的解析通道对远程面彻底关闭。
//! 2. 远程面只保留两条应用命令 `store_read_entry` / `store_write_entry`,文件与 key 走
//!    `REMOTE_STORE_ALLOWLIST` 白名单(当前仅 auth.json:refresh_token、ihui-vault.json:master_key)。
//! 3. 两条命令的路径先过本模块 `resolve_store_path`:拒绝绝对路径、拒绝任何 `..` 段,
//!    `path.resolve`(canonicalize,含符号链接/junction 解析)后断言仍落在 `app_data_dir` 内;
//!    任何一步失败都 fail-closed(返回 Err,不落盘)。
//! 4. Rust 内部 `window-state.json` 不走远程命令,仍由 `StoreExt` 直接读写(常量文件名)。

use std::path::{Component, Path, PathBuf};

use tauri::Manager;
use tauri_plugin_store::StoreExt;

/// 远程 webview 允许的文件与 key(最小必要集合)。
/// 新增条目必须同步 web 侧 `VaultEntryChannel` 的消费方与回归测试。
pub const REMOTE_STORE_ALLOWLIST: &[(&str, &[&str])] = &[
    ("auth.json", &["refresh_token"]),
    ("ihui-vault.json", &["master_key"]),
];

/// 路径守卫失败原因。全部为 fail-closed 分支,调用方只允许映射成 IPC error。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StorePathError {
    /// 空路径。
    Empty,
    /// 绝对路径 / 盘符前缀(Windows `C:\...`、`C:relative`、UNC)。
    AbsolutePath,
    /// 含 `..` 段(无论最终是否仍在 AppData 内,一律拒绝)。
    ParentTraversal,
    /// canonicalize 后落在 `app_data_dir` 之外(含符号链接/junction 指向外部)。
    OutsideAppData,
    /// 取不到可用的 `app_data_dir`(目录不存在或权限不足)。
    AppDataUnavailable(String),
    /// canonicalize 过程中除 NotFound 之外的 I/O 失败(权限、坏链接等)。
    Io(String),
}

impl std::fmt::Display for StorePathError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorePathError::Empty => write!(f, "store path is empty"),
            StorePathError::AbsolutePath => write!(f, "store path must be relative"),
            StorePathError::ParentTraversal => write!(f, "store path must not contain `..`"),
            StorePathError::OutsideAppData => {
                write!(f, "store path escapes app_data_dir")
            }
            StorePathError::AppDataUnavailable(e) => {
                write!(f, "app_data_dir unavailable: {e}")
            }
            StorePathError::Io(e) => write!(f, "store path resolve failed: {e}"),
        }
    }
}

/// 把外部传入的 store 路径解析成 `app_data_dir` 内的真实绝对路径。
///
/// 顺序固定:先做词法拒绝(空 / 绝对 / `..`),再 canonicalize 做语义断言。
/// 只做词法或只做 canonicalize 都会漏:前者漏符号链接,后者漏「解析后仍字面在
/// AppData 内的 `..`」。
pub fn resolve_store_path(app_data_dir: &Path, raw: &str) -> Result<PathBuf, StorePathError> {
    if raw.trim().is_empty() {
        return Err(StorePathError::Empty);
    }
    let relative = Path::new(raw);
    if relative.is_absolute() {
        return Err(StorePathError::AbsolutePath);
    }
    let mut has_file_name = false;
    for component in relative.components() {
        match component {
            Component::ParentDir => return Err(StorePathError::ParentTraversal),
            Component::RootDir | Component::Prefix(_) => return Err(StorePathError::AbsolutePath),
            Component::CurDir => {}
            Component::Normal(_) => has_file_name = true,
        }
    }
    if !has_file_name {
        return Err(StorePathError::Empty);
    }

    let canonical_base = app_data_dir
        .canonicalize()
        .map_err(|e| StorePathError::AppDataUnavailable(e.to_string()))?;
    let joined = canonical_base.join(relative);
    let resolved =
        canonicalize_allow_missing(&joined).map_err(|e| StorePathError::Io(e.to_string()))?;
    if !resolved.starts_with(&canonical_base) {
        return Err(StorePathError::OutsideAppData);
    }
    Ok(resolved)
}

/// canonicalize 目标路径;目标文件可以尚未落盘,此时回退到「canonicalize 最深的已存在祖先
/// + 逐段拼回尾部」。这样符号链接/junction 在存在的每一层都被真实解析,而不是被跳过。
fn canonicalize_allow_missing(path: &Path) -> std::io::Result<PathBuf> {
    let mut current = path.to_path_buf();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    loop {
        match current.canonicalize() {
            Ok(mut canonical) => {
                for name in tail.iter().rev() {
                    canonical.push(name);
                }
                return Ok(canonical);
            }
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                let Some(name) = current.file_name().map(|n| n.to_os_string()) else {
                    return Err(err);
                };
                tail.push(name);
                if !current.pop() {
                    return Err(err);
                }
            }
            Err(err) => return Err(err),
        }
    }
}

/// 校验远程请求的文件/键是否在白名单内。
pub fn check_remote_store_target(file: &str, key: &str) -> Result<(), String> {
    for (allowed_file, allowed_keys) in REMOTE_STORE_ALLOWLIST {
        if *allowed_file == file {
            if allowed_keys.contains(&key) {
                return Ok(());
            }
            return Err(format!("store key not allowed for {file}: {key}"));
        }
    }
    Err(format!("store file not allowed: {file}"))
}

fn resolve_remote_store_path(
    app: &tauri::AppHandle,
    file: &str,
    key: &str,
) -> Result<PathBuf, String> {
    check_remote_store_target(file, key)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir unavailable: {e}"))?;
    resolve_store_path(&app_data_dir, file).map_err(|e| e.to_string())
}

/// 远程面唯一的 store 读命令:只允许白名单文件 + 白名单 key,值必须是字符串。
#[tauri::command]
pub fn store_read_entry(
    app: tauri::AppHandle,
    file: String,
    key: String,
) -> Result<Option<String>, String> {
    let path = resolve_remote_store_path(&app, &file, &key)?;
    let store = app.store(&path).map_err(|e| e.to_string())?;
    match store.get(&key) {
        Some(serde_json::Value::String(text)) => Ok(Some(text)),
        Some(_) => Err(format!("store value is not a string for {file}:{key}")),
        None => Ok(None),
    }
}

/// 远程面唯一的 store 写命令:`value = null` 表示删除该 key,否则写入字符串并立即落盘。
#[tauri::command]
pub fn store_write_entry(
    app: tauri::AppHandle,
    file: String,
    key: String,
    value: Option<String>,
) -> Result<bool, String> {
    let path = resolve_remote_store_path(&app, &file, &key)?;
    let store = app.store(&path).map_err(|e| e.to_string())?;
    match value {
        Some(text) => store.set(&key, serde_json::Value::String(text)),
        None => {
            store.delete(&key);
        }
    }
    store.save().map_err(|e| e.to_string())?;
    Ok(true)
}

/// 与 `PathBuf::push`/`app.path().resolve(path, AppData)` 同构的旧解析(仅供复现/取证)。
#[cfg(test)]
fn legacy_resolve_store_path(app_data_dir: &Path, raw: &str) -> PathBuf {
    let mut resolved = app_data_dir.to_path_buf();
    resolved.push(raw);
    resolved
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// 造一组「AppData 内 / AppData 外」同级的真实目录,返回 (根, app_data, outside)。
    fn fixture() -> (PathBuf, PathBuf, PathBuf) {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "ihui-store-path-repro-{}-{stamp}",
            std::process::id()
        ));
        let app_data = root.join("app-data");
        let outside = root.join("outside");
        fs::create_dir_all(&app_data).unwrap();
        fs::create_dir_all(&outside).unwrap();
        (root, app_data, outside)
    }

    #[test]
    fn repro_absolute_name_writes_outside_appdata() {
        let (root, app_data, outside) = fixture();
        let raw = outside.join("absolute-store.json");
        let raw_str = raw.to_string_lossy().to_string();

        // 旧解析:绝对路径 push 后整体替换基目录。
        let resolved = legacy_resolve_store_path(&app_data, &raw_str);
        assert_eq!(resolved, raw, "绝对路径应整体替换 AppData 基目录");
        assert!(!resolved.starts_with(&app_data), "解析结果必须已越出 AppData");

        // 用「store 落盘」等价的最小写操作取证:文件真的写到 AppData 之外。
        fs::write(&resolved, br#"{"leaked":true}"#).unwrap();
        assert!(resolved.exists(), "AppData 之外的文件应被真实写出");
        assert!(
            !app_data.join("absolute-store.json").exists(),
            "AppData 内不应出现该文件"
        );

        eprintln!(
            "[repro] absolute: raw={raw_str} resolved={} app_data={}",
            resolved.display(),
            app_data.display()
        );
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn repro_parent_traversal_writes_outside_appdata() {
        let (root, app_data, outside) = fixture();
        let raw = "../outside/parent-store.json";
        let resolved = legacy_resolve_store_path(&app_data, raw);

        // 旧解析保留 `..`,落点 = app-data/../outside/parent-store.json。
        // 注意:未解析的 PathBuf 仍字面以 app_data 开头,越界事实只有 canonicalize 后才成立
        // —— 这正是"只看字符串前缀做校验"会漏掉的那一格。
        assert_eq!(resolved, app_data.join(raw), "`..` 段应原样保留");
        let canonical_app_data = fs::canonicalize(&app_data).unwrap();
        // 目标文件尚未落盘,先 canonicalize 其父目录(符号链接/`..` 在这一层就解析完)。
        let canonical_resolved = fs::canonicalize(resolved.parent().unwrap())
            .unwrap()
            .join(resolved.file_name().unwrap());
        assert!(
            !canonical_resolved.starts_with(&canonical_app_data),
            "canonicalize 后必须已越出 AppData"
        );
        let canonical_outside = fs::canonicalize(&outside).unwrap();
        assert_eq!(
            canonical_resolved,
            canonical_outside.join("parent-store.json"),
            "`../outside/...` 应解析到 AppData 之外的真实文件"
        );

        fs::write(&resolved, br#"{"leaked":true}"#).unwrap();
        assert!(resolved.exists(), "AppData 之外的文件应被真实写出");

        eprintln!(
            "[repro] parent: raw={raw} resolved={} app_data={}",
            resolved.display(),
            app_data.display()
        );
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rejects_absolute_path() {
        let (root, app_data, outside) = fixture();
        let raw = outside.join("absolute-store.json").to_string_lossy().to_string();
        assert_eq!(
            resolve_store_path(&app_data, &raw),
            Err(StorePathError::AbsolutePath)
        );
        // Windows 盘符相对形态(`C:foo`)同样必须拒绝,防止被当成相对路径 push。
        assert_eq!(
            resolve_store_path(&app_data, "C:auth.json"),
            Err(StorePathError::AbsolutePath)
        );
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rejects_parent_traversal() {
        let (root, app_data, _outside) = fixture();
        for raw in [
            "../outside/parent-store.json",
            "nested/../../outside/store.json",
            "..",
            "./../auth.json",
        ] {
            assert_eq!(
                resolve_store_path(&app_data, raw),
                Err(StorePathError::ParentTraversal),
                "含 `..` 的路径必须 fail-closed: {raw}"
            );
        }
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rejects_symlink_escape() {
        let (root, app_data, outside) = fixture();
        // junction 在 Windows 上不需要 SeCreateSymbolicLink 权限(普通用户即可建);
        // canonicalize 会把它解析成 outside 的真实路径。
        let link = app_data.join("escape-link");
        let status = Command::new("cmd.exe")
            .args([
                "/d",
                "/s",
                "/c",
                "mklink",
                "/J",
                &link.to_string_lossy(),
                &outside.to_string_lossy(),
            ])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .expect("mklink 应可执行");
        assert!(status.success(), "junction 创建失败,符号链接组无法取证");
        assert!(link.exists(), "junction 应已创建");

        assert_eq!(
            resolve_store_path(&app_data, "escape-link/evil.json"),
            Err(StorePathError::OutsideAppData),
            "指向 AppData 外的 junction 必须被 canonicalize 后拒绝"
        );
        // 正常的相对路径仍然通过(对照组,证明拒绝不是"坏链接存在就全拒")。
        assert!(resolve_store_path(&app_data, "auth.json").is_ok());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn accepts_normal_relative_path() {
        let (root, app_data, _outside) = fixture();
        let canonical_app_data = fs::canonicalize(&app_data).unwrap();
        let resolved = resolve_store_path(&app_data, "auth.json").unwrap();
        assert!(
            resolved.starts_with(&canonical_app_data),
            "合法相对路径必须落在 AppData 内"
        );
        assert_eq!(
            resolved,
            canonical_app_data.join("auth.json"),
            "合法相对路径应解析为 AppData 下的同名文件"
        );
        // 子目录形态对纯路径守卫同样合法(命令层再用文件白名单收窄)。
        let nested = resolve_store_path(&app_data, "nested/dir/store.json").unwrap();
        assert!(nested.starts_with(&canonical_app_data));
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn remote_allowlist_is_minimal() {
        assert_eq!(check_remote_store_target("auth.json", "refresh_token"), Ok(()));
        assert_eq!(
            check_remote_store_target("ihui-vault.json", "master_key"),
            Ok(())
        );
        assert!(check_remote_store_target("window-state.json", "window.main.x").is_err());
        assert!(check_remote_store_target("auth.json", "other_key").is_err());
        assert!(check_remote_store_target("../auth.json", "refresh_token").is_err());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
