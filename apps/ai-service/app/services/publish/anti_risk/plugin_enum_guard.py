"""插件枚举防护 — 拦截 navigator.plugins/mimeTypes/permissions,返回固定值。

检测原理:navigator.plugins(插件列表)、navigator.mimeTypes(MIME 类型列表)、
navigator.permissions.query(权限查询)是稳定设备指纹。自动化浏览器可能返回空
plugins 或异常 permissions,被检测为"无头浏览器"。

对抗策略:
1. 拦截 navigator.plugins,返回固定的 PluginArray(3 个常见 PDF 插件)
2. 拦截 navigator.mimeTypes,返回固定的 MimeTypeArray
3. 拦截 navigator.permissions.query,对 notifications 返回 'default',
   对 camera/microphone 返回 'denied'

3 个常见插件:PDF Viewer / Chrome PDF Viewer / Chromium PDF Viewer
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_plugin_guard_script(account_seed: int) -> str:
    """构建插件枚举防护 JS 脚本。"""
    return f"""
(function() {{
  'use strict';

  // 账号种子(用于 groupId 等确定性值)
  var _seed = {account_seed} >>> 0;

  // ---- 1. navigator.plugins ----
  // 返回固定的 PluginArray(3 个常见 PDF 插件)
  try {{
    var _plugins = [
      {{
        name: 'PDF Viewer',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
        length: 1,
        0: {{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
      }},
      {{
        name: 'Chrome PDF Viewer',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
        length: 1,
        0: {{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
      }},
      {{
        name: 'Chromium PDF Viewer',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
        length: 1,
        0: {{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
      }},
    ];

    var _pluginArray = [];
    _plugins.forEach(function(p) {{
      var plugin = Object.create(Plugin.prototype);
      Object.defineProperty(plugin, 'name', {{ value: p.name, configurable: true }});
      Object.defineProperty(plugin, 'filename', {{ value: p.filename, configurable: true }});
      Object.defineProperty(plugin, 'description', {{ value: p.description, configurable: true }});
      Object.defineProperty(plugin, 'length', {{ value: p.length, configurable: true }});
      _pluginArray.push(plugin);
    }});

    Object.defineProperty(navigator, 'plugins', {{
      get: function() {{
        var arr = _pluginArray.slice();
        arr.item = function(i) {{ return arr[i] || null; }};
        arr.namedItem = function(n) {{
          return arr.find(function(p) {{ return p.name === n; }}) || null;
        }};
        arr.refresh = function() {{}};
        return arr;
      }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 2. navigator.mimeTypes ----
  // 返回固定的 MimeTypeArray(application/pdf)
  try {{
    var _mimeTypes = [
      {{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
      {{ type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
    ]];
    var _mimeArray = [];
    _mimeTypes.forEach(function(m) {{
      var mt = Object.create(MimeType.prototype);
      Object.defineProperty(mt, 'type', {{ value: m.type, configurable: true }});
      Object.defineProperty(mt, 'suffixes', {{ value: m.suffixes, configurable: true }});
      Object.defineProperty(mt, 'description', {{ value: m.description, configurable: true }});
      _mimeArray.push(mt);
    }});
    Object.defineProperty(navigator, 'mimeTypes', {{
      get: function() {{
        var arr = _mimeArray.slice();
        arr.item = function(i) {{ return arr[i] || null; }};
        arr.namedItem = function(n) {{
          return arr.find(function(m) {{ return m.type === n; }}) || null;
        }};
        return arr;
      }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 3. navigator.permissions.query ----
  // 对 notifications 返回 'default'(真人默认状态)
  // 对 camera/microphone 返回 'denied'(真人通常拒绝)
  try {{
    if (navigator.permissions && navigator.permissions.query) {{
      var _origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function(params) {{
        if (params && params.name) {{
          var permName = params.name.toLowerCase();
          if (permName === 'notifications') {{
            return Promise.resolve({{
              state: 'default',
              onchange: null,
              addEventListener: function() {{}},
              removeEventListener: function() {{}},
              dispatchEvent: function() {{ return true; }},
            }});
          }}
          if (permName === 'camera' || permName === 'microphone' || permName === 'geolocation') {{
            return Promise.resolve({{
              state: 'denied',
              onchange: null,
              addEventListener: function() {{}},
              removeEventListener: function() {{}},
              dispatchEvent: function() {{ return true; }},
            }});
          }}
        }}
        return _origQuery(params);
      }};
    }}
  }} catch (e) {{}}

}})();
"""


async def inject_plugin_guard(
    context: BrowserContext, account_seed: int,
) -> None:
    """对 BrowserContext 注入插件枚举防护脚本。

    拦截 navigator.plugins(3 个 PDF 插件)/ mimeTypes / permissions.query,
    返回固定值,防止插件枚举指纹探测。

    Args:
        context: Playwright BrowserContext(async)
        account_seed: 账号种子(同账号固定,用于确定性值生成)
    """
    script = _build_plugin_guard_script(account_seed)
    await context.add_init_script(script)
    logger.debug(
        "[plugin_guard] 插件枚举防护已注入(seed=%d,3 插件 + 3 类权限)",
        account_seed,
    )


__all__ = ["inject_plugin_guard", "_build_plugin_guard_script"]
