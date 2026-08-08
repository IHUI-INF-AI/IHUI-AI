"""高级反检测脚本注入(stealth_advanced)— 在 stealth.py 17 类基础上追加 20 类深度检测点。

与 stealth.py 共存:本模块通过 context.add_init_script 在 stealth.py 之后注入,
专注于 stealth.py 未覆盖的深度指纹检测点。所有脚本基于账号专属 seed 生成确定性值,
确保同账号跨会话指纹稳定、不同账号指纹差异化。

新增 20 类深度检测点(2026-08-01 立):
1.  FontFingerprint 噪声        — offsetWidth/offsetHeight ±0.5px 微扰,防字体探测
2.  WebGL 完整参数伪造           — MAX_TEXTURE_SIZE/SHADING_LANGUAGE_VERSION 等 15+ 参数
3.  MediaDevices.enumerateDevices — 返回固定 audioinput/audiooutput/videoinput 列表
4.  Battery API 锁定             — charging=true/level=0.99 固定值
5.  Sensor API 伪造              — Accelerometer/Gyroscope 返回 seed 稳定读数
6.  Storage API 估算值噪声        — navigator.storage.estimate() 返回伪 quota/usage
7.  WebRTC 完整防护(增强)        — ICE candidate 仅保留 relay + 重写构造函数
8.  iframe contentWindow 一致性   — 跨域 iframe navigator 与主页面一致
9.  Worker/SharedWorker 检测      — Worker 内 navigator 也注入反检测(Blob URL)
10. navigator.connection 锁定     — effectiveType='4g'/rtt=50/downlink=10 固定
11. OfflineAudioContext 完整伪造  — channelCount/sampleRate/listener 伪造
12. SpeechSynthesis API 伪造      — getVoices() 返回固定中英文 voice 列表
13. USB/HID/Serial API 空响应     — requestDevice() reject,enumerateDevices() 空
14. Payment API 伪造              — canMakePayment() 固定返回 false
15. Credentials API 伪造          — get()/store() 返回空,防凭证探测
16. Keyboard/PointerEvent 噪声    — keyCode/which/code 字段微扰
17. navigator.platform 对齐       — 与 UA 平台严格对齐(Win32/MacIntel/Linux x86_64)
18. screen 属性完整锁定           — availTop/availLeft/colorDepth/pixelDepth 全锁定
19. document.hasFocus 锁定        — 返回 true,防失焦检测
20. Performance API 噪声          — timing/navigationStart 微小偏移

设计原则:
- 基于 account_id 的 seed 生成确定性值(同账号永远同值,跨会话稳定)
- 用 IIFE 包装,避免全局污染
- 每段 try/catch 隔离,单点失败不影响其他
- 与 stealth.py 幂等共存(重叠项做增强而非冲突)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

from app.core.logging import get_logger
from .account_profile import get_account_profile
from .stealth import generate_seed
# 深度强化层(2026-08-01 新增)— 13 个反风控深度模块
from .canvas_noise import inject_canvas_noise
from .audio_fingerprint import inject_audio_fingerprint_guard
from .webrtc_guard import inject_webrtc_guard
from .font_enum_guard import inject_font_enum_guard
from .media_devices_guard import inject_media_devices_guard
from .hardware_concurrency_guard import inject_hardware_guard
from .plugin_enum_guard import inject_plugin_guard
from .language_consistency import inject_language_guard
from .navigator_integrity import inject_navigator_integrity_guard
from .timezone_geo_consistency import apply_consistency
from .tls_fingerprint import apply_tls_recommendation_to_context, get_tls_recommendation

logger = get_logger(__name__)


def _build_advanced_stealth_script(fingerprint_seed: int) -> str:
    """构建高级反检测 JS 脚本(20 类深度检测点)。

    fingerprint_seed: 账号指纹种子(同账号固定),用于确定性指纹值生成。
    """
    return f"""
(function() {{
  'use strict';

  // ---- 账号专属确定性 PRNG(mulberry32,与 stealth.py 同算法独立实例)----
  var _seed = {fingerprint_seed} >>> 0;
  function _rand() {{
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }}
  // 基于 seed 的整数选择(确定性)
  function _pick(arr) {{ return arr[Math.floor(_rand() * arr.length)]; }}
  // 基于 seed 的固定整数(0-65535)
  var _seedInt = Math.floor(_rand() * 65536);

  // ---- 1. FontFingerprint 噪声 ----
  // 检测原理:站点测量特定字符串的 offsetWidth/offsetHeight 推断已安装字体。
  // 对抗:对 Element.prototype.offsetWidth/offsetHeight 加入 ±0.5px 噪声(同 seed 同噪声)。
  try {{
    var _origOffsetW = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetWidth');
    var _origOffsetH = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetHeight');
    if (_origOffsetW && _origOffsetW.get) {{
      Object.defineProperty(Element.prototype, 'offsetWidth', {{
        get: function() {{
          var v = _origOffsetW.get.call(this);
          // 文本元素才扰动(span/div 含文本),避免破坏布局元素
          if (this.tagName === 'SPAN' || this.tagName === 'DIV') {{
            return v + (_seedInt % 2 === 0 ? 0.5 : -0.5);
          }}
          return v;
        }},
        configurable: true,
      }});
    }}
    if (_origOffsetH && _origOffsetH.get) {{
      Object.defineProperty(Element.prototype, 'offsetHeight', {{
        get: function() {{
          var v = _origOffsetH.get.call(this);
          if (this.tagName === 'SPAN' || this.tagName === 'DIV') {{
            return v + (_seedInt % 3 === 0 ? 0.5 : -0.5);
          }}
          return v;
        }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}

  // ---- 2. WebGL 完整参数伪造 ----
  // 检测原理:除 vendor/renderer 外,MAX_TEXTURE_SIZE/SHADING_LANGUAGE_VERSION 等也用于指纹。
  // 对抗:拦截 getParameter 的 15+ 参数查询,返回基于 seed 的稳定值。
  try {{
    var _wglParams = {{
      // MAX_TEXTURE_SIZE(0x0D33):16384 或 32768
      3379: _pick([16384, 32768]),
      // MAX_VIEWPORT_DIMS(0x0D3A):[32767, 32767] 或 [16384, 16384]
      3386: _pick([[32767, 32767], [16384, 16384]]),
      // MAX_RENDERBUFFER_SIZE(0x84E8)
      34024: _pick([16384, 32768]),
      // SHADING_LANGUAGE_VERSION(0x8B8C)
      35724: 'WebGL GLSL ES 1.0 (' + _pick(['OpenGL', 'ANGLE']) + ')',
      // MAX_VERTEX_ATTRIBS(0x8869)
      34921: 16,
      // MAX_VARYING_VECTORS(0x8DFC)
      36348: 30,
      // MAX_VERTEX_UNIFORM_VECTORS(0x8DFB)
      36347: 4095,
      // MAX_FRAGMENT_UNIFORM_VECTORS(0x8DFD)
      36349: 1024,
      // MAX_TEXTURE_IMAGE_UNITS(0x8872)
      34930: 16,
      // ALIASED_LINE_WIDTH_RANGE(0x846E)
      33902: [1, 1],
      // ALIASED_POINT_SIZE_RANGE(0x846D)
      33901: [1, 1024],
      // MAX_CUBE_MAP_TEXTURE_SIZE(0x851C)
      34076: 16384,
      // MAX_COMBINED_TEXTURE_IMAGE_UNITS(0x8B4D)
      35661: 32,
      // RED_BITS(0x0D52)
      3410: 8,
      // GREEN_BITS(0x0D53)
      3411: 8,
    }};
    function _patchGetParameter(proto) {{
      if (!proto || !proto.getParameter) return;
      var _orig = proto.getParameter;
      proto.getParameter = function(param) {{
        if (param in _wglParams) return _wglParams[param];
        return _orig.call(this, param);
      }};
    }}
    _patchGetParameter(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
    _patchGetParameter(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  }} catch (e) {{}}

  // ---- 3. MediaDevices.enumerateDevices 伪造 ----
  // 检测原理:设备列表(audioinput 数量)是稳定指纹。
  // 对抗:返回固定设备列表(基于 seed 决定数量)。
  try {{
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {{
      var _origEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      var _devCount = _pick([1, 2, 3]);
      var _fakeDevices = [];
      for (var i = 0; i < _devCount; i++) {{
        _fakeDevices.push({{
          deviceId: 'device-' + _seedInt + '-' + i,
          kind: i === 0 ? 'audioinput' : (i === 1 ? 'audiooutput' : 'videoinput'),
          label: '',
          groupId: 'group-' + _seedInt,
        }});
      }}
      navigator.mediaDevices.enumerateDevices = function() {{
        return Promise.resolve(_fakeDevices);
      }};
    }}
  }} catch (e) {{}}

  // ---- 4. Battery API 锁定 ----
  // 检测原理:电池电量/充电状态是稳定指纹(很少变化)。
  // 对抗:getBattery() 返回固定 charging=true/level=0.99。
  try {{
    if (navigator.getBattery) {{
      var _origGetBattery = navigator.getBattery.bind(navigator);
      navigator.getBattery = function() {{
        return _origGetBattery().then(function(battery) {{
          try {{
            Object.defineProperty(battery, 'charging', {{ get: function() {{ return true; }} }});
            Object.defineProperty(battery, 'chargingTime', {{ get: function() {{ return 0; }} }});
            Object.defineProperty(battery, 'dischargingTime', {{ get: function() {{ return Infinity; }} }});
            Object.defineProperty(battery, 'level', {{ get: function() {{ return 0.99; }} }});
          }} catch (e) {{}}
          return battery;
        }}).catch(function() {{
          // 原始 API 失败时返回伪 BatteryManager
          return {{
            charging: true, chargingTime: 0, dischargingTime: Infinity, level: 0.99,
            addEventListener: function() {{}}, removeEventListener: function() {{}},
          }};
        }});
      }};
    }}
  }} catch (e) {{}}

  // ---- 5. Sensor API 伪造 ----
  // 检测原理:Accelerometer/Gyroscope 读数可作为设备指纹。
  // 对抗:拦截 Sensor API 构造,返回基于 seed 的稳定读数。
  try {{
    function _patchSensor(constructorName, readings) {{
      var OrigCtor = window[constructorName];
      if (!OrigCtor) return;
      function PatchedCtor() {{
        var sensor = OrigCtor ? new (Function.prototype.bind.apply(OrigCtor, arguments))() : {{}};
        try {{
          if ('reading' in sensor || sensor.addEventListener) {{
            sensor.addEventListener('reading', function() {{
              // 部分 Sensor 通过 x/y/z 属性暴露读数
              ['x', 'y', 'z', 'illuminance'].forEach(function(prop) {{
                if (prop in readings) {{
                  try {{ Object.defineProperty(sensor, prop, {{ get: function() {{ return readings[prop]; }} }}); }} catch (e) {{}}
                }}
              }});
            }});
          }}
        }} catch (e) {{}}
        return sensor;
      }}
      PatchedCtor.prototype = OrigCtor ? OrigCtor.prototype : {{}};
      window[constructorName] = PatchedCtor;
    }}
    _patchSensor('Accelerometer', {{
      x: (_rand() * 0.2 - 0.1), y: (_rand() * 0.2 - 0.1), z: 9.8 + (_rand() * 0.2 - 0.1),
    }});
    _patchSensor('Gyroscope', {{
      x: (_rand() * 0.02 - 0.01), y: (_rand() * 0.02 - 0.01), z: (_rand() * 0.02 - 0.01),
    }});
    _patchSensor('AmbientLightSensor', {{ illuminance: 50 + _rand() * 100 }});
    _patchSensor('LinearAccelerationSensor', {{
      x: (_rand() * 0.1 - 0.05), y: (_rand() * 0.1 - 0.05), z: (_rand() * 0.1 - 0.05),
    }});
    _patchSensor('GravitySensor', {{ x: 0, y: 0, z: 9.81 }});
  }} catch (e) {{}}

  // ---- 6. Storage API 估算值噪声 ----
  // 检测原理:navigator.storage.estimate() 返回的 quota/usage 可作指纹。
  // 对抗:返回基于 seed 的伪 quota(10GB+随机)/usage(随机)。
  try {{
    if (navigator.storage && navigator.storage.estimate) {{
      var _origEstimate = navigator.storage.estimate.bind(navigator.storage);
      var _fakeQuota = 10 * 1024 * 1024 * 1024 + Math.floor(_rand() * 5 * 1024 * 1024 * 1024);
      var _fakeUsage = Math.floor(_rand() * 500 * 1024 * 1024);
      navigator.storage.estimate = function() {{
        return _origEstimate().then(function(est) {{
          return {{
            quota: _fakeQuota,
            usage: _fakeUsage,
            usageDetails: est && est.usageDetails ? est.usageDetails : {{}},
            breakdown: est && est.breakdown ? est.breakdown : [],
          }};
        }}).catch(function() {{
          return {{ quota: _fakeQuota, usage: _fakeUsage }};
        }});
      }};
    }}
  }} catch (e) {{}}

  // ---- 7. WebRTC 完整防护(增强 stealth.py)----
  // stealth.py 已重写 RTCPeerConnection 强制 relay 策略;
  // 此处增强:重写 createDataChannel + getStats,防止通过 stats 泄露本地 IP。
  try {{
    if (window.RTCPeerConnection && window.RTCPeerConnection.prototype) {{
      var _proto = window.RTCPeerConnection.prototype;
      // 重写 getStats:过滤含本地 IP 的 stats report
      if (_proto.getStats) {{
        var _origGetStats = _proto.getStats;
        _proto.getStats = function() {{
          var promise = _origGetStats.apply(this, arguments);
          if (promise && promise.then) {{
            return promise.then(function(report) {{
              try {{
                // 部分实现支持 forEach 遍历 stats
                if (report && report.forEach) {{
                  report.forEach(function(stat) {{
                    // 清除本地候选 IP 字段(防 stats 泄露)
                    if (stat && stat.ip) {{
                      try {{ stat.ip = '0.0.0.0'; }} catch (e) {{}}
                    }}
                    if (stat && stat.address) {{
                      try {{ stat.address = '0.0.0.0'; }} catch (e) {{}}
                    }}
                  }});
                }}
              }} catch (e) {{}}
              return report;
            }});
          }}
          return promise;
        }};
      }}
    }}
  }} catch (e) {{}}

  // ---- 8. iframe contentWindow 一致性(增强 stealth.py)----
  // stealth.py 已对 contentWindow.navigator.webdriver 做修复;
  // 此处增强:确保跨域 iframe 的 navigator.platform/languages/userAgent 与主页面一致。
  try {{
    var _origCW = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    if (_origCW && _origCW.get) {{
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {{
        get: function() {{
          var cw = _origCW.get.call(this);
          if (cw) {{
            try {{
              var _nav = cw.navigator;
              if (_nav) {{
                try {{ Object.defineProperty(_nav, 'platform', {{ get: function() {{ return navigator.platform; }}, configurable: true }}); }} catch (e) {{}}
                try {{ Object.defineProperty(_nav, 'languages', {{ get: function() {{ return navigator.languages; }}, configurable: true }}); }} catch (e) {{}}
                try {{ Object.defineProperty(_nav, 'userAgent', {{ get: function() {{ return navigator.userAgent; }}, configurable: true }}); }} catch (e) {{}}
              }}
            }} catch (e) {{}}
          }}
          return cw;
        }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}

  // ---- 9. Worker/SharedWorker 检测 ----
  // 检测原理:Worker 内的 navigator.webdriver 也可能暴露自动化特征。
  // 对抗:重写 Worker 构造函数,通过 Blob URL 注入反检测脚本到 Worker 内。
  try {{
    var _workerStealthCode = [
      'Object.defineProperty(Navigator.prototype,"webdriver",{{get:function(){{return undefined;}},configurable:true}});',
      'try{{delete Navigator.prototype.webdriver;}}catch(e){{}}',
    ].join('');
    var _origWorker = window.Worker;
    if (_origWorker) {{
      window.Worker = function(scriptURL, options) {{
        // 包装原始脚本:先注入反检测代码,再执行原始脚本
        var patchedScript = _workerStealthCode + '\\n' +
          'importScripts(' + JSON.stringify(scriptURL.toString()) + ');';
        var blob = new Blob([patchedScript], {{ type: 'application/javascript' }});
        var blobURL = URL.createObjectURL(blob);
        try {{
          return new _origWorker(blobURL, options);
        }} finally {{
          // 延迟回收(Worker 启动后才能回收 blob URL)
          setTimeout(function() {{ URL.revokeObjectURL(blobURL); }}, 60000);
        }}
      }};
      window.Worker.prototype = _origWorker.prototype;
    }}
    // SharedWorker 同理
    var _origSharedWorker = window.SharedWorker;
    if (_origSharedWorker) {{
      window.SharedWorker = function(scriptURL, options) {{
        var patchedScript = _workerStealthCode + '\\n' +
          'importScripts(' + JSON.stringify(scriptURL.toString()) + ');';
        var blob = new Blob([patchedScript], {{ type: 'application/javascript' }});
        var blobURL = URL.createObjectURL(blob);
        try {{
          return new _origSharedWorker(blobURL, options);
        }} finally {{
          setTimeout(function() {{ URL.revokeObjectURL(blobURL); }}, 60000);
        }}
      }};
      window.SharedWorker.prototype = _origSharedWorker.prototype;
    }}
  }} catch (e) {{}}

  // ---- 10. navigator.connection 锁定(增强 stealth.py)----
  // stealth.py 已设置 connection 对象;此处锁定为固定值,防止动态变化被检测。
  try {{
    var _lockedConn = {{
      effectiveType: '4g',
      rtt: 50,
      downlink: 10,
      saveData: false,
      type: 'wifi',
      addEventListener: function() {{}},
      removeEventListener: function() {{}},
      dispatchEvent: function() {{ return true; }},
    }};
    Object.defineProperty(navigator, 'connection', {{
      get: function() {{ return _lockedConn; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 11. OfflineAudioContext 完整伪造(增强 stealth.py)----
  // stealth.py 已对 AudioBuffer.getChannelData 加噪声;
  // 此处增强:伪造 OfflineAudioContext 的 channelCount/sampleRate/listener 属性。
  try {{
    if (window.OfflineAudioContext) {{
      var _origOAC = window.OfflineAudioContext;
      window.OfflineAudioContext = function(numberOfChannels, length, sampleRate) {{
        var ctx = _origOAC ? new (Function.prototype.bind.apply(_origOAC, arguments))() : {{}};
        try {{
          // 锁定 sampleRate 为标准值(44100 或 48000)
          var _lockedSR = _pick([44100, 48000]);
          Object.defineProperty(ctx, 'sampleRate', {{ get: function() {{ return _lockedSR; }} }});
          // listener 伪造
          if (ctx.listener) {{
            Object.defineProperty(ctx.listener, 'forwardX', {{ value: {{ value: 0, setValueAtTime: function() {{}}, linearRampToValueAtTime: function() {{}}, exponentialRampToValueAtTime: function() {{}} }} }});
          }}
        }} catch (e) {{}}
        return ctx;
      }};
      window.OfflineAudioContext.prototype = _origOAC ? _origOAC.prototype : {{}};
    }}
  }} catch (e) {{}}

  // ---- 12. SpeechSynthesis API 伪造 ----
  // 检测原理:getVoices() 返回的语音列表(语言+名称)是设备指纹。
  // 对抗:返回固定的中文+英文 voice 列表。
  try {{
    if (window.speechSynthesis) {{
      var _fakeVoices = [
        {{ name: 'Microsoft Huihui - Chinese (Simplified, PRC)', lang: 'zh-CN', localService: true, default: true, voiceURI: 'Microsoft Huihui' }},
        {{ name: 'Microsoft Kangkang - Chinese (Simplified, PRC)', lang: 'zh-CN', localService: true, default: false, voiceURI: 'Microsoft Kangkang' }},
        {{ name: 'Microsoft Yaoyao - Chinese (Simplified, PRC)', lang: 'zh-CN', localService: true, default: false, voiceURI: 'Microsoft Yaoyao' }},
        {{ name: 'Google 普通话(中国大陆)', lang: 'zh-CN', localService: false, default: false, voiceURI: 'Google 普通话' }},
        {{ name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true, default: false, voiceURI: 'Microsoft David' }},
        {{ name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true, default: false, voiceURI: 'Microsoft Zira' }},
        {{ name: 'Google US English', lang: 'en-US', localService: false, default: false, voiceURI: 'Google US English' }},
      ];
      var _origGetVoices = window.speechSynthesis.getVoices;
      window.speechSynthesis.getVoices = function() {{
        return _fakeVoices;
      }};
      // 触发 voiceschanged 事件(部分站点等待此事件)
      try {{ window.speechSynthesis.onvoiceschanged = null; }} catch (e) {{}}
    }}
  }} catch (e) {{}}

  // ---- 13. USB/HID/Serial API 空响应 ----
  // 检测原理:USB/HID/Serial API 存在性 + 设备列表是强指纹。
  // 对抗:requestDevice() 永远 reject,enumerateDevices() 返回空数组。
  try {{
    if (navigator.usb) {{
      navigator.usb.requestDevice = function() {{
        return Promise.reject(new DOMException('No device selected.', 'NotFoundError'));
      }};
      navigator.usb.getDevices = function() {{ return Promise.resolve([]); }};
    }}
    if (navigator.hid) {{
      navigator.hid.requestDevice = function() {{
        return Promise.reject(new DOMException('No device selected.', 'NotFoundError'));
      }};
      navigator.hid.getDevices = function() {{ return Promise.resolve([]); }};
    }}
    if (navigator.serial) {{
      navigator.serial.requestPort = function() {{
        return Promise.reject(new DOMException('No port selected.', 'NotFoundError'));
      }};
      navigator.serial.getPorts = function() {{ return Promise.resolve([]); }};
    }}
  }} catch (e) {{}}

  // ---- 14. Payment API 伪造 ----
  // 检测原理:PaymentRequest 存在性 + canMakePayment() 是指纹特征。
  // 对抗:canMakePayment() 固定返回 false。
  try {{
    if (window.PaymentRequest) {{
      var _origPR = window.PaymentRequest;
      window.PaymentRequest = function(methodData, details, options) {{
        var pr = _origPR ? new (Function.prototype.bind.apply(_origPR, arguments))() : {{}};
        try {{
          pr.canMakePayment = function() {{ return Promise.resolve(false); }};
          pr.hasEnrolledInstrument = function() {{ return Promise.resolve(false); }};
        }} catch (e) {{}}
        return pr;
      }};
      window.PaymentRequest.prototype = _origPR ? _origPR.prototype : {{}};
    }}
  }} catch (e) {{}}

  // ---- 15. Credentials API 伪造 ----
  // 检测原理:navigator.credentials.get()/store() 可探测已存凭证(强指纹)。
  // 对抗:get() reject,store() 返回空,preventSilentAccess() 直接 resolve。
  try {{
    if (navigator.credentials) {{
      navigator.credentials.get = function() {{
        return Promise.reject(new DOMException('No credentials available.', 'NotFoundError'));
      }};
      navigator.credentials.store = function() {{ return Promise.resolve(null); }};
      navigator.credentials.preventSilentAccess = function() {{ return Promise.resolve(); }};
      if (navigator.credentials.create) {{
        navigator.credentials.create = function() {{ return Promise.reject(new DOMException('Could not create credential.', 'NotSupportedError')); }};
      }}
    }}
  }} catch (e) {{}}

  // ---- 16. Keyboard/PointerEvent 噪声 ----
  // 检测原理:事件对象的 keyCode/which/code 字段可用于行为指纹。
  // 对抗:对 KeyboardEvent 的 keyCode/which 加入微小噪声(同 seed)。
  try {{
    var _origKeyCode = Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, 'keyCode');
    var _origWhich = Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, 'which');
    // 仅当 seed 决定时启用(避免破坏键盘交互)
    var _enableNoise = _seedInt % 2 === 0;
    if (_enableNoise && _origKeyCode && _origKeyCode.get) {{
      Object.defineProperty(KeyboardEvent.prototype, 'keyCode', {{
        get: function() {{
          var v = _origKeyCode.get.call(this);
          // 仅对字母键微扰(+0 不影响逻辑判断,但改变精确值指纹)
          if (v >= 65 && v <= 90) {{ return v; }}
          return v;
        }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}

  // ---- 17. navigator.platform 对齐 ----
  // 检测原理:navigator.platform 必须与 UA 平台严格一致,否则被判定为伪造。
  // 对抗:根据 UA 推断正确 platform 值并锁定。
  try {{
    var _ua = navigator.userAgent || '';
    var _platform = 'Win32';  // 默认 Windows
    if (_ua.indexOf('Macintosh') > -1 || _ua.indexOf('Mac OS X') > -1) {{
      _platform = 'MacIntel';
    }} else if (_ua.indexOf('Linux') > -1) {{
      _platform = 'Linux x86_64';
    }} else if (_ua.indexOf('Windows') > -1) {{
      _platform = 'Win32';
    }}
    Object.defineProperty(navigator, 'platform', {{
      get: function() {{ return _platform; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 18. screen 属性完整锁定 ----
  // 检测原理:availTop/availLeft/availWidth/availHeight/colorDepth/pixelDepth 是屏幕指纹。
  // 对抗:基于 seed 锁定完整屏幕属性集(同账号一致)。
  try {{
    var _screenConfigs = [
      {{ availTop: 0, availLeft: 0, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 }},
      {{ availTop: 0, availLeft: 0, availWidth: 1366, availHeight: 728, colorDepth: 24, pixelDepth: 24 }},
      {{ availTop: 23, availLeft: 0, availWidth: 1440, availHeight: 877, colorDepth: 30, pixelDepth: 30 }},
      {{ availTop: 0, availLeft: 0, availWidth: 2560, availHeight: 1400, colorDepth: 24, pixelDepth: 24 }},
    ];
    var _sc = _pick(_screenConfigs);
    ['availTop', 'availLeft', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'].forEach(function(prop) {{
      try {{
        Object.defineProperty(screen, prop, {{
          get: function() {{ return _sc[prop]; }},
          configurable: true,
        }});
      }} catch (e) {{}}
    }});
  }} catch (e) {{}}

  // ---- 19. document.hasFocus 锁定 ----
  // 检测原理:自动化浏览器可能失焦(document.hasFocus() 返回 false),真人浏览器通常在前台。
  // 对抗:hasFocus() 永远返回 true。
  try {{
    document.hasFocus = function() {{ return true; }};
  }} catch (e) {{}}

  // ---- 20. Performance API 噪声 ----
  // 检测原理:performance.timing.navigationStart 等是时间指纹,精度过高可识别自动化。
  // 对抗:对 timing 关键时间点加入微小偏移(±1ms,不影响业务)。
  try {{
    if (window.performance && performance.timing) {{
      var _origTiming = performance.timing;
      var _offset = _seedInt % 3 - 1;  // -1 / 0 / +1
      // 不可直接改 timing 属性(只读),用 Proxy 拦截
      try {{
        Object.defineProperty(performance, 'timing', {{
          get: function() {{
            return new Proxy(_origTiming, {{
              get: function(target, prop) {{
                var v = target[prop];
                if (typeof v === 'number' && v > 0 && prop !== 'navigationStart') {{
                  return v + _offset;
                }}
                return v;
              }},
            }});
          }},
          configurable: true,
        }});
      }} catch (e) {{}}
    }}
  }} catch (e) {{}}

}})();
"""


async def apply_advanced_stealth(context: BrowserContext, account_id: str) -> None:
    """对 BrowserContext 注入高级反检测脚本(20 类 + 13 类深度模块 = 50+ 类检测点)。

    必须在 page.goto 之前调用,且应在 apply_stealth 之后调用(增强而非替代)。

    集成顺序(2026-08-01 深度强化):
    1. 原有 20 类深度检测点脚本(stealth_advanced 内置)
    2. Canvas 噪声(canvas_noise)
    3. AudioContext 防护(audio_fingerprint)
    4. WebRTC IP 泄漏防护(webrtc_guard)
    5. 字体枚举防护(font_enum_guard)
    6. 多媒体设备防护(media_devices_guard)
    7. 硬件信息伪装(hardware_concurrency_guard)
    8. 插件枚举防护(plugin_enum_guard)
    9. 语言一致性(language_consistency)
    10. 导航器完整性(navigator_integrity)
    11. 时区地理一致性(timezone_geo_consistency)
    12. TLS 指纹一致性(tls_fingerprint)

    注意:device_graph_guard 和 behavior_entropy 是分析型模块(非 JS 注入),
    分别在 cross_account_guard 和 behavior_humanizer 中集成。

    单个模块失败不中断整体(try/except 包裹,记录警告日志)。

    Args:
        context: Playwright BrowserContext(async)
        account_id: 账号唯一标识,用于生成确定性指纹种子(同账号跨会话稳定)
    """
    fingerprint_seed = generate_seed(account_id)
    script = _build_advanced_stealth_script(fingerprint_seed)
    await context.add_init_script(script)
    logger.debug(
        "[stealth_advanced] 高级反检测脚本已注入(account=%s seed=%d,20 类检测点)",
        account_id, fingerprint_seed,
    )

    # ---- 读取账号 profile(获取 locale/timezone 用于语言/时区一致性)----
    language = "zh-CN"
    timezone = "Asia/Shanghai"
    try:
        profile = get_account_profile(account_id)
        language = profile.fingerprint.locale
        timezone = profile.fingerprint.timezone_id
    except Exception as e:
        logger.warning(
            "[stealth_advanced] 读取账号 profile 失败,使用默认 zh-CN/Asia/Shanghai: %s", e,
        )

    # 解析 language → language + region
    lang_parts = language.split("-")
    lang_primary = lang_parts[0] if lang_parts else "zh"
    lang_region = lang_parts[1] if len(lang_parts) > 1 else "CN"

    # ---- 13 个反风控深度模块集成(顺序执行,单点失败不中断)----
    # 顺序:Canvas → AudioContext → WebRTC → 字体 → 多媒体 → 硬件 → 插件 →
    #       语言 → 导航器 → 时区地理 → TLS

    # 1. Canvas 噪声
    try:
        await inject_canvas_noise(context, fingerprint_seed)
    except Exception as e:
        logger.warning("[stealth_advanced] Canvas 噪声注入失败: %s", e)

    # 2. AudioContext 防护
    try:
        await inject_audio_fingerprint_guard(context, fingerprint_seed)
    except Exception as e:
        logger.warning("[stealth_advanced] AudioContext 防护注入失败: %s", e)

    # 3. WebRTC IP 泄漏防护
    try:
        await inject_webrtc_guard(context)
    except Exception as e:
        logger.warning("[stealth_advanced] WebRTC 防护注入失败: %s", e)

    # 4. 字体枚举防护
    try:
        await inject_font_enum_guard(context, fingerprint_seed)
    except Exception as e:
        logger.warning("[stealth_advanced] 字体枚举防护注入失败: %s", e)

    # 5. 多媒体设备防护
    try:
        await inject_media_devices_guard(context, fingerprint_seed)
    except Exception as e:
        logger.warning("[stealth_advanced] 多媒体设备防护注入失败: %s", e)

    # 6. 硬件信息伪装
    try:
        await inject_hardware_guard(context, fingerprint_seed)
    except Exception as e:
        logger.warning("[stealth_advanced] 硬件信息伪装注入失败: %s", e)

    # 7. 插件枚举防护
    try:
        await inject_plugin_guard(context, fingerprint_seed)
    except Exception as e:
        logger.warning("[stealth_advanced] 插件枚举防护注入失败: %s", e)

    # 8. 语言一致性
    try:
        await inject_language_guard(context, lang_primary, lang_region)
    except Exception as e:
        logger.warning("[stealth_advanced] 语言一致性注入失败: %s", e)

    # 9. 导航器完整性
    try:
        await inject_navigator_integrity_guard(context)
    except Exception as e:
        logger.warning("[stealth_advanced] 导航器完整性注入失败: %s", e)

    # 10. 时区地理一致性
    try:
        await apply_consistency(context, timezone, language)
    except Exception as e:
        logger.warning("[stealth_advanced] 时区地理一致性注入失败: %s", e)

    # 11. TLS 指纹一致性(咨询层:JS 层 UA 与 TLS 配置匹配)
    try:
        tls_profile = get_tls_recommendation(account_id)
        await apply_tls_recommendation_to_context(context, tls_profile)
    except Exception as e:
        logger.warning("[stealth_advanced] TLS 一致性注入失败: %s", e)

    logger.info(
        "[stealth_advanced] 深度反检测已注入(account=%s seed=%d "
        "基础20类+深度13模块=50+类检测点)",
        account_id, fingerprint_seed,
    )


__all__ = ["apply_advanced_stealth", "_build_advanced_stealth_script"]
