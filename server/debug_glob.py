import re
from app.api.v1.workspace.tools import _compile_glob

# 模拟前端转义: query → safe
queries = ['weird[brackets]', 'file{a,b}', 'test.js', 'weird.dotted']
for query in queries:
    # 正确模拟 JS: '\\$&' → 在 Python 中是 r'\\$&' (3 字符: \, \, $, &)
    # Python re.sub 中 \\ → 1 个 \ (在 replacement 里 \\ 实际保留为 \\)
    # 实际验证: Python re.sub 替换字符串里 $& = 整个匹配, \\ = 单个 \
    # 所以 r'\\$&' = \ + matched group (与 JS 行为一致)
    result = re.sub(r'[*?[\](){}.+]', r'\\$&', query)
    pattern = f'*{result}*'
    print(f'query={query!r:25}  safe={result!r:25}  pattern={pattern!r}')

    rx = _compile_glob(pattern)
    print(f'  regex={rx.pattern!r}')
    print(f'  match weird[brackets].ts: {rx.search("weird[brackets].ts")}')
    print(f'  match file{{a,b}}.ts: {rx.search("file{a,b}.ts")}')
    print()
