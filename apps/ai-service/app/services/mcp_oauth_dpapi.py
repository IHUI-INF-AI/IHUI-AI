# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP OAuth 凭据的 Windows DPAPI 封装(L09 消费侧)。

为什么需要这一层:Python 服务与 `packages/auth` 的 Node 保险箱不是同一进程,
不能直接复用后者;但 RP-4 要的是「OS 保护器保护、明文零落盘」,不是某一种语言
的实现。这里用 ctypes 直连 crypt32 的 CryptProtectData/CryptUnprotectData,
零新增依赖,密文只有本机当前用户能解。

格式:`IHUI-DPAPI-V1:<base64url(DPAPI 密文)>`。带前缀是为了让读取方先判
「这份文件是不是 DPAPI 封的」,再决定走哪条解密腿 —— 不能拿"解密失败"当
"没有令牌"再覆盖写。
"""

from __future__ import annotations

import base64
import ctypes
import sys
from ctypes import wintypes

DPAPI_PREFIX = "IHUI-DPAPI-V1:"
_CRYPTPROTECT_UI_FORBIDDEN = 0x1


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_char)),
    ]


def available() -> bool:
    """当前平台是否有可用的 DPAPI(只在 Windows 且 crypt32 可加载时为真)。"""
    if sys.platform != "win32":
        return False
    try:
        return bool(ctypes.windll.crypt32)  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001 - 加载失败即视为不可用
        return False


def _call(data: bytes, *, protect: bool) -> bytes:
    if not available():
        raise OSError("DPAPI 在当前平台不可用")
    crypt32 = ctypes.windll.crypt32  # type: ignore[attr-defined]
    kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
    buf = ctypes.create_string_buffer(data, len(data))
    blob_in = _DataBlob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    blob_out = _DataBlob()
    fn = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    # 第二参(描述)传 None:不把用途写进密文,避免同一路径多服务串味。
    ok = fn(
        ctypes.byref(blob_in),
        None,
        None,
        None,
        None,
        _CRYPTPROTECT_UI_FORBIDDEN,
        ctypes.byref(blob_out),
    )
    if not ok:
        raise OSError(f"DPAPI {'加密' if protect else '解密'}失败: {ctypes.get_last_error()}")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(blob_out.pbData, ctypes.c_void_p))


def protect(data: bytes) -> bytes:
    """明文 → 只有当前用户能解的密文。"""
    return _call(data, protect=True)


def unprotect(data: bytes) -> bytes:
    """密文 → 明文;换了用户/机器会直接失败,不静默降级。"""
    return _call(data, protect=False)


def is_encoded(text: str) -> bool:
    """判断一段文本是否是本模块写出的 DPAPI 信封。"""
    return text.startswith(DPAPI_PREFIX)


def encode(data: bytes) -> str:
    """明文 → 可落盘的文本信封。"""
    return DPAPI_PREFIX + base64.urlsafe_b64encode(protect(data)).decode("ascii")


def decode(text: str) -> bytes:
    """文本信封 → 明文;非本格式抛 ValueError,由调用方决定怎么记。"""
    if not is_encoded(text):
        raise ValueError("不是 IHUI-DPAPI-V1 信封")
    return unprotect(base64.urlsafe_b64decode(text[len(DPAPI_PREFIX) :]))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
