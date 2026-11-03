# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Computer Use 浏览器可视化驾驶舱路由(对标 Claude Computer Use)。

提供一批最小可用的"浏览器驾驶"端点,让用户通过 web 面板可视化地操作真实的
headless Chromium(打开页面/交互元素快照/点击/输入/截图/提取文本/关闭)。

驱动层:playwright.async_api + **按用户隔离**的会话表(`_sessions: dict[user_id -> _UserBrowser]`)。
- main.py 已在 Windows 强制 ProactorEventLoop(否则 Playwright 启动 Chromium 会
  报 NotImplementedError),async Playwright 可正常驱动 subprocess。
- 会话按令牌主体隔离:首次 open 时为**该用户**懒加载启动一只 headless Chromium,
  同一用户的 snapshot/click/type/screenshot 复用他自己的 Page(保持浏览会话状态);
  失败不清状态(下次请求自愈重连)。**不同用户之间互不可见、互不可操作。**
  (G-258 B 组第二票改前本模块是**进程级单例** —— 六枚模块全局被全体用户共用同一只
  页面,于是 click/type 是在别人的浏览器里替别人按键,screenshot 是看别人的登录页面,
  close 关掉的是全站唯一那只浏览器。病灶账在 PROJECT_PLAN 的 G-258。)
- 关闭:POST /api/computer-use/close **只关调用人自己那只**浏览器并把该条目从会话表
  摘掉(不留"已关掉但还在表里"的半死态)。进程退出面由 `close_all_sessions()` 收口
  —— 它挂在 main.py lifespan 的 shutdown 分支(yield 之后,与 browser_hub/LspClient
  同一批清理并列),逐只关、**异常隔离**(某一只关不掉继续关其余的并写一行 error 日志,
  禁止 `except: pass`)。旧 docstring 那句"亦可复用 main.py shutdown 时统一收口"曾经
  是不成立的声称(grep 零调用点),2026-09-27 由本票把那句话变成现状。
- 资源上界(数值一律取自本服务既有的同类机制,出处写在常量注释里,**不是拍出来的**):
  · 空闲回收:超过 `_IDLE_TTL_SECONDS` 未被访问且**当前没在跑操作**的浏览器,在
    "下一个用户要新建浏览器之前"惰性回收(不起后台定时器 —— 定时器会引入泄漏与关停竞态)。
  · 并发上界:同时持有的浏览器数不超过 `_MAX_LIVE_BROWSERS`,占满时新建请求回 503
    而不是把别人的浏览器踢掉(替别人关浏览器 = 上一个票刚修掉的那一型)。
  · 被淘汰/回收的会话与"用户自己 close"**走同一份实现** `_close_page`,不存在第二套关闭路径。

认证/审计:复用项目 pass-the-request 的 `get_current_user_id` 依赖注入
(与 routers/research.py / agents.py 一致)。该身份在本模块**既是鉴权也是归属**:
会话表的键、trace 记录的 owner 字段都由它盖章,不传就等于拿别人的浏览器/trace。

端点(router prefix="/computer-use",由 main.py include_router(prefix="/api")):
  POST /api/computer-use/open        → 打开 URL
  GET  /api/computer-use/snapshot    → 当前页可交互元素快照(ref/tag/role/name/坐标/状态)
  POST /api/computer-use/click       → 按 ref / selector / x,y 点击
  POST /api/computer-use/type        → 按 ref / selector / x,y 输入文本
  GET  /api/computer-use/screenshot  → 返回 base64 PNG(视口/整页)
  POST /api/computer-use/extract-text→ 提取当前页可见文本
  POST /api/computer-use/close       → 关闭浏览器并释放进程

trace 录制/回放(2-4,H9 失败可回放):
  POST /api/computer-use/trace/start     → 开启录制(后续操作自动记录为结构化 trace)
  POST /api/computer-use/trace/stop      → 结束录制,返回 trace 摘要
  GET  /api/computer-use/trace           → 列出全部 trace 摘要
  GET  /api/computer-use/trace/{id}      → 取单个 trace 详情(含全部步骤)
  DELETE /api/computer-use/trace/{id}    → 删除 trace
  POST /api/computer-use/replay          → 按序回放 trace,返回成功率与失败差异报告
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.browser_replay import PageDriver, classify_error, replay_trace
from ..services.browser_trace import browser_trace_store, new_trace_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/computer-use", tags=["computer-use"])

# ============ 按用户隔离的浏览器会话表 ============
#
# 改前这一格是六枚模块级全局(_playwright/_browser/_context/_page/_last_snapshot/
# _recording_trace_id),即**进程级单例**:全站所有人共用同一只 headless Chromium
# 页面。归属由类型系统保证不了,只能由"键"保证 —— 所以下面把六枚全局收进
# `_UserBrowser`,模块级只留一张以令牌主体 id 为键的表。
# 表本身就是归属判据:一个用户**拿不到**别人的 `_UserBrowser` 对象,因此不需要在每
# 个操作前再问一次"这是你的吗"(browser_hub 那边 session_id 由客户端任意传,才需要
# `_same_owner` 逐次过滤;这里 user_id 来自令牌,不是入参)。


class _UserBrowser:
    """单个用户的浏览器会话:锁 + Playwright 对象 + 最近快照 + 录制状态。

    `user_id` 冗余存在对象上,是为了让 `_record_step` 这类"只拿到 sess"的 helper
    也能给 trace 记录盖上归属戳(归属只能从承载层显式传,不得从被操作对象反推)。
    """

    __slots__ = (
        "browser",
        "context",
        "last_access",
        "last_snapshot",
        "lock",
        "page",
        "playwright",
        "recording_trace_id",
        "starting",
        "user_id",
    )

    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        # 每用户一把锁:懒创建时绑定当前事件循环,故不能做成模块级单例
        self.lock: asyncio.Lock = asyncio.Lock()
        # 最后一次"碰这条会话"的时刻(单调钟,不受系统改时影响)。空闲回收判据用它,
        # 而不是请求时间戳:一个用户可能几十分钟只点一次截图,那不该被当成在用。
        self.last_access: float = time.monotonic()
        # 正在懒启动浏览器(已占住一个并发名额但 page 还没落地)。上界计数与空闲回收
        # 都必须认它,否则两个首次 open 会一起通过检查、把上界顶穿。
        self.starting: bool = False
        self.playwright: Any = None
        self.browser: Any = None
        self.context: Any = None
        self.page: Any = None
        # 最近一次快照的元素(供 ref → 坐标换算,click/type 复用)
        self.last_snapshot: list[dict[str, Any]] = []
        # trace 录制状态:该用户当前活跃 trace_id(None=未录制)。
        # /trace/start 开启后,open/click/type/screenshot/extract-text 每次调用都会
        # 自动把结构化步骤追加到 browser_trace_store(带 owner=user_id),供 /replay 回放。
        self.recording_trace_id: str | None = None


_sessions: dict[str, _UserBrowser] = {}

# ============ 资源上界(数值全部取自本服务既有同类机制,不得拍脑袋)============
#
# 立因:改成按用户隔离之后,"活跃用户数 = Chromium 进程数" —— 表只有一个收缩出口
# (用户自己 POST /close),既没有并发上界也没有空闲回收,而此前无人计量。
#
# 两条判据的出处(照抄本仓既有档位,不新造数字):
# · _IDLE_TTL_SECONDS = 1800.0
#     取自 app/routers/agent_runtime.py:86 `_SESSION_TTL_SEC = 1800`(原文注释"30 分钟
#     未访问的 session 自动淘汰")。选它而不是 agent_engine 的 600/900:那两档的回收判据
#     是"超时**且进程已退出**才移除"(见 agent_engine.py:6324 `_prune_sessions`),对一只
#     活着但没人用的 Chromium 结构上不生效 —— 拿它当依据就是写一个永不回收的"回收"。
#     agent_runtime 那一档判的是"每用户一份、活着的路由层会话",与本模块同型。
# · _MAX_LIVE_BROWSERS = 8
#     取自 app/services/agent_engine.py:297 `_MAX_EXEC_SESSIONS = 8`(常驻 shell 会话表
#     的并发上界;同文件 :322 `_MAX_CODE_SESSIONS = 4`)。这是本服务对"一个功能愿意持有
#     多少只常驻子进程"给过的最大档位,取它 ⇒ 本模块不会比仓内任何已上线的同类机制更宽松。
#     刻意不"顺手收紧到 4":更小的数同样没有额外依据,却会更快把用户挡在门外。
#
# 两条都写在回归里当判据输入(tests/test_computer_use_resource_bounds.py 的出处对账),
# 出处常量若被改动/改名,那条测试必须红 ⇒ 逼重新取证,而不是让注释悄悄变成假账。
_IDLE_TTL_SECONDS: float = 1800.0
_MAX_LIVE_BROWSERS: int = 8


# 只收集这些可交互标签/角色
_SNAPSHOT_SELECTOR = (
    "button, a, input, textarea, select, "
    '[role="button"], [role="link"], [role="textbox"], [role="checkbox"], '
    '[role="radio"], [contenteditable="true"]'
)

_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-default-apps",
]


def _session_for(user_id: str) -> _UserBrowser:
    """取该用户的会话条目,不存在则建空条目(不含 Playwright 对象)。

    函数体内**没有任何 await**,而本服务跑在单个事件循环上 ⇒ 取或建对协程是原子的,
    不需要额外一把表锁。

    顺手续 `last_access`:这是"这条会话刚被人碰过"的唯一记录点。空闲回收判据读它,
    所以任何取用路径都不得绕过本函数去手搓 `_UserBrowser(...)`。
    """
    sess = _sessions.get(user_id)
    if sess is None:
        sess = _UserBrowser(user_id)
        _sessions[user_id] = sess
    sess.last_access = time.monotonic()
    return sess


async def _start_browser(sess: _UserBrowser) -> Any:
    """在会话锁内启动该用户的 Chromium(调用方负责持锁)。失败不清状态(下次自愈)。"""
    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        raise RuntimeError(
            "Playwright 未安装。请在 ai-service 目录执行: "
            "uv add playwright && uv run playwright install chromium"
        ) from e

    sess.playwright = await async_playwright().start()
    sess.browser = await sess.playwright.chromium.launch(headless=True, args=_LAUNCH_ARGS)
    sess.context = await sess.browser.new_context(
        viewport={"width": 1280, "height": 800},
        locale="zh-CN",
        timezone_id="Asia/Shanghai",
    )
    sess.page = await sess.context.new_page()
    logger.info("[computer_use] Chromium 已启动(user=%s)", sess.user_id)
    return sess.page


async def _ensure_page(user_id: str) -> Any:
    """获取**该用户**的 Page;未启动时为其懒加载一只 Chromium(受并发上界与空闲回收管)。"""
    # 3 次是"等锁期间别人替他 close 了"这一极少竞态的重试预算,不是业务重试
    for _ in range(3):
        sess = _session_for(user_id)
        async with sess.lock:
            if _sessions.get(user_id) is not sess:
                # 等锁期间该条目被 close 摘走 ⇒ 拿到的对象已成孤儿。重新取一次,
                # 绝不把浏览器起在一个不在表里的会话上(那等于泄漏一只没人能关的进程)。
                continue
            if sess.page is not None and not sess.page.is_closed():
                return sess.page
            # 上界 + 惰性回收都在这一把**该用户自己的**锁内问闸;占位(starting)在
            # 真正 launch 之前完成,所以两个用户同时首开不会一起通过计数检查。
            await _reserve_browser_slot(sess)
            try:
                return await _start_browser(sess)
            finally:
                sess.starting = False
    raise HTTPException(
        status_code=409, detail="该用户的浏览器会话正在被关闭,请重试"
    )


_NOT_OPEN_DETAIL = "浏览器未打开,请先调用 POST /api/computer-use/open"


def _require_session(user_id: str) -> _UserBrowser:
    """取该用户**已打开**的会话条目;没有则 409(错误消息与旧版逐字同形)。

    归属判据就是这一句 `_sessions.get(user_id)` —— 键取自令牌主体,不是客户端入参,
    所以别人的条目在本函数里结构上取不到,无需再比一次 owner。

    每个操作端点都经过这里,所以它同时是"该用户此刻在用"的记录点(续 last_access),
    空闲回收因此不需要在端点里逐处补一句。
    """
    sess = _sessions.get(user_id)
    if sess is None or sess.page is None or sess.page.is_closed():
        raise HTTPException(status_code=409, detail=_NOT_OPEN_DETAIL)
    sess.last_access = time.monotonic()
    return sess


def _holds_browser(sess: _UserBrowser) -> bool:
    """这条会话是否**正占着一只浏览器**(含"正在懒启动"那一格)。

    单独一个谓词是因为上界计数和空闲回收必须给同一个问题同一个答案:两处各写一遍
    判断必然漂移(本仓记过最多次的失效型),而漂移的表现是"上界看着有、实际能超"。
    """
    if sess.starting:
        return True
    if sess.page is None:
        return False
    try:
        return not sess.page.is_closed()
    except Exception as e:  # 判不出就当没占(宁可少计一个名额,绝不误挡新用户)
        logger.warning("[computer_use] is_closed() 判定失败(视为未占用): %s", e)
        return False


def _live_browser_count() -> int:
    return sum(1 for sess in _sessions.values() if _holds_browser(sess))


async def _reclaim_idle_browsers() -> int:
    """惰性空闲回收:关掉超阈且当前没在跑操作的浏览器,返回**实际关掉**的只数。

    挂点只有一个 —— "下一个用户要新建浏览器之前"(_reserve_browser_slot)。刻意
    **不起后台定时器**:定时器会在关停期与 close_all_sessions 抢同一批对象,并让
    "回收"变成一件没人能预测时机的事(本仓对惰性清理的先例同 agent_runtime 的
    _evict_if_needed)。调用方已持有自己的会话锁,而本函数**跳过所有 lock 被占的会话**,
    所以不存在"持 A 锁等 B 锁"的交叉等待。

    关闭一律走 _close_page —— 与"用户自己 POST /close"同一份实现,不得有第二套关闭路径。
    """
    now = time.monotonic()
    stale = [
        user_id
        for user_id, sess in _sessions.items()
        # 正在懒启动的那只还没跑起来,收它是净伤害;锁被占 = 有人正在操作它,按定义不空闲
        if not sess.starting
        and not sess.lock.locked()
        and sess.page is not None
        and now - sess.last_access > _IDLE_TTL_SECONDS
    ]
    reclaimed = 0
    for user_id in stale:
        try:
            await _close_page(user_id)
        except Exception as e:  # pragma: no cover - 回收是旁路,绝不因此挡住本次请求
            logger.warning("[computer_use] 空闲回收失败(user=%s,继续其余): %s", user_id, e)
            continue
        reclaimed += 1
        logger.info(
            "[computer_use] 空闲回收:关闭 user=%s 的浏览器(空闲 > %.0fs)",
            user_id,
            _IDLE_TTL_SECONDS,
        )
    return reclaimed


async def _reserve_browser_slot(sess: _UserBrowser) -> None:
    """新建浏览器之前的两道闸:先惰性回收,再判并发上界,通过即占住名额。

    "查计数 → 置 starting" 之间**没有 await**,单事件循环下这对协程是原子的(与
    _session_for 同一论证),所以不需要一把表锁就能保证上界不被两个并发首开顶穿。
    starting 的释放由调用方在 finally 里做,启动失败不留占位。
    """
    await _reclaim_idle_browsers()
    if _live_browser_count() >= _MAX_LIVE_BROWSERS:
        raise HTTPException(
            status_code=503,
            detail=(
                f"浏览器驾驶舱并发已满(同时最多 {_MAX_LIVE_BROWSERS} 只),"
                "请稍后重试或先 POST /api/computer-use/close 释放自己的那只"
            ),
        )
    sess.starting = True



def _require_page(user_id: str) -> Any:
    """同步取该用户已打开的 Page(未 open 则 409)。

    `_require_session` 的一行投影,保留是因为工单点名的 helper 契约就是按
    `_require_page(user_id)` 的形状收口的;本模块内部一律用 `_require_session`
    (click/type/screenshot 这些操作除了页面还要 `last_snapshot` 与录制状态)。
    """
    return _require_session(user_id).page


async def _close_page(user_id: str) -> None:
    """关闭**该用户自己**那只浏览器(幂等),并把条目从会话表摘掉。

    改前这里是全站唯一那只 Chromium ⇒ 任何登录用户一次 POST /close 即对所有人造成
    服务中断(跨用户 DoS)。摘表而非只清字段,是为了不留下"还在表里但已经关掉"的
    半死态 —— 那会让后续 _ensure_page 在一个已关闭的 page 上做 is_closed() 判断。
    """
    sess = _sessions.get(user_id)
    if sess is None:
        return
    async with sess.lock:
        for _obj in (sess.page, sess.context, sess.browser, sess.playwright):
            if _obj is not None:
                try:
                    await _obj.close()
                except Exception as e:  # pragma: no cover - 防御性清理
                    logger.warning("[computer_use] 关闭浏览器组件失败(忽略): %s", e)
        sess.page = sess.context = sess.browser = sess.playwright = None
        sess.last_snapshot = []
        sess.recording_trace_id = None
        # 持锁内摘除:与 _ensure_page 的"表里还是不是我"那条复查配成一对
        if _sessions.get(user_id) is sess:
            _sessions.pop(user_id, None)


async def close_all_sessions() -> dict[str, int]:
    """退出收口:逐个关闭会话表里**所有用户**的浏览器,返回 `{"closed", "failed"}`。

    由 main.py 的 lifespan shutdown 分支调用(yield 之后,与 browser_hub / LspClient
    那批清理并列)。两条不可动摇的写法:
    ① **异常隔离** —— 某一只关不掉必须继续关其余的(否则一只挂死的 Playwright 就把
       全站剩余的 Chromium 全留在进程树里,而这正是本函数存在的理由);
    ② **不吞异常** —— 失败一律 `logger.error` 点名是哪只、为什么(§5e"失败必须响"),
       禁止 `except: pass`。返回值把两个计数交给调用方,便于日志与用例断言。

    与"用户自己 close"共用 `_close_page`,所以这里不存在第二套关闭路径,也不会出现
    "退出时关掉的东西和用户关的东西语义不同"。
    """
    closed = 0
    failed = 0
    for user_id in list(_sessions.keys()):
        try:
            await _close_page(user_id)
        except Exception as e:
            failed += 1
            logger.error(
                "[computer_use] 退出收口:关闭 user=%s 的浏览器失败(继续关其余 %d 只): %s",
                user_id,
                len(_sessions),
                e,
            )
            continue
        closed += 1
    if failed:
        logger.error("[computer_use] 退出收口完成但有 %d 只没关掉(见上方逐条日志)", failed)
    else:
        logger.info("[computer_use] 退出收口:已关闭 %d 个用户会话", closed)
    return {"closed": closed, "failed": failed}


async def _take_snapshot_inner(user_id: str) -> list[dict[str, Any]]:
    """从**该用户**的页面提取可交互元素列表(带 ref 索引与中心坐标)。"""
    sess = _require_session(user_id)
    page = sess.page
    try:
        raw = await page.eval_on_selector_all(
            _SNAPSHOT_SELECTOR,
            """els => els.map(el => {
                const r = el.getBoundingClientRect();
                if (!r.width && !r.height) return null;
                const name = (el.getAttribute('aria-label')
                  || el.innerText?.trim()
                  || el.value
                  || el.placeholder
                  || el.textContent?.trim()
                  || el.getAttribute('name')
                  || '') .slice(0, 120);
                return {
                  tag: (el.tagName || '').toLowerCase(),
                  role: el.getAttribute('role') || '',
                  name,
                  x: Math.round(r.x + r.width / 2),
                  y: Math.round(r.y + r.height / 2),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                  disabled: !!el.disabled,
                  checked: el.checked === true,
                };
              }).filter(Boolean)""",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取快照失败: {e}") from e

    items: list[dict[str, Any]] = []
    for i, it in enumerate(raw or []):
        items.append(
            {
                "ref": i,
                "tag": it.get("tag"),
                "role": it.get("role"),
                "name": it.get("name") or "",
                "x": it.get("x"),
                "y": it.get("y"),
                "width": it.get("width"),
                "height": it.get("height"),
                "disabled": bool(it.get("disabled")),
                "checked": bool(it.get("checked")),
            }
        )
    sess.last_snapshot = items
    return items


def _resolve_target(
    sess: _UserBrowser,
    *,
    ref: int | None,
    selector: str | None,
    x: int | None,
    y: int | None,
) -> dict[str, Any]:
    """把 (ref | selector | x,y) 归一化为可操作的坐标字典。

    `sess` 是必传入参而不是省着读全局:ref 的取值域是**该用户最近一次快照**,
    改前它读的是全站共享的 `_last_snapshot`,于是 A 的 ref=3 会点在 B 刚快照出来的
    第 3 个元素坐标上(两个人快照的是不同页面)。

    - ref:命中该用户最近一次快照的元素,取其中点坐标
    - selector:返回 selector 标志,由调用方用 locator 处理
    - x,y:直接命中坐标
    """
    if selector:
        return {"selector": selector}
    if ref is not None:
        if not sess.last_snapshot:
            raise HTTPException(status_code=409, detail="尚无快照,请先调用 snapshot")
        for it in reversed(sess.last_snapshot):
            if it.get("ref") == ref:
                return {"x": it.get("x"), "y": it.get("y"), "ref": ref}
        raise HTTPException(status_code=404, detail=f"ref={ref} 不在最近快照中,请重新 snapshot")
    if x is not None and y is not None:
        return {"x": x, "y": y}
    raise HTTPException(status_code=422, detail="必须提供 selector / ref / x,y 三者之一")


# ============ trace 录制钩子 ============


def _record_step(
    sess: _UserBrowser,
    action: str,
    *,
    target: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    expect: dict[str, Any] | None = None,
    status: str = "ok",
    result_summary: str = "",
    error: dict[str, str] | None = None,
    duration_ms: float = 0.0,
) -> dict[str, Any] | None:
    """录制活跃时把一步操作追加到 browser_trace_store;未录制返回 None。

    owner 由 `sess.user_id`(令牌主体)显式传入 store,不来自请求体、也不从被操作的
    trace 反推。别人同名 trace_id 上的追加会被 store 拒掉(抛 ValueError ⇒ 走下面的
    旁路日志),所以这一格既不污染他人记录,也不会让主操作失败。

    记录失败只打日志不影响主操作(录制是旁路可观测,不引入新失败面)。
    """
    if sess.recording_trace_id is None:
        return None
    try:
        return browser_trace_store.append_step(
            sess.recording_trace_id,
            {
                "action": action,
                "target": target,
                "params": params,
                "expect": expect,
                "status": status,
                "result_summary": result_summary,
                "error": error,
                "duration_ms": round(duration_ms, 2),
            },
            owner_user_id=sess.user_id,
        )
    except Exception as e:
        logger.warning("[computer_use] trace 步骤记录失败(忽略): %s", e)
        return None


# ============ 数据模型 ============


class OpenRequest(BaseModel):
    url: str = Field(..., min_length=1, description="要打开的 URL")
    timeout_ms: int = Field(15000, ge=1000, le=60000, description="页面加载超时 ms")


class ClickRequest(BaseModel):
    selector: str | None = Field(None, description="CSS 选择器(优先)")
    ref: int | None = Field(None, description="最近一次快照中的元素 ref")
    x: int | None = Field(None, description="点击中心 x")
    y: int | None = Field(None, description="点击中心 y")


class TypeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="要输入的文本")
    selector: str | None = Field(None, description="CSS 选择器(优先)")
    ref: int | None = Field(None, description="最近一次快照中的元素 ref")
    x: int | None = Field(None, description="点击中心 x")
    y: int | None = Field(None, description="点击中心 y")
    clear: bool = Field(False, description="输入前是否清空原有内容")


# ============ 端点 ============


@router.post("/open")
async def computer_use_open(
    body: OpenRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """打开指定 URL(在**调用人自己**的浏览器里),返回最终 url + title。"""
    page = await _ensure_page(user_id)
    sess = _require_session(user_id)
    started = time.monotonic()
    try:
        await page.goto(body.url, timeout=body.timeout_ms, wait_until="domcontentloaded")
        title = (await page.title()) or ""
        _record_step(
            sess,
            "navigate",
            params={"url": body.url, "timeout_ms": body.timeout_ms},
            result_summary=f"url={page.url} title={title}",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"url": page.url, "title": title, "status": "opened"}
    except Exception as e:
        _record_step(
            sess,
            "navigate",
            params={"url": body.url, "timeout_ms": body.timeout_ms},
            status="error",
            error={"kind": "navigation_error", "message": f"{type(e).__name__}: {str(e)[:300]}"},
            duration_ms=(time.monotonic() - started) * 1000,
        )
        raise HTTPException(
            status_code=502,
            detail=f"打开页面失败: {type(e).__name__}: {str(e)[:300]}",
        ) from e


@router.get("/snapshot")
async def computer_use_snapshot(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """返回**调用人自己**当前页可交互元素快照(ref/tag/role/name/坐标/状态)。"""
    # 身份既是鉴权也是归属:未 open 时内部 _require_session 报 409,
    # 而别人那只浏览器的页面在本函数里根本没有取到的路径。
    items = await _take_snapshot_inner(user_id)
    sess = _sessions.get(user_id)
    page = sess.page if sess is not None else None
    current_url = page.url if (page is not None and not page.is_closed()) else ""
    return {"url": current_url, "count": len(items), "elements": items}


@router.post("/click")
async def computer_use_click(
    body: ClickRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """在**调用人自己**的页面上点击请求目标(ref / selector / x,y)。"""
    sess = _require_session(user_id)
    page = sess.page
    t = _resolve_target(sess, ref=body.ref, selector=body.selector, x=body.x, y=body.y)
    started = time.monotonic()
    try:
        if "selector" in t:
            await page.click(t["selector"])
        else:
            await page.mouse.click(int(t["x"]), int(t["y"]))
        _record_step(
            sess,
            "click",
            target=t,
            result_summary=f"clicked {t}",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"ok": True, "target": t}
    except Exception as e:
        _record_step(
            sess,
            "click",
            target=t,
            status="error",
            error=classify_error(e, "click"),
            duration_ms=(time.monotonic() - started) * 1000,
        )
        raise HTTPException(
            status_code=500, detail=f"点击失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/type")
async def computer_use_type(
    body: TypeRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """向**调用人自己**页面的请求目标输入文本(ref / selector / x,y,可选清空)。

    改前这里是"替别人输密码":文本进的是全站共用那只页面上别人聚焦的输入框。
    """
    sess = _require_session(user_id)
    page = sess.page
    t = _resolve_target(sess, ref=body.ref, selector=body.selector, x=body.x, y=body.y)
    started = time.monotonic()
    try:
        if "selector" in t:
            loc = page.locator(t["selector"]).first
            await loc.click()
            if body.clear:
                await loc.fill("")
            await loc.type(body.text, delay=10)
        else:
            await page.mouse.click(int(t["x"]), int(t["y"]))
            if body.clear:
                await page.keyboard.press("Control+A")
            await page.keyboard.type(body.text, delay=10)
        _record_step(
            sess,
            "type",
            target=t,
            params={"text": body.text, "clear": body.clear},
            result_summary=f"typed {len(body.text)} chars into {t}",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"ok": True, "target": t, "length": len(body.text)}
    except Exception as e:
        _record_step(
            sess,
            "type",
            target=t,
            params={"text": body.text, "clear": body.clear},
            status="error",
            error=classify_error(e, "type"),
            duration_ms=(time.monotonic() - started) * 1000,
        )
        raise HTTPException(
            status_code=500, detail=f"输入失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.get("/screenshot")
async def computer_use_screenshot(
    full_page: bool = False,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """返回**调用人自己**当前页截图 base64 PNG(默认视口,full_page=true 整页)。

    改前这里截的是全站共用那只页面 ⇒ 任何人一次 GET 就能看到别人登录后的页面内容。
    """
    sess = _require_session(user_id)
    page = sess.page
    started = time.monotonic()
    try:
        data = await page.screenshot(full_page=full_page, type="png")
        viewport = await page.viewport_size()
        step = _record_step(
            sess,
            "screenshot",
            params={"full_page": full_page},
            result_summary=f"png {len(data)}B",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        # step 非 None 已经隐含"这条 trace 归我"(append 被 store 的归属过滤拒掉时返回
        # None ⇒ 走不到这里),attach 再带一次 owner 只是不让这条蕴含关系承重。
        if step is not None and sess.recording_trace_id is not None:
            browser_trace_store.attach_screenshot(
                sess.recording_trace_id, step["step_index"], data, owner_user_id=user_id
            )
        return {
            "screenshot": base64.b64encode(data).decode("ascii"),
            "full_page": full_page,
            "width": (viewport or {}).get("width"),
            "height": (viewport or {}).get("height"),
        }
    except Exception as e:
        _record_step(
            sess,
            "screenshot",
            params={"full_page": full_page},
            status="error",
            error={"kind": "exception", "message": f"{type(e).__name__}: {str(e)[:300]}"},
            duration_ms=(time.monotonic() - started) * 1000,
        )
        raise HTTPException(
            status_code=500, detail=f"截图失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/extract-text")
async def computer_use_extract_text(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """提取**调用人自己**当前页可见文本(HTML 换行归一化)。"""
    sess = _require_session(user_id)
    page = sess.page
    started = time.monotonic()
    try:
        text = await page.evaluate(
            "() => document.body ? document.body.innerText : ''"
        )
        text = "\n".join(line.strip() for line in (text or "").splitlines() if line.strip())
        _record_step(
            sess,
            "extract_text",
            result_summary=text[:200],
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"url": page.url, "length": len(text), "text": text[:50000]}
    except Exception as e:
        _record_step(
            sess,
            "extract_text",
            status="error",
            error={"kind": "exception", "message": f"{type(e).__name__}: {str(e)[:300]}"},
            duration_ms=(time.monotonic() - started) * 1000,
        )
        raise HTTPException(
            status_code=500, detail=f"提取文本失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/close")
async def computer_use_close(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """关闭**调用人自己**那只浏览器并释放其 Chromium 进程(幂等)。

    改前它是"关掉全站唯一那只浏览器"—— 一个普通登录用户即可对所有人造成服务中断。
    响应形状逐字未变(`{ok, status}`),"别人的浏览器还在跑"不是错误,故不新增字段。
    """
    await _close_page(user_id)
    return {"ok": True, "status": "closed"}


# ============ trace 录制 / 回放端点(2-4,H9 失败可回放)============


class TraceStartRequest(BaseModel):
    trace_id: str | None = Field(
        None, description="指定 trace_id(缺省自动生成);已有同名 trace 则续录"
    )


class ReplayRequest(BaseModel):
    trace_id: str = Field(..., min_length=1, description="要回放的 trace_id")
    stop_on_error: bool = Field(True, description="失败步骤是否立即中止回放")
    save_failure_screenshot: bool = Field(
        True, description="失败步骤是否落盘截图(供失败取证)"
    )


@router.post("/trace/start")
async def computer_use_trace_start(
    body: TraceStartRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """开启 trace 录制:此后 open/click/type/screenshot/extract-text 自动记步。

    录制状态是**每个会话一份**(改前是模块级 `_recording_trace_id`,于是 A 一开录制,
    B 的每次操作都会被记进 A 的 trace,而 B 自己的 trace 里混进陌生步骤)。
    `trace_id` 仍可客户端自指定,但"是否续录"只看**归属过滤后**能不能读到它:别人的
    同名 trace 在这里与"不存在"逐字同形(`resumed: False`),而后续对该 trace_id 的
    追加会被 store 按 owner 拒掉 ⇒ 既读不到、也写不进。
    """
    sess = _session_for(user_id)
    trace_id = body.trace_id or new_trace_id()
    existing = browser_trace_store.get_trace(trace_id, owner_user_id=user_id)
    sess.recording_trace_id = trace_id
    return {
        "trace_id": trace_id,
        "status": "recording",
        "resumed": existing is not None,
        "step_count": len(existing["steps"]) if existing else 0,
    }


@router.post("/trace/stop")
async def computer_use_trace_stop(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """结束**本会话**的录制,返回该 trace 摘要。未在录制时返回 idle。"""
    sess = _sessions.get(user_id)
    if sess is None or sess.recording_trace_id is None:
        return {"trace_id": None, "status": "idle", "step_count": 0}
    trace_id = sess.recording_trace_id
    sess.recording_trace_id = None
    trace = browser_trace_store.get_trace(trace_id, owner_user_id=user_id)
    steps = trace["steps"] if trace else []
    ok = sum(1 for s in steps if s.get("status") == "ok")
    return {
        "trace_id": trace_id,
        "status": "stopped",
        "step_count": len(steps),
        "ok_count": ok,
        "error_count": len(steps) - ok,
    }


@router.get("/trace")
async def computer_use_trace_list(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """列出**属于调用人**的 trace 摘要(新的在前)。

    `count` 与 `traces` 必须同源过滤 —— 只过滤列表而计数走全量,这个端点就还是
    "探测全站有多少条别人的 trace"。
    """
    items = browser_trace_store.list_traces(owner_user_id=user_id)
    return {"count": len(items), "traces": items}


@router.get("/trace/{trace_id}")
async def computer_use_trace_detail(
    trace_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """取单个 trace 详情(含全部步骤与断言);别人的 trace 与"不存在"同码同形。"""
    trace = browser_trace_store.get_trace(trace_id, owner_user_id=user_id)
    if trace is None:
        raise HTTPException(status_code=404, detail=f"trace 不存在: {trace_id}")
    return trace


@router.delete("/trace/{trace_id}")
async def computer_use_trace_delete(
    trace_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """删除 trace(幂等);别人的 trace 删不掉且与"不存在"同形(`ok: False`)。"""
    ok = browser_trace_store.delete_trace(trace_id, owner_user_id=user_id)
    return {"ok": ok, "trace_id": trace_id}


@router.post("/replay")
async def computer_use_replay(
    body: ReplayRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """按序回放 trace:navigate/click/type 真实驱动,失败步骤记录差异+截图。

    两道归属一起收:① trace 必须是**调用人自己的**(别人的 ⇒ 与不存在同形 404,否则
    这个端点就是"在别人页面上按别人录过的步骤真实执行操作"——步骤里含点过什么、
    输过什么);② 回放跑的是**调用人自己**那只浏览器(`_ensure_page(user_id)`),
    改前它跑在全站共用的那一只页面上。
    """
    trace = browser_trace_store.get_trace(body.trace_id, owner_user_id=user_id)
    if trace is None:
        raise HTTPException(status_code=404, detail=f"trace 不存在: {body.trace_id}")
    if not trace["steps"]:
        raise HTTPException(status_code=409, detail="trace 无步骤,无法回放")

    page = await _ensure_page(user_id)
    driver = PageDriver(page)

    async def _failure_screenshot(step_index: int) -> str | None:
        if not body.save_failure_screenshot:
            return None
        data = await driver.screenshot_bytes()
        if data is None:
            return None
        return browser_trace_store.save_trace_file(
            body.trace_id, f"replay_step_{step_index:03d}_fail.png", data
        )

    report = await replay_trace(
        trace["steps"],
        driver,
        stop_on_error=body.stop_on_error,
        on_step_failure=_failure_screenshot,
    )
    report["trace_id"] = body.trace_id
    return report


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
