# -*- coding: utf-8 -*-
"""
口播稿热点选题池生成器（全网版）
================================

信源（与公众号工作流共用 all_sources.py，保证信源一致）：
  - aihot.virxact.com       自动拉近7天精选（urllib + UA）
  - Hacker News API          自动拉 top + AI 关键词过滤（urllib）
  - arXiv API                自动拉 cs.AI/cs.CL/cs.CV 最新论文（urllib）
  - X 官方 / 国内官方 / 媒体 / 中文热榜 / 视频平台
                            Python 直连多被 Cloudflare/登录墙挡，由 agent 用 WebFetch 抓
                            （见脚本打印的「核查清单」）

用法：
  python topic_pool.py                 # 全网拉取 + 打印各平台核查清单
  python topic_pool.py --take 60      # aihot 条数
  python topic_pool.py --date 2026-07-16
  python topic_pool.py --no-api       # 跳过自动拉取，只打印核查清单
  python all_sources.py "Kimi"        # 主题聚焦核查清单（来自 all_sources）

输出：选题池 markdown 到 stdout（可重定向到文件）。
"""
import sys, os, json, urllib.request, urllib.parse, datetime, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from all_sources import (ALL_SOURCES, PLATFORM_LABELS, by_platform,
                         priority1_official, api_sources, webfetch_sources)

AIHOT_BASE = "https://aihot.virxact.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 aihot-skill/0.2.0")

AI_KW = re.compile(r'\b(ai|llm|gpt|chatgpt|openai|anthropic|claude|gemini|google|deepmind|'
                   r'deepseek|qwen|kimi|minimax|meta|llama|mistral|model|agent|diffusion|'
                   r'neural|transformer|rag|fine-tun|multimodal|embedding)\b', re.I)


def _get(url, timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'ignore')


# ── aihot ────────────────────────────────────────────────────────
def fetch_aihot(take=60):
    url = f"{AIHOT_BASE}/api/public/items?mode=selected&take={take}"
    data = json.loads(_get(url))
    return data.get('items', [])


# ── Hacker News ──────────────────────────────────────────────────
def fetch_hn(limit=25):
    try:
        ids = json.loads(_get('https://hacker-news.firebaseio.com/v0/topstories.json'))[:100]
    except Exception:
        return []
    out = []
    for iid in ids:
        try:
            it = json.loads(_get(f'https://hacker-news.firebaseio.com/v0/item/{iid}.json'))
        except Exception:
            continue
        if not it or 'title' not in it:
            continue
        if AI_KW.search(it.get('title', '')):
            out.append(it)
        if len(out) >= limit:
            break
    return out


# ── arXiv ────────────────────────────────────────────────────────
def fetch_arxiv(cats=('cs.AI', 'cs.CL', 'cs.CV'), per=10):
    out = []
    for c in cats:
        url = ('http://export.arxiv.org/api/query?search_query=cat:%s'
               '&sortBy=submittedDate&sortOrder=descending&max_results=%d' % (c, per))
        try:
            xml = _get(url, timeout=25)
        except Exception:
            continue
        for m in re.finditer(r'<entry>(.*?)</entry>', xml, re.S):
            e = m.group(1)
            title = re.search(r'<title>(.*?)</title>', e, re.S)
            published = re.search(r'<published>(.*?)</published>', e, re.S)
            if title:
                out.append({
                    'title': re.sub(r'\s+', ' ', title.group(1)).strip(),
                    'published': published.group(1)[:10] if published else '',
                    'cat': c,
                })
    return out


def main():
    take = 60
    if '--take' in sys.argv:
        take = int(sys.argv[sys.argv.index('--take') + 1])
    date = datetime.date.today().strftime('%Y-%m-%d')
    if '--date' in sys.argv:
        date = sys.argv[sys.argv.index('--date') + 1]
    no_api = '--no-api' in sys.argv

    L = [f'# 口播稿热点选题池 · 全网版 · {date}', '',
         '> 信源：aihot(自动) + Hacker News(自动) + arXiv(自动) + X官方/国内官方/媒体/中文热榜/视频平台(WebFetch核查)',
         '> 信源注册表与公众号共用 `all_sources.py`，两边一致。',
         '> 写作以本池真实热点为准，不写未核实型号。', '']

    # ── 自动拉取 ──
    if not no_api:
        try:
            aihot = fetch_aihot(take)
        except Exception as e:
            aihot = []
            sys.stderr.write(f'[warn] aihot 拉取失败：{e}\n')
        try:
            hn = fetch_hn(25)
        except Exception:
            hn = []
        try:
            arx = fetch_arxiv()
        except Exception:
            arx = []

        L.append(f'## 一、aihot 近7天精选（{len(aihot)} 条·自动拉取）')
        for i, it in enumerate(aihot, 1):
            L.append(f"{i}. **{it.get('title')}** — {it.get('source')}")
            if it.get('summary'):
                L.append(f"   {it['summary'][:80]}")
        L.append('')

        L.append(f'## 二、Hacker News AI 热点（{len(hn)} 条·自动拉取）')
        for it in hn:
            _url = it.get('url') or ('https://news.ycombinator.com/item?id=%s' % it.get('id'))
            L.append(f"- **{it.get('title')}** — 👍{it.get('score',0)} [{_url}]")
        L.append('')

        L.append(f'## 三、arXiv 最新论文（{len(arx)} 篇·自动拉取）')
        for p in arx:
            L.append(f"- **{p['title']}** — {p['cat']} · {p['published']}")
        L.append('')

    # ── WebFetch / 手动核查清单 ──
    L.append('## 四、其余平台核查清单（agent 用 WebFetch / 人工补全）')
    L.append('> X 官方与国内官方为一手发布信源，发布潮必查；媒体/热榜/视频用于交叉验证与角度扩展。')
    L.append('')
    pri1 = priority1_official()
    L.append(f'### ★ 发布潮核心（official & priority=1，共 {len(pri1)} 个·必查）')
    for s in pri1:
        L.append(f"- [ ] @{s.get('handle','')} — {s['name']} — {s['url']}")
    L.append('')

    for p in ['media_intl', 'media_cn', 'community', 'cn_hot', 'video']:
        lst = by_platform(p)
        if not lst:
            continue
        L.append(f'### {PLATFORM_LABELS[p]}（{len(lst)}）')
        for s in lst:
            L.append(f"- [ ] {s['name']} — {s['url']} （fetch={s.get('fetch')}）")
        L.append('')

    L.append('---')
    L.append('> 自动拉取项即为今日真实热点；核查清单项由 agent 选题时用 WebFetch 补全后并入选题。')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
