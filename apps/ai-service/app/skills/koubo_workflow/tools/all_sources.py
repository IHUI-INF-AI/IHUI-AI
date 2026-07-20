# -*- coding: utf-8 -*-
"""
全网 AI 热点信源注册表（口播稿 × 公众号 共用同一份，保证信源一致）
============================================================

本文件是「热点选题池」的唯一信源权威。口播稿与公众号各自物理持有一份副本
（口播稿/koubo/工具脚本/all_sources.py 与 公众号/wechat-article-system/lib/all_sources.py），
信源条目完全相同，任何一侧更新都需同步另一侧。

信源分类（platform）：
  x_official     X(Twitter) 官方账号，一手发布，发布潮核心信源
  cn_official    国内大模型官方（官网/公众号），一手发布
  media_intl     国际科技媒体 RSS / 栏目
  media_cn       国内科技媒体 RSS / 栏目
  community      开发者社区（Hacker News / Reddit / CSDN / 掘金）
  paper          论文预印本（arXiv / Papers with Code）
  cn_hot         中文热榜（微博 / 知乎 / 百度 / 微信搜一搜）
  video          视频平台（抖音 / 视频号 / B站 / YouTube）
  genai          生成式厂商（图像/视频/音乐：Midjourney / Runway / FLUX / Suno / Luma）
  aggregator     聚合 / 榜单 / 趋势（aihot / HF Trending / GitHub Trending / LMArena 等，最热信号）

每个信源字段：
  name        显示名
  platform    上述分类
  handle      句柄 / 路径（X 用 @handle，其他用路径或子站点）
  url         可直接打开的主页或 API
  official    True=官方一手信源；False=媒体/社区/聚合
  priority    1=发布潮核心(必查) 2=重要 3=补充
  fetch       'api'    = 脚本可 urllib 直连自动拉取
              'webfetch'= 由 agent 用 WebFetch 工具抓（Python 直连被 Cloudflare 挡）
              'manual' = 需人工到平台看/搜（无稳定 API）

注意：X 官方条目复用公众号 x_sources.py 的 X_SOURCES，保证两边 X 信源逐条一致。
"""

# ── 复用公众号同款 X 信源（保证一致）──────────────────────────────
try:
    from x_sources import X_SOURCES as _X_SOURCES
except Exception:
    _X_SOURCES = []


def _x_entries():
    """把公众号 x_sources.X_SOURCES 转成本注册表统一结构。"""
    out = []
    for cat, lst in (_X_SOURCES or {}).items():
        for s in lst:
            out.append({
                'name': s.get('name', s.get('handle', '')),
                'platform': 'x_official',
                'handle': s.get('handle', ''),
                'url': f"https://x.com/{s.get('handle','').lstrip('@')}",
                'official': bool(s.get('official')),
                'priority': s.get('priority', 2),
                'fetch': 'webfetch',
                'note': s.get('note', ''),
            })
    return out


# ── 国内大模型官方（官网 / 公众号 / 博客）─────────────────────────
CN_OFFICIAL = [
    {'name': '智谱 AI', 'platform': 'cn_official', 'handle': 'zhipuai',
     'url': 'https://www.zhipuai.cn/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': 'GLM 系列，发布潮核心'},
    {'name': '月之暗面 Kimi', 'platform': 'cn_official', 'handle': 'kimi_moonshot',
     'url': 'https://kimi.moonshot.cn/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': 'K 系列长文本，发布潮核心'},
    {'name': 'DeepSeek', 'platform': 'cn_official', 'handle': 'deepseek_ai',
     'url': 'https://www.deepseek.com/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': 'V 系列，发布潮核心'},
    {'name': 'MiniMax', 'platform': 'cn_official', 'handle': 'MiniMax_AI',
     'url': 'https://www.minimax.io/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': 'M 系列，发布潮核心'},
    {'name': '阿里 通义千问 Qwen', 'platform': 'cn_official', 'handle': 'qwenlm',
     'url': 'https://qwen.ai/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': 'Qwen 开源系列'},
    {'name': '百度 文心一言', 'platform': 'cn_official', 'handle': 'wenxin_yiyan',
     'url': 'https://yiyan.baidu.com/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'ERNIE 系列'},
    {'name': '腾讯 混元', 'platform': 'cn_official', 'handle': 'TencentHunyuan',
     'url': 'https://hunyuan.tencent.com/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': '混元系列，发布潮核心'},
    {'name': '字节 豆包', 'platform': 'cn_official', 'handle': 'doubao',
     'url': 'https://www.doubao.com/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '豆包 / Coze'},
    {'name': '阶跃星辰 StepFun', 'platform': 'cn_official', 'handle': 'StepFunAI',
     'url': 'https://www.stepfun.com/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'Step 系列'},
    {'name': '百川智能', 'platform': 'cn_official', 'handle': 'baichuanai',
     'url': 'https://www.baichuan-ai.com/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': 'Baichuan 系列'},
    {'name': '讯飞 星火', 'platform': 'cn_official', 'handle': 'iFLYTEK',
     'url': 'https://xinghuo.xfyun.cn/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': 'Spark 系列'},
    # 2026-07-16 补齐：今日真实热点出现但原表遗漏的国内一手厂商
    {'name': '商汤 SenseTime（日日新 SenseNova）', 'platform': 'cn_official', 'handle': 'SenseTime_AI',
     'url': 'https://www.sensetime.com/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'SenseNova 系列，多模态视觉强'},
    {'name': '快手 可灵 Kling', 'platform': 'cn_official', 'handle': 'Kling_ai',
     'url': 'https://klingai.kuaishou.com/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': '视频生成头部，AI视频大流量话题'},
    {'name': '昆仑万维 天工 SkyWork', 'platform': 'cn_official', 'handle': 'Kunlun_Tiangong',
     'url': 'https://www.tiangong.cn/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '天工大模型 / AI 短剧'},
    {'name': '生数科技 Vidu', 'platform': 'cn_official', 'handle': 'ShengshuAI',
     'url': 'https://www.vidu.studio/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '视频生成'},
    {'name': '上海AI实验室 书生 InternLM', 'platform': 'cn_official', 'handle': 'opengvlab',
     'url': 'https://internlm.intern-ai.org.cn/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '书生·浦语 / InternVL 开源'},
    {'name': '智源 BAAI（悟道/Emu）', 'platform': 'cn_official', 'handle': 'BAAIBeijing',
     'url': 'https://www.baai.ac.cn/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '悟道 / Emu 多模态'},
    {'name': '面壁智能 MiniCPM', 'platform': 'cn_official', 'handle': 'ModelBestAI',
     'url': 'https://modelbest.cn/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '端侧模型，与 X 侧 @ModelBestAI 呼应'},
    {'name': '零一万物 Yi', 'platform': 'cn_official', 'handle': '01AI',
     'url': 'https://www.lingyiwanwu.com/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'Yi 系列，与 X 侧 @01AI 呼应'},
    # 2026-07-16 二次补齐：国内一手厂商仍有遗漏（推理平台 / 机器人）
    {'name': '硅基流动 SiliconFlow', 'platform': 'cn_official', 'handle': 'siliconflow',
     'url': 'https://siliconflow.cn/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '开源模型推理/API 平台，模型上线风向'},
    {'name': '宇树科技 Unitree', 'platform': 'cn_official', 'handle': 'unitree',
     'url': 'https://www.unitree.com/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '四足/人形机器人头部，AI+机器人高热话题'},
    {'name': '智元机器人 Agibot', 'platform': 'cn_official', 'handle': 'agibot',
     'url': 'https://www.agibot.com/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '远征人形机器人，AI+机器人话题'},
]

# ── 国际科技媒体（RSS / 栏目）────────────────────────────────────
MEDIA_INTL = [
    {'name': 'The Verge AI', 'platform': 'media_intl', 'handle': 'ai',
     'url': 'https://www.theverge.com/ai-artificial-intelligence', 'official': False, 'priority': 2,
     'fetch': 'webfetch', 'note': '大众科技风向'},
    {'name': 'TechCrunch AI', 'platform': 'media_intl', 'handle': 'category/artificial-intelligence',
     'url': 'https://techcrunch.com/category/artificial-intelligence/', 'official': False, 'priority': 2,
     'fetch': 'webfetch', 'note': '创投/产品'},
    {'name': 'Ars Technica AI', 'platform': 'media_intl', 'handle': 'ai',
     'url': 'https://arstechnica.com/ai/', 'official': False, 'priority': 3, 'fetch': 'webfetch', 'note': ''},
    {'name': 'VentureBeat AI', 'platform': 'media_intl', 'handle': 'ai',
     'url': 'https://venturebeat.com/category/ai/', 'official': False, 'priority': 3, 'fetch': 'webfetch', 'note': ''},
    {'name': 'The Decoder', 'platform': 'media_intl', 'handle': '',
     'url': 'https://the-decoder.com/', 'official': False, 'priority': 3, 'fetch': 'webfetch', 'note': '欧洲视角'},
    {'name': 'OpenAI Blog', 'platform': 'media_intl', 'handle': 'blog',
     'url': 'https://openai.com/news/', 'official': True, 'priority': 1, 'fetch': 'webfetch', 'note': '一手'},
    {'name': 'Anthropic News', 'platform': 'media_intl', 'handle': 'news',
     'url': 'https://www.anthropic.com/news', 'official': True, 'priority': 1, 'fetch': 'webfetch', 'note': '一手'},
    {'name': 'Google DeepMind Blog', 'platform': 'media_intl', 'handle': 'blog',
     'url': 'https://deepmind.google/blog/', 'official': True, 'priority': 1, 'fetch': 'webfetch', 'note': '一手'},
    {'name': 'Meta AI Blog', 'platform': 'media_intl', 'handle': 'blog',
     'url': 'https://ai.meta.com/blog/', 'official': True, 'priority': 2, 'fetch': 'webfetch', 'note': '一手'},
    # 2026-07-16 补齐：国际一手厂商官网（今日 Grok/Inkling 顶流，原表漏）
    {'name': 'xAI News（Grok）', 'platform': 'media_intl', 'handle': 'news',
     'url': 'https://x.ai/news', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': '一手，Grok 系列/CLI/Build'},
    {'name': 'Thinking Machines', 'platform': 'media_intl', 'handle': 'news',
     'url': 'https://thinkingmachines.ai/', 'official': True, 'priority': 1, 'fetch': 'webfetch',
     'note': '一手，Mira Murati 团队（Inkling 等开放权重）'},
    {'name': 'Microsoft AI Blog', 'platform': 'media_intl', 'handle': 'ai',
     'url': 'https://blogs.microsoft.com/ai/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '一手，Copilot / MAI 系列'},
    {'name': 'Mistral AI News', 'platform': 'media_intl', 'handle': 'news',
     'url': 'https://mistral.ai/news/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '一手，与 X 侧 @MistralAI 呼应'},
    {'name': 'Perplexity Blog', 'platform': 'media_intl', 'handle': 'hub',
     'url': 'https://www.perplexity.ai/hub', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '一手，AI 搜索'},
    {'name': 'Apple ML Research', 'platform': 'media_intl', 'handle': '',
     'url': 'https://machinelearning.apple.com/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '一手，Apple Intelligence 底层'},
    # 2026-07-16 二次补齐：国际一手官网仍漏（X 侧有但无官网条目）
    {'name': 'NVIDIA AI Blog', 'platform': 'media_intl', 'handle': 'blog',
     'url': 'https://developer.nvidia.com/blog/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': '一手，与 X 侧 @NVIDIAAI 呼应；GPU/推理/具身'},
    {'name': 'Cohere Blog', 'platform': 'media_intl', 'handle': 'blog',
     'url': 'https://cohere.com/blog', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '一手，与 X 侧 @Cohere 呼应；企业/Command 系列'},
    {'name': 'Allen AI（AI2）', 'platform': 'media_intl', 'handle': 'ai2',
     'url': 'https://allenai.org/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '一手，OLMo 开放权重系列'},
    {'name': 'Amazon Nova / AWS AI', 'platform': 'media_intl', 'handle': 'ai',
     'url': 'https://aws.amazon.com/ai/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '一手，Nova 多模态系列'},
    {'name': 'IBM Granite / watsonx', 'platform': 'media_intl', 'handle': 'granite',
     'url': 'https://www.ibm.com/products/watsonx-ai', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': '一手，企业级开放权重'},
]

# ── 国内科技媒体（RSS / 栏目）────────────────────────────────────
MEDIA_CN = [
    {'name': '机器之心', 'platform': 'media_cn', 'handle': 'jiqizhixin',
     'url': 'https://www.jiqizhixin.com/', 'official': False, 'priority': 1, 'fetch': 'webfetch',
     'note': '国内最权威 AI 媒体'},
    {'name': '量子位', 'platform': 'media_cn', 'handle': 'QbitAI',
     'url': 'https://www.qbitai.com/', 'official': False, 'priority': 1, 'fetch': 'webfetch', 'note': '快讯多'},
    {'name': '智东西', 'platform': 'media_cn', 'handle': 'zhidx',
     'url': 'https://www.zhidx.com/', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': '2026-07-16 修正：原误标"新智元"，zhidx.com 实为智东西域名'},
    {'name': '新智元', 'platform': 'media_cn', 'handle': 'AI_era',
     'url': 'https://mp.weixin.qq.com/', 'official': False, 'priority': 2, 'fetch': 'manual',
     'note': '无独立门户，主发公众号"新智元"，需微信搜一搜'},
    {'name': '36氪', 'platform': 'media_cn', 'handle': 'ai',
     'url': 'https://36kr.com/search/articles/人工智能', 'official': False, 'priority': 2,
     'fetch': 'webfetch', 'note': '创投/商业化'},
    {'name': '极客公园', 'platform': 'media_cn', 'handle': 'geekpark',
     'url': 'https://www.geekpark.net/', 'official': False, 'priority': 3, 'fetch': 'webfetch', 'note': ''},
    {'name': '爱范儿', 'platform': 'media_cn', 'handle': 'ifanr',
     'url': 'https://www.ifanr.com/', 'official': False, 'priority': 3, 'fetch': 'webfetch', 'note': ''},
]

# ── 开发者社区 ───────────────────────────────────────────────────
COMMUNITY = [
    {'name': 'Hacker News', 'platform': 'community', 'handle': 'top',
     'url': 'https://news.ycombinator.com/', 'official': False, 'priority': 1, 'fetch': 'api',
     'note': 'HN API 可自动拉 topstories + AI 关键词过滤'},
    {'name': 'Reddit r/LocalLLaMA', 'platform': 'community', 'handle': 'r/LocalLLaMA',
     'url': 'https://www.reddit.com/r/LocalLLaMA/', 'official': False, 'priority': 1, 'fetch': 'webfetch',
     'note': '开源/本地部署风向'},
    {'name': 'Reddit r/artificial', 'platform': 'community', 'handle': 'r/artificial',
     'url': 'https://www.reddit.com/r/artificial/', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': '大众 AI 讨论'},
    {'name': 'Reddit r/MachineLearning', 'platform': 'community', 'handle': 'r/MachineLearning',
     'url': 'https://www.reddit.com/r/MachineLearning/', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': '论文/研究'},
    {'name': 'Reddit r/singularity', 'platform': 'community', 'handle': 'r/singularity',
     'url': 'https://www.reddit.com/r/singularity/', 'official': False, 'priority': 3, 'fetch': 'webfetch',
     'note': '趋势/奇点讨论'},
    # 2026-07-16 用户指定补：中文开发者社区（技术实操/大模型实战风向）
    {'name': 'CSDN（AI）', 'platform': 'community', 'handle': 'ai',
     'url': 'https://www.csdn.net/category/ai', 'official': False, 'priority': 3, 'fetch': 'webfetch',
     'note': '中文最大开发者社区，AI 技术实操/教程风向'},
    {'name': '掘金（AI）', 'platform': 'community', 'handle': 'ai',
     'url': 'https://juejin.cn/', 'official': False, 'priority': 3, 'fetch': 'webfetch',
     'note': '中文开发者社区，前端/大模型实战'},
]

# ── 论文预印本 ───────────────────────────────────────────────────
PAPER = [
    {'name': 'arXiv cs.AI', 'platform': 'paper', 'handle': 'cs.AI',
     'url': 'http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&max_results=30',
     'official': False, 'priority': 2, 'fetch': 'api', 'note': 'arXiv API 可自动拉最新论文'},
    {'name': 'arXiv cs.CL', 'platform': 'paper', 'handle': 'cs.CL',
     'url': 'http://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&max_results=30',
     'official': False, 'priority': 2, 'fetch': 'api', 'note': 'NLP 方向'},
    {'name': 'arXiv cs.CV', 'platform': 'paper', 'handle': 'cs.CV',
     'url': 'http://export.arxiv.org/api/query?search_query=cat:cs.CV&sortBy=submittedDate&max_results=20',
     'official': False, 'priority': 3, 'fetch': 'api', 'note': '视觉方向'},
    {'name': 'Papers with Code', 'platform': 'paper', 'handle': 'trending',
     'url': 'https://paperswithcode.com/', 'official': False, 'priority': 3, 'fetch': 'webfetch',
     'note': 'SOTA 趋势'},
]

# ── 中文热榜 ─────────────────────────────────────────────────────
CN_HOT = [
    {'name': '微博热搜 (AI)', 'platform': 'cn_hot', 'handle': 'hotsearch',
     'url': 'https://s.weibo.com/top/summary?cate=realtimehot', 'official': False, 'priority': 2,
     'fetch': 'webfetch', 'note': '社会热度风向，搜 AI 相关'},
    {'name': '知乎热榜 (AI)', 'platform': 'cn_hot', 'handle': 'hot',
     'url': 'https://www.zhihu.com/hot', 'official': False, 'priority': 1, 'fetch': 'webfetch',
     'note': '选题验证5步法指定信源，关注>1000 回答>50'},
    {'name': '百度热搜 (AI)', 'platform': 'cn_hot', 'handle': 'hotsearch',
     'url': 'https://top.baidu.com/board?tab=realtime', 'official': False, 'priority': 2,
     'fetch': 'webfetch', 'note': '大众搜索风向'},
    {'name': '微信搜一搜', 'platform': 'cn_hot', 'handle': 'weixin',
     'url': 'https://weixin.qq.com/', 'official': False, 'priority': 1, 'fetch': 'manual',
     'note': '公众号选题验证指定信源，需到微信内搜一搜看热搜词'},
    # 2026-07-16 二次补齐：小红书是中文 AI 内容/工具种草最大阵地
    {'name': '小红书 (AI内容/工具)', 'platform': 'cn_hot', 'handle': 'xiaohongshu',
     'url': 'https://www.xiaohongshu.com/', 'official': False, 'priority': 1, 'fetch': 'manual',
     'note': 'AI 工具种草/大众热度风向，需到 App 内看热搜'},
]

# ── 视频平台（口播可直接观察同赛道）──────────────────────────────
VIDEO = [
    {'name': '抖音 (AI口播同赛道)', 'platform': 'video', 'handle': 'douyin',
     'url': 'https://www.douyin.com/', 'official': False, 'priority': 1, 'fetch': 'manual',
     'note': '搜同类 AI 口播号，看选题/形式/数据（后台数不可见）'},
    {'name': '视频号', 'platform': 'video', 'handle': 'channels',
     'url': 'https://channels.weixin.qq.com/', 'official': False, 'priority': 2, 'fetch': 'manual',
     'note': '同赛道对标'},
    {'name': 'B站 热门 (AI区)', 'platform': 'video', 'handle': 'bilibili',
     'url': 'https://www.bilibili.com/v/popular/science/', 'official': False, 'priority': 2,
     'fetch': 'webfetch', 'note': '长视频/深度解读风向'},
    {'name': 'YouTube Two Minute Papers', 'platform': 'video', 'handle': '@TwoMinutePapers',
     'url': 'https://www.youtube.com/@TwoMinutePapers', 'official': False, 'priority': 3,
     'fetch': 'webfetch', 'note': '海外论文解读'},
    {'name': 'YouTube Yannic Kilcher', 'platform': 'video', 'handle': '@YannicKilcher',
     'url': 'https://www.youtube.com/@YannicKilcher', 'official': False, 'priority': 3,
     'fetch': 'webfetch', 'note': '海外论文精读'},
]

# ── 生成式厂商（图像/视频/音乐 —— AI绘画/AI视频大流量话题）──────────
GENAI = [
    {'name': 'Midjourney', 'platform': 'genai', 'handle': 'midjourney',
     'url': 'https://www.midjourney.com/updates', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'AI 绘画头部'},
    {'name': 'Runway', 'platform': 'genai', 'handle': 'runwayml',
     'url': 'https://runwayml.com/research', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'AI 视频 Gen 系列'},
    {'name': 'Black Forest Labs（FLUX）', 'platform': 'genai', 'handle': 'bfl_ml',
     'url': 'https://blackforestlabs.ai/', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'FLUX 开源图像'},
    {'name': 'Suno', 'platform': 'genai', 'handle': 'suno_ai_',
     'url': 'https://suno.com/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': 'AI 音乐生成'},
    {'name': 'Luma AI', 'platform': 'genai', 'handle': 'LumaLabsAI',
     'url': 'https://lumalabs.ai/', 'official': True, 'priority': 3, 'fetch': 'webfetch',
     'note': 'Dream Machine 视频/3D'},
    # 2026-07-16 二次补齐：图像生成头部 Stability AI
    {'name': 'Stability AI（SD）', 'platform': 'genai', 'handle': 'stabilityai',
     'url': 'https://stability.ai/news', 'official': True, 'priority': 2, 'fetch': 'webfetch',
     'note': 'Stable Diffusion 系列，开源图像生成'},
]

# ── 聚合 / 榜单 / 趋势（最热信号）──────────────────────────────────
AGGREGATOR = [
    {'name': 'aihot.virxact.com', 'platform': 'aggregator', 'handle': 'api',
     'url': 'https://aihot.virxact.com/api/public/items?mode=selected&take=60',
     'official': False, 'priority': 1, 'fetch': 'api', 'note': '中文 AI 资讯聚合，可自动拉近7天精选'},
    # 2026-07-16 补齐：最热榜单/趋势信源（反映真实热度，原表漏）
    {'name': 'Hugging Face Trending Models', 'platform': 'aggregator', 'handle': 'hf_trending',
     'url': 'https://huggingface.co/api/models?sort=trendingScore&limit=30',
     'official': False, 'priority': 1, 'fetch': 'api', 'note': '开源模型热度榜，JSON API 可自动拉'},
    {'name': 'Hugging Face Daily Papers', 'platform': 'aggregator', 'handle': 'hf_papers',
     'url': 'https://huggingface.co/papers', 'official': False, 'priority': 1, 'fetch': 'webfetch',
     'note': '社区热门论文（今日选题池已引用）'},
    {'name': 'GitHub Trending（AI）', 'platform': 'aggregator', 'handle': 'github_trending',
     'url': 'https://github.com/trending?since=daily', 'official': False, 'priority': 1, 'fetch': 'webfetch',
     'note': '开源项目风向'},
    {'name': 'Chatbot Arena / LMArena', 'platform': 'aggregator', 'handle': 'lmarena',
     'url': 'https://lmarena.ai/leaderboard', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': '模型能力民意榜，与 X 侧 @lmsysorg 呼应'},
    {'name': 'Artificial Analysis', 'platform': 'aggregator', 'handle': 'artificialanalysis',
     'url': 'https://artificialanalysis.ai/', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': '权威 benchmark（今日选题池已引用其语音推理榜）'},
    {'name': 'Product Hunt AI', 'platform': 'aggregator', 'handle': 'producthunt',
     'url': 'https://www.producthunt.com/topics/artificial-intelligence', 'official': False, 'priority': 3,
     'fetch': 'webfetch', 'note': 'AI 产品新品热榜'},
    # 2026-07-16 二次补齐：邮件简报/论文日更/中文聚合（最热策展信号）
    {'name': "Ben's Bites", 'platform': 'aggregator', 'handle': 'bensbites',
     'url': 'https://bensbites.com/', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': '海外头部 AI 日更简报，策展信号'},
    {'name': 'TLDR AI', 'platform': 'aggregator', 'handle': 'tldrai',
     'url': 'https://tldr.tech/ai', 'official': False, 'priority': 2, 'fetch': 'webfetch',
     'note': 'AI 日更简报，工程师向'},
    {'name': 'MarkTechPost', 'platform': 'aggregator', 'handle': 'marktechpost',
     'url': 'https://www.marktechpost.com/', 'official': False, 'priority': 3, 'fetch': 'webfetch',
     'note': '每日 AI 论文/模型速递'},
    {'name': 'aibase（中文聚合）', 'platform': 'aggregator', 'handle': 'aibase',
     'url': 'https://www.aibase.com/', 'official': False, 'priority': 3, 'fetch': 'webfetch',
     'note': '中文 AI 资讯聚合'},
    {'name': 'Google Trends（AI）', 'platform': 'aggregator', 'handle': 'google_trends',
     'url': 'https://trends.google.com/trends/explore?q=AI', 'official': False, 'priority': 3,
     'fetch': 'webfetch', 'note': '搜索趋势信号'},
]

# ── 合并全集 ─────────────────────────────────────────────────────
ALL_SOURCES = (_x_entries() + CN_OFFICIAL + MEDIA_INTL + MEDIA_CN + COMMUNITY
               + PAPER + CN_HOT + VIDEO + GENAI + AGGREGATOR)

PLATFORM_LABELS = {
    'x_official': 'X 官方账号（一手）',
    'cn_official': '国内大模型官方',
    'media_intl': '国际科技媒体',
    'media_cn': '国内科技媒体',
    'community': '开发者社区',
    'paper': '论文预印本',
    'cn_hot': '中文热榜',
    'video': '视频平台',
    'genai': '生成式厂商（图/视频/音乐）',
    'aggregator': '聚合 / 榜单 / 趋势',
}


def by_platform(platform=None):
    if platform:
        return [s for s in ALL_SOURCES if s['platform'] == platform]
    return ALL_SOURCES


def priority1_official():
    """发布潮核心：official 且 priority==1。"""
    return [s for s in ALL_SOURCES if s.get('official') and s.get('priority') == 1]


def api_sources():
    """脚本可自动拉取的信源（urllib 直连）。"""
    return [s for s in ALL_SOURCES if s.get('fetch') == 'api']


def webfetch_sources():
    """需 agent 用 WebFetch 抓的信源。"""
    return [s for s in ALL_SOURCES if s.get('fetch') == 'webfetch']


def topic_focus(query, top_n=15):
    """主题聚焦：返回名称/句柄/平台含 query 关键词的信源核查清单。"""
    q = (query or '').lower()
    hits = [s for s in ALL_SOURCES
            if q in s['name'].lower() or q in s.get('handle', '').lower()
            or q in s.get('note', '').lower()]
    # 优先级排序：priority 升序 + official 优先
    hits.sort(key=lambda s: (s.get('priority', 9), 0 if s.get('official') else 1))
    return hits[:top_n]


if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] != '--count':
        q = ' '.join(sys.argv[1:])
        print(f'# 主题聚焦核查清单：{q}')
        for s in topic_focus(q):
            print(f"- [{s['platform']}] @{s.get('handle','')} — {s['name']} "
                  f"(pri={s.get('priority')}, fetch={s.get('fetch')})")
    else:
        print(f'# 全网信源总数：{len(ALL_SOURCES)}')
        for p, lab in PLATFORM_LABELS.items():
            lst = by_platform(p)
            print(f'\n## {lab}（{len(lst)}）')
            for s in lst:
                tag = '★' if (s.get('official') and s.get('priority') == 1) else ''
                print(f"- {tag} @{s.get('handle','')} — {s['name']} "
                      f"(pri={s.get('priority')}, fetch={s.get('fetch')})")
