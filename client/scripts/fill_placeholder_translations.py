"""填充 placeholder 翻译.

策略:
  - 扫描 4 个非 zh-CN locale (zh-TW, en, ja, ko)
  - 找到所有 [ZH:xxx] 占位符 (值匹配占位符模式)
  - 用 zh-CN 中对应 key 的值填充
  - 这样保证所有 key 都有非占位符内容, 后续可接 AI 翻译服务批量优化

Dry-run 默认, --apply 才会修改文件.
"""
import argparse
import json
import re
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(r"G:\IHUI-AI\client\src\locales\modules")
LOCALES = ["zh-TW", "en", "ja", "ko"]
ZH_LOCALE = "zh-CN"

# 占位符/未翻译模式 (同 scan_untranslated.py)
PLACEHOLDER_PATTERN = re.compile(r"^\[ZH:.*\]$|^TODO|^FIXME|^TBD$|^xxx$|^XXX$|^placeholder$")


def find_zhcn_value(zhcn_data: dict, key: str):
    """从 zh-CN 合并数据中找到 key 的值."""
    parts = key.split(".")
    cur = zhcn_data
    for p in parts:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def load_locale_merged(locale_dir: Path) -> dict:
    """合并一个 locale 目录所有 json 文件."""
    merged = {}
    for f in sorted(locale_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        # 深 merge
        def deep_merge(t, s):
            for k, v in s.items():
                if k in t and isinstance(t[k], dict) and isinstance(v, dict):
                    deep_merge(t[k], v)
                else:
                    t[k] = v
        deep_merge(merged, data)
    return merged


def walk_and_collect(obj: dict, prefix: str, out: list[str]):
    """递归收集所有 leaf key 路径."""
    for k, v in obj.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            walk_and_collect(v, path, out)
        else:
            out.append(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际修改文件 (默认 dry-run)")
    args = ap.parse_args()

    # 加载 zh-CN
    zhcn_dir = ROOT / ZH_LOCALE
    if not zhcn_dir.exists():
        zhcn_dir = ROOT / ZH_LOCALE.lower()
    print(f"📚 加载 zh-CN from {zhcn_dir}")
    zhcn_merged = load_locale_merged(zhcn_dir)

    # 加载 4 个非 zh-CN locale
    total_filled = 0
    by_locale = {}
    by_module = defaultdict(int)

    for loc in LOCALES:
        loc_dir = ROOT / loc
        if not loc_dir.exists():
            loc_dir = ROOT / loc.lower()
        if not loc_dir.exists():
            print(f"⚠️  {loc} 目录不存在, 跳过")
            continue
        print(f"\n🔍 处理 {loc} from {loc_dir}")

        loc_filled = 0
        # 逐文件处理
        for f in sorted(loc_dir.glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"  ⚠️  解析失败 {f.name}: {e}")
                continue

            file_changed = False
            file_filled = 0

            def walk_fill(obj, prefix=""):
                nonlocal file_changed, file_filled
                for k in list(obj.keys()):
                    path = f"{prefix}.{k}" if prefix else k
                    v = obj[k]
                    if isinstance(v, dict):
                        walk_fill(v, path)
                    elif isinstance(v, str) and PLACEHOLDER_PATTERN.match(v):
                        # 是占位符, 找 zh-CN 中对应值
                        zhcn_val = find_zhcn_value(zhcn_merged, path)
                        if zhcn_val is None:
                            # zh-CN 中也找不到, 跳过
                            continue
                        if not isinstance(zhcn_val, str):
                            continue
                        # 填充
                        obj[k] = zhcn_val
                        file_changed = True
                        file_filled += 1

            walk_fill(data)

            if file_changed:
                if args.apply:
                    f.write_text(
                        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8",
                    )
                by_module[f.stem] += file_filled
                loc_filled += file_filled
                verb = "✅ 已写入" if args.apply else "[DRY]"
                print(f"  {verb} {f.name}: 填充 {file_filled} 处")

        by_locale[loc] = loc_filled
        total_filled += loc_filled

    print("\n" + "=" * 70)
    print("填充汇总")
    print("=" * 70)
    for loc, cnt in by_locale.items():
        print(f"  {loc}: {cnt} 处")
    print(f"  总计: {total_filled} 处 (跨 {len(by_module)} 个 module)")

    if not args.apply:
        print("\n⚠️  DRY-RUN 模式, 未修改任何文件")
        print("   实际填充请运行: python scripts/fill_placeholder_translations.py --apply")
    else:
        print(f"\n🎉 共填充 {total_filled} 处 (使用 zh-CN 值)")
        print("   建议: 跑 npm run check:i18n:keys -- --all 验证")
        print("   后续: 接入 AI 翻译服务批量翻译 4 个非中文 locale")


if __name__ == "__main__":
    main()
