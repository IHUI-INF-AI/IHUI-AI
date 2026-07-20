# -*- coding: utf-8 -*-
"""
事实核查质检模块（第23项检查）
与22项内容自检（validate.py）共同构成完整质检体系

核查维度（12项子检查）：
  C1  数据信源：每个具体数字必须有可追溯来源
  C2  引用归属：所有引用必须明确具名来源
  C3  排名基准：排名/第一/最强必须指明具体评测名称
  C4  数学自洽：百分比/计算结果必须数学正确
  C5  数据一致：同一数据点在全文中必须一致
  C6  产品版本：产品名/版本号必须在已知产品库中或标记待核实
  C7  时间线：日期和时间线声明必须内部一致
  C8  能力边界：能力声明必须区分官方数据 vs 个人体验
  C9  匿名信源：匿名归属必须标记风险
  C10 图片说明：图片说明必须与正文声明一致
  C11 主观伪装客观：主观判断不能伪装成客观事实
  C12 信源注册表：构建脚本必须提供完整的事实声明注册表

严重级别：
  HIGH   → 阻断交付（必须修复才能发布）
  MEDIUM → 警告（建议修复，可人工确认后放行）
  LOW    → 提示（建议优化）

用法:
  方式一（自动模式）: 传入article dict，自动扫描所有文本提取可疑声明
  方式二（注册表模式）: article dict包含claims_registry字段，逐项核实
  方式三（完整模式）: 两者都执行

from lib.fact_check import fact_check
passed, report = fact_check(article_dict)
"""
import re
import sys
import os
from datetime import datetime

# ===== 严重级别 =====
HIGH = 'HIGH'
MEDIUM = 'MEDIUM'
LOW = 'LOW'

# ===== 已知产品/版本知识库（持续更新） =====
# 用于标记完全不存在的产品名或可疑版本号
KNOWN_PRODUCTS = {
    # OpenAI
    'GPT-4': {'versions': ['turbo', 'o', 'o-mini'], 'maker': 'OpenAI'},
    'GPT-4o': {'versions': ['mini', 'nano'], 'maker': 'OpenAI'},
    'GPT-5': {'versions': ['preview', 'mini'], 'maker': 'OpenAI'},
    'ChatGPT': {'versions': ['Plus', 'Team', 'Enterprise', 'Free'], 'maker': 'OpenAI'},
    'OpenAI': {'maker': 'OpenAI'},
    'Codex': {'maker': 'OpenAI'},
    # Anthropic
    'Claude': {'versions': ['3', '3.5', '4', 'Opus', 'Sonnet', 'Haiku', '3.5 Sonnet', '4 Opus'], 'maker': 'Anthropic'},
    'Claude Code': {'maker': 'Anthropic'},
    'Anthropic': {'maker': 'Anthropic'},
    # Google
    'Gemini': {'versions': ['1.5', '2.0', 'Pro', 'Flash', 'Ultra'], 'maker': 'Google'},
    'Google': {'maker': 'Google'},
    'DeepMind': {'maker': 'Google'},
    # 腾讯
    '混元': {'versions': ['Hy3', 'Hunyuan'], 'maker': '腾讯'},
    '腾讯混元': {'versions': ['Hy3'], 'maker': '腾讯'},
    'Hy3': {'maker': '腾讯'},
    # 其他
    'DeepSeek': {'versions': ['V3', 'R1', 'V4'], 'maker': 'DeepSeek'},
    'Kimi': {'maker': '月之暗面'},
    '豆包': {'maker': '字节跳动'},
    'WorkBuddy': {'maker': '第三方平台'},
    'OpenRouter': {'maker': 'OpenRouter'},
    # 安全/研究
    'Sysdig': {'maker': 'Sysdig'},
    'Langflow': {'maker': 'Langflow'},
}

# ===== 已知基准测试名称 =====
KNOWN_BENCHMARKS = [
    'Terminal-Bench', 'MMLU', 'HumanEval', 'GSM8K', 'MATH',
    'ARC-Challenge', 'HellaSwag', 'TruthfulQA', 'Winogrande',
    'SWE-bench', 'WebArena', 'GAIA', 'AgentBench', 'ToolBench',
    'LMSYS', 'Chatbot Arena', 'LiveBench', 'Arena-Hard',
    'SuperGLUE', 'GLUE', 'WMT', 'COPA', 'PIQA',
    'MBPP', 'BigCodeBench', 'CRUXEval', 'DS-1000',
]

# ===== 匿名信源模式 =====
ANONYMOUS_SOURCE_PATTERNS = [
    r'有人(?:说|发现|透露|指出|表示|称|反映)',
    r'有(?:技术|内部|行业|相关)?(?:人员|专家|人士|分析师|研究员)(?:发现|透露|指出|表示|称|分析)',
    r'(?:据|根据)(?:称|说)(?:[^，。]{0,5})(?:透露|表示|称)',
    r'据(?:多方|多位|相关|业内)(?:报道|消息|透露|分析)',
    r'(?:消息人士|知情人士|业内人士)(?:透露|表示|称|指出)',
    r'(?:有|某)(?:家|个)(?:媒体|平台|公司|机构)(?:报道|发现|指出)',
    r'(?:网上|网上有)(?:消息称|有人|流传)',
]

# ===== 主观伪装客观模式 =====
SUBJECTIVE_AS_OBJECTIVE_PATTERNS = [
    # 把个人判断写成客观事实的语气
    r'(?:事实|真相|实际上|显然|无疑|毫无疑问)(?:是|表明|说明|证明)',
    r'(?:所有人|大家都知道|众所周知|不言而喻)',
    r'(?:已经|早已)(?:被)?(?:证实|证明|确认|公认)',
]

# ===== 信源强度分级 =====
STRONG_SOURCES = [
    '官方', '论文', 'GitHub', '官网', 'OpenAI', '腾讯', 'Anthropic',
    'Google', 'DeepSeek', 'Sysdig', '高盛', 'Gartner', 'IDC',
    'OpenRouter', 'Terminal-Bench', 'MMLU', 'LMSYS',
    'SWE-bench', 'AgentBench', 'ToolBench',
]

WEAK_SOURCES = [
    '朋友', '听说', '据说', '有人', '网上', '传闻',
    '可能', '大概', '似乎', '好像', '估计',
]

NO_SOURCE = [
    '无', 'none', '', '未标注', '未知',
]


def _extract_all_text(article):
    """从article dict提取全部文本内容"""
    texts = []
    if article.get('title'):
        texts.append(('title', article['title']))
    if article.get('subtitle'):
        texts.append(('subtitle', article['subtitle']))
    for i, lead in enumerate(article.get('lead', [])):
        texts.append((f'lead[{i}]', lead))
    for sec in article.get('sections', []):
        texts.append((f'section[{sec.get("num","?")}].title', sec.get('title', '')))
        for j, el in enumerate(sec.get('elements', [])):
            etype = el.get('type', '')
            if etype == 'body':
                texts.append((f's{sec["num"]}.body[{j}]', el.get('text', '')))
            elif etype == 'body_list':
                for k, item_text in enumerate(el.get('items', [])):
                    texts.append((f's{sec["num"]}.list[{j}][{k}]', item_text))
            elif etype == 'quote':
                texts.append((f's{sec["num"]}.quote[{j}]', el.get('text', '')))
            elif etype == 'card':
                texts.append((f's{sec["num"]}.card[{j}]', el.get('title', '') + ' ' + el.get('text', '')))
            elif etype == 'highlight':
                texts.append((f's{sec["num"]}.hl[{j}]', el.get('text', '')))
            elif etype == 'callout':
                texts.append((f's{sec["num"]}.callout[{j}]', el.get('text', '')))
            elif etype == 'image':
                texts.append((f's{sec["num"]}.img_cap[{j}]', el.get('caption', '')))
            elif etype == 'stats':
                for item in el.get('items', []):
                    texts.append((f's{sec["num"]}.stat', f'{item.get("num","")} {item.get("label","")} {item.get("desc","")}'))
            elif etype == 'info_card':
                texts.append((f's{sec["num"]}.info[{j}]', el.get('title', '') + ' ' + el.get('content', '')))
            elif etype == 'ceo':
                texts.append((f's{sec["num"]}.ceo[{j}]', el.get('quote', '')))
            elif etype == 'data_table':
                for row in el.get('rows', []):
                    texts.append((f's{sec["num"]}.table', ' '.join(str(c) for c in row)))
    footer = article.get('footer', {})
    geo_text = footer.get('geo_text', '')
    if geo_text:
        texts.append(('footer_geo', geo_text))
    return texts


def _full_text(texts):
    """拼接全部文本"""
    return '\n'.join(t for _, t in texts)


def _context_around(text, pattern, window=60):
    """提取匹配位置的上下文"""
    m = re.search(pattern, text)
    if not m:
        return ''
    start = max(0, m.start() - window)
    end = min(len(text), m.end() + window)
    return text[start:end]


# ============================================================
#  C1: 数据信源检查 — 每个具体数字必须有来源
# ============================================================
def check_data_sources(article, texts):
    """检查文章中的具体数字是否标注了来源"""
    issues = []
    registry = article.get('claims_registry', [])

    # 从注册表检查：有数字但无来源
    for claim in registry:
        cat = claim.get('category', '')
        if cat not in ('benchmark', 'parameter', 'pricing', 'market', 'spec'):
            continue
        claim_text = claim.get('claim', '')
        source = claim.get('source', '')
        # 提取claim中的数字
        numbers = re.findall(r'[\d.]+[%％万亿倍]?', claim_text)
        if not numbers:
            continue
        if not source or source.lower() in NO_SOURCE:
            issues.append({
                'check': 'C1',
                'severity': HIGH,
                'location': 'claims_registry',
                'text': claim_text[:80],
                'problem': f'具体数据缺少信源标注',
                'suggestion': f'请补充数据来源（如官方公告、论文、平台页面等）',
                'numbers': numbers,
            })
        elif source in WEAK_SOURCES or any(w in source for w in WEAK_SOURCES):
            issues.append({
                'check': 'C1',
                'severity': MEDIUM,
                'location': 'claims_registry',
                'text': claim_text[:80],
                'problem': f'信源强度不足："{source}"',
                'suggestion': f'建议替换为一手信源（官方公告/论文/平台数据）',
                'numbers': numbers,
            })

    # 从正文扫描：包含具体数字的句子，检查附近是否有信源词
    for loc, text in texts:
        if loc in ('title', 'subtitle', 'footer_geo'):
            continue
        # 找包含具体数字的句子
        sentences = re.split(r'[。！？\n]', text)
        for sent in sentences:
            # 跳过纯数字统计行
            if re.match(r'^[\d.]+[%％万]', sent.strip()):
                continue
            # 找有意义的数字（排除太小的数字如"3分钟""5个"等日常数字）
            numbers = re.findall(r'(\d[\d,.]*[%％万亿万]|\d{2,})', sent)
            if not numbers:
                continue
            # 检查句子或相邻句是否有信源词
            context = sent
            has_source = False
            for s in STRONG_SOURCES:
                if s in context:
                    has_source = True
                    break
            # 检查是否被注册表覆盖
            if not has_source:
                for claim in registry:
                    if claim.get('claim', '')[:20] in text:
                        src = claim.get('source', '')
                        if src and src not in NO_SOURCE:
                            has_source = True
                            break
            if not has_source:
                # 检查是否是个人体验（可豁免）
                personal_markers = ['我试了', '我测了', '我用', '我的体验', '我用了', '我跑']
                is_personal = any(m in sent for m in personal_markers)
                if not is_personal:
                    issues.append({
                        'check': 'C1',
                        'severity': MEDIUM,
                        'location': loc,
                        'text': sent.strip()[:100],
                        'problem': '正文含具体数字但未找到信源标注',
                        'suggestion': '在句中或上句补充数据来源，如"根据XX官方数据""据XX论文"',
                        'numbers': numbers,
                    })

    return issues


# ============================================================
#  C2: 引用归属检查 — 所有引用必须有具名来源
# ============================================================
def check_quote_attribution(article, texts):
    """检查引用是否有明确归属"""
    issues = []
    full = _full_text(texts)

    # 检查匿名信源模式
    for pattern in ANONYMOUS_SOURCE_PATTERNS:
        for m in re.finditer(pattern, full):
            start = max(0, m.start() - 30)
            end = min(len(full), m.end() + 80)
            ctx = full[start:end]
            issues.append({
                'check': 'C2',
                'severity': HIGH,
                'location': '正文',
                'text': ctx,
                'problem': f'匿名信源："{m.group()}"',
                'suggestion': '请具名引用（如"OpenAI官方博客显示""腾讯在发布会上表示"），或删除该引用',
            })

    # 检查直接引语（引号内容）是否有归属
    quotes = re.findall(r'["\']([^"\']{5,80})["\']', full)
    for q in quotes:
        # 跳过常见非引用内容
        if any(skip in q for skip in ['混元', 'Hy3', 'GPT', 'WorkBuddy', 'AI', 'PPT', 'Excel', 'ChatGPT']):
            continue
        if re.match(r'^[\d.]+', q):  # 纯数字
            continue
        # 检查引语附近是否有归属词
        idx = full.find(q)
        if idx >= 0:
            context = full[max(0, idx-60):min(len(full), idx+len(q)+60)]
            attribution_words = ['说', '表示', '指出', '发现', '透露', '称', '认为', '分析', '写道']
            has_attr = any(w in context for w in attribution_words)
            if not has_attr:
                issues.append({
                    'check': 'C2',
                    'severity': MEDIUM,
                    'location': '正文',
                    'text': f'"{q}"',
                    'problem': '直接引语缺少归属（谁说的？）',
                    'suggestion': '补充引语来源，如"XX说：..."或改为间接引用',
                })

    return issues


# ============================================================
#  C3: 排名/基准检查 — 排名声明必须指明具体评测或平台
# ============================================================

# 已知平台/数据源（可作为排名声明的有效来源）
KNOWN_PLATFORMS = [
    'OpenRouter', 'LMSYS', 'Chatbot Arena', 'Hugging Face', 'HF',
    'Artificial Analysis', 'LiveBench', 'BigBench',
    'WorkBuddy', '腾讯云', '阿里云', '百度智能云',
]

def check_ranking_claims(article, texts):
    """检查排名/第一/最强声明是否指明具体评测或平台"""
    issues = []
    full = _full_text(texts)

    ranking_patterns = [
        r'(?:全球|世界|业内|行业)?(?:排名|排行|排行版)(?:第?\s*[一二三1-3]|[，,]\s*名[列居])',
        r'(?:全球|世界|业内|行业)?(?:第[一1]|第一|榜首|夺冠)',
        r'(?:拿下|获得|取得)(?:了)?(?:第[一1]|冠军|首位)',
        r'(?:超过|超越|领先).+(?:模型|AI|大模型)',
        r'(?:工具调用|能力|性能).{0,5}(?:第一|最强|领先)',
    ]

    for pattern in ranking_patterns:
        for m in re.finditer(pattern, full):
            start = max(0, m.start() - 40)
            end = min(len(full), m.end() + 80)
            ctx = full[start:end]
            # 检查附近（±200字）是否提到具体基准测试或平台
            wide_start = max(0, m.start() - 200)
            wide_end = min(len(full), m.end() + 200)
            wide_ctx = full[wide_start:wide_end]
            has_benchmark = any(b in wide_ctx for b in KNOWN_BENCHMARKS)
            has_platform = any(p in wide_ctx for p in KNOWN_PLATFORMS)
            if not has_benchmark and not has_platform:
                issues.append({
                    'check': 'C3',
                    'severity': HIGH,
                    'location': '正文',
                    'text': ctx,
                    'problem': '排名/第一声明未指明具体评测基准或平台',
                    'suggestion': '请补充评测名称（如"在Terminal-Bench 2.1评测中"）或平台名称（如"在OpenRouter平台上"）',
                })

    return issues


# ============================================================
#  C4: 数学自洽检查 — 百分比/计算必须正确
# ============================================================
def check_math_consistency(article, texts):
    """检查数学计算是否正确"""
    issues = []
    full = _full_text(texts)

    # 模式1: "从X增加到Y，涨幅达到Z%"
    pattern1 = r'从\s*([\d,.]+)\s*万?\s*(?:词元|tokens?|个|元|家|人|台)?\s*(?:增加|增长|提高|上升|扩大)(?:到|至)\s*([\d,.]+)\s*万?\s*(?:词元|tokens?|个|元|家|人|台)?[，,].{0,15}(?:涨幅|增幅|增长率|增长|提高)\s*(?:达到|为|是|了)?\s*([\d.]+)\s*%'
    for m in re.finditer(pattern1, full):
        try:
            old = float(m.group(1).replace(',', ''))
            new = float(m.group(2).replace(',', ''))
            stated_pct = float(m.group(3))
            if old > 0:
                actual_pct = round((new - old) / old * 100, 1)
                if abs(actual_pct - stated_pct) > 2:
                    issues.append({
                        'check': 'C4',
                        'severity': HIGH,
                        'location': '正文',
                        'text': m.group()[:100],
                        'problem': f'数学计算错误：从{m.group(1)}到{m.group(2)}实际涨幅为{actual_pct}%，文中写的是{stated_pct}%',
                        'suggestion': f'请修正为{actual_pct}%，或核实原始数据',
                    })
        except (ValueError, ZeroDivisionError):
            pass

    # 模式2: "X万...一年下来就是Y个小时" 等时间计算
    pattern2 = r'(?:每周|每月|每天)\s*(?:省下?|节省|节约)\s*([\d.]+)\s*(?:分钟|小时|个小时)\s*.{0,20}(?:一年|每月|一周)\s*(?:下来|就是|等于|大约|约)\s*([\d.]+)\s*(?:小时|分钟|天|个)'
    for m in re.finditer(pattern2, full):
        try:
            per_period = float(m.group(1))
            total = float(m.group(2))
            # 简单验证：如果提到"一年"，大约50周
            if '一年' in m.group():
                expected = per_period * 50  # 50 work weeks
                if '小时' in m.group() and abs(expected - total) > expected * 0.15:
                    issues.append({
                        'check': 'C4',
                        'severity': MEDIUM,
                        'location': '正文',
                        'text': m.group()[:100],
                        'problem': f'估算可能有偏差：每周{per_period}×50周≈{expected}，文中写的是{total}',
                        'suggestion': '请核实计算逻辑，或标注为"大约"',
                    })
        except (ValueError, ZeroDivisionError):
            pass

    # 模式3: 注册表中的计算类声明
    registry = article.get('claims_registry', [])
    for claim in registry:
        if claim.get('category') != 'calculation':
            continue
        calc = claim.get('calculation', '')
        if calc:
            try:
                result = eval(calc, {"__builtins__": {}}, {})
                stated = claim.get('value')
                if stated is not None and abs(float(result) - float(stated)) > 1:
                    issues.append({
                        'check': 'C4',
                        'severity': HIGH,
                        'location': 'claims_registry',
                        'text': claim.get('claim', '')[:80],
                        'problem': f'计算错误：{calc} = {result}，但文中写的是{stated}',
                        'suggestion': f'请修正计算结果',
                    })
            except Exception:
                pass

    return issues


# ============================================================
#  C5: 数据一致性检查 — 同一数据点在全文中必须一致
# ============================================================
def check_data_consistency(article, texts):
    """检查同一数据点在全文中是否一致"""
    issues = []
    full = _full_text(texts)

    # 提取所有"X万词元"格式的数据点
    context_numbers = {}
    patterns = {
        'context_万词元': r'([\d.]+)\s*万\s*词元',
        'context_tokens': r'([\d.]+)\s*万?\s*tokens?',
        '参数_亿': r'([\d.]+)\s*亿\s*参数',
        '百分比': r'([\d.]+)\s*%',
        '价格_元': r'([\d.]+)\s*元\s*/\s*百万\s*词元',
    }

    for label, pattern in patterns.items():
        matches = re.findall(pattern, full)
        unique_vals = set(matches)
        if len(unique_vals) > 2:  # 同一类型出现超过2个不同值
            # 检查这些值是否在同一个上下文（同一个实体）
            for val in unique_vals:
                locations = []
                for loc, text in texts:
                    if re.search(re.escape(val) + r'\s*(万\s*词元|tokens?|亿\s*参数|%|元\s*/)', text):
                        locations.append(loc)
                context_numbers.setdefault(label, {})[val] = locations

    # 检查是否有矛盾（同一实体在不同位置用不同数字）
    # 这里用简单启发式：如果"X万词元"在全文出现且X有多个值，检查是否指同一实体
    context_vals = re.findall(r'([\d.]+)\s*万\s*词元', full)
    unique_context = set(context_vals)
    if len(unique_context) > 2:
        issues.append({
            'check': 'C5',
            'severity': MEDIUM,
            'location': '全文',
            'text': f'上下文长度出现{len(unique_context)}个不同值：{", ".join(unique_context)}',
            'problem': '同一指标可能在不同位置使用了不同数值',
            'suggestion': '请确认每个数值分别对应哪个产品/模型，确保不混淆',
        })

    # 检查注册表中的声明是否在正文中都能找到
    registry = article.get('claims_registry', [])
    for claim in registry:
        claim_text = claim.get('claim', '')
        # 提取claim中的关键数字
        numbers = re.findall(r'[\d.]+[%％万亿万]?', claim_text)
        if not numbers:
            continue
        found_in_article = False
        for num in numbers:
            # 清理数字格式
            clean_num = num.replace('%', '').replace('％', '').replace('万', '').replace('亿', '')
            if clean_num and clean_num in full:
                found_in_article = True
                break
        if not found_in_article and numbers:
            issues.append({
                'check': 'C5',
                'severity': MEDIUM,
                'location': 'claims_registry vs 正文',
                'text': claim_text[:80],
                'problem': '注册表中的声明在正文中未找到对应数字',
                'suggestion': '请确认该数据是否确实写入了正文，或从注册表中移除',
            })

    return issues


# ============================================================
#  C6: 产品/版本检查 — 标记可疑的产品名或版本号
# ============================================================
def check_product_versions(article, texts):
    """检查产品名/版本号是否可疑"""
    issues = []
    full = _full_text(texts)

    # 提取所有"产品名+版本号"模式
    version_patterns = [
        r'([A-Za-z][\w.+-]+)\s+(?:v?(\d+\.\d+(?:\.\d+)?))',
        r'([A-Za-z][\w.+-]+)\s+([\d]+\.[\d]+)',
    ]

    for pattern in version_patterns:
        for m in re.finditer(pattern, full):
            product = m.group(1)
            version = m.group(2)
            # 跳过非产品名
            if product.lower() in ['v', 'vs', 'no', 'ok', 'ip', 'api', 'pdf', 'docx', 'pptx']:
                continue
            if len(product) < 2:
                continue
            # 检查是否在知识库中
            matched = False
            for known_product, info in KNOWN_PRODUCTS.items():
                if product.lower() == known_product.lower() or known_product.lower() in product.lower():
                    matched = True
                    known_versions = info.get('versions', [])
                    if known_versions and version not in known_versions:
                        # 版本号不在已知列表中，标记为待核实
                        issues.append({
                            'check': 'C6',
                            'severity': MEDIUM,
                            'location': '正文',
                            'text': f'{product} {version}',
                            'problem': f'版本号"{version}"不在已知版本列表中（已知：{", ".join(known_versions[:5])}）',
                            'suggestion': '请核实该版本号是否准确，或补充信源',
                        })
                    break
            if not matched:
                # 完全不在知识库中的产品
                if len(product) >= 3 and not product.isdigit():
                    issues.append({
                        'check': 'C6',
                        'severity': LOW,
                        'location': '正文',
                        'text': f'{product} {version}',
                        'problem': '产品名不在已知知识库中，需人工确认',
                        'suggestion': '请确认该产品/版本确实存在',
                    })

    # 检查是否有"不存在"的产品（完全虚构的）
    # 启发式：如果产品名包含明显的版本号但不像真实产品
    suspicious_patterns = [
        r'(?:GPT|Claude|Gemini)-?\s*\d+\.\d+\.\d+\.\d+',  # 过多小数点
    ]
    for pattern in suspicious_patterns:
        for m in re.finditer(pattern, full):
            issues.append({
                'check': 'C6',
                'severity': HIGH,
                'location': '正文',
                'text': m.group(),
                'problem': '版本号格式可疑（小数点过多），可能不存在',
                'suggestion': '请核实该产品版本是否真实存在',
            })

    return issues


# ============================================================
#  C7: 时间线检查 — 日期和时间线是否合理
# ============================================================
def check_temporal_claims(article, texts):
    """检查时间线声明"""
    issues = []
    full = _full_text(texts)

    # 提取具体日期
    date_patterns = [
        (r'(\d{1,2})月(\d{1,2})日', 'date_m_d'),
        (r'(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日]?', 'date_ymd'),
    ]

    found_dates = []
    for pattern, fmt in date_patterns:
        for m in re.finditer(pattern, full):
            if fmt == 'date_m_d':
                month, day = int(m.group(1)), int(m.group(2))
                found_dates.append({'text': m.group(), 'month': month, 'day': day, 'pos': m.start()})
            elif fmt == 'date_ymd':
                year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
                found_dates.append({'text': m.group(), 'year': year, 'month': month, 'day': day, 'pos': m.start()})

    # 检查日期合理性
    for d in found_dates:
        month = d.get('month', 0)
        day = d.get('day', 0)
        if month < 1 or month > 12:
            issues.append({
                'check': 'C7',
                'severity': HIGH,
                'location': '正文',
                'text': d['text'],
                'problem': f'月份{month}不合理',
                'suggestion': '请核实日期',
            })
        if day < 1 or day > 31:
            issues.append({
                'check': 'C7',
                'severity': HIGH,
                'location': '正文',
                'text': d['text'],
                'problem': f'日期{day}不合理',
                'suggestion': '请核实日期',
            })

    # 检查相对时间词是否与文章日期一致
    # "昨晚""昨天""今天""上周""本周"等
    relative_times = re.findall(r'(昨晚|昨天|今天|明天|前天|上周|本周|这周|上月|本月)', full)
    if relative_times:
        # 这只是提醒，不自动判断对错（因为需要知道文章发布日期）
        pass

    # 检查"一周内""两天内"等时间段声明
    duration_patterns = [
        r'(\d+)\s*(?:天|日|周|个月|年)(?:之?内|以来)',
        r'仅\s*(\d+)\s*(?:分钟|秒|小时|天|周)',
    ]
    for pattern in duration_patterns:
        for m in re.finditer(pattern, full):
            num = int(m.group(1))
            if num <= 0:
                issues.append({
                    'check': 'C7',
                    'severity': MEDIUM,
                    'location': '正文',
                    'text': m.group(),
                    'problem': '时间数值不合理',
                    'suggestion': '请核实时间描述',
                })

    return issues


# ============================================================
#  C8: 能力声明检查 — 区分官方数据 vs 个人体验
# ============================================================
def check_capability_claims(article, texts):
    """检查能力声明是否标注了来源类型"""
    issues = []
    registry = article.get('claims_registry', [])
    full = _full_text(texts)

    # 检查注册表中的能力声明
    for claim in registry:
        if claim.get('category') != 'capability':
            continue
        source_type = claim.get('source_type', '')
        if source_type not in ('official', 'personal_test', 'third_party'):
            issues.append({
                'check': 'C8',
                'severity': MEDIUM,
                'location': 'claims_registry',
                'text': claim.get('claim', '')[:80],
                'problem': '能力声明未标注来源类型',
                'suggestion': '请标注source_type：official(官方数据) / personal_test(个人实测) / third_party(第三方评测)',
            })

    # 检查正文中的能力声明是否有适当的限定词
    capability_patterns = [
        r'(?:能|可以|能够)(?:自动|自主|独立)(?:完成|执行|处理|调用|生成|分析|整理)',
        r'(?:任务|能力|性能)(?:达到|为|是)\s*\d+%',
    ]
    for pattern in capability_patterns:
        for m in re.finditer(pattern, full):
            start = max(0, m.start() - 60)
            end = min(len(full), m.end() + 60)
            ctx = full[start:end]
            # 检查是否有"根据官方数据""在我的测试中"等限定
            has_qualifier = any(q in ctx for q in [
                '官方', '根据', '据', '在我的', '我实测', '我的测试',
                '从我的', '我注意到', '我发现', '预览版', '正式版',
                '测试中', '实测', '体验',
            ])
            if not has_qualifier:
                issues.append({
                    'check': 'C8',
                    'severity': LOW,
                    'location': '正文',
                    'text': ctx,
                    'problem': '能力声明缺少来源限定（官方数据还是个人体验？）',
                    'suggestion': '建议添加限定词，如"根据腾讯官方数据""在我的实测中"',
                })

    return issues


# ============================================================
#  C9: 匿名信源风险检查
# ============================================================
def check_anonymous_sources(article, texts):
    """检查匿名信源的使用"""
    issues = []
    full = _full_text(texts)

    anonymous_count = 0
    for pattern in ANONYMOUS_SOURCE_PATTERNS:
        matches = list(re.finditer(pattern, full))
        anonymous_count += len(matches)

    if anonymous_count > 3:
        issues.append({
            'check': 'C9',
            'severity': HIGH,
            'location': '全文统计',
            'text': f'全文共{anonymous_count}处匿名信源',
            'problem': '匿名信源过多（>3处），严重影响可信度',
            'suggestion': '将匿名信源替换为具名信源，或删除无法核实的引用',
        })
    elif anonymous_count > 0:
        issues.append({
            'check': 'C9',
            'severity': MEDIUM,
            'location': '全文统计',
            'text': f'全文共{anonymous_count}处匿名信源',
            'problem': '存在匿名信源，建议尽量具名化',
            'suggestion': '每个匿名引用都应尽量找到具体来源',
        })

    return issues


# ============================================================
#  C10: 图片说明准确性检查
# ============================================================
def check_image_captions(article, texts):
    """检查图片说明是否与正文声明一致"""
    issues = []

    for sec in article.get('sections', []):
        for el in sec.get('elements', []):
            if el.get('type') != 'image':
                continue
            caption = el.get('caption', '')
            if not caption:
                issues.append({
                    'check': 'C10',
                    'severity': MEDIUM,
                    'location': f'第{sec.get("num")}节',
                    'text': '(图片无说明)',
                    'problem': '图片缺少说明文字',
                    'suggestion': '请为图片添加准确的说明文字',
                })
                continue

            # 检查说明中是否包含具体数字/声明，如果有，是否与正文一致
            caption_numbers = re.findall(r'[\d.]+[%％万亿万]?', caption)
            if caption_numbers:
                # 在正文中搜索同一节的内容，看是否有对应数字
                section_texts = []
                for other_el in sec.get('elements', []):
                    if other_el.get('type') == 'body':
                        section_texts.append(other_el.get('text', ''))
                section_full = ' '.join(section_texts)
                for num in caption_numbers:
                    clean = num.replace('%', '').replace('％', '').replace('万', '')
                    if clean and clean not in section_full and len(clean) >= 2:
                        issues.append({
                            'check': 'C10',
                            'severity': MEDIUM,
                            'location': f'第{sec.get("num")}节图片说明',
                            'text': caption[:80],
                            'problem': f'图片说明中的数字"{num}"在正文中未找到对应内容',
                            'suggestion': '请确保图片说明与正文数据一致',
                        })

    return issues


# ============================================================
#  C11: 主观伪装客观检查
# ============================================================
def check_subjective_as_objective(article, texts):
    """检查主观判断是否伪装成客观事实"""
    issues = []
    full = _full_text(texts)

    for pattern in SUBJECTIVE_AS_OBJECTIVE_PATTERNS:
        for m in re.finditer(pattern, full):
            start = max(0, m.start() - 30)
            end = min(len(full), m.end() + 80)
            ctx = full[start:end]
            issues.append({
                'check': 'C11',
                'severity': MEDIUM,
                'location': '正文',
                'text': ctx,
                'problem': f'可能将主观判断伪装成客观事实："{m.group()}"',
                'suggestion': '如果是个人判断，建议用"我认为""我判断""在我看来"等主观表达',
            })

    # 检查"所有人都""没有人不""每个...都"等过度概括
    overgeneralize = [
        r'所有(?:人|用户|企业|公司)(?:都|必须|应该)',
        r'没有(?:人|企业|公司)(?:不|不会)',
        r'每个(?:人|用户)(?:都|必须)',
        r'(?:任何|无论谁)(?:都|都能|都可以)',
    ]
    for pattern in overgeneralize:
        for m in re.finditer(pattern, full):
            start = max(0, m.start() - 20)
            end = min(len(full), m.end() + 60)
            ctx = full[start:end]
            issues.append({
                'check': 'C11',
                'severity': LOW,
                'location': '正文',
                'text': ctx,
                'problem': '过度概括，可能不符合实际情况',
                'suggestion': '建议添加限定词，如"大多数""大部分""通常情况下"',
            })

    return issues


# ============================================================
#  C12: 信源注册表完整性检查
# ============================================================
def check_claims_registry(article, texts):
    """检查信源注册表是否完整"""
    issues = []
    registry = article.get('claims_registry', [])
    full = _full_text(texts)

    if not registry:
        issues.append({
            'check': 'C12',
            'severity': HIGH,
            'location': 'article dict',
            'text': '未提供claims_registry',
            'problem': '文章缺少信源注册表，无法进行系统性事实核查',
            'suggestion': '请在article dict中添加claims_registry字段，列出所有可验证的事实声明及其来源',
        })
        return issues

    # 统计各类声明
    categories = {}
    for claim in registry:
        cat = claim.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1

    # 检查是否所有数字类声明都有来源
    data_categories = {'benchmark', 'parameter', 'pricing', 'market', 'spec', 'calculation'}
    for claim in registry:
        cat = claim.get('category', '')
        if cat in data_categories:
            source = claim.get('source', '')
            if not source or source in NO_SOURCE:
                issues.append({
                    'check': 'C12',
                    'severity': HIGH,
                    'location': 'claims_registry',
                    'text': claim.get('claim', '')[:80],
                    'problem': f'{cat}类声明缺少信源',
                    'suggestion': '请补充source字段',
                })

    # 检查是否有"verified"标记为False的声明
    for claim in registry:
        if claim.get('verified') is False:
            issues.append({
                'check': 'C12',
                'severity': HIGH,
                'location': 'claims_registry',
                'text': claim.get('claim', '')[:80],
                'problem': '声明标记为未核实(verified=False)',
                'suggestion': '请在发布前完成核实，或从文章中移除该声明',
            })

    # 打印统计
    print(f"  Claims registry: {len(registry)} claims")
    for cat, count in sorted(categories.items()):
        print(f"    {cat}: {count}")

    return issues


# ============================================================
#  主函数
# ============================================================
def fact_check(article):
    """
    执行完整事实核查

    Args:
        article: article dict，包含title, sections, claims_registry等

    Returns:
        (passed, issues_list)
        passed: bool - 是否通过（无HIGH级别问题）
        issues_list: list of issue dicts
    """
    print("\n" + "=" * 60)
    print("事实核查（第23项检查）")
    print("=" * 60)

    texts = _extract_all_text(article)
    full = _full_text(texts)

    all_issues = []

    # 运行12项子检查
    checks = [
        ('C1', '数据信源', check_data_sources),
        ('C2', '引用归属', check_quote_attribution),
        ('C3', '排名基准', check_ranking_claims),
        ('C4', '数学自洽', check_math_consistency),
        ('C5', '数据一致', check_data_consistency),
        ('C6', '产品版本', check_product_versions),
        ('C7', '时间线', check_temporal_claims),
        ('C8', '能力声明', check_capability_claims),
        ('C9', '匿名信源', check_anonymous_sources),
        ('C10', '图片说明', check_image_captions),
        ('C11', '主观客观', check_subjective_as_objective),
        ('C12', '注册表完整', check_claims_registry),
    ]

    for code, name, check_fn in checks:
        try:
            issues = check_fn(article, texts)
            all_issues.extend(issues)
            high_count = sum(1 for i in issues if i['severity'] == HIGH)
            med_count = sum(1 for i in issues if i['severity'] == MEDIUM)
            low_count = sum(1 for i in issues if i['severity'] == LOW)
            status = '✓' if high_count == 0 else '✗'
            print(f"  {status} {code} {name}: {len(issues)}个问题 (HIGH={high_count}, MED={med_count}, LOW={low_count})")
        except Exception as e:
            print(f"  ! {code} {name}: 检查异常 - {e}")
            all_issues.append({
                'check': code,
                'severity': MEDIUM,
                'location': '系统',
                'text': str(e),
                'problem': f'{name}检查执行异常',
                'suggestion': '请检查异常原因',
            })

    # 汇总
    high_issues = [i for i in all_issues if i['severity'] == HIGH]
    med_issues = [i for i in all_issues if i['severity'] == MEDIUM]
    low_issues = [i for i in all_issues if i['severity'] == LOW]

    print(f"\n  汇总: HIGH={len(high_issues)}, MEDIUM={len(med_issues)}, LOW={len(low_issues)}")
    passed = len(high_issues) == 0
    print(f"  结果: {'PASS ✓' if passed else 'FAIL ✗'} (HIGH=0才能通过)")

    if all_issues:
        print(f"\n  {'='*50}")
        print(f"  详细问题清单:")
        print(f"  {'='*50}")
        for i, issue in enumerate(all_issues, 1):
            sev_mark = {'HIGH': '🔴', 'MEDIUM': '🟡', 'LOW': '🔵'}.get(issue['severity'], '⚪')
            print(f"\n  {sev_mark} [{issue['check']}] {issue['severity']}")
            print(f"    位置: {issue['location']}")
            print(f"    原文: {issue['text'][:100]}")
            print(f"    问题: {issue['problem']}")
            print(f"    建议: {issue['suggestion']}")

    return passed, all_issues


# ============================================================
#  辅助：从article dict自动提取claims（供人工审核后填入注册表）
# ============================================================
def auto_extract_claims(article):
    """
    自动从文章中提取所有可能的的事实声明
    输出为claims_registry格式的初稿，供人工审核后使用
    """
    texts = _extract_all_text(article)
    full = _full_text(texts)
    claims = []

    # 提取所有数字+上下文
    number_pattern = r'([\d][\d,.]*[%％万亿万]?)'
    sentences = re.split(r'[。！？\n]', full)
    for sent in sentences:
        numbers = re.findall(number_pattern, sent)
        if not numbers:
            continue
        # 跳过太短或纯数字的句子
        if len(sent.strip()) < 10:
            continue
        # 判断类别
        category = 'unknown'
        if any(w in sent for w in ['参数', '亿参数']):
            category = 'parameter'
        elif any(w in sent for w in ['上下文', '词元', 'token', 'context']):
            category = 'spec'
        elif any(w in sent for w in ['评测', '得分', '分数', '排名', '第一']):
            category = 'benchmark'
        elif any(w in sent for w in ['元/', '定价', '价格', '收费', '费用']):
            category = 'pricing'
        elif any(w in sent for w in ['份额', '市场', '用户数']):
            category = 'market'
        elif any(w in sent for w in ['涨幅', '增长', '提高', '降低', '下降']):
            category = 'calculation'
        elif any(w in sent for w in ['发布', '上线', '开放', '内测', '公测']):
            category = 'timeline'
        elif any(w in sent for w in ['能', '可以', '支持', '实现']):
            category = 'capability'

        claims.append({
            'claim': sent.strip()[:120],
            'category': category,
            'numbers': numbers,
            'source': '',  # 待人工填写
            'verified': False,
        })

    return claims


if __name__ == '__main__':
    # 测试：从已构建的DOCX反向提取（实际使用时直接从article dict调用）
    print("事实核查模块 v1.0")
    print("用法: from lib.fact_check import fact_check")
    print("      passed, issues = fact_check(article_dict)")
    print()
    print("自动提取声明: from lib.fact_check import auto_extract_claims")
    print("              claims = auto_extract_claims(article_dict)")
