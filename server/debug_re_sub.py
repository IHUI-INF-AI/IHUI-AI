import re

# Python re.sub 替换字符串的转义行为
test = 'a[b]c'
print(f'输入: {test!r}')

# 测试不同的 replacement 字符串
for repl in [r'\$&', r'\\$&', r'\\\${$&}', r'\\\\$&']:
    result = re.sub(r'[\[\]]', repl, test)
    print(f'  repl={repl!r:12} → result={result!r}')

# 对比 JS 行为
print()
print('=== JS 行为对比 ===')
# JS: 'a[b]c'.replace(/[\[\]]/g, '\\$&')
# 在 JS 字符串中 '\\$&' 是 3 字符: \, $, &
# 在 replace 替换中, \\ = \, $& = matched group
# 所以 [ → \[, ] → \]
# 期望结果: 'a\\[b\\]c' (即 a\[b\]c)

# Python 怎么写?
# 我们想要的结果: 'a\\[b\\]c' (即 a\[b\]c)
# 在 Python raw string 中: r'a\\[b\\]c'  (12 chars)
# replacement 想要 \ + match:
# - 1 个 \ 在 replacement 里要写成 \\
# - match 写为 $&
# - 所以 replacement 是 r'\\$&' (4 chars in raw: \, \, $, &)

result = re.sub(r'[\[\]]', r'\\$&', test)
print(f'Python r"\\\\$&" result: {result!r}')

# 但 debug 输出显示是 r'\\$&' (4 chars in raw) 在 Python 里
# 让我用 re.escape 测试

# 实际上 re.sub 替换里 \\ 是 1 个 \, $& 是匹配
# 让我直接用 chr 测试
repl_str = chr(92) + '$&'  # 1 个 \ + $&
result = re.sub(r'[\[\]]', repl_str, test)
print(f'chr(92) + "$&" result: {result!r}')
