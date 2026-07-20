# -*- coding: utf-8 -*-
"""
archive_daily.py — 口播稿每日自动存档 v2.0
2026-07-14 用户强制·每天自动存档（历史稿整合为单文件汇编版）

目录约定：
  koubo/
  ├── Output/      ← 当日输出的口播稿（MMDD.txt）放这里
  ├── 历史稿/      ← 历史口播稿汇编（历史口播稿汇编.txt，按 # MMDD 分段）
  └── 工具脚本/    ← 本脚本所在位置

功能：
  将 Output/ 下所有非今日的 MMDD.txt 追加进 历史稿/历史口播稿汇编.txt
  （以 "# MMDD" 段头分隔），然后删除 Output 下对应文件，保持根目录只留当日稿。
  - 仅处理匹配 ^\\d{4}\\.txt$ 的文件
  - 幂等：汇编中已存在该日期段则跳过（不重复追加），并清理 Output 残留
  - 自动写日志到 历史稿/archive_log.txt

模式：
  默认（无参数）  ：只移「非当日」稿，当日稿按设计留 Output/（次日收尾时再归）。
  --finalize       ：工作流收尾用。把「当日」MMDD.txt 也追加进汇编并移除 Output 副本
                     （幂等：# MMDD 已存在则跳过）。这一步才是真正的"当天稿归档"。
  --check          ：仅校验「当日」稿是否已在汇编（# MMDD 段存在），在→exit0，不在→exit1。
                     用作工作流收尾守卫：返回非0说明归档未完成，工作流不可视为结束。
  --dry            ：只预览，不移动。

用法：
  python archive_daily.py                  # 存档历史稿（只移非当日）
  python archive_daily.py --finalize       # 工作流收尾：连当日稿一起归档
  python archive_daily.py --check          # 校验当日稿是否已归档
  python archive_daily.py --dry            # 只预览，不移动
"""
import os, re, sys
from datetime import datetime

# ── 项目边界硬门禁（缺省 fail-closed） ──
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # koubo_workflow/
import project_boundary
project_boundary.check_action(tool="archive_daily.py", paths=sys.argv[1:], cwd=os.getcwd())

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))   # 工具脚本/
KOUBO_ROOT = os.path.dirname(SCRIPT_DIR)                  # koubo/
OUTPUT = os.path.join(KOUBO_ROOT, 'Output')
HISTORY = os.path.join(KOUBO_ROOT, '历史稿')
ANTHOLOGY = os.path.join(HISTORY, '历史口播稿汇编.txt')
DATE_RE = re.compile(r'^\d{4}\.txt$')
SEG_RE = re.compile(r'^# (\d{4})\s*$', re.MULTILINE)


def today_mmdd():
    return datetime.now().strftime('%m%d')


def main():
    dry = '--dry' in sys.argv
    finalize = '--finalize' in sys.argv
    check = '--check' in sys.argv
    today = today_mmdd()
    os.makedirs(HISTORY, exist_ok=True)
    # 收集汇编中已存在的日期段（幂等依据）
    existing = set()
    if os.path.exists(ANTHOLOGY):
        with open(ANTHOLOGY, 'r', encoding='utf-8') as f:
            existing = set(SEG_RE.findall(f.read()))

    # --check：仅校验当日稿是否已归档，不移动任何文件
    if check:
        if today in existing:
            print(f'✅ 今日稿 {today}.txt 已归档（历史汇编含 # {today} 段）')
            sys.exit(0)
        else:
            print(f'❌ 今日稿 {today}.txt 尚未归档（历史汇编无 # {today} 段）——工作流未完成归档')
            sys.exit(1)

    moved, skipped = [], []
    if not os.path.isdir(OUTPUT):
        print(f'⚠️ 未找到 Output/ 目录：{OUTPUT}')
        sys.exit(2)
    for fn in sorted(os.listdir(OUTPUT)):
        fp = os.path.join(OUTPUT, fn)
        if not os.path.isfile(fp):
            continue
        if not DATE_RE.match(fn):
            continue
        date = fn[:4]
        is_today = (date == today)
        # 默认（非 finalize）：当日稿留 Output/，不归当日
        if is_today and not finalize:
            skipped.append(fn)
            continue
        if date in existing:
            skipped.append(fn + '(已入汇编)')
            if not dry:
                os.remove(fp)  # 清理 Output 残留
            continue
        if dry:
            moved.append(fn + '(预览)')
            continue
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        # 2026-07-20 修复：正文首行常自带 "# MMDD" 段头，归档再前置一个会双倍段头，
        # 故入库前剥掉正文首行与本次 date 同号的 "# MMDD" 头，保证汇编单头干净。
        content = re.sub(r'^\s*#\s*' + re.escape(date) + r'\s*\n', '', content, count=1)
        project_boundary.check_write(ANTHOLOGY)
        with open(ANTHOLOGY, 'a', encoding='utf-8') as f:
            f.write('\n\n# ' + date + '\n\n' + content + '\n')
        os.remove(fp)
        moved.append(fn)
        existing.add(date)
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    logpath = os.path.join(HISTORY, 'archive_log.txt')
    project_boundary.check_write(logpath)
    with open(logpath, 'a', encoding='utf-8') as f:
        f.write(f'[{ts}] {"[finalize] " if finalize else ""}存入汇编 {len(moved)} 篇，跳过 {len(skipped)} 篇\n')
    mode_tag = '（finalize·含当日稿）' if finalize else '（今日稿留 Output/）'
    print(f'[{ts}] 存入汇编 {len(moved)} 篇，跳过 {len(skipped)} 篇{mode_tag}')
    if moved:
        print('  已存入:', ', '.join(moved))
    if skipped:
        print('  跳过:', ', '.join(skipped))


if __name__ == '__main__':
    main()
