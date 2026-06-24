"""多智能体编排引擎.

核心职责:
  1. 创建多智能体会话
  2. 分解任务并分配给各角色
  3. 协调智能体间的协作
  4. 汇总结果

支持两种模式:
  - CrewAI 模式: 完整多智能体协作 (需安装 crewai)
  - 简化模式: 顺序调用 LLM 模拟多角色协作 (回退方案)
"""

import json
from datetime import datetime
from typing import Any
from uuid import uuid4

from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.models.crew_models import CrewMessage, CrewSession, CrewTask
from app.services.crew_agent_registry import agent_registry
from app.services.crew_llm_adapter import create_crew_llm, get_available_models
from app.services.crew_tools import get_default_tools

# 检测 CrewAI 是否可用
try:
    from crewai import Agent, Crew, Process, Task

    _CREWAI_AVAILABLE = True
except ImportError:
    _CREWAI_AVAILABLE = False
    logger.info("CrewAI 未安装, 多智能体将使用简化模式")

# 默认免费模型 code (优先使用标记为免费的模型)
DEFAULT_FREE_MODEL_CODE = "zhipu_glm4_flash"


def _resolve_default_model_id() -> str:
    """当用户未指定模型时, 自动选择一个可用的免费模型."""
    try:
        models = get_available_models()
        if not models:
            return ""
        # 优先匹配预设的免费模型 code
        for m in models:
            if m.get("model_id") == DEFAULT_FREE_MODEL_CODE:
                return m["model_id"]
        # 回退: 优先选 flash/免费模型
        for m in models:
            mid = (m.get("model_id") or "").lower()
            name = m.get("name") or ""
            if "flash" in mid or "免费" in name:
                return m["model_id"]
        # 最终回退: 第一个可用模型
        return models[0].get("model_id", "")
    except Exception as e:
        logger.warning(f"解析默认模型失败: {e}")
        return ""


class CrewOrchestrator:
    """多智能体编排器."""

    def __init__(self) -> None:
        self._crewai_available = _CREWAI_AVAILABLE

    def create_session(
        self,
        user_id: str,
        input_message: str,
        title: str = "",
        config: dict[str, Any] | None = None,
    ) -> str:
        """创建多智能体会话, 返回会话 ID."""
        session_id = str(uuid4())
        with get_session() as db:
            session = CrewSession(
                id=session_id,
                user_id=user_id,
                title=title or input_message[:50],
                status="pending",
                input_message=input_message,
                config=json.dumps(config, ensure_ascii=False) if config else None,
            )
            db.add(session)
            db.commit()
        logger.info(f"创建多智能体会话: {session_id}")
        return session_id

    def execute_session(self, session_id: str) -> dict[str, Any]:
        """执行多智能体会话."""
        with get_session() as db:
            session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
            if not session:
                return {"success": False, "error": "会话不存在"}
            if session.status == "running":
                return {"success": False, "error": "会话正在执行中"}
            session.status = "running"
            db.commit()

            input_message = session.input_message or ""
            user_id = session.user_id
            config = json.loads(session.config) if session.config else {}

        try:
            if self._crewai_available:
                result = self._execute_with_crewai(session_id, input_message, user_id, config)
            else:
                result = self._execute_simplified(session_id, input_message, user_id, config)

            self._update_session_status(session_id, "completed", result)
            return {"success": True, "session_id": session_id, "result": result}
        except Exception as e:
            logger.error(f"会话执行失败: {e}")
            self._update_session_status(session_id, "failed", str(e))
            return {"success": False, "error": str(e)}

    def _execute_with_crewai(
        self, session_id: str, input_message: str, user_id: str, config: dict
    ) -> str:
        """使用 CrewAI 执行完整多智能体协作."""
        model_id = config.get("model_id", "") or _resolve_default_model_id()
        llm = create_crew_llm(model_id) if model_id else None
        tools = get_default_tools(
            collection_name=config.get("collection_name", ""),
            owner_uuid=user_id,
        )

        roles = agent_registry.get_execution_order()
        agents = {}
        for role_name in roles:
            cfg = agent_registry.get_role(role_name)
            if not cfg:
                continue
            agent_tools = []
            for tool_name in cfg.tools:
                if tool_name == "rag_search" and tools:
                    agent_tools.append(tools[0])
                elif tool_name == "coze_workflow" and len(tools) > 1:
                    agent_tools.append(tools[1])

            agents[role_name] = Agent(
                role=cfg.role,
                goal=cfg.goal,
                backstory=cfg.backstory,
                llm=llm,
                tools=agent_tools,
                allow_delegation=cfg.allow_delegation,
                verbose=cfg.verbose,
            )

        tasks = []
        task_plan = self._plan_tasks(input_message)
        for i, plan in enumerate(task_plan):
            role = plan["role"]
            agent = agents.get(role)
            if not agent:
                continue
            task = Task(
                description=plan["description"],
                expected_output=plan.get("expected_output", ""),
                agent=agent,
            )
            tasks.append(task)
            self._create_task_record(session_id, i, role, plan["description"])

        crew = Crew(
            agents=list(agents.values()),
            tasks=tasks,
            process=Process.sequential,
            verbose=True,
        )

        result = crew.kickoff()
        result_str = str(result)

        self._log_message(session_id, "system", "crew", result_str, "result")
        return result_str

    def _execute_simplified(
        self, session_id: str, input_message: str, user_id: str, config: dict
    ) -> str:
        """简化模式: 顺序调用 LLM 模拟多角色协作."""
        model_id = config.get("model_id", "") or _resolve_default_model_id()

        # 动态任务分解 (如果配置了 model_id)
        if model_id:
            task_plan = self._dynamic_plan_tasks(input_message, model_id)
        else:
            task_plan = self._plan_tasks(input_message)

        context = {"input": input_message}
        results = {}

        for i, plan in enumerate(task_plan):
            role = plan["role"]
            cfg = agent_registry.get_role(role)
            if not cfg:
                continue

            task_id = self._create_task_record(session_id, i, role, plan["description"])
            self._update_task_status(task_id, "running")

            prompt = self._build_prompt(role, cfg, plan, context)

            # 研究员角色注入 RAG 上下文
            if role == "researcher":
                rag_context = self._get_rag_context(input_message, config, user_id)
                if rag_context:
                    prompt += f"\n\n知识库参考信息:\n{rag_context}"

            # 带重试的 LLM 调用
            max_retries = config.get("max_retries", 2)
            output = None
            last_error = None

            for attempt in range(max_retries + 1):
                try:
                    llm = create_crew_llm(model_id) if model_id else None
                    if llm and hasattr(llm, "call"):
                        messages = [{"role": "user", "content": prompt}]
                        output = llm.call(messages)
                    else:
                        output = f"[LLM 未配置, 跳过 {role} 角色]"
                    break
                except Exception as e:
                    last_error = e
                    logger.warning(f"{role} 第 {attempt+1} 次执行失败: {e}")
                    if attempt < max_retries:
                        prompt += f"\n\n注意: 上次执行失败({e}), 请重试."
                    else:
                        output = f"[{role} 执行失败 (重试{max_retries}次): {e}]"

            if last_error and not output:
                self._update_task_status(task_id, "failed", error=str(last_error))
            else:
                self._update_task_status(task_id, "completed", output=output)

            results[role] = output or ""
            context[role] = output or ""
            self._log_message(session_id, role, "next", output or "")

        return results.get("reporter", results.get("executor", "无结果"))

    def execute_session_streaming(self, session_id: str):
        """流式执行会话, 生成器模式, 逐步产出进度.

        Yields:
            dict: 进度消息, 包含 type/content/role/task_index 等
        """
        with get_session() as db:
            session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
            if not session:
                yield {"type": "error", "content": "会话不存在"}
                return
            if session.status == "running":
                yield {"type": "error", "content": "会话正在执行中"}
                return
            session.status = "running"
            db.commit()
            input_message = session.input_message or ""
            user_id = session.user_id
            config = json.loads(session.config) if session.config else {}

        model_id = config.get("model_id", "") or _resolve_default_model_id()

        yield {"type": "start", "content": "多智能体协作开始", "session_id": session_id}

        try:
            # 动态任务分解
            if model_id:
                yield {"type": "planning", "content": "正在分析任务并制定执行计划..."}
                task_plan = self._dynamic_plan_tasks(input_message, model_id)
            else:
                task_plan = self._plan_tasks(input_message)

            yield {
                "type": "plan",
                "content": f"任务分解完成, 共 {len(task_plan)} 个步骤",
                "tasks": [{"role": t["role"], "description": t["description"]} for t in task_plan],
            }

            context = {"input": input_message}
            results = {}

            for i, plan in enumerate(task_plan):
                role = plan["role"]
                cfg = agent_registry.get_role(role)
                if not cfg:
                    continue

                yield {
                    "type": "task_start",
                    "role": role,
                    "task_index": i,
                    "content": f"[{role}] 开始执行: {plan['description'][:80]}...",
                }

                task_id = self._create_task_record(session_id, i, role, plan["description"])
                self._update_task_status(task_id, "running")

                prompt = self._build_prompt(role, cfg, plan, context)

                if role == "researcher":
                    rag_context = self._get_rag_context(input_message, config, user_id)
                    if rag_context:
                        prompt += f"\n\n知识库参考信息:\n{rag_context}"

                try:
                    llm = create_crew_llm(model_id) if model_id else None
                    if llm and hasattr(llm, "call"):
                        messages = [{"role": "user", "content": prompt}]
                        output = llm.call(messages)
                    else:
                        output = f"[LLM 未配置, 跳过 {role} 角色]"
                except Exception as e:
                    output = f"[{role} 执行失败: {e}]"
                    self._update_task_status(task_id, "failed", error=str(e))
                    yield {"type": "task_error", "role": role, "content": str(e)}
                else:
                    self._update_task_status(task_id, "completed", output=output)

                results[role] = output
                context[role] = output
                self._log_message(session_id, role, "next", output)

                yield {
                    "type": "task_complete",
                    "role": role,
                    "task_index": i,
                    "content": output[:500] + "..." if len(output) > 500 else output,
                }

            final_result = results.get("reporter", results.get("executor", "无结果"))
            self._update_session_status(session_id, "completed", final_result)

            yield {"type": "complete", "content": final_result, "session_id": session_id}
        except Exception as e:
            logger.error(f"流式执行异常: {e}")
            self._update_session_status(session_id, "failed", str(e))
            yield {"type": "error", "content": f"执行异常: {e}", "session_id": session_id}
        finally:
            # 确保会话状态不会卡在 running (如客户端断开导致生成器被 GC)
            try:
                with get_session() as db:
                    s = db.query(CrewSession).filter(CrewSession.id == session_id).first()
                    if s and s.status == "running":
                        s.status = "failed"
                        s.output_message = "执行被中断 (客户端断开或异常)"
                        s.completed_at = datetime.now()
                        db.commit()
            except Exception:
                pass

    def _plan_tasks(self, input_message: str) -> list[dict[str, str]]:
        """返回固定 5 步任务分解计划."""
        return [
            {
                "role": "planner",
                "description": f"分析以下需求并制定执行计划:\n{input_message}",
                "expected_output": "结构化的执行计划,包含步骤和优先级",
            },
            {
                "role": "researcher",
                "description": f"根据规划师的计划,检索相关知识库信息:\n{input_message}",
                "expected_output": "关键知识点和信息汇总",
            },
            {
                "role": "executor",
                "description": "根据规划和研究结果,执行核心任务",
                "expected_output": "任务执行成果",
            },
            {
                "role": "reviewer",
                "description": "审查执行结果,检查质量和准确性",
                "expected_output": "审查意见和改进建议",
            },
            {
                "role": "reporter",
                "description": "汇总所有阶段结果,生成最终报告",
                "expected_output": "完整的最终报告",
            },
        ]

    def _dynamic_plan_tasks(
        self, input_message: str, model_id: str
    ) -> list[dict[str, str]]:
        """使用 LLM 动态分解任务.

        根据输入消息的复杂度, 让 LLM 决定需要哪些角色和具体任务.
        回退到固定计划如果 LLM 调用失败.
        """
        planning_prompt = (
            "你是多智能体系统的任务规划器.\n"
            "根据以下用户需求, 生成一个任务执行计划.\n\n"
            f"用户需求: {input_message}\n\n"
            "可用角色: planner(规划), researcher(研究), executor(执行), reviewer(审查), reporter(报告)\n\n"
            "请返回 JSON 数组, 每个元素包含:\n"
            '- "role": 角色名\n'
            '- "description": 具体任务描述\n'
            '- "expected_output": 期望输出\n\n'
            "注意:\n"
            "1. 可以跳过不需要的角色 (如简单任务可跳过 researcher)\n"
            "2. 必须包含 reporter 作为最后一步\n"
            "3. 任务描述要具体, 结合用户需求\n"
            "4. 只返回 JSON 数组, 不要其他内容\n"
            "5. 执行顺序必须遵循: planner 在前, reporter 在最后\n"
        )

        try:
            llm = create_crew_llm(model_id)
            if llm and hasattr(llm, "call"):
                messages = [{"role": "user", "content": planning_prompt}]
                raw = llm.call(messages)

                # 解析 JSON
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                raw = raw.strip()

                plan = json.loads(raw)
                if isinstance(plan, list) and len(plan) > 0:
                    # 验证并规范化
                    valid_roles = {"planner", "researcher", "executor", "reviewer", "reporter"}
                    normalized = []
                    for item in plan:
                        role = item.get("role", "").strip().lower()
                        if role not in valid_roles:
                            continue
                        normalized.append({
                            "role": role,
                            "description": item.get("description", ""),
                            "expected_output": item.get("expected_output", ""),
                        })
                    # 确保最后一步是 reporter
                    if normalized and normalized[-1]["role"] != "reporter":
                        normalized.append({
                            "role": "reporter",
                            "description": "汇总所有阶段结果,生成最终报告",
                            "expected_output": "完整的最终报告",
                        })
                    # 强制按标准流水线顺序排序: planner 首位, reporter 末位
                    order_map = {r: i for i, r in enumerate(agent_registry.get_execution_order())}
                    normalized.sort(key=lambda x: order_map.get(x["role"], 99))
                    if normalized:
                        logger.info(f"动态任务分解: {len(normalized)} 个任务, 顺序: {[t['role'] for t in normalized]}")
                        return normalized
        except Exception as e:
            logger.warning(f"动态任务分解失败, 回退到固定计划: {e}")

        return self._plan_tasks(input_message)

    def _build_prompt(self, role: str, cfg, plan: dict, context: dict) -> str:
        """构建角色提示词."""
        prompt = f"你是{cfg.role}.\n目标: {cfg.goal}\n背景: {cfg.backstory}\n\n"
        prompt += f"当前任务: {plan['description']}\n\n"

        if role != "planner":
            if "planner" in context:
                prompt += f"规划师输出:\n{context['planner']}\n\n"
        if role in ("executor", "reviewer", "reporter"):
            if "researcher" in context:
                prompt += f"研究员输出:\n{context['researcher']}\n\n"
        if role in ("reviewer", "reporter"):
            if "executor" in context:
                prompt += f"执行者输出:\n{context['executor']}\n\n"
        if role == "reporter":
            if "reviewer" in context:
                prompt += f"审查员输出:\n{context['reviewer']}\n\n"

        prompt += "请输出你的工作成果:"
        return prompt

    def _get_rag_context(self, query: str, config: dict, user_id: str) -> str:
        """获取 RAG 上下文 (如果知识库服务可用)."""
        try:
            from app.services.knowledge_service import knowledge_service

            return knowledge_service.get_rag_context(
                query=query,
                collection_name=config.get("collection_name", "default"),
                top_k=5,
                owner_uuid=user_id,
            ) or ""
        except ImportError:
            return ""
        except Exception as e:
            logger.warning(f"RAG 上下文获取失败: {e}")
            return ""

    def _create_task_record(
        self, session_id: str, index: int, role: str, description: str
    ) -> str:
        """创建任务记录."""
        task_id = str(uuid4())
        with get_session() as db:
            task = CrewTask(
                id=task_id,
                session_id=session_id,
                task_index=index,
                agent_role=role,
                description=description,
                status="pending",
            )
            db.add(task)
            db.commit()
        return task_id

    def _update_task_status(
        self,
        task_id: str,
        status: str,
        output: str | None = None,
        error: str | None = None,
    ) -> None:
        """更新任务状态."""
        with get_session() as db:
            task = db.query(CrewTask).filter(CrewTask.id == task_id).first()
            if task:
                task.status = status
                if output:
                    task.output_data = output
                if error:
                    task.error_message = error
                if status == "running":
                    task.started_at = datetime.utcnow()
                elif status in ("completed", "failed"):
                    task.completed_at = datetime.utcnow()
                db.commit()

    def _update_session_status(
        self, session_id: str, status: str, result: str | None = None
    ) -> None:
        """更新会话状态."""
        with get_session() as db:
            session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
            if session:
                session.status = status
                if result:
                    session.output_message = result if isinstance(result, str) else str(result)
                if status in ("completed", "failed"):
                    session.completed_at = datetime.utcnow()
                db.commit()

    def _log_message(
        self,
        session_id: str,
        from_role: str,
        to_role: str,
        content: str,
        msg_type: str = "text",
    ) -> None:
        """记录消息日志."""
        with get_session() as db:
            msg = CrewMessage(
                session_id=session_id,
                from_role=from_role,
                to_role=to_role,
                content=content[:10000],
                message_type=msg_type,
            )
            db.add(msg)
            db.commit()

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        """获取会话详情."""
        with get_session() as db:
            session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
            if not session:
                return None
            return {
                "id": session.id,
                "user_id": session.user_id,
                "title": session.title,
                "status": session.status,
                "input_message": session.input_message,
                "output_message": session.output_message,
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            }

    def list_sessions(self, user_id: str = "", limit: int = 20) -> list[dict[str, Any]]:
        """列出会话."""
        with get_session() as db:
            q = db.query(CrewSession)
            if user_id:
                q = q.filter(CrewSession.user_id == user_id)
            sessions = q.order_by(CrewSession.created_at.desc()).limit(limit).all()
            return [
                {
                    "id": s.id,
                    "title": s.title,
                    "status": s.status,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                }
                for s in sessions
            ]

    def get_session_tasks(self, session_id: str) -> list[dict[str, Any]]:
        """获取会话的任务列表."""
        with get_session() as db:
            tasks = (
                db.query(CrewTask)
                .filter(CrewTask.session_id == session_id)
                .order_by(CrewTask.task_index)
                .all()
            )
            return [
                {
                    "id": t.id,
                    "task_index": t.task_index,
                    "agent_role": t.agent_role,
                    "description": t.description,
                    "status": t.status,
                    "output_data": t.output_data,
                    "error_message": t.error_message,
                    "started_at": t.started_at.isoformat() if t.started_at else None,
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                }
                for t in tasks
            ]

    def get_session_messages(self, session_id: str) -> list[dict[str, Any]]:
        """获取会话的消息日志."""
        with get_session() as db:
            msgs = (
                db.query(CrewMessage)
                .filter(CrewMessage.session_id == session_id)
                .order_by(CrewMessage.created_at)
                .all()
            )
            return [
                {
                    "id": m.id,
                    "from_role": m.from_role,
                    "to_role": m.to_role,
                    "content": m.content,
                    "message_type": m.message_type,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in msgs
            ]

    def cancel_session(self, session_id: str) -> bool:
        """取消会话."""
        with get_session() as db:
            session = db.query(CrewSession).filter(CrewSession.id == session_id).first()
            if not session:
                return False
            if session.status in ("completed", "failed", "cancelled"):
                return False
            session.status = "cancelled"
            db.commit()
            return True


crew_orchestrator = CrewOrchestrator()
