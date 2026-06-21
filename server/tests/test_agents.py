"""Agent 规则 / 需求任务测试（仅验证 ORM 注册和路由挂载，不触达 DB）."""



class TestRuleModel:
    def test_agent_rule_table_name(self):
        from app.models.agent_rule_models import AgentRule

        assert AgentRule.__tablename__ == "zhs_agent_rule"

    def test_need_task_table_name(self):
        from app.models.agent_rule_models import AgentNeedTask

        assert AgentNeedTask.__tablename__ == "zhs_agent_need_task"


class TestRulesRouter:
    def test_router_has_endpoints(self):
        from app.api.v1.agents.rules import router

        paths = [r.path for r in router.routes]
        assert "/list" in paths
        assert "/create" in paths
        assert "/search" in paths
        assert "/need-task/list" in paths
        assert "/need-task/create" in paths
        assert "/need-task/accept" in paths
        assert "/need-task/complete" in paths


class TestMultiVendorRouter:
    def test_vendors_count(self):
        from app.api.v1.chat.multi import VENDOR_ENDPOINTS

        assert len(VENDOR_ENDPOINTS) >= 5
        for v in ("zhipu", "openrouter", "luyala", "n8n", "bailian", "coze_workflow", "langchain"):
            assert v in VENDOR_ENDPOINTS


class TestCozeCompat:
    def test_client_class(self):
        from app.utils.coze_compat import CozeClient

        cli = CozeClient()
        assert cli.base
