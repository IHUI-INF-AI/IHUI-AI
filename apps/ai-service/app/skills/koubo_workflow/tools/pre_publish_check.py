# -*- coding: utf-8 -*-
"""
pre_publish_check.py — 发布前自动门禁检查 v1.0
2026-07-14 用户强制·零容忍·根绝复发

本脚本集成以下检查，任意一项 FAIL 即 exit 1（禁止发布）：
  1. scan_ambig.py — 4 类歧义压缩扫描
  2. scan_canonical.py — 跨稿统一词表一致性
  3. koubo_validate.py — 全量验证（字数/句长/标题/开头/...）
  4. koubo_quality_gate.py — 断句/语病/自然度/人设终审
  5. hot_topic_coverage_gate.py — 热点覆盖自检（漏抓当日高热热点·尤其大模型发布潮→阻断）

使用方法：
  python pre_publish_check.py Output/0714.txt   # 检查单稿
  python pre_publish_check.py --all             # 检查 Output/ 下所有 MMDD.txt

退出码：
  0 = 全部通过，可发布
  1 = 有 FAIL，阻断发布
  2 = 参数错误

可作为 git pre-commit / pre-push hook 使用：
  .git/hooks/pre-commit 内容：
  #!/bin/sh
  cd apps/ai-service/app/skills/koubo_workflow
  python tools/pre_publish_check.py --all || exit 1
"""
import os
import re
import sys
import subprocess

# 路径解析：本脚本位于 工具脚本/，当日稿在 ../Output/，历史稿在 ../历史稿/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
KOUBO_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(KOUBO_ROOT, 'Output')


def _resolve_script(name):
    """子脚本与本品同目录（工具脚本/），用绝对路径调用，避免 cwd 影响。"""
    return os.path.join(SCRIPT_DIR, name)


def _resolve_target(arg):
    """支持 Output/0714.txt / 0714.txt（自动去 Output/ 找）/ 绝对路径。"""
    if os.path.exists(arg):
        return arg
    in_output = os.path.join(OUTPUT_DIR, arg)
    return in_output if os.path.exists(in_output) else arg


# Windows cmd GBK fix
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def run_script(cmd, label):
    """运行子脚本，返回 (returncode, output)"""
    print(f'\n{"=" * 70}')
    print(f'  ▶ {label}')
    print(f'    $ {" ".join(cmd)}')
    print('=' * 70)
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    # 仅输出最后 30 行（避免刷屏）
    output_lines = (result.stdout + result.stderr).strip().split('\n')
    tail = '\n'.join(output_lines[-30:])
    print(tail)
    return result.returncode, (result.stdout + result.stderr)


def main():
    # 解析参数
    if len(sys.argv) < 2:
        print('用法: python pre_publish_check.py Output/0714.txt  或  python pre_publish_check.py --all')
        sys.exit(2)
    if sys.argv[1] == '--all':
        files = [os.path.join(OUTPUT_DIR, f) for f in os.listdir(OUTPUT_DIR)
                 if re.match(r'^\d{4}\.txt$', f)]
        files.sort()
    else:
        files = [_resolve_target(a) for a in sys.argv[1:]]

    if not files:
        print('未指定文件 或 Output/ 下无 MMDD.txt')
        sys.exit(2)

    # 子脚本（scan_ambig/scan_canonical）靠 listdir('.') 找当日稿，需把 cwd 切到 Output/
    os.chdir(OUTPUT_DIR)

    total_fail = 0
    results = []

    # ── 1) scan_ambig.py ──
    rc, out = run_script(
        [sys.executable, _resolve_script('scan_ambig.py')] + files,
        '1/5 scan_ambig.py — 4 类歧义压缩扫描'
    )
    if rc != 0:
        total_fail += 1
    results.append(('歧义压缩', rc, out.count('处') and '发现' in out))

    # ── 2) scan_canonical.py ──
    rc, out = run_script(
        [sys.executable, _resolve_script('scan_canonical.py')],
        '2/5 scan_canonical.py — 跨稿统一词表一致性'
    )
    if rc != 0:
        total_fail += 1
    results.append(('跨稿词表', rc, out.count('问题') and '0' not in out.split('问题')[1][:3] if '问题' in out else False))

    # ── 3) koubo_validate.py（逐篇）──
    for f in files:
        rc, out = run_script(
            [sys.executable, _resolve_script('koubo_validate.py'), f],
            f'3/5 koubo_validate.py {f}'
        )
        if rc != 0:
            total_fail += 1

    # ── 4) koubo_quality_gate.py（逐篇）──
    for f in files:
        rc, out = run_script(
            [sys.executable, _resolve_script('koubo_quality_gate.py'), f],
            f'4/5 koubo_quality_gate.py {f}'
        )
        if rc != 0:
            total_fail += 1

    # ── 5) hot_topic_coverage_gate.py（热点覆盖自检·逐篇文件）──
    for f in files:
        rc, out = run_script(
            [sys.executable, _resolve_script('hot_topic_coverage_gate.py'), f],
            f'5/5 hot_topic_coverage_gate.py {f}'
        )
        if rc != 0:
            total_fail += 1

    # ── 总结 ──
    print('\n' + '=' * 70)
    print('  📋 pre_publish_check 总览')
    print('=' * 70)
    if total_fail == 0:
        print('  ✅ 全部通过——可发布')
        print('=' * 70)
        sys.exit(0)
    else:
        print(f'  ❌ {total_fail} 项 FAIL——禁止发布')
        print('  请修复 FAIL 项后重跑。')
        print('=' * 70)
        sys.exit(1)


if __name__ == '__main__':
    main()
