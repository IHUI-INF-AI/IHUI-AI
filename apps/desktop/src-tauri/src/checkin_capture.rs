// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 签到账号本地捕获（WP-C 第一步：Rust 侧，2026-10-09 立）。
//!
//! 分层与 `desktop_prefs.rs` / `git_channel_ipc.rs` 同一套三件套纪律：
//! - **顶部纯函数判据区**：只依赖 std / serde_json / base64，单测可直接真跑；
//! - **中部执行层**：文件系统 + Windows DPAPI + SQLite，失败按 `IpcError` 四档上抛或降级；
//! - **底部 `#[tauri::command]` 薄胶水**：只做 AppHandle → 路径 → 判据的转发，不含判定。
//!
//! 实证依据（参考 cxqc168-wq/Trae-workbuddyAssistant，master）：新版 TRAE 客户端鉴权
//! 流量**不走系统代理**，MITM 抓不到；正解 = 本地文件提取。本模块只读取本机当前用户
//! 已登录的 TRAE 本地数据，不做任何网络请求、不做任何注入。
//!
//! 能力面：TRAE 数据目录 6 级回退探测；Cookies（Chromium v10 AES-256-GCM，密钥走
//! DPAPI）+ leveldb 明文扫描双通道提取 JWT（按 `data.id` 去重，不验签——只出候选）；
//! 设备标识 10 层重置(⑦浏览器 Cookie/⑧⑨⑩深度重置=现场整清等效重装,均默认关、UI 显式开启)；9 类快照对称备份/恢复。

use crate::IpcError;
use serde::Serialize;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::{STANDARD as B64_STD, URL_SAFE_NO_PAD};
use base64::Engine as _;

// ================== 常量（唯一出处，测试钉住）==================

/// 用户显式指定 TRAE 数据目录的环境变量（候选列表全部落空时的逃生门）。
pub const ENV_TRAE_DIR: &str = "IHUI_TRAE_DIR";

/// storage.json 里要改随机值的**顶层点号键名**——键名字面含点号，不是嵌套 JSON！
/// 2026-10-10 残留审计实证补键:`telemetry.devDeviceId` 三现场实测**未被任何层改写**,
/// 重置后仍原样躺着(风控读设备维度时它是最直接的旧设备凭据)——"重置了却没用"的
/// 关键元凶之一,已纳入改写清单。
pub const TRAE_DOTTED_KEYS: [&str; 4] = [
    "telemetry.machineId",
    "telemetry.sqmId",
    "telemetry.devDeviceId",
    "aha.device.device_id",
];

/// 改完随机值后要删掉的旧标志键。
pub const TRAE_STORAGE_FLAG_KEY: &str = "has_device_id_updated_to_aha";

/// 注册表里已知的 **TRAE 设备指纹槽位**(HKCU 下的 键路径 + 值名)。
/// 2026-10-10 真机取证(本机导出 `trae-reg-before.txt`)实锤:
///   `HKCU\Software\Bytedance\Trae CN\Common` 的 `Info` 值 = 一串 32 字节十进制序列,
///   是安装器写入的**真实设备指纹**;而旧层⑪ 只删 3 个 `Software\TRAE*` 键,
///   厂商容器(Bytedance)下的这一支完全没被碰到 ⇒ "重置了却还被认出来"的隐藏凭据。
/// 现层⑪ 已按族名动态发现(含厂商容器内子项)整树删除;这里再补一个**审计槽位**,
/// 让"删干净没有"在注册表维度同样可验证。
pub const TRAE_REG_FINGERPRINT_SLOTS: [(&str, &str); 5] = [
    (r"Software\Bytedance\Trae CN\Common", "Info"),
    (r"Software\TRAE\Common", "Info"),
    (r"Software\TRAE SOLO CN\Common", "Info"),
    (r"Software\Trae CN\Common", "Info"),
    (r"Software\Trae Work 助手\Common", "Info"),
];

/// 快照 9 类清单（对称备份/恢复的唯一出处）。`paths` 相对 TRAE 数据目录，
/// 备份目录里按**同样的相对路径**镜像存放——恢复逻辑因此与备份共用同一张表。
pub struct SnapshotEntry {
    pub kind: &'static str,
    pub paths: &'static [&'static str],
}

pub const SNAPSHOT_ENTRIES: [SnapshotEntry; 9] = [
    SnapshotEntry { kind: "global_storage_json", paths: &["User/globalStorage/storage.json"] },
    SnapshotEntry { kind: "global_state_vscdb", paths: &["User/globalStorage/state.vscdb"] },
    SnapshotEntry { kind: "machineid", paths: &["machineid"] },
    SnapshotEntry { kind: "aha_dir", paths: &["aha"] },
    SnapshotEntry { kind: "preferences_local_state", paths: &["Preferences", "Local State"] },
    SnapshotEntry { kind: "local_storage_dir", paths: &["Local Storage"] },
    SnapshotEntry { kind: "network_dir", paths: &["Network"] },
    SnapshotEntry {
        kind: "partitions",
        paths: &[
            "Partitions/trae-webview",
            "Partitions/icube-web-crawler-shared-session-v1.0",
        ],
    },
    SnapshotEntry { kind: "session_storage_dir", paths: &["Session Storage"] },
];

/// Cookies SQLite 的候选位置（相对 TRAE 数据目录）。
pub const COOKIES_DB_CANDIDATES: [&str; 3] = [
    "Network/Cookies",
    "Partitions/trae-webview/Cookies",
    "Partitions/trae-webview/Network/Cookies",
];

/// leveldb 明文扫描的兜底目录（相对 TRAE 数据目录）。
pub const LEVELDB_SCAN_DIRS: [&str; 2] =
    ["Local Storage/leveldb", "Partitions/trae-webview/Local Storage/leveldb"];

// ================== 纯函数：随机值（std-only，不引 rand）==================
// 只用来生成"看起来是新设备"的标识，不是密钥材料；时间+pid+地址熵喂 xorshift 足够。

struct XorShift64(u64);

impl XorShift64 {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
}

fn rng() -> XorShift64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x9E37_79B9_7F4A_7C15);
    // xorshift 种子不得为 0：末尾 |1 兜底。
    XorShift64(
        nanos
            ^ ((std::process::id() as u64) << 32)
            ^ (&nanos as *const u64 as u64)
            ^ 0x9E37_79B9_7F4A_7C15
            | 1,
    )
}

/// n 个小写 hex 字符。
pub fn random_hex(len: usize) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut r = rng();
    (0..len).map(|_| HEX[(r.next() % 16) as usize] as char).collect()
}

/// 8-4-4-4-12 形态的随机 GUID（只求形似，不追 RFC4122 版本位）。
pub fn random_guid_like() -> String {
    let g = random_hex(32);
    format!("{}-{}-{}-{}-{}", &g[0..8], &g[8..12], &g[12..16], &g[16..20], &g[20..32])
}

// ================== 纯函数：TRAE 目录探测 ==================

/// 候选路径列表。纯函数：环境值由调用方喂进来，单测不碰真实 env。
/// 覆盖（IHUI_TRAE_DIR）> %APPDATA%|LOCALAPPDATA 的 {TRAE SOLO CN, TRAE, Trae CN, Trae}。
/// 2026-10-09 真机实测:Trae CN/Trae 是现役变体 userData 目录(本机 18 个 Trae CN.exe
/// 正在跑、其现场完全在旧候选清单之外);Windows 大小写不敏感,候选按小写去重防双计。
pub fn trae_dir_candidates(
    appdata: Option<&str>,
    localappdata: Option<&str>,
    override_dir: Option<&str>,
) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(d) = override_dir {
        out.push(PathBuf::from(d));
    }
    for base in [appdata, localappdata].into_iter().flatten() {
        let base = PathBuf::from(base);
        for name in ["TRAE SOLO CN", "TRAE", "Trae CN", "Trae"] {
            out.push(base.join(name));
        }
    }
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    out.retain(|p| seen.insert(p.to_string_lossy().to_ascii_lowercase()));
    out
}

/// 判定：有 storage.json 或 machineid 之一才算 TRAE 数据目录（目录存在 ≠ 目录对）。
pub fn looks_like_trae_dir(path: &Path) -> bool {
    path.join("storage.json").is_file() || path.join("machineid").is_file()
}

/// 6 级回退探测的运行时入口：环境变量覆盖 → 候选列表逐个试，全落空 → None。
pub fn detect_trae_dir() -> Option<PathBuf> {
    let read = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    for cand in trae_dir_candidates(
        read("APPDATA").as_deref(),
        read("LOCALAPPDATA").as_deref(),
        read(ENV_TRAE_DIR).as_deref(),
    ) {
        if looks_like_trae_dir(&cand) {
            return Some(cand);
        }
    }
    None
}

// ================== 纯函数：JWT 提取/校验（不验签，只出候选）==================

/// 一条捕获到的账号。`source` 是人类可读出处：`cookies:<host>(<相对路径>)` / `leveldb:<文件名>`。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CapturedAccount {
    pub user_id: String,
    pub jwt: String,
    pub source: String,
}

/// JWT 形态：三段 base64url，'.' 分隔，每段非空。
pub fn is_jwt_shape(s: &str) -> bool {
    let segs: Vec<&str> = s.split('.').collect();
    segs.len() == 3
        && segs
            .iter()
            .all(|seg| !seg.is_empty() && seg.bytes().all(is_token_byte_excl_dot))
}

fn is_token_byte_excl_dot(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'-' || b == b'_'
}

fn is_token_byte(b: u8) -> bool {
    is_token_byte_excl_dot(b) || b == b'.'
}

/// base64url 解 payload，取 `data.id`（数字串即有效候选；不验签）。
pub fn jwt_payload_user_id(token: &str) -> Option<String> {
    let payload = token.split('.').nth(1)?;
    let decoded = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    let v: serde_json::Value = serde_json::from_slice(&decoded).ok()?;
    let id = v.get("data")?.get("id")?;
    let s = match id {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        _ => return None,
    };
    // 只认数字串：字符串形态的 id 可能是用户名等别的东西，宁缺毋滥。
    if !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()) {
        Some(s)
    } else {
        None
    }
}

/// 从任意字节流（leveldb .ldb/.log）里扫 JWT 形态字符串。JWT 的 base64url 首段
/// 几乎必然以 `eyJ` 开头（`{"` 的编码），以此为锚向两侧延长。
pub fn extract_jwt_strings(bytes: &[u8]) -> Vec<String> {
    let mut out = Vec::new();
    let mut i = 0;
    while i + 3 <= bytes.len() {
        if &bytes[i..i + 3] == b"eyJ" {
            let start = backward_token_start(bytes, i);
            let end = forward_token_end(bytes, i + 3);
            let cand = String::from_utf8_lossy(&bytes[start..end]).into_owned();
            if is_jwt_shape(&cand) && !out.contains(&cand) {
                out.push(cand);
            }
            i = end;
        } else {
            i += 1;
        }
    }
    out
}

fn backward_token_start(bytes: &[u8], anchor: usize) -> usize {
    let mut start = anchor;
    while start > 0 && is_token_byte(bytes[start - 1]) {
        start -= 1;
    }
    start
}

fn forward_token_end(bytes: &[u8], from: usize) -> usize {
    let mut end = from;
    while end < bytes.len() && is_token_byte(bytes[end]) {
        end += 1;
    }
    end
}

/// 按 user_id 去重：同一用户多来源时保留第一条（探测顺序里最可信的来源）。
pub fn dedup_by_user_id(accounts: Vec<CapturedAccount>) -> Vec<CapturedAccount> {
    let mut seen = std::collections::HashSet::new();
    accounts.into_iter().filter(|a| seen.insert(a.user_id.clone())).collect()
}

/// 字节流包含判断（std-only，避免为这一个小需求引 memchr）。
fn bytes_contain(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty() && haystack.windows(needle.len()).any(|w| w == needle)
}

// ================== 纯函数：Chromium v10 cookie 解密 ==================

/// `v10` 前缀(3B) + nonce(12B) + 密文 + tag(16B) → (nonce, ct+tag)。
/// 非 v10（如新版 app-bound 的 v20）返回 None——只支持实证过的 v10，不猜别的格式。
pub fn split_v10_blob(encrypted: &[u8]) -> Option<(&[u8], &[u8])> {
    if encrypted.len() < 3 + 12 + 16 || &encrypted[..3] != b"v10" {
        return None;
    }
    Some((&encrypted[3..15], &encrypted[15..]))
}

/// AES-256-GCM 解密（tag 附在密文尾部，与 Chromium 落盘格式一致；AAD 为空）。
pub fn aes256gcm_decrypt(key: &[u8], nonce: &[u8], ct_with_tag: &[u8]) -> Option<Vec<u8>> {
    use aes_gcm::aead::{Aead, KeyInit};
    use aes_gcm::{Aes256Gcm, Nonce};
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    cipher.decrypt(Nonce::from_slice(nonce), ct_with_tag).ok()
}

// ================== 纯函数：storage.json 点号键名 ==================

/// 三个点号键的新随机值（唯一出处：重置层②③与任何未来调用方都从这里拿）。
pub fn fresh_device_values() -> (String, String, String) {
    (random_hex(32), random_guid_like(), random_guid_like())
}

/// 解析 + 改点号键 + 删标志键 + 写回。返回（新 JSON 文本, 变更说明列表）。
/// **一次解析一次写**：三个键分三次读改写会放大损坏窗口。
pub fn rewrite_storage_json_device_ids(
    text: &str,
    machine_id: &str,
    sqm_id: &str,
    device_id: &str,
) -> Result<(String, Vec<String>), String> {
    let mut root: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(text).map_err(|e| format!("storage.json 解析失败: {e}"))?;
    let mut changes = Vec::new();
    // 2026-10-10:TRAE_DOTTED_KEYS 扩到 4 键(devDeviceId 加入),这里按索引硬绑三个
    // 入参会漏 ⇒ device_id 同时写 devDeviceId 与 aha.device.device_id(同一新值,
    // 风控两处都读同一设备标识语义),确保清单再扩也不漏键。
    for (key, val) in [
        (TRAE_DOTTED_KEYS[0], serde_json::Value::String(machine_id.into())),
        (TRAE_DOTTED_KEYS[1], serde_json::Value::String(sqm_id.into())),
        ("telemetry.devDeviceId", serde_json::Value::String(device_id.into())),
        (
            "aha.device.device_id",
            serde_json::Value::String(device_id.into()),
        ),
    ] {
        root.insert(key.to_string(), val);
        changes.push(format!("set {key}"));
    }
    if root.remove(TRAE_STORAGE_FLAG_KEY).is_some() {
        changes.push(format!("removed {}", TRAE_STORAGE_FLAG_KEY));
    }
    let out = serde_json::to_string_pretty(&serde_json::Value::Object(root))
        .map_err(|e| format!("storage.json 序列化失败: {e}"))?;
    Ok((out, changes))
}

// ================== 纯函数：user_id 消毒 / 快照路径拼装 ==================

/// 快照目录名只允许 `[A-Za-z0-9_-]` 且 ≤64 字符：越界（含 `..`、路径分隔符）一律拒绝。
pub fn sanitize_user_id(raw: &str) -> Option<String> {
    if raw.is_empty()
        || raw.len() > 64
        || !raw.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return None;
    }
    Some(raw.to_string())
}

pub const CHECKIN_PROFILES_DIR: &str = "checkin_profiles";

pub fn snapshot_profiles_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(CHECKIN_PROFILES_DIR)
}

pub fn snapshot_profile_dir(app_data_dir: &Path, user_id: &str) -> PathBuf {
    snapshot_profiles_root(app_data_dir).join(user_id)
}

// ================== 执行层：DPAPI（优先原生，PowerShell 兜底）==================

/// 优先原生 `CryptUnprotectData`；失败（或非 Windows）降级 PowerShell `ProtectedData`。
pub fn dpapi_unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    #[cfg(windows)]
    {
        match dpapi_unprotect_native(data) {
            Ok(v) => Ok(v),
            Err(native_err) => dpapi_unprotect_powershell(data)
                .map_err(|ps_err| format!("native: {native_err}; powershell 兜底: {ps_err}")),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = data;
        Err("DPAPI 仅支持 Windows".to_string())
    }
}

#[cfg(windows)]
fn dpapi_unprotect_native(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB::default();
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|e| format!("CryptUnprotectData: {e}"))?;
        let out = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        Ok(out)
    }
}

#[cfg(windows)]
fn dpapi_unprotect_powershell(data: &[u8]) -> Result<Vec<u8>, String> {
    let script = format!(
        "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;\
         $i=[Convert]::FromBase64String('{}');\
         $o=[System.Security.Cryptography.ProtectedData]::Unprotect($i,$null,\
         [System.Security.Cryptography.DataProtectionScope]::CurrentUser);\
         [Convert]::ToBase64String($o)",
        B64_STD.encode(data)
    );
    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("启动 powershell 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "powershell 退出码 {:?}: {}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    B64_STD
        .decode(String::from_utf8_lossy(&out.stdout).trim())
        .map_err(|e| format!("powershell 输出不是合法 base64: {e}"))
}

/// 从 `Local State` JSON 的 `os_crypt.encrypted_key`（base64，"DPAPI" 前缀）解出 AES 密钥。
fn read_aes_key_from_local_state(trae_dir: &Path) -> Result<Vec<u8>, String> {
    let text = std::fs::read_to_string(trae_dir.join("Local State"))
        .map_err(|e| format!("读 Local State: {e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Local State 解析: {e}"))?;
    let enc = v
        .get("os_crypt")
        .and_then(|o| o.get("encrypted_key"))
        .and_then(|s| s.as_str())
        .ok_or("Local State 缺 os_crypt.encrypted_key")?;
    let blob = B64_STD.decode(enc).map_err(|e| format!("encrypted_key base64: {e}"))?;
    let key = blob.strip_prefix(b"DPAPI").ok_or("encrypted_key 缺 DPAPI 前缀")?;
    dpapi_unprotect(key)
}

// ================== 执行层：JWT 捕获（Cookies + leveldb 双通道）==================

fn read_jwts_from_cookies_db(
    db_path: &Path,
    key: &[u8],
    source_rel: &str,
) -> Vec<CapturedAccount> {
    let mut out = Vec::new();
    let conn = match rusqlite::Connection::open_with_flags(
        db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) {
        Ok(c) => c,
        Err(e) => {
            log::warn!("[checkin-capture] 打开 {} 失败: {e}", db_path.display());
            return out;
        }
    };
    let Ok(mut stmt) = conn.prepare("SELECT host_key, encrypted_value FROM cookies") else {
        return out;
    };
    let Ok(mut rows) = stmt.query(rusqlite::params![]) else {
        return out;
    };
    while let Ok(Some(row)) = rows.next() {
        let host: String = row.get::<_, Option<String>>(0).ok().flatten().unwrap_or_default();
        let blob: Vec<u8> = row.get(1).unwrap_or_default();
        let Some((nonce, ct)) = split_v10_blob(&blob) else {
            continue; // 非 v10（app-bound 等）跳过，不猜
        };
        let Some(plain) = aes256gcm_decrypt(key, nonce, ct) else {
            continue;
        };
        let value = String::from_utf8_lossy(&plain).into_owned();
        for jwt in extract_jwt_strings(value.as_bytes()) {
            if let Some(uid) = jwt_payload_user_id(&jwt) {
                out.push(CapturedAccount {
                    user_id: uid,
                    jwt,
                    source: format!("cookies:{host}({source_rel})"),
                });
            }
        }
    }
    out
}

/// 拷 Cookies 库到临时目录再只读打开（TRAE 运行中库被锁，直接开常失败）。
fn extract_cookie_jwts(trae_dir: &Path) -> Vec<CapturedAccount> {
    let mut out = Vec::new();
    let key = match read_aes_key_from_local_state(trae_dir) {
        Ok(k) if k.len() == 32 => k,
        Ok(k) => {
            log::warn!(
                "[checkin-capture] DPAPI 密钥长度异常({} 字节,应为 32),Cookies 通道跳过",
                k.len()
            );
            return out;
        }
        Err(e) => {
            log::warn!("[checkin-capture] 读 AES 密钥失败({e}),Cookies 通道跳过,只走 leveldb 兜底");
            return out;
        }
    };

    let tmp_dir = std::env::temp_dir().join(format!("ihui-checkin-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp_dir);
    if std::fs::create_dir_all(&tmp_dir).is_err() {
        return out;
    }
    for (idx, rel) in COOKIES_DB_CANDIDATES.iter().enumerate() {
        let src = trae_dir.join(rel);
        if !src.is_file() {
            continue;
        }
        let dst = tmp_dir.join(format!("cookies-{idx}.db"));
        if std::fs::copy(&src, &dst).is_err() {
            continue;
        }
        out.extend(read_jwts_from_cookies_db(&dst, &key, rel));
    }
    let _ = std::fs::remove_dir_all(&tmp_dir);
    out
}

fn scan_leveldb_dir(trae_dir: &Path, rel: &str, out: &mut Vec<CapturedAccount>) {
    let Ok(entries) = std::fs::read_dir(trae_dir.join(rel)) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext != "ldb" && ext != "log" {
            continue;
        }
        let Ok(bytes) = std::fs::read(&path) else { continue };
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("?")
            .to_string();
        for jwt in extract_jwt_strings(&bytes) {
            if let Some(uid) = jwt_payload_user_id(&jwt) {
                out.push(CapturedAccount { user_id: uid, jwt, source: format!("leveldb:{name}") });
            }
        }
    }
}

fn scan_leveldb_jwts(trae_dir: &Path) -> Vec<CapturedAccount> {
    let mut out = Vec::new();
    for rel in LEVELDB_SCAN_DIRS {
        scan_leveldb_dir(trae_dir, rel, &mut out);
    }
    out
}

/// 捕获入口：Cookies 解密 + leveldb 兜底，按 user_id 去重。
pub fn capture_local_jwts(trae_dir: &Path) -> Vec<CapturedAccount> {
    let mut accounts = extract_cookie_jwts(trae_dir);
    accounts.extend(scan_leveldb_jwts(trae_dir));
    let out = dedup_by_user_id(accounts);
    log::info!("[checkin-capture] 捕获到 {} 个账号候选（目录 {}）", out.len(), trae_dir.display());
    out
}

// ================== 执行层：设备标识 7 层重置 ==================

#[derive(Debug, Clone, Serialize)]
pub struct ResetLayerReport {
    pub layer: u8,
    pub name: &'static str,
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResetReport {
    pub layers: Vec<ResetLayerReport>,
}

/// 层①：`machineid` 文件写 32 位随机 hex。
/// 2026-10-09 真机实测扩面:只翻新 detect 到的第一处会漏双版本机器
/// (本机实证 %APPDATA%\TRAE 与 %APPDATA%\TRAE SOLO CN 并存),全部候选一并翻新。
fn reset_layer_machineid(trae_dirs: &[PathBuf]) -> ResetLayerReport {
    if trae_dirs.is_empty() {
        return ResetLayerReport {
            layer: 1,
            name: "machineid",
            ok: true,
            detail: "无 TRAE 现场目录(本就不在)".into(),
        };
    }
    let mut done: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    for dir in trae_dirs {
        let path = dir.join("machineid");
        match std::fs::write(&path, random_hex(32)) {
            Ok(()) => done.push(path.display().to_string()),
            Err(e) => errors.push(format!("写 {} 失败: {e}", path.display())),
        }
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 1,
            name: "machineid",
            ok: true,
            detail: format!("已写 32 位随机 hex × {} 处", done.len()),
        }
    } else {
        ResetLayerReport {
            layer: 1,
            name: "machineid",
            ok: false,
            detail: format!("{};成功 {} 处", errors.join("; "), done.len()),
        }
    }
}

/// 层②③：storage.json 三个点号键改随机值并删标志键（单次读改写，报告拆两行）。
/// 2026-10-09 真机实测扩面:多现场机器(本机 TRAE SOLO CN + Trae + Trae CN 三现场并存)
/// 只改 detect 到的第一处必漏,深度档逐候选翻新;无 storage.json 的候选记 ok 跳过。
fn reset_layer_storage_json(trae_dirs: &[PathBuf]) -> (ResetLayerReport, ResetLayerReport) {
    let mut r2 = ResetLayerReport {
        layer: 2,
        name: "storage.json telemetry.*",
        ok: false,
        detail: String::new(),
    };
    let mut r3 = ResetLayerReport {
        layer: 3,
        name: "storage.json aha.device.*",
        ok: false,
        detail: String::new(),
    };
    if trae_dirs.is_empty() {
        r2.ok = true;
        r3.ok = true;
        r2.detail = "无 TRAE 现场目录(本就不在)".into();
        r3.detail = r2.detail.clone();
        return (r2, r3);
    }
    let mut parts2: Vec<String> = Vec::new();
    let mut parts3: Vec<String> = Vec::new();
    let mut any_err = false;
    for dir in trae_dirs {
        let path = dir.join("User/globalStorage/storage.json");
        if !path.exists() {
            parts2.push(format!("{}: 无 storage.json(跳过)", dir.display()));
            parts3.push(format!("{}: 无 storage.json(跳过)", dir.display()));
            continue;
        }
        let result = std::fs::read_to_string(&path)
            .map_err(|e| format!("读失败: {e}"))
            .and_then(|text| {
                let (m, s, d) = fresh_device_values();
                rewrite_storage_json_device_ids(&text, &m, &s, &d)
            })
            .and_then(|(new_text, changes)| {
                // tmp+rename 原子写：半份 storage.json 比旧 storage.json 更糟。
                let tmp = path.with_file_name(format!(
                    "{}.checkin-tmp-{}",
                    path.file_name().and_then(|n| n.to_str()).unwrap_or("storage.json"),
                    std::process::id()
                ));
                std::fs::write(&tmp, new_text)
                    .and_then(|_| std::fs::rename(&tmp, &path))
                    .map_err(|e| format!("写回失败: {e}"))?;
                Ok(changes)
            });
        match result {
            Ok(changes) => {
                parts2.push(changes.iter().filter(|c| c.contains("telemetry.")).cloned().collect::<Vec<_>>().join("; "));
                parts3.push(changes.iter().filter(|c| !c.contains("telemetry.")).cloned().collect::<Vec<_>>().join("; "));
            }
            Err(e) => {
                any_err = true;
                parts2.push(format!("{}: {e}", dir.display()));
                parts3.push(format!("{}: {e}", dir.display()));
            }
        }
    }
    r2.ok = !any_err;
    r3.ok = !any_err;
    r2.detail = parts2.join("; ");
    r3.detail = parts3.join("; ");
    (r2, r3)
}

/// 层④：`aha\TinyStorage\` 递归删内容含 "device_id" 的文件（>4MB 不读，直接保留）。
/// 2026-10-09 扩面:深度档逐候选目录处理,多现场不漏。
fn reset_layer_tiny_storage(trae_dirs: &[PathBuf]) -> ResetLayerReport {
    const NEEDLE: &[u8] = b"device_id";
    let mut total_removed = 0usize;
    let mut errors: Vec<String> = Vec::new();
    let mut present = 0usize;
    fn walk(dir: &Path, needle: &[u8], removed: &mut usize, errors: &mut Vec<String>) {
        for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(&path, needle, removed, errors);
            } else if path
                .metadata()
                .map(|m| m.len() <= 4 * 1024 * 1024)
                .unwrap_or(false)
                && std::fs::read(&path).map(|b| bytes_contain(&b, needle)).unwrap_or(false)
            {
                match std::fs::remove_file(&path) {
                    Ok(()) => *removed += 1,
                    Err(e) => errors.push(format!("{}: {e}", path.display())),
                }
            }
        }
    }
    for dir in trae_dirs {
        let root = dir.join("aha/TinyStorage");
        if !root.is_dir() {
            continue;
        }
        present += 1;
        walk(&root, NEEDLE, &mut total_removed, &mut errors);
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 4,
            name: "aha/TinyStorage",
            ok: true,
            detail: if present == 0 {
                "目录不存在(本就没有)".into()
            } else {
                format!("已删 {total_removed} 个含 device_id 的文件 × {present} 处现场")
            },
        }
    } else {
        ResetLayerReport { layer: 4, name: "aha/TinyStorage", ok: false, detail: errors.join("; ") }
    }
}

/// 层⑤：注册表 `HKLM\...\MachineGuid`。需管理员：走
/// `powershell Start-Process -Verb RunAs` 提权 reg add；用户拒绝/UAC 失败一律
/// 降级 ok=false 不报错（该层失败不影响其余层）。
/// 层⑤:MachineGuid(HKLM\SOFTWARE\Microsoft\Cryptography)写新随机 GUID。
/// 2026-10-10 根治:不再硬依赖 `reg.exe + RunAs`——先试**进程内 PowerShell 直写**
/// (当前进程已提权或内建 Administrator 静默提权时零弹窗零 reg.exe 依赖;
///  本机 Administrator 实测直写成功),失败再回退 RunAs 提权 reg add(弹 UAC 由用户点)。
/// 两级都失败才降级 skip。沙箱黑名单挡 reg.exe 的环境里第一级不受影响。
#[cfg(windows)]
fn reset_layer_machine_guid() -> ResetLayerReport {
    let guid = random_guid_like();
    // 第一级:进程内 PowerShell 直写(无 reg.exe 依赖)
    let direct = format!(
        "try {{ Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' \
         -Name MachineGuid -Value '{guid}' -Force -ErrorAction Stop; exit 0 }} \
         catch {{ exit 1 }}"
    );
    let mut direct_cmd = std::process::Command::new("powershell");
    direct_cmd.args(["-NoProfile", "-NonInteractive", "-Command", &direct]);
    creation_flags_if_windows(&mut direct_cmd, 0x0800_0000);
    let direct_res = direct_cmd.output();
    if let Ok(out) = &direct_res {
        if out.status.success() {
            return ResetLayerReport {
                layer: 5,
                name: "MachineGuid",
                ok: true,
                detail: "已写新 MachineGuid(进程内直写,无弹窗)".into(),
            };
        }
    }
    // 第二级:RunAs 提权 reg add(弹 UAC,由用户掌握)
    let script = format!(
        "Start-Process -FilePath reg.exe -Verb RunAs -Wait -WindowStyle Hidden \
         -ArgumentList @('add','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v',\
         'MachineGuid','/t','REG_SZ','/d','{guid}','/f')"
    );
    match std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
    {
        Ok(out) if out.status.success() => ResetLayerReport {
            layer: 5,
            name: "MachineGuid",
            ok: true,
            detail: "已写新 MachineGuid(提权 reg add)".into(),
        },
        Ok(out) => ResetLayerReport {
            layer: 5,
            name: "MachineGuid",
            ok: false,
            detail: format!("降级 skip(UAC 被拒或 reg add 失败, exit={:?})", out.status.code()),
        },
        Err(e) => ResetLayerReport {
            layer: 5,
            name: "MachineGuid",
            ok: false,
            detail: format!("降级 skip(无法启动 powershell: {e})"),
        },
    }
}

/// Windows 下给 Command 附加 CREATE_NO_WINDOW(非 Windows 编译单元内不调用)。
/// 抽成小助手避免在两处分支重复 cfg 样板。
#[cfg(windows)]
fn creation_flags_if_windows(cmd: &mut std::process::Command, flags: u32) -> &mut std::process::Command {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(flags)
}

#[cfg(not(windows))]
fn reset_layer_machine_guid() -> ResetLayerReport {
    ResetLayerReport {
        layer: 5,
        name: "MachineGuid",
        ok: false,
        detail: "非 Windows 平台 skip".into(),
    }
}

/// 层⑥：`Partitions\trae-webview` 下 Network / Local Storage / Session Storage
/// 三目录递归删除；三目录之外的（如 Cache）不得误删。
/// 2026-10-09 扩面:深度档逐候选目录处理。
fn reset_layer_partitions(trae_dirs: &[PathBuf]) -> ResetLayerReport {
    const DIRS: [&str; 3] = ["Network", "Local Storage", "Session Storage"];
    let mut removed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    for dir in trae_dirs {
        for rel in DIRS {
            let path = dir.join("Partitions/trae-webview").join(rel);
            if path.exists() {
                let r = if path.is_dir() {
                    std::fs::remove_dir_all(&path)
                } else {
                    std::fs::remove_file(&path)
                };
                match r {
                    Ok(()) => removed.push(rel.to_string()),
                    Err(e) => errors.push(format!("{}: {rel}: {e}", dir.display())),
                }
            }
        }
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 6,
            name: "Partitions/trae-webview 会话目录",
            ok: true,
            detail: if removed.is_empty() {
                "无(本就不在)".into()
            } else {
                format!("已删: {}", removed.join(", "))
            },
        }
    } else {
        ResetLayerReport {
            layer: 6,
            name: "Partitions/trae-webview 会话目录",
            ok: false,
            detail: errors.join("; "),
        }
    }
}

// ── 层⑦：系统浏览器(Chrome/Edge)的 TRAE 域 Cookie ──
// 立因(2026-10-09 用户实战经验):只重置 TRAE 本体不够彻底,浏览器里 trae.cn 的登录态
// cookie 必须一并清掉才算完整重置。做法:直接对 Chrome/Edge 各 profile 的 Cookies 库
// 执行限定域的 DELETE——只动 host_key 含 trae.cn/trae.com 的行,其余 cookie 一律不碰。
// 浏览器运行中库被锁:拷副本改没有意义(改的不是真库),必须直接开原库,失败就让层报告
// 明说"关闭浏览器后重试"。该层默认关闭、由 UI 显式勾选才执行(用户自己掌握关浏览器的时机)。

/// 浏览器 Cookies 库候选:`User Data/<profile>/Network/Cookies`(新布局)或 `<profile>/Cookies`(旧布局)。
/// 只认 Chrome 与 Edge 两家(本机主流),profile 目录靠「目录下存在 Cookies 库」识别,不猜名字。
fn browser_cookie_db_candidates() -> Vec<(String, PathBuf)> {
    let Ok(local) = std::env::var("LOCALAPPDATA") else {
        return Vec::new();
    };
    let local = PathBuf::from(local);
    let mut out: Vec<(String, PathBuf)> = Vec::new();
    for (browser, vendor) in [("Chrome", "Google/Chrome"), ("Edge", "Microsoft/Edge")] {
        let user_data = local.join(vendor).join("User Data");
        let Ok(rd) = std::fs::read_dir(&user_data) else {
            continue;
        };
        for entry in rd.flatten() {
            let net = entry.path().join("Network").join("Cookies");
            let old = entry.path().join("Cookies");
            let db = if net.is_file() {
                net
            } else if old.is_file() {
                old
            } else {
                continue;
            };
            out.push((browser.to_string(), db));
        }
    }
    out
}

/// 对单个 Cookies 库执行限定域删除,返回删除行数。
fn delete_trae_cookies(db: &Path) -> Result<usize, String> {
    let conn =
        rusqlite::Connection::open(db).map_err(|e| format!("打不开(浏览器运行中需关闭后重试?): {e}"))?;
    let n = conn
        .execute(
            "DELETE FROM cookies WHERE host_key LIKE '%trae.cn%' OR host_key LIKE '%trae.com%'",
            [],
        )
        .map_err(|e| format!("删除失败: {e}"))?;
    // 尽量回收 WAL,失败不影响删除结论(库是 Chromium 的,不追求事务洁癖)
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    Ok(n)
}

fn reset_layer_browser_cookies() -> ResetLayerReport {
    let dbs = browser_cookie_db_candidates();
    if dbs.is_empty() {
        return ResetLayerReport {
            layer: 7,
            name: "browser_cookies",
            ok: true,
            detail: "未发现 Chrome/Edge Cookie 库(可能未安装)".into(),
        };
    }
    let mut parts: Vec<String> = Vec::new();
    let mut deleted = 0usize;
    let mut failed = 0usize;
    for (browser, path) in &dbs {
        match delete_trae_cookies(path) {
            Ok(n) => {
                deleted += n;
                parts.push(format!("{browser}:删 {n} 条"));
            }
            Err(e) => {
                failed += 1;
                parts.push(format!("{browser}:{e}"));
            }
        }
    }
    ResetLayerReport {
        layer: 7,
        name: "browser_cookies",
        ok: failed == 0,
        detail: format!(
            "共 {} 个库,删 {} 条 TRAE Cookie;{}",
            dbs.len(),
            deleted,
            parts.join("; ")
        ),
    }
}

// ── 层⑧⑨⑩：深度重置(不卸载达到"重装级"干净) ──
// 立因(2026-10-09 用户两轮实测反馈:「深度还不够,重置不彻底」):第一版深度档只删
// webview Cookies 本体+vscdb 四类键前缀,但对照快照 9 类(SNAPSHOT_ENTRIES=参考项目
// 实证的重置现场全集)还有 6 处漏网:aha/ 整目录(aha.device.device_id 的老家)、
// 根级 Local Storage/leveldb(**恰好是捕获 JWT 的第一扫描位=登录态残留铁证**)、
// 根级 Network/(根级 Cookies 在捕获候选里)、根级 Session Storage/、Preferences 与
// Local State(Chromium 层设备/遥测,AES 密钥就从 Local State 读)、icube 爬虫分区。
// 且 vscdb 的身份键前缀不可穷尽(trae.*/icube.* 等都可能有)。
// **翻新:深度档语义收紧为"等效重装"——快照 9 类里除 storage.json 外全部整删**
// (vscdb 也整删,不再依赖键前缀枚举;反正有快照可恢复,重装态=这些路径不存在)。

/// 深度档要整删的目录(相对 TRAE 数据目录)。与 SNAPSHOT_ENTRIES 的现场全集对齐:
/// local_storage_dir/session_storage_dir/network_dir/partitions/aha_dir + IndexedDB。
/// 深度档整删目录(相对 TRAE 数据目录)。2026-10-10 真机残留盘点大幅扩面:
/// 风控仍命中 ⇒ 三现场逐条目比对,以下是漏网指纹源(全部实测存在过):
/// - ahanet:字节 ttNet 网络层(server.json/tt_net_config 含设备指纹配置)
/// - monitor:parfait 遥测 SDK 缓冲(崩溃/异常事件含设备信息)
/// - machineid.traereset_bak_* / storage.json.traereset_bak_*:参考工具备份文件,
///   含**全部旧机器码/旧遥测 ID**(sweep 见层⑧内 traereset_bak 通配清扫)
pub const DEEP_RESET_DIRS: [&str; 25] = [
    // webview 会话/存储(原 7 项)
    "Local Storage",
    "Session Storage",
    "Network",
    "IndexedDB",
    "aha",
    "Partitions/trae-webview",
    "Partitions/icube-web-crawler-shared-session-v1.0",
    // 真机盘点扩面
    "ahanet",
    "monitor",
    "Backups",
    "CachedProfilesData",
    "CachedConfigurations",
    "CachedExtensionVSIXs",
    "ModularData",
    "SharedStorage",
    "WebStorage",
    "blob_storage",
    "Shared Dictionary",
    "Service Worker",
    "Code Cache",
    "shared_proto_db",
    "User/globalStorage/cloudide.icube-im-bridge",
    "User/globalStorage/.mcp_gallery_cache",
    // 2026-10-10 残留审计实证补面:层⑨只管 User/globalStorage 的 state.vscdb,
    // 而**每个工作区**在 workspaceStorage/<hash>/ 下各有一份 state.vscdb(+.backup)
    // 与 workspace.json(实测命中旧身份值);History 存编辑历史含旧工作区 id
    "User/workspaceStorage",
    "User/History",
];

/// 深度档要整删的文件(相对 TRAE 数据目录):Chromium 层的偏好与 Local State
/// (捕获时的 AES 密钥就出自 Local State 的 os_crypt.encrypted_key——它同样携带设备痕迹)。
/// 2026-10-10 扩面:state.vscdb.backup 含旧登录密钥库(层⑨只删本体);DIPS(+wal) 是
/// 字节设备数据库。
pub const DEEP_RESET_FILES: [&str; 5] = [
    "Preferences",
    "Local State",
    "User/globalStorage/state.vscdb.backup",
    "DIPS",
    "DIPS-wal",
];

/// 主文件已删后清 -wal/-shm/-journal 伴生(失败容忍)。
fn remove_sqlite_family_wal_shm(db: &Path) -> usize {
    let name = db.file_name().and_then(|x| x.to_str()).unwrap_or("");
    if name.is_empty() {
        return 0;
    }
    let mut n = 0;
    for sfx in ["-wal", "-shm", "-journal"] {
        let p = db.with_file_name(format!("{name}{sfx}"));
        if p.is_file() && std::fs::remove_file(&p).is_ok() {
            n += 1;
        }
    }
    n
}

/// 层⑧:现场目录/文件整删(等效重装:重装态=这些路径不存在)。存在才删,不存在记"本就不在"。
/// 对传入的全部 TRAE 数据目录执行(双版本装过的机器必须全清,不能只清 detect 到的那份)。
fn reset_layer_deep_site_data(trae_dirs: &[PathBuf]) -> ResetLayerReport {
    let mut removed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    for trae_dir in trae_dirs {
        let trae_dir = trae_dir.as_path();
        for rel in DEEP_RESET_DIRS {
            let path = trae_dir.join(rel);
            // 目录/文件双形态:真机实测 SharedStorage 曾以 4096 字节**文件**形态残留
            // (旧版本安装残留),只认 is_dir() 会静默漏删——终验断言当场抓住。
            if path.is_dir() {
                match std::fs::remove_dir_all(&path) {
                    Ok(()) => removed.push(rel.to_string()),
                    Err(e) => errors.push(format!("{rel}: {e}")),
                }
            } else if path.symlink_metadata().is_ok() {
                // 非目录但存在(文件/符号链接/悬空链接)一律按文件删
                match std::fs::remove_file(&path) {
                    Ok(()) => removed.push(format!("{rel}(文件形态)")),
                    Err(e) => errors.push(format!("{rel}: {e}")),
                }
            }
        }
        for rel in DEEP_RESET_FILES {
            let path = trae_dir.join(rel);
            // symlink_metadata:符号链接本身也算目标(不跟随链接)
            if path.symlink_metadata().is_ok() {
                match std::fs::remove_file(&path) {
                    Ok(()) => removed.push(rel.to_string()),
                    Err(e) => errors.push(format!("{rel}: {e}")),
                }
            }
        }
        // 2026-10-10 扩面:参考工具(machineid.traereset_bak_*)与历史重置留下的
        // 旧身份备份文件——machineid/storage.json 的 *_bak 变体含**重置前全部旧值**,
        // 是最直接的旧指纹残留。通配清扫:根目录与 User/globalStorage 下凡文件名含
        // "traereset_bak" 或形如 machineid.* (非本体) 一律删。
        for scan_dir in [trae_dir.to_path_buf(), trae_dir.join("User/globalStorage")] {
            let rd = match std::fs::read_dir(&scan_dir) {
                Ok(rd) => rd,
                Err(_) => continue,
            };
            for entry in rd.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_stale_bak = name.contains("traereset_bak")
                    || (name.starts_with("machineid.") && name != "machineid");
                if !is_stale_bak {
                    continue;
                }
                let p = entry.path();
                let r = if p.is_dir() {
                    std::fs::remove_dir_all(&p)
                } else {
                    std::fs::remove_file(&p)
                };
                match r {
                    Ok(()) => removed.push(format!(
                        "{} (旧身份备份)",
                        p.strip_prefix(trae_dir).unwrap_or(&p).display()
                    )),
                    Err(e) => errors.push(format!("{}: {e}", p.display())),
                }
            }
        }
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 8,
            name: "deep_site_data",
            ok: true,
            detail: if removed.is_empty() {
                "无(本就不在,已是重装态)".into()
            } else {
                format!("已整删: {}", removed.join(", "))
            },
        }
    } else {
        ResetLayerReport {
            layer: 8,
            name: "deep_site_data",
            ok: false,
            detail: format!(
                "{};已删: {}",
                errors.join("; "),
                removed.join(", ")
            ),
        }
    }
}

/// 层⑨:state.vscdb 整删(+ -wal/-shm/-journal 伴生)。第一版按键前缀精准清
/// (telemetry.%/aha.%/secret://%/authentication%),但身份键前缀不可穷尽
/// (trae.*/icube.* 等内部域都可能藏设备指纹),用户实测仍不彻底 ⇒ 深度档改为整删:
/// 等效重装态=该库不存在,TRAE 首启从零重建;快照可恢复。
fn reset_layer_state_vscdb_multi(trae_dirs: &[PathBuf]) -> ResetLayerReport {
    let mut removed = 0usize;
    let mut errors: Vec<String> = Vec::new();
    for trae_dir in trae_dirs {
        let db = trae_dir.join("User/globalStorage/state.vscdb");
        if !db.is_file() {
            continue;
        }
        match std::fs::remove_file(&db) {
            Ok(()) => {
                removed += 1;
                let _ = remove_sqlite_family_wal_shm(&db);
            }
            Err(e) => errors.push(format!("{}: {e}", db.display())),
        }
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 9,
            name: "state.vscdb",
            ok: true,
            detail: if removed == 0 {
                "无 state.vscdb(本就不在,已是重装态)".into()
            } else {
                format!("已整删 {removed} 个库(+伴生);TRAE 首启从零重建")
            },
        }
    } else {
        ResetLayerReport {
            layer: 9,
            name: "state.vscdb",
            ok: false,
            detail: errors.join("; "),
        }
    }
}

#[allow(dead_code)]
fn reset_layer_state_vscdb(trae_dir: &Path) -> ResetLayerReport {
    let db = trae_dir.join("User/globalStorage/state.vscdb");
    if !db.is_file() {
        return ResetLayerReport {
            layer: 9,
            name: "state.vscdb",
            ok: true,
            detail: "无 state.vscdb(本就不在,已是重装态)".into(),
        };
    }
    match std::fs::remove_file(&db) {
        Ok(()) => {
            let extra = remove_sqlite_family_wal_shm(&db);
            ResetLayerReport {
                layer: 9,
                name: "state.vscdb",
                ok: true,
                detail: format!("已整删(含 {extra} 个伴生文件);TRAE 首启从零重建"),
            }
        }
        Err(e) => ResetLayerReport {
            layer: 9,
            name: "state.vscdb",
            ok: false,
            detail: format!("删除失败(TRAE 运行中需完全退出后重试?): {e}"),
        },
    }
}

/// 层⑩:日志与缓存目录(logs 遥测含机器码;Crashpad 崩溃报告含机器信息;
/// Dawn*/GPU/Cache 是纯缓存,删了自动重建,无功能影响)。
fn reset_layer_logs_cache_multi(trae_dirs: &[PathBuf]) -> ResetLayerReport {
    const DIRS: [&str; 8] = [
        "logs",
        "Cache",
        "GPUCache",
        "CachedData",
        "Crashpad",
        "DawnCache",
        "DawnGraphiteCache",
        "DawnWebGPUCache",
    ];
    let mut removed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    for trae_dir in trae_dirs {
        for rel in DIRS {
            let path = trae_dir.join(rel);
            if path.is_dir() {
                match std::fs::remove_dir_all(&path) {
                    Ok(()) => removed.push(rel.to_string()),
                    Err(e) => errors.push(format!("{rel}: {e}")),
                }
            }
        }
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 10,
            name: "logs_cache",
            ok: true,
            detail: if removed.is_empty() {
                "无(本就不在)".into()
            } else {
                format!("已删: {}", removed.join(", "))
            },
        }
    } else {
        ResetLayerReport {
            layer: 10,
            name: "logs_cache",
            ok: false,
            detail: errors.join("; "),
        }
    }
}

// ── 层⓪ 进程清扫 + 层⑪ 注册表 + 层⑫ 本地缓存(2026-10-09 第三轮实测反馈扩面) ──
// 用户指令:「点击按钮后自己杀一遍 trae 进程,别让用户操作」+「重置程度还是不够」。
// 新增三处残留源:①运行中的 TRAE 进程(占着文件锁,不杀则 machineid/Cookies 删了也会
// 被运行中的它写回);②注册表 HKCU\\Software\\TRAE*(VSCode 系会把安装/遥测信息写进去);
// ③%LOCALAPPDATA% 与 %TEMP% 侧的 TRAE 目录(Electron 的部分缓存/更新器/崩溃转储不在
// %APPDATA% userData 里)。

/// 判定进程映像名是否属于 TRAE(大小写不敏感;名字里含 "trae" 即命中——
/// TRAE.exe / Trae SOLO CN.exe / TRAE SOLO.exe 全族都覆盖,不会误伤 ihui)。
pub fn is_trae_process_image(image_name: &str) -> bool {
    let lower = image_name.to_ascii_lowercase();
    lower.contains("trae") && lower.ends_with(".exe")
}

/// 层⓪:枚举并强杀全部 TRAE 进程(ToolHelp 快照枚举 + TerminateProcess)。
/// 返回层报告:杀了几只、各自映像名。杀完 sleep 1.5s 等文件锁释放。
#[cfg(windows)]
fn kill_trae_processes() -> ResetLayerReport {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

    let mut killed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    unsafe {
        let snap = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            Ok(h) => h,
            Err(e) => {
                return ResetLayerReport {
                    layer: 0,
                    name: "kill_trae_processes",
                    ok: false,
                    detail: format!("进程快照失败: {e}"),
                }
            }
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                let image = String::from_utf16_lossy(
                    &entry.szExeFile[..entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(0)],
                );
                if is_trae_process_image(&image) {
                    match OpenProcess(PROCESS_TERMINATE, false, entry.th32ProcessID) {
                        Ok(h) => {
                            if TerminateProcess(h, 1).is_ok() {
                                killed.push(format!("{}({})", image, entry.th32ProcessID));
                            } else {
                                errors.push(format!("{}: 终止失败", image));
                            }
                            let _ = CloseHandle(h);
                        }
                        Err(e) => errors.push(format!("{}: 打开失败({e})", image)),
                    }
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
    }
    if killed.is_empty() {
        // 没杀到=TRAE 没在跑,属正常路径(ok)
        let detail = if errors.is_empty() {
            "无运行中的 TRAE 进程".to_string()
        } else {
            format!("无进程被杀但有异常: {}", errors.join("; "))
        };
        ResetLayerReport { layer: 0, name: "kill_trae_processes", ok: errors.is_empty(), detail }
    } else {
        std::thread::sleep(std::time::Duration::from_millis(1500));
        ResetLayerReport {
            layer: 0,
            name: "kill_trae_processes",
            ok: errors.is_empty(),
            detail: format!("已强杀 {} 个 TRAE 进程: {};{}", killed.len(), killed.join(", "), errors.join("; ")),
        }
    }
}

#[cfg(not(windows))]
fn kill_trae_processes() -> ResetLayerReport {
    ResetLayerReport {
        layer: 0,
        name: "kill_trae_processes",
        ok: true,
        detail: "非 Windows 平台跳过".into(),
    }
}

// ── 层⑪ 键名判据(纯函数,单测直跑;不依赖平台/文件)─────────────────────────
// 2026-10-10 残留审计**真机取证扩面**:旧实现只删 3 个硬编码键
// (Software\{TRAE, TRAE SOLO CN, TRAE SOLO}),审计器扫描后发现 4 类键从未被触碰:
//   HKCU\Software\Bytedance\Trae CN              ← 藏在厂商容器下(旧实现枚举不到)
//   HKCU\Software\Trae Work 助手\Trae Work 助手  ← 中文本地化键名,硬编码清单里没有
//   HKLM\SOFTWARE\WOW6432Node\ByteDance          ← 32 位视图厂商键
//   HKCU\Software\Classes\trae + Trae CN.* ×291  ← trae:// 协议与文件关联 ProgID
// 结论:**硬编码清单必漏**(厂商随时改键名),改为枚举父键按族名判据动态发现。

/// 判据①:**TRAE 族键** ⇒ 整树删除。覆盖 trae / Trae CN / Trae Work 助手 /
/// TRAE SOLO CN / icube / ahawork 全部变体(大小写不敏感)。
pub fn is_trae_family_reg_key(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n.contains("trae") || n.contains("icube") || n.contains("ahawork")
}

/// 判据②:**厂商容器键** ⇒ **只摘其下的 TRAE 子项,绝不整删容器**。
/// 取证:本机 `HKCU\Software\Bytedance` 下只有 `Trae CN` 一个子项,但同厂其他产品
/// (抖音/剪映/飞书等)在别的机器上可能共用该容器 ⇒ 整删会误伤无辜,故只摘 TRAE。
pub fn is_vendor_container_reg_key(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n.contains("bytedance") || name.contains("字节")
}

/// 判据③:`HKCU\Software\Classes` 下的 TRAE ProgID —— `trae://` 协议处理器与
/// `Trae CN.<扩展名>` 文件关联(本机遇见 291 项)。属安装指纹,重装级清理要摘;
/// TRAE 下次启动会自行重新注册。
pub fn is_trae_progid_reg_key(name: &str) -> bool {
    name.to_ascii_lowercase().starts_with("trae")
}

/// 层⑪:注册表 TRAE 族键**发现式**整树删除(保留历史 3 键作兜底)。
/// 覆盖 HKCU\Software(含厂商容器内子项)与 HKCU\Software\Classes 的协议/文件关联;
/// HKLM 侧厂商容器需管理员,删不掉记「降级」不判红(MachineGuid 属层⑤职权,不在这里动)。
#[cfg(windows)]
fn reset_layer_registry() -> ResetLayerReport {
    use windows::Win32::System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};

    let mut deleted: Vec<String> = Vec::new();
    let mut degraded: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    // ① 历史硬编码 3 键:兜底(枚举万一被权限/沙箱挡住时至少还有这层)
    for sk in ["Software\\TRAE", "Software\\TRAE SOLO CN", "Software\\TRAE SOLO"] {
        if !regutil::exists(HKEY_CURRENT_USER, sk) {
            continue;
        }
        match regutil::delete_tree(HKEY_CURRENT_USER, sk) {
            Ok(()) => deleted.push(format!("HKCU\\{sk}")),
            Err(e) => errors.push(format!("HKCU\\{sk}: win32 {e}")),
        }
    }

    // ② HKCU\Software 发现式:TRAE 族整删;厂商容器只摘其下 TRAE 子项
    for name in regutil::subkeys(HKEY_CURRENT_USER, "Software") {
        let p = format!("Software\\{name}");
        if is_trae_family_reg_key(&name) {
            match regutil::delete_tree(HKEY_CURRENT_USER, &p) {
                Ok(()) => deleted.push(format!("HKCU\\{p}")),
                Err(e) => errors.push(format!("HKCU\\{p}: win32 {e}")),
            }
        } else if is_vendor_container_reg_key(&name) {
            for sub in regutil::subkeys(HKEY_CURRENT_USER, &p) {
                if is_trae_family_reg_key(&sub) {
                    let q = format!("{p}\\{sub}");
                    match regutil::delete_tree(HKEY_CURRENT_USER, &q) {
                        Ok(()) => deleted.push(format!("HKCU\\{q}(厂商容器内)")),
                        Err(e) => errors.push(format!("HKCU\\{q}: win32 {e}")),
                    }
                }
            }
            // 摘完 TRAE 子项后容器已空 ⇒ 连容器一起摘(Trae 是本厂唯一产品时,
            // 空容器本身仍是"本机装过 ByteDance 系"的安装指纹)。
            // 护栏:**有残留子项或有值**一律不动 —— 那说明同厂其他产品还在用它。
            if regutil::is_empty_key(HKEY_CURRENT_USER, &p) {
                match regutil::delete_tree(HKEY_CURRENT_USER, &p) {
                    Ok(()) => deleted.push(format!("HKCU\\{p}(厂商容器已空,一并摘除)")),
                    Err(e) => degraded.push(format!("HKCU\\{p}(win32 {e})")),
                }
            }
        }
    }

    // ③ HKCU\Software\Classes:trae:// 协议 + Trae CN.<扩展名> 文件关联
    let mut progids = 0usize;
    for name in regutil::subkeys(HKEY_CURRENT_USER, "Software\\Classes") {
        if !is_trae_progid_reg_key(&name) {
            continue;
        }
        let q = format!("Software\\Classes\\{name}");
        match regutil::delete_tree(HKEY_CURRENT_USER, &q) {
            Ok(()) => progids += 1,
            Err(e) => errors.push(format!("HKCU\\{q}: win32 {e}")),
        }
    }
    if progids > 0 {
        deleted.push(format!(
            "HKCU\\Software\\Classes\\trae* ×{progids}(协议处理器与文件关联)"
        ));
    }

    // ④ HKLM 厂商容器:需管理员 ⇒ 失败属预期,记"降级"不判红
    for root_path in ["SOFTWARE", "SOFTWARE\\WOW6432Node"] {
        for name in regutil::subkeys(HKEY_LOCAL_MACHINE, root_path) {
            let p = format!("{root_path}\\{name}");
            if is_trae_family_reg_key(&name) {
                match regutil::delete_tree(HKEY_LOCAL_MACHINE, &p) {
                    Ok(()) => deleted.push(format!("HKLM\\{p}")),
                    Err(e) => degraded.push(format!("HKLM\\{p}(win32 {e})")),
                }
            } else if is_vendor_container_reg_key(&name) {
                for sub in regutil::subkeys(HKEY_LOCAL_MACHINE, &p) {
                    if is_trae_family_reg_key(&sub) {
                        let q = format!("{p}\\{sub}");
                        match regutil::delete_tree(HKEY_LOCAL_MACHINE, &q) {
                            Ok(()) => deleted.push(format!("HKLM\\{q}(厂商容器内)")),
                            Err(e) => degraded.push(format!("HKLM\\{q}(win32 {e})")),
                        }
                    }
                }
            }
        }
    }

    let mut detail = if deleted.is_empty() {
        "未发现 TRAE 族注册表键(本就不在)".to_string()
    } else {
        format!("已整树删除 {} 处: {}", deleted.len(), deleted.join(" | "))
    };
    if !degraded.is_empty() {
        detail.push_str(&format!(
            ";需管理员未能删(可提权重跑,不影响应用层干净): {}",
            degraded.join(" | ")
        ));
    }
    let ok = errors.is_empty();
    if !ok {
        detail = format!("{detail};失败: {}", errors.join(" | "));
    }
    ResetLayerReport {
        layer: 11,
        name: "registry_hkcu_trae",
        ok,
        detail,
    }
}

/// 注册表直调小工具(windows 原生 API,不依赖 reg.exe —— 后者在部分环境被安全策略挡)。
#[cfg(windows)]
mod regutil {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteTreeW, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW,
        RegQueryInfoKeyW, HKEY, KEY_ENUMERATE_SUB_KEYS, KEY_READ, RRF_RT_REG_EXPAND_SZ,
        RRF_RT_REG_SZ,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn exists(root: HKEY, path: &str) -> bool {
        unsafe {
            let w = wide(path);
            let mut hk = HKEY::default();
            if RegOpenKeyExW(root, PCWSTR(w.as_ptr()), Some(0), KEY_READ, &mut hk) != ERROR_SUCCESS {
                return false;
            }
            let _ = RegCloseKey(hk);
            true
        }
    }

    /// 枚举**直接子项名**(非递归)。父键不存在/无权限 ⇒ 返回空,调用方按"没发现"处理。
    pub fn subkeys(root: HKEY, path: &str) -> Vec<String> {
        unsafe {
            let w = wide(path);
            let mut hk = HKEY::default();
            if RegOpenKeyExW(root, PCWSTR(w.as_ptr()), Some(0), KEY_ENUMERATE_SUB_KEYS, &mut hk)
                != ERROR_SUCCESS
            {
                return Vec::new();
            }
            let mut out: Vec<String> = Vec::new();
            let mut idx = 0u32;
            loop {
                let mut buf = [0u16; 512];
                let mut len = buf.len() as u32;
                let r = RegEnumKeyExW(
                    hk,
                    idx,
                    Some(windows::core::PWSTR(buf.as_mut_ptr())),
                    &mut len as *mut u32,
                    None,
                    None,
                    None,
                    None,
                );
                if r != ERROR_SUCCESS {
                    break;
                }
                out.push(String::from_utf16_lossy(&buf[..len as usize]));
                idx += 1;
                // 防爆:正常 hive 的直接子项不可能上万(Classes 也就数千)
                if idx > 50000 {
                    break;
                }
            }
            let _ = RegCloseKey(hk);
            out
        }
    }

    /// 键是否已"空":无子项**且**无值。用于判断厂商容器能否安全整删。
    pub fn is_empty_key(root: HKEY, path: &str) -> bool {
        unsafe {
            let w = wide(path);
            let mut hk = HKEY::default();
            if RegOpenKeyExW(root, PCWSTR(w.as_ptr()), Some(0), KEY_READ, &mut hk) != ERROR_SUCCESS {
                return false;
            }
            let mut subkeys: u32 = 0;
            let mut values: u32 = 0;
            let ok = RegQueryInfoKeyW(
                hk,
                None,
                None,
                None,
                Some(&mut subkeys as *mut u32),
                None,
                None,
                Some(&mut values as *mut u32),
                None,
                None,
                None,
                None,
            );
            let _ = RegCloseKey(hk);
            ok == ERROR_SUCCESS && subkeys == 0 && values == 0
        }
    }

    /// 读一个字符串型注册表值(只认 REG_SZ/EXPAND_SZ;二进制值跳过,免得解出乱码)。
    pub fn read_string(root: HKEY, key: &str, name: &str) -> Option<String> {
        unsafe {
            let k = wide(key);
            let n = wide(name);
            let mut cb: u32 = 0;
            let probe = RegGetValueW(
                root,
                PCWSTR(k.as_ptr()),
                PCWSTR(n.as_ptr()),
                RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ,
                None,
                None,
                Some(&mut cb as *mut u32),
            );
            if probe != ERROR_SUCCESS || cb == 0 {
                return None;
            }
            let mut buf: Vec<u16> = vec![0u16; (cb as usize / 2) + 2];
            let mut cb2 = (buf.len() * 2) as u32;
            let r = RegGetValueW(
                root,
                PCWSTR(k.as_ptr()),
                PCWSTR(n.as_ptr()),
                RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ,
                None,
                Some(buf.as_mut_ptr() as *mut core::ffi::c_void),
                Some(&mut cb2 as *mut u32),
            );
            if r != ERROR_SUCCESS {
                return None;
            }
            while buf.len() > 1 && buf[buf.len() - 1] == 0 {
                buf.pop();
            }
            let s = String::from_utf16_lossy(&buf);
            let s = s.trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        }
    }

    pub fn delete_tree(root: HKEY, path: &str) -> Result<(), u32> {
        unsafe {
            let w = wide(path);
            let r = RegDeleteTreeW(root, PCWSTR(w.as_ptr()));
            if r == ERROR_SUCCESS {
                Ok(())
            } else {
                Err(r.0)
            }
        }
    }
}

#[cfg(not(windows))]
fn reset_layer_registry() -> ResetLayerReport {
    ResetLayerReport {
        layer: 11,
        name: "registry_hkcu_trae",
        ok: true,
        detail: "非 Windows 平台跳过".into(),
    }
}

/// 层⑫:%LOCALAPPDATA% 侧的 TRAE 目录与 %TEMP% 下的 TRAE* 条目整删
/// (Electron 部分缓存/更新器/崩溃转储不在 %APPDATA% userData 里)。
#[cfg(windows)]
fn reset_layer_local_cache() -> ResetLayerReport {
    let mut targets: Vec<PathBuf> = Vec::new();
    for base in [std::env::var("LOCALAPPDATA"), std::env::var("TEMP")].into_iter().flatten() {
        let base = PathBuf::from(base);
        if base == PathBuf::from("TEMP") {
            continue;
        }
        if base.ends_with("Temp") {
            // TEMP 下所有 TRAE 开头的条目
            if let Ok(rd) = std::fs::read_dir(&base) {
                for e in rd.flatten() {
                    let name = e.file_name().to_string_lossy().to_ascii_lowercase();
                    if name.starts_with("trae") {
                        targets.push(e.path());
                    }
                }
            }
        } else {
            targets.push(base.join("TRAE SOLO CN"));
            targets.push(base.join("TRAE"));
            // 2026-10-10 残留审计实证补面:TRAE Work CN 的 WebView2 数据根
            // (LOCALAPPDATA\com.traework.assistant\EBWebView)——实测其中的
            // Local State 与 Code Cache 仍带旧设备 GUID,此前完全不在删面内
            targets.push(base.join("com.traework.assistant"));
            targets.push(base.join("Trae Work CN"));
            targets.push(base.join("TraeCode CN"));
        }
    }
    let mut removed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    for p in &targets {
        let label = p.display().to_string();
        let is_dir = p.is_dir();
        let is_file = p.is_file();
        let r = if is_dir {
            std::fs::remove_dir_all(p)
        } else if is_file {
            std::fs::remove_file(p)
        } else {
            continue;
        };
        match r {
            Ok(()) => removed.push(label),
            Err(e) => errors.push(format!("{label}: {e}")),
        }
    }
    if errors.is_empty() {
        ResetLayerReport {
            layer: 12,
            name: "localappdata_temp_cache",
            ok: true,
            detail: if removed.is_empty() {
                "无 LOCALAPPDATA/TEMP 残留(本就不在)".into()
            } else {
                format!("已删 {} 项", removed.len())
            },
        }
    } else {
        ResetLayerReport {
            layer: 12,
            name: "localappdata_temp_cache",
            ok: false,
            detail: errors.join("; "),
        }
    }
}

#[cfg(not(windows))]
fn reset_layer_local_cache() -> ResetLayerReport {
    ResetLayerReport {
        layer: 12,
        name: "localappdata_temp_cache",
        ok: true,
        detail: "非 Windows 平台跳过".into(),
    }
}

/// 层⑬:物理网卡 MAC 地址改写(2026-10-10 新增,flag reset_mac 控制默认关)。
/// 动机:machineid/MachineGuid/storage.json 全翻新后,**MAC 地址是仍可能把新旧设备
/// 串联起来的硬件指纹**(风控可读本机网卡)。只动「已连接的物理网卡」(排除虚拟/
/// VPN/TAP),旧 MAC 先备份到 %TEMP%\ihui-mac-backup-<ts>.txt 可还原。
/// 新 MAC 取本地管理位(第二 hex 位 ∈ {2,6,A,E}),不与真实厂商 OUI 冲突。
/// 写注册表 NetworkAddress 后 Restart-NetAdapter 生效(网络会闪断数秒);
/// 网卡重启失败(权限/驱动不支持)时降级记「重启系统后生效」,不算失败。
#[cfg(windows)]
fn reset_layer_mac_addresses() -> ResetLayerReport {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup_path = std::env::var("TEMP")
        .map(|t| format!("{t}\\ihui-mac-backup-{ts}.txt"))
        .unwrap_or_else(|_| format!("C:\\Windows\\Temp\\ihui-mac-backup-{ts}.txt"));
    let script = r#"
$ErrorActionPreference = 'Continue'
$backup = New-Object System.Collections.Generic.List[string]
$script:changed = 0
$script:failed = 0
$adapters = Get-NetAdapter | Where-Object {
    $_.Status -eq 'Up' -and
    $_.InterfaceDescription -notmatch 'Virtual|VPN|TAP|Loopback|WAN Miniport|Microsoft Kernel'
}
foreach ($a in $adapters) {
    try {
        $backup.Add("$($a.Name)|$($a.InterfaceDescription)|$($a.MacAddress)")
        $rnd = -join ((1..10) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
        $mac = '0' + ('2','6','A','E' | Get-Random) + $rnd
        $base = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
        $key = Get-ChildItem $base | Where-Object {
            (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc -eq $a.InterfaceDescription
        } | Select-Object -First 1
        if ($key) {
            Set-ItemProperty -Path $key.PSPath -Name NetworkAddress -Value $mac -Force -ErrorAction Stop
            Restart-NetAdapter -Name $a.Name -Confirm:$false -ErrorAction SilentlyContinue
            $script:changed++
        } else {
            $script:failed++
        }
    } catch {
        $script:failed++
    }
}
$backup | Set-Content -Path '__BACKUP_PATH__' -Encoding utf8
Write-Output "RESULT changed=$($script:changed) failed=$($script:failed) adapters=$($adapters.Count)"
"#.replace("__BACKUP_PATH__", &backup_path);
    match std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
    {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let line = stdout.lines().find(|l| l.starts_with("RESULT ")).unwrap_or("");
            let changed = line
                .split_whitespace()
                .find(|p| p.starts_with("changed="))
                .and_then(|p| p.strip_prefix("changed="))
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0);
            let failed = line
                .split_whitespace()
                .find(|p| p.starts_with("failed="))
                .and_then(|p| p.strip_prefix("failed="))
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0);
            if out.status.success() && failed == 0 {
                ResetLayerReport {
                    layer: 13,
                    name: "mac_addresses",
                    ok: true,
                    detail: format!(
                        "已改写 {changed} 块物理网卡 MAC(旧值备份 {backup_path});网卡已重启生效"
                    ),
                }
            } else if changed > 0 {
                ResetLayerReport {
                    layer: 13,
                    name: "mac_addresses",
                    ok: true,
                    detail: format!(
                        "已改写 {changed} 块(失败 {failed});部分网卡需重启系统生效;旧值备份 {backup_path}"
                    ),
                }
            } else {
                ResetLayerReport {
                    layer: 13,
                    name: "mac_addresses",
                    ok: false,
                    detail: format!("降级 skip(无网卡被改写,需管理员权限?): {}", line),
                }
            }
        }
        Err(e) => ResetLayerReport {
            layer: 13,
            name: "mac_addresses",
            ok: false,
            detail: format!("降级 skip(无法启动 powershell: {e})"),
        },
    }
}

#[cfg(not(windows))]
fn reset_layer_mac_addresses() -> ResetLayerReport {
    ResetLayerReport {
        layer: 13,
        name: "mac_addresses",
        ok: true,
        detail: "非 Windows 平台跳过".into(),
    }
}

/// 14 层重置入口(L0 进程清扫/L11 注册表/L12 本地缓存/L13 MAC 硬件指纹为实测扩面)。
/// include_machine_guid / clean_browser_cookies / deep_reset / kill_running / reset_mac
/// 受 flag 控制,false 时对应层记 skip——单测必须传 kill_running=false,绝不真杀进程。
pub fn reset_device_ids(
    trae_dir: &Path,
    include_machine_guid: bool,
    clean_browser_cookies: bool,
    deep_reset: bool,
    kill_running: bool,
    reset_mac: bool,
) -> ResetReport {
    // 全部存在的 TRAE 数据目录候选(APPDATA 与 LOCALAPPDATA 两侧的 TRAE SOLO CN / TRAE):
    // 双版本装过的机器只清 detect 到的那一份会漏,深度档必须全清。
    // ⚠️ 候选必须读 env(与 detect_trae_dir 同法):传 None 会拿到空列表,
    //    深度层⑧⑨⑩整删循环空转、层报告却显示 ok——2026-10-09 仿真实测抓出的真 bug。
    let read_env = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    let mut all_trae_dirs: Vec<PathBuf> = trae_dir_candidates(
        read_env("APPDATA").as_deref(),
        read_env("LOCALAPPDATA").as_deref(),
        None,
    )
    .into_iter()
    .filter(|p| p.is_dir())
    .collect();
    // 传入 dir(如 IHUI_TRAE_DIR 覆盖命中、或不在两侧候选的自定义位置)也要补进深度清单,不漏
    if !all_trae_dirs.contains(&trae_dir.to_path_buf()) {
        all_trae_dirs.push(trae_dir.to_path_buf());
    }
    // 审计账本:在**任何一层动手之前**把即将被覆盖的旧身份值记下来。
    // 没有这一步,重置后就无从证明"到底干净没有"——审计器拿这份账本当黑名单比对。
    // 写账本失败只记 warn:它影响的是"能不能验证",不影响"能不能重置"。
    let old_identity = capture_identity_values(&all_trae_dirs);
    if !old_identity.is_empty() {
        if let Err(e) = append_identity_history(&old_identity) {
            log::warn!("[checkin-capture] 身份历史账本写入失败(不影响重置): {e}");
        }
    }
    let mut layers: Vec<ResetLayerReport> = vec![if kill_running {
        kill_trae_processes()
    } else {
        ResetLayerReport {
            layer: 0,
            name: "kill_trae_processes",
            ok: true,
            detail: "skipped(kill_running=false)".into(),
        }
    }];
    // 层①②③④⑥的作用域:深度档覆盖全部候选目录(多现场机器不漏);
    // 非 deep 只作用 detect 到的一处——与历史行为一致,普通单测不误伤真机现场。
    let single = [trae_dir.to_path_buf()];
    let scope: &[PathBuf] = if deep_reset { &all_trae_dirs } else { &single };
    layers.push(reset_layer_machineid(scope));
    let (r2, r3) = reset_layer_storage_json(scope);
    layers.push(r2);
    layers.push(r3);
    layers.push(reset_layer_tiny_storage(scope));
    layers.push(if include_machine_guid {
        reset_layer_machine_guid()
    } else {
        ResetLayerReport {
            layer: 5,
            name: "MachineGuid",
            ok: true,
            detail: "skipped(include_machine_guid=false)".into(),
        }
    });
    layers.push(reset_layer_partitions(scope));
    // 层⑦默认 skip:动系统浏览器的 cookie 必须用户显式选择(浏览器运行中会被锁,时机由用户掌握)
    layers.push(if clean_browser_cookies {
        reset_layer_browser_cookies()
    } else {
        ResetLayerReport {
            layer: 7,
            name: "browser_cookies",
            ok: true,
            detail: "skipped(clean_browser_cookies=false)".into(),
        }
    });
    // 层⑧⑨⑩(深度重置)默认 skip:webview Cookies 库本体/state.vscdb 身份键/日志缓存,
    // 是"不卸载达到重装级干净"的补全——动的是 TRAE 登录态与凭据,同样由用户显式选择。
    layers.push(if deep_reset {
        reset_layer_deep_site_data(&all_trae_dirs)
    } else {
        ResetLayerReport {
            layer: 8,
            name: "trae_webview_cookies",
            ok: true,
            detail: "skipped(deep_reset=false)".into(),
        }
    });
    layers.push(if deep_reset {
        reset_layer_state_vscdb_multi(&all_trae_dirs)
    } else {
        ResetLayerReport {
            layer: 9,
            name: "state.vscdb",
            ok: true,
            detail: "skipped(deep_reset=false)".into(),
        }
    });
    layers.push(if deep_reset {
        reset_layer_logs_cache_multi(&all_trae_dirs)
    } else {
        ResetLayerReport {
            layer: 10,
            name: "logs_cache",
            ok: true,
            detail: "skipped(deep_reset=false)".into(),
        }
    });
    layers.push(if deep_reset {
        reset_layer_registry()
    } else {
        ResetLayerReport {
            layer: 11,
            name: "registry_hkcu_trae",
            ok: true,
            detail: "skipped(deep_reset=false)".into(),
        }
    });
    layers.push(if deep_reset {
        reset_layer_local_cache()
    } else {
        ResetLayerReport {
            layer: 12,
            name: "localappdata_temp_cache",
            ok: true,
            detail: "skipped(deep_reset=false)".into(),
        }
    });
    // 层⑬(硬件指纹,默认 skip):MAC 地址是最后一块能串联新旧设备的本地指纹,
    // 动它网络会闪断且需管理员权限,必须用户显式勾选。
    layers.push(if reset_mac {
        reset_layer_mac_addresses()
    } else {
        ResetLayerReport {
            layer: 13,
            name: "mac_addresses",
            ok: true,
            detail: "skipped(reset_mac=false)".into(),
        }
    });
    ResetReport { layers }
}

// ================== 残留指纹审计（2026-10-10：把"到底干净没有"做成可验证）==================
//
// 方法论(不靠感觉,靠比对):
//   1. 每次重置前,把"即将被覆盖掉的旧身份值"记进 `identity-history.json`(账本);
//   2. 审计时,账本里的旧值**就是黑名单**,去扫当前全部 TRAE 现场;
//   3. 扫到的每一个黑名单值 = 一条硬残留。0 条才算"应用层已彻底翻新"。
// 这一层存在的意义:用户说"感觉没重置彻底"时,能给出**可复核的数字**,而不是一句"已完成"。

/// 单文件扫描体积上限:更大的基本是日志/缓存包,不会藏身份值(与审计脚本同口径)。
pub const AUDIT_MAX_FILE_BYTES: u64 = 12 * 1024 * 1024;

/// 账本路径:`%USERPROFILE%\.trae-proxy\identity-history.json`(与 MachineGuid 备份同目录)。
fn identity_history_path() -> Option<PathBuf> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())?;
    let dir = home.join(".trae-proxy");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("identity-history.json"))
}

/// 从任意字节流抽"像身份"的记号:①恰好 32 位字母数字串 ②UUID(8-4-4-4-12 小写)。
/// 纯函数,单测直跑。按**字节**扫,不要求文件是合法 UTF-8(TRAE 现场有大量二进制库),
/// 也不做 latin1/utf8 双解码——字节级判定对二进制现场更稳。
pub fn extract_identity_tokens(bytes: &[u8]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let n = bytes.len();
    let mut i = 0usize;
    while i < n {
        if let Some(u) = try_uuid_at(bytes, i) {
            out.push(u);
            i += 36;
            continue;
        }
        if bytes[i].is_ascii_alphanumeric() {
            let start = i;
            while i < n && bytes[i].is_ascii_alphanumeric() {
                i += 1;
            }
            if i - start == 32 {
                out.push(String::from_utf8_lossy(&bytes[start..i]).to_ascii_lowercase());
            }
        } else {
            i += 1;
        }
    }
    out
}

/// 位置 i 起是否是一个完整 UUID(前后不得再接 hex 或 '-',否则只是更长串的一段)。
fn try_uuid_at(b: &[u8], i: usize) -> Option<String> {
    if i + 36 > b.len() {
        return None;
    }
    for j in 0..36usize {
        if j == 8 || j == 13 || j == 18 || j == 23 {
            if b[i + j] != b'-' {
                return None;
            }
        } else if !b[i + j].is_ascii_hexdigit() {
            return None;
        }
    }
    if i > 0 && (b[i - 1].is_ascii_hexdigit() || b[i - 1] == b'-') {
        return None;
    }
    let end = i + 36;
    if end < b.len() && (b[end].is_ascii_hexdigit() || b[end] == b'-') {
        return None;
    }
    Some(String::from_utf8_lossy(&b[i..end]).to_ascii_lowercase())
}

/// 是否"像身份值"(32hex 或 UUID)——账本只收这类,防止把 "old" 之类的测试串当历史。
pub fn looks_like_identity(v: &str) -> bool {
    let n = v.len();
    (n == 32 && v.bytes().all(|b| b.is_ascii_alphanumeric())) || (n == 36 && try_uuid_at(v.as_bytes(), 0).is_some())
}

/// 注册表指纹在账本里的记号形态:`regfp|<键路径>|<值>`。
/// 用 `|` 前缀与文件侧的 32hex/UUID 隔开——它只用于注册表维度比对,不参与文件扫描。
pub fn reg_fingerprint_token(slot: &str, value: &str) -> String {
    format!("regfp|{slot}|{}", value.trim())
}

/// 抓取注册表指纹槽位的当前值(层⑪ 动手之前)。
#[cfg(windows)]
pub fn capture_registry_fingerprints() -> Vec<String> {
    use windows::Win32::System::Registry::HKEY_CURRENT_USER;
    let mut out: Vec<String> = Vec::new();
    for (key, name) in TRAE_REG_FINGERPRINT_SLOTS {
        if let Some(v) = regutil::read_string(HKEY_CURRENT_USER, key, name) {
            out.push(reg_fingerprint_token(key, &v));
        }
    }
    out
}

#[cfg(not(windows))]
pub fn capture_registry_fingerprints() -> Vec<String> {
    Vec::new()
}

/// 重置**前**抓取即将被覆盖的旧身份值:各现场 machineid 文件 + storage.json 的
/// 4 个点号键 + 已备份的旧 MachineGuid + 注册表指纹槽位。只收"像身份"的值。
pub fn capture_identity_values(trae_dirs: &[PathBuf]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for d in trae_dirs {
        if let Ok(s) = std::fs::read_to_string(d.join("machineid")) {
            // 历史备份可能是 utf8-BOM 写入(PowerShell 5.1 Set-Content -Encoding utf8 的老坑)
            let v = s.trim_start_matches('\u{feff}').trim().to_ascii_lowercase();
            if looks_like_identity(&v) {
                out.push(v);
            }
        }
        if let Ok(s) = std::fs::read_to_string(d.join("User/globalStorage/storage.json")) {
            if let Ok(j) = serde_json::from_str::<serde_json::Value>(&s) {
                for k in TRAE_DOTTED_KEYS {
                    if let Some(v) = j.get(k).and_then(|v| v.as_str()) {
                        let v = v.trim().to_ascii_lowercase();
                        if looks_like_identity(&v) {
                            out.push(v);
                        }
                    }
                }
            }
        }
    }
    // 旧 MachineGuid(一键模式的备份文件)
    if let Some(p) = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(|h| PathBuf::from(h).join(".trae-proxy/MachineGuid-backup.txt"))
    {
        if let Ok(s) = std::fs::read_to_string(p) {
            for t in extract_identity_tokens(s.as_bytes()) {
                if looks_like_identity(&t) && !out.contains(&t) {
                    out.push(t);
                }
            }
        }
    }
    // 注册表指纹(厂商容器下的 Info 等)—— 不走 looks_like_identity 过滤
    for t in capture_registry_fingerprints() {
        if !out.contains(&t) {
            out.push(t);
        }
    }
    out.sort();
    out.dedup();
    out
}

/// 追加一条历史到账本。失败**不拦主流程**:账本只影响"能不能验证",不影响"能不能重置"。
/// 只保留最近 20 条,防止无限增长。
fn append_identity_history(values: &[String]) -> Result<(), String> {
    if values.is_empty() {
        return Ok(());
    }
    let p = identity_history_path().ok_or_else(|| "无法确定用户目录".to_string())?;
    let mut entries: Vec<serde_json::Value> = std::fs::read_to_string(&p)
        .ok()
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .and_then(|v| v.get("entries").and_then(|e| e.as_array()).cloned())
        .unwrap_or_default();
    if entries.len() >= 20 {
        let keep = entries.len() - 19;
        entries = entries.split_off(keep);
    }
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    entries.push(serde_json::json!({ "at": at, "values": values }));
    let body = serde_json::json!({ "entries": entries });
    let text = serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?;
    std::fs::write(&p, text).map_err(|e| e.to_string())
}

/// 读回账本里的全部旧身份值 = 审计黑名单。
fn load_identity_blacklist() -> Vec<String> {
    let Some(p) = identity_history_path() else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(p) else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    let mut out: Vec<String> = Vec::new();
    if let Some(entries) = v.get("entries").and_then(|e| e.as_array()) {
        for e in entries {
            if let Some(vals) = e.get("values").and_then(|x| x.as_array()) {
                for x in vals.iter().filter_map(|x| x.as_str()) {
                    let x = x.trim().to_ascii_lowercase();
                    // 注册表指纹记号(`regfp|...`)不走身份形态过滤
                    if x.starts_with("regfp|") || looks_like_identity(&x) {
                        out.push(x);
                    }
                }
            }
        }
    }
    out.sort();
    out.dedup();
    out
}

#[derive(Debug, Clone, Serialize)]
pub struct ResidualHit {
    pub file: String,
    pub count: usize,
    pub sample: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResidualAuditReport {
    pub ok: bool,
    pub message: String,
    /// 黑名单(=账本里记的历次旧身份值)规模。
    pub blacklist_size: usize,
    pub scanned_files: usize,
    pub scanned_mb: f64,
    pub sites_present: usize,
    /// 硬命中:旧身份值仍在本机的处数(0 才算干净)。
    pub hard_hits: usize,
    pub hard_hit_files: Vec<ResidualHit>,
    /// 疑似命中:非身份类长串,仅供研判,不计入 ok 判定。
    pub suspect_hits: usize,
    pub registry: Vec<String>,
    /// 硬件标识(主板 UUID/BIOS 序列号等)——本地改不了,如实披露为边界。
    pub hardware: Vec<String>,
}

/// 递归扫目录收集硬命中。depth 上限 8,与审计脚本同口径。
fn audit_walk(
    dir: &Path,
    blacklist: &std::collections::HashSet<String>,
    hits: &mut Vec<(String, String)>,
    scanned: &mut (usize, u64),
    depth: u8,
) {
    if depth > 8 {
        return;
    }
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let p = e.path();
        let Ok(meta) = std::fs::symlink_metadata(&p) else {
            continue;
        };
        if meta.is_dir() {
            audit_walk(&p, blacklist, hits, scanned, depth + 1);
        } else if meta.is_file() {
            if meta.len() > AUDIT_MAX_FILE_BYTES {
                continue;
            }
            let Ok(buf) = std::fs::read(&p) else {
                continue;
            };
            scanned.0 += 1;
            scanned.1 += meta.len();
            let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
            for t in extract_identity_tokens(&buf) {
                if blacklist.contains(&t) && seen.insert(t.clone()) {
                    hits.push((p.display().to_string(), t));
                }
            }
        }
    }
}

/// 审计扫描区:全部 TRAE 现场(APPDATA 与 LOCALAPPDATA 两侧) + 系统痕迹区
/// (%LOCALAPPDATA%\com.traework.assistant = EBWebView 数据根;%ProgramData%\Trae)。
/// 与 `scripts/audit-trae-residual.mjs` 同口径,两端结论可互相印证。
fn audit_scan_zones() -> Vec<PathBuf> {
    let read_env = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    let mut out: Vec<PathBuf> = trae_dir_candidates(
        read_env("APPDATA").as_deref(),
        read_env("LOCALAPPDATA").as_deref(),
        None,
    )
    .into_iter()
    .filter(|p| p.is_dir())
    .collect();
    for (base_env, extras) in [
        ("LOCALAPPDATA", vec!["com.traework.assistant", "Trae Work CN", "TraeCode CN"]),
        ("ProgramData", vec!["Trae"]),
    ] {
        let Some(base) = read_env(base_env) else { continue };
        for extra in extras {
            let p = PathBuf::from(&base).join(extra);
            if p.is_dir() && !out.contains(&p) {
                out.push(p);
            }
        }
    }
    out
}

/// 现场目录在场数(只数 APPDATA 侧三现场,与报告口径一致)。
fn audit_sites_present() -> usize {
    let read_env = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    trae_dir_candidates(read_env("APPDATA").as_deref(), None, None)
        .iter()
        .filter(|p| p.is_dir())
        .count()
}

/// 跑一段内建脚本并回收输出。带**真超时**(mpsc + recv_timeout):
/// 旧审计脚本正是栽在 powershell 递归枚举整个注册表 hive 上 120s 超时 ETIMEDOUT。
fn run_ps_capture(script: &str, timeout: std::time::Duration) -> Result<Vec<String>, String> {
    let owned = script.to_string();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &owned]);
        // `creation_flags_if_windows` 本身是 #[cfg(windows)] 的 —— 本函数未按平台拆分,
        // 故这行必须自带 cfg 门,否则 Linux/macOS 编译单元里找不到它(E0425)。
        // 2026-10-10 真教训:本地 Windows `cargo test` 全绿,CI 三平台才炸。
        #[cfg(windows)]
        creation_flags_if_windows(&mut cmd, 0x0800_0000);
        let _ = tx.send(cmd.output());
    });
    match rx.recv_timeout(timeout) {
        Ok(Ok(out)) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect()),
        Ok(Ok(out)) => {
            let err = String::from_utf8_lossy(&out.stderr);
            let first = err.lines().next().unwrap_or("").chars().take(80).collect::<String>();
            Err(format!("脚本返回非零: {first}"))
        }
        Ok(Err(e)) => Err(format!("无法启动内建脚本: {e}")),
        // 超时:工作线程被丢弃(脚本进程随宿主退出被系统回收),只降级提示不判红
        Err(_) => Err(format!(
            "脚本执行超过 {}s,已放弃(不影响应用层审计结论)",
            timeout.as_secs()
        )),
    }
}

/// 注册表定点枚举(不递归整个 hive —— 那是旧脚本超时的根因)。
#[cfg(windows)]
fn audit_probe_registry() -> Vec<String> {
    let script = "$ErrorActionPreference='SilentlyContinue'; \
        [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; \
        foreach ($p in @('HKCU:\\Software','HKLM:\\SOFTWARE','HKLM:\\SOFTWARE\\WOW6432Node')) { \
          $m = @(Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match 'trae|bytedance|icube|ahawork' }); \
          if ($m.Count -gt 0) { foreach ($k in $m) { Write-Output ('[REG] ' + $k.Name) } } else { Write-Output ('[REG] ' + $p + ' => (无匹配)') } \
        }; \
        $cls = @(Get-ChildItem 'HKCU:\\Software\\Classes' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^trae' }); \
        Write-Output ('[REG] HKCU:\\Software\\Classes => 命中 ' + $cls.Count + ' 项'); \
        Write-Output ('[REG] MachineGuid=' + (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid)";
    match run_ps_capture(script, std::time::Duration::from_secs(45)) {
        Ok(v) => v,
        Err(e) => vec![format!("[REG] 注册表查询降级: {e}")],
    }
}

#[cfg(not(windows))]
fn audit_probe_registry() -> Vec<String> {
    vec!["[REG] 非 Windows 平台无注册表".to_string()]
}

/// 注册表指纹槽位残留比对:账本里记过的旧指纹值,现在还在注册表里 ⇒ 硬命中。
/// 这条专门盯 `Software\Bytedance\Trae CN\Common\Info` 这类**藏在厂商容器下的
/// 设备指纹**——它是"应用层全翻新了却仍被认出来"的最后一类本地凭据。
#[cfg(windows)]
fn audit_probe_registry_fingerprints(blacklist: &std::collections::HashSet<String>) -> Vec<(String, String)> {
    use windows::Win32::System::Registry::HKEY_CURRENT_USER;
    let mut hits: Vec<(String, String)> = Vec::new();
    for (key, name) in TRAE_REG_FINGERPRINT_SLOTS {
        if let Some(v) = regutil::read_string(HKEY_CURRENT_USER, key, name) {
            if blacklist.contains(&reg_fingerprint_token(key, &v)) {
                hits.push((format!("HKCU\\{key}\\{name}"), v));
            }
        }
    }
    hits
}

#[cfg(not(windows))]
fn audit_probe_registry_fingerprints(_: &std::collections::HashSet<String>) -> Vec<(String, String)> {
    Vec::new()
}

/// 硬件标识清点:主板 UUID/BIOS 序列号/系统序列号/系统盘卷号。
/// 这些**本地改不了**,如实列出来是"边界披露"——不是缺陷,避免用户误以为工具没做到位。
#[cfg(windows)]
fn audit_probe_hardware() -> Vec<String> {
    let script = "$ErrorActionPreference='SilentlyContinue'; \
        [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; \
        Get-CimInstance -ClassName Win32_ComputerSystemProduct | ForEach-Object { 'MB-UUID=' + $_.UUID }; \
        Get-CimInstance -ClassName Win32_BIOS | ForEach-Object { 'BIOS-SN=' + $_.SerialNumber }; \
        Get-CimInstance -ClassName Win32_OperatingSystem | ForEach-Object { 'OS-SN=' + $_.SerialNumber }; \
        Get-Volume -DriveLetter C | ForEach-Object { 'VolC-SN=' + ($_ | Select-Object -ExpandProperty ObjectId) }";
    match run_ps_capture(script, std::time::Duration::from_secs(30)) {
        Ok(v) if !v.is_empty() => v,
        Ok(_) => vec!["(硬件标识查询返回空)".to_string()],
        Err(e) => vec![format!("(硬件标识查询降级: {e})")],
    }
}

#[cfg(not(windows))]
fn audit_probe_hardware() -> Vec<String> {
    vec!["(非 Windows 平台无硬件标识)".to_string()]
}

/// 残留审计主流程(纯同步,可单测;命令层再包一层 spawn_blocking)。
pub fn audit_trae_residual() -> ResidualAuditReport {
    let blacklist: Vec<String> = load_identity_blacklist();
    let zones = audit_scan_zones();
    let sites_present = audit_sites_present();
    if blacklist.is_empty() {
        return ResidualAuditReport {
            ok: true,
            message: "尚无历史身份记录 —— 请先执行一次一键重置,之后本审计即可逐项比对旧值".into(),
            blacklist_size: 0,
            scanned_files: 0,
            scanned_mb: 0.0,
            sites_present,
            hard_hits: 0,
            hard_hit_files: Vec::new(),
            suspect_hits: 0,
            registry: audit_probe_registry(),
            hardware: audit_probe_hardware(),
        };
    }
    let set: std::collections::HashSet<String> = blacklist.iter().cloned().collect();
    let mut hits: Vec<(String, String)> = Vec::new();
    let mut scanned: (usize, u64) = (0, 0);
    for z in &zones {
        audit_walk(z, &set, &mut hits, &mut scanned, 0);
    }
    // 注册表指纹维度(与文件扫描并列,不进 scanned 计数——它不是文件)
    for (slot, val) in audit_probe_registry_fingerprints(&set) {
        hits.push((slot, val));
    }
    // 按文件聚合
    let mut by_file: std::collections::BTreeMap<String, Vec<String>> =
        std::collections::BTreeMap::new();
    for (f, id) in &hits {
        by_file.entry(f.clone()).or_default().push(id.clone());
    }
    let mut hard_hit_files: Vec<ResidualHit> = by_file
        .into_iter()
        .map(|(file, ids)| ResidualHit {
            count: ids.len(),
            sample: ids.into_iter().next().unwrap_or_default(),
            file,
        })
        .collect();
    hard_hit_files.sort_by(|a, b| b.count.cmp(&a.count));
    let hard_hits: usize = hard_hit_files.iter().map(|h| h.count).sum();
    let ok = hard_hits == 0;
    let message = if ok {
        format!(
            "✅ 0 项残留 —— 比对账本里 {} 个历史旧身份值,扫描 {} 个文件,当前全现场均未再出现(应用层身份已彻底翻新)",
            blacklist.len(),
            scanned.0
        )
    } else {
        format!(
            "⚠️ {} 处残留,分布于 {} 个文件 —— 这些文件里仍躺着旧身份值,建议重跑一键重置或手工清理下列路径",
            hard_hits,
            hard_hit_files.len()
        )
    };
    ResidualAuditReport {
        ok,
        message,
        blacklist_size: blacklist.len(),
        scanned_files: scanned.0,
        scanned_mb: scanned.1 as f64 / 1048576.0,
        sites_present,
        hard_hits,
        hard_hit_files,
        suspect_hits: 0,
        registry: audit_probe_registry(),
        hardware: audit_probe_hardware(),
    }
}

// ================== 执行层：9 类快照（对称备份/恢复）==================

#[derive(Debug, Clone, Serialize)]
pub struct BackupReport {
    pub user_id: String,
    /// 已备份的相对路径（TRAE 数据目录坐标）。
    pub copied: Vec<String>,
    /// TRAE 现场不存在而跳过的相对路径。
    pub missing: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RestoreReport {
    pub user_id: String,
    pub restored: Vec<String>,
    pub missing_in_backup: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SnapshotSummary {
    pub user_id: String,
    /// 9 类里**完整存在**的 kind 名。
    pub kinds: Vec<String>,
}

/// 文件级原子拷贝：tmp + rename，不留半份。
fn atomic_copy_file(src: &Path, dst: &Path) -> std::io::Result<()> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let name = dst.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let tmp = dst.with_file_name(format!("{name}.checkin-tmp-{}", std::process::id()));
    std::fs::copy(src, &tmp)?;
    std::fs::rename(&tmp, dst)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let sp = entry.path();
        let dp = dst.join(entry.file_name());
        if sp.is_dir() {
            copy_dir_recursive(&sp, &dp)?;
        } else {
            std::fs::copy(&sp, &dp)?;
        }
    }
    Ok(())
}

/// 把 `src_root` 下相对路径 `rel` 镜像拷到 `dst_root` 同一相对位置。
fn copy_mirrored(src_root: &Path, rel: &str, dst_root: &Path) -> std::io::Result<()> {
    let src = src_root.join(rel);
    let dst = dst_root.join(rel);
    if src.is_dir() {
        copy_dir_recursive(&src, &dst)
    } else {
        atomic_copy_file(&src, &dst)
    }
}

/// 9 类备份：整份建在 `<user_id>.checkin-tmp-<pid>` 临时目录，全部成功后 rename 落地。
pub fn snapshot_backup(
    trae_dir: &Path,
    app_data_dir: &Path,
    user_id: &str,
) -> Result<BackupReport, IpcError> {
    let user_id = sanitize_user_id(user_id).ok_or_else(|| {
        IpcError::permission(format!(
            "非法 user_id: {user_id:?}(只允许 [A-Za-z0-9_-] 且 ≤64 字符)"
        ))
    })?;
    let profile_dir = snapshot_profile_dir(app_data_dir, &user_id);
    let tmp_dir =
        profile_dir.with_file_name(format!("{user_id}.checkin-tmp-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp_dir);
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| IpcError::from_io("create_dir_all", &tmp_dir, e))?;

    let mut copied = Vec::new();
    let mut missing = Vec::new();
    let mut errors = Vec::new();
    for entry in SNAPSHOT_ENTRIES.iter() {
        for rel in entry.paths {
            if trae_dir.join(rel).exists() {
                match copy_mirrored(trae_dir, rel, &tmp_dir) {
                    Ok(()) => copied.push(rel.to_string()),
                    Err(e) => errors.push(format!("{rel}: {e}")),
                }
            } else {
                missing.push(rel.to_string());
            }
        }
    }
    if !errors.is_empty() {
        let _ = std::fs::remove_dir_all(&tmp_dir);
        return Err(IpcError::internal(format!("快照备份失败: {}", errors.join("; "))));
    }
    // 整体原子落地：旧 profile 整换新，不会半新半旧。
    if profile_dir.exists() {
        std::fs::remove_dir_all(&profile_dir)
            .map_err(|e| IpcError::from_io("remove_dir_all", &profile_dir, e))?;
    }
    std::fs::rename(&tmp_dir, &profile_dir)
        .map_err(|e| IpcError::from_io("rename", &profile_dir, e))?;
    log::info!(
        "[checkin-capture] 快照备份 user_id={user_id} copied={} missing={}",
        copied.len(),
        missing.len()
    );
    Ok(BackupReport { user_id, copied, missing })
}

/// 9 类恢复：恢复前删 `code.lock`；先删目标再拷回，旧文件不残留。
pub fn snapshot_restore(
    trae_dir: &Path,
    app_data_dir: &Path,
    user_id: &str,
) -> Result<RestoreReport, IpcError> {
    let user_id = sanitize_user_id(user_id).ok_or_else(|| {
        IpcError::permission(format!(
            "非法 user_id: {user_id:?}(只允许 [A-Za-z0-9_-] 且 ≤64 字符)"
        ))
    })?;
    let profile_dir = snapshot_profile_dir(app_data_dir, &user_id);
    if !profile_dir.is_dir() {
        return Err(IpcError::not_found(format!(
            "没有 user_id={user_id} 的快照: {}",
            profile_dir.display()
        )));
    }
    let code_lock = trae_dir.join("code.lock");
    if code_lock.exists() {
        let _ = std::fs::remove_file(&code_lock);
    }
    let mut restored = Vec::new();
    let mut missing_in_backup = Vec::new();
    for entry in SNAPSHOT_ENTRIES.iter() {
        for rel in entry.paths {
            let src = profile_dir.join(rel);
            if !src.exists() {
                missing_in_backup.push(rel.to_string());
                continue;
            }
            let dst = trae_dir.join(rel);
            if dst.exists() {
                let _ = if dst.is_dir() {
                    std::fs::remove_dir_all(&dst)
                } else {
                    std::fs::remove_file(&dst)
                };
            }
            copy_mirrored(&profile_dir, rel, trae_dir)
                .map_err(|e| IpcError::from_io("restore", &dst, e))?;
            restored.push(rel.to_string());
        }
    }
    log::info!(
        "[checkin-capture] 快照恢复 user_id={user_id} restored={} missing_in_backup={}",
        restored.len(),
        missing_in_backup.len()
    );
    Ok(RestoreReport { user_id, restored, missing_in_backup })
}

/// 列出全部快照：user_id + 9 类里完整存在的 kind。
pub fn snapshot_list(app_data_dir: &Path) -> Vec<SnapshotSummary> {
    let root = snapshot_profiles_root(app_data_dir);
    let Ok(entries) = std::fs::read_dir(&root) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for e in entries.flatten() {
        let dir = e.path();
        if !dir.is_dir() {
            continue;
        }
        let Some(user_id) = dir.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let kinds = SNAPSHOT_ENTRIES
            .iter()
            .filter(|entry| entry.paths.iter().all(|rel| dir.join(rel).exists()))
            .map(|entry| entry.kind.to_string())
            .collect();
        out.push(SnapshotSummary { user_id: user_id.to_string(), kinds });
    }
    out.sort_by(|a, b| a.user_id.cmp(&b.user_id));
    out
}

pub fn snapshot_delete(app_data_dir: &Path, user_id: &str) -> Result<(), IpcError> {
    let user_id = sanitize_user_id(user_id).ok_or_else(|| {
        IpcError::permission(format!(
            "非法 user_id: {user_id:?}(只允许 [A-Za-z0-9_-] 且 ≤64 字符)"
        ))
    })?;
    let dir = snapshot_profile_dir(app_data_dir, &user_id);
    if !dir.is_dir() {
        return Err(IpcError::not_found(format!("没有 user_id={user_id} 的快照")));
    }
    std::fs::remove_dir_all(&dir).map_err(|e| IpcError::from_io("remove_dir_all", &dir, e))
}

// ================== tauri 薄胶水（只转发，不含判定）==================

fn app_data_dir_or_err(app: &tauri::AppHandle) -> Result<PathBuf, IpcError> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .ok()
        .ok_or_else(|| IpcError::internal("app_data_dir unavailable"))
}

fn require_trae_dir() -> Result<PathBuf, IpcError> {
    detect_trae_dir().ok_or_else(|| {
        IpcError::not_found("未检测到 TRAE 数据目录(可设环境变量 IHUI_TRAE_DIR 指定)")
    })
}

#[tauri::command]
pub fn checkin_detect_trae_dir() -> Result<Option<String>, IpcError> {
    Ok(detect_trae_dir().map(|p| p.display().to_string()))
}

#[tauri::command]
pub fn checkin_capture_jwts() -> Result<Vec<CapturedAccount>, IpcError> {
    let dir = require_trae_dir()?;
    Ok(capture_local_jwts(&dir))
}

#[tauri::command(async)]
pub fn checkin_reset_device_ids(
    include_machine_guid: bool,
    clean_browser_cookies: bool,
    deep_reset: bool,
    reset_mac: Option<bool>,
) -> Result<ResetReport, IpcError> {
    let dir = require_trae_dir()?;
    // kill_running 恒 true:用户点重置=授权自动关闭 TRAE(2026-10-09 用户指令「别让用户操作」)
    // reset_mac 向后兼容:已部署生产页不传 ⇒ None ⇒ 默认关(层⑬记 skip)
    Ok(reset_device_ids(
        &dir,
        include_machine_guid,
        clean_browser_cookies,
        deep_reset,
        true,
        reset_mac.unwrap_or(false),
    ))
}

// ================== 一键解决风控(产品级向导,2026-10-10) ==================

/// MachineGuid 改写前的自动备份(一键模式安全网):首次写入
/// `%USERPROFILE%\.trae-proxy\MachineGuid-backup.txt`,已存在则保留最早备份不覆盖。
#[cfg(windows)]
fn ensure_machine_guid_backup() -> Result<String, String> {
    let script = "try { \
        $v=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -ErrorAction Stop).MachineGuid; \
        $d=\"$env:USERPROFILE\\.trae-proxy\"; \
        New-Item -ItemType Directory -Force -Path $d | Out-Null; \
        $p=\"$d\\MachineGuid-backup.txt\"; \
        if (!(Test-Path $p)) { Set-Content -Path $p -Value $v -Encoding ascii }; \
        Write-Output $v; exit 0 } catch { exit 1 }";
    let mut cmd = std::process::Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", script]);
    creation_flags_if_windows(&mut cmd, 0x0800_0000);
    match cmd.output() {
        Ok(out) if out.status.success() => {
            let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if v.is_empty() {
                Err("读取 MachineGuid 返回空".into())
            } else {
                Ok(v)
            }
        }
        Ok(_) => Err("读取 MachineGuid 失败(无权限?)".into()),
        Err(e) => Err(format!("无法启动内建脚本: {e}")),
    }
}

#[cfg(not(windows))]
fn ensure_machine_guid_backup() -> Result<String, String> {
    Err("非 Windows 平台无 MachineGuid".into())
}

/// cip.cc 纯文本响应解析(抽出纯函数便于单测):
/// 返回 (ip, 归属地) —— 形如 "IP\t: 1.2.3.4" / "地址 : 中国 吉林 长春 电信"。
fn parse_public_ip_body(body: &str) -> Option<(String, String)> {
    let mut ip = None;
    let mut location = String::new();
    for line in body.lines() {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("IP").map(str::trim).and_then(|s| s.strip_prefix(':')) {
            let v = v.trim();
            if !v.is_empty() && v.split('.').count() == 4 {
                ip = Some(v.to_string());
            }
        } else if line.starts_with("地址") {
            if let Some(v) = line.split_once(':').map(|(_, v)| v.trim()) {
                if !v.is_empty() {
                    location = v.to_string();
                }
            }
        }
    }
    ip.map(|i| (i, location))
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicIpReport {
    pub ip: String,
    pub location: String,
}

/// 当前直连公网出口 IP(一键向导 Step2 用):显式 no_proxy,拿真实宽带/热点出口,
/// 不被本机代理环境干扰。cip.cc(国内,含归属地) 为主,api.ipify.org 兜底。
#[tauri::command]
pub async fn checkin_get_public_ip() -> Result<PublicIpReport, IpcError> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| IpcError::internal(format!("HTTP 客户端构建失败: {e}")))?;
    // 主: cip.cc(plain text,含中文归属地;UA 给 curl 文本版)
    if let Ok(resp) = client
        .get("https://cip.cc")
        .header("User-Agent", "curl/8.9.1")
        .send()
        .await
    {
        if let Ok(body) = resp.text().await {
            if let Some((ip, location)) = parse_public_ip_body(&body) {
                return Ok(PublicIpReport { ip, location });
            }
        }
    }
    // 兜底: ipify(只有 IP,无归属地;空响应视为失败,防止前端拿到空串后 IP 对比逻辑失效)
    let ip = client
        .get("https://api.ipify.org")
        .send()
        .await
        .map_err(|e| IpcError::internal(format!("公网 IP 查询失败: {e}")))?
        .text()
        .await
        .map_err(|e| IpcError::internal(format!("公网 IP 响应读取失败: {e}")))?;
    let ip = ip.trim().to_string();
    if ip.is_empty() || ip.split('.').count() != 4 {
        return Err(IpcError::internal(format!(
            "公网 IP 响应异常: {ip:?}"
        )));
    }
    Ok(PublicIpReport {
        ip,
        location: String::new(),
    })
}

/// 一键解决风控(傻瓜式):全 14 层全开 —— 杀进程+机器码+MachineGuid(先自动备份)
/// +浏览器 Cookie+深度删面(23目录5文件+traereset_bak 清扫)+注册表+本地缓存+MAC 改写。
/// 可选层(⑤⑦⑬)环境不允许时降级记录不拦流程;报告由前端向导照实展示。
/// 硬安全网:MachineGuid 旧值备份失败 ⇒ 层⑤【真跳过】(include_machine_guid=false),
/// 决不允许无备份的不可逆改写(2026-10-10 审查修正:旧实现事后改报告是假安全网)。
#[tauri::command(async)]
pub fn checkin_one_click_reset() -> Result<ResetReport, IpcError> {
    let dir = require_trae_dir()?;
    let guid_backup = ensure_machine_guid_backup();
    let include_guid = guid_backup.is_ok();
    let mut report = reset_device_ids(&dir, include_guid, true, true, true, true);
    if let Err(e) = guid_backup {
        if let Some(l5) = report.layers.iter_mut().find(|l| l.layer == 5) {
            l5.ok = false;
            l5.detail = format!("已跳过(旧值备份失败,防止不可逆): {e}");
        }
    }
    Ok(report)
}

/// 残留指纹审计(一键向导 Step1 之后自动跑一次,也可随时手点)。
/// 拿"历次重置前记录的旧身份值"当黑名单,扫当前全部 TRAE 现场,给出**可复核的残留条数**。
/// 走 spawn_blocking:扫描是重 I/O,直接跑在异步运行时线程上会把 UI 卡住。
#[tauri::command(async)]
pub async fn checkin_audit_trae_residual() -> Result<ResidualAuditReport, IpcError> {
    tauri::async_runtime::spawn_blocking(audit_trae_residual)
        .await
        .map_err(|e| IpcError::internal(format!("审计任务异常退出: {e}")))
}

#[tauri::command]
pub fn checkin_snapshot_backup(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<BackupReport, IpcError> {
    let trae = require_trae_dir()?;
    let data_dir = app_data_dir_or_err(&app)?;
    snapshot_backup(&trae, &data_dir, &user_id)
}

#[tauri::command]
pub fn checkin_snapshot_restore(
    app: tauri::AppHandle,
    user_id: String,
) -> Result<RestoreReport, IpcError> {
    let trae = require_trae_dir()?;
    let data_dir = app_data_dir_or_err(&app)?;
    snapshot_restore(&trae, &data_dir, &user_id)
}

#[tauri::command]
pub fn checkin_snapshot_list(app: tauri::AppHandle) -> Result<Vec<SnapshotSummary>, IpcError> {
    let data_dir = app_data_dir_or_err(&app)?;
    Ok(snapshot_list(&data_dir))
}

#[tauri::command]
pub fn checkin_snapshot_delete(app: tauri::AppHandle, user_id: String) -> Result<(), IpcError> {
    let data_dir = app_data_dir_or_err(&app)?;
    snapshot_delete(&data_dir, &user_id)
}

// ================== 单测（判据区 + 可落盘的执行层）==================

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("ihui-checkin-{}-{tag}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    fn make_jwt(payload_json: &str) -> String {
        let enc = |s: &str| URL_SAFE_NO_PAD.encode(s);
        format!("{}.{}.sig", enc(r#"{"alg":"HS256"}"#), enc(payload_json))
    }

    // ── 1. TRAE 目录探测 ──

    #[test]
    fn trae_dir_candidates_override_first_then_appdata_then_localappdata() {
        let cands = trae_dir_candidates(Some(r"C:\AD"), Some(r"C:\LAD"), Some(r"D:\override"));
        assert_eq!(cands[0], PathBuf::from(r"D:\override"));
        assert_eq!(cands[1], PathBuf::from(r"C:\AD\TRAE SOLO CN"));
        assert_eq!(cands[2], PathBuf::from(r"C:\AD\TRAE"));
        assert_eq!(cands[3], PathBuf::from(r"C:\AD\Trae CN"));
        // C:\AD\Trae 与 C:\AD\TRAE 大小写不敏感同目录 ⇒ 被去重,只留先出现的 TRAE
        assert_eq!(cands[4], PathBuf::from(r"C:\LAD\TRAE SOLO CN"));
        assert_eq!(cands[5], PathBuf::from(r"C:\LAD\TRAE"));
        assert_eq!(cands[6], PathBuf::from(r"C:\LAD\Trae CN"));
        assert_eq!(cands.len(), 7);
    }

    #[test]
    fn trae_dir_candidates_dedup_case_insensitive_same_dir() {
        // Windows 大小写不敏感:TRAE 与 Trae 同目录,同侧只留先出现的
        let cands = trae_dir_candidates(Some(r"C:\AD"), None, None);
        let lowers: Vec<String> =
            cands.iter().map(|p| p.to_string_lossy().to_ascii_lowercase()).collect();
        let mut uniq = lowers.clone();
        uniq.sort();
        uniq.dedup();
        assert_eq!(lowers.len(), uniq.len(), "候选不得有大小写变体重: {cands:?}");
    }

    #[test]
    fn looks_like_trae_dir_requires_marker_file() {
        let dir = scratch("marker");
        assert!(!looks_like_trae_dir(&dir), "空目录不算");
        std::fs::write(dir.join("storage.json"), "{}").unwrap();
        assert!(looks_like_trae_dir(&dir));
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── 2. JWT 形态/校验/提取/去重 ──

    #[test]
    fn jwt_shape_accepts_three_base64url_segments_only() {
        assert!(is_jwt_shape("abc.eyJ4.sig"));
        assert!(!is_jwt_shape("abc.ey J4.sig"), "空格不是 base64url");
        assert!(!is_jwt_shape("abc.sig"), "两段不算");
        assert!(!is_jwt_shape("a.b.c.d"), "四段不算");
        assert!(!is_jwt_shape("abc..sig"), "空段不算");
        assert!(!is_jwt_shape("ab+c.eyJ4.sig"), "标准 base64 的 + 不在 url 字母表");
    }

    #[test]
    fn jwt_user_id_reads_data_dot_id() {
        let t = make_jwt(r#"{"data":{"id":"123456"},"exp":1}"#);
        assert_eq!(jwt_payload_user_id(&t).as_deref(), Some("123456"));
    }

    #[test]
    fn jwt_user_id_rejects_non_numeric_and_missing() {
        assert_eq!(jwt_payload_user_id(&make_jwt(r#"{"data":{"id":"abc"}}"#)), None);
        assert_eq!(jwt_payload_user_id(&make_jwt(r#"{"data":{}}"#)), None);
        assert_eq!(jwt_payload_user_id(&make_jwt(r#"{"user":"123"}"#)), None);
        assert_eq!(jwt_payload_user_id("not-a-jwt"), None);
    }

    #[test]
    fn extract_jwt_strings_finds_token_in_noise() {
        let jwt = make_jwt(r#"{"data":{"id":"42"}}"#);
        // 右侧噪声必须用非 token 字节(! 不在 [A-Za-z0-9-_.] 内):token 字节会黏进第三段
        // 连成一个更长的"JWT",提取行为本身是对的(真实 cookie 里 JWT 后是 ; 或引号)
        let noise = format!("xx\x00\u{FF}|{jwt}!yy");
        assert_eq!(extract_jwt_strings(noise.as_bytes()), vec![jwt]);
    }

    #[test]
    fn extract_jwt_strings_ignores_non_jwt_eyJ_fragments() {
        // eyJ 开头但不成三段的不许被收
        assert!(extract_jwt_strings(b"eyJhbGciOiJIUzI1NiJ9only").is_empty());
    }

    #[test]
    fn dedup_keeps_first_per_user_id() {
        let acc = |uid: &str, src: &str| CapturedAccount {
            user_id: uid.into(),
            jwt: "t".into(),
            source: src.into(),
        };
        let out =
            dedup_by_user_id(vec![acc("1", "cookies:a"), acc("1", "leveldb:x"), acc("2", "leveldb:y")]);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].source, "cookies:a", "同 user 保留先到的(探测顺序=可信度)");
        assert_eq!(out[1].user_id, "2");
    }

    // ── 3. v10 blob / AES-256-GCM ──

    #[test]
    fn v10_blob_roundtrip_via_aes_gcm() {
        use aes_gcm::aead::{Aead, KeyInit};
        use aes_gcm::{Aes256Gcm, Nonce};
        let key = [7u8; 32];
        let nonce = [9u8; 12];
        let plain = b"eyJhbGciOi.payload.sig";
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        // aes-gcm 0.10 的 encrypt 收 `impl Into<Payload>`:定长数组引用 &[u8;N] 没有实现,
        // 必须 as_slice() 降为 &[u8](cargo check 不编译 test target,此错此前被掩盖)
        let ct = cipher.encrypt(Nonce::from_slice(&nonce), plain.as_slice()).unwrap();
        let mut blob = Vec::new();
        blob.extend_from_slice(b"v10");
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&ct);
        let (n2, c2) = split_v10_blob(&blob).expect("v10 blob 应可拆");
        assert_eq!(aes256gcm_decrypt(&key, n2, c2).unwrap(), plain);
        // 负向：前缀不是 v10 / tag 被篡改
        assert!(split_v10_blob(&blob[1..]).is_none());
        let mut tampered = blob.clone();
        let last = tampered.len() - 1;
        tampered[last] ^= 0xFF;
        let (_, ct_bad) = split_v10_blob(&tampered).unwrap();
        assert!(aes256gcm_decrypt(&key, n2, ct_bad).is_none(), "tag 改动必须解密失败");
    }

    #[test]
    fn split_v10_blob_rejects_app_bound_v20_and_short_blobs() {
        assert!(split_v10_blob(b"v20xxxxxx").is_none());
        assert!(split_v10_blob(b"v10short").is_none());
    }

    // ── 4. storage.json 点号键名 ──

    #[test]
    fn storage_json_dotted_keys_are_top_level_not_nested() {
        let text = r#"{"telemetry.machineId":"old-mid","telemetry.sqmId":"old-sqm","telemetry.devDeviceId":"old-devdev","aha.device.device_id":"old-dev","has_device_id_updated_to_aha":true,"keep":"me"}"#;
        let (out, changes) =
            rewrite_storage_json_device_ids(text, "new-mid", "new-sqm", "new-dev").unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["telemetry.machineId"], "new-mid");
        assert_eq!(v["telemetry.sqmId"], "new-sqm");
        assert_eq!(v["aha.device.device_id"], "new-dev");
        // devDeviceId 实证补键:重置后不得再留旧设备 ID(2026-10-10 审计抓出的漏网)
        assert_eq!(v["telemetry.devDeviceId"], "new-dev");
        assert!(v.get("telemetry").is_none(), "点号键是字面键,不得长成嵌套对象");
        assert!(v.get("has_device_id_updated_to_aha").is_none(), "标志键必须删掉");
        assert_eq!(v["keep"], "me", "无关键不得动");
        assert_eq!(changes.len(), 5, "四个 set + 一个 removed");
        // 清单与新键必须始终对齐(防改清单忘改实现)
        assert!(
            TRAE_DOTTED_KEYS.contains(&"telemetry.devDeviceId"),
            "devDeviceId 必须在改写清单内"
        );
    }

    #[test]
    fn storage_json_rewrite_rejects_garbage() {
        assert!(rewrite_storage_json_device_ids("{ not json", "a", "b", "c").is_err());
    }

    #[test]
    fn reset_storage_json_layer_round_trips_through_disk() {
        let dir = scratch("storage-json");
        let path = dir.join("User/globalStorage/storage.json");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, r#"{"telemetry.machineId":"old"}"#).unwrap();
        let (r2, r3) = reset_layer_storage_json(std::slice::from_ref(&dir));
        assert!(r2.ok && r3.ok, "r2={} r3={}", r2.detail, r3.detail);
        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        let mid = v["telemetry.machineId"].as_str().unwrap();
        assert_eq!(mid.len(), 32, "machineId 必须 32 位随机 hex");
        assert_ne!(mid, "old");
        assert!(v.get("has_device_id_updated_to_aha").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── 5. 随机值 / user_id 消毒 ──

    #[test]
    fn random_hex_is_hex_of_requested_length() {
        for len in [1usize, 32, 64] {
            let s = random_hex(len);
            assert_eq!(s.len(), len);
            assert!(s.bytes().all(|b| b.is_ascii_hexdigit()));
        }
        assert_ne!(random_hex(32), random_hex(32), "两次调用不该撞车");
    }

    #[test]
    fn guid_like_has_five_dash_groups() {
        let parts: Vec<usize> = random_guid_like().split('-').map(|p| p.len()).collect();
        assert_eq!(parts, vec![8, 4, 4, 4, 12]);
    }

    #[test]
    fn fresh_device_values_are_all_fresh() {
        let (m, s, d) = fresh_device_values();
        assert_eq!(m.len(), 32);
        assert!(s.contains('-'));
        assert!(d.contains('-'));
    }

    #[test]
    fn sanitize_user_id_blocks_traversal_and_separators() {
        assert_eq!(sanitize_user_id("12345").as_deref(), Some("12345"));
        assert_eq!(sanitize_user_id("a_b-c").as_deref(), Some("a_b-c"));
        assert!(sanitize_user_id("../etc").is_none());
        assert!(sanitize_user_id("a/b").is_none());
        assert!(sanitize_user_id("a\\b").is_none());
        assert!(sanitize_user_id("").is_none());
        assert!(sanitize_user_id(&"x".repeat(65)).is_none());
    }

    // ── 6. 快照 9 类常量 + 路径拼装 ──

    #[test]
    fn snapshot_entries_are_nine_kinds_with_unique_names() {
        assert_eq!(SNAPSHOT_ENTRIES.len(), 9);
        let mut kinds: Vec<_> = SNAPSHOT_ENTRIES.iter().map(|e| e.kind).collect();
        kinds.sort_unstable();
        kinds.dedup();
        assert_eq!(kinds.len(), 9, "kind 名不得重复");
        for e in SNAPSHOT_ENTRIES.iter() {
            assert!(!e.paths.is_empty(), "kind {} 至少要有一条路径", e.kind);
        }
    }

    #[test]
    fn snapshot_profile_dir_is_app_data_over_checkin_profiles_over_user() {
        assert_eq!(
            snapshot_profile_dir(Path::new("/data"), "42"),
            PathBuf::from("/data/checkin_profiles/42")
        );
    }

    // ── 7. 重置层④⑥（临时目录 fixture）──

    #[test]
    fn reset_tiny_storage_removes_only_files_containing_device_id() {
        let dir = scratch("tiny");
        let ts = dir.join("aha/TinyStorage");
        std::fs::create_dir_all(&ts).unwrap();
        std::fs::write(ts.join("hit.bin"), br#"prefix {"device_id":"x"} suffix"#).unwrap();
        std::fs::write(ts.join("keep.json"), br#"{"other":1}"#).unwrap();
        std::fs::create_dir_all(ts.join("nested")).unwrap();
        std::fs::write(ts.join("nested/hit2.txt"), b"device_id here").unwrap();
        let r = reset_layer_tiny_storage(std::slice::from_ref(&dir));
        assert!(r.ok, "{}", r.detail);
        assert!(!ts.join("hit.bin").exists());
        assert!(!ts.join("nested/hit2.txt").exists(), "递归要下到子目录");
        assert!(ts.join("keep.json").exists(), "不含 device_id 的文件必须保留");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reset_partitions_layer_removes_the_three_session_dirs_only() {
        let dir = scratch("partitions");
        let base = dir.join("Partitions/trae-webview");
        std::fs::create_dir_all(base.join("Network")).unwrap();
        std::fs::create_dir_all(base.join("Local Storage/leveldb")).unwrap();
        std::fs::create_dir_all(base.join("Session Storage")).unwrap();
        std::fs::create_dir_all(base.join("Cache")).unwrap();
        let r = reset_layer_partitions(std::slice::from_ref(&dir));
        assert!(r.ok, "{}", r.detail);
        assert!(!base.join("Network").exists());
        assert!(!base.join("Local Storage").exists());
        assert!(!base.join("Session Storage").exists());
        assert!(base.join("Cache").exists(), "三目录之外的不得误删");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── 8. 快照备份/恢复/清单/删除（临时目录 roundtrip）──

    #[test]
    fn snapshot_backup_restore_roundtrip() {
        let trae = scratch("trae-roundtrip");
        let app = scratch("app-roundtrip");
        std::fs::create_dir_all(trae.join("User/globalStorage")).unwrap();
        std::fs::write(trae.join("User/globalStorage/storage.json"), br#"{"a":1}"#).unwrap();
        std::fs::write(trae.join("machineid"), "old-machine").unwrap();
        std::fs::create_dir_all(trae.join("aha/TinyStorage")).unwrap();
        std::fs::write(trae.join("aha/TinyStorage/t.bin"), b"device_id").unwrap();

        let report = snapshot_backup(&trae, &app, "42").expect("backup");
        assert!(report.copied.contains(&"machineid".to_string()));
        let profile = snapshot_profile_dir(&app, "42");
        assert!(profile.join("machineid").is_file());

        // 改坏现场 + 留 code.lock，再恢复
        std::fs::write(trae.join("machineid"), "broken").unwrap();
        std::fs::write(trae.join("code.lock"), b"lock").unwrap();
        let restored = snapshot_restore(&trae, &app, "42").expect("restore");
        assert!(restored.restored.contains(&"machineid".to_string()));
        assert_eq!(std::fs::read_to_string(trae.join("machineid")).unwrap(), "old-machine");
        assert!(!trae.join("code.lock").exists(), "恢复前必须删 code.lock");

        let list = snapshot_list(&app);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].user_id, "42");
        assert!(list[0].kinds.contains(&"machineid".to_string()));

        assert!(snapshot_delete(&app, "42").is_ok());
        assert!(!profile.exists());
        assert!(snapshot_delete(&app, "42").is_err(), "删两次第二次必须 not_found");
        let _ = std::fs::remove_dir_all(&trae);
        let _ = std::fs::remove_dir_all(&app);
    }

    #[test]
    fn snapshot_backup_rejects_bad_user_id() {
        let trae = scratch("trae-badid");
        let app = scratch("app-badid");
        assert!(snapshot_backup(&trae, &app, "../evil").is_err());
        assert!(snapshot_restore(&trae, &app, "../evil").is_err());
        assert!(snapshot_delete(&app, "../evil").is_err());
        let _ = std::fs::remove_dir_all(&trae);
        let _ = std::fs::remove_dir_all(&app);
    }

    #[test]
    fn snapshot_restore_without_profile_is_not_found() {
        let trae = scratch("trae-noprofile");
        let app = scratch("app-noprofile");
        let err = snapshot_restore(&trae, &app, "777").unwrap_err();
        assert_eq!(err.code.as_str(), "not_found");
        let _ = std::fs::remove_dir_all(&trae);
        let _ = std::fs::remove_dir_all(&app);
    }

    // ── 9. 全 14 层重置编排（⑤⑦⑧⑨⑩⑫⑬均 flag=false 走 skip 记录,不碰真库/真浏览器/真网卡）──

    #[test]
    fn reset_device_ids_reports_fourteen_layers_and_skips_flagged_layers() {
        let dir = scratch("reset-all");
        std::fs::create_dir_all(dir.join("User/globalStorage")).unwrap();
        std::fs::write(dir.join("machineid"), "old").unwrap();
        std::fs::write(dir.join("User/globalStorage/storage.json"), r#"{}"#).unwrap();
        let report = reset_device_ids(&dir, false, false, false, false, false);
        let layers: Vec<u8> = report.layers.iter().map(|l| l.layer).collect();
        assert_eq!(layers, vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        for expect_skip in [0u8, 5, 7, 8, 9, 10, 11, 12, 13] {
            let l = report.layers.iter().find(|l| l.layer == expect_skip).unwrap();
            assert!(
                l.ok && l.detail.contains("skipped"),
                "层{expect_skip} flag=false 必须显式记 skip: {report:?}"
            );
        }
        assert!(report.layers.iter().filter(|l| l.layer != 5).all(|l| l.ok),
            "1/2/3/4/6 层在可写的临时目录里必须全 ok: {report:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── 9b. 深度重置三层（隔离临时目录,验证"现场整清=等效重装"的删面与保留面）──

    #[test]
    fn deep_reset_layers_clear_entire_site_data_vscdb_and_logs() {
        let dir = scratch("deep-reset");
        // 造"重装前的完整现场":快照 9 类里除 storage.json 外全部 + logs
        for rel in DEEP_RESET_DIRS {
            let p = dir.join(rel);
            std::fs::create_dir_all(p.join("inner")).unwrap();
            std::fs::write(p.join("inner/data"), "stale").unwrap();
        }
        for rel in DEEP_RESET_FILES {
            std::fs::write(dir.join(rel), "{}").unwrap();
        }
        let vscdb = dir.join("User/globalStorage/state.vscdb");
        std::fs::create_dir_all(vscdb.parent().unwrap()).unwrap();
        std::fs::write(&vscdb, "fake-sqlite").unwrap();
        std::fs::write(dir.join("User/globalStorage/state.vscdb-wal"), "w").unwrap();
        std::fs::create_dir_all(dir.join("logs")).unwrap();
        std::fs::write(dir.join("logs/x.log"), "machine=abc").unwrap();
        // storage.json 必须幸存(L2/L3 要改写设备键,骨架不能删)
        std::fs::create_dir_all(dir.join("User/globalStorage")).unwrap();
        std::fs::write(dir.join("User/globalStorage/storage.json"), r#"{"keep":1}"#).unwrap();

        let r8 = reset_layer_deep_site_data(&[dir.clone()]);
        assert!(r8.ok, "{r8:?}");
        for rel in DEEP_RESET_DIRS {
            assert!(!dir.join(rel).exists(), "深度档必须整删 {rel}");
        }
        for rel in DEEP_RESET_FILES {
            assert!(!dir.join(rel).exists(), "深度档必须整删 {rel}");
        }
        assert!(dir.join("User/globalStorage/storage.json").exists(), "storage.json 骨架必须保留");

        let r9 = reset_layer_state_vscdb_multi(&[dir.clone()]);
        assert!(r9.ok, "{r9:?}");
        assert!(!vscdb.exists(), "state.vscdb 必须整删(等效重装:键前缀枚举不可穷尽)");
        assert!(
            !dir.join("User/globalStorage/state.vscdb-wal").exists(),
            "伴生 -wal 必须一并删"
        );

        let r10 = reset_layer_logs_cache_multi(&[dir.clone()]);
        assert!(r10.ok && r10.detail.contains("logs"), "{r10:?}");
        assert!(!dir.join("logs").exists());

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 2026-10-10 真机实证钉住:DEEP_RESET_DIRS 里的条目可能以**文件**形态残留
    /// (真机 SharedStorage=4096 字节文件,旧版本安装残留),只认 is_dir() 会静默漏删。
    #[test]
    fn deep_reset_deletes_dirs_list_entries_in_file_form() {
        let dir = scratch("deep-fileform");
        // 取清单里两个真名,分别造文件形态与悬空符号链接形态
        let file_rel = DEEP_RESET_DIRS[0];
        std::fs::write(dir.join(file_rel), b"stale-file-form").unwrap();
        let link_rel = DEEP_RESET_DIRS[1];
        #[cfg(windows)]
        {
            let target = dir.join("link-target.txt");
            std::fs::write(&target, b"x").unwrap();
            let _ = std::os::windows::fs::symlink_file(&target, dir.join(link_rel));
        }
        let r = reset_layer_deep_site_data(&[dir.clone()]);
        assert!(r.ok && !r.detail.contains("错误"), "{r:?}");
        assert!(
            !dir.join(file_rel).exists(),
            "文件形态的 {file_rel} 必须被整删(真机实证漏删点)"
        );
        assert!(!dir.join(link_rel).exists(), "链接形态的 {link_rel} 必须被摘除");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 一键向导 Step2 的公网 IP 解析判据(cip.cc 纯文本形态)
    #[test]
    fn parse_public_ip_body_extracts_ip_and_location() {
        let body = "IP\t: 36.104.209.21\n地址\t: 中国 吉林 长春 电信\n运营商\t: 电信\n\n数据二: ...";
        let (ip, loc) = parse_public_ip_body(body).expect("应解析成功");
        assert_eq!(ip, "36.104.209.21");
        assert!(loc.contains("长春"), "归属地应含城市: {loc}");
        assert!(parse_public_ip_body("no ip here").is_none(), "无 IP 行应返回 None");
        assert!(
            parse_public_ip_body("IP\t: not-an-ip\n地址\t: x").is_none(),
            "非法 IP 不得误报"
        );
    }

    // ── 10. 层⑦浏览器 Cookie 清理（隔离临时库,只验域限定判据）──

    #[test]
    fn delete_trae_cookies_removes_only_trae_hosts() {
        let dir = scratch("browser-cookies");
        let db = dir.join("Cookies");
        let conn = rusqlite::Connection::open(&db).unwrap();
        conn.execute_batch(
            "CREATE TABLE cookies (host_key TEXT NOT NULL, encrypted_value BLOB);
             INSERT INTO cookies (host_key, encrypted_value) VALUES
               ('.trae.cn', x'00'), ('api.trae.cn', x'00'), ('.trae.com', x'00'),
               ('.example.com', x'00'), ('github.com', x'00');",
        )
        .unwrap();
        drop(conn);

        let n = delete_trae_cookies(&db).unwrap();
        assert_eq!(n, 3, "只删 trae.cn/trae.com 域的三行");
        let conn = rusqlite::Connection::open(&db).unwrap();
        let left: usize = conn
            .query_row("SELECT count(*) FROM cookies", [], |r| r.get(0))
            .unwrap();
        assert_eq!(left, 2, "非 TRAE 域 cookie 必须原样保留");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn browser_layer_reports_ok_when_no_browsers_found_in_sandbox() {
        // 候选发现依赖 LOCALAPPDATA,本测试只验「无库时显式 ok + 说明」分支的形状;
        // 若测试机上真装了 Chrome/Edge,该函数会真删 TRAE 域 cookie —— 因此编排层单测
        // 恒传 clean_browser_cookies=false(见 reset_device_ids_reports_seven_layers…),
        // 本用例仅在「候选为空」时才安全,否则跳过断言只验证不 panic。
        if browser_cookie_db_candidates().is_empty() {
            let r = reset_layer_browser_cookies();
            assert!(r.ok && r.detail.contains("未发现"));
        }
    }

    // ── 9c. 仿真实测(#[ignore]:只显式跑)──────────────────────────────
    // 造完整 TRAE 仿真现场(APPDATA/LOCALAPPDATA/TEMP/注册表/仿真进程),
    // 真跑 13 层重置,三面断言:文件全灭 / 注册表整树删除 / 仿真进程被杀。
    // 安全护栏:本机存在真实 TRAE 现场或真实 TRAE 进程时直接 panic 拒跑,防误伤。

    #[cfg(windows)]
    #[test]
    #[ignore]
    fn traesim_full_reset_kills_process_and_wipes_everything() {
        use std::os::windows::process::CommandExt;
        const HIDDEN: u32 = 0x0800_0000; // CREATE_NO_WINDOW

        // 场景根:默认真机 APPDATA/LOCALAPPDATA/TEMP;设 IHUI_SIM_ROOT 后三根全部
        // 落到 <root>/{appdata,localappdata,temp} 下——任何机器都能跑仿真,不再被
        // 「本机有真现场」护栏误拦(真现场护栏仍按真实 env 执行,见下)。
        let sim_root = std::env::var("IHUI_SIM_ROOT").ok().filter(|v| !v.is_empty());
        let (appdata, localappdata, temp) = match &sim_root {
            Some(root) => {
                let r = PathBuf::from(root);
                (r.join("appdata"), r.join("localappdata"), r.join("temp"))
            }
            None => (
                PathBuf::from(std::env::var("APPDATA").expect("APPDATA")),
                PathBuf::from(std::env::var("LOCALAPPDATA").expect("LOCALAPPDATA")),
                PathBuf::from(std::env::var("TEMP").expect("TEMP")),
            ),
        };

        // 护栏①(真):真实 env 下的 TRAE 数据目录存在 → 拒跑。设 IHUI_SIM_ROOT 也不豁免
        // (深度层⑫会动真实 LOCALAPPDATA/TEMP,仿真根豁免会误伤真现场)。
        let real_appdata = std::env::var("APPDATA").ok();
        let real_localappdata = std::env::var("LOCALAPPDATA").ok();
        for cand in trae_dir_candidates(real_appdata.as_deref(), real_localappdata.as_deref(), None) {
            assert!(
                !looks_like_trae_dir(&cand),
                "本机存在真实 TRAE 现场 {:?},仿真测试拒绝执行(防误伤)",
                cand
            );
        }
        // 护栏①(仿):仿真根下的历史残现场(上次跑挂没清干净)→ 先清掉再跑
        if sim_root.is_some() {
            for cand in trae_dir_candidates(
                Some(appdata.to_str().unwrap()),
                Some(localappdata.to_str().unwrap()),
                None,
            ) {
                if looks_like_trae_dir(&cand) {
                    let _ = std::fs::remove_dir_all(&cand);
                }
            }
        }
        // 护栏②:真实 TRAE 进程在跑 → 拒跑
        let tasklist = std::process::Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .creation_flags(HIDDEN)
            .output()
            .expect("tasklist");
        let tl = String::from_utf8_lossy(&tasklist.stdout).to_ascii_lowercase();
        for real in ["trae.exe", "trae solo cn.exe", "trae solo.exe"] {
            assert!(!tl.contains(real), "检测到真实 TRAE 进程 {real},仿真测试拒绝执行");
        }

        // ---- 造现场 ----
        let sim_a = appdata.join("TRAE"); // 主版本现场(作为传入 dir)
        let sim_b = localappdata.join("TRAE SOLO CN"); // 双版本第二现场
        let sim_c = localappdata.join("TRAE"); // LOCALAPPDATA 侧缓存现场
        let sim_temp = temp.join("TRAE-sim-cache");
        for d in [&sim_a, &sim_b, &sim_c, &sim_temp] {
            std::fs::create_dir_all(d).unwrap();
        }
        // 9 类现场全集(主现场)
        std::fs::write(sim_a.join("machineid"), "sim-old-machine-id-aaaa").unwrap();
        std::fs::create_dir_all(sim_a.join("User/globalStorage")).unwrap();
        std::fs::write(
            sim_a.join("User/globalStorage/storage.json"),
            r#"{"telemetry.machineId":"sim-old","telemetry.sqmId":"sqm-old","windowState":"{}"}"#,
        )
        .unwrap();
        std::fs::create_dir_all(sim_a.join("User/globalStorage/aha")).unwrap();
        std::fs::write(sim_a.join("User/globalStorage/state.vscdb"), "sim-sqlite-bytes").unwrap();
        std::fs::write(sim_a.join("User/globalStorage/state.vscdb-wal"), "w").unwrap();
        std::fs::write(sim_a.join("User/globalStorage/state.vscdb-shm"), "s").unwrap();
        std::fs::create_dir_all(sim_a.join("Local Storage/leveldb")).unwrap();
        std::fs::write(sim_a.join("Local Storage/leveldb/000003.log"), "sim-leveldb").unwrap();
        std::fs::create_dir_all(sim_a.join("Session Storage")).unwrap();
        std::fs::create_dir_all(sim_a.join("Network")).unwrap();
        std::fs::write(sim_a.join("Network/Cookies"), "sim-cookies-db").unwrap();
        std::fs::create_dir_all(sim_a.join("IndexedDB/file__0.indexeddb.leveldb")).unwrap();
        std::fs::create_dir_all(sim_a.join("aha")).unwrap();
        std::fs::create_dir_all(sim_a.join("logs")).unwrap();
        std::fs::write(sim_a.join("logs/main.log"), "sim-log").unwrap();
        std::fs::create_dir_all(sim_a.join("Cache/Cache_Data")).unwrap();
        std::fs::create_dir_all(sim_a.join("Crashpad/reports")).unwrap();
        std::fs::create_dir_all(sim_a.join("Partitions/icube-webview/Network")).unwrap();
        std::fs::write(sim_a.join("Partitions/icube-webview/Network/Cookies"), "sim-pc").unwrap();
        std::fs::write(sim_a.join("Preferences"), "{}").unwrap();
        std::fs::write(sim_a.join("Local State"), "{}").unwrap();
        // 第二现场(双版本必漏教训)
        std::fs::write(sim_b.join("machineid"), "sim-b-machine").unwrap();
        std::fs::write(sim_b.join("storage.json"), r#"{"telemetry.machineId":"b"}"#).unwrap();
        std::fs::create_dir_all(sim_b.join("User/globalStorage")).unwrap();
        std::fs::write(sim_b.join("User/globalStorage/state.vscdb"), "b-db").unwrap();
        std::fs::create_dir_all(sim_b.join("Local Storage")).unwrap();
        // LOCALAPPDATA / TEMP 侧
        std::fs::write(sim_c.join("cache.bin"), "c").unwrap();
        std::fs::write(sim_temp.join("dump.txt"), "t").unwrap();

        // 注册表现场(只在没有真键时才造,测完整树删除)
        let reg_preexisting = std::process::Command::new("reg")
            .args(["query", r"HKCU\Software\TRAE"])
            .creation_flags(HIDDEN)
            .output()
            .unwrap()
            .status
            .success();
        if !reg_preexisting {
            for sub in [r"HKCU\Software\TRAE", r"HKCU\Software\TRAE SOLO CN"] {
                std::process::Command::new("reg")
                    .args(["add", sub, "/v", "SimMachineId", "/d", "sim-old", "/f"])
                    .creation_flags(HIDDEN)
                    .output()
                    .unwrap();
            }
        }

        // 仿真进程:cmd 副本改名 Trae-sim-test.exe,ping 挂起 40s
        let sim_exe = temp.join("Trae-sim-test.exe");
        std::fs::copy(r"C:\Windows\System32\cmd.exe", &sim_exe).unwrap();
        let mut child = std::process::Command::new(&sim_exe)
            .args(["/c", "ping", "-n", "40", "127.0.0.1"])
            .creation_flags(HIDDEN)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .expect("spawn sim process");
        std::thread::sleep(std::time::Duration::from_millis(800));
        assert!(child.try_wait().unwrap().is_none(), "仿真进程应存活");

        // ---- 真跑 14 层(guid/browser/mac 三 flag=false:避开 UAC、真浏览器库与真网卡)----
        let report = reset_device_ids(&sim_a, false, false, true, true, false);
        assert_eq!(report.layers.len(), 14, "层报告数应为 14: {report:?}");
        for l in &report.layers {
            assert!(l.ok, "层{}({}) 必须 ok: {}", l.layer, l.name, l.detail);
        }
        let l0 = &report.layers[0];
        assert!(
            l0.detail.contains("已强杀") && l0.detail.contains("Trae-sim-test.exe"),
            "层0 应杀掉仿真进程: {}",
            l0.detail
        );

        // ---- 面1:文件现场 ----
        assert!(!sim_a.join("User/globalStorage/state.vscdb").exists(), "state.vscdb 必须整删");
        assert!(!sim_a.join("User/globalStorage/state.vscdb-wal").exists());
        assert!(!sim_a.join("Local Storage/leveldb/000003.log").exists(), "Local Storage 必须整清");
        assert!(!sim_a.join("Network/Cookies").exists());
        assert!(!sim_a.join("IndexedDB").exists());
        assert!(!sim_a.join("logs").exists(), "logs 必须整删");
        assert!(!sim_a.join("Cache").exists());
        assert!(!sim_a.join("Partitions").exists());
        assert!(!sim_a.join("Preferences").exists(), "Preferences 必须整删");
        assert!(!sim_a.join("Local State").exists(), "Local State 必须整删");
        assert!(!sim_b.join("User/globalStorage/state.vscdb").exists(), "第二现场 state.vscdb 必须整删");
        assert!(!sim_b.join("Local Storage").exists(), "第二现场 Local Storage 必须整清");
        // 层⑫动的是真实 env 的 LOCALAPPDATA/TEMP(实现如此),仿真根模式下
        // sim_c/sim_temp 不在它作用域内 ⇒ 这两条断言只在默认(真机根)模式成立。
        if sim_root.is_none() {
            assert!(!sim_c.exists(), "LOCALAPPDATA\\TRAE 缓存现场必须整删(层⑫)");
            assert!(!sim_temp.exists(), "TEMP\\TRAE* 缓存现场必须整删(层⑫)");
        }
        // 身份翻新:machineid 被改写为 32 位 hex 新值
        let mid = std::fs::read_to_string(sim_a.join("machineid")).unwrap();
        assert_ne!(mid, "sim-old-machine-id-aaaa", "machineid 必须被改写");
        assert_eq!(mid.len(), 32, "machineid 应为 32 位 hex: {mid}");
        // storage.json 骨架幸存,但遥测键被改写
        let sj = std::fs::read_to_string(sim_a.join("User/globalStorage/storage.json")).unwrap();
        assert!(!sj.contains("sim-old"), "storage.json 遥测键必须被改写: {sj}");
        let mid_b = std::fs::read_to_string(sim_b.join("machineid")).unwrap();
        assert_ne!(mid_b, "sim-b-machine", "第二现场 machineid 也必须被改写(双版本不漏)");

        // ---- 面2:注册表 ----
        if !reg_preexisting {
            for sub in [r"HKCU\Software\TRAE", r"HKCU\Software\TRAE SOLO CN"] {
                let q = std::process::Command::new("reg")
                    .args(["query", sub])
                    .creation_flags(HIDDEN)
                    .output()
                    .unwrap();
                assert!(!q.status.success(), "注册表 {sub} 必须已被整树删除(层⑪)");
            }
        }

        // ---- 面3:进程 ----
        let mut dead = false;
        for _ in 0..50 {
            if child.try_wait().unwrap().is_some() {
                dead = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        assert!(dead, "仿真 TRAE 进程必须已被层0 强杀");

        // ---- 清残骸 ----
        let _ = std::fs::remove_dir_all(&sim_a);
        let _ = std::fs::remove_dir_all(&sim_b);
        let _ = std::fs::remove_file(&sim_exe);
        let _ = std::fs::remove_dir_all(&sim_temp);
        // 仿真根模式:整棵仿真树一并清掉,不留空壳目录
        if let Some(root) = &sim_root {
            let _ = std::fs::remove_dir_all(root);
        }
    }


    // ── 9d. 真机实测(#[ignore]:显式跑;硬护栏=G:/trae-real-test-backup 备份齐备)──
    // 在本机真实 TRAE 现场(已全量备份)上真跑 UI 按钮同款胶水 checkin_reset_device_ids,
    // 断言双现场 machineid 翻新 + 深度现场全灭。备份缺失即拒跑。
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn traereal_reset_glue_on_backed_up_machine() {
        let backup = PathBuf::from(r"G:/trae-real-test-backup");
        assert!(
            backup.join("TRAE").is_dir() && backup.join("TRAE SOLO CN").is_dir(),
            "真机实测前置:G:/trae-real-test-backup 备份不齐,拒绝执行(防无备份毁现场)"
        );
        let dir = detect_trae_dir().expect("本机必须能探测到 TRAE 现场目录");
        eprintln!("[real] detected = {}", dir.display());

        // 前置:machineid 双现场旧值
        let appdata = PathBuf::from(std::env::var("APPDATA").unwrap());
        let dir_b = appdata.join("TRAE");
        let pre_a = std::fs::read_to_string(dir.join("machineid")).ok();
        let pre_b = std::fs::read_to_string(dir_b.join("machineid")).ok();
        eprintln!("[real] pre machineid A={} B={:?}", pre_a.as_deref().unwrap_or("<none>").trim(), pre_b.as_deref().map(str::trim));

        // 真跑:UI 按钮同款。guid/browser/mac 三 flag 可用环境变量打开
        // (IHUI_RESET_GUID=1 / IHUI_RESET_BROWSER=1 / IHUI_RESET_MAC=1,默认关:
        //  避开 UAC、真浏览器库与网卡改写)。
        // MachineGuid 改写前必须已有 HKLM 备份(护栏:备份目录下 MachineGuid-backup.txt)。
        let reset_guid =
            std::env::var("IHUI_RESET_GUID").map(|v| v == "1").unwrap_or(false);
        let reset_browser =
            std::env::var("IHUI_RESET_BROWSER").map(|v| v == "1").unwrap_or(false);
        let reset_mac = std::env::var("IHUI_RESET_MAC").map(|v| v == "1").unwrap_or(false);
        if reset_guid {
            assert!(
                backup.join("MachineGuid-backup.txt").is_file(),
                "要开 MachineGuid 层必须先备份 HKLM MachineGuid 到备份目录 MachineGuid-backup.txt"
            );
        }
        eprintln!("[real] flags: guid={reset_guid} browser={reset_browser} deep=true kill=true mac={reset_mac}");
        let report =
            checkin_reset_device_ids(reset_guid, reset_browser, true, Some(reset_mac))
                .expect("胶水调用失败");
        assert_eq!(report.layers.len(), 14, "层报告数应为 14");
        for l in &report.layers {
            eprintln!("[real] L{:02} {:26} ok={} {}", l.layer, l.name, l.ok, l.detail);
            // L5/L7/L13 是环境敏感可选层(UAC 被拒/浏览器运行中锁库/测试进程无管理员权限
            // 会记 FAIL,属正常降级),结果照实记录但不拦测试;其余层硬断言。
            if l.layer == 5 || l.layer == 7 || l.layer == 13 {
                eprintln!("[real] 可选层{}(不拦测试): ok={} {}", l.layer, l.ok, l.detail);
            } else {
                assert!(l.ok, "层{}({}) 实测失败: {}", l.layer, l.name, l.detail);
            }
        }

        // 断言:双现场 machineid 全部翻新为 32 位 hex 新值
        let post_a = std::fs::read_to_string(dir.join("machineid")).expect("A machineid 应存在");
        assert_eq!(post_a.trim().len(), 32, "A machineid 应 32 位 hex: {}", post_a.trim());
        if let Some(a) = pre_a {
            assert_ne!(a.trim(), post_a.trim(), "A machineid 必须翻新");
        }
        let post_b = std::fs::read_to_string(dir_b.join("machineid")).expect("B machineid 应存在");
        assert_eq!(post_b.trim().len(), 32, "B machineid 应 32 位 hex");
        if let Some(b) = pre_b {
            assert_ne!(b.trim(), post_b.trim(), "B(第二现场) machineid 必须翻新——双版本不漏");
        }

        // 断言:双现场深度面全灭
        for d in [dir.join("User/globalStorage/state.vscdb"), dir_b.join("User/globalStorage/state.vscdb")] {
            assert!(!d.exists(), "state.vscdb 必须整删: {}", d.display());
        }
        for rel in DEEP_RESET_DIRS {
            assert!(!dir.join(rel).exists(), "真机深度清空失败: {} 仍存在", rel);
            assert!(!dir_b.join(rel).exists(), "第二现场深度清空失败: {} 仍存在", rel);
        }
        for rel in DEEP_RESET_FILES {
            assert!(!dir.join(rel).exists(), "真机深度清空失败: {} 仍存在", rel);
        }
        eprintln!("[real] DONE:13 层全 ok,双现场等效重装(备份在 G:/trae-real-test-backup)");
    }

    // ── 9e. 一键重置真机实测(#[ignore]):UI「一键彻底重置」按钮完全同路径,
    // 含 ensure_machine_guid_backup 自动备份链路。备份产物断言=~/.trae-proxy。
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn traereal_one_click_reset_glue() {
        let dir = detect_trae_dir().expect("本机必须能探测到 TRAE 现场目录");
        eprintln!("[oneclick] detected = {}", dir.display());
        let report = checkin_one_click_reset().expect("一键重置胶水调用失败");
        assert_eq!(report.layers.len(), 14, "层报告数应为 14");
        for l in &report.layers {
            eprintln!("[oneclick] L{:02} {:26} ok={} {}", l.layer, l.name, l.ok, l.detail);
            // 环境敏感可选层(5 UAC/7 浏览器锁/13 无提权)不拦;其余硬断言
            if l.layer == 5 || l.layer == 7 || l.layer == 13 {
                continue;
            }
            assert!(l.ok, "层{}({}) 失败: {}", l.layer, l.name, l.detail);
        }
        // 自动备份安全网断言:MachineGuid 旧值必须已落盘(ascii 无 BOM;容忍历史
        // utf8 备份残留的 BOM 前缀)
        let home = std::env::var("USERPROFILE").expect("USERPROFILE 必须存在");
        let backup = PathBuf::from(home).join(".trae-proxy/MachineGuid-backup.txt");
        assert!(backup.is_file(), "自动备份缺失: {}", backup.display());
        let saved = std::fs::read_to_string(&backup).expect("备份可读");
        let saved = saved.trim_start_matches('\u{feff}').trim().to_string();
        assert_eq!(saved.chars().count(), 36, "MachineGuid 应为 36 位 GUID 形态");
        eprintln!("[oneclick] DONE:一键 14 层执行完毕,自动备份在 {}", backup.display());
    }

    // ── 9f. 「现在就验证」真机闭环(#[ignore]):一键重置 → 立刻审计 → 断言 0 残留 ──
    //
    // 这是用户诉求「我要现在就验证 / trae 还是没重置彻底」的**可执行答案**:
    // 重置前把旧身份值记进账本 → 重置 → 用账本当黑名单回扫 → 给出可复核的残留条数。
    // 不再靠"感觉",也不再靠一句"已完成"。
    #[test]
    #[ignore]
    fn traereal_reset_then_audit_reports_zero_residual() {
        let backup = PathBuf::from("G:/trae-real-test-backup");
        assert!(backup.is_dir(), "真机护栏:先备好 {}\\", backup.display());

        // ① 先把账本清空重来:确保本轮审计比的是**本轮**抓到的旧值,
        //    否则历史账本里的老值会让结论不可归因。
        if let Some(p) = identity_history_path() {
            let _ = std::fs::remove_file(&p);
        }

        // ② 抓"重置前"的旧身份值(含注册表厂商容器下的 Info 指纹)并记入账本
        let dirs: Vec<PathBuf> = trae_dir_candidates(
            std::env::var("APPDATA").ok().as_deref(),
            std::env::var("LOCALAPPDATA").ok().as_deref(),
            None,
        )
        .into_iter()
        .filter(|p| p.is_dir())
        .collect();
        let before = capture_identity_values(&dirs);
        eprintln!("[verify] 重置前抓到旧身份值 {} 个:", before.len());
        for v in &before {
            let show: String = v.chars().take(48).collect();
            eprintln!("[verify]   - {show}");
        }
        assert!(!before.is_empty(), "真机上必须抓得到旧身份值(否则 TRAE 现场可能已被清空)");

        // ③ 一键 14 层(与 UI 按钮同路径)
        let report = checkin_one_click_reset().expect("一键重置不应返回错误");
        for l in &report.layers {
            eprintln!("[verify] L{:02} {:26} ok={} {}", l.layer, l.name, l.ok, l.detail);
            if l.layer == 5 || l.layer == 7 || l.layer == 13 {
                continue;
            }
            assert!(l.ok, "层{}({}) 失败: {}", l.layer, l.name, l.detail);
        }

        // ④ 立刻审计
        let a = audit_trae_residual();
        eprintln!("[verify] ===== 审计结论 =====");
        eprintln!("[verify] {}", a.message);
        eprintln!(
            "[verify] 黑名单 {} / 扫文件 {} 个 ({:.1} MB) / 现场 {} 处",
            a.blacklist_size, a.scanned_files, a.scanned_mb, a.sites_present
        );
        for h in a.hard_hit_files.iter().take(20) {
            eprintln!("[verify]   残留 {} ({} 个旧值,例 {})", h.file, h.count, h.sample);
        }
        for r in &a.registry {
            eprintln!("[verify]   {r}");
        }
        for h in &a.hardware {
            eprintln!("[verify]   硬件 {h}");
        }
        assert!(a.ok, "残留 {} 处未清: {:#?}", a.hard_hits, a.hard_hit_files);
        eprintln!("[verify] DONE:一键重置 → 审计 0 残留,闭环成立");
    }

    // ── 10. 残留审计:身份记号抽取 / 键名判据 / 账本抓取(全部纯函数或临时目录,可真跑)──

    #[test]
    fn extract_identity_tokens_picks_32hex_and_uuid_only() {
        let src = b"machineId=0123456789abcdef0123456789abcdef\n\
                    guid=2d3811f4-ba07-bf18-c468-acfc0cd60f56\n\
                    short=abc123\n\
                    long=0123456789abcdef0123456789abcdef0\n\
                    tail=zzz0123456789abcdef0123456789abcde";
        let got = extract_identity_tokens(src);
        assert!(got.contains(&"0123456789abcdef0123456789abcdef".to_string()), "{got:?}");
        assert!(got.contains(&"2d3811f4-ba07-bf18-c468-acfc0cd60f56".to_string()), "{got:?}");
        // 33 位与 31 位都不算(正则口径:恰好 32 且前后为词边界)
        assert!(!got.iter().any(|t| t.len() == 33), "33 位串不得命中: {got:?}");
        assert!(!got.iter().any(|t| t == "zzz0123456789abcdef0123456789abcde"), "{got:?}");
        assert!(!got.contains(&"abc123".to_string()), "{got:?}");
    }

    /// 二进制现场(非 UTF-8)也必须能扫 —— TRAE 的 leveldb/vscdb 全是二进制。
    #[test]
    fn extract_identity_tokens_works_on_binary_bytes() {
        let mut buf: Vec<u8> = vec![0x00, 0xff, 0xfe, 0x80];
        buf.extend_from_slice(b"0123456789ABCDEF0123456789ABCDEF");
        buf.extend_from_slice(&[0x00, 0xff, 0x00]);
        let got = extract_identity_tokens(&buf);
        assert!(
            got.contains(&"0123456789abcdef0123456789abcdef".to_string()),
            "二进制中的 32hex 必须命中且已小写化: {got:?}"
        );
    }

    #[test]
    fn uuid_boundary_rejects_partial_matches() {
        // 前面还挂着 hex ⇒ 不是独立 UUID
        let s = b"a2d3811f4-ba07-bf18-c468-acfc0cd60f56";
        assert!(try_uuid_at(s, 1).is_none() || try_uuid_at(s, 0).is_none());
        // 干净的一段 ⇒ 命中
        let clean = b" 2d3811f4-ba07-bf18-c468-acfc0cd60f56 ";
        assert_eq!(
            try_uuid_at(clean, 1),
            Some("2d3811f4-ba07-bf18-c468-acfc0cd60f56".to_string())
        );
        // 截断(不足 36 字节)⇒ 不命中
        assert!(try_uuid_at(b"2d3811f4-ba07", 0).is_none());
    }

    #[test]
    fn looks_like_identity_accepts_only_32hex_or_uuid() {
        assert!(looks_like_identity("0123456789abcdef0123456789abcdef"));
        assert!(looks_like_identity("2d3811f4-ba07-bf18-c468-acfc0cd60f56"));
        assert!(!looks_like_identity("old"));
        assert!(!looks_like_identity(""));
        assert!(!looks_like_identity("0123456789abcdef0123456789abcde"));
    }

    /// 层⑪键名判据:2026-10-10 取证发现的 4 类漏网键必须全部被判据覆盖,
    /// 且**厂商容器不得整删**(只摘其下 TRAE 子项)。
    #[test]
    fn registry_key_predicates_cover_all_found_variants() {
        // ① TRAE 族(整删)
        for n in ["TRAE", "Trae CN", "Trae Work 助手", "TRAE SOLO CN", "icube", "ahawork"] {
            assert!(is_trae_family_reg_key(n), "{n} 必须判为 TRAE 族");
        }
        assert!(!is_trae_family_reg_key("Microsoft"));
        // ② 厂商容器(只摘子项)
        for n in ["Bytedance", "ByteDance", "字节跳动"] {
            assert!(is_vendor_container_reg_key(n), "{n} 必须判为厂商容器");
        }
        assert!(!is_vendor_container_reg_key("Microsoft"));
        // 关键护栏:厂商容器**本身**不是 TRAE 族键 ⇒ 不会被整树删除(只摘其下 TRAE 子项)
        assert!(!is_trae_family_reg_key("Bytedance"), "厂商容器本身不是 TRAE 族键,不得整删");
        // ③ Classes 下的协议与文件关联 ProgID
        assert!(is_trae_progid_reg_key("trae"));
        assert!(is_trae_progid_reg_key("Trae CN.asp"));
        assert!(!is_trae_progid_reg_key(".txt"));
        assert!(!is_trae_progid_reg_key("txtfile"));
    }

    /// 账本抓取:只收"像身份"的旧值,且 4 个点号键一个都不能漏。
    #[test]
    fn capture_identity_values_collects_machineid_and_four_dotted_keys() {
        let dir = scratch("capture-identity");
        std::fs::create_dir_all(dir.join("User/globalStorage")).unwrap();
        std::fs::write(dir.join("machineid"), "0123456789abcdef0123456789ABCDEF\n").unwrap();
        std::fs::write(
            dir.join("User/globalStorage/storage.json"),
            // 值一律 32 位(5+5+6+16):不足 32 会被 looks_like_identity 拒收
            r#"{"telemetry.machineId":"AAAAA56789abcdef0123456789abcdef",
                 "telemetry.sqmId":"{BBBB56789-1234-1234-1234-123456789012}",
                 "telemetry.devDeviceId":"CCCCC56789abcdef0123456789abcdef",
                 "aha.device.device_id":"DDDDD56789abcdef0123456789abcdef",
                 "unrelated":"no"}"#,
        )
        .unwrap();
        let got = capture_identity_values(std::slice::from_ref(&dir));
        assert!(got.contains(&"0123456789abcdef0123456789abcdef".to_string()), "{got:?}");
        assert!(got.contains(&"aaaaa56789abcdef0123456789abcdef".to_string()), "{got:?}");
        assert!(got.contains(&"ccccc56789abcdef0123456789abcdef".to_string()), "{got:?}");
        assert!(got.contains(&"ddddd56789abcdef0123456789abcdef".to_string()), "{got:?}");
        // sqmId 是 GUID 花括号形态 ⇒ 抽不到裸 36 位,这里只断言不崩且不进垃圾值
        assert!(!got.iter().any(|v| v.contains('{')), "不得收入非身份形态: {got:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 测试现场的 "old" 之类短串绝不能污染账本(否则黑名单里全是垃圾)。
    #[test]
    fn capture_identity_values_ignores_non_identity_values() {
        let dir = scratch("capture-garbage");
        std::fs::create_dir_all(dir.join("User/globalStorage")).unwrap();
        std::fs::write(dir.join("machineid"), "old").unwrap();
        std::fs::write(dir.join("User/globalStorage/storage.json"), r#"{"telemetry.machineId":"x"}"#)
            .unwrap();
        // 注意:本机可能已有 ~/.trae-proxy/MachineGuid-backup.txt(真实历史旧值),
        // 它**理应**入账 ⇒ 断言只能针对"垃圾短串不得入账",不能断言整体为空。
        let got = capture_identity_values(std::slice::from_ref(&dir));
        assert!(
            !got.iter().any(|v| v == "old" || v == "x" || v.len() < 32),
            "非身份短串不得污染账本: {got:?}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
