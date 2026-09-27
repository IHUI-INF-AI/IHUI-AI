// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端启动守护(2026-09-27,根治"双击打不开")。
//!
//! 根因链(2026-09-27 真机日志实锤,见智汇AI.log 07:12-08:34 段):
//! 1. `tauri-plugin-single-instance` 2.4.3 的 Windows 实现有两个致命缺陷:
//!    a) 第二实例用 **无超时** 的 `SendMessageW(WM_COPYDATA)` 唤醒第一实例——
//!       第一实例主线程一旦被占住(事件循环挂死,实证:「app.exit(0) 未在 120s
//!       内终止进程」),这条发送就永远阻塞:第二实例无窗口、无日志、静默堆积在
//!       任务管理器里。用户侧表现即"双击毫无反应"。
//!    b) mutex 已存在但找不到隐藏消息窗口(`{id}-siw`)时,第二实例**直接放行继续
//!       启动**——WebView2 用户数据目录被第一实例占住,实证「failed to create
//!       webview: 0x800700AA 请求的资源在使用中」;新实例又变成一个"占着目录和
//!       mutex、既看不见也退不掉"的僵尸,级联污染之后每一次启动。
//! 2. 本模块在 `tauri::Builder` 之前用与插件完全相同的命名(`{id}-sim` mutex /
//!    `{id}-sic` 窗口类 / `{id}-siw` 窗口标题)预检:
//!    - 无其他实例 → 放行,插件照常拿 mutex、建隐藏窗口;
//!    - 有其他实例且隐藏窗口 2s 内应答 → 放行,由插件唤醒它的窗口并结束本进程
//!      (健康路径的既有行为,一字不改);
//!    - 有其他实例但隐藏窗口缺失或不应答(挂死/僵尸)→ 终止所有**同 exe 路径**的
//!      其他进程,然后作为唯一实例继续启动——双击必须看见窗口。
//! 3. 完整闭环还差最后一环(2026-09-27 实测):被强杀的旧实例留下的
//!    `msedgewebview2.exe`(browser 主进程)不会随父进程立即退出(实测父死
//!    1~3 分钟内仍在),继续占住 `EBWebView` 数据目录;而且它的 DACL 拒绝任何
//!    外部进程打开(连 `PROCESS_QUERY_LIMITED_INFORMATION` 都失败)——杀不掉,
//!    只能等。这期间 wry 在主线程**同步**等 webview 环境创建:窗口不显示、
//!    日志一行不写,与"双击没反应"完全同形(实测卡 102s)。因此预检在"将以
//!    唯一实例身份继续启动"的路径上,先等 `EBWebView\Lockfile` 独占打开成功
//!    (上限 120s,超时仍继续启动、退回旧阻塞行为),再让 Tauri 建窗口。
//! 4. 探针 mutex 句柄在返回前必须关闭:否则插件随后 `CreateMutexW` 会看到
//!    `ERROR_ALREADY_EXISTS`(自己占的)而找不到窗口 → 命中缺陷 b → 每个实例都
//!    不建隐藏窗口 → 全部级联僵尸。这是本模块存在的意义,不得回退。

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

/// 启动守护的三态判定(纯函数,可单测)。
#[derive(Debug, PartialEq, Eq)]
pub enum PreflightAction {
    /// 无其他实例:放行,插件照常接管。
    ContinueLaunch,
    /// 有其他实例且健康:放行,插件唤醒其窗口并结束本进程。
    HandoffToExisting,
    /// 有其他实例但挂死/僵尸:先清理其他实例,再继续启动。
    KillStaleThenContinue,
}

/// 三态判定:`{id}-sim` mutex 是否存在、`{id}-siw` 窗口是否找到、是否 2s 内应答。
///
/// mutex 不存在时其余两个参数无意义(无其他实例)。
pub fn decide(mutex_exists: bool, siw_window_found: bool, siw_responsive: bool) -> PreflightAction {
    if !mutex_exists {
        return PreflightAction::ContinueLaunch;
    }
    if siw_window_found && siw_responsive {
        return PreflightAction::HandoffToExisting;
    }
    PreflightAction::KillStaleThenContinue
}

/// 大小写不敏感的 exe 全路径比较(Windows 文件系统大小写不敏感,进程枚举与
/// `current_exe` 的大小写/短路径写法可能不同)。
fn same_exe_path(a: &Path, b: &Path) -> bool {
    a.as_os_str()
        .to_string_lossy()
        .eq_ignore_ascii_case(&b.as_os_str().to_string_lossy())
}

/// 上一次 `preflight()` 清理掉的挂死/僵尸实例数(供 setup 阶段日志插件就绪后补记)。
static KILLED_STALE_COUNT: AtomicUsize = AtomicUsize::new(0);

/// 取走并清零清理计数(setup 里调用一次)。
pub fn take_killed_stale_count() -> usize {
    KILLED_STALE_COUNT.swap(0, Ordering::SeqCst)
}

/// 上一次 `preflight()` 为等待 EBWebView 目录锁释放而阻塞的毫秒数。
static WEBVIEW_LOCK_WAIT_MS: AtomicUsize = AtomicUsize::new(0);

/// 取走并清零等待时长(setup 里调用一次)。
pub fn take_webview_lock_wait_ms() -> usize {
    WEBVIEW_LOCK_WAIT_MS.swap(0, Ordering::SeqCst)
}

/// 等待 `EBWebView\Lockfile` 释放(上限 `max_wait_ms`),返回实际等待毫秒数,
/// 0 = 无需等待。
///
/// 被强杀实例留下的孤儿 WebView2 browser 进程**无法从外部打开/终止**
/// (2026-09-27 实测:OpenProcess 连 PROCESS_QUERY_LIMITED_INFORMATION 都被
/// DACL 拒绝),但会在父进程死后 1~3 分钟自行退出。所以正确动作不是杀它们,
/// 而是等它们释放目录锁后再建本进程的 webview——否则 wry 在主线程同步等
/// 环境创建,窗口不显示、日志一行不写,与"双击没反应"完全同形(实测卡 102s)。
///
/// 判据用 Lockfile 独占打开:成功/不存在 = 已释放;ERROR_SHARING_VIOLATION(32)
/// = 仍被占用,继续等;其他错误(如权限) = 无法判定,放行——绝不因守护卡死启动。
#[cfg(target_os = "windows")]
pub fn wait_for_webview_lock_release(lockfile: &Path, max_wait_ms: u64) -> u64 {
    use std::os::windows::fs::OpenOptionsExt;
    const ERROR_SHARING_VIOLATION: i32 = 32;
    let start = std::time::Instant::now();
    loop {
        if !lockfile.exists() {
            return start.elapsed().as_millis() as u64;
        }
        let probe = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0)
            .open(lockfile);
        match probe {
            Ok(_exclusive) => return start.elapsed().as_millis() as u64,
            Err(e) if e.raw_os_error() == Some(ERROR_SHARING_VIOLATION) => {}
            Err(_) => return start.elapsed().as_millis() as u64,
        }
        if start.elapsed().as_millis() as u64 >= max_wait_ms {
            return max_wait_ms;
        }
        std::thread::sleep(std::time::Duration::from_millis(1000));
    }
}

#[cfg(target_os = "windows")]
pub fn preflight() {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::ptr;

    use winapi::shared::minwindef::{DWORD, FALSE, TRUE};
    use winapi::shared::ntdef::HANDLE;
    use winapi::shared::winerror::ERROR_ALREADY_EXISTS;
    use winapi::um::errhandlingapi::GetLastError;
    use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
    use winapi::um::processthreadsapi::{GetCurrentProcessId, OpenProcess, TerminateProcess};
    use winapi::um::synchapi::{CreateMutexW, WaitForSingleObject};
    use winapi::um::tlhelp32::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winnt::{
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, SYNCHRONIZE,
    };
    use winapi::um::winuser::{
        FindWindowW, SendMessageTimeoutW, SMTO_ABORTIFHUNG, SMTO_BLOCK, WM_NULL,
    };

    /// 与 tauri.conf.json `identifier` 一致;改名/改 identifier 必须同步这里,
    /// 否则预检与插件不再是同一个锁,守护整体失效。
    const APP_ID: &str = "com.ihui.desktop";
    /// 隐藏消息窗口应答探测超时(毫秒)。插件自身的 `SendMessageW` 无超时,
    /// 本探测必须带超时,否则预检自己也会卡在挂死实例上。
    const SIW_PROBE_TIMEOUT_MS: DWORD = 2000;
    /// 等待被终止进程退出的上限(毫秒)。
    const KILL_WAIT_MS: DWORD = 5000;
    /// 等待 EBWebView 目录锁释放的上限(毫秒)。孤儿 browser 实测父死后 1~3 分钟
    /// 自行退出;超过上限仍继续启动(回到旧行为),不无限卡死。
    const WEBVIEW_LOCK_WAIT_MAX_MS: u64 = 120_000;

    fn encode_wide(s: &str) -> Vec<u16> {
        std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    let mutex_name = encode_wide(&format!("{APP_ID}-sim"));
    let class_name = encode_wide(&format!("{APP_ID}-sic"));
    let window_name = encode_wide(&format!("{APP_ID}-siw"));

    unsafe {
        // 探针:与插件同名 mutex。FALSE=不要求初始所有权,只为问"有没有别人"。
        let hmutex = CreateMutexW(ptr::null_mut(), FALSE, mutex_name.as_ptr());
        if hmutex.is_null() {
            // 探针失败 → 放行(插件自身逻辑兜底),绝不因守护阻断启动。
            return;
        }
        let mutex_exists = GetLastError() == ERROR_ALREADY_EXISTS;

        if mutex_exists {
            let hwnd = FindWindowW(class_name.as_ptr(), window_name.as_ptr());
            let found = !hwnd.is_null();
            // 带超时 + SMTO_ABORTIFHUNG 的空消息探测:挂死的主线程不会应答。
            let responsive = found && {
                // lpdwResult 是 PDWORD_PTR(= *mut usize),不是 LPDWORD。
                let mut result: usize = 0;
                SendMessageTimeoutW(
                    hwnd,
                    WM_NULL,
                    0,
                    0,
                    SMTO_ABORTIFHUNG | SMTO_BLOCK,
                    SIW_PROBE_TIMEOUT_MS,
                    &mut result as *mut usize,
                ) != 0
            };

            match decide(true, found, responsive) {
                PreflightAction::HandoffToExisting | PreflightAction::ContinueLaunch => {
                    // 健康路径:关掉探针句柄交给插件(插件会唤醒已有窗口并结束本进程)。
                    CloseHandle(hmutex);
                    return;
                }
                PreflightAction::KillStaleThenContinue => {
                    let killed = kill_other_instances(
                        GetCurrentProcessId(),
                        &std::env::current_exe().unwrap_or_default(),
                    );
                    if killed > 0 {
                        KILLED_STALE_COUNT.store(killed, Ordering::SeqCst);
                    }
                }
            }
        }
        // 走到这里 = 本进程将以唯一实例身份继续启动(健康实例已在上面 return 移交)。
        // 等孤儿 WebView2 释放 EBWebView 目录锁(判据与上限见 wait_for_webview_lock_release):
        // 不等的话 wry 会在主线程同步等环境创建,窗口不显示、日志一行不写,
        // 与"双击没反应"完全同形——这正是"强制退出兜底"之后下一次双击打不开的最终一环。
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let lockfile = std::path::Path::new(&local_app_data)
                .join(APP_ID)
                .join("EBWebView")
                .join("Lockfile");
            let waited = wait_for_webview_lock_release(&lockfile, WEBVIEW_LOCK_WAIT_MAX_MS);
            if waited > 0 {
                WEBVIEW_LOCK_WAIT_MS.store(waited as usize, Ordering::SeqCst);
            }
        }
        // 所有路径都必须关掉探针句柄(见模块头注第 4 条)。
        CloseHandle(hmutex);
    }

    /// 终止除自身外所有**同全路径**的 ihui-desktop 进程,返回成功终止数。
    unsafe fn kill_other_instances(own_pid: DWORD, own_exe: &Path) -> usize {
        if own_exe.as_os_str().is_empty() {
            return 0;
        }
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return 0;
        }

        let own_name = own_exe.file_name().map(|n| n.to_string_lossy().into_owned());
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as DWORD;
        let mut killed = 0usize;
        let mut terminated: Vec<HANDLE> = Vec::new();

        if Process32FirstW(snapshot, &mut entry) == TRUE {
            loop {
                let pid = entry.th32ProcessID;
                if pid != own_pid {
                    // 先按 exe 名粗筛(便宜),再 OpenProcess 核全路径(防同名不同目录)。
                    let name = OsString::from_wide(&entry.szExeFile)
                        .to_string_lossy()
                        .into_owned();
                    let name = name.trim_end_matches('\0').to_string();
                    if own_name.as_deref() == Some(name.as_str()) {
                        let h = OpenProcess(
                            PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE,
                            FALSE,
                            pid,
                        );
                        if !h.is_null() {
                            let mut buf = [0u16; 1024];
                            let mut size = buf.len() as DWORD;
                            let full_path_ok = QueryFullProcessImageNameW(
                                h,
                                0,
                                buf.as_mut_ptr(),
                                &mut size,
                            ) != FALSE
                                && same_exe_path(
                                    &Path::new(&OsString::from_wide(&buf[..size as usize])),
                                    own_exe,
                                );
                            if full_path_ok && TerminateProcess(h, 1) != FALSE {
                                killed += 1;
                                // 句柄统一在下方等待退出后关闭;此处绝不能 continue,
                                // 否则会跳过 Process32NextW 死循环。
                                terminated.push(h);
                            } else {
                                CloseHandle(h);
                            }
                        }
                    }
                }
                if Process32NextW(snapshot, &mut entry) != TRUE {
                    break;
                }
            }
        }
        for h in terminated {
            // 返回值不判:超时也继续,绝不因单个进程退不掉而卡死启动。
            WaitForSingleObject(h, KILL_WAIT_MS);
            CloseHandle(h);
        }
        CloseHandle(snapshot);
        killed
    }

}

#[cfg(not(target_os = "windows"))]
pub fn preflight() {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn 无其他实例时放行() {
        assert_eq!(
            decide(false, false, false),
            PreflightAction::ContinueLaunch
        );
    }

    #[test]
    fn 健康实例存在时移交插件唤醒() {
        assert_eq!(
            decide(true, true, true),
            PreflightAction::HandoffToExisting
        );
    }

    #[test]
    fn 挂死实例隐藏窗口不应答时先清理再启动() {
        assert_eq!(
            decide(true, true, false),
            PreflightAction::KillStaleThenContinue
        );
    }

    #[test]
    fn 僵尸实例占着锁却没有隐藏窗口时先清理再启动() {
        assert_eq!(
            decide(true, false, false),
            PreflightAction::KillStaleThenContinue
        );
    }

    #[test]
    fn 可执行文件路径比较大小写不敏感() {
        let a = PathBuf::from("D:\\智汇AI\\ihui-desktop.exe");
        let b = PathBuf::from("d:\\智汇ai\\IHUI-DESKTOP.EXE");
        assert!(same_exe_path(&a, &b));
    }

    #[test]
    fn 可执行文件路径不同目录判为不同实例() {
        let a = PathBuf::from("D:\\智汇AI\\ihui-desktop.exe");
        let b = PathBuf::from("G:\\IHUI-AI\\apps\\desktop\\src-tauri\\target\\release\\ihui-desktop.exe");
        assert!(!same_exe_path(&a, &b));
    }

    #[test]
    fn 清理计数取走即清零() {
        KILLED_STALE_COUNT.store(3, Ordering::SeqCst);
        assert_eq!(take_killed_stale_count(), 3);
        assert_eq!(take_killed_stale_count(), 0);
    }
}
