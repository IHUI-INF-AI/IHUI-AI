// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 独立浏览器窗口的收藏 / 历史(2026-10-24 立)。
//!
//! ## 为什么需要一份「桌面端自己的」收藏与历史
//!
//! 用户规则:「收藏 历史等两种形态都该有」。工作区停靠档的收藏/历史来自 web
//! 端 store(localStorage),但独立窗口是**裸 webview 里的第三方页面**,没有
//! 本站脚本、拿不到那份 store。要让独立窗口也有收藏与历史,只能由宿主进程存
//! 一份 —— 就是本模块。
//!
//! 两份数据各自独立、互不同步:停靠档面向"本站工作区",独立窗口面向"宿主原生
//! 窗口",用户看到的是同一个工具条位置上的同名功能,但归属不同存储域(和
//! 浏览器 cookie 分区同思路)。不合并是有意的 —— 合并要么让 web 端读 Rust 文件,
//! 要么让 Rust 读 localStorage,两边都得为对方开一个洞。
//!
//! 存储:`<app_data_dir>/browser-store.json`,一次全量写盘(条目上限见常量)。

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::{AppHandle, Manager};

/// 收藏上限(与 web 端 MAX_FAVORITES 同量级)。
const MAX_FAVORITES: usize = 100;
/// 历史上限(与 web 端 MAX_RECENT_URLS 同量级)。
const MAX_HISTORY: usize = 30;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEntry {
    pub url: String,
    pub title: String,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrowserStoreData {
    pub favorites: Vec<BrowserEntry>,
    pub history: Vec<BrowserEntry>,
}

static DATA: OnceLock<Mutex<BrowserStoreData>> = OnceLock::new();
static FILE: OnceLock<PathBuf> = OnceLock::new();

fn store_file(app: &AppHandle) -> &'static PathBuf {
    FILE.get_or_init(|| {
        let dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir());
        let _ = std::fs::create_dir_all(&dir);
        dir.join("browser-store.json")
    })
}

fn data(app: &AppHandle) -> &'static Mutex<BrowserStoreData> {
    DATA.get_or_init(|| {
        let loaded = std::fs::read_to_string(store_file(app))
            .ok()
            .and_then(|s| serde_json::from_str::<BrowserStoreData>(&s).ok())
            .unwrap_or_default();
        Mutex::new(loaded)
    })
}

/// 数据版本号:每次真改动 +1,`snapshot_arc` 据此判断缓存是否还新鲜。
static GEN: AtomicU64 = AtomicU64::new(0);

/// 快照缓存 `(generation, Arc<数据>)`。
///
/// 为什么值得缓存:工具条每次推状态都会取快照(切换标签、页面加载、收藏操作),
/// 原实现每次都持锁 clone 整份收藏+历史(上限 130 条)。改动是低频的,读是高频的,
/// 用版本号换"只在真变时 clone 一次"。
static CACHE: OnceLock<Mutex<Option<(u64, Arc<BrowserStoreData>)>>> = OnceLock::new();

/// 有"已排队但还没落盘"的改动。退出时据此决定要不要补一次同步写。
static PENDING: AtomicBool = AtomicBool::new(false);

/// 立即写盘:先写 `.tmp` 再 rename 覆盖(原子替换,强杀也不会留下半截 JSON)。
fn write_now(app: &AppHandle) {
    PENDING.store(false, Ordering::SeqCst);
    let snapshot = data(app)
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let Ok(text) = serde_json::to_string(&snapshot) else {
        return;
    };
    let path = store_file(app);
    let tmp = path.with_extension("json.tmp");
    if std::fs::write(&tmp, text).is_ok() {
        let _ = std::fs::rename(&tmp, path);
    }
}

/// 常驻写盘线程:把 500ms 内的连续请求合并成一次写。
///
/// 为什么必须去抖:浏览一次页面会连续触发 Started/Finished,重定向链更多;
/// 原实现每次访问都全量 JSON 序列化 + 写盘,在 tokio 工作线程上做同步文件 I/O,
/// 既费 SSD 又和渲染抢盘。收藏/清历史这类低频且用户可感知的操作仍走 [`write_now`]。
static SAVER: OnceLock<Sender<AppHandle>> = OnceLock::new();

fn save_soon(app: &AppHandle) {
    PENDING.store(true, Ordering::SeqCst);
    let tx = SAVER.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<AppHandle>();
        std::thread::spawn(move || {
            while let Ok(app) = rx.recv() {
                std::thread::sleep(Duration::from_millis(500));
                // 睡眠期间又排进来的请求一并合并(快照在 write_now 里现取,不会漏数据)
                while rx.try_recv().is_ok() {}
                write_now(&app);
            }
        });
        tx
    });
    let _ = tx.send(app.clone());
}

/// 退出前把排队中的改动立刻落盘(去抖线程可能还在睡)。
pub fn flush(app: &AppHandle) {
    if PENDING.swap(false, Ordering::SeqCst) {
        write_now(app);
    }
}

/// 当前快照(工具条渲染用;共享 Arc,不重复 clone)。
pub fn snapshot_arc(app: &AppHandle) -> Arc<BrowserStoreData> {
    let gen = GEN.load(Ordering::Acquire);
    let cache = CACHE.get_or_init(|| Mutex::new(None));
    if let Some((cached_gen, data)) = cache.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        if *cached_gen == gen {
            return data.clone();
        }
    }
    let fresh = Arc::new(data(app).lock().unwrap_or_else(|e| e.into_inner()).clone());
    *cache.lock().unwrap_or_else(|e| e.into_inner()) = Some((gen, fresh.clone()));
    fresh
}

/// 当前快照(IPC 出口用:需要按值序列化,只能 clone 一份)。
pub fn snapshot(app: &AppHandle) -> BrowserStoreData {
    (*snapshot_arc(app)).clone()
}

/// 数据真变了 ⇒ 版本号 +1(快照缓存下一次读会重建)。
fn bump() {
    GEN.fetch_add(1, Ordering::Release);
}

/// 当前 URL 是否已收藏(走快照缓存,避免再单独加锁)。
pub fn is_favorite(app: &AppHandle, url: &str) -> bool {
    snapshot_arc(app).favorites.iter().any(|f| f.url == url)
}

/// 加收藏(同 URL 覆盖标题;超上限丢最旧)。
pub fn add_favorite(app: &AppHandle, url: &str, title: &str) {
    if url.is_empty() {
        return;
    }
    let title = if title.is_empty() { url.to_string() } else { title.to_string() };
    let changed = {
        let mut d = data(app).lock().unwrap_or_else(|e| e.into_inner());
        // 已经在收藏里且标题一致 ⇒ 不重排、不写盘(幂等)
        match d.favorites.first() {
            Some(f) if f.url == url && f.title == title => false,
            _ => {
                d.favorites.retain(|f| f.url != url);
                d.favorites.insert(0, BrowserEntry { url: url.to_string(), title });
                d.favorites.truncate(MAX_FAVORITES);
                true
            }
        }
    };
    if changed {
        bump();
        write_now(app);
    }
}

/// 取消收藏。本来就不在收藏里 ⇒ 不写盘。
pub fn remove_favorite(app: &AppHandle, url: &str) {
    let existed = {
        let mut d = data(app).lock().unwrap_or_else(|e| e.into_inner());
        let before = d.favorites.len();
        d.favorites.retain(|f| f.url != url);
        d.favorites.len() != before
    };
    if existed {
        bump();
        write_now(app);
    }
}

/// 记录一次访问(同 URL 去重置顶;`about:blank` / 空地址不记)。
///
/// 同一页面反复加载(刷新、OAuth 回跳、SPA 重定向)只更新条目标题,不重排、
/// 不触发写盘 —— 否则"一刷新历史第一条跳到最前"既反直觉又白写磁盘。
pub fn record_visit(app: &AppHandle, url: &str, title: &str) {
    if url.is_empty() || url == "about:blank" || !url.starts_with("http") {
        return;
    }
    let title = if title.is_empty() { url.to_string() } else { title.to_string() };
    let changed = {
        let mut d = data(app).lock().unwrap_or_else(|e| e.into_inner());
        push_visit(&mut d.history, url, &title)
    };
    if changed {
        bump();
        save_soon(app);
    }
}

/// 历史入列(纯函数,便于单测):同 URL 已在最前只更新标题,否则去重置顶。
/// 返回是否真的改动了数据(调用方据此决定要不要写盘)。
fn push_visit(history: &mut Vec<BrowserEntry>, url: &str, title: &str) -> bool {
    if history.first().map(|h| h.url == url).unwrap_or(false) {
        let first = &mut history[0];
        if first.title == title {
            return false;
        }
        first.title = title.to_string();
        return true;
    }
    history.retain(|h| h.url != url);
    history.insert(
        0,
        BrowserEntry {
            url: url.to_string(),
            title: title.to_string(),
        },
    );
    history.truncate(MAX_HISTORY);
    true
}

/// 清空历史。本来就空 ⇒ 不写盘。
pub fn clear_history(app: &AppHandle) {
    let changed = {
        let mut d = data(app).lock().unwrap_or_else(|e| e.into_inner());
        let had = !d.history.is_empty();
        d.history.clear();
        had
    };
    if changed {
        bump();
        write_now(app);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_url_reload_does_not_reorder_or_write() {
        let mut h = vec![
            BrowserEntry { url: "https://b/".into(), title: "B".into() },
            BrowserEntry { url: "https://a/".into(), title: "A".into() },
        ];
        // 刷新 B:标题没变 ⇒ 不改动(不写盘)
        assert!(!push_visit(&mut h, "https://b/", "B"));
        assert_eq!(h[0].url, "https://b/");
        // 同页标题变了 ⇒ 只更新标题
        assert!(push_visit(&mut h, "https://b/", "B2"));
        assert_eq!(h[0].title, "B2");
        assert_eq!(h.len(), 2);
        // 回访旧条目 ⇒ 置顶且去重
        assert!(push_visit(&mut h, "https://a/", "A"));
        assert_eq!(h[0].url, "https://a/");
        assert_eq!(h.len(), 2);
    }

    #[test]
    fn entry_roundtrip() {
        let d = BrowserStoreData {
            favorites: vec![BrowserEntry { url: "https://a.b/".into(), title: "A".into() }],
            history: vec![],
        };
        let text = serde_json::to_string(&d).unwrap();
        let back: BrowserStoreData = serde_json::from_str(&text).unwrap();
        assert_eq!(back.favorites.len(), 1);
        assert_eq!(back.favorites[0].url, "https://a.b/");
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
