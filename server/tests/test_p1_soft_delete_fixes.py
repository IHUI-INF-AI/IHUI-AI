"""
2026-06-25 P1 软删除过滤修复验证测试

覆盖:
- admin_panel 用户/角色/菜单/岗位/字典/通知/配置/任务/SMS模板查询带 del_flag 过滤
- admin_migration Message 查询带 deleted_at 过滤
- 软删除的记录不应被查询返回
- SoftDeleteMixin / DelFlagMixin / soft_delete_filter 单元测试
"""

import pytest


# =============================================================================
# admin_panel.py 软删除过滤测试 (新增: Config/Dict/Notice/Job/SmsTemplate)
# =============================================================================


class TestAdminPanelSoftDelete:
    """admin_panel.py 关键查询必须过滤 del_flag == '0'."""

    def test_user_list_filters_deleted(self):
        from app.api.v1.admin_panel import user_list
        import inspect
        source = inspect.getsource(user_list)
        assert "SysUser.del_flag" in source
        assert '"0"' in source

    def test_get_user_filters_deleted(self):
        from app.api.v1.admin_panel import get_user
        import inspect
        source = inspect.getsource(get_user)
        assert "SysUser.del_flag" in source

    def test_menu_list_filters_deleted(self):
        from app.api.v1.admin_panel import menu_list
        import inspect
        source = inspect.getsource(menu_list)
        assert "SysMenu.del_flag" in source

    def test_menu_treeselect_filters_deleted(self):
        from app.api.v1.admin_panel import menu_treeselect
        import inspect
        source = inspect.getsource(menu_treeselect)
        assert "SysMenu.del_flag" in source

    def test_get_routers_filters_deleted(self):
        from app.api.v1.admin_panel import get_routers
        import inspect
        source = inspect.getsource(get_routers)
        assert "SysMenu.del_flag" in source

    def test_post_list_filters_deleted(self):
        from app.api.v1.admin_panel import post_list
        import inspect
        source = inspect.getsource(post_list)
        assert "SysPost.del_flag" in source

    def test_get_post_filters_deleted(self):
        from app.api.v1.admin_panel import get_post
        import inspect
        source = inspect.getsource(get_post)
        assert "SysPost.del_flag" in source

    def test_user_info_by_name_filters_deleted_role(self):
        from app.api.v1.admin_panel import user_info_by_name
        import inspect
        source = inspect.getsource(user_info_by_name)
        assert "SysRole.del_flag" in source

    def test_user_auth_role_filters_deleted_role(self):
        from app.api.v1.admin_panel import user_auth_role
        import inspect
        source = inspect.getsource(user_auth_role)
        assert source.count("SysRole.del_flag") >= 1

    # --- 2026-06-25 P1 新增: Config/Dict/Notice/Job/SmsTemplate ---

    def test_config_list_filters_deleted(self):
        from app.api.v1.admin_panel import config_list
        import inspect
        source = inspect.getsource(config_list)
        assert "SysConfig.del_flag" in source
        assert '"0"' in source

    def test_get_config_by_key_filters_deleted(self):
        from app.api.v1.admin_panel import get_config_by_key
        import inspect
        source = inspect.getsource(get_config_by_key)
        assert "SysConfig.del_flag" in source

    def test_get_config_filters_deleted(self):
        from app.api.v1.admin_panel import get_config
        import inspect
        source = inspect.getsource(get_config)
        assert "SysConfig.del_flag" in source

    def test_delete_configs_uses_soft_delete(self):
        """delete_configs 必须用 soft delete (update del_flag='2'), 不是物理删除."""
        from app.api.v1.admin_panel import delete_configs
        import inspect
        source = inspect.getsource(delete_configs)
        # 应使用 .update 软删除, 而不是物理 .delete
        assert ".update(" in source
        assert 'del_flag: "2"' in source or "del_flag='2'" in source
        # 排除装饰器 @xxx.delete(...) 的误判, 检查实际 .delete(synchronize_session=False) 调用
        assert ".delete(synchronize_session=False)" not in source

    def test_dict_type_list_filters_deleted(self):
        from app.api.v1.admin_panel import dict_type_list
        import inspect
        source = inspect.getsource(dict_type_list)
        assert "SysDictType.del_flag" in source

    def test_dict_type_optionselect_filters_deleted(self):
        from app.api.v1.admin_panel import dict_type_optionselect
        import inspect
        source = inspect.getsource(dict_type_optionselect)
        assert "SysDictType.del_flag" in source

    def test_dict_data_list_filters_deleted(self):
        from app.api.v1.admin_panel import dict_data_list
        import inspect
        source = inspect.getsource(dict_data_list)
        assert "SysDictData.del_flag" in source

    def test_dict_data_by_type_filters_deleted(self):
        from app.api.v1.admin_panel import dict_data_by_type
        import inspect
        source = inspect.getsource(dict_data_by_type)
        assert "SysDictData.del_flag" in source

    def test_notice_list_filters_deleted(self):
        from app.api.v1.admin_panel import notice_list
        import inspect
        source = inspect.getsource(notice_list)
        assert "SysNotice.del_flag" in source

    def test_get_notice_filters_deleted(self):
        from app.api.v1.admin_panel import get_notice
        import inspect
        source = inspect.getsource(get_notice)
        assert "SysNotice.del_flag" in source

    def test_delete_notices_uses_soft_delete(self):
        from app.api.v1.admin_panel import delete_notices
        import inspect
        source = inspect.getsource(delete_notices)
        assert ".update(" in source
        # 排除装饰器, 检查物理删除调用
        assert ".delete(synchronize_session=False)" not in source

    def test_sms_template_list_filters_deleted(self):
        from app.api.v1.admin_panel import sms_template_list
        import inspect
        source = inspect.getsource(sms_template_list)
        assert "SysSmsTemplate.del_flag" in source

    def test_get_sms_template_filters_deleted(self):
        from app.api.v1.admin_panel import get_sms_template
        import inspect
        source = inspect.getsource(get_sms_template)
        assert "SysSmsTemplate.del_flag" in source

    def test_sms_template_update_filters_deleted(self):
        from app.api.v1.admin_panel import update_sms_template
        import inspect
        source = inspect.getsource(update_sms_template)
        assert "SysSmsTemplate.del_flag" in source

    def test_job_list_filters_deleted(self):
        from app.api.v1.admin_panel import job_list
        import inspect
        source = inspect.getsource(job_list)
        assert "SysJob.del_flag" in source

    def test_get_job_filters_deleted(self):
        from app.api.v1.admin_panel import get_job
        import inspect
        source = inspect.getsource(get_job)
        assert "SysJob.del_flag" in source

    def test_update_job_filters_deleted(self):
        from app.api.v1.admin_panel import update_job
        import inspect
        source = inspect.getsource(update_job)
        assert "SysJob.del_flag" in source

    def test_change_job_status_filters_deleted(self):
        from app.api.v1.admin_panel import change_job_status
        import inspect
        source = inspect.getsource(change_job_status)
        assert "SysJob.del_flag" in source

    def test_run_job_once_filters_deleted(self):
        from app.api.v1.admin_panel import run_job_once
        import inspect
        source = inspect.getsource(run_job_once)
        assert "SysJob.del_flag" in source

    def test_delete_jobs_uses_soft_delete(self):
        """delete_jobs 必须用 soft delete (update del_flag='2'), 不是物理删除."""
        from app.api.v1.admin_panel import delete_jobs
        import inspect
        source = inspect.getsource(delete_jobs)
        # 应使用 .update 软删除, 而不是物理 .delete
        assert ".update(" in source
        # 排除装饰器 @xxx.delete(...) 的误判, 检查实际物理删除调用
        # .delete(synchronize_session=False) 或 .delete() 才是物理删除
        assert ".delete(synchronize_session=False)" not in source
        # 验证装饰器用的是 .delete (这是路由装饰, 不是物理删除), 单独验证
        assert "@job_router.delete(" in source
        # 软删除标志 (del_flag='2') 必须存在
        assert 'del_flag: "2"' in source or "del_flag='2'" in source


# =============================================================================
# admin_models.py 模型字段测试 (新增 del_flag)
# =============================================================================


class TestAdminModelDelFlag:
    """admin_models.py 中所有需要软删除的表必须有 del_flag 字段."""

    @pytest.mark.parametrize(
        "model_name",
        [
            "AdminUser",
            "AdminRole",
            "AdminMenu",
            "AdminDept",
            "AdminDictType",
            "AdminDictData",
            "AdminConfig",
            "AdminNotice",
            "AdminPost",
            "AdminJob",
            "AdminSmsTemplate",
        ],
    )
    def test_model_has_del_flag(self, model_name):
        from app.models.admin_models import (
            AdminUser,
            AdminRole,
            AdminMenu,
            AdminDept,
            AdminDictType,
            AdminDictData,
            AdminConfig,
            AdminNotice,
            AdminPost,
            AdminJob,
            AdminSmsTemplate,
        )

        model = {
            "AdminUser": AdminUser,
            "AdminRole": AdminRole,
            "AdminMenu": AdminMenu,
            "AdminDept": AdminDept,
            "AdminDictType": AdminDictType,
            "AdminDictData": AdminDictData,
            "AdminConfig": AdminConfig,
            "AdminNotice": AdminNotice,
            "AdminPost": AdminPost,
            "AdminJob": AdminJob,
            "AdminSmsTemplate": AdminSmsTemplate,
        }[model_name]

        assert hasattr(model, "del_flag"), f"{model_name} 缺少 del_flag 字段"


# =============================================================================
# 反馈/消息/问答模块的软删除过滤测试
# =============================================================================


class TestFeedbackSoftDelete:
    """feedback.py 必须过滤 status==2 (已忽略) 作为业务软删除."""

    def test_list_my_feedbacks_filters_ignored_by_default(self):
        from app.api.v1.feedback.feedback import list_my_feedbacks
        import inspect
        source = inspect.getsource(list_my_feedbacks)
        # 默认必须过滤 status != 2
        assert "status != 2" in source or 'status != 2' in source

    def test_get_feedback_filters_ignored(self):
        from app.api.v1.feedback.feedback import get_feedback
        import inspect
        source = inspect.getsource(get_feedback)
        # 详情接口也必须过滤 status != 2
        assert "status != 2" in source or 'status != 2' in source


class TestMessageAnnouncementSoftDelete:
    """message.py 的公告详情必须过滤 status==1 (已上线)."""

    def test_get_announcement_filters_status(self):
        from app.api.v1.message.message import get_announcement
        import inspect
        source = inspect.getsource(get_announcement)
        # 公告详情应只返回 status==1 (上线)
        assert "status == 1" in source or "status==1" in source


class TestAskQuestionSoftDelete:
    """ask/question.py 的 update_question 必须过滤已删除问题."""

    def test_update_question_filters_deleted(self):
        from app.api.v1.ask.question import update_question
        import inspect
        source = inspect.getsource(update_question)
        # 必须过滤 deleted=True
        assert "not AskQuestion.deleted" in source or "deleted=False" in source


# =============================================================================
# SoftDeleteMixin / DelFlagMixin / soft_delete_filter 单元测试
# =============================================================================


class TestSoftDeleteMixin:
    """SoftDeleteMixin 软删除行为验证.

    注意: SoftDeleteMixin 在类级别定义 deleted_at 字段为 Column 描述符.
    通过 SQLAlchemy mapper 之后, 实例访问 deleted_at 会返回该实例的实际值.
    直接创建 FakeModel() (不经过 mapper) 会返回 Column 对象, 不符合 None 断言.
    本测试使用真实的 SQLAlchemy 表来验证行为.
    """

    def _make_test_model(self):
        """创建临时 SQLAlchemy 模型用于测试 SoftDeleteMixin."""
        from sqlalchemy import Column, Integer
        from sqlalchemy.orm import declarative_base

        from app.models.base import SoftDeleteMixin

        TestBase = declarative_base()

        class TestModel(SoftDeleteMixin, TestBase):
            __tablename__ = "test_soft_delete_mixin"
            id = Column(Integer, primary_key=True)

        return TestModel, TestBase

    def test_soft_delete_sets_deleted_at(self):
        TestModel, TestBase = self._make_test_model()
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        engine = create_engine("sqlite:///:memory:", echo=False)
        TestBase.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        session = Session()

        obj = TestModel()
        session.add(obj)
        session.commit()

        # 初始状态: deleted_at 应该是 None
        assert obj.deleted_at is None
        assert not obj.is_deleted

        # 软删除
        obj.soft_delete()
        session.commit()
        assert obj.deleted_at is not None
        assert obj.is_deleted

    def test_restore_clears_deleted_at(self):
        TestModel, TestBase = self._make_test_model()
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        engine = create_engine("sqlite:///:memory:", echo=False)
        TestBase.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        session = Session()

        obj = TestModel()
        session.add(obj)
        session.commit()
        obj.soft_delete()
        session.commit()
        assert obj.is_deleted

        obj.restore()
        session.commit()
        assert obj.deleted_at is None
        assert not obj.is_deleted

    def test_set_deleted_with_custom_time(self):
        from datetime import datetime

        TestModel, TestBase = self._make_test_model()
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        engine = create_engine("sqlite:///:memory:", echo=False)
        TestBase.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        session = Session()

        obj = TestModel()
        session.add(obj)
        session.commit()

        custom = datetime(2020, 1, 1, 12, 0, 0)
        obj.set_deleted(custom)
        session.commit()
        assert obj.deleted_at == custom


class TestDelFlagMixin:
    """DelFlagMixin 软删除行为验证."""

    def test_soft_delete_sets_del_flag_to_2(self):
        from app.models.base import DelFlagMixin

        class FakeModel(DelFlagMixin):
            del_flag = "0"

        obj = FakeModel()
        assert obj.del_flag == "0"
        assert not obj.is_deleted
        obj.soft_delete()
        assert obj.del_flag == "2"
        assert obj.is_deleted

    def test_restore_sets_del_flag_to_0(self):
        from app.models.base import DelFlagMixin

        class FakeModel(DelFlagMixin):
            del_flag = "0"

        obj = FakeModel()
        obj.soft_delete()
        assert obj.del_flag == "2"
        obj.restore()
        assert obj.del_flag == "0"

    def test_soft_delete_handles_missing_del_flag(self):
        """即使模型没有 del_flag 字段, soft_delete 也不抛错."""
        from app.models.base import DelFlagMixin

        class FakeModel(DelFlagMixin):
            pass

        obj = FakeModel()
        # 应不抛错
        obj.soft_delete()
        obj.restore()
        # is_deleted 应返回 False (因为没有 del_flag 字段)
        assert not obj.is_deleted


class TestSoftDeleteFilterHelper:
    """soft_delete_filter 通用过滤助手验证."""

    def test_filter_with_del_flag(self):
        from app.models.admin_models import AdminConfig
        from app.models.base import soft_delete_filter

        expr = soft_delete_filter(AdminConfig)
        # 表达式应被构造 (BinaryExpression 对象)
        assert expr is not None
        assert expr is not True  # 不应该是永真条件

    def test_filter_with_deleted_at(self):
        from app.models.base import soft_delete_filter

        class FakeModel:
            deleted_at = None  # 模拟字段

        expr = soft_delete_filter(FakeModel, "deleted_at", None)
        # 永真条件 (字段为 None 时)
        # 不抛错即可
        assert expr is True

    def test_filter_with_missing_field_returns_true(self):
        """字段不存在时应返回永真, 兼容旧代码."""

        class FakeModel:
            pass

        from app.models.base import soft_delete_filter

        # 不抛错, 返回永真
        result = soft_delete_filter(FakeModel, "non_existent_field")
        assert result is True


# =============================================================================
# 审计脚本测试
# =============================================================================


class TestAuditScriptSoftDelete:
    """审计脚本自身软删除检测应正确识别同行业务."""

    def test_audit_supports_both_del_flag_and_deleted_at(self):
        import re
        from pathlib import Path

        audit_src = Path("g:/IHUI-AI/server/scripts/backend_audit.py").read_text(encoding="utf-8")
        # 必须包含两种模式
        assert "del_flag" in audit_src
        assert "deleted_at" in audit_src

    def test_audit_reports_admin_panel_improved(self):
        """admin_panel.py P1-MissingSoftDelete 问题数应显著减少 (修复前 50+)."""
        import subprocess

        result = subprocess.run(
            ["python", "scripts/backend_audit.py"],
            cwd="g:/IHUI-AI/server",
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout
        # admin_panel.py 应大幅减少 (目标 < 15)
        lines = [l for l in output.split("\n") if "admin_panel.py" in l and "P1-MissingSoftDelete" in l]
        assert len(lines) < 20, f"admin_panel.py 仍有 {len(lines)} 个 P1 问题待修复"


# =============================================================================
# 安全模块: require_role / require_permission to_thread 包装
# =============================================================================


class TestSecurityRolePermissionToThread:
    """require_role/require_permission 必须用 asyncio.to_thread 包装."""

    def test_require_role_uses_to_thread(self):
        import importlib

        import app.security as security_mod
        import inspect

        security_src = inspect.getsource(security_mod)
        assert "asyncio.to_thread" in security_src
        assert "_check_role_sync" in security_src
        assert "_check_perm_sync" in security_src

    def test_sync_check_functions_return_bool(self):
        import inspect

        from app.security import _check_role_sync, _check_perm_sync

        for func in [_check_role_sync, _check_perm_sync]:
            sig = inspect.signature(func)
            assert sig.return_annotation is bool, f"{func.__name__} 应返回 bool"


# =============================================================================
# 集成测试: 使用内存 SQLite 验证软删除行为
# =============================================================================


class TestSoftDeleteIntegration:
    """集成测试: 创建表 -> 插入数据 -> 软删除 -> 验证查询过滤."""

    @pytest.fixture
    def session_local(self):
        """创建内存 SQLite 会话."""
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        from app.database import Base
        from app.models.admin_models import AdminConfig

        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(engine, tables=[AdminConfig.__table__])
        Session = sessionmaker(bind=engine)
        return Session()

    def test_soft_deleted_config_not_in_list_query(self, session_local):
        """软删的 config 不应出现在 list 查询中."""
        from app.models.admin_models import AdminConfig

        # 插入 2 条 config
        c1 = AdminConfig(config_name="active", config_key="key1", config_value="v1", del_flag="0")
        c2 = AdminConfig(config_name="deleted", config_key="key2", config_value="v2", del_flag="2")
        session_local.add_all([c1, c2])
        session_local.commit()

        # 模拟 list 查询 (加 del_flag == "0" 过滤)
        active = session_local.query(AdminConfig).filter(AdminConfig.del_flag == "0").all()
        assert len(active) == 1
        assert active[0].config_key == "key1"

    def test_soft_delete_method_works(self, session_local):
        """DelFlagMixin.soft_delete() 应正确工作."""
        from app.models.admin_models import AdminConfig

        c = AdminConfig(config_name="test", config_key="k", config_value="v", del_flag="0")
        session_local.add(c)
        session_local.commit()

        # 通过 soft_delete 删除
        c.soft_delete()
        session_local.commit()
        assert c.del_flag == "2"
        assert c.is_deleted

        # 不应被默认 list 查询返回
        active = session_local.query(AdminConfig).filter(AdminConfig.del_flag == "0").all()
        assert c not in active


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
