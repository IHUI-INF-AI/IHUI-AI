#!/usr/bin/env python3
"""
koubo_live_check.py — 口播稿实时约束校验器 v1.0

解决"写完才验→失败→修→再验"的低效迭代循环。
在写作过程中随时调用，即时反馈所有门禁约束。

用法:
  python koubo_live_check.py "正文内容..."          # 单篇检查
  python koubo_live_check.py --all 0712.txt         # 全8篇检查
  python koubo_live_check.py --body "..." --idx 3   # 带索引检查（用于跨篇）

输出:
  - 字数 (target: 470-490)
  - 句子长度 (max: 42 hard, 33 soft)
  - "我"次数 (need: >= 8)
  - 二次冲击280-380区间转折词位置
  - 收藏价值5维预估分
  - 教练穿插检测
  - 跨篇: 但/其实/我自己/高频表达 频率
"""

import sys, re, os
from collections import Counter

# ========== 阈值（与 koubo_validate.py 完全对齐） ==========
WORD_MIN, WORD_MAX = 470, 490
SENTENCE_HARD = 42  # 硬 FAIL
SENTENCE_SOFT = 33  # 软 WARN
ME_MIN = 8
TURN_ZONE = (280, 380)

# 转折词白名单（与 validate.py line 329 完全一致）
TURN_WORDS = ['但', '却', '竟然', '居然', '原来', '结果', '没想到',
              '出乎', '反转', '不对', '其实', '事实上', '最让人',
              '更要命', '讽刺', '意外', '反过', '颠覆',
              '而且', '同时', '另外', '关键是', '问题是', '不过', '然而',
              '仔细一看', '再一看', '刺眼', '不对劲']

# 收藏价值5维关键词
COLLECT_DIMS = {
    '步骤清单': ['第一', '第二', '第三', '第一步', '第二步', '第三步', '步', '步骤', '清单', '分三步', '分两点'],
    '价格数据': ['块', '元', '价', '费', '成本', '万', '千', '百', '免费', '便宜', '贵', '省', '%', '折'],
    '工具推荐': ['工具', '用', '插件', '平台', '软件', 'App', '网站', '扫描', '模型', '接口'],
    '避坑框架': ['避坑', '别', '不要', '千万别', '警告', '注意', '小心', '防', '踩', '陷阱', '坑'],
    '方法论': ['方法', '框架', '论', '标准', '判断', '总结', '公式', '原理', '铁律', '法则', '法'],
}

# 教练词
COACH_WORDS = ['你不妨', '你试试', '你赶紧', '现在就', '先别', '别等', '不妨', '试一次', '赶紧去']

# 结尾句式判断词
ENDING_PATTERNS = {
    '行动式': ['你赶紧', '你现在就', '你试试', '试一次', '赶紧去', '先别'],
    '金句式': ['说到底', '本质', '就一句话', '最', '才是', '别踩'],
    '感慨式': ['太', '真', '确实', '感慨', '觉得', '才是真'],
}

# 2026-07-12 新规则①：开头多样化——禁止"太X了/吓一跳/炸锅了"模板化起手
BANNED_TEMPLATE_OPENINGS = [
    '太可怕了', '太吓人了', '太震惊了', '太夸张了',
    '吓我一跳', '吓了一跳', '吓死我了', '吓人',
    '炸锅了', '炸裂了', '炸了',
    '大事件', '出大事了',
    '离谱', '太离谱了',
]

# 2026-07-12 新规则③：建议自然融入——禁止结尾"建议N条/记住N点/给你N条"软清单
SOFT_LIST_ENDING_PAT = re.compile(r'(建议[一二三四五六七八九十两\d]+[条步点样件]|记住[一二三四五六七八九十两\d]+[条步点样件]|给你[一二三四五六七八九十两\d]+[条步点样件]|做到[一二三四五六七八九十两\d]+[条步点样件]|牢记[一二三四五六七八九十两\d]+[条步点样件])')

# 跨篇监控词
CROSS_WORDS = ['但', '其实', '我自己', '说白了', '真正', '很多人']

# 2026-07-14 新规则：4项口播稿结构优化软警告（WARN级别，不影响all_ok）
# 优化1·开头3句钩子公式：S2=完播承诺句, S3=完播锁钩句
S2_HOOK_PATS = ['今天', '用', '分钟', '告诉你', '讲给你']
S2_AUDIENCE_PATS = ['家长', '老板', '创业者', '打工人', '普通人', '小白', '中年', '宝妈', '上班族', '搞AI', '做内容', '做自媒体']
S3_LOCK_PATS = ['最后一个', '最狠', '最关键', '都中过', '%', '百分之', '一半', '8成', '九成', '十有八九']

# 2026-07-14 时长铁律软警告：实际视频=1.5分钟(一分半)，钩子"用X分钟"严禁写两/三分钟
BAD_DURATION_PAT = re.compile(r'用[两二三四五六七]分钟')

# 优化2·段落收尾金句类型（每篇≥2种）
PUNCHLINE_PATTERNS = {
    '概念反转': re.compile(r'不是[^，。！？]{1,15}(是|而是)'),
    '类比画面': re.compile(r'(等于|就像|好比|相当于)'),
    '数据落差': re.compile(r'(\d+[块元%万亿千百]|百分之\d+).{0,20}(却|反而|还|只|才|不如)|(\d+).{0,8}(降到|跌到|缩到|剩|只剩|不到)|(\d+).{0,6}(vs|对比|比起|比不上).{0,8}(\d+)'),
    '反共识': re.compile(r'(都说|都在|都以为|都认为|大家都).{0,15}(——|可|但|其实|反而|偏偏)'),
}

# 优化3·观点密度（含判断词的句子数≥4达标）
OPINION_WORDS = ['不是', '而是', '其实', '本质', '关键', '核心', '真正', '说白了', '底层', '真相', '根本']

# 优化4·结尾自我诊断引导（末50字含软引导词）
ENDING_DIAG_PATS = ['你对照', '你想想', '你琢磨', '等着看', '你猜', '你算算', '你盘盘', '你问问自己', '你自查', '你对号入座']

# 2026-07-14 v1.1 改造：统一从 koubo_terms 导入术语/歧义压缩词表
from koubo_terms import BANNED_AMBIG_COMP, TERM_CANONICAL_DICT, find_ambig_hits, find_alias_issues


def analyze_body(body, idx=None):
    """分析单篇正文，返回约束报告"""
    r = {}
    body = body.strip()

    # 1. 字数
    r['chars'] = len(body)
    r['chars_ok'] = WORD_MIN <= r['chars'] <= WORD_MAX
    r['chars_gap'] = (WORD_MIN - r['chars']) if r['chars'] < WORD_MIN else (
        r['chars'] - WORD_MAX) if r['chars'] > WORD_MAX else 0

    # 2. 句子长度
    sents = re.split(r'[。！？\n]', body)
    sents = [s.strip() for s in sents if s.strip()]
    r['sentences'] = []
    r['hard_fails'] = []
    r['soft_warns'] = []
    for si, s in enumerate(sents):
        slen = len(s)
        r['sentences'].append((si + 1, slen, s[:30]))
        if slen > SENTENCE_HARD:
            r['hard_fails'].append((si + 1, slen, s[:30] + '...'))
        elif slen > SENTENCE_SOFT:
            r['soft_warns'].append((si + 1, slen, s[:30] + '...'))

    # 3. "我"次数
    r['me_count'] = body.count('我')
    r['me_ok'] = r['me_count'] >= ME_MIN
    r['me_gap'] = max(0, ME_MIN - r['me_count'])

    # 4. 二次冲击 280-380
    zone = body[TURN_ZONE[0]:TURN_ZONE[1]] if len(body) > TURN_ZONE[1] else body[TURN_ZONE[0]:]
    r['turn_in_zone'] = [w for w in TURN_WORDS if w in zone]
    r['turn_positions'] = []
    for w in TURN_WORDS:
        for m in re.finditer(re.escape(w), body):
            r['turn_positions'].append((w, m.start()))
    r['turn_positions'].sort(key=lambda x: x[1])
    r['turn_in_zone_ok'] = len(r['turn_in_zone']) > 0

    # 5. 收藏价值预估
    r['collect_dims'] = {}
    r['collect_score'] = 0
    for dim, keywords in COLLECT_DIMS.items():
        hits = sum(1 for kw in keywords if kw in body)
        r['collect_dims'][dim] = min(hits, 3)  # cap at 3
        if hits > 0:
            r['collect_score'] += min(hits, 2)  # max 2 per dim

    # 6. 教练穿插
    r['coach_hits'] = [w for w in COACH_WORDS if w in body]
    r['coach_ok'] = len(r['coach_hits']) > 0

    # 7. 结尾类型预估
    r['ending_type'] = '未知'
    for etype, patterns in ENDING_PATTERNS.items():
        if body[-100:]:  # last 100 chars
            if any(p in body[-100:] for p in patterns):
                r['ending_type'] = etype
                break

    # 2026-07-12 新规则③：软清单收尾检测
    r['soft_list_ending'] = bool(SOFT_LIST_ENDING_PAT.search(body[-80:]))

    # 2026-07-12 新规则①：模板化开头检测
    r['template_opening'] = [p for p in BANNED_TEMPLATE_OPENINGS if p in body[:50]]

    # 2026-07-12 新规则②：结构流水线检测（新闻→分析→我做AI教育→建议清单）
    r['pipeline_structure'] = False
    news_start = any(p in body[:80] for p in ['刚发布', '刚上线', '刚宣布', '推出了', '发布了', '上线了', '宣布了'])
    edu_anchor = any(p in body for p in ['我做AI教育', '我们智汇', '我搞AI', '我做培训', '我办学', '我开公司', '我创业'])
    list_advice = bool(SOFT_LIST_ENDING_PAT.search(body[-80:]))
    if news_start and edu_anchor and list_advice:
        r['pipeline_structure'] = True

    # ⑪ 2026-07-13 AI味检测（用户强制·AI味=0才可交付）
    AI_TASTE_PATTERNS = [
        (r'先[^，。！？]{0,8}(再|又|然后|接着)最后', 'AI味[机械排比]'),
        (r'第[一二三四五][^，。！？]{0,6}第[一二三四五][^，。！？]{0,6}第[一二三四五]', 'AI味[机械序列]'),
        (r'[一二三四五][、．.][^，。！？]{0,6}[一二三四五][、．.][^，。！？]{0,6}[一二三四五]', 'AI味[顿号序列]'),
        (r'(三个|三样|三件事|三条|三个指标|三个环节|三个场景)', 'AI味[硬数字重复]'),
        (r'值得注意的是', 'AI味[套话]'),
        (r'不难发现', 'AI味[套话]'),
        (r'不可否认', 'AI味[套话]'),
        (r'总而言之', 'AI味[套话]'),
        (r'综上所述', 'AI味[套话]'),
        (r'从[^，。！？]{0,10}角度来看', 'AI味[套话]'),
        (r'随着[^，。！？]{0,10}的[^，。！？]{0,6}(发展|演变|推进)', 'AI味[套话]'),
        (r'问题来了[。！]', 'AI味[八股]'),
        (r'答案是[。！]', 'AI味[八股]'),
        (r'这意味着[。！]', 'AI味[八股]'),
        (r'这说明了[。！]', 'AI味[八股]'),
        (r'研究表明[^，。！？]{0,20}[。！]', 'AI味[伪权威]'),
        (r'专家指出[^，。！？]{0,20}[。！]', 'AI味[伪权威]'),
        (r'据[^，。！？]{0,6}(统计|研究|调查|报告)[^，。！？]{0,10}[。！]', 'AI味[伪权威]'),
        (r'至关重要', 'AI味[空洞强调]'),
        (r'不可或缺', 'AI味[空洞强调]'),
        (r'具有重要[^，。！？]{0,6}(意义|价值|作用)', 'AI味[空洞强调]'),
        (r'(但是[^，。！？]{0,10}){3,}', 'AI味[转折堆积]'),
    ]
    r['ai_taste_hits'] = []
    for pat, atype in AI_TASTE_PATTERNS:
        m = re.search(pat, body)
        if m:
            r['ai_taste_hits'].append((atype, m.group(0)))
    r['ai_taste_ok'] = len(r['ai_taste_hits']) == 0

    # 8. 跨篇词频
    r['cross_hits'] = {}
    for w in CROSS_WORDS:
        cnt = body.count(w)
        if cnt > 0:
            r['cross_hits'][w] = cnt

    # ⑫ 2026-07-14 新规则：4项口播稿结构优化软警告（WARN级别，不影响all_ok）
    # 优化1·开头3句钩子公式：S1身份背书, S2完播承诺, S3完播锁钩
    r['hook_s2_ok'] = False
    r['hook_s3_ok'] = False
    r['hook_duration_warn'] = False
    if len(sents) >= 2:
        s2 = sents[1]
        has_hook = any(p in s2 for p in S2_HOOK_PATS)
        has_aud = any(p in s2 for p in S2_AUDIENCE_PATS)
        r['hook_s2_ok'] = has_hook and has_aud
        r['hook_duration_warn'] = bool(BAD_DURATION_PAT.search(s2))
    if len(sents) >= 3:
        s3 = sents[2]
        r['hook_s3_ok'] = any(p in s3 for p in S3_LOCK_PATS)

    # 优化2·段落收尾金句类型（每篇≥2种）
    r['punchline_types'] = []
    for ptype, pat in PUNCHLINE_PATTERNS.items():
        if pat.search(body):
            r['punchline_types'].append(ptype)
    r['punchline_ok'] = len(r['punchline_types']) >= 2

    # 优化3·观点密度（含判断词的句子数≥4达标）
    opinion_sents = [s for s in sents if any(w in s for w in OPINION_WORDS)]
    r['opinion_count'] = len(opinion_sents)
    r['opinion_ok'] = r['opinion_count'] >= 4

    # 优化4·结尾自我诊断引导（末50字含软引导词）
    ending_50 = body[-50:]
    r['ending_diag_hit'] = [w for w in ENDING_DIAG_PATS if w in ending_50]
    r['ending_diag_ok'] = len(r['ending_diag_hit']) > 0

    # ⑬ 2026-07-14 新规则：生造/压缩导致歧义的词（0714 A8 事故·零容忍）
    r['ambig_comp_hits'] = []
    for pat in BANNED_AMBIG_COMP:
        m = pat.search(body)
        if m:
            r['ambig_comp_hits'].append(m.group())
    r['ambig_comp_ok'] = len(r['ambig_comp_hits']) == 0

    # ⑭ 2026-07-14 新规则：跨稿统一词表一致性（WARN级，不影响all_ok）
    r['canonical_hits'] = []
    for canonical, *aliases in TERM_CANONICAL_DICT:
        for alias in aliases:
            if alias and alias in body and canonical not in body:
                r['canonical_hits'].append('"%s"→"%s"' % (alias, canonical))
                break

    return r


def print_report(idx, body, r):
    """打印单篇报告"""
    art_label = f'A{idx + 1}' if idx is not None else 'DRAFT'

    print(f"\n{'=' * 50}")
    print(f" {art_label} 实时约束报告")
    print(f"{'=' * 50}")

    # 字数
    icon = '✓' if r['chars_ok'] else '✗'
    gap_info = ''
    if not r['chars_ok']:
        if r['chars_gap'] > 0:
            gap_info = f' → 需+{r["chars_gap"]}字' if r['chars'] < WORD_MIN else f' → 需-{r["chars_gap"]}字'
    print(f"  {icon} 字数: {r['chars']} (目标 {WORD_MIN}-{WORD_MAX}){gap_info}")

    # 句子
    if r['hard_fails']:
        print(f"  ✗ 长句硬伤({len(r['hard_fails'])}处 >{SENTENCE_HARD}字):")
        for si, slen, txt in r['hard_fails']:
            print(f"    句#{si}: {slen}字 → \"{txt}\"")
    elif r['soft_warns']:
        print(f"  △ 长句预警({len(r['soft_warns'])}处 >{SENTENCE_SOFT}字):")
        for si, slen, txt in r['soft_warns']:
            print(f"    句#{si}: {slen}字 → \"{txt}\"")
    else:
        print(f"  ✓ 句子长度: 全部≤{SENTENCE_SOFT}字")

    # 我
    icon = '✓' if r['me_ok'] else '✗'
    gap = f' → 需+{r["me_gap"]}个"我"' if r['me_gap'] > 0 else ''
    print(f"  {icon} \"我\"次数: {r['me_count']} (需≥{ME_MIN}){gap}")

    # 二次冲击
    icon = '✓' if r['turn_in_zone_ok'] else '✗'
    zone_info = f' → 区段内转折词: {r["turn_in_zone"]}' if r['turn_in_zone'] else f' → 区段内无转折词!'
    print(f"  {icon} 二次冲击280-380: {zone_info}")
    if r['turn_positions']:
        pos_str = ', '.join([f'{w}@{p}' for w, p in r['turn_positions']])
        print(f"     全部转折词位置: {pos_str}")

    # 收藏价值
    print(f"  {'✓' if r['collect_score'] >= 4 else '△'} 收藏价值预估: ~{r['collect_score']}分 (需均分≥5)")
    for dim, score in r['collect_dims'].items():
        bar = '#' * score + '.' * (3 - score)
        print(f"     {dim}: [{bar}] {score}/3")

    # 教练
    icon = '✓' if r['coach_ok'] else '✗'
    coach_str = f'({", ".join(r["coach_hits"])})' if r['coach_hits'] else '(无)'
    print(f"  {icon} 教练穿插: {coach_str}")

    # 结尾
    print(f"  → 结尾类型预估: {r['ending_type']}")
    if r.get('soft_list_ending'):
        print(f"  ✗ 软清单收尾: 检测到'建议N条/记住N点'式列举，须自然融入")
    if r.get('template_opening'):
        print(f"  ✗ 模板化开头: {r['template_opening']}（禁止太X了/吓一跳/炸锅了起手）")
    if r.get('pipeline_structure'):
        print(f"  ✗ 流水线结构: 新闻→分析→我做AI教育→建议清单（须换结构）")
    if r.get('ai_taste_hits'):
        print(f"  ✗ AI味检测({len(r['ai_taste_hits'])}处):")
        for atype, txt in r['ai_taste_hits']:
            print(f"    {atype}: 「{txt}」")
    else:
        print(f"  ✓ AI味检测: 0处（AI味=0）")

    # ⑫ 2026-07-14 新规则：4项结构优化软警告（△符号显示，不影响all_ok）
    if not r.get('hook_s2_ok', True) or not r.get('hook_s3_ok', True):
        miss = []
        if not r.get('hook_s2_ok', True): miss.append('S2(完播承诺)')
        if not r.get('hook_s3_ok', True): miss.append('S3(完播锁钩)')
        print(f"  △ 开头3句钩子公式: 缺{','.join(miss)}（S2=身份+承诺, S3=锁钩）")
    if r.get('hook_duration_warn'):
        print(f"  △ 钩子时长: 写\"X分钟\"超实际(1.5分钟/一分半)，需改为\"1分钟\"或\"一分半\"")
    if not r.get('punchline_ok', True):
        ptypes = r.get('punchline_types', []) or ['无']
        print(f"  △ 收尾金句类型: 仅{len(r.get('punchline_types', []))}种({','.join(ptypes)})，需≥2种(概念反转/类比画面/数据落差/反共识)")
    if not r.get('opinion_ok', True):
        print(f"  △ 观点密度: {r.get('opinion_count', 0)}个判断句，需≥4个")
    if not r.get('ending_diag_ok', True):
        print(f"  △ 结尾自我诊断: 末50字缺软引导词(你对照/你想想/你琢磨/等着看/你猜...)")

    # ⑬ 2026-07-14 新规则：生造/压缩导致歧义的词（用户铁律·零容忍）
    if r.get('ambig_comp_hits'):
        print(f"  ✗ 生造/压缩歧义词({len(r['ambig_comp_hits'])}处):")
        for h in r['ambig_comp_hits'][:3]:
            print(f"    「{h}」（详见 AGENTS.md 2.7）")
    else:
        print(f"  ✓ 生造/压缩歧义词: 0处")

    # ⑭ 2026-07-14 新规则：跨稿统一词表一致性（WARN级）
    if r.get('canonical_hits'):
        print(f"  △ 跨稿词表不一致({len(r['canonical_hits'])}处):")
        for h in r['canonical_hits'][:3]:
            print(f"    {h}")
    else:
        print(f"  ✓ 跨稿词表一致: 0处")

    # 跨篇
    if r['cross_hits']:
        print(f"  → 跨篇词频: {r['cross_hits']}")

    # 总结
    all_ok = r['chars_ok'] and not r['hard_fails'] and r['me_ok'] and r['turn_in_zone_ok'] and r['coach_ok'] and r['ai_taste_ok']
    # 2026-07-12 新规则：模板化开头/软清单收尾/流水线结构 也算 FAIL
    if r.get('template_opening') or r.get('soft_list_ending') or r.get('pipeline_structure'):
        all_ok = False
    # 2026-07-14 新规则：生造歧义词也算 FAIL
    if not r.get('ambig_comp_ok', True):
        all_ok = False
    print(f"\n  {'=' * 20}")
    if all_ok:
        print(f"  ✓ 单篇约束全部通过，可继续下一篇")
    else:
        fails = []
        if not r['chars_ok']: fails.append(f"字数{'不足' if r['chars'] < WORD_MIN else '超标'}{abs(r['chars_gap'])}")
        if r['hard_fails']: fails.append(f"长句{len(r['hard_fails'])}处")
        if not r['me_ok']: fails.append(f"缺{r['me_gap']}个我")
        if not r['turn_in_zone_ok']: fails.append("缺转折词")
        if not r['coach_ok']: fails.append("缺教练词")
        if r.get('template_opening'): fails.append("模板化开头")
        if r.get('soft_list_ending'): fails.append("软清单收尾")
        if r.get('pipeline_structure'): fails.append("流水线结构")
        if not r.get('ai_taste_ok', True): fails.append(f"AI味{len(r['ai_taste_hits'])}处")
        if not r.get('ambig_comp_ok', True): fails.append(f"生造歧义词{len(r['ambig_comp_hits'])}处")
        print(f"  ✗ 需修复: {', '.join(fails)}")
    print(f"  {'=' * 20}")


def check_cross(all_reports):
    """跨篇检查"""
    print(f"\n{'=' * 50}")
    print(f" 跨篇约束报告")
    print(f"{'=' * 50}")

    # 聚合
    total_but = 0
    total_qishi = 0
    total_woziji = 0
    total_zhenzheng = 0
    ending_types = Counter()
    high_freq = Counter()

    for r in all_reports:
        total_but += 1 if '但' in r.get('cross_hits', {}) else 0
        total_qishi += r.get('cross_hits', {}).get('其实', 0)
        total_woziji += r.get('cross_hits', {}).get('我自己', 0)
        total_zhenzheng += r.get('cross_hits', {}).get('真正', 0)
        ending_types[r['ending_type']] += 1

    print(f"  {'✓' if total_but <= 5 else '✗'} \"但\"跨篇: {total_but}篇 (限≤5)")
    print(f"  {'✓' if total_qishi <= 5 else '✗'} \"其实\"跨篇: {total_qishi}次 (限≤5)")
    print(f"  {'✓' if total_woziji <= 2 else '✗'} \"我自己\"跨篇: {total_woziji}次 (限≤2)")
    print(f"  {'✓' if total_zhenzheng <= 3 else '✗'} \"真正\"跨篇: {total_zhenzheng}次 (限≤3)")
    print(f"  {'✓' if ending_types['感慨式'] <= 3 else '✗'} 结尾感慨式: {ending_types['感慨式']}篇 (限≤3)")

    avg_score = sum(r['collect_score'] for r in all_reports) / len(all_reports) if all_reports else 0
    print(f"  {'✓' if avg_score >= 5 else '✗'} 收藏均分: {avg_score:.1f} (需≥5.0)")


def main():
    if len(sys.argv) < 2:
        print("用法:")
        print("  python koubo_live_check.py \"正文内容...\"     # 单篇检查")
        print("  python koubo_live_check.py --all 0712.txt     # 全8篇检查")
        print("  python koubo_live_check.py --quick 0712.txt   # 仅跨篇")
        sys.exit(0)

    if sys.argv[1] == '--all':
        # 全8篇模式
        filepath = sys.argv[2] if len(sys.argv) > 2 else None
        if not filepath or not os.path.exists(filepath):
            print(f"文件不存在: {filepath}")
            sys.exit(1)

        with open(filepath, 'r', encoding='utf-8') as f:
            data = f.read()

        sep = '\u2500' * 30
        articles = data.split(sep)
        reports = []

        for i, art in enumerate(articles[:8]):
            lines = art.strip().split('\n')
            body_start = 0
            for j, line in enumerate(lines):
                if line.startswith('[置顶]'):
                    body_start = j + 1
                    break
                if j > 0 and not line.startswith('#') and line.strip():
                    body_start = j
                    break
            body = ''.join(lines[body_start:])
            r = analyze_body(body, i)
            print_report(i, body[:20] + '...', r)
            reports.append(r)

        check_cross(reports)

    elif sys.argv[1] == '--quick':
        # 仅跨篇
        filepath = sys.argv[2] if len(sys.argv) > 2 else None
        if not filepath or not os.path.exists(filepath):
            print(f"文件不存在: {filepath}")
            sys.exit(1)

        with open(filepath, 'r', encoding='utf-8') as f:
            data = f.read()

        sep = '\u2500' * 30
        articles = data.split(sep)
        reports = []
        for i, art in enumerate(articles[:8]):
            lines = art.strip().split('\n')
            body_start = 0
            for j, line in enumerate(lines):
                if line.startswith('[置顶]'):
                    body_start = j + 1
                    break
                if j > 0 and not line.startswith('#') and line.strip():
                    body_start = j
                    break
            body = ''.join(lines[body_start:])
            reports.append(analyze_body(body, i))
        check_cross(reports)

    else:
        # 单篇模式
        body = ' '.join(sys.argv[1:])
        r = analyze_body(body)
        print_report(None, body, r)


if __name__ == '__main__':
    main()
