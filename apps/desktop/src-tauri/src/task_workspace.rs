// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! Task Workspace —— 可丢弃工作副本的最小内核（Phase 1）。
//!
//! 目标不是给命令更多权限，而是把"写工作区"从权限问题改成**副本问题**：
//! 在 AppContainer 的 `AC` 根下创建一个独立 Git clone（共享对象、独立 `.git`），
//! 命令在副本里以低完整性运行、无网络；结束后把变化收成 binary patch，由调用方
//! 显式 `publish` 回源工作区。源工作区的完整性/ACL 完全不放宽。
//!
//! 本模块优先支持 Git 仓库（共享对象 clone）；非 Git 目录走树拷贝 + 副本内基线
//! 提交，发布前逐文件比对源与基线。容器/overlay 后端留给 Phase 3。

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// 一个任务工作副本。`Drop` 会删除副本目录；源工作区永远不由本模块直接改，
/// 只有显式 `publish` 才会 apply patch。
#[derive(Debug)]
pub struct TaskWorkspace {
    source: PathBuf,
    root: PathBuf,
    task_id: String,
    kind: TaskKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TaskKind {
    /// 源是 Git 仓库顶层：共享对象 clone。
    Git,
    /// 源不是 Git 仓库：树拷贝后在副本里建一个基线 Git 仓库，仍用 patch 发布。
    Copy,
}

/// 发布结果：有多少文件、patch 多少字节。调用方拿到这个才能做审计。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublishReport {
    pub changed_files: usize,
    pub patch_bytes: usize,
}

impl TaskWorkspace {
    /// 自动选择后端：Git 源走共享对象 clone；非 Git 源走树拷贝 + 副本内基线提交。
    /// 非 Git 源没有 `git status`，发布时会逐文件比对源与副本基线，拒绝覆盖任务期间
    /// 被用户改过的文件。
    pub fn prepare(source: &Path, task_id: &str) -> Result<Self, String> {
        let source = source
            .canonicalize()
            .map_err(|e| format!("工作区路径无法 canonicalize: {e}"))?;
        if !source.is_dir() {
            return Err("工作区不是目录".to_string());
        }
        let task = sanitize_task_id(task_id)?;
        let is_git = git_capture(&source, &["rev-parse", "--is-inside-work-tree"])
            .map(|out| out.trim() == "true")
            .unwrap_or(false);
        if is_git {
            return Self::prepare_git(&source, &task);
        }
        Self::prepare_copy(&source, &task)
    }

    fn prepare_copy(source: &Path, task: &str) -> Result<Self, String> {
        let root = crate::sandbox_spawn::appcontainer_sandbox_root(&format!("task-{task}"))?;
        if root.exists() {
            std::fs::remove_dir_all(&root)
                .map_err(|e| format!("清理残留任务副本失败 {}: {e}", root.display()))?;
        }
        copy_tree(source, &root).map_err(|e| {
            let _ = std::fs::remove_dir_all(&root);
            format!("复制非 Git 工作区失败: {e}")
        })?;
        let init = (|| -> Result<(), String> {
            git_capture(&root, &["init", "--quiet"])?;
            git_capture(&root, &["config", "user.name", "IHUI Agent"])?;
            git_capture(&root, &["config", "user.email", "agent@ihui.local"])?;
            // 副本必须按字节保真：全局 core.autocrlf=true 会让 add/commit/apply
            // 把 LF 改写成 CRLF，patch 不再等于源文件的真实内容。
            git_capture(&root, &["config", "core.autocrlf", "false"])?;
            git_capture(&root, &["add", "-A", "-f"])?;
            git_capture(&root, &["commit", "--quiet", "--allow-empty", "-m", "task-baseline"])?;
            Ok(())
        })();
        if let Err(err) = init {
            let _ = std::fs::remove_dir_all(&root);
            return Err(err);
        }
        Ok(Self {
            source: source.to_path_buf(),
            root,
            task_id: task.to_string(),
            kind: TaskKind::Copy,
        })
    }

    /// 从 Git 源仓库准备一个共享对象 clone。
    ///
    /// 前置条件是源工作区干净：否则 clone 出来的 HEAD 与工作区不一致，后续 patch
    /// 会把用户未提交的改动混进任务。脏源直接拒，不偷偷 stash/覆盖。
    pub fn prepare_git(source: &Path, task_id: &str) -> Result<Self, String> {
        let source = source
            .canonicalize()
            .map_err(|e| format!("工作区路径无法 canonicalize: {e}"))?;
        if !source.is_dir() {
            return Err("工作区不是目录".to_string());
        }
        let task = sanitize_task_id(task_id)?;
        let toplevel = git_capture(&source, &["rev-parse", "--show-toplevel"])?;
        let toplevel = PathBuf::from(toplevel.trim())
            .canonicalize()
            .map_err(|e| format!("git 顶层路径无法 canonicalize: {e}"))?;
        if toplevel != source {
            return Err(format!(
                "源目录不是 Git 仓库顶层（实际顶层 {}），拒绝建副本",
                toplevel.display()
            ));
        }
        let dirty = git_capture(&source, &["status", "--porcelain"])?;
        if !dirty.trim().is_empty() {
            return Err("源工作区不干净，拒绝建任务副本（请先提交或清理）".to_string());
        }

        let root = crate::sandbox_spawn::appcontainer_sandbox_root(&format!("task-{task}"))?;
        // 同一 task_id 的残留副本（上次进程崩溃/测试中断）先清掉；Task ID 由调用方
        // 保证唯一，清理范围只在这个 AC 任务目录内。
        if root.exists() {
            std::fs::remove_dir_all(&root)
                .map_err(|e| format!("清理残留任务副本失败 {}: {e}", root.display()))?;
        }
        // clone 由宿主中等完整性进程执行，目标在 AC 根下；副本自己的 .git 可写，
        // 不依赖源仓库 common-dir 的写权限。--shared 只借用对象，不复制整个 .git。
        let mut clone = Command::new("git");
        clone
            .arg("-c")
            .arg("core.autocrlf=false")
            .arg("clone")
            .arg("--shared")
            .arg("--quiet")
            .arg(git_path(&source))
            .arg(git_path(&root));
        let out = clone
            .output()
            .map_err(|e| format!("执行 git clone 失败: {e}"))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let _ = std::fs::remove_dir_all(&root);
            return Err(format!("git clone --shared 失败: {}", stderr.trim()));
        }
        // 副本需要自己的提交身份；不继承用户全局配置，避免把任务提交记到个人名下。
        git_capture(&root, &["config", "user.name", "IHUI Agent"])?;
        git_capture(&root, &["config", "user.email", "agent@ihui.local"])?;
        git_capture(&root, &["config", "core.autocrlf", "false"])?;

        Ok(Self {
            source,
            root,
            task_id: task,
            kind: TaskKind::Git,
        })
    }

    pub fn source(&self) -> &Path {
        &self.source
    }

    pub fn stage_root(&self) -> &Path {
        &self.root
    }

    pub fn task_id(&self) -> &str {
        &self.task_id
    }

    /// 把副本内所有变化（含 untracked）收成 binary patch。可重复调用，不产生副作用。
    pub fn diff_patch(&self) -> Result<String, String> {
        git_capture(self.stage(), &["add", "-A", "-f"])?;
        git_capture(self.stage(), &["diff", "--cached", "--binary"])
            .map_err(|e| format!("生成任务 patch 失败: {e}"))
    }

    /// 变更文件列表（`git diff --cached --name-status` 原样输出）。
    pub fn changed_files(&self) -> Result<Vec<String>, String> {
        git_capture(self.stage(), &["add", "-A", "-f"])?;
        let raw = git_capture(self.stage(), &["diff", "--cached", "--name-status"])?;
        Ok(raw
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .map(ToOwned::to_owned)
            .collect())
    }

    /// NUL 分隔的 status/path 对；路径里带空格也不会被拆错。
    fn changed_entries(&self) -> Result<Vec<(String, String)>, String> {
        let raw = git_capture_bytes(
            self.stage(),
            &["diff", "--cached", "--name-status", "--no-renames", "-z"],
        )?;
        let mut parts = raw.split(|b| *b == 0);
        let mut entries = Vec::new();
        while let Some(status) = parts.next() {
            if status.is_empty() {
                continue;
            }
            let path = parts
                .next()
                .ok_or_else(|| "任务 patch 的 name-status 缺少路径".to_string())?;
            if path.is_empty() {
                return Err("任务 patch 的 name-status 含空路径".to_string());
            }
            entries.push((
                String::from_utf8_lossy(status).into_owned(),
                String::from_utf8_lossy(path).into_owned(),
            ));
        }
        Ok(entries)
    }

    /// 网关侧文件写入：只允许落在本任务副本内，路径不接受绝对路径、`..` 或
    /// 现有符号链接。调用方是 tool-host，不是 Agent 自己，避免在 CLI 进程里再长一条
    /// 绕过任务副本的直写通道。
    pub fn write_file(&self, relative: &str, content: &str) -> Result<u64, String> {
        let rel = safe_task_path(relative)?;
        let root = self
            .stage()
            .canonicalize()
            .map_err(|e| format!("任务副本不可读: {e}"))?;
        let target = root.join(&rel);

        // 逐级检查现有祖先，父目录是符号链接就直接拒绝；然后再创建缺失目录。
        let mut cursor = root.clone();
        for component in rel.components() {
            cursor.push(component.as_os_str());
            if let Ok(meta) = std::fs::symlink_metadata(&cursor) {
                if meta.file_type().is_symlink() {
                    return Err(format!("任务副本内不允许符号链接路径: {}", cursor.display()));
                }
            }
        }
        let parent = target
            .parent()
            .ok_or_else(|| format!("文件路径没有父目录: {relative}"))?;
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建任务副本目录失败 {}: {e}", parent.display()))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("任务副本父目录不可读 {}: {e}", parent.display()))?;
        if !canonical_parent.starts_with(&root) {
            return Err(format!("文件路径逃出任务副本: {relative}"));
        }
        if let Ok(meta) = std::fs::symlink_metadata(&target) {
            if meta.file_type().is_symlink() {
                return Err(format!("拒绝写入符号链接: {}", target.display()));
            }
        }

        std::fs::write(&target, content.as_bytes())
            .map_err(|e| format!("写入任务副本失败 {}: {e}", target.display()))?;
        Ok(content.len() as u64)
    }

    /// 网关侧删除：同样只允许任务副本内的普通文件；符号链接/目录一律拒绝，
    /// 避免 Agent 在副本里借删除动作碰到副本外的东西。
    pub fn delete_file(&self, relative: &str) -> Result<(), String> {
        let rel = safe_task_path(relative)?;
        let root = self
            .stage()
            .canonicalize()
            .map_err(|e| format!("任务副本不可读: {e}"))?;
        let target = root.join(&rel);
        let parent = target
            .parent()
            .ok_or_else(|| format!("文件路径没有父目录: {relative}"))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("任务副本父目录不可读 {}: {e}", parent.display()))?;
        if !canonical_parent.starts_with(&root) {
            return Err(format!("文件路径逃出任务副本: {relative}"));
        }
        let meta = std::fs::symlink_metadata(&target)
            .map_err(|e| format!("任务副本文件不可读 {}: {e}", target.display()))?;
        if meta.file_type().is_symlink() {
            return Err(format!("拒绝删除符号链接: {}", target.display()));
        }
        if meta.is_dir() {
            return Err(format!("目标不是普通文件: {}", target.display()));
        }
        std::fs::remove_file(&target)
            .map_err(|e| format!("删除任务副本文件失败 {}: {e}", target.display()))?;
        Ok(())
    }

    /// 显式发布：再次确认源工作区干净，然后把二进制 patch apply 回源。
    /// 不自动 commit、不自动 stash、不覆盖用户未提交的改动。
    pub fn publish(&self) -> Result<PublishReport, String> {
        if self.kind == TaskKind::Copy {
            return self.publish_copy();
        }
        let dirty = git_capture(&self.source, &["status", "--porcelain"])?;
        if !dirty.trim().is_empty() {
            return Err("源工作区在任务执行期间变脏，拒绝发布 patch".to_string());
        }
        let patch = self.diff_patch()?;
        if patch.trim().is_empty() {
            return Ok(PublishReport {
                changed_files: 0,
                patch_bytes: 0,
            });
        }
        let files = self.changed_files()?.len();
        apply_patch(&self.source, &patch)?;
        Ok(PublishReport {
            changed_files: files,
            patch_bytes: patch.len(),
        })
    }

    /// 非 Git 源的发布：先逐文件比对源与副本基线，再 apply；这样用户在任务期间
    /// 改过的文件不会被新内容静默覆盖。
    fn publish_copy(&self) -> Result<PublishReport, String> {
        let patch = self.diff_patch()?;
        if patch.trim().is_empty() {
            return Ok(PublishReport {
                changed_files: 0,
                patch_bytes: 0,
            });
        }
        let entries = self.changed_entries()?;
        for (status, path) in &entries {
            if path.is_empty()
                || Path::new(path).is_absolute()
                || path.split(['/', '\\']).any(|part| part == "..")
            {
                return Err(format!("任务 patch 含非法路径: {path}"));
            }
            let source_path = self.source.join(path);
            match status.as_bytes().first().copied() {
                Some(b'A') => {
                    if source_path.exists() {
                        return Err(format!(
                            "源工作区新增了同名文件，拒绝覆盖: {}",
                            source_path.display()
                        ));
                    }
                }
                Some(b'M') | Some(b'D') | Some(b'T') => {
                    let base = git_capture_bytes(
                        self.stage(),
                        &["cat-file", "-p", &format!("HEAD:{path}")],
                    )?;
                    let current = std::fs::read(&source_path)
                        .map_err(|e| format!("读取源文件失败 {}: {e}", source_path.display()))?;
                    if current != base {
                        return Err(format!(
                            "源文件在任务执行期间被改动，拒绝发布: {}",
                            source_path.display()
                        ));
                    }
                }
                Some(b'R') | Some(b'C') => {
                    return Err("非 Git 发布不支持重命名/复制条目（应使用 --no-renames）".to_string());
                }
                _ => return Err(format!("无法识别的 patch 状态: {status}")),
            }
        }
        let files = entries.len();
        apply_patch(&self.source, &patch)?;
        Ok(PublishReport {
            changed_files: files,
            patch_bytes: patch.len(),
        })
    }

    /// 删除副本；幂等。`Drop` 也会兜底。
    pub fn abandon(&self) -> Result<(), String> {
        if self.root.exists() {
            std::fs::remove_dir_all(&self.root)
                .map_err(|e| format!("删除任务副本失败 {}: {e}", self.root.display()))?;
        }
        Ok(())
    }

    fn stage(&self) -> &Path {
        &self.root
    }
}

impl Drop for TaskWorkspace {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn sanitize_task_id(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 96 {
        return Err("task_id 为空或过长".to_string());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    {
        return Err("task_id 只允许 ASCII 字母/数字/-_.，拒绝路径注入".to_string());
    }
    Ok(trimmed.to_string())
}

/// 任务副本内的相对路径：只允许 Normal 组件；绝对路径、`..`、Windows 盘符/前缀
/// 一律拒绝。调用方仍要在真实落盘前做 canonical parent 检查。
fn safe_task_path(value: &str) -> Result<PathBuf, String> {
    if value.trim().is_empty() {
        return Err("任务副本路径为空".to_string());
    }
    let raw = Path::new(value);
    let mut rel = PathBuf::new();
    for component in raw.components() {
        match component {
            std::path::Component::Normal(part) => {
                let name = part.to_string_lossy();
                if name.contains(':') {
                    return Err(format!("任务副本路径不允许冒号/ADS: {value}"));
                }
                if name.ends_with(' ') || name.ends_with('.') {
                    return Err(format!("任务副本路径不允许尾随空格/点: {value}"));
                }
                let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
                let reserved = matches!(
                    stem.as_str(),
                    "CON" | "PRN" | "AUX" | "NUL"
                        | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9"
                        | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9"
                );
                if reserved {
                    return Err(format!("任务副本路径命中 Windows 保留设备名: {value}"));
                }
                rel.push(part);
            }
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                return Err(format!("任务副本路径不允许 ..: {value}"))
            }
            std::path::Component::RootDir | std::path::Component::Prefix(_) => {
                return Err(format!("任务副本路径不允许绝对路径: {value}"))
            }
        }
    }
    if rel.as_os_str().is_empty() {
        return Err("任务副本路径为空".to_string());
    }
    Ok(rel)
}

/// 先 `--check` 再真正 apply：git apply 在多文件补丁上不保证"全成或全不成"，
/// 先 dry-run 把可应用性判完，避免源工作区被半截 patch 改脏。
fn apply_patch(source: &Path, patch: &str) -> Result<(), String> {
    for dry_run in [true, false] {
        let mut command = Command::new("git");
        command
            .args(["-c", "core.autocrlf=false", "-C"])
            .arg(git_path(source))
            .args(["apply", "--binary", "--whitespace=nowarn"]);
        if dry_run {
            command.arg("--check");
        }
        command
            .arg("-")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command
            .spawn()
            .map_err(|e| format!("启动 git apply 失败: {e}"))?;
        child
            .stdin
            .as_mut()
            .ok_or_else(|| "git apply stdin 不可用".to_string())?
            .write_all(patch.as_bytes())
            .map_err(|e| format!("写 git apply stdin 失败: {e}"))?;
        let out = child
            .wait_with_output()
            .map_err(|e| format!("等待 git apply 失败: {e}"))?;
        if !out.status.success() {
            return Err(format!(
                "git apply {}失败: {}",
                if dry_run { "--check " } else { "" },
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
    }
    Ok(())
}

fn git_capture(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(git_path(cwd))
        .args(args)
        .output()
        .map_err(|e| format!("执行 git 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "git {} 失败: {}",
            args.join(" "),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn git_capture_bytes(cwd: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(git_path(cwd))
        .args(args)
        .output()
        .map_err(|e| format!("执行 git 失败: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "git {} 失败: {}",
            args.join(" "),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(out.stdout)
}

/// 非 Git 源的树拷贝。`.git` 目录不进入副本：源本来不是仓库，若存在同名目录
/// 只会让副本基线混入无关对象；符号链接直接拒绝，避免把链接目标带出授权根。
fn copy_tree(source: &Path, destination: &Path) -> Result<(), String> {
    std::fs::create_dir_all(destination)
        .map_err(|e| format!("创建副本目录失败 {}: {e}", destination.display()))?;
    for entry in std::fs::read_dir(source)
        .map_err(|e| format!("读取源目录失败 {}: {e}", source.display()))?
    {
        let entry = entry.map_err(|e| format!("读取源目录项失败: {e}"))?;
        let name = entry.file_name();
        if name == ".git" {
            continue;
        }
        let from = entry.path();
        let to = destination.join(&name);
        let meta = std::fs::symlink_metadata(&from)
            .map_err(|e| format!("读取源条目元信息失败 {}: {e}", from.display()))?;
        if meta.file_type().is_symlink() {
            return Err(format!("非 Git 任务副本暂不支持符号链接: {}", from.display()));
        }
        if meta.is_dir() {
            copy_tree(&from, &to)?;
        } else if meta.is_file() {
            std::fs::copy(&from, &to)
                .map_err(|e| format!("复制文件失败 {}: {e}", from.display()))?;
        }
    }
    Ok(())
}

/// Git 不认 Windows verbatim 前缀 `\\?\`（会把 `\\?\C:\...` 当成 hostname）。
/// 这里只做传参归一化，不改变实际路径身份。
fn git_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    let cleaned = raw.strip_prefix(r"\\?\").unwrap_or(&raw);
    cleaned.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sandbox_spawn::SandboxSpec;
    use std::fs;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    fn unique_dir(tag: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("ihui-{tag}-{}-{stamp}", std::process::id()))
    }

    fn git(cwd: &Path, args: &[&str]) {
        let out = Command::new("git")
            .arg("-C")
            .arg(git_path(cwd))
            .args(args)
            .output()
            .expect("git 执行");
        assert!(
            out.status.success(),
            "git {:?} 失败: {}",
            args,
            String::from_utf8_lossy(&out.stderr)
        );
    }

    fn read_normalized(path: &Path) -> String {
        fs::read_to_string(path)
            .unwrap_or_default()
            .replace("\r\n", "\n")
    }

    #[test]
    fn appcontainer_writes_stage_and_patch_publishes_source() {
        let source = unique_dir("task-source");
        fs::create_dir_all(&source).unwrap();
        git(&source, &["init", "--quiet"]);
        git(&source, &["config", "user.name", "Test"]);
        git(&source, &["config", "user.email", "test@ihui.local"]);
        fs::write(source.join("a.txt"), "before\n").unwrap();
        git(&source, &["add", "a.txt"]);
        git(&source, &["commit", "--quiet", "-m", "init"]);

        let ws = TaskWorkspace::prepare_git(
            &source,
            &format!("task-{}", std::process::id()),
        )
        .expect("准备任务副本");
        assert_eq!(read_normalized(&ws.stage_root().join("a.txt")), "before\n");

        // 关键：命令在 AppContainer 里跑，cwd 是副本；它没有 internetClient。
        let mut spec = SandboxSpec::new("cmd.exe");
        spec.cwd = Some(ws.stage_root().to_path_buf());
        spec.raw_command_line = Some(r#"cmd.exe /d /s /c "echo after> a.txt""#.to_string());
        spec.limits.job_memory_bytes = 128 * 1024 * 1024;
        let mut child = crate::sandbox_spawn::spawn(&spec).expect("AppContainer 启动");
        let code = child.wait(Some(Duration::from_secs(15))).expect("等待副本命令");
        assert_eq!(code, 0, "副本内写文件应成功");

        // 同一副本里再跑一次 ping：写能力与网络能力必须解耦，副本不是“放宽的沙箱”。
        let mut net = SandboxSpec::new("ping.exe");
        net.cwd = Some(ws.stage_root().to_path_buf());
        net.args = vec!["-n".into(), "1".into(), "8.8.8.8".into()];
        let mut net_child = crate::sandbox_spawn::spawn(&net).expect("AppContainer 网络探测");
        let net_code = net_child
            .wait(Some(Duration::from_secs(15)))
            .expect("等待网络探测");
        let net_out = net_child.read_stdout_to_end().unwrap_or_default();
        assert_ne!(net_code, 0, "任务副本不应能出网: {net_out}");
        assert!(!net_out.contains("TTL="), "任务副本出现了 ping 成功输出: {net_out}");

        assert_eq!(read_normalized(&ws.stage_root().join("a.txt")), "after\n");
        assert_eq!(read_normalized(&source.join("a.txt")), "before\n");

        let patch = ws.diff_patch().expect("生成 patch");
        assert!(patch.contains("a.txt"), "patch 未包含 a.txt: {patch}");
        assert_eq!(ws.changed_files().unwrap(), vec!["M\ta.txt"]);

        let report = ws.publish().expect("发布 patch");
        assert_eq!(report.changed_files, 1);
        assert_eq!(read_normalized(&source.join("a.txt")), "after\n");

        ws.abandon().unwrap();
        assert!(!ws.stage_root().exists());
        let _ = fs::remove_dir_all(&source);
    }

    #[test]
    fn non_git_source_is_copied_and_published_without_overwrite() {
        let source = unique_dir("non-git-source");
        fs::create_dir_all(source.join("docs")).unwrap();
        fs::write(source.join("a.txt"), "before\n").unwrap();
        fs::write(source.join("docs").join("b.txt"), "keep\n").unwrap();

        let ws = TaskWorkspace::prepare(&source, &format!("nongit-{}", std::process::id()))
            .expect("非 Git 源应可准备任务副本");
        assert_eq!(read_normalized(&ws.stage_root().join("a.txt")), "before\n");
        assert_eq!(
            read_normalized(&ws.stage_root().join("docs").join("b.txt")),
            "keep\n"
        );

        fs::write(ws.stage_root().join("a.txt"), "after\n").unwrap();
        fs::write(ws.stage_root().join("docs").join("c.txt"), "new\n").unwrap();
        assert!(ws.write_file("../escape.txt", "x").is_err(), ".. 路径必须拒绝");
        assert!(
            ws.write_file("C:\\Windows\\escape.txt", "x").is_err(),
            "绝对路径必须拒绝"
        );
        let patch = ws.diff_patch().expect("生成非 Git patch");
        assert!(patch.contains("a.txt"), "patch 未包含 a.txt");
        assert_eq!(read_normalized(&source.join("a.txt")), "before\n");

        // 源在任务期间被用户改过：必须拒绝，不能静默覆盖。
        fs::write(source.join("a.txt"), "user-change\n").unwrap();
        let err = ws.publish().expect_err("源改动后发布必须失败");
        assert!(err.contains("被改动"), "冲突必须是显式错误: {err}");
        assert_eq!(read_normalized(&source.join("a.txt")), "user-change\n");

        // 用户恢复原内容后，发布可以继续；新文件也落到源。
        fs::write(source.join("a.txt"), "before\n").unwrap();
        let report = ws.publish().expect("恢复后发布");
        assert_eq!(report.changed_files, 2);
        assert_eq!(read_normalized(&source.join("a.txt")), "after\n");
        assert_eq!(
            read_normalized(&source.join("docs").join("c.txt")),
            "new\n"
        );

        ws.abandon().unwrap();
        let _ = fs::remove_dir_all(&source);
    }

    #[test]
    fn non_git_source_keeps_gitignored_files_in_task_baseline() {
        let source = unique_dir("non-git-ignored");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join(".gitignore"), "ignored.txt\n").unwrap();
        fs::write(source.join("ignored.txt"), "before\n").unwrap();

        let ws = TaskWorkspace::prepare(&source, &format!("ignored-{}", std::process::id()))
            .expect("非 Git 源应可准备任务副本");
        assert_eq!(
            read_normalized(&ws.stage_root().join("ignored.txt")),
            "before\n",
            "被 .gitignore 忽略的文件也必须进入副本基线"
        );
        fs::write(ws.stage_root().join("ignored.txt"), "after\n").unwrap();
        let patch = ws.diff_patch().expect("生成 patch");
        assert!(patch.contains("ignored.txt"), "patch 丢掉了 ignored 文件: {patch}");

        let report = ws.publish().expect("发布 ignored 文件改动");
        assert_eq!(report.changed_files, 1);
        assert_eq!(read_normalized(&source.join("ignored.txt")), "after\n");

        ws.abandon().unwrap();
        let _ = fs::remove_dir_all(&source);
    }

    #[test]
    fn gateway_file_write_stays_inside_stage() {
        let source = unique_dir("gateway-write");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("keep.txt"), "before\n").unwrap();
        let ws = TaskWorkspace::prepare(&source, &format!("write-{}", std::process::id()))
            .expect("非 Git 源应可准备任务副本");

        assert_eq!(
            ws.write_file("nested/gateway.txt", "via-host\n").unwrap(),
            9
        );
        assert_eq!(
            read_normalized(&ws.stage_root().join("nested").join("gateway.txt")),
            "via-host\n"
        );
        assert_eq!(read_normalized(&source.join("keep.txt")), "before\n");
        assert!(ws.write_file("../escape.txt", "x").is_err());
        assert!(
            ws.write_file("C:\\Windows\\escape.txt", "x").is_err(),
            "绝对路径必须拒绝"
        );
        assert!(ws.write_file("NUL", "x").is_err(), "保留设备名必须拒绝");
        assert!(ws.write_file("name:stream", "x").is_err(), "ADS 冒号必须拒绝");
        ws.delete_file("nested/gateway.txt").unwrap();
        assert!(!ws.stage_root().join("nested").join("gateway.txt").exists());
        assert_eq!(read_normalized(&source.join("keep.txt")), "before\n");

        ws.abandon().unwrap();
        let _ = fs::remove_dir_all(&source);
    }

    #[test]
    fn task_delete_is_published_as_source_removal() {
        let source = unique_dir("delete-publish");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("keep.txt"), "keep\n").unwrap();
        fs::write(source.join("delete-me.txt"), "gone\n").unwrap();
        let ws = TaskWorkspace::prepare(&source, &format!("delete-{}", std::process::id()))
            .expect("非 Git 源应可准备任务副本");

        ws.delete_file("delete-me.txt").expect("删除任务副本文件");
        assert!(!ws.stage_root().join("delete-me.txt").exists());
        assert!(source.join("delete-me.txt").exists(), "publish 前源文件不动");

        let report = ws.publish().expect("发布删除");
        assert_eq!(report.changed_files, 1);
        assert!(!source.join("delete-me.txt").exists());
        assert!(source.join("keep.txt").exists());

        ws.abandon().unwrap();
        let _ = fs::remove_dir_all(&source);
    }

    #[test]
    fn dirty_source_and_unsafe_task_id_are_rejected() {
        let source = unique_dir("dirty-source");
        fs::create_dir_all(&source).unwrap();
        git(&source, &["init", "--quiet"]);
        git(&source, &["config", "user.name", "Test"]);
        git(&source, &["config", "user.email", "test@ihui.local"]);
        fs::write(source.join("dirty.txt"), "committed\n").unwrap();
        git(&source, &["add", "dirty.txt"]);
        git(&source, &["commit", "--quiet", "-m", "init"]);
        fs::write(source.join("dirty.txt"), "uncommitted\n").unwrap();

        let err = TaskWorkspace::prepare_git(&source, "task-safe").unwrap_err();
        assert!(err.contains("不干净"), "脏源必须拒绝: {err}");
        assert!(sanitize_task_id("../escape").is_err());
        let _ = fs::remove_dir_all(&source);
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
