# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""受限策略表达式求值器 —— 遵循统一工程规范。

## 取证依据（2026-11-15，Round 10 补做，craft-anything `--deep` 实跑）

对 `codex-command-runner.exe` 与 `codex-code-mode-host.exe` 跑
`native-rust-binary-show`，两者均检出：

```
starlark         0.14.2   ×212
starlark_map     0.14.2   ×4
starlark_syntax  0.14.2   ×12
```

`strength: strong`。⇒ Codex 的 `execpolicy` 用 **Starlark**（Bazel 的策略语言）
写规则，而不是纯数据格式。

## 为什么本仓需要它

本仓 `app/core/exec_policy_decision.py` / `command_policy_merge.py` 的策略面是
**TOML + 扁平规则表**：能表达「命令前缀 == X ⇒ deny」，但表达不了

```
host == "registry.npmjs.org" and user in TRUSTED_USERS and not is_prod
```

这类**条件策略**。TOML 是声明式数据，没有控制流；这正是 Codex 选 Starlark 的
原因 —— 它有 `if` / 布尔运算 / 成员测试，同时**没有副作用、没有 IO、可静态分析**。

## 为什么不直接移植 Starlark

完整 Starlark 解释器（`starlark` crate 的 Python 等价物）代价过高：词法、语法、
作用域、求值、错误模型全要重写，且引入的解析器本身就是新攻击面。
本仓只需要「条件表达式」这一小块，不需要函数定义、循环、导入、推导式。

⇒ 本模块实现 **Starlark 表达式子集**：布尔运算 + 比较 + 成员测试 + 字面量 + 变量引用。

## 安全设计（本模块的第一原则）

**绝不调用 `eval` / `exec` / `ast.literal_eval` 处理用户输入。** 手写词法 + 递归下降，
求值器只认自己构造的 AST。在此之上设六道闸：

1. **无属性访问** —— `.` 一律判非法。这是防 `().__class__.__bases__` 类逃逸的根本手段，
   比任何黑名单都可靠。
2. **无函数调用** —— `(` 只用于分组。没有调用就没有 `__import__` / `getattr` 的落点。
3. **变量只从显式环境取值** —— 只有调用方 `PolicyEnv` 注入的键可见，取不到就是
   `UNDETERMINED`（不是 `False`，见下）。
4. **规模上限** —— 表达式长度、token 数、嵌套深度三道上限，防解析期 DoS。
5. **不做隐式类型转换** —— `True == 1` 为 `False`。Python 的 `bool ⊂ int` 会让策略
   出现「`flag == 1` 意外命中」，这在安全判据里是真实缺陷。
6. **不吞异常** —— 求值期任何意外都转成 `UNDETERMINED` 并留痕，绝不返回 `False`
   冒充「条件不成立」（那会让 deny 规则静默失效）。

## 三态语义（与仓规 §0.3 同源）

求值结果是三态而非布尔：

| 状态 | 含义 | 调用方应如何处置 |
|---|---|---|
| `TRUE` | 条件成立 | 规则命中 |
| `FALSE` | 条件确定不成立 | 规则不命中 |
| `UNDETERMINED` | 认不出的语法 / 缺失变量 / 类型不可比 | **不猜**：不当命中、也不当不命中，按「本条件未判定」上报 |

`UNDETERMINED` 与 `FALSE` 必须分开：把「不知道」写成「不成立」会让 deny 规则
静默失效（本仓 §0.3 反复强调的那一型失真）。

## 显式不做（有据跳过）

- 函数定义 / lambda / 循环 / 推导式：策略条件不需要控制流。
- 导入 / 属性访问 / 下标（除 list 字面量的成员测试）：全是逃逸面。
- 字符串方法（`.startswith` 等）：需要属性访问，已拒。等价的
  `"x" in s` 子串测试足够表达绝大多数策略。
- 与 Starlark 的完整语法兼容：本模块是**语义子集**，不承诺接受任意 Starlark。
  对侧策略若要完整迁移，需按本模块支持面重写（这是有意的成本，换取可审计）。
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final

# ---------- 规模上限（防解析期 DoS） ----------

MAX_EXPRESSION_CHARS: Final[int] = 4096
MAX_TOKENS: Final[int] = 512
MAX_DEPTH: Final[int] = 32
MAX_LIST_ITEMS: Final[int] = 64


class EvalState(StrEnum):
    """三态求值结果（见模块 docstring §三态语义）。"""

    TRUE = "true"
    FALSE = "false"
    UNDETERMINED = "undetermined"


class ExprError(StrEnum):
    """编译期错误码（每一条都对应一个具体拒绝理由，便于排障）。"""

    TOO_LONG = "too_long"
    TOO_MANY_TOKENS = "too_many_tokens"
    TOO_DEEP = "too_deep"
    UNEXPECTED_CHAR = "unexpected_char"
    UNTERMINATED_STRING = "unterminated_string"
    UNEXPECTED_TOKEN = "unexpected_token"
    UNEXPECTED_END = "unexpected_end"
    ATTRIBUTE_ACCESS_FORBIDDEN = "attribute_access_forbidden"
    CALL_FORBIDDEN = "call_forbidden"
    EMPTY_EXPRESSION = "empty_expression"
    TOO_MANY_LIST_ITEMS = "too_many_list_items"


# ---------- 词法 ----------


class TokenKind(StrEnum):
    IDENT = "ident"
    STRING = "string"
    NUMBER = "number"
    LPAREN = "lparen"
    RPAREN = "rparen"
    LBRACKET = "lbracket"
    RBRACKET = "rbracket"
    COMMA = "comma"
    DOT = "dot"
    OP = "op"
    EOF = "eof"


@dataclass(frozen=True)
class Token:
    kind: TokenKind
    text: str
    value: object = None


_KEYWORDS: Final[frozenset[str]] = frozenset({"and", "or", "not", "in", "true", "false", "none"})
_TWO_CHAR_OPS: Final[frozenset[str]] = frozenset({"==", "!=", "<=", ">="})
_ONE_CHAR_OPS: Final[frozenset[str]] = frozenset({"<", ">"})


@dataclass(frozen=True)
class CompileError:
    """编译失败的结构化理由（不抛异常，交调用方决定如何上报）。"""

    code: ExprError
    detail: str
    position: int = 0

    def to_explanation(self) -> str:
        return f"[{self.code}] {self.detail}（位置 {self.position}）"


def tokenize(source: str) -> tuple[list[Token], CompileError | None]:
    """把表达式切成 token。失败返回 `(已切出的部分, 错误)`，绝不抛异常。"""
    if not isinstance(source, str):
        return [], CompileError(ExprError.UNEXPECTED_CHAR, f"表达式须为字符串，实得 {type(source).__name__}")
    if len(source) > MAX_EXPRESSION_CHARS:
        return [], CompileError(
            ExprError.TOO_LONG, f"表达式 {len(source)} 字符，超过上限 {MAX_EXPRESSION_CHARS}"
        )
    tokens: list[Token] = []
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch in " \t\r\n":
            i += 1
            continue
        # 字符串字面量：只支持单双引号、无转义（策略里不需要转义，减少歧义面）
        if ch in ("'", '"'):
            quote = ch
            j = i + 1
            buf: list[str] = []
            closed = False
            while j < n:
                if source[j] == quote:
                    closed = True
                    break
                buf.append(source[j])
                j += 1
            if not closed:
                return tokens, CompileError(
                    ExprError.UNTERMINATED_STRING, "字符串字面量未闭合", i
                )
            tokens.append(Token(TokenKind.STRING, source[i : j + 1], "".join(buf)))
            i = j + 1
            continue
        # 数字：只支持非负整数（策略条件是标志位/端口/计数，不需要浮点与负数）
        if ch.isdigit():
            j = i
            while j < n and source[j].isdigit():
                j += 1
            if j < n and (source[j].isalpha() or source[j] == "_"):
                return tokens, CompileError(
                    ExprError.UNEXPECTED_CHAR, f"数字后紧跟标识符字符 {source[j]!r}（不支持单位后缀）", j
                )
            tokens.append(Token(TokenKind.NUMBER, source[i:j], int(source[i:j])))
            i = j
            continue
        # 标识符 / 关键字
        if ch.isalpha() or ch == "_":
            j = i
            while j < n and (source[j].isalnum() or source[j] == "_"):
                j += 1
            word = source[i:j]
            low = word.lower()
            if low in _KEYWORDS:
                tokens.append(Token(TokenKind.OP if low in {"and", "or", "not", "in"} else TokenKind.IDENT, low))
            else:
                tokens.append(Token(TokenKind.IDENT, word))
            i = j
            continue
        # 括号与逗号
        single = {
            "(": TokenKind.LPAREN,
            ")": TokenKind.RPAREN,
            "[": TokenKind.LBRACKET,
            "]": TokenKind.RBRACKET,
            ",": TokenKind.COMMA,
            ".": TokenKind.DOT,
        }
        if ch in single:
            tokens.append(Token(single[ch], ch))
            i += 1
            continue
        # 双字符运算符先于单字符
        two = source[i : i + 2]
        if two in _TWO_CHAR_OPS:
            tokens.append(Token(TokenKind.OP, two))
            i += 2
            continue
        if ch in _ONE_CHAR_OPS:
            tokens.append(Token(TokenKind.OP, ch))
            i += 1
            continue
        return tokens, CompileError(ExprError.UNEXPECTED_CHAR, f"不认识的字符 {ch!r}", i)
    tokens.append(Token(TokenKind.EOF, ""))
    if len(tokens) > MAX_TOKENS:
        return tokens, CompileError(
            ExprError.TOO_MANY_TOKENS, f"token 数 {len(tokens)}，超过上限 {MAX_TOKENS}"
        )
    return tokens, None


# ---------- AST ----------


class NodeKind(StrEnum):
    LITERAL = "literal"
    VAR = "var"
    NOT = "not"
    AND = "and"
    OR = "or"
    COMPARE = "compare"
    IN = "in"
    LIST = "list"


@dataclass(frozen=True)
class Node:
    kind: NodeKind
    value: object = None
    left: Node | None = None
    right: Node | None = None
    items: tuple[Node, ...] = ()
    op: str = ""


class _Parser:
    """递归下降解析器。运算符优先级（低 → 高）：or < and < not < 比较/成员 < 原子。"""

    def __init__(self, tokens: list[Token]) -> None:
        self._t = tokens
        self._i = 0
        self._depth = 0

    def _peek(self) -> Token:
        return self._t[self._i]

    def _advance(self) -> Token:
        tok = self._t[self._i]
        self._i += 1
        return tok

    def _enter(self) -> CompileError | None:
        self._depth += 1
        if self._depth > MAX_DEPTH:
            return CompileError(ExprError.TOO_DEEP, f"嵌套深度超过 {MAX_DEPTH}")
        return None

    def _leave(self) -> None:
        self._depth -= 1

    def parse(self) -> tuple[Node | None, CompileError | None]:
        node, err = self._parse_or()
        if err is not None:
            return None, err
        if self._peek().kind is not TokenKind.EOF:
            tok = self._peek()
            # 逃逸向量要给出**准确的**拒绝码，不能笼统报「多余 token」：
            # 错误码是可审计信号，'host.startswith(...)' 报 unexpected_token
            # 会让审计者以为只是语法笔误，看不出这是一次越权尝试。
            if tok.kind is TokenKind.DOT:
                return None, CompileError(
                    ExprError.ATTRIBUTE_ACCESS_FORBIDDEN,
                    "策略表达式禁止属性访问（'.'）——这是防沙箱逃逸的硬约束",
                    self._i,
                )
            if tok.kind is TokenKind.LPAREN:
                return None, CompileError(
                    ExprError.CALL_FORBIDDEN,
                    "策略表达式禁止函数调用（'(' 仅可用于分组）",
                    self._i,
                )
            return None, CompileError(
                ExprError.UNEXPECTED_TOKEN, f"表达式结束后仍有多余 token {tok.text!r}", self._i
            )
        return node, None

    def _parse_or(self) -> tuple[Node | None, CompileError | None]:
        left, err = self._parse_and()
        if err is not None:
            return None, err
        while self._peek().kind is TokenKind.OP and self._peek().text == "or":
            self._advance()
            right, err = self._parse_and()
            if err is not None:
                return None, err
            left = Node(NodeKind.OR, left=left, right=right)
        return left, None

    def _parse_and(self) -> tuple[Node | None, CompileError | None]:
        left, err = self._parse_not()
        if err is not None:
            return None, err
        while self._peek().kind is TokenKind.OP and self._peek().text == "and":
            self._advance()
            right, err = self._parse_not()
            if err is not None:
                return None, err
            left = Node(NodeKind.AND, left=left, right=right)
        return left, None

    def _parse_not(self) -> tuple[Node | None, CompileError | None]:
        if self._peek().kind is TokenKind.OP and self._peek().text == "not":
            self._advance()
            err = self._enter()
            if err is not None:
                return None, err
            operand, err2 = self._parse_not()
            self._leave()
            if err2 is not None:
                return None, err2
            return Node(NodeKind.NOT, left=operand), None
        return self._parse_comparison()

    def _parse_comparison(self) -> tuple[Node | None, CompileError | None]:
        left, err = self._parse_atom()
        if err is not None:
            return None, err
        while True:
            tok = self._peek()
            if tok.kind is TokenKind.OP and tok.text in {"==", "!=", "<", ">", "<=", ">="}:
                self._advance()
                right, err = self._parse_atom()
                if err is not None:
                    return None, err
                left = Node(NodeKind.COMPARE, left=left, right=right, op=tok.text)
                continue
            if tok.kind is TokenKind.OP and tok.text == "in":
                self._advance()
                right, err = self._parse_atom()
                if err is not None:
                    return None, err
                left = Node(NodeKind.IN, left=left, right=right)
                continue
            return left, None

    def _parse_atom(self) -> tuple[Node | None, CompileError | None]:
        err = self._enter()
        if err is not None:
            return None, err
        try:
            tok = self._peek()
            # 属性访问：一律拒绝（防 __class__ 逃逸的根本手段）
            if tok.kind is TokenKind.DOT:
                return None, CompileError(
                    ExprError.ATTRIBUTE_ACCESS_FORBIDDEN,
                    "策略表达式禁止属性访问（'.'）——这是防沙箱逃逸的硬约束",
                    self._i,
                )
            if tok.kind is TokenKind.LPAREN:
                self._advance()
                inner, err2 = self._parse_or()
                if err2 is not None:
                    return None, err2
                if self._peek().kind is not TokenKind.RPAREN:
                    # 括号后紧跟原子 ⇒ 调用语法；明确拒绝而不是误报缺括号
                    return None, CompileError(
                        ExprError.CALL_FORBIDDEN,
                        "策略表达式禁止函数调用（'(' 仅可用于分组）",
                        self._i,
                    )
                self._advance()
                # 分组后若还有 '(' ⇒ 仍在尝试调用
                if self._peek().kind is TokenKind.LPAREN:
                    return None, CompileError(
                        ExprError.CALL_FORBIDDEN, "策略表达式禁止函数调用", self._i
                    )
                return inner, None
            if tok.kind is TokenKind.LBRACKET:
                self._advance()
                items: list[Node] = []
                if self._peek().kind is not TokenKind.RBRACKET:
                    while True:
                        item, err2 = self._parse_atom()
                        if err2 is not None:
                            return None, err2
                        if item is None:
                            return None, CompileError(
                                ExprError.CALL_FORBIDDEN, "列表字面量含不可解析项", self._i
                            )
                        items.append(item)
                        if len(items) > MAX_LIST_ITEMS:
                            return None, CompileError(
                                ExprError.TOO_MANY_LIST_ITEMS,
                                f"列表字面量超过 {MAX_LIST_ITEMS} 项",
                                self._i,
                            )
                        if self._peek().kind is TokenKind.COMMA:
                            self._advance()
                            continue
                        break
                if self._peek().kind is not TokenKind.RBRACKET:
                    return None, CompileError(ExprError.UNEXPECTED_TOKEN, "列表缺少 ']'", self._i)
                self._advance()
                return Node(NodeKind.LIST, items=tuple(items)), None
            if tok.kind is TokenKind.STRING:
                self._advance()
                return Node(NodeKind.LITERAL, value=tok.value), None
            if tok.kind is TokenKind.NUMBER:
                self._advance()
                return Node(NodeKind.LITERAL, value=tok.value), None
            if tok.kind is TokenKind.IDENT:
                self._advance()
                low = tok.text.lower()
                if low == "true":
                    return Node(NodeKind.LITERAL, value=True), None
                if low == "false":
                    return Node(NodeKind.LITERAL, value=False), None
                if low == "none":
                    return Node(NodeKind.LITERAL, value=None), None
                return Node(NodeKind.VAR, value=tok.text), None
            if tok.kind is TokenKind.EOF:
                return None, CompileError(ExprError.UNEXPECTED_END, "表达式意外结束", self._i)
            return None, CompileError(
                ExprError.UNEXPECTED_TOKEN, f"此处不应出现 {tok.text!r}", self._i
            )
        finally:
            self._leave()


@dataclass(frozen=True)
class CompiledPolicy:
    """编译成功的策略表达式。`source` 保留原文用于留痕与对账。"""

    source: str
    root: Node
    token_count: int


# ---------- 求值 ----------


@dataclass(frozen=True)
class PolicyEnv:
    """求值环境：**只有这里显式注入的键可见**。"""

    values: Mapping[str, object] = field(default_factory=dict)

    def get(self, name: str) -> tuple[bool, object]:
        if name in self.values:
            return True, self.values[name]
        return False, None


@dataclass(frozen=True)
class EvalResult:
    """三态结果 + 留痕。`trail` 记录每个 UNDETERMINED 的理由。"""

    state: EvalState
    trail: tuple[str, ...] = ()

    @property
    def is_true(self) -> bool:
        return self.state is EvalState.TRUE

    def to_explanation(self) -> str:
        if not self.trail:
            return f"state={self.state}"
        return f"state={self.state}；" + " | ".join(self.trail)


def _type_tag(v: object) -> str:
    if v is None:
        return "none"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, str):
        return "str"
    if isinstance(v, (list, tuple)):
        return "list"
    return type(v).__name__


def _comparable(a: object, b: object) -> bool:
    """bool 与 int 视为不可比：Python 里 True == 1 会让策略误命中。"""
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    return _type_tag(a) == _type_tag(b)


class _Evaluator:
    def __init__(self, env: PolicyEnv) -> None:
        self._env = env
        self._trail: list[str] = []

    def _undet(self, reason: str) -> EvalState:
        self._trail.append(reason)
        return EvalState.UNDETERMINED

    def _eval_node(self, node: Node) -> tuple[EvalState, object]:
        kind = node.kind
        if kind is NodeKind.LITERAL:
            return EvalState.TRUE, node.value
        if kind is NodeKind.LIST:
            vals = []
            for item in node.items:
                st, v = self._eval_node(item)
                if st is not EvalState.TRUE:
                    return st, None
                vals.append(v)
            return EvalState.TRUE, vals
        if kind is NodeKind.VAR:
            found, val = self._env.get(str(node.value))
            if not found:
                return self._undet(f"变量 {node.value!r} 未注入环境"), None
            return EvalState.TRUE, val
        if kind is NodeKind.NOT:
            st, v = self._eval_node(node.left)  # type: ignore[arg-type]
            if st is not EvalState.TRUE:
                return st, None
            if not isinstance(v, bool):
                return self._undet(f"'not' 的操作数须为 bool，实得 {_type_tag(v)}"), None
            return EvalState.TRUE, (not v)
        if kind is NodeKind.AND:
            st_l, v_l = self._eval_node(node.left)  # type: ignore[arg-type]
            if st_l is EvalState.TRUE and isinstance(v_l, bool) and not v_l:
                return EvalState.FALSE, False
            st_r, v_r = self._eval_node(node.right)  # type: ignore[arg-type]
            if st_r is EvalState.TRUE and isinstance(v_r, bool) and not v_r:
                return EvalState.FALSE, False
            if st_l is not EvalState.TRUE or st_r is not EvalState.TRUE:
                return EvalState.UNDETERMINED, None
            for label, v in (("左", v_l), ("右", v_r)):
                if not isinstance(v, bool):
                    return self._undet(
                        f"'and' 的{label}操作数须为 bool，实得 {_type_tag(v)}"
                    ), None
            return EvalState.TRUE, (bool(v_l) and bool(v_r))
        if kind is NodeKind.OR:
            st_l, v_l = self._eval_node(node.left)  # type: ignore[arg-type]
            if st_l is EvalState.TRUE and isinstance(v_l, bool) and v_l:
                return EvalState.TRUE, True
            st_r, v_r = self._eval_node(node.right)  # type: ignore[arg-type]
            if st_r is EvalState.TRUE and isinstance(v_r, bool) and v_r:
                return EvalState.TRUE, True
            if st_l is not EvalState.TRUE or st_r is not EvalState.TRUE:
                return EvalState.UNDETERMINED, None
            for label, v in (("左", v_l), ("右", v_r)):
                if not isinstance(v, bool):
                    return self._undet(
                        f"'or' 的{label}操作数须为 bool，实得 {_type_tag(v)}"
                    ), None
            return EvalState.TRUE, False
        return self._eval_membership_or_compare(node)

    def _eval_membership_or_compare(self, node: Node) -> tuple[EvalState, object]:
        kind = node.kind
        if kind is NodeKind.IN:
            st_l, v_l = self._eval_node(node.left)  # type: ignore[arg-type]
            if st_l is not EvalState.TRUE:
                return st_l, None
            st_r, v_r = self._eval_node(node.right)  # type: ignore[arg-type]
            if st_r is not EvalState.TRUE:
                return st_r, None
            if isinstance(v_r, str):
                if not isinstance(v_l, str):
                    return self._undet(
                        f"子串测试左值须为 str，实得 {_type_tag(v_l)}"
                    ), None
                return EvalState.TRUE, (v_l in v_r)
            if isinstance(v_r, (list, tuple)):
                hit = any(_comparable(v_l, it) and v_l == it for it in v_r)
                return EvalState.TRUE, hit
            if isinstance(v_r, Mapping):
                if not isinstance(v_l, str):
                    return self._undet("字典键测试左值须为 str"), None
                return EvalState.TRUE, (v_l in v_r)
            return self._undet(
                f"'in' 右值须为 str/list/dict，实得 {_type_tag(v_r)}"
            ), None
        if kind is NodeKind.COMPARE:
            st_l, v_l = self._eval_node(node.left)  # type: ignore[arg-type]
            if st_l is not EvalState.TRUE:
                return st_l, None
            st_r, v_r = self._eval_node(node.right)  # type: ignore[arg-type]
            if st_r is not EvalState.TRUE:
                return st_r, None
            return self._compare(node.op, v_l, v_r)
        return self._undet(f"未知节点类型 {kind}"), None

    def _compare(self, op: str, v_l: object, v_r: object) -> tuple[EvalState, object]:
        if op in ("==", "!="):
            if not _comparable(v_l, v_r):
                # 类型不同 ⇒ 确定不相等（不猜）
                return EvalState.TRUE, (op == "!=")
            return EvalState.TRUE, (v_l == v_r) if op == "==" else (v_l != v_r)
        if not _comparable(v_l, v_r) or isinstance(v_l, bool):
            return self._undet(
                f"有序比较要求同类型 int/str，实得 {_type_tag(v_l)} 与 {_type_tag(v_r)}"
            ), None
        try:
            if op == "<":
                return EvalState.TRUE, (v_l < v_r)  # type: ignore[operator]
            if op == ">":
                return EvalState.TRUE, (v_l > v_r)  # type: ignore[operator]
            if op == "<=":
                return EvalState.TRUE, (v_l <= v_r)  # type: ignore[operator]
            if op == ">=":
                return EvalState.TRUE, (v_l >= v_r)  # type: ignore[operator]
        except TypeError as exc:
            return self._undet(f"有序比较失败: {exc}"), None
        return self._undet(f"未知比较运算符 {op!r}"), None


# ---------- 公开入口 ----------


def compile_policy(source: str) -> tuple[CompiledPolicy | None, CompileError | None]:
    """编译策略表达式。失败返回 `(None, CompileError)`，**不抛异常**。"""
    tokens, lex_err = tokenize(source)
    if lex_err is not None:
        return None, lex_err
    if len(tokens) <= 1:
        return None, CompileError(ExprError.EMPTY_EXPRESSION, "表达式为空")
    root, parse_err = _Parser(tokens).parse()
    if parse_err is not None:
        return None, parse_err
    if root is None:
        return None, CompileError(ExprError.EMPTY_EXPRESSION, "解析未产出表达式")
    return CompiledPolicy(source=source, root=root, token_count=len(tokens) - 1), None


def evaluate_policy(policy: CompiledPolicy, env: PolicyEnv) -> EvalResult:
    """求值已编译的策略。顶层结果必须是 bool，否则判 UNDETERMINED。"""
    ev = _Evaluator(env)
    try:
        state, value = ev._eval_node(policy.root)
    except Exception as exc:
        return EvalResult(
            state=EvalState.UNDETERMINED,
            trail=(f"求值异常（已兜底判未判定）: {type(exc).__name__}: {exc}",),
        )
    if state is not EvalState.TRUE:
        return EvalResult(state=state, trail=tuple(ev._trail))
    if not isinstance(value, bool):
        ev._trail.append(f"顶层结果须为 bool，实得 {_type_tag(value)}")
        return EvalResult(state=EvalState.UNDETERMINED, trail=tuple(ev._trail))
    return EvalResult(
        state=EvalState.TRUE if value else EvalState.FALSE, trail=tuple(ev._trail)
    )


def evaluate_source(source: str, env: PolicyEnv) -> tuple[EvalResult, CompileError | None]:
    """编译并求值的一站式入口。**编译失败返回 UNDETERMINED，不是 FALSE。**"""
    policy, err = compile_policy(source)
    if err is not None:
        return EvalResult(state=EvalState.UNDETERMINED, trail=(err.to_explanation(),)), err
    if policy is None:
        return (
            EvalResult(state=EvalState.UNDETERMINED, trail=("编译未产出策略",)),
            CompileError(ExprError.CALL_FORBIDDEN, "编译未产出策略", 0),
        )
    return evaluate_policy(policy, env), None


__all__ = [
    "ExampleCase",
    "MAX_DEPTH",
    "MAX_EXPRESSION_CHARS",
    "MAX_LIST_ITEMS",
    "MAX_TOKENS",
    "CompileError",
    "CompiledPolicy",
    "EvalResult",
    "EvalState",
    "ExprError",
    "Node",
    "NodeKind",
    "POLICY_DECISION_WIRE",
    "PolicyDecision",
    "PolicyEnv",
    "SelfTestFailure",
    "SelfTestResult",
    "Token",
    "TokenKind",
    "assert_policy",
    "compile_policy",
    "evaluate_policy",
    "evaluate_source",
    "parse_policy_decision",
    "policy_decision_to_three",
    "run_policy_self_test",
    "tokenize",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# ---------- 策略内建自测（遵循统一工程规范）----------
#
# 取证依据：`codex-command-runner.exe` 的 .rdata 内可见
#   "expected every example to match at least one rule. rules: ... ; unmatched examples: ..."
#   "expected example to not match rule `...`"
#   "ExampleDidMatch" / "ExampleDidNotMatch" / "InvalidExample"
# ⇒ 对侧策略可携带正例（match）与反例（not_match），**加载时机器自检**。
# 本仓现状是策略正确性只能靠外部 pytest，策略本身无法自证。此函数补上这一块。


class SelfTestFailure(StrEnum):
    """自测失败类别（逐条可定位，不汇成一个布尔）。"""

    EXPECTED_TRUE_GOT_FALSE = "expected_true_got_false"
    EXPECTED_TRUE_GOT_UNDETERMINED = "expected_true_got_undetermined"
    EXPECTED_FALSE_GOT_TRUE = "expected_false_got_true"
    EXPECTED_FALSE_GOT_UNDETERMINED = "expected_false_got_undetermined"


@dataclass(frozen=True)
class ExampleCase:
    """一条自测用例：`env` 下求值，期望状态为 `expect`。"""

    label: str
    env: PolicyEnv
    expect: EvalState


@dataclass(frozen=True)
class SelfTestResult:
    """自测结论。`ok` 为真当且仅当全部用例符合预期。"""

    ok: bool
    failures: tuple[tuple[str, SelfTestFailure, str], ...] = ()

    def to_explanation(self) -> str:
        if self.ok:
            return "策略自测通过"
        lines = [f"策略自测失败 {len(self.failures)} 项:"]
        for label, kind, detail in self.failures:
            lines.append(f"  - [{label}] {kind}: {detail}")
        return "\n".join(lines)


def run_policy_self_test(
    policy: CompiledPolicy, cases: Sequence[ExampleCase]
) -> SelfTestResult:
    """对已编译策略跑正反例自测（对齐对侧 `match` / `not_match`）。

    设计取向与对侧一致：**任一用例不符即整体失败**，且失败项逐条留痕
    （对侧文案 `expected example to not match rule` 是单条报错，本仓给全量列表）。

    与对侧的差异（本仓超越）：
      - 区分「期望 TRUE 得到 UNDETERMINED」与「期望 TRUE 得到 FALSE」——
        前者是**装配问题**（变量没注入），后者是**策略写错**，排障方向完全不同。
      - 空用例集判 `ok=True` 但在 detail 注明「未提供用例」，不冒充「已验证」。
    """
    failures: list[tuple[str, SelfTestFailure, str]] = []
    for case in cases:
        res = evaluate_policy(policy, case.env)
        if case.expect is EvalState.TRUE:
            if res.state is EvalState.FALSE:
                failures.append(
                    (case.label, SelfTestFailure.EXPECTED_TRUE_GOT_FALSE, res.to_explanation())
                )
            elif res.state is EvalState.UNDETERMINED:
                failures.append(
                    (
                        case.label,
                        SelfTestFailure.EXPECTED_TRUE_GOT_UNDETERMINED,
                        res.to_explanation(),
                    )
                )
        elif case.expect is EvalState.FALSE:
            if res.state is EvalState.TRUE:
                failures.append(
                    (case.label, SelfTestFailure.EXPECTED_FALSE_GOT_TRUE, res.to_explanation())
                )
            elif res.state is EvalState.UNDETERMINED:
                failures.append(
                    (
                        case.label,
                        SelfTestFailure.EXPECTED_FALSE_GOT_UNDETERMINED,
                        res.to_explanation(),
                    )
                )
        else:
            # 期望 UNDETERMINED：只有真的未判定才算通过
            if res.state is not EvalState.UNDETERMINED:
                failures.append(
                    (
                        case.label,
                        SelfTestFailure.EXPECTED_FALSE_GOT_TRUE
                        if res.state is EvalState.TRUE
                        else SelfTestFailure.EXPECTED_TRUE_GOT_FALSE,
                        res.to_explanation(),
                    )
                )
    return SelfTestResult(ok=not failures, failures=tuple(failures))


def assert_policy(
    source: str,
    cases: Sequence[ExampleCase],
) -> tuple[SelfTestResult | None, CompileError | None]:
    """编译 + 自测的一站式断言。编译失败返回 `(None, CompileError)`。"""
    policy, err = compile_policy(source)
    if err is not None:
        return None, err
    if policy is None:  # pragma: no cover
        return None, CompileError(ExprError.EMPTY_EXPRESSION, "编译未产出策略")
    return run_policy_self_test(policy, cases), None


# ---------- 四值决策（遵循统一工程规范）----------
#
# 取证依据：`外部程序` 0x1166166b 窗口内可见字面序列
#   `PrefixRule` `Allow` `Prompt` `PromptUser` `Forbidden` `SingleAlts`
# 且 `codex-command-runner.exe` 的 rule.rs 窗口同样出现同一序列。
# ⇒ 对侧决策值域是**四值**，本仓 `Decision` 是三值（allow/prompt/forbidden）。
#
# 为什么不在 `Decision` 上直接加第四值：该枚举被 `exec_policy_decision` 的判定矩阵、
# `DECISION_STRICTNESS`、以及大量既有测试钉住，加值会波及现网语义。
# 因此在**策略层**提供四值视图，并给出到既有三值的**显式降级映射**。


class PolicyDecision(StrEnum):
    """策略层四值决策（对侧值域）。"""

    ALLOW = "allow"
    PROMPT = "prompt"
    PROMPT_USER = "prompt_user"
    FORBIDDEN = "forbidden"


def policy_decision_to_three(decision: PolicyDecision) -> str:
    """四值 → 既有三值的显式降级映射。

    `PROMPT_USER` 降级为 `prompt`：在既有三值契约里「必须人答」是「提示」的子集，
    降级方向恒为**更保守**（提示而非放行）。降级事实由调用方留痕。
    """
    if decision is PolicyDecision.ALLOW:
        return "allow"
    if decision is PolicyDecision.PROMPT:
        return "prompt"
    if decision is PolicyDecision.PROMPT_USER:
        return "prompt"
    return "forbidden"


# Codex 序列化用 deny 而非 forbidden（与 exec_policy_amendments 的 _DECISION_MAPPING 同源）
POLICY_DECISION_WIRE: Final[dict[PolicyDecision, str]] = {
    PolicyDecision.ALLOW: "allow",
    PolicyDecision.PROMPT: "prompt",
    PolicyDecision.PROMPT_USER: "prompt_user",
    PolicyDecision.FORBIDDEN: "deny",
}


def parse_policy_decision(raw: object) -> PolicyDecision | None:
    """解析四值决策（含别名）。认不出返回 None，**不回落默认值**。"""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower().replace("-", "_")
    aliases = {
        "allow": PolicyDecision.ALLOW,
        "prompt": PolicyDecision.PROMPT,
        "prompt_user": PolicyDecision.PROMPT_USER,
        "promptuser": PolicyDecision.PROMPT_USER,
        "forbidden": PolicyDecision.FORBIDDEN,
        "deny": PolicyDecision.FORBIDDEN,
    }
    return aliases.get(key)
