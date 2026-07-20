#!/usr/bin/env python3
"""
koubo_display.py — 口播稿全量显示生成器 + 全量显示检查点维护  (2026-07-20)

为什么存在：用户铁律——每次修改口播稿汇编后，必须在对话框内完整显示
全部 N 篇正文 + 每篇评估检测数据（AGENTS.md 6.2 格式），禁止只贴改动部分。
本脚本把“全量显示”做成可机读、可校验的步骤：

  1) python koubo_display.py               → 打印段内全部文章（6.2 格式 + 每篇【评估检测】）
  2) 把上方输出完整粘贴至对话框
  3) python koubo_display.py --mark        → 记录当前段内容 sha 到检查点文件
  4) koubo_validate.py 的“显示纪律(全量显示)”检查随即匹配 → 否则硬 FAIL 阻断交付

用法：
  python koubo_display.py [汇编文件或段文件]      # 打印全量显示内容
  python koubo_display.py [文件] --mark           # 打印并写检查点
  python koubo_display.py --check                 # 仅查看检查点状态
默认文件 = 历史稿/历史口播稿汇编.txt（自动取最后一个 #MMDD 段）
"""
import sys, os, re, hashlib, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import koubo_validate as kv

_KOUBO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # koubo_workflow/
ASSEMBLY = os.path.join(_KOUBO_DIR, 'history', '历史口播稿汇编.txt')
HASH_FILE = os.path.join(_KOUBO_DIR, '.cache', 'koubo_display_hash')


def seg_hash(text):
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()[:16]


def extract_latest_segment(text):
    headers = [m.start() for m in re.finditer(r'^#\s*\d{4}\s*$', text, re.M)]
    if not headers:
        return text, None
    start = headers[-1]
    nxt = None
    for h in headers:
        if h > start:
            nxt = h
            break
    seg = text[start: nxt] if nxt else text[start:]
    m = re.match(r'^#\s*(\d{4})', seg)
    sid = m.group(1) if m else '????'
    return seg, sid


def num(detail):
    m = re.search(r'\d+', detail or '')
    return m.group(0) if m else '0'


def build_display(seg_text):
    tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_disp_tmp.txt')
    open(tmp, 'w', encoding='utf-8').write(seg_text)
    try:
        articles = kv.parse_articles(tmp)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    if not articles:
        return '（未解析到文章）', []
    blocks = []
    for i, art in enumerate(articles):
        R = kv.check_article(art, articles)
        rd = {name: (p, d) for name, p, d in R}
        def g(n):
            return rd.get(n, (None, ''))
        blen = g('字数')[1]
        tlen = g('标题字数')[1]
        wo = g('"我"次数')[1]
        sent = g('句子长度')[1]
        coach = g('教练穿插')[1]
        s3_ok, _ = g('前3秒冲突强度')
        hook_ok, _ = g('结尾评论钩子')
        tag = g('话题词数量')[1]
        sl = g('生硬自报家门')[1]
        sem_ok, _ = g('语义通顺')
        fake_ok, _ = g('虚构社会关系')
        coach_n = num(coach)
        # 收藏价值：门禁中该项为跨篇级，这里给单篇近似（标注≈，避免冒充权威值）
        body = art.body
        sc = 3
        if ('学员' in body or '我带' in body or '我见过' in body):
            sc += 3
        if re.search(r'\d', body):
            sc += 2
        if coach_n not in ('0',):
            sc += 1
        if s3_ok:
            sc += 1
        sc = min(sc, 10)
        eval_parts = [
            f'字数{blen}',
            f'标题{tlen}',
            f'我字{wo}',
            f'教练{coach_n}处',
            f'前3秒{"✓" if s3_ok else "✗"}',
            f'结尾钩子{"✓" if hook_ok else "✗"}',
            f'话题词{tag}',
            f'生硬自报家门{sl}',
            f'语义{"✓" if sem_ok else "✗"}',
            f'虚构关系{"✓" if fake_ok else "✗"}',
            f'朗读{sent}',
            f'收藏≈{sc}',
        ]
        # 话题行取汇编原文（保留 #Kimi K3 等完整标签，解析器会丢无#前缀的词）
        raw_lines = [l.strip() for l in art.raw.split('\n') if l.strip()]
        ri = 0
        while ri < len(raw_lines) and re.match(r'^#\s*\d{4}$', raw_lines[ri]):
            ri += 1
        topic_line = raw_lines[ri + 1] if ri + 1 < len(raw_lines) else ''
        block = (f'第{i+1}篇\n\n{art.title}\n{topic_line}\n\n{art.body}\n\n'
                 f'【评估检测】' + ' / '.join(eval_parts))
        blocks.append(block)
    sep = '\n\n' + '─' * 40 + '\n\n'
    return sep.join(blocks), articles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file', nargs='?', default=ASSEMBLY)
    ap.add_argument('--mark', action='store_true')
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()

    text = open(args.file, encoding='utf-8').read()
    seg, sid = extract_latest_segment(text)
    h = seg_hash(seg)

    if args.check:
        if os.path.exists(HASH_FILE):
            stored = open(HASH_FILE, encoding='utf-8').read().strip()
            print(f'检查点(段#{sid}): 当前sha={h}  存储sha={stored}  '
                  f'{"匹配✓" if stored == h else "不匹配✗(需全量显示)"}')
        else:
            print(f'检查点(段#{sid}): 尚未建立 (当前sha={h})')
        return

    disp, articles = build_display(seg)
    print('═' * 62)
    print(f' 口播稿全量显示（段 #{sid}，共 {len(articles)} 篇）— AGENTS.md 6.2 格式')
    print('═' * 62)
    print()
    print(disp)
    print()
    print('═' * 62)
    print(f' ⚠️ 显示纪律：请将上方全部 {len(articles)} 篇完整正文+评估数据粘贴至对话框，')
    print(f'   然后运行：python koubo_display.py --mark  更新全量显示检查点。')
    print('═' * 62)

    if args.mark:
        with open(HASH_FILE, 'w', encoding='utf-8') as f:
            f.write(h)
        print(f'\n[检查点已更新] sha={h}（段#{sid}，{len(articles)}篇）')


if __name__ == '__main__':
    main()
