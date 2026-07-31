"""反检测脚本注入(stealth)— 隐藏 Playwright/CDP 自动化特征。

等同 puppeteer-extra-plugin-stealth 的核心能力,通过 context.add_init_script
在每个页面加载前注入 JS,修改 navigator/window 属性,让自动化浏览器"看起来是真人"。

隐藏项(12 类检测点):
1. navigator.webdriver → undefined(最基础,CDP 默认会设 true)
2. window.chrome → 模拟真实 Chrome 对象(runtime/csi/loadTimes/app)
3. navigator.plugins → 模拟非空(Chrome PDF/Plugin 数组)
4. navigator.languages → ['zh-CN', 'zh', 'en']
5. Permissions API → 修复 notifications 查询异常
6. WebGL vendor/renderer → 伪装真实显卡(Intel/NVIDIA/AMD 轮换)
7. Canvas 噪声 → 每像素微扰(防 Canvas 指纹追踪)
8. AudioContext 噪声 → 每账号不同种子(防音频指纹)
9. navigator.hardwareConcurrency → 4/8/12/16 随机
10. navigator.deviceMemory → 4/8/16 随机
11. 隐藏 CDP runtime.enable 检测特征
12. iframe contentWindow 一致性修复

Canvas/AudioContext 噪声用账号专属种子(同账号一致,不同账号不同),
避免"每次访问指纹都变"的反常特征(真人指纹是稳定的)。
"""
from __future__ import annotations

import json
import logging
import random
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_stealth_script(fingerprint_seed: int) -> str:
    """构建反检测 JS 脚本(含账号专属 Canvas/AudioContext 噪声种子)。

    fingerprint_seed: 账号指纹种子(同账号固定,不同账号不同),
        用于 Canvas/AudioContext/WebGL 噪声生成,确保同账号指纹跨会话稳定。
    """
    # 基于 seed 的确定性伪随机生成器(JS 端实现,同 seed 同结果)
    # 用 mulberry32 算法(轻量确定性 PRNG)
    return f"""
(function() {{
  'use strict';

  // ---- 账号专属确定性 PRNG(mulberry32)----
  // 同 fingerprint_seed 永远生成相同序列,确保同账号指纹跨会话稳定
  var _seed = {fingerprint_seed} >>> 0;
  function _rand() {{
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }}

  // ---- 1. navigator.webdriver → undefined ----
  try {{
    Object.defineProperty(Navigator.prototype, 'webdriver', {{
      get: function() {{ return undefined; }},
      configurable: true,
    }});
  }} catch (e) {{}}
  // 兜底:直接删
  try {{ delete Navigator.prototype.webdriver; }} catch (e) {{}}

  // ---- 2. window.chrome(模拟真实 Chrome)----
  if (!window.chrome) {{
    window.chrome = {{}};
  }}
  if (!window.chrome.runtime) {{
    window.chrome.runtime = {{
      OnInstalledReason: {{ CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' }},
      OnRestartRequiredReason: {{ APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }},
      PlatformArch: {{ ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }},
      PlatformOs: {{ ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }},
      RequestUpdateCheckStatus: {{ NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }},
      connect: function() {{ return {{ onDisconnect: {{ addListener: function() {{}} }}, onMessage: {{ addListener: function() {{}} }} }}; }},
      sendMessage: function() {{}},
    }};
  }}
  if (!window.chrome.csi) {{
    window.chrome.csi = function() {{ return {{ onloadT: Date.now(), startE: Date.now(), pageT: {{}} }}; }};
  }}
  if (!window.chrome.loadTimes) {{
    window.chrome.loadTimes = function() {{
      return {{
        commitLoadTime: Date.now() / 1000 - 100,
        connectionInfo: 'h2',
        finishDocumentLoadTime: Date.now() / 1000 - 50,
        finishLoadTime: Date.now() / 1000 - 40,
        firstPaintAfterLoadTime: 0,
        firstPaintTime: Date.now() / 1000 - 90,
        navigationType: 'Other',
        npnNegotiatedProtocol: 'h2',
        requestTime: Date.now() / 1000 - 120,
        startLoadTime: Date.now() / 1000 - 110,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
      }};
    }};
  }}
  if (!window.chrome.app) {{
    window.chrome.app = {{ isInstalled: false, InstallState: {{ DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }}, RunningState: {{ CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }}, getDetails: function() {{ return null; }}, getIsInstalled: function() {{ return false; }} }};
  }}

  // ---- 3. navigator.plugins(模拟非空)----
  try {{
    var _fakePlugins = [
      {{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
      {{ name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' }},
      {{ name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }},
    ];
    var _pluginArray = [];
    _fakePlugins.forEach(function(p) {{
      var plugin = Object.create(Plugin.prototype);
      Object.defineProperty(plugin, 'name', {{ value: p.name }});
      Object.defineProperty(plugin, 'filename', {{ value: p.filename }});
      Object.defineProperty(plugin, 'description', {{ value: p.description }});
      Object.defineProperty(plugin, 'length', {{ value: 1 }});
      _pluginArray.push(plugin);
    }});
    Object.defineProperty(navigator, 'plugins', {{
      get: function() {{
        var arr = _pluginArray.slice();
        arr.item = function(i) {{ return arr[i] || null; }};
        arr.namedItem = function(n) {{ return arr.find(function(p) {{ return p.name === n; }}) || null; }};
        arr.refresh = function() {{}};
        return arr;
      }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 4. navigator.languages ----
  try {{
    Object.defineProperty(navigator, 'languages', {{
      get: function() {{ return ['zh-CN', 'zh', 'en-US', 'en']; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 5. Permissions API 修复 ----
  try {{
    var _origQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = function(params) {{
      if (params && params.name === 'notifications') {{
        return Promise.resolve({{ state: Notification.permission, onchange: null }});
      }}
      return _origQuery.call(window.navigator.permissions, params);
    }};
  }} catch (e) {{}}

  // ---- 6. WebGL vendor/renderer 伪装 ----
  try {{
    var _webglVendors = [
      ['Google Inc. (Intel)', 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)'],
      ['Google Inc. (NVIDIA)', 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)'],
      ['Google Inc. (AMD)', 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)'],
    ];
    var _wglIdx = Math.floor(_rand() * _webglVendors.length);
    var _wglPair = _webglVendors[_wglIdx];

    var _getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {{
      // UNMASKED_VENDOR_WEBGL = 0x9245, UNMASKED_RENDERER_WEBGL = 0x9246
      if (param === 0x9245) return _wglPair[0];
      if (param === 0x9246) return _wglPair[1];
      return _getParameter.call(this, param);
    }};
    // WebGL2 同样处理
    if (window.WebGL2RenderingContext) {{
      var _getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {{
        if (param === 0x9245) return _wglPair[0];
        if (param === 0x9246) return _wglPair[1];
        return _getParameter2.call(this, param);
      }};
    }}
  }} catch (e) {{}}

  // ---- 7. Canvas 噪声(每像素微扰,防指纹追踪)----
  // 同 seed 同噪声(同账号稳定),不同 seed 不同噪声(不同账号差异)
  try {{
    var _toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {{
      var ctx = this.getContext('2d');
      if (ctx && this.width > 0 && this.height > 0) {{
        try {{
          var img = ctx.getImageData(0, 0, this.width, this.height);
          for (var i = 0; i < img.data.length; i += 4) {{
            // 每像素 R 通道微扰 ±1(肉眼不可见,但改变哈希)
            var noise = (_rand() * 2 - 1) | 0;
            img.data[i] = Math.max(0, Math.min(255, img.data[i] + noise));
          }}
          ctx.putImageData(img, 0, 0);
        }} catch (e) {{}}  // CORS canvas 跳过
      }}
      return _toDataURL.apply(this, arguments);
    }};
  }} catch (e) {{}}

  // ---- 8. AudioContext 噪声 ----
  try {{
    var _getChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {{
      var data = _getChannelData.apply(this, arguments);
      // 仅对非空数据微扰(避免破坏音频播放)
      if (data && data.length > 0) {{
        for (var i = 0; i < data.length; i += 100) {{
          data[i] = data[i] + (_rand() * 0.0000001 - 0.00000005);
        }}
      }}
      return data;
    }};
  }} catch (e) {{}}

  // ---- 9. navigator.hardwareConcurrency ----
  try {{
    var _cores = [4, 8, 8, 12, 16][Math.floor(_rand() * 5)];
    Object.defineProperty(navigator, 'hardwareConcurrency', {{
      get: function() {{ return _cores; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 10. navigator.deviceMemory ----
  try {{
    var _mem = [4, 8, 8, 16][Math.floor(_rand() * 4)];
    Object.defineProperty(navigator, 'deviceMemory', {{
      get: function() {{ return _mem; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 11. 隐藏 CDP 检测特征 ----
  // 某些站点检测 window.cdc_XXX 属性(ChromeDriver 注入)
  try {{
    Object.keys(window).forEach(function(key) {{
      if (/^cdc_/.test(key) || /^\\$cdc_/.test(key)) {{
        try {{ delete window[key]; }} catch (e) {{}}
      }}
    }});
  }} catch (e) {{}}

  // ---- 12. iframe contentWindow 一致性 ----
  // 防止通过 iframe 检测 webdriver(子框架 navigator.webdriver 应与主框架一致)
  try {{
    var _origContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    if (_origContentWindow && _origContentWindow.get) {{
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {{
        get: function() {{
          var cw = _origContentWindow.get.call(this);
          if (cw) {{
            try {{ Object.defineProperty(cw.Navigator.prototype, 'webdriver', {{ get: function() {{ return undefined; }} }}); }} catch (e) {{}}
          }}
          return cw;
        }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}

}})();
"""


async def apply_stealth(context: Any, fingerprint_seed: int) -> None:
    """对 BrowserContext 注入反检测脚本。

    必须在 page.goto 之前调用(add_init_script 会在每个新页面加载前注入)。

    Args:
        context: Playwright BrowserContext(async)
        fingerprint_seed: 账号指纹种子(同账号固定),用于 Canvas/AudioContext 噪声
    """
    script = _build_stealth_script(fingerprint_seed)
    await context.add_init_script(script)
    logger.debug("[stealth] 反检测脚本已注入(seed=%d)", fingerprint_seed)


def generate_seed(account_id: str) -> int:
    """基于账号 ID 生成稳定的指纹种子(同账号同种子)。"""
    # 简单 hash,同账号永远同种子(跨会话稳定)
    h = 0
    for ch in account_id:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    # 避免全 0
    return h if h > 0 else 1


# 导出脚本构建函数(供单元测试验证 JS 内容)
__all__ = ["apply_stealth", "generate_seed", "_build_stealth_script"]
