// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 本机工作区文件通道的**判据层**（纯 std，零 tauri 依赖）。
//!
//! 为什么拆出来：`workspace_fs_ipc.rs` 只做 DTO 映射与状态存取，判定全在这里 ——
//! 这样 `rustc --test src/workspace_fs_core.rs` 就能真跑单测，不必等整棵 tauri
//! 依赖树编完（本仓"造好没装车"的常见成因）。
//!
//! 边界（与 `git_channel_ipc.rs` 同族，但比对标的三家更严）：
//! 1. **root 不由前端自报**：只能来自宿主自己的原生目录选择器（见 IPC 层），
//!    前端能拿到的只有一个已经写进状态的 root。
//! 2. **路径一律相对**：绝对路径 / `..` 逃逸 / verbatim(`\\?\`) / UNC(`\\host`) /
//!    盘符前缀 全部拒（`out-of-bounds` 与 `suspicious-input` 分开，两者都不是放行）。
//! 3. **符号链接逃逸靠 canonicalize 兜**：候选路径与 root 都 canonicalize 之后再比
//!    前缀，符号链接指向 root 之外的会被判出界。
//! 4. **写前比对前像**：调用方可给 `expected_sha256`，与盘上实测不符即拒（外部改动
//!    不会被静默覆盖）。

use std::path::{Path, PathBuf};

/// 单次读上限（防"把 4GB 日志读进 webview"）。
pub const MAX_READ_BYTES: u64 = 2 * 1024 * 1024;
/// 单次写上限。
pub const MAX_WRITE_BYTES: u64 = 8 * 1024 * 1024;
/// 单次列目录上限（超出即拒，不静默截断）。
pub const MAX_LIST_ENTRIES: usize = 4096;

/// 拒绝原因。**每一种都不是放行**，前端应按字符串分支做提示文案。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Reject {
    /// root 尚未授权（宿主还没拿到目录）
    RootNotAuthorized,
    /// 路径出界（绝对路径、`..` 逃逸、符号链接指向 root 之外）
    OutOfBounds(String),
    /// 看不清的输入（verbatim / UNC / 盘符 / 空字节 / 控制字符）
    SuspiciousInput(String),
    /// 存在性/类型不符（要读的是目录、要列的是文件…）
    TypeMismatch(String),
    /// 超限（读/写/条目数）
    TooLarge(String),
    /// 写冲突（前像 sha 与盘上不符）
    Conflict(String),
    /// 其他运行期错误（IO 原文）
    Io(String),
}

impl Reject {
    /// 稳定分类名（前端按此分支，不解析中文原因）。
    pub fn kind(&self) -> &'static str {
        match self {
            Reject::RootNotAuthorized => "root_not_authorized",
            Reject::OutOfBounds(_) => "out_of_bounds",
            Reject::SuspiciousInput(_) => "suspicious_input",
            Reject::TypeMismatch(_) => "type_mismatch",
            Reject::TooLarge(_) => "too_large",
            Reject::Conflict(_) => "conflict",
            Reject::Io(_) => "io_error",
        }
    }

    pub fn reason(&self) -> String {
        match self {
            Reject::RootNotAuthorized => "尚未授权工作区根（先在工作区选择器里选一次本地文件夹）".into(),
            Reject::OutOfBounds(detail) => format!("路径超出已授权工作区根：{detail}"),
            Reject::SuspiciousInput(detail) => format!("输入形态不可判定：{detail}"),
            Reject::TypeMismatch(detail) => format!("类型不符：{detail}"),
            Reject::TooLarge(detail) => format!("超出上限：{detail}"),
            Reject::Conflict(detail) => format!("写入冲突：{detail}"),
            Reject::Io(detail) => format!("文件系统错误：{detail}"),
        }
    }
}

/// 把调用方给的相对路径规范成正斜杠相对串。
///
/// 空串 = 根目录本身（合法）。任何绝对/逃逸/怪异形态一律拒。
pub fn normalize_rel(raw: &str) -> Result<String, Reject> {
    if raw.len() > 4096 {
        return Err(Reject::SuspiciousInput("路径长度超过 4096".into()));
    }
    if raw.contains('\0') || raw.chars().any(|c| (c as u32) < 0x20) {
        return Err(Reject::SuspiciousInput("路径含空字节或控制字符".into()));
    }
    let trimmed = raw.trim();
    let unified = trimmed.replace('\\', "/");
    if unified.is_empty() || unified == "." || unified == "/" {
        return Ok(String::new());
    }
    // verbatim / UNC / 盘符：本通道只吃"根内相对路径"
    if unified.starts_with("//") {
        return Err(Reject::OutOfBounds("UNC 路径不属于工作区".into()));
    }
    if unified.starts_with('/') {
        return Err(Reject::OutOfBounds("绝对路径不属于工作区".into()));
    }
    if unified.as_bytes().get(1) == Some(&b':') {
        return Err(Reject::OutOfBounds("盘符路径不属于工作区".into()));
    }
    let mut parts: Vec<&str> = Vec::new();
    for seg in unified.split('/') {
        match seg {
            "" | "." => continue,
            ".." => return Err(Reject::OutOfBounds("`..` 逃逸不属于工作区".into())),
            other => {
                if other.ends_with(':') || other.contains(':') {
                    return Err(Reject::SuspiciousInput("路径段含冒号(备用数据流形态)".into()));
                }
                parts.push(other);
            }
        }
    }
    if parts.is_empty() {
        return Ok(String::new());
    }
    Ok(parts.join("/"))
}

/// 大小写是否折叠（Windows 文件系统不区分大小写）。
pub fn fold_case() -> bool {
    cfg!(windows)
}

fn same_case(a: &Path, b: &Path) -> bool {
    if fold_case() {
        // 逐组件比，避免 `G:/a` 与 `G:/A` 判成不同
        let (mut ita, mut itb) = (a.components(), b.components());
        loop {
            match (ita.next(), itb.next()) {
                (None, None) => return true,
                (Some(x), Some(y)) => {
                    let xs = x.as_os_str().to_string_lossy();
                    let ys = y.as_os_str().to_string_lossy();
                    if !xs.eq_ignore_ascii_case(&ys) {
                        return false;
                    }
                }
                _ => return false,
            }
        }
    }
    a == b
}

/// `candidate`（已 canonicalize）是否落在 `root`（已 canonicalize）之内。
///
/// 相等也算"之内"（根目录自身）。
pub fn within_root(root: &Path, candidate: &Path) -> bool {
    if candidate == root || same_case(candidate, root) {
        return true;
    }
    // starts_with 是组件级比较，不以字符串前缀误判（`/a/bc` 不算 `/a/b` 之内）
    let root_components: Vec<_> = root.components().collect();
    let cand_components: Vec<_> = candidate.components().collect();
    if cand_components.len() <= root_components.len() {
        return false;
    }
    for (idx, rc) in root_components.iter().enumerate() {
        let cc = &cand_components[idx];
        let rs = rc.as_os_str().to_string_lossy();
        let cs = cc.as_os_str().to_string_lossy();
        let eq = if fold_case() {
            rs.eq_ignore_ascii_case(&cs)
        } else {
            rs == cs
        };
        if !eq {
            return false;
        }
    }
    true
}

/// 8 位字节的 sha256（只用于前像比对，不做安全用途）。
///
/// 实现刻意小：写冲突检测只需稳定指纹，不需要密码学强度；若将来要做内容寻址，
/// 应换成仓库既有的 sha256 实现，而不是在这里加长。
pub fn fingerprint(bytes: &[u8]) -> String {
    let mut state: [u64; 4] = [
        0x243f_6a88_85a3_08d3,
        0x1319_8a2e_0370_7344,
        0xa409_3822_299f_31d0,
        0x082e_fa98_ec4e_6c89,
    ];
    for (idx, chunk) in bytes.chunks(64).enumerate() {
        let mut w = [0u64; 8];
        for (i, part) in chunk.chunks(8).enumerate() {
            let mut buf = [0u8; 8];
            buf[..part.len()].copy_from_slice(part);
            w[i] = u64::from_be_bytes(buf);
        }
        w[0] = w[0]
            .wrapping_add(u64::from_be_bytes([0xE9, 0xB5, 0xAD, 0x55, 0x2A, 0x9B, 0x6B, 0x84]))
            .wrapping_add(idx as u64);
        for i in 0..8 {
            w[i % 4] = w[i % 4].wrapping_add(w[(i + 1) % 4].rotate_left((i as u32) % 32 + 1));
            w[i % 4] = w[i % 4].rotate_left(7).wrapping_mul(0x9E37_79B9_7F4A_7C15);
        }
        for i in 0..4 {
            state[i] = state[i] ^ w[i] ^ w[i + 4];
            state[i] = state[i].rotate_left((i as u32) * 9 + 11);
        }
    }
    let mut hex = String::with_capacity(32);
    for word in state {
        for byte in word.to_be_bytes().iter().take(8) {
            hex.push_str(&format!("{byte:02x}"));
        }
        if hex.len() >= 32 {
            break;
        }
    }
    hex[..32].to_string()
}

/// 把 root + 相对路径拼成待校验的绝对路径（**不做**存在性检查）。
pub fn join_rel(root: &Path, rel: &str) -> PathBuf {
    let mut out = root.to_path_buf();
    if !rel.is_empty() {
        for seg in rel.split('/') {
            if !seg.is_empty() {
                out.push(seg);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_accepts_plain_relatives() {
        assert_eq!(normalize_rel("").unwrap(), "");
        assert_eq!(normalize_rel(".").unwrap(), "");
        assert_eq!(normalize_rel("src/main.rs").unwrap(), "src/main.rs");
        assert_eq!(normalize_rel("src\\main.rs").unwrap(), "src/main.rs");
        assert_eq!(normalize_rel("./a//b/").unwrap(), "a/b");
    }

    #[test]
    fn normalize_rejects_absolute_and_escapes() {
        assert_eq!(normalize_rel("/etc/passwd").unwrap_err().kind(), "out_of_bounds");
        assert_eq!(normalize_rel("G:\\IHUI-AI").unwrap_err().kind(), "out_of_bounds");
        assert_eq!(normalize_rel("../etc").unwrap_err().kind(), "out_of_bounds");
        assert_eq!(normalize_rel("a/../../b").unwrap_err().kind(), "out_of_bounds");
        assert_eq!(normalize_rel("//server/share").unwrap_err().kind(), "out_of_bounds");
    }

    #[test]
    fn normalize_rejects_suspicious_shapes() {
        assert_eq!(normalize_rel("a\u{0}b").unwrap_err().kind(), "suspicious_input");
        assert_eq!(normalize_rel("a/file.txt:ads").unwrap_err().kind(), "suspicious_input");
        assert_eq!(normalize_rel(&"x".repeat(5000)).unwrap_err().kind(), "suspicious_input");
    }

    #[test]
    fn within_root_is_component_wise() {
        let root = Path::new("G:\\IHUI-AI");
        assert!(within_root(root, Path::new("G:\\IHUI-AI")));
        assert!(within_root(root, Path::new("G:\\IHUI-AI\\src\\main.rs")));
        // 前缀相似但不是子路径
        assert!(!within_root(root, Path::new("G:\\IHUI-AI2\\x")));
        // 同级/上级
        assert!(!within_root(root, Path::new("G:\\")));
        assert!(!within_root(root, Path::new("G:\\other")));
    }

    #[test]
    fn join_rel_never_escapes_input_shape() {
        let root = Path::new("G:\\IHUI-AI");
        assert_eq!(join_rel(root, ""), root.to_path_buf());
        assert_eq!(join_rel(root, "a/b"), root.join("a").join("b"));
    }

    #[test]
    fn fingerprint_is_stable_and_differs() {
        assert_eq!(fingerprint(b"hello"), fingerprint(b"hello"));
        assert_ne!(fingerprint(b"hello"), fingerprint(b"hellp"));
        assert_eq!(fingerprint(b"").len(), 32);
    }
}
