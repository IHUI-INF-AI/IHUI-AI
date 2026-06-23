"""多智能体角色注册表.

定义 5 个核心角色及其配置:
  - planner   规划师: 任务分解与流程设计
  - researcher 研究员: 信息检索与知识收集
  - executor  执行者: 具体任务执行
  - reviewer  审查员: 质量检查与反馈
  - reporter  报告员: 结果汇总与报告生成
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentRoleConfig:
    """智能体角色配置."""

    role: str
    goal: str
    backstory: str
    llm_model_id: str = ""
    tools: list[str] = field(default_factory=list)
    allow_delegation: bool = False
    verbose: bool = True


DEFAULT_ROLES: dict[str, AgentRoleConfig] = {
    "planner": AgentRoleConfig(
        role="planner",
        goal="分析用户需求,将复杂任务分解为可执行的子任务序列,制定最优执行计划",
        backstory=(
            "你是一位经验丰富的项目规划师,擅长将复杂问题拆解为清晰的步骤。"
            "你总是考虑任务间的依赖关系和执行优先级,确保计划的高效性和可操作性。"
        ),
        llm_model_id="",
        tools=[],
        allow_delegation=True,
    ),
    "researcher": AgentRoleConfig(
        role="researcher",
        goal="利用知识库和外部资源收集与任务相关的信息,为团队提供准确的知识支撑",
        backstory=(
            "你是一位严谨的研究员,拥有强大的信息检索和分析能力。"
            "你善于从海量信息中提取关键知识点,为后续执行提供可靠的依据。"
        ),
        llm_model_id="",
        tools=["rag_search"],
        allow_delegation=False,
    ),
    "executor": AgentRoleConfig(
        role="executor",
        goal="根据规划和研究结果,高效执行具体任务,产出高质量的工作成果",
        backstory=(
            "你是一位全能的执行专家,具备广泛的技能和丰富的实战经验。"
            "你能够调用各种工具和API来完成任务,确保输出结果的准确性和完整性。"
        ),
        llm_model_id="",
        tools=["coze_workflow", "llm_generate"],
        allow_delegation=False,
    ),
    "reviewer": AgentRoleConfig(
        role="reviewer",
        goal="审查执行结果的质量和准确性,提供改进建议,确保最终交付物满足要求",
        backstory=(
            "你是一位严格的质量审查专家,对细节有着极高的敏感度。"
            "你不仅检查结果的正确性,还关注逻辑性、完整性和用户体验。"
        ),
        llm_model_id="",
        tools=[],
        allow_delegation=False,
    ),
    "reporter": AgentRoleConfig(
        role="reporter",
        goal="汇总所有阶段的结果,生成结构清晰、内容完整的最终报告",
        backstory=(
            "你是一位专业的技术写作专家,擅长将复杂的技术内容转化为清晰易懂的报告。"
            "你注重逻辑结构和表达效果,确保读者能快速获取关键信息。"
        ),
        llm_model_id="",
        tools=[],
        allow_delegation=False,
    ),
}


class AgentRegistry:
    """智能体角色注册中心."""

    def __init__(self) -> None:
        self._roles: dict[str, AgentRoleConfig] = dict(DEFAULT_ROLES)

    def get_role(self, role_name: str) -> AgentRoleConfig | None:
        """获取角色配置."""
        return self._roles.get(role_name)

    def list_roles(self) -> list[dict[str, Any]]:
        """列出所有角色."""
        return [
            {
                "role": cfg.role,
                "goal": cfg.goal,
                "backstory": cfg.backstory,
                "tools": cfg.tools,
                "allow_delegation": cfg.allow_delegation,
            }
            for cfg in self._roles.values()
        ]

    def register_role(self, config: AgentRoleConfig) -> None:
        """注册新角色或覆盖已有角色."""
        self._roles[config.role] = config

    def update_role_llm(self, role_name: str, llm_model_id: str) -> bool:
        """更新角色的 LLM 模型."""
        cfg = self._roles.get(role_name)
        if cfg is None:
            return False
        cfg.llm_model_id = llm_model_id
        return True

    def get_execution_order(self) -> list[str]:
        """返回默认执行顺序."""
        return ["planner", "researcher", "executor", "reviewer", "reporter"]


agent_registry = AgentRegistry()
