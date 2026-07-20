# -*- coding: utf-8 -*-
"""
scan_ambig.py — 口播稿歧义压缩扫描器 v1.1
2026-07-14 用户强制·零容忍·0714 A8 事故

扫描指定 .txt 文件中的 4 类生造/压缩歧义表达：
  ① 姓氏+职业压缩（"AI博士""AI老师"等）
  ② 模糊倍数（"差了一倍""翻了三倍"等）
  ③ 未核实的具体数字（"多卖三万套订阅"等）
  ④ 生造行业术语嵌套（"agent壳""智能体壳"等）

+ 跨稿统一词表（TERM_CANONICAL_DICT）一致性检查

本脚本所有规则均从 koubo_terms.py 统一 import，禁止重复定义。

用法：
  python scan_ambig.py                      # 扫描当前目录所有 MMDD.txt
  python scan_ambig.py 0714.txt             # 扫描单个文件
  python scan_ambig.py 0714.txt 0713.txt    # 扫描多个文件
  python scan_ambig.py --strict 0714.txt    # 严格模式（任何别名出现即报错）
"""
import os
import re
import sys

# 统一从 koubo_terms 导入
from koubo_terms import BANNED_AMBIG_COMP, TERM_CANONICAL_DICT, find_ambig_hits, find_alias_issues


def scan_file(filepath, strict=False):
    with open(filepath, 'r', encoding='utf-8') as fp:
        content = fp.read()
    issues = []
    # 1) 4 类歧义压缩正则
    for hit in find_ambig_hits(content):
        hit['file'] = filepath
        issues.append(hit)
    # 2) 跨稿统一词表别名
    for issue in find_alias_issues(content, strict=strict):
        issue['file'] = filepath
        issues.append(issue)
    return issues


def main():
    strict = False
    if len(sys.argv) > 1 and sys.argv[1] == '--strict':
        strict = True
        sys.argv = [sys.argv[0]] + sys.argv[2:]
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = [f for f in os.listdir('.') if re.match(r'^\d{4}\.txt$', f)]
    if not files:
        print("未指定文件且无 MMDD.txt")
        return
    total = 0
    for f in files:
        if not os.path.exists(f):
            print('❌ 文件不存在: ' + f)
            continue
        issues = scan_file(f, strict=strict)
        total += len(issues)
        if issues:
            mode_tag = ' [STRICT]' if strict else ''
            print('\n=== ' + f + mode_tag + ' (' + str(len(issues)) + ' issues) ===')
            for i in issues:
                line = '  [' + i['type'] + '] ' + i.get('hit', i.get('alias', '?'))
                if 'should' in i:
                    line += ' → 应改 "' + i['should'] + '"'
                line += '\n    ctx: ...' + i.get('ctx', '') + '...'
                print(line)
    print('\n=== 总计: ' + str(total) + ' 处 ===' + (' [STRICT模式]' if strict else ''))
    sys.exit(0 if total == 0 else 1)


if __name__ == '__main__':
    main()
