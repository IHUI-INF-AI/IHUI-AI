# -*- coding: utf-8 -*-
"""
scan_canonical.py — 跨稿统一词表一致性深度扫描 v1.1
2026-07-14 用户强制·零容忍·根绝复发

本脚本所有规则均从 koubo_terms.py 统一 import，禁止重复定义。

对 TERM_CANONICAL_DICT 内的每个产品/项目：
  1) 检查"推荐写法"是否被使用
  2) 检查"禁用别名"是否在文中出现
  3) 默认模式：别名是推荐写法子串则跳过；否则别名出现 + 推荐写法未出现 = 报错
  4) --strict 模式：任何别名出现即报错

用法：
  python scan_canonical.py             # 普通模式
  python scan_canonical.py --strict    # 严格模式
"""
import os
import re
import sys

# 统一从 koubo_terms 导入
from koubo_terms import TERM_CANONICAL_DICT, find_alias_issues


def scan_file(filepath, strict=False):
    with open(filepath, 'r', encoding='utf-8') as fp:
        content = fp.read()
    issues = []
    for issue in find_alias_issues(content, strict=strict):
        issue['file'] = filepath
        issues.append(issue)
    return issues


def main():
    strict = '--strict' in sys.argv
    files = [f for f in os.listdir('.') if re.match(r'^\d{4}\.txt$', f)]
    files.sort()
    if not files:
        print("未找到 MMDD.txt")
        return
    all_issues = []
    for f in files:
        issues = scan_file(f, strict=strict)
        all_issues.extend(issues)
    if not all_issues:
        print("=== 跨稿统一词表 0 处问题 ===" + (' [STRICT模式]' if strict else ''))
        return
    by_type = {}
    for i in all_issues:
        by_type.setdefault(i['type'], []).append(i)
    for t, lst in by_type.items():
        print(f'\n=== {t} ({len(lst)} 处) ===')
        for i in lst:
            line = f"  [{i['file']}] 别名: '{i['alias']}' → 应改: '{i['should']}'"
            print(line)
    print(f'\n=== 总计: {len(all_issues)} 处 ===' + (' [STRICT模式]' if strict else ''))


if __name__ == '__main__':
    main()
