// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 受限本地 store 通道(2026-11-07 缺陷挖掘 T1)。
//!
//! ## 为什么不再给远程页 `store:default`
//! tauri-plugin-store 的 `load(path)` 经 `app.path().resolve(path, AppData)` 解析:
//! 相对名落到 app_data_dir,**绝对路径原样返回**,且插件本身没有路径 scope。远程页
//! (https://aizhs.top,含任意 XSS)拿到该权限后,能读写 app_data 下任意 store 文件,
//! 也能用绝对路径逃逸到磁盘任意位置;`ihui-vault.json`(会话主密钥)与
//! `auth.json`(refresh token)恰在这两处。
//!
//! ## 收口方式
//! 只保留两条命令 `vault_read` / `vault_write`,并把攻击面压到**双白名单**:
//! 1. 文件名白名单:只认 `ihui-vault.json` / `auth.json`(裸名,不含任何路径分量);
//! 2. 键名白名单:每个文件只认自己那几个键(加键必须改本文件,是显式契约);
//! 3. 路径:app_data_dir.join(白名单裸名) 后交给 `ensure_in_app_data` —— 与
//!    read_text_file 等命令同一套 canonicalize + 符号链接包含性校验(宿主已有实现,
//!    本模块不复制第二份判据);
//! 4. 数据:顶层必须是 JSON 对象,解析失败**返回错误而不是回退空对象**(避免把损坏
//!    文件静默覆盖成只剩新键);单键 ≤ 64 KiB、整文件 ≤ 1 MiB;
//! 5. 落盘:同目录临时文件 + rename 原子替换,失败清理临时文件。
//!
//! 语义与 plugin-store 的 `autoSave:false` + 显式 `save()` 对齐:web 侧仍是
//! set/delete 后 save;这里每次写命令即时原子落盘,`save()` 在前端是空操作。

use serde_json::{Map, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

/// 整文件上限(plugin-store 文本文件,正常只有几十字节到几 KB)。
const MAX_STORE_BYTES: u64 = 1024 * 1024;
/// 单值上限(vault 主密钥 / refresh token 都是短串,留足余量即可)。
const MAX_ENTRY_BYTES: usize = 64 * 1024;
/// 键名上限 + 字符集:只允许裸键,挡掉路径样式与怪字符。
const MAX_KEY_LEN: usize = 128;

struct Scope {
    file: &'static str,
    keys: &'static [&'static str],
}

/// 双白名单唯一出处。新增文件或键必须同时改这里(web 侧调用面见
/// apps/web/src/lib/local-vault.ts 与 desktop-token-vault.ts)。
const ALLOWED: &[Scope] = &[
    Scope { file: "ihui-vault.json", keys: &["master_key"] },
    Scope { file: "auth.json", keys: &["refresh_token"] },
];

/// 两个窗口(main/admin)可能同时写同一个文件:读-改-写必须在进程内串行。
static VAULT_WRITE_LOCK: Mutex<()> = Mutex::new(());

fn key_charset_ok(key: &str) -> bool {
    key.len() <= MAX_KEY_LEN
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

/// 文件名 + 键名双白名单。返回命中的静态 scope(落盘用 `scope.file` 而非调用方入参)。
pub(crate) fn scope_for(file: &str, key: &str) -> Result<&'static Scope, String> {
    let scope = ALLOWED
        .iter()
        .find(|s| s.file == file)
        .ok_or_else(|| format!("store 文件不在白名单(拒绝): {}", clip(file)))?;
    if !key_charset_ok(key) {
        return Err(format!("store 键名不合法(拒绝): {}", clip(key)));
    }
    if !scope.keys.contains(&key) {
        return Err(format!("store 键不在白名单(拒绝): {}", clip(key)));
    }
    Ok(scope)
}

/// 错误信息里只回显前 32 个字符,避免把超长入参原样回抛。
fn clip(raw: &str) -> String {
    let mut out: String = raw.chars().take(32).collect();
    if raw.chars().count() > 32 {
        out.push('…');
    }
    out
}

/// 文件名逃逸的纯判据:白名单裸名 + canonicalize 后仍须落在 `dir` 内。
///
/// 四式逃逸在这里一次收口:
/// - 绝对路径(`C:\Windows\auth.json`)、上跳(`../auth.json`)、子目录(`sub/auth.json`)
///   在**词法**层被拒 —— 只接受单分量裸名;
/// - junction / 符号链接由注入的 `canonicalize` 解析后比前缀(CI 造不出真实
///   junction,与 `workspace_index` 的 `dir_verdict` 同一套可测口径);
/// - `dir` 自身被换成指向外部的链接时,同样在 canonical 前缀比对里落空。
fn ensure_bare_file_in_dir(
    dir: &Path,
    file: &str,
    canonicalize: &dyn Fn(&Path) -> Option<PathBuf>,
) -> Result<PathBuf, String> {
    let p = Path::new(file);
    if file.is_empty()
        || file == "."
        || file == ".."
        || file.contains('/')
        || file.contains('\\')
        || p.is_absolute()
        || p.components().count() != 1
    {
        return Err(format!("store 文件名必须是裸文件名(拒绝): {}", clip(file)));
    }
    let path = dir.join(file);
    if let Some(real) = canonicalize(&path) {
        if let Some(base) = canonicalize(dir) {
            if !real.starts_with(&base) {
                return Err(format!(
                    "store 路径(经符号链接/junction 解析)不在 app_data 目录内(拒绝): {}",
                    clip(&path.display().to_string())
                ));
            }
        }
    }
    Ok(path)
}

/// 解析落盘路径并复用宿主既有的 app_data 包含性校验。
///
/// `ensure_in_app_data` 先做词法前缀,再对已存在路径 canonicalize(解析 symlink/
/// junction),对创建场景上溯最近已存在祖先再比前缀 —— 本命令的文件名是白名单裸名,
/// 词法上不可能逃逸,这里用它挡的是「攻击链先把 ihui-vault.json 换成指向外部的符号
/// 链接」那一维。
pub(crate) fn store_path(app: &tauri::AppHandle, file: &'static str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir 解析失败: {}", e))?;
    let path = ensure_bare_file_in_dir(&dir, file, &|p| std::fs::canonicalize(p).ok())?;
    let as_str = path.to_string_lossy().into_owned();
    crate::ensure_in_app_data(app, &as_str).map_err(|e| format!("store 路径校验失败: {}", e))?;
    Ok(path)
}

/// 读整份 store。缺失 = 空;损坏/非对象 = Err(拒绝覆盖)。
pub(crate) fn read_store(path: &Path) -> Result<Option<Value>, String> {
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("读取 store 失败: {}", e)),
    };
    if bytes.len() as u64 > MAX_STORE_BYTES {
        return Err("store 文件超过大小上限(拒绝)".to_string());
    }
    if bytes.is_empty() {
        return Ok(Some(Value::Object(Map::new())));
    }
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "store 文件不是合法 JSON(拒绝覆盖)".to_string())?;
    if !value.is_object() {
        return Err("store 文件顶层不是 JSON 对象(拒绝覆盖)".to_string());
    }
    Ok(Some(value))
}

/// 取条目:只有字符串算值,其余(数字/对象/缺失)一律当"不存在",与前端
/// `typeof value === 'string'` 的判据保持一致。
pub(crate) fn entry_value(root: &Value, key: &str) -> Option<String> {
    match root.get(key) {
        Some(Value::String(s)) => Some(s.clone()),
        _ => None,
    }
}

/// 读-改-写里的"改":保留其它键,`None` = 删除该键。
pub(crate) fn apply_entry(
    root: Option<Value>,
    key: &str,
    value: Option<String>,
) -> Result<Value, String> {
    let mut root = root.unwrap_or_else(|| Value::Object(Map::new()));
    let map = root
        .as_object_mut()
        .ok_or_else(|| "store 文件顶层不是 JSON 对象(拒绝覆盖)".to_string())?;
    match value {
        Some(text) => {
            if text.len() > MAX_ENTRY_BYTES {
                return Err("store 条目超过大小上限(拒绝)".to_string());
            }
            map.insert(key.to_string(), Value::String(text));
        }
        None => {
            map.remove(key);
        }
    }
    Ok(root)
}

/// 同目录临时文件 + rename 原子替换;任一步失败都清理临时文件。
pub(crate) fn write_store_atomic(path: &Path, root: &Value) -> Result<(), String> {
    let dir = path
        .parent()
        .ok_or_else(|| "store 路径缺少父目录".to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| format!("创建 app_data 目录失败: {}", e))?;
    let bytes = serde_json::to_vec_pretty(root)
        .map_err(|e| format!("序列化 store 失败: {}", e))?;
    if bytes.len() as u64 > MAX_STORE_BYTES {
        return Err("store 文件超过大小上限(拒绝)".to_string());
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "store 文件名不可用".to_string())?;
    let tmp = dir.join(format!(".{}.{}.tmp", name, std::process::id()));
    let write_result = (|| -> std::io::Result<()> {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(&bytes)?;
        f.sync_all()
    })();
    if let Err(e) = write_result {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("写入临时文件失败: {}", e));
    }
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("原子替换 store 失败: {}", e));
    }
    Ok(())
}

/// 读取受限 store 条目。缺失/非字符串返回 null(前端映射为 undefined)。
#[tauri::command]
pub fn vault_read(
    app: tauri::AppHandle,
    file: String,
    key: String,
) -> Result<Option<String>, String> {
    let scope = scope_for(&file, &key)?;
    let path = store_path(&app, scope.file)?;
    let root = read_store(&path)?;
    Ok(root.as_ref().and_then(|v| entry_value(v, &key)))
}

/// 写入/删除受限 store 条目(`value = null` 即删除)。
#[tauri::command]
pub fn vault_write(
    app: tauri::AppHandle,
    file: String,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    let scope = scope_for(&file, &key)?;
    if let Some(text) = value.as_ref() {
        if text.len() > MAX_ENTRY_BYTES {
            return Err("store 条目超过大小上限(拒绝)".to_string());
        }
    }
    let path = store_path(&app, scope.file)?;
    // 读-改-写整体持锁:两个窗口并发写时不许互相覆盖。
    let _guard = VAULT_WRITE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let root = read_store(&path)?;
    let next = apply_entry(root, &key, value)?;
    write_store_atomic(&path, &next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    const BUILD_RS: &str = include_str!("../build.rs");
    const LIB_RS: &str = include_str!("lib.rs");
    const CAPS: &str = include_str!("../capabilities/default.json");

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn temp_dir(tag: &str) -> PathBuf {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "ihui-vault-test-{}-{}-{}",
            std::process::id(),
            tag,
            n
        ));
        std::fs::create_dir_all(&dir).expect("建临时目录");
        dir
    }

    #[test]
    fn 文件名与键名白名单() {
        assert!(scope_for("ihui-vault.json", "master_key").is_ok());
        assert!(scope_for("auth.json", "refresh_token").is_ok());
        // 文件名不在白名单
        for bad in [
            "other.json",
            "../auth.json",
            "auth.json/../ihui-vault.json",
            "sub/auth.json",
            r"C:\Windows\auth.json",
            "",
        ] {
            assert!(
                scope_for(bad, "master_key").is_err(),
                "文件名 {:?} 必须被拒",
                bad
            );
        }
        // 键不在该文件的白名单(交叉借用也不行)
        assert!(scope_for("auth.json", "master_key").is_err());
        assert!(scope_for("ihui-vault.json", "refresh_token").is_err());
        assert!(scope_for("auth.json", "a/b").is_err());
        assert!(scope_for("auth.json", "refresh token").is_err());
        assert!(scope_for("auth.json", &"k".repeat(MAX_KEY_LEN + 1)).is_err());
    }

    /// T1 验收:落盘路径恒为 `app_data_dir/<白名单裸名>`,不得多一层子目录。
    #[test]
    fn vault路径恒在app数据目录下() {
        let dir = Path::new(r"C:\Users\me\AppData\Roaming\com.ihui.desktop");
        let ident = |p: &Path| Some(p.to_path_buf());
        for scope in ALLOWED {
            let path = ensure_bare_file_in_dir(dir, scope.file, &ident)
                .unwrap_or_else(|e| panic!("白名单裸名必须合法: {e}"));
            assert_eq!(path.parent(), Some(dir), "落盘路径必须直接位于 app_data 下");
            assert_eq!(
                path.components().count(),
                dir.components().count() + 1,
                "不得多一级子目录"
            );
        }
    }

    /// T1 验收:绝对路径 / 上跳 / 子目录 / junction / 符号链接五形逃逸全部拒绝。
    /// junction 与 symlink 用注入的 canonicalize 模拟(CI 造不出真实链接,与
    /// workspace_index 的 dir_verdict 同一套可测口径),真实链接另有两支 #[cfg(windows)]。
    #[test]
    fn 路径逃逸五式全部拒绝() {
        let dir = Path::new(r"C:\Users\me\AppData\Roaming\com.ihui.desktop");
        let missing = |_p: &Path| -> Option<PathBuf> { None };
        for bad in [
            r"C:\Windows\auth.json",
            "../auth.json",
            r"..\auth.json",
            "sub/auth.json",
            "auth.json/../ihui-vault.json",
            r"\\?\C:\Windows\auth.json",
            "",
            ".",
            "..",
        ] {
            assert!(
                ensure_bare_file_in_dir(dir, bad, &missing).is_err(),
                "文件名 {:?} 必须被拒",
                bad
            );
        }
        // junction/symlink:裸名合法,但真实解析落在 app_data 之外
        let escape = |p: &Path| -> Option<PathBuf> {
            if p == dir.join("auth.json") {
                Some(PathBuf::from(r"C:\Windows\System32\auth.json"))
            } else {
                Some(p.to_path_buf())
            }
        };
        assert!(
            ensure_bare_file_in_dir(dir, "auth.json", &escape).is_err(),
            "符号链接/junction 解析到目录外必须被拒"
        );
    }

    #[cfg(windows)]
    #[test]
    fn 真实junction逃逸被拒() {
        let root = temp_dir("junction-escape");
        let appdata = root.join("appdata");
        let outside = root.join("outside");
        std::fs::create_dir_all(&appdata).expect("建 appdata");
        std::fs::create_dir_all(&outside).expect("建 outside");
        let link = appdata.join("auth.json");
        let out = std::process::Command::new("cmd")
            .args([
                "/C",
                "mklink",
                "/J",
                &link.display().to_string(),
                &outside.display().to_string(),
            ])
            .output()
            .expect("运行 mklink");
        if !out.status.success() {
            eprintln!(
                "跳过真实 junction 用例(环境不允许): {}",
                String::from_utf8_lossy(&out.stderr)
            );
            return;
        }
        let err = ensure_bare_file_in_dir(&appdata, "auth.json", &|p| std::fs::canonicalize(p).ok())
            .expect_err("junction 指向外部必须被拒");
        assert!(
            err.contains("符号链接/junction") || err.contains("不在 app_data"),
            "拒绝理由须点明链接解析: {err}"
        );
    }

    #[cfg(windows)]
    #[test]
    fn 真实符号链接逃逸被拒() {
        let root = temp_dir("symlink-escape");
        let appdata = root.join("appdata");
        let outside = root.join("outside");
        std::fs::create_dir_all(&appdata).expect("建 appdata");
        std::fs::create_dir_all(&outside).expect("建 outside");
        let link = appdata.join("ihui-vault.json");
        if std::os::windows::fs::symlink_dir(&outside, &link).is_err() {
            eprintln!("跳过真实符号链接用例(需开发者模式/特权)");
            return;
        }
        let err = ensure_bare_file_in_dir(&appdata, "ihui-vault.json", &|p| std::fs::canonicalize(p).ok())
            .expect_err("符号链接指向外部必须被拒");
        assert!(
            err.contains("符号链接/junction") || err.contains("不在 app_data"),
            "拒绝理由须点明链接解析: {err}"
        );
    }

    #[test]
    fn 取条目只认字符串() {
        let root: Value = serde_json::json!({
            "refresh_token": "rt-1",
            "nested": {"a": 1},
            "num": 42,
            "empty": ""
        });
        assert_eq!(entry_value(&root, "refresh_token").as_deref(), Some("rt-1"));
        // 非字符串一律当"不存在"(与前端 typeof 判据一致)
        assert!(entry_value(&root, "nested").is_none());
        assert!(entry_value(&root, "num").is_none());
        assert!(entry_value(&root, "missing").is_none());
        assert_eq!(entry_value(&root, "empty").as_deref(), Some(""));
    }

    #[test]
    fn 写入保留其它键且null即删除() {
        let root = Some(serde_json::json!({"refresh_token": "old", "keep": "x"}));
        let next = apply_entry(root, "refresh_token", Some("new".to_string())).expect("写入");
        assert_eq!(next.get("refresh_token").unwrap(), "new");
        assert_eq!(next.get("keep").unwrap(), "x");

        let next = apply_entry(Some(next), "refresh_token", None).expect("删除");
        assert!(next.get("refresh_token").is_none());
        assert_eq!(next.get("keep").unwrap(), "x");

        // 缺失文件 ⇒ 从空对象开始
        let fresh = apply_entry(None, "master_key", Some("k".to_string())).expect("新建");
        assert_eq!(fresh.get("master_key").unwrap(), "k");

        // 超长值拒绝
        let too_long = "x".repeat(MAX_ENTRY_BYTES + 1);
        assert!(apply_entry(None, "master_key", Some(too_long)).is_err());
    }

    #[test]
    fn 损坏文件读失败不静默回退() {
        let dir = temp_dir("corrupt");
        let path = dir.join("ihui-vault.json");
        std::fs::write(&path, b"{not-json").expect("写坏文件");
        assert!(read_store(&path).is_err(), "损坏 JSON 必须报错(不得回退空对象)");
        std::fs::write(&path, b"[1,2,3]").expect("写数组");
        assert!(read_store(&path).is_err(), "顶层非对象必须报错");
        // 文件仍在,坏数据没被覆盖
        assert_eq!(std::fs::read(&path).unwrap(), b"[1,2,3]");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn 缺失文件读到空且空文件按空对象处理() {
        let dir = temp_dir("missing");
        assert!(read_store(&dir.join("auth.json")).expect("缺失=空").is_none());
        let path = dir.join("auth.json");
        std::fs::write(&path, b"").expect("写空文件");
        let root = read_store(&path).expect("空文件").expect("有值");
        assert!(root.is_object());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn 原子写入可回读且无临时残留() {
        let dir = temp_dir("atomic");
        let path = dir.join("auth.json");
        let value = serde_json::json!({"refresh_token": "rt-2"});
        write_store_atomic(&path, &value).expect("原子写");
        let root = read_store(&path).expect("回读").expect("有值");
        assert_eq!(entry_value(&root, "refresh_token").as_deref(), Some("rt-2"));
        // 覆盖写同样成功(rename 替换)
        write_store_atomic(&path, &serde_json::json!({"refresh_token": "rt-3"}))
            .expect("覆盖写");
        let root = read_store(&path).expect("回读").expect("有值");
        assert_eq!(entry_value(&root, "refresh_token").as_deref(), Some("rt-3"));
        // 目录里只剩目标文件,无 .tmp 残留
        let names: Vec<String> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["auth.json".to_string()], "不得残留临时文件");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 三处接线一致(build.rs 生成 ACL / invoke_handler 注册 / capability 放行)。
    /// 只改其中一处 ⇒ 远程页命令"注册了但没授权"或"授权了但没注册",都是静默失效。
    #[test]
    fn 三处接线一致() {
        for cmd in ["vault_read", "vault_write"] {
            assert!(
                BUILD_RS.contains(&format!("\"{}\"", cmd)),
                "build.rs 命令表缺 {} ⇒ 不生成 allow-* 权限",
                cmd
            );
            assert!(
                LIB_RS.contains(&format!("vault_store::{}", cmd)),
                "invoke_handler 未注册 {}",
                cmd
            );
        }
        assert!(
            LIB_RS.contains("mod vault_store;"),
            "lib.rs 未声明 mod vault_store"
        );
        assert!(
            CAPS.contains("\"allow-vault-read\"") && CAPS.contains("\"allow-vault-write\""),
            "capability 未放行受限 vault 命令"
        );
        assert!(
            !CAPS.contains("\"store:default\""),
            "remote capability 仍授予 store:default"
        );
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
