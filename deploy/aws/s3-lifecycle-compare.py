#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""比较「声明」与「线上」S3 生命周期配置,判漂移。

判据(2026-11-07 立,对应 P2-2):
  ① **内容**比较,不是条数比较 —— 改 Expiration.Days 而条数不变必须判漂移;
  ② 输入不可判定(缺文件/非法 JSON/无 Rules 数组/声明为空)⇒ 退出码 2,绝不当「无漂移」;
  ③ 漂移 ⇒ 退出码 1(调用方据此让 job 红),无漂移 ⇒ 0。

用法: s3-lifecycle-compare.py <declared.json> <current.json>
"""

import json
import sys


def rule_key(rule):
    """规则的规范化字符串:键排序 + 紧凑分隔符,避免键序差异造成假漂移。"""
    return json.dumps(rule, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def load(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def main(argv):
    if len(argv) != 3:
        print('::error::用法: s3-lifecycle-compare.py <declared.json> <current.json>')
        return 2
    try:
        declared = load(argv[1])
        current = load(argv[2])
    except (OSError, ValueError) as exc:
        print('::error::读取/解析生命周期配置失败: %s' % exc)
        return 2

    if not isinstance(declared, dict) or not isinstance(declared.get('Rules'), list):
        print('::error::声明缺少 Rules 数组 —— 判据失明,不得判「无漂移」')
        return 2
    if not isinstance(current, dict) or not isinstance(current.get('Rules'), list):
        print('::error::线上配置缺少 Rules 数组 —— 判定不可用')
        return 2

    d_rules = declared['Rules']
    c_rules = current['Rules']
    if not d_rules:
        print('::error::声明 Rules 为空 —— 判据失明,不得判「无漂移」')
        return 2

    if sorted(rule_key(r) for r in d_rules) == sorted(rule_key(r) for r in c_rules):
        print('✅ 无漂移:声明 %d 条 == 线上 %d 条,逐条内容一致' % (len(d_rules), len(c_rules)))
        return 0

    print('::error::检测到 S3 生命周期配置漂移(桶见 job 输入)')
    print('声明 %d 条 / 线上 %d 条' % (len(d_rules), len(c_rules)))

    d_map = {str(r.get('ID')): r for r in d_rules if isinstance(r, dict) and r.get('ID') is not None}
    c_map = {str(r.get('ID')): r for r in c_rules if isinstance(r, dict) and r.get('ID') is not None}
    for rid in sorted(set(d_map) - set(c_map)):
        print('  声明有、线上缺: %s' % rid)
    for rid in sorted(set(c_map) - set(d_map)):
        print('  线上有、声明缺: %s' % rid)
    for rid in sorted(set(d_map) & set(c_map)):
        if rule_key(d_map[rid]) != rule_key(c_map[rid]):
            print('  内容不一致: %s' % rid)
            print('    声明: %s' % rule_key(d_map[rid]))
            print('    线上: %s' % rule_key(c_map[rid]))
    # 没有 ID 的规则(理论上 AWS 要求 ID,这里兜底只报条数口径差异)
    if not d_map and not c_map:
        print('  两端口径无 ID 可对齐,按规范化内容整体比较即已判漂移')
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
