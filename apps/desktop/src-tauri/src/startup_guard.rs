// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端启动守护(2026-09-27,根治"双击打不开")。
//!
//! 根因链(2026-09-27 真机日志实锤,见智汇AI.log 07:12-08:34 段):
//! 1. `tauri-plugin-single-instance` 2.4.3 的 Windows 实现有两个致命缺陷:
//!    a) 第二实例用 **无超时** 的 `SendMessageW(WM_COPYDATA)` 唤醒第一实例——
//!       第一实例主线程一旦被占住(事件循环挂死,实证:「app.exit(0) 未在 120s
//!       内终止进程」),这条发送就永远阻塞:第二实例无窗口、无日志、静默堆积在
//!       任务管理器里。用户侧表现即"双击毫无反应"。
//!    b) mutex 已存在但找不到隐藏消息窗口(`{id}-siw`)时,第二实例**直接放行继续
//!       启动**——WebView2 用户数据目录被第一实例占住,实证「failed to create
//!       webview: 0x800700AA 请求的资源在使用中」;新实例又变成一个"占着目录和
//!       mutex、既看不见也退不掉"的僵尸,级联污染之后每一次启动。
//! 2. 本模块在 `tauri::Builder` 之前用与插件完全相同的命名(`{id}-sim` mutex /
//!    `{id}-sic` 窗口类 / `{id}-siw` 窗口标题)预检:
//!    - 无其他实例 → 放行,插件照常拿 mutex、建隐藏窗口;
//!    - 有其他实例且隐藏窗口 2s 内应答 → 放行,由插件唤醒它的窗口并结束本进程
//!      (健康路径的既有行为,一字不改);
//!    - 有其他实例但隐藏窗口缺失或不应答(挂死/僵尸)→ 终止所有**同 exe 路径**的
//!      其他进程,然后作为唯一实例继续启动——双击必须看见窗口。(2026-09-27 同日补两条
//!      前置条件,任一命中都不得杀,见第 5 条)
//! 3. 完整闭环还差最后一环(2026-09-27 实测):被强杀的旧实例留下的
//!    `msedgewebview2.exe`(browser 主进程)不会随父进程立即退出(实测父死
//!    1~3 分钟内仍在),继续占住 `EBWebView` 数据目录;而且它的 DACL 拒绝任何
//!    外部进程打开(连 `PROCESS_QUERY_LIMITED_INFORMATION` 都失败)——杀不掉,
//!    只能等。这期间 wry 在主线程**同步**等 webview 环境创建:窗口不显示、
//!    日志一行不写,与"双击没反应"完全同形(实测卡 102s)。因此预检在"将以
//!    唯一实例身份继续启动"的路径上,先等 `EBWebView\Lockfile` 独占打开成功
//!    (上限 120s,超时仍继续启动、退回旧阻塞行为),再让 Tauri 建窗口。
//! 4. 探针 mutex 句柄在返回前必须关闭:否则插件随后 `CreateMutexW` 会看到
//!    `ERROR_ALREADY_EXISTS`(自己占的)而找不到窗口 → 命中缺陷 b → 每个实例都
//!    不建隐藏窗口 → 全部级联僵尸。这是本模块存在的意义,不得回退。
//! 5. 同日两条收口(实测:17:00-17:45 之间被重启 18 次,日志 `failed to create
//!    webview: 0x800700AA 请求的资源在使用中` ×2 + `0x800705B4 超时` ×1 +
//!    `启动守护:终止了 1 个挂死/僵尸的旧实例` ×1;而 24h 内 Windows 事件日志**没有
//!    一条 ihui-desktop.exe 的 1000 应用错误事件** ⇒ 进程是被终止的,不是原生崩溃):
//!    a) **有可见顶层窗口的实例绝不能杀**。被并发构建 + 上百道守门压满的机器上,一个
//!       窗口正开着、用户正在用的健康实例,会因为主线程被占住而 2s 内不应答探测,
//!       于是被按成僵尸杀掉——用户侧表现就是"点哪个页面就崩"。真僵尸按定义是**没有
//!       窗口**的那个(第 1、2 条描述的"双击毫无反应、静默堆积在任务管理器")。
//!    b) **跨路径这一对既无人清理也互不移交**(安装版 `D:\智汇AI\ihui-desktop.exe` 与
//!       开发版 `target\{debug,release}\ihui-desktop.exe`:只要 identifier 相同就同 `{id}-sim`
//!       mutex、同 `EBWebView` 数据目录)。正确出口是**本进程移交退出**,不是把清理
//!       范围扩到跨路径——那等于让开发版去杀用户正在用的安装版,是 a) 的放大。
//!       2026-10-19 起开发版另配 identifier(G-921,机主拍板"dev 用独立标识"),与安装版
//!       不再是同一把锁;本条判据对"同 identifier 的跨路径对"照常成立。
//! 6. 2026-10-21 立(票 L7220 P2)**启动相位竞态**:本模块的 `preflight()` 跑在
//!    `tauri::Builder` **之前**,而 `{id}-sim` mutex 与 `{id}-siw` 隐藏窗都是**插件自己的
//!    setup** 才建的。于是第二实例在"对方正在建窗/正在等它那一次最长 120s 的
//!    EBWebView 锁(第 3 条)"这段时间里,看到的一定是 `mutex 在 ∧ siw 不在` —— 与第 1b 条
//!    描述的僵尸**逐字段同形**,旧判据因此把它判成僵尸杀掉(两实例互杀,谁也没机会启动)。
//!    本机日志实测同型:40 次启动里"等锁"3 次(一次打满 120000ms)。
//!    出口 = 新增一条**正交事实**:同名的对方进程还在不在。`mutex 在 ∧ siw 未现 ∧ 对方进程在`
//!    判为"启动相位"档(`WaitForOtherStartupPhase`),该档**只等不杀**(轮询 `{id}-siw`),
//!    等待结束后重新采一遍事实、不带该旗再判一次 ⇒ 原语义(含该杀的僵尸)一格未削。
//! 7. 2026-10-21 立(票 L7220 P1)**可观测性**:上面每一条判据用的事实都只活在预检的
//!    栈里,而"链已坏 ⇒ 本进程自行 `exit(0)`"那一条连日志插件的 setup 都活不到 ⇒ 事后
//!    没有任何一行证据说明"这次启动到底看到了什么"。现把每轮读数存进 `LAST_READING`
//!    (供应用级 setup 经 `take_last_reading()` 逐条报名),并且**只在活不到 setup 的那条
//!    出口上**自己追加一行到插件那本日志里(落点 = `%LOCALAPPDATA%\{id}\logs\` +
//!    `log_retention::ACTIVE_LOG_STEM`,与插件 LogDir 同一根,不新造落点根)。
//!    ⚠️ 健康路径(插件唤醒对方)刻意**不**落盘:每一次"应用已在运行时再双击一次"都走
//!    那条出口,落盘等于用正常操作把 40KB 的日志刷满。
//! 8. 2026-10-22 立(票 L7170,复现前置的**静态取证**):票面"尚未取证'主实例处于隐藏态时
//!    siw 窗口是否仍在'"由读插件源码收口 —— `tauri-plugin-single-instance-2.4.3`
//!    `src/platform_impl/windows.rs` 里 `{id}-siw` 只在插件 setup 的首实例分支创建一次
//!    (L105 `create_event_target_window`),唯一销毁点是 `RunEvent::Exit → destroy() →
//!    DestroyWindow`(L111-115/L126-128);全文件对主窗口可见性零引用,siw 的 HWND 也不
//!    暴露给应用侧 ⇒ **主窗口 hide/show 不触及 siw,"隐藏态"不构成第二实例的放行路径**。
//!    放行路径只剩三型:对方启动相位(第 6 条,只等不杀)/级联僵尸(第 4 条,已修)/
//!    对方事件循环挂死(siw 在而 2s 不应答,第 1a 条 ⇒ `KillStaleThenContinue`)。
//!    这三型连同"隐藏态 ∧ siw 在 ∧ 应答 ⇒ 移交不杀"一起由 `decide` 的成对用例钉住
//!    (见测试「健康实例存在时移交插件唤醒」)。活体读数格:自下一次真实启动起由第 7 条
//!    的落账行(`启动守护预检落账 … siw_found=…`)自动产出,无需专设复现窗。

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

/// 启动守护的三态判定(纯函数,可单测)。
#[derive(Debug, PartialEq, Eq)]
pub enum PreflightAction {
    /// 无其他实例:放行,插件照常接管。
    ContinueLaunch,
    /// 有其他实例:**本进程退出**,把界面留给对方。执行者视探测链是否完好二选一——
    /// 插件唤醒对方并结束本进程(健康路径),或本模块自行 `exit(0)`(链已坏:
    /// 隐藏窗口缺失时插件会放行继续启动、不应答时插件的无超时 `SendMessageW`
    /// 会把本进程永久挂住,两条都是模块头注第 1a/1b 条)。
    HandoffToExisting,
    /// 有其他实例但挂死/僵尸且**用户看不见它**:先清理其他实例,再继续启动。
    KillStaleThenContinue,
    /// 2026-10-21 立(票 L7220 P2,模块头注第 6 条):`{id}-sim` 在、`{id}-siw` 未现、
    /// 而同名对方进程**还活着** ⇒ 对方处在它自己的启动序列里(插件 setup 未跑,或正在
    /// 等它那一轮 EBWebView 锁),按第 1b 条的定义**不是**僵尸。
    ///
    /// 本态的语义只有两个字:**只等不杀**。调用方轮询 `{id}-siw` 至多
    /// `STARTUP_PHASE_WAIT_MAX_MS`,然后**重新采一遍事实**并**不带本旗**再判一次
    /// (见 `preflight()`);因此它既不可能变成第二次等待,也不可能把该杀的僵尸放过。
    WaitForOtherStartupPhase,
}

/// 枚举"其他实例"得到的三态。**与"有没有可见窗口"是两条正交的事实,不得合成一条**:
/// 前者回答"有没有可清理对象"(决定能不能杀干净),后者回答"对方是不是用户看得见的
/// 程序"(决定该不该杀)。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OtherInstances {
    /// 一个同名其他进程都没枚举到,而 mutex 却存在 —— 对方正在退出的瞬时状态,或
    /// mutex 异常残留。这一态**绝不许**让本进程静默退出:那正是本模块要消灭的
    /// "双击毫无反应"。
    NoneSeen,
    /// 有其他实例,但没有一个与本进程同全路径(典型:安装版与开发版并存),也即
    /// **筛不出可清理对象**。见模块头注第 5b 条。
    PresentButNothingCleanable,
    /// 有其他实例,且至少一个与本进程同全路径 ⇒ 存在可清理对象。
    PresentWithCleanableTarget,
}

/// 三态判定:`{id}-sim` mutex 是否存在、`{id}-siw` 窗口是否找到、是否 2s 内应答、
/// 枚举到的其他实例形态、其他实例是否拥有可见顶层窗口、对方是否处在启动相位。
///
/// mutex 不存在时其余参数无意义(无其他实例)。
///
/// `other_in_startup_phase`(2026-10-21,票 L7220 P2)由调用方按**独立事实**算出:
/// `siw 未现 ∧ 枚举得到同名对方进程`。判据不许从这里反推(见模块头注第 6 条:
/// "siw 不在"这一条同时属于僵尸和属于"正在启动",按它杀人就是把竞态转嫁给用户)。
///
/// 判序是这套逻辑的全部安全性所在,改动前先读模块头注第 5 条与第 6 条:
/// 1. **看得见 = 不可杀**(第 5a 条)——必须排在探测结果之前:健康但主线程被占住的
///    实例同样会在 2s 内不应答,按探测判僵尸就是误杀用户正在用的窗口。
/// 2. 探测链完好(隐藏窗口在位且应答)→ 交给插件移交(既有健康路径)。
/// 3. **启动相位只等不杀**(第 6 条)——排在原语义 match 之前,所以该态**永不可能**
///    返回 `KillStaleThenContinue`;排在 1、2 两条之后,所以它也不会把"看得见/应答
///    正常"的对象改写成等待(那两条本就不杀)。
/// 4. 只剩"没有窗口的其他实例":同全路径才有对象可清理;跨路径只能移交(第 5b 条);
///    一个实例都没看到就照旧继续(绝不静默退出)。
pub fn decide(
    mutex_exists: bool,
    siw_window_found: bool,
    siw_responsive: bool,
    other: OtherInstances,
    other_has_visible_window: bool,
    other_in_startup_phase: bool,
) -> PreflightAction {
    if !mutex_exists {
        return PreflightAction::ContinueLaunch;
    }
    // 两条事实矛盾时(看不见任何实例却说有可见窗口)以"有没有实例"为准:
    // 无人接管却退出 = 双击毫无反应,比误判更糟。
    if other != OtherInstances::NoneSeen && other_has_visible_window {
        return PreflightAction::HandoffToExisting;
    }
    if siw_window_found && siw_responsive {
        return PreflightAction::HandoffToExisting;
    }
    // NoneSeen 时本旗结构上不成立(算不出"对方进程在"),这里仍按事实再窄一次:
    // 判据不得依赖调用方的自律(与「两条事实矛盾时」那条同一个纪律)。
    if other_in_startup_phase && other != OtherInstances::NoneSeen {
        return PreflightAction::WaitForOtherStartupPhase;
    }
    match other {
        OtherInstances::PresentWithCleanableTarget => PreflightAction::KillStaleThenContinue,
        // 继续往下建 webview 必然撞 `EBWebView` 目录锁(0x800700AA),而撞完的结果是
        // 本进程变成一个"占着目录和 mutex、既看不见也退不掉"的新僵尸(第 1b 条)。
        OtherInstances::PresentButNothingCleanable => PreflightAction::HandoffToExisting,
        OtherInstances::NoneSeen => PreflightAction::ContinueLaunch,
    }
}

/// 大小写不敏感的 exe 全路径比较(Windows 文件系统大小写不敏感,进程枚举与
/// `current_exe` 的大小写/短路径写法可能不同)。
fn same_exe_path(a: &Path, b: &Path) -> bool {
    a.as_os_str()
        .to_string_lossy()
        .eq_ignore_ascii_case(&b.as_os_str().to_string_lossy())
}

/// 上一次 `preflight()` 清理掉的挂死/僵尸实例数(供 setup 阶段日志插件就绪后补记)。
static KILLED_STALE_COUNT: AtomicUsize = AtomicUsize::new(0);

/// 取走并清零清理计数(setup 里调用一次)。
pub fn take_killed_stale_count() -> usize {
    KILLED_STALE_COUNT.swap(0, Ordering::SeqCst)
}

/// 一轮预检在**本进程内**能看到的全部事实(票 L7220 P1,模块头注第 7 条)。
///
/// 存在的理由:这些事实此前只活在被当场 `exit(0)` 掐掉的那条出口的栈里 —— 事后连
/// "那次到底看到了什么"都没有,更别说归因。字段一律按**取证到的那一轮**记账:走
/// `WaitForOtherStartupPhase`(只等不杀)时,记的是等待结束后**重采**的那一轮,
/// 也就是真正驱动结论的那一组事实。
///
/// ⚠️ 六条字段全部如实可空:`mutex_exists` / `other` 取 `None` 表示**没判出来**
/// (探针 `CreateMutexW` 都没建起来 / 根本没进入采样),不得用 `false` 冒充"判过、
/// 结论是不存在"(AGENTS §0.3)。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PreflightReading {
    /// `{id}-sim` mutex 是否已存在。`None` = 探针失败 ⇒ **整轮未判定**。
    pub mutex_exists: Option<bool>,
    /// `{id}-siw` 隐藏消息窗口是否找到(仅 `mutex_exists == Some(true)` 时才会采样)。
    pub siw_found: bool,
    /// `{id}-siw` 是否在 2s 内应答空消息探测。
    pub responsive: bool,
    /// 枚举"其他实例"得到的三态。`None` = 未进入采样。
    pub other: Option<OtherInstances>,
    /// 其他实例是否拥有可见顶层窗口(第 5a 条那条与应答性**正交**的独立事实)。
    pub other_has_visible: bool,
    /// 为等待 `EBWebView\Lockfile` 释放而阻塞的毫秒数;0 = 未等待或无需等待。
    /// (旧版这是一枚独立的 `AtomicUsize` + 第二个 getter,与这里算同一件事 ⇒
    /// 一份事实两处载体必然漂移,2026-10-21 并到读数里,单一载体。)
    pub waited_lock_ms: u64,
}

/// 本轮预检的读数槽。`None` = **本轮预检没有落过账**(非 Windows 平台没有预检,
/// 或者 `preflight()` 压根没跑);`take_last_reading()` 据此回 `None`,调用方必须
/// 把它读成"未判定"而不是"一切正常"。
static LAST_READING: std::sync::Mutex<Option<PreflightReading>> = std::sync::Mutex::new(None);

/// 填账(每个出口都要填一次)。锁中毒/抢不到 ⇒ 放弃记账并**继续原动作**:
/// 可观测性层没有任何资格阻断启动,更不许改变判定(与 `wait_for_webview_lock_release`
/// "绝不因守护卡死启动"同一条方向纪律)。
///
/// 非 Windows 上这几个私有函数只有测试在用(落账链的调用点都在 `preflight` 的
/// windows 档里)⇒ 按平台豁免 dead_code,而不是把它们塞进 cfg 块里造成第二份实现。
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn record_last_reading(reading: &PreflightReading) {
    if let Ok(mut slot) = LAST_READING.lock() {
        *slot = Some(reading.clone());
    }
}

/// 取走本轮预检读数并清空(setup 里调用一次;取走是为了让"没落账"与"落过账"
/// 在日志里可区分,而不是留一份陈旧读数被下一轮读到)。
pub fn take_last_reading() -> Option<PreflightReading> {
    LAST_READING.lock().ok()?.take()
}

/// 把读数渲染成一行自述(**纯函数**,可单测;不走 `log` 宏,因为活不到 setup 的那条
/// 出口上日志插件还没初始化)。字段一律**显式命名**,不靠位置参数——事后读日志的人
/// 只有键名可对账。
pub fn describe_for_log(reading: &PreflightReading, outcome: &str) -> String {
    format!(
        "[desktop] 启动守护预检落账 outcome={} mutex_exists={:?} siw_found={} siw_responsive={} other_instances={:?} other_has_visible={} waited_lock_ms={}",
        outcome,
        reading.mutex_exists,
        reading.siw_found,
        reading.responsive,
        reading.other,
        reading.other_has_visible,
        reading.waited_lock_ms
    )
}

/// Epoch 毫秒 → `YYYY-MM-DDTHH:MM:SS.mmmZ`(**UTC**,毫秒)。
///
/// 刻意用 UTC 且不写本地偏移:`std::time` 在预检阶段拿不到可信的本地时区偏移,
/// 而猜一个偏移 = 往同一本日志里写一个会误导排序的时刻(§0.3)。换算本体是纯函数,
/// 由 `civil_from_days` 单测钉住。
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn utc_stamp_ms(epoch_ms: u64) -> String {
    let secs = epoch_ms / 1000;
    let millis = epoch_ms % 1000;
    let days = (secs / 86_400) as i64;
    let within = (secs % 86_400) as u32;
    let (y, m, d) = civil_from_days(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        y,
        m,
        d,
        within / 3600,
        (within % 3600) / 60,
        within % 60,
        millis
    )
}

/// 民用日历换算(days 自 1970-01-01,可为负;Howard Hinnant 的 `civil_from_days`,
/// 移位法以 400 年 = 146097 天为一周期)。返回 `(年, 月, 日)`,月/日为 1 基。
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = (z - era * 146_097) as u32; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// 把一行自述追加到**插件已经在用的那本日志**。
///
/// 落点必须与插件同源,不新造根(模块头注第 7 条):
/// * 目录 = `%LOCALAPPDATA%\{app_id}\logs\` —— tauri 插件的 `TargetKind::LogDir`
///   在 Windows 上解析为 `app_log_dir()` = `app_data_dir()/logs` = 该路径
///   (出处:lib.rs 日志插件那段注释、`log_retention.rs` 头注的源码考据);
///   而本函数所在模块等锁用的也是同一个 `%LOCALAPPDATA%\{app_id}` 根,不另立第三个。
/// * 文件 = `{log_stem}.log`,其中 `log_stem` 由调用方(lib.rs)注入**同一枚**它交给
///   插件 `file_name` 的常量 —— 主文件名不在这里抄第二份(§0.6;`preflight` 的形参
///   注释写死了这条约束,在此写死字面量即为违规)。
///
/// 只在**活不到应用级 setup** 的那条出口上调用(健康路径每次正常双击都会走,落盘
/// 等于把 40KB 的日志刷满 —— 那条刻意不落)。
///
/// 失败一律返回 `false` 且不报错:预检阶段没有日志器可以报错,而"落不下日志"绝不能
/// 变成阻断启动或改变判定的理由。调用方只消费返回值与否都不影响主流程。
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn append_to_app_log(app_id: &str, log_stem: &str, line: &str) -> bool {
    use std::io::Write;
    let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") else {
        return false;
    };
    let dir = Path::new(&local_app_data).join(app_id).join("logs");
    let file = dir.join(format!("{log_stem}.log"));
    let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&file) else {
        return false;
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default();
    // 行式与插件默认格式同形(`时刻 [级别] [target] 消息`),便于在同一本日志里对齐。
    writeln!(
        f,
        "{} [WARN] [ihui_desktop_lib::startup_guard] {}",
        utc_stamp_ms(now),
        line
    )
    .is_ok()
}

/// 等待 `EBWebView\Lockfile` 释放(上限 `max_wait_ms`),返回实际等待毫秒数,
/// 0 = 无需等待。
///
/// 被强杀实例留下的孤儿 WebView2 browser 进程**无法从外部打开/终止**
/// (2026-09-27 实测:OpenProcess 连 PROCESS_QUERY_LIMITED_INFORMATION 都被
/// DACL 拒绝),但会在父进程死后 1~3 分钟自行退出。所以正确动作不是杀它们,
/// 而是等它们释放目录锁后再建本进程的 webview——否则 wry 在主线程同步等
/// 环境创建,窗口不显示、日志一行不写,与"双击没反应"完全同形(实测卡 102s)。
///
/// 判据用 Lockfile 独占打开:成功/不存在 = 已释放;ERROR_SHARING_VIOLATION(32)
/// = 仍被占用,继续等;其他错误(如权限) = 无法判定,放行——绝不因守护卡死启动。
#[cfg(target_os = "windows")]
pub fn wait_for_webview_lock_release(lockfile: &Path, max_wait_ms: u64) -> u64 {
    use std::os::windows::fs::OpenOptionsExt;
    const ERROR_SHARING_VIOLATION: i32 = 32;
    let start = std::time::Instant::now();
    loop {
        if !lockfile.exists() {
            return start.elapsed().as_millis() as u64;
        }
        let probe = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0)
            .open(lockfile);
        match probe {
            Ok(_exclusive) => return start.elapsed().as_millis() as u64,
            Err(e) if e.raw_os_error() == Some(ERROR_SHARING_VIOLATION) => {}
            Err(_) => return start.elapsed().as_millis() as u64,
        }
        if start.elapsed().as_millis() as u64 >= max_wait_ms {
            return max_wait_ms;
        }
        std::thread::sleep(std::time::Duration::from_millis(1000));
    }
}

#[cfg(target_os = "windows")]
/// 启动守护预检。`app_id` **必须**是运行期配置里的 identifier(调用方取
/// `tauri::Context::config().identifier`,与插件 setup 里的 `app.config().identifier`
/// 同一枚值)—— 锁名由它派生,写死一份就等于让预检和插件各拿一把锁。
///
/// `log_stem` **必须**是调用方交给日志插件 `file_name` 的同一枚常量(lib.rs 的
/// `APP_LOG_FILE_STEM`):落账那一行要写进插件那本日志(`{log_stem}.log`),在这里再写
/// 一遍字面量就是第二个真相源(§0.6),而且会把"链已坏 ⇒ 自行退出"那条出口的可观测性
/// 落到一本没人去读的册子上(模块头注第 7 条)。
pub fn preflight(app_id: &str, log_stem: &str) {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::ptr;

    use winapi::shared::minwindef::{BOOL, DWORD, FALSE, LPARAM, TRUE};
    use winapi::shared::ntdef::HANDLE;
    use winapi::shared::windef::HWND;
    use winapi::shared::winerror::ERROR_ALREADY_EXISTS;
    use winapi::um::errhandlingapi::GetLastError;
    use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
    use winapi::um::processthreadsapi::{GetCurrentProcessId, OpenProcess, TerminateProcess};
    use winapi::um::synchapi::{CreateMutexW, WaitForSingleObject};
    use winapi::um::tlhelp32::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winnt::{
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, SYNCHRONIZE,
    };
    use winapi::um::winuser::{
        EnumWindows, FindWindowW, GetWindowThreadProcessId, IsWindowVisible, SendMessageTimeoutW,
        SMTO_ABORTIFHUNG, SMTO_BLOCK, WM_NULL,
    };

    /// 隐藏消息窗口应答探测超时(毫秒)。插件自身的 `SendMessageW` 无超时,
    /// 本探测必须带超时,否则预检自己也会卡在挂死实例上。
    const SIW_PROBE_TIMEOUT_MS: DWORD = 2000;
    /// 等待被终止进程退出的上限(毫秒)。
    const KILL_WAIT_MS: DWORD = 5000;
    /// 等待 EBWebView 目录锁释放的上限(毫秒)。孤儿 browser 实测父死后 1~3 分钟
    /// 自行退出;超过上限仍继续启动(回到旧行为),不无限卡死。
    const WEBVIEW_LOCK_WAIT_MAX_MS: u64 = 120_000;
    /// 「启动相位只等不杀」的等待上限(毫秒)与轮询步长(模块头注第 6 条)。
    ///
    /// ⚠️ 如实登记射程:对方实例从建 `{id}-sim` 到插件 setup 建出 `{id}-siw`,中间可能
    /// 夹着它自己那一轮最长 120s 的 EBWebView 等锁(第 3 条),**本上限覆盖不了那种最坏
    /// 情形**;取 10s 是"绝大多数正常冷启动此刻早已建窗"与"用户双击后必须尽快有结论"
    /// 的折中。超上限后回到原语义(重采事实、不带该旗再判一次),**不**无限等,也**不**
    /// 因为"还在等"就把对方杀了。
    const STARTUP_PHASE_WAIT_MAX_MS: u64 = 10_000;
    const STARTUP_PHASE_POLL_STEP_MS: u64 = 200;

    fn encode_wide(s: &str) -> Vec<u16> {
        std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    let mutex_name = encode_wide(&format!("{app_id}-sim"));
    let class_name = encode_wide(&format!("{app_id}-sic"));
    let window_name = encode_wide(&format!("{app_id}-siw"));

    unsafe {
        // 本轮预检的取数槽:每一条出口都必须先填账再离开(模块头注第 7 条)。
        let mut reading = PreflightReading::default();

        // 探针:与插件同名 mutex。FALSE=不要求初始所有权,只为问"有没有别人"。
        let hmutex = CreateMutexW(ptr::null_mut(), FALSE, mutex_name.as_ptr());
        if hmutex.is_null() {
            // 探针失败 → 放行(插件自身逻辑兜底),绝不因守护阻断启动。
            // `mutex_exists` 保持 `None`:这一轮**什么都没判出来**,不得让 setup 把它
            // 报名成"判过了,结论是没有其他实例"(§0.3)。
            record_last_reading(&reading);
            return;
        }
        let mutex_exists = GetLastError() == ERROR_ALREADY_EXISTS;
        reading.mutex_exists = Some(mutex_exists);

        if mutex_exists {
            let mut sample = sample_other(&class_name, &window_name);
            apply_to_reading(&mut reading, &sample);

            // 「启动相位」那条**独立事实**(模块头注第 6 条):siw 未现,却枚举得到同名
            // 对方进程 ⇒ 对方还在自己的启动序列里(插件 setup 没跑),不是僵尸。
            // 判据只用已经采到的两条事实,不在 decide 里反推(反推 = 把竞态转嫁给结论)。
            let in_startup_phase =
                !sample.found && !matches!(sample.other, OtherInstances::NoneSeen);
            let mut action = decide(
                true,
                sample.found,
                sample.responsive,
                sample.other,
                sample.has_visible_window,
                in_startup_phase,
            );

            if matches!(action, PreflightAction::WaitForOtherStartupPhase) {
                // 只等不杀:先把上一轮开的进程句柄关掉(等待期间不持有别人的句柄,也不
                // 在等待里开新句柄),再轮询 `{id}-siw`。
                close_opened_handles(&sample.cleanable);
                let _appeared = wait_for_sibling_siw_window(
                    &class_name,
                    &window_name,
                    STARTUP_PHASE_WAIT_MAX_MS,
                );
                // 等待结束 = 重新采一遍事实,并且**不带**启动相位旗再判一次:
                // 结构上不可能二次等待(无循环),而该杀的僵尸在这一格照原语义被杀。
                // 现身且应答 → decide 给 HandoffToExisting(交插件唤醒);超时仍未现身且
                // 对方进程不在 / 无可移交对象 → 原语义继续或清理。
                sample = sample_other(&class_name, &window_name);
                apply_to_reading(&mut reading, &sample);
                action = decide(
                    true,
                    sample.found,
                    sample.responsive,
                    sample.other,
                    sample.has_visible_window,
                    false,
                );
            }

            if !matches!(action, PreflightAction::KillStaleThenContinue) {
                // 不杀就把开给别人的句柄全关掉:留在手里没有用处,而"继续启动"这一格
                // 之后还要跑很久(等 EBWebView 锁,上限 120s)。
                close_opened_handles(&sample.cleanable);
            }
            match action {
                PreflightAction::HandoffToExisting => {
                    // 所有离开的路径都必须关掉探针句柄(见模块头注第 4 条),
                    // 包括立刻退出的那条 —— 不把"关句柄"变成一条依赖路径的规矩。
                    CloseHandle(hmutex);
                    if !(sample.found && sample.responsive) {
                        // 插件的移交链已坏:隐藏窗口缺失时它**放行第二实例继续启动**
                        // (第 1b 条),不应答时它的无超时 `SendMessageW` 会把本进程永久
                        // 挂住(第 1a 条)。所以这里自己结束本进程 —— 此刻 Builder 尚未
                        // 运行,无窗口无资源,终态与插件移交一致(exit 0)。
                        // 2026-10-21(票 L7220 P1)订正最后那句"不写日志":本进程活不到
                        // setup,而这条出口恰恰是唯一需要留证的(它是"双击毫无反应"的
                        // 终态本身)。于是在 exit(0) **之前**把读数追加进插件那本日志 ——
                        // 落点与文件名同源自 lib.rs 的 `APP_LOG_FILE_STEM`,不新造落点根。
                        record_last_reading(&reading);
                        append_to_app_log(
                            app_id,
                            log_stem,
                            &describe_for_log(&reading, "handoff-self-exit"),
                        );
                        std::process::exit(0);
                    }
                    // 健康路径:插件唤醒对方并结束本进程。**不落盘**(每次正常双击都走
                    // 这条,落盘等于把日志刷满);仍填账,因为此刻本进程还没交出去。
                    record_last_reading(&reading);
                    return;
                }
                PreflightAction::KillStaleThenContinue => {
                    let killed = kill_collected_instances(sample.cleanable);
                    if killed > 0 {
                        KILLED_STALE_COUNT.store(killed, Ordering::SeqCst);
                    }
                }
                // mutex 在、却一个同名实例都没枚举到(对方正在退出的瞬时状态或异常残留):
                // 没有任何可移交的对象,**继续启动** —— 绝不允许在这种状态下静默退出,
                // 那正是本模块要消灭的"双击毫无反应"。
                PreflightAction::ContinueLaunch => {}
                // 重判时相位旗恒为 false ⇒ 这一臂结构上不可达。留空臂而不是 panic:
                // release 档 `panic = "abort"`,守护里任何一臂都不许以中止进程为代价。
                PreflightAction::WaitForOtherStartupPhase => {}
            }
        }
        // 走到这里 = 本进程将以唯一实例身份继续启动(要移交的已在上面 return / exit 离开)。
        // 等孤儿 WebView2 释放 EBWebView 目录锁(判据与上限见 wait_for_webview_lock_release):
        // 不等的话 wry 会在主线程同步等环境创建,窗口不显示、日志一行不写,
        // 与"双击没反应"完全同形——这正是"强制退出兜底"之后下一次双击打不开的最终一环。
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let lockfile = std::path::Path::new(&local_app_data)
                .join(app_id)
                .join("EBWebView")
                .join("Lockfile");
            let waited = wait_for_webview_lock_release(&lockfile, WEBVIEW_LOCK_WAIT_MAX_MS);
            if waited > 0 {
                reading.waited_lock_ms = waited;
            }
        }
        // 每一条走到这里的路径都必须填账(setup 逐条报名用),也必须关掉探针句柄
        // (见模块头注第 4 条)。
        record_last_reading(&reading);
        CloseHandle(hmutex);
    }

    /// 一次采样得到的四条事实 + 开到的可清理进程句柄(只查不杀)。
    /// 句柄生命周期归调用方:要么交给 `kill_collected_instances`,要么交给
    /// `close_opened_handles`,不得随结构体一起被 drop 掉(句柄不是 File,不会自动关)。
    struct Sample {
        found: bool,
        responsive: bool,
        other: OtherInstances,
        has_visible_window: bool,
        cleanable: Vec<HANDLE>,
    }

    /// 采一遍对方一侧的事实。抽成一个函数是因为「启动相位」档等待结束后必须
    /// **用同一把尺子重采一次**(模块头注第 6 条);两处各写一份探测代码必然漂移。
    unsafe fn sample_other(class_name: &[u16], window_name: &[u16]) -> Sample {
        let hwnd = FindWindowW(class_name.as_ptr(), window_name.as_ptr());
        let found = !hwnd.is_null();
        // 带超时 + SMTO_ABORTIFHUNG 的空消息探测:挂死的主线程不会应答。
        // ⚠️ "不应答"有两种可能:真挂死,或只是主线程被占住的**健康**实例
        //    (2026-09-27 实测:并发构建 + 上百道守门把机器压满时 2s 不够)。
        //    两者在探测上同形,所以判"该不该杀"必须再问两条独立事实 —— 可见窗口
        //    (`has_visible_window`,第 5a 条)与对方进程是否还活着(第 6 条)。
        let responsive = found && {
            // lpdwResult 是 PDWORD_PTR(= *mut usize),不是 LPDWORD。
            let mut result: usize = 0;
            SendMessageTimeoutW(
                hwnd,
                WM_NULL,
                0,
                0,
                SMTO_ABORTIFHUNG | SMTO_BLOCK,
                SIW_PROBE_TIMEOUT_MS,
                &mut result as *mut usize,
            ) != 0
        };

        // 枚举**只查不杀**:杀掉谁要等可见窗口与启动相位两条判据一起进 decide() 才能定。
        let own_exe = std::env::current_exe().unwrap_or_default();
        let (candidates, cleanable) = collect_other_instances(GetCurrentProcessId(), &own_exe);
        let has_visible_window = other_instance_has_visible_window(&candidates);
        let other = if candidates.is_empty() {
            OtherInstances::NoneSeen
        } else if cleanable.is_empty() {
            OtherInstances::PresentButNothingCleanable
        } else {
            OtherInstances::PresentWithCleanableTarget
        };
        Sample { found, responsive, other, has_visible_window, cleanable }
    }

    /// 把这一轮采到的事实抄进取数槽(两个采样点共用一份抄法,不各写四行)。
    fn apply_to_reading(reading: &mut PreflightReading, sample: &Sample) {
        reading.siw_found = sample.found;
        reading.responsive = sample.responsive;
        reading.other = Some(sample.other);
        reading.other_has_visible = sample.has_visible_window;
    }

    unsafe fn close_opened_handles(handles: &[HANDLE]) {
        for h in handles {
            CloseHandle(*h);
        }
    }

    /// 「只等不杀」档的执行体:轮询 `{id}-siw` 至多 `max_wait_ms`,现身返回 true。
    /// 只问 `FindWindowW`(一次同步系统调用,不开句柄、不发消息),因此等待期间本进程
    /// 仍然"无窗口、无日志"—— 与既有等 EBWebView 锁那一档同形,代价由 P1 的落账兜住。
    unsafe fn wait_for_sibling_siw_window(
        class_name: &[u16],
        window_name: &[u16],
        max_wait_ms: u64,
    ) -> bool {
        let start = std::time::Instant::now();
        loop {
            if !FindWindowW(class_name.as_ptr(), window_name.as_ptr()).is_null() {
                return true;
            }
            if start.elapsed().as_millis() as u64 >= max_wait_ms {
                return false;
            }
            std::thread::sleep(std::time::Duration::from_millis(STARTUP_PHASE_POLL_STEP_MS));
        }
    }

    /// 终止 `collect_other_instances` 交出的**同全路径**进程(句柄已在手),返回成功终止数。
    unsafe fn kill_collected_instances(targets: Vec<HANDLE>) -> usize {
        let mut killed = 0usize;
        let mut terminated: Vec<HANDLE> = Vec::new();
        for h in targets {
            if TerminateProcess(h, 1) != FALSE {
                killed += 1;
                terminated.push(h);
            } else {
                CloseHandle(h);
            }
        }
        for h in terminated {
            // 返回值不判:超时也继续,绝不因单个进程退不掉而卡死启动。
            WaitForSingleObject(h, KILL_WAIT_MS);
            CloseHandle(h);
        }
        killed
    }

    /// 枚举除自身外的 ihui-desktop 进程,**只查不杀**,返回两份语义不重叠的事实:
    /// - `candidates`:exe **文件名**相同的其他进程 pid(含全路径不同的、也含句柄/路径
    ///   核不出来那些)—— 回答"到底还有没有别的实例",并作为可见窗口判据的搜索范围;
    /// - `cleanable`:其中**全路径与本进程一致**者的进程句柄(已带 PROCESS_TERMINATE)
    ///   —— 只有这些是可清理对象。跨路径一律不在此列:让开发版去杀用户正在用的安装版,
    ///   是模块头注第 5a 条那类误杀的放大版(第 5b 条)。
    ///
    /// 取不到自身路径时返回两个空集(等价于"没看到其他实例"→ 继续启动),不猜。
    unsafe fn collect_other_instances(
        own_pid: DWORD,
        own_exe: &Path,
    ) -> (Vec<DWORD>, Vec<HANDLE>) {
        if own_exe.as_os_str().is_empty() {
            return (Vec::new(), Vec::new());
        }
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return (Vec::new(), Vec::new());
        }

        let own_name = own_exe.file_name().map(|n| n.to_string_lossy().into_owned());
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as DWORD;
        let mut candidates: Vec<DWORD> = Vec::new();
        let mut cleanable: Vec<HANDLE> = Vec::new();

        if Process32FirstW(snapshot, &mut entry) == TRUE {
            loop {
                let pid = entry.th32ProcessID;
                if pid != own_pid {
                    // 先按 exe 名粗筛(便宜),再 OpenProcess 核全路径(防同名不同目录)。
                    let name = OsString::from_wide(&entry.szExeFile)
                        .to_string_lossy()
                        .into_owned();
                    let name = name.trim_end_matches('\0').to_string();
                    if own_name.as_deref() == Some(name.as_str()) {
                        candidates.push(pid);
                        let h = OpenProcess(
                            PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE,
                            FALSE,
                            pid,
                        );
                        if !h.is_null() {
                            let mut buf = [0u16; 1024];
                            let mut size = buf.len() as DWORD;
                            let full_path_ok = QueryFullProcessImageNameW(
                                h,
                                0,
                                buf.as_mut_ptr(),
                                &mut size,
                            ) != FALSE
                                && same_exe_path(
                                    &Path::new(&OsString::from_wide(&buf[..size as usize])),
                                    own_exe,
                                );
                            if full_path_ok {
                                // 句柄留给 kill_collected_instances(它负责终止/等待/关闭);
                                // 这里绝不能 continue,否则会跳过 Process32NextW 死循环。
                                cleanable.push(h);
                            } else {
                                CloseHandle(h);
                            }
                        }
                    }
                }
                if Process32NextW(snapshot, &mut entry) != TRUE {
                    break;
                }
            }
        }
        CloseHandle(snapshot);
        (candidates, cleanable)
    }

    /// 候选进程里是否有任何一个拥有**可见的顶层窗口**(模块头注第 5a 条的判据)。
    ///
    /// 判据刻意取"宽",并且**不排除最小化窗口** —— 理由一句话:最小化的窗口仍是用户
    /// 自己拥有、随时能还原的窗口,以"此刻看不见"为由杀掉它,用户下次还原时看到的就是
    /// 一个凭空消失的应用;而本模块要清理的真僵尸按定义是**没有窗口**的那个。
    ///
    /// 只问 `IsWindowVisible`,不看 `IsIconic`/owner;`EnumWindows` 天然只枚举顶层窗口,
    /// 而插件的隐藏消息窗口 `{id}-siw` 不带 `WS_VISIBLE`,所以不会被读成"看得见"。
    /// 自己的 pid 在本函数内再排除一次(调用方给的是"除自身外"的清单):判据不得依赖
    /// 调用方的自律,而本进程此刻还没建任何窗口,自排除恒为无害。
    unsafe fn other_instance_has_visible_window(pids: &[DWORD]) -> bool {
        if pids.is_empty() {
            return false;
        }
        struct Scan<'a> {
            pids: &'a [DWORD],
            own_pid: DWORD,
            found: bool,
        }
        unsafe extern "system" fn on_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
            // SAFETY: 唯一调用方把一个栈上 `Scan` 的地址交给 EnumWindows,而 EnumWindows
            // 是同步的 —— 它返回时回调已全部跑完,该地址在整段枚举期间始终有效。
            let scan = &mut *(lparam as *mut Scan<'_>);
            let mut pid: DWORD = 0;
            if GetWindowThreadProcessId(hwnd, &mut pid) != 0
                && pid != scan.own_pid
                && scan.pids.contains(&pid)
                && IsWindowVisible(hwnd) != FALSE
            {
                scan.found = true;
                return FALSE; // 已确认"用户看得见",不必再枚举剩下的窗口
            }
            TRUE
        }
        let mut scan = Scan {
            pids,
            own_pid: GetCurrentProcessId(),
            found: false,
        };
        // 返回值不判:枚举失败(0)时 scan.found 保持 false,即"没证据说有可见窗口",
        // 与判不到时保守放行同一条方向。
        let _ = EnumWindows(Some(on_window), &mut scan as *mut Scan<'_> as LPARAM);
        scan.found
    }
}

#[cfg(not(target_os = "windows"))]
/// 非 Windows:本平台没有 `{id}-sim` mutex / `{id}-siw` 消息窗这套机制(single-instance
/// 插件在 unix 侧走的是另一套),预检**无事可做**,因此也**没有任何读数可填** ——
/// `take_last_reading()` 保持 `None`,setup 那一侧会如实报名"未落账 ⇒ 未判定",
/// 不得在这里造一份"全 false 的正常读数"冒充判过(§0.3)。
pub fn preflight(_app_id: &str, _log_stem: &str) {}

#[cfg(test)]
mod tests {
    use super::*;
    use super::OtherInstances::*;
    use std::path::PathBuf;

    // ⚠️ 覆盖面如实登记(**不得把没测写成测过**):本模块只测 `decide` 的纯判定、
    // `same_exe_path`、以及取数槽/落账行这几个纯函数。四个 Win32 函数
    // (`collect_other_instances` / `kill_collected_instances` /
    // `other_instance_has_visible_window` / `wait_for_sibling_siw_window`)住在
    // `preflight()` 体内、测试不可见;其中"有没有可见窗口"要端到端验证就得真造一个
    // 顶层窗口(注册窗口类 + 消息循环,且无桌面会话的 CI 上不稳定),故**未做端到端覆盖**
    // —— 它的判据是刻意做成注入点(纯函数收 `bool`)的,所以"该杀/不该杀"的所有分支
    // 都由下面的成对用例锁住,只有"窗口可见性怎么量到"这一层没有测试兜着。
    //
    // ⚠️ 2026-10-21 起 `decide` 多了一条入参 `other_in_startup_phase`(票 L7220 P2)。
    // 下面**每一条 2026-09-27 的既有用例都传 `false`**(= 不在启动相位,原语义),
    // 这样它们判的还是各自原来那一格;该档自己的用例逐条显式写 `true`,不与旧表混。
    // 反证锁:把 `decide` 里那一臂删掉 ⇒ `启动相位档永不清理` 立刻红(见该用例注释)。

    #[test]
    fn 无其他实例时放行() {
        // mutex 不存在 ⇒ 其余参数无意义,取最保守的一档。
        assert_eq!(
            decide(false, false, false, NoneSeen, false, false),
            PreflightAction::ContinueLaunch
        );
    }

    #[test]
    fn 健康实例存在时移交插件唤醒() {
        // 探测链完好 ⇒ 即便存在可清理对象也绝不杀(交给插件唤醒 + 结束本进程)。
        // 这一例同时是票 L7170 复现前置("主实例隐藏态时 siw 是否仍在",判据侧)的钉:
        // 第 5 参 false = 主实例隐藏;事实侧(siw 不随可见性消失)见模块头注第 8 条。
        assert_eq!(
            decide(true, true, true, PresentWithCleanableTarget, false, false),
            PreflightAction::HandoffToExisting
        );
    }

    #[test]
    fn 挂死实例隐藏窗口不应答时先清理再启动() {
        assert_eq!(
            decide(true, true, false, PresentWithCleanableTarget, false, false),
            PreflightAction::KillStaleThenContinue
        );
    }

    #[test]
    fn 僵尸实例占着锁却没有隐藏窗口时先清理再启动() {
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, false, false),
            PreflightAction::KillStaleThenContinue
        );
    }

    // ---- 2026-09-27 缺陷 1:「有可见窗口 ⇒ 绝不能杀」—— 成对用例 ----

    #[test]
    fn 可见窗口这一维必须真的改变结论两个方向各测一次() {
        // 同一组探测结果(隐藏窗口缺失、不应答、有同路径可清理对象),唯一变量是
        // "对方有没有可见窗口":false ⇒ 允许清理(否则退回"双击打不开"),
        // true ⇒ 只移交(误杀用户正在用的窗口 = 用户侧的"点哪个页面就崩")。
        // 只留其中一半,判据就成了"永远不杀"或"永远照杀"。
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, false, false),
            PreflightAction::KillStaleThenContinue
        );
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, true, false),
            PreflightAction::HandoffToExisting
        );
    }

    #[test]
    fn 有可见窗口时隐藏窗口不应答也不得杀() {
        // 与「挂死实例隐藏窗口不应答时先清理再启动」逐字段对照,只把可见窗口翻成 true。
        assert_eq!(
            decide(true, true, false, PresentWithCleanableTarget, true, false),
            PreflightAction::HandoffToExisting
        );
    }

    // ---- 2026-09-27 缺陷 2:跨路径这一对既无人清理也互不移交 ----

    #[test]
    fn 跨路径且筛不出可清理对象时移交而非继续启动() {
        // 同一 identifier 的两个实例(如安装版与其更新版、两份同配置的开发版)共用一把
        // `{id}-sim` mutex、同一个 `EBWebView` 目录:继续往下建
        // webview 必撞目录锁(实测 `0x800700AA 请求的资源在使用中` ×2 + `0x800705B4` ×1)。
        assert_eq!(
            decide(true, false, false, PresentButNothingCleanable, false, false),
            PreflightAction::HandoffToExisting
        );
    }

    #[test]
    fn 同路径有可清理对象时不得被跨路径那一条放过() {
        // 反向对照:上面那条把"筛不出对象"换成"筛得出"就必须翻回清理,
        // 否则第 5a 条之外的正常僵尸再也没人清(即本模块最初的立因)。
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, false, false),
            PreflightAction::KillStaleThenContinue
        );
    }

    #[test]
    fn 一个同名实例都没看到时绝不静默退出() {
        // 与「跨路径…移交」唯一差别是有没有枚举到实例:没有可移交对象时必须继续启动。
        assert_eq!(
            decide(true, false, false, NoneSeen, false, false),
            PreflightAction::ContinueLaunch
        );
    }

    #[test]
    fn 两条事实矛盾时以有没有实例为准不得无人接管就退出() {
        // 生产面上不可达(可见窗口判据的搜索范围就是枚举到的候选 pid),但纯函数不得
        // 假设调用方自律:判成移交 = 本进程退出而屏幕上一个窗口都没有。
        assert_eq!(
            decide(true, false, false, NoneSeen, true, false),
            PreflightAction::ContinueLaunch
        );
    }

    #[test]
    fn 可执行文件路径比较大小写不敏感() {
        let a = PathBuf::from("D:\\智汇AI\\ihui-desktop.exe");
        let b = PathBuf::from("d:\\智汇ai\\IHUI-DESKTOP.EXE");
        assert!(same_exe_path(&a, &b));
    }

    #[test]
    fn 可执行文件路径不同目录判为不同实例() {
        let a = PathBuf::from("D:\\智汇AI\\ihui-desktop.exe");
        let b = PathBuf::from("G:\\IHUI-AI\\apps\\desktop\\src-tauri\\target\\release\\ihui-desktop.exe");
        assert!(!same_exe_path(&a, &b));
    }

    #[test]
    fn 清理计数取走即清零() {
        KILLED_STALE_COUNT.store(3, Ordering::SeqCst);
        assert_eq!(take_killed_stale_count(), 3);
        assert_eq!(take_killed_stale_count(), 0);
    }

    // ---- 2026-10-21 票 L7220 P2:启动相位那一档「只等不杀」 ----

    /// **用例①**:新表含「startup-phase 永不 KillStale」。
    ///
    /// 穷举该旗为 `true` 时的**全部**其余入参组合(2×2×3×2 = 24 组),断言其中
    /// **没有一组**返回 `KillStaleThenContinue` —— 这条档的全部意义就是"正在启动的
    /// 自己人不能被当成僵尸打死"(模块头注第 6 条),而"永不"只能穷举证明,举一两个
    /// 例子等于没证。
    ///
    /// 反证锁:删掉 `decide()` 里 `other_in_startup_phase` 那一臂 ⇒ 本用例立刻红
    /// (24 组里 `(true, PresentWithCleanableTarget, false)` 一族会翻成 KillStale)。
    #[test]
    fn 启动相位档永不清理旧实例() {
        let found = [false, true];
        let responsive = [false, true];
        let others = [
            OtherInstances::NoneSeen,
            OtherInstances::PresentButNothingCleanable,
            OtherInstances::PresentWithCleanableTarget,
        ];
        let visible = [false, true];
        let mut combos = 0usize;
        let mut waited = 0usize;
        for f in found {
            for r in responsive {
                for o in others {
                    for v in visible {
                        combos += 1;
                        let got = decide(true, f, r, o, v, true);
                        assert_ne!(
                            got,
                            PreflightAction::KillStaleThenContinue,
                            "启动相位(flag=true)却判出清理:found={f} responsive={r} other={o:?} visible={v}"
                        );
                        if got == PreflightAction::WaitForOtherStartupPhase {
                            waited += 1;
                        }
                    }
                }
            }
        }
        // 枚举到 0 个候选判死不记绿:该档必须真的覆盖到若干组,否则"永不"是空的。
        assert_eq!(combos, 24, "穷举面本身被改动了(入参维度少了一维)");
        // 落在等待档的确切组数 = 6。按判序逐条数(总数 24 = 2×2×3×2):
        //   · other=NoneSeen 一族 8 组:结构上进不了等待档(旗的定义含"对方进程在");
        //   · 另两族各 8 组:其中"可见=true"4 组被第 1 条截胡成移交,
        //     "可见=false 且 siw 在且应答"1 组被第 2 条截胡成移交 ⇒ 每族只剩 3 组;
        //   · 3 + 3 = 6。(移交合计 8+2+2=12、继续启动 8,12+8+6=24。)
        // 数字写死是刻意的:少一组 = 判序被动过,多一组 = 等待档吞掉了别格。
        assert_eq!(
            waited, 6,
            "等待档覆盖到 {waited} 组,与按判序算出的 6 组不符 ⇒ 判序被动过"
        );
    }

    #[test]
    fn 启动相位等待结束后同一组事实照原语义判() {
        // 成对对照:这一组事实(mutex 在、siw 未现、不应答、有同路径可清理对象、无可见窗)
        // 带旗 ⇒ 只等不杀;摘旗(= 等待结束后重采那一轮)⇒ 原语义该杀还杀。
        // 少了后一半,这一档就变成"永远不杀"—— 第 1b 条的僵尸再也没人清。
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, false, true),
            PreflightAction::WaitForOtherStartupPhase
        );
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, false, false),
            PreflightAction::KillStaleThenContinue
        );
    }

    #[test]
    fn 启动相位里对方现身且应答就交插件移交() {
        // 等待之后重采:siw 出来了且应答 ⇒ 探测链完好,交回插件唤醒对方(既有健康路径)。
        assert_eq!(
            decide(true, true, true, PresentWithCleanableTarget, false, false),
            PreflightAction::HandoffToExisting
        );
    }

    #[test]
    fn 启动相位旗在看不见任何实例时不得改写结论() {
        // 生产面上算不出来(旗的定义含"对方进程在"),但纯函数不得假设调用方自律:
        // NoneSeen 时若判成移交,本进程退出而屏幕上一个窗口都没有 = "双击毫无反应"。
        assert_eq!(
            decide(true, false, false, NoneSeen, false, true),
            PreflightAction::ContinueLaunch
        );
    }

    #[test]
    fn 看得见这一维排在启动相位之前() {
        // 第 5a 条(看得见 = 不可杀)必须仍然压在第 6 条之前:同一组事实带旗与否都判移交,
        // 且绝不是"等待"之后的清理 —— 用户正在用的窗口不因相位这条新档而换个死法。
        assert_eq!(
            decide(true, false, false, PresentWithCleanableTarget, true, true),
            PreflightAction::HandoffToExisting
        );
    }

    // ---- 2026-10-21 票 L7220 P1:预检取数槽与落账行 ----

    /// 取数槽的"填 → 取 → 取空"三态。**单独一个 #[test] 且自成闭环**:槽是进程级
    /// static,并行用例互相取走会彼此的读数(与 `清理计数取走即清零` 同一纪律)。
    #[test]
    fn 预检读数填一次取一次_取走后必须显式空而非旧值() {
        let r = PreflightReading {
            mutex_exists: Some(true),
            siw_found: false,
            responsive: true,
            other: Some(OtherInstances::PresentButNothingCleanable),
            other_has_visible: true,
            waited_lock_ms: 4321,
        };
        record_last_reading(&r);
        let got = take_last_reading().expect("填过账必须取得到");
        assert_eq!(got, r, "取回的读数与填进去的逐字段不等");
        assert_eq!(got.waited_lock_ms, 4321);
        assert!(
            take_last_reading().is_none(),
            "取走后再取得到值 ⇒ 上一轮的读数会被下一轮当成本轮报名"
        );
    }

    #[test]
    fn 探针失败那一档必须读成未判定不是判过() {
        // §0.3:取不到输入 ⇒ "未判定",不得用 false 冒充"判过了,结论是没有其他实例"。
        let none_judged = PreflightReading::default();
        assert_eq!(none_judged.mutex_exists, None);
        assert_eq!(none_judged.other, None);
        let line = describe_for_log(&none_judged, "probe-failed");
        assert!(
            line.contains("mutex_exists=None"),
            "落账行没把'未判定'写出来 ⇒ 事后日志读起来像判过:{line}"
        );
        assert!(line.contains("other_instances=None"), "同上,第二维:{line}");
        assert!(line.contains("outcome=probe-failed"), "{line}");
    }

    #[test]
    fn 落账行六个字段全部带键名() {
        // 逐字段**显式命名**是这条出口唯一的可判读形态(半启动那一型下没人能重新采一遍)。
        let r = PreflightReading {
            mutex_exists: Some(true),
            siw_found: true,
            responsive: false,
            other: Some(OtherInstances::PresentWithCleanableTarget),
            other_has_visible: false,
            waited_lock_ms: 120_000,
        };
        let line = describe_for_log(&r, "kill-stale-then-continue");
        for key in [
            "outcome=",
            "mutex_exists=",
            "siw_found=",
            "siw_responsive=",
            "other_instances=",
            "other_has_visible=",
            "waited_lock_ms=",
        ] {
            assert!(line.contains(key), "落账行缺字段 {key}:{line}");
        }
        assert!(line.contains("PresentWithCleanableTarget"), "{line}");
        assert!(line.contains("waited_lock_ms=120000"), "{line}");
    }

    #[test]
    fn utc时刻换算对齐独立实现含闰年与世纪不闰() {
        // 期望值由与本函数无关的实现算出(node `new Date(ms).toISOString()`),
        // 两边同形才算证据;世纪档 2100 **不是**闰年,是最容易写错的一处。
        assert_eq!(utc_stamp_ms(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(utc_stamp_ms(1000), "1970-01-01T00:00:01.000Z");
        assert_eq!(utc_stamp_ms(86_399_000), "1970-01-01T23:59:59.000Z");
        assert_eq!(utc_stamp_ms(86_400_000), "1970-01-02T00:00:00.000Z");
        assert_eq!(utc_stamp_ms(1_704_067_199_999), "2023-12-31T23:59:59.999Z");
        assert_eq!(utc_stamp_ms(1_709_164_800_000), "2024-02-29T00:00:00.000Z");
        assert_eq!(utc_stamp_ms(1_709_251_200_000), "2024-03-01T00:00:00.000Z");
        assert_eq!(utc_stamp_ms(4_107_456_000_000), "2100-02-28T00:00:00.000Z");
        assert_eq!(utc_stamp_ms(4_107_542_400_000), "2100-03-01T00:00:00.000Z");
    }

    #[test]
    fn 落账那一行不得含任何凭据形态() {
        // 这行会被写进用户机器上的日志文件:内容只有布尔/枚举/毫秒,不得出现路径或键值。
        let r = PreflightReading {
            mutex_exists: Some(true),
            siw_found: false,
            responsive: false,
            other: Some(OtherInstances::NoneSeen),
            other_has_visible: false,
            waited_lock_ms: 0,
        };
        let line = describe_for_log(&r, "continue");
        assert!(
            !line.contains(":\\") && !line.contains('/') && !line.contains("=Some(\""),
            "落账行混进路径或自由文本,日志面就变成凭据泄漏面:{line}"
        );
    }
}
