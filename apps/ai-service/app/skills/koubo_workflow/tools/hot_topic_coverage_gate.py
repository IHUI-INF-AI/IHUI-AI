# -*- coding: utf-8 -*-
"""
hot_topic_coverage_gate.py — 口播稿「热点覆盖自检」门禁 v1.0
2026-07-16 用户强制·彻底杜绝漏抓当日高热热点（尤其大模型发布潮）

═══════════════════════════════════════════════════════════
根因（为什么 0715 漏抓大模型发布潮）：
  1. 选题流程只强制 WebSearch≥3 次，没有「锚定当日最热集群」的强制步骤，
     也没拉 aihot 的 ai-models 模型发布分类，更无「热点覆盖自检」门禁。
     → AI 把 8 篇分散到人群视角（监管/端侧/机器人/编程/就业/月活/估值/企业AI），
        完全漏掉「大模型密集发布」这一当日最热叙事（0715 八篇 0 篇模型发布主题）。
  2. 跨项目混淆：把公众号已覆盖的模型发布误当成口播稿已覆盖，凭模糊记忆判断。
  3. 把「人群多样性」当第一优先，而非「当日热点集群」，导致散开漏爆点。

本门禁（交付前第 5 道硬门禁）做两件事：
  A. 模型发布潮检测：自动拉 aihot `ai-models`（近 7 天精选）+ 精选总览，
     若窗口内模型/产品发布 ≥3 条，判定为「发布潮」。
  B. 覆盖要求（发布潮存在时强制）：
     - 主题覆盖：8 篇中必须提及 ≥2 个不同「模型发布实体」（用正则抽取）。
     - 用户点名：若对话中用户点名了具体模型（--extra-keywords），必须全部出现，
       缺一个即 FAIL（直接对应「用户点名的热点没写」这一投诉）。
 任意一项不达标 → rc=1 阻断交付。

用法：
  python hot_topic_coverage_gate.py Output/0716.txt
  python hot_topic_coverage_gate.py Output/0716.txt \
      --extra-keywords "Kimi K3,DeepSeek V4,GLM-5.3,MiniMax M3.1,Claude Opus 5,Gemini-3.5 Pro"
  python hot_topic_coverage_gate.py Output/0716.txt --ack-offline   # aihot 不可达时显式声明手动确认

退出码：0=通过可交付  1=漏抓热点·阻断  2=参数错误
"""
import os
import re
import sys
import json
import urllib.request
import urllib.error

# ── 项目边界硬门禁（缺省 fail-closed：未声明会话 / 公众号会话均拦截） ──
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # koubo_workflow/
import project_boundary
project_boundary.check_action(tool="hot_topic_coverage_gate.py", paths=sys.argv[1:], cwd=os.getcwd())

# ── 路径 ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
KOUBO_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(KOUBO_ROOT, 'Output')

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 aihot-skill/0.2.0")
AIHOT_BASE = "https://aihot.virxact.com/api/public/items"

# Windows GBK 输出修复
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


# ── 模型发布实体正则（用于从正文/标题抽取「模型发布实体」）──
# 注意：纯 App 品牌（豆包/千问/通义/混元 无版本号）不计入，避免把「月活榜单」误判为发布覆盖。
# 注意：用 ASCII 字符类 [A-Za-z0-9]，绝不用 \w（Python3 unicode 模式下 \w 会匹配中文，
# 导致 "Qwen从54G压到4G" 等被误判为模型发布实体）。DeepSeek 强制 V 前缀，避免
# "DeepSeek1.3亿"(月活) 被误判。纯 App 品牌（豆包/千问/通义/混元 无版本号）不计入。
MODEL_PATTERNS = [
    r'Kimi\s*K?\d+(?:\.\d+)?',
    r'DeepSeek[\s\-]?V\d+(?:\.\d+)?',          # 强制 V 前缀
    r'GLM[\s\-]?\d+(?:\.\d+)?',
    r'MiniMax[\s\-]?M?\d+(?:\.\d+)?',
    r'Claude(?:\s+(?:Opus|Sonnet|Haiku))?\s*\d+(?:\.\d+)?',
    r'Gemini\s*\d+(?:\.\d+)?(?:\s*Pro)?',
    r'GPT[\s\-]?\d+(?:\.\d+)?(?:\s*(?:Pro|Red|Sol|Terra|Luna|mini))?',
    r'Qwen[\s\-]?(?:Audio[\s\-]?\d+(?:\.\d+)?|\d+(?:\.\d+)?)',  # 仅带数字（Qwen-Audio-3.0 / Qwen2.5）
    r'(?:Hunyuan|混元)\s*Hy\d+',
    r'Llama\s*\d+',
    r'Grok\s*\d+(?:\.\d+)?',
    r'(?:ERNIE|文心)\s*\d+',
    r'Inkling',
    r'Bonsai\s*\d+B?',
    r'SenseNova[\s\-]?Vision[\s\-]?\d+B?',
    r'SWE-1\.?\d+',
]
_MODEL_RE = [re.compile(p, re.IGNORECASE) for p in MODEL_PATTERNS]


def _norm(s):
    """归一化：去空格/连字符、转小写，用于实体匹配（兼容「Gemini-3.5 Pro」与「Gemini 3.5 Pro」）。"""
    return re.sub(r'[\s\-]', '', s).lower()


def extract_entities(text):
    """从文本抽取去重后的模型发布实体（归一化集合）。"""
    found = set()
    for rx in _MODEL_RE:
        for m in rx.findall(text):
            found.add(_norm(m))
    return found


def pull_aihot(category=None, since_days=7, take=50):
    """拉 aihot 精选条目；返回 list[dict]。网络失败抛异常。"""
    since = _iso_since(since_days)
    url = f"{AIHOT_BASE}?mode=selected&since={since}&take={take}"
    if category:
        url += f"&category={category}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    return data.get('items', [])


def _iso_since(days):
    """生成 since=now-days 的 ISO8601 UTC。"""
    from datetime import datetime, timedelta, timezone
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def parse_articles(path):
    """解析 MMDD.txt 为 [{title, text}] 列表。以全 ─ 行分隔各篇。"""
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    blocks = re.split(r'\n─{10,}\n', raw)
    articles = []
    for blk in blocks:
        lines = [l for l in blk.split('\n') if l.strip()]
        if not lines:
            continue
        title = lines[0].strip()
        text = '\n'.join(lines)
        articles.append({'title': title, 'text': text})
    return articles


def main():
    if len(sys.argv) < 2:
        print('用法: python hot_topic_coverage_gate.py Output/0716.txt '
              '[--extra-keywords "Kimi K3,..."] [--ack-offline]')
        sys.exit(2)

    # 参数解析
    target = sys.argv[1]
    extra_raw = ''
    ack_offline = False
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--extra-keywords':
            extra_raw = sys.argv[i + 1] if i + 1 < len(sys.argv) else ''
            i += 2
        elif sys.argv[i] == '--ack-offline':
            ack_offline = True
            i += 1
        else:
            i += 1

    # 解析目标文件
    if not os.path.exists(target):
        in_out = os.path.join(OUTPUT_DIR, target)
        if os.path.exists(in_out):
            target = in_out
        else:
            print(f'文件不存在: {target}')
            sys.exit(2)
    articles = parse_articles(target)
    if not articles:
        print('未解析到任何口播稿（检查分隔线格式）')
        sys.exit(2)

    # 用户点名热点
    extra = [e.strip() for e in extra_raw.split(',') if e.strip()] if extra_raw else []
    extra_norm = [_norm(e) for e in extra]

    # 正文合并（用于实体抽取）
    all_text = '\n'.join(a['text'] for a in articles)
    article_entities = extract_entities(all_text)

    # ── 拉 aihot 检测发布潮 ──
    wave = False
    aihot_count = 0
    aihot_err = None
    try:
        items = pull_aihot(category='ai-models', since_days=7, take=50)
        aihot_count = len(items)
        wave = aihot_count >= 3
    except (urllib.error.URLError, urllib.error.HTTPError, Exception) as e:  # noqa
        aihot_err = str(e)
        # 网络不可达：除非显式 --ack-offline，否则阻断（逼 AI 解决/手动确认）
        if not ack_offline:
            print('\n' + '=' * 70)
            print('  ❌ 热点覆盖自检：aihot 不可达，无法自动检测发布潮')
            print(f'     错误: {aihot_err}')
            print('     处理：修复网络，或显式声明已手动确认覆盖（--ack-offline）。')
            print('=' * 70)
            sys.exit(1)
        # ack_offline：跳过 aihot 潮检测，仅依赖用户点名 + 主题实体计数

    # ── 判定 ──
    problems = []

    # 主题覆盖：发布潮存在（aihot 或 用户点名）时必须 ≥2 个模型发布实体
    trigger = wave or (len(extra) >= 1)
    if trigger:
        if len(article_entities) < 2:
            problems.append(
                f"漏抓模型发布热点：检测到发布潮（aihot 近7天 {aihot_count} 条发布"
                f"{' / 用户点名 ' + str(len(extra)) + ' 个' if extra else ''}），"
                f"但 8 篇仅提及 {len(article_entities)} 个模型发布实体，需 ≥2"
            )
    else:
        # 平静日：无发布潮、无用户点名 → 不强制（避免误伤）
        pass

    # 用户点名严格覆盖
    if extra:
        norm_text = _norm(all_text)
        missing = [e for e, en in zip(extra, extra_norm) if en not in norm_text]
        if missing:
            problems.append(f"用户点名热点未覆盖：{ '、'.join(missing) }")

    # ── 输出报告 ──
    print('\n' + '=' * 70)
    print(f'  🔥 热点覆盖自检 — {os.path.basename(target)}')
    print('=' * 70)
    if aihot_err and ack_offline:
        print(f'  aihot：不可达（--ack-offline 跳过自动检测）')
    else:
        print(f'  aihot 模型发布(近7天)：{aihot_count} 条 → '
              f'{"[发布潮]" if wave else "[无发布潮]"}')
    print(f'  8 篇提及的模型发布实体（{len(article_entities)} 个）：'
          + (', '.join(sorted(article_entities)) if article_entities else '（无）'))
    if extra:
        print(f"  用户点名（{len(extra)} 个）：{'、'.join(extra)}")
        missing = [e for e, en in zip(extra, extra_norm) if en not in _norm(all_text)]
        print(f'    覆盖状态：{"✅ 全部覆盖" if not missing else "❌ 缺失 " + "、".join(missing)}')
    print('-' * 70)

    if problems:
        for p in problems:
            print(f'  ❌ {p}')
        print('=' * 70)
        print('  ⛔ 结果：FAIL — 漏抓当日高热热点，阻断交付')
        print('=' * 70)
        sys.exit(1)
    else:
        print('  ✅ 结果：PASS — 当日高热热点已覆盖，可交付')
        print('=' * 70)
        sys.exit(0)


if __name__ == '__main__':
    main()
