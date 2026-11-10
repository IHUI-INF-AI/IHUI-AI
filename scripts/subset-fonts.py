#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""
字体子集化 + WOFF2 转换(2026-11-10 重写:从"源码扫描窄子集"升级为"按字重分档的 GB2312 宽子集")。

## 为什么重写(病灶与实测真值)
原实现只把「源代码里出现过的字符」打进子集,实测产出 4016 码位 / 汉字 2292 个 ——
GB2312 一级 3755 字里缺 2178 个,二级 3008 字里缺 2981 个。
于是运行时动态中文(用户昵称、知识库标题、AI 回答、Agent 名称)大量落在子集之外,
按 --font-sans 回退链换成交互式系统字体渲染,同一行里两种字面并存 = 用户看到的
「一个粗一个细、看着不像一个字体」。2026-11-10 真 Chromium 夹具截图复现并取证。

## 分档策略(体积与覆盖的取舍,数字为 2026-11-10 实测)
| 档 | 字符集 | 码位 | 单面体积 | 理由 |
|---|---|---|---|---|
| Regular(400) | 源码扫描 ∪ GB2312 一级 ∪ 二级 | 9175 | 1033 KB | 正文是动态中文主战场(AI 回答/文档/昵称),必须最全 |
| Medium(500)  | 源码扫描 ∪ GB2312 一级 | 6194 | 629 KB | 强调/次级标题,动态文案以一级字为主 |
| Bold(600-700)| 源码扫描 ∪ GB2312 一级 | 6194 | 632 KB | 标题档,同上 |
| Thin(100) / Light(300) | 源码扫描(窄) | 4016 | ~350 KB | 全站几乎不用,不为它付体积 |
营销首页另有更窄的 Home 子集(见 apps/web/app/(marketing)/marketing-fonts.css,FEO 决策),本脚本不碰。

## 输入 / 输出
输入: <src-dir>/HarmonyOS_Sans_SC_{Thin,Light,Regular,Medium,Bold}.ttf
      (官方 zip 解出;源目录用 --src-dir 指定,默认按 lib 解析,不写死盘符)
      ⚠ 源目录必须含 **SC 简体**面(官方 zip 里的 HarmonyOS_Sans_SC/)。同 zip 里的
      HarmonyOS_Sans/(拉丁变体)只有 ~146KB / 874 码位 / 0 汉字,切出来全是空面 ⇒
      脚本在 preflight 阶段就按「GB2312 一级覆盖率」判它不是 SC 面并 exit 2。
输出: apps/web/public/fonts/HarmonyOS_SansSC_{Weight}.{tier-tag}.woff2
      scripts/font-subset-chars.txt        三面宽档字符集并集(供其他工具与守门读取)
      scripts/font-subset-unicode-range.txt **分档** unicode-range 描述(2026-11-10 起:
        口径由「并集单行」改为「每档一段」;各档 range 取该档产出字体的**实际 cmap**,
        逐码位合并连续段生成 —— 写成整段(如 U+4E00-9FFF)会与 rare 档重叠,
        浏览器按声明顺序取先声明的那一面 ⇒ 罕见字仍换脸)
      scripts/data/font-subset-manifest.json 逐面码位数/体积/缺字哨兵结果(守门对账用)

## 用法
  python scripts/subset-fonts.py --dry-run          # 只统计,不写盘
  python scripts/subset-fonts.py                    # 实际生成 + 缺字哨兵自检
  python scripts/subset-fonts.py --src-dir <目录>    # 指定官方 TTF 所在目录
  python scripts/subset-fonts.py --patch-globals-css  # 顺带把 globals.css 的 @font-face
                                                  # 与本脚本产出的 range 对齐(幂等)
  python scripts/subset-fonts.py --self-test        # 判据自检(不碰真字体)

## 依赖
  pip install fonttools brotli
前置缺失一律 exit 2 显式「未判定」并点名原因,绝不静默跳过(全局铁律 §0.3)。
"""
import argparse
import codecs
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "apps" / "web" / "public" / "fonts"
MANIFEST_PATH = ROOT / "scripts" / "data" / "font-subset-manifest.json"
CHARS_PATH = ROOT / "scripts" / "font-subset-chars.txt"
RANGE_PATH = ROOT / "scripts" / "font-subset-unicode-range.txt"

# 窄档沿用既有文件名(.subset.woff2)原位刷新,不产生孤儿文件;宽档另起 tier 段文件名,
# 浏览器/边缘缓存按 URL 键控,字符集变更即换名刷新(与 Home 窄子集 v1 命名纪律一致)。
TIER_NARROW = "subset"
TIER_L1 = "gb2312-l1"
TIER_L12 = "gb2312-l12"
# 罕见字面(2026-11-10 新增):GBK 全集里 regular 档(GB2312 一二级 + 96 生僻字等)之外的汉字。
# 命名纪律:tier 名**不得**含 `gb2312` 前缀 —— 门 313 的基线棘轮只钉 `tier.startsWith('gb2312')`
# 的档(`scripts/check-typography-face-coverage.mjs` 的 checkSubsetRatchet / --update-baseline),
# 带该前缀会被自动纳入棘轮;`gbk-rare` 不含 ⇒ 基线无需更新。
TIER_GBK_RARE = "gbk-rare"

# (权重名, CSS 字重, 字符集档)
WEIGHTS = [
    ("Thin", 100, TIER_NARROW),
    ("Light", 300, TIER_NARROW),
    ("Regular", 400, TIER_L12),
    ("Medium", 500, TIER_L1),
    ("Bold", 700, TIER_L1),
]

# 罕见字面(只做 Regular 400):标题里的罕见字同理会换脸,但先做 400 档;
# Medium/Bold 留待后续(每个字重档都要单独切,不能只切一面)。
#
# ⚠ rare **不能**跟其它档同批构建:rare 的字符集要减掉 regular 产出面的**实际** cmap
# (只减请求集不够 —— `--layout-features=*` 的字形闭包会多带字进来,实测多出 U+2039),
# 重叠 ⇒ 罕见字被 regular 面抢走 ⇒ 换脸;而"实际 cmap"只有切出 regular 面之后才知道
# ⇒ rare 必须**后切**(见 main 的两阶段构建)。
RARE_WEIGHTS = [
    ("Regular", 400, TIER_GBK_RARE),
]

# 只有这些档往 globals.css 写 unicode-range(400 档两面必须严格互补);
# 其余字重档本轮不写 —— 它们各自只有一面,不存在"抢字"问题,写 range 只会徒增 CSS 体积。
RANGED_TIERS = (TIER_L12, TIER_GBK_RARE)

# globals.css 里的品牌族名(补丁只认本脚本自己产的 HarmonyOS 档,不碰 EDIX 等外部面)
BRAND_FAMILY = "HarmonyOS Sans SC"
GLOBALS_CSS = ROOT / "apps" / "web" / "app" / "globals.css"

# 缺字哨兵词表:2026-10 起真机报"忽粗忽细"时抽样出的高频动态中文(姓名/勋章/技术词/昵称)。
# 生成后逐字核验宽档必须全覆盖 —— 任一字缺失即判失败,防止子集无声缩水回潮。
SENTINEL_WORDS = [
    "魏鑫焱彪桐勤鲁卓越勋章熔断锤",
    "客户张经理反馈贵司产品的鲁棒性与可扩展性极佳值得采购",
    "本次迭代涵盖鉴权限流熔断灰度发布回滚监控大盘等能力",
    "恭喜获得卓越贡献者勋章请前往个人中心查看徽章与积分",
    "星空下的旅人王大锤德彪雨桐考勤记录已同步",
    "华区营销复盘与明年规划纲要知识库检索命中率提升至",
]

# 中文人名高频生僻字(GB2312 之外,却常见于真实用户昵称/姓名)。
# 来源口径:取名常用字清单 + 本项目昵称场景高频字人工归集,现读去重 96 字(见 manifest.sentinel.nameChars);
# 成本实测约 +30KB/面,收益是"昵称不再半路换脸"——昵称是本仓最高频的动态中文渲染面。
# 这些字 GB2312 一级/二级都没有,必须显式打进宽档。
NAME_RARE_CHARS = (
    "翀赟燚犇骉猋麤龘芈昱昀暄燊璟珅瑀甯頔翊弢钤荩淼垚堃芃甡旻旸晞烨煊煜珩琰瑾瑜"
    "祎禛禹翎舟蕤虢郗隽姝婳嫚彧昶胤荏葳蕙樾棣栾槿檀沅洢浠淞滢潆熹燮珣瑄璆舸芩芮"
    "苒荀荞荻蒽蕖薏藜虬蠡衎贲赉趸骊骐鲲鹍麈馥囍曦"
)

DEFAULT_SRC_CANDIDATES = [
    ROOT / "apps" / "web" / "public" / "fonts",
    Path("D:/DevEnv/cache/harmonyos-font-src/unzip/HarmonyOS Sans/HarmonyOS_Sans_SC"),
    ROOT / ".ihui-agent" / "tmp" / "harmony-sc-src",
]

# ===== RN(RN 原生字体栈)专档 =====
# RN 原生**不吃 woff2**(只认 TTF/OTF),且字体栈只取**第一个族名**
# (react-native-css-interop 的 parseFontFamily(fontFamily[0]))⇒ RN 端必须自带一套 TTF 面。
RN_OUT_DIR = ROOT / "apps" / "mobile-rn" / "assets" / "fonts"
# RN 侧现读的 fontWeight 取值分布(apps/mobile-rn + packages/app + packages/ui-native):
#   600×1224 / 700×357 / 500×200 / 300×7 / 400×5 / 'bold'×4 / 800×1
# ⇒ 必须切的面 = 300/400/500/700 四个(600/800 由 Bold 面显式代打,登记在
#   apps/mobile-rn/app.config.js 的 android XML font-family 里,不许平台隐式猜)。
RN_WEIGHTS = [
    ("Light", 300, TIER_NARROW),
    ("Regular", 400, TIER_L12),
    ("Medium", 500, TIER_L1),
    ("Bold", 700, TIER_L1),
]
# RN 的 name 表必须保住 16/17(typographic family/subfamily):
# 源字体的 Medium/Light/Thin/Black 面的 nameID 1 是旧式族名(如 'HarmonyOS Sans SC Medium'),
# 靠 nameID 16='HarmonyOS Sans SC' 才归到同一族;丢掉 16/17 ⇒ iOS/CoreText 认不出同族多字重面
# ⇒ 500/700 只能落到 Regular 面(换脸)。web 的 woff2 路径保持 --name-IDs=1,2,3,4,6 不变。
RN_NAME_IDS = "1,2,3,4,6,16,17"


def collect_used_chars() -> set:
    """扫描 web + i18n 源代码,收集所有用到的字符(窄档基线,也是宽档的并集底座)。"""
    chars = set()
    scan_dirs = [
        ROOT / "apps" / "web" / "app",
        ROOT / "apps" / "web" / "src",
        ROOT / "packages" / "ui" / "src",
        ROOT / "packages" / "i18n" / "src",
    ]
    messages_dirs = [
        ROOT / "apps" / "web" / "messages",
        ROOT / "apps" / "desktop" / "src" / "i18n" / "messages",
        ROOT / "apps" / "extension" / "src" / "i18n" / "messages",
        ROOT / "apps" / "mobile-rn" / "src" / "i18n" / "messages",
        ROOT / "apps" / "miniapp-taro" / "src" / "i18n",
    ]
    extensions = {".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md"}
    for scan_dir in scan_dirs + messages_dirs:
        if not scan_dir.exists():
            continue
        for path in scan_dir.rglob("*"):
            if not path.is_file() or path.suffix not in extensions:
                continue
            if any(part in path.parts for part in ("node_modules", ".next", "dist", "build")):
                continue
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for ch in content:
                if ch.isprintable() or ch in ("\n", "\t", " "):
                    chars.add(ch)
    return chars


def gb2312_level1():
    return _gb2312_range(0xB0, 0xD7)


def gb2312_level2():
    return _gb2312_range(0xD8, 0xF7)


def _gb2312_range(hi_lo, hi_hi):
    dec = codecs.getdecoder("gb2312")
    out = set()
    for hi in range(hi_lo, hi_hi + 1):
        for lo in range(0xA1, 0xFF):
            try:
                ch, _ = dec(bytes([hi, lo]))
            except (UnicodeDecodeError, ValueError):
                continue
            if ch:
                out.add(ch)
    return out


def gbk_codepoints() -> set:
    """GBK(CP936)全集的**码位**集合(双字节区穷举)。

    形状照 `_gb2312_range`:按双字节区间穷举 + 解码器校验。GB2312 解码器解不了
    GBK 扩展区,必须换成 `codecs.getdecoder("gbk")`;hi 0x81–0xFE × lo 0x40–0xFE,
    跳过 lo == 0x7F(GBK 双字节区第二字节的空洞)。

    ⚠ 返回**码位(int)**,不是字符 —— `gb2312_level1()/level2()` 返回的是字符集合,
    两者混用会让集合运算恒为空(GBK 扩展字全部落进 rare 档,体积从 2.1MB 涨到 3.1MB)。
    """
    dec = codecs.getdecoder("gbk")
    out = set()
    for hi in range(0x81, 0xFF):
        for lo in range(0x40, 0xFF):
            if lo == 0x7F:
                continue
            try:
                ch, _ = dec(bytes([hi, lo]))
            except (UnicodeDecodeError, ValueError):
                continue
            if ch:
                out.add(ord(ch))
    return out


def source_codepoints(ttf: Path) -> set:
    """源字体 TTF 的实际 cmap 码位(切面时能被切进去的码位上限)。"""
    from fontTools.ttLib import TTFont

    font = TTFont(str(ttf), lazy=True)
    try:
        return set(font.getBestCmap().keys())
    finally:
        font.close()


def face_codepoints(woff2: Path) -> set:
    """产出 woff2 的实际 cmap 码位 —— unicode-range 必须按它算(不是按请求字符集算)。

    差在哪:① 源字体没有的字切不进去;② `--layout-features=*` 的字形闭包会**多带**几个
    字进来(实测 U+2039:不在请求集里,却出现在产出面里)。按请求集算 range ⇒ range 与
    实际字面不符 ⇒ 要么声明了没有的字(浏览器据此不取该面),要么漏掉了实际有的字。
    """
    from fontTools.ttLib import TTFont

    font = TTFont(str(woff2), lazy=True)
    try:
        return set(font.getBestCmap().keys())
    finally:
        font.close()


def build_rare_charset(src_cmap: set, regular_face_cps: set) -> set:
    """罕见字面的字符集 = (GBK 全集 ∩ 源字体 cmap) − regular 面**实际**已有的码位。

    减的是 regular **产出面**的实际码位(不是请求集):只有这样两张面才严格互补 ——
    互补是浏览器"按 range 命中哪一面"的唯一依据,重叠 ⇒ 罕见字被 regular 面抢走 ⇒ 换脸。
    """
    return {chr(cp) for cp in (gbk_codepoints() & src_cmap) - regular_face_cps}


def build_charset(used: set, tier: str) -> set:
    """按档组装最终字符集。

    窄档 = 源码扫描 + ASCII/Latin + CJK 标点/全角(保持原行为,Thin/Light 用)。
    一级 = 窄档 ∪ GB2312 一级 3755 字。
    一级+二级 = 一级 ∪ GB2312 二级 3008 字。
    """
    final = set(used)
    for cp in range(0x0020, 0x0250):
        final.add(chr(cp))
    for cp in range(0x3000, 0x3040):
        final.add(chr(cp))
    for cp in range(0xFF00, 0xFFF0):
        final.add(chr(cp))
    if tier in (TIER_L1, TIER_L12):
        final |= gb2312_level1()
        final |= set(NAME_RARE_CHARS)
    if tier == TIER_L12:
        final |= gb2312_level2()
    return final


def compute_unicode_ranges(chars: set) -> str:
    """字符集 → unicode-range 段列表(连续码位合并成段)。

    支持非 BMP(>0xFFFF):CSS unicode-range 允许最多 6 位十六进制,实测 chars.txt 里有
    41 个非 BMP 码位 —— 旧实现用 `0x20 <= ord(c) <= 0xFFFF` 直接丢弃它们,range 与
    实际字面不符(声明少了 ⇒ 浏览器不取该面)。
    """
    codepoints = sorted({ord(c) for c in chars if ord(c) >= 0x20})
    if not codepoints:
        return "U+0020-007F"
    ranges = []
    start = end = codepoints[0]
    for cp in codepoints[1:]:
        if cp == end + 1:
            end = cp
        else:
            ranges.append((start, end))
            start = end = cp
    ranges.append((start, end))
    return ", ".join(
        f"U+{_fmt_hex(s)}" + (f"-{_fmt_hex(e)}" if e > s else "") for s, e in ranges
    )


def _fmt_hex(cp: int) -> str:
    """码位 → 十六进制串(BMP 4 位,更高位按需加宽到 5/6 位)。

    区间记法是 U+<起>-<止>(前缀只出现一次)—— 与既有 range 文件同口径,
    门 313 的 JS 侧用同一套补零规则重算,两边 sha 必须相等。
    """
    if cp <= 0xFFFF:
        return f"{cp:04X}"
    if cp <= 0xFFFFF:
        return f"{cp:05X}"
    return f"{cp:06X}"


def _fmt_cp(cp: int) -> str:
    """码位 → CSS unicode-range 单点记法(U+XXXX)。"""
    return f"U+{_fmt_hex(cp)}"


def wrap_range(range_text: str, width: int = 96) -> str:
    """把 range 段列表按行宽折行(纯排版;CSS 声明值里换行是合法的)。

    断行处**保留逗号**:丢逗号会让续行与上一行粘成一个 token(range 解析即失效)。
    """
    lines = []
    cur = ""
    for token in range_text.split(", "):
        piece = token if not cur else cur + ", " + token
        if len(piece) > width and cur:
            lines.append(cur + ",")
            cur = token
        else:
            cur = piece
    if cur:
        lines.append(cur)
    return "\n".join(lines)


def face_report(dst: Path, charset: set) -> dict:
    """产出面的实测报告:实际 cmap 码位数 / range 段数 / range sha256。

    sha256 取的是**规范化后的 range 文本**(码位升序、连续段合并、", " 分隔),
    门 313 用同一套规范化算法从 globals.css 的声明侧重算并比对 ⇒ 两端口径必须一致。
    """
    cps = face_codepoints(dst)
    rng = compute_unicode_ranges({chr(c) for c in cps})
    return {
        "charset": len(charset),
        "faceCodepoints": len(cps),
        "rangeSegments": len(rng.split(", ")),
        "rangeSha": hashlib.sha256(rng.encode("utf-8")).hexdigest(),
        "range": rng,
        "codepoints": cps,
    }


def cjk_count(chars: set) -> int:
    """字符集里的汉字数(口径与既有 manifest/基线一致:U+4E00–U+9FFF)。"""
    return sum(1 for c in chars if 0x4E00 <= ord(c) <= 0x9FFF)

def resolve_src_dir(explicit: str) -> Path:
    """源 TTF 目录:--src-dir 优先,否则按候选序取存在者(不写死盘符)。"""
    if explicit:
        p = Path(explicit)
        return p if p.exists() else None
    for cand in DEFAULT_SRC_CANDIDATES:
        if cand.exists() and any(cand.glob("HarmonyOS_Sans_SC_*.ttf")):
            return cand
    return None


def preflight() -> list:
    """依赖自检:fonttools + brotli 必须可用。返回问题清单(空=可跑)。"""
    problems = []
    try:
        import fontTools  # noqa: F401
    except Exception as exc:
        problems.append(f"缺 fonttools({exc});出路: pip install fonttools brotli")
    try:
        import brotli  # noqa: F401
    except Exception:
        problems.append("缺 brotli(woff2 压缩必需);出路: pip install brotli")
    return problems


def subset_one_weight(src_dir: Path, name: str, weight: int, tier: str, charset: set, dry: bool,
                      flavor: str = "woff2", out_dir: Path | None = None,
                      stem: str | None = None, name_ids: str = "1,2,3,4,6"):
    """切一个字重面。

    flavor / out_dir / stem / name_ids 可配(2026-11-10 RN 改造立):
      - 默认档(woff2 + apps/web/public/fonts + 原档名 + name-IDs=1,2,3,4,6)**逐字节不变**;
      - RN 档(flavor=ttf)走同一套分档逻辑,只是输出 TTF 且保住 nameID 16/17。
    """
    tag = f"{name.lower()}-{tier}"
    src = src_dir / f"HarmonyOS_Sans_SC_{name}.ttf"
    ext = "ttf" if flavor == "ttf" else flavor
    dst = (out_dir or FONTS_DIR) / (stem or f"HarmonyOS_SansSC_{name}.{tier}.{ext}")
    if not src.exists():
        return {"weight": name, "css_weight": weight, "tier": tier, "skipped": True,
                "reason": f"源文件不存在: {src}", "dst": dst.name}
    if dry:
        return {"weight": name, "css_weight": weight, "tier": weight and tier,
                "src_kb": src.stat().st_size // 1024, "chars": len(charset), "dst": dst.name}
    text = "".join(sorted(charset))
    cmd = [
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--output-file={dst}", f"--text={text}",
        # fontTools 只认 woff/woff2 两种 flavor;TTF 是默认输出格式,不能带 --flavor。
        *( [f"--flavor={flavor}"] if flavor != "ttf" else [] ),
        "--no-hinting", "--desubroutinize", "--layout-features=*",
        "--drop-tables+=DSIG", f"--name-IDs={name_ids}",
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or b"").decode("utf-8", errors="replace")[:400]
        return {"weight": name, "css_weight": weight, "tier": tier, "error": True,
                "stderr": err, "dst": dst.name, "tag": tag}
    size = dst.stat().st_size if dst.exists() else 0
    return {"weight": name, "css_weight": weight, "tier": tier, "chars": len(charset),
            "bytes": size, "kb": round(size / 1024), "dst": dst.name, "tag": tag}


def check_sentinel(charsets: dict) -> dict:
    """缺字哨兵:正文宽档(regular 400 两面并集)必须吃掉全部哨兵词与姓名高频生僻字。

    覆盖面 = gb2312-l12 ∪ gbk-rare(两面互补 ⇒ 合起来才是 regular 400 的全部可渲染汉字)。
    哨兵词本身都在 GB2312 内 ⇒ 落在 gb2312-l12 面;把 rare 并进来是为了让口径
    与"400 档两面并集"一致(将来哨兵里加 GBK 扩展字时不会被漏判)。
    """
    wide = charsets.get(TIER_L12)
    if not wide:
        return {"ok": False, "reason": "未生成宽档字符集,无法判定"}
    covered = set(wide) | set(charsets.get(TIER_GBK_RARE) or ())
    missing = []
    for word in SENTINEL_WORDS:
        for ch in word:
            if "\u4e00" <= ch <= "\u9fff" and ch not in covered:
                missing.append(ch)
    name_missing = [c for c in NAME_RARE_CHARS if "\u4e00" <= c <= "\u9fff" and c not in covered]
    return {"ok": not missing and not name_missing,
            "missing": "".join(sorted(set(missing + name_missing))),
            "words": len(SENTINEL_WORDS),
            "nameChars": len(set(NAME_RARE_CHARS))}


# ── globals.css 补丁(幂等)────────────────────────────────────────────────────
FONT_FACE_BLOCK_RE = re.compile(r"@font-face\s*\{[^}]*\}", re.S)


def _block_family_weight(block: str):
    fam = re.search(r"font-family\s*:\s*([^;]+);", block)
    wt = re.search(r"font-weight\s*:\s*([^;]+);", block)
    return (fam.group(1).strip() if fam else ""), (wt.group(1).strip() if wt else "")


def _weight_covers(block_weight: str, want: int) -> bool:
    """块里声明的字重区间是否覆盖 want(600 700 覆盖 600 与 700)。"""
    nums = []
    for tok in str(block_weight).lower().split():
        if tok == "normal":
            nums.append(400)
        elif tok == "bold":
            nums.append(700)
        elif tok.isdigit():
            nums.append(int(tok))
    return bool(nums) and min(nums) <= want <= max(nums)


def _css_range_decl(range_text: str, indent: str = "  ") -> str:
    """range 文本 → CSS 声明(多行折行,末行带分号)。

    注意:wrap_range 已经在行尾留了逗号,这里**不得**再补 —— 否则会出现 "U+0020-007F,,"。
    """
    lines = wrap_range(range_text, 96).split("\n")
    if len(lines) == 1:
        return f"{indent}unicode-range: {lines[0]};"
    out = [f"{indent}unicode-range: {lines[0]}"]
    for line in lines[1:-1]:
        out.append(f"{indent}  {line}")
    out.append(f"{indent}  {lines[-1]};")
    return "\n".join(out)


def patch_globals_css(reports: list) -> list:
    """把指定档的精确 unicode-range 写回 globals.css 的 @font-face(幂等)。

    只动本脚本自己产的 HarmonyOS 档(文件名带 tier 段),不碰 EDIX 等外部面;
    只处理 RANGED_TIERS(400 档两面),其余字重档本轮不动。
    返回人读的动作清单(空 = 无改动)。
    """
    actions = []
    text = GLOBALS_CSS.read_text(encoding="utf-8")
    for rep in reports:
        if rep["tier"] not in RANGED_TIERS:
            continue
        dst = rep["dst"]
        decl = _css_range_decl(rep["range"])
        block = None
        for m in FONT_FACE_BLOCK_RE.finditer(text):
            if dst in m.group(0):
                block = m
                break
        if block is not None:
            old = block.group(0)
            if "unicode-range:" in old:
                new = re.sub(r"unicode-range\s*:\s*[^;]+;", lambda _m: decl, old, count=1)
                kind = "更新 range"
            else:
                idx = old.rfind("}")
                new = old[:idx] + decl + "\n" + old[idx:]
                kind = "补 range"
            if new != old:
                text = text[: block.start()] + new + text[block.end():]
                actions.append(f"{kind}: {dst}")
            continue
        # 没有这一面 ⇒ 新增(插到同族同字重的最后一面之后)
        anchor = None
        for m in FONT_FACE_BLOCK_RE.finditer(text):
            fam, wt = _block_family_weight(m.group(0))
            if BRAND_FAMILY in fam and _weight_covers(wt, rep["css_weight"]):
                anchor = m
        if anchor is None:
            actions.append(f"跳过(找不到同族同字重的锚点面): {dst}")
            continue
        new_block = (
            "@font-face {\n"
            f"  font-family: '{BRAND_FAMILY}';\n"
            f"  font-weight: {rep['css_weight']};\n"
            "  font-style: normal;\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/{dst}') format('woff2');\n"
            f"{decl}\n"
            "}"
        )
        text = text[: anchor.end()] + "\n" + new_block + text[anchor.end():]
        actions.append(f"新增面: {dst}")
    if actions:
        GLOBALS_CSS.write_text(text, encoding="utf-8", newline="\n")
    return actions


def run_self_test() -> int:
    """判据自检:不碰真字体,验字表组装/哨兵/区间计算三件事。"""
    fails = []
    l1, l2 = gb2312_level1(), gb2312_level2()
    if len(l1) != 3755:
        fails.append(f"GB2312 一级应为 3755,现算得 {len(l1)}")
    if len(l2) != 3008:
        fails.append(f"GB2312 二级应为 3008,现算得 {len(l2)}")
    if l1 & l2:
        fails.append("一级与二级字表不应相交")
    base = {"的", "一"}
    if not build_charset(base, TIER_NARROW) >= {"的", "一", " ", "~"}:
        fails.append("窄档底座丢失源码字符/ASCII")
    wide = build_charset(base, TIER_L12)
    for ch in "魏鑫焱彪桐勤鲁卓越勋章熔断锤":
        if ch not in wide:
            fails.append(f"宽档缺哨兵字: {ch}")
    for ch in "龘囍燚赟翀":
        if ch not in wide:
            fails.append(f"宽档缺姓名高频生僻字: {ch}")
    if "龘" in build_charset(base, TIER_NARROW):
        fails.append("窄档不该含姓名生僻字(说明分档失效)")
    if "鑫" in build_charset(base, TIER_NARROW):
        fails.append("窄档不该含二级生僻字(说明分档失效)")
    rng = compute_unicode_ranges({"a", "b", "c", "e"})
    if rng != "U+0061-0063, U+0065":
        fails.append(f"unicode-range 计算异常(4 位补零): {rng}")
    # 非 BMP:CSS unicode-range 允许最多 6 位十六进制,旧实现直接丢弃 >0xFFFF 的码位
    if compute_unicode_ranges({chr(0x20000), chr(0x2FFFF)}) != "U+20000, U+2FFFF":
        fails.append("非 BMP 区间的 unicode-range 计算异常")
    if _fmt_cp(0x20) != "U+0020" or _fmt_cp(0x1F600) != "U+1F600":
        fails.append(f"码位格式化异常: {_fmt_cp(0x20)} / {_fmt_cp(0x1F600)}")
    # GBK 全集码位(双字节区穷举):必须返回**码位**而不是字符
    gbk = gbk_codepoints()
    if len(gbk) != 21791:
        fails.append(f"GBK 双字节区码位数应为 21791,现算得 {len(gbk)}")
    if not all(isinstance(c, int) for c in gbk):
        fails.append("gbk_codepoints() 必须返回 int 码位(与字符集混用会让集合运算恒空)")
    # rare 档字符集 = (GBK∩src) − regular 产出面实际码位 ⇒ 必须与 regular 严格不相交
    src = {0x41, 0x4E00, 0x6607, 0x5570}
    regular_face = {0x41, 0x4E00}
    rare = build_rare_charset(src, regular_face)
    if {ord(c) for c in rare} & regular_face:
        fails.append("rare 字符集与 regular 产出面码位有交集(互补性失效 ⇒ 罕见字换脸)")
    if {ord(c) for c in rare} != {0x6607, 0x5570}:
        fails.append(f"rare 字符集组装异常: {sorted(hex(ord(c)) for c in rare)}")
    # 折行必须保留逗号(丢了逗号会让续行与上一行粘成一个 token)
    long_range = ", ".join(f"U+{i:04X}" for i in range(200))
    wrapped = wrap_range(long_range, 40)
    if wrapped.replace("\n", "").count(",") != long_range.count(","):
        fails.append("range 折行丢逗号")
    # 汉字计数口径必须与既有 manifest/基线一致(U+4E00–U+9FFF)
    probe = {"一", "鿿", "a", "龘"}
    if cjk_count(probe) != 3:
        fails.append(f"汉字计数口径异常: {cjk_count(probe)}")
    if resolve_src_dir("Z:/definitely-not-here") is not None:
        fails.append("--src-dir 指向不存在目录时应返回 None")
    for line in (["SELF-TEST PASS"] if not fails else ["SELF-TEST FAIL"] + fails):
        print(line)
    return 0 if not fails else 1


def merge_manifest_faces(existing_faces, produced_faces):
    """把本次产出的面并进既有清单(按 dst 去重,既有条目原样保留)。

    为什么:web 的 woff2 面与 RN 的 TTF 面**共用同一本清单**(唯一真相源),两次生成各写各的
    会把对方的面抹掉 ⇒ 清单内容随生成顺序漂移。既有条目一律原样保留,只按 dst 覆盖同名条目。
    """
    produced_dst = {f.get("dst") for f in produced_faces if f.get("dst")}
    kept = [f for f in (existing_faces or []) if f.get("dst") not in produced_dst]
    return kept + [f for f in produced_faces if f.get("dst")]


def run_rn_target(src_dir: Path, args) -> int:
    """RN 档:切 TTF 面到 apps/mobile-rn/assets/fonts,并登记进同一本清单。

    与 web 档**共用** build_charset 的分档逻辑(同一套字表口径),只换输出格式与落盘目录。
    RN 不吃 woff2 ⇒ flavor=ttf;name 表保住 16/17 ⇒ iOS/CoreText 认得出同族多字重面。
    """
    out_dir = Path(args.out_dir) if args.out_dir else RN_OUT_DIR
    flavor = args.flavor or "ttf"
    print("=" * 64)
    print(f"字体子集化 · RN 档(flavor={flavor})")
    print("=" * 64)
    print(f"[1/3] 源目录: {src_dir}")
    print(f"[2/3] 输出目录: {out_dir}")

    used = collect_used_chars()
    print(f"      源码字符 {len(used)} 个")
    charsets = {}
    for tier in (TIER_NARROW, TIER_L1, TIER_L12):
        charsets[tier] = build_charset(used, tier)
        print(f"      {tier:<12} 码位={len(charsets[tier])} 汉字={cjk_count(charsets[tier])}")

    results = []
    for name, weight, tier in RN_WEIGHTS:
        r = subset_one_weight(src_dir, name, weight, tier, charsets[tier], args.dry_run,
                              flavor=flavor, out_dir=out_dir,
                              stem=f"HarmonyOS_Sans_SC_{name}.ttf", name_ids=RN_NAME_IDS)
        if not r.get("skipped") and not r.get("error"):
            # RN 的 dst 记仓库相对路径(web 档记的是裸档名,两端口径必须分得开)
            try:
                r["dst"] = str((out_dir / r["dst"]).relative_to(ROOT)).replace("\\", "/")
            except ValueError:
                r["dst"] = str(out_dir / r["dst"]).replace("\\", "/")
            r["tag"] = f"{name.lower()}-{tier}-rn"
        results.append(r)
        if r.get("skipped"):
            print(f"      [{name}] SKIP {r['reason']}")
        elif r.get("error"):
            print(f"      [{name}] ERROR {r['stderr'][:120]}")
        elif args.dry_run:
            print(f"      [{name}] src={r['src_kb']}KB chars={r['chars']} -> {r['dst']}")
        else:
            print(f"      [{name}] {r['kb']}KB chars={r['chars']} -> {r['dst']}")

    sentinel = check_sentinel(charsets)
    if not sentinel.get("ok"):
        print(f"      ❌ 哨兵未过: {sentinel.get('missing') or sentinel.get('reason')}")
    else:
        print(f"      ✅ 哨兵 {sentinel['words']} 词全覆盖")

    if args.dry_run:
        print("\nDry run 完成,未写盘。")
        return 0 if sentinel.get("ok") else 1

    # 只登记 RN 的面:tiers/sentinel 归 web 档那次生成管,RN 档不覆写它们的读数。
    manifest = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}
    manifest.setdefault("generatedBy", "scripts/subset-fonts.py")
    manifest["faces"] = merge_manifest_faces(manifest.get("faces"), results)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\n清单   -> {MANIFEST_PATH.relative_to(ROOT)}")
    print("下一步:在 apps/mobile-rn/app.config.js 的 expo-font config plugin 里登记这些面")
    return 0 if sentinel.get("ok") else 1


def write_range_file(reports: list) -> None:
    """写分档 unicode-range 描述(头部写明口径变化)。

    口径变化(2026-11-10):由「并集单行」改为「每面一段」——
      · 各段取该档产出 woff2 的**实际 cmap** 逐码位合并连续段生成(不是请求字符集,
        也不是整段区间;整段如 U+4E00-9FFF 会与 gbk-rare 面重叠 ⇒ 浏览器按序取
        regular 面 ⇒ 罕见字仍换脸);
      · 每段前给出该面的码位数/段数/sha256(与 manifest.faces 对账);
      · 断行保留逗号,续行缩进两格。
    """
    lines = [
        "# 字体子集 unicode-range(分档;2026-11-10 起由「并集单行」改为「每面一段」)",
        "#",
        "# 读取约定:'#' 开头为注释;'[<产物文件名>]' 开头为该面的 range 段,续行缩进两格,",
        "#           段之间以逗号分隔(断行处逗号保留)。",
        "# 互补约束:[gb2312-l12 面] 与 [gbk-rare 面] 的码位交集必须为空 —— 浏览器按",
        "#           unicode-range 命中哪一面,两面都命中时按声明顺序取先声明的那一面 ⇒",
        "#           重叠 = 罕见字被 regular 面抢走 = 换脸。该约束由 scripts/subset-fonts.py",
        "#           在生成时断言(非空即非零退出,且不写清单)。",
        "",
    ]
    for rep in reports:
        lines.append(f"# ── 档 {rep['tier']} · {rep['dst']} ──")
        lines.append(
            f"# 码位 {rep['faceCodepoints']} / 段 {rep['rangeSegments']} / sha256 {rep['rangeSha']}"
        )
        body = wrap_range(rep["range"], 96).split("\n")
        lines.append(f"[{rep['dst']}] {body[0]}")
        for extra in body[1:]:
            lines.append(f"  {extra}")
        lines.append("")
    RANGE_PATH.write_text("\n".join(lines), encoding="utf-8", newline="\n")


def main():
    parser = argparse.ArgumentParser(description="字体子集化 + WOFF2 转换(分档宽子集)")
    parser.add_argument("--dry-run", action="store_true", help="只统计,不生成文件")
    parser.add_argument("--src-dir", default="", help="官方 HarmonyOS_Sans_SC_*.ttf 所在目录")
    parser.add_argument("--self-test", action="store_true", help="判据自检(不碰真字体)")
    parser.add_argument(
        "--target",
        choices=["web", "rn"],
        default="web",
        help="web=woff2 档(默认,既有行为不变);rn=TTF 档(RN 原生只吃 TTF)",
    )
    parser.add_argument(
        "--flavor",
        choices=["woff2", "ttf"],
        default="",
        help="输出 flavor;缺省按 --target 取(web=woff2 / rn=ttf)",
    )
    parser.add_argument("--out-dir", default="", help="输出目录(缺省按 --target 取)")
    parser.add_argument(
        "--patch-globals-css",
        action="store_true",
        help="把本脚本产出的精确 unicode-range 写回 globals.css 的 @font-face(幂等)",
    )
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    print("=" * 64)
    print("字体子集化 + WOFF2 转换(GB2312 分档宽子集 + GBK 罕见字面)")
    print("=" * 64)

    problems = preflight()
    if problems:
        for p in problems:
            print(f"❌ 前置缺失: {p}")
        print("未判定 —— 不静默跳过,不产出半成品字体")
        return 2

    src_dir = resolve_src_dir(args.src_dir)
    if src_dir is None:
        print("❌ 未判定: 找不到 HarmonyOS_Sans_SC_*.ttf 源文件")
        print(f"   已查: {[str(p) for p in DEFAULT_SRC_CANDIDATES]}")
        print("   出路: 取官方 HarmonyOS Sans zip 解压后 --src-dir <HarmonyOS_Sans_SC 目录> 重跑")
        return 2

    if args.target == "rn":
        return run_rn_target(src_dir, args)

    print(f"[1/6] 源目录: {src_dir}")

    print("[2/6] 扫描源代码字符...")
    used = collect_used_chars()
    print(f"      源码字符 {len(used)} 个")

    print("[3/6] 组装分档字符集...")
    charsets = {}
    for tier in (TIER_NARROW, TIER_L1, TIER_L12):
        charsets[tier] = build_charset(used, tier)
        print(f"      {tier:<12} 码位={len(charsets[tier])} 汉字={cjk_count(charsets[tier])}")

    print(f"[4/6] {'预览' if args.dry_run else '生成'} {len(WEIGHTS)} 个常规字重档...")
    results = []
    for name, weight, tier in WEIGHTS:
        r = subset_one_weight(src_dir, name, weight, tier, charsets[tier], args.dry_run)
        results.append(r)
        if r.get("skipped"):
            print(f"      [{name}] SKIP {r['reason']}")
        elif r.get("error"):
            print(f"      [{name}] ERROR {r['stderr'][:120]}")
        elif args.dry_run:
            print(f"      [{name}] src={r['src_kb']}KB chars={r['chars']} -> {r['dst']}")
        else:
            print(f"      [{name}] {r['kb']}KB chars={r['chars']} -> {r['dst']}")

    # ── 阶段二:罕见字面(必须后切)───────────────────────────────────────────
    print("[5/6] 组装并生成罕见字面(gbk-rare)...")
    regular_face = FONTS_DIR / f"HarmonyOS_SansSC_Regular.{TIER_L12}.woff2"
    src_cmap = source_codepoints(src_dir / "HarmonyOS_Sans_SC_Regular.ttf")
    gbk_in_src = gbk_codepoints() & src_cmap
    if not regular_face.exists():
        print("      ❌ 未判定: regular 产出面不存在(先跑一次不带 --dry-run)")
        return 2
    regular_cps = face_codepoints(regular_face)
    rare_chars = build_rare_charset(src_cmap, regular_cps)
    charsets[TIER_GBK_RARE] = rare_chars
    print(
        f"      gbk-rare      码位={len(rare_chars)} 汉字={cjk_count(rare_chars)}"
        f"(GBK∩源字体={len(gbk_in_src)} − regular 实际 cmap={len(regular_cps)})"
    )
    for name, weight, tier in RARE_WEIGHTS:
        r = subset_one_weight(src_dir, name, weight, tier, charsets[tier], args.dry_run)
        results.append(r)
        if r.get("skipped"):
            print(f"      [{name}] SKIP {r['reason']}")
        elif r.get("error"):
            print(f"      [{name}] ERROR {r['stderr'][:120]}")
        elif args.dry_run:
            print(f"      [{name}] src={r['src_kb']}KB chars={r['chars']} -> {r['dst']}")
        else:
            print(f"      [{name}] {r['kb']}KB chars={r['chars']} -> {r['dst']}")

    # ── 阶段三:实测产出面 + 互补断言 + 哨兵 ────────────────────────────────
    print("[6/6] 实测产出面 + 互补断言 + 缺字哨兵...")
    reports = []
    absent = []
    for r in results:
        if r.get("skipped") or r.get("error"):
            continue
        dst = FONTS_DIR / r["dst"]
        if not dst.exists():
            absent.append(r["dst"])
            continue
        rep = face_report(dst, charsets[r["tier"]])
        rep.update(
            {
                "dst": r["dst"],
                "tier": r["tier"],
                "weight": r["weight"],
                "css_weight": r["css_weight"],
                "chars": len(charsets[r["tier"]]),
                "bytes": dst.stat().st_size,
                "kb": round(dst.stat().st_size / 1024),
                "tag": r.get("tag", ""),
            }
        )
        reports.append(rep)
        print(
            f"      {r['dst']:<46} 实际码位={rep['faceCodepoints']} 段={rep['rangeSegments']} {rep['kb']}KB"
        )
    if absent:
        print(f"      ⚠ 产出面尚不存在(dry-run 预览): {', '.join(absent)}")

    by_tier = {rep["tier"]: rep for rep in reports}
    regular_rep = by_tier.get(TIER_L12)
    rare_rep = by_tier.get(TIER_GBK_RARE)
    if not regular_rep or not rare_rep:
        print("      ⚠ 未判定: regular/rare 产出面缺失,互补性本轮不发言")
    else:
        overlap = regular_rep["codepoints"] & rare_rep["codepoints"]
        if overlap:
            sample = "".join(sorted(chr(c) for c in overlap))[:60]
            print(f"      ❌ 两面交集非空({len(overlap)} 码位,例: {sample})")
            print(
                "         ⇒ 浏览器按 unicode-range 命中哪一面会有歧义,罕见字仍换脸;"
                "已中止,未写清单/range/globals.css"
            )
            return 1
        print(
            f"      ✅ 互补: gb2312-l12({regular_rep['faceCodepoints']}) ∩ "
            f"gbk-rare({rare_rep['faceCodepoints']}) = 0"
        )

    sentinel = check_sentinel(charsets)
    if not sentinel.get("ok"):
        print(f"      ❌ 哨兵未过: {sentinel.get('missing') or sentinel.get('reason')}")
    else:
        print(f"      ✅ 哨兵 {sentinel['words']} 词全覆盖")

    if args.dry_run:
        print("\nDry run 完成,未写盘。去掉 --dry-run 实际生成。")
        return 0 if sentinel.get("ok") else 1

    # ── 写盘 ────────────────────────────────────────────────────────────────
    union = charsets[TIER_L12]
    CHARS_PATH.write_text("".join(sorted(union)), encoding="utf-8", newline="\n")
    write_range_file(reports)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest_faces = []
    for rep in reports:
        manifest_faces.append(
            {
                "weight": rep["weight"],
                "css_weight": rep["css_weight"],
                "tier": rep["tier"],
                "chars": rep["chars"],
                "faceCodepoints": rep["faceCodepoints"],
                "rangeSegments": rep["rangeSegments"],
                "rangeSha": rep["rangeSha"],
                "bytes": rep["bytes"],
                "kb": rep["kb"],
                "dst": rep["dst"],
                "tag": rep["tag"],
            }
        )
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "generatedBy": "scripts/subset-fonts.py",
                "tiers": {
                    t: {"codepoints": len(c), "cjk": cjk_count(c)} for t, c in charsets.items()
                },
                "faces": manifest_faces,
                "sentinel": sentinel,
                "complementary": {
                    "note": "regular(400) 与 rare(400) 两面的实际 cmap 交集必须为空",
                    "regular": regular_rep["dst"] if regular_rep else None,
                    "rare": rare_rep["dst"] if rare_rep else None,
                    "overlap": 0,
                },
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"\n字符集 -> {CHARS_PATH.relative_to(ROOT)}")
    print(f"range  -> {RANGE_PATH.relative_to(ROOT)}")
    print(f"清单   -> {MANIFEST_PATH.relative_to(ROOT)}")
    if args.patch_globals_css:
        actions = patch_globals_css(reports)
        for act in actions:
            print(f"globals.css -> {act}")
        if not actions:
            print("globals.css -> 无改动")
    else:
        print(
            "下一步: 跑 `python scripts/subset-fonts.py --patch-globals-css` 把精确 range "
            "写回 globals.css,再跑字体守门对账"
        )
    return 0 if sentinel.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
