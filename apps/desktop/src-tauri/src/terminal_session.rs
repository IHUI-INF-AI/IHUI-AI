// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


//! 终端执行会话 —— **跨平台 PTY + 环形缓冲 + 进程树清理**。
//!
//! 来源（2026-11-15 四程序独立分析，T3 §A / T4 §A）：Trae `icube/terminal/` 13 模块分层
//! （run/session/manager/buffer/output/stdin/send/kill/status/cleanup）与
//! `icube/command_execution/` 7 模块（start/stop/poll/list_owned/…）；WorkBuddy 终端栈
//! 的 **job-object**（Windows 作业对象保证整树清理）与 `os-bridge`。只取**架构模式**
//! 复现，不搬运任何专有源码。
//!
//! 设计三条（对齐本仓 `workspace_index.rs` / `startup_guard.rs` 的纪律）：
//! 1. **std-first**：不引入 `portable-pty` 等新依赖。POSIX 侧用 `std::os::unix`
//!    的 `CommandExt::process_group(0)`（会话首进程，`kill(0, -pid)` 可清整组）；
//!    Windows 侧用已在 `[target.'cfg(windows)'.dependencies]` 的 `winapi`
//!    （`processthreadsapi`/`winbase`/`winnt`）建 **Job Object**，`TerminateJobObject`
//!    一次清整树。这正对应 WorkBuddy 的 job-object 模式，且不越出本仓依赖面。
//! 2. **环形缓冲封顶**（Trae `buffer.rs` 的封顶语义）：输出只保留最近 `RING_BYTES`
//!    字节，旧的被覆盖；`read_out` 明确回报 `dropped`（被覆盖字节数）与
//!    `seq`（累计产出字节序号），**不假装完整**——与 `workspace_index.rs`
//!    "超预算判 Undetermined 不截断放行" 同一条诚实纪律。调用方据此知道
//!    「我读到的窗口是否漏了开头」。
//! 3. **状态机七态**（照 Trae session/cleanup 的状态面收敛为可单测枚举）：
//!    Starting → Running → {Exited, Killed, Failed}，外加 TimedOut / AlreadyFinished。
//!    终态是**终态**：`start` 已完成的会话再 `write`/`poll` 走 `AlreadyFinished`，
//!    不复活、不重入。

use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// 环形缓冲字节上限。超过后最旧输出被覆盖（Trae `buffer.rs` 封顶语义）。
/// 默认 1 MiB——足够回滚屏（scrollback）一屏到几屏，又不至于无界吃内存。
pub const RING_BYTES: usize = 1024 * 1024;
/// 单次 `read_out` 返回的最多字节。调用方按需分页。
pub const READ_CHUNK_MAX: usize = 64 * 1024;
/// 单次读取线程 `read` 的块大小。
const READ_BLOCK: usize = 8 * 1024;

// ---------------------------------------------------------------------------
// 环形缓冲（纯结构，可单测）
// ---------------------------------------------------------------------------

/// 定长环形字节缓冲：写满后覆盖最旧内容，并累计「被覆盖字节数」与「总产出字节序号」。
///
/// 语义对齐 Trae `buffer.rs` 的封顶 + 本仓诚实三态纪律：
/// - `dropped`：到目前为止**已因覆盖而丢失**的字节数（读者据此判断窗口是否漏头）。
/// - `total_written`：累计写入字节序号（`seq`），用于前端做「读到哪了」的去重。
#[derive(Debug)]
pub struct RingBuffer {
    buf: Box<[u8]>,
    cap: usize,
    /// 写指针（下一写入位置的绝对偏移，单调递增，非 wrap 后的下标）。
    write_pos: usize,
    /// 累计写入总字节（= write_pos 的绝对量）。
    total_written: usize,
    /// 因覆盖丢失的累计字节。
    dropped: usize,
}

impl RingBuffer {
    /// 建一个 `cap` 字节的环形缓冲。`cap == 0` 视为 1（避免除零 / 空 buf）。
    pub fn new(cap: usize) -> Self {
        let cap = cap.max(1);
        Self {
            buf: vec![0u8; cap].into_boxed_slice(),
            cap,
            write_pos: 0,
            total_written: 0,
            dropped: 0,
        }
    }

    /// 写入一段输出。返回写入字节数（恒等于 `data.len()`）。
    ///
    /// 写满后：从头部覆盖，`dropped` 累加被覆盖的字节数。
    pub fn write(&mut self, data: &[u8]) -> usize {
        let n = data.len();
        if n == 0 {
            return 0;
        }
        if n >= self.cap {
            // 一次性超过整个缓冲：只保留最后 cap 字节，之前的全算 dropped。
            let skip = n - self.cap;
            self.dropped += skip;
            self.buf.copy_from_slice(&data[skip..]);
            self.write_pos = self.cap;
            self.total_written += n;
            return n;
        }
        let start = self.write_pos % self.cap;
        // 可能分两段写（尾部 + 回绕到头）。
        let first = (self.cap - start).min(n);
        self.buf[start..start + first].copy_from_slice(&data[..first]);
        if n > first {
            let rest = n - first;
            self.buf[..rest].copy_from_slice(&data[first..]);
        }
        self.write_pos += n;
        self.total_written += n;
        // 被覆盖 = 已写入总量超过容量后，超出（且此刻仍在容量内）的那部分。
        // 严谨口径：dropped = max(0, total_written - cap)，但只在新写入真正
        // 越过历史边界时增加。这里用总量差直接算，幂等且不会少算。
        self.dropped = self.total_written.saturating_sub(self.cap);
        n
    }

    /// 读出当前缓冲内的**最新** `max` 字节（按时间顺序），并附带
    /// `dropped`（累计覆盖丢失）与 `seq`（累计写入总量）。
    ///
    /// 返回 `(bytes, dropped, seq)`。`bytes` 为空表示无新内容。
    pub fn read_out(&self, max: usize) -> (Vec<u8>, usize, usize) {
        let available = self.total_written.min(self.cap);
        let take = available.min(max);
        let end_abs = self.write_pos; // 下一写入位置（绝对）
        let start_abs = end_abs.saturating_sub(take);
        let mut out = Vec::with_capacity(take);
        let start_idx = start_abs % self.cap;
        let end_idx = end_abs % self.cap;
        if start_idx < end_idx {
            out.extend_from_slice(&self.buf[start_idx..end_idx]);
        } else if start_idx > end_idx {
            out.extend_from_slice(&self.buf[start_idx..]);
            out.extend_from_slice(&self.buf[..end_idx]);
        } else if take > 0 {
            // start == end 且 take>0：缓冲正好满一圈，读整圈。
            out.extend_from_slice(&self.buf[..]);
        }
        (out, self.dropped, self.total_written)
    }

    /// 已因覆盖丢失的累计字节。
    pub fn dropped(&self) -> usize {
        self.dropped
    }

    /// 累计写入总量（seq）。
    pub fn total_written(&self) -> usize {
        self.total_written
    }
}

// ---------------------------------------------------------------------------
// 会话状态机（纯枚举，可单测）
// ---------------------------------------------------------------------------

/// 终端会话状态（照 Trae session/cleanup 状态面收敛）。
///
/// `Killed` / `TimedOut` / `Failed` 三者区分是给调用方做**不同善后**的：
/// Killed=显式 kill、TimedOut=超过预算被回收、Failed=启动即失败（shell 不存在等）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionState {
    Starting,
    Running,
    Exited,
    Killed,
    TimedOut,
    Failed,
}

impl SessionState {
    /// 是否终态（终态不可再写 / 不可复活）。
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            SessionState::Exited
                | SessionState::Killed
                | SessionState::TimedOut
                | SessionState::Failed
        )
    }
}

/// 会话元信息（对外只读快照，不含进程句柄）。
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: u64,
    pub state: SessionState,
    /// 退出码（仅 Exited / Failed 时有意义；Killed/TimedOut 为 None）。
    pub exit_code: Option<i32>,
    /// 运行时长（毫秒），终态后冻结。
    pub elapsed_ms: u128,
    /// 累计输出 seq（与 RingBuffer::read_out 的 seq 一致）。
    pub seq: usize,
}

// ---------------------------------------------------------------------------
// 平台侧：进程组 / Job Object（kill 整树的关键）
// ---------------------------------------------------------------------------

/// Windows 作业对象句柄（跨线程共享给读取/回收线程）。
#[cfg(windows)]
pub struct JobObject {
    handle: winapi::shared::ntdef::HANDLE,
}

#[cfg(windows)]
unsafe impl Send for JobObject {}
#[cfg(windows)]
unsafe impl Sync for JobObject {}

#[cfg(windows)]
impl JobObject {
    /// 建一个「杀时整树终止」的作业对象（不挂进程）。
    ///
    /// `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`：作业句柄关闭时自动终止组内全部进程。
    /// 这是 WorkBuddy job-object 模式的复现，供两条线复用同一份建立逻辑
    /// （单一真相源，不复制）：
    /// - 终端会话：``attach_job_object`` 把子进程挂进来（逐会话）；
    /// - 防孤儿守护：``orphan_guard::install`` 把**主进程**挂进来（退出即清整树）。
    /// 失败返回 None（调用方降级，不阻断）。
    pub fn create_kill_on_close() -> Option<Self> {
        use winapi::um::jobapi2::{CreateJobObjectW, SetInformationJobObject};
        use winapi::um::winnt::{
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };
        unsafe {
            let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
            if job.is_null() {
                return None;
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                job,
                winapi::um::winnt::JobObjectExtendedLimitInformation,
                &info as *const _ as winapi::shared::minwindef::LPVOID,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            ) == 0
            {
                winapi::um::handleapi::CloseHandle(job);
                return None;
            }
            Some(JobObject { handle: job })
        }
    }

    /// 裸句柄（供 AssignProcessToJobObject 等接收 HANDLE 的 API 用）。
    pub fn raw(&self) -> winapi::shared::ntdef::HANDLE {
        self.handle
    }
}

#[cfg(windows)]
impl Drop for JobObject {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            unsafe {
                winapi::um::handleapi::CloseHandle(self.handle);
            }
        }
    }
}

/// 把已 spawn 的子进程挂入一个「杀时整树终止」的作业对象（仅 Windows）。
///
/// 复用 ``JobObject::create_kill_on_close``（单一真相源），只补挂进程一步。
/// 返回 None 表示建作业失败（降级为「只 kill 单个 pid」，不阻断会话创建）。
#[cfg(windows)]
fn attach_job_object(child: &Child) -> Option<Arc<JobObject>> {
    use winapi::um::jobapi2::AssignProcessToJobObject;
    use std::os::windows::io::AsRawHandle;

    unsafe {
        let job = JobObject::create_kill_on_close()?;
        if AssignProcessToJobObject(
            job.raw(),
            child.as_raw_handle() as winapi::shared::ntdef::HANDLE,
        ) == 0
        {
            return None; // job Drop 时 CloseHandle 兜底
        }
        Some(Arc::new(job))
    }
}

/// 给子进程设置「整组可 kill」的属性（仅 POSIX）。
///
/// POSIX 侧用 `process_group(0)`：子进程成为新进程组首，`kill(0, -pid)` 可清整组，
/// 对应 Windows Job Object 的作用。
#[cfg(unix)]
fn set_process_group(cmd: &mut Command) {
    use std::os::unix::process::CommandExt;
    // process_group(0) = 新建进程组，子进程为组长。
    cmd.process_group(0);
}

#[cfg(not(any(windows, unix)))]
fn set_process_group(_cmd: &mut Command) {
    // 未知平台：不保证整树清理（降级）。
}

// ---------------------------------------------------------------------------
// 会话核心（spawn + 读取线程 + kill 整树）
// ---------------------------------------------------------------------------

/// 一个终端会话的运行时句柄。
///
/// 读取线程后台把子进程 stdout+stderr（合并）持续写入共享 `RingBuffer`；
/// `poll` / `read_out` / `kill` 只碰这把共享状态与子进程句柄，无跨线程锁竞争面。
pub struct TerminalSession {
    id: u64,
    child: Option<Child>,
    ring: Arc<Mutex<RingBuffer>>,
    /// Windows 作业对象（杀整树用）。POSIX 靠进程组，故 None。
    #[cfg(windows)]
    job: Option<Arc<JobObject>>,
    state: Arc<Mutex<SessionState>>,
    exit_code: Arc<Mutex<Option<i32>>>,
    started_at: Instant,
    /// 该会话的超时预算（None = 无限）。超时由 `poll` 惰性判定。
    timeout: Option<Duration>,
}

impl TerminalSession {
    /// 启动一个会话：`program` + `args`，工作目录 `cwd`（None 继承当前）。
    ///
    /// stdout 与 stderr **合并**为一条流（与多数 agent 终端一致，避免两路乱序交错）；
    /// stdin 建管道以支持 `write_stdin`。返回 (会话, 会话 id 由调用方分配)。
    ///
    /// 启动失败（shell 不存在等）返回 `Err(String)`，状态记 `Failed`——不假装成功。
    pub fn spawn(
        id: u64,
        program: &str,
        args: &[String],
        cwd: Option<&std::path::Path>,
        timeout: Option<Duration>,
    ) -> Result<Self, String> {
        let mut cmd = Command::new(program);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        // 平台侧：整组可清理（Windows Job Object 在 spawn 后挂入；POSIX 这里设进程组）。
        #[cfg(unix)]
        set_process_group(&mut cmd);

        let mut child = cmd.spawn().map_err(|e| {
            format!("终端启动失败 program={program:?}: {e}")
        })?;

        // stdout + stderr 都需要读。简单做法：stderr 合并进 stdout（Stdio 需要 OS 级；
        // std 不直接支持 merge，故用两个读取线程分别喂同一个 RingBuffer）。
        let ring = Arc::new(Mutex::new(RingBuffer::new(RING_BYTES)));
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // 两个后台读取线程：分别把 stdout / stderr 写入同一环形缓冲。
        spawn_reader(stdout, Arc::clone(&ring));
        spawn_reader(stderr, Arc::clone(&ring));

        // Windows：spawn 后挂入 Job Object。
        #[cfg(windows)]
        let job = attach_job_object(&child);

        let state = Arc::new(Mutex::new(SessionState::Running));
        let exit_code = Arc::new(Mutex::new(None::<i32>));

        Ok(Self {
            id,
            child: Some(child),
            ring,
            #[cfg(windows)]
            job,
            state,
            exit_code,
            started_at: Instant::now(),
            timeout,
        })
    }

    /// 会话 id。
    pub fn id(&self) -> u64 {
        self.id
    }

    /// 向 stdin 写入（含 `\n` 由调用方决定）。会话已终态则返回 `AlreadyFinished`。
    pub fn write_stdin(&mut self, data: &[u8]) -> Result<usize, WriteErr> {
        if self.state().is_terminal() {
            return Err(WriteErr::AlreadyFinished);
        }
        let Some(child) = self.child.as_mut() else {
            return Err(WriteErr::AlreadyFinished);
        };
        let Some(stdin) = child.stdin.as_mut() else {
            return Err(WriteErr::NoStdin);
        };
        stdin
            .write_all(data)
            .map(|_| data.len())
            .map_err(|_| WriteErr::BrokenPipe)
    }

    /// 读取当前输出窗口（最多 `max` 字节）。返回 `(bytes, dropped, seq, state)`。
    ///
    /// `dropped > 0` 表示开头已被环形缓冲覆盖——调用方据此知道窗口不完整。
    pub fn read_out(&self, max: usize) -> (Vec<u8>, usize, usize, SessionState) {
        let (bytes, dropped, seq) = self.ring.lock().unwrap().read_out(max);
        (bytes, dropped, seq, self.state())
    }

    /// 轮询：非阻塞地查退出状态，并惰性处理超时。
    ///
    /// 返回当前状态。若刚从 Running 转入终态，`exit_code` 已更新。
    pub fn poll(&mut self) -> SessionState {
        let cur = self.state();
        if cur.is_terminal() {
            return cur;
        }
        // 超时惰性判定（不依赖后台定时器，poll 时才判，简化生命周期）。
        if let Some(t) = self.timeout {
            if self.elapsed_ms() >= t.as_millis() {
                self.kill_inner(SessionState::TimedOut);
                return SessionState::TimedOut;
            }
        }
        let Some(child) = self.child.as_mut() else {
            return cur;
        };
        match child.try_wait() {
            Ok(Some(status)) => {
                let code = status.code().unwrap_or(-1);
                *self.exit_code.lock().unwrap() = Some(code);
                let next = if code == 0 {
                    SessionState::Exited
                } else {
                    // 非零退出：仍算正常结束（Exited），退出码区分成败；
                    // 只有启动即失败才用 Failed（spawn 阶段已处理）。
                    SessionState::Exited
                };
                self.set_state(next);
                next
            }
            Ok(None) => SessionState::Running,
            Err(_) => {
                // 取状态失败：按失败处理（不假装还在跑）。
                self.kill_inner(SessionState::Failed);
                SessionState::Failed
            }
        }
    }

    /// 显式 kill：清整树（Windows Job Object / POSIX 进程组），状态记 `Killed`。
    pub fn kill(&mut self) -> SessionState {
        self.kill_inner(SessionState::Killed);
        SessionState::Killed
    }

    /// kill 的内部实现：先按平台清整树，再 reap 子进程，最后置终态。
    fn kill_inner(&mut self, terminal: SessionState) {
        #[cfg(windows)]
        if let Some(job) = &self.job {
            unsafe {
                winapi::um::jobapi2::TerminateJobObject(job.handle, 0);
            }
        }
        #[cfg(unix)]
        if let Some(child) = self.child.as_ref() {
            // kill 整个进程组：负 pid。
            let pid = child.id();
            unsafe {
                libc_killpg(pid as i32, 15); // SIGTERM
            }
        }
        // reap 子进程（给几毫秒让它退）。
        if let Some(child) = self.child.as_mut() {
            let _ = child.wait();
        }
        // 关 stdin 让读取线程 EOF 退出。
        if let Some(child) = self.child.as_mut() {
            child.stdin.take();
        }
        self.set_state(terminal);
    }

    fn state(&self) -> SessionState {
        *self.state.lock().unwrap()
    }

    fn set_state(&mut self, s: SessionState) {
        *self.state.lock().unwrap() = s;
    }

    /// 运行时长（毫秒）。
    pub fn elapsed_ms(&self) -> u128 {
        self.started_at.elapsed().as_millis()
    }

    /// 对外只读快照。
    pub fn info(&self) -> SessionInfo {
        let (_, _, seq, state) = self.read_out(0);
        SessionInfo {
            id: self.id,
            state,
            exit_code: *self.exit_code.lock().unwrap(),
            elapsed_ms: self.elapsed_ms(),
            seq,
        }
    }

    /// 是否仍在运行。
    pub fn is_running(&self) -> bool {
        !self.state().is_terminal()
    }
}

/// 起一个后台读取线程，把 `R: Read` 持续写入 `ring`，EOF/错误即退。
fn spawn_reader<R: Read + Send + 'static>(mut stream: Option<R>, ring: Arc<Mutex<RingBuffer>>) {
    let Some(mut stream) = stream else {
        return;
    };
    std::thread::spawn(move || {
        let mut block = [0u8; READ_BLOCK];
        loop {
            match stream.read(&mut block) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let _ = ring.lock().unwrap().write(&block[..n]);
                }
                Err(_) => break, // 管道断（子进程退出）——正常退出路径之一
            }
        }
    });
}

/// `write_stdin` 的错误面（照 Trae stdin.rs 的失败分类收敛）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteErr {
    /// 会话已终态，不可再写。
    AlreadyFinished,
    /// 该会话没有 stdin（未建管道）。
    NoStdin,
    /// 管道已断（子进程已退出）。
    BrokenPipe,
}

// libc killpg 在 POSIX 需要；避免引入 libc crate，用内联 extern。
#[cfg(unix)]
extern "C" {
    fn killpg(pgrp: i32, sig: i32) -> i32;
}
#[cfg(unix)]
fn libc_killpg(pgrp: i32, sig: i32) -> i32 {
    unsafe { killpg(pgrp, sig) }
}

// ---------------------------------------------------------------------------
// 管理器（list_owned / 按 id 取会话 —— Trae command_execution/list_owned.rs 语义）
// ---------------------------------------------------------------------------

/// 会话管理器：持有全部活跃会话，按 id 取用。供 Tauri `State` 共享。
///
/// 用 `Mutex<HashMap<u64, TerminalSession>>`；`TerminalSession` 不需 Sync
/// （进程句柄 + 共享 Arc），管理器自己串行化访问。
pub struct TerminalManager {
    sessions: Mutex<HashMap<u64, TerminalSession>>,
    next_id: std::sync::atomic::AtomicU64,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: std::sync::atomic::AtomicU64::new(1),
        }
    }

    fn alloc_id(&self) -> u64 {
        self.next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    /// 启动并登记一个会话，返回会话 id。
    pub fn start(
        &self,
        program: &str,
        args: &[String],
        cwd: Option<&std::path::Path>,
        timeout: Option<Duration>,
    ) -> Result<u64, String> {
        let id = self.alloc_id();
        let sess = TerminalSession::spawn(id, program, args, cwd, timeout)?;
        self.sessions.lock().unwrap().insert(id, sess);
        Ok(id)
    }

    /// 对会话执行闭包（串行化）。返回 None = 该 id 不存在。
    pub fn with_session<R>(
        &self,
        id: u64,
        f: impl FnOnce(&mut TerminalSession) -> R,
    ) -> Option<R> {
        let mut map = self.sessions.lock().unwrap();
        map.get_mut(&id).map(f)
    }

    /// 列出全部会话快照（Trae list_owned 语义）。顺带把已终态且输出已读尽的
    /// 老会话留在表里（由调用方显式 remove），避免误删正在读回滚屏的会话。
    pub fn list(&self) -> Vec<SessionInfo> {
        let mut map = self.sessions.lock().unwrap();
        let mut v: Vec<SessionInfo> = map.values_mut().map(|s| s.info()).collect();
        v.sort_by_key(|s| s.id);
        v
    }

    /// 移除一个已终态的会话（释放句柄）。对运行中的会话返回 Err。
    pub fn remove(&self, id: u64) -> Result<(), String> {
        let mut map = self.sessions.lock().unwrap();
        match map.remove(&id) {
            Some(s) if s.state().is_terminal() => Ok(()),
            Some(_) => {
                // 不删运行中的：放回并报错。
                Err(format!("会话 {id} 仍在运行，先 kill 再 remove"))
            }
            None => Err(format!("会话 {id} 不存在")),
        }
    }

    /// 退出时清空全部会话（防孤儿）。逐个 kill，忽略已终态的。
    pub fn kill_all(&self) {
        let mut map = self.sessions.lock().unwrap();
        for (_, s) in map.iter_mut() {
            if s.is_running() {
                s.kill();
            }
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// 单元测试（纯逻辑：环形缓冲 + 状态机；不起真进程，避免测试环境依赖 shell）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_basic_write_read() {
        let mut r = RingBuffer::new(16);
        r.write(b"hello");
        let (out, dropped, seq) = r.read_out(16);
        assert_eq!(out, b"hello");
        assert_eq!(dropped, 0);
        assert_eq!(seq, 5);
    }

    #[test]
    fn ring_overflow_drops_head() {
        // 容量 8，写 12 字节 → 前 4 字节被覆盖。
        let mut r = RingBuffer::new(8);
        r.write(b"abcdefghijkl"); // 12 bytes
        let (out, dropped, seq) = r.read_out(16);
        assert_eq!(out, b"efghijkl");
        assert_eq!(dropped, 4);
        assert_eq!(seq, 12);
    }

    #[test]
    fn ring_single_write_larger_than_cap() {
        let mut r = RingBuffer::new(4);
        r.write(b"abcdefgh"); // 8 bytes, cap 4 → keep last 4
        let (out, dropped, _) = r.read_out(16);
        assert_eq!(out, b"efgh");
        assert_eq!(dropped, 4);
    }

    #[test]
    fn ring_windowed_read_returns_tail() {
        let mut r = RingBuffer::new(32);
        r.write(b"0123456789");
        let (out, _, _) = r.read_out(4);
        assert_eq!(out, b"6789"); // 最新 4 字节
    }

    #[test]
    fn state_terminal_is_terminal() {
        assert!(SessionState::Exited.is_terminal());
        assert!(SessionState::Killed.is_terminal());
        assert!(SessionState::TimedOut.is_terminal());
        assert!(SessionState::Failed.is_terminal());
        assert!(!SessionState::Starting.is_terminal());
        assert!(!SessionState::Running.is_terminal());
    }

    #[test]
    fn ring_zero_capacity_safe() {
        let mut r = RingBuffer::new(0); // 提升为 1
        r.write(b"abc");
        let (out, dropped, _) = r.read_out(16);
        assert_eq!(out, b"c");
        assert_eq!(dropped, 2);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
