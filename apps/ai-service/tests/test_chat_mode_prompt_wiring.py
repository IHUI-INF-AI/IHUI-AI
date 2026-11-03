# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ChatMode 引导词的**通路**回归:引导词真的以字符串形态进了发给模型的消息。

与 `test_chat_mode_prompts_shape.py` 的分工:那个文件测**数据**(词表里每个值必须是非空 str、
审查档必须含三档与 path:line),本文件测**通路**(`_resolve_chat_mode` + `_inject_system_prefix`
这一段真正把值搬进 messages 的路径)。只有数据测试是不够的:有人把 `_inject_system_prefix`
改成"前缀塞进 list"或"对非 str 做 `str(...)` 兜底",词表测试照样全绿,而线上又坏了 —— 用户能
感知的从来不是字典里那个值,而是模型收到的那条 system 消息。

立因(2026-09-27):`_CHAT_MODE_PROMPTS["review"]` 值结尾多了一个逗号,Python 里
`("aaa" "bbb",)` 是 **1 元组**而不是字符串,而字典注解写的是 `dict[str, str]`;
`llm.py` 的 ChatMode 注入分支把它原样喂给 `_inject_system_prefix` ⇒ 审查模式收到的是一段 tuple
的 repr,那段"必须分 P1/P2/Nits 三档、每条 finding 带 path:line 证据"的验收指引从未生效。
逗号已由另一枚提交删掉,本文件钉住的是"再回来时有人会看见"。

**这套测试证明了什么、没证明什么(如实登记)**:
- 证明:词表值经 `_inject_system_prefix` 后,在发给模型的消息里是一条 **逐字等于该值** 的 str,
  且位置与该函数既有语义一致(前置在 index 0 的 system 头上;已有 system 头则合并进它而不是新插一条)。
- 没证明 ①:`llm.py` 里那 4 行 `if chat_mode == "plan" / elif chat_mode in _CHAT_MODE_PROMPTS / else`
  的**分支派发**没有被执行到 —— 到达它要过请求体与鉴权,而本票禁止连生产库/Redis。这里改测该分支
  赖以判定的两个输入(`_resolve_chat_mode` 的返回值 + `"review" in _CHAT_MODE_PROMPTS`),
  两者同时成立时那一支必然被走,但它仍是**推论**而非**观测**。
- 没证明 ②:没有真机跑过一次 `/review` 请求,所以"输出格式改善了多少"这条不在本文件射程内。
- 没证明 ③:通路层**不校验**前缀类型(见 `test_pathway_should_refuse_a_non_string_prefix` 那条
  显式登记的 xfail)—— 所以那个逗号型事故在运行期**没有任何防线**,mypy(守门 35)是唯一一道。
"""

from typing import Any

import pytest

from app.routers.llm import _CHAT_MODE_PROMPTS, _inject_system_prefix, _resolve_chat_mode

# 元组形态的前缀(那个逗号产出的东西)——构造面,不依赖仓库此刻有没有这个 bug。
TUPLE_PREFIX: tuple[str, ...] = ("x",)
TUPLE_REPR = "('x',)"


def _user_only_messages() -> list[dict[str, Any]]:
    return [{"role": "user", "content": "帮我看看这段 diff"}]


def _system_head_messages() -> list[dict[str, Any]]:
    return [
        {"role": "system", "content": "BASE SYSTEM PROMPT"},
        {"role": "user", "content": "帮我看看这段 diff"},
    ]


# ---------------------------------------------------------------- 分支入口(推论层)


def test_chat_mode_gate_inputs_are_pinned() -> None:
    """钉住注入分支赖以判定的两个输入。

    分支本体(`llm.py` 的 if/elif)在本票不可达(要过请求体+鉴权),但它只在
    `_resolve_chat_mode(...)` 返回的值**同时**是 `_CHAT_MODE_PROMPTS` 的键时才注入。
    两个输入任一漂移,`/review` 就静默退化成"什么都不注入"(else 支:messages 原样返回,
    零报错零日志)—— 那正是本仓最高频的失效形态:功能没跑,账面全绿。
    """
    assert _resolve_chat_mode("review", None) == "review"
    assert _resolve_chat_mode("REVIEW ", None) == "review", "mode 大小写/空白归一是既有语义"
    # build 刻意不在词表里(默认档不注入);ask/spec 必须在。
    assert set(_CHAT_MODE_PROMPTS) == {"ask", "review", "spec"}, (
        f"词表键集变成 {sorted(_CHAT_MODE_PROMPTS)} ⇒ review 可能已被挪出注入射程"
    )


# ---------------------------------------------------------------- 通路(观测层)


@pytest.mark.parametrize("mode", sorted(_CHAT_MODE_PROMPTS))
def test_prompt_arrives_as_a_verbatim_string_in_the_head_message(mode: str) -> None:
    """走一遍注入:被注入的那条消息 content 逐字等于词表值,且必须是 str。

    正向对照:那个逗号产出的元组形态过不了 `isinstance(str)` —— 这条断言的牙就在此。
    """
    prompt = _CHAT_MODE_PROMPTS[mode]
    messages = _inject_system_prefix(_user_only_messages(), prompt)

    assert len(messages) == 2, "前缀注入应新插一条 system,而不是替换或追加到尾部"
    assert messages[0]["role"] == "system"
    assert isinstance(messages[0]["content"], str), (
        f"{mode} 的引导词到了模型手上是 {type(messages[0]['content']).__name__}"
    )
    assert messages[0]["content"] == prompt, "content 必须逐字等于词表值(不加不改不套 repr)"
    assert messages[1] == {
        "role": "user",
        "content": "帮我看看这段 diff",
    }, "用户消息被后移一位,内容与位置语义都不得被动"


def test_review_guidance_sections_reach_the_message_the_model_reads() -> None:
    """审查档的三档与 path:line 判据必须出现在**注入后的那条消息**里。

    数据测试只证明"字典值里有这三段";本条证明"这三段确实进了发给模型的 system 消息"——
    那才是用户可感知的部分(事故当时,字典值里三段齐全而模型收到的是 tuple repr)。
    """
    messages = _inject_system_prefix(_user_only_messages(), _CHAT_MODE_PROMPTS["review"])
    content = messages[0]["content"]
    for needle in ("### P1 Blocking", "### P2 Suggested", "### Nits", "path:line"):
        assert needle in content, f"注入后的审查引导词缺少 {needle!r}"


def test_prompt_is_prepended_to_an_existing_system_head_not_appended() -> None:
    """已有 system 头时的既有语义:合并进头一条的**最顶部**,不新插第二条 system。

    顺序有业务后果(`llm.py:2413` 注释:注入在 `_inject_workspace_memory` 之前,
    确保模式引导位于 system prompt 最顶部)。
    """
    prompt = _CHAT_MODE_PROMPTS["review"]
    messages = _inject_system_prefix(_system_head_messages(), prompt)

    assert len(messages) == 2, "已有 system 头时应在原位合并,不得新插一条"
    assert messages[0]["role"] == "system"
    assert isinstance(messages[0]["content"], str)
    assert messages[0]["content"] == f"{prompt}\n\nBASE SYSTEM PROMPT"
    assert messages[1] == {"role": "user", "content": "帮我看看这段 diff"}


def test_empty_system_head_yields_the_bare_prompt_without_a_leading_break() -> None:
    """content 为空的 system 头 ⇒ merged 走 `prefix` 那一支(不产出前导 `\n\n`)。

    钉这一格是因为它是两条分支的接缝:把它并入 f-string 那一支会让模型收到一条以空行
    开头的引导词,而这是本函数既有语义里刻意分开的两种形态。
    """
    prompt = _CHAT_MODE_PROMPTS["review"]
    messages = _inject_system_prefix([{"role": "system", "content": ""}], prompt)

    assert isinstance(messages[0]["content"], str)
    assert messages[0]["content"] == prompt
    assert not messages[0]["content"].startswith("\n")


def test_injection_is_pure_and_does_not_accumulate_on_the_request() -> None:
    """注入不得改写入参(新列表 + 头字典重建)⇒ 同一请求重复注入不会叠两层前缀。

    tool loop 与自动压缩路径都可能拿同一份 `req.messages` 多次取值;若本函数就地改写,
    第二次注入会把引导词前缀再叠一层,而模型只是"变长了一点",极难归因。
    """
    source = _system_head_messages()
    prompt = _CHAT_MODE_PROMPTS["review"]

    first = _inject_system_prefix(source, prompt)
    second = _inject_system_prefix(source, prompt)

    assert source[0]["content"] == "BASE SYSTEM PROMPT", "入参的 system 头被就地改写了"
    assert len(source) == 2, "入参列表被插入了元素"
    assert first is not source and second is not source
    assert first[0]["content"] == second[0]["content"], "重复注入产出了不同结果"


# ------------------------------------------------------- 元组反例(显式登记,不修复)


def test_tuple_prefix_currently_reaches_the_model_untouched() -> None:
    """记录**现状**:通路层对非 str 前缀零校验,两种形态都静默放行。

    这不是期望行为,是缺陷的形状 —— 写成绿断言只因为它判的是"今天真发生了什么":
    - 无 system 头:content 就是那个 tuple 对象本身(连 str 都不是),后续任何
      `len(content)` / `.strip()` 都会炸在离现场很远的地方;
    - 有 system 头:f-string 把 tuple 的 repr 拼进正文 ⇒ 模型真的读到 `('x',)`,
      而 content 是 str,所以"必须是 str"这一类断言**抓不到它**。

    两种形态都无声。修复属产品代码(`_inject_system_prefix` 加类型闸),本票禁改 app/ ⇒
    这里只把形状钉住;上面那条 `isinstance(str)` 断言只在词表值真是 str 时才有意义,
    而词表值是不是 str 由 `test_chat_mode_prompts_shape.py` 与本文件的 xfail 一起看着。
    """
    no_head = _inject_system_prefix(_user_only_messages(), TUPLE_PREFIX)  # type: ignore[arg-type]
    assert not isinstance(no_head[0]["content"], str), (
        "通路层已经会拒非 str 前缀了 —— 若是,请把下面的 xfail 撤掉并改写本用例"
    )
    assert no_head[0]["content"] == TUPLE_PREFIX

    with_head = _inject_system_prefix(_system_head_messages(), TUPLE_PREFIX)  # type: ignore[arg-type]
    assert isinstance(with_head[0]["content"], str), "合并分支产出 str,所以类型断言对它失明"
    assert TUPLE_REPR in with_head[0]["content"], "元组 repr 被拼进正文是这条事故的指纹"


@pytest.mark.xfail(
    strict=True,
    reason="通路层(唯一注入出口 `_inject_system_prefix`)不校验前缀类型:无 system 头时 tuple "
    "被原样放进 content(不是 str),有 system 头时它的 repr 被 f-string 拼进正文(是 str 但是错文本)。"
    "⇒ 那个逗号型事故在运行期没有任何防线,mypy --strict(守门 35)是唯一一道。本票只加尺子不动被量"
    "的东西,故不在此给函数加类型闸;真要落地应在 `_inject_system_prefix` 拒收非 str 并让本条 XPASS"
    "(strict xfail 会当场翻红,逼着撤掉本标记并把上一条改写成判据)。",
)
def test_pathway_should_refuse_a_non_string_prefix() -> None:
    """期望行为(今天不成立):非 str 前缀必须被拒,或至少不得变成模型可读的 repr。

    两条形态同时判:content 必须是 str,且正文里不得出现 `('x',)`。
    """
    for injected in (
        _inject_system_prefix(_user_only_messages(), TUPLE_PREFIX),  # type: ignore[arg-type]
        _inject_system_prefix(_system_head_messages(), TUPLE_PREFIX),  # type: ignore[arg-type]
    ):
        content = injected[0]["content"]
        assert isinstance(content, str)
        assert TUPLE_REPR not in content
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
