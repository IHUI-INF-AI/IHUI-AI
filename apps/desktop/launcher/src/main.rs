// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

//! IHUI AI 桌面端稳定启动器。
//!
//! 职责只有一个：让磁盘上永远有一个确定能启动的版本。
//! - 正常启动：读 state.json → 有 pending 且目录存在就切指针 → 起 `versions/<current>/ihui-app.exe`
//! - 健康窗口：子进程活过 10s 记为健康；启动即崩连续两次 → 自动切回 previous
//! - 不碰运行中的文件：更新只新增版本目录 + 写 pending，切换只改 state.json 指针
//! - 第二个快捷方式：只拉起 current 让壳的单实例插件聚焦，绝不切 pending
//!
//! 隐藏调试入口（只给本地验收脚本用，不暴露给壳）：
//!   --root <dir>          指定安装根（默认 = 本 exe 所在目录）
//!   --print-state         打印 state.json
//!   --switch-pending      只执行一次 pending 切换并落盘
//!   --set-pending <ver>   写 pending（不校验目录；验收脚本自己造）
//!   --mark-healthy        仅用于验收：写 last_good_at 并清 fail_count

mod log;
mod platform;

use ihui_launcher::state;
use serde_json::json;
use std::collections::HashSet;
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus};
use std::thread;
use std::time::{Duration, Instant};

use state::{app_exe, list_payload_versions, now_secs, version_dir, Rollback, State, Switch};

const BOOT_GRACE: Duration = Duration::from_secs(10);
const POLL: Duration = Duration::from_millis(100);
/// 壳收到“立即重启”后必须用这个退出码退出；Launcher 看到它才原地切 pending 并重启。
/// 普通关窗是 0，普通崩溃是其它非零码，绝不能把“关窗”误判成“重启”。
const RESTART_EXIT_CODE: i32 = 42;
const EXIT_MISSING: i32 = 2;
const EXIT_SPAWN: i32 = 3;
const EXIT_CRASH_NO_ROLLBACK: i32 = 4;

/// 启动失败时既写日志，也给 GUI 用户一个原生可见出口（Launcher 无控制台）。
fn fatal(root: &Path, message: &str, code: i32) -> i32 {
    let detail = format!(
        "{message}\n\n安装目录：{}\n日志：{}",
        root.display(),
        root.join("launcher.log").display()
    );
    log::line(root, &format!("fatal: {message}"));
    platform::fatal(&detail);
    code
}

fn main() {
    std::process::exit(run());
}

fn run() -> i32 {
    let raw: Vec<String> = env::args().skip(1).collect();
    let root = match parse_root(&raw) {
        Some(path) => path,
        None => match env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf))
        {
            Some(path) => path,
            None => return EXIT_MISSING,
        },
    };
    if root.as_os_str().is_empty() {
        return EXIT_MISSING;
    }

    if raw.iter().any(|arg| arg == "--print-state") {
        return match State::load(&root) {
            Ok(state) => {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&state).unwrap_or_default()
                );
                0
            }
            Err(err) => {
                eprintln!("state unreadable: {err}");
                EXIT_MISSING
            }
        };
    }

    if let Some(value) = flag_value(&raw, "--set-pending") {
        let mut state = match State::load(&root) {
            Ok(state) => state,
            Err(err) => {
                eprintln!("state unreadable: {err}");
                return EXIT_MISSING;
            }
        };
        state.pending = Some(value.to_string());
        if let Err(err) = state.save(&root) {
            eprintln!("state save failed: {err}");
            return EXIT_MISSING;
        }
        log::line(&root, &format!("debug: set pending={value}"));
        println!(
            "{}",
            serde_json::to_string_pretty(&state).unwrap_or_default()
        );
        return 0;
    }

    if raw.iter().any(|arg| arg == "--switch-pending") {
        let mut state = match State::load(&root) {
            Ok(state) => state,
            Err(err) => {
                eprintln!("state unreadable: {err}");
                return EXIT_MISSING;
            }
        };
        let switched = state.begin_launch();
        if let Err(err) = state.save(&root) {
            eprintln!("state save failed: {err}");
            return EXIT_MISSING;
        }
        if let Some(switch) = switched {
            log::line(
                &root,
                &format!("debug: switched {} -> {}", switch.from, switch.to),
            );
        }
        println!(
            "{}",
            serde_json::to_string_pretty(&state).unwrap_or_default()
        );
        return 0;
    }

    if raw.iter().any(|arg| arg == "--mark-healthy") {
        let mut state = match State::load(&root) {
            Ok(state) => state,
            Err(err) => {
                eprintln!("state unreadable: {err}");
                return EXIT_MISSING;
            }
        };
        state.mark_healthy();
        if let Err(err) = state.save(&root) {
            eprintln!("state save failed: {err}");
            return EXIT_MISSING;
        }
        println!(
            "{}",
            serde_json::to_string_pretty(&state).unwrap_or_default()
        );
        return 0;
    }

    let passthrough = passthrough_args(&raw);
    let guard = platform::primary_guard(&root);

    if !guard.is_primary() {
        // 已有 Launcher 在跑：只起 current 让壳的单实例插件把窗口拉到前台，绝不切 pending。
        let state = match State::load(&root) {
            Ok(state) => state,
            Err(err) => {
                eprintln!("state unreadable: {err}");
                return EXIT_MISSING;
            }
        };
        return match spawn_app(&root, &state.current, &passthrough, true) {
            Ok(mut child) => {
                log::line(
                    &root,
                    &format!(
                        "secondary: spawn current={} pid={}",
                        state.current,
                        child.id()
                    ),
                );
                // 壳的单实例插件会很快把第二个进程退掉；最多等 3s 防止僵尸。
                let started = Instant::now();
                while started.elapsed() < Duration::from_secs(3) {
                    match child.try_wait() {
                        Ok(Some(status)) => return status.code().unwrap_or(0),
                        Ok(None) => thread::sleep(POLL),
                        Err(_) => return 0,
                    }
                }
                0
            }
            Err(err) => {
                eprintln!("spawn current failed: {err}");
                EXIT_SPAWN
            }
        };
    }

    let mut state = match State::load_or_bootstrap(&root) {
        Ok(state) => state,
        Err(err) => {
            return fatal(
                &root,
                &format!("没有可启动的版本，安装可能不完整：{err}"),
                EXIT_MISSING,
            );
        }
    };

    // pending 目录不存在（下载没写完/被清理）→ 丢弃，绝不让用户切到空指针。
    if let Some(pending) = state.pending.clone() {
        let exists = app_exe(&root, &pending)
            .map(|p| p.exists())
            .unwrap_or(false);
        if !exists {
            log::line(&root, &format!("pending {pending} has no payload; dropped"));
            state.pending = None;
            let _ = state.save(&root);
        }
    }

    // current 目录被误删/被杀软隔离/半截安装：不能直接报 EXIT_SPAWN 等下一次，
    // 自动从 versions/ 里挑一个真有 ihui-app.exe 的最高版本顶上（排除已知 bad）。
    if state.pending.is_none()
        && !app_exe(&root, &state.current)
            .map(|p| p.is_file())
            .unwrap_or(false)
    {
        let candidates: Vec<String> = list_payload_versions(&root)
            .unwrap_or_default()
            .into_iter()
            .filter(|v| state.bad.as_deref() != Some(v.as_str()))
            .collect();
        if let Some(fallback) = candidates
            .into_iter()
            .max_by(|a, b| ihui_launcher::state::compare_versions(a, b))
        {
            log::line(
                &root,
                &format!(
                    "heal: current={} missing; fallback={fallback}",
                    state.current
                ),
            );
            state.current = fallback;
            state.fail_count = 0;
            if state
                .previous
                .as_deref()
                .map(|v| app_exe(&root, v).map(|p| p.is_file()).unwrap_or(false))
                .unwrap_or(false)
                == false
            {
                state.previous = None;
            }
            let _ = state.save(&root);
        }
    }

    let switched = state.begin_launch();
    // 状态落盘失败（例如装进 Program Files 但当前用户不可写）不能阻断启动：
    // 内存里的 current 仍然正确，先把应用拉起来，更新/回滚退化为下次启动不保证。
    if let Err(err) = state.save(&root) {
        log::line(&root, &format!("state save before launch failed: {err}"));
    }
    if let Some(Switch { from, to }) = switched {
        log::line(&root, &format!("switch: {from} -> {to}"));
    }

    match state::cleanup_versions(&root, &state) {
        Ok(removed) if !removed.is_empty() => {
            log::line(&root, &format!("cleanup: {}", removed.join(",")));
        }
        Ok(_) => {}
        Err(err) => log::line(&root, &format!("cleanup failed: {err}")),
    }

    log::line(
        &root,
        &format!(
            "launch: current={} previous={} pending={} fail_count={}",
            state.current,
            state.previous.as_deref().unwrap_or("-"),
            state.pending.as_deref().unwrap_or("-"),
            state.fail_count
        ),
    );

    watch(&root, state, &passthrough)
}

/// 起子进程 → 健康窗口 → 崩溃两次回滚。返回 Launcher 最终退出码。
fn watch(root: &Path, mut state: State, passthrough: &[String]) -> i32 {
    loop {
        let mut child = match spawn_app(root, &state.current, passthrough, false) {
            Ok(child) => child,
            Err(err) => {
                log::line(
                    root,
                    &format!("spawn failed: current={} err={err}", state.current),
                );
                // 起不来等价于启动失败；连续两次后回滚。
                if let Some(rollback) = force_spawn_failure(&mut state) {
                    if let Err(code) = persist_or_fatal(root, &state, "回滚状态写入失败") {
                        return code;
                    }
                    write_rollback_notice(root, &rollback);
                    continue;
                }
                if let Err(err) = state.save(root) {
                    log::line(
                        root,
                        &format!("state save after spawn failure failed: {err}"),
                    );
                }
                return fatal(
                    root,
                    "应用启动失败（进程无法拉起）。请重装或查看日志。",
                    EXIT_SPAWN,
                );
            }
        };

        log::line(
            root,
            &format!("child: version={} pid={}", state.current, child.id()),
        );

        let started = Instant::now();
        let mut healthy = false;
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Some(status),
                Ok(None) => {}
                Err(err) => {
                    log::line(root, &format!("wait failed: {err}"));
                    break None;
                }
            }
            if !healthy && started.elapsed() >= BOOT_GRACE {
                state.mark_healthy();
                if let Err(err) = state.save(root) {
                    log::line(root, &format!("state save after healthy failed: {err}"));
                }
                healthy = true;
                log::line(root, &format!("healthy: version={}", state.current));
                match state::cleanup_versions(root, &state) {
                    Ok(removed) if !removed.is_empty() => {
                        log::line(root, &format!("cleanup: {}", removed.join(",")));
                    }
                    _ => {}
                }
            }
            thread::sleep(POLL);
        };

        let code = match status {
            Some(status) => exit_code(&status),
            None => -1,
        };

        if code == RESTART_EXIT_CODE {
            // 壳已经把草稿/窗口状态 flush 完，用 42 交棒。重新读盘拿它写的 pending。
            let mut fresh = match State::load(root) {
                Ok(state) => state,
                Err(err) => {
                    log::line(
                        root,
                        &format!("restart: state reload failed: {err}; keep in-memory"),
                    );
                    state
                }
            };
            let switched = fresh.begin_launch();
            if let Err(err) = fresh.save(root) {
                log::line(root, &format!("restart: state save failed: {err}"));
            }
            state = fresh;
            match switched {
                Some(Switch { from, to }) => {
                    log::line(root, &format!("restart-switch: {from} -> {to}"));
                }
                None => log::line(
                    root,
                    &format!("restart: no pending, relaunch {}", state.current),
                ),
            }
            continue;
        }

        if code == 0 {
            log::line(root, &format!("exit: version={} code=0", state.current));
            return 0;
        }

        if healthy {
            // 跑起来之后才崩：不自动回滚（可能是用户数据/环境问题），交给下次启动与遥测。
            if let Err(err) = state.save(root) {
                log::line(
                    root,
                    &format!("state save after healthy crash failed: {err}"),
                );
            }
            log::line(
                root,
                &format!("crash-after-healthy: version={} code={code}", state.current),
            );
            return code;
        }

        log::line(
            root,
            &format!(
                "crash-before-healthy: version={} code={code}",
                state.current
            ),
        );
        if let Some(rollback) = state.mark_failure() {
            if let Err(code) = persist_or_fatal(root, &state, "回滚状态写入失败") {
                return code;
            }
            write_rollback_notice(root, &rollback);
            log::line(
                root,
                &format!("rollback: {} -> {}", rollback.from, rollback.to),
            );
            continue;
        }
        if let Err(code) = persist_or_fatal(root, &state, "启动失败计数写入失败") {
            return code;
        }
        if state.fail_count == 1 {
            log::line(root, "retry: first crash, relaunch same version");
            continue;
        }
        return fatal(
            root,
            "新版本连续启动失败，且没有可回退的旧版本。请重新安装。",
            EXIT_CRASH_NO_ROLLBACK,
        );
    }
}

/// 起进程失败：有 previous 就立刻回滚，没有就返回 None。
fn force_spawn_failure(state: &mut State) -> Option<Rollback> {
    state.rollback_now()
}

fn spawn_app(root: &Path, version: &str, passthrough: &[String], focus: bool) -> io::Result<Child> {
    let exe = app_exe(root, version).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("illegal version: {version}"),
        )
    })?;
    if !exe.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("payload missing: {}", exe.display()),
        ));
    }

    let mut command = Command::new(&exe);
    command.current_dir(root);
    command.env("IHUI_INSTALL_ROOT", root);
    command.env("IHUI_LAUNCHER_PID", std::process::id().to_string());
    if focus {
        command.env("IHUI_FOCUS_REQUEST", "1");
    }
    for arg in passthrough {
        command.arg(arg);
    }
    command.spawn()
}

fn exit_code(status: &ExitStatus) -> i32 {
    status.code().unwrap_or(-1)
}

/// 回滚/失败计数必须落盘：写不进去时不能只在内存里“回滚过”然后继续。
/// 装进只读目录时磁盘仍是坏版本指针，下次启动会再次掉进同一个坑。
fn persist_or_fatal(root: &Path, state: &State, context: &str) -> Result<(), i32> {
    if let Err(err) = state.save(root) {
        log::line(root, &format!("{context}: {err}"));
        return Err(fatal(
            root,
            &format!(
                "{context}。安装目录可能不可写，已停止以免反复启动坏版本。请重装修复权限或查看日志。"
            ),
            EXIT_CRASH_NO_ROLLBACK,
        ));
    }
    Ok(())
}

fn write_rollback_notice(root: &Path, rollback: &Rollback) {
    let notice = json!({
        "schema": 1,
        "from": rollback.from,
        "to": rollback.to,
        "at": now_secs(),
        "reason": "boot-failed",
    });
    let path = root.join("rollback-notice.json");
    let text = serde_json::to_vec_pretty(&notice).unwrap_or_default();
    if let Err(err) = fs::write(&path, text) {
        log::line(root, &format!("write rollback notice failed: {err}"));
    }
}

fn parse_root(args: &[String]) -> Option<PathBuf> {
    if let Some(value) = flag_value(args, "--root") {
        return Some(PathBuf::from(value));
    }
    args.iter().find_map(|arg| {
        arg.strip_prefix("--root=")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
    })
}

fn flag_value<'a>(args: &'a [String], flag: &str) -> Option<&'a str> {
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if arg == flag {
            return iter.next().map(String::as_str);
        }
        if let Some(value) = arg.strip_prefix(&format!("{flag}=")) {
            return Some(value);
        }
    }
    None
}

fn passthrough_args(args: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if arg == "--root" {
            index += 2;
            continue;
        }
        if arg == "--set-pending" {
            index += 2;
            continue;
        }
        if arg == "--print-state"
            || arg == "--switch-pending"
            || arg == "--mark-healthy"
            || arg.starts_with("--root=")
            || arg.starts_with("--set-pending=")
        {
            index += 1;
            continue;
        }
        out.push(arg.clone());
        index += 1;
    }
    out
}

/// 供验收脚本复用：确保 versions/<ver> 存在（不创建 state）。
#[allow(dead_code)]
fn ensure_version_dir(root: &Path, version: &str) -> io::Result<PathBuf> {
    let dir = version_dir(root, version)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "illegal version"))?;
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

#[allow(dead_code)]
fn kept_versions(state: &State) -> HashSet<String> {
    let mut keep = HashSet::new();
    keep.insert(state.current.clone());
    if let Some(v) = &state.previous {
        keep.insert(v.clone());
    }
    if let Some(v) = &state.pending {
        keep.insert(v.clone());
    }
    if let Some(v) = &state.bad {
        keep.insert(v.clone());
    }
    keep
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
