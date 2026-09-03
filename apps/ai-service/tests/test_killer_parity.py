# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:not-applied-new-file

"""杀手锏常量 跨端漂移即失败(parity)测试。

在 Python(app.core.tunables 唯一真源)与 TS 只读镜像
(packages/shared/src/constants.ts)之间逐常量断言"Py 值 == TS 值"。
任一不匹配即测试失败,并打印两端值及其来源文件。

不强依赖 npm/vitest —— 直接以正则/ast-lite 解析 TS 文件的 `export const` 命名常量。
改动真源后若忘记同步 TS 镜像,本测试立即变红。
"""

from __future__ import annotations

import re
from pathlib import Path

import app.core.tunables as tunables  # 杀手锏常量唯一真源(Py 侧)

# ---- 路径:仓库根(g:/IHUI-AI) ----
_REPO_ROOT = Path(__file__).resolve().parents[3]
_TS_CONSTANTS = _REPO_ROOT / "packages/shared/src/constants.ts"

# 杀手锏常量 → Py 端散点来源文件(相对仓库根),供失败时打印定位
# 每个常量名都必须能在 app.core.tunables 取到、且能在 TS 镜像解析出同名值。
KILLER_CONSTANTS: dict[str, str] = {
    "MAX_STEPS_PER_RUN": "apps/ai-service/app/services/agent_step_recorder.py",
    "DEFAULT_CHECKPOINT_TTL": "apps/ai-service/app/services/agent_checkpoint.py",
    "FILE_VERSION_REDIS_TTL": "apps/ai-service/app/services/file_editor.py",
    "DEFAULT_TRIGGER_RATIO": "apps/ai-service/app/core/context_compaction.py",
    "DEFAULT_TARGET_RATIO": "apps/ai-service/app/core/context_compaction.py",
    "DEFAULT_KEEP_RECENT": "apps/ai-service/app/core/context_compaction.py",
    "DEFAULT_MIN_MESSAGES": "apps/ai-service/app/core/context_compaction.py",
    "DEFAULT_PROTOCOL_VERSION": "apps/ai-service/app/services/mcp_client.py",
    "SUPPORTED_PROTOCOL_VERSIONS": "apps/ai-service/app/services/mcp_client.py",
}


def _parse_ts_scalar(raw: str):
    """解析单个 TS 字面量:'...' / \"...\" / 数字 / true|false;失败返回原始字符串。"""
    raw = raw.strip()
    if (raw.startswith("'") and raw.endswith("'")) or (raw.startswith('"') and raw.endswith('"')):
        return raw[1:-1]
    if raw == "true":
        return True
    if raw == "false":
        return False
    try:
        return float(raw) if any(c in raw for c in ".eE") else int(raw)
    except ValueError:
        return raw


def _parse_ts_constants(text: str) -> dict[str, object]:
    """解析 TS 文件中 `export const NAME = <value>` 命名常量。

    支持数字、单双引号字符串、数组字面量(含 `as const` 后缀,可跨多行)。用
    ast.literal_eval 保护之一 + 手工解析,规避 eval 风险,且不依赖任何 TS 运行时。

    多行数组必须先整体匹配:单行正则在 `export const X = [` 处只会截到 '[',
    会把数组常量解析成字符串 '[' 造成假漂移。
    """
    result: dict[str, object] = {}
    # 1) 跨行数组字面量(含 as const)
    array_pattern = re.compile(
        r"^export const (\w+)\s*=\s*\[(.*?)\](?:\s*as const)?\s*$",
        re.MULTILINE | re.DOTALL,
    )
    for match in array_pattern.finditer(text):
        name, inner = match.group(1), match.group(2)
        try:
            result[name] = [_parse_ts_scalar(p) for p in inner.split(",") if p.strip()]
        except Exception:  # 不认识的语法跳过,不影响其他常量
            continue
    # 2) 单值声明(数字 / 字符串)
    pattern = re.compile(r"^export const (\w+)\s*=\s*(.+)$", re.MULTILINE)
    for match in pattern.finditer(text):
        name, raw = match.group(1), match.group(2).strip()
        if name in result:  # 已由多行数组解析成功,避免被截断值覆盖
            continue
        try:
            if raw.endswith(" as const"):
                raw = raw[: -len(" as const")].strip()
            if raw.startswith("[") and raw.endswith("]"):
                inner = raw[1:-1]
                result[name] = [_parse_ts_scalar(p) for p in inner.split(",") if p.strip()]
            else:
                result[name] = _parse_ts_scalar(raw)
        except Exception:  # 不认识的语法跳过,不影响其他常量
            continue
    return result


def test_ts_mirror_file_exists() -> None:
    """TS 只读镜像必须存在(缺失即失败)。"""
    assert _TS_CONSTANTS.is_file(), f"TS 镜像缺失: {_TS_CONSTANTS}"


def test_killer_constants_parity() -> None:
    """每个杀手锏常量:Py 真源值 == TS 镜像值,任一漂移即失败。"""
    text = _TS_CONSTANTS.read_text(encoding="utf-8")
    ts_values = _parse_ts_constants(text)

    failures: list[str] = []
    for name, py_src in KILLER_CONSTANTS.items():
        py_value = getattr(tunables, name)
        ts_value = ts_values.get(name, "<TS 镜像缺失>")
        # 归一化 tuple/list 等价
        py_norm, ts_norm = _normalize(py_value), _normalize(ts_value)
        if py_norm != ts_norm:
            failures.append(
                f"{name}: Py={py_value!r} (来源 {py_src}) != "
                f"TS={ts_value!r} (apps/ai-service/../../packages/shared/src/constants.ts)"
            )
    assert not failures, "杀手锏常量跨端漂移:\n" + "\n".join(failures)


def _normalize(value: object):
    if isinstance(value, (list, tuple)):
        return [_normalize(v) for v in value]
    return value


def test_killer_constants_are_covered_by_tunables() -> None:
    """守卫:每个 TS 镜像常量都登记在 KILLER_CONSTANTS(防新增常量漏测)。"""
    text = _TS_CONSTANTS.read_text(encoding="utf-8")
    ts_names = set(_parse_ts_constants(text).keys())
    assert set(KILLER_CONSTANTS) <= ts_names, (
        f"以下真源常量未在 TS 镜像中找到同名导出(需同步 packages/shared/src/constants.ts): "
        f"{set(KILLER_CONSTANTS) - ts_names}"
    )
