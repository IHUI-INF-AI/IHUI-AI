"""批量修复 B904: 在 except 块的 raise 后加 from e/err/exc"""
import re
import sys
from pathlib import Path

# 2026-06-25 修复: 改用脚本自身位置计算 server 根, 避免硬编码 G:/1/server
# scripts/fix-b904.py -> ../../server
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_SERVER_ROOT = _PROJECT_ROOT / "server"

# 获取所有 B904 错误位置
import subprocess
result = subprocess.run(
    [sys.executable, "-m", "ruff", "check", "app/", "--select", "B904", "--output-format=concise"],
    capture_output=True, text=True, cwd=str(_SERVER_ROOT)
)

# 解析错误位置: app\file.py:line:col: B904 ...
errors = []
for line in result.stdout.splitlines():
    m = re.match(r'^(.+?):(\d+):(\d+): B904', line)
    if m:
        errors.append((m.group(1).replace('\\', '/'), int(m.group(2)), int(m.group(3))))

print(f"Found {len(errors)} B904 errors")

# 按文件分组
from collections import defaultdict
by_file = defaultdict(list)
for f, ln, col in errors:
    by_file[f].append((ln, col))

# 修复每个文件
total_fixed = 0
for filepath, locations in by_file.items():
    full_path = _SERVER_ROOT / filepath
    lines = full_path.read_text(encoding='utf-8').splitlines(keepends=True)
    
    # 从后往前修，避免行号偏移
    locations_sorted = sorted(locations, reverse=True)
    
    for line_no, _col in locations_sorted:
        idx = line_no - 1
        if idx >= len(lines):
            continue
        line = lines[idx]
        
        # 找 raise 语句，在行尾加 from e/err/exc
        # 常见模式: raise HTTPException(...) 或 raise ValueError(...) 等
        # 找到 except ... as <var> 的变量名
        var_name = None
        for i in range(idx - 1, max(idx - 10, -1), -1):
            m = re.search(r'except\s+\w+(?:\([^)]*\))?\s+as\s+(\w+)', lines[i])
            if m:
                var_name = m.group(1)
                break
        
        if not var_name:
            var_name = 'e'
        
        # 检查行尾是否已有 from xxx
        stripped = line.rstrip('\n\r')
        if re.search(r'\bfrom\s+\w+\s*$', stripped):
            continue  # 已有 from
        
        # 在 raise 语句末尾加 from <var>
        # raise 语句可能跨行，找完整的 raise 语句
        # 简单处理：如果当前行以 raise 开头且以 ) 结尾，直接加
        if re.match(r'\s*raise\s+\w+', stripped) and stripped.rstrip().endswith(')'):
            new_line = stripped.rstrip() + f' from {var_name}\n'
            # 保留原换行符
            if line.endswith('\r\n'):
                new_line = stripped.rstrip() + f' from {var_name}\r\n'
            lines[idx] = new_line
            total_fixed += 1
        else:
            # 多行 raise，找闭合括号
            # 向下找直到括号闭合
            pass
    
    full_path.write_text(''.join(lines), encoding='utf-8')

print(f"Fixed {total_fixed} of {len(errors)} errors")
