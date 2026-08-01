"""导航器属性完整性校验 — 拦截 navigator 核心属性,确保与真实浏览器一致。

检测原理:平台通过检查 navigator.webdriver / navigator.platform / navigator.vendor /
navigator.languages / window.chrome / navigator.maxTouchPoints 等核心属性判断
是否为自动化浏览器。属性间不一致(如 UA 显示 Chrome 但 navigator.vendor 不是
'Google Inc.')是强自动化信号。

对抗策略:
1. 拦截 navigator.webdriver,返回 false 并删除原型属性
2. 拦截 navigator.languages,返回 ['zh-CN', 'zh', 'en']
3. 拦截 navigator.platform,与 UA 一致(Win32/MacIntel/Linux x86_64)
4. 拦截 navigator.vendor,返回 'Google Inc.'
5. 拦截 navigator.maxTouchPoints,返回 0(桌面浏览器)
6. 拦截 window.chrome,返回真实 Chrome 对象
7. 防止 Object.defineProperty 被检测(patch 防反检测)
"""
from __future__ import annotations

from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_navigator_integrity_script() -> str:
    """构建导航器完整性校验 JS 脚本。"""
    return """
(function() {
  'use strict';

  // ---- 1. navigator.webdriver → false + 删除原型属性 ----
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: function() { return false; },
      configurable: true,
    });
  } catch (e) {}
  try { delete Navigator.prototype.webdriver; } catch (e) {}
  // 兜底:在实例上也定义
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: function() { return false; },
      configurable: true,
    });
  } catch (e) {}

  // ---- 2. navigator.languages ----
  try {
    Object.defineProperty(navigator, 'languages', {
      get: function() { return ['zh-CN', 'zh', 'en']; },
      configurable: true,
    });
  } catch (e) {}

  // ---- 3. navigator.platform(与 UA 一致)----
  try {
    var _ua = navigator.userAgent || '';
    var _platform = 'Win32';
    if (_ua.indexOf('Macintosh') > -1 || _ua.indexOf('Mac OS X') > -1) {
      _platform = 'MacIntel';
    } else if (_ua.indexOf('Linux') > -1 && _ua.indexOf('Android') === -1) {
      _platform = 'Linux x86_64';
    } else if (_ua.indexOf('Windows') > -1) {
      _platform = 'Win32';
    }
    Object.defineProperty(navigator, 'platform', {
      get: function() { return _platform; },
      configurable: true,
    });
  } catch (e) {}

  // ---- 4. navigator.vendor ----
  try {
    var _ua2 = navigator.userAgent || '';
    var _vendor = 'Google Inc.';
    if (_ua2.indexOf('Safari') > -1 && _ua2.indexOf('Chrome') === -1) {
      _vendor = 'Apple Computer, Inc.';
    }
    Object.defineProperty(navigator, 'vendor', {
      get: function() { return _vendor; },
      configurable: true,
    });
  } catch (e) {}

  // ---- 5. navigator.maxTouchPoints(桌面浏览器 = 0)----
  try {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: function() { return 0; },
      configurable: true,
    });
  } catch (e) {}

  // ---- 6. window.chrome(模拟真实 Chrome 对象)----
  try {
    if (!window.chrome) {
      window.chrome = {};
    }
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: function() {
          return {
            onDisconnect: { addListener: function() {} },
            onMessage: { addListener: function() {} },
          };
        },
        sendMessage: function() {},
      };
    }
    if (!window.chrome.csi) {
      window.chrome.csi = function() {
        return { onloadT: Date.now(), startE: Date.now(), pageT: {} };
      };
    }
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function() {
        return {
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
        };
      };
    }
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
      };
    }
  } catch (e) {}

  // ---- 7. 防止 Object.defineProperty 被反检测 ----
  // 检测原理:站点通过 Object.defineProperty(navigator, 'webdriver', {...})
  // 抛异常来判断属性是否已被 patch。如果抛 TypeError,说明已被拦截 → 判定为自动化。
  // 对抗:重写 defineProperty,对 navigator 属性的 defineProperty 静默成功(不抛异常)。
  try {
    var _origDP = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
      // 对 Navigator 实例的 defineProperty 静默成功(不实际修改,避免覆盖我们的 patch)
      if (obj === navigator || (obj instanceof Navigator)) {
        try {
          return _origDP.call(Object, obj, prop, descriptor);
        } catch (e) {
          // 静默失败(返回原对象,不抛异常)
          return obj;
        }
      }
      return _origDP.call(Object, obj, prop, descriptor);
    };
  } catch (e) {}

  // ---- 8. navigator.permissions API(增强)----
  try {
    if (navigator.permissions && navigator.permissions.query) {
      var _origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function(params) {
        if (params && params.name === 'notifications') {
          return Promise.resolve({
            state: 'default',
            onchange: null,
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return true; },
          });
        }
        return _origQuery(params);
      };
    }
  } catch (e) {}

  // ---- 9. navigator.webdriver getter 深度隐藏 ----
  // 部分检测器通过 Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')
  // 检查属性是否存在。删除原型上的描述符。
  try {
    var _desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
    if (_desc) {
      // 用 undefined 替换(部分浏览器接受)
      try { Navigator.prototype.__defineGetter__('webdriver', function() { return undefined; }); } catch (e) {}
    }
  } catch (e) {}

})();
"""


async def inject_navigator_integrity_guard(context: BrowserContext) -> None:
    """对 BrowserContext 注入导航器完整性校验脚本。

    拦截 navigator.webdriver/platform/vendor/languages/maxTouchPoints/window.chrome/
    permissions/defineProperty,确保导航器属性与真实浏览器一致,防止属性不一致检测。

    Args:
        context: Playwright BrowserContext(async)
    """
    script = _build_navigator_integrity_script()
    await context.add_init_script(script)
    logger.debug("[navigator_integrity] 导航器完整性已注入(9 类拦截点)")


__all__ = [
    "inject_navigator_integrity_guard",
    "_build_navigator_integrity_script",
]
