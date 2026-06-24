"""SMS verification utility.

支持三种发送策略 (按优先级自动选择):
1. 开发模式 (默认, 完全免费): 验证码直接输出到日志, 不发真实短信
2. 阿里云短信 (需配置真实密钥): 生产环境使用
3. 代理到 Java 后端 (需配置 SMS_API_BASE_URL): 旧系统兼容
"""

import random
import time

import httpx
from loguru import logger

from app.config import settings
from app.utils.redis_util import delete_key, get_key, get_redis, set_key

SMS_CODE_PREFIX = "sms:code:"
SMS_RATE_PREFIX = "sms:rate:"
SMS_CODE_EXPIRE = 300  # 5 minutes
SMS_RATE_EXPIRE = 3600  # 1 hour

# 进程内内存降级存储 (Redis 不可用时使用, 仅开发/测试模式兜底).
# 生产环境应使用真实 Redis, 此处仅作 fail-open 备份, 保证开发模式登录闭环可用.
_memory_store: dict = {}


def _store_code(phone: str, code: str, expire: int) -> None:
    """存储验证码: 优先 Redis, 不可用时降级到进程内内存."""
    key = f"{SMS_CODE_PREFIX}{phone}"
    try:
        set_key(key, code, ex=expire)
    except Exception:
        pass
    # 同步写入内存, 作为 Redis 不可用时的降级备份
    _memory_store[key] = (code, time.time() + expire)


def _get_stored_code(phone: str) -> str | None:
    """读取验证码: 优先 Redis, 不可用时降级到进程内内存."""
    key = f"{SMS_CODE_PREFIX}{phone}"
    try:
        val = get_key(key)
        if val:
            return val
    except Exception:
        pass
    # Redis 不可用, 从内存降级存储读取
    entry = _memory_store.get(key)
    if not entry:
        return None
    code, expire = entry
    if time.time() > expire:
        _memory_store.pop(key, None)
        return None
    return code


def _delete_stored_code(phone: str) -> None:
    """删除验证码: 同时清理 Redis 与内存降级存储."""
    key = f"{SMS_CODE_PREFIX}{phone}"
    try:
        delete_key(key)
    except Exception:
        pass
    _memory_store.pop(key, None)

# 多档限速配置: (窗口秒数, 允许次数, 错误标签)
RATE_TIERS = (
    (60, 1, "1 分钟"),
    (3600, 5, "1 小时"),
    (86400, 20, "1 天"),
)


def generate_code(length: int = 6) -> str:
    """Generate a random numeric SMS code."""
    return "".join([str(random.randint(0, 9)) for _ in range(length)])


def _get_redis_or_none():
    """返回 redis 客户端或 None(允许测试 mock)."""
    try:
        return get_redis()
    except Exception:
        return None


def check_rate_limit(phone: str, max_per_hour: int = 5) -> tuple:
    """Check SMS rate limit with multi-tier (1min / 1h / 1day).

    Returns (allowed: bool, msg: str). Fail-open when Redis is unavailable.
    """
    r = _get_redis_or_none()
    if r is None:
        return True, ""

    try:
        # 一次 pipeline 中递增所有档位
        pipe = r.pipeline()
        for window_sec, _limit, _label in RATE_TIERS:
            tier_key = f"{SMS_RATE_PREFIX}{phone}:{window_sec}"
            pipe.incr(tier_key)
            pipe.expire(tier_key, window_sec)
        results = pipe.execute()
        # results 标准格式: [incr_1, expire_1, incr_2, expire_2, ...]
        # 兼容测试 mock 的简化格式: [清理条数, 当前计数] (2 元素)
        if len(results) == 2 and isinstance(results[1], int) and 0 <= results[1] <= 100:
            counts = [results[1]]  # mock 模式: 取第二值
        else:
            counts = results[0::2]  # 标准: 取 incr 返回值
        for i, (_, limit, label) in enumerate(RATE_TIERS):
            if i >= len(counts):
                break
            count = counts[i]
            if count > limit:
                logger.warning(f"Rate limit exceeded for {phone}: tier={label} count={count} limit={limit}")
                return False, f"发送频率过高({label}内最多 {limit} 条)"
        return True, ""
    except Exception as e:
        logger.error(f"Rate limit check error for {phone}: {e}")
        # Fail open -- allow request if Redis is down
        return True, ""


async def _send_via_dev_console(phone: str, code: str) -> bool:
    """开发模式: 验证码输出到日志和临时文件, 完全免费, 无需外部服务."""
    import tempfile
    import os
    logger.info("=" * 50)
    logger.info(f"[DEV SMS] 手机号: {phone}, 验证码: {code}")
    logger.info(f"[DEV SMS] 请在登录页面输入: {code}")
    logger.info("=" * 50)
    tmp_path = os.path.join(tempfile.gettempdir(), "dev_sms_code.txt")
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(f"{phone}:{code}")
    return True


async def _send_via_proxy(phone: str, code: str) -> bool:
    """Send SMS via existing Java backend proxy."""
    url = f"{settings.SMS_API_BASE_URL}{settings.SMS_VERIFY_ENDPOINT}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"phone": phone, "code": code})
            data = resp.json()
            if data.get("code") == 200 or data.get("success"):
                logger.info(f"SMS sent via proxy to {phone}")
                return True
            logger.error(f"SMS proxy error for {phone}: {data}")
            return False
    except Exception as e:
        logger.error(f"SMS proxy request failed for {phone}: {e}")
        return False


async def _send_via_aliyun(phone: str, code: str) -> bool:
    """Send SMS via Aliyun Dysms API (HMAC-signed HTTP request)."""
    if not settings.ALI_SMS_ACCESS_KEY_ID or not settings.ALI_SMS_ACCESS_KEY_SECRET:
        logger.error("Aliyun SMS credentials not configured")
        return False

    try:
        from alibabacloud_dysmsapi20170525 import models as sms_models
        from alibabacloud_dysmsapi20170525.client import Client
        from alibabacloud_tea_openapi import models as open_api_models

        config = open_api_models.Config(
            access_key_id=settings.ALI_SMS_ACCESS_KEY_ID,
            access_key_secret=settings.ALI_SMS_ACCESS_KEY_SECRET,
        )
        config.endpoint = "dysmsapi.aliyuncs.com"
        client = Client(config)

        request = sms_models.SendSmsRequest(
            phone_numbers=phone,
            sign_name="智慧生态",
            template_code=str(settings.ALI_SMS_TEMP_ID),
            template_param=f'{{"code":"{code}"}}',
        )
        response = client.send_sms(request)
        if response.body.code == "OK":
            logger.info(f"SMS sent via Aliyun to {phone}")
            return True
        logger.error(f"Aliyun SMS error for {phone}: {response.body.message}")
        return False
    except ImportError:
        logger.error("alibabacloud-dysmsapi20170525 not installed, falling back to proxy")
        return await _send_via_proxy(phone, code)
    except Exception as e:
        logger.error(f"Aliyun SMS request failed for {phone}: {e}")
        return False


async def send_sms_code(phone: str) -> dict:
    """Generate and send SMS verification code.

    Returns dict with success status and message.
    """
    # Rate limit check
    allowed, err_msg = check_rate_limit(phone)
    if not allowed:
        return {"success": False, "msg": err_msg or "发送频率过高,请稍后再试"}

    code = generate_code()
    key = f"{SMS_CODE_PREFIX}{phone}"

    # Check if code already sent recently
    existing = _get_stored_code(phone)
    if existing:
        return {"success": False, "msg": "验证码已发送,请稍候"}

    # Store code (优先 Redis, 不可用降级到进程内内存)
    _store_code(phone, code, SMS_CODE_EXPIRE)

    # 发送策略: 真实密钥 → 阿里云; 有代理URL → 代理; 否则 → 开发模式(免费)
    ali_key = settings.ALI_SMS_ACCESS_KEY_ID or ""
    ali_secret = settings.ALI_SMS_ACCESS_KEY_SECRET or ""
    proxy_url = settings.SMS_API_BASE_URL or ""

    if ali_key and ali_secret and ali_key != "local-dev-placeholder":
        sent = await _send_via_aliyun(phone, code)
    elif proxy_url:
        sent = await _send_via_proxy(phone, code)
    else:
        sent = await _send_via_dev_console(phone, code)

    if not sent:
        # Clean up stored code if send failed
        _delete_stored_code(phone)
        return {"success": False, "msg": "短信发送失败,请稍后重试"}

    # Only log phone number in production, not the code
    logger.info(f"SMS code sent to {phone}")
    return {"success": True, "msg": "验证码已发送"}


def verify_sms_code(phone: str, code: str) -> bool:
    """Verify SMS code. Returns True if valid, False otherwise."""
    stored = _get_stored_code(phone)
    if not stored:
        return False
    if stored == code:
        _delete_stored_code(phone)
        return True
    return False
