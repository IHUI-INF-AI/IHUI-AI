# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""从 assets/images/logo.png 生成 mobile-rn 的 App 图标与开屏源资源(全部入库)。

用法:  python scripts/regen-app-icons.py
依赖:  Pillow

产出:
  assets/icon.png                    1024  实心黑方(iOS 不允许透明;Android legacy 兜底)
  assets/adaptive-icon.png           1024  透明前景(Android 自适应图标,图形落在 66% 安全区内)
  assets/splash-icon.png             1024  透明前景(开屏 logo,iOS / EAS 通用)
  assets/splash/drawable-{density}/splashscreen_logo.png
                                           Android 开屏图(288dp 画布 + 居中 logo),
                                           由 plugins/withSplash.cjs 在 prebuild 时写入原生 res

为什么需要 withSplash 插件(实测结论):
  - 图标:Expo prebuild 读 app.json 的 icon / android.adaptiveIcon 自动生成(含
    mipmap-anydpi-v26 + ic_launcher_foreground),已验证生效,本脚本无需代劳。
  - Android 开屏:本项目未装 expo-splash-screen,走 @expo/prebuild-config 的 legacy 分支,
    该分支**不会写 drawable-*/splashscreen_logo.png**,原生目录里留的是 Android 模板自带的
    灰白占位图(品红对照实验已证实);且 styles.xml 的 windowBackground 直接指向该 png 会被
    拉伸填满屏幕(变形)。故改用自定义 config plugin 落图,并把 windowBackground 指向
    layer-list(gravity=center,不缩放)。
  - android/ 与 ios/ 都被 .gitignore,EAS 构建时重新 prebuild,所以源图必须放在 assets/ 入库。

换 logo:替换 assets/images/logo.png 后重跑本脚本,再重新出包。
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/images/logo.png"
AST = ROOT / "assets"
BLACK = (0, 0, 0, 255)
# logo.png 画布 2534 见方,方板本体 alpha 外接框为 79..2455,先裁掉自带留边再缩放
BBOX = (79, 79, 2455, 2455)
# Expo legacy splash:画布 288dp,logo 宽取 imageWidth(200dp),各密度乘 dimensionsMultiplier
SPLASH_CANVAS_DP = 288
SPLASH_LOGO_DP = 200
SPLASH_MULT = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

tile = Image.open(SRC).convert("RGBA").crop(BBOX)


def _strip_black_plate(image: Image.Image) -> Image.Image:
    """把 logo 自带的黑方板抠成透明,只留品牌图形。

    方板与图形靠亮度区分(方板 luma≈0,图形为浅色渐变 luma>120),
    4..30 做软过渡保住抗锯齿边缘;合到黑底上与抠图前逐像素一致(max diff ≤12, RMS 0.22)。
    """
    out = image.copy()
    alpha = out.getchannel("A")
    mask = out.convert("L").point(
        lambda v: 0 if v <= 4 else (255 if v >= 30 else (v - 4) * 255 // 26)
    )
    out.putalpha(ImageChops.multiply(alpha, mask))
    return out


def on_black(size: int, ratio: float = 1.0) -> Image.Image:
    """实心黑方底 + 居中图形(圆角外的透明区填黑,iOS 与 legacy 均安全)。"""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * ratio)
    off = (size - inner) // 2
    canvas.alpha_composite(tile.resize((inner, inner), Image.LANCZOS), (off, off))
    flat = Image.new("RGBA", (size, size), BLACK)
    flat.alpha_composite(canvas)
    return flat.convert("RGB")


def foreground(size: int, ratio: float = 0.63) -> Image.Image:
    """透明前景;ratio 保证图形落在自适应图标中心 66% 安全区内不被遮罩裁切。"""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * ratio)
    off = (size - inner) // 2
    canvas.alpha_composite(tile.resize((inner, inner), Image.LANCZOS), (off, off))
    return canvas


def splash_mark(size: int) -> Image.Image:
    """透明底开屏图形:抠掉黑方板后按最大边贴合 size,再居中放置。"""
    mark = _strip_black_plate(tile)
    bbox = mark.getchannel("A").getbbox()
    if bbox:
        mark = mark.crop(bbox)
    scale = min(size / mark.width, size / mark.height)
    w = max(1, round(mark.width * scale))
    h = max(1, round(mark.height * scale))
    mark = mark.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((size - w) // 2, (size - h) // 2))
    return canvas


def splash_drawable(canvas_px: int, logo_px: int) -> Image.Image:
    """复现 Expo legacy 行为:288dp 底色画布 + 居中 logo(宽 imageWidth dp)。"""
    canvas = Image.new("RGBA", (canvas_px, canvas_px), BLACK)
    mark = splash_mark(logo_px)
    canvas.alpha_composite(mark, ((canvas_px - logo_px) // 2, (canvas_px - logo_px) // 2))
    return canvas.convert("RGB")


def main() -> None:
    on_black(1024).save(AST / "icon.png", optimize=True)
    foreground(1024).save(AST / "adaptive-icon.png", optimize=True)
    splash_mark(1024).save(AST / "splash-icon.png", optimize=True)

    for density, mult in SPLASH_MULT.items():
        out_dir = AST / "splash" / f"drawable-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        splash_drawable(round(SPLASH_CANVAS_DP * mult), round(SPLASH_LOGO_DP * mult)).save(
            out_dir / "splashscreen_logo.png", optimize=True
        )

    print(
        "已生成 App 图标/开屏源资源:"
        "assets/{icon,adaptive-icon,splash-icon}.png + assets/splash/drawable-*"
    )


if __name__ == "__main__":
    main()
