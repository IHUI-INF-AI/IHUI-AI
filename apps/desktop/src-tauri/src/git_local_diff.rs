// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 本地 diff 文本通道 —— **执行层**（只用 std，不碰 tauri；测试随 crate `cargo test` 真跑）。
//!
//! 票72② 的 diff 腿：与 `git_local_status` 同构的三态出口（本仓铁律：不得把
//! "没跑到/判不了"折叠成"没有改动"）：
//!
//! 1. `Facts` —— git 零退出**且**输出是合法 UTF-8 **且**不超预算；
//!    `dirty=false`（空文本=该范围无差异）与 `dirty=true` 是两个结论，不合并；
//! 2. `CommandFailed` —— git 非零退出，带 stderr 原文；
//! 3. `Undetermined` —— 判不了：超时 / 二进制缺失 / 越界 scope / 非 UTF-8 / 超预算 /
//!     无退出码。按 `Blindness` 分小类，"为什么判不了"决定下一步动作
//!     （缩小 scope？分 staged/unstaged 两边问？还是根本不在这台机问）。
//!
//! 为什么超预算判 `Undetermined(Budget)` 而不是"截断+旗标放行"：与 status 通道同一
//! 条纪律 —— 截断的清单/文本会被读成完整的。diff 的正确下一步是**缩小 scope**
//! （按文件问）或**分边问**（staged / unstaged 各一次），两条路都给在 reason 里。
//!
//! 授权边界：scope 沿用 `git_local_status::check_scope`（只收相对路径，`..`/绝对/
//! verbatim/UNC 一律拒）；root 不在本层采信 —— IPC 层只对**已授权**根调用本层。

use std::path::Path;

use crate::git_local_status::{
    check_scope, Blindness, Config, ExecResult, ExecState, Gate, Runner,
};

/// 单次 diff 回报的字节预算。超了判"判不了"，不截断放行。
pub const MAX_DIFF_BYTES: usize = 262_144;
/// `-U` 上下文行数上限（防前端传 1_000_000 把预算炸掉）。
pub const MAX_DIFF_CONTEXT: u32 = 8;

/// `git diff` 的参数序列。`staged=true` 问 index vs HEAD，否则问 worktree vs index。
pub fn diff_args(root: &str, scope: &str, staged: bool, context: u32) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-c".to_string(),
        "safe.directory=*".to_string(),
        "-C".to_string(),
        root.to_string(),
        "diff".to_string(),
        // 颜色/外部 diff/textconv 都会把"机器要的原始文本"换成"给人看的东西"，
        // 通道要的是可判定的原文，一个都不放行。
        "--no-color".to_string(),
        "--no-ext-diff".to_string(),
        "--no-textconv".to_string(),
        "-U".to_string(),
        context.clamp(0, MAX_DIFF_CONTEXT).to_string(),
    ];
    if staged {
        args.push("--cached".to_string());
    }
    args.push("--".to_string());
    args.push(scope.to_string());
    args
}

/// diff 通道三态。`Facts.dirty` 由"文本是否为空"结构化推导，前端无从把
/// "空 diff"读成"有改动"（那是文本通道最容易出的假阳性）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffOutcome {
    Facts {
        scope: String,
        staged: bool,
        dirty: bool,
        text: String,
    },
    CommandFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
    Undetermined {
        kind: Blindness,
        reason: String,
    },
}

/// 把"子进程结果 + 预算/UTF-8 判据"折叠成三态。与 `classify_exec` 同构：
/// 非零退出永远是 `CommandFailed`，即使 stdout 有内容。
pub fn judge_diff_exec(exec: &ExecResult, scope: &str, staged: bool) -> DiffOutcome {
    match exec.state {
        ExecState::NotFound => DiffOutcome::Undetermined {
            kind: Blindness::MissingBinary,
            reason: exec.detail.clone(),
        },
        ExecState::SpawnFailed => DiffOutcome::Undetermined {
            kind: Blindness::Spawn,
            reason: exec.detail.clone(),
        },
        ExecState::IoFailed => DiffOutcome::Undetermined {
            kind: Blindness::Io,
            reason: format!("读取子进程输出失败：{}", exec.detail),
        },
        ExecState::TimedOut => DiffOutcome::Undetermined {
            kind: Blindness::Timeout,
            reason: exec.detail.clone(),
        },
        ExecState::Exited => match exec.exit {
            None => DiffOutcome::Undetermined {
                kind: Blindness::NoExitCode,
                reason: "子进程无退出码（被信号/异常终止），不足以判定\"无差异\"".into(),
            },
            Some(code) if code != 0 => DiffOutcome::CommandFailed {
                exit_code: Some(code),
                stderr: if exec.stderr.trim().is_empty() {
                    exec.detail.clone()
                } else {
                    exec.stderr.clone()
                },
            },
            Some(0) => {
                if exec.stdout.len() > MAX_DIFF_BYTES {
                    return DiffOutcome::Undetermined {
                        kind: Blindness::Budget,
                        reason: format!(
                            "diff 输出 {} 字节超单次预算 {MAX_DIFF_BYTES}，截断文本会被读成完整 ⇒ 判不了；下一步：缩小 scope 按文件问，或分 staged/unstaged 两边各问一次",
                            exec.stdout.len()
                        ),
                    };
                }
                match std::str::from_utf8(&exec.stdout) {
                    Err(err) => DiffOutcome::Undetermined {
                        kind: Blindness::Parse,
                        reason: format!(
                            "diff 输出自字节 {} 起不是合法 UTF-8（非 UTF-8 路径判\"判不了\"而非 lossy 替换的同一条纪律）：{err}",
                            err.valid_up_to()
                        ),
                    },
                    Ok(text) => DiffOutcome::Facts {
                        scope: scope.to_string(),
                        staged,
                        dirty: !text.is_empty(),
                        text: text.to_string(),
                    },
                }
            }
            Some(_) => unreachable!("match 已覆盖全部 i32 除 None/0/非零"),
        },
    }
}

/// 通道主入口（与 `local_status` 同构）：scope 门 → 执行 → 判据折叠。
/// `resolved` 由调用方 FS 探测得到，本层不碰文件系统 ⇒ 单测全注入。
pub fn local_diff(
    cfg: &Config,
    root: &str,
    scope: &str,
    staged: bool,
    resolved: Option<&Path>,
    runner: &dyn Runner,
) -> DiffOutcome {
    let gate: Gate = check_scope(Some(scope));
    if !gate.is_pass() {
        return match gate {
            Gate::Refuse { kind, reason } => DiffOutcome::Undetermined { kind, reason },
            Gate::Pass => unreachable!("上一行已判非 Pass"),
        };
    }
    let binary = match resolved {
        Some(b) => b.to_path_buf(),
        None => {
            return DiffOutcome::Undetermined {
                kind: Blindness::MissingBinary,
                reason: "git 绝对路径候选一个都不存在（装 git 或设 IHUI_GIT_BIN）".into(),
            }
        }
    };
    let args = diff_args(root, scope, staged, MAX_DIFF_CONTEXT);
    let exec = runner.run(&binary, &args, root, cfg.timeout);
    judge_diff_exec(&exec, scope, staged)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git_local_status::ExecResult;
    use std::time::Duration;

    fn exec_ok(stdout: &[u8]) -> ExecResult {
        ExecResult {
            state: ExecState::Exited,
            exit: Some(0),
            stdout: stdout.to_vec(),
            stderr: String::new(),
            detail: String::new(),
        }
    }

    fn exec_exit(code: i32, stderr: &str) -> ExecResult {
        ExecResult {
            state: ExecState::Exited,
            exit: Some(code),
            stdout: Vec::new(),
            stderr: stderr.to_string(),
            detail: String::new(),
        }
    }

    // ---------- 参数序列 ----------

    #[test]
    fn args_shape_staged_and_context() {
        let a = diff_args("/work", "src/lib.ts", true, 3);
        assert_eq!(a[0], "-c");
        assert!(a.windows(2).any(|w| w[0] == "-C" && w[1] == "/work"));
        assert!(a.contains(&"--cached".to_string()));
        assert!(a.windows(2).any(|w| w[0] == "-U" && w[1] == "3"));
        assert_eq!(*a.last().unwrap(), "src/lib.ts");
        // context 超上限被钳到 MAX，不透传
        let b = diff_args("/work", ".", false, 999);
        let ctx = b.iter().position(|x| x == "-U").unwrap();
        assert_eq!(b[ctx + 1], MAX_DIFF_CONTEXT.to_string());
    }

    #[test]
    fn unstaged_has_no_cached_flag() {
        let a = diff_args("/work", ".", false, 3);
        assert!(!a.contains(&"--cached".to_string()));
    }

    // ---------- 判据折叠 ----------

    #[test]
    fn empty_output_is_clean_not_dirty() {
        let out = judge_diff_exec(&exec_ok(b""), "src/lib.ts", false);
        match out {
            DiffOutcome::Facts { dirty, text, .. } => {
                assert!(!dirty, "空 diff 是 clean，不得读成有改动");
                assert!(text.is_empty());
            }
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn nonempty_output_is_dirty_with_text() {
        let out = judge_diff_exec(&exec_ok(b"diff --git a/x b/x\n"), "x", false);
        match out {
            DiffOutcome::Facts { dirty, text, .. } => {
                assert!(dirty);
                assert!(text.starts_with("diff --git"));
            }
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn nonzero_exit_is_command_failed_even_with_stdout() {
        let mut e = exec_exit(128, "fatal: not a git repository");
        e.stdout = b"garbage".to_vec();
        match judge_diff_exec(&e, ".", false) {
            DiffOutcome::CommandFailed { exit_code, stderr } => {
                assert_eq!(exit_code, Some(128));
                assert!(stderr.contains("not a git repository"));
            }
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn budget_overflow_is_undetermined_never_truncated_facts() {
        let big = vec![b'a'; MAX_DIFF_BYTES + 1];
        match judge_diff_exec(&exec_ok(&big), ".", false) {
            DiffOutcome::Undetermined { kind, reason } => {
                assert_eq!(kind, Blindness::Budget);
                assert!(reason.contains("缩小 scope"), "给下一步动作：{reason}");
            }
            other => panic!("截断放行是纪律违规：{other:?}"),
        }
    }

    #[test]
    fn exactly_budget_passes() {
        let big = vec![b'a'; MAX_DIFF_BYTES];
        match judge_diff_exec(&exec_ok(&big), ".", false) {
            DiffOutcome::Facts { dirty, .. } => assert!(dirty),
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn non_utf8_is_parse_blind_not_lossy() {
        let mut raw = b"diff --git a/x b/x\n".to_vec();
        raw.extend_from_slice(&[0xFF, 0xFE, 0xB6, 0xAB]);
        match judge_diff_exec(&exec_ok(&raw), "x", false) {
            DiffOutcome::Undetermined { kind, reason } => {
                assert_eq!(kind, Blindness::Parse);
                assert!(reason.contains("UTF-8"), "点名字节偏移：{reason}");
            }
            other => panic!("lossy 替换是纪律违规：{other:?}"),
        }
    }

    #[test]
    fn exec_states_map_to_their_blindness() {
        // 本地助手：git_local_status::ExecResult::failed 是私有构造，判据面自建同形。
        fn blind(state: ExecState, detail: &str) -> ExecResult {
            ExecResult {
                state,
                exit: None,
                stdout: Vec::new(),
                stderr: String::new(),
                detail: detail.to_string(),
            }
        }
        let cases = [
            (blind(ExecState::NotFound, "缺"), Blindness::MissingBinary),
            (blind(ExecState::SpawnFailed, "败"), Blindness::Spawn),
            (blind(ExecState::IoFailed, "读"), Blindness::Io),
            (blind(ExecState::TimedOut, "超"), Blindness::Timeout),
        ];
        for (exec, want) in cases {
            match judge_diff_exec(&exec, ".", false) {
                DiffOutcome::Undetermined { kind, .. } => assert_eq!(kind, want),
                other => panic!("实得 {other:?}"),
            }
        }
    }

    #[test]
    fn no_exit_code_is_undetermined() {
        let e = ExecResult {
            state: ExecState::Exited,
            exit: None,
            stdout: b"partial".to_vec(),
            stderr: String::new(),
            detail: String::new(),
        };
        match judge_diff_exec(&e, ".", false) {
            DiffOutcome::Undetermined { kind, .. } => assert_eq!(kind, Blindness::NoExitCode),
            other => panic!("实得 {other:?}"),
        }
    }

    // ---------- 通道主入口 ----------

    #[cfg(windows)]
    const ABS_SCOPE: &str = "C:/elsewhere/x.ts";
    #[cfg(not(windows))]
    const ABS_SCOPE: &str = "/elsewhere/x.ts";

    #[test]
    fn absolute_scope_refused_before_any_spawn() {
        let cfg = Config {
            bases: vec!["/work".to_string()],
            git_candidates: vec![],
            timeout: Duration::from_millis(1),
            fold_case: false,
        };
        let used = std::cell::Cell::new(false);
        let runner = crate::git_local_status::tests::Probe { used: &used };
        let out = local_diff(&cfg, "/work", ABS_SCOPE, false, Some(Path::new("/fake/git")), &runner);
        match out {
            DiffOutcome::Undetermined { kind, .. } => {
                assert!(matches!(kind, Blindness::OutOfBounds | Blindness::SuspiciousInput));
            }
            other => panic!("实得 {other:?}"),
        }
        assert!(!used.get(), "scope 门必须先于任何子进程派生");
    }

    #[test]
    fn missing_binary_short_circuits() {
        let cfg = Config {
            bases: vec!["/work".to_string()],
            git_candidates: vec![],
            timeout: Duration::from_millis(1),
            fold_case: false,
        };
        let used = std::cell::Cell::new(false);
        let runner = crate::git_local_status::tests::Probe { used: &used };
        let out = local_diff(&cfg, "/work", "x.ts", false, None, &runner);
        match out {
            DiffOutcome::Undetermined { kind, .. } => assert_eq!(kind, Blindness::MissingBinary),
            other => panic!("实得 {other:?}"),
        }
        assert!(!used.get());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
