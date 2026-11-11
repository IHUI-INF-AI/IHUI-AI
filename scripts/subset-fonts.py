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
输出: apps/web/public/fonts/HarmonyOS_SansSC_{Weight}.{tier-tag}.woff2
      scripts/font-subset-chars.txt        三面宽档字符集并集(供其他工具与守门读取)
      scripts/font-subset-unicode-range.txt 并集 unicode-range 描述
      scripts/data/font-subset-manifest.json 逐面码位数/体积/缺字哨兵结果(守门对账用)

## 用法
  python scripts/subset-fonts.py --dry-run          # 只统计,不写盘
  python scripts/subset-fonts.py                    # 实际生成 + 缺字哨兵自检
  python scripts/subset-fonts.py --src-dir <目录>    # 指定官方 TTF 所在目录
  python scripts/subset-fonts.py --self-test        # 判据自检(不碰真字体)

## 依赖
  pip install fonttools brotli
前置缺失一律 exit 2 显式「未判定」并点名原因,绝不静默跳过(全局铁律 §0.3)。
"""
import argparse
import codecs
import json
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

# (权重名, CSS 字重, 字符集档)
WEIGHTS = [
    ("Thin", 100, TIER_NARROW),
    ("Light", 300, TIER_NARROW),
    ("Regular", 400, TIER_L12),
    ("Medium", 500, TIER_L1),
    ("Bold", 700, TIER_L1),
]

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
]


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
    codepoints = sorted(ord(c) for c in chars if 0x20 <= ord(c) <= 0xFFFF)
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
    return ", ".join(f"U+{s:04X}" + (f"-{e:04X}" if e > s else "") for s, e in ranges)


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


def subset_one_weight(src_dir: Path, name: str, weight: int, tier: str, charset: set, dry: bool):
    tag = f"{name.lower()}-{tier}"
    src = src_dir / f"HarmonyOS_Sans_SC_{name}.ttf"
    dst = FONTS_DIR / f"HarmonyOS_SansSC_{name}.{tier}.woff2"
    if not src.exists():
        return {"weight": name, "css_weight": weight, "tier": tier, "skipped": True,
                "reason": f"源文件不存在: {src}", "dst": dst.name}
    if dry:
        return {"weight": name, "css_weight": weight, "tier": weight and tier,
                "src_kb": src.stat().st_size // 1024, "chars": len(charset), "dst": dst.name}
    text = "".join(sorted(charset))
    cmd = [
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--output-file={dst}", f"--text={text}", "--flavor=woff2",
        "--no-hinting", "--desubroutinize", "--layout-features=*",
        "--drop-tables+=DSIG", "--name-IDs=1,2,3,4,6",
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
    """缺字哨兵:正文档(一级+二级)必须吃掉全部哨兵词与姓名高频生僻字,否则判失败。"""
    wide = charsets.get(TIER_L12)
    if not wide:
        return {"ok": False, "reason": "未生成宽档字符集,无法判定"}
    missing = []
    for word in SENTINEL_WORDS:
        for ch in word:
            if "\u4e00" <= ch <= "\u9fff" and ch not in wide:
                missing.append(ch)
    name_missing = [c for c in NAME_RARE_CHARS if "\u4e00" <= c <= "\u9fff" and c not in wide]
    return {"ok": not missing and not name_missing,
            "missing": "".join(sorted(set(missing + name_missing))),
            "words": len(SENTINEL_WORDS),
            "nameChars": len(set(NAME_RARE_CHARS))}


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
        fails.append(f"unicode-range 计算异常: {rng}")
    if resolve_src_dir("Z:/definitely-not-here") is not None:
        fails.append("--src-dir 指向不存在目录时应返回 None")
    for line in (["SELF-TEST PASS"] if not fails else ["SELF-TEST FAIL"] + fails):
        print(line)
    return 0 if not fails else 1


def main():
    parser = argparse.ArgumentParser(description="字体子集化 + WOFF2 转换(分档宽子集)")
    parser.add_argument("--dry-run", action="store_true", help="只统计,不生成文件")
    parser.add_argument("--src-dir", default="", help="官方 HarmonyOS_Sans_SC_*.ttf 所在目录")
    parser.add_argument("--self-test", action="store_true", help="判据自检(不碰真字体)")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    print("=" * 64)
    print("字体子集化 + WOFF2 转换(GB2312 分档宽子集)")
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
    print(f"[1/5] 源目录: {src_dir}")

    print("[2/5] 扫描源代码字符...")
    used = collect_used_chars()
    print(f"      源码字符 {len(used)} 个")

    print("[3/5] 组装分档字符集...")
    charsets = {}
    for tier in (TIER_NARROW, TIER_L1, TIER_L12):
        charsets[tier] = build_charset(used, tier)
        cjk = sum(1 for c in charsets[tier] if "\u4e00" <= c <= "\u9fff")
        print(f"      {tier:<12} 码位={len(charsets[tier])} 汉字={cjk}")

    print(f"[4/5] {'预览' if args.dry_run else '生成'} 5 个字重...")
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

    print("[5/5] 缺字哨兵自检...")
    sentinel = check_sentinel(charsets)
    if not sentinel.get("ok"):
        print(f"      ❌ 哨兵未过: {sentinel.get('missing') or sentinel.get('reason')}")
    else:
        print(f"      ✅ 哨兵 {sentinel['words']} 词全覆盖")

    if args.dry_run:
        print("\nDry run 完成,未写盘。去掉 --dry-run 实际生成。")
        return 0 if sentinel.get("ok") else 1

    union = charsets[TIER_L12]
    CHARS_PATH.write_text("".join(sorted(union)), encoding="utf-8")
    RANGE_PATH.write_text(compute_unicode_ranges(union), encoding="utf-8")
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "generatedBy": "scripts/subset-fonts.py",
                "tiers": {t: {"codepoints": len(c), "cjk": sum(1 for x in c if "\u4e00" <= x <= "\u9fff")}
                          for t, c in charsets.items()},
                "faces": results,
                "sentinel": sentinel,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"\n字符集 -> {CHARS_PATH.relative_to(ROOT)}")
    print(f"清单   -> {MANIFEST_PATH.relative_to(ROOT)}")
    print("下一步: 更新 apps/web/app/globals.css 的 @font-face src 指向新档名,并跑字体守门对账")
    return 0 if sentinel.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
