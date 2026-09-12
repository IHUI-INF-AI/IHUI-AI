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
import difflib
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET
from collections.abc import Iterator
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

    2026-09-12 修复:临时 loop 结束前关闭"本临时 loop"的共享连接池。
    asyncio.run 返回后不会再执行任何协程,故清理必须放在协程内部 try/finally;
    否则临时 loop 的池既不关闭也不释放,且会被下一个 loop 误用。
    """

    async def _guarded() -> Any:
        try:
            return await coro
        finally:
            # 延迟导入,避免模块级循环依赖。
            from app.core.db_pool import close_current_loop_pool

            try:
                await close_current_loop_pool()
            except Exception as e:  # noqa: BLE001 清理失败不得掩盖业务异常
                logger.warning(
                    "[self_healing_llm] 临时 loop 共享池清理失败(忽略): %s", e
                )

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_guarded())
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(lambda: asyncio.run(_guarded())).result()


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
    "\"explanation\": str}. No prose, no markdown fences. "
    "IMPORTANT: `file_path` MUST be one of the real absolute paths present in the "
    "provided context (e.g. the value of `workspace_root` / `target_path`). "
    "Never invent container-style paths such as /app/...; patches outside the "
    "workspace are rejected by the sandbox whitelist. "
    "If the failing test's source is provided, it is authoritative: the fix MUST "
    "make its assertions pass, and you MUST NOT edit the test to match a wrong fix."
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


def list_workspace_files(root: str, limit: int = 60) -> list[str]:
    """列出工作区内可编辑的源文件绝对路径(供补丁生成定位真实目标文件)。

    2026-09-12 立:实测 LLM 拿到 workspace_root 后仍会猜文件名(把 calc.py 猜成
    divide.py / math_ops.py),补丁虽然落盘却不命中失败文件。给出真实文件清单后
    LLM 才能选中正确文件。
    """
    import os
    from pathlib import Path

    SKIP = {".venv", "__pycache__", ".git", "node_modules", ".mypy_cache", ".pytest_cache"}
    try:
        base = Path(root)
        if base.is_file():
            return [str(base)]
        if not base.is_dir():
            return []
        out: list[str] = []
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP]
            for name in sorted(filenames):
                if name.endswith((".py", ".ts", ".tsx", ".js", ".jsx")):
                    out.append(str(Path(dirpath) / name))
                    if len(out) >= limit:
                        return sorted(out)
        return sorted(out)
    except Exception:  # noqa: BLE001 - 列目录失败不影响主流程
        return []


def _resolve_test_file(test_id: str, workspace_root: str | None) -> str | None:
    """从 pytest 归因 ``test_id`` 解析失败测试的源文件(绝对路径);解析不出返回 None。

    支持两种形态的前缀(``::`` 之前的部分):
    - 路径式:``tests/test_x.py`` / ``C:\\...\\test_x.py``(含分隔符或 .py 后缀);
    - 点分模块式:pytest junit 的 ``classname``(``test_x`` / ``tests.test_x``)
      —— 还原为 ``test_x.py`` / ``tests/test_x.py``。

    相对路径以 ``workspace_root`` 为基准拼接;无法得到绝对路径则返回 None。
    """
    from pathlib import Path

    prefix = str(test_id).split("::", 1)[0].strip()
    if not prefix:
        return None
    cand: Path | None = None
    if "/" in prefix or "\\" in prefix or prefix.endswith(".py"):
        cand = Path(prefix)
    else:
        parts = [p for p in prefix.split(".") if p]
        if parts and all(p.isidentifier() for p in parts):
            cand = Path(*parts).with_suffix(".py")
    if cand is None:
        return None
    if not cand.is_absolute() and workspace_root:
        cand = Path(workspace_root) / cand
    return str(cand) if cand.is_absolute() else None


def _path_within(root: str, path: str) -> bool:
    """``path`` 解析(realpath,含 symlink)后是否落在 ``root`` 之内(防目录穿越)。"""
    try:
        root_r = os.path.normcase(os.path.realpath(root))
        path_r = os.path.normcase(os.path.realpath(path))
    except Exception:  # noqa: BLE001 - 解析失败一律判越界
        return False
    if root_r == path_r:
        return True
    try:
        return os.path.commonpath([root_r, path_r]) == root_r
    except ValueError:  # 不同盘符等
        return False


# 单个失败测试源文件注入 prompt 的行数上限
_FAILURE_SOURCE_MAX_LINES = 200


def read_failure_sources(
    failure: Any, context: Any, limit_chars: int = 4000
) -> str:
    """读取失败测试的真实源码(断言),供补丁生成对齐"测试到底断言了什么"。

    2026-09-12 立:LLM 只看 pytest 归因消息(test_id/message/exception_type)时
    无法知道断言,实测会把"除零应返回 0"改成"抛 ValueError"——方向猜错。
    注入失败测试源码后补丁命中率显著提升(端到端演练 HEALED=True)。

    安全:解析出的路径必须落在 ``context["workspace_root"]`` 之内(realpath 校验,
    防 symlink / ``..`` 目录穿越);越界、读失败、解析不出文件一律返回空串,
    绝不抛错。内容按 ``_FAILURE_SOURCE_MAX_LINES`` 行 / ``limit_chars`` 字符截断
    并注明截断。
    """
    try:
        if not isinstance(context, dict):
            return ""
        root = context.get("workspace_root")
        if not root:
            return ""
        if isinstance(failure, dict):
            test_id = failure.get("test_id")
        elif isinstance(failure, str):
            test_id = failure
        else:
            test_id = None
        if not test_id:
            return ""
        path = _resolve_test_file(str(test_id), str(root))
        if not path or not _path_within(str(root), path) or not os.path.isfile(path):
            return ""
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()
        lines = text.splitlines()
        truncated = len(lines) > _FAILURE_SOURCE_MAX_LINES
        if truncated:
            lines = lines[:_FAILURE_SOURCE_MAX_LINES]
        text = "\n".join(lines)
        if limit_chars > 0 and len(text) > limit_chars:
            text = text[:limit_chars]
            truncated = True
        if truncated:
            text += (
                f"\n# [truncated: showing at most {_FAILURE_SOURCE_MAX_LINES} lines "
                f"/ {limit_chars} chars]"
            )
        return text
    except Exception as exc:  # noqa: BLE001 - 任何失败都优雅降级为空
        logger.warning(
            "[self_healing_llm] read_failure_sources failed (%s): %s",
            type(exc).__name__,
            exc,
        )
        return ""


def _dump_context(context: Any) -> str:
    # 2026-09-12 修复:workspace_root / target_path 必须进 prompt,否则 LLM 只看到
    # pytest 失败文本会编造容器式路径(/app/...、/home/user/...),补丁被工作区
    # 白名单拒绝,自愈永远落不了盘。
    if isinstance(context, dict):
        return json.dumps(
            {
                k: context[k]
                for k in (
                    "task",
                    "passed",
                    "failed",
                    "failures",
                    "workspace_root",
                    "target_path",
                    "workspace_files",
                )
                if k in context
            },
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
    root = context.get("workspace_root") if isinstance(context, dict) else None
    files = context.get("workspace_files") if isinstance(context, dict) else None
    root_line = (
        f"Workspace root (every file_path you return MUST be inside it): {root}\n\n"
        if root
        else ""
    )
    files_line = (
        "Editable source files in the workspace "
        "(file_path MUST be exactly one of these paths):\n"
        + "\n".join(f"- {f}" for f in files)
        + "\n\n"
        if files
        else ""
    )
    # 失败测试的真实源码走独立段落(不塞进 _dump_context,避免重复与上下文膨胀)。
    # 优先用 _patch_adapter 显式注入的 context["failing_test_source"],缺失时自行收集。
    src = context.get("failing_test_source") if isinstance(context, dict) else None
    if not src:
        src = read_failure_sources(failure, context)
    source_block = (
        "Failing test source (authoritative — the fix MUST make these assertions pass):\n"
        f"{src}\n\n"
        if src
        else ""
    )
    prompt = (
        f"{root_line}{files_line}"
        f"Failing test:\n{_dump_failure(failure)}\n\n"
        f"{source_block}"
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
            suite_name = suite.get("name", "")
            for tc in suite.iter("testcase"):
                # junit 的 testsuite.name 恒为 "pytest"(无定位价值);testcase.classname
                # 才是模块(点分)名,是自愈层把失败测试还原回源文件的唯一线索。
                # 2026-09-12 立:补丁命中质量依赖 test_id 可解析出测试文件。
                classname = tc.get("classname") or suite_name
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
    """把补丁描述写入磁盘(原子写)。

    支持两种形态:
    - ``new_content``:全量覆写(v1 路径,不变)。
    - ``diff``(v2,2026-09-12 立):unified diff 三方合并应用——读原文件 →
      hunk 定位(精确/模糊)→ merge3 合并(文件漂移时同时保留磁盘侧改动)
      → 原子写。冲突/定位失败/merge3 未安装整体失败,不半应用。

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
        diff = str(patch.get("diff") or "")
        if not diff:
            return False, "patch missing new_content"
        if not os.path.exists(file_path):
            return False, f"diff patch target does not exist: {file_path}"
        try:
            with open(file_path, encoding="utf-8") as f:
                current = f.read()
        except Exception as exc:  # noqa: BLE001 - 读取失败降级
            return False, f"read target failed: {type(exc).__name__}: {exc}"
        ok, info, merged = _apply_unified_diff(diff, current)
        if not ok:
            return False, info
        new_content = merged
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


# ---------------------------------------------------------------------------
# 2c. unified diff 应用(v2,merge3 三方合并)
# ---------------------------------------------------------------------------

_HUNK_HEADER_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@")
# hunk 模糊定位的搜索窗口(期望行号前后的行数)
_HUNK_SEARCH_WINDOW = 400
# 模糊定位的相似度阈值;达到即交给 merge3 合并漂移区域
_HUNK_FUZZY_THRESHOLD = 0.5


def _parse_unified_hunks(diff: str) -> list[tuple[int, list[str], list[str]]]:
    """解析 unified diff 为 ``[(old_start, old_lines, new_lines), ...]``。

    上下文行进 old/new 两侧;``\\ No newline`` 标记忽略;文件头
    (diff --git / --- / +++)跳过。hunk 头非法抛 ValueError(由上层降级)。
    """
    hunks: list[tuple[int, list[str], list[str]]] = []
    old_start = 0
    old: list[str] = []
    new: list[str] = []
    in_hunk = False
    for line in diff.splitlines():
        if line.startswith("@@"):
            if in_hunk:
                hunks.append((old_start, old, new))
            m = _HUNK_HEADER_RE.match(line)
            if not m:
                raise ValueError(f"malformed hunk header: {line!r}")
            old_start = max(1, int(m.group(1)))
            old, new = [], []
            in_hunk = True
        elif not in_hunk or line.startswith("\\"):
            continue
        elif line.startswith("-"):
            old.append(line[1:])
        elif line.startswith("+"):
            new.append(line[1:])
        else:
            # 上下文行:标准为单空格前缀;空行容错为空串
            ctx = line[1:] if line.startswith(" ") else line
            old.append(ctx)
            new.append(ctx)
    if in_hunk:
        hunks.append((old_start, old, new))
    return hunks


def _locate_hunk(
    lines: list[str], pos: int, expected: int, old: list[str]
) -> int | None:
    """在文件行中定位 hunk 旧文本,返回起始下标(0-based)。

    先在期望位置前后窗口内精确匹配;失败再做 difflib 模糊匹配(阈值
    ``_HUNK_FUZZY_THRESHOLD``,达标区域交给 merge3 合并磁盘侧漂移)。
    找不到返回 None。``pos`` 为已消费下界(hunk 须按序应用)。
    """
    n = len(old)
    window = _HUNK_SEARCH_WINDOW

    def _candidates() -> Iterator[int]:
        for d in range(window + 1):
            if d == 0:
                yield expected
            else:
                yield expected + d
                yield expected - d

    for idx in _candidates():
        if idx < pos or idx + n > len(lines):
            continue
        if lines[idx : idx + n] == old:
            return idx

    best_idx: int | None = None
    best_ratio = _HUNK_FUZZY_THRESHOLD
    for idx in _candidates():
        if idx < pos or idx + n > len(lines):
            continue
        region = lines[idx : idx + n]
        sm = difflib.SequenceMatcher(None, old, region)
        if sm.real_quick_ratio() < best_ratio or sm.quick_ratio() < best_ratio:
            continue
        ratio = sm.ratio()
        # 严格 > :ratio 并列时保留先遍历到的候选(candidates 按与期望位置的距离
        # 升序生成),避免同分时取到更远的错位区域制造假冲突。
        if ratio > best_ratio:
            best_idx, best_ratio = idx, ratio
    return best_idx


def _apply_unified_diff(diff: str, current: str) -> tuple[bool, str, str]:
    """把 unified diff 应用到当前文件内容,返回 (ok, message, new_content)。

    每个 hunk:精确命中 → 直接替换;区域漂移 → merge3 三方合并
    (base=diff 旧文本, a=diff 新文本, b=磁盘当前区域),同时保留
    LLM 变更与磁盘漂移;冲突则整体失败(不半应用)。
    merge3 未安装时优雅降级为失败原因(不影响 new_content 路径)。
    """
    try:
        hunks = _parse_unified_hunks(diff)
    except ValueError as exc:
        return False, f"malformed unified diff: {exc}", ""
    if not hunks:
        return False, "diff contains no hunks", ""
    try:
        from merge3 import Merge3
    except ImportError:
        return False, "unified-diff patches require the merge3 package", ""

    def _nl(raw: list[str], last_raw: bool) -> list[str]:
        out = [x + "\n" for x in raw]
        if last_raw and out:
            out[-1] = out[-1].removesuffix("\n")
        return out

    lines = current.splitlines(keepends=True)
    out: list[str] = []
    pos = 0
    for old_start, old_raw, new_raw in hunks:
        applied = False
        # 两种行尾形态:全 '\n' 结尾 / 末行无 '\n'(对应文件末行无换行)
        for last_raw in (False, True):
            old = _nl(old_raw, last_raw)
            idx = _locate_hunk(lines, pos, old_start - 1, old)
            if idx is None:
                continue
            out.extend(lines[pos:idx])
            region = lines[idx : idx + len(old)]
            new = _nl(new_raw, last_raw)
            if region == old:
                out.extend(new)
            else:
                m3 = Merge3(old, new, region)
                if any(r[0] == "conflict" for r in m3.merge_regions()):
                    return False, f"merge conflict in hunk at old line {old_start}", ""
                out.extend(m3.merge_lines())
            pos = idx + len(old)
            applied = True
            break
        if not applied:
            return (
                False,
                f"hunk at old line {old_start} not located (file drifted too far?)",
                "",
            )
    out.extend(lines[pos:])
    return True, "", "".join(out)


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
    "read_failure_sources",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
