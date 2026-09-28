// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

//! 本地 git/diff 通道 —— **纯函数核心**（零 IO、零平台调用、零 tauri 依赖）。
//!
//! 分成两个文件是本仓认可的形状（同 `packages/shared/src/chat/model-load.ts`
//! 的 `deriveTaskStatusBar`：纯逻辑可单测，平台调用留在别处）：
//! - 本文件：`git status --porcelain=v1 -z` 字节流 → 结构化条目；目录包含性校验。
//! - `git_local_status.rs`：Tauri command 出口 + 子进程派生（真去跑 git）。
//!
//! 三态约定（本仓铁律：**不得把"没判到"写成"判过了"**）：
//! `status_outcome_from_z(&[])` 产出 `Facts{entries:[]}`（= 确认无改动），
//! 而任何解析失败产出 `Undetermined{reason}`（= 判不了）。两者是**不同枚举分支**，
//! 调用方结构上无法把它们折叠成同一件事。

use std::fmt;

/// porcelain v1 每条记录 = 2 个状态列 + 1 个空格 + 路径。
pub const STATUS_COLUMNS: usize = 2;
/// 单次结果预算：超过即判"判不了（被截断）",而不是悄悄截断后报"完整清单"。
pub const MAX_ENTRIES: usize = 5000;

/// 变更类别。`Added/Modified/Deleted/Renamed/Untracked` 是任务书要求的四件，
/// 另三类是 porcelain v1 真实会产出、且必须与"未知状态码"区分开的形态。
///
/// 刻意**不**派生 serde：本文件要能被 `rustc --test` 单独编译（零外部依赖），
/// 上线形态由 `git_channel_ipc.rs` 的 DTO 负责。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Ignored,
    Conflicted,
    /// typechange（`T`）：文件类型变了（regular ↔ symlink ↔ gitlink）。
    TypeChange,
}

impl ChangeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ChangeKind::Added => "added",
            ChangeKind::Modified => "modified",
            ChangeKind::Deleted => "deleted",
            ChangeKind::Renamed => "renamed",
            ChangeKind::Copied => "copied",
            ChangeKind::Untracked => "untracked",
            ChangeKind::Ignored => "ignored",
            ChangeKind::Conflicted => "conflicted",
            ChangeKind::TypeChange => "typechange",
        }
    }
}

/// 一条工作区变更。`path` 恒为**相对仓库根**、以 `/` 分隔（git 自己的输出格式）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusEntry {
    pub kind: ChangeKind,
    /// 索引列原值（`X`），逐字保留，便于前端展示与后续对账。
    pub index_status: String,
    /// 工作树列原值（`Y`）。
    pub worktree_status: String,
    pub path: String,
    /// rename/copy 的来源路径（`-z` 形态下是紧随其后的那一个 NUL 字段）。
    pub old_path: Option<String>,
}

/// 解析失败的原因。**每一种都必须落到"判不了"，不得落到"无改动"。**
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseError {
    ShortField { index: usize, field: String },
    MissingSeparator { index: usize, field: String },
    UnknownStatusCode { index: usize, code: String },
    RenameSourceMissing { index: usize, path: String },
    /// 非 UTF-8 路径字节。**刻意不做 lossy 转换**：U+FFFD 会改变包含性校验的输入，
    /// 把"看不清的路径"当成"看得清的路径"去判越界，正是本仓最高频的失效型。
    InvalidUtf8 { index: usize },
    /// 行形态（未加 `-z`）下 git 会给路径加双引号 + C 转义；本核心不实现反转义，
    /// 判"不了"而不是猜一个可能错的路径。
    QuotedPathUnsupported { index: usize, field: String },
    /// 行形态的 `old -> new` 出现多个分隔串，归属不可判。
    AmbiguousRenameArrow { index: usize, field: String },
    /// `-z` 记录里出现了预期之外的分支头/注释字段（`--branch` 属 v2 语义）。
    UnexpectedV2Field { index: usize, field: String },
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ParseError::ShortField { index, field } => {
                write!(f, "记录 #{index} 长度不足（应为 2 状态列 + 空格 + 路径）：{field:?}")
            }
            ParseError::MissingSeparator { index, field } => {
                write!(f, "记录 #{index} 缺少状态列与路径之间的空格分隔：{field:?}")
            }
            ParseError::UnknownStatusCode { index, code } => {
                write!(f, "记录 #{index} 的状态码 {code:?} 不在 porcelain v1 已知集合内")
            }
            ParseError::RenameSourceMissing { index, path } => {
                write!(f, "记录 #{index} 声明为 rename/copy 但其后没有来源路径字段：{path:?}")
            }
            ParseError::InvalidUtf8 { index } => {
                write!(f, "记录 #{index} 的路径含非 UTF-8 字节，无法在不猜测的前提下继续")
            }
            ParseError::QuotedPathUnsupported { index, field } => {
                write!(f, "记录 #{index} 为带引号转义的路径（缺 -z），本核心不反转义：{field:?}")
            }
            ParseError::AmbiguousRenameArrow { index, field } => {
                write!(f, "记录 #{index} 含多个 \" -> \"，old/new 归属不可判：{field:?}")
            }
            ParseError::UnexpectedV2Field { index, field } => {
                write!(f, "记录 #{index} 是 porcelain v2/`--branch` 字段，v1 通道不接受：{field:?}")
            }
        }
    }
}

impl ParseError {
    pub fn reason(&self) -> String {
        self.to_string()
    }
}

/// 判据层三态。`Undetermined` 与 `Facts{entries: Vec::new()}` 是**两个分支**。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StatusOutcome {
    Facts { entries: Vec<StatusEntry> },
    Undetermined { reason: String },
}

impl StatusOutcome {
    pub fn is_undetermined(&self) -> bool {
        matches!(self, StatusOutcome::Undetermined { .. })
    }
}

/// 把字节切成 NUL 分隔的字段。
///
/// 规则：**一个终止符不产生额外空字段**（`"A x\0"` → `["A x"]`），
/// 但**内部的双 NUL 会产生空字段**并交由记录解析判红（那才是真畸形输出）。
/// 末尾没有 NUL 的残段照样进入字段表 —— 它通常意味着输出被截断。
fn split_nul(raw: &[u8]) -> Vec<&[u8]> {
    let mut fields = Vec::new();
    let mut start = 0usize;
    for (i, byte) in raw.iter().enumerate() {
        if *byte == 0 {
            fields.push(&raw[start..i]);
            start = i + 1;
        }
    }
    if start < raw.len() {
        fields.push(&raw[start..]);
    }
    fields
}

fn preview(bytes: &[u8]) -> String {
    let s = String::from_utf8_lossy(bytes);
    s.chars().take(120).collect()
}

fn decode(bytes: &[u8], index: usize) -> Result<String, ParseError> {
    match std::str::from_utf8(bytes) {
        Ok(s) => Ok(s.to_string()),
        Err(_) => Err(ParseError::InvalidUtf8 { index }),
    }
}

/// 索引列 / 工作树列的合法字符集（porcelain v1）。空格代表"该侧无变化"。
///
/// 工作树列**必须含 `A`**：未合并行 `AA` 的第二列就是 A（`DD AU UD UA DU AA` 是 v1
/// 的六种冲突形态）。第一次写这表时漏了 A，于是 `AA` 整行被判"未知状态码" ——
/// 即"仓库里有冲突"被读成"我看不懂这个输出"，方向上仍然安全，但把一个真实现象
/// 报成了判据失明，属于该被单测抓住的错（它抓住了）。
fn known_column_byte(b: u8, is_index: bool) -> bool {
    const INDEX: &[u8] = b" MARCDUT?!";
    const WORKTREE: &[u8] = b" MDATCU?!";
    if is_index {
        INDEX.contains(&b)
    } else {
        WORKTREE.contains(&b)
    }
}

/// 未合并（冲突）状态码：v1 会为每个 stage 各打一行，共 6 种组合。
fn is_conflict_code(code: &str) -> bool {
    matches!(code, "DD" | "AU" | "UD" | "UA" | "DU" | "AA")
}

fn classify_code(code: &str) -> Option<ChangeKind> {
    let b = code.as_bytes();
    if b.len() != 2 {
        return None;
    }
    let (x, y) = (b[0], b[1]);
    if x == b'?' && y == b'?' {
        return Some(ChangeKind::Untracked);
    }
    if x == b'!' && y == b'!' {
        return Some(ChangeKind::Ignored);
    }
    if x == b'U' || y == b'U' || is_conflict_code(code) {
        return Some(ChangeKind::Conflicted);
    }
    // 优先级：rename/copy > added > deleted > typechange > modified。
    // 依据：一行同时含 A 与 M（暂存后又有工作树改动）时，用户要看到的是"新增"这一事件。
    if x == b'R' || y == b'R' {
        return Some(ChangeKind::Renamed);
    }
    if x == b'C' || y == b'C' {
        return Some(ChangeKind::Copied);
    }
    if x == b'A' {
        return Some(ChangeKind::Added);
    }
    if x == b'D' || y == b'D' {
        return Some(ChangeKind::Deleted);
    }
    if x == b'T' || y == b'T' {
        return Some(ChangeKind::TypeChange);
    }
    if x == b'M' || y == b'M' {
        return Some(ChangeKind::Modified);
    }
    if x == b' ' && y == b' ' {
        // git 不会产出 `"  path"`；出现即说明输入不是我们以为的那个格式。
        return None;
    }
    None
}

/// 解析单条记录。返回（条目，消耗掉的字段数）；rename/copy 在 `-z` 下消耗 2。
fn parse_record(
    field: &[u8],
    index: usize,
    next: Option<&[u8]>,
) -> Result<(StatusEntry, usize), ParseError> {
    let text = decode(field, index)?;
    if text.starts_with('"') {
        return Err(ParseError::QuotedPathUnsupported {
            index,
            field: preview(field),
        });
    }
    if text.starts_with("# branch") || text.starts_with("! ") {
        return Err(ParseError::UnexpectedV2Field {
            index,
            field: preview(field),
        });
    }
    let bytes = text.as_bytes();
    if bytes.len() <= STATUS_COLUMNS {
        return Err(ParseError::ShortField {
            index,
            field: preview(field),
        });
    }
    // bytes[2] == b' '  ⇒  下标 2 必是字符边界（0x20 不可能是 UTF-8 续字节），
    // 所以 &text[..2] / &text[3..] 不会 panic。
    if bytes[STATUS_COLUMNS] != b' ' {
        return Err(ParseError::MissingSeparator {
            index,
            field: preview(field),
        });
    }
    let x_byte = bytes[0];
    let y_byte = bytes[1];
    let code = &text[..STATUS_COLUMNS];
    let path_part = &text[STATUS_COLUMNS + 1..];
    let kind = match classify_code(code) {
        Some(k) => k,
        None => {
            return Err(ParseError::UnknownStatusCode {
                index,
                code: code.to_string(),
            })
        }
    };
    if !known_column_byte(x_byte, true) || !known_column_byte(y_byte, false) {
        return Err(ParseError::UnknownStatusCode {
            index,
            code: code.to_string(),
        });
    }

    let needs_source = matches!(kind, ChangeKind::Renamed | ChangeKind::Copied);
    if path_part.starts_with('"') {
        // 未加 -z 时 git 给含空格/特殊符的路径加双引号 + C 转义；不反转义就不判。
        return Err(ParseError::QuotedPathUnsupported {
            index,
            field: preview(field),
        });
    }
    let (path, old_path, consumed) = if needs_source {
        match next {
            Some(src) => (path_part.to_string(), Some(decode(src, index + 1)?), 2usize),
            None => {
                return Err(ParseError::RenameSourceMissing {
                    index,
                    path: preview(field),
                })
            }
        }
    } else {
        (path_part.to_string(), None, 1usize)
    };

    Ok((
        StatusEntry {
            kind,
            index_status: (x_byte as char).to_string(),
            worktree_status: (y_byte as char).to_string(),
            path,
            old_path,
        },
        consumed,
    ))
}

/// `-z` 形态主解析器。`raw` 为空 ⇒ `Ok(vec![])`（确认无改动，不是"判不了"）。
pub fn parse_porcelain_z(raw: &[u8]) -> Result<Vec<StatusEntry>, ParseError> {
    if raw.is_empty() {
        return Ok(Vec::new());
    }
    let fields = split_nul(raw);
    let mut entries = Vec::with_capacity(fields.len());
    let mut i = 0usize;
    while i < fields.len() {
        let next = if i + 1 < fields.len() {
            Some(fields[i + 1])
        } else {
            None
        };
        let (entry, consumed) = parse_record(fields[i], i, next)?;
        entries.push(entry);
        i += consumed;
    }
    Ok(entries)
}

/// 行形态（**未** 加 `-z`）解析器：git 用 `R  old -> new` 表达 rename。
/// 只作降级兜底与回归覆盖用；正常通道走 `parse_porcelain_z`。
pub fn parse_porcelain_lines(raw: &str) -> Result<Vec<StatusEntry>, ParseError> {
    let mut entries = Vec::new();
    for (index, line) in raw.split('\n').enumerate() {
        let line = line.strip_suffix('\r').unwrap_or(line);
        if line.is_empty() {
            continue;
        }
        let field = line.as_bytes();
        let text = decode(field, index)?;
        if text.starts_with('"') {
            return Err(ParseError::QuotedPathUnsupported {
                index,
                field: preview(field),
            });
        }
        let bytes = text.as_bytes();
        if bytes.len() <= STATUS_COLUMNS {
            return Err(ParseError::ShortField {
                index,
                field: preview(field),
            });
        }
        // bytes[2] == b' ' ⇒ 下标 2 是字符边界（见 parse_record 同一论证）。
        if bytes[STATUS_COLUMNS] != b' ' {
            return Err(ParseError::MissingSeparator {
                index,
                field: preview(field),
            });
        }
        let code = &text[..STATUS_COLUMNS];
        let kind = classify_code(code)
            .ok_or_else(|| ParseError::UnknownStatusCode {
                index,
                code: preview(field),
            })?;
        let path_part = &text[STATUS_COLUMNS + 1..];
        if path_part.starts_with('"') {
            // 未加 -z 时 git 给含空格/控制符的路径加引号转义，本核心不猜。
            return Err(ParseError::QuotedPathUnsupported {
                index,
                field: preview(field),
            });
        }
        let (path, old_path) = if matches!(kind, ChangeKind::Renamed | ChangeKind::Copied) {
            let hits: Vec<usize> = path_part.match_indices(" -> ").map(|(p, _)| p).collect();
            match hits.len() {
                1 => {
                    let at = hits[0];
                    (
                        path_part[at + 4..].to_string(),
                        Some(path_part[..at].to_string()),
                    )
                }
                0 => {
                    return Err(ParseError::RenameSourceMissing {
                        index,
                        path: preview(field),
                    })
                }
                _ => {
                    return Err(ParseError::AmbiguousRenameArrow {
                        index,
                        field: preview(field),
                    })
                }
            }
        } else {
            (path_part.to_string(), None)
        };
        entries.push(StatusEntry {
            kind,
            index_status: (bytes[0] as char).to_string(),
            worktree_status: (bytes[1] as char).to_string(),
            path,
            old_path,
        });
    }
    Ok(entries)
}

/// 判据装配：解析结果 + 结果预算 ⇒ 三态。
pub fn status_outcome_from_z(raw: &[u8]) -> StatusOutcome {
    match parse_porcelain_z(raw) {
        Ok(entries) if entries.len() > MAX_ENTRIES => StatusOutcome::Undetermined {
            reason: format!(
                "变更条目 {} 超过单次预算 {}，清单不完整（拒绝出具合格证）",
                entries.len(),
                MAX_ENTRIES
            ),
        },
        Ok(entries) => StatusOutcome::Facts { entries },
        Err(err) => StatusOutcome::Undetermined {
            reason: err.reason(),
        },
    }
}

/// 三态：`Inside` 才可放行；`Outside` 是明确越界；`Undetermined` 一律按拒绝处置
/// 但**原因不同**（前者是"不该给你看"，后者是"我没看清"，报告里不得混写）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Contain {
    Inside,
    Outside,
    Undetermined,
}

impl Contain {
    pub fn as_str(self) -> &'static str {
        match self {
            Contain::Inside => "inside",
            Contain::Outside => "outside",
            Contain::Undetermined => "undetermined",
        }
    }
    pub fn is_inside(self) -> bool {
        matches!(self, Contain::Inside)
    }
}

fn has_control_char(s: &str) -> bool {
    s.chars().any(|c| c.is_control())
}

/// Windows 盘符前缀（`C:` / `c:`）。返回冒号下标。
fn drive_prefix(s: &str) -> Option<usize> {
    let b = s.as_bytes();
    if b.len() >= 2 && b[0].is_ascii_alphabetic() && b[1] == b':' {
        Some(1)
    } else {
        None
    }
}

/// `\\?\` / `\\.\` / UNC `\\server\share` —— 这些形态的语义不是"一个目录下的相对路径"，
/// 也不受普通 `..` 归一约束，判"不了"。
fn is_verbatim_or_unc(s: &str) -> bool {
    s.starts_with("\\\\")
}

/// 归一**相对**路径成分：折叠 `.`、按 `..` 回退；一旦回退越过根即 `Outside`。
/// 绝对路径（`/`、`\`、盘符开头）作为"前端自报的相对路径"出现 ⇒ `Outside`（防穿越/防覆盖根）。
pub fn normalize_rel(rel: &str) -> Result<Vec<String>, Contain> {
    if rel.is_empty() {
        return Ok(Vec::new());
    }
    if has_control_char(rel) || is_verbatim_or_unc(rel) {
        return Err(Contain::Undetermined);
    }
    if rel.starts_with('/') || rel.starts_with('\\') {
        return Err(Contain::Outside);
    }
    if drive_prefix(rel).is_some() {
        return Err(Contain::Outside);
    }
    let mut out: Vec<String> = Vec::new();
    for part in rel.split(|c: char| c == '/' || c == '\\') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            if out.is_empty() {
                return Err(Contain::Outside);
            }
            out.pop();
            continue;
        }
        out.push(part.to_string());
    }
    Ok(out)
}

/// 拆绝对路径为（盘符, 成分）。盘符统一小写后比较由调用方决定，这里只剥壳。
fn split_absolute(absolute: &str) -> Result<(Option<String>, Vec<String>), Contain> {
    if absolute.is_empty() || has_control_char(absolute) || is_verbatim_or_unc(absolute) {
        return Err(Contain::Undetermined);
    }
    let (drive, rest) = match drive_prefix(absolute) {
        Some(at) => {
            let d = absolute[..at].to_ascii_lowercase();
            (Some(d), &absolute[at + 1..])
        }
        None if absolute.starts_with('/') || absolute.starts_with('\\') => (None, absolute),
        None => return Err(Contain::Undetermined),
    };
    let mut out: Vec<String> = Vec::new();
    for part in rest.split(|c: char| c == '/' || c == '\\') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            // 根内 `..` 只能停在根；出现即说明规格本身可疑，不猜。
            return Err(Contain::Undetermined);
        }
        out.push(part.to_string());
    }
    Ok((drive, out))
}

/// 目录包含性校验（纯函数）。`fold_ascii_case` 对应 Windows 大小写不敏感的卷。
///
/// 刻意**不碰文件系统**：符号链接/junction 逃逸由 command 层用 `canonicalize` 之后再喂进来。
/// 也就是说本函数判的是"字符串层面的包含"，它挡的是 `..` 与绝对路径注入，
/// **挡不住**根目录内部一个指向外部的 symlink —— 那一维在报告里如实登记为未收口。
pub fn path_within_root(root: &str, target: &str, fold_ascii_case: bool) -> Contain {
    let (rd, mut rc) = match split_absolute(root) {
        Ok(v) => v,
        Err(c) => return c,
    };
    let (td, tc) = match split_absolute(target) {
        Ok(v) => v,
        Err(c) => return c,
    };
    if rd != td {
        return Contain::Outside;
    }
    let (rc, tc) = if fold_ascii_case {
        (
            rc.drain(..).map(|p| p.to_ascii_lowercase()).collect::<Vec<_>>(),
            tc.into_iter().map(|p| p.to_ascii_lowercase()).collect::<Vec<_>>(),
        )
    } else {
        (rc.drain(..).collect::<Vec<_>>(), tc)
    };
    if rc.len() > tc.len() {
        return Contain::Outside;
    }
    for i in 0..rc.len() {
        if rc[i] != tc[i] {
            return Contain::Outside;
        }
    }
    Contain::Inside
}

/// 前端传来的相对路径是否可作为工作区内的目标。空串 = 仓库根本身 ⇒ 允许。
pub fn classify_rel_target(rel: &str) -> Contain {
    match normalize_rel(rel) {
        Ok(_) => Contain::Inside,
        Err(verdict) => verdict,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 把 `"M  a.rs"` 这类片段拼成 `-z` 字节流：每条以 NUL 结尾。
    fn z(parts: &[&str]) -> Vec<u8> {
        let mut raw = Vec::new();
        for p in parts {
            raw.extend_from_slice(p.as_bytes());
            raw.push(0);
        }
        raw
    }

    // ---------- ① 各状态解析 ----------

    #[test]
    fn parses_every_required_status() {
        let raw = z(&[
            "A  new-file.rs",
            " M dirty.rs",
            "M  staged.rs",
            " D gone.rs",
            "?? brand-new.rs",
        ]);
        let entries = parse_porcelain_z(&raw).expect("应全部解析成功");
        let kinds: Vec<ChangeKind> = entries.iter().map(|e| e.kind).collect();
        assert_eq!(
            kinds,
            vec![
                ChangeKind::Added,
                ChangeKind::Modified,
                ChangeKind::Modified,
                ChangeKind::Deleted,
                ChangeKind::Untracked,
            ]
        );
        assert_eq!(entries[0].path, "new-file.rs");
        assert_eq!(entries[1].path, "dirty.rs");
        assert_eq!(entries[4].path, "brand-new.rs");
        // 状态列原值必须留痕（前端展示与后续对账要用）
        assert_eq!(entries[0].index_status, "A");
        assert_eq!(entries[1].index_status, " ");
        assert_eq!(entries[1].worktree_status, "M");
    }

    #[test]
    fn parses_conflict_ignored_and_typechange() {
        let raw = z(&["AA both.rs", "!! secret.env", "T  now-a-link.rs"]);
        let entries = parse_porcelain_z(&raw).expect("三类已知码不得判失败");
        assert_eq!(entries[0].kind, ChangeKind::Conflicted);
        assert_eq!(entries[1].kind, ChangeKind::Ignored);
        assert_eq!(entries[2].kind, ChangeKind::TypeChange);
    }

    // ---------- ② NUL 分隔不被当普通空格 ----------

    #[test]
    fn nul_is_the_only_record_delimiter_spaces_stay_in_path() {
        // 整份输出里有大量空格（状态列后那个 + 路径内部的），分隔只认 NUL。
        let raw = z(&["M  dir with spaces/a file.txt"]);
        let entries = parse_porcelain_z(&raw).expect("路径里的空格必须属于路径");
        assert_eq!(entries.len(), 1, "不得按空格/普通分隔拆成多条");
        assert_eq!(entries[0].path, "dir with spaces/a file.txt");
    }

    #[test]
    fn arrow_text_inside_a_path_is_not_split_in_z_mode() {
        // `-z` 下 rename 来源在**下一个字段**，所以路径里的 " -> " 只是文件名的一部分。
        let raw = z(&["M  notes/a -> b.md"]);
        let entries = parse_porcelain_z(&raw).expect("普通修改行不参与 -> 拆分");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "notes/a -> b.md");
        assert_eq!(entries[0].old_path, None);
    }

    #[test]
    fn unterminated_tail_is_still_parsed_not_dropped() {
        // 输出被截断（末条没有终止 NUL）时，宁可解析出这一条也不静默丢掉。
        let mut raw = z(&["M  a.rs"]);
        raw.extend_from_slice(b"?? b.rs");
        let entries = parse_porcelain_z(&raw).expect("残段也要给结论");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[1].kind, ChangeKind::Untracked);
    }

    // ---------- ③ 越界路径被拒 ----------

    #[test]
    fn rejects_escaping_and_absolute_targets() {
        assert_eq!(
            classify_rel_target("../outside.txt"),
            Contain::Outside,
            "..  越出根必须拒"
        );
        assert_eq!(
            classify_rel_target("src/../../outside.txt"),
            Contain::Outside,
            "先进再出同样越界"
        );
        assert_eq!(
            classify_rel_target("/etc/passwd"),
            Contain::Outside,
            "绝对路径不得当作仓库内相对路径"
        );
        assert_eq!(
            classify_rel_target("C:/Windows/win.ini"),
            Contain::Outside,
            "盘符开头的自报路径必须拒"
        );
        assert_eq!(
            classify_rel_target("\\\\?\\G:\\IHUI-AI\\x"),
            Contain::Undetermined,
            "verbatim 语法判不了 ⇒ 按拒处理，但原因不同"
        );
        assert_eq!(classify_rel_target("src\u{0}-main.rs"), Contain::Undetermined);
        assert_eq!(classify_rel_target("src/main.rs"), Contain::Inside);
        assert_eq!(classify_rel_target("./src/main.rs"), Contain::Inside);
        assert_eq!(classify_rel_target(""), Contain::Inside, "空串 = 仓库根本身");
    }

    #[test]
    fn containment_is_component_wise_not_prefix_string() {
        let root = "G:/IHUI-AI";
        assert_eq!(
            path_within_root(root, "G:/IHUI-AI/apps/desktop", true),
            Contain::Inside
        );
        assert_eq!(path_within_root(root, "G:/IHUI-AI", true), Contain::Inside);
        assert_eq!(
            path_within_root(root, "G:/IHUI-AI-OTHER/x", true),
            Contain::Outside,
            "字符串前缀相等但目录不同：必须按成分比"
        );
        assert_eq!(
            path_within_root(root, "G:/ihui-ai/apps", true),
            Contain::Inside,
            "Windows 卷大小写不敏感"
        );
        assert_eq!(
            path_within_root(root, "G:/ihui-ai/apps", false),
            Contain::Outside,
            "关掉折叠后不得仍算命中（折叠判据本身要可验）"
        );
        assert_eq!(
            path_within_root(root, "D:/IHUI-AI/apps", true),
            Contain::Outside,
            "换盘即越界"
        );
        assert_eq!(
            path_within_root(root, "IHUI-AI/apps", true),
            Contain::Undetermined,
            "相对规格无法与绝对根比较 ⇒ 判不了，不得算命中"
        );
        assert_eq!(
            path_within_root(root, "G:/IHUI-AI/../Windows", true),
            Contain::Undetermined,
            "根规格里带 .. ⇒ 不猜"
        );
    }

    // ---------- ④ 空输出 vs 解析失败：必须分家 ----------

    #[test]
    fn empty_output_is_no_changes_while_malformed_is_undetermined() {
        let clean = status_outcome_from_z(b"");
        let blind = status_outcome_from_z(b"XY weird line without nul");
        match (&clean, &blind) {
            (StatusOutcome::Facts { entries }, StatusOutcome::Undetermined { reason }) => {
                assert!(entries.is_empty(), "空输出 = 确认无改动");
                assert!(
                    reason.contains("状态码"),
                    "判不了的原因必须点名为什么判不了，实得：{reason}"
                );
            }
            other => panic!("两态不得折叠为一：{other:?}"),
        }
        assert!(!clean.is_undetermined());
        assert!(blind.is_undetermined());
        // 缺分隔符的畸形行也要落到"判不了"
        assert!(status_outcome_from_z(&z(&["Zmissing separator"])).is_undetermined());
        // 双 NUL（空记录）同样是畸形
        assert!(status_outcome_from_z(b"M  a.rs\x00\x00").is_undetermined());
        // 非 UTF-8 路径字节 ⇒ 判不了（禁止 lossy 之后继续做包含性校验）
        let mut raw = Vec::new();
        raw.extend_from_slice(b"M  bad\xff.rs");
        raw.push(0);
        assert!(status_outcome_from_z(&raw).is_undetermined());
    }

    #[test]
    fn v2_and_quoted_fields_are_refused_not_guessed() {
        assert!(status_outcome_from_z(&z(&["# branch.oid (head)"])).is_undetermined());
        assert!(status_outcome_from_z(&z(&["M  \"quoted path.rs\""])).is_undetermined());
    }

    #[test]
    fn oversized_result_is_undetermined_not_truncated() {
        let mut raw = Vec::new();
        for i in 0..(MAX_ENTRIES + 1) {
            raw.extend_from_slice(format!(" M f{i}.rs").as_bytes());
            raw.push(0);
        }
        let outcome = status_outcome_from_z(&raw);
        assert!(outcome.is_undetermined(), "超预算必须喊判不了，不得交一份残缺清单");
    }

    // ---------- ⑤ rename 的 old->new 形态 ----------

    #[test]
    fn rename_uses_next_field_in_z_mode() {
        let raw = z(&["R  src/new-name.rs", "src/old-name.rs", " M other.rs"]);
        let entries = parse_porcelain_z(&raw).expect("rename 双字段形态");
        assert_eq!(entries.len(), 2, "来源字段不得被当成第 2 条记录");
        assert_eq!(entries[0].kind, ChangeKind::Renamed);
        assert_eq!(entries[0].path, "src/new-name.rs");
        assert_eq!(entries[0].old_path.as_deref(), Some("src/old-name.rs"));
        assert_eq!(entries[1].path, "other.rs");
    }

    #[test]
    fn rename_without_source_field_is_undetermined() {
        assert!(status_outcome_from_z(&z(&["R  only-new.rs"])).is_undetermined());
    }

    #[test]
    fn rename_arrow_form_parses_in_line_mode() {
        let raw = "R  src/old.rs -> src/new.rs\nM  staged.rs\n?? u.rs\n";
        let entries = parse_porcelain_lines(raw).expect("行形态 -> 拆分");
        assert_eq!(entries[0].kind, ChangeKind::Renamed);
        assert_eq!(entries[0].old_path.as_deref(), Some("src/old.rs"));
        assert_eq!(entries[0].path, "src/new.rs");
        assert_eq!(entries[1].kind, ChangeKind::Modified);
        assert_eq!(entries[2].kind, ChangeKind::Untracked);
        assert_eq!(
            parse_porcelain_lines("").expect("空行形态").len(),
            0,
            "空输入 = 无改动"
        );
        assert!(parse_porcelain_lines("R  a -> b -> c").is_err(), "多个 -> 归属不可判");
        assert!(parse_porcelain_lines("M  \"q uoted\"").is_err());
    }

    #[test]
    fn kinds_have_stable_wire_names() {
        assert_eq!(ChangeKind::Added.as_str(), "added");
        assert_eq!(ChangeKind::Renamed.as_str(), "renamed");
        assert_eq!(Contain::Undetermined.as_str(), "undetermined");
    }
}
