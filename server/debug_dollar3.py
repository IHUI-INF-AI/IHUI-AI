import re

# 找到正确的 Python re.sub 转义语法
# 目标: x 替换为 \x (1 个 \ 加 整个匹配)

# 用 callback 函数 (最简单)
result = re.sub(r'x', lambda m: '\\' + m.group(0), 'axb')
print(f"callback: {result!r}")
# 期望: 'a\\xb' 即 a\xb (3 chars: a, \, x, b -- 4 chars)

# 用字符串: 需要 \\ + \g<0>
# 实际字符串: '\\\\\\g<0>' (Python 字符串里 7 字符: \, \, \, g, <, 0, >)
# \\ → \   (1 backslash)
# \g<0> → 整个匹配
# 合计: \ + 整个匹配
repl = '\\\\\\g<0>'  # Python source: 7 字符
print(f"repl: {repl!r} (len={len(repl)})")
result = re.sub(r'x', repl, 'axb')
print(f"str method: {result!r}")

# 在 raw string 中: r'\\\g<0>'  实际是 \\\g<0> 7 chars
repl2 = r'\\\g<0>'
print(f"repl2: {repl2!r} (len={len(repl2)})")
result = re.sub(r'x', repl2, 'axb')
print(f"raw method: {result!r}")
