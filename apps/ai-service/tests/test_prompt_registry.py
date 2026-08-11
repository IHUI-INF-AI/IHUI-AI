"""Prompt Registry 单元测试。

覆盖:
- 创建 prompt
- 更新 prompt(创建新版本)
- 获取指定版本内容
- 回滚到历史版本
- 列出所有 prompt
- 获取版本列表
- 删除 prompt
- 10 个默认 prompt 已加载
- 不存在的 prompt 返回 None
"""

from __future__ import annotations

from app.services.prompt_registry import (
    DEFAULT_PROMPTS,
    PromptRegistry,
    prompt_registry,
)


class TestPromptRegistry:
    def setup_method(self) -> None:
        """每个测试方法前创建干净的 registry 实例。"""
        self.registry = PromptRegistry()

    # =========================================================================
    # 默认 prompt
    # =========================================================================

    def test_default_prompts_loaded(self) -> None:
        """验证 10 个默认 prompt 已加载。"""
        prompts = self.registry.list_prompts()
        assert len(prompts) == 10
        names = {p["name"] for p in prompts}
        expected = {
            "researcher", "coder", "reviewer", "architect", "debugger",
            "frontend-dev", "backend-dev", "devops", "security-auditor",
            "test-engineer",
        }
        assert names == expected

    def test_default_prompt_content_matches(self) -> None:
        """验证默认 prompt 内容与 DEFAULT_PROMPTS 一致。"""
        for name, info in DEFAULT_PROMPTS.items():
            content = self.registry.get(name)
            assert content == info["content"], f"prompt {name} 内容不匹配"

    def test_default_prompt_version_1(self) -> None:
        """验证默认 prompt 版本号为 1。"""
        for name in DEFAULT_PROMPTS:
            versions = self.registry.get_versions(name)
            assert len(versions) == 1
            assert versions[0]["version"] == 1

    # =========================================================================
    # 创建
    # =========================================================================

    def test_create_prompt(self) -> None:
        """创建新 prompt。"""
        entry = self.registry.create("test-agent", "你是测试 agent。", "测试用")
        assert entry.name == "test-agent"
        assert entry.latest_version == 1
        assert self.registry.get("test-agent") == "你是测试 agent。"

    def test_create_overwrite_existing(self) -> None:
        """创建已存在的 prompt 会覆盖。"""
        self.registry.create("test-agent", "v1", "第一次")
        self.registry.create("test-agent", "v2", "第二次")
        # create 会覆盖整个 entry，版本重置为 1
        content = self.registry.get("test-agent")
        assert content == "v2"

    # =========================================================================
    # 更新(创建新版本)
    # =========================================================================

    def test_update_prompt_creates_new_version(self) -> None:
        """更新 prompt 创建新版本，旧版本保留。"""
        self.registry.create("test-agent", "v1", "初始版本")
        self.registry.update("test-agent", "v2内容", "第二版")
        assert self.registry.get("test-agent") == "v2内容"
        assert self.registry.get("test-agent", version=1) == "v1"
        assert self.registry.get("test-agent", version=2) == "v2内容"

    def test_update_not_exist_creates(self) -> None:
        """更新不存在的 prompt 相当于创建。"""
        entry = self.registry.update("new-agent", "新内容", "新 agent")
        assert entry.latest_version == 1
        assert self.registry.get("new-agent") == "新内容"

    def test_multiple_updates(self) -> None:
        """多次更新，版本递增。"""
        self.registry.create("test-agent", "v1")
        for i in range(2, 6):
            self.registry.update("test-agent", f"v{i}")
        versions = self.registry.get_versions("test-agent")
        assert len(versions) == 5
        assert versions[-1]["version"] == 5
        assert versions[-1]["content"] == "v5"

    # =========================================================================
    # 获取指定版本
    # =========================================================================

    def test_get_specific_version(self) -> None:
        """获取指定版本内容。"""
        self.registry.create("test-agent", "v1")
        self.registry.update("test-agent", "v2")
        self.registry.update("test-agent", "v3")
        assert self.registry.get("test-agent", version=1) == "v1"
        assert self.registry.get("test-agent", version=2) == "v2"
        assert self.registry.get("test-agent", version=3) == "v3"

    def test_get_nonexistent_version(self) -> None:
        """获取不存在的版本返回 None。"""
        self.registry.create("test-agent", "v1")
        assert self.registry.get("test-agent", version=99) is None

    def test_get_nonexistent_prompt(self) -> None:
        """获取不存在的 prompt 返回 None。"""
        assert self.registry.get("nonexistent") is None
        assert self.registry.get("nonexistent", version=1) is None

    # =========================================================================
    # 回滚
    # =========================================================================

    def test_rollback_to_previous_version(self) -> None:
        """回滚到上一版本，内容恢复，版本递增。"""
        self.registry.create("test-agent", "v1")
        self.registry.update("test-agent", "v2")
        self.registry.update("test-agent", "v3")
        entry = self.registry.rollback("test-agent", target_version=1)
        assert entry.latest_version == 4
        assert self.registry.get("test-agent") == "v1"
        # 验证版本 4 是回滚版
        v4 = self.registry.get_versions("test-agent")[-1]
        assert v4["version"] == 4
        assert v4["content"] == "v1"
        assert "回滚" in v4["description"]

    def test_rollback_to_middle_version(self) -> None:
        """回滚到中间版本。"""
        self.registry.create("test-agent", "v1")
        self.registry.update("test-agent", "v2")
        self.registry.update("test-agent", "v3")
        self.registry.rollback("test-agent", target_version=2)
        assert self.registry.get("test-agent") == "v2"

    def test_rollback_nonexistent_version_raises(self) -> None:
        """回滚到不存在的版本抛出 ValueError。"""
        self.registry.create("test-agent", "v1")
        import pytest
        with pytest.raises(ValueError, match="版本 99 不存在"):
            self.registry.rollback("test-agent", target_version=99)

    def test_rollback_nonexistent_prompt_raises(self) -> None:
        """回滚不存在的 prompt 抛出 ValueError。"""
        import pytest
        with pytest.raises(ValueError, match="Prompt 不存在"):
            self.registry.rollback("nonexistent", target_version=1)

    # =========================================================================
    # 列出所有 prompt
    # =========================================================================

    def test_list_prompts(self) -> None:
        """列出所有 prompt，返回包含元信息。"""
        registry = PromptRegistry()
        prompts = registry.list_prompts()
        assert len(prompts) == 10
        for p in prompts:
            assert "name" in p
            assert "latest_version" in p
            assert "versions_count" in p
            assert p["versions_count"] >= 1

    def test_list_prompts_after_create(self) -> None:
        """创建新 prompt 后列表更新。"""
        self.registry.create("custom-agent", "自定义", "自定义 agent")
        prompts = self.registry.list_prompts()
        assert len(prompts) == 11
        names = [p["name"] for p in prompts]
        assert "custom-agent" in names

    # =========================================================================
    # 获取版本列表
    # =========================================================================

    def test_get_versions(self) -> None:
        """获取 prompt 版本列表。"""
        self.registry.create("test-agent", "v1")
        self.registry.update("test-agent", "v2")
        versions = self.registry.get_versions("test-agent")
        assert len(versions) == 2
        assert versions[0]["version"] == 1
        assert versions[0]["content"] == "v1"
        assert versions[1]["version"] == 2
        assert versions[1]["content"] == "v2"

    def test_get_versions_nonexistent(self) -> None:
        """获取不存在的 prompt 版本列表返回空列表。"""
        assert self.registry.get_versions("nonexistent") == []

    # =========================================================================
    # 删除
    # =========================================================================

    def test_delete_prompt(self) -> None:
        """删除 prompt。"""
        self.registry.create("temp-agent", "临时", "临时 agent")
        assert self.registry.get("temp-agent") is not None
        ok = self.registry.delete("temp-agent")
        assert ok is True
        assert self.registry.get("temp-agent") is None

    def test_delete_nonexistent(self) -> None:
        """删除不存在的 prompt 返回 False。"""
        ok = self.registry.delete("nonexistent")
        assert ok is False

    def test_delete_default_prompt(self) -> None:
        """删除默认 prompt 后列表减少。"""
        self.registry.delete("researcher")
        assert self.registry.get("researcher") is None
        assert len(self.registry.list_prompts()) == 9

    # =========================================================================
    # 全局单例
    # =========================================================================

    def test_singleton_has_defaults(self) -> None:
        """全局 prompt_registry 单例已加载默认 prompt。"""
        assert len(prompt_registry.list_prompts()) == 10
        assert prompt_registry.get("researcher") is not None

    def test_singleton_mutations(self) -> None:
        """全局单例支持 CRUD。"""
        prompt_registry.create("singleton-test", "单例测试", "测试")
        assert prompt_registry.get("singleton-test") == "单例测试"
        prompt_registry.delete("singleton-test")
        assert prompt_registry.get("singleton-test") is None

    # =========================================================================
    # 边缘情况
    # =========================================================================

    def test_empty_prompt_content(self) -> None:
        """创建空内容 prompt 允许(不验证 content 非空)。"""
        entry = self.registry.create("empty-agent", "", "空内容")
        assert entry.name == "empty-agent"
        assert self.registry.get("empty-agent") == ""

    def test_version_order(self) -> None:
        """版本号严格递增。"""
        self.registry.create("test-agent", "v1")
        self.registry.update("test-agent", "v2")
        self.registry.update("test-agent", "v3")
        versions = self.registry.get_versions("test-agent")
        for i, v in enumerate(versions):
            assert v["version"] == i + 1

    def test_get_latest_after_rollback(self) -> None:
        """回滚后获取最新版本内容为回滚目标内容。"""
        self.registry.create("test-agent", "原始内容")
        self.registry.update("test-agent", "已修改内容")
        self.registry.rollback("test-agent", target_version=1)
        assert self.registry.get("test-agent") == "原始内容"