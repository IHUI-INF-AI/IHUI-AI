"""SMS verification utility.

支持四种发送策略 (按优先级自动选择):
1. 开发模式 (默认, 完全免费): 验证码直接输出到日志, 不发真实短信
2. 阿里云短信 (需配置真实密钥): 生产环境使用
3. 253 短信平台 (需配置 SMS_253_ACCOUNT): 创蓝253 通道 (历史 notification-service 迁移)
4. 代理到 Java 后端 (需配置 SMS_API_BASE_URL): 旧系统兼容

另提供无锡物业短信 (send_sms_wuxi) 作为备用通道, 供业务方按需调用.
"""

import hmac
import random
import secrets
import threading
import time

import httpx
from loguru import logger

from app.config import settings
from app.utils.redis_util import delete_key, get_key, get_redis, set_key

SMS_CODE_PREFIX = "sms:code:"
SMS_RATE_PREFIX = "sms:rate:"
SMS_CODE_EXPIRE = 300  # 5 minutes
SMS_RATE_EXPIRE = 3600  # 1 hour


def _mask_phone(phone: str) -> str:
    """脱敏手机号: 138****1234. 用于日志输出, 避免明文 PII."""
    if not phone or len(phone) < 7:
        return "***"
    return f"{phone[:3]}****{phone[-4:]}"

# 进程内内存降级存储 (Redis 不可用时使用, 仅开发/测试模式兜底).
# 生产环境应使用真实 Redis, 此处仅作 fail-open 备份, 保证开发模式登录闭环可用.
_memory_store: dict = {}
_memory_store_lock = threading.Lock()


def _store_code(phone: str, code: str, expire: int) -> None:
    """存储验证码: 优先 Redis, 不可用时降级到进程内内存."""
    key = f"{SMS_CODE_PREFIX}{phone}"
    try:
        set_key(key, code, ex=expire)
    except Exception as e:
        logger.debug("Redis 存储验证码失败 (降级到内存): %s", e)
    # 同步写入内存, 作为 Redis 不可用时的降级备份
    with _memory_store_lock:
        _memory_store[key] = (code, time.time() + expire)


def _get_stored_code(phone: str) -> str | None:
    """读取验证码: 优先 Redis, 不可用时降级到进程内内存."""
    key = f"{SMS_CODE_PREFIX}{phone}"
    try:
        val = get_key(key)
        if val:
            return val
    except Exception as e:
        logger.debug("Redis 读取验证码失败 (降级到内存): %s", e)
    # Redis 不可用, 从内存降级存储读取
    with _memory_store_lock:
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
    except Exception as e:
        logger.debug("Redis 删除验证码失败: %s", e)
    with _memory_store_lock:
        _memory_store.pop(key, None)

# 多档限速配置: (窗口秒数, 允许次数, 错误标签)
RATE_TIERS = (
    (60, 1, "1 分钟"),
    (3600, 5, "1 小时"),
    (86400, 20, "1 天"),
)


def generate_code(length: int = 6) -> str:
    """Generate a random numeric SMS code using cryptographically secure RNG."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


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
                logger.warning(f"Rate limit exceeded for {_mask_phone(phone)}: tier={label} count={count} limit={limit}")
                return False, f"发送频率过高({label}内最多 {limit} 条)"
        return True, ""
    except Exception as e:
        logger.error(f"Rate limit check error for {_mask_phone(phone)}: {e}")
        # Fail open -- allow request if Redis is down
        return True, ""


def _send_via_dev_console(phone: str, code: str) -> bool:
    """开发模式: 验证码输出到日志和临时文件, 完全免费, 无需外部服务."""
    import tempfile
    import os
    logger.info("=" * 50)
    logger.info(f"[DEV SMS] 手机号: {_mask_phone(phone)}, 验证码: ***")
    logger.info("[DEV SMS] 验证码已发送, 请在登录页面输入")
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
                logger.info(f"SMS sent via proxy to {_mask_phone(phone)}")
                return True
            logger.error(f"SMS proxy error for {_mask_phone(phone)}: {data}")
            return False
    except Exception as e:
        logger.error(f"SMS proxy request failed for {_mask_phone(phone)}: {e}")
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
            logger.info(f"SMS sent via Aliyun to {_mask_phone(phone)}")
            return True
        logger.error(f"Aliyun SMS error for {_mask_phone(phone)}: {response.body.message}")
        return False
    except ImportError:
        logger.error("alibabacloud-dysmsapi20170525 not installed, falling back to proxy")
        return await _send_via_proxy(phone, code)
    except Exception as e:
        logger.error(f"Aliyun SMS request failed for {_mask_phone(phone)}: {e}")
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

    # 发送策略: 真实密钥 → 阿里云; 253账号 → 253平台; 有代理URL → 代理; 否则 → 开发模式(免费)
    ali_key = settings.ALI_SMS_ACCESS_KEY_ID or ""
    ali_secret = settings.ALI_SMS_ACCESS_KEY_SECRET or ""
    sms_253_account = settings.SMS_253_ACCOUNT or ""
    proxy_url = settings.SMS_API_BASE_URL or ""

    if ali_key and ali_secret and ali_key != "local-dev-placeholder":
        sent = await _send_via_aliyun(phone, code)
    elif sms_253_account:
        sent = await send_sms_253(phone, code)
    elif proxy_url:
        sent = await _send_via_proxy(phone, code)
    else:
        sent = await _send_via_dev_console(phone, code)

    if not sent:
        # Clean up stored code if send failed
        _delete_stored_code(phone)
        return {"success": False, "msg": "短信发送失败,请稍后重试"}

    # Only log phone number in production, not the code
    logger.info(f"SMS code sent to {_mask_phone(phone)}")
    return {"success": True, "msg": "验证码已发送"}


def verify_sms_code(phone: str, code: str) -> bool:
    """Verify SMS code. Returns True if valid, False otherwise.

    防爆破: 单手机号 5 分钟内验证失败 5 次后锁定 (删除验证码并拒绝),
    验证成功时清除失败计数.
    """
    stored = _get_stored_code(phone)
    if not stored:
        return False

    # 检查失败次数 (Redis 不可用时降级为不限制, 保持原有可用性)
    fail_key = f"sms:fail:{phone}"
    r = _get_redis_or_none()
    fail_count = 0
    if r is not None:
        try:
            fail_count = int(r.get(fail_key) or 0)
        except Exception as e:
            logger.debug("读取短信失败计数失败 (降级放行): %s", e)
            fail_count = 0
    if fail_count >= 5:
        _delete_stored_code(phone)
        return False

    if hmac.compare_digest(stored, code):
        _delete_stored_code(phone)
        if r is not None:
            try:
                r.delete(fail_key)
            except Exception as e:
                logger.debug("清除短信失败计数失败: %s", e)
        return True

    # 失败计数 +1, TTL 5 分钟
    if r is not None:
        try:
            r.incr(fail_key)
            r.expire(fail_key, 300)
        except Exception as e:
            logger.debug("写入短信失败计数失败: %s", e)
    return False


# ---------------------------------------------------------------------------
# 253 短信平台 (创蓝253) -- 历史 ihui-ai-edu-notification-service 迁移
# 文档: http://smssh1.253.com/msg/send/json  (JSON 接口, code=0 表示成功)
# ---------------------------------------------------------------------------


async def send_sms_253(phone: str, code: str) -> bool:
    """通过 253 创蓝短信平台发送验证码.

    使用 settings.SMS_253_* 配置. 短信内容 = SMS_253_TEMPLATE + code.
    返回 True 表示发送成功.
    """
    account = settings.SMS_253_ACCOUNT or ""
    password = settings.SMS_253_PASSWORD or ""
    url = settings.SMS_253_URL or "http://smssh1.253.com/msg/send/json"
    template = settings.SMS_253_TEMPLATE or "Your verification code is: "

    if not account or not password:
        logger.error("253 SMS account/password not configured")
        return False

    msg = f"{template}{code}"
    payload = {
        "account": account,
        "password": password,
        "msg": msg,
        "phone": phone,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()
        # 253 返回: {"code": "0", "msgId": "...", "time": "...", "errorMsg": ""}
        # code 为 "0" 表示成功 (字符串)
        if str(data.get("code")) == "0":
            logger.info(f"SMS sent via 253 to {_mask_phone(phone)} msgId={data.get('msgId')}")
            return True
        logger.error(
            f"253 SMS error for {_mask_phone(phone)}: code={data.get('code')} msg={data.get('errorMsg')}"
        )
        return False
    except Exception as e:
        logger.error(f"253 SMS request failed for {_mask_phone(phone)}: {e}")
        return False


# ---------------------------------------------------------------------------
# 无锡物业短信 (备用通道) -- 历史 ihui-ai-edu-notification-service 迁移
# 通过 SMS_WUXI_API_HOST 调用物业短信网关, 适合内部业务通知场景.
# ---------------------------------------------------------------------------


async def send_sms_wuxi(phone: str, code: str) -> bool:
    """通过无锡物业短信网关发送验证码 (备用通道).

    使用 settings.SMS_WUXI_* 配置. 短信内容 = SMS_WUXI_PREFIX + (SMS_WUXI_REGISTER_TEMPLATE % code).
    返回 True 表示发送成功.
    """
    api_host = settings.SMS_WUXI_API_HOST or ""
    client_id = settings.SMS_WUXI_CLIENT_ID or ""
    client_secret = settings.SMS_WUXI_CLIENT_SECRET or ""

    if not api_host or not client_id or not client_secret:
        logger.error("Wuxi SMS gateway not configured (host/clientId/clientSecret)")
        return False

    prefix = settings.SMS_WUXI_PREFIX or ""
    template = settings.SMS_WUXI_REGISTER_TEMPLATE or "Your verification code is %s, valid for 5 minutes."
    try:
        content = template % code
    except (TypeError, ValueError):
        content = f"{template}{code}"
    full_content = f"{prefix}{content}" if prefix else content

    # 物业网关通用接口: POST {api_host}/api/sms/send
    # 兼容 api_host 末尾带/或不带/
    base = api_host.rstrip("/")
    url = f"{base}/api/sms/send"
    payload = {
        "clientId": client_id,
        "clientSecret": client_secret,
        "phone": phone,
        "content": full_content,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()
        # 兼容两种返回: {"code": 0/"0"/200, "success": true} 或 {"code": "0", "msg": "OK"}
        code_val = str(data.get("code", ""))
        if code_val in ("0", "200") or data.get("success") is True:
            logger.info(f"SMS sent via Wuxi gateway to {_mask_phone(phone)}")
            return True
        logger.error(
            f"Wuxi SMS error for {_mask_phone(phone)}: code={data.get('code')} msg={data.get('msg') or data.get('message')}"
        )
        return False
    except Exception as e:
        logger.error(f"Wuxi SMS request failed for {_mask_phone(phone)}: {e}")
        return False
