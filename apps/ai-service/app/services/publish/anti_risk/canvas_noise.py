"""Canvas 指纹噪声增强 — 拦截 Canvas/WebGL 读取 API,注入确定性噪声。

检测原理:站点通过 CanvasRenderingContext2D.getImageData / HTMLCanvasElement.toDataURL
获取像素数据并计算哈希,作为设备指纹。同浏览器哈希稳定,不同浏览器哈希不同。

对抗策略:拦截像素读取 API,对每个像素的 RGB 通道加 ±2 的确定性噪声(基于账号种子)。
- 同账号跨会话:噪声一致(指纹稳定,避免"每次访问指纹都变"的反常特征)
- 不同账号:噪声不同(指纹差异化,避免跨账号关联)
- ±2 噪声:人眼不可见,但破坏哈希(使 Canvas 哈希与真实浏览器不同)

拦截点(4 类):
1. CanvasRenderingContext2D.prototype.getImageData
2. HTMLCanvasElement.prototype.toDataURL
3. HTMLCanvasElement.prototype.toBlob
4. WebGLRenderingContext.prototype.readPixels
"""
from __future__ import annotations

from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_canvas_noise_script(account_seed: int) -> str:
    """构建 Canvas 噪声注入 JS 脚本。

    account_seed: 账号种子(同账号固定),用于确定性噪声生成。
    """
    return f"""
(function() {{
  'use strict';

  // ---- 账号专属确定性 PRNG(mulberry32)----
  var _seed = {account_seed} >>> 0;
  function _rand() {{
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }}
  // 噪声范围:每像素 RGB 通道 ±2(人眼不可见,但破坏哈希)
  function _noiseChannel() {{
    return Math.floor(_rand() * 5) - 2;  // -2, -1, 0, 1, 2
  }}

  // ---- 1. CanvasRenderingContext2D.prototype.getImageData ----
  try {{
    var _origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {{
      var imageData = _origGetImageData.apply(this, arguments);
      try {{
        var data = imageData.data;
        // 每个像素 RGBA,只扰 RGB(跳过 Alpha)
        for (var i = 0; i < data.length; i += 4) {{
          data[i] = Math.max(0, Math.min(255, data[i] + _noiseChannel()));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + _noiseChannel()));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + _noiseChannel()));
          // Alpha 不扰动(避免透明度异常)
        }}
      }} catch (e) {{}}
      return imageData;
    }};
  }} catch (e) {{}}

  // ---- 2. HTMLCanvasElement.prototype.toDataURL ----
  try {{
    var _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {{
      try {{
        var ctx = this.getContext('2d');
        if (ctx) {{
          var w = this.width, h = this.height;
          if (w > 0 && h > 0) {{
            var imageData = ctx.getImageData(0, 0, w, h);
            // getImageData 已被拦截注入噪声,putImageData 写回再 toDataURL
            ctx.putImageData(imageData, 0, 0);
          }}
        }}
      }} catch (e) {{}}
      return _origToDataURL.apply(this, arguments);
    }};
  }} catch (e) {{}}

  // ---- 3. HTMLCanvasElement.prototype.toBlob ----
  try {{
    var _origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback) {{
      try {{
        var ctx = this.getContext('2d');
        if (ctx) {{
          var w = this.width, h = this.height;
          if (w > 0 && h > 0) {{
            var imageData = ctx.getImageData(0, 0, w, h);
            ctx.putImageData(imageData, 0, 0);
          }}
        }}
      }} catch (e) {{}}
      return _origToBlob.apply(this, arguments);
    }};
  }} catch (e) {{}}

  // ---- 4. WebGLRenderingContext.prototype.readPixels ----
  try {{
    function _patchReadPixels(proto) {{
      if (!proto || !proto.readPixels) return;
      var _origReadPixels = proto.readPixels;
      proto.readPixels = function(x, y, width, height, format, type, pixels) {{
        _origReadPixels.apply(this, arguments);
        try {{
          if (pixels && pixels.length) {{
            // WebGL 像素数据:每像素 4 字节(RGBA),扰动 RGB
            for (var i = 0; i < pixels.length; i += 4) {{
              pixels[i] = Math.max(0, Math.min(255, pixels[i] + _noiseChannel()));
              pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + _noiseChannel()));
              pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + _noiseChannel()));
            }}
          }}
        }} catch (e) {{}}
      }};
    }}
    _patchReadPixels(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
    _patchReadPixels(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  }} catch (e) {{}}

}})();
"""


async def inject_canvas_noise(context: BrowserContext, account_seed: int) -> None:
    """对 BrowserContext 注入 Canvas 指纹噪声脚本。

    拦截 getImageData/toDataURL/toBlob/readPixels,对像素 RGB 通道加 ±2 确定性噪声。
    噪声基于 account_seed 生成,同账号跨会话一致,不同账号差异。

    Args:
        context: Playwright BrowserContext(async)
        account_seed: 账号种子(同账号固定),用于确定性噪声生成
    """
    script = _build_canvas_noise_script(account_seed)
    await context.add_init_script(script)
    logger.debug(
        "[canvas_noise] Canvas 噪声已注入(seed=%d,4 类拦截点)", account_seed,
    )


__all__ = ["inject_canvas_noise", "_build_canvas_noise_script"]
