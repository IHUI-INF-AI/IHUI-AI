"""反检测脚本注入(stealth)— 隐藏 Playwright/CDP 自动化特征。

等同 puppeteer-extra-plugin-stealth 的核心能力,通过 context.add_init_script
在每个页面加载前注入 JS,修改 navigator/window 属性,让自动化浏览器"看起来是真人"。

隐藏项(12 类检测点 + 2026-07-31 强化 5 类 = 17 类):
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

强化(2026-07-31)— 堵住常见代理/指纹泄露点:
13. WebRTC IP 泄露防护 → 重写 RTCPeerConnection,禁用 STUN/TURN 真实 IP 收集
14. navigator.permissions 重写 → notifications 查询返回 denied(非 default)
15. navigator.deviceMemoryEntropy → 对 deviceMemory 添加微小噪声(避免精确值指纹)
16. screen.colorDepth 噪声 → 24/32 之间随机(避免精确值指纹)
17. navigator.connection 增强 → 模拟真实网络信息 API(防网络指纹)

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

  // ---- 13. WebRTC IP 泄露防护(2026-07-31 强化)----
  // 重写 RTCPeerConnection,禁用 STUN/TURN 真实 IP 收集
  // 即使使用代理,WebRTC 也会泄露真实 IP(浏览器绕过代理直连 STUN 服务器)
  try {{
    if (window.RTCPeerConnection) {{
      var _OrigRTC = window.RTCPeerConnection;
      window.RTCPeerConnection = function(config, constraints) {{
        // 强制 iceTransportPolicy: 'relay'(仅走 TURN 代理,不直连 STUN)
        // 若无 TURN,则禁用 ICE candidate(返回空)
        var newConfig = config || {{}};
        newConfig.iceServers = newConfig.iceServers || [];
        // 移除所有 STUN 服务器(只保留 TURN)
        newConfig.iceServers = newConfig.iceServers.filter(function(s) {{
          return s.urls && s.urls.some(function(u) {{ return u.indexOf('turn:') === 0 || u.indexOf('turns:') === 0; }});
        }});
        // 强制 relay 策略(不收集 host/srflx candidate)
        newConfig.iceTransportPolicy = 'relay';
        var pc = new _OrigRTC(newConfig, constraints);
        // 重写 createOffer/createAnswer 后的 ICE candidate 收集
        var _origAddIceCandidate = pc.addIceCandidate;
        // 重写 onicecandidate(拦截 candidate,过滤掉 host/srflx)
        var _origOnIceCandidate = Object.getOwnPropertyDescriptor(pc, 'onicecandidate');
        try {{
          Object.defineProperty(pc, 'onicecandidate', {{
            set: function(fn) {{
              var wrappedFn = function(event) {{
                // 过滤掉非 relay 的 candidate(避免泄露真实 IP)
                if (event && event.candidate) {{
                  var cand = event.candidate.candidate || '';
                  // 仅允许 'relay' 类型 candidate,其他丢弃
                  if (cand.indexOf('relay') === -1) {{
                    // 拦截,不传给应用
                    return;
                  }}
                }}
                if (typeof fn === 'function') fn.call(pc, event);
              }};
              // 用 _OrigRTC.prototype 上的 setOnIceCandidate 设置
              if (_origOnIceCandidate && _origOnIceCandidate.set) {{
                _origOnIceCandidate.set.call(pc, wrappedFn);
              }} else {{
                pc._onicecandidate_wrapped = wrappedFn;
              }}
            }},
            get: function() {{
              return pc._onicecandidate_wrapped || null;
            }},
            configurable: true,
          }});
        }} catch (e) {{}}
        return pc;
      }};
      // 复制原型 + 静态属性
      window.RTCPeerConnection.prototype = _OrigRTC.prototype;
      if (_OrigRTC.generateCertificate) {{
        window.RTCPeerConnection.generateCertificate = _OrigRTC.generateCertificate;
      }}
    }}
    // 兼容 webkitRTCPeerConnection(旧版 Chrome)
    if (window.webkitRTCPeerConnection && !window.RTCPeerConnection) {{
      window.RTCPeerConnection = window.webkitRTCPeerConnection;
    }}
  }} catch (e) {{}}

  // ---- 14. navigator.permissions 重写(2026-07-31 强化)----
  // 原版查询 notifications 时返回 default,这是自动化浏览器的指纹特征
  // 真人浏览器查询 notifications 多数返回 denied(用户拒绝过)
  try {{
    if (window.navigator.permissions) {{
      var _origPermQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
      window.navigator.permissions.query = function(params) {{
        if (params && params.name === 'notifications') {{
          // 真人浏览器:多数用户拒绝过通知,返回 denied
          return Promise.resolve({{ state: 'denied', onchange: null }});
        }}
        // 其他权限查询(midi/camera/microphone 等)走原版
        return _origPermQuery(params);
      }};
    }}
  }} catch (e) {{}}

  // ---- 15. navigator.deviceMemoryEntropy(2026-07-31 强化)----
  // 对 navigator.deviceMemory 添加微小噪声,避免精确值指纹
  // 真人浏览器 deviceMemory 是 0.25/0.5/1/2/4/8 之一,
  // 但精确到 bit 的指纹会让"同 deviceMemory 的不同设备"被关联
  // 用账号专属种子决定是否对 deviceMemory 做 ±1 的微扰
  try {{
    var _origDeviceMemory = navigator.deviceMemory;
    if (_origDeviceMemory !== undefined) {{
      // 50% 概率保持原值,50% 概率微扰(同账号一致)
      var _shouldPerturb = _rand() > 0.5;
      if (_shouldPerturb) {{
        // 在 [4, 8] 区间内选一个(避免极端值)
        var _memChoices = [4, 8];
        var _memIdx = Math.floor(_rand() * _memChoices.length);
        Object.defineProperty(navigator, 'deviceMemory', {{
          get: function() {{ return _memChoices[_memIdx]; }},
          configurable: true,
        }});
      }}
    }}
  }} catch (e) {{}}

  // ---- 16. screen.colorDepth 噪声(2026-07-31 强化)----
  // 真人浏览器 colorDepth 是 24(RGB)或 32(RGBA),同账号固定其一
  // 用账号专属种子决定(同账号一致,不同账号不同)
  try {{
    var _depthChoices = [24, 32];
    var _depthIdx = Math.floor(_rand() * _depthChoices.length);
    var _colorDepth = _depthChoices[_depthIdx];
    Object.defineProperty(screen, 'colorDepth', {{
      get: function() {{ return _colorDepth; }},
      configurable: true,
    }});
    // pixelDepth 也同步(避免不一致被检测)
    Object.defineProperty(screen, 'pixelDepth', {{
      get: function() {{ return _colorDepth; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 17. navigator.connection 增强(2026-07-31 强化)----
  // 模拟真实网络信息 API(防网络指纹)
  // 真人浏览器有 navigator.connection(wifi/4g/3g),自动化浏览器可能缺失或异常
  try {{
    if (!navigator.connection) {{
      var _connTypes = ['wifi', 'wifi', 'wifi', '4g', '4g'];  // wifi 最常见
      var _connIdx = Math.floor(_rand() * _connTypes.length);
      var _connObj = {{
        effectiveType: _connTypes[_connIdx],
        rtt: Math.floor(_rand() * 50) + 50,  // 50-100ms
        downlink: Math.round((_rand() * 5 + 5) * 10) / 10,  // 5-10 Mbps
        saveData: false,
        addEventListener: function() {{}},
        removeEventListener: function() {{}},
      }};
      Object.defineProperty(navigator, 'connection', {{
        get: function() {{ return _connObj; }},
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
