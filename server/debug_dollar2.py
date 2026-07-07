import re

# Python re.sub 实际支持的语法
# 1. 数字反向引用: \1 \2
# 2. \g<name> 或 \g<number>
# 3. \X 已知转义 (\n, \t 等)
# 4. 未知转义保留为字面 (含 \$)

# 测试 \g<0> (整个匹配)
result = re.sub(r'x', r'\\g<0>', 'axb')  # \\g<0> = \g<0> in raw = literal \ + group 0
print(f"1. r'\\\\g<0>': {result!r}")

result = re.sub(r'x', r'\\g<0>test', 'axb')
print(f"2. r'\\\\g<0>test': {result!r}")

# 实际想要: \ + match
# 方法 A: 用 \g<0> 引用整个匹配 + 前面加 \
# Python replacement: \\g<0> (raw: \, \, g, <, 0, >) — 这里 \\ → \, g<0> → 整个匹配
result = re.sub(r'x', r'\\g<0>', 'axb')
print(f"3. 期望 a\\xb 实际 {result!r}")

# 方法 B: 用 callback 函数
result = re.sub(r'x', lambda m: '\\' + m.group(0), 'axb')
print(f"4. callback: {result!r}")
