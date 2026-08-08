"""Hardware Concurrency/内存伪装 — 拦截硬件信息 API,返回基于种子的固定值。

检测原理:navigator.hardwareConcurrency(CPU 核心数)、navigator.deviceMemory(内存)、
navigator.connection(网络信息)、performance.memory(JS 堆内存)是稳定设备指纹。
自动化浏览器可能返回默认值(如 hardwareConcurrency=4),与真实设备分布不符。

对抗策略:
1. 拦截 navigator.hardwareConcurrency,返回 4/6/8/12/16 之一(基于账号种子)
2. 拦截 navigator.deviceMemory,返回 4/8/16 之一(基于账号种子)
3. 拦截 navigator.connection,返回真实范围(effectiveType='4g', rtt=50, downlink=10)
4. 拦截 performance.memory,返回合理的堆内存值

所有值基于账号种子确定性生成(同账号跨会话一致,不同账号差异)。
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_hardware_guard_script(account_seed: int) -> str:
    """构建硬件信息伪装 JS 脚本。"""
    return f"""
(function() {{
  'use strict';

  // 账号专属确定性 PRNG(mulberry32)
  var _seed = {account_seed} >>> 0;
  function _rand() {{
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }}
  function _pick(arr) {{ return arr[Math.floor(_rand() * arr.length)]; }}

  // ---- 1. navigator.hardwareConcurrency ----
  // 返回 4/6/8/12/16 之一(基于种子)
  try {{
    var _cores = _pick([4, 6, 8, 12, 16]);
    Object.defineProperty(navigator, 'hardwareConcurrency', {{
      get: function() {{ return _cores; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 2. navigator.deviceMemory ----
  // 返回 4/8/16 之一(基于种子,Chrome 仅支持 0.25/0.5/1/2/4/8)
  try {{
    var _mem = _pick([4, 8, 8]);  // 8 最常见,权重更高
    Object.defineProperty(navigator, 'deviceMemory', {{
      get: function() {{ return _mem; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 3. navigator.connection ----
  // 返回真实网络范围(effectiveType='4g', rtt=50, downlink=10)
  try {{
    var _rtt = _pick([50, 75, 100]);
    var _downlink = _pick([5, 10, 15]);
    var _conn = {{
      effectiveType: '4g',
      rtt: _rtt,
      downlink: _downlink,
      saveData: false,
      type: 'wifi',
      addEventListener: function() {{}},
      removeEventListener: function() {{}},
      dispatchEvent: function() {{ return true; }},
    }};
    Object.defineProperty(navigator, 'connection', {{
      get: function() {{ return _conn; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 4. performance.memory ----
  // 返回合理的 JS 堆内存值(Chrome 独有 API)
  try {{
    if (window.performance) {{
      var _usedHeap = Math.floor(20 * 1024 * 1024 + _rand() * 50 * 1024 * 1024);
      var _totalHeap = Math.floor(_usedHeap * 1.5 + _rand() * 50 * 1024 * 1024);
      var _heapLimit = Math.floor(2048 * 1024 * 1024);  // 2GB
      var _fakeMemory = {{
        usedJSHeapSize: _usedHeap,
        totalJSHeapSize: _totalHeap,
        jsHeapSizeLimit: _heapLimit,
      }};
      Object.defineProperty(performance, 'memory', {{
        get: function() {{ return _fakeMemory; }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}

  // ---- 5. navigator.maxTouchPoints ----
  // 桌面浏览器返回 0(无触摸屏)
  try {{
    Object.defineProperty(navigator, 'maxTouchPoints', {{
      get: function() {{ return 0; }},
      configurable: true,
    }});
  }} catch (e) {{}}

}})();
"""


async def inject_hardware_guard(
    context: BrowserContext, account_seed: int,
) -> None:
    """对 BrowserContext 注入硬件信息伪装脚本。

    拦截 hardwareConcurrency/deviceMemory/connection/performance.memory/maxTouchPoints,
    返回基于账号种子的固定值(同账号跨会话一致,不同账号差异)。

    Args:
        context: Playwright BrowserContext(async)
        account_seed: 账号种子(同账号固定),用于确定性硬件值生成
    """
    script = _build_hardware_guard_script(account_seed)
    await context.add_init_script(script)
    logger.debug(
        "[hardware_guard] 硬件信息伪装已注入(seed=%d,5 类拦截点)",
        account_seed,
    )


__all__ = ["inject_hardware_guard", "_build_hardware_guard_script"]
