import re

# 明确测试
test = 'a[b]c'
print(f'输入: {test!r}')

# JS 行为:
# 'a[b]c'.replace(/[\[\]]/g, '\\$&')
# JS 字符串 '\\$&' 是 3 字符: \, $, &
# 在 JS replace 替换中:
#   $$ → $ (字面)
#   $& → matched
#   $` → before match
#   $' → after match
#   $n → capture group n
#   \X (X 非 $, `, ', &, n, <) → ?  (实际 JS 中 \X 一般不变)
# 所以 '\\$&' 在 JS 中: \ (literal) + $& (matched) = \ + match

# 模拟 JS 在 Python 中:
# 想要: \ + matched
# Python replacement 中: \\ → \, $& → matched
# 所以 replacement = '\\$&' (3 字符: \, \, $, &)
repl = '\\\\$&'  # Python 字符串里这是 3 字符: \, $, &, 实际等价 JS 的 '\\$&'
print(f'replacement 实际值: {repl!r} (len={len(repl)})')
result = re.sub(r'[\[\]]', repl, test)
print(f'Python re.sub result: {result!r} (len={len(result)})')
print()

# 期望 result 是 'a\\[b\\]c' (实际字符 a, \, [, b, \, ], c) — 长度 7
print(f'期望 result: a, \\, [, b, \\, ], c (长度 7)')

# 对比: 用 chr 构造
repl2 = chr(92) + '$&'  # \, $, &  (3 chars)
print(f'chr 构造: {repl2!r} (len={len(repl2)})')
result2 = re.sub(r'[\[\]]', repl2, test)
print(f'chr 构造 result: {result2!r} (len={len(result2)})')
