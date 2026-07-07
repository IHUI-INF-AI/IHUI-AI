import re

# 测试 $& 的正确行为
result = re.sub(r'x', '$&', 'axb')
print(f"1. '$&': {result!r}")

result = re.sub(r'x', r'$&', 'axb')
print(f"2. r'$&': {result!r}")

# 测试 单独的 \\
result = re.sub(r'x', '\\', 'axb')
print(f"3. '\\\\': {result!r}")

# 测试 \\$&
result = re.sub(r'x', '\\$&', 'axb')
print(f"4. '\\\\$&': {result!r}")

# 用 chr 构造 3 字符: \, $, &
repl = chr(92) + '$&'
print(f"5. chr(92) + '$&' = {repl!r} (len={len(repl)})")
result = re.sub(r'x', repl, 'axb')
print(f"   result: {result!r}")

# 用 chr 构造 4 字符: \, \, $, &
repl = chr(92) + chr(92) + '$&'
print(f"6. chr(92)*2 + '$&' = {repl!r} (len={len(repl)})")
result = re.sub(r'x', repl, 'axb')
print(f"   result: {result!r}")

# 终极测试: 1 个 \ + match
# 期望: 输入 'axb', 替换 x → 想要 \x (即 2 chars: \, x)
repl = chr(92) + chr(92) + '$&'
result = re.sub(r'x', repl, 'axb')
print(f"7. 期望 a\\xb 实际 {result!r}")
