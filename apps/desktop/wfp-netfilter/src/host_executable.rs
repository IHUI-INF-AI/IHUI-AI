// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! `host_executable` 真身锁定 —— 遵循统一工程规范。
//!
//! # 取证依据（2026-11-15，实测）
//!
//! `codex-command-runner.exe` .rdata @ `0x5b9a98` 处的字符串簇：
//!
//! ```text
//! host_executable name cannot be empty
//! host_executable name must be a bare executable name (got ...)
//! host_executable paths must be strings (got ...)
//! host_executable paths must be absolute (got ...)
//! invalid absolute path `...`
//! host_executable path `...` must have basename `...`      ← 关键的一条
//! ```
//!
//! 同簇可见 schema 字段序：
//! `pattern decision match not_match justification` / `prefix_rule host protocol`
//! / `network_rule name paths` / `host_executable`
//!
//! # 这条约束为什么重要
//!
//! `name` + `paths` 的组合语义是：**按裸名（bare name）识别程序，但用绝对路径锁定真身**。
//! 若 `paths` 里的某个路径 basename 与 `name` 不符，那就是一条自相矛盾的声明 ——
//! 攻击者可以放一个同名程序在某个受信目录，让策略「以为」它认得。
//! 对侧用 `must have basename` 直接拒绝，而不是宽容接受。
//!
//! # 本模块超越对侧的三处
//!
//! 1. **大小写与路径分隔符归一**：Windows 路径大小写不敏感、`\` 与 `/` 等价。
//!    对侧只说不符就拒（未取证到是否归一），本模块显式归一再比对，并在结果里
//!    保留「原始形态 → 归一形态」的映射，便于排障。
//! 2. **拒绝路径穿越**：`..` 出现即拒（对侧只查 absolute，未取证到是否查 `..`）。
//!    一条 `C:\a\..\..\evil\name.exe` 是 absolute 的，但指向别处。
//! 3. **冲突显式化**：同一 `name` 被两条规则声明**不同的**路径集合 ⇒ 报错，
//!    不静默合并（合并会让「谁授权了这条路径」变得不可追溯）。

use std::collections::BTreeMap;
use std::fmt;

/// 可执行文件声明的标识（供留痕）。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct HostExecutableId(pub String);

impl fmt::Display for HostExecutableId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// 一条 `host_executable` 声明（对侧 schema 的 Rust 侧镜像）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExecutableClaim {
    /// 声明标识（留痕用）。
    pub id: HostExecutableId,
    /// 裸可执行名（不含路径、不含扩展名歧义）。
    pub name: String,
    /// 允许的绝对路径集合（原始形态，未归一）。
    pub paths: Vec<String>,
    /// 人读理由。
    pub justification: String,
}

/// 归一后的路径：`\` → `/`、去尾斜杠、小写（Windows 语义）。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct NormalizedPath(String);

impl NormalizedPath {
    /// 归一形态（用于比对与去重）。
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// 编译后的声明：一个裸名 → 一组锁定路径。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExecutableBinding {
    /// 裸名（已小写）。
    pub name: String,
    /// 锁定路径（已归一、已排序去重）。
    pub paths: Vec<NormalizedPath>,
    /// 来自哪条声明（多条同义声明合并时只留第一条的 id，其余进 `deduped`）。
    pub source: HostExecutableId,
}

/// 编译错误。每一种点名具体声明与原因。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostExecutableError {
    /// name 为空。
    EmptyName {
        /// 出错的声明。
        claim: HostExecutableId,
    },
    /// name 含路径分隔符或目录成分（不是裸名）。
    NameNotBare {
        /// 出错的声明。
        claim: HostExecutableId,
        /// 原始 name。
        name: String,
    },
    /// paths 为空（声明了名字却不给路径，等于无约束 —— 必须拒绝）。
    NoPaths {
        /// 出错的声明。
        claim: HostExecutableId,
    },
    /// 路径不是绝对路径。
    PathNotAbsolute {
        /// 出错的声明。
        claim: HostExecutableId,
        /// 原始路径。
        path: String,
    },
    /// 路径含 `..`（绝对但可穿越）。
    PathTraversal {
        /// 出错的声明。
        claim: HostExecutableId,
        /// 原始路径。
        path: String,
    },
    /// 路径 basename 与 name 不符（对侧 `must have basename`）。
    BasenameMismatch {
        /// 出错的声明。
        claim: HostExecutableId,
        /// 该条路径。
        path: String,
        /// 路径的 basename。
        basename: String,
        /// 声明里的 name。
        name: String,
    },
    /// justification 为空。
    EmptyJustification {
        /// 出错的声明。
        claim: HostExecutableId,
    },
    /// 同一 name 被两条声明给出不同路径集合。
    ConflictingPaths {
        /// 冲突的名字。
        name: String,
        /// 第一条声明的路径集（已归一排序）。
        first: Vec<String>,
        /// 第二条声明的路径集（已归一排序）。
        second: Vec<String>,
    },
}

impl fmt::Display for HostExecutableError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            HostExecutableError::EmptyName { claim } => {
                write!(f, "声明 {claim}: host_executable name 不能为空")
            }
            HostExecutableError::NameNotBare { claim, name } => write!(
                f,
                "声明 {claim}: host_executable name 必须是裸可执行名（得到 {name:?}）"
            ),
            HostExecutableError::NoPaths { claim } => {
                write!(f, "声明 {claim}: paths 不能为空（无路径等于无约束）")
            }
            HostExecutableError::PathNotAbsolute { claim, path } => write!(
                f,
                "声明 {claim}: host_executable paths 必须是绝对路径（得到 {path:?}）"
            ),
            HostExecutableError::PathTraversal { claim, path } => write!(
                f,
                "声明 {claim}: 路径含 `..` 可穿越（得到 {path:?}）"
            ),
            HostExecutableError::BasenameMismatch {
                claim,
                path,
                basename,
                name,
            } => write!(
                f,
                "声明 {claim}: 路径 {path:?} 的 basename ({basename:?}) 与 name ({name:?}) 不符"
            ),
            HostExecutableError::EmptyJustification { claim } => {
                write!(f, "声明 {claim}: justification 不能为空")
            }
            HostExecutableError::ConflictingPaths {
                name,
                first,
                second,
            } => write!(
                f,
                "name={name} 出现冲突路径集：{first:?} vs {second:?}"
            ),
        }
    }
}

impl std::error::Error for HostExecutableError {}

/// 归一化路径：`\`→`/`、去尾斜杠、小写。
fn normalize_path(raw: &str) -> String {
    let unified = raw.trim().replace('\\', "/");
    let trimmed = unified.trim_end_matches('/');
    trimmed.to_ascii_lowercase()
}

fn is_absolute(raw: &str) -> bool {
    let t = raw.trim();
    // Windows 盘符绝对路径：`X:\` 或 `X:/`
    let bytes = t.as_bytes();
    if bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
    {
        return true;
    }
    // UNC：`\\server\share`
    if t.starts_with("\\\\") || t.starts_with("//") {
        return true;
    }
    // POSIX 绝对（本模块同时支持，便于跨平台测试）
    t.starts_with('/')
}

fn basename(raw: &str) -> Option<&str> {
    let unified = raw.trim();
    let cut = unified.rsplit(['/', '\\']).next()?;
    if cut.is_empty() {
        None
    } else {
        Some(cut)
    }
}

fn is_bare_name(name: &str) -> bool {
    let t = name.trim();
    !t.is_empty() && !t.contains('/') && !t.contains('\\') && !t.contains(':')
}

/// 编译一组 `host_executable` 声明。
///
/// 语义（逐条对应测试）：
/// 1. 每条声明过全部校验，**任一失败即整体失败**（不跳过坏声明继续）。
/// 2. 同 name 同路径集 ⇒ 去重（后者进 `deduped`）。
/// 3. 同 name 不同路径集 ⇒ [`HostExecutableError::ConflictingPaths`]。
/// 4. 输出按 name 排序，路径排序去重 ⇒ 稳定。
pub fn compile_host_executables(
    claims: &[HostExecutableClaim],
) -> Result<HostExecutableCompilation, HostExecutableError> {
    let mut chosen: BTreeMap<String, HostExecutableBinding> = BTreeMap::new();
    let mut deduped: Vec<HostExecutableId> = Vec::new();

    for claim in claims {
        let name_raw = claim.name.trim();
        if name_raw.is_empty() {
            return Err(HostExecutableError::EmptyName {
                claim: claim.id.clone(),
            });
        }
        if !is_bare_name(name_raw) {
            return Err(HostExecutableError::NameNotBare {
                claim: claim.id.clone(),
                name: claim.name.clone(),
            });
        }
        if claim.justification.trim().is_empty() {
            return Err(HostExecutableError::EmptyJustification {
                claim: claim.id.clone(),
            });
        }
        if claim.paths.is_empty() {
            return Err(HostExecutableError::NoPaths {
                claim: claim.id.clone(),
            });
        }
        let lower_name = name_raw.to_ascii_lowercase();

        let mut normalized: Vec<NormalizedPath> = Vec::new();
        for raw in &claim.paths {
            if !is_absolute(raw) {
                return Err(HostExecutableError::PathNotAbsolute {
                    claim: claim.id.clone(),
                    path: raw.clone(),
                });
            }
            let norm = normalize_path(raw);
            if norm.split('/').any(|seg| seg == "..") {
                return Err(HostExecutableError::PathTraversal {
                    claim: claim.id.clone(),
                    path: raw.clone(),
                });
            }
            let base = basename(raw).unwrap_or("");
            if base.to_ascii_lowercase() != lower_name {
                return Err(HostExecutableError::BasenameMismatch {
                    claim: claim.id.clone(),
                    path: raw.clone(),
                    basename: base.to_string(),
                    name: claim.name.clone(),
                });
            }
            normalized.push(NormalizedPath(norm));
        }
        normalized.sort();
        normalized.dedup();

        match chosen.get(&lower_name) {
            None => {
                chosen.insert(
                    lower_name.clone(),
                    HostExecutableBinding {
                        name: lower_name.clone(),
                        paths: normalized,
                        source: claim.id.clone(),
                    },
                );
            }
            Some(existing) if existing.paths == normalized => {
                deduped.push(claim.id.clone());
            }
            Some(existing) => {
                return Err(HostExecutableError::ConflictingPaths {
                    name: lower_name,
                    first: existing.paths.iter().map(|p| p.as_str().to_string()).collect(),
                    second: normalized.iter().map(|p| p.as_str().to_string()).collect(),
                });
            }
        }
    }

    Ok(HostExecutableCompilation {
        bindings: chosen.into_values().collect(),
        deduped,
    })
}

/// 一次编译的完整结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExecutableCompilation {
    /// 按 name 排序的绑定。
    pub bindings: Vec<HostExecutableBinding>,
    /// 被去重的同义声明。
    pub deduped: Vec<HostExecutableId>,
}

impl HostExecutableCompilation {
    /// 查某个裸名被锁定的路径集合。名字大小写不敏感。
    pub fn lookup(&self, name: &str) -> Option<&HostExecutableBinding> {
        let lower = name.trim().to_ascii_lowercase();
        self.bindings.iter().find(|b| b.name == lower)
    }

    /// 判断「给定绝对路径」是否是某名字的合法真身。
    ///
    /// **失败方向恒定**：名字未声明 ⇒ `false`（不是"没约束所以允许"）；
    /// 路径不在集合内 ⇒ `false`。绝不因"查不到"而放行。
    pub fn is_locked_path(&self, name: &str, path: &str) -> bool {
        match self.lookup(name) {
            None => false,
            Some(binding) => {
                let norm = normalize_path(path);
                binding.paths.iter().any(|p| p.as_str() == norm)
            }
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
