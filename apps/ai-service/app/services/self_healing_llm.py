# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM 后端注入 + 真实 pytest 子进程 runner(自愈引擎接线层)。

把离线引擎 (app/services/self_healing.py) 接上:
- ``llm_gen_fn``:LLM 生成测试用例 JSON(注入为引擎的 gen_fn)。
- ``llm_patch_fn``:LLM 生成修复补丁(注入为引擎的 patch_fn)。
- ``PytestSubprocessRunner``:真实 pytest 子进程 runner(注入为引擎的 runner)。

严格保持引擎的优雅降级契约:gen_fn / patch_fn / runner 任何异常都不得外逃
——gen_fn 解析失败抛错让引擎落回离线模板;patch_fn 失败返回 None 让循环
继续;runner 子进程错误/超时归因为单条 runner_error 失败。

LLM 调用统一走 app/core/llm_gateway.llm_gateway(支持 async complete)。
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET
from typing import Any

from app.core.llm_gateway import llm_gateway
from app.services.self_healing import classify_failure

logger = logging.getLogger(__name__)

# 默认模型(env 可覆盖);生产/测试均可注入 llm= 假网关绕过真实网络。
DEFAULT_MODEL = os.environ.get("AGENT_SELF_HEALING_MODEL", "stepfun/step-3.7-flash")


# ---------------------------------------------------------------------------
# sync <-> async 桥接:引擎是同步的,llm_gateway.complete 是 async
# ---------------------------------------------------------------------------


def _run_async(coro: Any) -> Any:
    """在同步上下文跑协程,避免外层已存在事件循环时 asyncio.run 死锁。

    同步测试 / run_in_threadpool 内无运行中的 loop -> 直接 asyncio.run;
    FastAPI async 端点内已有 loop -> 丢到自带 loop 的临时线程执行。
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(lambda: asyncio.run(coro)).result()


# ---------------------------------------------------------------------------
# 1. LLM 测试用例生成
# ---------------------------------------------------------------------------

_GEN_SYSTEM = (
    "You are a test engineer. Given a task description, output ONLY a JSON array "
    "of test cases. Each element: {\"id\": str, \"description\": str, "
    "\"setup\": str (python source or empty), \"assertion\": str (python expression "
    "that must evaluate truthy), \"target\": str}. No prose, no markdown fences."
)

_GEN_USER = "Task: {task}"


def _strip_fences(text: str) -> str:
    """去掉 ```json ... ``` 围栏(若存在),返回纯文本。"""
    text = (text or "").strip()
    if text.startswith("```") and "```" in text[3:]:
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_cases_json(content: str) -> list[dict[str, Any]]:
    """从模型输出提取测试用例 JSON 数组;非法则抛错(让引擎落回离线模板)。"""
    text = _strip_fences(content)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("["), text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("no JSON array in LLM output") from None
        data = json.loads(text[start : end + 1])
    if not isinstance(data, list):
        raise ValueError("LLM output JSON is not an array")
    return [c for c in data if isinstance(c, dict)]


def llm_gen_fn(
    task: Any, *, llm: Any = None, model: str | None = None
) -> list[dict[str, Any]]:
    """LLM 后端测试用例生成器(同步,引擎兼容)。

    返回测试用例 dict 列表。任何 LLM/解析失败都 **抛错**,使引擎的
    generate_test_cases 捕获并落回确定性离线模板(优雅降级,绝不返回脏数据)。
    """
    gateway = llm if llm is not None else llm_gateway
    used_model = model or DEFAULT_MODEL
    resp = _run_async(
        gateway.complete(
            [
                {"role": "system", "content": _GEN_SYSTEM},
                {"role": "user", "content": _GEN_USER.format(task=str(task))},
            ],
            used_model,
        )
    )
    content = resp.get("content") if isinstance(resp, dict) else resp
    return _parse_cases_json(str(content or ""))


# ---------------------------------------------------------------------------
# 2. LLM 修复补丁生成
# ---------------------------------------------------------------------------

_PATCH_SYSTEM = (
    "You are a senior engineer. Given a failing test and its context, produce a fix. "
    "Respond ONLY with a JSON object: "
    "{\"file_path\": str (absolute path to edit), "
    "\"new_content\": str (full new file content) OR \"diff\": str (unified diff), "
    "\"explanation\": str}. No prose, no markdown fences."
)


def _parse_patch_json(content: str) -> dict[str, Any]:
    """从模型输出提取补丁 JSON 对象;非法则抛错(由 llm_patch_fn 捕获降级)。"""
    text = _strip_fences(content)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("no JSON object in LLM output") from None
        data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("patch JSON is not an object")
    return data


def _dump_failure(failure: Any) -> str:
    if isinstance(failure, dict):
        return json.dumps(
            {
                k: failure[k]
                for k in ("test_id", "message", "exception_type", "category")
                if failure.get(k) is not None
            },
            ensure_ascii=False,
        )
    return str(failure)


def _dump_context(context: Any) -> str:
    if isinstance(context, dict):
        return json.dumps(
            {k: context[k] for k in ("passed", "failed", "failures") if k in context},
            ensure_ascii=False,
            default=str,
        )
    return str(context)


def llm_patch_fn(
    failure: Any, context: Any, *, llm: Any = None, model: str | None = None
) -> dict[str, Any] | None:
    """LLM 后端补丁生成器(同步,引擎兼容)。

    返回补丁描述 dict,或失败时返回 None(优雅降级:heal 循环在缺少补丁下继续)。
    绝不抛错。
    """
    gateway = llm if llm is not None else llm_gateway
    used_model = model or DEFAULT_MODEL
    prompt = (
        f"Failing test:\n{_dump_failure(failure)}\n\n"
        f"Context (recent run result):\n{_dump_context(context)}"
    )
    try:
        resp = _run_async(
            gateway.complete(
                [
                    {"role": "system", "content": _PATCH_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                used_model,
            )
        )
        pcontent = resp.get("content") if isinstance(resp, dict) else resp
        patch = _parse_patch_json(str(pcontent or ""))
    except Exception as exc:  # noqa: BLE001 - 优雅降级:不返回补丁
        logger.warning(
            "[self_healing_llm] patch generation failed: %s: %s",
            type(exc).__name__,
            exc,
        )
        return None
    if not patch.get("file_path"):
        logger.warning("[self_healing_llm] patch missing file_path, ignoring")
        return None
    return patch


# ---------------------------------------------------------------------------
# 3. 真实 pytest 子进程 runner
# ---------------------------------------------------------------------------


class PytestSubprocessRunner:
    """真实 pytest 子进程 runner(引擎兼容,优雅降级)。

    在目标目录/文件起 pytest 子进程,解析 junit-xml 归因到具体用例,失败时
    归因为分类失败。子进程错误/超时/越界都不外抛,降级为单条 runner_error 失败。

    契约:``run(cases) -> {"passed": [ids], "failures": [{test_id, message,
    exception_type, category?}], "coverage_hint": "pytest"}``。cases 参数被忽略
    (真实信号来自磁盘上的测试文件),保留仅为兼容引擎 runner 签名。
    """

    def __init__(
        self,
        target_path: str,
        *,
        timeout: float = 120.0,
        junit_dir: str | None = None,
    ) -> None:
        self.target_path = str(target_path)
        self.timeout = timeout
        self._junit_dir = junit_dir

    def run(self, test_cases: Any = None) -> dict[str, Any]:
        junit_path = self._make_junit_path()
        cmd = [
            sys.executable,
            "-m",
            "pytest",
            self.target_path,
            "--junit-xml",
            junit_path,
            "-p",
            "no:cacheprovider",
            "-q",
        ]
        try:
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=self.timeout
            )
        except subprocess.TimeoutExpired:
            return {
                "passed": [],
                "failures": [
                    {
                        "test_id": self.target_path,
                        "message": f"pytest timed out after {self.timeout}s",
                        "exception_type": "TimeoutError",
                    }
                ],
                "coverage_hint": "pytest",
            }
        except Exception as exc:  # noqa: BLE001 - 子进程错误降级
            logger.warning("[self_healing_llm] pytest subprocess error: %s", exc)
            return {
                "passed": [],
                "failures": [
                    {
                        "test_id": self.target_path,
                        "message": f"pytest subprocess error: {exc}",
                        "exception_type": type(exc).__name__,
                    }
                ],
                "coverage_hint": "pytest",
            }
        try:
            return self._parse_junit(junit_path, proc.stdout, proc.returncode)
        except Exception as exc:  # noqa: BLE001 - junit 解析失败回退 stdout
            logger.warning(
                "[self_healing_llm] junit parse failed, fallback stdout: %s", exc
            )
            return self._parse_stdout(proc.stdout, proc.returncode)

    def _make_junit_path(self) -> str:
        d = self._junit_dir or tempfile.mkdtemp(prefix="sh_junit_")
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, f"sh_{uuid.uuid4().hex}.xml")

    def _parse_junit(self, junit_path: str, stdout: str, returncode: int) -> dict[str, Any]:
        if not os.path.exists(junit_path):
            return self._parse_stdout(stdout, returncode)
        root = ET.parse(junit_path).getroot()
        suites = root.iter("testsuite") if root.tag == "testsuites" else [root]
        passed: list[str] = []
        failures: list[dict[str, Any]] = []
        for suite in suites:
            classname = suite.get("name", "")
            for tc in suite.iter("testcase"):
                name = tc.get("name", "")
                tcid = f"{classname}::{name}" if classname else name
                # 注意:Element 空子元素为 falsy,必须显式 is not None 判断,
                # 否则 <failure message=".."/>(无子节点)会被误判为通过。
                fail = tc.find("failure")
                if fail is None:
                    fail = tc.find("error")
                if fail is None:
                    passed.append(tcid)
                    continue
                msg = (fail.get("message") or fail.text or "test failed").strip()
                exc_type = fail.get("type") or "AssertionError"
                failures.append(
                    {
                        "test_id": tcid,
                        "message": msg,
                        "exception_type": exc_type,
                        "category": classify_failure(exc_type, msg),
                    }
                )
        return {"passed": passed, "failures": failures, "coverage_hint": "pytest"}

    def _parse_stdout(self, stdout: str, returncode: int) -> dict[str, Any]:
        """junit 缺失时的兜底:从 stdout 解析 FAILED 行,否则整轮归因为单条失败。"""
        passed: list[str] = []
        failures: list[dict[str, Any]] = []
        m_pass = re.search(r"(\d+)\s+passed", stdout or "")
        if m_pass:
            passed = [f"passed_{i}" for i in range(int(m_pass.group(1)))]
        for line in (stdout or "").splitlines():
            s = line.strip()
            if s.startswith("FAILED ") or s.startswith("ERROR "):
                tcid = s.split()[1].split("[")[0]
                failures.append(
                    {
                        "test_id": tcid,
                        "message": s,
                        "exception_type": "AssertionError",
                    }
                )
        if not passed and not failures and returncode != 0:
            failures.append(
                {
                    "test_id": self.target_path,
                    "message": stdout or "pytest failed",
                    "exception_type": "AssertionError",
                }
            )
        return {"passed": passed, "failures": failures, "coverage_hint": "pytest"}


# ---------------------------------------------------------------------------
# 2b. 补丁落盘应用(heal 循环只记录 patch_applied,磁盘写入由本层负责)
# ---------------------------------------------------------------------------


def _default_path_validator(path: str) -> tuple[bool, str]:
    """默认路径白名单校验(与 MCP 工作区同一套根)。"""
    from app.services.mcp_server import _validate_path_in_workspace

    ok, info = _validate_path_in_workspace(path)
    return bool(ok), str(info)


def apply_patch_descriptor(
    patch: dict[str, Any], *, validator: Any = None
) -> tuple[bool, str]:
    """把补丁描述写入磁盘(new_content 全量覆写,原子写)。

    v1 只支持 ``new_content`` 全量写;仅 ``diff`` 的补丁返回失败原因(不半应用)。
    目标路径必须通过 workspace 白名单校验(防 LLM 产出路径穿越)。
    成功返回 (True, file_path);失败返回 (False, 原因)。
    """
    file_path = str(patch.get("file_path") or "")
    if not file_path:
        return False, "patch missing file_path"
    check = (validator or _default_path_validator)(file_path)
    if not check[0]:
        return False, f"path outside workspace whitelist: {check[1]}"
    new_content = patch.get("new_content")
    if new_content is None:
        if patch.get("diff"):
            return False, "unified-diff patches not supported in v1; provide new_content"
        return False, "patch missing new_content"
    try:
        os.makedirs(os.path.dirname(file_path) or ".", exist_ok=True)
        tmp_path = f"{file_path}.sh_tmp_{uuid.uuid4().hex}"
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(str(new_content))
        os.replace(tmp_path, file_path)
        return True, file_path
    except Exception as exc:  # noqa: BLE001 - 写入失败降级
        logger.warning("[self_healing_llm] patch apply failed: %s: %s", type(exc).__name__, exc)
        return False, f"{type(exc).__name__}: {exc}"


def llm_patch_and_apply(
    failure: Any, context: Any, *, llm: Any = None, model: Any = None
) -> dict[str, Any] | None:
    """LLM 生成补丁并落盘;任一环节失败返回 None(优雅降级,绝不抛错)。

    返回的 dict 附带 ``applied`` 布尔与 ``apply_error``(失败原因),供
    AttemptRecord.patch_applied 透出诊断信息。
    """
    patch = llm_patch_fn(failure, context, llm=llm, model=model)
    if patch is None:
        return None
    ok, info = apply_patch_descriptor(patch)
    patch = {**patch, "applied": ok}
    if not ok:
        patch["apply_error"] = info
    return patch


__all__ = [
    "PytestSubprocessRunner",
    "apply_patch_descriptor",
    "llm_gen_fn",
    "llm_patch_and_apply",
    "llm_patch_fn",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
