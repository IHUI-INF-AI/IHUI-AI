"""Skill 基于反馈迭代优化(P3-2,对标 Hermes Agent 基于反馈迭代优化 + 评分)。

输入当前 skill + 使用统计 + 失败案例 + 测试结果,LLM 生成改进版,
写回 SKILL.md(版本号 minor +1),自动重跑测试验证(通过率提升则保留,否则回滚)。
类型契约对齐 packages/types/src/agent-runtime.ts 的
SkillIterationRequest / SkillIterationResult。
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

from ..core.llm_gateway import llm_gateway
from .skill_feedback import skill_feedback_tracker
from .skill_tester import skill_tester

logger = logging.getLogger(__name__)


class SkillIterator:
    """Skill 迭代器:LLM 生成改进版 + 写回 + 测试验证 + 回滚兜底。"""

    async def iterate(self, request: dict[str, Any]) -> dict[str, Any]:
        """基于反馈 + 失败案例 + 测试结果迭代优化 skill。

        Args:
            request: SkillIterationRequest 字典
                (skillName/currentContent/usageStats/failureCases/currentTestResult)。

        Returns:
            SkillIterationResult 字典
            (shouldIterate/newVersion?/newContent?/reason/expectedImprovements)。
        """
        skill_name = str(request.get("skillName", ""))
        current_content = str(request.get("currentContent", ""))
        usage_stats = request.get("usageStats", {}) or {}
        failure_cases = request.get("failureCases", []) or []
        current_test = request.get("currentTestResult", {}) or {}
        baseline_pass_rate = float(current_test.get("passRate", 0.0) or 0.0)

        messages = self._build_iterate_prompt(
            skill_name=skill_name,
            current_content=current_content,
            usage_stats=usage_stats,
            failure_cases=failure_cases,
            current_test=current_test,
        )
        try:
            result = await llm_gateway.complete(messages)
            content = str(result.get("content", ""))
        except Exception as e:
            logger.warning("迭代 LLM 调用失败(skill=%s): %s", skill_name, e)
            return self._no_iterate(f"LLM 调用失败: {type(e).__name__}")

        parsed = self._parse_iterate_output(content)
        if not parsed.get("shouldIterate"):
            return parsed

        new_content = str(parsed.get("newContent", "")).strip()
        if not new_content:
            parsed["shouldIterate"] = False
            parsed["reason"] = parsed.get("reason", "") + " [新内容为空,未落盘]"
            return parsed

        # 读旧文件 + 计算新版本
        old_md, skill_path = self._read_skill_file(skill_name)
        current_version = self._extract_version(old_md) or "1.0.0"
        new_version = self.bump_version(current_version)

        # 写回新版本(保留旧 frontmatter 的 description/relatedSkills 等)
        new_md = self._rewrite_skill_md(old_md, new_content, new_version)
        backup_md = old_md  # 旧内容用于回滚
        write_ok = self._write_skill_file(skill_path, new_md)
        if not write_ok:
            parsed["shouldIterate"] = False
            parsed["reason"] = parsed.get("reason", "") + " [写盘失败,已回滚]"
            return parsed

        # 自动重跑测试验证新版本(通过率提升则保留,否则回滚)
        kept, new_pass_rate = await self._verify_and_maybe_rollback(
            skill_name=skill_name,
            new_content=new_content,
            skill_path=skill_path,
            backup_md=backup_md,
            baseline_pass_rate=baseline_pass_rate,
            current_version=current_version,
            new_version=new_version,
            reason=parsed.get("reason", ""),
        )

        if not kept:
            parsed["shouldIterate"] = False
            parsed["reason"] = parsed.get("reason", "") + (
                f" [验证未提升:基线 {baseline_pass_rate:.2f} → 新 {new_pass_rate:.2f},已回滚]"
            )
            parsed.pop("newVersion", None)
            parsed.pop("newContent", None)
        else:
            parsed["newVersion"] = new_version
            parsed["newContent"] = new_content
            # 记录迭代历史(成功保留)
            await skill_feedback_tracker.record_iteration(skill_name, {
                "version": new_version,
                "iteratedAt": datetime.now(timezone.utc).isoformat(),
                "reason": parsed.get("reason", ""),
                "previousPassRate": baseline_pass_rate,
                "newPassRate": new_pass_rate,
            })
        return parsed

    @staticmethod
    def _build_iterate_prompt(
        *,
        skill_name: str,
        current_content: str,
        usage_stats: dict[str, Any],
        failure_cases: list[dict[str, Any]],
        current_test: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """构建迭代 prompt(喂给 LLM 当前内容 + 统计 + 失败案例 + 测试结果)。"""
        stats_text = json.dumps(usage_stats, ensure_ascii=False, default=str)[:2000]
        failures_text = json.dumps(failure_cases[:5], ensure_ascii=False, default=str)[:2000]
        test_text = json.dumps(
            {
                "passRate": current_test.get("passRate", 0),
                "passed": current_test.get("passed", 0),
                "total": current_test.get("total", 0),
                "failedCases": [
                    {"name": r.get("name", ""), "reason": r.get("failureReason", "")}
                    for r in (current_test.get("results", []) or [])
                    if not r.get("passed")
                ][:5],
            },
            ensure_ascii=False,
        )[:1500]
        return [
            {
                "role": "system",
                "content": (
                    "你是 Skill 迭代优化专家。基于使用反馈和测试结果改进 skill 内容。\n"
                    "约束:\n"
                    "1. 只在确有改进空间时才迭代(shouldIterate=true),否则返回 false。\n"
                    "2. newContent 是改进后的 SKILL.md 正文 Instructions(完整可执行步骤,不要 frontmatter)。\n"
                    "3. expectedImprovements 列出 2-4 个具体改进点。\n"
                    "4. 保持原有 skill 的核心能力,不要删除关键步骤。\n"
                    "返回纯 JSON(不要 markdown 包裹):\n"
                    '{"shouldIterate": bool, "newContent": "改进后的正文", '
                    '"reason": "迭代理由", "expectedImprovements": ["改进点1", "改进点2"]}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Skill 名: {skill_name}\n\n"
                    f"当前 skill 内容:\n{current_content[:4000]}\n\n"
                    f"使用统计:\n{stats_text}\n\n"
                    f"失败案例:\n{failures_text}\n\n"
                    f"当前测试结果:\n{test_text}"
                ),
            },
        ]

    @staticmethod
    def _parse_iterate_output(content: str) -> dict[str, Any]:
        """解析 LLM 迭代输出为 SkillIterationResult 字典(容错)。

        增强容错(2026-07-22):
        1. 剥离 markdown 代码块包裹(```json ... ```)
        2. 修复 newContent 字段内未转义换行符(JSON 字符串不能含裸 \n)
        3. 提取失败时默认 shouldIterate=false(避免格式问题误触发迭代)
        """
        # 1. 剥离 markdown 代码块
        cleaned = content.strip()
        if cleaned.startswith("```"):
            # 去掉首行 ```json 或 ```
            lines = cleaned.split("\n")
            if len(lines) > 2:
                cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        # 2. 提取最外层 {...}
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return {
                "shouldIterate": False,
                "reason": "LLM 输出未包含 JSON 对象",
                "expectedImprovements": [],
            }

        raw = match.group()
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict):
                return {
                    "shouldIterate": bool(obj.get("shouldIterate", False)),
                    "newContent": str(obj.get("newContent", "")),
                    "reason": str(obj.get("reason", "")),
                    "expectedImprovements": list(obj.get("expectedImprovements", []) or []),
                }
        except json.JSONDecodeError:
            # 3. 尝试修复:newContent 字段内的裸换行符转义为 \\n
            try:
                fixed = re.sub(
                    r'("newContent"\s*:\s*")(.*?)"(\s*[,\}])',
                    lambda m: m.group(1) + m.group(2).replace("\n", "\\n").replace('"', '\\"') + '"' + m.group(3),
                    raw,
                    flags=re.DOTALL,
                )
                obj = json.loads(fixed)
                if isinstance(obj, dict):
                    return {
                        "shouldIterate": bool(obj.get("shouldIterate", False)),
                        "newContent": str(obj.get("newContent", "")),
                        "reason": str(obj.get("reason", "")),
                        "expectedImprovements": list(obj.get("expectedImprovements", []) or []),
                    }
            except (json.JSONDecodeError, TypeError):
                pass

        # 4. 兜底:解析失败默认不迭代(避免格式问题误触发)
        return {
            "shouldIterate": False,
            "reason": f"LLM 输出无法解析为 JSON(前 100 字:{raw[:100]})",
            "expectedImprovements": [],
        }

    @staticmethod
    def bump_version(current: str) -> str:
        """语义化版本递增(默认 minor +1:major.minor.patch → major.(minor+1).0)。

        异常输入兜底返回 '1.1.0'。
        """
        try:
            parts = current.strip().split(".")
            if len(parts) < 2:
                return "1.1.0"
            major = int(parts[0])
            minor = int(parts[1])
            return f"{major}.{minor + 1}.0"
        except (ValueError, IndexError):
            return "1.1.0"

    @staticmethod
    def _read_skill_file(skill_name: str) -> tuple[str, str]:
        """读取 skill 文件,返回 (content, path)。不存在返回 ("", path)。"""
        from .skills import SkillRegistry

        auto_dir = SkillRegistry._auto_dir()
        skill_path = os.path.join(auto_dir, f"{skill_name}.md")
        if not os.path.isfile(skill_path):
            return "", skill_path
        try:
            with open(skill_path, "r", encoding="utf-8") as f:
                return f.read(), skill_path
        except Exception as e:
            logger.warning("读取 skill 文件失败(%s): %s", skill_path, e)
            return "", skill_path

    @staticmethod
    def _write_skill_file(skill_path: str, content: str) -> bool:
        """写回 skill 文件,返回是否成功。"""
        try:
            os.makedirs(os.path.dirname(skill_path), exist_ok=True)
            with open(skill_path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            logger.warning("写回 skill 文件失败(%s): %s", skill_path, e)
            return False

    @staticmethod
    def _extract_version(md_content: str) -> str:
        """从 SKILL.md frontmatter 提取 version。"""
        match = re.search(r"^version:\s*(.+?)\s*$", md_content, re.MULTILINE)
        return match.group(1) if match else ""

    @staticmethod
    def _rewrite_skill_md(old_md: str, new_instructions: str, new_version: str) -> str:
        """重写 SKILL.md:保留旧 frontmatter(仅替换 version),替换正文。

        若旧文件无 frontmatter(空),用最小 frontmatter 重建。
        """
        # 拆分 frontmatter 与正文
        if old_md.startswith("---"):
            match = re.match(r"^---\n(.*?)\n---\n?(.*)$", old_md, re.DOTALL)
            if match:
                frontmatter = match.group(1)
                # 替换 version 行(不存在则追加)
                if re.search(r"^version:\s*.+$", frontmatter, re.MULTILINE):
                    new_frontmatter = re.sub(
                        r"^version:\s*.+$",
                        f"version: {new_version}",
                        frontmatter,
                        count=1,
                        flags=re.MULTILINE,
                    )
                else:
                    new_frontmatter = frontmatter + f"\nversion: {new_version}"
                return f"---\n{new_frontmatter}\n---\n\n# Instructions\n\n{new_instructions}\n"
        # 无 frontmatter:重建最小 frontmatter
        return (
            "---\n"
            f"version: {new_version}\n"
            "source: auto\n"
            f"autoGeneratedAt: {datetime.now(timezone.utc).isoformat()}\n"
            "---\n\n"
            f"# Instructions\n\n{new_instructions}\n"
        )

    async def _verify_and_maybe_rollback(
        self,
        *,
        skill_name: str,
        new_content: str,
        skill_path: str,
        backup_md: str,
        baseline_pass_rate: float,
        current_version: str,
        new_version: str,
        reason: str,
    ) -> tuple[bool, float]:
        """重跑测试验证新版本:通过率提升则保留(返回 True),否则回滚(返回 False)。"""
        try:
            test_cases = await skill_tester.generate_test_cases(skill_name, new_content)
            test_result = await skill_tester.run_test({
                "skillName": skill_name,
                "skillContent": new_content,
                "testCases": test_cases,
            })
            new_pass_rate = float(test_result.get("passRate", 0.0) or 0.0)
        except Exception as e:
            logger.warning("验证测试失败(skill=%s): %s, 回滚", skill_name, e)
            self._write_skill_file(skill_path, backup_md)
            return (False, 0.0)

        # 通过率提升(>= 基线,允许持平以容忍测试用例波动)则保留
        if new_pass_rate >= baseline_pass_rate:
            # 刷新注册表
            try:
                from .skills import skill_registry

                skill_registry.reload_auto()
            except Exception:
                pass
            return (True, new_pass_rate)

        # 通过率下降 → 回滚
        logger.info(
            "迭代未提升(skill=%s): %s 基线 %.2f → 新 %.2f,回滚到 %s",
            skill_name, new_version, baseline_pass_rate, new_pass_rate, current_version,
        )
        self._write_skill_file(skill_path, backup_md)
        return (False, new_pass_rate)

    @staticmethod
    def _no_iterate(reason: str) -> dict[str, Any]:
        """构造不迭代的结果。"""
        return {
            "shouldIterate": False,
            "reason": reason,
            "expectedImprovements": [],
        }


skill_iterator = SkillIterator()
