// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 本地 git/diff 通道 —— **执行层**（只用 std，不依赖 tauri，可被 `rustc --test` 单独编译）。
//!
//! 这一层的唯一职责：把 `git_status_core` 的判据包成**真去取一次本地仓库状态**的出口，
//! 并把三态**显式分开**（本仓铁律：不得把"没跑到"折叠成"没有改动"）：
//!
//! 1. `Facts` —— 命令零退出**且**输出解析成功，条目清单可作结论；
//! 2. `CommandFailed` —— git 非零退出（含"不是仓库""safe.directory 被拒"等），带 stderr 原文；
//! 3. `Undetermined` —— 判不了：超时 / 二进制缺失 / 路径越界被拒 / 输出畸形 / 超预算。
//!    这一态再按 `Blindness` 分小类，因为"为什么判不了"决定下一步动作
//!    （装 git？换路径？还是补解析器），把它们混成一句"失败"就等于没报。
//!
//! 授权边界（防穿越，写在这里也写在 `GitChannelState::boundary_note` 里给运行时读）：
//! - 前端只能报**相对路径**；绝对路径 / `..` 逃逸 / verbatim(`\\?\`) / UNC / 控制字符
//!   一律拒（`OutOfBounds`）或判不了（`SuspiciousInput`），**两者都不是放行**。
//! - 工作目录（`root`）**不采信前端自报**：必须同时满足
//!   ① 落在宿主登记的 permitted bases 之内，② `git rev-parse --show-toplevel` 亲口确认
//!   它就是自己那个 worktree 的顶层。任一不成立即拒。
//! - git 一律走**绝对路径候选**（不依赖 PATH），并且带 `-c safe.directory=*`。

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use crate::git_status_core::{
    classify_rel_target, parse_porcelain_z, path_within_root, ChangeKind, Contain, StatusEntry,
};

/// Windows：不分配新控制台窗口（与 §5b「派生控制台程序必须 windowsHide」同一条要求）。
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const DEFAULT_TIMEOUT_MS: u64 = 4000;
pub const MAX_TIMEOUT_MS: u64 = 15_000;
/// 显式指定 git 绝对路径的出口（换机/便携 git 用），**不**是 PATH 查找。
pub const ENV_GIT_BIN: &str = "IHUI_GIT_BIN";
/// 允许被授权的 workspace 根所在的基目录（`;` 分隔的绝对路径）。
pub const ENV_GIT_BASES: &str = "IHUI_DESKTOP_GIT_BASES";
/// 单次最多回报的条目数。**唯一数值在 `git_status_core::MAX_ENTRIES`**，
/// 这里只是别名 —— 两处各写一个数就是"两个预算互相顶掉"的开始。
pub const MAX_REPORTED_ENTRIES: usize = crate::git_status_core::MAX_ENTRIES;

/// 三态之"判不了"的原因类别。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Blindness {
    /// 子进程在预算内没回来（可能被外部杀掉 ⇒ 绝不当"无改动"）。
    Timeout,
    /// 绝对路径候选里一个都不存在。
    MissingBinary,
    /// 越界：明确不该给的路径（绝对路径 / `..` 逃逸 / root 未经证明）。
    OutOfBounds,
    /// 输入看不清（非 UTF-8、verbatim 语法、控制字符），拒绝猜。
    SuspiciousInput,
    /// 输出解析不了（畸形 porcelain）。
    Parse,
    /// 结果超预算 ⇒ 清单不完整，拒绝出具合格证。
    Budget,
    /// 读子进程管道失败（与"输出内容看不懂"是两件事）。
    Io,
    /// 派生失败但不是"找不到二进制"（权限、目录不存在等）。
    Spawn,
    /// 拿不到退出码（被信号终止）。
    NoExitCode,
}

impl Blindness {
    pub fn as_str(self) -> &'static str {
        match self {
            Blindness::Timeout => "timeout",
            Blindness::MissingBinary => "missing-binary",
            Blindness::OutOfBounds => "out-of-bounds",
            Blindness::SuspiciousInput => "suspicious-input",
            Blindness::Parse => "parse",
            Blindness::Budget => "budget",
            Blindness::Io => "io-failed",
            Blindness::Spawn => "spawn-failed",
            Blindness::NoExitCode => "no-exit-code",
        }
    }
}

/// 出口三态。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineOutcome {
    Facts {
        root: String,
        git_binary: String,
        /// `None` = 整个仓库；`Some(rel)` = 只问这一条路径。
        scope: Option<String>,
        entries: Vec<StatusEntry>,
    },
    CommandFailed {
        git_binary: String,
        args: Vec<String>,
        exit_code: Option<i32>,
        stderr: String,
    },
    Undetermined {
        kind: Blindness,
        reason: String,
    },
}

impl EngineOutcome {
    pub fn is_facts(&self) -> bool {
        matches!(self, EngineOutcome::Facts { .. })
    }
    pub fn undetermined_kind(&self) -> Option<Blindness> {
        match self {
            EngineOutcome::Undetermined { kind, .. } => Some(*kind),
            _ => None,
        }
    }
}

/// 子进程执行结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExecState {
    Exited,
    TimedOut,
    NotFound,
    SpawnFailed,
    IoFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecResult {
    pub state: ExecState,
    pub exit: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: String,
    pub detail: String,
}

impl ExecResult {
    fn failed(state: ExecState, detail: String) -> Self {
        ExecResult {
            state,
            exit: None,
            stdout: Vec::new(),
            stderr: String::new(),
            detail,
        }
    }
}

/// 派生 seam：单测注入脚本化实现，真实调用走 `ProcessRunner`。
pub trait Runner {
    fn run(&self, program: &Path, args: &[String], cwd: &str, timeout: Duration) -> ExecResult;
}

/// 真实实现：绝对路径程序 + 隐藏窗口 + 硬超时 + 不弹凭据提示。
pub struct ProcessRunner;

impl Runner for ProcessRunner {
    fn run(&self, program: &Path, args: &[String], cwd: &str, timeout: Duration) -> ExecResult {
        if !program.is_file() {
            return ExecResult::failed(
                ExecState::NotFound,
                format!("git 绝对路径候选不存在：{}", program.display()),
            );
        }
        let mut cmd = Command::new(program);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd.current_dir(cwd)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // 不继承仓库外可能存在的 git 环境（会让判定与实际执行不一致）。
            .env_remove("GIT_DIR")
            .env_remove("GIT_WORK_TREE")
            .env_remove("GIT_INDEX_FILE")
            // 只读命令不取可选锁（避免与并发写 index 的会话互相挂住）。
            .env("GIT_OPTIONAL_LOCKS", "0")
            // 绝不弹凭据提示：需要提示的仓库直接失败，而不是挂到超时。
            .env("GIT_TERMINAL_PROMPT", "0");

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(err) => {
                let state = if err.kind() == std::io::ErrorKind::NotFound {
                    ExecState::NotFound
                } else {
                    ExecState::SpawnFailed
                };
                return ExecResult::failed(state, format!("派生失败：{err}"));
            }
        };
        let out_pipe = match child.stdout.take() {
            Some(p) => p,
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return ExecResult::failed(ExecState::IoFailed, "stdout 管道不可用".into());
            }
        };
        let err_pipe = match child.stderr.take() {
            Some(p) => p,
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return ExecResult::failed(ExecState::IoFailed, "stderr 管道不可用".into());
            }
        };

        let (otx, orx) = mpsc::channel::<(Vec<u8>, Option<String>)>();
        thread::spawn(move || {
            use std::io::Read;
            let mut buf = Vec::new();
            let mut handle = out_pipe;
            let msg = match handle.read_to_end(&mut buf) {
                Ok(_) => (buf, None),
                Err(err) => (Vec::new(), Some(err.to_string())),
            };
            let _ = otx.send(msg);
        });
        let (etx, erx) = mpsc::channel::<(String, Option<String>)>();
        thread::spawn(move || {
            use std::io::Read;
            let mut buf = Vec::new();
            let mut handle = err_pipe;
            let msg = match handle.read_to_end(&mut buf) {
                Ok(_) => (String::from_utf8_lossy(&buf).into_owned(), None),
                Err(err) => (String::new(), Some(err.to_string())),
            };
            let _ = etx.send(msg);
        });
        // 有界等待退出。用 `try_wait` 轮询而**不是**把 child 交给等待线程 ——
        // 主线程必须始终持有 child，否则超时后无法把它杀掉，会留下 git 孤儿进程
        // （本仓 §80 记过"提交像死掉了"那一型：git 调用一旦无界挂起就没人能收）。
        let deadline = Instant::now() + timeout;
        let mut exited = false;
        let mut code: Option<i32> = None;
        let mut exit_error: Option<String> = None;
        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    exited = true;
                    code = status.code();
                    break;
                }
                Ok(None) => {
                    if Instant::now() >= deadline {
                        break;
                    }
                    thread::sleep(Duration::from_millis(20));
                }
                Err(err) => {
                    exit_error = Some(format!("等待子进程状态失败：{err}"));
                    break;
                }
            }
        }
        let timed_out = !exited && exit_error.is_none();
        if !exited {
            let _ = child.kill();
            let _ = child.wait();
        }
        // 进程已终止/已杀掉 ⇒ 管道必然出结果，给一小段宽限而不是继续等满预算。
        let pipe_deadline = Instant::now() + Duration::from_millis(500);
        let mut outcome_stderr = String::new();
        let mut outcome_stdout: Vec<u8> = Vec::new();
        let mut io_detail: Option<String> = None;
        match recv_within(&orx, pipe_deadline) {
            Some((bytes, None)) => outcome_stdout = bytes,
            Some((_, Some(err))) => io_detail = Some(format!("读 stdout 失败：{err}")),
            None => {
                io_detail = Some(if timed_out {
                    String::new()
                } else {
                    "stdout 通道在预算内未返回（读线程失联）".to_string()
                })
            }
        }
        match recv_within(&erx, pipe_deadline) {
            Some((text, None)) => outcome_stderr = text,
            Some((_, Some(err))) => {
                if io_detail.is_none() {
                    io_detail = Some(format!("读 stderr 失败：{err}"))
                }
            }
            None => {
                if io_detail.is_none() && !timed_out {
                    io_detail = Some("stderr 通道在预算内未返回（读线程失联）".to_string())
                }
            }
        }

        if let Some(detail) = exit_error {
            return ExecResult::failed(ExecState::IoFailed, detail);
        }
        if let Some(detail) = io_detail {
            if timed_out || detail.is_empty() {
                return ExecResult::failed(
                    ExecState::TimedOut,
                    format!("子进程在 {}ms 内未返回（已强杀）", timeout.as_millis()),
                );
            }
            return ExecResult::failed(ExecState::IoFailed, detail);
        }
        if timed_out {
            return ExecResult::failed(
                ExecState::TimedOut,
                format!("子进程在 {}ms 内未返回（已强杀）", timeout.as_millis()),
            );
        }
        ExecResult {
            state: ExecState::Exited,
            exit: code,
            stdout: outcome_stdout,
            stderr: truncate_chars(&outcome_stderr, 2000),
            detail: String::new(),
        }
    }
}

fn recv_within<T>(rx: &mpsc::Receiver<T>, deadline: Instant) -> Option<T> {
    let now = Instant::now();
    let budget = if deadline > now {
        deadline - now
    } else {
        Duration::from_millis(0)
    };
    rx.recv_timeout(budget).ok()
}

fn truncate_chars(s: &str, max: usize) -> String {
    let mut out: String = s.trim_end().chars().take(max).collect();
    if s.chars().count() > max {
        out.push('…');
    }
    out
}

fn env_abs(v: Option<String>, tail: &str) -> Option<PathBuf> {
    v.filter(|s| !s.trim().is_empty())
        .map(|s| PathBuf::from(s.trim()).join(tail))
}

/// git 二进制**绝对路径**候选表（顺序即优先级）。
///
/// 刻意**不**放裸 `"git"`：依赖 PATH 查找会在服务账户 / 干净环境下静默找不到，
/// 而"找不到"必须是显式的 `MissingBinary`，不是"看起来没有改动"。
pub fn git_binary_candidates(get_env: &dyn Fn(&str) -> Option<String>) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    if let Some(explicit) = get_env(ENV_GIT_BIN) {
        if !explicit.trim().is_empty() {
            out.push(PathBuf::from(explicit.trim()));
        }
    }
    if cfg!(windows) {
        let bases = [
            env_abs(get_env("PROGRAMFILES"), "Git/cmd/git.exe"),
            env_abs(get_env("PROGRAMFILES"), "Git/bin/git.exe"),
            env_abs(get_env("PROGRAMFILES(X86)"), "Git/cmd/git.exe"),
            env_abs(get_env("LOCALAPPDATA"), "Programs/Git/cmd/git.exe"),
            // 本仓脚本层首选的便携 git（见 scripts/lib/gitdir.mjs），同一台机上两份常同时存在。
            get_env("USERPROFILE")
                .filter(|s| !s.trim().is_empty())
                .map(|s| PathBuf::from(s.trim()).join(".workbuddy/binaries/PortableGit/cmd/git.exe")),
        ];
        for candidate in bases.into_iter().flatten() {
            out.push(candidate);
        }
        out.push(PathBuf::from("C:/Program Files/Git/cmd/git.exe"));
    } else {
        for path in ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"] {
            out.push(PathBuf::from(path));
        }
    }
    // 去重（保持顺序）：同一路径由不同来源给出时不重复探测。
    let mut seen: Vec<PathBuf> = Vec::new();
    for candidate in out {
        if !seen.contains(&candidate) {
            seen.push(candidate);
        }
    }
    seen
}

/// 探测注入（`probe` 是真 FS 判定；单测给假表 ⇒ 这条判据可确定性覆盖）。
pub fn resolve_git_binary(
    candidates: &[PathBuf],
    probe: &dyn Fn(&Path) -> bool,
) -> Option<PathBuf> {
    candidates.iter().find(|p| probe(p.as_path())).cloned()
}

pub fn missing_binary_reason(candidates: &[PathBuf]) -> String {
    let mut listed = Vec::new();
    for p in candidates.iter().take(6) {
        listed.push(p.display().to_string());
    }
    format!(
        "绝对路径候选 {} 个全部不存在（前 {} 个：{}）。设置 {} 可指向本机 git。刻意不回退 PATH 查找 —— 那种「找不到」会静默变成「没有改动」。",
        candidates.len(),
        listed.len(),
        listed.join(" | "),
        ENV_GIT_BIN
    )
}

/// 组装 status 参数（纯函数，便于逐字断言）。`--` 分隔保证路径不会被当选项注入。
pub fn status_args(root: &str, scope: Option<&str>) -> Vec<String> {
    let mut args = vec![
        "-c".to_string(),
        "safe.directory=*".to_string(),
        "-C".to_string(),
        root.to_string(),
        "status".to_string(),
        "--porcelain=v1".to_string(),
        "-z".to_string(),
    ];
    if let Some(rel) = scope {
        args.push("--".to_string());
        args.push(rel.to_string());
    }
    args
}

/// `rev-parse --show-toplevel` 的参数（授权证明用）。
pub fn toplevel_args(root: &str) -> Vec<String> {
    vec![
        "-c".to_string(),
        "safe.directory=*".to_string(),
        "-C".to_string(),
        root.to_string(),
        "rev-parse".to_string(),
        "--show-toplevel".to_string(),
    ]
}

/// 把 toplevel 输出与请求的 root 做**双向包含** ⇒ 等值判定（容忍 `\`/`/` 与卷大小写差异）。
pub fn toplevel_matches(raw_stdout: &[u8], requested_root: &str, fold: bool) -> Result<bool, Blindness> {
    if raw_stdout.is_empty() {
        return Ok(false);
    }
    let text = match std::str::from_utf8(raw_stdout) {
        Ok(s) => s,
        Err(_) => return Err(Blindness::SuspiciousInput),
    };
    let reported = text.trim_end_matches(|c: char| c == '\n' || c == '\r');
    if reported.is_empty() {
        return Ok(false);
    }
    if reported.contains('\n') {
        // show-toplevel 只应给一行；多行说明取到的不是我以为的输出。
        return Err(Blindness::Parse);
    }
    let a = path_within_root(reported, requested_root, fold);
    let b = path_within_root(requested_root, reported, fold);
    Ok(a.is_inside() && b.is_inside())
}

/// 一次调用的输入。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestSpec {
    pub root: String,
    pub scope: Option<String>,
}

/// 宿主侧配置（由 IPC 层从环境/状态装配；本层不读环境，保证可测）。
#[derive(Debug, Clone)]
pub struct Config {
    /// 允许的基目录（绝对路径）。空 = 无从判定 ⇒ 一律不放行。
    pub bases: Vec<String>,
    pub git_candidates: Vec<PathBuf>,
    pub timeout: Duration,
    pub fold_case: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            bases: Vec::new(),
            git_candidates: Vec::new(),
            timeout: Duration::from_millis(DEFAULT_TIMEOUT_MS),
            fold_case: cfg!(windows),
        }
    }
}

/// 授权判定（纯）。`Pass` / `Refuse`（含原因类别）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Gate {
    Pass,
    Refuse { kind: Blindness, reason: String },
}

impl Gate {
    pub fn is_pass(&self) -> bool {
        matches!(self, Gate::Pass)
    }
}

/// root 必须落在某个 permitted base 之内（或等于它），否则拒。
pub fn check_root_within_bases(root: &str, bases: &[String], fold: bool) -> Gate {
    if bases.is_empty() {
        return Gate::Refuse {
            kind: Blindness::OutOfBounds,
            reason: format!(
                "宿主没有登记任何允许基目录（{} 未设且用户主目录不可用），无从判定授权边界 ⇒ 拒绝，不按放行处理",
                ENV_GIT_BASES
            ),
        };
    }
    let mut saw_undetermined = 0usize;
    for base in bases {
        match path_within_root(base, root, fold) {
            Contain::Inside => return Gate::Pass,
            Contain::Outside => {}
            Contain::Undetermined => saw_undetermined += 1,
        }
    }
    if saw_undetermined > 0 {
        return Gate::Refuse {
            kind: Blindness::SuspiciousInput,
            reason: format!("root 或基目录语法无法判定（可疑规格 {saw_undetermined} 处）：{root:?}"),
        };
    }
    Gate::Refuse {
        kind: Blindness::OutOfBounds,
        reason: format!("root {root:?} 不在任何允许的基目录之内（登记 {} 个）", bases.len()),
    }
}

/// scope（前端自报的相对路径）判据。
pub fn check_scope(scope: Option<&str>) -> Gate {
    let rel = match scope {
        None => return Gate::Pass,
        Some(r) => r,
    };
    match classify_rel_target(rel) {
        Contain::Inside => Gate::Pass,
        Contain::Outside => Gate::Refuse {
            kind: Blindness::OutOfBounds,
            reason: format!("请求路径越出工作区根（绝对路径或 .. 逃逸）：{rel:?}"),
        },
        Contain::Undetermined => Gate::Refuse {
            kind: Blindness::SuspiciousInput,
            reason: format!("请求路径含无法判定的语法（verbatim/UNC/控制符）：{rel:?}"),
        },
    }
}

fn refused(gate: Gate) -> EngineOutcome {
    match gate {
        Gate::Pass => unreachable!("refused() 只接受非 Pass 判定"),
        Gate::Refuse { kind, reason } => EngineOutcome::Undetermined { kind, reason },
    }
}

/// 把"子进程结果 + porcelain 判据"折叠成三态。**核心约束**：
/// 非零退出永远是 `CommandFailed`，即使 stdout 里有一副看起来能解析的样子。
/// `parsed` 的错误位带 `Blindness` —— 否则"超预算"会被折叠成"解析失败"，
/// 而这两类的处置动作完全不同（前者要分页/缩范围，后者要补解析器）。
pub fn classify_exec(
    exec: &ExecResult,
    parsed: Result<Vec<StatusEntry>, (Blindness, String)>,
) -> EngineOutcome {
    match exec.state {
        ExecState::NotFound => EngineOutcome::Undetermined {
            kind: Blindness::MissingBinary,
            reason: exec.detail.clone(),
        },
        ExecState::SpawnFailed => EngineOutcome::Undetermined {
            kind: Blindness::Spawn,
            reason: exec.detail.clone(),
        },
        ExecState::IoFailed => EngineOutcome::Undetermined {
            kind: Blindness::Io,
            reason: format!("读取子进程输出失败：{}", exec.detail),
        },
        ExecState::TimedOut => EngineOutcome::Undetermined {
            kind: Blindness::Timeout,
            reason: exec.detail.clone(),
        },
        ExecState::Exited => {
            if let Some(code) = exec.exit {
                if code != 0 {
                    return EngineOutcome::CommandFailed {
                        exit_code: Some(code),
                        stderr: if exec.stderr.trim().is_empty() {
                            exec.detail.clone()
                        } else {
                            exec.stderr.clone()
                        },
                        git_binary: String::new(),
                        args: Vec::new(),
                    };
                }
            } else {
                return EngineOutcome::Undetermined {
                    kind: Blindness::NoExitCode,
                    reason: "子进程无退出码（被信号/异常终止），不足以判定\"无改动\"".into(),
                };
            }
            match parsed {
                Ok(entries) => EngineOutcome::Facts {
                    root: String::new(),
                    git_binary: String::new(),
                    scope: None,
                    entries,
                },
                Err((kind, reason)) => EngineOutcome::Undetermined { kind, reason },
            }
        }
    }
}

fn parse_status_bytes(raw: &[u8]) -> Result<Vec<StatusEntry>, (Blindness, String)> {
    match parse_porcelain_z(raw) {
        Ok(entries) if entries.len() > MAX_REPORTED_ENTRIES => Err((
            Blindness::Budget,
            format!(
                "变更条目 {} 条超过单次回报预算 {}，清单不完整（拒绝出具合格证）",
                entries.len(),
                MAX_REPORTED_ENTRIES
            ),
        )),
        Ok(entries) => Ok(entries),
        Err(err) => Err((Blindness::Parse, err.reason())),
    }
}

/// root 的**授权证明**（不含 status）：bases 边界 → git 二进制 → `rev-parse --show-toplevel`
/// 必须与请求 root 等值。单独成口是因为"授权"这件事不该取决于仓库有多大 ——
/// 上一版把两步揉在 `local_status` 里，于是变更条目超预算的仓库**永远无法被授权**
/// （status 判 `Budget` ⇒ 不写 authorized_root ⇒ 下一次还是判不了）。
/// 成功返回实际使用的 git 绝对路径（供回读，"用了哪份配置"必须是返回值不是日志行）。
pub fn verify_root(
    cfg: &Config,
    root: &str,
    resolved: Option<&Path>,
    runner: &dyn Runner,
) -> Result<String, EngineOutcome> {
    let gate = check_root_within_bases(root, &cfg.bases, cfg.fold_case);
    if !gate.is_pass() {
        return Err(refused(gate));
    }
    let binary = match resolved {
        Some(b) => b.to_path_buf(),
        None => {
            return Err(EngineOutcome::Undetermined {
                kind: Blindness::MissingBinary,
                reason: missing_binary_reason(&cfg.git_candidates),
            })
        }
    };
    let binary_str = binary.display().to_string();
    let args = toplevel_args(root);
    let tp = runner.run(&binary, &args, root, cfg.timeout);
    match classify_exec(&tp, Ok(Vec::new())) {
        EngineOutcome::CommandFailed {
            exit_code, stderr, ..
        } => {
            return Err(EngineOutcome::CommandFailed {
                git_binary: binary_str,
                args,
                exit_code,
                stderr,
            })
        }
        EngineOutcome::Facts { .. } => {}
        EngineOutcome::Undetermined { kind, reason } => return Err(EngineOutcome::Undetermined { kind, reason }),
    }
    match toplevel_matches(&tp.stdout, root, cfg.fold_case) {
        Ok(true) => Ok(binary_str),
        Ok(false) => Err(EngineOutcome::Undetermined {
            kind: Blindness::OutOfBounds,
            reason: format!(
                "git 确认的 worktree 顶层与请求 root 不一致（拒绝把父仓库的 .git 借给子目录用）：请求 {:?}，git 报 {:?}",
                root,
                String::from_utf8_lossy(&tp.stdout).trim_end()
            ),
        }),
        Err(kind) => Err(EngineOutcome::Undetermined {
            kind,
            reason: "rev-parse --show-toplevel 输出无法判定".into(),
        }),
    }
}

/// 通道主入口。`resolved` 由调用方用 FS 探测得到（`resolve_git_binary`），
/// 这样本函数在单测里可注入假二进制路径而完全不碰文件系统。
pub fn local_status(
    cfg: &Config,
    req: &RequestSpec,
    resolved: Option<&Path>,
    runner: &dyn Runner,
) -> EngineOutcome {
    let gate = check_scope(req.scope.as_deref());
    if !gate.is_pass() {
        return refused(gate);
    }
    let binary_str = match verify_root(cfg, &req.root, resolved, runner) {
        Ok(binary) => binary,
        Err(outcome) => return outcome,
    };

    let args = status_args(&req.root, req.scope.as_deref());
    let exec = runner.run(
        Path::new(&binary_str),
        &args,
        &req.root,
        cfg.timeout,
    );
    let mut outcome = classify_exec(&exec, parse_status_bytes(&exec.stdout));
    if let EngineOutcome::CommandFailed {
        git_binary,
        args: a,
        ..
    } = &mut outcome
    {
        // 补上命令上下文（classify_exec 不持有它们）。
        *git_binary = binary_str.clone();
        *a = args.clone();
    }
    if let EngineOutcome::Facts {
        root,
        git_binary,
        scope,
        ..
    } = &mut outcome
    {
        *root = req.root.clone();
        *git_binary = binary_str;
        *scope = req.scope.clone();
    }
    outcome
}

/// 计数摘要（前端徽章用；`undetermined` 与 `clean` 必须是不同结论）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusSummary {
    pub verdict: String,
    pub total: usize,
    pub by_kind: Vec<(String, usize)>,
    pub undetermined_kind: Option<String>,
}

pub fn summarize(outcome: &EngineOutcome) -> StatusSummary {
    match outcome {
        EngineOutcome::Facts { entries, .. } => {
            let mut counts: Vec<(ChangeKind, usize)> = Vec::new();
            for entry in entries {
                if let Some(slot) = counts.iter_mut().find(|entry_slot| entry_slot.0 == entry.kind) {
                    slot.1 += 1;
                } else {
                    counts.push((entry.kind, 1));
                }
            }
            counts.sort_by_key(|(kind, _)| kind.as_str());
            StatusSummary {
                verdict: if entries.is_empty() { "clean" } else { "dirty" }.into(),
                total: entries.len(),
                by_kind: counts
                    .into_iter()
                    .map(|(k, n)| (k.as_str().to_string(), n))
                    .collect(),
                undetermined_kind: None,
            }
        }
        EngineOutcome::CommandFailed { exit_code, .. } => StatusSummary {
            verdict: "command-failed".into(),
            total: 0,
            by_kind: Vec::new(),
            undetermined_kind: Some(format!("exit={}", exit_code.map(|c| c.to_string()).unwrap_or_else(|| "none".into()))),
        },
        EngineOutcome::Undetermined { kind, .. } => StatusSummary {
            verdict: "undetermined".into(),
            total: 0,
            by_kind: Vec::new(),
            undetermined_kind: Some(kind.as_str().to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    struct Scripted {
        replies: RefCell<Vec<ExecResult>>,
        pub calls: RefCell<Vec<(String, Vec<String>, String)>>,
    }

    impl Scripted {
        fn new(replies: Vec<ExecResult>) -> Self {
            Scripted {
                replies: RefCell::new(replies),
                calls: RefCell::new(Vec::new()),
            }
        }
    }

    impl Runner for Scripted {
        fn run(&self, program: &Path, args: &[String], cwd: &str, _t: Duration) -> ExecResult {
            self.calls
                .borrow_mut()
                .push((program.display().to_string(), args.to_vec(), cwd.to_string()));
            let mut replies = self.replies.borrow_mut();
            if replies.is_empty() {
                return ExecResult {
                    state: ExecState::Exited,
                    exit: Some(0),
                    stdout: Vec::new(),
                    stderr: String::new(),
                    detail: String::new(),
                };
            }
            replies.remove(0)
        }
    }

    fn ok_z(body: &str) -> ExecResult {
        ExecResult {
            state: ExecState::Exited,
            exit: Some(0),
            stdout: body.as_bytes().to_vec(),
            stderr: String::new(),
            detail: String::new(),
        }
    }

    fn exit_with(code: i32, stderr: &str, stdout: &str) -> ExecResult {
        ExecResult {
            state: ExecState::Exited,
            exit: Some(code),
            stdout: stdout.as_bytes().to_vec(),
            stderr: stderr.to_string(),
            detail: String::new(),
        }
    }

    fn cfg_with(bases: Vec<String>) -> Config {
        Config {
            bases,
            git_candidates: vec![PathBuf::from("/fake/abs/git")],
            timeout: Duration::from_millis(100),
            fold_case: false,
        }
    }

    fn req(root: &str, scope: Option<&str>) -> RequestSpec {
        RequestSpec {
            root: root.to_string(),
            scope: scope.map(|s| s.to_string()),
        }
    }

    const ROOT: &str = "/work/proj";
    const GIT: &str = "/usr/bin/git";

    fn toplevel_ok() -> ExecResult {
        ok_z(&format!("{ROOT}\n"))
    }

    // ---------- 三态不折叠 ----------

    #[test]
    fn facts_flows_end_to_end_with_scripted_runner() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(vec![toplevel_ok(), ok_z("M  src/a.rs\u{0}?? new.txt\u{0}")]);
        let outcome = local_status(&cfg, &req(ROOT, None), Some(Path::new(GIT)), &runner);
        match &outcome {
            EngineOutcome::Facts {
                root,
                git_binary,
                entries,
                scope,
            } => {
                assert_eq!(root, ROOT);
                assert_eq!(git_binary, GIT);
                assert!(scope.is_none());
                assert_eq!(entries.len(), 2);
                assert_eq!(entries[0].kind, ChangeKind::Modified);
                assert_eq!(entries[1].kind, ChangeKind::Untracked);
            }
            other => panic!("应为 Facts，实得 {other:?}"),
        }
        let calls = runner.calls.borrow();
        assert_eq!(calls.len(), 2);
        assert!(calls[1].1.contains(&"--porcelain=v1".to_string()));
        assert!(calls[1].1.contains(&"-z".to_string()));
        assert!(calls[1].1.contains(&"safe.directory=*".to_string()));
        assert_eq!(calls[1].2, ROOT, "子进程工作目录必须是已授权的 root");
    }

    #[test]
    fn empty_output_is_clean_facts_not_undetermined() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(vec![toplevel_ok(), ok_z("")]);
        let outcome = local_status(&cfg, &req(ROOT, None), Some(Path::new(GIT)), &runner);
        assert!(outcome.is_facts(), "空输出 = 确认无改动");
        assert_eq!(summarize(&outcome).verdict, "clean");
    }

    #[test]
    fn malformed_output_is_undetermined_not_clean() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        // 合法退出的 git 吐出行形态（没有 -z 该有的 NUL，且状态码未知）⇒ 必须判不了。
        let runner = Scripted::new(vec![toplevel_ok(), ok_z("ZZ bogus status line")]);
        let outcome = local_status(&cfg, &req(ROOT, None), Some(Path::new(GIT)), &runner);
        assert_eq!(
            outcome.undetermined_kind(),
            Some(Blindness::Parse),
            "解析失败不得折叠成无改动：{outcome:?}"
        );
        let summary = summarize(&outcome);
        assert_eq!(summary.verdict, "undetermined");
        assert_eq!(summary.total, 0);
    }

    #[test]
    fn nonzero_exit_is_command_failed_even_with_parseable_stdout() {
        // 关键反例：git 非零退出但 stdout 里躺着一副可读的清单 —— 绝不能当 Facts。
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(vec![
            toplevel_ok(),
            exit_with(128, "fatal: not a git repository", "M  a.rs\u{0}"),
        ]);
        let outcome = local_status(&cfg, &req(ROOT, None), Some(Path::new(GIT)), &runner);
        match &outcome {
            EngineOutcome::CommandFailed {
                exit_code,
                stderr,
                args,
                git_binary,
            } => {
                assert_eq!(*exit_code, Some(128));
                assert!(stderr.contains("not a git repository"), "stderr 原文要能诊断");
                assert!(args.contains(&"--porcelain=v1".to_string()));
                assert_eq!(git_binary, GIT);
            }
            other => panic!("非零退出必须是 CommandFailed，实得 {other:?}"),
        }
        assert!(!outcome.is_facts());
    }

    #[test]
    fn timeout_and_missing_binary_are_undetermined_with_distinct_kinds() {
        for (state, expect) in [
            (ExecState::TimedOut, Blindness::Timeout),
            (ExecState::NotFound, Blindness::MissingBinary),
            (ExecState::SpawnFailed, Blindness::Spawn),
            (ExecState::IoFailed, Blindness::Io),
        ] {
            let exec = ExecResult {
                state,
                exit: Some(0),
                stdout: Vec::new(),
                stderr: String::new(),
                detail: "x".into(),
            };
            let got = classify_exec(&exec, Ok(Vec::new()));
            assert_eq!(got.undetermined_kind(), Some(expect), "{expect:?} 不得被 Some(0) 洗白");
        }
        // 无退出码（被信号杀）也算判不了，不是零改动。
        let signalled = ExecResult {
            state: ExecState::Exited,
            exit: None,
            stdout: Vec::new(),
            stderr: String::new(),
            detail: String::new(),
        };
        assert_eq!(
            classify_exec(&signalled, Ok(Vec::new())).undetermined_kind(),
            Some(Blindness::NoExitCode)
        );
    }

    // ---------- ③ 越界 / 授权边界 ----------

    #[test]
    fn escaping_scope_is_refused_before_any_spawn() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(Vec::new());
        let outcome = local_status(
            &cfg,
            &req(ROOT, Some("../secrets/id_rsa")),
            Some(Path::new(GIT)),
            &runner,
        );
        assert_eq!(outcome.undetermined_kind(), Some(Blindness::OutOfBounds));
        assert!(
            runner.calls.borrow().is_empty(),
            "越界请求必须在派生子进程之前就拒掉"
        );
        assert!(matches!(
            check_scope(Some("/etc/passwd")),
            Gate::Refuse {
                kind: Blindness::OutOfBounds,
                ..
            }
        ));
        assert!(matches!(
            check_scope(Some("\\\\?\\C:\\Windows")),
            Gate::Refuse {
                kind: Blindness::SuspiciousInput,
                ..
            }
        ));
        assert!(check_scope(Some("src/app.rs")).is_pass());
        assert!(check_scope(None).is_pass());
    }

    #[test]
    fn root_outside_bases_is_refused() {
        assert!(matches!(
            check_root_within_bases("/etc", &["/work".to_string()], false),
            Gate::Refuse {
                kind: Blindness::OutOfBounds,
                ..
            }
        ));
        // 字符串前缀相同但目录不同 —— 组件级判据的价值就在这里。
        assert!(matches!(
            check_root_within_bases("/work-OTHER/x", &["/work".to_string()], false),
            Gate::Refuse {
                kind: Blindness::OutOfBounds,
                ..
            }
        ));
        assert!(check_root_within_bases("/work/proj", &["/work".to_string()], false).is_pass());
    }

    #[test]
    fn empty_base_registry_refuses_instead_of_defaulting_open() {
        let gate = check_root_within_bases("/anywhere", &[], false);
        assert!(
            matches!(gate, Gate::Refuse { kind: Blindness::OutOfBounds, .. }),
            "没有登记表 ⇒ 边界无从判定，绝不能算通过"
        );
        assert!(!gate.is_pass());
    }

    #[test]
    fn root_must_be_worktree_toplevel_not_a_nested_subdir() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        // git 说真正的顶层是 /work/proj，而请求打的是它下面的 apps/cli ⇒ 拒。
        let runner = Scripted::new(vec![ok_z("/work/proj\n"), ok_z("")]);
        let outcome = local_status(
            &cfg,
            &req("/work/proj/apps/cli", None),
            Some(Path::new(GIT)),
            &runner,
        );
        assert_eq!(outcome.undetermined_kind(), Some(Blindness::OutOfBounds));
        let reason = match &outcome {
            EngineOutcome::Undetermined { reason, .. } => reason.clone(),
            other => panic!("{other:?}"),
        };
        assert!(reason.contains("worktree 顶层"), "原因要说明是哪一步拦的：{reason}");
    }

    #[test]
    fn toplevel_equality_tolerates_separator_and_case_but_not_prefix() {
        assert!(toplevel_matches(b"/work/proj\n", "/work/proj", false).unwrap());
        assert!(toplevel_matches(b"C:/Work/Proj\r\n", "C:\\work\\proj", true).unwrap());
        assert!(!toplevel_matches(b"C:/Work/Proj", "C:/Work/Proj/apps", true).unwrap());
        assert!(!toplevel_matches(b"", "/work/proj", false).unwrap());
        assert_eq!(
            toplevel_matches(b"a\nb\n", "/work/proj", false).err(),
            Some(Blindness::Parse),
            "多行输出说明取到的不是预期字段 ⇒ 判不了"
        );
    }

    // ---------- git 二进制解析（绝对路径候选） ----------

    #[test]
    fn candidates_are_absolute_and_never_rely_on_path_lookup() {
        // 夹具里的显式覆盖路径按宿主取形：Windows 上 `/opt/...` 不是绝对路径
        // （缺盘符前缀），拿它断言 is_absolute 会得到一条与判据无关的红。
        let override_path = if cfg!(windows) { "C:/opt/custom/git.exe" } else { "/opt/custom/git" };
        let env = |k: &str| -> Option<String> {
            match k {
                "IHUI_GIT_BIN" => Some(override_path.to_string()),
                _ => None,
            }
        };
        let list = git_binary_candidates(&env);
        assert_eq!(
            list.first().map(|p| p.display().to_string()),
            Some(override_path.to_string()),
            "显式覆盖必须排第一"
        );
        assert!(
            !list.iter().any(|p| p.display().to_string() == "git"),
            "候选表里不得出现裸 `git`（那等于依赖 PATH）"
        );
        assert!(
            list.iter().all(|p| p.is_absolute()),
            "候选必须全是绝对路径，实得 {list:?}"
        );
        let probe = |p: &Path| -> bool { p == Path::new(override_path) };
        assert_eq!(
            resolve_git_binary(&list, &probe),
            Some(PathBuf::from(override_path))
        );
        assert_eq!(resolve_git_binary(&list, &|_| false), None);
        let reason = missing_binary_reason(&list);
        assert!(
            reason.contains("IHUI_GIT_BIN"),
            "给出路：{}",
            reason
        );
    }

    #[test]
    fn missing_binary_short_circuits_before_spawn() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(Vec::new());
        let outcome = local_status(&cfg, &req(ROOT, None), None, &runner);
        assert_eq!(outcome.undetermined_kind(), Some(Blindness::MissingBinary));
        assert!(runner.calls.borrow().is_empty(), "没有二进制就不该派生任何东西");
    }

    // ---------- 参数组装 ----------

    #[test]
    fn args_carry_hardening_flags_and_dashdash_guard() {
        let args = status_args("/work/proj", Some("src/a.rs"));
        assert_eq!(
            args,
            vec![
                "-c",
                "safe.directory=*",
                "-C",
                "/work/proj",
                "status",
                "--porcelain=v1",
                "-z",
                "--",
                "src/a.rs"
            ]
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<String>>()
        );
        assert!(!status_args("/work/proj", None).contains(&"--".to_string()));
        assert!(toplevel_args("/work/proj").contains(&"rev-parse".to_string()));
    }

    #[test]
    fn scoped_request_reports_scope_in_facts() {
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(vec![toplevel_ok(), ok_z(" M a.rs\u{0}")]);
        let outcome = local_status(&cfg, &req(ROOT, Some("a.rs")), Some(Path::new(GIT)), &runner);
        match &outcome {
            EngineOutcome::Facts { scope, entries, .. } => {
                assert_eq!(scope.as_deref(), Some("a.rs"));
                assert_eq!(entries.len(), 1);
            }
            other => panic!("{other:?}"),
        }
        assert_eq!(summarize(&outcome).by_kind, vec![("modified".to_string(), 1usize)]);
    }

    #[test]
    fn oversized_result_is_budget_not_truncated_facts() {
        let mut body = String::new();
        for i in 0..(MAX_REPORTED_ENTRIES + 1) {
            body.push_str(&format!(" M f{i}.rs\u{0}"));
        }
        let cfg = cfg_with(vec!["/work".to_string()]);
        let runner = Scripted::new(vec![toplevel_ok(), ok_z(&body)]);
        let outcome = local_status(&cfg, &req(ROOT, None), Some(Path::new(GIT)), &runner);
        assert_eq!(outcome.undetermined_kind(), Some(Blindness::Budget));
    }

    /// 真派生一个会拖满预算的子进程，验证超时分支**真的把进程杀掉**并显式报 TimedOut。
    ///
    /// 这段代码（try_wait 轮询 + 主线程持有 child + kill + 宽限收管道）没法用假 runner
    /// 覆盖，只靠"看起来对"就是本仓 §80 记过的"提交像死掉了"那一型。
    #[test]
    #[ignore = "派生真子进程（默认不跑）"]
    fn real_timeout_kills_the_child_and_reports_timeout() {
        let (program, args) = if cfg!(windows) {
            // 直接派生 ping.exe（-n 30 ⇒ 约 29s），**不经 cmd** ——
            // 上一版夹具用了 `cmd /C "ping ... >nul"`，cmd 把自己收到的引号串判成
            // "命令语法不正确"并以非零退出，于是测试红在夹具上而不是判据上（夹具错与
            // 生产错修法相反，必须先分清）。
            let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
            (
                PathBuf::from(root).join("System32").join("ping.exe"),
                vec!["-n".to_string(), "30".to_string(), "127.0.0.1".to_string()],
            )
        } else {
            (PathBuf::from("/bin/sleep"), vec!["30".to_string()])
        };
        assert!(program.is_file(), "夹具程序不存在：{}", program.display());
        let cwd = std::env::current_dir().expect("current_dir 不可用");
        let exec = ProcessRunner.run(
            &program,
            &args,
            &cwd.display().to_string(),
            Duration::from_millis(600),
        );
        assert_eq!(
            exec.state,
            ExecState::TimedOut,
            "超时必须显式报 TimedOut（不得当成零改动），实得 {exec:?}"
        );
        assert!(exec.detail.contains("已强杀"), "要写明已经收尸：{exec:?}");
    }

    /// 真机 git 冒烟（默认不跑）。
    ///
    /// 跑法：`IHUI_DESKTOP_GIT_SMOKE_ROOT=<绝对仓库路径> <测试二进制> --ignored --nocapture`
    #[test]
    #[ignore = "依赖本机 git 与真仓库；显式设 IHUI_DESKTOP_GIT_SMOKE_ROOT 后手动跑"]
    fn real_git_smoke_returns_facts_not_blindness() {
        let root = std::env::var("IHUI_DESKTOP_GIT_SMOKE_ROOT").expect("需设 IHUI_DESKTOP_GIT_SMOKE_ROOT");
        let candidates = git_binary_candidates(&|k: &str| std::env::var(k).ok());
        let binary = resolve_git_binary(&candidates, &|p: &Path| p.is_file())
            .expect("本机找不到绝对路径 git —— 如实失败，不降级");
        let cfg = Config {
            bases: vec![root.clone()],
            git_candidates: candidates,
            timeout: Duration::from_millis(8000),
            fold_case: cfg!(windows),
        };
        let outcome = local_status(&cfg, &req(&root, None), Some(&binary), &ProcessRunner);
        println!("smoke outcome = {outcome:?}");
        assert!(
            outcome.is_facts()
                || matches!(
                    outcome.undetermined_kind(),
                    Some(Blindness::Parse) | Some(Blindness::Budget)
                ),
            "真机跑一次既不是 Facts 也不是\"看得见的判不了\"，说明通道没通：{outcome:?}"
        );
        if let EngineOutcome::Facts { git_binary, .. } = &outcome {
            assert!(Path::new(git_binary).is_absolute());
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
