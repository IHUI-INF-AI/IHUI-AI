"""字体枚举防护 — 拦截字体探测 API,返回账号绑定的字体白名单。

检测原理:站点通过 document.fonts.check / Canvas 文本测量(offsetWidth/offsetHeight)
探测已安装字体。不同系统安装的字体不同(如 Windows 有微软雅黑,macOS 没有),
字体列表是强设备指纹。

对抗策略:
1. 拦截 document.fonts / FontFaceSet.prototype.check,返回字体存在性白名单
2. 拦截 Canvas 文本测量,对 offsetWidth/offsetHeight 加 ±1 像素噪声
3. 维护账号绑定的字体白名单(15 中文字体 + 20 英文字体)
4. 字体白名单基于账号种子确定选择(同账号跨会话一致)

字体白名单设计:
- 15 个常见中文字体(微软雅黑/宋体/黑体/楷体等)
- 20 个常见英文字体(Arial/Times New Roman/Calibri 等)
- 基于账号种子从池中选择子集(同账号固定,不同账号差异)
"""
from __future__ import annotations

from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


# 中文字体池(15 个常见中文字体)
_CN_FONT_POOL: list[str] = [
    "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体",
    "KaiTi", "楷体", "FangSong", "仿宋", "STXihei", "华文细黑",
    "STKaiti", "华文楷体", "STSong", "华文宋体", "STFangsong", "华文仿宋",
    "Microsoft JhengHei", "微軟正黑體",
]

# 英文字体池(20 个常见英文字体)
_EN_FONT_POOL: list[str] = [
    "Arial", "Arial Black", "Arial Narrow", "Calibri", "Calibri Light",
    "Cambria", "Candara", "Comic Sans MS", "Consolas", "Constantia",
    "Corbel", "Courier New", "Franklin Gothic Medium", "Gabriola",
    "Georgia", "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype",
    "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana",
]


def _select_fonts_for_account(account_seed: int) -> list[str]:
    """基于账号种子确定性选择字体白名单(同账号固定)。"""
    # 用 mulberry32 算法从池中选择子集
    seed = account_seed & 0xFFFFFFFF
    def _rand() -> float:
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
        t = seed
        t = (t ^ (t >> 15)) * (t | 1)
        t ^= t + ((t ^ (t >> 7)) * (t | 61))
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    # 从中文池选 10 个,英文池选 15 个
    cn_selected = sorted(
        _CN_FONT_POOL, key=lambda _: _rand(),
    )[:min(10, len(_CN_FONT_POOL))]
    en_selected = sorted(
        _EN_FONT_POOL, key=lambda _: _rand(),
    )[:min(15, len(_EN_FONT_POOL))]
    return cn_selected + en_selected


def _build_font_enum_script(account_seed: int) -> str:
    """构建字体枚举防护 JS 脚本。"""
    allowed_fonts = _select_fonts_for_account(account_seed)
    # 构建字体白名单 JS 数组字符串
    fonts_js = ", ".join(f"'{f}'" for f in allowed_fonts)
    return f"""
(function() {{
  'use strict';

  // 账号绑定的字体白名单(同账号跨会话一致)
  var _allowedFonts = [{fonts_js}];
  var _fontSet = new Set(_allowedFonts.map(function(f) {{ return f.toLowerCase(); }}));

  // ---- 1. document.fonts / FontFaceSet.prototype.check ----
  try {{
    if (document.fonts && document.fonts.check) {{
      var _origCheck = document.fonts.check.bind(document.fonts);
      document.fonts.check = function(font, text) {{
        // 解析 font 简写中的字体名(如 "12px Arial" → "Arial")
        try {{
          var fontNames = font.match(/["']?([^"']+?)["']?(?:,|$)/g);
          if (fontNames) {{
            for (var i = 0; i < fontNames.length; i++) {{
              var name = fontNames[i].replace(/["']/g, '').replace(/,\\s*$/, '').trim().toLowerCase();
              if (_fontSet.has(name)) {{
                return true;
              }}
            }}
            return false;
          }}
        }} catch (e) {{}}
        return _origCheck(font, text);
      }};
    }}
  }} catch (e) {{}}

  // ---- 2. Canvas 文本测量防护(offsetWidth/offsetHeight ±1 噪声)----
  // 检测原理:站点创建 span,设置 font-family: 'TargetFont', fallback,
  // 测量 offsetWidth 与 fallback 对比,推断字体是否安装。
  // 对抗:对含 font-family style 的元素 offsetWidth/offsetHeight 加 ±1 像素噪声。
  try {{
    var _origOffsetW = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetWidth');
    if (_origOffsetW && _origOffsetW.get) {{
      Object.defineProperty(Element.prototype, 'offsetWidth', {{
        get: function() {{
          var v = _origOffsetW.get.call(this);
          // 仅对 span/div 元素且设置了 font-family 时扰动
          if (this.tagName === 'SPAN' || this.tagName === 'DIV') {{
            try {{
              var style = this.style;
              if (style && style.fontFamily) {{
                var seed = {account_seed} >>> 0;
                var noise = (seed % 3) - 1;  // -1, 0, 1
                return v + noise;
              }}
            }} catch (e) {{}}
          }}
          return v;
        }},
        configurable: true,
      }});
    }}
    var _origOffsetH = Object.getOwnPropertyDescriptor(Element.prototype, 'offsetHeight');
    if (_origOffsetH && _origOffsetH.get) {{
      Object.defineProperty(Element.prototype, 'offsetHeight', {{
        get: function() {{
          var v = _origOffsetH.get.call(this);
          if (this.tagName === 'SPAN' || this.tagName === 'DIV') {{
            try {{
              var style = this.style;
              if (style && style.fontFamily) {{
                var seed = {account_seed} >>> 0;
                var noise = (seed % 3) - 1;
                return v + noise;
              }}
            }} catch (e) {{}}
          }}
          return v;
        }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}

  // ---- 3. measureText 防护(Canvas 文本测量)----
  try {{
    var _origMeasureText = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function(text) {{
      var metrics = _origMeasureText.call(this, text);
      try {{
        // 对 width 加微小噪声(±0.5px,破坏字体探测对比)
        var seed = {account_seed} >>> 0;
        var noise = (seed % 2 === 0) ? 0.5 : -0.5;
        // measureText 返回 TextMetrics 对象,width 是只读属性
        try {{
          return new Proxy(metrics, {{
            get: function(target, prop) {{
              if (prop === 'width') {{
                return target.width + noise;
              }}
              return target[prop];
            }},
          }});
        }} catch (e) {{
          return metrics;
        }}
      }} catch (e) {{
        return metrics;
      }}
    }};
  }} catch (e) {{}}

}})();
"""


async def inject_font_enum_guard(
    context: BrowserContext, account_seed: int,
) -> None:
    """对 BrowserContext 注入字体枚举防护脚本。

    拦截 document.fonts.check / Canvas 文本测量 / offsetWidth/offsetHeight,
    返回账号绑定的字体白名单,防止字体枚举指纹探测。

    Args:
        context: Playwright BrowserContext(async)
        account_seed: 账号种子(同账号固定),用于确定性字体白名单选择
    """
    script = _build_font_enum_script(account_seed)
    await context.add_init_script(script)
    fonts = _select_fonts_for_account(account_seed)
    logger.debug(
        "[font_enum_guard] 字体枚举防护已注入(seed=%d,白名单 %d 字体)",
        account_seed, len(fonts),
    )


__all__ = ["inject_font_enum_guard", "_build_font_enum_script"]
