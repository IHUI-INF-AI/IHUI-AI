// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 工作区增量索引 —— **执行层**（只用 std，不碰 tauri；测试随 crate `cargo test` 真跑）。
//!
//! 票72② 的索引腿。职责：给授权工作区出一份**文件清单快照**（rel 路径 + size + mtime_ms），
//! 并把它与上一次快照折叠成增量（added/removed/changed/unchanged）。
//!
//! 增量口径（诚实边界，票面"增量索引"四字的落地解释）：
//! - "没变" = rel 相同 **且** (size, mtime_ms) 都相同。这是 lstat 级近似，
//!   **不是**内容哈希 —— 同秒同大小的内容改写会被读成没变。这个近似必须
//!   名字里带 suspect 语义暴露给前端（`deltaBasis: "size+mtime"`），不得暗示内容级。
//! - 目录判定走纯函数 [`dir_verdict`]：符号链接目录（含 Windows junction —— std 的
//!   `file_type().is_symlink()` 对 reparse point 一律为真）**不下降**、计数上报；
//!   `.git` 跳过；深度封顶。这就是票72④「符号链接/junction 逃逸」在索引侧的收口：
//!   索引路径由 read_dir 逐级拼接构造，`..` 从结构上不可能出现，唯一逃逸口就是
//!   符号链接目录 —— 不下降即不逃逸。
//! - 非 UTF-8 文件名：跳过并计数上报（非 UTF-8 路径判"判不了"而非 lossy 的同一条纪律，
//!   但索引是清单场景 —— 逐个"整单判不了"会把一个坏名字放大成整仓不可用，
//!   所以选择是**点名计数 + 不假装它在场**）。
//! - 条目超预算 ⇒ 整单 `Undetermined(Budget)`（截断清单会被读成完整，同 status 纪律）。

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::git_local_status::Blindness;

/// 单次索引的条目预算。超了判"判不了"，不截断放行。
pub const MAX_INDEX_ENTRIES: usize = 50_000;
/// 目录下降深度上限（从 root 起算，root 本身是 0）。
pub const MAX_INDEX_DEPTH: usize = 32;

/// 一条索引记录。`rel` 恒用 `/` 分隔、不含 `..`、非绝对（构造方式保证）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndexEntry {
    pub rel: String,
    pub size: u64,
    pub mtime_ms: u128,
}

/// 索引三态。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WalkOutcome {
    Facts {
        entries: Vec<IndexEntry>,
        /// 符号链接/junction 目录：不下降、逐个计数（票72④ 的索引侧计数面）。
        symlink_dirs_skipped: u32,
        /// 非 UTF-8 文件名：跳过并计数，不假装在场。
        non_utf8_skipped: u32,
    },
    Undetermined {
        kind: Blindness,
        reason: String,
    },
}

/// 目录下降判定（纯函数，junction/symlink/`.git`/深度四口的单点）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DirVerdict {
    Descend,
    SkipSymlink,
    SkipGitDir,
    SkipDepth,
}

pub fn dir_verdict(is_symlink: bool, name: &str, depth: usize) -> DirVerdict {
    // 顺序即优先级：链接优先于名字 —— 一个名叫 .git 的符号链接也得按链接处理
    //（先判链接才能保证"不下降"这一句对它同样成立）。
    if is_symlink {
        return DirVerdict::SkipSymlink;
    }
    if name == ".git" {
        return DirVerdict::SkipGitDir;
    }
    // depth 是该目录自身的深度：depth >= MAX 时它的孩子将超出预算 ⇒ 不再下降。
    if depth >= MAX_INDEX_DEPTH {
        return DirVerdict::SkipDepth;
    }
    DirVerdict::Descend
}

/// mtime → 毫秒（早于纪元的钟表偏移一律记 0，不参与"变了"判定）。
pub fn mtime_ms(md: &std::fs::Metadata) -> u128 {
    md.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 真走文件系统的一次全量快照（增量由调用方拿上一次快照 + [`compute_delta`] 完成 ——
/// previous 由前端持有，宿主不存会话态，重启即失效的索引没有资格叫"增量索引"）。
pub fn walk_index(root: &Path) -> WalkOutcome {
    let mut entries: Vec<IndexEntry> = Vec::new();
    let mut symlink_dirs_skipped: u32 = 0;
    let mut non_utf8_skipped: u32 = 0;
    // 显式栈代替递归：深度上限是判据不是递归保险丝。
    let mut stack: Vec<(PathBuf, String, usize)> = vec![(root.to_path_buf(), String::new(), 0)];
    while let Some((dir, rel_prefix, depth)) = stack.pop() {
        let rd = match std::fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(err) => {
                // root 本身读不了 ⇒ 整单判不了；子目录读不了（权限）同样不出
                // "部分清单" —— 部分清单会被读成完整。
                return WalkOutcome::Undetermined {
                    kind: Blindness::Io,
                    reason: format!(
                        "read_dir 失败（{}）：{err} —— 清单会缺这一枝，拒绝出具部分合格证",
                        if rel_prefix.is_empty() { "root" } else { rel_prefix.as_str() }
                    ),
                };
            }
        };
        for item in rd {
            let item = match item {
                Ok(i) => i,
                Err(err) => {
                    return WalkOutcome::Undetermined {
                        kind: Blindness::Io,
                        reason: format!("枚举 {} 失败：{err}", rel_prefix),
                    }
                }
            };
            let raw_name = item.file_name();
            let name = match raw_name.to_str() {
                Some(n) => n.to_string(),
                None => {
                    non_utf8_skipped += 1;
                    continue;
                }
            };
            // DirEntry::file_type 是 lstat 语义（不穿越链接）。
            let ft = match item.file_type() {
                Ok(ft) => ft,
                Err(err) => {
                    return WalkOutcome::Undetermined {
                        kind: Blindness::Io,
                        reason: format!("file_type {} 失败：{err}", rel_prefix),
                    }
                }
            };
            let child_rel = if rel_prefix.is_empty() {
                name.clone()
            } else {
                format!("{rel_prefix}/{name}")
            };
            if ft.is_dir() {
                match dir_verdict(ft.is_symlink(), &name, depth) {
                    DirVerdict::Descend => stack.push((item.path(), child_rel, depth + 1)),
                    DirVerdict::SkipSymlink => symlink_dirs_skipped += 1,
                    DirVerdict::SkipGitDir | DirVerdict::SkipDepth => {}
                }
                continue;
            }
            // 文件（含符号链接文件 —— 记链接自身的 lstat，不追目标）。
            let md = match item.metadata() {
                Ok(md) => md,
                Err(err) => {
                    return WalkOutcome::Undetermined {
                        kind: Blindness::Io,
                        reason: format!("metadata {child_rel} 失败：{err}"),
                    }
                }
            };
            entries.push(IndexEntry {
                rel: child_rel,
                size: md.len(),
                mtime_ms: mtime_ms(&md),
            });
            if entries.len() > MAX_INDEX_ENTRIES {
                return WalkOutcome::Undetermined {
                    kind: Blindness::Budget,
                    reason: format!(
                        "文件数超过单次索引预算 {MAX_INDEX_ENTRIES}，截断清单会被读成完整 ⇒ 判不了；下一步：把授权 root 收窄到子目录"
                    ),
                };
            }
        }
    }
    // 稳定序：delta 与回放都依赖同一份排序，不依赖文件系统返回序。
    entries.sort_by(|a, b| a.rel.cmp(&b.rel));
    WalkOutcome::Facts {
        entries,
        symlink_dirs_skipped,
        non_utf8_skipped,
    }
}

/// 快照间增量。`changed` = rel 相同但 (size, mtime_ms) 任一不同。
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct IndexDelta {
    pub added: Vec<String>,
    pub removed: Vec<String>,
    pub changed: Vec<String>,
    pub unchanged: usize,
}

/// 纯函数：上一次快照（rel → (size, mtime_ms)）× 本次清单 ⇒ 增量。
pub fn compute_delta(previous: &BTreeMap<String, (u64, u128)>, current: &[IndexEntry]) -> IndexDelta {
    let mut delta = IndexDelta::default();
    let mut current_rels: std::collections::HashSet<&str> = std::collections::HashSet::new();
    for e in current {
        current_rels.insert(e.rel.as_str());
        match previous.get(&e.rel) {
            None => delta.added.push(e.rel.clone()),
            Some(&(sz, mt)) => {
                if sz != e.size || mt != e.mtime_ms {
                    delta.changed.push(e.rel.clone());
                } else {
                    delta.unchanged += 1;
                }
            }
        }
    }
    for rel in previous.keys() {
        if !current_rels.contains(rel.as_str()) {
            delta.removed.push(rel.clone());
        }
    }
    delta
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- 目录判定（纯，跨平台可测 —— junction 在 CI 造不出来） ----------

    #[test]
    fn symlink_dir_never_descends_even_if_named_git() {
        // 顺序即优先级：一个名叫 .git 的 junction 也必须按链接处理。
        assert_eq!(dir_verdict(true, ".git", 0), DirVerdict::SkipSymlink);
        assert_eq!(dir_verdict(true, "vendor", 0), DirVerdict::SkipSymlink);
    }

    #[test]
    fn git_dir_skipped_only_as_directory_name() {
        assert_eq!(dir_verdict(false, ".git", 0), DirVerdict::SkipGitDir);
        assert_eq!(dir_verdict(false, ".github", 0), DirVerdict::Descend, "前缀不算");
        assert_eq!(dir_verdict(false, "my.git", 0), DirVerdict::Descend, "后缀不算");
    }

    #[test]
    fn depth_cap_is_at_max_depth() {
        assert_eq!(dir_verdict(false, "a", MAX_INDEX_DEPTH - 1), DirVerdict::Descend);
        assert_eq!(dir_verdict(false, "a", MAX_INDEX_DEPTH), DirVerdict::SkipDepth);
    }

    // ---------- 增量折叠（纯） ----------

    fn entry(rel: &str, size: u64, mtime_ms: u128) -> IndexEntry {
        IndexEntry { rel: rel.into(), size, mtime_ms }
    }

    #[test]
    fn delta_four_way_partition() {
        let mut prev = BTreeMap::new();
        prev.insert("keep.rs".to_string(), (10u64, 100u128));
        prev.insert("edited.rs".to_string(), (10u64, 100u128));
        prev.insert("gone.rs".to_string(), (10u64, 100u128));
        let cur = vec![
            entry("edited.rs", 12, 100),  // size 变 ⇒ changed
            entry("keep.rs", 10, 100),    // 全同 ⇒ unchanged
            entry("new.rs", 1, 1),        // 新 ⇒ added
        ];
        let d = compute_delta(&prev, &cur);
        assert_eq!(d.added, vec!["new.rs".to_string()]);
        assert_eq!(d.removed, vec!["gone.rs".to_string()]);
        assert_eq!(d.changed, vec!["edited.rs".to_string()]);
        assert_eq!(d.unchanged, 1);
    }

    #[test]
    fn mtime_only_change_is_changed() {
        let mut prev = BTreeMap::new();
        prev.insert("a.rs".to_string(), (10u64, 100u128));
        let d = compute_delta(&prev, &[entry("a.rs", 10, 101)]);
        assert!(d.changed.len() == 1 && d.unchanged == 0);
    }

    #[test]
    fn empty_previous_means_everything_added() {
        let d = compute_delta(&BTreeMap::new(), &[entry("a", 1, 1), entry("b", 2, 2)]);
        assert_eq!(d.added.len(), 2);
        assert_eq!(d.unchanged, 0);
    }

    // ---------- 真走文件系统（临时目录，真跑不 mock） ----------

    struct TempTree {
        root: PathBuf,
    }

    impl TempTree {
        fn new(tag: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "ihui-idx-test-{tag}-{}",
                std::process::id()
            ));
            let _ = std::fs::remove_dir_all(&root);
            std::fs::create_dir_all(&root).unwrap();
            TempTree { root }
        }
        fn write(&self, rel: &str, body: &[u8]) {
            let p = self.root.join(rel);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(p, body).unwrap();
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn walk_lists_files_skips_git_and_counts() {
        let t = TempTree::new("basic");
        t.write("src/lib.rs", b"fn main() {}");
        t.write("src/deep/a/b/c.txt", b"x");
        t.write(".git/HEAD", b"ref: main");
        t.write("README.md", b"hi");
        match walk_index(&t.root) {
            WalkOutcome::Facts { entries, symlink_dirs_skipped, non_utf8_skipped } => {
                let rels: Vec<&str> = entries.iter().map(|e| e.rel.as_str()).collect();
                assert!(rels.contains(&"src/lib.rs"));
                assert!(rels.contains(&"src/deep/a/b/c.txt"));
                assert!(rels.contains(&"README.md"));
                assert!(!rels.iter().any(|r| r.contains(".git")), "整枝 .git 必须缺席：{rels:?}");
                assert_eq!(symlink_dirs_skipped, 0);
                assert_eq!(non_utf8_skipped, 0);
                // 稳定序
                let mut sorted = rels.clone();
                sorted.sort();
                assert_eq!(rels, sorted);
            }
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn walk_counts_size_and_mtime() {
        let t = TempTree::new("stat");
        t.write("f.bin", &[0u8; 77]);
        match walk_index(&t.root) {
            WalkOutcome::Facts { entries, .. } => {
                assert_eq!(entries.len(), 1);
                assert_eq!(entries[0].size, 77);
                assert!(entries[0].mtime_ms > 0, "真实文件的 mtime 必须可取");
            }
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn walk_two_rounds_delta_is_stable() {
        let t = TempTree::new("incr");
        t.write("a.txt", b"one");
        let first = match walk_index(&t.root) {
            WalkOutcome::Facts { entries, .. } => entries,
            other => panic!("实得 {other:?}"),
        };
        // 第二轮：改一个、加一个、删一个
        std::fs::write(t.root.join("a.txt"), b"one!").unwrap();
        t.write("b.txt", b"two");
        std::fs::remove_file(t.root.join("a.txt")).ok(); // 删掉再造一个同名不同内容的？不 —— 保持简单：
        t.write("a.txt", b"changed");
        let second = match walk_index(&t.root) {
            WalkOutcome::Facts { entries, .. } => entries,
            other => panic!("实得 {other:?}"),
        };
        let mut prev = BTreeMap::new();
        for e in &first {
            prev.insert(e.rel.clone(), (e.size, e.mtime_ms));
        }
        let d = compute_delta(&prev, &second);
        assert!(d.added.contains(&"b.txt".to_string()));
        assert!(d.changed.contains(&"a.txt".to_string()), "内容变了 size 必变：{d:?}");
        assert_eq!(d.removed.len(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_dir_is_counted_not_descended() {
        let t = TempTree::new("symlink");
        t.write("real/f.txt", b"x");
        std::os::unix::fs::symlink(t.root.join("real"), t.root.join("escape")).unwrap();
        match walk_index(&t.root) {
            WalkOutcome::Facts { entries, symlink_dirs_skipped, .. } => {
                assert_eq!(symlink_dirs_skipped, 1, "链接目录计数不下降");
                assert!(!entries.iter().any(|e| e.rel.starts_with("escape/")));
            }
            other => panic!("实得 {other:?}"),
        }
    }

    #[test]
    fn missing_root_is_undetermined_not_empty_facts() {
        let ghost = std::env::temp_dir().join(format!("ihui-idx-ghost-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&ghost);
        match walk_index(&ghost) {
            WalkOutcome::Undetermined { kind, .. } => assert_eq!(kind, Blindness::Io),
            other => panic!("把\"读不到\"折叠成\"空清单\"是纪律违规：{other:?}"),
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
