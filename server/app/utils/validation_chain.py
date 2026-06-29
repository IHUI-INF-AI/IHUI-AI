"""数据校验链(Bug-128)
多规则串联 + 短路 + 错误聚合 + 严重度分级
"""

from __future__ import annotations

import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

_dc_field = field  # alias to avoid shadowing by dataclass field named "field"


class Severity(StrEnum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class FieldType(StrEnum):
    STRING = "STRING"
    INTEGER = "INTEGER"
    FLOAT = "FLOAT"
    BOOLEAN = "BOOLEAN"
    EMAIL = "EMAIL"
    URL = "URL"
    PHONE = "PHONE"
    ID_CARD = "ID_CARD"
    IP = "IP"
    DATE = "DATE"
    DATETIME = "DATETIME"
    UUID = "UUID"
    JSON = "JSON"
    LIST = "LIST"
    DICT = "DICT"
    ANY = "ANY"


@dataclass
class ValidationError:
    field: str
    code: str
    message: str
    severity: Severity = Severity.ERROR
    value: Any = None
    rule: str = ""


@dataclass
class RuleResult:
    rule_id: str
    field: str
    passed: bool
    errors: list[ValidationError] = _dc_field(default_factory=list)  # noqa: RUF009
    duration_ms: float = 0.0


@dataclass
class FieldSchema:
    field: str
    type: FieldType = FieldType.ANY
    required: bool = False
    min_length: int | None = None
    max_length: int | None = None
    min_value: float | None = None
    max_value: float | None = None
    pattern: str | None = None
    choices: list[Any] | None = None
    default: Any = None
    description: str = ""


_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
_URL_RE = re.compile(r"^https?://[^\s/$.?#].[^\s]*$")
_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")
_ID_CARD_RE = re.compile(r"^\d{17}[\dXx]$")
_IP_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def _check_type(value: Any, t: FieldType) -> bool:
    if value is None:
        return True
    if t == FieldType.STRING:
        return isinstance(value, str)
    if t == FieldType.INTEGER:
        return isinstance(value, int) and not isinstance(value, bool)
    if t == FieldType.FLOAT:
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == FieldType.BOOLEAN:
        return isinstance(value, bool)
    if t == FieldType.EMAIL:
        return isinstance(value, str) and bool(_EMAIL_RE.match(value))
    if t == FieldType.URL:
        return isinstance(value, str) and bool(_URL_RE.match(value))
    if t == FieldType.PHONE:
        return isinstance(value, str) and bool(_PHONE_RE.match(value))
    if t == FieldType.ID_CARD:
        return isinstance(value, str) and bool(_ID_CARD_RE.match(value))
    if t == FieldType.IP:
        return isinstance(value, str) and bool(_IP_RE.match(value))
    if t == FieldType.DATE:
        return isinstance(value, str) and bool(re.match(r"^\d{4}-\d{2}-\d{2}$", value))
    if t == FieldType.DATETIME:
        return isinstance(value, str) and bool(re.match(r"^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}", value))
    if t == FieldType.UUID:
        return isinstance(value, str) and bool(_UUID_RE.match(value))
    if t == FieldType.JSON:
        return isinstance(value, (dict, list))
    if t == FieldType.LIST:
        return isinstance(value, list)
    if t == FieldType.DICT:
        return isinstance(value, dict)
    return True


@dataclass
class ValidationRule:
    rule_id: str
    name: str
    field: str = ""
    severity: Severity = Severity.ERROR
    enabled: bool = True
    schema: FieldSchema | None = None
    predicate: Callable[[dict[str, Any]], str | None] | None = None
    description: str = ""


@dataclass
class ChainConfig:
    short_circuit_on_critical: bool = True
    stop_on_error: bool = False
    collect_all: bool = True
    timeout_ms: float = 5000.0


@dataclass
class ChainResult:
    passed: bool
    errors: list[ValidationError] = field(default_factory=list)
    rule_results: list[RuleResult] = field(default_factory=list)
    duration_ms: float = 0.0

    def errors_by_severity(self, severity: Severity) -> list[ValidationError]:
        return [e for e in self.errors if e.severity == severity]

    def has_critical(self) -> bool:
        return any(e.severity == Severity.CRITICAL for e in self.errors)


class ValidationChain:
    """校验链: 按规则顺序执行,支持短路/错误聚合"""

    def __init__(self, config: ChainConfig | None = None) -> None:
        self.config = config or ChainConfig()
        self._rules: list[ValidationRule] = []
        self._lock = threading.RLock()

    def add_rule(self, rule: ValidationRule) -> None:
        with self._lock:
            self._rules.append(rule)
        return None

    def insert_rule(self, index: int, rule: ValidationRule) -> None:
        with self._lock:
            self._rules.insert(max(0, index), rule)

    def remove_rule(self, rule_id: str) -> bool:
        with self._lock:
            for i, r in enumerate(self._rules):
                if r.rule_id == rule_id:
                    self._rules.pop(i)
                    return True
            return False

    def list_rules(self) -> list[ValidationRule]:
        with self._lock:
            return list(self._rules)

    def clear(self) -> None:
        with self._lock:
            self._rules.clear()

    def _validate_schema(self, data: dict[str, Any], schema: FieldSchema) -> list[ValidationError]:
        errs: list[ValidationError] = []
        if schema.field not in data:
            if schema.required:
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="REQUIRED",
                        message=f"字段 {schema.field} 必填",
                        severity=Severity.ERROR,
                        rule=schema.field,
                    )
                )
            return errs
        value = data[schema.field]
        if value is None:
            if schema.required:
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="NULL_VALUE",
                        message=f"字段 {schema.field} 不能为 null",
                        severity=Severity.ERROR,
                        value=None,
                        rule=schema.field,
                    )
                )
            return errs
        if not _check_type(value, schema.type):
            errs.append(
                ValidationError(
                    field=schema.field,
                    code="TYPE_MISMATCH",
                    message=f"字段 {schema.field} 类型应为 {schema.type.value}",
                    severity=Severity.ERROR,
                    value=value,
                    rule=schema.field,
                )
            )
            return errs
        if isinstance(value, str):
            if schema.min_length is not None and len(value) < schema.min_length:
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="MIN_LENGTH",
                        message=f"字段 {schema.field} 长度不能小于 {schema.min_length}",
                        severity=Severity.WARN,
                        value=value,
                        rule=schema.field,
                    )
                )
            if schema.max_length is not None and len(value) > schema.max_length:
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="MAX_LENGTH",
                        message=f"字段 {schema.field} 长度不能大于 {schema.max_length}",
                        severity=Severity.ERROR,
                        value=value,
                        rule=schema.field,
                    )
                )
            if schema.pattern and not re.search(schema.pattern, value):
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="PATTERN",
                        message=f"字段 {schema.field} 不匹配模式 {schema.pattern}",
                        severity=Severity.ERROR,
                        value=value,
                        rule=schema.field,
                    )
                )
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if schema.min_value is not None and value < schema.min_value:
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="MIN_VALUE",
                        message=f"字段 {schema.field} 不能小于 {schema.min_value}",
                        severity=Severity.WARN,
                        value=value,
                        rule=schema.field,
                    )
                )
            if schema.max_value is not None and value > schema.max_value:
                errs.append(
                    ValidationError(
                        field=schema.field,
                        code="MAX_VALUE",
                        message=f"字段 {schema.field} 不能大于 {schema.max_value}",
                        severity=Severity.ERROR,
                        value=value,
                        rule=schema.field,
                    )
                )
        if schema.choices is not None and value not in schema.choices:
            errs.append(
                ValidationError(
                    field=schema.field,
                    code="NOT_IN_CHOICES",
                    message=f"字段 {schema.field} 必须是 {schema.choices} 之一",
                    severity=Severity.ERROR,
                    value=value,
                    rule=schema.field,
                )
            )
        return errs

    def _run_rule(self, rule: ValidationRule, data: dict[str, Any]) -> RuleResult:
        start = time.time()
        errs: list[ValidationError] = []
        if rule.schema is not None:
            errs.extend(self._validate_schema(data, rule.schema))
        if rule.predicate is not None:
            try:
                msg = rule.predicate(data)
                if msg:
                    errs.append(
                        ValidationError(
                            field=rule.field or rule.rule_id,
                            code=rule.rule_id,
                            message=msg,
                            severity=rule.severity,
                            value=data.get(rule.field) if rule.field else None,
                            rule=rule.rule_id,
                        )
                    )
            except Exception as e:
                errs.append(
                    ValidationError(
                        field=rule.field or rule.rule_id,
                        code="PREDICATE_ERROR",
                        message=f"规则执行异常: {e}",
                        severity=Severity.CRITICAL,
                        rule=rule.rule_id,
                    )
                )
        passed = len(errs) == 0
        return RuleResult(
            rule_id=rule.rule_id,
            field=rule.field,
            passed=passed,
            errors=errs,
            duration_ms=(time.time() - start) * 1000,
        )

    def validate(self, data: dict[str, Any]) -> ChainResult:
        with self._lock:
            rules = list(self._rules)
        start = time.time()
        all_errs: list[ValidationError] = []
        rule_results: list[RuleResult] = []
        for rule in rules:
            if not rule.enabled:
                continue
            elapsed_ms = (time.time() - start) * 1000
            if elapsed_ms > self.config.timeout_ms:
                all_errs.append(
                    ValidationError(
                        field="*",
                        code="CHAIN_TIMEOUT",
                        message=f"校验链超时 ({self.config.timeout_ms}ms)",
                        severity=Severity.CRITICAL,
                        rule=rule.rule_id,
                    )
                )
                break
            res = self._run_rule(rule, data)
            rule_results.append(res)
            if not res.passed:
                all_errs.extend(res.errors)
                if rule.severity == Severity.CRITICAL and self.config.short_circuit_on_critical:
                    break
                if self.config.stop_on_error:
                    break
        passed = not any(e.severity in (Severity.ERROR, Severity.CRITICAL) for e in all_errs)
        return ChainResult(
            passed=passed,
            errors=all_errs,
            rule_results=rule_results,
            duration_ms=(time.time() - start) * 1000,
        )
