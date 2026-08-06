"""扫码登录服务(2026-07-30 新增)。

需求:用户希望"在项目内置浏览器(WorkPanel)里扫码登录第三方平台,
自动保存 cookies 到后端账号"。

实现:
- 任务存储:P2 修复(2026-08-06)后 Redis 优先(`scan_login:task:{task_id}`,多实例共享),
  Redis 不可用时降级为进程内 dict;每个扫码任务 = {platform, user_id, status, cookies, qr_image}
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
import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from ..core.config import settings
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
    # ===== 第二批:友好 API 平台(2026-08-01 扩展)=====
    "cnblogs": {
        "name": "博客园",
        "login_url": "https://account.cnblogs.com/signin",
        "success_cookies": [".CNBlogsCookie", "CnblogsAdministrator"],
        "success_url_pattern": r"account\.cnblogs\.com/|cnblogs\.com/mvc/news.aspx",
    },
    "segmentfault": {
        "name": "思否",
        "login_url": "https://segmentfault.com/user/login",
        "success_cookies": ["PHPSESSID", "SFSSID"],
        "success_url_pattern": r"segmentfault\.com/u/",
    },
    "oschina": {
        "name": "开源中国",
        "login_url": "https://www.oschina.net/action/user/hash_login",
        "success_cookies": ["_user_token", "osc"],
        "success_url_pattern": r"oschina\.net/u/\d+|my\.oschina\.net",
    },
    "jianshu": {
        "name": "简书",
        "login_url": "https://www.jianshu.com/sign_in",
        "success_cookies": ["remember_user_token", "_jianshu_session"],
        "success_url_pattern": r"jianshu\.com/u/|jianshu\.com/writer",
    },
    # ===== 第三批:六大号平台(2026-08-01 扩展)=====
    "baijiahao": {
        "name": "百家号",
        "login_url": "https://baijiahao.baidu.com",
        "success_cookies": ["BDUSS", "STOKEN", "BAIDUID"],
        "success_url_pattern": r"baijiahao\.baidu\.com/(ucui|home)",
    },
    "qq": {
        "name": "企鹅号",
        "login_url": "https://om.qq.com/userAuth/login",
        "success_cookies": ["pgv_pvid", "RK", "ptcz", "p_skey"],
        "success_url_pattern": r"om\.qq\.com/(main|companion)",
    },
    "dayihao": {
        "name": "大鱼号",
        "login_url": "https://mp.dayu.com",
        "success_cookies": ["_tb_token_", "cookie2", "unb"],
        "success_url_pattern": r"mp\.dayu\.com/(dashboard|home)",
    },
    "netease": {
        "name": "网易号",
        "login_url": "https://mp.163.com/login.html",
        "success_cookies": ["P_INFO", "S_INFO", "NTES_CMT_USER_INFO"],
        "success_url_pattern": r"mp\.163\.com/(media|home)",
    },
    "sohu": {
        "name": "搜狐号",
        "login_url": "https://mp.sohu.com/mp/login",
        "success_cookies": ["SUV", "IPLOC", "sct", "_mp_key"],
        "success_url_pattern": r"mp\.sohu\.com/(mp4|home)",
    },
    "sina": {
        "name": "新浪看点",
        "login_url": "https://login.sina.com.cn/signup/signin.php",
        "success_cookies": ["SCF", "SUB", "SUBP", "ALF"],
        "success_url_pattern": r"login\.sina\.com\.cn/cgi|weibo\.com/u/",
    },
    # ===== 视频平台(2026-08-01 扩展)=====
    "xigua": {
        "name": "西瓜视频",
        "login_url": "https://studio.ixigua.com/login",
        "success_cookies": ["sessionid", "uid_tt", "sid_tt"],
        "success_url_pattern": r"studio\.ixigua\.com/(main|dashboard)",
    },
    "haokan": {
        "name": "好看视频",
        "login_url": "https://haokan.baidu.com",
        "success_cookies": ["BDUSS", "STOKEN", "BAIDUID"],
        "success_url_pattern": r"haokan\.baidu\.com/(u|creator)",
    },
    # ===== 第四批:SEO/GEO 高权重平台(2026-08-01 扩展)=====
    "baidu_zhidao": {
        "name": "百度知道",
        "login_url": "https://passport.baidu.com/v2/?login",
        "success_cookies": ["BDUSS", "STOKEN"],
        "success_url_pattern": r"passport\.baidu\.com/center|zhidao\.baidu\.com",
    },
    "baidu_tieba": {
        "name": "百度贴吧",
        "login_url": "https://passport.baidu.com/v2/?login",
        "success_cookies": ["BDUSS", "STOKEN", "TIEBA_USERTYPE"],
        "success_url_pattern": r"tieba\.baidu\.com/(index|home)",
    },
    "douban": {
        "name": "豆瓣",
        "login_url": "https://accounts.douban.com/passport/login",
        "success_cookies": ["dbcl2", "ck"],
        "success_url_pattern": r"accounts\.douban\.com/passport|douban\.com/mine",
    },
    "36kr": {
        "name": "36氪",
        "login_url": "https://36kr.com/signin",
        "success_cookies": ["kr_user_id", "kr_security_id"],
        "success_url_pattern": r"36kr\.com/user/|36kr\.com/newsflashes",
    },
    "huxiu": {
        "name": "虎嗅网",
        "login_url": "https://www.huxiu.com/user/login",
        "success_cookies": ["huxiu_user_token"],
        "success_url_pattern": r"huxiu\.com/user/\d+|huxiu\.com/member",
    },
    "tmtmedia": {
        "name": "钛媒体",
        "login_url": "https://www.tmtpost.com/login",
        "success_cookies": ["tmtpost_email", "user_id"],
        "success_url_pattern": r"tmtpost\.com/user/|dao\.tmtpost\.com",
    },
    "acfun": {
        "name": "AcFun",
        "login_url": "https://www.acfun.cn/login",
        "success_cookies": ["acPasstoken", "ac_username"],
        "success_url_pattern": r"acfun\.cn/u/|acfun\.cn/member",
    },
    "lofter": {
        "name": "LOFTER",
        "login_url": "https://www.lofter.com/login",
        "success_cookies": ["LOFTER_PERSISTENT"],
        "success_url_pattern": r"lofter\.com/assign|lofter\.com/home",
    },
    "zhihu_daily": {
        "name": "知乎日报",
        "login_url": "https://daily.zhihu.com/login",
        "success_cookies": ["z_c0", "d_c0"],
        "success_url_pattern": r"daily\.zhihu\.com/account",
    },
    "people": {
        "name": "人民网",
        "login_url": "https://login.peopleweb.com.cn/login",
        "success_cookies": ["JSESSIONID"],
        "success_url_pattern": r"login\.peopleweb\.com\.cn/(success|home)",
    },
    "china_news": {
        "name": "中国新闻网",
        "login_url": "https://www.chinanews.com.cn/member/login",
        "success_cookies": ["cnUserP"],
        "success_url_pattern": r"chinanews\.com\.cn/member/(center|home)",
    },
    "hupu": {
        "name": "虎扑社区",
        "login_url": "https://passport.hupu.com/iframe/login",
        "success_cookies": ["hupu_username", "hupu_uid"],
        "success_url_pattern": r"passport\.hupu\.com/iframe/loginSuccess|my\.hupu\.com",
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
    status: str = "pending"  # pending | waiting_scan | scanned | success | failed | timeout | cancelled | expired
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
        # P2 修复(2026-08-06): 新增 expired 终态
        return self.status in ("success", "failed", "timeout", "cancelled", "expired")

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
# 任务存储(Redis 优先,多实例共享;Redis 不可用时降级为进程内 dict)
# P2 修复(2026-08-06): 原 _TASKS 为进程内 dict,多实例部署下轮询打到其它实例会 404
# ---------------------------------------------------------------------------
try:
    import redis as _redis_sync
except ImportError:
    _redis_sync = None  # type: ignore[assignment]

_TERMINAL_STATUSES = ("success", "failed", "timeout", "cancelled", "expired")

_TASK_TTL_SECONDS = 5 * 60  # 完成后保留 5 分钟
_QR_VALIDITY_SECONDS = 5 * 60  # 二维码有效/轮询超时窗口(与线程内 5 分钟超时一致)
_REDIS_KEY_TTL_SECONDS = 10 * 60  # Redis key TTL:覆盖二维码有效期 + 结果保留期


class ScanTaskStore:
    """扫码任务存储。

    - Redis 模式:key=`scan_login:task:{task_id}`,value=任务 JSON(含 base64 截图),TTL=10 分钟。
      任意实例创建的任务,其它实例经同一 Redis 也能查到(解决多实例轮询 404)。
    - 内存模式:Redis 未配置 / 未安装 redis 包 / ping 失败时降级为进程内 dict(与 memory.py 同模式)。
    - 本地 dict 始终保留本实例创建任务的工作副本(含线程句柄/浏览器对象,不可序列化),
      Redis 中仅存可序列化快照。
    """

    KEY_PREFIX = "scan_login:task:"

    def __init__(self) -> None:
        self._local: dict[str, ScanTask] = {}
        self._lock = threading.Lock()
        self._redis: Any = None
        self._use_redis = bool(settings.redis_url) and _redis_sync is not None

    # -- Redis 连接 -------------------------------------------------------
    def _get_redis(self) -> Any:
        """获取同步 Redis 客户端;连接失败时降级为内存模式(与 memory.py 同模式)。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = _redis_sync.Redis.from_url(
                    settings.redis_url, decode_responses=True
                )
                self._redis.ping()
                logger.info("[scan_login] Redis 存储已启用")
            except Exception as e:
                logger.warning("[scan_login] Redis 连接失败,降级为内存模式: %s", e, exc_info=True)
                self._use_redis = False
                self._redis = None
        return self._redis

    def _key(self, task_id: str) -> str:
        return f"{self.KEY_PREFIX}{task_id}"

    # -- 本地工作副本(含线程句柄/浏览器对象,不可序列化) ---------------------
    def get_local(self, task_id: str) -> Optional[ScanTask]:
        with self._lock:
            return self._local.get(task_id)

    def put_local(self, task: ScanTask) -> None:
        with self._lock:
            self._local[task.task_id] = task

    def pop_local(self, task_id: str) -> Optional[ScanTask]:
        with self._lock:
            return self._local.pop(task_id, None)


_TASK_STORE = ScanTaskStore()


def _task_to_dict(task: ScanTask) -> dict[str, Any]:
    """把任务序列化为 JSON 可存储字典(不包含线程/浏览器等不可序列化字段)。"""
    return {
        "task_id": task.task_id,
        "user_id": task.user_id,
        "platform": task.platform,
        "status": task.status,
        "message": task.message,
        "qr_image_b64": task.qr_image_b64,
        "qr_image_updated_at": task.qr_image_updated_at,
        "cookies": dict(task.cookies),
        "all_relevant_cookies": dict(task.all_relevant_cookies),
        "account_id": task.account_id,
        "created_at": task.created_at,
        "completed_at": task.completed_at,
    }


def _task_from_dict(data: dict[str, Any]) -> ScanTask:
    """从 Redis JSON 恢复只读任务副本(无线程句柄,仅用于查询/状态展示)。"""
    return ScanTask(
        task_id=str(data.get("task_id", "")),
        user_id=str(data.get("user_id", "")),
        platform=str(data.get("platform", "")),
        status=str(data.get("status", "pending")),
        message=str(data.get("message", "")),
        qr_image_b64=str(data.get("qr_image_b64", "")),
        qr_image_updated_at=float(data.get("qr_image_updated_at", 0.0) or 0.0),
        cookies=dict(data.get("cookies") or {}),
        all_relevant_cookies=dict(data.get("all_relevant_cookies") or {}),
        account_id=data.get("account_id"),
        created_at=float(data.get("created_at", time.time()) or time.time()),
        completed_at=data.get("completed_at"),
    )


def _persist_task(task: ScanTask) -> bool:
    """把任务快照写入 Redis(带 TTL)。Redis 不可用时静默返回 False,降级内存。"""
    redis = _TASK_STORE._get_redis()
    if not redis:
        return False
    try:
        redis.set(
            _TASK_STORE._key(task.task_id),
            json.dumps(_task_to_dict(task), ensure_ascii=False),
            ex=_REDIS_KEY_TTL_SECONDS,
        )
        return True
    except Exception as e:
        logger.warning("[scan_login] 任务持久化失败,降级为内存模式: %s", e, exc_info=True)
        _TASK_STORE._use_redis = False
        _TASK_STORE._redis = None
        return False


def _cleanup_expired_tasks() -> None:
    """清理超时的已完成任务(> 5 分钟)。内存模式手动遍历;Redis 模式靠 TTL + 兜底扫描。"""
    now = time.time()
    # 本地工作副本:只清理本实例已终态且超保留期的任务(不误删运行中线程的任务)
    expired: list[str] = []
    with _TASK_STORE._lock:
        for tid, task in list(_TASK_STORE._local.items()):
            if task.is_terminal() and task.completed_at and now - task.completed_at > _TASK_TTL_SECONDS:
                expired.append(tid)
        for tid in expired:
            _TASK_STORE._local.pop(tid, None)
            logger.info(f"[scan_login] 清理过期任务 {tid}")

    # Redis 模式:P2 修复(2026-08-06) 兜底扫描 `scan_login:task:*`,删除超保留期的终态 key
    # (正常情况下 TTL 会自动过期,这里防 TTL 未设置的孤儿 key)
    redis = _TASK_STORE._get_redis()
    if redis:
        try:
            keys = redis.keys(f"{_TASK_STORE.KEY_PREFIX}*")
            for k in keys:
                raw = redis.get(k)
                if not raw:
                    continue
                try:
                    data = json.loads(raw)
                except Exception:
                    continue
                if (
                    data.get("status") in _TERMINAL_STATUSES
                    and data.get("completed_at")
                    and now - float(data["completed_at"]) > _TASK_TTL_SECONDS
                ):
                    redis.delete(k)
                    logger.info(f"[scan_login] 清理 Redis 过期任务 {k}")
        except Exception as e:
            logger.warning("[scan_login] Redis 清理任务失败: %s", e, exc_info=True)


def get_task(task_id: str) -> Optional[ScanTask]:
    """按 task_id 查询任务:优先本地工作副本,本地无则读 Redis(支持跨实例轮询)。"""
    # 本地工作副本(含线程句柄)优先
    task = _TASK_STORE.get_local(task_id)
    if task is None:
        # 跨实例:从 Redis 读取只读副本
        redis = _TASK_STORE._get_redis()
        if redis:
            try:
                raw = redis.get(_TASK_STORE._key(task_id))
            except Exception as e:
                logger.warning("[scan_login] 读取 Redis 任务失败: %s", e, exc_info=True)
                raw = None
            if raw:
                try:
                    task = _task_from_dict(json.loads(raw))
                except Exception as e:
                    logger.warning("[scan_login] 反序列化任务失败: %s", e, exc_info=True)
                    task = None
        if task is None:
            return None

    # P2 修复(2026-08-06): 超过二维码有效期且未到终态 → 一次性标记 expired,前端轮询得到明确过期状态
    if not task.is_terminal() and task.completed_at is None and time.time() - task.created_at > _QR_VALIDITY_SECONDS:
        task.status = "expired"
        task.message = "二维码已过期,请重新发起扫码登录"
        task.completed_at = time.time()
        _persist_task(task)
    return task


def list_tasks(user_id: Optional[str] = None) -> list[ScanTask]:
    """列出任务。Redis 模式扫描 `scan_login:task:*` 前缀;内存模式遍历本地 dict。"""
    redis = _TASK_STORE._get_redis()
    if redis:
        tasks: list[ScanTask] = []
        try:
            keys = redis.keys(f"{_TASK_STORE.KEY_PREFIX}*")
            for k in keys:
                raw = redis.get(k)
                if not raw:
                    continue
                try:
                    tasks.append(_task_from_dict(json.loads(raw)))
                except Exception:
                    continue
        except Exception as e:
            logger.warning("[scan_login] 列出 Redis 任务失败: %s", e, exc_info=True)
            return []
        if user_id:
            tasks = [t for t in tasks if t.user_id == user_id]
        return tasks
    with _TASK_STORE._lock:
        tasks = list(_TASK_STORE._local.values())
    if user_id:
        tasks = [t for t in tasks if t.user_id == user_id]
    return tasks


def create_task(user_id: str, platform: str) -> ScanTask:
    """创建任务:写入本地工作副本 + Redis(带 TTL)。"""
    if platform not in PLATFORM_SCAN_CONFIG:
        raise ValueError(f"不支持的平台: {platform},可用: {list(PLATFORM_SCAN_CONFIG.keys())}")
    task = ScanTask(
        task_id=str(uuid.uuid4()),
        user_id=user_id,
        platform=platform,
    )
    _TASK_STORE.put_local(task)
    _persist_task(task)
    return task


def remove_task(task_id: str) -> None:
    """删除任务:本地 + Redis 同时清理,并触发线程停止。"""
    task = _TASK_STORE.pop_local(task_id)
    redis = _TASK_STORE._get_redis()
    if redis:
        try:
            redis.delete(_TASK_STORE._key(task_id))
        except Exception as e:
            logger.warning("[scan_login] 删除 Redis 任务失败: %s", e, exc_info=True)
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
        _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis
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
            _persist_task(task)  # P2 修复(2026-08-06): 状态变更同步到 Redis
            try:
                page.goto(config["login_url"], wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                task.status = "failed"
                task.message = f"打开登录页失败:{type(e).__name__}: {str(e)[:200]}"
                task.completed_at = time.time()
                _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis
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
            _persist_task(task)  # P2 修复(2026-08-06): 状态变更同步到 Redis

            # 4. 轮询检测登录成功
            timeout_seconds = 5 * 60  # 5 分钟超时
            start_time = time.time()
            last_screenshot_time = 0.0
            import re

            while not task._stop_event.is_set():
                # P2 修复(2026-08-06): 检测其它实例的状态变更(取消/过期),
                # 避免本线程在跨实例取消后继续运行并覆盖终态
                _redis = _TASK_STORE._get_redis()
                if _redis:
                    try:
                        _raw = _redis.get(_TASK_STORE._key(task.task_id))
                        if _raw:
                            _remote = json.loads(_raw)
                            _rs = _remote.get("status")
                            if _rs in ("cancelled", "expired"):
                                task.status = _rs
                                task.message = _remote.get("message", "") or (
                                    "用户取消" if _rs == "cancelled"
                                    else "二维码已过期,请重新发起扫码登录"
                                )
                                task.completed_at = time.time()
                                logger.info(f"[scan_login] 任务 {task.task_id} 检测到远端终态: {_rs}")
                                break
                    except Exception:
                        pass

                if time.time() - start_time > timeout_seconds:
                    task.status = "timeout"
                    task.message = f"等待超时(> {timeout_seconds}s)"
                    task.completed_at = time.time()
                    logger.warning(f"[scan_login] 任务 {task.task_id} 超时")
                    _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis
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
                        _persist_task(task)  # P2 修复(2026-08-06): 成功终态同步到 Redis
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
                        _persist_task(task)  # P2 修复(2026-08-06): 成功终态同步到 Redis
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
        _persist_task(task)  # P2 修复(2026-08-06): 终态同步到 Redis


def _update_qr_screenshot(task: ScanTask, page: Any) -> None:
    """更新任务的二维码截图(base64 PNG)。"""
    try:
        png_bytes = page.screenshot(type="png", full_page=False)
        with task._lock:
            task.qr_image_b64 = base64.b64encode(png_bytes).decode("ascii")
            task.qr_image_updated_at = time.time()
    except Exception as e:
        logger.debug(f"[scan_login] 截图失败:{e}")
        return
    # P2 修复(2026-08-06): 截图变更后同步到 Redis,保证跨实例 qr 轮询取到最新截图
    _persist_task(task)


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

    encrypted = encrypt(credentials_dict)
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
            return int(row["id"])
        new_id = await conn.fetchval(
            """INSERT INTO publish_accounts(user_id, platform, display_name, credentials_enc, status)
               VALUES($1, $2, $3, $4, 'active') RETURNING id""",
            user_id, platform, display_name, encrypted,
        )
        logger.info(f"[scan_login] 创建账号 {new_id}({platform})")
        return int(new_id)
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
    finally:
        # P2 修复(2026-08-06): account_id 更新后同步到 Redis,前端可查询到关联账号
        _persist_task(task)


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
    """取消扫码任务。跨实例同样生效:更新 Redis 终态,创建侧线程轮询检测到 cancelled 后自行退出。"""
    task = get_task(task_id)
    if not task:
        return False
    if task.is_terminal():
        return False
    # 本实例若持有工作副本(线程句柄),触发线程立即停止
    local = _TASK_STORE.get_local(task_id)
    if local is not None:
        local._stop_event.set()
    task.status = "cancelled"
    task.message = "用户取消"
    task.completed_at = time.time()
    _persist_task(task)  # P2 修复(2026-08-06): 取消终态同步到 Redis(跨实例可见)
    return True


def get_qr_image(task_id: str) -> Optional[bytes]:
    """获取二维码截图 PNG 字节(供 API 返回)。"""
    task = get_task(task_id)
    if not task or not task.qr_image_b64:
        return None
    return base64.b64decode(task.qr_image_b64)
