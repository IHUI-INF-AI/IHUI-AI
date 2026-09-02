# fixture_text_utils

文本工具模块(确定性,无网络)。

`text_utils.py` 提供:

- `word_count`:词数统计
- `to_uppercase`:大小写转换
- `slugify`:slug 化(小写 + 空格转连字符)
- `reverse`:字符串反转(**故意埋设 bug**,步长写错不反转)

`tests/test_text_utils.py` 覆盖 `word_count` / `to_uppercase` / `reverse`,
但**缺失 `slugify` 的测试**——这是写测试类任务的缺口。
