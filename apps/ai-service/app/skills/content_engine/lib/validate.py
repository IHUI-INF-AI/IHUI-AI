# -*- coding: utf-8 -*-
"""
文章自检脚本（2026-07-09 扩展为22项）
每次构建Markdown后必须执行，22项全部通过才能交付
用法: python lib/validate.py <md路径>

8项技术自检（2026-06-20）：字数、配图、格式、营销词、推荐语、违规短语、标题绝对化用语、output目录
4项内容质量检测（2026-06-22）：原创度、AI味、平台审核风险、流量预测
1项GEO优化检测（2026-06-22）
1项标题质量检测（2026-06-28）
3项可读性/传播性/受众对齐检测（2026-07-01新增）：可读性、传播力、受众对齐
5项补充评分（2026-07-09新增）：配图重复检测等
"""
import sys
import os
import re
import json


# ===== 技术自检常量（原有） =====

# 营销宣传词清单（CSDN审核要求）
MARKETING_WORDS = [
    '完全免费', '碾压', '对标', '亮眼', '崛起',
    '值得一试', '几分钟跑起来', '几分钟就能跑', '真金白银',
    '技术实力展示', '抢占位置', '降低使用门槛', '迭代速度很快',
    '迭代活跃', '性能数据亮眼', '首选', '最佳',
    '最强', '顶级', '神器', '封神', '吊打',
    '秒杀', '完爆', '完胜', '颠覆性', '革命性', '突破性',
    '强烈推荐', '建议大家', '赶紧', '不要错过',
    '错过就没了', '红利', '风口',
]

# 推荐性语句
RECOMMEND_PATTERNS = [
    '值得一试', '建议你', '建议大家', '赶紧', '不要错过',
    '强烈推荐', '必备', '必入', '必试', '快去试试',
]

# 违规短语（用户永久禁令）
VIOLATION_PHRASES = [
    '我每天上班第一件事就是看我们的AI交付数据',
    '我跟你说这事儿啊',
    '这波红利错过就没了',
    '下期预告',
    '大家好我是李总',
    '大家好，我是李总',
]

# CSDN/跨平台广告检测（2026-07-02新增）
# 这些内容在微信公众号里正常，但在CSDN等技术社区会被判为广告营销
CSDN_AD_PATTERNS = [
    # 社交平台互动引导（CSDN不允许公众号式引流）
    r'点个?关注',
    r'转发给.{2,15}(朋友|同事|家人|同学)',
    r'(关注|点赞|在看|收藏).{0,5}(下周|下期|明天|每天)',
    r'(评论区|留言区).{0,8}(说说|告诉我|留言)',
    # 品牌/机构宣传（CSDN不允许公司宣传）
    r'(本文作者为|本文由).{2,20}(团队|工作室|公司|机构)',
    r'(所属机构为|隶属于).{2,30}(公司|科技|集团|企业)',
    r'(我们一直在|我们致力于|我们专注于).{2,20}(帮助|服务|提供)',
    # 跨平台引流（CSDN不允许引导到其他平台）
    r'(公众号|微信|抖音|小红书|B站|微博).{0,5}(搜索|关注|扫码)',
    r'(加我|添加|扫码|进群|入群)',
]

# CSDN内容方向检测（2026-07-03新增）
# 正向信号：技术内容特征，CSDN友好
CSDN_TECH_POSITIVE_PATTERNS = [
    r'```',                              # 代码块
    r'(def |class |import |from\s+\S+\s+import)\s+\w+',  # Python代码
    r'(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=)',   # JS代码
    r'(pip\s+install|npm\s+install|docker|kubectl)',      # 工具命令
    r'(GitHub|Gitee|开源|repo)',
    r'(API|接口|SDK|框架|模型|算法|数据集)',
    r'(教程|手把手|实操|步骤|实现|部署|配置|搭建)',
    r'(架构|源码|源码分析|源码解读|原理)',
    r'(Python|JavaScript|Java|Go|Rust|C\+\+|TypeScript)',
    r'(TensorFlow|PyTorch|Docker|Kubernetes|Linux)',
    r'(测试|benchmark|性能|优化|实测)',
    r'(安装|环境|依赖|版本|运行)',
]

# 负向信号：非技术内容特征，CSDN不友好
CSDN_TECH_NEGATIVE_PATTERNS = [
    r'(职场|升职|跳槽|面试|简历)',
    r'(焦虑|迷茫|鸡汤|励志|人生感悟)',
    r'(理财|基金|股票|投资|房价)',
    r'(情感|婚姻|育儿|养生)',
    r'(普通人|上班族|打工人|白领|宝妈)',
    r'(月薪|工资|收入|年薪|薪资)',
    r'(避坑指南|生存指南|出路|自救)',
    r'(热搜|冲上热搜|刷屏|朋友圈)',
    r'(收藏起来|分享给.*朋友|欢迎转发)',
]


def _check_csdn_content_fit(full_text):
    """检测文章是否适合CSDN技术社区发布（信息性检测，不影响通过/失败）"""
    positive_hits = []
    negative_hits = []

    for pattern in CSDN_TECH_POSITIVE_PATTERNS:
        matches = re.findall(pattern, full_text)
        if matches:
            positive_hits.append(f"{pattern}({len(matches)})")

    for pattern in CSDN_TECH_NEGATIVE_PATTERNS:
        matches = re.findall(pattern, full_text)
        if matches:
            negative_hits.append(f"{pattern}({len(matches)})")

    pos_count = len(positive_hits)
    neg_count = len(negative_hits)

    if pos_count >= 3 and pos_count > neg_count:
        classification = "✅ 适合CSDN（技术内容充足）"
    elif pos_count >= 2 and pos_count >= neg_count:
        classification = "⚠️ CSDN需优化（技术内容偏少，建议增加工具实测/代码示例）"
    else:
        classification = "❌ 仅适合公众号（无技术内容，CSDN大概率拒审）"

    detail = f"{classification} | 技术信号{pos_count}个 非技术信号{neg_count}个"
    if positive_hits:
        detail += f" | 正向: {', '.join(positive_hits[:5])}"
    if negative_hits:
        detail += f" | 负向: {', '.join(negative_hits[:5])}"

    return pos_count, neg_count, detail


# 标题绝对化用语
ABS_WORDS = [
    '碾压', '翻盘', '封神', '吊打', '秒杀', '完爆', '完胜',
    '最强', '第一', '顶级', '神器', '免费对标',
]


# ===== 内容质量检测常量（2026-06-22新增） =====

# AI过渡词——强标记（句首出现，权重1.0）
AI_TRANSITION_STRONG = [
    '需要指出的是', '值得注意的是', '综上所述', '总而言之',
    '换言之', '不难发现', '由此可见', '从某种意义上说',
    '毋庸置疑', '显而易见', '毋庸置疑地',
]

# AI过渡词——弱标记（句首出现，权重0.3）
AI_TRANSITION_WEAK = [
    '这一', '这种', '这样', '这些',
]

# 对称句式（每处权重0.3，因对比论证属于正常写作手法）
SYMMETRIC_PATTERNS = [
    r'不仅是.{1,20}更是',
    r'一方面.{1,30}另一方面',
    r'既.{1,15}又.{1,15}',
    r'不是.{1,15}而是',
    r'首先.{1,20}其次.{1,20}最后',
    r'既.{1,15}也',
]

# 个人观点/分析标记词（用于原创度检测）
OPINION_PATTERNS = [
    # 第一人称判断
    r'我认为', r'我觉得', r'我判断', r'我的判断是', r'我的感受是',
    r'我的看法是', r'我注意到', r'我发现', r'我关注', r'我越.{1,6}越',
    r'我算了一笔账', r'我粗略算了一下', r'我始终觉得',
    # 自然化第一人称观点（2026-07-20 扩展：允许用户去模板腔后仍计观点密度）
    r'我倒是觉得', r'我观察', r'我观察下来', r'我带学员', r'我做过',
    r'我踩过', r'我的体会是', r'最深的感受是', r'说实话', r'我亲眼',
    # 分析视角
    r'从.{1,10}角度看', r'从.{0,5}角度', r'从技术.{0,5}看', r'从行业.{0,5}看',
    # 本质/关键
    r'这意味着', r'关键在于', r'本质上', r'说白了', r'说到底',
    r'核心问题是', r'真正价值', r'实际价值', r'实际意义',
    # 趋势/风险判断
    r'背后是', r'取决于', r'并非简单的', r'并非.{0,10}唯一',
    r'后果会被放大', r'核心壁垒', r'结构性趋势',
    r'技术含义', r'关键指标', r'尤为重要',
    r'远高于', r'加剧.{0,10}竞争', r'增加了.{0,10}不确定性',
    r'面临.{0,10}风险', r'可能促使', r'衡量.{0,10}关键',
    r'对于.{0,10}而言',
    # 直接表达
    r'直接说结论', r'仔细观察你会发现',
    r'真相是', r'问题在于',
]

# 数据引用模式（用于原创度检测）
DATA_PATTERN = re.compile(
    r'\d+\.?\d*\s*(%|％|亿|万|百万|千万|千亿|tokens?|美元|倍|个|张|条|次|篇|款|分)'
    r'|\d{4}年|\d+月\d+日'
)

# 综述性表述（过多说明原创度不足）
REVIEW_PHRASES = [
    '据报道', '据多方报道', '据报', '消息称', '有报道称',
    '这些信息相互印证', '均非官方确认', '目前已知', '目前存在争议',
]

# 流量预测关键词
TRAFFIC_TIMELINESS = {
    2: ['明天', '今天', '刚刚', '即将', '发布', '上线', '实测', '前瞻', '首发',
        '今年', '本周', '本月', '这几天', '这周', '2025年', '2026年'],
    1: ['最近', '近期', '最新', '昨天', '上周', '前几天'],
}

TRAFFIC_CONFLICT = {
    3: ['反超', '分歧', '争议', '风险', '淘汰', '翻车', '打脸', '禁令', '危机',
        '骗局', '坑人', '陷阱', '收割', '割韭菜'],
    2: ['对比', '竞争', '博弈', '较量', '挑战', '压力',
        '差距', '悬殊', '落差', '套路', '忽悠', '信息差'],
    1: ['差异', '不同', '分化'],
}

TRAFFIC_RESONANCE = {
    # 2026-07-01 从开发者导向改为普通人导向（原关键词：开发者/成本/选型/商业/创业/价格/定价）
    3: ['省钱', '省时间', '赚钱', '工作', '就业', '学习', '教育', '孩子', '家长',
        '家庭', '工资', '安全', '健康', '生活', '普通人', '上班族', '学生', '宝妈',
        '副业', '转型', '裁员', '失业', '升职', '加薪', '求职', '考试', '升学'],
    2: ['付费', '免费', '应用', '落地', '工具', '效率', '方便', '实用', '避坑',
        '教程', '方法', '技巧', '省钱', '时间', '收入'],
    1: ['AI', '模型', '产品', '功能', '使用', '体验', '变化', '更新'],
}

TRAFFIC_SPREAD_BRANDS = [
    'GPT', 'OpenAI', 'Claude', 'Anthropic', 'Google', 'Gemini',
    'Apple', 'Meta', 'Microsoft', 'Nvidia', 'SpaceX', 'Tesla',
    '百度', '阿里', '腾讯', '华为', '字节',
]

# ===== 可读性/传播性/受众对齐检测常量（2026-07-01新增） =====

# 需要解释的技术术语（出现在正文中时，附近应有通俗解释）
TECH_JARGON_TERMS = [
    '向量数据库', '推理加速', '投机解码', '半自回归', '隐写术', '隐写标记',
    '注意力机制', '编码器', '解码器', 'Transformer', '嵌入', '量化', '蒸馏',
    '微调', '对齐', '上下文窗口', 'tokens', 'Token', 'API', 'Agent',
    '进程内架构', '置信度调度', '自回归生成', 'MTP', '基线',
    'XOR', 'base64', '二进制', '混淆', '域名列表',
    'RAG', 'MCP', 'A2A', 'Agent化',
    '智能体', '多模态', '参数', '权重', '梯度', '反向传播',
    '容器', '编排', '缓存', '索引', '检索',
]

# 传播力关键词（普通人关心的情感/利益维度）
SHAREABILITY_SIGNALS = {
    'identity': ['普通人', '上班族', '学生', '家长', '宝妈', '打工人', '自由职业者',
                 '退休', '毕业生', '职场人', '创业者', '普通人也能', '人人都能'],
    'emotion': ['震惊', '意外', '没想到', '真相', '揭秘', '竟然', '居然',
                '后背发凉', '意外', ' surprising', '颠覆', '反转'],
    'benefit': ['省钱', '省时间', '赚钱', '避坑', '免费', '效率', '实用',
                '教程', '方法', '技巧', '攻略', '指南', '速查', '一键'],
    'share_triggers': ['收藏', '转发', '分享', '告诉', '提醒', '记得',
                       '以后用得上', '先收藏', '备查'],
}

# 受众偏离关键词（大量出现说明文章偏技术/商业，偏离普通人定位）
AUDIENCE_DEVIATION_KEYWORDS = [
    '架构设计', '技术路线', '底层实现', '代码层面', '算法层面',
    '性能基准', '基准测试', '跑分', '吞吐量', '延迟',
    '商业模式', '盈利模式', '融资', '估值', 'IPO', '赛道', '护城河',
    '生态位', '卡位', '降维打击', 'ToB', 'ToC', 'SaaS', 'PaaS',
    '开发者', '工程师', '程序员', '运维', 'DevOps',
    'ROI', '获客成本', '转化率', 'DAU', 'MAU', 'ARPU',
    '战略', '布局', '矩阵', '闭环', '赋能',
]


# ===== 辅助函数 =====

def _extract_title_from_md(text):
    """从Markdown文本中提取标题（第一个# heading行）"""
    for line in text.split('\n'):
        line = line.strip().lstrip('\ufeff')
        if line.startswith('# ') and not line.startswith('## '):
            return line[2:].strip()
    return ''


def _count_sentences(text):
    """统计句子数（按句号、问号、感叹号分句）"""
    sentences = re.split(r'[。！？]', text)
    return len([s for s in sentences if s.strip()])


def _load_published_memory(md_path):
    """加载已发布内容记忆JSON (优先 BASE 根, 兼容老路径)"""
    # 优先: BASE 根目录 (lib 在 BASE/lib 下, BASE = lib 的父目录)
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for cand in [
        os.path.join(base_path, '已发布内容记忆.json'),
        os.path.join(os.path.dirname(md_path), '已发布内容记忆.json'),
        os.path.join(os.getcwd(), '已发布内容记忆.json'),
    ]:
        if os.path.exists(cand):
            try:
                with open(cand, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f'[validate] 读已发布记忆失败({cand}): {e}')
                return None
    return None


def _check_duplicate_paragraphs(full_text):
    """Check for completely duplicate paragraphs in text"""
    paragraphs = [p.strip() for p in full_text.split('\n\n') if p.strip()]
    seen = {}
    duplicates = []
    for i, para in enumerate(paragraphs):
        if len(para) < 10:
            continue
        if para in seen:
            duplicates.append((i, seen[para], para[:50]))
        else:
            seen[para] = i
    return duplicates


def _check_originality(full_text, title, md_path):
    """原创度检测：主题对比 + 独特观点密度 + 数据引用密度 + 综述性表述
    返回: (score, detail_str)
    """
    score = 100
    details = []

    # 1. 主题对比：与已发布文章对比（排除自身）
    memory = _load_published_memory(md_path)
    if memory:
        published = memory.get('published', [])
        for pub in published:
            pub_title = pub.get('title', '')
            pub_status = pub.get('status', 'published')
            # 排除自身和非已发布状态（superseded/generated等不纳入对比）
            if pub_title == title or pub_status != 'published':
                continue
            pub_keywords = set(pub.get('keywords', []))
            # 标题字符重叠检查
            if pub_title and title:
                common = set(title) & set(pub_title)
                overlap_ratio = len(common) / max(len(set(title)), 1)
                if overlap_ratio > 0.6:
                    score = 0
                    details.append(f'主题与已发布文章重叠: {pub_title}')
                    return score, '; '.join(details)
            # 关键词重叠检查（≥4个关键词重叠视为主题重复）
            if pub_keywords:
                overlap_keywords = [k for k in pub_keywords if k in title or k in full_text[:500]]
                if len(overlap_keywords) >= 4:
                    score = 0
                    details.append(f'关键词与已发布文章高度重叠: {pub_title}')
                    return score, '; '.join(details)

    # 2. 独特观点密度
    cn_chars = sum(1 for c in full_text if '\u4e00' <= c <= '\u9fff')
    opinion_count = 0
    for pattern in OPINION_PATTERNS:
        opinion_count += len(re.findall(pattern, full_text))
    opinion_density = opinion_count / max(cn_chars / 1000, 1)

    if opinion_density >= 3:
        details.append(f'观点密度{opinion_density:.1f}/千字（充足）')
    elif opinion_density >= 2:
        score -= 5
        details.append(f'观点密度{opinion_density:.1f}/千字（适中，建议增加个人判断）')
    elif opinion_density >= 1:
        score -= 10
        details.append(f'观点密度{opinion_density:.1f}/千字（偏低，需增加个人分析）')
    else:
        score -= 20
        details.append(f'观点密度{opinion_density:.1f}/千字（严重不足，需大幅增加个人判断）')

    # 3. 数据引用密度
    data_count = len(DATA_PATTERN.findall(full_text))
    data_density = data_count / max(cn_chars / 1000, 1)

    if data_density >= 5:
        details.append(f'数据密度{data_density:.1f}/千字（充足）')
    elif data_density >= 3:
        score -= 1
        details.append(f'数据密度{data_density:.1f}/千字（适中）')
    else:
        score -= 8
        details.append(f'数据密度{data_density:.1f}/千字（偏低，需增加具体数据）')

    # 4. 综述性表述检测
    review_count = sum(full_text.count(p) for p in REVIEW_PHRASES)
    if review_count >= 5:
        score -= 10
        details.append(f'综述性表述{review_count}处（偏多，建议增加个人分析减少综述）')
    elif review_count >= 3:
        score -= 5
        details.append(f'综述性表述{review_count}处（适中，可考虑减少）')

    return max(score, 0), '; '.join(details)


def _check_ai_flavor(full_text):
    """AI味检测：过渡词频率 + 对称句式
    返回: (ai_percent, detail_str)
    """
    total_sentences = _count_sentences(full_text)
    if total_sentences == 0:
        return 0, '无句子'

    ai_count = 0.0
    details = []

    # 1. 强AI过渡词（句首出现，权重1.0）
    strong_hits = []
    for word in AI_TRANSITION_STRONG:
        pattern = f'(?:^|[。！？\\n]){word}'
        hits = len(re.findall(pattern, full_text))
        if hits > 0:
            strong_hits.append(f'{word}x{hits}')
            ai_count += hits
    if strong_hits:
        details.append(f'强AI词: {", ".join(strong_hits)}')

    # 2. 弱AI过渡词（句首出现，权重0.3）
    weak_hits = []
    for word in AI_TRANSITION_WEAK:
        pattern = f'(?:^|[。！？\\n]){word}'
        hits = len(re.findall(pattern, full_text))
        if hits > 0:
            weak_hits.append(f'{word}x{hits}')
            ai_count += hits * 0.3
    if weak_hits:
        details.append(f'弱AI词: {", ".join(weak_hits)}')

    # 3. 对称句式（权重0.3，对比论证属于正常写作手法，不应过度惩罚）
    sym_hits = []
    for pattern in SYMMETRIC_PATTERNS:
        hits = len(re.findall(pattern, full_text))
        if hits > 0:
            sym_hits.append(f'{pattern[:15]}x{hits}')
            ai_count += hits * 0.3
    if sym_hits:
        details.append(f'对称句式: {", ".join(sym_hits)}')

    ai_percent = (ai_count / total_sentences) * 100
    detail_str = f'AI味{ai_percent:.1f}%（{total_sentences}句，AI标记{ai_count:.1f}处）'
    if details:
        detail_str += ' | ' + '; '.join(details)

    return ai_percent, detail_str


def _check_platform_risk(full_text, title_text):
    """平台审核风险：汇总营销词+推荐语+违规短语+绝对化用语+CSDN广告模式 -> 风险百分比
    返回: (risk_percent, detail_str)
    """
    risks = []

    found_marketing = [w for w in MARKETING_WORDS if w in full_text]
    if found_marketing:
        risks.append(f'营销词: {found_marketing}')

    found_rec = [p for p in RECOMMEND_PATTERNS if p in full_text]
    if found_rec:
        risks.append(f'推荐语: {found_rec}')

    found_v = [v for v in VIOLATION_PHRASES if v in full_text]
    if found_v:
        risks.append(f'违规短语: {found_v}')

    found_abs = [w for w in ABS_WORDS if w in title_text]
    if found_abs:
        risks.append(f'标题绝对化: {found_abs}')

    # CSDN/跨平台广告模式检测
    csdn_hits = []
    for pattern in CSDN_AD_PATTERNS:
        matches = re.findall(pattern, full_text)
        if matches:
            # 找到匹配的具体文本片段（截取上下文）
            for m in re.finditer(pattern, full_text):
                snippet = full_text[max(0, m.start()-5):m.end()+5].replace('\n', ' ')
                csdn_hits.append(snippet)
    if csdn_hits:
        risks.append(f'CSDN广告嫌疑: {csdn_hits[:3]}')

    if risks:
        return 100, ' | '.join(risks)
    return 0, '无风险项'


def _check_traffic_score(full_text, title, md_path):
    """流量预测：时效性+冲突性+共鸣度+稀缺性+传播力 = 10分
    返回: (score, detail_str)
    """
    text = title + ' ' + full_text
    details = []

    # 1. 时效性（0-2分）
    timeliness_score = 0
    for score_tier, keywords in TRAFFIC_TIMELINESS.items():
        if any(kw in text for kw in keywords):
            timeliness_score = max(timeliness_score, score_tier)
    details.append(f'时效性{timeliness_score}/2')

    # 2. 冲突性（0-3分）
    conflict_score = 0
    for score_tier, keywords in TRAFFIC_CONFLICT.items():
        if any(kw in text for kw in keywords):
            conflict_score = max(conflict_score, score_tier)
    details.append(f'冲突性{conflict_score}/3')

    # 3. 共鸣度（0-3分）
    resonance_score = 0
    for score_tier, keywords in TRAFFIC_RESONANCE.items():
        if any(kw in text for kw in keywords):
            resonance_score = max(resonance_score, score_tier)
    details.append(f'共鸣度{resonance_score}/3')

    # 4. 稀缺性（0-1分）
    scarcity_score = 1
    memory = _load_published_memory(md_path)
    if memory:
        published = memory.get('published', [])
        for pub in published:
            pub_title = pub.get('title', '')
            pub_status = pub.get('status', 'published')
            # 排除自身和非已发布状态
            if pub_title == title or pub_status != 'published':
                continue
            if pub_title and title:
                common = set(title) & set(pub_title)
                overlap_ratio = len(common) / max(len(set(title)), 1)
                if overlap_ratio > 0.5:
                    scarcity_score = 0
                    details.append(f'稀缺性0/1（与已发布"{pub_title[:20]}"相似）')
                    break
        else:
            details.append('稀缺性1/1')
    else:
        details.append('稀缺性1/1（无记忆库，默认通过）')

    # 5. 传播力（0-1分）
    spread_score = 1 if any(brand in text for brand in TRAFFIC_SPREAD_BRANDS) else 0
    details.append(f'传播力{spread_score}/1')

    total = timeliness_score + conflict_score + resonance_score + scarcity_score + spread_score
    detail_str = f'{total}/10分 | ' + ' + '.join(details)

    return total, detail_str


# ==================== 可读性/传播性/受众对齐检测（2026-07-01新增） ====================

def _check_readability(full_text):
    """可读性检测（2026-07-01新增）：
    检测文章是否适合普通人阅读。
    核心逻辑：技术术语密度 + 术语解释率 + 类比数量
    返回: (score, passed, detail_str)
    """
    cn_chars = sum(1 for c in full_text if '\u4e00' <= c <= '\u9fff')
    if cn_chars == 0:
        return 0, False, '无中文内容'

    score = 100
    details = []

    # 1. 技术术语密度检测
    jargon_count = 0
    unexplained_terms = []
    for term in TECH_JARGON_TERMS:
        count = full_text.count(term)
        if count > 0:
            jargon_count += count
            # 检查术语附近200字内是否有通俗解释信号
            for match in re.finditer(re.escape(term), full_text):
                start = max(0, match.start() - 100)
                end = min(len(full_text), match.end() + 150)
                context = full_text[start:end]
                explanation_signals = [
                    '简单来说', '通俗讲', '也就是说', '换句话说',
                    '就像', '好比', '类似于', '类似于', '相当于',
                    '你可以理解为', '你可以把它看成',
                    '意思是', '指的是', '就是',
                    '（即', '——即',
                    '说白了', '直白点说',
                ]
                has_explanation = any(signal in context for signal in explanation_signals)
                if not has_explanation:
                    unexplained_terms.append(term)
                    break

    jargon_per_1000 = jargon_count / (cn_chars / 1000)
    unique_unexplained = len(set(unexplained_terms))

    if jargon_per_1000 > 8:
        score -= 40
        details.append(f'术语密度{jargon_per_1000:.1f}/千字（严重超标）')
    elif jargon_per_1000 > 5:
        score -= 20
        details.append(f'术语密度{jargon_per_1000:.1f}/千字（偏高）')
    elif jargon_per_1000 > 3:
        score -= 10
        details.append(f'术语密度{jargon_per_1000:.1f}/千字（适中）')
    else:
        details.append(f'术语密度{jargon_per_1000:.1f}/千字（良好）')

    # 2. 未解释术语惩罚
    if unique_unexplained > 8:
        score -= 40
        details.append(f'{unique_unexplained}个术语无解释（严重，需为每个术语添加通俗解释）')
    elif unique_unexplained > 5:
        score -= 25
        details.append(f'{unique_unexplained}个术语无解释（需添加通俗解释）')
    elif unique_unexplained > 3:
        score -= 15
        details.append(f'{unique_unexplained}个术语无解释（建议添加解释）')
    elif unique_unexplained > 0:
        score -= 5 * unique_unexplained
        details.append(f'{unique_unexplained}个术语无解释')
    else:
        details.append('所有术语均有解释')

    # 3. 类比/生活化表达奖励
    analogy_patterns = [
        r'就像.{5,50}(一样|似的)',
        r'好比.{5,50}(一样|似的)',
        r'相当于.{5,40}',
        r'你可以把它(想|看|理解).{2,30}',
        r'简单来说.{5,50}',
        r'说白了.{5,50}',
        r'打个比方.{5,50}',
        r'类似于.{5,40}',
    ]
    analogy_count = 0
    for pattern in analogy_patterns:
        analogy_count += len(re.findall(pattern, full_text))

    if analogy_count >= 3:
        score += 10
        details.append(f'类比表达{analogy_count}处（良好）')
    elif analogy_count >= 1:
        details.append(f'类比表达{analogy_count}处（基本合格）')
    else:
        score -= 15
        details.append('无类比/生活化表达（需添加通俗类比）')

    score = max(0, min(100, score))
    passed = score >= 60
    detail_str = f'{score}/100 | ' + '; '.join(details)
    return score, passed, detail_str


def _check_shareability(full_text, title):
    """传播力检测（2026-07-01新增）：
    检测文章是否具备社交传播动力（用户为什么愿意转发）。
    4维度：身份信号 + 情感共鸣 + 实用价值 + 分享触发器
    返回: (score, passed, detail_str)
    """
    score = 0
    details = []

    # 1. 身份信号（0-3分）：文章是否让特定人群觉得"这说的就是我"
    identity_count = 0
    found_identities = []
    for kw in SHAREABILITY_SIGNALS['identity']:
        if kw in full_text:
            identity_count += 1
            found_identities.append(kw)
    if identity_count >= 3:
        score += 3
        details.append(f'身份信号{identity_count}个({found_identities[:3]})')
    elif identity_count >= 1:
        score += 2
        details.append(f'身份信号{identity_count}个({found_identities[:3]})')
    else:
        details.append('无身份信号（需添加"普通人/上班族/家长"等人群锚定）')

    # 2. 情感共鸣（0-3分）：文章是否有让人"哇"的瞬间
    emotion_count = 0
    for kw in SHAREABILITY_SIGNALS['emotion']:
        if kw in full_text or kw in title:
            emotion_count += 1
    if emotion_count >= 3:
        score += 3
        details.append(f'情感共鸣{emotion_count}处')
    elif emotion_count >= 1:
        score += 2
        details.append(f'情感共鸣{emotion_count}处')
    else:
        details.append('无情感共鸣点（需添加"没想到/竟然/真相"等冲击表达）')

    # 3. 实用价值（0-2分）：文章是否有可操作的内容
    benefit_count = 0
    for kw in SHAREABILITY_SIGNALS['benefit']:
        if kw in full_text:
            benefit_count += 1
    if benefit_count >= 5:
        score += 2
        details.append(f'实用信号{benefit_count}个')
    elif benefit_count >= 2:
        score += 1
        details.append(f'实用信号{benefit_count}个')
    else:
        details.append('实用信号不足（需添加"方法/技巧/教程/避坑"等实用内容）')

    # 4. 分享触发器（0-2分）：文章是否有引导分享的元素
    trigger_count = 0
    for kw in SHAREABILITY_SIGNALS['share_triggers']:
        if kw in full_text:
            trigger_count += 1
    if trigger_count >= 2:
        score += 2
        details.append(f'分享触发{trigger_count}处')
    elif trigger_count >= 1:
        score += 1
        details.append(f'分享触发{trigger_count}处')
    else:
        details.append('无分享触发器（需添加"收藏/转发/以后用得上"等元素）')

    passed = score >= 5
    detail_str = f'{score}/10 | ' + ' | '.join(details)
    return score, passed, detail_str


def _check_audience_alignment(full_text, title):
    """受众对齐检测（2026-07-01新增）：
    检测文章是否偏离"普通人"定位，滑向"开发者/投资人"导向。
    核心逻辑：统计受众偏离关键词数量
    返回: (score, passed, detail_str)
    """
    text = title + ' ' + full_text
    violations = []
    violation_count = 0

    for kw in AUDIENCE_DEVIATION_KEYWORDS:
        count = text.count(kw)
        if count > 0:
            violations.append(f'{kw}x{count}')
            violation_count += count

    # 评分
    if violation_count >= 15:
        score = 0
        passed = False
    elif violation_count >= 10:
        score = 30
        passed = False
    elif violation_count >= 6:
        score = 50
        passed = False
    elif violation_count >= 3:
        score = 70
        passed = True
    else:
        score = 100
        passed = True

    if passed:
        detail_str = f'{score}/100 | 受众对齐良好（偏离词{violation_count}个）'
    else:
        detail_str = (
            f'{score}/100 | 受众偏离（偏离词{violation_count}个: '
            f'{", ".join(violations[:8])}）。'
            f'文章偏向开发者/投资人读者，需重写为普通人视角'
        )

    return score, passed, detail_str


# ===== 主检测函数 =====

def validate(md_path):
    """执行22项自检，返回(全部通过, 报告列表)
    第0-8项：基础技术自检（段落重复/字数/配图/格式/营销词/推荐语/违规短语/标题绝对化/output目录）
    第9-12项：内容质量自检（原创度/AI味/平台风险/流量预测）
    第13项：GEO优化检测
    第14项：标题质量检测（2026-06-28新增：4条件+空洞否定收尾拦截）
    第15项：可读性检测（2026-07-01新增：术语密度+解释率+类比）
    第16项：传播力检测（2026-07-01新增：身份信号+情感共鸣+实用价值+分享触发器）
    第17项：受众对齐检测（2026-07-01新增：是否偏离普通人定位）
    """
    if not os.path.exists(md_path):
        return False, [f'文件不存在: {md_path}']

    with open(md_path, 'r', encoding='utf-8') as f:
        full_text = f.read()
    title_text = _extract_title_from_md(full_text)
    reports = []
    all_pass = True

    # === 8项技术自检（原有） ===

    # 0. 段落重复检查（2026-06-26新增，禁止完全重复段落）
    dup_paras = _check_duplicate_paragraphs(full_text)
    if dup_paras:
        reports.append(f"0. 段落重复检查: (失败) 发现{len(dup_paras)}处完全重复段落")
        all_pass = False
    else:
        reports.append("0. 段落重复检查: (通过) 无重复段落")

    # 1. 字数检查
    # 2026-07-05 基于完读率+GEO研究调整为1500-3500字（原3400-5000）
    # 数据依据：1500字完读率70%+，GEO最优区间800-2000字，信息密度>字数
    cn_chars = sum(1 for c in full_text if '\u4e00' <= c <= '\u9fff')
    passed = 1500 <= cn_chars <= 3500
    reports.append(f"1. 字数检查: {cn_chars}字 ({'通过' if passed else '失败，需1500-3500字'})")
    if not passed:
        all_pass = False

    # 2. 配图检查（Markdown图片语法）
    img_count = len(re.findall(r'!\[.*?\]\(.*?\)', full_text))
    passed = img_count >= 3
    reports.append(f"2. 配图检查: {img_count}张 ({'通过' if passed else '失败，需≥3张'})")
    if not passed:
        all_pass = False

    # 3. 格式检查 - 确保Markdown干净，无禁止的HTML标签
    forbidden_html = ['<style', '<script', '<div', 'class=', 'id=']
    found_forbidden = [tag for tag in forbidden_html if tag in full_text]
    passed = len(found_forbidden) == 0
    reports.append(f"3. 格式检查: {'通过' if passed else '失败，发现禁止的HTML标签. ' + str(found_forbidden)}")
    if not passed:
        all_pass = False

    # 4. 营销宣传词检查
    found_marketing = [w for w in MARKETING_WORDS if w in full_text]
    passed = len(found_marketing) == 0
    detail = f"发现: {found_marketing}" if found_marketing else "无"
    reports.append(f"4. 营销宣传词检查: ({'通过' if passed else '失败'}) {detail}")
    if not passed:
        all_pass = False

    # 5. 推荐性语句检查
    found_rec = [p for p in RECOMMEND_PATTERNS if p in full_text]
    passed = len(found_rec) == 0
    detail = f"发现: {found_rec}" if found_rec else "无"
    reports.append(f"5. 推荐性语句检查: ({'通过' if passed else '失败'}) {detail}")
    if not passed:
        all_pass = False

    # 6. 违规短语检查
    found_v = [v for v in VIOLATION_PHRASES if v in full_text]
    passed = len(found_v) == 0
    detail = f"发现: {found_v}" if found_v else "无"
    reports.append(f"6. 违规短语检查: ({'通过' if passed else '失败'}) {detail}")
    if not passed:
        all_pass = False

    # 7. 标题绝对化用语检查
    found_abs = [w for w in ABS_WORDS if w in title_text]
    passed = len(found_abs) == 0
    detail = f"标题: {title_text[:40]} | 发现: {found_abs}" if found_abs else f"标题: {title_text[:40]}"
    reports.append(f"7. 标题绝对化用语检查: ({'通过' if passed else '失败'}) {detail}")
    if not passed:
        all_pass = False

    # 8. output目录检查
    output_dir = os.path.dirname(md_path)
    files = os.listdir(output_dir)
    md_files = [f for f in files if f.endswith('.md')]
    img_dirs = [f for f in files if os.path.isdir(os.path.join(output_dir, f))]
    passed = len(md_files) >= 1
    detail = f"MD:{len(md_files)}个 文件夹:{img_dirs}"
    reports.append(f"8. output目录检查: ({'通过' if passed else '失败'}) {detail}")
    if not passed:
        all_pass = False

    # 8b. 章节编号重复检查（防止 "01 1：xxx" 双重编号）
    double_num_paras = []
    for line in full_text.split('\n'):
        t = line.strip()
        if re.match(r'^\d{2}\s+\d{1,2}\s*[：:]', t):
            double_num_paras.append(t[:40])
    if double_num_paras:
        reports.append(f"8b. 章节编号检查: (失败) 发现双重编号: {double_num_paras}")
        all_pass = False
    else:
        reports.append("8b. 章节编号检查: (通过) 无双重编号")

    # === 4项内容质量检测（2026-06-22新增） ===

    # 9. 原创度检测
    orig_score, orig_detail = _check_originality(full_text, title_text, md_path)
    passed = orig_score >= 100
    status = '通过' if passed else '失败'
    reports.append(f"9. 原创度检测: {orig_score}% ({status}，需=100%) {orig_detail}")
    if not passed:
        all_pass = False

    # 10. AI味检测
    ai_percent, ai_detail = _check_ai_flavor(full_text)
    passed = ai_percent <= 2
    reports.append(f"10. AI味检测: {ai_percent:.1f}% ({'通过' if passed else '失败，需≤2%'}) {ai_detail}")
    if not passed:
        all_pass = False

    # 11. 平台审核风险
    risk_percent, risk_detail = _check_platform_risk(full_text, title_text)
    passed = risk_percent == 0
    reports.append(f"11. 平台审核风险: {risk_percent}% ({'通过' if passed else '失败，需0%'}) {risk_detail}")
    if not passed:
        all_pass = False

    # 12. 流量预测
    traffic_score, traffic_detail = _check_traffic_score(full_text, title_text, md_path)
    passed = traffic_score >= 6
    reports.append(f"12. 流量预测: {traffic_score}/10 ({'通过' if passed else '失败，需≥6分'}) {traffic_detail}")
    if not passed:
        all_pass = False

    # 13. GEO优化检测（2026-06-22新增）
    geo_score, geo_detail = _check_geo_optimization(full_text, title_text)
    passed = geo_score >= 100
    reports.append(f"13. GEO优化检测: {geo_score}/100 ({'通过' if passed else '失败，需满分100分'}) {geo_detail}")
    if not passed:
        all_pass = False

    # 14. 标题质量检测（2026-06-28新增）
    # 检测项：长度≤32字、含具体产品名/事件名、含冲突词、含具体普通人利益点（禁止空洞否定收尾）
    title_quality_pass, title_quality_detail = _check_title_quality(title_text)
    reports.append(f"14. 标题质量检测: ({'通过' if title_quality_pass else '失败'}) {title_quality_detail}")
    if not title_quality_pass:
        all_pass = False

    # 15. 可读性检测（2026-07-01新增：普通人能不能看懂）
    readability_score, readability_pass, readability_detail = _check_readability(full_text)
    reports.append(f"15. 可读性检测: ({'通过' if readability_pass else '失败'}) {readability_detail}")
    if not readability_pass:
        all_pass = False

    # 16. 传播力检测（2026-07-01新增：用户愿不愿意转发）
    shareability_score, shareability_pass, shareability_detail = _check_shareability(full_text, title_text)
    reports.append(f"16. 传播力检测: ({'通过' if shareability_pass else '失败'}) {shareability_detail}")
    if not shareability_pass:
        all_pass = False

    # 17. 受众对齐检测（2026-07-01新增：是否偏离普通人定位）
    audience_score, audience_pass, audience_detail = _check_audience_alignment(full_text, title_text)
    reports.append(f"17. 受众对齐检测: ({'通过' if audience_pass else '失败'}) {audience_detail}")
    if not audience_pass:
        all_pass = False

    # === 2项点击率评分（2026-07-02新增，信息性评分，不影响通过/失败） ===

    # 18. 标题吸引力评分
    title_attr_score, title_attr_detail = _score_title_attractiveness(title_text)
    reports.append(f"18. 标题吸引力: {title_attr_detail}")

    # 19. 开头钩子评分
    opening_score, opening_detail = _score_opening_hook(full_text)
    reports.append(f"19. 开头钩子: {opening_detail}")

    # 20. CSDN内容方向检测（2026-07-03新增，信息性检测，不影响通过/失败）
    csdn_pos, csdn_neg, csdn_detail = _check_csdn_content_fit(full_text)
    reports.append(f"20. CSDN适配度: {csdn_detail}")

    # 21. 事件驱动检测（2026-07-05新增，信息性检测，不影响通过/失败）
    # 检测文章是否有具体新闻事件触发（无事件=流量封顶）
    event_patterns = [
        r'(昨天|上周|前天|今日|今天|本周|刚刚|昨日)',  # 时间锚点
        r'(发布|宣布|公布|曝光|披露|出台|落地|上线)',  # 事件动词
        r'(研究|报告|数据|调查)\s*(显示|表明|发现|指出)',  # 研究引用
        r'(据|根据|来自)\s*(\S{2,10})\s*(报道|消息|数据|研究)',  # 信源引用
    ]
    event_hits = []
    for pat in event_patterns:
        matches = re.findall(pat, full_text[:2000])  # 检测前2000字
        if matches:
            event_hits.extend(matches[:2])
    if event_hits:
        reports.append(f"21. 事件驱动: ✅ 检测到事件触发信号({len(event_hits)}个)")
    else:
        reports.append(f"21. 事件驱动: ⚠️ 未检测到具体新闻事件（无事件=流量封顶，建议找事件钩子或换选题）")

    # 22. 配图重复检测（2026-07-09新增，防止跨文章重复用图）
    # 从已发布内容记忆中加载image_registry，检查当前文章是否使用了已用过的图片
    # 2026-07-12 修复：原 os.path.dirname(md_path) 在 articles/ 子目录永远找不到,改走 _load_published_memory
    memory_data = _load_published_memory(md_path)
    if memory_data:
        try:
            registry = memory_data.get('image_registry', {}).get('used_images', [])
            # 排除当前文章自身的记录（按标题匹配 + 同日注册排除）
            current_title = title_text.strip() if title_text else ''
            from datetime import date
            today_str = date.today().isoformat()
            used_files = {
                entry['file'] for entry in registry
                if 'file' in entry
                and entry.get('article', '') != current_title
                and entry.get('date', '') != today_str
            }

            # 从Markdown中提取图片文件名
            doc_images = set(re.findall(r'!\[.*?\]\((?:images/)?([^)]+)\)', full_text))

            # 检查重复
            duplicates = doc_images & used_files
            if duplicates:
                all_pass = False
                dup_info = ', '.join(sorted(duplicates))
                reports.append(f"22. 配图重复检测: (失败) 以下图片已在历史文章中使用过: {dup_info}")
            else:
                reports.append(f"22. 配图重复检测: (通过) 无重复配图，使用{len(doc_images)}张新图")
        except Exception as e:
            reports.append(f"22. 配图重复检测: ⚠️ 检测跳过 ({str(e)[:80]})")
    else:
        reports.append("22. 配图重复检测: ⚠️ 跳过（未找到已发布内容记忆.json）")

    return all_pass, reports


# ==================== 标题质量检测（第14项，2026-06-28新增，2026-07-02重构） ====================

# 冲突/悬念/好奇心缺口词
TITLE_CONFLICT_WORDS = [
    '但是', '但', '竟然', '真相是', '真相', '我算了一笔账',
    '我扒完', '我读完', '我实测', '我亲测', '发现',
    '竟然是', '其实是', '内幕', '揭秘', '秘密',
    '没想到', '没想到的是', '反超', '反转', '翻车',
    '结果', '却', '居然', '原来', '才',
]

# 情绪触发词（标题中引发强烈情绪的关键词）
TITLE_EMOTION_WORDS = [
    '坑', '骗局', '骗局', '坑人', '忽悠', '割韭菜',
    '被骗', '上当', '踩坑', '血泪', '惨痛', '扎心',
    '后悔', '惊醒', '惊醒', '打脸', '真相', '底裤',
    '暴利', '暴利', '黑幕', '套路', '陷阱', '智商税',
    '翻车', '暴雷', '塌房', '救命', '逆天', '炸裂',
    '傻眼', '懵了', '慌了', '哭了', '笑了',
]

# 好奇心缺口模式
TITLE_CURIOSITY_PATTERNS = [
    r'但.{0,8}(发现|结果|其实|真相|没想到)',
    r'竟然', r'居然', r'原来',
    r'我.{0,4}(扒完|算完|实测|亲测|看完|试完)',
    r'真相是', r'没想到',
    r'才知道', r'才明白', r'才懂',
    r'秘密', r'内幕',
    r'\？',  # 标题含问号（提问式标题）
]

# 空洞否定收尾模式（禁止用这种写法收尾）
TITLE_VAGUE_NEGATION_PATTERNS = [
    r'不是.{1,8}$',
    r'不只是.{1,8}$',
    r'并非.{1,8}$',
    r'不在于.{1,8}$',
    r'不是.{1,15}那.{0,5}样$',
]

# 具体普通人利益点关键词（出现任一即视为给到具体利益）
TITLE_BENEFIT_KEYWORDS = [
    # 省钱类
    '省', '便宜', '降价', '涨价', '免费', '收费', '账单', '价格', '定价', '钱',
    '元', '块', '成本', '退款', '白嫖',
    # 省时间类
    '分钟', '小时', '秒', '省时', '快', '提速', '加速',
    # 避坑类
    '避坑', '坑', '骗局', '别跟风', '别买', '别用', '别交', '白砸', '白花',
    '套路', '陷阱', '智商税',
    # 赚了类
    '赚', '收益', '副业', '变现', '搞钱', '月入', '日薪', '年薪',
    # 其他具体利益
    '工作', '就业', '求职', '上岸', 'offer', 'Offer',
    '翻身', '逆袭', '出路',
]


def _check_title_quality(title_text):
    """标题质量检测（2026-07-02重构）：
    核心改变：去掉产品名/品牌名强制要求（旧规则逼出别扭标题），
    改为「点击冲动测试」——标题是否让人忍不住想点？

    4个条件：
    1. 点击冲动：有数字/情绪/好奇心缺口（至少2项）
    2. 具体利益：给读者一个点进来的理由（省钱/避坑/赚钱等）
    3. 禁止空洞否定收尾
    4. 长度≤35字通过，36-45字警告，>45字失败

    返回: (passed, detail_str)
    """
    if not title_text:
        return False, '无标题'

    title = title_text.strip()
    title_len = len(title)
    fails = []
    warns = []

    # 条件1：点击冲动测试（替代旧版"产品名"要求）
    # 至少满足以下2项：
    click_elements = []

    # 1a. 有具体数字（"200""8小时""3个坑"等）
    has_number = bool(re.search(r'\d+', title))
    if has_number:
        click_elements.append('数字')

    # 1b. 有情绪触发词
    has_emotion = any(kw in title for kw in TITLE_EMOTION_WORDS)
    if has_emotion:
        click_elements.append('情绪')

    # 1c. 有好奇心缺口句式
    has_curiosity = any(re.search(p, title) for p in TITLE_CURIOSITY_PATTERNS)
    if has_curiosity:
        click_elements.append('好奇心缺口')

    # 1d. 有悬念式疑问收尾
    if title.endswith(('?', '？')):
        click_elements.append('悬念疑问')

    if len(click_elements) < 2:
        fails.append(f'条件1失败：标题缺乏点击冲动（仅有{click_elements or "无"}，需数字+情绪/好奇心至少2项）')

    # 条件2：包含具体普通人利益点，且禁止空洞否定收尾
    has_benefit = any(kw in title for kw in TITLE_BENEFIT_KEYWORDS)
    if not has_benefit:
        fails.append('条件2失败：标题未包含具体普通人利益点（省钱/省时间/避坑/赚了，需具体如"日薪200""避坑""月入过万"）')

    # 空洞否定收尾检测
    vague_negation_hits = []
    for pattern in TITLE_VAGUE_NEGATION_PATTERNS:
        matches = re.findall(pattern, title)
        if matches:
            vague_negation_hits.append(f'"{matches[-1]}"')
    if vague_negation_hits:
        fails.append(f'条件2违规：标题以空洞否定收尾{vague_negation_hits}，必须给具体利益点')

    # 条件3：标题长度≤32字通过，33-45字警告，>45字强制失败
    if title_len > 45:
        fails.append(f'条件3失败：标题{title_len}字超过45字上限')
    elif title_len > 32:
        warns.append(f'标题{title_len}字偏长（建议≤32字）')

    # 汇总
    detail_parts = [f'标题{title_len}字']
    if click_elements:
        detail_parts.append(f'点击冲动({"+".join(click_elements)})')
    if has_benefit and not vague_negation_hits:
        detail_parts.append('具体利益✓')

    if warns:
        detail_parts.append('；'.join(warns))

    detail = ' | '.join(detail_parts)
    if fails:
        detail += ' | 失败项: ' + '；'.join(fails)

    passed = len(fails) == 0
    return passed, detail


# ==================== 标题吸引力评分（2026-07-02新增，信息性评分） ====================

def _score_title_attractiveness(title_text):
    """标题吸引力评分（0-10分）：衡量标题让人想点进来的程度。
    不是通过/失败检测，而是帮助判断标题的点击潜力。
    返回: (score, detail_str)
    """
    if not title_text:
        return 0, '无标题'

    title = title_text.strip()
    score = 0
    patterns_matched = []

    # 1. 有具体数字 (+2)
    if re.search(r'\d+', title):
        score += 2
        patterns_matched.append('具体数字')

    # 2. 有情绪触发词 (+2)
    if any(kw in title for kw in TITLE_EMOTION_WORDS):
        score += 2
        patterns_matched.append('情绪触发')

    # 3. 有好奇心缺口 (+2)
    if any(re.search(p, title) for p in TITLE_CURIOSITY_PATTERNS):
        score += 2
        patterns_matched.append('好奇心缺口')

    # 4. 有对比/反转结构 (+1)
    reversal_patterns = [
        r'但', r'却', r'竟然', r'居然', r'原来',
        r'结果', r'没想到',
    ]
    if any(p in title for p in reversal_patterns):
        score += 1
        patterns_matched.append('对比反转')

    # 5. 有身份锚定 (+1): 标题中提到目标读者身份
    identity_words = ['普通人', '上班族', '学生', '家长', '宝妈', '打工人',
                      '毕业生', '求职者', '自由职业', '新手']
    if any(kw in title for kw in identity_words):
        score += 1
        patterns_matched.append('身份锚定')

    # 6. 有行动暗示 (+1): 标题暗示读者看完能做什么
    action_patterns = [
        r'(方法|技巧|教程|指南|攻略)',
        r'(怎么|如何|怎样)',
        r'(3个?招|3步|一步|这样)',
        r'(避坑|避过|躲过)',
        r'(省|赚|月入|日赚)',
    ]
    if any(re.search(p, title) for p in action_patterns):
        score += 1
        patterns_matched.append('行动暗示')

    # 7. 长度适中加分 (+1): 20-34字最佳
    title_len = len(title)
    if 20 <= title_len <= 34:
        score += 1
        patterns_matched.append('长度适中')

    # 8. 悬念疑问收尾 (+1)
    if title.endswith(('?', '？')):
        score += 1
        patterns_matched.append('悬念疑问')

    detail = f'{score}/10'
    if patterns_matched:
        detail += f' | 命中: {", ".join(patterns_matched)}'

    return min(score, 10), detail


# ==================== 标题候选排名（2026-07-02新增） ====================

def rank_title_candidates(candidates):
    """
    对多个标题候选进行打分排名。

    Args:
        candidates: list of str, 标题候选列表

    Returns:
        list of (score, title, detail) 按分数降序排列
    """
    results = []
    for title in candidates:
        score, detail = _score_title_attractiveness(title)
        results.append((score, title, detail))

    results.sort(key=lambda x: x[0], reverse=True)
    return results


# ==================== 开头钩子评分（2026-07-02新增，信息性评分） ====================

# 开头钩子模式库（用于检测开头是否有吸引力）
OPENING_HOOK_PATTERNS = {
    '个人故事': [
        r'我(去|试|用|发现|看到|收到|经历|认识|心想|算了|扒了|查了)',
        r'(上周|昨天|前几天|上个月|今天早上)',
        r'有(个|一位)(朋友|同事|同学|学员|宝妈|大哥|姐姐)',
    ],
    '对话引用': [
        r'[\'\'""「」（）：:](.{2,30})[\'\'""」）]',
        r'跟我说',
        r'(问|告诉|喊|叫)我',
        r'朋友(给|发|转)',
        r'(她|他)(说|问|觉得)',
    ],
    '数据冲击': [
        r'\d+[%％]',
        r'涨(了|幅)',
        r'(暴涨|暴跌|翻倍|腰斩)',
        r'增长(了|幅度)',
        r'\d+倍',
        r'(收入差了|差距|差了)\d+',
        r'(过万|不到)\d+',
    ],
    '直接提问': [
        r'(你|大家).{0,5}(知道|有没有|想过|觉得|认为)',
        r'(为什么|是不是|难道)',
        r'(怎么办|好不好|行不行|对不对)',
    ],
    '场景代入': [
        r'(想象|假设|如果你|当你|每次)',
        r'(你正在|你试过|你有没有过)',
    ],
    '争议声明': [
        r'(其实|事实上|说实话|直说了)',
        r'(很多人|大部分人|绝大多数人).{2,10}(都|是|以为)',
        r'(真相|事实)',
        r'被(忽悠|骗|误导)',
        r'(最大的|最火的|最热的).{2,10}(误区|谎言|骗局)',
    ],
    '反常识': [
        r'(不是|并非|不像).{2,15}(而是|其实)',
        r'越.{1,6}越',
        r'(反而|恰恰相反)',
        r'跟.{2,10}(想的|以为的).{0,5}不一样',
        r'同样.{2,25}(差了|差距)',
    ],
}


def _score_opening_hook(full_text):
    """开头钩子评分（0-10分）：衡量文章开头让人想继续读的程度。
    检测前3句（约前100字）是否包含经过验证的钩子模式。
    返回: (score, detail_str)
    """
    if not full_text:
        return 0, '无正文'

    # 提取开头（前200字或前3句）
    opening = full_text[:200]

    score = 0
    hooks_found = []

    for hook_type, patterns in OPENING_HOOK_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, opening):
                score += 2
                hooks_found.append(hook_type)
                break  # 每种类型只计一次

    # 开头有问号的额外加分（提问式开头天然吸引注意力）
    if re.search(r'[？?]', opening):
        score += 1
        hooks_found.append('提问式')

    # 开头有对话/引号的加分（对话式开头更有代入感）
    if re.search(r'[「『"\'：:]', opening[:50]):
        score += 1
        hooks_found.append('对话式')

    # 开头太短扣分（少于20字的开头没有冲击力）
    if len(opening.strip()) < 20:
        score = max(0, score - 2)
        hooks_found.append('开头过短')

    # 开头是综述式扣分（"近年来""随着""目前"等开头太无聊）
    boring_starts = ['近年来', '随着', '目前', '众所周知', '毫无疑问',
                     '在当今', '如今']
    if any(opening.startswith(bs) for bs in boring_starts):
        score = max(0, score - 2)
        hooks_found.append('综述式开头(扣分)')

    score = min(score, 10)
    opening_preview = opening[:40].replace('\n', ' ') + '...'
    detail = f'{score}/10 | 开头: "{opening_preview}"'
    if hooks_found:
        detail += f' | 钩子: {", ".join(hooks_found)}'

    return score, detail


# ==================== GEO优化检测（第13项，2026-06-22新增） ====================

def _check_geo_optimization(full_text, title_text):
    """
    GEO优化检测：检测文章是否具备被AI搜索引擎检索和引用的优化要素。
    返回(geo_score, detail_string)
    geo_score: 0-100，≥100为通过（满分才放行）
    """
    cn_chars = sum(1 for c in full_text if '\u4e00' <= c <= '\u9fff')
    if cn_chars == 0:
        return 0, '无中文内容'

    score = 0
    details = []

    # 1. 结构化内容检测（15分）
    # 检测章节标题格式（数字+冒号/编号/模板渲染格式）
    section_patterns = [
        r'\d+[：:]\s*\S',
        r'第[一二三四五六七八九十]+[章节]',
        r'\d+\.\s*\S',
        r'\d{2}\s{2,}\S',       # 模板渲染格式：01  标题（builder编号+双空格+标题）
    ]
    section_count = 0
    for pattern in section_patterns:
        section_count += len(re.findall(pattern, full_text))
    if section_count >= 3:
        score += 15
        details.append(f"章节标题{section_count}个(结构化)")
    elif section_count >= 1:
        score += 8
        details.append(f"章节标题{section_count}个(不足)")
    else:
        details.append("无章节标题结构")

    # 2. 数据引用密度检测（20分）
    # 检测数字、百分比、金额、日期等数据点
    data_patterns = [
        r'\d+\.?\d*%',           # 百分比
        r'\d+\.?\d*万',           # 万级数字
        r'\d+\.?\d*亿',           # 亿级数字
        r'\$\d+\.?\d*',           # 美元
        r'\d+\.?\d*美元',         # 美元
        r'\d+\.?\d*元',           # 人民币
        r'\d{4}年\d{1,2}月',      # 日期
        r'\d+\.?\d*倍',           # 倍数
        r'\d+\.?\d*token',        # token数
        r'\d+\.?\d*[TKGB]B?',     # 技术单位
    ]
    data_count = 0
    for pattern in data_patterns:
        data_count += len(re.findall(pattern, full_text, re.IGNORECASE))
    data_density = data_count / (cn_chars / 1000) if cn_chars > 0 else 0
    if data_density >= 3:
        score += 20
        details.append(f"数据密度{data_density:.1f}/千字({data_count}个)")
    elif data_density >= 1.5:
        score += 12
        details.append(f"数据密度{data_density:.1f}/千字(不足)")
    else:
        details.append(f"数据密度{data_density:.1f}/千字(严重不足)")

    # 3. 问答结构检测（15分）
    # 检测自问自答段落
    qa_patterns = [
        r'是什么[？\?]',
        r'为什么[？\?]',
        r'怎么回事[？\?]',
        r'怎么办[？\?]',
        r'如何[？\?]',
        r'什么意思[？\?]',
        r'有什么[？\?]',
        r'有哪些[？\?]',
        r'是多少[？\?]',
        r'多大[？\?]',
    ]
    qa_count = 0
    for pattern in qa_patterns:
        qa_count += len(re.findall(pattern, full_text))
    if qa_count >= 2:
        score += 15
        details.append(f"问答结构{qa_count}处")
    elif qa_count >= 1:
        score += 8
        details.append(f"问答结构{qa_count}处(不足)")
    else:
        details.append("无问答结构")

    # 4. 专业术语检测（15分）
    # 检测技术术语密度（英文术语+中文技术词）
    tech_terms_en = re.findall(r'[A-Z][a-zA-Z]{2,15}', full_text)
    tech_terms_cn = re.findall(r'[\u4e00-\u9fff]{2,6}(?:模型|架构|算法|协议|接口|框架|引擎|向量|矩阵|推理|训练|微调|对齐|部署|容器|编排|缓存|索引|检索|生成|优化|压缩|量化|蒸馏|注意力|编码器|解码器|嵌入|标记|上下文|窗口|智能体|代理)', full_text)
    unique_terms = set(tech_terms_en + tech_terms_cn)
    term_count = len(unique_terms)
    if term_count >= 8:
        score += 15
        details.append(f"专业术语{term_count}个")
    elif term_count >= 5:
        score += 10
        details.append(f"专业术语{term_count}个(不足)")
    else:
        details.append(f"专业术语{term_count}个(严重不足)")

    # 5. 权威信源引用检测（10分）
    # 检测权威信源表述（合规格式，非"据报道"）
    source_patterns = [
        r'官方数据显示',
        r'官方博客',
        r'官方信息',
        r'研究数据显示',
        r'测试数据显示',
        r'公开信息显示',
        r'公开数据显示',
        r'多方消息显示',
        r'有消息称',
        r'泄露信息',
        r'日志显示',
        r'Gartner',
        r'IDC',
        r'中国信通院',
        r'麦肯锡',
        r'波士顿咨询',
    ]
    source_count = 0
    for pattern in source_patterns:
        source_count += len(re.findall(pattern, full_text))
    if source_count >= 2:
        score += 10
        details.append(f"权威信源{source_count}处")
    elif source_count >= 1:
        score += 10
        details.append(f"权威信源{source_count}处")
    else:
        details.append("无权威信源")

    # 6. 长尾关键词检测（10分）
    # 检测标题中的关键词在正文中的出现情况
    title_keywords = re.findall(r'[\u4e00-\u9fff]{2,6}', title_text)
    title_keywords = [kw for kw in title_keywords if len(kw) >= 2]
    keyword_in_body = 0
    for kw in title_keywords:
        if kw in full_text:
            keyword_in_body += 1
    keyword_ratio = keyword_in_body / max(len(title_keywords), 1)
    if keyword_ratio >= 0.8:
        score += 10
        details.append(f"标题关键词正文覆盖{keyword_ratio:.0%}")
    elif keyword_ratio >= 0.5:
        score += 5
        details.append(f"标题关键词正文覆盖{keyword_ratio:.0%}(不足)")
    else:
        details.append(f"标题关键词正文覆盖{keyword_ratio:.0%}(严重不足)")

    # 7. E-E-A-T信号检测（10分）
    # 经验：个人视角表达
    experience_patterns = [r'我关注', r'我判断', r'我理解', r'我注意到', r'我发现', r'我的判断', r'我的看法', r'我倒是觉得', r'我观察', r'我带学员', r'我做过', r'我踩过', r'我的体会是', r'说白了', r'最深的感受是']
    experience_count = 0
    for pattern in experience_patterns:
        experience_count += len(re.findall(pattern, full_text))
    # 可信度：免责声明
    trust_patterns = [r'不构成.*推荐', r'不构成.*建议', r'以.*为准', r'谨慎对待', r'独立评估', r'独立测试']
    trust_count = 0
    for pattern in trust_patterns:
        trust_count += len(re.findall(pattern, full_text))

    ee_score = 0
    if experience_count >= 2:
        ee_score += 5
    elif experience_count >= 1:
        ee_score += 3
    if trust_count >= 1:
        ee_score += 5
    elif trust_count >= 0:
        ee_score += 0
    score += ee_score
    details.append(f"E-E-A-T: 经验{experience_count}处+可信度{trust_count}处({ee_score}分)")

    # 8. 引流行为扫描（扣分项，发现即扣20分）
    # 检测微信号、电话、QQ群等引流联系方式
    lead_gen_patterns = [
        r'微信[：:]\s*\S+',
        r'微信号[：:]?\s*\S+',
        r'加微',
        r'扫码',
        r'二维码',
        r'QQ群',
        r'电话[：:]\s*\d',
        r'手机[：:]\s*\d',
        r'1[3-9]\d{9}',           # 手机号
        r'关注公众号',
        r'关注我们',
        r'进群',
        r'私聊',
        r'联系我',
    ]
    lead_gen_count = 0
    for pattern in lead_gen_patterns:
        lead_gen_count += len(re.findall(pattern, full_text))
    if lead_gen_count > 0:
        score -= 20
        details.append(f"引流行为{lead_gen_count}处(扣20分)")

    # 9. 来源标注违规扫描（扣分项，发现即扣10分）
    violation_source_patterns = [
        r'据.{0,4}报道',
        r'据.{0,4}消息',
        r'来自公开报道',
        r'来源[于:：]',
        r'转载自',
        r'综合自',
    ]
    violation_count = 0
    for pattern in violation_source_patterns:
        violation_count += len(re.findall(pattern, full_text))
    if violation_count > 0:
        score -= 10
        details.append(f"来源标注违规{violation_count}处(扣10分)")

    # 10. 品牌实体覆盖检测（2026-06-22新增，加分项，最多加20分）
    # 检测智汇AI品牌实体在文章中的覆盖情况
    brand_full = '吉林省爱智汇人工智能科技有限公司'
    brand_main = '智汇AI'
    brand_sub = ['智汇AI社区', '智汇AI教育']
    brand_address_keywords = ['长春', '越达路', '人工智能人才孵化基地', '高新区']
    business_keywords = ['AI课程', '人工智能课程', 'AI培训', 'AI工具', 'AI服务', '就业指导', '就业推荐']

    brand_bonus = 0
    # 品牌名出现（全称或品牌名）
    has_brand = (brand_full in full_text) or (brand_main in full_text)
    if has_brand:
        brand_bonus += 10
        brand_name_found = brand_full if brand_full in full_text else brand_main
        details.append(f"品牌实体'{brand_name_found}'已植入(+10)")
    else:
        details.append("品牌实体未植入(缺+10)")

    # 子品牌覆盖
    sub_hits = [sb for sb in brand_sub if sb in full_text]
    if len(sub_hits) >= 1:
        brand_bonus += 3
        details.append(f"子品牌{sub_hits}(+3)")

    # 业务关键词覆盖
    business_hits = [kw for kw in business_keywords if kw in full_text]
    if len(business_hits) >= 2:
        brand_bonus += 4
        details.append(f"业务关键词{len(business_hits)}个(+4)")
    elif len(business_hits) >= 1:
        brand_bonus += 2
        details.append(f"业务关键词{len(business_hits)}个(+2)")

    # 地域关键词覆盖
    address_hits = [kw for kw in brand_address_keywords if kw in full_text]
    if len(address_hits) >= 1:
        brand_bonus += 3
        details.append(f"地域关键词{len(address_hits)}个(+3)")

    score += brand_bonus

    # 11. 营销推广语扫描（扣分项，发现即扣15分）
    marketing_promo_patterns = [
        r'快来报名',
        r'限时优惠',
        r'立即咨询',
        r'名额有限',
        r'抢先体验',
        r'马上体验',
        r'免费试听',
        r'预约体验',
        r'报名从速',
        r'优惠活动',
        r'折扣',
        r'促销',
    ]
    promo_count = 0
    for pattern in marketing_promo_patterns:
        promo_count += len(re.findall(pattern, full_text))
    if promo_count > 0:
        score -= 15
        details.append(f"营销推广语{promo_count}处(扣15分)")

    score = max(0, min(100, score))
    detail_str = ' | '.join(details)
    return score, detail_str


def main():
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
    if len(sys.argv) < 2:
        # 未传参时自动找output目录下最新的md
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'output')
        if os.path.exists(output_dir):
            md_files = [f for f in os.listdir(output_dir) if f.endswith('.md')]
            if md_files:
                md_path = os.path.join(output_dir, md_files[0])
            else:
                print('未找到Markdown文件')
                sys.exit(1)
        else:
            print('用法: python lib/validate.py <md路径>')
            sys.exit(1)
    else:
        md_path = sys.argv[1]

    print('====== 文章自检报告（22项） ======')
    print(f'文件: {os.path.basename(md_path)}')
    print()

    all_pass, reports = validate(md_path)

    for report in reports:
        print(report)

    print()
    if all_pass:
        print('====== 全部22项通过，可以交付 ======')
        sys.exit(0)
    else:
        print('====== 存在失败项，禁止交付 ======')
        sys.exit(1)


if __name__ == '__main__':
    main()
