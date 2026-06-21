"""实时风控规则引擎(Bug-127)
表达式求值 + 规则优先级 + 命中追踪 + 滑动窗口累计
"""

from __future__ import annotations

import ast
import operator
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class RuleAction(StrEnum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REVIEW = "REVIEW"
    CHALLENGE = "CHALLENGE"
    SCORE = "SCORE"


class Operator(StrEnum):
    GT = ">"
    GTE = ">="
    LT = "<"
    LTE = "<="
    EQ = "=="
    NE = "!="
    IN = "IN"
    NOT_IN = "NOT_IN"
    CONTAINS = "CONTAINS"
    STARTS_WITH = "STARTS_WITH"
    ENDS_WITH = "ENDS_WITH"
    REGEX = "REGEX"


_BIN_OPS = {
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
}

_UNARY_OPS = {
    ast.Not: operator.not_,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


class SafeEvaluator:
    """受限表达式求值:支持 变量/字面量/二元/一元/三元/成员/in/not in/regex"""

    def __init__(self) -> None:
        self._vars: dict[str, Any] = {}

    def set_vars(self, vars: dict[str, Any]) -> None:
        self._vars = dict(vars)

    def evaluate(self, expr: str) -> Any:
        try:
            tree = ast.parse(expr, mode="eval")
        except SyntaxError as e:
            raise ValueError(f"表达式语法错误: {e}") from e
        return self._eval_node(tree.body)

    def _eval_node(self, node: ast.AST) -> Any:
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Name):
            if node.id in self._vars:
                return self._vars[node.id]
            if node.id in ("True", "False", "None"):
                return {"True": True, "False": False, "None": None}[node.id]
            return None
        if isinstance(node, ast.Num):
            return node.n
        if isinstance(node, ast.Str):
            return node.s
        if isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type in _UNARY_OPS:
                return _UNARY_OPS[op_type](self._eval_node(node.operand))
        if isinstance(node, ast.BinOp):
            return self._eval_binop(node)
        if isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                result = True
                for v in node.values:
                    result = self._eval_node(v)
                    if not result:
                        return result
                return result
            if isinstance(node.op, ast.Or):
                result = False
                for v in node.values:
                    result = self._eval_node(v)
                    if result:
                        return result
                return result
        if isinstance(node, ast.Compare):
            return self._eval_compare(node)
        if isinstance(node, ast.Call):
            return self._eval_call(node)
        if isinstance(node, ast.IfExp):
            test = self._eval_node(node.test)
            return self._eval_node(node.body) if test else self._eval_node(node.orelse)
        if isinstance(node, ast.List):
            return [self._eval_node(elt) for elt in node.elts]
        if isinstance(node, ast.Tuple):
            return tuple(self._eval_node(elt) for elt in node.elts)
        if isinstance(node, ast.Dict):
            return {self._eval_node(k): self._eval_node(v) for k, v in zip(node.keys, node.values, strict=True)}
        if isinstance(node, ast.Subscript):
            value = self._eval_node(node.value)
            key = self._eval_node(node.slice)
            try:
                return value[key]
            except (KeyError, IndexError, TypeError):
                return None
        if isinstance(node, ast.Attribute):
            value = self._eval_node(node.value)
            return getattr(value, node.attr, None)
        return None

    def _eval_binop(self, node: ast.BinOp) -> Any:
        left = self._eval_node(node.left)
        right = self._eval_node(node.right)
        op_type = type(node.op)
        if op_type in _BIN_OPS:
            try:
                return _BIN_OPS[op_type](left, right)
            except TypeError:
                return False
        if op_type is ast.Add:
            try:
                return left + right
            except TypeError:
                return str(left) + str(right)
        if op_type is ast.Sub:
            return left - right
        if op_type is ast.Mult:
            return left * right
        if op_type is ast.Div:
            return left / right if right != 0 else 0
        if op_type is ast.Mod:
            return left % right if right != 0 else 0
        return None

    def _eval_compare(self, node: ast.Compare) -> bool:
        left = self._eval_node(node.left)
        for op, comparator in zip(node.ops, node.comparators, strict=True):
            right = self._eval_node(comparator)
            op_type = type(op)
            if op_type in _BIN_OPS:
                try:
                    if not _BIN_OPS[op_type](left, right):
                        return False
                except TypeError:
                    return False
            elif op_type is ast.In:
                if left not in right:
                    return False
            elif op_type is ast.NotIn:
                if left in right:
                    return False
            elif op_type is ast.Is:
                if left is not right:
                    return False
            elif op_type is ast.IsNot and left is right:
                return False
            left = right
        return True

    def _eval_call(self, node: ast.Call) -> Any:
        if isinstance(node.func, ast.Name):
            fname = node.func.id
            if fname == "len":
                target = self._eval_node(node.args[0])
                return len(target) if target is not None else 0
            if fname == "abs":
                return abs(self._eval_node(node.args[0]))
            if fname == "min":
                args = [self._eval_node(a) for a in node.args]
                return min(*args) if args else None
            if fname == "max":
                args = [self._eval_node(a) for a in node.args]
                return max(*args) if args else None
            if fname == "int":
                return int(self._eval_node(node.args[0]))
            if fname == "float":
                return float(self._eval_node(node.args[0]))
            if fname == "str":
                return str(self._eval_node(node.args[0]))
            if fname == "lower":
                return str(self._eval_node(node.args[0])).lower()
            if fname == "upper":
                return str(self._eval_node(node.args[0])).upper()
            if fname == "starts_with":
                s = str(self._eval_node(node.args[0]))
                p = str(self._eval_node(node.args[1]))
                return s.startswith(p)
            if fname == "ends_with":
                s = str(self._eval_node(node.args[0]))
                p = str(self._eval_node(node.args[1]))
                return s.endswith(p)
            if fname == "contains":
                s = self._eval_node(node.args[0])
                p = self._eval_node(node.args[1])
                if s is None:
                    return False
                return p in s
            if fname == "regex":
                import re

                s = str(self._eval_node(node.args[0]))
                p = str(self._eval_node(node.args[1]))
                try:
                    return bool(re.search(p, s))
                except re.error:
                    return False
        return None


@dataclass
class RiskRule:
    rule_id: str
    name: str
    expression: str
    action: RuleAction = RuleAction.DENY
    priority: int = 100
    score: int = 0
    enabled: bool = True
    description: str = ""
    tags: list[str] = field(default_factory=list)
    window_sec: float = 0.0
    threshold: int = 0
    created_at: float = field(default_factory=time.time)


@dataclass
class HitRecord:
    rule_id: str
    subject_id: str
    action: RuleAction
    score: int
    expression: str
    matched_at: float
    context: dict[str, Any] = field(default_factory=dict)
    reason: str = ""


@dataclass
class EngineConfig:
    short_circuit: bool = True
    default_action: RuleAction = RuleAction.ALLOW
    max_hits: int = 10000
    enable_window_counter: bool = True


class RiskRuleEngine:
    """实时风控规则引擎"""

    def __init__(self, config: EngineConfig | None = None) -> None:
        self.config = config or EngineConfig()
        self._rules: dict[str, RiskRule] = {}
        self._evaluator = SafeEvaluator()
        self._lock = threading.RLock()
        self._hits: deque[HitRecord] = deque(maxlen=self.config.max_hits)
        self._window_counters: dict[tuple[str, str, str], deque[float]] = {}

    def add_rule(self, rule: RiskRule) -> None:
        with self._lock:
            self._rules[rule.rule_id] = rule
            if rule.window_sec > 0:
                self._window_counters[(rule.rule_id, "*", "*")] = deque()

    def remove_rule(self, rule_id: str) -> bool:
        with self._lock:
            return self._rules.pop(rule_id, None) is not None

    def enable_rule(self, rule_id: str, enabled: bool = True) -> bool:
        with self._lock:
            r = self._rules.get(rule_id)
            if r is None:
                return False
            r.enabled = enabled
            return True

    def get_rule(self, rule_id: str) -> RiskRule | None:
        with self._lock:
            return self._rules.get(rule_id)

    def list_rules(self) -> list[RiskRule]:
        with self._lock:
            return sorted(self._rules.values(), key=lambda r: (r.priority, r.rule_id))

    def _record_hit(self, rule: RiskRule, subject_id: str, context: dict[str, Any]) -> HitRecord:
        hit = HitRecord(
            rule_id=rule.rule_id,
            subject_id=subject_id,
            action=rule.action,
            score=rule.score,
            expression=rule.expression,
            matched_at=time.time(),
            context=dict(context),
            reason=rule.description or rule.name,
        )
        self._hits.append(hit)
        return hit

    def _check_window(self, rule: RiskRule, subject_id: str, value: bool) -> bool:
        if rule.window_sec <= 0 or rule.threshold <= 0:
            return True
        key = (rule.rule_id, subject_id, "hits")
        now = time.time()
        with self._lock:
            buf = self._window_counters.setdefault(key, deque())
            if value:
                buf.append(now)
            while buf and now - buf[0] > rule.window_sec:
                buf.popleft()
            return len(buf) >= rule.threshold

    def evaluate(self, subject_id: str, context: dict[str, Any]) -> tuple[RuleAction, list[HitRecord]]:
        """评估单个subject, 返回 (最终动作, 命中列表)"""
        with self._lock:
            rules = self.list_rules()
            hits: list[HitRecord] = []
            final_action = self.config.default_action
            for rule in rules:
                if not rule.enabled:
                    continue
                ctx = dict(context)
                ctx["subject_id"] = subject_id
                self._evaluator.set_vars(ctx)
                try:
                    matched = bool(self._evaluator.evaluate(rule.expression))
                except Exception:
                    matched = False
                if not matched:
                    continue
                if not self._check_window(rule, subject_id, True):
                    continue
                hit = self._record_hit(rule, subject_id, ctx)
                hits.append(hit)
                if rule.action == RuleAction.SCORE:
                    continue
                final_action = rule.action
                if self.config.short_circuit:
                    break
            return final_action, hits

    def hits_by_subject(self, subject_id: str, limit: int = 100) -> list[HitRecord]:
        with self._lock:
            return [h for h in reversed(self._hits) if h.subject_id == subject_id][:limit]

    def hits_by_rule(self, rule_id: str, limit: int = 100) -> list[HitRecord]:
        with self._lock:
            return [h for h in reversed(self._hits) if h.rule_id == rule_id][:limit]

    def clear_hits(self) -> int:
        with self._lock:
            n = len(self._hits)
            self._hits.clear()
            return n

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "rules_total": len(self._rules),
                "rules_enabled": sum(1 for r in self._rules.values() if r.enabled),
                "hits_total": len(self._hits),
                "subjects": len({h.subject_id for h in self._hits}),
            }
