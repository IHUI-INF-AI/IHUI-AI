# -*- coding: utf-8 -*-
"""
X（Twitter）信源注册表 —— 公众号工作流取信源之「X 平台」权威清单

为什么需要它：
- 当前取信源主要是对话里临时 WebSearch + aihot，X 只被 site:x.com 顺带命中，
  不是系统性、可审计的信源。本文件把「X 平台所有相关信源」固化成注册表，
  写稿前按表核查，保证官方账号/高信号信源不漏。

X 平台在沙箱的可达性（已实测 2026-07-16）：
- 我的 WebFetch 工具（带浏览器渲染）✅ 能拿到真实推文（已验证 @kimi_moonshot）。
- Python urllib 直连 x.com ❌ 返回 Cloudflare "Just a moment" 挑战页，无真实推文。
- Jina Reader 代理（r.jina.ai/http://x.com/<handle>）❌ 403 Forbidden。
=> 结论：X 真实推文只能经 WebFetch 工具获取，管线内 Python 脚本无法自动抓 X。
   因此「X 核查」是写稿前由 agent 用 WebFetch 执行的强制研究步骤，本注册表保证全覆盖。

用法：
- 写稿前：python lib/x_sources.py "Kimi K3 DeepSeek V4 GLM-5.3 MiniMax M3.1"
  => 打印该主题应核查的 X 账号清单（按优先级/相关度排序）。
- 研究时：对清单里 official=True 的账号逐一 WebFetch https://x.com/<handle>，
  并补一轮 WebSearch "site:x.com <主题关键词>"，把关键事实记入文章。
- 审计：research_x_coverage(topic, checked_handles) 写入 .workbuddy/x_coverage/<date>.json，
  供 full_audit / 复盘核对「是否漏了官方信源」。

字段说明：
- handle: X 账号（不含 @）
- name: 主体名
- cat: 分类（official_domestic / official_intl / media / researchers / aggregators）
- official: 是否官方发布账号（最高优先级，发布潮判定以这些为准）
- priority: 1(最高)~3(一般)
- covers: 覆盖主题关键词，用于 pick_for_topic 匹配
- verified: 该 handle 是否已人工核实存在（未核实的首次使用前需 WebFetch 确认）
"""

import json
import os
from datetime import datetime

# ===================== X 信源注册表 =====================
X_SOURCES = {
    # ---------- 国内官方模型实验室（发布潮核心信源） ----------
    'official_domestic': [
        {'handle': 'kimi_moonshot', 'name': 'Kimi / 月之暗面', 'official': True, 'priority': 1,
         'covers': ['kimi', '月之暗面', 'moonshot', 'k2', 'k3'], 'verified': True},
        {'handle': 'kimidevs', 'name': 'Kimi 开发者', 'official': True, 'priority': 2,
         'covers': ['kimi', 'moonshot', 'api', 'k2', 'k3'], 'verified': True},
        {'handle': 'deepseek_ai', 'name': 'DeepSeek', 'official': True, 'priority': 1,
         'covers': ['deepseek', 'v4', 'deepseek-v4', 'r2'], 'verified': True},
        {'handle': 'ZhipuAI', 'name': '智谱 AI（GLM 系列）', 'official': True, 'priority': 1,
         'covers': ['glm', '智谱', 'zhipu', 'glm-5', 'glm-5.3', 'chatglm'], 'verified': True},
        {'handle': 'MiniMax_AI', 'name': 'MiniMax', 'official': True, 'priority': 1,
         'covers': ['minimax', 'm3', 'm3.1', 'abab'], 'verified': True},
        {'handle': 'Alibaba_Qwen', 'name': '通义千问 Qwen（阿里）', 'official': True, 'priority': 2,
         'covers': ['qwen', '通义', '阿里', '千问'], 'verified': True},
        {'handle': 'stepfun_ai', 'name': '阶跃星辰 Step', 'official': True, 'priority': 2,
         'covers': ['阶跃', 'step', 'stepfun'], 'verified': True},
        {'handle': '01AI', 'name': '零一万物 Yi', 'official': True, 'priority': 2,
         'covers': ['零一', 'yi', '01ai', '万知'], 'verified': True},
        {'handle': 'ModelBestAI', 'name': '面壁智能 MiniCPM', 'official': True, 'priority': 2,
         'covers': ['面壁', 'minicpm', 'modelbest', 'cpm'], 'verified': True},
        {'handle': 'ByteDanceSeed', 'name': '字节 Seed（豆包底层）', 'official': True, 'priority': 2,
         'covers': ['字节', '豆包', 'seed', 'doubao', 'bytedance'], 'verified': True},
        {'handle': 'Baichuan_AI', 'name': '百川智能', 'official': True, 'priority': 3,
         'covers': ['百川', 'baichuan'], 'verified': False},
        {'handle': 'TencentHunyuan', 'name': '腾讯混元', 'official': True, 'priority': 3,
         'covers': ['腾讯', '混元', 'hunyuan'], 'verified': False},
    ],
    # ---------- 国际官方模型实验室 ----------
    'official_intl': [
        {'handle': 'OpenAI', 'name': 'OpenAI', 'official': True, 'priority': 1,
         'covers': ['openai', 'gpt', 'chatgpt', 'o1', 'o3', 'o4'], 'verified': True},
        {'handle': 'AnthropicAI', 'name': 'Anthropic', 'official': True, 'priority': 1,
         'covers': ['anthropic', 'claude', 'opus', 'sonnet', 'haiku'], 'verified': True},
        {'handle': 'GoogleDeepMind', 'name': 'Google DeepMind', 'official': True, 'priority': 1,
         'covers': ['gemini', 'deepmind', 'google', 'gemma'], 'verified': True},
        {'handle': 'AIatMeta', 'name': 'Meta AI（原 @MetaAI 已停用，官方宣布迁此）', 'official': True, 'priority': 1,
         'covers': ['meta', 'llama', 'fair'], 'verified': True},
        {'handle': 'xai', 'name': 'xAI（Grok）', 'official': True, 'priority': 2,
         'covers': ['grok', 'xai', 'musk'], 'verified': True},
        {'handle': 'MistralAI', 'name': 'Mistral AI', 'official': True, 'priority': 2,
         'covers': ['mistral', 'mixtral', 'magistral'], 'verified': True},
        {'handle': 'Cohere', 'name': 'Cohere', 'official': True, 'priority': 2,
         'covers': ['cohere', 'command'], 'verified': True},
        {'handle': 'huggingface', 'name': 'Hugging Face', 'official': True, 'priority': 2,
         'covers': ['huggingface', 'hf', '开源权重', '模型库'], 'verified': True},
        {'handle': 'NVIDIAAI', 'name': 'NVIDIA', 'official': True, 'priority': 2,
         'covers': ['nvidia', 'gpu', 'cuda', '芯片'], 'verified': True},
    ],
    # ---------- AI 新闻 / 媒体 ----------
    'media': [
        {'handle': 'TheDecoder', 'name': 'The Decoder', 'official': False, 'priority': 2,
         'covers': ['news', '发布', '模型', 'ai news'], 'verified': False},  # 抓取返回"hasn't posted"疑似弃号，首次用前须核实正确 handle
        {'handle': 'TechCrunch', 'name': 'TechCrunch', 'official': False, 'priority': 2,
         'covers': ['news', '发布', '融资', 'ai'], 'verified': True},
        {'handle': 'arstechnica', 'name': 'Ars Technica', 'official': False, 'priority': 3,
         'covers': ['news', '技术', 'ai'], 'verified': True},
        {'handle': 'VentureBeat', 'name': 'VentureBeat', 'official': False, 'priority': 3,
         'covers': ['news', '企业', 'ai'], 'verified': True},
        {'handle': 'TheRundownAI', 'name': 'The Rundown AI', 'official': False, 'priority': 2,
         'covers': ['daily', 'news', '简报'], 'verified': True},
        {'handle': 'ImportAI_news', 'name': 'Import AI', 'official': False, 'priority': 3,
         'covers': ['research', '周报', '论文'], 'verified': True},
        {'handle': 'MIT_TechReview', 'name': 'MIT Technology Review', 'official': False, 'priority': 3,
         'covers': ['news', '研究', '政策'], 'verified': True},
    ],
    # ---------- 研究者 / 工程 / 高信号意见领袖 ----------
    'researchers': [
        {'handle': 'ylecun', 'name': 'Yann LeCun', 'official': False, 'priority': 2,
         'covers': ['research', 'llm', '观点', 'meta'], 'verified': True},
        {'handle': 'karpathy', 'name': 'Andrej Karpathy', 'official': False, 'priority': 2,
         'covers': ['research', 'code', 'llm', '教程'], 'verified': True},
        {'handle': 'EMostaque', 'name': 'Emad Mostaque', 'official': False, 'priority': 3,
         'covers': ['观点', '开源', '政策'], 'verified': True},
        {'handle': 'bindureddy', 'name': 'Bindu Reddy', 'official': False, 'priority': 3,
         'covers': ['发布', '模型', '观点'], 'verified': True},
        {'handle': 'omarsar0', 'name': 'Elvis Saravia', 'official': False, 'priority': 3,
         'covers': ['research', '教程', 'llm'], 'verified': True},
        {'handle': '_akhaliq', 'name': 'Akhaliq', 'official': False, 'priority': 3,
         'covers': ['research', 'demo', '模型'], 'verified': True},
        {'handle': 'swyx', 'name': 'swyx (Latent Space)', 'official': False, 'priority': 3,
         'covers': ['news', '播客', '开发者'], 'verified': True},
        {'handle': 'goodfellow_ian', 'name': 'Ian Goodfellow', 'official': False, 'priority': 3,
         'covers': ['research', 'gan', '安全'], 'verified': True},
        {'handle': 'AndrewYNg', 'name': 'Andrew Ng', 'official': False, 'priority': 3,
         'covers': ['观点', '教育', 'ai'], 'verified': True},
        {'handle': 'demishassab', 'name': 'Demis Hassabis', 'official': False, 'priority': 3,
         'covers': ['deepmind', 'research', '观点'], 'verified': True},
        {'handle': 'nearcyan', 'name': 'near (爆料/逆向高信号)', 'official': False, 'priority': 2,
         'covers': ['爆料', '泄露', '发布前瞻', '逆向'], 'verified': True},
    ],
    # ---------- 聚合 / 泄露 / 论文前瞻 ----------
    'aggregators': [
        {'handle': 'lmsysorg', 'name': 'LMSYS', 'official': False, 'priority': 2,
         'covers': ['榜单', 'arena', '评测', 'llm'], 'verified': True},
        {'handle': 'vitrupo', 'name': 'vitrupo (每日 AI 论文)', 'official': False, 'priority': 3,
         'covers': ['论文', 'research', 'daily'], 'verified': True},
        {'handle': '_philschmid', 'name': 'Phil Schmid', 'official': False, 'priority': 3,
         'covers': ['教程', 'hf', '部署'], 'verified': True},
        {'handle': 'smol_ai', 'name': 'smol.ai (swyx lab)', 'official': False, 'priority': 3,
         'covers': ['开发者', '工具', 'news'], 'verified': True},
    ],
}

CAT_LABELS = {
    'official_domestic': '国内官方实验室',
    'official_intl': '国际官方实验室',
    'media': 'AI 新闻/媒体',
    'researchers': '研究者/工程/意见领袖',
    'aggregators': '聚合/泄露/论文前瞻',
}


# ===================== 查询辅助 =====================
def all_handles():
    out = []
    for cat, items in X_SOURCES.items():
        for it in items:
            out.append(it['handle'])
    return out


def pick_for_topic(keywords, limit=None):
    """返回与主题相关的 X 账号（官方+高优先级优先）。

    keywords: 空格分隔的主题词（如 "Kimi K3 DeepSeek V4"）
    limit: 截断数量；None = 不截断（全量输出）
    """
    kw = [k.strip().lower() for k in keywords.replace('，', ' ').split() if k.strip()]
    scored = []
    for cat, items in X_SOURCES.items():
        for it in items:
            it2 = dict(it)
            it2['cat'] = cat
            score = 0
            hay = ' '.join(it['covers']).lower() + ' ' + it['name'].lower() + ' ' + it['handle'].lower()
            for k in kw:
                if k and k in hay:
                    score += 3
            if it.get('official'):
                score += 2
            score += (4 - it.get('priority', 3))  # priority1 加 3，priority3 加 1
            if score > 0:
                scored.append((score, it2))
    scored.sort(key=lambda x: (-x[0], x[1].get('priority', 3), x[1]['handle']))
    if limit:
        scored = scored[:limit]
    return [it for _, it in scored]


def full_checklist():
    """返回注册表【全量】信源清单（按分类+优先级，不依赖主题打分）。
    写稿前 X 核查基准：官方账号【发布源】必拉；媒体/研究者/聚合按优先级全扫。"""
    total = sum(len(v) for v in X_SOURCES.values())
    lines = [f'# X 平台信源【全量】核查清单（共 {total} 个）', '',
             '> 官方账号【发布源】必拉；媒体/研究者/聚合按优先级全扫（或至少覆盖与主题相关者）。',
             '> 核查方式：WebFetch https://x.com/<handle> 取最新推文 + WebSearch "site:x.com <关键词>"。', '']
    for cat in ['official_domestic', 'official_intl', 'media', 'researchers', 'aggregators']:
        items = sorted(X_SOURCES[cat], key=lambda x: (x.get('priority', 3), x['handle']))
        lines.append(f'## {CAT_LABELS[cat]}（{len(items)}）')
        for it in items:
            flag = '【官方·发布源】' if it.get('official') else ''
            vflag = '' if it.get('verified') else ' ⚠️未核实handle'
            lines.append(f'- [ ] @{it["handle"]} — {it["name"]} {flag}{vflag}')
        lines.append('')
    return '\n'.join(lines)


def checklist_for_topic(keywords, limit=None):
    """生成写稿前应核查的 X 账号 Markdown 清单（主题聚焦，默认全量不截断）。"""
    picks = pick_for_topic(keywords, limit=limit)
    lines = [f'# X 平台信源核查清单（主题：{keywords}）', '',
             '> 用 WebFetch 逐一打开 https://x.com/<handle> 取最新推文；',
             '> 并补一轮 WebSearch "site:x.com <主题关键词>"。', '']
    by_cat = {}
    for it in picks:
        by_cat.setdefault(it['cat'], []).append(it)
    for cat in ['official_domestic', 'official_intl', 'media', 'researchers', 'aggregators']:
        if cat not in by_cat:
            continue
        lines.append(f'## {CAT_LABELS[cat]}')
        for it in by_cat[cat]:
            flag = '【官方·发布源】' if it.get('official') else ''
            vflag = '' if it.get('verified') else ' ⚠️未核实handle'
            lines.append(f'- [ ] @{it["handle"]} — {it["name"]} {flag}{vflag}')
        lines.append('')
    return '\n'.join(lines)


def coverage_dir():
    d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     '.workbuddy', 'x_coverage')
    os.makedirs(d, exist_ok=True)
    return d


def log_coverage(topic, checked_handles, notes=''):
    """记录本次 X 信源核查覆盖，供审计/复盘。"""
    date = datetime.now().strftime('%Y-%m-%d')
    path = os.path.join(coverage_dir(), f'{date}.json')
    rec = {
        'topic': topic,
        'checked': checked_handles,
        'checked_count': len(checked_handles),
        'notes': notes,
        'ts': datetime.now().isoformat(timespec='seconds'),
    }
    # 同主题追加，不覆盖
    data = []
    if os.path.exists(path):
        try:
            data = json.load(open(path, encoding='utf-8'))
        except Exception:
            data = []
    if not isinstance(data, list):
        data = []
    data.append(rec)
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return path


# ===================== CLI =====================
if __name__ == '__main__':
    import sys
    args = sys.argv[1:]
    if '--full' in args:
        print(full_checklist())
    else:
        topic = args[0] if args else '大模型 发布'
        print(checklist_for_topic(topic))
