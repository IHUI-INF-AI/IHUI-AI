# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""ChatMode 引导词表的**形状**回归(纯静态,不连库不联网)。

立因:`_CHAT_MODE_PROMPTS["review"]` 的值曾以 `"…verdict.",` 结尾 —— 圆括号里那个逗号
把整段隐式拼接变成了 **1 元组**,而字典注解写的是 `dict[str, str]`。后果不是"少一条注释":
`llm.py:2418` 把它原样喂给 `_inject_system_prefix`,审查模式收到的是一个 tuple 的 repr
而不是那段 P1/P2/Nits 指引。mypy --strict 现在能判出来(守门 35),本文件把同一件事在
**运行期**也钉住:注解会被人改松,值不会自己变回字符串。
"""

from app.routers.llm import _CHAT_MODE_PROMPTS


def test_every_chat_mode_prompt_is_a_non_empty_string() -> None:
    """每个模式的引导词必须是 str 且非空。

    正向对照:元组形态(那个逗号产出的东西)必须被这条断言拦下 —— 这也是本用例的牙。
    """
    assert _CHAT_MODE_PROMPTS, "词表不应为空:五个 ChatMode 的引导词都从这里取"
    for mode, prompt in _CHAT_MODE_PROMPTS.items():
        assert isinstance(prompt, str), (
            f"{mode} 的引导词是 {type(prompt).__name__}(多半是括号里多了个逗号)⇒ "
            "它会被原样拼进 system 前缀,模型收到的是 repr 不是指引"
        )
        assert prompt.strip(), f"{mode} 的引导词为空白"


def test_review_prompt_keeps_the_three_severity_sections() -> None:
    """审查档必须同时点名三档严重度与 path:line 证据要求(缺一条就等于验收判据丢了)。"""
    review = _CHAT_MODE_PROMPTS["review"]
    for needle in ("### P1 Blocking", "### P2 Suggested", "### Nits", "path:line"):
        assert needle in review, f"review 引导词缺少 {needle!r}"
