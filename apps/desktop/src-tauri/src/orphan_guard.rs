// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


//! 防孤儿守护 —— **退出即清整棵进程树 + 原生件加载前验签**。
//!
//! 来源(2026-11-15 四程序逆向 T3§H / T4§H):Trae ``orphan_protection.rs``(防孤儿)+
//! kill-on-close + ``spk_verify.rs``(原生件签名校验)。只取架构模式复现,不搬专有源码。
//!
//! 与本仓既有件的关系(单一真相源,不重复造):
//! - ``startup_guard.rs``:管**启动相位**竞态(双击打不开/互杀),是另一条正交线。
//!   本模块**不碰**启动相位,只管"进程退出时后代别留成孤儿"。
//! - ``terminal_session.rs``:终端会话有自己的 Job Object(逐会话),退出走
//!   ``kill_all()``。本模块补的是**不归终端管的后代**(operator / embedded_browser /
//!   外部工具拉起的子进程)——它们此前退出时不保证被清。
//!
//! # 机制一:kill-on-close 作业(核心)
//! 主进程一启动就把自己挂进一个 ``JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`` 的作业对象。
//! Windows 语义:此后本进程 fork 出的**所有后代默认继承该作业**;主进程退出时内核
//! 关闭作业句柄 ⇒ 组内全部进程被 ``TerminateJobObject`` 自动终止。这比"退出时枚举
//! 子进程再逐个杀"稳健——**不依赖枚举的完备性**(枚举会漏已 detach / 已改父的进程)。
//!
//! 这正是 Trae ``orphan_protection.rs`` + kill-on-close 的复现:把"必须记得清理"变成
//! "忘了清理也会被内核兜底"。返回句柄由调用方持有到进程生命周期结束(故意不显式
//! CloseHandle——提前关会触发整树终止)。
//!
//! # 机制二:原生件 sha256 白名单验签
//! 加载第三方/自研原生件(.node / .dll)前,校验其 sha256 是否在白名单内(照 Trae
//! ``spk_verify.rs`` 的"加载前验签"思想)。白名单可为空(=全部拒绝)+ 运行期注册;
//! Authenticode 完整校验留作后续(需要 ``WinVerifyTrust``,超出本轮 std 面)。
//! 判据纯函数 ``verify_artifact`` 可单测;I/O 走薄函数。

use std::path::Path;

use sha2::{Digest, Sha256};

// ---------------------------------------------------------------------------
// 机制一:kill-on-close 作业(仅 Windows;非 Windows 无作业概念,退化为 no-op)
// ---------------------------------------------------------------------------

/// 进程级 kill-on-close 作业句柄。持有到进程结束;Drop 故意**不** CloseHandle
/// (见模块头注:提前关 = 整树终止)。
#[cfg(windows)]
pub struct OrphanGuard {
    job: crate::terminal_session::JobObject,
}

#[cfg(not(windows))]
pub struct OrphanGuard;

/// 把当前进程挂入 kill-on-close 作业。应在 ``main`` 早期调用。
///
/// 失败(建作业/赋进程失败)返回 ``None`` 并记日志——**降级而非阻断**:拿不到作业
/// 兜底时,进程照常跑,只是失去"退出自动清树"这层保险(不因保险失效而拒启)。
#[cfg(windows)]
pub fn install() -> Option<OrphanGuard> {
    use winapi::um::processthreadsapi::GetCurrentProcess;
    match crate::terminal_session::JobObject::create_kill_on_close() {
        Some(job) => unsafe {
            if winapi::um::jobapi2::AssignProcessToJobObject(
                job.raw(),
                GetCurrentProcess(),
            ) == 0
            {
                log::warn!(
                    "[orphan_guard] 挂入 kill-on-close 作业失败(GetLastError={}),\
                     降级:退出时不保证自动清整树",
                    winapi::um::errhandlingapi::GetLastError()
                );
                return None; // job 在此 Drop,CloseHandle 兜底
            }
            Some(OrphanGuard { job })
        },
        None => {
            log::warn!(
                "[orphan_guard] 建 kill-on-close 作业失败,降级:退出时不保证自动清整树"
            );
            None
        }
    }
}

#[cfg(not(windows))]
pub fn install() -> Option<OrphanGuard> {
    // 非 Windows:无作业对象。POSIX 的进程组清理由 terminal_session 逐会话负责,
    // 本模块暂无全局兜底(诚实边界,不假装有)。
    None
}

// ---------------------------------------------------------------------------
// 机制二:原生件 sha256 白名单验签(跨平台,判据纯函数可单测)
// ---------------------------------------------------------------------------

/// 验签三态(对齐本仓诚实纪律:取不到不冒绿,不认的不判死)。
///
/// - ``Ok``:文件读到、sha256 命中白名单 ⇒ 放行加载。
/// - ``Mismatch``:读到、算出哈希、但**不在**白名单 ⇒ 拒绝(具名原因)。
/// - ``Unjudged``:文件读不到 / 白名单为空 = 没有任何可信锚点 ⇒ **不判定**并阻断
///   (§0.3「没判绝不写成判过」:白名单空时"放行"等于没验签,绝不允许)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VerifyOutcome {
    Ok,
    Mismatch { reason: String },
    Unjudged { reason: String },
}

impl VerifyOutcome {
    /// 是否允许加载。``Unjudged`` 与 ``Mismatch`` 一律不允许(fail-closed)。
    pub fn allow(&self) -> bool {
        matches!(self, VerifyOutcome::Ok)
    }
}

/// 计算文件 sha256(十六进制小写)。读不到返回 ``None``。
///
/// 分块读(64 KiB),不整文件进内存——原生件可能几十 MB。
pub fn sha256_of_file(path: &Path) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        use std::io::Read;
        match file.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buf[..n]),
            Err(_) => return None, // 读到一半出错:返回 None(Unjudged,不冒绿)
        }
    }
    let digest = hasher.finalize();
    Some(hex_encode(&digest))
}

/// 十六进制小写编码(不引 hex crate,sha2 只给原始字节)。
fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

/// 验签判据(纯函数,可单测):给定算好的 sha256 与白名单,判三态。
///
/// 白名单为空 ⇒ ``Unjudged``(**不是放行**):没有任何可信锚点时,"通过"等于没验,
/// 与 §0.3「没判不写成判过」同一条纪律。哈希大小写不敏感(白名单条目归一小写比对)。
pub fn verify_artifact(sha256: &str, allowlist: &[String]) -> VerifyOutcome {
    if allowlist.is_empty() {
        return VerifyOutcome::Unjudged {
            reason: "sha256 白名单为空:无任何可信锚点,拒绝加载(不是放行)".into(),
        };
    }
    let got = sha256.to_ascii_lowercase();
    let hit = allowlist.iter().any(|e| e.trim().to_ascii_lowercase() == got);
    if hit {
        VerifyOutcome::Ok
    } else {
        VerifyOutcome::Mismatch {
            reason: format!(
                "sha256 不在白名单内: got={got}, allowlist_len={}",
                allowlist.len()
            ),
        }
    }
}

/// 薄 I/O 封装:读文件算哈希并验签。文件读不到 ⇒ ``Unjudged``(阻断,不冒绿)。
pub fn verify_artifact_path(path: &Path, allowlist: &[String]) -> VerifyOutcome {
    match sha256_of_file(path) {
        Some(hash) => verify_artifact(&hash, allowlist),
        None => VerifyOutcome::Unjudged {
            reason: format!("原生件读不到: {}", path.display()),
        },
    }
}

// ---------------------------------------------------------------------------
// 单元测试(纯逻辑:验签判据 + 哈希;不起真进程)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_encode_known_vector() {
        // sha256("") 的已知值(空输入)。
        let mut h = Sha256::new();
        h.update(b"");
        assert_eq!(
            hex_encode(&h.finalize()),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn verify_ok_when_hash_in_allowlist() {
        let h = "aabbcc".to_string();
        let list = vec!["aabbcc".to_string()];
        assert_eq!(verify_artifact(&h, &list), VerifyOutcome::Ok);
    }

    #[test]
    fn verify_ok_case_insensitive() {
        let list = vec!["AABBCC".to_string()];
        assert_eq!(verify_artifact(&"aabbcc", &list), VerifyOutcome::Ok);
    }

    #[test]
    fn verify_empty_allowlist_is_unjudged_not_allow() {
        // 白名单空 = 没锚点 ⇒ Unjudged(阻断),绝不放行。
        let out = verify_artifact("aabbcc", &[]);
        assert!(matches!(out, VerifyOutcome::Unjudged { .. }));
        assert!(!out.allow());
    }

    #[test]
    fn verify_mismatch_blocks() {
        let list = vec!["deadbeef".to_string()];
        let out = verify_artifact("aabbcc", &list);
        assert!(matches!(out, VerifyOutcome::Mismatch { .. }));
        assert!(!out.allow());
    }

    #[test]
    fn verify_unjudged_does_not_allow() {
        let out = verify_artifact("x", &[]);
        assert!(!out.allow());
    }

    #[test]
    fn sha256_of_missing_file_is_none() {
        let out = sha256_of_file(Path::new("Z:/definitely/not/here.bin"));
        assert!(out.is_none());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
