# -*- coding: utf-8 -*-
"""
口播稿朗读质量门禁 v1.0  (2026-07-11 用户强制·杜绝"该断句没断/语病/不自然")

为什么存在：
  SKILL.md 第三节虽有"每句不超过35字"的朗读友好建议，但只是写作提示，
  没有强制机器拦截。0711 出现大量"一长串逗号硬连、该断句没断、动宾搭配错"
  的硬伤，根因就是缺这道自动门禁。本脚本每次交付前必须跑，不过不交付。

检测五类硬伤：
  ① 断句缺失：单句过长 / 一逗到底 / 连续无换气点 / 标点密度过低
  ② 语病模式：从真实错误提炼的可累积黑名单（动宾错/缺动词/缺标点粘连等）
  ③ 英文未译：品牌白名单外的英文词（WARN 级，不致命）
  ④ 自然度：语义错乱句 / 空头论点 / AI腔生硬反问收尾（2026-07-11 用户铁律·彻底杜绝）
  ⑤ 虚构社会关系/人设：编造同事/朋友/亲戚/我妈我爸/我认识的XX/身边五个小朋友等佐证
     （2026-07-11 用户铁律·杜绝"假人设/编亲戚"）；另对"全文无创始人真实经历印记"给 WARN 提示

用法：
  python koubo_quality_gate.py <MMDD.txt>
  python koubo_quality_gate.py <MMDD.txt> --strict     # 连 WARN 也当作失败
退出码：0=全部通过  1=有 FAIL 项（--strict 时含 WARN）
"""

import sys
import re
import os

# ============ 跨项目边界硬门禁（2026-07-20 新增·防止窜工作） ============
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # koubo_workflow/
import project_boundary
project_boundary.check_action(tool="koubo_quality_gate.py", paths=sys.argv[1:], cwd=os.getcwd())

# ===================== 阈值参数 =====================
SENTENCE_FAIL = 42      # 单句(以。！？分句)纯中文字数 > 此值 → FAIL（铁律35，给合理长句容差）
SENTENCE_WARN = 33      # > 此值 → WARN
COMMA_MAX = 6           # 单句内 ，、； 数量 > 此值 → "一逗到底" FAIL
NOPUNCT_FAIL = 24       # 连续非标点字符 > 此值 → 无换气点 FAIL（专有名词串如"加州大学圣地亚哥分校的实验室用宇树G1人形机器人"约21-24字，给到24避免误杀）
PUNCT_MIN_RATIO = 0.05  # 整篇标点占非空白字符比 < 此值 → 不断句 FAIL

# ===================== 语病模式库（持续累积） =====================
# (正则, 类型, 修改建议)
# 注意：只命中"确实错误"的写法，已修正的写法（带上组件/步骤、思考）不得入列
BUG_PATTERNS = [
    (r'教\s*AI\s*平台', '动宾搭配错误', '应为"让孩子用AI平台"或"用AI平台教"'),
    (r'在替你上班', '语义混乱', '"上班"主语不当，改"在替你干活/写"'),
    (r'效果取决于双重保障', '缺谓语', '拆为"医生再复核，等于双重保障"'),
    (r'再复核效果', '缺谓语', '补逗号/动词："医生再复核，效果取决于…"'),
    (r'带\s*组件来展示', '缺动词', '应为"带上组件来展示"'),
    (r'步骤[^\s，、；。！？]{0,6}思考过程', '缺顿号', '应为"执行步骤、思考过程"加顿号'),
    (r'执行步骤思考', '缺顿号', '应为"执行步骤、思考"加顿号'),
    (r'机器人已能走完\S{0,20}这实际上是', '缺标点粘连', '拆句："…走完一整套标准手术流程。这本身就是一次认知翻转。"'),
    (r'你以为在学专家经验其实', '缺标点粘连', '拆句："你以为在学专家经验，其实是…"'),
    (r'关键就一条我去年', '缺标点粘连', '拆句："关键就一条：我去年…"'),
    (r'用\s*这些\s*AI\s*平台', '动宾搭配错误', '应为"让孩子用AI学"'),
    (r'让\s*孩子\s*用\s*AI\s*平台', '动宾搭配错误/落点不清', '应为"让孩子用AI学点什么"'),
    (r'用[^，。？！]{0,6}AI\s*平台[^，。？！]{0,4}到底', '悬空疑问', '"用AI平台到底…"落点不清，改为"该让孩子用AI学点什么"'),
    (r'(到底|究竟)[^，。？！]{0,4}(该|要|能)?(学|做|用|教|干)什么[？?]', '悬空疑问(缺主语)', '主语+谓语齐备，如"我们该让孩子用AI学点什么"'),
]

# ===================== 虚构社会关系/人设模式库（2026-07-11 用户铁律·杜绝"假人设/编亲戚"） =====================
# (正则, 类型, 修改建议)
# 命中即 FAIL：编造未确认的第三方当案例/社会证明/情感锚点。这是稿件"假"的最大来源。
# 注：创始人唯一已确认亲属是"儿子(2岁半)"，故"我妈/我爸/表姐/亲戚/同事/朋友"等一律视为虚构。
FAKE_THIRD_PATTERNS = [
    (r'我(的)?(妈|母亲|娘|爸|父亲|爹)', '虚构父母', '父母未确认，禁止编造。改写：用创始人对公开事件的真实判断，或引用真实素材库'),
    (r'我(的)?(表哥|表姐|表弟|表妹|堂哥|堂姐|堂弟|堂妹|叔|伯|舅|姨|姑|亲戚|家人)', '虚构亲属', '亲属未确认，禁止编造。改写：删除该例证或换真实素材库内容'),
    (r'我(的)?(同事|朋友|邻居|发小|同学)', '虚构社交关系', '同事/朋友未确认，禁止当佐证。如确为真实团队可写"我们团队/我们公司"，但不得虚构具体个人言行'),
    (r'我认识(的)?(一个|位|个)?(医生|老师|朋友|客户|老板|人|同行|专家)', '虚构熟人', '不得虚构"我认识一个XX"。用公开可查事实或真实素材库'),
    (r'身边(的)?(几个|五个|一些|那些|的)?(朋友|同事|人|小朋友|家长|学员)', '虚构身边人', '禁止虚构"身边五个小朋友/身边同事"。创始人视角只讲自己或公开事实'),
    (r'(好?几个|几个|一些|那些|那几个|三五|两三个)\s*(个)?\s*(同事|朋友|邻居|熟人|小朋友|家长)', '虚构社交关系(模糊量词)', '模糊量词的同事/朋友属虚构社交圈，禁止。改：用公开事实或真实素材库'),
    # 把未确认的同事/朋友当"观点来源/佐证"——典型AI编造（覆盖"我发给做内容的同事看""我问了医疗圈的朋友""我跟几个同事聊"）
    (r'我(发给|问了|专门问了|跟|和|找|对)(做内容|医疗圈|身边|几个|一些|那个|我)?(的)?(同事|朋友|邻居|熟人)', '虚构社交关系(当佐证)', '同事/朋友未确认，禁止当观点来源。改：用公开事实或真实素材库'),
    (r'(同事|朋友|邻居|熟人)(说|看|告诉|觉得|认为|聊|讲|分享|透露|直接说)', '虚构社交关系(当佐证)', '同事/朋友未确认，禁止编造其言行。改：删除或换真实素材库'),
]

# 人设真实锚定词：正文出现其一即视为有创始人真实经历/身份印记（仅 WARN 提示，不硬拦）
IDENTITY_ANCHORS = [
    '我当年', '我去年', '我做AI教育', '智汇AI教育', '我创业', '我开公司', '我们公司',
    '我们团队', '我带团队', '我做培训', '我搞AI', '我入行', '我做教育', '我办学',
    '我踩过', '我踩过坑', '我交过学费', '我犯过', '我亏', '我失败', '我错判', '我误判',
    '我做智汇', '我开智汇', '我学员', '我客户', '我家长', '我带过',
    # 扩展：常见创始人第一人称经历标记（非虚构社交圈，仅为身份印记）
    '我第一反应', '我反复看', '我见过', '我带学员', '我给学生', '我习惯', '我盯', '我判断',
]

# ===================== 英文未译白名单（品牌/通用术语/常见英文/AI圈常用词可保留） =====================
BRAND_WHITELIST = {
    # 品牌/产品名
    'ai', 'api', 'agent', 'gpt', 'claude', 'google', 'meta', 'openai', 'anthropic',
    'deepseek', 'kimi', 'qwen', 'llama', 'gemini', 'copilot', 'chatgpt', 'grok',
    'perplexity', 'manus', 'midjourney', 'sora', 'runway', 'suno', 'cursor',
    'glm', 'opus', 'pro', 'claudeopus', 'kimi', 'minimax', 'zhipu', '智谱',
    'tensorflow', 'pytorch', 'python', 'xai', 'apple', 'tesla', 'nvidia', 'amd',
    'huawei', 'baidu', 'alibaba', 'tencent', 'bytedance', 'xiaomi', 'minimax',
    'iphone', 'ipad', 'mac', 'windows', 'android', 'ios', 'app', 'apps',
    'id', 'url', 'ceo', 'cto', 'coo', 'ai+', 'prompt', 'prompts',
    'sol', 'luna', 'matt', 'shumer', 'code', 'voice', 'vibe', 'coding',
    # 基础英文词（最常用，无需翻译）
    'web', 'data', 'info', 'news', 'report', 'tool', 'tools', 'tech',
    'bug', 'fix', 'run', 'build', 'test', 'dev', 'product', 'design',
    'user', 'client', 'server', 'cloud', 'file', 'log', 'key', 'value',
    'type', 'class', 'object', 'function', 'method', 'array', 'string',
    'number', 'bool', 'return', 'import', 'export', 'on', 'off', 'in', 'out',
    'ok', 'yes', 'no', 'good', 'best', 'better', 'first', 'second', 'third',
    'last', 'next', 'new', 'old', 'big', 'small', 'long', 'short', 'high', 'low',
    'fast', 'slow', 'hot', 'cold', 'dark', 'light', 'black', 'white', 'red', 'blue',
    'green', 'yellow',
    # AI/tech 扩展常用词
    'model', 'train', 'training', 'dataset', 'token', 'tokens', 'embed', 'vector',
    'matrix', 'weight', 'bias', 'layer', 'network', 'neural', 'deep', 'learning',
    'machine', 'vision', 'nlp', 'llm', 'rag', 'inference', 'deploy', 'endpoint',
    'sdk', 'ui', 'ux', 'frontend', 'backend', 'fullstack', 'repo', 'git', 'github',
    'docker', 'k8s', 'kubernetes', 'aws', 'gcp', 'azure', 'oss', 'cdn', 'dns', 'vpn',
    'ssh', 'https', 'http', 'tcp', 'ip', 'json', 'xml', 'yaml', 'csv', 'md', 'txt',
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'mp3', 'zip', 'tar', 'gz',
    'linux', 'unix', 'bash', 'shell', 'script', 'command', 'terminal', 'ide', 'vscode',
}

# ===================== 2026-07-12 新规则常量 =====================
# 新规则①：开头多样化——禁止"太X了/吓一跳/炸锅了"模板化起手
BANNED_TEMPLATE_OPENINGS = [
    '太可怕了', '太吓人了', '太震惊了', '太夸张了',
    '吓我一跳', '吓了一跳', '吓死我了', '吓人',
    '炸锅了', '炸裂了', '炸了',
    '大事件', '出大事了',
    '太离谱了', '离谱',
]

# 新规则③：建议自然融入——禁止结尾"建议N条/记住N点/给你N条"软清单
SOFT_LIST_ENDING_PAT = re.compile(
    r'(建议[一二三四五六七八九十两\d]+[条步点样件]|'
    r'记住[一二三四五六七八九十两\d]+[条步点样件]|'
    r'给你[一二三四五六七八九十两\d]+[条步点样件]|'
    r'做到[一二三四五六七八九十两\d]+[条步点样件]|'
    r'牢记[一二三四五六七八九十两\d]+[条步点样件])'
)

# 新规则②：结构流水线——新闻→分析→我做AI教育→建议清单
PIPELINE_NEWS_PATS = [r'刚发布', r'刚上线', r'刚宣布', r'推出了', r'发布了', r'上线了', r'宣布了']
PIPELINE_EDU_PATS = [r'我做AI教育', r'我们智汇', r'我搞AI', r'我做培训', r'我办学', r'我开公司', r'我创业']
PIPELINE_LIST_PAT = SOFT_LIST_ENDING_PAT

# ===================== 2026-07-14 新规则：4项口播稿结构优化软警告 =====================
# 软警告级别（·符号显示），不影响all_ok/total_fail/退出码；--strict模式也不计入FAIL
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

# ===================== 2026-07-14 v1.1 改造：统一从 koubo_terms 导入术语/歧义压缩词表 =====================
# BANNED_AMBIG_COMP / TERM_CANONICAL_DICT 已迁出本文件，统一从 koubo_terms 导入
from koubo_terms import BANNED_AMBIG_COMP, TERM_CANONICAL_DICT, find_ambig_hits, find_alias_issues


# ===================== 解析 =====================
CJK = re.compile(r'[\u4e00-\u9fff]')
PUNCT = re.compile(r'[\u3000-\u303f\uff00-\uffef，。！？、；：""\'\'（）《》（）\-\—\.\,\;\:\!\?]')
SENT_SPLIT = re.compile(r'[。！？]')
SEP_RE = re.compile(r'^\s*[-─]{8,}\s*$')


def parse_scripts(content):
    """按长破折号分篇；每篇：标题 / 话题词(#) / [置顶]行 / 正文。返回含置顶行。"""
    lines = content.split('\n')
    blocks = []
    cur = []
    for ln in lines:
        if SEP_RE.match(ln):
            if cur:
                blocks.append(cur)
                cur = []
        else:
            cur.append(ln)
    if cur:
        blocks.append(cur)

    scripts = []
    for block in blocks:
        title = None
        kw = None
        top = None
        body_parts = []
        for raw in block:
            s = raw.strip()
            if not s:
                continue
            if s.startswith('#') and (s.count('#') >= 2 or ' ' in s):
                kw = s
                continue
            if s.startswith('[置顶]'):
                top = s
                continue
            if title is None:
                title = s
                continue
            body_parts.append(s)
        if title is None or not body_parts:
            continue
        scripts.append({
            'title': title,
            'keywords': kw or '',
            'top': top or '',
            'body': ''.join(body_parts),
        })
    return scripts


# ===================== 单篇检测 =====================
def check_script(sc, strict=False):
    body = sc['body']
    fails = []
    warns = []

    # --- ① 断句：按句末标点分句 ---
    sentences = SENT_SPLIT.split(body)
    for idx, sent in enumerate(sentences):
        cjk_n = len(CJK.findall(sent))
        if cjk_n == 0:
            continue
        comma_n = len(re.findall(r'[，、；]', sent))
        if comma_n > COMMA_MAX:
            fails.append('一逗到底：第%d句含%d个顿/逗号（>%d），必须拆句' % (idx + 1, comma_n, COMMA_MAX))
        if cjk_n > SENTENCE_FAIL:
            fails.append('单句过长：第%d句 %d 字（>%d），必须断句' % (idx + 1, cjk_n, SENTENCE_FAIL))
        elif cjk_n > SENTENCE_WARN:
            warns.append('单句偏长：第%d句 %d 字（>%d），建议断句' % (idx + 1, cjk_n, SENTENCE_WARN))

    # --- ② 无换气点：连续非标点字符 ---
    run = 0
    run_start = 0
    for i, ch in enumerate(body):
        if PUNCT.match(ch):
            if run > NOPUNCT_FAIL:
                fails.append('无换气点：第%d字起连续%d字无标点，播报无法换气' % (run_start + 1, run))
            run = 0
        else:
            if run == 0:
                run_start = i
            run += 1
    if run > NOPUNCT_FAIL:
        fails.append('无换气点：文末连续%d字无标点' % run)

    # --- ③ 标点密度 ---
    total = len(re.sub(r'\s', '', body))
    punct_n = len(PUNCT.findall(body))
    ratio = punct_n / total if total else 0
    if ratio < PUNCT_MIN_RATIO:
        fails.append('标点密度过低：%.1f%%（<%d%%），全文几乎不断句' % (ratio * 100, PUNCT_MIN_RATIO * 100))

    # --- ④ 语病模式库 ---
    for pat, btype, fix in BUG_PATTERNS:
        m = re.search(pat, body)
        if m:
            fails.append('语病[%s]：命中「%s」 → %s' % (btype, m.group(0), fix))

    # --- ⑤ 英文未译（WARN） ---
    for m in re.finditer(r'[a-zA-Z]{2,}', body):
        w = m.group(0).lower()
        if w not in BRAND_WHITELIST:
            warns.append('英文未译：%s（非品牌词建议译中文）' % m.group(0))
            break

    # --- ⑥ 自然度：空头论点 + AI腔收尾反问 ---
    # ⑥a 空头论点："最关键就一点"等承诺单一论点，后文必须紧跟明确判断，不得直接跳行动
    HOLLOW_ANCHORS = ['最关键就一点', '最关键的一点', '关键就一条', '关键就一条',
                       '说白了就一句', '核心就一点', '其实就一句', '核心就一句话',
                       '说白了就一句话']
    HOLLOW_JUDGE = ['是', '在于', '等于', '比', '关键在', '本质', '就是', '说明', '真相', '最', '核心']
    HOLLOW_ACTION = ['赶紧', '去看看', '去查', '你试试', '你先', '先别', '现在就', '你去', '记得', '记住', '你赶紧', '你去看']
    for anc in HOLLOW_ANCHORS:
        pos = body.find(anc)
        if pos >= 0:
            tail = body[pos + len(anc):]
            first_clause = tail.split('。')[0]
            jpos = 10**9
            for w in HOLLOW_JUDGE:
                p = first_clause.find(w)
                if p >= 0:
                    jpos = p
                    break
            apos = 10**9
            for w in HOLLOW_ACTION:
                p = first_clause.find(w)
                if p >= 0:
                    apos = p
                    break
            if apos < jpos:
                fails.append('空头论点：承诺「%s」后直接跳行动、未先立住论点（必须先给明确判断，再接行动引导）' % anc)
            break
    # ⑥b AI腔收尾反问：正文结尾生硬反问
    end_txt = body.rstrip()[-45:]
    RH_PATS = [
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
    for p in RH_PATS:
        m = p.search(end_txt)
        if m:
            fails.append('AI腔反问收尾：结尾「%s」生硬反问，口播很假，改为自然陈述/态度金句/行动引导' % m.group(0))
            break

    # --- ⑦ 虚构社会关系/人设（2026-07-11 用户铁律·彻底杜绝：报出全部命中，不 break；正文+置顶同检） ---
    _fake_text = body + (sc.get('top') or '')
    for pat, ftype, fix in FAKE_THIRD_PATTERNS:
        m = re.search(pat, _fake_text)
        if m:
            fails.append('虚构社会关系[%s]：命中「%s」 → %s' % (ftype, m.group(0), fix))

    # --- ⑦b 人设真实锚定缺失（WARN，不硬拦） ---
    has_anchor = any(anc in body for anc in IDENTITY_ANCHORS)
    if not has_anchor:
        warns.append('人设真实锚定缺失：全文未见创始人真实经历/身份印记(如"我当年/我做AI教育/我们团队")，建议植入真实素材库中的一段真实经历，避免通篇只有公开信息复述')

    # --- ⑧ 2026-07-12 新规则①：模板化开头检测 ---
    opening_50 = body[:50]
    for tpl in BANNED_TEMPLATE_OPENINGS:
        if tpl in opening_50:
            fails.append('模板化开头：正文起手「%s」属禁止模板(太X了/吓一跳/炸锅了)，须换成独特情绪钩子' % tpl)
            break

    # --- ⑨ 2026-07-12 新规则③：软清单收尾检测 ---
    ending_80 = body[-80:]
    m = SOFT_LIST_ENDING_PAT.search(ending_80)
    if m:
        fails.append('软清单收尾：结尾「%s」属禁止模式(建议N条/记住N点/给你N条)，建议须自然融入正文、不列举' % m.group(0))

    # --- ⑩ 2026-07-12 新规则②：流水线结构检测 ---
    has_news_start = any(p in body[:80] for p in PIPELINE_NEWS_PATS)
    has_edu_anchor = any(p in body for p in PIPELINE_EDU_PATS)
    has_list_advice = bool(PIPELINE_LIST_PAT.search(body[-80:]))
    if has_news_start and has_edu_anchor and has_list_advice:
        fails.append('流水线结构：新闻播报→分析→我做AI教育→建议清单，8篇须结构各异，禁止同一流水线套用')

    # --- ⑪ 2026-07-13 新规则：AI味检测（用户强制·AI味=0才可交付） ---
    # 命中即 FAIL：典型AI生成文本的机械套路、套话、八股结构
    AI_TASTE_PATTERNS = [
        # 机械列举排比（用户最痛恨）
        (r'先[^，。！？]{0,8}(再|又|然后|接着)最后', 'AI味[机械排比]', '禁止"先X再Y最后Z"机械列举，改为自然叙述'),
        (r'第[一二三四五][^，。！？]{0,6}第[一二三四五][^，。！？]{0,6}第[一二三四五]', 'AI味[机械序列]', '禁止"第一第二第三"机械序列'),
        (r'[一二三四五][、．.][^，。！？]{0,6}[一二三四五][、．.][^，。！？]{0,6}[一二三四五]', 'AI味[顿号序列]', '禁止"一、二、三"机械列举'),
        # 硬数字集中轰炸（如"三个指标""三条铁律""三件事"堆叠）
        (r'(三个|三样|三件事|三条|三个指标|三个环节|三个场景)', 'AI味[硬数字重复]', '避免集中使用"三个/三条"等机械计数，改用"多场景/几个/几件"'),
        # AI腔套话
        (r'值得注意的是', 'AI味[套话]', '删除"值得注意的是"，改为自然表达'),
        (r'不难发现', 'AI味[套话]', '删除"不难发现"，改为自然表达'),
        (r'不可否认', 'AI味[套话]', '删除"不可否认"，改为自然表达'),
        (r'总而言之', 'AI味[套话]', '删除"总而言之"，改为自然收束'),
        (r'综上所述', 'AI味[套话]', '删除"综上所述"，改为自然收束'),
        (r'从[^，。！？]{0,10}角度来看', 'AI味[套话]', '删除"从XX角度来看"，改为直接判断'),
        (r'随着[^，。！？]{0,10}的[^，。！？]{0,6}(发展|演变|推进)', 'AI味[套话]', '删除"随着XX发展"，改为直接陈述'),
        # 八股文结构
        (r'问题来了[。！]', 'AI味[八股]', '禁止"问题来了"八股过渡'),
        (r'答案是[。！]', 'AI味[八股]', '禁止"答案是"八股结论'),
        (r'这意味着[。！]', 'AI味[八股]', '禁止"这意味着"八股解释'),
        (r'这说明了[。！]', 'AI味[八股]', '禁止"这说明了"八股解释'),
        # 假权威引用（无具体来源）
        (r'研究表明[^，。！？]{0,20}[。！]', 'AI味[伪权威]', '禁止无具体来源的"研究表明"，须给出具体出处'),
        (r'专家指出[^，。！？]{0,20}[。！]', 'AI味[伪权威]', '禁止无具体来源的"专家指出"，须给出具体姓名/机构'),
        (r'据[^，。！？]{0,6}(统计|研究|调查|报告)[^，。！？]{0,10}[。！]', 'AI味[伪权威]', '禁止模糊引用"据统计/研究/报告"，须给具体来源'),
        # 空洞强调
        (r'至关重要', 'AI味[空洞强调]', '删除"至关重要"，用具体判断替代'),
        (r'不可或缺', 'AI味[空洞强调]', '删除"不可或缺"，用具体判断替代'),
        (r'具有重要[^，。！？]{0,6}(意义|价值|作用)', 'AI味[空洞强调]', '删除"具有重要XX"，改为具体价值判断'),
        # 机械转折堆积
        (r'(但是[^，。！？]{0,10}){3,}', 'AI味[转折堆积]', '禁止三重以上"但是"堆积，精简为一次转折'),
    ]
    for pat, atype, fix in AI_TASTE_PATTERNS:
        m = re.search(pat, body)
        if m:
            fails.append('AI味[%s]：命中「%s」 → %s' % (atype, m.group(0), fix))

    # --- ⑫ 2026-07-14 新规则：4项结构优化软警告（soft_warns，·符号显示，不影响all_ok/--strict） ---
    soft_warns = []
    # 优化1·开头3句钩子公式：S1身份背书, S2完播承诺, S3完播锁钩
    sents_list = [s for s in SENT_SPLIT.split(body) if s.strip()]
    hook_s2_ok = False
    hook_s3_ok = False
    if len(sents_list) >= 2:
        s2 = sents_list[1]
        has_hook = any(p in s2 for p in S2_HOOK_PATS)
        has_aud = any(p in s2 for p in S2_AUDIENCE_PATS)
        hook_s2_ok = has_hook and has_aud
        if BAD_DURATION_PAT.search(s2):
            soft_warns.append('钩子时长: 写"X分钟"超实际(1.5分钟/一分半)，需改为"1分钟"或"一分半"')
    if len(sents_list) >= 3:
        s3 = sents_list[2]
        hook_s3_ok = any(p in s3 for p in S3_LOCK_PATS)
    if not hook_s2_ok or not hook_s3_ok:
        miss = []
        if not hook_s2_ok: miss.append('S2(完播承诺)')
        if not hook_s3_ok: miss.append('S3(完播锁钩)')
        soft_warns.append('开头3句钩子公式: 缺%s（S2=身份+承诺, S3=锁钩）' % ','.join(miss))

    # 优化2·段落收尾金句类型（每篇≥2种）
    ptypes = []
    for ptype, pat in PUNCHLINE_PATTERNS.items():
        if pat.search(body):
            ptypes.append(ptype)
    if len(ptypes) < 2:
        soft_warns.append('收尾金句类型: 仅%d种(%s)，需≥2种(概念反转/类比画面/数据落差/反共识)' % (len(ptypes), ','.join(ptypes) if ptypes else '无'))

    # 优化3·观点密度（含判断词的句子数≥4达标）
    opinion_count = sum(1 for s in sents_list if any(w in s for w in OPINION_WORDS))
    if opinion_count < 4:
        soft_warns.append('观点密度: %d个判断句，需≥4个' % opinion_count)

    # 优化4·结尾自我诊断引导（末50字含软引导词）
    ending_50 = body[-50:]
    if not any(w in ending_50 for w in ENDING_DIAG_PATS):
        soft_warns.append('结尾自我诊断: 末50字缺软引导词(你对照/你想想/你琢磨/等着看/你猜...)')

    # --- ⑬ 2026-07-14 用户铁律：生造/压缩导致歧义的词（0714 A8 事故·零容忍） ---
    # 命中即 FAIL：制造歧义的压缩/生造词，听者无法第一秒理解。
    full_text = (sc.get('title', '') or '') + '\n' + body + (sc.get('top', '') or '')
    for pat in BANNED_AMBIG_COMP:
        m = pat.search(full_text)
        if m:
            fails.append('生造/压缩歧义词：命中「%s」 → 听者会误解为不同概念，必须改写为全称/具体数字/官方称谓（详见 AGENTS.md 2.7）' % m.group(0))

    # --- ⑭ 2026-07-14 新规则：跨稿统一词表一致性（WARN 级，不硬拦） ---
    # 命中禁用别名即提示应改推荐写法，确保跨稿称谓一致
    canonical_hits = []
    for canonical, *aliases in TERM_CANONICAL_DICT:
        for alias in aliases:
            if alias and alias in full_text and canonical not in full_text:
                # 检查是仅含"禁用别名"且不含"推荐写法"才告警
                if not (canonical in full_text):
                    canonical_hits.append('"%s" → 建议改"%s"' % (alias, canonical))
                    break
    if canonical_hits:
        warns.append('跨稿词表不一致：%s（如本篇确需使用该写法请登记到 TERM_CANONICAL_DICT）' % '; '.join(canonical_hits[:3]))

    return fails, warns, soft_warns


# ===================== 主流程 =====================
def main():
    if len(sys.argv) < 2:
        print('用法: python koubo_quality_gate.py <MMDD.txt> [--strict]')
        sys.exit(2)
    path = sys.argv[1]
    strict = '--strict' in sys.argv
    if not os.path.exists(path):
        print('文件不存在: %s' % path)
        sys.exit(2)

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    scripts = parse_scripts(content)
    if not scripts:
        print('未能解析出任何篇目，请检查文件格式（标题/话题词/[置顶]/正文，篇间────分隔）')
        sys.exit(2)

    print('=' * 72)
    print('口播稿朗读质量门禁 v1.0  |  待检 %d 篇  |  文件: %s' % (len(scripts), os.path.basename(path)))
    print('=' * 72)

    all_ok = True
    for i, sc in enumerate(scripts):
        fails, warns, soft_warns = check_script(sc, strict)
        status = 'FAIL' if fails else ('WARN' if warns else 'PASS')
        if fails:
            all_ok = False
        elif warns and strict:
            all_ok = False
        bar = {'FAIL': '✗', 'WARN': '△', 'PASS': '✓'}[status]
        print('\n%s 第%d篇: %s  [%s]' % (bar, i + 1, sc['title'][:30], status))
        for f in fails:
            print('    ✗ %s' % f)
        for w in warns:
            print('    △ %s' % w)
        # ⑫ 2026-07-14 软警告：·符号显示，不影响all_ok/--strict
        for sw in soft_warns:
            print('    · %s' % sw)

    print('\n' + '=' * 72)
    if all_ok:
        print('整体结果: PASS —— 断句/语病/自然度/人设门禁全部通过，可交付。')
        sys.exit(0)
    else:
        print('整体结果: FAIL —— 存在断句/语病/虚构社会关系硬伤，禁止交付，必须先修订。')
        sys.exit(1)


if __name__ == '__main__':
    main()
