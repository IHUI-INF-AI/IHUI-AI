#!/usr/bin/env python3
"""
koubo_validate.py — 口播稿全量验证脚本 v1.0

覆盖 AGENTS.md 十二节全部验证标准:
  - 12.1 技术约束验证（21项逐篇检查）
  - 12.2 跨篇去重验证
  - 6.1 栏目分配验证
  - 3.x 永久禁令检测
  - 3.4 抖音平台安全红线

用法: python koubo_validate.py [MMDD.txt]
默认: 自动查找当天日期文件

标准: 完美细致完整毫无遗漏
"""

import sys, re, os, io, hashlib
from collections import Counter, defaultdict
from datetime import datetime, timedelta

# 2026-07-14 v1.1 改造：统一从 koubo_terms 导入术语/歧义压缩词表
from koubo_terms import BANNED_AMBIG_COMP, TERM_CANONICAL_DICT, find_ambig_hits, find_alias_issues

# Windows cmd GBK fix: force UTF-8 output
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ============ 跨项目边界硬门禁（2026-07-20 新增·防止窜工作） ============
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # koubo_workflow/
import project_boundary
project_boundary.check_action(tool="koubo_validate.py", paths=sys.argv[1:], cwd=os.getcwd())

# Symbols (ASCII-safe for Windows cmd)
OK = '[OK]'
FAIL = '[!!]'
WARN = '[??]'
PASS_ALL = '[**]'

# ════════════════════════════════════════════════
# 解析
# ════════════════════════════════════════════════

SEPARATOR = '──────────────────────────────'

class Article:
    def __init__(self, aid, title, hashtags, pinned_comment, body, raw):
        self.aid = aid
        self.title = title
        self.hashtags = hashtags
        self.pinned_comment = pinned_comment
        self.body = body
        self.raw = raw

def parse_articles(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    blocks = re.split(r'─{5,}', content)
    articles = []
    idx = 1
    for block in blocks:
        lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
        if not lines:
            continue
        # 跳过段首的日期段头（如 "# 0720"），否则会被误当成标题、真实标题又漏进正文，
        # 导致该段首篇的正文字数/开头句式族判定被污染（2026-07-20 修复）。
        while lines and re.match(r'^#\s*\d{4}$', lines[0]):
            lines = lines[1:]
        if not lines:
            continue
        title = lines[0]
        hashtags, pinned_comment, body = [], '', ''
        # 解析流程：标题 → #话题词 → [置顶]评论 → 正文
        line_idx = 1
        if line_idx < len(lines) and lines[line_idx].startswith('#'):
            hashtags = [t.strip().lstrip('#') for t in lines[line_idx].split() if t.strip().startswith('#')]
            line_idx += 1
        if line_idx < len(lines) and lines[line_idx].startswith('[置顶]'):
            pinned_comment = lines[line_idx][4:].strip()  # 去掉[置顶]取内容
            line_idx += 1
        body = ''.join(lines[line_idx:])
        if not body or len(body) < 50:
            continue
        aid = f'A{idx}'
        if title[:1] == 'A' and len(title) > 1 and title[1].isdigit():
            aid = re.match(r'A\d+', title).group()
            title = re.sub(r'^A\d+\s*', '', title)
        articles.append(Article(aid, title, hashtags, pinned_comment, body, block.strip()))
        idx += 1
    return articles

# ════════════════════════════════════════════════
# 规则常量
# ════════════════════════════════════════════════

NORTHEAST_MARKERS = {
    '咱就说': 1, '说白了': 1, '你想想': 1, '你品品': 1,
    '你琢磨琢磨': 1, '咱唠唠': 1, '你寻思寻思': 2,
    '可不是嘛': 2, '你猜怎么着': 2, '你说说': 1,
    '这事儿我琢磨': 1,
}

BANNED_LOW_MARKERS = ['咱就这么说', '嘎嘎香', '咱东北话讲', '拉倒吧']
BANNED_PHRASES = [
    '而且我告诉你', '而且我跟你说', '写到这里手心都是汗的',
]
BANNED_SENTENCE_PATTERNS = [
    re.compile(r'(?:^|[。！？；，])这才是'),  # "这才是X"句式，非简单子串
]
BANNED_SENTENCES_PLAIN = ['也包括那些做', '也能沾光']
BANNED_FORMAL = ['综上所述', '由此可见', '笔者认为']
BANNED_SLANG = ['绝绝子', 'yyds', '家人们']
BANNED_FAKE_NE = ['咋地', '干哈呢']

# ── 正文自然度硬禁令（2026-07-11 用户铁律：彻底杜绝三类问题）──
# 20. 语义错乱句：动宾/偏正错配、无主悬空、读不通的短语。
#     出现即整篇打回。本表为"种子黑名单"，今后任何读不通的句式都追加到此。
BANNED_GARBLED = [
    '教AI平台', '教人工智能平台', '教机器平台', '教智能平台',
    '用这些AI平台', '让孩子用AI平台', '让孩子用这些AI',
    'AI平台到底该', '教我们教AI',
]
BANNED_GARBLED_PATTERNS = [
    re.compile(r'教[^，。？！]{0,5}(AI|人工智能|机器|智能)[^，。？！]{0,5}平台'),  # 教…平台（把平台当谓语宾语）
    re.compile(r'用[^，。？！]{0,6}AI平台[^，。？！]{0,4}到底'),      # 用AI平台到底…（悬空疑问）
    re.compile(r'(到底|究竟)[^，。？！]{0,4}(该|要|能)?(学|做|用|教|干)什么[？?]'),  # 到底该学什么（缺主语悬空疑问）
]
# 22. 生硬自报家门（商业名片式自我介绍，AI模板腔）—— 2026-07-20 用户铁律：
#     口播稿禁止"我是做AI教育的李总/我是李总/我就是李总"等自报家门；人设用"我办学/我带学员"自然带出
#     （与 7 篇统一口吻，账号名已含"李总"）。出现即整篇打回（同语义通顺硬门禁）。
BANNED_SELF_LABEL_PATTERNS = [
    re.compile(r'我(是|就是|叫)[^，。！？]{0,10}?李总'),
    re.compile(r'我[，,]\s*李总'),
]
# 21. 空头论点：承诺"最关键就一点/关键就一条"等单一论点，但后文未立住。
HOLLOW_POINT_ANCHORS = [
    '最关键就一点', '最关键的一点', '关键就一条', '关键就一条',
    '说白了就一句', '核心就一点', '其实就一句', '核心就一句话',
    '说白了就一句话',
]
HOLLOW_JUDGMENT = ['是', '在于', '等于', '比', '关键在', '本质', '就是', '说明', '真相', '最', '核心']
HOLLOW_ACTION = ['赶紧', '去看看', '去查', '你试试', '你先', '先别', '现在就', '你去', '记得', '记住', '你赶紧', '你去看']
# 22. AI腔收尾反问：正文结尾生硬反问（"难道不是吗"等）。
AI_RHETORIC_END_PATTERNS = [
    re.compile(r'难道不是吗[？?]\s*$'),
    re.compile(r'难道没有吗[？?]\s*$'),
    re.compile(r'不是吗[？?]\s*$'),
    re.compile(r'对吧[？?]\s*$'),
    re.compile(r'是吧[？?]\s*$'),
    re.compile(r'你说呢[？?]\s*$'),
    re.compile(r'你说是吗[？?]\s*$'),
    re.compile(r'没毛病吧[？?]\s*$'),
    re.compile(r'难道.{0,8}吗[？?]\s*$'),
]

# 23. 生造/压缩导致歧义的词（2026-07-14 用户强制·0714 A8 "AI龙老师"事故·零容忍）
# 注意：BANNED_AMBIG_COMP / TERM_CANONICAL_DICT 已统一从 koubo_terms 导入（v1.1）
# 命中即整篇打回。错误示范：把"深圳龙岗'龙老师'AI教育产品矩阵"压缩成"AI龙老师"——听者会以为"姓龙的老师"。

CROSS_ARTICLE_PHRASES = [
    '我专门', '我自己', '你现在', '我发现', '我查了', '我认识', '我判断',
    '说实话', '身边', '朋友', '意外', '我注意到', '我意识到',
    '我研究', '我对比', '我梳理', '我翻看', '我扒了',
    '我仔细', '我特意', '最让人', '更要命的是', '出乎我意料',
    '我越', '我一直以为', '我赶紧', '我认真',
    '你想想', '你觉得', '你试试',
    '判断值不值就一个标准',
]

CTA_PATTERNS = [
    # 2026-07-16 策略翻转：评论/转发/收藏 等互动引导现在鼓励（拉评论率/转发率/收藏率），
    # 仅保留"订阅/私信/导流"类为真正CTA（仍禁，避免私域导流伤账号）。
    # 2026-07-20 用户铁律：「关注我」类 CTA 收束不再写（翻转为硬禁止，命中即 FAIL）。
    '点个关注', '关注我', '来找我', '私信我', '加我', '下期', '下集',
]

LIST_ENDING = re.compile(r'[一二三四五六七八九十百两\d]+个?[条样件事点种步].*[:：]')
LIST_NUMBERING = re.compile(r'[一二三四五六七八九十1-9][、.．]\s*\S')

BANNED_OPENINGS = [
    '近日', '据了解', '据报道', '据相关', '据悉',
    '据了解，', '据报道，',
    # 2026-07-12 新规则①：开头多样化——禁止"太X了/吓一跳"模板化起手
    '太可怕了', '太吓人了', '太震惊了', '太夸张了',
    '吓我一跳', '吓了一跳', '吓死我了', '吓人',
    '炸锅了', '炸裂了', '炸了',
    '大事件', '出大事了',
    '离谱', '太离谱了',
]

# 2026-07-12 新规则②：结构各异——禁止"新闻→分析→我做AI教育→建议"流水线
# 检测方式：如果正文前60字含新闻播报+120-200字含"我做AI教育/我们智汇"+结尾含建议清单=流水线
PIPELINE_MARKERS = {
    'news_start': re.compile(r'(刚发布|刚上线|刚宣布|推出了|发布了|上线了|宣布了)'),
    'edu_anchor': re.compile(r'我做AI教育|我们智汇|我搞AI|我做培训|我办学|我开公司|我创业'),
    'list_advice': re.compile(r'(建议.*[:：]|记住.*[:：]|给你.*[一二三四五六七八九十]|[一二三四五六七八九十]、.*[条步点样件])'),
}

# 2026-07-12 新规则③：建议自然融入——禁止结尾"三步法/三点建议"清单式收尾
# 扩展原 LIST_ENDING，覆盖"建议三步/记住三点/给你三条"等软清单
SOFT_LIST_ENDING = re.compile(r'(建议[一二三四五六七八九十两\d]+[条步点样件]|记住[一二三四五六七八九十两\d]+[条步点样件]|给你[一二三四五六七八九十两\d]+[条步点样件]|做到[一二三四五六七八九十两\d]+[条步点样件]|牢记[一二三四五六七八九十两\d]+[条步点样件])')

BANNED_HASHTAGS = {'知识科普', '抖音', '推荐', '热门'}

ABSOLUTE_WORDS = ['全网首创', '独家首发', '首选', '全网第一', '独一无二']
SAFETY_SENSITIVE = [
    '保证赚钱', '稳赚不赔', '暴富', '内幕揭秘',
    '不转不是中国人', '不转封号',
    '阶层固化', '男女对立',
    '治病', '治愈', '偏方',
    '收益率', '保本', '荐股',
]
SAFETY_LIMIT_FLOW = ['免费', '白嫖', '赚钱', '副业', '内幕', '揭秘']

COACH_PATTERNS = [
    re.compile(r'你现在可以'),
    re.compile(r'你试试'),
    re.compile(r'你做个自测'),
    re.compile(r'你现在做个'),
    re.compile(r'你赶紧'),
    re.compile(r'赶紧把'),
    re.compile(r'趁现在试试'),
    re.compile(r'赶紧试'),
    re.compile(r'赶紧打开'),
    re.compile(r'你(现在就)?去'),
    re.compile(r'赶紧去'),
    re.compile(r'先别'),
    re.compile(r'自己去'),
    re.compile(r'自己上手'),
    re.compile(r'动手试'),
    re.compile(r'别等'),
    re.compile(r'现在就'),
    re.compile(r'不妨'),
    re.compile(r'抓紧'),
    re.compile(r'自查'),
    re.compile(r'先学会'),
    re.compile(r'劝大家'),
]

SENT_ENDS = '。！？；…'
SENT_MIDS = '，、：'
ALL_PUNCT = SENT_ENDS + SENT_MIDS

# 常见英文白名单（口播中可直接读）
EN_WHITELIST = {
    'ai', 'ceo', 'api', 'app', 'ok', 'vip', 'ipo', 'token', 'agent', 'bug', 'demo',
    'gpt', 'k2', 'glm', 'mit', 'ibm', 'yc', 'bat', 'hbm', 'dram', 'gpu', 'cpu',
    'openai', 'claude', 'gemini', 'deepseek', 'anthropic', 'meta',
    'google', 'copilot', 'github', 'grok', 'llama', 'xai', 'chatgpt',
    'nvidia', 'space', 'code', 'huggingface', 'offer', 'chat',
    'challenger', 'pixel', 'pro', 'max', 'plus', 'mini', 'nano',
    'kimi', 'qwen', 'doubao', 'tiktok', 'wechat', 'linux',
    'opus', 'sonnet', 'haiku', 'deepseek',
    'sol', 'luna', 'vibe', 'voice', 'matt', 'shumer', 'coding',
    'stepx', 'step', 'aos', 'amoo', 'neo', 'fable',
    'hyocr', 'typescript', 'seedream', 'ps', 'image',
}
EN_BLACKLIST_EXAMPLES = ['m3', 'msa', 'tps', 'codex', 'finfet', 'risc-v']

# ════════════════════════════════════════════════
# 工具函数
# ════════════════════════════════════════════════

def split_sentences(text):
    """按中文标点断句，返回含标点的句子列表（标点计入字数）"""
    parts = re.split(f'([{SENT_ENDS}{SENT_MIDS}])', text)
    sentences = []
    for i in range(0, len(parts) - 1, 2):
        s = parts[i].strip()
        punct = parts[i + 1] if i + 1 < len(parts) else ''
        if s:
            sentences.append(s + punct)
    if parts and parts[-1].strip() and parts[-1] not in ALL_PUNCT:
        sentences.append(parts[-1].strip())
    return sentences

def first_clause(text):
    """取第一个分句（到第一个标点，无论哪种标点）"""
    for i, ch in enumerate(text):
        if ch in ALL_PUNCT:
            return text[:i]
    return text[:30] + '(无标点)' if len(text) > 30 else text  # 无标点时截断并标记

def classify_opening(sents):
    """开头结构族分类，用于跨篇多样性硬门禁（2026-07-16 用户质疑修复）。
    旧逻辑按首字分类且豁免'其他'类，换首字即可躲过>2上限（0715八篇中招）。
    新逻辑按 S1结构 + S2/S3死模板组合分类，取消'其他'豁免，任何族>2即FAIL。
    """
    s1 = sents[0] if len(sents) > 0 else ''
    s2 = sents[1] if len(sents) > 1 else ''
    s3 = sents[2] if len(sents) > 2 else ''
    _head = s2 + s3  # 完播承诺句常落在第2-3句（逗号可能断开）
    _window = ''.join(sents[:6])  # 取首6句窗口，确保锁钩词(常在第3-6句)不被截断
    # 0. 死模板：第2-3句含"今天用X分钟"承诺 且 首6句含"最后一个/最狠/最关键+九成/八成"锁钩
    #    两者同时出现即经典的"今天用1分钟+最后一个九成人"死模板，跨篇>2即FAIL。
    _s2_formula = bool(re.search(r'今天', _head) and re.search(r'用.{0,4}(分钟|一分半|1分钟|两分钟|三分钟)', _head))
    _s3_lock = bool(re.search(r'(最后一个|最狠的一条|最关键的一条|最绝的一条)', _window)
                    and re.search(r'(九成|八成|十有八九|都中过|都没|还没|没往)', _window))
    if _s2_formula and _s3_lock:
        return '死模板(今天用X分钟+最后一个/九成)'
    if re.match(r'^你(的)?', s1):
        return '你直戳式'
    if re.search(r'[？！]|竟然|居然|没想到|承认吧|说实话|说白了|你看', s1):
        return '惊叹疑问式'
    if re.search(r'都说|都以为|大家都|人人都|都在说|老说', s1):
        return '反共识式'
    if re.search(r'上周|那天|一个.{1,8}(拉|问|找|跟我说)|记得|去年|前年', s1):
        return '场景代入式'
    if re.search(r'刚|刚刚|今天|昨天|最近|日前|最新|月活|估值|数据|同比', s1):
        return '时效播报式'
    if re.search(r'\d', s1):
        return '数字冲击式'
    if s1.startswith('我') or re.match(r'^我', s1):
        return '身份自述式'
    return '其他自由式'

def count_in_text(text, phrase):
    return len(re.findall(re.escape(phrase), text))

def find_en_words(text):
    """找出文本中的英文词"""
    return re.findall(r'[A-Za-z]{2,}', text)

# ════════════════════════════════════════════════
# 逐篇验证
# ════════════════════════════════════════════════

# ════════════════════════════════════════════════
# 虚构社会关系模式库（2026-07-11 用户铁律·杜绝"假人设/编亲戚"）
# 命中即判 FAIL：编造未确认的同事/朋友/父母/亲戚当案例/社会证明/情感锚点。
# 创始人唯一已确认亲属是"儿子(2岁半)"，故父母/表姐/同事/朋友等一律视为虚构。
FAKE_THIRD_PATTERNS = [
    (r'我(的)?(妈|母亲|娘|爸|父亲|爹)', '虚构父母'),
    (r'我(的)?(表哥|表姐|表弟|表妹|堂哥|堂姐|堂弟|堂妹|叔|伯|舅|姨|姑|亲戚|家人)', '虚构亲属'),
    (r'我(的)?(同事|朋友|邻居|发小|同学)', '虚构社交关系'),
    (r'我认识(的)?(一个|位|个)?(医生|老师|朋友|客户|老板|人|同行|专家)', '虚构熟人'),
    (r'身边(的)?(几个|五个|一些|那些|的)?(朋友|同事|人|小朋友|家长|学员)', '虚构身边人'),
    (r'(好?几个|几个|一些|那些|那几个|三五|两三个)\s*(个)?\s*(同事|朋友|邻居|熟人|小朋友|家长)', '虚构社交关系(模糊量词)'),
    (r'我(发给|问了|专门问了|跟|和|找|对)(做内容|医疗圈|身边|几个|一些|那个|我)?(的)?(同事|朋友|邻居|熟人)', '虚构社交关系(当佐证)'),
    (r'(同事|朋友|邻居|熟人)(说|看|告诉|觉得|认为|聊|讲|分享|透露|直接说)', '虚构社交关系(当佐证)'),
]

# ════════════════════════════════════════════════
# 2026-07-14 新规则：4项口播稿结构优化软警告（[??]符号显示，ok=True不计入fail）
# 4项均为软警告级别，不影响total_fail/退出码
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

# 软警告检测项集合（display函数对此集合内的项使用[??]符号，detail含"需"或"✗"时显示[??]）
# 2026-07-16 流量归因修订：结构5项铁律(7/14引入)致7/14-7/15掉量。
# 收尾金句/观点密度/结尾自我诊断/开头3句钩子 已降级为可选，不再报检查（避免逼出模板伤完播）。
# 仅保留"钩子时长"事实正确性检查（视频实际1.5分钟，禁写两/三分钟）。
SOFT_WARN_CHECKS = {'钩子时长', '话题词数量'}

# 2026-07-17 对齐 7/16 降级软项（详见 MEMORY.md）：以下检查即使不通过也不计入 real_fail / total_fail，
# 仅作展示提示，不阻断交付。包含：标题情绪待判、生僻英文专有名词、跨篇转折去重、跨篇逐句去重。
SOFT_NONFAIL = {'抖音安全', '标题情绪类型', '英文词'}
SOFT_CROSS = {'转折表达去重', '跨篇逐句去重'}


def check_article(art, all_articles):
    R = []  # (check_name, pass_bool, detail)

    # ── 1. 正文字数 470-490 ──
    blen = len(art.body)
    ok = 470 <= blen <= 490
    R.append(('字数', ok, f'{blen}字'))

    # ── 2. 标题字数 15-23 ──
    tlen = len(art.title)
    ok = 15 <= tlen <= 23
    R.append(('标题字数', ok, f'{tlen}字'))

    # ── 3. 标题情绪类型 ──
    has_num = bool(re.search(r'\d|[一二三四五六七八九十百千万亿]', art.title))
    has_verb = bool(re.search(r'[打抢杀崩炸裂撕砍赢输拼争破毁掉灭吓坑慌坐改涨跌等收]', art.title))
    has_susp = bool(re.search(r'谁|哪|为什么|怎么|竟|居然|没想到|原来|问题出在哪|还剩多少|多少', art.title))
    has_scene = bool(re.search(r'车间|毕业|花|孩子|家长|脸|简历|薪|万', art.title))
    has_rev = bool(re.search(r'却|但|竟然|居然|原来|结果|没想到|反', art.title))

    types = []
    if has_num and (has_verb or has_rev):
        types.append('数字冲突')
    if has_susp:
        types.append('悬念缺口')
    if has_scene and not has_susp:
        types.append('画面式')
    if has_verb and not has_num:
        types.append('扎心式')
    if not types:
        if has_num and has_scene:
            types.append('数字冲突')
        elif has_scene:
            types.append('画面式')
        else:
            types.append('待人工判断')
    ok = '待人工判断' not in types
    R.append(('标题情绪类型', ok, '/'.join(types)))

    # ── 4. 开头第一分句 ≤15字 + 情绪触发 ──
    fc = first_clause(art.body)
    fclen = len(fc)
    ok_len = fclen <= 15
    has_hook = bool(re.search(
        r'你|谁|！|？|还|竟|已|刚|不|没|就|才|只|又|被|全|最|太|空|一|整|大|多|爆|猛|吓|抢|暴涨|暴跌|崩|炸|疯|卷', fc
    ))
    ok = ok_len and has_hook
    R.append(('开头第一分句', ok, f'"{fc}"({fclen}字) {"✓情绪" if has_hook else "✗缺情绪"}'))

    # ── 5. 开头类型（禁止播报型） ──
    opening = art.body[:50]
    bad_opens = [p for p in BANNED_OPENINGS if p in opening]
    news_open = re.match(r'(Anthropic|OpenAI|Google|Meta|微软|阿里|百度|腾讯)\s*(刚|今天|近日)?(发布|宣布|推出)', opening)
    # 2026-07-12 新规则①：开头多样化——检测模板化起手"太X了/吓一跳/炸锅了"
    template_open = any(p in opening for p in BANNED_OPENINGS if p not in ['近日', '据了解', '据报道', '据相关', '据悉', '据了解，', '据报道，'])
    ok = not bad_opens and not news_open and not template_open
    detail = ''
    if bad_opens:
        detail += f'禁止: {",".join(bad_opens)}'
    if news_open:
        detail += ' 英文品牌/播报型开头'
    if template_open:
        detail += ' 模板化起手(太X了/吓一跳/炸锅了)'
    if ok:
        detail = '情绪钩子✓'
    R.append(('开头类型', ok, detail))

    # ── 6. 二次冲击位 280-380 ──
    turn_words = ['但', '却', '竟然', '居然', '原来', '结果', '没想到',
                  '出乎', '反转', '不对', '其实', '事实上', '最让人',
                  '更要命', '讽刺', '意外', '反过', '颠覆',
                  '而且', '同时', '另外', '关键是', '问题是', '不过', '然而',
                  '仔细一看', '再一看', '刺眼', '不对劲']
    zone_start, zone_end = 280, 380
    zone = art.body[zone_start:zone_end]
    impact_types = []
    has_price = bool(re.search(r'块|元|价|费|成本|万|千|百|免费|便宜|贵|省', zone))
    has_hidden = bool(re.search(r'不知道|没注意|偷偷|悄悄|隐藏|秘密|没人告诉|才发现', zone))
    has_cognitive = bool(re.search(r'不是.*是|其实|事实上|原来|颠覆|认知|一直以为|完全反', zone))
    has_action = bool(re.search(r'会做|不会做|差距|区别|不同|关键在', zone))
    if has_price: impact_types.append('价格反转')
    if has_hidden: impact_types.append('隐藏信息')
    if has_cognitive: impact_types.append('认知翻转')
    if has_action: impact_types.append('行动差距')

    has_turn = any(w in zone for w in turn_words)
    ok = has_turn and len(impact_types) > 0
    detail = f'280-380区间'
    if has_turn:
        detail += ' 转折✓'
    else:
        detail += ' 缺转折'
    if impact_types:
        detail += f' 类型:{"+".join(impact_types)}'
    elif has_turn:
        detail += ' 缺明确冲击类型'
    R.append(('二次冲击', ok, detail))

    # ── 7. "我" ≥8 ──
    wo = count_in_text(art.body, '我')
    ok = wo >= 8
    R.append(('"我"次数', ok, f'{wo}次'))

    # ── 8. CTA残留 = 0 ──
    # 2026-07-20 用户铁律：口播稿不再写「关注我，XXXXX」类 CTA 收束（翻转为硬禁止）。
    # 命中「关注我」即计入 CTA残留 → FAIL。其余订阅/私信/导流类（点个关注/来找我/私信我/加我/下期/下集）仍禁。
    found_cta = []
    for c in CTA_PATTERNS:
        if c in art.body:
            found_cta.append(c)
    ok = len(found_cta) == 0
    R.append(('CTA残留', ok, f'发现: {",".join(found_cta)}' if found_cta else '0次'))

    # ── 8.5 李总收束硬门禁（2026-07-17 人设铁律）──
    # 「我」=李总，第一人称自述不需要再提名字。结尾收束句（末40字）禁止出现「李总」。
    ending_tail = art.body.strip()[-40:]
    if '李总' in ending_tail:
        R.append(('李总收束', False, '结尾收束句出现「李总」(第一人称禁自呼其名)'))
    else:
        R.append(('李总收束', True, '0次'))

    # ── 9. 东北味标记词 ──
    marker_issues = []
    for marker, limit in NORTHEAST_MARKERS.items():
        c = count_in_text(art.body, marker)
        if c > limit:
            marker_issues.append(f'{marker}={c}/{limit}')
    ok = len(marker_issues) == 0
    shown = ', '.join(f'{m}={count_in_text(art.body,m)}' for m in NORTHEAST_MARKERS if count_in_text(art.body,m)>0)
    R.append(('东北味标记词', ok, marker_issues and '; '.join(marker_issues) or shown or '无'))

    # ── 10. 禁用表达 = 0 ──
    found_ban = [b for b in BANNED_PHRASES if b in art.body]
    found_low = [b for b in BANNED_LOW_MARKERS if b in art.body]
    found_sent = [b for b in BANNED_SENTENCES_PLAIN if b in art.body]
    found_pat = [p.search(art.body).group() for p in BANNED_SENTENCE_PATTERNS if p.search(art.body)]
    found_formal = [b for b in BANNED_FORMAL if b in art.body]
    found_slang = [b for b in BANNED_SLANG if b in art.body]
    found_fake_ne = [b for b in BANNED_FAKE_NE if b in art.body]
    all_banned = found_ban + found_low + found_sent + found_pat + found_formal + found_slang + found_fake_ne
    ok = len(all_banned) == 0
    R.append(('禁用表达', ok, f'发现: {",".join(all_banned)}' if all_banned else '0次'))

    # ── 11. 结尾类型 ──
    ending = art.body[-60:]
    end_issues = []
    for cta in CTA_PATTERNS:
        if cta in ending:
            end_issues.append(f'CTA:{cta}')  # 2026-07-20：「关注我」不再豁免，命中即记
    if LIST_ENDING.search(ending):
        end_issues.append('列举式')
    if LIST_NUMBERING.search(ending[-40:]):
        end_issues.append('编号列举')
    # 2026-07-12 新规则③：建议自然融入——禁止"建议三步/记住三点/给你三条"软清单
    if SOFT_LIST_ENDING.search(ending):
        end_issues.append('软清单收尾(建议N条/记住N点)')

    end_types = []
    if re.search(r'[？?]', ending):
        end_types.append('反问式')
    if re.search(r'(赶紧|现在就|趁现在|去做|去试)', ending):
        end_types.append('行动式')
    if not end_types and not end_issues:
        end_types.append('金句式')

    ok = len(end_issues) == 0
    detail = f'类型:{"+".join(end_types) if end_types else "无"}'
    if end_issues:
        detail += f' 问题:{",".join(end_issues)}'
    R.append(('结尾类型', ok, detail))

    # ── 12. 句子长度 ≤35字 ──
    sentences = split_sentences(art.body)
    long_sents = [(s, len(s)) for s in sentences if len(s) > 35]
    ok = len(long_sents) == 0
    if long_sents:
        detail = f'{len(long_sents)}句超标'
        for s, l in long_sents[:3]:
            detail += f' | "{s[:20]}..."={l}字'
    else:
        detail = f'全部≤35字(最长{max((len(s) for s in sentences), default=0)}字)'
    R.append(('句子长度', ok, detail))

    # ── 13. 英文词检查 ──
    en_words = find_en_words(art.body)
    unknown_en = []
    for w in en_words:
        wl = w.lower()
        if wl not in EN_WHITELIST and len(wl) > 1:
            # 检查是否包含在白名单中（如GPT-5.6中的GPT）
            if not any(wl.startswith(white) for white in EN_WHITELIST):
                unknown_en.append(w)
    ok = len(unknown_en) == 0
    R.append(('英文词', ok, f'生僻: {",".join(set(unknown_en))}' if unknown_en else '均为常见词'))

    # ── 14. 抖音安全红线（警告级） ──
    safety_hits = []
    for w in ABSOLUTE_WORDS:
        if w in art.body:
            safety_hits.append(w)
    for w in SAFETY_SENSITIVE:
        if w in art.body:
            safety_hits.append(w)
    # "免费"在正文出现（非引述场景）需要警惕
    if '免费' in art.body:
        safety_hits.append('免费(注意语境)')
    ok = len(safety_hits) == 0
    R.append(('抖音安全', ok, f'触发: {",".join(safety_hits)}' if safety_hits else '无触发'))

    # ── 15. 教练穿插 ≥1 ──
    coach_count = 0
    coach_found = []
    for p in COACH_PATTERNS:
        m = p.findall(art.body)
        if m:
            coach_count += len(m)
            coach_found.append(m[0])
    ok = coach_count >= 1
    R.append(('教练穿插', ok, f'{coach_count}处: {",".join(coach_found[:3])}' if coach_found else '0处'))

    # ── 16. 热点锚点（前150字含数字或时间词） ──
    head = art.body[:150]
    has_number = bool(re.search(r'\d|[一二三四五六七八九十百千万亿]', head))
    has_time = bool(re.search(r'今[天日]|昨[天日]|本周|这[周月年]|最近|刚刚|刚才|\d+月|\d+号|\d+日|\d{2,4}年', head))
    ok = has_number or has_time
    R.append(('热点锚点', ok, f'{"数字✓" if has_number else ""}{"时间✓" if has_time else ""}' or '前150字缺数字/时间'))

    # ── 17. 禁止导流词 ──
    daoliu = ['来找我', '私信我', '加我', '能听懂的']
    found_dl = [d for d in daoliu if d in art.body]
    ok = len(found_dl) == 0
    R.append(('导流词', ok, f'发现: {",".join(found_dl)}' if found_dl else '0次'))

    # ── 18. "很多人没看懂/没想到/注意的是" = 0 ──
    banned_many = ['很多人没看懂', '很多人没想到', '很多人注意的是']
    found_bm = [b for b in banned_many if b in art.body]
    ok = len(found_bm) == 0
    R.append(('禁用"很多人X"', ok, f'发现: {",".join(found_bm)}' if found_bm else '0次'))

    # ── 19. 置顶评论钩子（2026-07-16 用户命令：取消置顶评论，改为可选）──
    pc = art.pinned_comment
    if not pc:
        R.append(('置顶评论', True, '未生成(用户2026-07-16起取消)'))
    else:
        pc_len = len(pc)
        issues = []
        if pc_len < 10:
            issues.append(f'太短({pc_len}字<10)')
        if pc_len > 45:
            issues.append(f'太长({pc_len}字>45)')
        # 禁止CTA词（去重）
        pc_cta = [c for c in ['评论区说说', '评论区告诉我', '评论区聊聊', '你怎么看',
                               '你觉得呢', '你选哪个', '留言告诉我', '说说你',
                               '你们觉得', '大家觉得'] if c in pc]
        if pc_cta:
            issues.append(f'含CTA:{",".join(pc_cta)}')
        # 禁止问号（含句中）
        if '？' in pc or '?' in pc:
            issues.append('含问号(陈述句铁律)')
        # 禁止笼统无观点
        generic = ['AI发展真快', '时代变了', '世界在变', '未来已来', '真的变了',
                    '太厉害了', '真牛', '太可怕了']
        found_gen = [g for g in generic if g in pc]
        if found_gen:
            issues.append(f'笼统:{",".join(found_gen)}')
        # 反模式：反问句（扩展模式）
        if re.search(r'难道不是吗|不是吗$|对不对$|是不是$|你信吗$|真的假的$|怎么可能$', pc.rstrip()):
            issues.append('反问句(低质)')
        # 反模式：纯emoji（无中文字符）
        if not re.search(r'[\u4e00-\u9fff]', pc):
            issues.append('无中文内容(疑似纯emoji)')
        # 反模式：与标题雷同（提取标题核心关键词，检查置顶评论是否重复）
        if art.title:
            # 提取标题中的数字+名词组合（≥2字的连续中文片段）
            title_segments = re.findall(r'[\u4e00-\u9fff]{2,}', art.title)
            pc_core = pc[:15]  # 取置顶评论前15字比对
            overlap = [seg for seg in title_segments if len(seg) >= 4 and seg in pc_core]
            if overlap:
                issues.append(f'与标题雷同({",".join(overlap)})')
        ok = len(issues) == 0
        detail = f'{pc_len}字'
        if issues:
            detail += f' ⚠ {"; ".join(issues)}'
        else:
            detail += f' "{pc[:30]}{"..." if len(pc)>30 else ""}"'
        R.append(('置顶评论', ok, detail))

    # ── 20. 语义通顺（动宾/偏正错配、悬空疑问）──
    garbled_hits = [g for g in BANNED_GARBLED if g in art.body]
    for p in BANNED_GARBLED_PATTERNS:
        m = p.search(art.body)
        if m:
            garbled_hits.append(m.group())
    ok = len(garbled_hits) == 0
    R.append(('语义通顺', ok, f'错乱句: {"; ".join(garbled_hits)}' if garbled_hits else '无读不通句式'))

    # ── 22. 生硬自报家门（商业名片式自我介绍，AI模板腔）──
    self_label_hits = []
    for p in BANNED_SELF_LABEL_PATTERNS:
        m = p.search(art.body)
        if m:
            self_label_hits.append(m.group())
    ok = len(self_label_hits) == 0
    R.append(('生硬自报家门', ok, f'自报家门: {"; ".join(self_label_hits)}' if self_label_hits else '无'))

    # ── 21. 论点立住（承诺单一论点必须后接明确判断）──
    hollow_hit = None
    for anc in HOLLOW_POINT_ANCHORS:
        pos = art.body.find(anc)
        if pos >= 0:
            tail = art.body[pos + len(anc):]
            tail_clause = tail.split('。')[0]
            jpos = 10**9
            for w in HOLLOW_JUDGMENT:
                p = tail_clause.find(w)
                if p >= 0:
                    jpos = p
                    break
            apos = 10**9
            for w in HOLLOW_ACTION:
                p = tail_clause.find(w)
                if p >= 0:
                    apos = p
                    break
            if apos < jpos:
                hollow_hit = anc
            break
    ok = hollow_hit is None
    R.append(('论点立住', ok,
              f'空头论点: "{hollow_hit}"承诺单一论点但后文直接跳行动、未立住' if hollow_hit
              else '论点承诺词后均有明确判断'))

    # ── 22. 结尾自然（禁止AI腔生硬反问收尾）──
    end_txt = art.body.rstrip()[-45:]
    rh_hits = [p.pattern for p in AI_RHETORIC_END_PATTERNS if p.search(end_txt)]
    ok = len(rh_hits) == 0
    R.append(('结尾自然', ok, f'AI腔反问: {"; ".join(rh_hits)}' if rh_hits else '无生硬反问收尾'))

    # ── 23. 生造/压缩导致歧义的词（2026-07-14 用户强制·0714 A8 事故·零容忍）──
    # 标题+正文+置顶合并扫描；命中即整篇打回
    full_text = art.title + '\n' + art.body + (art.pinned_comment or '')
    ambig_hits = []
    for p in BANNED_AMBIG_COMP:
        m = p.search(full_text)
        if m:
            ambig_hits.append(m.group())
    ok = len(ambig_hits) == 0
    R.append(('生造歧义词', ok,
              f'命中: {"; ".join(ambig_hits)}（详见 AGENTS.md 2.7）' if ambig_hits else '无生造/压缩歧义词'))

    # ── 24. 跨稿统一词表一致性（WARN 级，不计入FAIL）──
    canonical_hits = []
    for canonical, *aliases in TERM_CANONICAL_DICT:
        for alias in aliases:
            if alias and alias in full_text and canonical not in full_text:
                canonical_hits.append('"%s"→"%s"' % (alias, canonical))
                break
    if canonical_hits:
        R.append(('跨稿词表一致', True, f'{len(canonical_hits)}处需统一: {", ".join(canonical_hits[:3])}（如本篇确需使用该写法请登记到 TERM_CANONICAL_DICT）'))
    else:
        R.append(('跨稿词表一致', True, '全稿称谓与词表一致✓'))

    # ── 虚构社会关系/人设检测（2026-07-11 用户铁律·杜绝"假人设/编亲戚"）──
    _fake_text = art.body + (getattr(art, 'top', '') or '')
    _fake_hits = []
    for _pat, _ftype in FAKE_THIRD_PATTERNS:
        _m = re.search(_pat, _fake_text)
        if _m:
            _fake_hits.append('[%s]%s' % (_ftype, _m.group(0)))
    _ok_fake = len(_fake_hits) == 0
    _detail_fake = '无虚构亲属/同事✓' if _ok_fake else '虚构:' + ';'.join(_fake_hits)
    R.append(('虚构社会关系', _ok_fake, _detail_fake))

    # ── 25. 前3秒冲突强度（2026-07-16 流量增长门禁·硬FAIL）──
    # 开头第一句必须含冲突/代价/反共识/身份刺痛/好奇缺口 任一强钩子，
    # 直接拉前3秒完播率（抖音/视频号完播权重最高）。
    _sa = split_sentences(art.body)
    _m = re.search(r'[。！？]', art.body)
    _open_sent = art.body[:_m.start() + 1] if _m else art.body[:60]
    _hook_strength = [
        r'多花|白花|亏|赔|丢|裁|删|禁|坑|雷|炸|崩|抢|慌|吓|肉疼|烧钱|白搭|流钱|贵|省|涨|跌|封|停|卷|作废|废',
        r'都说|都以为|人人都|老说|别信|别被|别迷信|其实没|根本不|戳破|真相|骗局|智商税|坑你|别再|醒醒|别只',
        r'你(的)?(手机|会员|账单|公司|号|钱|工资|主业)|普通人|创业者|副业|小白|新手',
        r'为什么|凭什么|怎么做到|没想到|竟|居然|说实话|承认吧|你中招|你踩',
    ]
    _strength_hit = bool(_open_sent) and any(re.search(p, _open_sent) for p in _hook_strength)
    R.append(('前3秒冲突强度', _strength_hit,
              '强钩子✓' if _strength_hit else '缺冲突/代价/反共识信号，前3秒钩子弱(伤完播)'))

    # ── 26. 结尾评论钩子（2026-07-16 流量增长门禁·硬FAIL）──
    # 结尾末句必须抛问题/二选一/你…互动，拉评论率（算法顶级权重）。
    # 注意：避开 AI腔生硬反问(对不对/是不是/难道不是吗 等由#22拦截)，用真互动钩子。
    _end_sent2 = _sa[-1] if _sa else ''
    _end_zone2 = art.body[-60:]
    _has_q = bool(re.search(r'[？?]', _end_sent2)) or bool(re.search(r'[？?]', _end_zone2))
    _comment_bait = [
        r'你(用过|踩过|遇到|中招|花|亏|试过|选|站|服|认同|说是|猜|说呢|觉得|敢|发现|缺|中了|做过|换过|用对|用错|卡过|开过|退过)',
        r'你们|大家|朋友们',
        r'评论区|留言区|弹幕|说说|聊聊|报个数|扣1|扣个',
        r'你选哪个|你站哪边|你服不服|认不认同|同不同意|你敢|你说是',
    ]
    _bait_hit = _has_q or any(re.search(p, _end_zone2) for p in _comment_bait)
    R.append(('结尾评论钩子', _bait_hit,
              '评论钩子✓' if _bait_hit else '缺评论钩子(结尾需抛问题/二选一/你…互动拉评论)'))

    # ── 27. 话题词数量（2026-07-16 用户规则·4个为准）──
    # 规则（AGENTS.md §6.3）：每篇话题词 4 个（四层各 1；第4层最多放 2 个品牌词时不超 5）。
    # 判定：count==4 → PASS；count==5 → WARN（文档允许的第4层2品牌词例外，需人工确认是否真属该情形）；
    #       count<4 或 count>5 → FAIL（偏离4且非文档例外）。
    _ntag = len(art.hashtags)
    if _ntag == 4:
        R.append(('话题词数量', True, f'{_ntag}个✓'))
    elif _ntag == 5:
        R.append(('话题词数量', True, f'{_ntag}个[??需确认是否为第4层2品牌词例外]'))
    else:
        R.append(('话题词数量', False, f'{_ntag}个[FAIL 应为4,5仅第4层2品牌词例外]'))

    # ── 2026-07-14 新规则：4项口播稿结构优化软警告（ok=True避免计入fail，detail含"需"时display显示[??]）──
    # 优化1·开头3句钩子公式：S2=完播承诺句, S3=完播锁钩句
    _sents_list = [s for s in re.split(r'[。！？]', art.body) if s.strip()]
    _hook_s2_ok = False
    _hook_s3_ok = False
    if len(_sents_list) >= 2:
        _s2 = _sents_list[1]
        _has_hook = any(p in _s2 for p in S2_HOOK_PATS)
        _has_aud = any(p in _s2 for p in S2_AUDIENCE_PATS)
        _hook_s2_ok = _has_hook and _has_aud
    if len(_sents_list) >= 3:
        _s3 = _sents_list[2]
        _hook_s3_ok = any(p in _s3 for p in S3_LOCK_PATS)
    _hook_detail = ''
    if _hook_s2_ok and _hook_s3_ok:
        _hook_detail = 'S2/S3均符合✓'
    else:
        _miss = []
        if not _hook_s2_ok: _miss.append('S2(完播承诺)')
        if not _hook_s3_ok: _miss.append('S3(完播锁钩)')
        _hook_detail = '缺%s，需补齐S2=身份+承诺/S3=锁钩' % ','.join(_miss)
    # 2026-07-16 降级：开头3句钩子公式已降为可选（classify_opening 多样性为硬门禁），不再报检查

    _dur_bad = bool(len(_sents_list) >= 2 and BAD_DURATION_PAT.search(_sents_list[1]))
    _dur_detail = '1分钟/一分半✓' if not _dur_bad else '超实际时长✗需改为1分钟'
    R.append(('钩子时长', True, _dur_detail))

    # 优化2·段落收尾金句类型（每篇≥2种）
    _ptypes = []
    for _ptype, _pat in PUNCHLINE_PATTERNS.items():
        if _pat.search(art.body):
            _ptypes.append(_ptype)
    if len(_ptypes) >= 2:
        _punch_detail = '%d种✓:%s' % (len(_ptypes), ','.join(_ptypes))
    else:
        _punch_detail = '仅%d种(%s)，需≥2种(概念反转/类比画面/数据落差/反共识)' % (len(_ptypes), ','.join(_ptypes) if _ptypes else '无')
    # 2026-07-16 降级：收尾金句类型已降为可选，不再报检查（避免逼出模板伤完播）

    # 优化3·观点密度（含判断词的句子数≥4达标）
    _opinion_count = sum(1 for s in _sents_list if any(w in s for w in OPINION_WORDS))
    if _opinion_count >= 4:
        _op_detail = '%d个判断句✓' % _opinion_count
    else:
        _op_detail = '%d个判断句，需≥4个' % _opinion_count
    # 2026-07-16 降级：观点密度已降为可选，不再报检查（避免逼出模板伤完播）

    # 优化4·结尾自我诊断引导（末50字含软引导词）
    _ending_50 = art.body[-50:]
    _diag_hits = [w for w in ENDING_DIAG_PATS if w in _ending_50]
    if _diag_hits:
        _diag_detail = '命中✓:%s' % ','.join(_diag_hits)
    else:
        _diag_detail = '末50字缺软引导词，需补(你对照/你想想/你琢磨/等着看/你猜...)'
    # 2026-07-16 降级：结尾自我诊断已降为可选，不再报检查（避免逼出模板伤完播）

    return R

# ════════════════════════════════════════════════
# 跨篇验证
# ════════════════════════════════════════════════

def cross_article_checks(articles, filepath=''):
    R = []

    # ── 跨篇去重: 高频表达扫描 ──
    phrase_articles = defaultdict(set)
    for art in articles:
        text = art.body
        for phrase in CROSS_ARTICLE_PHRASES:
            if phrase in text:
                phrase_articles[phrase].add(art.aid)
    # 转为排序列表用于显示
    phrase_articles = {p: sorted(aids, key=lambda x: int(x[1:])) for p, aids in phrase_articles.items()}
    overused = {p: aids for p, aids in phrase_articles.items() if len(aids) > 2}
    ok = len(overused) == 0
    detail = ''
    if overused:
        parts = [f'"{p}"({len(a)}篇:{",".join(a)})' for p, a in overused.items()]
        detail = f'{len(overused)}个超标: {"; ".join(parts[:5])}'
    else:
        near = {p: aids for p, aids in phrase_articles.items() if len(aids) == 2}
        if near:
            detail = f'{len(near)}个=2次(临界)'
        else:
            detail = '全部≤2次'
    R.append(('跨篇高频表达', ok, detail))

    # ── "说白了" 8篇≤1次 ──
    total_slb = sum(count_in_text(a.body, '说白了') for a in articles)
    ok = total_slb <= 1
    R.append(('"说白了"总计', ok, f'{total_slb}次(≤1)'))

    # ── "真正" 8篇≤3次 ──
    total_zz = sum(count_in_text(a.body, '真正') for a in articles)
    ok = total_zz <= 3
    R.append(('"真正"总计', ok, f'{total_zz}次(≤3)'))

    # ── "很多人" 8篇≤2次 ──
    total_hdp = sum(count_in_text(a.body, '很多人') for a in articles)
    ok = total_hdp <= 2
    R.append(('"很多人"总计', ok, f'{total_hdp}次(≤2)'))

    # ── "孩子" 8篇<5次 ──
    total_hz = sum(count_in_text(a.body, '孩子') for a in articles)
    ok = total_hz < 5
    R.append(('"孩子"总计', ok, f'{total_hz}次(<5)'))

    # ── 转折表达去重 ──
    # 基础连词（但/却/其实/原来）允许更多篇使用；特色表达限制更严
    BASIC_TURNS = {'但', '却', '其实', '原来'}
    turn_exprs = defaultdict(set)
    for art in articles:
        for expr in ['但', '却', '竟然', '居然', '原来', '结果', '没想到', '出乎意料',
                      '更要命', '最让人', '讽刺的是', '事实上', '其实']:
            if expr in art.body:
                turn_exprs[expr].add(art.aid)
    overused_turns = {}
    for e, aids in turn_exprs.items():
        threshold = 5 if e in BASIC_TURNS else 3
        if len(aids) > threshold:
            overused_turns[e] = sorted(aids)
    ok = len(overused_turns) == 0
    if overused_turns:
        parts = [f'"{e}"({len(a)}篇)' for e, a in overused_turns.items()]
        detail = f'{",".join(parts)}'
    else:
        detail = '转折表达多样化✓'
    R.append(('转折表达去重', ok, detail))

    # ── 开头句式多样性（结构族硬门禁·2026-07-16 用户质疑修复）──
    # 旧逻辑按首字分类且豁免"其他"类，换首字即可躲过>2上限（0715八篇全部中招）。
    # 新逻辑按"开头结构族"分类（S1结构 + S2/S3死模板组合），取消"其他"豁免，
    # 任何单一结构族>2篇即 FAIL；"今天用X分钟+最后一个/九成"死模板组合单独列为禁用族。
    opening_types = defaultdict(list)
    for art in articles:
        sents = split_sentences(art.body)
        fam = classify_opening(sents)
        opening_types[fam].append(art.aid)
    overused_open = {t: aids for t, aids in opening_types.items() if len(aids) > 2}
    ok = len(overused_open) == 0
    if overused_open:
        parts = [f'"{t}"({len(a)}篇:{",".join(a)})' for t, a in overused_open.items()]
        detail = f'{len(overused_open)}个族超标: {"; ".join(parts)}'
    else:
        detail = ', '.join(f'{t}={len(a)}' for t, a in opening_types.items())
    R.append(('开头句式多样性', ok, detail))

    # ── 结尾句式多样性 ──
    ending_types = defaultdict(list)
    for art in articles:
        ending = art.body[-40:]
        if '？' in ending or '?' in ending:
            ending_types['反问结尾'].append(art.aid)
        elif re.search(r'像.*一样|就像|好比|仿佛|如同', ending):
            ending_types['比喻/金句'].append(art.aid)
        elif re.search(r'先.*再|赶紧|现在就|去做|去试|学会', ending):
            ending_types['行动式'].append(art.aid)
        elif re.search(r'最|太|真|特别|真的|实在', ending):
            ending_types['感慨式'].append(art.aid)
        else:
            ending_types['陈述收尾'].append(art.aid)
    # 2026-07-16：结尾评论钩子(反问式)已升级为必选项，故反问结尾豁免>3上限；
    # 模板化由跨篇逐句去重(≥12字)兜底拦截。其余结尾类型仍保持≤3防同质。
    overused_end = {t: aids for t, aids in ending_types.items()
                    if len(aids) > 3 and t != '反问结尾'}
    ok = len(overused_end) == 0
    detail = ', '.join(f'{t}={len(a)}' for t, a in ending_types.items())
    R.append(('结尾句式多样性', ok, detail))

    # ── "很多人觉得/以为/认为" 8篇≤2次 ──
    total_hdj = sum(
        count_in_text(a.body, '很多人觉得') +
        count_in_text(a.body, '很多人以为') +
        count_in_text(a.body, '很多人认为')
        for a in articles
    )
    ok = total_hdj <= 2
    R.append(('"很多人觉得/以为/认为"总计', ok, f'{total_hdj}次(≤2)'))

    # ── 禁用话题标签 ──
    bad_tags = []
    for art in articles:
        for tag in art.hashtags:
            tl = tag.strip().lower()
            if tl in BANNED_HASHTAGS or (tl == 'ai' and len(art.hashtags) > 1):
                bad_tags.append(f'{art.aid}:#{tag}')
    ok = len(bad_tags) == 0
    R.append(('禁用话题标签', ok, f'发现: {",".join(bad_tags)}' if bad_tags else '0次'))

    # ── 栏目分配（从话题词推断，特异性优先匹配） ──
    # 按特异性从高到低排列，先匹配到的优先
    COL_RULES = [
        ('智商税',   ['智商税', 'AI学习', '家长必看']),
        ('翻车现场', ['翻车现场', 'AI翻车']),
        ('实用干货', ['实用干货', 'AI工具推荐', '普通人怎么用AI', '职场AI']),
        ('行业真相', ['行业真相', 'AI监管', 'AI安全', '隐私保护']),
        ('AI+教育',  ['AI教育', '家庭教育']),
        ('热点快评', ['AI取代工作', 'AI时代', 'AI融资', 'AI芯片', 'AI裁员']),
    ]

    col_assignments = {}
    for art in articles:
        tags = ' '.join(art.hashtags)
        best_col = '未标注'
        for col, keywords in COL_RULES:
            if any(kw in tags for kw in keywords):
                best_col = col
                break
        col_assignments[art.aid] = best_col

    unique_cols = set(c for c in col_assignments.values() if c != '未标注')
    # 用选题存档中的栏目做精确校验（如果有的话）
    col_counts = Counter(col_assignments.values())
    hot_count = col_counts.get('热点快评', 0)
    practical = col_counts.get('实用干货', 0)
    iq_crash = col_counts.get('智商税', 0) + col_counts.get('翻车现场', 0)

    ok_col = len(unique_cols) >= 4
    ok_hot = hot_count <= 3
    ok_pra = practical >= 1
    ok_iq = iq_crash >= 1
    if len(articles) < 4:
        # 单篇/少篇不强制栏目多样性分布：栏目分配本质是跨篇统计，
        # 单篇无法凑齐4类属设计性误报，故降级为 WARN（不计入 real_fail）。
        ok = True
    else:
        ok = ok_col and ok_hot and ok_pra and ok_iq
    detail = f'{len(unique_cols)}类: {dict(col_counts)}'
    issues = []
    if not ok_col: issues.append('<4类')
    if not ok_hot: issues.append(f'热点{hot_count}>3')
    if not ok_pra: issues.append('缺干货')
    if not ok_iq: issues.append('缺智商税/翻车')
    if issues:
        detail += f' ⚠ {",".join(issues)}'
    R.append(('栏目分配', ok, detail))

    # ── 东北味标记词跨篇总频 ──
    marker_totals = Counter()
    for art in articles:
        for marker in NORTHEAST_MARKERS:
            c = count_in_text(art.body, marker)
            marker_totals[marker] += c
    marker_issues = []
    for marker, limit in NORTHEAST_MARKERS.items():
        actual = marker_totals.get(marker, 0)
        if limit <= 1 and actual > 1:
            marker_issues.append(f'{marker}={actual}(≤1)')
        elif limit == 2 and actual > 4:
            # 8篇每篇≤2, 总计合理范围≤8, 但同一词>4说明过度集中
            marker_issues.append(f'{marker}={actual}(过集中)')
    ok = len(marker_issues) == 0
    detail = ', '.join(f'{m}={c}' for m, c in marker_totals.items() if c > 0) or '无标记词'
    if marker_issues:
        detail += f' ⚠ {"; ".join(marker_issues)}'
    R.append(('东北味跨篇总频', ok, detail))

    # ── "对普通X" ≤3次且不连续2篇 ──
    duipt = []
    for art in articles:
        c = len(re.findall(r'对普通[^，。！？；]{0,4}(而言|来说)', art.body))
        if c > 0:
            duipt.append((art.aid, c))
    total_dpt = sum(c for _, c in duipt)
    consecutive = False
    for i in range(len(duipt) - 1):
        if int(duipt[i][0][1:]) + 1 == int(duipt[i+1][0][1:]):
            consecutive = True
    ok = total_dpt <= 3 and not consecutive
    R.append(('"对普通X"频率', ok, f'{total_dpt}次(≤3){" ⚠连续" if consecutive else ""}'))

    # ── 置顶评论跨篇验证（2026-07-16 用户命令：取消置顶评论，全部未生成时直接通过）──
    pc_texts = [(a.aid, a.pinned_comment) for a in articles if a.pinned_comment]
    if not pc_texts:
        R.append(('置顶评论跨篇', True, '全部未生成(用户2026-07-16起取消)'))
        R.append(('置顶评论节奏', True, '全部未生成(用户2026-07-16起取消)'))
    else:
        # 重复检测（完全相同或前5字相同）
        dup_pc = []
        for i in range(len(pc_texts)):
            for j in range(i + 1, len(pc_texts)):
                if pc_texts[i][1] == pc_texts[j][1]:
                    dup_pc.append(f'{pc_texts[i][0]}={pc_texts[j][0]}')
                elif len(pc_texts[i][1]) >= 5 and len(pc_texts[j][1]) >= 5 and pc_texts[i][1][:5] == pc_texts[j][1][:5]:
                    dup_pc.append(f'{pc_texts[i][0]}~{pc_texts[j][0]}(前5字雷同)')
        # 类型多样性（10种类型，通过关键词粗判）
        # 注意：匹配顺序决定分类优先级，更具体的类型（灵魂拷问/内行揭秘）排在更宽泛的类型（信息缺口）前面
        type_map = {
            '反差炸弹': ['半小时', '领导说', '不算工作', '结果.*说', '%.*%', '自愧不如', '花.*块.*值', '分钟就',
                         '空调房', '抢不过', '大厂.*培训', '十二万', '花了.*学会', '百分之.*百分之', '块.*天'],
            '灵魂拷问': ['承认吧', '大部分人', '说实话.*其实', '就是.*没', '够罚', '别不当回事'],
            '身份戳心': ['做了.*年', '十年', '八年', '干了.*年', '看完.*沉默', '坐不住', '学了.*年', '顶替|被裁',
                         '你大学', '你身边', '干了十几年', '不看这个了', '你每天', '你掏.*块'],
            '自爆共鸣': ['我也', '我去年', '我当年', '交过学费', '花过.*千', '踩过', '翻遍', '花.*充', '去年.*买',
                         '我也交过', '我花.*买', '被罚'],
            '个人数据': ['我团队', '我公司', '我学员', '我客户', '我家长', '我带过', '我们智汇',
                         '查了.*条|查了.*个'],
            '内行揭秘': ['做了.*培训', '行业内心照', '内幕', '行内人说', '说一个.*真相'],
            '唱反转': ['说实话', '根本不是', '其实.*不是', '反了', '想反了', '十个.*九个', '还在研究'],
            '信息缺口': ['没想到', '另一个', '真正', '其实', '没人知道', '没说', '还有.*就来', '三周'],
            '打赌预言': ['赌', '明年', '三月', '半年', '迟早', '一年内'],
            '预言打脸': ['等着看', '三个月内', '必有一堆', '出来道歉'],
        }
        type_counts = Counter()
        for _, pc in pc_texts:
            matched = False
            for tname, keywords in type_map.items():
                if any(re.search(kw, pc) for kw in keywords):
                    type_counts[tname] += 1
                    matched = True
                    break
            if not matched:
                type_counts['未分类'] += 1
        unique_types = len([t for t, c in type_counts.items() if c > 0 and t != '未分类'])
        ok = len(dup_pc) == 0 and unique_types >= 5
        detail_parts = []
        if dup_pc:
            detail_parts.append(f"雷同：{', '.join(dup_pc)}")
        detail_parts.append(f'{unique_types}种类型(>=5)')
        if type_counts:
            detail_parts.append(f'({dict(type_counts)})')
        R.append(('置顶评论跨篇', ok, ' '.join(detail_parts)))

        # ── 3+2+2+1节奏配比（理想分布：3你戳人+2我自爆+2反差数据+1留白）──
        rhythm = {'你戳人': 0, '我自爆': 0, '反差数据': 0, '留白': 0}
        for _, pc in pc_texts:
            if '……' in pc:
                rhythm['留白'] += 1
            elif re.search(r'^我|^我花|^我去年|^我团队|^我公司|^我们', pc):
                rhythm['我自爆'] += 1
            elif re.search(r'百分之.*百分之|%.*%|块.*天', pc):
                rhythm['反差数据'] += 1
            elif re.search(r'你|承认吧', pc):
                rhythm['你戳人'] += 1
            else:
                rhythm['反差数据'] += 1  # 默认归入反差
        rhythm_max = max(rhythm.values())
        rhythm_ok = rhythm_max < 5  # 任何单一节奏不超过4条
        rhythm_detail = ' '.join(f'{k}={v}' for k, v in rhythm.items())
        if not rhythm_ok:
            rhythm_detail += ' 节奏偏科(某类>=5)'
        R.append(('置顶评论节奏', rhythm_ok, rhythm_detail))
    # ── 跨篇逐句去重（≥8字公共子串检测）──
    def longest_common_substring(s1, s2, min_len=8):
        """找两个字符串中最长的公共连续子串"""
        m, n = len(s1), len(s2)
        max_len = 0
        best = ''
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i - 1] == s2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1
                    if dp[i][j] > max_len:
                        max_len = dp[i][j]
                        best = s1[i - max_len:i]
                else:
                    dp[i][j] = 0
        return best if max_len >= min_len else ''

    verbatim_dups = []
    for i in range(len(articles)):
        for j in range(i + 1, len(articles)):
            lcs = longest_common_substring(articles[i].body, articles[j].body, min_len=12)
            if lcs:
                verbatim_dups.append(f'{articles[i].aid}↔{articles[j].aid}({len(lcs)}字:"{lcs[:20]}...")')
    ok_vd = len(verbatim_dups) == 0
    detail_vd = '; '.join(verbatim_dups) if verbatim_dups else '无≥12字重复片段'
    R.append(('跨篇逐句去重', ok_vd, detail_vd))

    # ── 跨天去重（与前一天MMDD.txt对比）──
    file_dir = os.path.dirname(os.path.abspath(filepath)) if filepath else '.'
    file_base = os.path.basename(filepath) if filepath else ''
    # 从文件名推算前一天的文件
    date_match = re.match(r'(\d{4})\.txt$', file_base)
    cross_day_detail = '未找到前一天文件'
    cross_day_ok = True
    if date_match:
        try:
            cur_date = datetime.strptime(date_match.group(1), '%m%d')
            prev_date = cur_date - timedelta(days=1)
            prev_text = None
            prev_file = os.path.join(file_dir, prev_date.strftime('%m%d.txt'))
            if os.path.exists(prev_file):
                with open(prev_file, 'r', encoding='utf-8') as f:
                    prev_text = f.read()
            else:
                # 历史稿已整合为单文件汇编，从汇编切片前一天段
                _koubo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 工具脚本/ -> koubo/
                for cand in (
                    os.path.join(file_dir, '..', '历史稿', '历史口播稿汇编.txt'),
                    os.path.join(_koubo_root, '历史稿', '历史口播稿汇编.txt'),
                ):
                    if os.path.exists(cand):
                        with open(cand, 'r', encoding='utf-8') as f:
                            _full = f.read()
                        _m = re.search(
                            r'^# ' + prev_date.strftime('%m%d') + r'.*?(?=\n# |\Z)',
                            _full, re.DOTALL | re.MULTILINE
                        )
                        if _m:
                            prev_text = _m.group(0)
                            break
            if prev_text:
                # 简单解析前一天的文章标题做对比
                prev_titles = []
                prev_titles = []
                for line in prev_text.strip().split('\n'):
                    line = line.strip()
                    if line and not line.startswith('#') and not line.startswith('[') and not line.startswith('─') and len(line) >= 15 and len(line) <= 30:
                        prev_titles.append(line)
                overlap_titles = []
                for art in articles:
                    for pt in prev_titles:
                        lcs = longest_common_substring(art.title, pt, min_len=8)
                        if lcs:
                            overlap_titles.append(f'{art.aid}↔昨天"{pt[:15]}"(共"{lcs}")')
                if overlap_titles:
                    cross_day_detail = '; '.join(overlap_titles)
                    cross_day_ok = False
                else:
                    cross_day_detail = f'与{prev_date.strftime("%m%d.txt")}无标题重复'
        except Exception:
            cross_day_detail = '日期推算失败'
    R.append(('跨天去重', cross_day_ok, cross_day_detail))

    # ── A8=AI+教育栏目检查 ──
    a8_art = next((a for a in articles if a.aid == 'A8'), None)
    if a8_art:
        edu_keywords = ['教育', '研学', '学习', '培训', '学校', '课程', '家长', '孩子', '学生', '老师']
        a8_tags = ' '.join(a8_art.hashtags)
        a8_has_edu = any(kw in a8_tags or kw in a8_art.body[:200] for kw in edu_keywords)
        ok_a8 = a8_has_edu
        detail_a8 = 'AI+教育✓' if a8_has_edu else 'A8缺教育关键词'
    else:
        ok_a8 = True
        detail_a8 = '无A8(不足8篇)'
    R.append(('A8教育栏目', ok_a8, detail_a8))

    # ── 2026-07-12 新规则④：标签与内容一致（全覆盖8篇）──
    # 每篇的话题词必须与正文实际内容匹配，不能标签是AI工具但正文全讲裁员
    tag_content_mismatches = []
    for art in articles:
        if not art.hashtags:
            continue
        body_lower = art.body[:300]  # 前300字应该能看出主题
        for tag in art.hashtags:
            tag_lower = tag.strip().lower()
            # 提取标签中的核心词
            if '教育' in tag_lower or '家长' in tag_lower or '孩子' in tag_lower:
                if not any(kw in art.body[:300] for kw in ['教育', '家长', '孩子', '学生', '老师', '学']):
                    tag_content_mismatches.append(f'{art.aid}:#{tag}(正文无教育内容)')
            elif '工具' in tag_lower or '干货' in tag_lower or '实用' in tag_lower:
                if not any(kw in art.body[:300] for kw in ['工具', '用', '操作', '步骤', '方法', '平台', '软件', 'App', '搜']):
                    tag_content_mismatches.append(f'{art.aid}:#{tag}(正文无工具/实操内容)')
            elif '取代' in tag_lower or '裁员' in tag_lower or '失业' in tag_lower:
                if not any(kw in art.body[:300] for kw in ['裁', '替代', '取代', '失业', '下岗', '淘汰', '饭碗']):
                    tag_content_mismatches.append(f'{art.aid}:#{tag}(正文无裁员/替代内容)')
            elif '翻车' in tag_lower:
                if not any(kw in art.body[:300] for kw in ['翻车', '出错', '出错', 'bug', '删', '故障', '漏洞', '出问题']):
                    tag_content_mismatches.append(f'{art.aid}:#{tag}(正文无翻车内容)')
            elif '安全' in tag_lower or '监管' in tag_lower:
                if not any(kw in art.body[:300] for kw in ['安全', '监管', '后门', '漏洞', '隐私', '风险', '禁用', '工信']):
                    tag_content_mismatches.append(f'{art.aid}:#{tag}(正文无安全/监管内容)')
    ok_tag = len(tag_content_mismatches) == 0
    detail_tag = '标签与内容一致✓' if ok_tag else f'{len(tag_content_mismatches)}处不匹配: {"; ".join(tag_content_mismatches[:3])}'
    R.append(('标签内容一致', ok_tag, detail_tag))

    # ── 收藏价值终审（5维评分，每篇≥3，平均≥5）──
    score_details = []
    total_score = 0
    low_score_arts = []
    for art in articles:
        body = art.body
        # 维度1: 步骤清单/操作指南 (0-3)
        step_patterns = [r'第一步|第二步|第三步', r'先.*再.*最后', r'一个标准', r'就一个办法',
                         r'操作步骤', r'方法很简单', r'分.*步', r'一招', r'只需要',
                         r'先看看', r'先搞清楚', r'先弄明白', r'先打开', r'先搜',
                         r'打开.*搜', r'打开.*看', r'查一下', r'对照.*查']
        step_count = sum(1 for p in step_patterns if re.search(p, body))
        s1 = min(3, step_count)
        # 维度2: 价格/数据对比 (0-2)
        data_patterns = [r'\d+块', r'\d+元', r'百分之', r'\d+%', r'比.*[高低多贵便宜]',
                         r'成本.*[多少高低]', r'价格', r'分成', r'薪资',
                         r'一半', r'翻倍', r'腰斩', r'暴涨', r'暴跌']
        data_count = sum(1 for p in data_patterns if re.search(p, body))
        s2 = min(2, data_count)
        # 维度3: 工具/资源推荐 (0-2)
        tool_patterns = [r'[Cc]hat[Gg][Pp][Tt]', r'[Cc]laude', r'AI工具', r'推荐.*工具',
                         r'平台', r'网站', r'[Aa]pp', r'软件', r'小程序', r'插件',
                         r'线上课', r'课程', r'系统', r'资源']
        tool_count = sum(1 for p in tool_patterns if re.search(p, body))
        s3 = min(2, tool_count)
        # 维度4: 避坑指南/判断框架 (0-2)
        judge_patterns = [r'判断.*标准', r'怎么判断', r'避坑', r'坑', r'割韭菜',
                          r'忽悠', r'套路', r'值不值', r'该不该', r'别.*买', r'省下',
                          r'不重要.*重要', r'核心就', r'关键就', r'就一个标准']
        judge_count = sum(1 for p in judge_patterns if re.search(p, body))
        s4 = min(2, judge_count)
        # 维度5: 方法论/思维模型 (0-1)
        method_patterns = [r'方法论', r'思维模型', r'核心.*就.*[一条]', r'底层逻辑',
                           r'本质.*就是', r'规律', r'不在于.*在于', r'最重要',
                           r'取决于', r'根本原因', r'本质']
        method_count = sum(1 for p in method_patterns if re.search(p, body))
        s5 = min(1, method_count)

        score = s1 + s2 + s3 + s4 + s5
        total_score += score
        score_details.append(f'{art.aid}={score}')
        if score < 3:
            low_score_arts.append(f'{art.aid}({score}分)')

    avg_score = total_score / len(articles) if articles else 0
    ok_score = len(low_score_arts) == 0 and avg_score >= 5
    detail_score = ' '.join(score_details) + f' 均分={avg_score:.1f}'
    if low_score_arts:
        detail_score += f' ⚠低分:{",".join(low_score_arts)}'
    if avg_score < 5:
        detail_score += f' ⚠均分<5'
    R.append(('收藏价值终审', ok_score, detail_score))

    return R

# ════════════════════════════════════════════════
# 输出
# ════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════════════
# 全量显示检查点（2026-07-20 用户铁律：修改口播稿后必须全量显示，禁止只贴改动部分）
#   原理：每次修改汇编后，koubo_display.py 生成全量显示内容并 --mark 记录段内容 sha；
#        本检查比对“被验证文件内容 sha”与“已标记显示 sha”，不一致 = 未全量显示 = 硬 FAIL，
#        直接阻断“全部通过”，迫使 agent 改完必先全量显示再交付。
# ════════════════════════════════════════════════════════════════════════
DISPLAY_HASH_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.cache', 'koubo_display_hash')

def _display_checkpoint(filepath, n_articles):
    try:
        text = open(filepath, encoding='utf-8').read()
    except Exception as e:
        return True, f'检查点跳过(读取失败:{e})'
    h = hashlib.sha256(text.strip().encode('utf-8')).hexdigest()[:16]
    if not os.path.exists(DISPLAY_HASH_FILE):
        return False, (f'尚未建立全量显示检查点(sha={h})。必须运行 koubo_display.py 输出并粘贴'
                       f'全部{n_articles}篇正文+评估数据到对话框，再跑 koubo_display.py --mark 更新检查点。')
    stored = open(DISPLAY_HASH_FILE, encoding='utf-8').read().strip()
    if stored == h:
        return True, f'全量显示检查点已匹配(sha={h})✓'
    return False, (f'汇编已修改(sha={h})但未全量显示，旧检查点={stored[:8]}…。必须运行 koubo_display.py '
                   f'输出并粘贴全部{n_articles}篇正文+评估数据到对话框，再跑 koubo_display.py --mark 更新检查点。')


def display(filepath, articles, per_results, cross_results):
    print(f'\n{"═"*62}')
    print(f' 口播稿全量验证  {filepath}')
    print(f' 文章数: {len(articles)}  时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'{"═"*62}')

    total_fail = 0

    # 逐篇
    for art in articles:
        results = per_results.get(art.aid, [])
        fails = [r for r in results if not r[1]]
        # 2026-07-17 对齐 7/16 降级软项：SOFT_NONFAIL 不计入 real_fail
        real_fails = [r for r in fails if r[0] not in SOFT_NONFAIL]
        total_fail += len(real_fails)

        status = OK if not real_fails else f'{FAIL}x{len(real_fails)}'
        title_show = art.title[:28] + ('...' if len(art.title) > 28 else '')
        print(f'\n+-- {art.aid} | {title_show} | {status}')

        for name, passed, detail in results:
            if name == '抖音安全':
                icon = WARN if not passed else OK
            elif name in SOFT_WARN_CHECKS:
                # 2026-07-14 软警告项：ok=True不计入fail；detail含"需"或"✗"时显示[??]，否则[OK]
                if '需' in detail or '✗' in detail:
                    icon = WARN
                else:
                    icon = OK
            elif name in SOFT_NONFAIL:
                # 2026-07-17 对齐 7/16 降级软项：展示为 WARN 提示，不阻断
                icon = WARN if not passed else OK
            else:
                icon = OK if passed else FAIL
            print(f'| {icon:5s} {name:<12s} | {detail}')
        print(f'+{"=" * 58}')

    # 跨篇
    print(f'\n{"=" * 62}')
    print(f' 跨篇验证 (12.2 + 栏目分配 + 频率统计)')
    print(f'{"=" * 62}')
    for name, passed, detail in cross_results:
        # 2026-07-17 对齐 7/16 降级软项：SOFT_CROSS 展示为 WARN，不计入 total_fail
        icon = OK if passed else (WARN if name in SOFT_CROSS else FAIL)
        if not passed and name not in SOFT_CROSS:
            total_fail += 1
        print(f'{icon:5s} {name:<16s} | {detail}')

    # 汇总
    print(f'\n{"=" * 62}')
    if total_fail == 0:
        print(f' {PASS_ALL} 全部通过! {len(articles)}篇文章验证零问题')
    else:
        print(f' {FAIL} 发现 {total_fail} 个问题，需要修复后重新验证')
    print(f'{"=" * 62}\n')

    return total_fail

# ════════════════════════════════════════════════
# 主函数
# ════════════════════════════════════════════════

def main():
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    else:
        today = datetime.now().strftime('%m%d')
        filepath = f'{today}.txt'

    if not os.path.exists(filepath):
        # 尝试 koubo 目录下
        script_dir = os.path.dirname(os.path.abspath(__file__))
        alt = os.path.join(script_dir, filepath)
        if os.path.exists(alt):
            filepath = alt
        else:
            print(f'❌ 文件不存在: {filepath}')
            print(f'用法: python koubo_validate.py [MMDD.txt]')
            sys.exit(1)

    print(f'解析文件: {filepath}')
    articles = parse_articles(filepath)

    if not articles:
        print('❌ 未解析到任何文章')
        sys.exit(1)

    print(f'解析到 {len(articles)} 篇文章: {", ".join(a.aid for a in articles)}\n')

    # 逐篇验证
    per_results = {}
    for art in articles:
        per_results[art.aid] = check_article(art, articles)

    # 跨篇验证
    cross_results = cross_article_checks(articles, filepath)

    # 全量显示检查点（2026-07-20 用户铁律）：未全量显示 = 硬 FAIL，阻断“全部通过”
    _dc_ok, _dc_detail = _display_checkpoint(filepath, len(articles))
    cross_results.append(('显示纪律(全量显示)', _dc_ok, _dc_detail))

    # 输出
    fail_count = display(filepath, articles, per_results, cross_results)
    sys.exit(1 if fail_count > 0 else 0)

if __name__ == '__main__':
    main()
