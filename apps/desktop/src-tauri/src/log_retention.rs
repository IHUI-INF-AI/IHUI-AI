// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面日志保留期(G-379/G-407/G-774 格②,2026-10-07 立)。
//!
//! [现状与立据 —— 全部为本机现读,非票面转抄]
//! 写日志的是 tauri-plugin-log 2.9.0(Cargo.lock 锁定 2.9.0),本机 registry 源码
//! (tauri-plugin-log-2.9.0/src/lib.rs)实证:
//!   * 默认策略 = `DEFAULT_MAX_FILE_SIZE 40_000` 字节 + `DEFAULT_ROTATION_STRATEGY
//!     KeepOne`(:46-47);本项目 lib.rs 此前未配置任何策略 → 走的正是这份默认。
//!   * KeepOne 轮转 = `fs::remove_file(主日志)`(:237-239):超限**直接删主文件**,
//!     历史 = 0,「保留期」概念不存在 —— 这正是本票要堵的洞。
//!   * 单文件形态:lib.rs 给 LogDir 指定 `file_name: Some("ihui-desktop")`,插件拼
//!     `dir.join(file_name).with_extension("log")`(:184)→
//!     `%LOCALAPPDATA%\com.ihui.desktop\logs\ihui-desktop.log`(identifier 见
//!     tauri.conf.json;票面写的「智汇AI.log」是历史读数,现读不是它)。
//!   * RotatingFile 的句柄在**插件自己的 setup** 里打开(:838-856 → :778-786),
//!     先于应用级 setup ⇒ 本模块启动裁剪时活跃文件句柄在插件手里:Windows 下句柄
//!     跟着文件走,若本模块 rename 活跃文件,插件后续日志会写进档案、其下一轮
//!     rotate 还会 remove_file 新建的主文件 —— 所以**活跃文件本模块绝不碰**,
//!     轮转(rename 出档案)交给插件自己做。
//!   * 运行期每次 flush 前按 `current_size + buffer > max_size` 判定轮转(:318-321),
//!     KeepSome 下轮转 = 按份数裁最旧档案(:248-278)+ `fs::rename` 把整卷改名成
//!     `ihui-desktop_<YYYY-MM-DD_HH-MM-SS>.log`(:280-299)。**rename 保留 mtime**,
//!     天然避开上游 desktopCrashCapture.ts:99-101 记录的 `copyFileSync` 把 mtime
//!     改成复制时刻、按 mtime 清理会误删较新件的陷阱 —— 本链路全程零 copy,
//!     不需要 filetime 之类的还原依赖。
//!   * 轮转撞名兜底会把既有档案改存成 `.log.bak`(:289-298),插件自己从不清理
//!     (remove_old_files 的 `.log` 后缀解析不认 .bak)→ 本模块一并认领。
//!
//! [策略 —— 常量即政策,唯一出处在本文件]
//!   * KEEP_ARCHIVES = 6:插件 KeepSome 保留的历史档案份数(lib.rs 的
//!     rotation_strategy 引用本常量,政策不落两处)。单档 ≤40KB(插件默认上限,
//!     维持不动),6 档 ≈ ≤240KB,足够回溯薄壳数个会话的事件型日志。
//!   * MAX_ARCHIVE_AGE_DAYS = 14 天:保留期取值对齐上游 logRetention.ts 的
//!     「启动裁 14 天」;形态不照抄 —— 上游按文件名日期切分,我方按 mtime 年龄裁
//!     (单文件形态,按 mtime+size,不按天切分)。
//!   * MAX_TOTAL_ARCHIVE_BYTES = 2 MB:与插件配置解耦的总量硬底(≈50×40KB),
//!     防将来插件侧配置漂移时历史档无限堆积。
//!
//! [分工]
//!   * 插件:按 size 触发轮转(rename 出档案)+ 按份数裁最旧。
//!   * 本模块(lib.rs setup 期调用一次):按 mtime 年龄 / 份数 / 总量裁**历史档案**;
//!     删除面用 is_archive_file 严格限定档案形态,动手前逐个复读校验,活跃主文件
//!     `ihui-desktop.log` 结构性排除。判定核心 prune_plan / is_archive_file 是纯
//!     函数,单测不落盘。

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use tauri::Manager;

/// 保留的历史日志档案份数(供 lib.rs 的 tauri_plugin_log RotationStrategy::KeepSome
/// 引用,政策唯一出处)。
pub(crate) const KEEP_ARCHIVES: usize = 6;

/// 历史档案最长保留天数(依据见模块头注)。
pub(crate) const MAX_ARCHIVE_AGE_DAYS: u64 = 14;

/// 由天数推出的保留期。档案 mtime 距今超过该值即删(mtime = 该卷最后一次写入
/// 时刻;rename 保留 mtime,故它是真实年龄,不是改名时刻)。
pub(crate) const MAX_ARCHIVE_AGE: Duration =
    Duration::from_secs(MAX_ARCHIVE_AGE_DAYS * 24 * 60 * 60);

/// 历史档案总量硬底(字节):超限从最旧开始裁,与份数/年龄两道闸独立。
pub(crate) const MAX_TOTAL_ARCHIVE_BYTES: u64 = 2 * 1024 * 1024;

/// 日志主文件名(= lib.rs LogDir file_name + 插件 with_extension("log"))。
/// 保留期处理绝不删它 —— 它是插件的活跃句柄目标(见模块头注)。
const ACTIVE_LOG_STEM: &str = "ihui-desktop";

/// 一份历史档案的判定要素(纯数据,便于单测)。
#[derive(Debug)]
struct ArchiveEntry {
    path: PathBuf,
    /// 文件 mtime。rename 保留 mtime ⇒ 即该卷日志最后一次写入时刻。
    modified: SystemTime,
    len: u64,
}

/// 档案形态严格判定:只认插件轮转产物 `ihui-desktop_<时间戳>.log` 及其撞名兜底
/// `ihui-desktop_<时间戳>.log.bak`。其余一律不碰(含活跃主文件、crash-*.log、
/// 任何非本插件产物)。
// G-379/G-407/G-774,2026-10-07
fn is_archive_file(file_name: &str) -> bool {
    let Some(rest) = file_name.strip_prefix(ACTIVE_LOG_STEM) else {
        return false;
    };
    if let Some(stamp) = rest.strip_suffix(".log") {
        // 活跃主文件 "ihui-desktop.log" 在此得到 stamp = "",被 is_timestampish
        // 的非空判定结构性排除 —— 不依赖额外名单,主文件永远进不了删除面。
        return is_timestampish(stamp);
    }
    if let Some(stamp) = rest.strip_suffix(".log.bak") {
        return is_timestampish(stamp);
    }
    false
}

/// 插件档案名的时间戳段(如 `2026-10-07_09-30-00`):数字 / `-` / `_` 组成、非空、
/// 且至少含一个数字(裸 `_` 不算时间戳)。刻意只放行这一族:保留期器是删除器,
/// 判据宁窄勿宽。
fn is_timestampish(s: &str) -> bool {
    s.bytes().any(|b| b.is_ascii_digit())
        && s.bytes()
            .all(|b| b.is_ascii_digit() || b == b'-' || b == b'_')
}

// G-379/G-407/G-774,2026-10-07
/// 裁剪判定核心(纯函数):给定档案全集与当前时刻,返回**应当删除**的档案路径,
/// 按从旧到新排序。三道闸依序:年龄 → 份数 → 总量。
/// 未来 mtime(时钟回拨)按 age=0 处理 ⇒ 不因年龄被删,只受份数/总量约束。
fn prune_plan(mut archives: Vec<ArchiveEntry>, now: SystemTime) -> Vec<PathBuf> {
    // 从旧到新:后面每道闸都从最旧端下刀。
    archives.sort_by_key(|e| e.modified);

    let mut doomed: Vec<ArchiveEntry> = Vec::new();
    let mut survivors: Vec<ArchiveEntry> = Vec::new();
    for entry in archives {
        let age = now.duration_since(entry.modified).unwrap_or_default();
        if age > MAX_ARCHIVE_AGE {
            doomed.push(entry);
        } else {
            survivors.push(entry);
        }
    }

    // 份数闸:只留最新 KEEP_ARCHIVES 份(survivors 旧→新,砍头部即砍最旧)。
    if survivors.len() > KEEP_ARCHIVES {
        let overflow = survivors.len() - KEEP_ARCHIVES;
        doomed.extend(survivors.drain(..overflow));
    }

    // 总量闸:仍超硬底则继续从最旧端裁,直到回落线内(或裁空)。
    let mut total: u64 = survivors.iter().map(|e| e.len).sum();
    while total > MAX_TOTAL_ARCHIVE_BYTES {
        let Some(oldest_len) = survivors.first().map(|e| e.len) else {
            break;
        };
        total -= oldest_len;
        doomed.push(survivors.remove(0));
    }

    doomed.into_iter().map(|e| e.path).collect()
}

// G-379/G-407/G-774,2026-10-07
/// 启动保留期处理(lib.rs setup 调用一次)。任何一步失败都只告警让路:
/// 保留期是卫生措施,不得因它卡启动。
pub(crate) fn enforce_on_startup(app: &tauri::App) {
    // 与插件同源:插件就是用 app.path().app_log_dir() 定位(:773),不另立第二份路径判据。
    let dir = match app.path().app_log_dir() {
        Ok(dir) => dir,
        Err(e) => {
            log::warn!("[log-retention] 无法解析日志目录,跳过保留期处理: {e}");
            return;
        }
    };

    let now = SystemTime::now();
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(e) => {
            // 目录尚不存在(首次安装)属正常形态;info 留痕即可。
            log::info!(
                "[log-retention] 日志目录不可读({e}),无需保留期处理: {}",
                dir.display()
            );
            return;
        }
    };

    let mut archives: Vec<ArchiveEntry> = Vec::new();
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        if !is_archive_file(&name) {
            continue;
        }
        // mtime/大小读不出来 = 无法判定 = 不删。保留期器不做无法判定的删除。
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if !meta.is_file() {
            continue;
        }
        let Ok(modified) = meta.modified() else {
            continue;
        };
        archives.push(ArchiveEntry {
            path: entry.path(),
            modified,
            len: meta.len(),
        });
    }
    let scanned = archives.len();

    let removed = prune_plan(archives, now)
        .into_iter()
        .filter(|path| {
            // 双保险:计划里只可能装着档案,动手前仍复读形态 —— 删除器的最后一道闸。
            match path.file_name().and_then(|n| n.to_str()) {
                Some(name) if is_archive_file(name) => true,
                _ => {
                    log::warn!(
                        "[log-retention] 计划内路径形态异常,拒绝删除: {}",
                        path.display()
                    );
                    false
                }
            }
        })
        .filter_map(|path| match fs::remove_file(&path) {
            Ok(()) => Some(path),
            Err(e) => {
                log::warn!("[log-retention] 删除日志档案失败 {}: {e}", path.display());
                None
            }
        })
        .count();

    if scanned > 0 {
        let total_mb = MAX_TOTAL_ARCHIVE_BYTES / (1024 * 1024);
        log::info!(
            "[log-retention] 保留期处理完成: 扫描历史档案 {scanned} 份, 删除 {removed} 份 \
             (上限 {KEEP_ARCHIVES} 份 / {MAX_ARCHIVE_AGE_DAYS} 天 / {total_mb} MB; 活跃主文件不参与)"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW_SECS: u64 = 1_000_000_000;

    fn now() -> SystemTime {
        SystemTime::UNIX_EPOCH + Duration::from_secs(NOW_SECS)
    }

    fn entry(name: &str, age_secs: u64, len: u64) -> ArchiveEntry {
        ArchiveEntry {
            path: PathBuf::from(name),
            modified: SystemTime::UNIX_EPOCH + Duration::from_secs(NOW_SECS - age_secs),
            len,
        }
    }

    const DAY: u64 = 24 * 60 * 60;
    const STAMP: &str = "2026-10-07_09-30-00";

    // ── 删除面形态判定:活跃主文件必须结构性排除 ──

    #[test]
    fn archive_shape_accepts_only_plugin_rotation_outputs() {
        assert!(is_archive_file(&format!("{ACTIVE_LOG_STEM}_{STAMP}.log")));
        assert!(is_archive_file(&format!("{ACTIVE_LOG_STEM}_{STAMP}.log.bak")));
    }

    #[test]
    fn active_log_and_foreign_files_are_never_archive_targets() {
        // 核心回归点:活跃主文件绝不进删除面(插件句柄目标,见模块头注)
        assert!(!is_archive_file("ihui-desktop.log"));
        // 无时间戳段的同前缀文件一律拒绝
        assert!(!is_archive_file("ihui-desktop.log.bak"));
        assert!(!is_archive_file("ihui-desktop_old.log"));
        assert!(!is_archive_file("ihui-desktop_.log"));
        assert!(!is_archive_file("ihui-desktop.log.old"));
        // 他族文件(crash handler 产物 / 用户文件)拒绝
        assert!(!is_archive_file("crash-20261007.log"));
        assert!(!is_archive_file("other_2026-10-07_09-30-00.log"));
        // 后缀不对拒绝
        assert!(!is_archive_file(&format!("{ACTIVE_LOG_STEM}_{STAMP}.txt")));
    }

    // ── 年龄闸:mtime 年龄为唯一删除依据(rename 保留 mtime,即真实年龄) ──

    #[test]
    fn archives_older_than_max_age_are_doomed() {
        let old = entry(&format!("{ACTIVE_LOG_STEM}_a.log"), MAX_ARCHIVE_AGE_DAYS * DAY + 1, 10);
        let fresh = entry(&format!("{ACTIVE_LOG_STEM}_b.log"), MAX_ARCHIVE_AGE_DAYS * DAY - 1, 10);
        assert_eq!(
            prune_plan(vec![old, fresh], now()),
            vec![PathBuf::from(format!("{ACTIVE_LOG_STEM}_a.log"))]
        );
    }

    #[test]
    fn age_boundary_is_strictly_greater() {
        // 恰好等于保留期不删(判定是 age > MAX):边界不漂
        let edge = entry(&format!("{ACTIVE_LOG_STEM}_edge.log"), MAX_ARCHIVE_AGE_DAYS * DAY, 10);
        assert!(prune_plan(vec![edge], now()).is_empty());
    }

    #[test]
    fn future_mtime_is_never_age_doomed() {
        // 时钟回拨 / 未来时间戳:age 按 0 处理,不因年龄被删
        let future = ArchiveEntry {
            path: PathBuf::from(format!("{ACTIVE_LOG_STEM}_future.log")),
            modified: now() + Duration::from_secs(3600),
            len: 10,
        };
        assert!(prune_plan(vec![future], now()).is_empty());
    }

    // ── 份数闸:只留最新 KEEP_ARCHIVES 份 ──

    #[test]
    fn count_bound_keeps_newest_and_drops_oldest() {
        let archives: Vec<ArchiveEntry> = (0..8u64)
            .map(|i| entry(&format!("{ACTIVE_LOG_STEM}_{i}.log"), (i + 1) * 60, 10))
            .collect();
        let doomed = prune_plan(archives, now());
        // age 越大越旧:8 份里砍掉最旧 2 份(_7 age=480s、_6 age=420s),留最新 6 份
        assert_eq!(
            doomed,
            vec![
                PathBuf::from(format!("{ACTIVE_LOG_STEM}_7.log")),
                PathBuf::from(format!("{ACTIVE_LOG_STEM}_6.log")),
            ]
        );
    }

    #[test]
    fn count_bound_exactly_at_limit_keeps_all() {
        let archives: Vec<ArchiveEntry> = (0..KEEP_ARCHIVES as u64)
            .map(|i| entry(&format!("{ACTIVE_LOG_STEM}_{i}.log"), (i + 1) * 60, 10))
            .collect();
        assert!(prune_plan(archives, now()).is_empty());
    }

    // ── 总量闸:从最旧端裁到硬底以内 ──

    #[test]
    fn total_size_bound_drops_oldest_until_under_cap() {
        let mb = 1024 * 1024;
        let archives = vec![
            entry(&format!("{ACTIVE_LOG_STEM}_a.log"), 60, mb),      // 1MB
            entry(&format!("{ACTIVE_LOG_STEM}_b.log"), 120, mb),     // 1MB
            entry(&format!("{ACTIVE_LOG_STEM}_c.log"), 180, mb),     // 1MB,合计 3MB > 2MB
        ];
        let doomed = prune_plan(archives, now());
        // age 越大越旧:合计 3MB 超硬底,从最旧端(_c,age=180s)裁 1MB 即回落到 2MB
        assert_eq!(doomed, vec![PathBuf::from(format!("{ACTIVE_LOG_STEM}_c.log"))]);
    }

    #[test]
    fn size_bound_never_loses_sight_of_empty_set() {
        // 单份就超硬底的极端:裁空为止,绝不死循环
        let huge = entry(&format!("{ACTIVE_LOG_STEM}_huge.log"), 60, 10 * 1024 * 1024);
        assert_eq!(
            prune_plan(vec![huge], now()),
            vec![PathBuf::from(format!("{ACTIVE_LOG_STEM}_huge.log"))]
        );
    }
}

//⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
