# -*- coding: utf-8 -*-
"""
koubo_terms.py — 口播稿术语/歧义压缩统一词表 (v1.0)
2026-07-14 用户强制·零容忍·根绝复发

本模块是【唯一权威源】，所有 BANNED_AMBIG_COMP / TERM_CANONICAL_DICT 定义
必须从本模块 import，禁止在 koubo_validate.py / koubo_live_check.py /
koubo_quality_gate.py / scan_ambig.py / scan_canonical.py 重复定义。

历史背景：
  - 2026-07-14 0714 A8 "AI龙老师"事故
  - 后续扫描发现 0629-0713 共 16 处同类歧义压缩 + 3 处跨稿词表混用
  - 用户原话："这种问题不可以再发生 不可以这么压缩 请彻底杜绝！！"

三处脚本必须统一 import 本模块：
  from koubo_terms import BANNED_AMBIG_COMP, TERM_CANONICAL_DICT, ALL_BANNED_ALIASES
"""
import re
from typing import List, Tuple

# ════════════════════════════════════════════════
# 1. 歧义压缩 4 类正则（BANNED_AMBIG_COMP）
# ════════════════════════════════════════════════
# ① 姓氏+职业压缩：AI+可选单字+职业（"AI龙老师""AI博士"听者会以为"姓X的XX"）
# ② 模糊倍数：动词+可选修饰+中文数字+倍（"差了一倍""涨了3倍"听者无法精确判断）
# ③ 未核实具体数字：动词+数字+量词+未核实的"订阅/销量"等
# ④ 行业术语嵌套生造：agent/智能体/AI/大模型+壳/芯/核等+再次壳/芯/核等
BANNED_AMBIG_COMP: List[re.Pattern] = [
    re.compile(r'AI[\u4e00-\u9fff]?(老师|博士|医生|律师|教练|经理|教授|总监|主任|同学|学员|校长|教练员)'),
    re.compile(r'(差|涨|跌|降|多|少|高|低|大|小|快|慢|翻|多花了|少花了|省了|亏了|赚了|多赚|少赚|多花|少花)(了|了整整|了近|了足足)?(差不多|大概)?[一二两三四五六七八九]倍'),
    re.compile(r'(多卖|少卖|多赚|少赚|多花|少花|多省|少省|多占|少占)(了)?[\d一二三四五六七八九十百千万]+(万|千|百|个|套|件|份|元|块|%)[^，。！？]{0,4}(订阅|销量|份额|用户|客户|下载|安装)'),
    re.compile(r'(agent|智能体|AI|大模型)(壳|芯|核|心|层|面|体|族|群|圈)[\u4e00-\u9fff]{0,3}(壳|芯|核|心|层|面|体)'),
]

# ════════════════════════════════════════════════
# 2. 跨稿统一词表（TERM_CANONICAL_DICT）
# ════════════════════════════════════════════════
# 格式：(推荐写法, 禁用别名1, 禁用别名2, ...)
# 规则：第一次出现必须用推荐写法，后续可用任意形式但推荐全稿统一
# 2026-07-14 增量补全：增加 "AI研究方向博士" 等高频推荐写法
TERM_CANONICAL_DICT: List[Tuple[str, ...]] = [
    ('深圳龙岗"龙老师"AI教育产品矩阵', 'AI龙老师', '龙老师矩阵'),
    ('阶跃星辰STEPX Neo', 'Neo手机', '智能体手机（仅指代STEPX Neo时）'),
    ('Claude Fable 5', 'Fable 5模型'),
    ('字节豆包', '豆包AI'),
    ('挑战者公司（Challenger Gray & Christmas）报告', '挑战者报告'),
    ('复旦肖仰华教授', '复旦教授', '肖教授'),
    ('字节Seedream 5.0 Pro', 'Seedream 5.0', '字节图像编辑模型'),
    ('腾讯混元HyOCR-1.5', 'HyOCR-1.5（首次）', '混元OCR'),
    ('阶跃星辰Step AOS', 'Step AOS系统'),
    ('阶跃星辰Amoo智能体', 'Amoo智能体（首次）'),
    ('OpenAI Codex', 'Codex（无厂商）'),
    ('阶跃星辰交互副屏', '交互副屏（无产品名）'),
    # 2026-07-14 增量补全：避免"AI博士"再次出现
    ('AI研究方向博士', 'AI博士'),
    ('AI系统架构博士', 'AI架构博士'),
    # 2026-07-14 增量补全：避免产品/项目再被压缩
    ('深圳龙岗"龙老师"AI教育产品矩阵', '龙老师AI产品'),
    # 2026-07-14 增量补全：避免"快三倍"等模糊倍数再次出现
    ('效率提升的具体百分比', '效率翻N倍', '快N倍', '慢N倍'),
    # 2026-07-14 增量补全：避免"产能翻倍"等口语化表达再次出现
    ('产能提升的具体百分比', '产能翻倍', '产能翻N倍'),
    # 2026-07-14 增量补全：避免"订单量翻倍"等
    ('订单量是去年同期的倍数', '订单量翻N倍', '订单翻倍'),
    # 2026-07-14 增量补全：避免"价格涨了N倍"
    ('价格涨幅的具体百分比', '价格涨N倍', '涨价翻倍'),
]

# ════════════════════════════════════════════════
# 3. 别名扁平化（便于扫描器/校验器使用）
# ════════════════════════════════════════════════
ALL_BANNED_ALIASES: List[str] = []
for _tuple in TERM_CANONICAL_DICT:
    canonical = _tuple[0]
    for alias in _tuple[1:]:
        if alias and alias not in ALL_BANNED_ALIASES:
            ALL_BANNED_ALIASES.append(alias)

# ════════════════════════════════════════════════
# 4. 检测函数（统一入口）
# ════════════════════════════════════════════════
def find_ambig_hits(text: str) -> List[dict]:
    """
    扫描文本中的 BANNED_AMBIG_COMP 命中
    返回: [{'type': 'BANNED_AMBIG', 'hit': str, 'ctx': str, 'pattern_idx': int}, ...]
    """
    hits = []
    for idx, pat in enumerate(BANNED_AMBIG_COMP):
        for m in pat.finditer(text):
            ctx = text[max(0, m.start() - 25):m.end() + 25]
            hits.append({
                'type': 'BANNED_AMBIG',
                'pattern_idx': idx,
                'hit': m.group(),
                'ctx': ctx,
            })
    return hits


def find_alias_issues(text: str, strict: bool = False) -> List[dict]:
    """
    扫描文本中的 TERM_CANONICAL_DICT 别名命中

    strict=False (默认): 别名出现但推荐写法未出现 → 报错；两者都出现 → 报错（混用）
    strict=True:          任何别名出现即报错（包括别名为推荐写法子串的情况）
    """
    issues = []
    for _tuple in TERM_CANONICAL_DICT:
        canonical = _tuple[0]
        aliases = _tuple[1:]
        for alias in aliases:
            if not alias or alias not in text:
                continue
            # 严格模式：别名出现即报错
            if strict:
                idx = text.find(alias)
                issues.append({
                    'type': 'STRICT_ALIAS',
                    'alias': alias,
                    'should': canonical,
                    'ctx': text[max(0, idx - 25):idx + len(alias) + 25],
                })
                continue
            # 普通模式：别名是推荐写法的子串 → 跳过（不算混用）
            if alias in canonical:
                continue
            # 别名出现，推荐写法未出现 → 报错
            if canonical not in text:
                idx = text.find(alias)
                issues.append({
                    'type': 'ALIAS_NO_CANONICAL',
                    'alias': alias,
                    'should': canonical,
                    'ctx': text[max(0, idx - 25):idx + len(alias) + 25],
                })
            else:
                # 别名与推荐写法都出现 → 混用警告
                idx = text.find(alias)
                issues.append({
                    'type': 'ALIAS_MIXED_WITH_CANONICAL',
                    'alias': alias,
                    'should': canonical,
                    'ctx': text[max(0, idx - 25):idx + len(alias) + 25],
                })
    return issues


def check_text(text: str, strict: bool = False) -> dict:
    """
    一站式检查入口
    返回: {'ambig_hits': [...], 'alias_issues': [...], 'total': int}
    """
    ambig_hits = find_ambig_hits(text)
    alias_issues = find_alias_issues(text, strict=strict)
    return {
        'ambig_hits': ambig_hits,
        'alias_issues': alias_issues,
        'total': len(ambig_hits) + len(alias_issues),
    }


# ════════════════════════════════════════════════
# 5. 自检（直接运行本文件时打印摘要）
# ════════════════════════════════════════════════
if __name__ == '__main__':
    print('=' * 60)
    print('koubo_terms.py v1.0 — 统一术语/歧义压缩词表')
    print('=' * 60)
    print(f'BANNED_AMBIG_COMP:  {len(BANNED_AMBIG_COMP)} 类正则')
    print(f'TERM_CANONICAL_DICT: {len(TERM_CANONICAL_DICT)} 条统一写法')
    print(f'ALL_BANNED_ALIASES:  {len(ALL_BANNED_ALIASES)} 个禁用别名')
    print('=' * 60)
