// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 本机工作区文件通道 —— **tauri 胶水层**（判定全在 `workspace_fs_core`）。
//!
//! 这是桌面端"像 Qoder / Trae / WorkBuddy 那样操作本机文件夹"的那一半：
//! 线上前端不再把路径发给服务器白名单校验，而是由**本机进程**在用户授权的
//! 目录内完成列/读/写/删/stat。
//!
//! 授权边界（运行时可读版本见 `boundary_note`）：
//! - root 有两条来源，**都要求用户在本机做出的动作**：
//!   ① `workspace_pick_root`：宿主自己弹原生目录选择器，凭证**不经过页面**（最强）；
//!   ② `workspace_authorize_root`：页面把已在系统选择器里选到的路径交上来；
//!      凭证 = 宿主原生选择器最近一次真实选中项（`G:\IHUI-AI` 这类家目录外的盘
//!      同样可授权），git bases 只作脚本场景兜底。2026-11-20 立：此前误用 git bases
//!      当闸，导致家目录外的工作区一律 `out_of_bounds`，界面表现为"读取不到本地"。
//! - 文件操作只接受**工作区内相对路径**，绝对路径 / `..` / verbatim / UNC / 盘符
//!   由 `workspace_fs_core::normalize_rel` 拒。
//! - 每次读写都算前像指纹（`fingerprint`），写入可带 `expected_sha256` 做冲突检测：
//!   外部改动过的文件不会被静默覆盖。

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::git_channel_ipc::bases_from_env;
use crate::workspace_fs_core::{
    fingerprint, join_rel, normalize_rel, within_root, Reject, MAX_LIST_ENTRIES, MAX_READ_BYTES,
    MAX_WRITE_BYTES,
};

/// 一条目录项的上线形态。
#[derive(Debug, Clone, Serialize)]
pub struct FsEntryWire {
    pub name: String,
    /// 工作区相对路径（正斜杠）
    pub path: String,
    /// `file` / `dir` / `other`
    pub kind: String,
    pub size: u64,
    /// 秒级 Unix 时间戳；取不到为 0
    pub modified: i64,
}

/// 统一回包。**`state` 只有 `ok` / `rejected` 两态**，`kind` 是封闭分类名
/// （`ok` 或 `Reject::kind()`），前端按 `kind` 分支，不解析中文原因。
#[derive(Debug, Clone, Serialize)]
pub struct FsReply {
    pub state: String,
    pub kind: String,
    pub reason: String,
    pub root: String,
    pub path: Option<String>,
    pub entries: Option<Vec<FsEntryWire>>,
    pub content: Option<String>,
    pub size: Option<u64>,
    pub sha256: Option<String>,
    pub modified: Option<i64>,
}

impl FsReply {
    fn ok(root: &str) -> Self {
        FsReply {
            state: "ok".into(),
            kind: "ok".into(),
            reason: String::new(),
            root: root.to_string(),
            path: None,
            entries: None,
            content: None,
            size: None,
            sha256: None,
            modified: None,
        }
    }

    fn reject(root: &str, reject: Reject) -> Self {
        FsReply {
            state: "rejected".into(),
            kind: reject.kind().to_string(),
            reason: reject.reason(),
            root: root.to_string(),
            path: None,
            entries: None,
            content: None,
            size: None,
            sha256: None,
            modified: None,
        }
    }
}

/// 宿主状态：已授权 root（最多一个，与"当前工程"语义一致）
/// + 宿主原生选择器最近一次选中的路径（凭证）+ git bases 快照。
///
/// 为什么要有 `picked`（2026-11-20 立，实测根因）：`workspace_authorize_root` 过去
/// 只认 `bases_from_env()`（`IHUI_DESKTOP_GIT_BASES` + `USERPROFILE` + `HOME`）——
/// 那本是**git 操作**的允许基目录，用在工作区授权上时，用户选 `G:\IHUI-AI`
/// 这类家目录之外的盘会一律 `out_of_bounds`，界面表现为"读取不到本地"。
/// 现在的信任根 = **用户在宿主原生选择器里亲手点中的那个目录**：
/// 选中即凭证（页面拿不到任意路径，被 XSS 的远程页面也无法凭空授权任意盘），
/// git bases 只作为脚本/无 UI 场景的兼容兜底保留。
pub struct WorkspaceFsState {
    root: Mutex<Option<String>>,
    picked: Mutex<Option<String>>,
    bases: Vec<String>,
}

impl WorkspaceFsState {
    pub fn from_env() -> Self {
        WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: bases_from_env(),
        }
    }

    /// 宿主原生选择器最近一次选中的路径（canonical 文本）。
    fn picked_root(&self) -> Option<String> {
        self.picked
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn set_picked(&self, path: String) {
        let mut guard = self
            .picked
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard = Some(path);
    }

    fn stored_root(&self) -> Option<String> {
        self.root
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn set_root(&self, root: String) {
        let mut guard = self
            .root
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard = Some(root);
    }

    /// 授权边界自述（前端/日志可读，便于事后核对"这一通道到底信了什么"）。
    pub fn boundary_note(&self) -> String {
        format!(
            "root 只能由宿主原生选择器(workspace_pick_root)选中后写入，或由 git bases({} 个)兜底 authorize；\
文件面只接受工作区相对路径；读上限 {}B / 写上限 {}B / 列上限 {} 条；写可带前像 sha 做冲突检测",
            self.bases.len(),
            MAX_READ_BYTES,
            MAX_WRITE_BYTES,
            MAX_LIST_ENTRIES
        )
    }
}

/// 把候选路径 canonicalize。存在则返回真实路径；不存在返回 IO 错误（由调用方转成 Reject）。
fn canon(path: &Path) -> std::io::Result<PathBuf> {
    path.canonicalize()
}

/// 授权一个 root。**幂等**。
///
/// 两道证：① 落在 permitted bases 之内（canonicalize 后比组件前缀）；
/// ② 本身就是目录。任一不成立即拒 —— 失效方向是"多要一次说明"，不是"多放一次"。
///
/// 注意：这条是**兼容兜底**（脚本 / 无 UI 场景）。桌面端点选文件夹走的是
/// `try_authorize_picked`，凭证是宿主原生选择器的真实选中项，不受 bases 限制。
fn try_authorize(state: &WorkspaceFsState, root: &str) -> Result<String, Reject> {
    let trimmed = root.trim();
    if trimmed.is_empty() {
        return Err(Reject::SuspiciousInput("root 为空".into()));
    }
    let candidate = canon(Path::new(trimmed))
        .map_err(|e| Reject::Io(format!("root 不可解析({trimmed}): {e}")))?;
    if !candidate.is_dir() {
        return Err(Reject::TypeMismatch(format!(
            "root 不是目录：{}",
            candidate.display()
        )));
    }
    if state.bases.is_empty() {
        return Err(Reject::RootNotAuthorized);
    }
    let mut landed = false;
    for base in &state.bases {
        if let Ok(base_canon) = canon(Path::new(base)) {
            if within_root(&base_canon, &candidate) {
                landed = true;
                break;
            }
        }
    }
    if !landed {
        return Err(Reject::OutOfBounds(format!(
            "root 不在允许基目录内({} 个基目录都不同族)：{}",
            state.bases.len(),
            candidate.display()
        )));
    }
    let text = candidate.to_string_lossy().to_string();
    state.set_root(text.clone());
    Ok(text)
}

/// 用"宿主原生选择器选中项"当凭证授权（2026-11-20 立）。
///
/// 判据：候选路径必须是目录 ∧（等于最近一次选中的路径 ∨ 落在它之内 ∨ 落在
/// 已授权 root 之内）。**不看 git bases** —— 用户能在系统对话框里点到的位置，
/// 就是他有权访问的位置；页面拿不到这条凭证，所以被 XSS 也授不了任意盘。
fn try_authorize_picked(state: &WorkspaceFsState, root: &str) -> Result<String, Reject> {
    let trimmed = root.trim();
    if trimmed.is_empty() {
        return Err(Reject::SuspiciousInput("root 为空".into()));
    }
    let candidate = canon(Path::new(trimmed))
        .map_err(|e| Reject::Io(format!("root 不可解析({trimmed}): {e}")))?;
    if !candidate.is_dir() {
        return Err(Reject::TypeMismatch(format!(
            "root 不是目录：{}",
            candidate.display()
        )));
    }
    let text = candidate.to_string_lossy().to_string();
    let inside_picked = match state.picked_root() {
        Some(picked) => match canon(Path::new(&picked)) {
            Ok(picked_canon) => within_root(&picked_canon, &candidate),
            Err(_) => false,
        },
        None => false,
    };
    let inside_current_root = match state.stored_root() {
        Some(current) => match canon(Path::new(&current)) {
            Ok(current_canon) => within_root(&current_canon, &candidate),
            Err(_) => false,
        },
        None => false,
    };
    if !inside_picked && !inside_current_root {
        return Err(Reject::RootNotAuthorized);
    }
    state.set_root(text.clone());
    Ok(text)
}

/// 页面把"系统选择器里已经选到的路径"交上来 -> 授权。
///
/// 先问"这是不是宿主选择器刚选中的那一个"（凭证制，不受 git bases 限制）；
/// 不成立再落到 bases 兜底（脚本 / 无 UI 场景）。两条都不成立才拒。
#[tauri::command(async)]
pub async fn workspace_authorize_root(
    state: tauri::State<'_, WorkspaceFsState>,
    root: String,
) -> Result<FsReply, String> {
    match try_authorize_picked(&state, &root) {
        Ok(text) => Ok(FsReply::ok(&text)),
        Err(first) => match try_authorize(&state, &root) {
            Ok(text) => Ok(FsReply::ok(&text)),
            Err(second) => {
                // 两条都拒时，回那条更具体的拒因：凭证制拒（root_not_authorized）
                // 往往只是"页面自己传了个没选过的路径"，而 bases 拒会点明到底哪个基目录不同族。
                let reject = match (&first, &second) {
                    (Reject::RootNotAuthorized, other) => other.clone(),
                    (other, _) => other.clone(),
                };
                Ok(FsReply::reject("", reject))
            }
        },
    }
}

/// 宿主自己弹原生目录选择器，选中即授权。**凭证不经过页面**（页面拿不到任意路径）。
///
/// 为什么不用 `blocking_pick_folder`：它要求在主线程之外调用，而本命令是 async
/// 命令（跑在 tauri 的 async 池）；这里用回调 + 通道自己等，语义等价且不依赖
/// 主线程假设。超时 120s 视为用户放弃（回 `undetermined` 语义的 reject）。
#[tauri::command(async)]
pub async fn workspace_pick_root(
    app: tauri::AppHandle,
    state: tauri::State<'_, WorkspaceFsState>,
) -> Result<FsReply, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel::<Option<String>>();
    app.dialog()
        .file()
        .set_title("选择本机工作区文件夹（本机执行）")
        .pick_folder(move |path| {
            let _ = tx.send(path.map(|p| p.to_string()));
        });
    match rx.recv_timeout(std::time::Duration::from_secs(120)) {
        Ok(Some(selected)) => {
            // 宿主选择器选中 = 凭证（2026-11-20）：用户亲手在系统对话框里点到的目录
            // 就是他有权访问的位置，不再拿 git bases 当闸（那会把家目录外的盘全拒掉，
            // 界面表现为"读取不到本地"）。
            let picked = match canon(Path::new(&selected)) {
                Ok(p) => p,
                Err(e) => {
                    return Ok(FsReply::reject(
                        "",
                        Reject::Io(format!("所选目录不可解析({selected}): {e}")),
                    ))
                }
            };
            if !picked.is_dir() {
                return Ok(FsReply::reject(
                    "",
                    Reject::TypeMismatch(format!("所选路径不是目录：{}", picked.display())),
                ));
            }
            let text = picked.to_string_lossy().to_string();
            state.set_picked(text.clone());
            state.set_root(text.clone());
            Ok(FsReply::ok(&text))
        }
        Ok(None) => Ok(FsReply::reject("", Reject::SuspiciousInput("用户取消了选择".into()))),
        Err(_) => Ok(FsReply::reject("", Reject::SuspiciousInput("等待选择超时".into()))),
    }
}

/// 通道自述（边界/上限/当前 root），前端可用来做"本机执行"状态条。
#[tauri::command]
pub fn workspace_fs_info(state: tauri::State<'_, WorkspaceFsState>) -> Result<FsReply, String> {
    let root = state.stored_root().unwrap_or_default();
    let mut reply = FsReply::ok(&root);
    reply.reason = state.boundary_note();
    Ok(reply)
}

/// 解析出"已授权 root + 候选绝对路径"，并完成包含性校验。
fn resolve_target(
    state: &WorkspaceFsState,
    rel_path: &str,
    must_exist: bool,
) -> Result<(String, String, PathBuf), Reject> {
    let root_text = state.stored_root().ok_or(Reject::RootNotAuthorized)?;
    let rel = normalize_rel(rel_path)?;
    let root_path = canon(Path::new(&root_text))
        .map_err(|e| Reject::Io(format!("root 已失效({root_text}): {e}")))?;
    let candidate = join_rel(&root_path, &rel);
    if must_exist {
        let real = canon(&candidate).map_err(|e| {
            Reject::Io(format!("路径不可解析({}): {e}", candidate.display()))
        })?;
        if !within_root(&root_path, &real) {
            return Err(Reject::OutOfBounds(format!(
                "目标经符号链接落到 root 之外：{}",
                real.display()
            )));
        }
        Ok((root_text, rel, real))
    } else {
        // 写目标通常还不存在：校验父目录（父目录必须存在且仍在 root 内）
        let parent = candidate
            .parent()
            .ok_or_else(|| Reject::OutOfBounds("目标没有父目录".into()))?
            .to_path_buf();
        let parent_real = canon(&parent)
            .map_err(|e| Reject::Io(format!("父目录不可解析({}): {e}", parent.display())))?;
        if !within_root(&root_path, &parent_real) {
            return Err(Reject::OutOfBounds(format!(
                "父目录经符号链接落到 root 之外：{}",
                parent_real.display()
            )));
        }
        let file_name = candidate
            .file_name()
            .ok_or_else(|| Reject::OutOfBounds("目标没有文件名".into()))?;
        Ok((root_text, rel, parent_real.join(file_name)))
    }
}

fn modified_secs(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// 列目录（`dir` 省略 = 根）。
#[tauri::command(async)]
pub async fn workspace_fs_list(
    state: tauri::State<'_, WorkspaceFsState>,
    dir: Option<String>,
) -> Result<FsReply, String> {
    let dir_text = dir.unwrap_or_default();
    let (root_text, rel, real) = match resolve_target(&state, &dir_text, true) {
        Ok(v) => v,
        Err(reject) => return Ok(FsReply::reject("", reject)),
    };
    if !real.is_dir() {
        return Ok(FsReply::reject(
            &root_text,
            Reject::TypeMismatch(format!("不是目录：{}", real.display())),
        ));
    }
    let read_dir = match std::fs::read_dir(&real) {
        Ok(v) => v,
        Err(e) => {
            return Ok(FsReply::reject(
                &root_text,
                Reject::Io(format!("列目录失败({}): {e}", real.display())),
            ))
        }
    };
    let mut entries: Vec<FsEntryWire> = Vec::new();
    for item in read_dir.flatten() {
        let name = item.file_name().to_string_lossy().to_string();
        let meta = match item.metadata() {
            Ok(m) => m,
            Err(_) => continue, // 拿不到元数据的一项不"猜到"文件类型，直接跳过
        };
        let kind = if meta.is_dir() {
            "dir"
        } else if meta.is_file() {
            "file"
        } else {
            "other"
        };
        let child_rel = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };
        entries.push(FsEntryWire {
            name,
            path: child_rel,
            kind: kind.to_string(),
            size: meta.len(),
            modified: modified_secs(&meta),
        });
        if entries.len() > MAX_LIST_ENTRIES {
            return Ok(FsReply::reject(
                &root_text,
                Reject::TooLarge(format!("目录项超过 {MAX_LIST_ENTRIES} 条，请指定子目录")),
            ));
        }
    }
    entries.sort_by(|a, b| {
        let rank = |k: &str| if k == "dir" { 0 } else { 1 };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    let mut reply = FsReply::ok(&root_text);
    reply.path = Some(rel);
    reply.entries = Some(entries);
    Ok(reply)
}

/// 读文本文件。
#[tauri::command(async)]
pub async fn workspace_fs_read(
    state: tauri::State<'_, WorkspaceFsState>,
    path: String,
    max_bytes: Option<u64>,
) -> Result<FsReply, String> {
    let limit = max_bytes.unwrap_or(MAX_READ_BYTES).min(MAX_READ_BYTES);
    let (root_text, rel, real) = match resolve_target(&state, &path, true) {
        Ok(v) => v,
        Err(reject) => return Ok(FsReply::reject("", reject)),
    };
    let meta = match std::fs::metadata(&real) {
        Ok(m) => m,
        Err(e) => {
            return Ok(FsReply::reject(
                &root_text,
                Reject::Io(format!("stat 失败({}): {e}", real.display())),
            ))
        }
    };
    if meta.is_dir() {
        return Ok(FsReply::reject(
            &root_text,
            Reject::TypeMismatch("目标是目录".into()),
        ));
    }
    if meta.len() > limit {
        return Ok(FsReply::reject(
            &root_text,
            Reject::TooLarge(format!("文件 {}B 超过读上限 {limit}B", meta.len())),
        ));
    }
    let bytes = match std::fs::read(&real) {
        Ok(v) => v,
        Err(e) => {
            return Ok(FsReply::reject(
                &root_text,
                Reject::Io(format!("读取失败({}): {e}", real.display())),
            ))
        }
    };
    let sha = fingerprint(&bytes);
    let text = String::from_utf8_lossy(&bytes).to_string();
    let mut reply = FsReply::ok(&root_text);
    reply.path = Some(rel);
    reply.content = Some(text);
    reply.size = Some(bytes.len() as u64);
    reply.sha256 = Some(sha);
    reply.modified = Some(modified_secs(&meta));
    Ok(reply)
}

/// stat（可选带内容指纹）。
#[tauri::command(async)]
pub async fn workspace_fs_stat(
    state: tauri::State<'_, WorkspaceFsState>,
    path: String,
    with_sha: Option<bool>,
) -> Result<FsReply, String> {
    let (root_text, rel, real) = match resolve_target(&state, &path, true) {
        Ok(v) => v,
        Err(reject) => return Ok(FsReply::reject("", reject)),
    };
    let meta = match std::fs::metadata(&real) {
        Ok(m) => m,
        Err(e) => {
            return Ok(FsReply::reject(
                &root_text,
                Reject::Io(format!("stat 失败({}): {e}", real.display())),
            ))
        }
    };
    let kind = if meta.is_dir() {
        "dir"
    } else if meta.is_file() {
        "file"
    } else {
        "other"
    };
    let mut reply = FsReply::ok(&root_text);
    reply.path = Some(rel);
    reply.size = Some(meta.len());
    reply.modified = Some(modified_secs(&meta));
    reply.kind = kind.to_string();
    if with_sha.unwrap_or(false) && meta.is_file() && meta.len() <= MAX_READ_BYTES {
        if let Ok(bytes) = std::fs::read(&real) {
            reply.sha256 = Some(fingerprint(&bytes));
        }
    }
    Ok(reply)
}

/// 写文本文件（可选前像校验）。
#[tauri::command(async)]
pub async fn workspace_fs_write(
    state: tauri::State<'_, WorkspaceFsState>,
    path: String,
    content: String,
    expected_sha256: Option<String>,
    create_parent: Option<bool>,
) -> Result<FsReply, String> {
    if content.len() as u64 > MAX_WRITE_BYTES {
        return Ok(FsReply::reject(
            "",
            Reject::TooLarge(format!("写入 {}B 超过上限 {MAX_WRITE_BYTES}B", content.len())),
        ));
    }
    let (root_text, rel, real) = match resolve_target(&state, &path, false) {
        Ok(v) => v,
        Err(reject) => return Ok(FsReply::reject("", reject)),
    };
    if real.is_dir() {
        return Ok(FsReply::reject(
            &root_text,
            Reject::TypeMismatch("目标是目录".into()),
        ));
    }
    if let Some(expected) = expected_sha256.as_ref() {
        let current = if real.is_file() {
            std::fs::read(&real).ok().map(|b| fingerprint(&b))
        } else {
            None
        };
        let matched = match (&current, expected.as_str()) {
            // 新建：期望的"前像"必须是空
            (None, "") => true,
            (Some(now), want) => now == want,
            _ => false,
        };
        if !matched {
            return Ok(FsReply::reject(
                &root_text,
                Reject::Conflict(format!(
                    "盘上前像 {} 与期望 {} 不符（外部改动过），已拒绝覆盖",
                    current.unwrap_or_else(|| "(不存在)".into()),
                    if expected.is_empty() { "(新建)" } else { expected }
                )),
            ));
        }
    }
    if create_parent.unwrap_or(false) {
        if let Some(parent) = real.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                return Ok(FsReply::reject(
                    &root_text,
                    Reject::Io(format!("创建父目录失败({}): {e}", parent.display())),
                ));
            }
        }
    }
    if let Err(e) = std::fs::write(&real, content.as_bytes()) {
        return Ok(FsReply::reject(
            &root_text,
            Reject::Io(format!("写入失败({}): {e}", real.display())),
        ));
    }
    let mut reply = FsReply::ok(&root_text);
    reply.path = Some(rel);
    reply.size = Some(content.len() as u64);
    reply.sha256 = Some(fingerprint(content.as_bytes()));
    Ok(reply)
}

/// 删除（文件或空目录；`recursive` 才允许删非空目录）。
#[tauri::command(async)]
pub async fn workspace_fs_remove(
    state: tauri::State<'_, WorkspaceFsState>,
    path: String,
    recursive: Option<bool>,
) -> Result<FsReply, String> {
    let (root_text, rel, real) = match resolve_target(&state, &path, true) {
        Ok(v) => v,
        Err(reject) => return Ok(FsReply::reject("", reject)),
    };
    if rel.is_empty() {
        return Ok(FsReply::reject(
            &root_text,
            Reject::OutOfBounds("不允许删除工作区根自身".into()),
        ));
    }
    let is_dir = real.is_dir();
    let result = if is_dir && recursive.unwrap_or(false) {
        std::fs::remove_dir_all(&real)
    } else {
        std::fs::remove_file(&real)
    };
    match result {
        Ok(()) => {
            let mut reply = FsReply::ok(&root_text);
            reply.path = Some(rel);
            Ok(reply)
        }
        Err(e) => Ok(FsReply::reject(
            &root_text,
            Reject::Io(format!("删除失败({}): {e}", real.display())),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_rejects_empty_and_non_bases() {
        let state = WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: vec![],
        };
        assert!(matches!(try_authorize(&state, ""), Err(Reject::SuspiciousInput(_))));
        // 没有 bases 时一律拒（fail-closed），不会静默放开
        let tmp = std::env::temp_dir();
        let first = try_authorize(&state, &tmp.to_string_lossy());
        assert!(matches!(first, Err(Reject::RootNotAuthorized)));
    }

    #[test]
    fn authorize_with_bases_accepts_subdir_and_rejects_outside() {
        let tmp = std::env::temp_dir();
        let state = WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: vec![tmp.to_string_lossy().to_string()],
        };
        let sub = tmp.join("ihui-ws-test");
        let _ = std::fs::create_dir_all(&sub);
        let ok = try_authorize(&state, &sub.to_string_lossy()).expect("子目录应可授权");
        assert!(ok.len() > 0);
        // 换一个不在 bases 内的根：拿盘符根比（一定不是 tmp 的子路径）
        let outside = if cfg!(windows) { "C:\\Windows" } else { "/etc" };
        if Path::new(outside).exists() {
            let bad = try_authorize(&state, outside);
            assert!(matches!(bad, Err(Reject::OutOfBounds(_)) | Err(Reject::RootNotAuthorized)));
        }
    }

    #[test]
    fn read_write_roundtrip_inside_root() {
        let tmp = std::env::temp_dir().join("ihui-ws-rt");
        let _ = std::fs::create_dir_all(&tmp);
        let state = WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: vec![std::env::temp_dir().to_string_lossy().to_string()],
        };
        let root = try_authorize(&state, &tmp.to_string_lossy()).expect("授权失败");
        assert!(root.len() > 0);

        let (_, _, target) = resolve_target(&state, "a.txt", false).expect("解析失败");
        std::fs::write(&target, b"hello").expect("写盘失败");
        let (_, rel, real) = resolve_target(&state, "a.txt", true).expect("解析失败");
        assert_eq!(rel, "a.txt");
        let bytes = std::fs::read(&real).expect("读盘失败");
        assert_eq!(fingerprint(&bytes), fingerprint(b"hello"));
    }

    #[test]
    fn resolve_rejects_escape_and_absolute() {
        let tmp = std::env::temp_dir().join("ihui-ws-esc");
        let _ = std::fs::create_dir_all(&tmp);
        let state = WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: vec![std::env::temp_dir().to_string_lossy().to_string()],
        };
        let _ = try_authorize(&state, &tmp.to_string_lossy());
        assert!(matches!(resolve_target(&state, "../x", false), Err(Reject::OutOfBounds(_))));
        assert!(matches!(resolve_target(&state, "C:\\Windows\\win.ini", false), Err(Reject::OutOfBounds(_))));
    }

    #[test]
    fn resolve_requires_authorized_root() {
        let state = WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: vec![],
        };
        assert!(matches!(resolve_target(&state, "a.txt", false), Err(Reject::RootNotAuthorized)));
    }

    /// 2026-11-20 回归锁：家目录之外的工作区（如 `G:\IHUI-AI`）必须能靠
    /// "宿主选择器选中"授权 —— 这正是"读取不到本地"的根因所在。
    #[test]
    fn picked_credential_authorizes_dir_outside_git_bases() {
        let tmp = std::env::temp_dir().join("ihui-ws-picked");
        let sub = tmp.join("IHUI-AI");
        let _ = std::fs::create_dir_all(&sub);
        let state = WorkspaceFsState {
            root: Mutex::new(None),
            picked: Mutex::new(None),
            bases: vec![],
        };
        // 没有 picked 凭证：一律拒（fail-closed）
        assert!(matches!(
            try_authorize_picked(&state, &sub.to_string_lossy()),
            Err(Reject::RootNotAuthorized)
        ));
        // 模拟宿主选择器选中 tmp ⇒ 其后代可授权，bases 为空也不拦
        let picked = canon(&tmp).expect("canon 失败");
        state.set_picked(picked.to_string_lossy().to_string());
        let ok = try_authorize_picked(&state, &sub.to_string_lossy()).expect("选择器凭证应可授权");
        assert!(ok.to_lowercase().contains("ihui-ai"));
        // 未选中的旁路目录仍拒（换一个与 tmp 不同族的盘符根）
        let outside = if cfg!(windows) { "C:\\Windows" } else { "/etc" };
        if Path::new(outside).exists() {
            assert!(matches!(
                try_authorize_picked(&state, outside),
                Err(Reject::RootNotAuthorized)
            ));
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
