// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! plugin-store 路径越权复现(先复现,后修 —— 修法见同文件下半段)。
//!
//! 上游 `tauri-plugin-store` 2.4.4 的 `resolve_store_path` 实现是
//! `app.path().resolve(path, BaseDirectory::AppData)`;而 Tauri 的 `resolve_path`
//! 只是 `base_dir.push(path)`。`PathBuf::push` 有两个可越界语义:
//!   * 绝对路径会**整体替换**基目录 → 可指向任意文件;
//!   * `..` 原样保留 → 相对路径可逐级跳出 AppData。
//! 本模块用与上游同构的 `legacy_resolve_store_path` 钉住这两个越界事实,
//! 回归读数由 `cargo test store_path` 现读。

use std::path::{Path, PathBuf};

/// 与 `PathBuf::push`/`app.path().resolve(path, AppData)` 同构的旧解析(仅供复现/取证)。
fn legacy_resolve_store_path(app_data_dir: &Path, raw: &str) -> PathBuf {
    let mut resolved = app_data_dir.to_path_buf();
    resolved.push(raw);
    resolved
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
