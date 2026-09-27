# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ChatMode 提示词表的**形状**回归锁(2026-09-27 抓到真缺陷)。

病灶(运行时实测,不是推演):`_CHAT_MODE_PROMPTS["review"]` 的值是一段隐式拼接的多行
字符串,但**最后一个片段后面带了逗号** —— 括号因此是元组括号而不是分组括号,该键的值是
`('……462 字符……',)`。类型标注写的是 `dict[str, str]`,而 mypy 报
`Dict entry 1 has incompatible type "str": "tuple[str]"` —— 也就是说**唯一看得见这一格的
尺子(mypy 门)当时是红的**,而它红在别人的文件上,于是每次碰 ai-service 的提交都被逼
`--no-verify`,连带约 180 道门作废。

后果不是崩,是**静默送到模型面前的坏提示**:`_inject_system_prefix` 用 f-string 拼前缀,
f-string 会把元组渲染成 repr ⇒ review 模式的 system message 实测以
`('## Review Mode Active\nYou are in REVIEW mode. …` 开头(括号、引号、转义符全在),
模型收到的是 Python 字面量而不是指令。这种形态不会报错、不会红任何一条 typecheck,
只会表现为"review 模式不守三段格式"而让人去改措辞。

三条判据:
  ① 每个模式的提示词必须是 `str`(不是 tuple/list)—— 直接钉死本型
  ② 经 `_inject_system_prefix` 注入后的 system content 不得含元组 repr 起始符,且必须
     原样带上各模式的标题(证明不是"空字符串恰好没炸")
  ③ 无 system 消息时的插入路径同样成立(两条支路共用一份 prefix)
"""

from __future__ import annotations

from typing import Any, cast

from app.routers.llm import _CHAT_MODE_PROMPTS, _inject_system_prefix

#: 各模式提示词里必须被看见的标题片段(取源码既有措辞,不新造期望)
_EXPECTED_HEAD = {
    "ask": "## Ask Mode Active",
    "review": "## Review Mode Active",
    "spec": "## Spec Mode Active",
}


def test_每个模式的提示词必须是纯字符串() -> None:
    bad = {
        key: type(value).__name__
        for key, value in cast("dict[str, Any]", _CHAT_MODE_PROMPTS).items()
        if not isinstance(value, str)
    }
    # 失败信息点名类型:元组正是 2026-09-27 那一格的实际形态
    assert not bad, f"这些模式的提示词不是 str 而是 {bad} —— 括号里的尾逗号会让拼接变成元组"


def test_注入后_system_message_不含元组_repr() -> None:
    for key, heading in _EXPECTED_HEAD.items():
        merged = _inject_system_prefix(
            [{"role": "system", "content": "BASELINE-PROMPT"}],
            _CHAT_MODE_PROMPTS[key],
        )
        content = merged[0]["content"]
        assert isinstance(content, str)
        # 元组 repr 的两个指纹:起始 `('` 与结尾 `',)` / `,)`
        assert not content.startswith("('"), f"{key} 的提示词以元组 repr 开头"
        assert heading in content, f"{key} 的标题没进 system message"
        assert "BASELINE-PROMPT" in content, f"{key} 把既有 system 内容挤掉了"


def test_无_system_消息时插入的新消息同样成立() -> None:
    for key, heading in _EXPECTED_HEAD.items():
        merged = _inject_system_prefix(
            [{"role": "user", "content": "hi"}],
            _CHAT_MODE_PROMPTS[key],
        )
        assert merged[0]["role"] == "system"
        assert isinstance(merged[0]["content"], str)
        assert merged[0]["content"].startswith(heading), f"{key}: 插入路径同样要干净"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
