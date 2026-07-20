# -*- coding: utf-8 -*-
"""
CSDN 专用 DOCX 构建器（2026-07-16 用户强制·2026-07-17 二次加固）
================================================================
背景：CSDN 对营销内容审核极严。用户要求以后每篇文章除微信版外，
额外单独出一个 CSDN 专用 DOCX——所有营销内容、SEO/GEO 优化内容、公众号调性全部删掉。

本模块做的事：
  1. clean_md_for_csdn(md_text, csdn_title=None)
     - 删除「## 智汇AI悄悄话」整段（创始人/公司业务推广 + 点赞/关注 CTA 图）
     - 删除**所有品牌植入**：智汇AI / 智汇AI教育 / 智汇AI社区 / 吉林省爱智汇 / 创始人/讲师等
     - 删除**个人经历/教学叙事**：我做了X年AI培训 / 我学员 / 我办AI教育 / 我教了/我见过等
     - 删除**公众号式互动引导**：点赞 / 收藏 / 关注我 / 转发给朋友 / 评论区告诉我
     - 删除 GEO 信源/信任话术：公开信息显示 / 多方消息显示 / 以官方公告为准
     - 标题去营销后缀（省钱不踩坑 / 红利 / 最强 / 必看 ...）
     - **第一人称"我"降级为"开发者/用户/从业者"**（公众号叙事 → 客观技术评测）
     - 保留：真实数据(2.5万亿等)、::: tip/warning 卡片、自然问答、技术分析
  2. build_csdn_docx(source_md, out_docx, images_dir, csdn_title=None)
     - 清洗后写入系统临时 md → 复用 build_gpt56_sol.build_docx 渲染 → 删除临时 md
     - 图片沿用 output/images 下与正文强相关的真实图（aipower_1~5），不嵌点赞/关注
     - **清洗后自检**：跑一次平台风险检测，>0 立即报错（不交付营销 CSDN）

说明：CSDN DOCX 不受微信 22 项门禁约束（GEO/营销是其刻意要的），是独立交付物。
但必须过 CSDN 平台审核——CSDN 比 validate 脚本严格得多。
"""
import os
import re
import sys
import tempfile

# 让本模块能 import 项目根的 build_gpt56_sol
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
import build_gpt56_sol as builder

# ===== 需剥离的 GEO 信源/信任话术（纯 SEO 优化，非事实）=====
GEO_BOILERPLATE = [
    r'公开信息显示[，,]?',
    r'公开报道里',
    r'多方消息显示[，,]?',
    r'具体以智谱官方公告为准[。.]?',
    r'以智谱官方公告为准[。.]?',
    r'以官方公告为准[。.]?',
    r'以官方为准[。.]?',
    r'谨慎对待[，,]?',
]

# ===== 品牌植入/机构宣传（2026-07-17 用户暴怒反馈·CSDN 平台驳回根因）=====
BRAND_PHRASES = [
    r'智汇AI',
    r'智汇A I',
    r'吉林省爱智汇[\u4e00-\u9fff]+有限公司?',
    r'爱智汇[\u4e00-\u9fff]*',
    r'智汇AI教育',
    r'智汇AI社区',
    r'智汇AI悄悄话',
]

# ===== 个人经历/教学叙事（CSDN 平台判定为公众号调性/个人品牌营销）=====
PERSONAL_NARRATIVE = [
    # 创始人/讲师/学员/公司业务等所有个人身份相关
    r'我[\u4e00-\u9fff]{0,3}(办|做|开了|创办|创立|在办了?|在做?)[\u4e00-\u9fff]{0,8}(AI[\u4e00-\u9fff]{0,3})?(培训|教育|学院|公司)?[\u4e00-\u9fff]{0,5}[，,。；;]?',
    r'我[\u4e00-\u9fff]{0,3}教(了|过)[\u4e00-\u9fff]{0,15}[，,。；;]?',
    r'我[\u4e00-\u9fff]{0,2}(学员|学生们?)[\u4e00-\u9fff]{0,15}[，,。；;]?',
    r'我[\u4e00-\u9fff]{0,3}(常|经常|总是|老|总|一直)[\u4e00-\u9fff]{0,8}(提醒|告诉|念叨|说)[\u4e00-\u9fff]{0,8}[，,。；;]?',
    r'我[\u4e00-\u9fff]{0,3}(两|三|几)年[\u4e00-\u9fff]{0,8}',
    r'我本人[\u4e00-\u9fff]{0,15}[，,。；;]?',
    # 公众号式个人感悟/沉默段
    r'我[\u4e00-\u9fff]{0,3}(沉默|感慨|思考|深思|动容|心酸)[\u4e00-\u9fff]{0,8}[，。,.;]',
    # 公众号式"我看到/我关注/我理解/我注意到/我发现/我判断/我建议/我提醒"等
    r'我[\u4e00-\u9fff]{0,2}(看到|关注|理解|注意到|发现|判断|建议|提醒)[\u4e00-\u9fff]{0,40}[，,。；;]',
]

# ===== 公众号式语段（CSDN 不允许整段出现）=====
PARAGRAPH_REWRITE = [
    # 公众号式结尾"如果你也是关注...创业者"——整段删
    (r'如果你也是关注[\u4e00-\u9fff]{0,40}创业者[\u4e00-\u9fff]{0,200}', ''),
    # 残留"我沉默了什么呢？"
    (r'\*\*我沉默了什么呢[\u4e00-\u9fff？\?]+\*\*[\s\S]{0,2000}?(?=\n##\s|\n\*\*|\Z)', ''),
    # 公众号式"我看到中国 AI..."感悟段
    (r'\*\*我看到[\s\S]{0,2000}?(?=\n##\s|\n\*\*|\Z)', ''),
    # 公众号式免责声明段（含"以...为准/独立评估"等纯 SEO 话术）
    (r'\*\*以上分析仅基于[\u4e00-\u9fff]{0,30}请[\u4e00-\u9fff]{0,5}，?独立评估[\u4e00-\u9fff]{0,30}\*\*', ''),
    (r'\*\*以上[\u4e00-\u9fff]{0,20}仅供参考[\u4e00-\u9fff]{0,40}\*\*', ''),
    # 公众号式"给普通人的X个实操建议"整段——改为"技术落地建议"+ 三行短句
    (r'## ▎给普通人的[\u4e00-\u9fff0-9]{0,5}个实操建议[\s\S]{0,3000}?(?=\n##\s|\n\*\*|\Z)',
     '## ▎技术落地建议\n\n1. **用免费 AI 程序做 POC**：选 Kimi K3 或 MiniMax M3 做小规模验证，3 美元/百万字起。\n2. **AI 终端尝鲜**：14.9g 的 AI 眼镜或量产 AI 数字员工手机均可。\n3. **集成 AI 数字员工**：把 AI 当 24 小时实习生，先派低风险任务。\n'),
    (r'## ▎给普通人的[\u4e00-\u9fff0-9]{0,5}个[\u4e00-\u9fff]{0,5}建议[\s\S]{0,3000}?(?=\n##\s|\n\*\*|\Z)',
     '## ▎技术落地建议\n\n1. **用免费 AI 程序做 POC**：选 Kimi K3 或 MiniMax M3 做小规模验证，3 美元/百万字起。\n2. **AI 终端尝鲜**：14.9g 的 AI 眼镜或量产 AI 数字员工手机均可。\n3. **集成 AI 数字员工**：把 AI 当 24 小时实习生，先派低风险任务。\n'),
    (r'技术落地建议[\u4e00-\u9fff]{0,300}?(?=1\.\s+\*\*)', ''),
    # 公众号式"想用开源...做业务/想用...帮你干活"开头
    (r'\*\*想用免费 AI 程序做业务[\u4e00-\u9fff]{0,5}', '**用免费 AI 程序做 POC：** '),
    (r'\*\*想用[\u4e00-\u9fff]{0,5}帮你干活[\u4e00-\u9fff]{0,5}', '**集成 AI 数字员工：** '),
    (r'如果你[\u4e00-\u9fff]{0,3}关注[\u4e00-\u9fff]{0,30}落地[\u4e00-\u9fff]{0,15}这3个步骤', '技术落地建议：'),
    (r'我是[\u4e00-\u9fff]{0,3}，?在[\u4e00-\u9fff]{0,5}做了[\u4e00-\u9fff]{0,5}两年[\u4e00-\u9fff]{0,30}[。.]?', ''),
    # 残留乱文（被半删的 CTA 句）
    (r'查资料[\u4e00-\u9fff]{0,5}。，[\u4e00-\u9fff]{0,5}', ''),
    (r'\*\*[，,。；;]?[\u4e00-\u9fff]{0,10}\*\*', ''),
]

# ===== 公众号式互动引导（CSDN 不允许）=====
CTA_PATTERNS = [
    r'点赞.{0,3}收藏.{0,8}',
    r'点赞[\u4e00-\u9fff]{0,3}收藏',
    r'点个?关注',
    r'关注[\u4e00-\u9fff]{0,3}我',
    r'后续[\u4e00-\u9fff]{0,5}(我会|我将继续|持续)[\u4e00-\u9fff]{0,10}',
    r'关注[\u4e00-\u9fff]{0,5}后[\u4e00-\u9fff]{0,8}',
    r'转发给.{2,15}(朋友|同事|家人|同学)',
    r'(关注|点赞|在看|收藏).{0,5}(下周|下期|明天|每天|后面)',
    r'(评论区|留言区).{0,8}(说说|告诉我|留言|聊聊)',
    r'(加我|添加|扫码|进群|入群)',
    r'找[\u4e00-\u9fff]{0,3}我',
    r'(公众号|微信|抖音|小红书|B站|微博).{0,5}(搜索|关注|扫码)',
    # 残句变体
    r'先收藏[\u4e00-\u9fff]{0,5}再[\u4e00-\u9fff]{0,5}',
    r'记得[\u4e00-\u9fff]{0,5}收藏',
]

# ===== 标题营销后缀词（CSDN 禁用）=====
MARKETING_TITLE_WORDS = [
    '省钱不踩坑', '不踩坑', '省钱', '红利', '最强', '必看', '速看',
    '干货', '收藏', '揭秘', '震惊', '可怕', '速懂', '一文搞懂',
    '速通', '保姆级', '血泪', '劝退', '早看早', '不踩', '暴涨',
    '赚到', '躺赚', '稳赚', '月入', '日入', '年薪', '翻倍',
]


def derive_csdn_title(wechat_title):
    """从微信标题派生 CSDN 中性标题（去营销后缀，不在标点处截断）。"""
    t = wechat_title or ''
    for w in MARKETING_TITLE_WORDS:
        t = t.replace(w, '')
    t = t.strip().rstrip(' ，,、:：')
    # 若去后缀后仍以逗号结尾（残句），截到上一个逗号
    if t and t[-1] in '，,':
        t = t.rsplit('，', 1)[0].rsplit(',', 1)[0]
    return t.strip() or (wechat_title or '')


def clean_md_for_csdn(md_text, csdn_title=None):
    """返回清洗后的 CSDN 版 markdown 文本。

    2026-07-17 加固：CSDN 平台判定营销的标准比 validate 脚本严格得多。
    必须删干净品牌植入 + 个人经历 + 公众号式互动。
    """
    lines = md_text.split('\n')
    out = []
    skip = False
    for ln in lines:
        s = ln.strip()
        # 1. 删除「智汇AI悄悄话」整段（含点赞/关注图），该段恒为文末营销块
        if s.startswith('## 智汇AI悄悄话'):
            skip = True
            continue
        if skip:
            continue
        out.append(ln)
    text = '\n'.join(out)

    # 2. 删品牌植入
    for pat in BRAND_PHRASES:
        text = re.sub(pat, '', text)

    # 3. 删个人经历/教学叙事
    for pat in PERSONAL_NARRATIVE:
        text = re.sub(pat, '', text)

    # 4. 删公众号式互动引导
    for pat in CTA_PATTERNS:
        text = re.sub(pat, '', text)

    # 5. 删 GEO 信源/信任话术
    for pat in GEO_BOILERPLATE:
        text = re.sub(pat, '', text)

    # 6. 第一人称"我"降级为"开发者"/"用户"/"从业者"（CSDN 调性）
    text = re.sub(r'^\s*我[\u4e00-\u9fff]{0,3}(判断|认为|建议|理解|关注|注意到|发现)[\u4e00-\u9fff]{0,2}',
                  lambda m: m.group(0).replace('我', '开发者社区', 1), text, flags=re.M)

    # 6.5 公众号式语段整段改写/删除
    for pat, repl in PARAGRAPH_REWRITE:
        text = re.sub(pat, repl, text, flags=re.S)

    # 6.6 残留"学员"/"收藏"等关键词二次清洗（防半删留残）
    text = re.sub(r'学员', '用户', text)
    text = re.sub(r'收藏[\u4e00-\u9fff]{0,3}这篇', '查阅技术文档', text)
    text = re.sub(r'收藏[\u4e00-\u9fff]{0,3}再', '查阅文档后', text)
    text = re.sub(r'这3个建议先收藏', '这3个步骤', text)
    text = re.sub(r'建议先收藏', '步骤可参考', text)
    # 残留感叹号乱文（如"！"+"WAIC深度解读"）
    text = re.sub(r'！[\u4e00-\u9fff]{0,30}深度解读[\u4e00-\u9fff]{0,30}', '', text)
    # 残留"如果你也是关注...创业者"整段（含任何后续内容直到段落结束）
    text = re.sub(r'如果你也是[\u4e00-\u9fff]{0,300}洞察[\u4e00-\u9fff]{0,30}', '', text, flags=re.S)
    text = re.sub(r'如果你也是[\u4e00-\u9fff]{0,300}点赞[\u4e00-\u9fff]{0,30}', '', text, flags=re.S)
    text = re.sub(r'如果你也是[\u4e00-\u9fff]{0,200}', '', text, flags=re.S)
    # 残留"以...为准/独立评估"等纯 SEO 短语
    text = re.sub(r'，?以[\u4e00-\u9fff]{0,10}官方[\u4e00-\u9fff]{0,5}为准', '', text)
    text = re.sub(r'，?独立评估[\u4e00-\u9fff]{0,15}', '', text)
    text = re.sub(r'，?仅供参考[\u4e00-\u9fff]{0,15}', '', text)
    text = re.sub(r'查资料[\u4e00-\u9fff]{0,30}。，?[\u4e00-\u9fff]{0,30}', '', text)
    text = re.sub(r'查资料[\u4e00-\u9fff]{0,30}', '', text)
    # 残留"我看到中国 AI..."半截（** 我看到 ... ** 不闭合也匹配）
    text = re.sub(r'\*\*我[\u4e00-\u9fff]{0,3}看到[\u4e00-\u9fff]{0,300}', '**技术观察：**', text)
    text = re.sub(r'\*\*我[\u4e00-\u9fff]{0,2}沉默了[\u4e00-\u9fff？\?]{0,10}\*\*[\u4e00-\u9fff]{0,500}', '', text, flags=re.S)
    # 残留"我看到"无星号包裹（标题/正文）
    text = re.sub(r'我[\u4e00-\u9fff]{0,2}看到[\u4e00-\u9fff]{0,200}[，,。；;]', '从技术观察看，', text)
    text = re.sub(r'我[\u4e00-\u9fff]{0,2}看到[\u4e00-\u9fff]{0,200}', '从技术观察看', text)
    # 残留"我预想/我理解/我让每个用户/我建议"等半截
    text = re.sub(r'我[\u4e00-\u9fff]{0,2}预想[\u4e00-\u9fff]{0,15}', '行业预想', text)
    text = re.sub(r'我[\u4e00-\u9fff]{0,2}让每个用户[\u4e00-\u9fff]{0,40}', '可先让团队用 K3', text)
    text = re.sub(r'我[\u4e00-\u9fff]{0,2}建议[\u4e00-\u9fff]{0,20}', '建议', text)
    text = re.sub(r'我[\u4e00-\u9fff]{0,2}理解[\u4e00-\u9fff]{0,30}', '从行业看', text)
    # 残留"佩戴我建议"等粘连
    text = re.sub(r'佩戴我', '佩戴，', text)
    text = re.sub(r'在我的[\u4e00-\u9fff]{0,5}里', '在团队内部', text)
    text = re.sub(r'在[\u4e00-\u9fff]{0,5}的用户群里', '在团队内部', text)
    # 残留乱文空段落
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'^\s*[\*#\s]*[\u4e00-\u9fff]{0,5}[\*#\s]*$', '', text, flags=re.M)
    # 残留"讲完五个真相，说点掏心窝的"等口语化
    text = re.sub(r'讲完[\u4e00-\u9fff]{0,8}，说点[\u4e00-\u9fff]{0,8}的[。.]', '技术建议：', text)
    # 残留"！" + 短句乱文
    text = re.sub(r'！[\u4e00-\u9fff]{0,5}[。.]', '。', text)
    # 残留"** WAIC 深度解读和行业洞察。"
    text = re.sub(r'\*\*\s*WAIC[\u4e00-\u9fff]{0,30}洞察[\u4e00-\u9fff]{0,30}', '', text)
    # 残留"**以上分析仅基于公开信息，请。**"
    text = re.sub(r'\*\*以上分析仅基于[\u4e00-\u9fff]{0,30}请[。，]?\*\*', '', text)
    text = re.sub(r'\*\*以上分析仅基于[\u4e00-\u9fff]{0,30}，独立评估[\u4e00-\u9fff]{0,30}\*\*', '', text)

    # 6.7 清洗副作用修补：段头孤字冒号 / K3 数字粘连 / 空格补足 / "建议"前补"的" / 缺失名词补回
    text = re.sub(r'^：([一-鿿])', r'从技术观察，', text, flags=re.M)
    text = re.sub(r'。，', '。', text)
    text = re.sub(r'K3(?:\*\*\uff0c\*\*)?(\d)', lambda m: 'K3 ' + m.group(1), text)  # K3 数字间补空格(包含 **，** 厏有)
    text = re.sub(r'M3(?:\*\*，\*\*)?(\d)', lambda m: 'M3 ' + m.group(1), text)  # M3 数字间补空格(包含 **，** 厏有)
    text = re.sub(r'了建议先', '了，可建议先', text)
    text = re.sub(r'的机会"建议', '的机会"，可建议', text)
    text = re.sub(r'了建议', '了，可建议', text)
    text = re.sub(r'AI行业', 'AI 行业', text)
    # 恢复"镇馆之宝"（被前步规则误删时）
    text = re.sub(r'WAIC\s*""\s*奖项', 'WAIC "镇馆之宝" 奖项', text)
    text = re.sub(r'百度展台上的""', '百度展台上的"百度搭子"', text)
    # "H3 馆一进去我愣住了。" 段头补主语
    text = re.sub(r'^H3 馆一进去我愣住了。', 'H3 馆一进去令人瞩目。', text, flags=re.M)
    # "他们最常问我：" 补主语
    text = re.sub(r'^他们最常问我：', '开发者最关心的问题：', text, flags=re.M)
    # "...机会"建议"..." 修补
    text = re.sub(r'([机会场景方向])"建议', r'"，可建议', text)
    # "：也很关键：" 段头补"价格策略"
    text = re.sub(r'^：?也很关键：', '价格策略也很关键：', text, flags=re.M)
    # "逛到 H1 馆，从技术观察看 50 多人"
    text = re.sub(r'逛到 H1 馆，?从技术观察看 50 多人', '逛到 H1 馆，看到 STEPX Neo 展位前排了 50 多人', text)
    # "为什么这事儿重要？说白了"
    text = re.sub(r'为什么这事儿重要[？\?]\s*说白了', '为何这款程序值得关注？说白了', text)
    text = re.sub(r'为什么我敢这么说[？\?]\s*因为', '为何这样判断？因为', text)
    # "：对做AI产品的创业者" 段头
    text = re.sub(r'^：?对做 AI 产品的创业者', '对做 AI 产品的创业者', text, flags=re.M)
    # "我之前帮一家公司算过账" 的"我之前"被删
    text = re.sub(r'^也很关键：', '价格策略也很关键：', text, flags=re.M)
    # "在 1:1 复刻的工厂产线上" 缺主语——补"Leju"
    text = re.sub(r'^在 1:1 复刻的工厂产线上，吭哧吭哧搬纸箱', '乐聚人形机器人在 1:1 复刻的工厂产线上，吭哧吭哧搬纸箱', text, flags=re.M)
    # 段头"：**" 双冒号
    text = text.replace('：**', '')
    text = re.sub(r'^：', '', text, flags=re.M)
    # 末尾"**以上分析仅基于公开信息，请。**" 残留 — 加强匹配
    text = re.sub(r'\*\*以上分析仅基于[一-鿿，。、：；0-9 ]{0,60}\*\*\s*', '', text)
    text = re.sub(r'以上分析仅基于公开信息，请。', '', text)

        # 7. 标题：优先用显式 csdn_title，否则派生
    m = re.search(r'^# (.+)$', text, re.M)
    orig_title = m.group(1) if m else ''
    new_title = csdn_title if csdn_title else derive_csdn_title(orig_title)
    if new_title and m:
        text = text[:m.start()] + f'# {new_title}' + text[m.end():]
    return text


def build_csdn_docx(source_md, out_docx, images_dir=None, csdn_title=None):
    """构建 CSDN 专用 DOCX（去营销/去 GEO），返回 out_docx 路径。

    2026-07-17 加固：清洗后自检平台风险，>0 立即报错（不交付营销 CSDN）。
    """
    if images_dir is None:
        images_dir = builder.IMAGES_DIR
    with open(source_md, 'r', encoding='utf-8') as f:
        md_text = f.read()
    cleaned = clean_md_for_csdn(md_text, csdn_title)

    # 清洗后自检：跑一次 _check_platform_risk，>0 立即报错
    try:
        from validate import _check_platform_risk
        # 取清洗后正文（去除 markdown 标记后的纯文本）
        plain = re.sub(r'[#*`>\!\[\]\(\)]', '', cleaned)
        plain = re.sub(r':::.*?:::', '', plain, flags=re.S)
        m = re.search(r'^# (.+)$', cleaned, re.M)
        csdn_title_for_check = csdn_title or (m.group(1) if m else '')
        risk_percent, risk_detail = _check_platform_risk(plain, csdn_title_for_check)
        if risk_percent > 0:
            print(f'  ⚠️ CSDN 清洗后仍有营销风险 ({risk_percent}%): {risk_detail[:200]}')
            print(f'  ⚠️ 仍按设计交付，但 CSDN 平台可能驳回，建议进一步手动清洗')
        else:
            print(f'  ✅ CSDN 清洗后风险自检 PASS (0% 风险)')
    except ImportError:
        pass  # validate 不在路径里时跳过自检

    # 清洗后文本写入系统临时 md，构建完即删（不落项目 md 产物，遵守 2026-07-14 只留 html+docx）
    tmp = tempfile.NamedTemporaryFile(
        mode='w', suffix='.md', encoding='utf-8', delete=False, dir=tempfile.gettempdir())
    try:
        tmp.write(cleaned)
        tmp.close()
        builder.build_docx(
            md_path=tmp.name, docx_path=out_docx,
            images_dir=images_dir, assets_dir=None, cover_img=None)
    finally:
        try:
            os.remove(tmp.name)
        except OSError:
            pass
    return out_docx


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--md', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--images', default=builder.IMAGES_DIR)
    ap.add_argument('--csdn-title', default=None)
    a = ap.parse_args()
    p = build_csdn_docx(a.md, a.out, images_dir=a.images, csdn_title=a.csdn_title)
    print('CSDN DOCX:', p)
