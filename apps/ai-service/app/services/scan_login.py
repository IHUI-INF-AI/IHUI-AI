"""扫码登录服务(2026-07-30 新增)。

需求:用户希望"在项目内置浏览器(WorkPanel)里扫码登录第三方平台,
自动保存 cookies 到后端账号"。

实现:
- 内存任务存储:每个扫码任务 = {platform, user_id, status, cookies, qr_image}
- 后台线程:启动 Playwright Chromium → 打开平台登录页 → 持续截图 → 检测登录态
- 登录态判定:cookies 出现目标字段 / URL 跳转 / 出现用户头像
- 登录成功:提取相关 cookies → 调用账号更新 API → 标记任务完成
- 截图接口:前端轮询拉取二维码截图,在 WorkPanel 弹窗中显示

设计:
- 复用 screenshot_service 的单例 sync Browser(避免重复启动)
- 任务用 UUID 管理,默认 5 分钟超时
- 完成后自动关闭 context,保留任务结果 5 分钟供前端拉取
"""
from __future__ import annotations

import asyncio
import base64
import io
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from ..core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 平台登录配置:登录 URL + 期望 cookie 字段 + 登录后跳转 URL 特征
# ---------------------------------------------------------------------------
PLATFORM_SCAN_CONFIG: dict[str, dict[str, Any]] = {
    "zhihu": {
        "name": "知乎",
        "login_url": "https://www.zhihu.com/signin",
        "success_cookies": ["z_c0"],
        "success_url_pattern": r"^https?://(www\.)?zhihu\.com/?($|#|\?)|/people/|/follow",
        "fallback_url_pattern": r"^https?://(www\.)?zhihu\.com/?$",
    },
    "bilibili": {
        "name": "B站",
        "login_url": "https://passport.bilibili.com/login",
        "success_cookies": ["SESSDATA", "DedeUserID"],
        "success_url_pattern": r"^https?://(www\.)?bilibili\.com/?($|#|\?)|bilibili\.com/index",
    },
    "xiaohongshu": {
        "name": "小红书",
        "login_url": "https://www.xiaohongshu.com/explore",
        "success_cookies": ["web_session", "webId", "a1"],
        "success_url_pattern": r"^https?://(www\.)?xiaohongshu\.com/explore",
    },
    "weibo": {
        "name": "微博",
        "login_url": "https://passport.weibo.com/sso/signin?entry=miniblog&source=miniblog&disp=popup&url=https%3A%2F%2Fweibo.com%2Fu%2F0",
        "success_cookies": ["SUB", "MLOGIN"],
        "success_url_pattern": r"weibo\.com/u/\d+",
    },
    "douyin": {
        "name": "抖音",
        "login_url": "https://www.douyin.com/",
        "success_cookies": ["sessionid", "uid_tt", "sid_tt"],
        "success_url_pattern": r"douyin\.com/$",
    },
    "kuaishou": {
        "name": "快手",
        "login_url": "https://www.kuaishou.com/",
        "success_cookies": ["userId", "kuaishou.server.web_st"],
        "success_url_pattern": r"kuaishou\.com/$",
    },
    "csdn": {
        "name": "CSDN",
        "login_url": "https://passport.csdn.net/login",
        "success_cookies": ["UserName", "UserToken", "UserSecret"],
        "success_url_pattern": r"^https?://(www\.)?csdn\.net/?($|#|\?)|blog\.csdn\.net",
    },
    "juejin": {
        "name": "掘金",
        "login_url": "https://juejin.cn/login",
        "success_cookies": ["sessionid", "signatureId"],
        "success_url_pattern": r"^https?://(www\.)?juejin\.cn/?($|#|\?)|/dashboard",
    },
    "shipinhao": {
        "name": "视频号",
        "login_url": "https://channels.weixin.qq.com/login",
        "success_cookies": ["wxuin", "wxsid", "web_login_channel"],
        "success_url_pattern": r"channels\.weixin\.qq.com/(home|creator)",
    },
}


# ---------------------------------------------------------------------------
# 任务状态
# ---------------------------------------------------------------------------
@dataclass
class ScanTask:
    task_id: str
    user_id: str
    platform: str
    status: str = "pending"  # pending | waiting_scan | scanned | success | failed | timeout | cancelled
    message: str = ""
    qr_image_b64: str = ""  # base64 PNG 截图
    qr_image_updated_at: float = 0.0
    cookies: dict[str, str] = field(default_factory=dict)
    all_relevant_cookies: dict[str, str] = field(default_factory=dict)
    account_id: Optional[int] = None  # 关联到的后端账号 id
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    _thread: Optional[threading.Thread] = field(default=None, repr=False)
    _stop_event: threading.Event = field(default_factory=threading.Event, repr=False)
    _context: Any = field(default=None, repr=False)
    _page: Any = field(default=None, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def is_terminal(self) -> bool:
        return self.status in ("success", "failed", "timeout", "cancelled")

    def snapshot(self) -> dict[str, Any]:
        """返回可序列化的状态(供 API 返回)。"""
        return {
            "task_id": self.task_id,
            "user_id": self.user_id,
            "platform": self.platform,
            "status": self.status,
            "message": self.message,
            "has_qr": bool(self.qr_image_b64),
            "qr_updated_at": self.qr_image_updated_at,
            "cookies_count": len(self.all_relevant_cookies),
            "account_id": self.account_id,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }


# ---------------------------------------------------------------------------
# 任务存储(进程内,简单实现)
# ---------------------------------------------------------------------------
_TASKS: dict[str, ScanTask] = {}
_TASKS_LOCK = threading.Lock()
_TASK_TTL_SECONDS = 5 * 60  # 完成后保留 5 分钟


def _cleanup_expired_tasks() -> None:
    """清理超时的已完成任务(> 5 分钟)。"""
    now = time.time()
    expired: list[str] = []
    with _TASKS_LOCK:
        for tid, task in _TASKS.items():
            if task.is_terminal() and task.completed_at and now - task.completed_at > _TASK_TTL_SECONDS:
                expired.append(tid)
        for tid in expired:
            del _TASKS[tid]
            logger.info(f"[scan_login] 清理过期任务 {tid}")


def get_task(task_id: str) -> Optional[ScanTask]:
    with _TASKS_LOCK:
        return _TASKS.get(task_id)


def list_tasks(user_id: Optional[str] = None) -> list[ScanTask]:
    with _TASKS_LOCK:
        tasks = list(_TASKS.values())
    if user_id:
        tasks = [t for t in tasks if t.user_id == user_id]
    return tasks


def create_task(user_id: str, platform: str) -> ScanTask:
    if platform not in PLATFORM_SCAN_CONFIG:
        raise ValueError(f"不支持的平台: {platform},可用: {list(PLATFORM_SCAN_CONFIG.keys())}")
    task = ScanTask(
        task_id=str(uuid.uuid4()),
        user_id=user_id,
        platform=platform,
    )
    with _TASKS_LOCK:
        _TASKS[task.task_id] = task
    return task


def remove_task(task_id: str) -> None:
    with _TASKS_LOCK:
        task = _TASKS.pop(task_id, None)
    if task:
        task._stop_event.set()


# ---------------------------------------------------------------------------
# Chromium 可执行文件查找(2026-07-30 立,解决 PLAYWRIGHT_BROWSERS_PATH 指向 D 盘但浏览器在 C 盘的问题)
# ---------------------------------------------------------------------------
def _find_chromium_executable() -> str | None:
    """查找可用的 Chromium 可执行文件路径。

    优先级:
    1. PLAYWRIGHT_BROWSERS_PATH 环境变量指向的路径(D 盘)
    2. Windows 默认路径(C:\\Users\\<user>\\AppData\\Local\\ms-playwright)
    3. 返回 None(让 Playwright 自己解析)
    """
    from pathlib import Path

    # 1. 检查环境变量指定的路径
    env_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if env_path:
        # chromium (完整版,支持 headless + headed)
        candidate = Path(env_path) / "chromium-1228" / "chrome-win64" / "chrome.exe"
        if candidate.exists():
            return str(candidate)
        # headless shell
        candidate = (
            Path(env_path)
            / "chromium_headless_shell-1228"
            / "chrome-headless-shell-win64"
            / "chrome-headless-shell.exe"
        )
        if candidate.exists():
            return str(candidate)

    # 2. 检查 Windows 默认路径
    home = Path.home()
    candidate = home / "AppData" / "Local" / "ms-playwright" / "chromium-1228" / "chrome-win64" / "chrome.exe"
    if candidate.exists():
        return str(candidate)

    # 3. 让 Playwright 自己找
    return None


# ---------------------------------------------------------------------------
# 后台扫码登录任务
# ---------------------------------------------------------------------------
def _run_scan_task(task: ScanTask) -> None:
    """在后台线程中执行扫码登录流程。"""
    config = PLATFORM_SCAN_CONFIG[task.platform]
    logger.info(f"[scan_login] 任务 {task.task_id} 启动: platform={task.platform}, user_id={task.user_id}")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        task.status = "failed"
        task.message = f"Playwright 未安装:{e}"
        task.completed_at = time.time()
        logger.error(f"[scan_login] Playwright 缺失:{e}")
        return

    try:
        with sync_playwright() as p:
            # 启动浏览器(2026-07-30:指定 executable_path 解决 PLAYWRIGHT_BROWSERS_PATH 指向 D 盘但浏览器在 C 盘的问题)
            chromium_path = _find_chromium_executable()
            logger.info(f"[scan_login] Chromium 路径: {chromium_path or '(Playwright 默认)'}")
            browser = p.chromium.launch(
                executable_path=chromium_path,  # None 时 Playwright 用默认解析
                headless=True,  # 后端 headless,前端通过截图看
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",  # 反检测
                ],
            )
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            task._context = context

            page = context.new_page()
            task._page = page

            # 1. 打开登录页
            task.status = "waiting_scan"
            task.message = f"正在打开 {config['name']} 登录页..."
            logger.info(f"[scan_login] 打开 {config['login_url']}")
            try:
                page.goto(config["login_url"], wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                task.status = "failed"
                task.message = f"打开登录页失败:{type(e).__name__}: {str(e)[:200]}"
                task.completed_at = time.time()
                return

            page.wait_for_timeout(3000)

            # 2. 尝试切换到扫码登录 tab
            scan_selectors = [
                'text=扫码登录',
                'text=二维码登录',
                'text=手机扫码登录',
                'text=微信扫码',
                'text=App 扫码',
                'a:has-text("扫码")',
                'a:has-text("二维码")',
                'div:has-text("扫码")',
                'div:has-text("二维码")',
                '[class*="scan"]',
                '[class*="qrcode-tab"]',
            ]
            for sel in scan_selectors:
                try:
                    el = page.locator(sel).first
                    if el.count() > 0:
                        el.click(timeout=2000)
                        page.wait_for_timeout(1500)
                        logger.info(f"[scan_login] 切换扫码: {sel}")
                        break
                except Exception:
                    pass

            page.wait_for_timeout(2000)

            # 3. 截图初始登录页(含二维码)
            _update_qr_screenshot(task, page)

            task.message = f"请用 {config['name']} App 扫描二维码"
            logger.info(f"[scan_login] 任务 {task.task_id} 进入等待扫码状态")

            # 4. 轮询检测登录成功
            timeout_seconds = 5 * 60  # 5 分钟超时
            start_time = time.time()
            last_screenshot_time = 0.0
            import re

            while not task._stop_event.is_set():
                if time.time() - start_time > timeout_seconds:
                    task.status = "timeout"
                    task.message = f"等待超时(> {timeout_seconds}s)"
                    task.completed_at = time.time()
                    logger.warning(f"[scan_login] 任务 {task.task_id} 超时")
                    break

                # 每 2 秒更新一次截图
                if time.time() - last_screenshot_time >= 2.0:
                    _update_qr_screenshot(task, page)
                    last_screenshot_time = time.time()

                # 检查 cookies
                cookies = context.cookies()
                cookies_dict = {c["name"]: c["value"] for c in cookies if c.get("value")}

                # 命中目标 cookie?
                for target in config["success_cookies"]:
                    if target in cookies_dict and len(cookies_dict[target]) > 5:
                        logger.info(f"[scan_login] 任务 {task.task_id} 检测到登录 cookie: {target}")
                        task.cookies = {k: v for k, v in cookies_dict.items() if k in config["success_cookies"]}
                        # 收集所有非 tracker 的相关 cookies
                        task.all_relevant_cookies = {
                            k: v for k, v in cookies_dict.items()
                            if not any(s in k.lower() for s in ["google", "baidu", "cnzz", "_ga", "hm.baidu"])
                        }
                        task.status = "success"
                        task.message = f"登录成功,获取到 {len(task.all_relevant_cookies)} 个 cookies"
                        task.completed_at = time.time()

                        # 截图最终状态
                        _update_qr_screenshot(task, page)

                        # 异步保存到后端账号
                        _schedule_account_save(task)
                        break

                if task.status == "success":
                    break

                # 检查 URL 跳转
                current_url = page.url
                pattern = config.get("success_url_pattern", "")
                if pattern and re.search(pattern, current_url) and "login" not in current_url.lower() and "signin" not in current_url.lower():
                    # URL 已跳转,可能已登录
                    logger.info(f"[scan_login] 任务 {task.task_id} URL 跳转: {current_url}")
                    # 再检查一次 cookies(可能还没设置)
                    if cookies_dict and any(target in cookies_dict for target in config["success_cookies"]):
                        task.cookies = {k: v for k, v in cookies_dict.items() if k in config["success_cookies"]}
                        task.all_relevant_cookies = {
                            k: v for k, v in cookies_dict.items()
                            if not any(s in k.lower() for s in ["google", "baidu", "cnzz", "_ga", "hm.baidu"])
                        }
                        task.status = "success"
                        task.message = f"登录成功(URL 跳转),获取到 {len(task.all_relevant_cookies)} 个 cookies"
                        task.completed_at = time.time()
                        _update_qr_screenshot(task, page)
                        _schedule_account_save(task)
                        break

                page.wait_for_timeout(1500)

            # 清理
            try:
                context.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass

    except Exception as e:
        logger.exception(f"[scan_login] 任务 {task.task_id} 异常")
        task.status = "failed"
        task.message = f"扫码登录异常:{type(e).__name__}: {str(e)[:200]}"
        task.completed_at = time.time()


def _update_qr_screenshot(task: ScanTask, page: Any) -> None:
    """更新任务的二维码截图(base64 PNG)。"""
    try:
        png_bytes = page.screenshot(type="png", full_page=False)
        with task._lock:
            task.qr_image_b64 = base64.b64encode(png_bytes).decode("ascii")
            task.qr_image_updated_at = time.time()
    except Exception as e:
        logger.debug(f"[scan_login] 截图失败:{e}")


def _schedule_account_save(task: ScanTask) -> None:
    """异步把扫码结果保存到后端账号(独立线程,不阻塞扫码任务)。"""
    def _save() -> None:
        try:
            asyncio.run(_save_account_async(task))
        except Exception as e:
            logger.exception(f"[scan_login] 保存账号失败:{e}")

    threading.Thread(target=_save, daemon=True).start()


async def _save_account_to_db(
    user_id: str,
    platform: str,
    credentials_dict: dict[str, str],
    platform_name: str,
) -> int:
    """加密保存账号到 DB,返回 account_id(扫码登录 + CDP 检测复用)。

    - 已存在同 user + platform → UPDATE credentials + status=active
    - 不存在 → INSERT 新账号
    """
    from ..core.db import get_db_conn
    from .publish.credentials_crypto import encrypt
    import json as _json

    credentials_json = _json.dumps(credentials_dict, ensure_ascii=False)
    encrypted = encrypt(credentials_json)
    display_name = f"{platform_name}(扫码登录 {time.strftime('%Y-%m-%d %H:%M')})"

    conn = await get_db_conn()
    try:
        row = await conn.fetchrow(
            "SELECT id FROM publish_accounts WHERE user_id=$1 AND platform=$2 ORDER BY id LIMIT 1",
            user_id, platform,
        )
        if row:
            await conn.execute(
                """UPDATE publish_accounts
                   SET credentials_enc=$1, display_name=$2, status='active', updated_at=NOW()
                   WHERE id=$3""",
                encrypted, display_name, row["id"],
            )
            logger.info(f"[scan_login] 更新账号 {row['id']}({platform})")
            return row["id"]
        new_id = await conn.fetchval(
            """INSERT INTO publish_accounts(user_id, platform, display_name, credentials_enc, status)
               VALUES($1, $2, $3, $4, 'active') RETURNING id""",
            user_id, platform, display_name, encrypted,
        )
        logger.info(f"[scan_login] 创建账号 {new_id}({platform})")
        return new_id
    finally:
        await conn.close()


async def _save_account_async(task: ScanTask) -> None:
    """把扫码结果保存到后端账号(独立线程,不阻塞扫码任务)。"""
    try:
        credentials = dict(task.all_relevant_cookies)
        credentials.update(task.cookies)
        task.account_id = await _save_account_to_db(
            task.user_id,
            task.platform,
            credentials,
            PLATFORM_SCAN_CONFIG[task.platform]["name"],
        )
    except Exception as e:
        logger.exception(f"[scan_login] 保存账号失败:{e}")


async def detect_login_from_cdp_session(
    session_id: str,
    platform: str,
    user_id: str,
) -> dict[str, Any]:
    """从 BrowserHub CDP 会话检测登录态 + 保存账号(2026-07-31 新增,CDP 扫码登录模式)。

    供前端 WorkPanel CDP 扫码登录轮询调用:
    - 前端 createBrowserSession 打开平台登录页 → 用户在 WorkPanel CDP 画面里扫码
    - 前端每 3s 调本函数 → 检测 success_cookies → 命中则加密保存到 DB
    - 返回 detected=True 时前端关闭会话 + 刷新账号列表

    Returns:
        {"detected": bool, "cookies_count": int, "account_id": int|None, "error": str|None}
    """
    if platform not in PLATFORM_SCAN_CONFIG:
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": f"不支持的平台: {platform}"}

    from .browser_hub import hub
    session = hub.get_session(session_id)
    if not session:
        return {"detected": False, "cookies_count": 0, "account_id": None,
                "error": "浏览器会话不存在或已关闭"}

    config = PLATFORM_SCAN_CONFIG[platform]
    cookies = await session.get_cookies()
    cookies_dict = {c["name"]: c["value"] for c in cookies if c.get("value")}

    # 检测 success_cookies 是否命中(值长度 > 5 视为有效)
    hit = [
        target for target in config["success_cookies"]
        if target in cookies_dict and len(cookies_dict.get(target, "")) > 5
    ]
    if not hit:
        return {"detected": False, "cookies_count": len(cookies_dict),
                "account_id": None, "error": None}

    # 命中 → 收集相关 cookies(剔除统计类)+ 保存
    all_relevant = {
        k: v for k, v in cookies_dict.items()
        if not any(s in k.lower() for s in ["google", "baidu", "cnzz", "_ga", "hm.baidu"])
    }
    try:
        account_id = await _save_account_to_db(
            user_id, platform, all_relevant, config["name"]
        )
        logger.info(
            f"[scan_login] CDP 检测成功: platform={platform}, "
            f"account_id={account_id}, cookies={len(all_relevant)}"
        )
        return {"detected": True, "cookies_count": len(all_relevant),
                "account_id": account_id, "error": None}
    except Exception as e:
        logger.exception(f"[scan_login] CDP 保存账号失败:{e}")
        return {"detected": False, "cookies_count": len(cookies_dict),
                "account_id": None, "error": f"保存账号失败: {e}"}


# ---------------------------------------------------------------------------
# 公共 API
# ---------------------------------------------------------------------------
def start_scan_task(user_id: str, platform: str) -> ScanTask:
    """启动后台扫码登录任务(立即返回 task_id)。"""
    _cleanup_expired_tasks()
    task = create_task(user_id, platform)
    thread = threading.Thread(
        target=_run_scan_task,
        args=(task,),
        daemon=True,
        name=f"scan-login-{task.task_id[:8]}",
    )
    task._thread = thread
    thread.start()
    return task


def cancel_scan_task(task_id: str) -> bool:
    """取消扫码任务。"""
    task = get_task(task_id)
    if not task:
        return False
    if task.is_terminal():
        return False
    task._stop_event.set()
    task.status = "cancelled"
    task.message = "用户取消"
    task.completed_at = time.time()
    return True


def get_qr_image(task_id: str) -> Optional[bytes]:
    """获取二维码截图 PNG 字节(供 API 返回)。"""
    task = get_task(task_id)
    if not task or not task.qr_image_b64:
        return None
    return base64.b64decode(task.qr_image_b64)
