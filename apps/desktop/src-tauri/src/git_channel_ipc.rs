// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 本地 git/diff 通道 —— **tauri 胶水层**（只做 DTO 映射与状态存取，判定全在别处）。
//!
//! 为什么单开一个文件：`git_status_core.rs` 与 `git_local_status.rs` 只依赖 std，
//! 因此可以被 `rustc --test` 单独编译并真跑单测；一旦把 `#[tauri::command]` 混进去，
//! 那两个文件就只能等整棵 tauri 依赖树编完才有测试可跑（本仓"造好没装车"那一族
//! 的常见成因之一就是"判据写完了但没人能跑它"）。
//!
//! 授权边界（运行时可读版本见 `boundary_note`）：
//! - **前端永远不能自报 root**。root 只能由 `git_authorize_workspace` 写入宿主状态，
//!   且写入前必须过两道独立证明：① 落在宿主登记的 permitted bases 之内；
//!   ② `git rev-parse --show-toplevel` 亲口确认它就是自己那个 worktree 的顶层。
//! - `git_workspace_status` 只接受**相对** `scope`；绝对路径 / `..` 逃逸 / verbatim / UNC
//!   由 `git_local_status::check_scope` 拒，拒因区分为 `out-of-bounds`（不该给）
//!   与 `suspicious-input`（看不清），两者都不是放行。

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use crate::git_local_status::{
    git_binary_candidates, local_status, resolve_git_binary, summarize, Config, EngineOutcome,
    ProcessRunner, RequestSpec, DEFAULT_TIMEOUT_MS, ENV_GIT_BASES, MAX_TIMEOUT_MS,
};
use crate::git_status_core::{ChangeKind, StatusEntry};

/// 一条变更的上线形态。`kind` 是封闭集（`added|modified|deleted|renamed|copied|
/// untracked|ignored|conflicted|typechange`），前端不得按字符串猜。
#[derive(Debug, Clone, Serialize)]
pub struct EntryWire {
    pub kind: String,
    pub index_status: String,
    pub worktree_status: String,
    pub path: String,
    pub old_path: Option<String>,
}

/// 三态出口。**`state` 只有三个取值**，且 `entries` 只在 `facts` 时有意义 ——
/// `undetermined` 时它是空数组但 `state != "facts"`，消费方无法把"判不了"读成"没有改动"。
#[derive(Debug, Clone, Serialize)]
pub struct StatusReply {
    /// `facts` / `command_failed` / `undetermined`
    pub state: String,
    /// 三态内的小类：`facts` 时为 `clean|dirty`；`undetermined` 时为 Blindness 名；
    /// `command_failed` 时为 `exit=<code|none>`。
    pub verdict: String,
    pub reason: String,
    pub root: String,
    pub git_binary: String,
    pub scope: Option<String>,
    pub total: usize,
    pub by_kind: Vec<(String, usize)>,
    pub entries: Vec<EntryWire>,
}

fn map_entry(entry: &StatusEntry) -> EntryWire {
    EntryWire {
        kind: entry.kind.as_str().to_string(),
        index_status: entry.index_status.clone(),
        worktree_status: entry.worktree_status.clone(),
        path: entry.path.clone(),
        old_path: entry.old_path.clone(),
    }
}

fn undetermined(reason: String) -> StatusReply {
    StatusReply {
        state: "undetermined".into(),
        verdict: "other".into(),
        reason,
        root: String::new(),
        git_binary: String::new(),
        scope: None,
        total: 0,
        by_kind: Vec::new(),
        entries: Vec::new(),
    }
}

impl From<&EngineOutcome> for StatusReply {
    fn from(outcome: &EngineOutcome) -> Self {
        let summary = summarize(outcome);
        let (state, reason, root, git_binary, scope, entries) = match outcome {
            EngineOutcome::Facts {
                root,
                git_binary,
                scope,
                entries,
            } => (
                "facts".to_string(),
                String::new(),
                root.clone(),
                git_binary.clone(),
                scope.clone(),
                entries.iter().map(map_entry).collect::<Vec<EntryWire>>(),
            ),
            EngineOutcome::CommandFailed {
                git_binary,
                stderr,
                exit_code,
                ..
            } => (
                "command_failed".to_string(),
                format!(
                    "git 退出码 {}；stderr 原文：{}",
                    exit_code.map(|c| c.to_string()).unwrap_or_else(|| "none".into()),
                    if stderr.trim().is_empty() { "(空)" } else { stderr }
                ),
                String::new(),
                git_binary.clone(),
                None,
                Vec::new(),
            ),
            EngineOutcome::Undetermined { kind, reason } => (
                "undetermined".to_string(),
                format!("[{}] {}", kind.as_str(), reason),
                String::new(),
                String::new(),
                None,
                Vec::new(),
            ),
        };
        StatusReply {
            state,
            verdict: summary.verdict,
            reason,
            root,
            git_binary,
            scope,
            total: summary.total,
            by_kind: summary.by_kind,
            entries,
        }
    }
}

/// 宿主状态：已授权的 root（最多一个，与"当前工程"语义一致）+ 环境派生的配置。
pub struct GitChannelState {
    authorized_root: Mutex<Option<String>>,
    bases: Vec<String>,
    git_candidates: Vec<PathBuf>,
    timeout: Duration,
    fold_case: bool,
}

/// 允许基目录：`IHUI_DESKTOP_GIT_BASES`（`;` 分隔绝对路径）∪ 用户主目录。
///
/// 为什么把主目录算进去：桌面端是用户自己的机器，工作区几乎必然在自己主目录之下；
/// 而**没有任何**允许基目录时判据是"一律拒"（见 `check_root_within_bases`），
/// 不会静默放开。需要更窄的边界就设那个环境变量。
pub fn bases_from_env() -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    if let Ok(raw) = std::env::var(ENV_GIT_BASES) {
        for part in raw.split(';') {
            let trimmed = part.trim();
            if !trimmed.is_empty() {
                out.push(trimmed.to_string());
            }
        }
    }
    for key in ["USERPROFILE", "HOME"] {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() && !out.iter().any(|existing| existing == trimmed) {
                out.push(trimmed.to_string());
            }
        }
    }
    out
}

fn timeout_from_env() -> Duration {
    let ms = std::env::var("IHUI_DESKTOP_GIT_TIMEOUT_MS")
        .ok()
        .and_then(|raw| raw.trim().parse::<u64>().ok())
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .clamp(200, MAX_TIMEOUT_MS);
    Duration::from_millis(ms)
}

impl GitChannelState {
    pub fn from_env() -> Self {
        GitChannelState {
            authorized_root: Mutex::new(None),
            bases: bases_from_env(),
            git_candidates: git_binary_candidates(&|key| std::env::var(key).ok()),
            timeout: timeout_from_env(),
            fold_case: cfg!(windows),
        }
    }

    fn config(&self) -> Config {
        Config {
            bases: self.bases.clone(),
            git_candidates: self.git_candidates.clone(),
            timeout: self.timeout,
            fold_case: self.fold_case,
        }
    }

    fn stored_root(&self) -> Option<String> {
        self.authorized_root
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    /// 授权边界自述（前端/日志可读，便于事后核对"这一通道到底信了什么"）。
    pub fn boundary_note(&self) -> String {
        format!(
            "root 必须由 git_authorize_workspace 写入且经 bases({} 个) + rev-parse --show-toplevel 双证；scope 只接受仓库内相对路径；git 走绝对路径候选({} 个,不依赖 PATH)；超时 {}ms",
            self.bases.len(),
            self.git_candidates.len(),
            self.timeout.as_millis()
        )
    }
}

fn resolved_binary(state: &GitChannelState) -> Option<PathBuf> {
    resolve_git_binary(&state.git_candidates, &|p| p.is_file())
}

/// 授权一个工作区根。**幂等**：重复授权同一根不报错；换根需显式再调一次。
#[tauri::command]
pub fn git_authorize_workspace(
    state: tauri::State<'_, GitChannelState>,
    root: String,
) -> Result<StatusReply, String> {
    let candidate = root.trim().to_string();
    if candidate.is_empty() {
        return Ok(undetermined("root 为空，未授权".into()));
    }
    let cfg = state.config();
    let binary = match resolved_binary(&state) {
        Some(b) => b,
        None => {
            return Ok(undetermined(
                crate::git_local_status::missing_binary_reason(&cfg.git_candidates),
            ))
        }
    };
    let req = RequestSpec {
        root: candidate.clone(),
        scope: None,
    };
    let outcome = local_status(&cfg, &req, Some(&binary), &ProcessRunner);
    let reply = StatusReply::from(&outcome);
    if reply.state == "facts" {
        let mut slot = state
            .authorized_root
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *slot = Some(candidate);
    }
    Ok(reply)
}

/// 取本地仓库状态。只作用于**已授权**的根，前端无从指定别的目录。
#[tauri::command]
pub fn git_workspace_status(
    state: tauri::State<'_, GitChannelState>,
    scope: Option<String>,
) -> Result<StatusReply, String> {
    let root = match state.stored_root() {
        Some(root) => root,
        None => {
            return Ok(undetermined(format!(
                "尚未授权工作区根（先调 git_authorize_workspace）；边界：{}",
                state.boundary_note()
            )))
        }
    };
    let cfg = state.config();
    let binary = match resolved_binary(&state) {
        Some(b) => b,
        None => {
            return Ok(undetermined(
                crate::git_local_status::missing_binary_reason(&cfg.git_candidates),
            ))
        }
    };
    let req = RequestSpec {
        root,
        scope: scope.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
    };
    Ok(StatusReply::from(&local_status(
        &cfg,
        &req,
        Some(&binary),
        &ProcessRunner,
    )))
}

/// 通道自述：当前授权根、git 解析结果、边界说明。用于"这条通道到底在用什么"的回读。
#[tauri::command]
pub fn git_channel_info(state: tauri::State<'_, GitChannelState>) -> Result<serde_json::Value, String> {
    let resolved = resolved_binary(&state);
    Ok(serde_json::json!({
        "authorizedRoot": state.stored_root(),
        "gitBinary": resolved.map(|p: PathBuf| p.display().to_string()),
        "candidates": state.git_candidates.iter().map(|p| p.display().to_string()).collect::<Vec<String>>(),
        "bases": state.bases,
        "timeoutMs": state.timeout.as_millis(),
        "boundary": state.boundary_note(),
    }))
}

/// 供测试与后续对账使用：把 kind 的封闭集固定在一处，前端拼错即编译不到。
#[allow(dead_code)]
fn kind_names() -> Vec<&'static str> {
    [
        ChangeKind::Added,
        ChangeKind::Modified,
        ChangeKind::Deleted,
        ChangeKind::Renamed,
        ChangeKind::Copied,
        ChangeKind::Untracked,
        ChangeKind::Ignored,
        ChangeKind::Conflicted,
        ChangeKind::TypeChange,
    ]
    .iter()
    .map(|k| k.as_str())
    .collect()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
