"""多媒体设备指纹防护 — 拦截 mediaDevices API,返回固定设备列表。

检测原理:navigator.mediaDevices.enumerateDevices() 返回设备列表(摄像头/麦克风/扬声器),
设备数量和 deviceId 是稳定指纹。navigator.mediaDevices.getUserMedia 探测用户是否
授权摄像头/麦克风(真人浏览器可能拒绝,自动化浏览器可能无响应)。

对抗策略:
1. 拦截 enumerateDevices,返回固定的设备列表(基于账号种子,2 摄像头 + 3 麦克风 + 4 扬声器)
2. 拦截 getUserMedia,返回 AbortError(模拟用户拒绝授权)
3. 拦截 navigator.usb.getDevices,返回空数组

设备列表基于账号种子确定性生成(同账号跨会话一致,不同账号差异)。
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_media_devices_script(account_seed: int) -> str:
    """构建多媒体设备防护 JS 脚本。"""
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
  function _deviceId(prefix, idx) {{
    // 基于种子生成确定性 deviceId(64 位十六进制)
    var h = (_seed + idx * 0x9E3779B1) >>> 0;
    var part1 = (h ^ 0xA5A5A5A5).toString(16).padStart(8, '0');
    var part2 = (h ^ 0x5A5A5A5A).toString(16).padStart(8, '0');
    return prefix + part1 + part2 + part1 + part2;
  }}

  // 生成固定设备列表:2 摄像头 + 3 麦克风 + 4 扬声器
  var _devices = [];
  // 2 个摄像头(videoinput)
  for (var i = 0; i < 2; i++) {{
    _devices.push({{
      deviceId: _deviceId('cam' + i + '-', i),
      kind: 'videoinput',
      label: '',
      groupId: 'group-' + _seed,
    }});
  }}
  // 3 个麦克风(audioinput)
  for (var i = 0; i < 3; i++) {{
    _devices.push({{
      deviceId: _deviceId('mic' + i + '-', i + 2),
      kind: 'audioinput',
      label: '',
      groupId: 'group-' + _seed,
    }});
  }}
  // 4 个扬声器(audiooutput)
  for (var i = 0; i < 4; i++) {{
    _devices.push({{
      deviceId: _deviceId('spk' + i + '-', i + 5),
      kind: 'audiooutput',
      label: '',
      groupId: 'group-' + _seed,
    }});
  }}

  // ---- 1. navigator.mediaDevices.enumerateDevices ----
  try {{
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {{
      navigator.mediaDevices.enumerateDevices = function() {{
        return Promise.resolve(_devices.map(function(d) {{
          // 返回副本(防止页面修改内部状态)
          return {{
            deviceId: d.deviceId,
            kind: d.kind,
            label: d.label,
            groupId: d.groupId,
          }};
        }}));
      }};
    }}
  }} catch (e) {{}}

  // ---- 2. navigator.mediaDevices.getUserMedia ----
  // 返回 AbortError(模拟用户拒绝授权,真人常见行为)
  try {{
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {{
      navigator.mediaDevices.getUserMedia = function(constraints) {{
        return Promise.reject(new DOMException(
          'Permission denied by user.',
          'NotAllowedError'
        ));
      }};
    }}
  }} catch (e) {{}}

  // ---- 3. navigator.mediaDevices.getDisplayMedia ----
  // 屏幕共享请求也拒绝
  try {{
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {{
      navigator.mediaDevices.getDisplayMedia = function(constraints) {{
        return Promise.reject(new DOMException(
          'Permission denied by user.',
          'NotAllowedError'
        ));
      }};
    }}
  }} catch (e) {{}}

  // ---- 4. navigator.usb.getDevices ----
  // USB 设备列表返回空(无 USB 设备连接)
  try {{
    if (navigator.usb) {{
      navigator.usb.getDevices = function() {{
        return Promise.resolve([]);
      }};
      navigator.usb.requestDevice = function() {{
        return Promise.reject(new DOMException(
          'No device selected.',
          'NotFoundError'
        ));
      }};
    }}
  }} catch (e) {{}}

}})();
"""


async def inject_media_devices_guard(
    context: BrowserContext, account_seed: int,
) -> None:
    """对 BrowserContext 注入多媒体设备指纹防护脚本。

    拦截 enumerateDevices(返回固定设备列表)/ getUserMedia(返回拒绝)/
    getDisplayMedia / usb.getDevices,防止设备指纹探测。

    Args:
        context: Playwright BrowserContext(async)
        account_seed: 账号种子(同账号固定),用于确定性设备列表生成
    """
    script = _build_media_devices_script(account_seed)
    await context.add_init_script(script)
    logger.debug(
        "[media_devices_guard] 多媒体设备防护已注入(seed=%d,9 设备:2cam+3mic+4spk)",
        account_seed,
    )


__all__ = ["inject_media_devices_guard", "_build_media_devices_script"]
