# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""独立编辑意图预测器(V3 #82,2026-09-27 立)。

对标 Trae CUE 的「编辑意图预测」而不是「补全」:现有 FIM 链路 (`app/routers/fim.py`)
的产物是一段裸文本,客户端只能把它插在光标处。本模块把同一条链路升级为输出
**结构化编辑动作**(insert / replace / delete + 文档绝对区间),并配齐三条判据:

1. **三态诚实**:`suggested`(有可执行动作)/ `no_action`(模型明说没有编辑意图)/
   `undetermined`(判不出来)三态互斥;`undetermined` 必带可分辨 `reason`
   (无凭据 / 模型不可用 / 超时 / 解析失败 / 全部动作被拒)。
   **禁止把"没判"折叠成"没有建议"** —— 本仓最高频失效型(AGENTS 守门速查多处实录)。
2. **区间确定性**:动作区间按**被审文档长度**校验,越界/倒序/空动作一律丢弃并逐条点名
   (`dropped`),绝不静默截断成合法区间;一条动作都没留下即判 `undetermined`,
   而不是 `no_action`。
3. **预算有界**:单次调用预算走 `resolve_budget_ms()` 唯一出口(env > 请求 > 默认,
   **内含封顶**),调用侧一律 `asyncio.wait_for` 喂该值 —— 与仓内既有超时口径
   (`app/routers/llm.py` 的 `asyncio.wait_for` / `app/core/llm_gateway.py` 的
   `_auto_route_budget_usd_from_env`)同形,不新造第二套无界 await。

依赖方向:本模块**不得** import `app.routers.*`(路由层依赖服务层,反向即循环)。
`routers/fim.py` 的 `_strip_fences` 现为本模块 `strip_code_fences` 的别名 ——
围栏剥离只有一份实现,两处各写一遍必然漂移。
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Mapping
from typing import Final, Literal

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

#: 允许的编辑动作种类(封闭集:新增一种必须同时补校验分支与测试,不得放过未知值)
EditActionKind = Literal["insert", "replace", "delete"]

#: 端点三态。undetermined ≠ no_action,见模块 docstring 判据 1。
EditDisposition = Literal["suggested", "no_action", "undetermined"]

#: `undetermined` 的原因码 —— 每种都必须可分辨,不得合并成一个大桶。
UndeterminedReason = Literal[
    "no_credentials",        # stub 模式 / MODEL_NOT_CONFIGURED:根本没有可用凭据
    "model_unavailable",     # 上游报错(含 PROVIDER_NOT_IMPLEMENTED / LLM_ERROR / 额度穷尽)
    "model_timeout",         # 本次调用超出 resolve_budget_ms 给的预算
    "parse_failed",          # 模型回了东西,但解不出规定的 JSON 结构
    "all_actions_rejected",  # 解出了动作,但逐条校验后一条都不成立
    "insufficient_context",  # 连可判定的上下文都没有(空文档),不得读成"没有编辑意图"
]

EDIT_ACTION_KINDS: Final[tuple[EditActionKind, ...]] = ("insert", "replace", "delete")

# --- 上下文窗口与产物上限 ---------------------------------------------------
#: 光标之前最多喂多少字符(绝对偏移不变,只是少喂)
_PREFIX_WINDOW_CHARS: Final[int] = 8_000
#: 光标之后最多喂多少字符
_SUFFIX_WINDOW_CHARS: Final[int] = 4_000
#: 单次最多接受的动作条数,超出按出现顺序丢弃并记名
MAX_ACTIONS: Final[int] = 5
#: 模型输出参与解析的字符上限(防无界输入撑爆 json.loads)
_MAX_OUTPUT_CHARS: Final[int] = 16_000

# --- 预算档位 ---------------------------------------------------------------
#: 默认预算:编辑意图预测必须在下一击之前回来,1.5s 是可用性门槛
_BUDGET_MS_DEFAULT: Final[int] = 1_500
#: 硬上限:任何来源(env / 请求体)都不得越过,否则就是无界 await
_BUDGET_MS_MAX: Final[int] = 4_000
#: 下限:小于此值必然超时,给个可判的地板而不是 0
_BUDGET_MS_MIN: Final[int] = 150

#: env 覆盖名(与 FIM_PREFERRED_MODEL / LLM_AUTO_ROUTE_BUDGET_USD 同一条命名习惯)
BUDGET_MS_ENV: Final[str] = "PREDICTIVE_EDIT_BUDGET_MS"


class EditAction(BaseModel):
    """一条可执行的编辑动作,区间是**被审文档的绝对字符偏移**。"""

    kind: EditActionKind
    start: int = Field(..., ge=0, description="区间起点(含),文档绝对字符偏移")
    end: int = Field(..., ge=0, description="区间终点(不含);insert 时必须等于 start")
    text: str = Field("", description="insert/replace 的插入内容;delete 必须为空串")
    # 82 号票第二刀(2026-10-18 立)的锚点:模型认为该区间**当前**的原文。
    # 关键的可选性:**None = 模型没给 ⇒ 不做锚点比对**(与上面对齐 —— 旧模型输出
    # 与旧调用方的行为逐字不变)。给了才比对,比对不上就丢弃并点名:
    # 区间算错位置是最难归因的一类脏数据 —— 它不越界、结构全合法,
    # 顺着执行下去就把改动打到文档的另一处,事后只能看到"改错了地方"。
    anchor: str | None = Field(
        None,
        description="模型认为 [start,end) 当前的原文;replace/delete 必给,给了就被比对",
    )


class DroppedAction(BaseModel):
    """被丢弃的动作:点名序号与原因,绝不静默消失。"""

    index: int
    reason: str
    detail: str | None = None


class EditIntentOutcome(BaseModel):
    """一次模型输出的完整判定结果(三态 + 逐条去留)。"""

    disposition: EditDisposition
    reason: UndeterminedReason | None = None
    actions: list[EditAction] = []
    dropped: list[DroppedAction] = []


# 82 号票第二刀(2026-10-18 立):契约文本与实现取齐,两处订正。
#   ① 条数上限原本手写 "At most 3 actions" 而 MAX_ACTIONS 是 5 —— 注释与代码
#      不一致就是缺陷信号:契约承诺 3 条而实现收 5 条,第 4、5 条在契约上根本没有
#      被要求过,模型按契约只给 3 条时那条上限形同虚设,反过来若哪天有人把
#      MAX_ACTIONS 调小,prompt 仍拿 3 去要,两边各自漂移。现在 prompt 直接
#      从 MAX_ACTIONS 插进去,上限只有一个真相源。
#   ② 第 7 条早就承诺了 "disjoint range",而校验侧**从来没有判过重叠**
#      (validate_action 是逐条独立的,天然看不见另一条)—— 契约承诺了却没人守,
#      等于没承诺。这两格(重叠 + 锚点)的判据就在下面,由测试钉住。
EDIT_INTENT_SYSTEM_PROMPT: Final[str] = (
    "You are an edit-intent predictor for a code editor. "
    "Given the document text, an absolute cursor offset and the file type, "
    "predict the single most likely edit the developer wants to make next. "
    "Reply with a JSON object and NOTHING else, exactly of this shape:\n"
    '{"actions":[{"kind":"insert","start":<int>,"end":<int>,"text":"<string>"'
    ',"anchor":"<string|null>"}]}\n'
    "Rules:\n"
    "1. kind is one of insert | replace | delete. Offsets are ABSOLUTE character "
    "positions in the document you were given, 0-based, end-exclusive.\n"
    "2. insert: start must equal end (a cursor point) and text must be non-empty.\n"
    "3. replace: start < end and text must be non-empty (the replacement text).\n"
    "4. delete: start < end and text must be the empty string.\n"
    '5. If there is no confident edit, reply exactly {"actions":[]} — do not invent one.\n'
    "6. Never output explanations, markdown fences, or raw code outside the text field.\n"
    f"7. At most {MAX_ACTIONS} actions, each touching a disjoint range.\n"
    "8. For replace and delete you MUST also send anchor = the exact text you "
    "believe is currently inside [start,end); the server compares it against the "
    "real document and discards the action when they differ. Omit anchor (or null) "
    "to skip that check — an action whose range you are not sure about is worse "
    "than no action."
)


def resolve_budget_ms(requested: int | None) -> int:
    """本次预测的调用预算(ms)唯一出口。

    优先级:env `PREDICTIVE_EDIT_BUDGET_MS` > 请求体 `budget_ms` > 默认档,
    三者一律被 `min(_BUDGET_MS_MAX)` 封顶(与 CLI 侧 `resolveToolExecBudgetMs`
    内含 `Math.min` 的同一设计:预算解析器必须自带上界,否则封顶规则会随调用方漂移)。

    env 值不可解析时**喊出来**(warning)并按"未设置"处理 ⇒ 仍尊重请求体的显式预算,
    无显式预算才落默认档 —— 静默把配错读成"没配",会让人以为收紧已经生效。
    """
    raw_env = (os.environ.get(BUDGET_MS_ENV) or "").strip()
    value: int | None = None
    if raw_env:
        try:
            value = int(float(raw_env))
        except ValueError:
            logger.warning(
                "%s=%r 不可解析为毫秒数,按默认档 %d 继续", BUDGET_MS_ENV, raw_env, _BUDGET_MS_DEFAULT
            )
            value = None
    if value is None:
        value = requested if requested is not None else _BUDGET_MS_DEFAULT
    if value < _BUDGET_MS_MIN:
        return _BUDGET_MS_MIN
    return min(value, _BUDGET_MS_MAX)


def strip_code_fences(text: str) -> str:
    """剥离模型偶尔输出的 markdown 代码围栏(自 `routers/fim.py` 迁入,行为不变)。

    推理型模型常先输出思考文本再给 ``` 围栏块,故存在任意围栏时取**最后一个**
    围栏内代码;无围栏则原样返回。FIM 补全与编辑意图预测共用这一份实现。
    """
    stripped = text.strip()
    if "```" in stripped:
        parts = stripped.split("```")
        block = parts[-1] if len(parts) % 2 == 0 else (parts[-2] if len(parts) >= 2 else stripped)
        if block is not None:
            first_nl = block.find("\n")
            body = block[first_nl + 1 :] if first_nl != -1 else block
            return body.strip("\n")
    return stripped.strip("\n")


def build_edit_intent_prompt(
    *,
    content: str,
    cursor: int,
    language: str,
    path: str | None = None,
) -> str:
    """构造喂给模型的用户消息:窗口化的文档 + 绝对光标高 + 文件类型。

    窗口只裁**可见上下文**,不裁文档本身 —— start/end 的坐标系始终是整篇文档,
    所以把窗口边界写给模型看(第 X 到 Y 字符),越界的动作会被校验层丢弃而不是猜。
    """
    document_length = len(content)
    safe_cursor = max(0, min(cursor, document_length))
    win_start = max(0, safe_cursor - _PREFIX_WINDOW_CHARS)
    win_end = min(document_length, safe_cursor + _SUFFIX_WINDOW_CHARS)
    window = content[win_start:win_end]
    file_label = path if path else f"unnamed.{language}"
    return (
        f"File: {file_label}\n"
        f"Language: {language}\n"
        f"Document length: {document_length} characters.\n"
        f"Visible slice: characters [{win_start}, {win_end}) of the document.\n"
        f"Cursor offset (absolute): {safe_cursor}\n"
        "----- document slice -----\n"
        f"{window}\n"
        "----- end slice -----\n"
        "Output the JSON object of edit actions now."
    )


def _coerce_action_list(payload: object) -> tuple[list[object] | None, str | None]:
    """从解出的 JSON 里取动作数组。

    Returns:
        (items, None) 取到了列表(可以为空列表 = 模型明说没有编辑意图);
        (None, reason) 结构不对 —— reason 只用于日志,对外一律 `parse_failed`。
    """
    if isinstance(payload, list):
        return payload, None
    if isinstance(payload, Mapping):
        actions = payload.get("actions", payload.get("edits"))
        if isinstance(actions, list):
            return actions, None
        return None, "缺少 actions 数组或类型不是数组"
    return None, "顶层既不是对象也不是数组"


def extract_json_payload(raw: str) -> tuple[object | None, str | None]:
    """把模型文本折成 JSON 值:整体 parse → 剥围栏 → 取首个 `{` 到末个 `}`。

    三步都不成即 (None, reason)。刻意**不猜**半截 JSON:解析不出来就是 parse_failed,
    而不是把残块当动作。
    """
    if not raw.strip():
        return None, "空输出"
    candidates: list[str] = [raw.strip(), strip_code_fences(raw)]
    body = candidates[1]
    open_at = body.find("{")
    close_at = body.rfind("}")
    if open_at != -1 and close_at > open_at:
        candidates.append(body[open_at : close_at + 1])
    arr_at = body.find("[")
    arr_end = body.rfind("]")
    if arr_at != -1 and arr_end > arr_at:
        candidates.append(body[arr_at : arr_end + 1])
    last_reason = "未找到可解析的 JSON"
    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate[:_MAX_OUTPUT_CHARS]), None
        except (json.JSONDecodeError, RecursionError) as e:
            last_reason = f"{type(e).__name__}: {str(e)[:120]}"
            continue
    return None, last_reason


def validate_action(raw: object, *, document_length: int) -> tuple[EditAction | None, str | None]:
    """单条动作 → (合法动作, None) 或 (None, 丢弃原因)。

    全部区间判据在这里,顺序即严格程度(先结构后区间):
    非对象 / 未知 kind / 偏移非整数 / 负数 / 倒序 / 越界 / 种类与文本不匹配。
    """
    if not isinstance(raw, Mapping):
        return None, "action 不是对象"
    kind = raw.get("kind")
    if kind not in EDIT_ACTION_KINDS:
        return None, f"未知 kind: {kind!r}"
    start = raw.get("start")
    end = raw.get("end", start)
    if isinstance(start, bool) or isinstance(end, bool) or not isinstance(start, int) or not isinstance(end, int):
        return None, "start/end 不是整数"
    if start < 0 or end < 0:
        return None, "start/end 为负"
    if start > document_length or end > document_length:
        return None, f"区间越界(文档长度 {document_length})"
    if start > end:
        return None, "区间倒序"
    text_value = raw.get("text", "")
    if text_value is None:
        text_value = ""
    if not isinstance(text_value, str):
        return None, "text 不是字符串"
    kind_typed = cast_kind(kind)
    if kind_typed == "insert":
        if start != end:
            return None, "insert 的 start 必须等于 end"
        if not text_value:
            return None, "insert 的 text 为空"
    else:
        if start == end:
            return None, f"{kind_typed} 的区间为空"
        if kind_typed == "replace" and not text_value:
            return None, "replace 的 text 为空"
        if kind_typed == "delete" and text_value:
            return None, "delete 不应带 text"
    # 锚点三态,刻意分开:
    # - 缺失或显式 null ⇒ None = "我不比对"(契约第 8 条承诺的跳过档,旧输出零变化);
    # - 字符串 ⇒ 收下,交给后面与文档切片比对;
    # - 其他类型(数字/布尔/对象)⇒ 丢弃本条:契约只承诺了"跳过"这一种豁免,
    #   把"模型给了个不可比对的 anchor"当成"没给"是把契约违规静默吞掉,
    #   而它本该和其它非法字段一样被逐条丢弃并点名。
    raw_anchor = raw.get("anchor")
    if raw_anchor is None:
        anchor_value: str | None = None
    elif isinstance(raw_anchor, str):
        anchor_value = raw_anchor
    else:
        return None, f"anchor 不是字符串: {raw_anchor!r}"
    return EditAction(
        kind=kind_typed, start=start, end=end, text=text_value, anchor=anchor_value
    ), None


def validate_anchor(action: EditAction, document: str) -> str | None:
    """锚点比对:模型声明的 [start,end) 当前原文 vs 文档实际切片;不等返回丢弃原因。

    **anchor 为 None ⇒ 不比对**(模型没声明,就不替它猜)—— 这是旧调用方与旧
    模型输出零行为变化的那一格:不声明 anchor 的输入路径与接线前逐字同。

    为什么这条值得单独立一格:区间算错位置是最难归因的一类脏数据 —— 它不越界、
    结构全合法、单条校验百分之百通过,顺着执行下去就把改动打到文档的另一处,
    事后只能看到"改错了地方"。拿模型自己声明的原文去对文档切片,是把"区间对不对"
    从**凭信任**变成**可证**;对不上就丢弃并点名,而不是静默按它执行。

    insert 不参与:它的区间是空区间,切片恒为空串,比对没有信息量。
    """
    if action.anchor is None or action.kind == "insert":
        return None
    actual = document[action.start : action.end]
    if actual != action.anchor:
        return (
            f"anchor_mismatch(区间内实际是 {actual!r},模型声明的是 {action.anchor!r})"
        )
    return None


def find_range_conflict(action: EditAction, accepted: list[EditAction]) -> str | None:
    """本条与**已接受**动作的区间冲突;无冲突返回 None。

    契约(prompt 第 7 条)向模型要的是 "disjoint ranges",而单条校验是逐条独立的
    —— 它结构上不可能看见另一条。契约承诺了却无人守,等于没承诺(这也是本票
    票面点名"判据缺重叠区间"那一格的成因)。

    两型冲突,各有理由,分开点名便于事后归因:
    - 区间相交:两条各自合法,但执行结果**依赖执行顺序**(先删后替 与 先替后删
      落点不同),而模型给的数组顺序不是它承诺过的语义 ⇒ 照单执行就是在赌一个
      没有定义的顺序;
    - 两条 insert 落在同一点:空区间按定义不相交,但同点插入谁先谁后得到的
      文本不同,同样是未定义顺序。
    """
    for other in accepted:
        if max(action.start, other.start) < min(action.end, other.end):
            return f"与已接受动作 [{other.start},{other.end}) 区间相交"
        if action.kind == "insert" and other.kind == "insert" and action.start == other.start:
            return f"与已接受动作在 {action.start} 处重复插入"
    return None


def cast_kind(kind: object) -> EditActionKind:
    """把已验过成员关系的 kind 收窄为字面量类型。

    mypy 无法从 `kind in EDIT_ACTION_KINDS` 反推 `Literal`,故显式一次映射;
    非成员值在调用方已被丢弃,这里再兜一次而不是 assert(断言崩栈不如判不出)。
    """
    if kind == "insert":
        return "insert"
    if kind == "replace":
        return "replace"
    return "delete"


def interpret_model_output(
    raw: str, *, document_length: int, document: str | None = None
) -> EditIntentOutcome:
    """模型原文 → 三态判定(本模块唯一对外判定出口)。

    ``document`` 是本票新加的**可选**入参:给了才做第二轮判据(区间冲突 + 锚点
    比对),不给 ⇒ 行为与接线前逐字同(现网凡是不传的调用方零行为变化)。
    为什么必须是可选而不是必填:本判定出口的调用方不止一个,强改签名会让"拿不到
    文档原文"的那一路要么传空串(那会把每条动作都误判成锚点不符)要么就地崩;
    宁可不判,也不许拿错的文档去判 —— 与 UndeterminedReason 那一族同一条失效方向。
    """
    payload, parse_reason = extract_json_payload(raw)
    if payload is None:
        logger.info("edit-intent 解析失败: %s", parse_reason)
        return EditIntentOutcome(disposition="undetermined", reason="parse_failed")
    items, list_reason = _coerce_action_list(payload)
    if items is None:
        logger.info("edit-intent 结构不合契约: %s", list_reason)
        return EditIntentOutcome(disposition="undetermined", reason="parse_failed")
    if not items:
        # 模型明说没有编辑意图 —— 这是判出来的结论,不是"没判"
        return EditIntentOutcome(disposition="no_action")

    actions: list[EditAction] = []
    dropped: list[DroppedAction] = []
    for index, item in enumerate(items):
        if index >= MAX_ACTIONS:
            dropped.append(
                DroppedAction(index=index, reason="action_budget_exceeded", detail=f"超过单次上限 {MAX_ACTIONS}")
            )
            continue
        action, reject_reason = validate_action(item, document_length=document_length)
        if action is None:
            dropped.append(DroppedAction(index=index, reason=reject_reason or "invalid_action"))
            continue
        # 第二轮:区间冲突(契约第 7 条 promise 了 disjoint,校验侧此前从未判过)
        conflict = find_range_conflict(action, actions)
        if conflict is not None:
            dropped.append(DroppedAction(index=index, reason="overlapping_range", detail=conflict))
            continue
        # 第三轮:锚点比对(仅在拿得到文档原文、且模型声明了 anchor 时)
        if document is not None:
            anchor_reason = validate_anchor(action, document)
            if anchor_reason is not None:
                dropped.append(DroppedAction(index=index, reason=anchor_reason))
                continue
        actions.append(action)

    if not actions:
        # 有动作、但一条都不成立:这是判定的失败,不是"没有编辑意图"
        return EditIntentOutcome(disposition="undetermined", reason="all_actions_rejected", dropped=dropped)
    return EditIntentOutcome(disposition="suggested", actions=actions, dropped=dropped)


def classify_gateway_result(result: Mapping[str, object]) -> UndeterminedReason | None:
    """网关返回值 → 失败原因(None = 这次调用本身可用)。

    三类敞口必须分别可分辨,不得都写成"模型不可用":
      - stub 模式(未配置任何凭据时网关自造回复)与 `MODEL_NOT_CONFIGURED` ⇒ `no_credentials`
      - 其余 error(含 `LLM_ERROR` / `PROVIDER_NOT_IMPLEMENTED` / 额度穷尽)⇒ `model_unavailable`
    """
    if result.get("error"):
        code = result.get("errorCode") or result.get("error_code")
        message = str(result.get("error_message") or "")
        if code == "MODEL_NOT_CONFIGURED" or "未配置" in message:
            return "no_credentials"
        return "model_unavailable"
    if result.get("stub"):
        return "no_credentials"
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
