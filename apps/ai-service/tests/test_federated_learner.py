"""联邦学习器测试(L7,2026-07-25 立,对标 Google Federated Learning)。

覆盖:
- DifferentialPrivacy: laplace_noise / gaussian_noise / apply_to_count /
  apply_to_score / anonymize_user_id / anonymize_text / k_anonymity_filter
- FederatedLearner: aggregate_user_lessons / list_federated_lessons /
  build_system_prompt_snippet / load_all_lessons / get_status

全部用 monkeypatch mock llm_gateway / asyncpg,不实际连 DB。
"""

from __future__ import annotations

import random
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.differential_privacy import (
    DifferentialPrivacy,
    differential_privacy,
)
from app.services.federated_learner import (
    FederatedLearner,
    _MAX_LESSONS_IN_PROMPT,
    _MIN_CONFIDENCE_FOR_PROMPT,
    federated_learner,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_meta_lesson_row(
    lesson_type: str = "failure_pattern",
    title: str = "T1",
    content: str = "C1",
    conf: float = 0.6,
    occ: int = 1,
) -> dict:
    """构造 agent_meta_lessons 行字典(mock 用)。"""
    return {
        "lesson_type": lesson_type,
        "title": title,
        "content": content,
        "conf": conf,
        "occ": occ,
    }


def make_federated_lesson(
    lesson_id: str = "00000000-0000-0000-0000-000000000001",
    lesson_type: str = "failure_pattern",
    title: str = "T1",
    content: str = "C1",
    source_user_count: int = 3,
    confidence: float = 0.7,
    occurrence_count: int = 5,
) -> dict:
    """构造联邦 lesson 字典(缓存格式)。"""
    return {
        "lessonId": lesson_id,
        "lessonType": lesson_type,
        "title": title,
        "content": content,
        "sourceUserCount": source_user_count,
        "sourceUserIdsHash": "abc123def456",
        "confidence": confidence,
        "occurrenceCount": occurrence_count,
        "dpNoiseAdded": 0.5,
        "anonymized": True,
        "createdAt": "",
        "updatedAt": "",
    }


def make_db_row(
    lesson_id: str = "00000000-0000-0000-0000-000000000001",
    lesson_type: str = "failure_pattern",
    title: str = "T1",
    content: str = "C1",
    suc: int = 3,
    conf: float = 0.7,
    occ: int = 5,
    dpn: float = 0.5,
) -> dict:
    """构造 asyncpg fetch 返回的行字典(mock 用)。"""
    return {
        "lesson_id": lesson_id,
        "lesson_type": lesson_type,
        "title": title,
        "content": content,
        "suc": suc,
        "source_user_ids_hash": "abc123def456",
        "conf": conf,
        "occ": occ,
        "dpn": dpn,
        "anonymized": True,
        "created_at": None,
        "updated_at": None,
    }


def make_mock_pool(rows: list[dict] | None = None) -> MagicMock:
    """构造 asyncpg mock 连接池(rows 用于 fetch 返回)。"""
    mock_pool = MagicMock()
    mock_conn = MagicMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    if rows is not None:
        mock_conn.fetch = AsyncMock(return_value=rows)
        mock_conn.fetchrow = AsyncMock(return_value=None)
        mock_conn.execute = AsyncMock(return_value="OK")
    return mock_pool


# =============================================================================
# DifferentialPrivacy: laplace_noise
# =============================================================================


class TestLaplaceNoise:
    """laplace_noise:Laplace 机制噪声采样。"""

    def test_returns_numeric(self):
        """返回 float 类型数值。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        noise = dp.laplace_noise(sensitivity=1.0, epsilon=1.0)
        assert isinstance(noise, float)

    def test_can_be_positive_or_negative(self):
        """100 次采样中既有正数也有负数(对称分布)。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        noises = [dp.laplace_noise(sensitivity=1.0, epsilon=1.0) for _ in range(100)]
        assert any(n > 0 for n in noises)
        assert any(n < 0 for n in noises)

    def test_sensitivity_zero_returns_zero(self):
        """sensitivity=0 → 返回 0(无查询影响,无噪声)。"""
        dp = DifferentialPrivacy()
        assert dp.laplace_noise(sensitivity=0.0, epsilon=1.0) == 0.0

    def test_large_epsilon_near_zero(self):
        """epsilon 极大 → b 极小 → 噪声近 0。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        noise = dp.laplace_noise(sensitivity=1.0, epsilon=1000000.0)
        assert abs(noise) < 0.001

    def test_invalid_epsilon_returns_zero(self):
        """epsilon <= 0 → 返回 0(避免除零)。"""
        dp = DifferentialPrivacy()
        assert dp.laplace_noise(sensitivity=1.0, epsilon=0.0) == 0.0
        assert dp.laplace_noise(sensitivity=1.0, epsilon=-1.0) == 0.0


# =============================================================================
# DifferentialPrivacy: gaussian_noise
# =============================================================================


class TestGaussianNoise:
    """gaussian_noise:Gaussian 机制噪声采样。"""

    def test_returns_numeric(self):
        """返回 float 类型数值。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        noise = dp.gaussian_noise(
            sensitivity=1.0, epsilon=1.0, delta=1e-5
        )
        assert isinstance(noise, float)

    def test_sensitivity_zero_returns_zero(self):
        """sensitivity=0 → 返回 0。"""
        dp = DifferentialPrivacy()
        assert dp.gaussian_noise(
            sensitivity=0.0, epsilon=1.0, delta=1e-5
        ) == 0.0

    def test_large_epsilon_near_zero(self):
        """epsilon 极大 → σ 极小 → 噪声近 0。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        noise = dp.gaussian_noise(
            sensitivity=1.0, epsilon=1000000.0, delta=1e-5
        )
        assert abs(noise) < 0.001

    def test_invalid_delta_returns_zero(self):
        """delta 非法(<=0 或 >=1)→ 返回 0。"""
        dp = DifferentialPrivacy()
        assert dp.gaussian_noise(
            sensitivity=1.0, epsilon=1.0, delta=0.0
        ) == 0.0
        assert dp.gaussian_noise(
            sensitivity=1.0, epsilon=1.0, delta=1.0
        ) == 0.0


# =============================================================================
# DifferentialPrivacy: apply_to_count
# =============================================================================


class TestApplyToCount:
    """apply_to_count:对计数值加 Laplace 噪声。"""

    def test_returns_non_negative(self):
        """100 次采样,结果始终 >= 0(max(0, ...) 保证)。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        for _ in range(100):
            result = dp.apply_to_count(5, epsilon=1.0)
            assert result >= 0

    def test_may_change_value(self):
        """高噪声(epsilon 小)时 count 会变化。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        results = {dp.apply_to_count(5, epsilon=0.01) for _ in range(50)}
        assert len(results) > 1

    def test_boundary_zero_count(self):
        """count=0 时结果仍 >= 0。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        result = dp.apply_to_count(0, epsilon=1.0)
        assert result >= 0

    def test_returns_int(self):
        """返回值是 int(整数舍入)。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        result = dp.apply_to_count(10, epsilon=1.0)
        assert isinstance(result, int)


# =============================================================================
# DifferentialPrivacy: apply_to_score
# =============================================================================


class TestApplyToScore:
    """apply_to_score:对评分加 Laplace 噪声,clip 到 [0,1]。"""

    def test_clips_to_01(self):
        """100 次采样,结果始终在 [0.0, 1.0]。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        for _ in range(100):
            result = dp.apply_to_score(0.5, epsilon=0.01)
            assert 0.0 <= result <= 1.0

    def test_normal_range_low_noise(self):
        """低噪声(epsilon 大)时结果接近原值。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        result = dp.apply_to_score(0.5, epsilon=100.0)
        assert 0.45 <= result <= 0.55

    def test_returns_float(self):
        """返回值是 float。"""
        dp = DifferentialPrivacy(rng=random.Random(42))
        result = dp.apply_to_score(0.5, epsilon=1.0)
        assert isinstance(result, float)


# =============================================================================
# DifferentialPrivacy: anonymize_user_id
# =============================================================================


class TestAnonymizeUserId:
    """anonymize_user_id:sha256+salt 不可逆 hash。"""

    def test_same_input_same_hash(self):
        """相同 user_id + 相同 salt → 相同 hash(确定性)。"""
        dp = DifferentialPrivacy()
        h1 = dp.anonymize_user_id("user-1", salt="fixed-salt")
        h2 = dp.anonymize_user_id("user-1", salt="fixed-salt")
        assert h1 == h2

    def test_different_input_different_hash(self):
        """不同 user_id → 不同 hash。"""
        dp = DifferentialPrivacy()
        h1 = dp.anonymize_user_id("user-1", salt="fixed-salt")
        h2 = dp.anonymize_user_id("user-2", salt="fixed-salt")
        assert h1 != h2

    def test_length_is_64(self):
        """sha256 hex 长度固定 64 字符。"""
        dp = DifferentialPrivacy()
        h = dp.anonymize_user_id("user-1", salt="fixed-salt")
        assert len(h) == 64

    def test_different_salt_different_hash(self):
        """相同 user_id + 不同 salt → 不同 hash(salt 不可缺)。"""
        dp = DifferentialPrivacy()
        h1 = dp.anonymize_user_id("user-1", salt="salt-a")
        h2 = dp.anonymize_user_id("user-1", salt="salt-b")
        assert h1 != h2


# =============================================================================
# DifferentialPrivacy: anonymize_text
# =============================================================================


class TestAnonymizeText:
    """anonymize_text:正则脱敏 PII(邮箱/手机/IP/身份证)。"""

    def test_email_replaced(self):
        """邮箱替换为 [EMAIL]。"""
        dp = DifferentialPrivacy()
        result = dp.anonymize_text("联系我: test@example.com")
        assert "[EMAIL]" in result
        assert "test@example.com" not in result

    def test_phone_replaced(self):
        """中国大陆手机号替换为 [PHONE]。"""
        dp = DifferentialPrivacy()
        result = dp.anonymize_text("电话: 13800138000")
        assert "[PHONE]" in result
        assert "13800138000" not in result

    def test_ip_replaced(self):
        """IPv4 替换为 [IP]。"""
        dp = DifferentialPrivacy()
        result = dp.anonymize_text("服务器: 192.168.1.1")
        assert "[IP]" in result
        assert "192.168.1.1" not in result

    def test_id_card_replaced(self):
        """18 位身份证号替换为 [ID]。"""
        dp = DifferentialPrivacy()
        result = dp.anonymize_text("身份证: 110101199001011234")
        assert "[ID]" in result
        assert "110101199001011234" not in result

    def test_multiple_emails_all_replaced(self):
        """多个邮箱都被替换。"""
        dp = DifferentialPrivacy()
        result = dp.anonymize_text("a@b.com 和 c@d.com")
        assert result.count("[EMAIL]") == 2
        assert "a@b.com" not in result
        assert "c@d.com" not in result

    def test_no_pii_unchanged(self):
        """无 PII 的文本原样返回。"""
        dp = DifferentialPrivacy()
        text = "这是一段普通文本,没有 PII 信息"
        assert dp.anonymize_text(text) == text

    def test_empty_string_unchanged(self):
        """空字符串原样返回。"""
        dp = DifferentialPrivacy()
        assert dp.anonymize_text("") == ""


# =============================================================================
# DifferentialPrivacy: k_anonymity_filter
# =============================================================================


class TestKAnonymityFilter:
    """k_anonymity_filter:只保留出现次数 >= k 的值。"""

    def test_k5_keeps_count_gte_5(self):
        """k=5 时只保留出现次数 >= 5 的值。"""
        dp = DifferentialPrivacy()
        values = ["a"] * 5 + ["b"] * 2 + ["c"] * 1
        result = dp.k_anonymity_filter(values, k=5)
        assert result == ["a"]

    def test_k1_keeps_all(self):
        """k=1 时所有不同值都保留。"""
        dp = DifferentialPrivacy()
        values = ["a", "b", "c"]
        result = dp.k_anonymity_filter(values, k=1)
        assert result == ["a", "b", "c"]

    def test_empty_returns_empty(self):
        """空列表返回空列表。"""
        dp = DifferentialPrivacy()
        assert dp.k_anonymity_filter([], k=5) == []

    def test_returns_sorted(self):
        """返回值是排序后的去重列表。"""
        dp = DifferentialPrivacy()
        values = ["c", "a", "b", "a", "c", "c"]
        result = dp.k_anonymity_filter(values, k=2)
        assert result == ["a", "c"]


# =============================================================================
# FederatedLearner: aggregate_user_lessons
# =============================================================================


class TestAggregateUserLessons:
    """aggregate_user_lessons:主聚合流程。"""

    @pytest.mark.asyncio
    async def test_llm_extract_success(self, monkeypatch):
        """LLM 提取共性成功 → 使用 LLM 返回的内容。"""
        learner = FederatedLearner()
        rows = [
            make_meta_lesson_row(title="T1", content="content-A"),
            make_meta_lesson_row(title="T1", content="content-B"),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        monkeypatch.setattr(
            "app.services.federated_learner.llm_gateway.complete",
            AsyncMock(return_value={"content": "common lesson", "error": False}),
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 1
        assert upsert_mock.await_count == 1
        # content 应是 LLM 返回的 "common lesson"(经 anonymize_text 无 PII 不变)
        call_kwargs = upsert_mock.await_args.kwargs
        assert "common lesson" in call_kwargs["content"]

    @pytest.mark.asyncio
    async def test_llm_failure_fallback_to_first(self, monkeypatch):
        """LLM 失败 → 降级用第一条 content。"""
        learner = FederatedLearner()
        rows = [
            make_meta_lesson_row(title="T1", content="content-A"),
            make_meta_lesson_row(title="T1", content="content-B"),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        monkeypatch.setattr(
            "app.services.federated_learner.llm_gateway.complete",
            AsyncMock(side_effect=RuntimeError("LLM down")),
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 1
        # 降级后 content 应是原始 content 之一(无 PII,anonymize_text 不变)
        call_kwargs = upsert_mock.await_args.kwargs
        assert call_kwargs["content"] in ("content-A", "content-B")

    @pytest.mark.asyncio
    async def test_llm_returns_error_fallback(self, monkeypatch):
        """LLM 返回 error=True → 降级用第一条 content。"""
        learner = FederatedLearner()
        rows = [
            make_meta_lesson_row(title="T1", content="content-A"),
            make_meta_lesson_row(title="T1", content="content-B"),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        monkeypatch.setattr(
            "app.services.federated_learner.llm_gateway.complete",
            AsyncMock(return_value={"content": "", "error": True}),
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 1
        call_kwargs = upsert_mock.await_args.kwargs
        assert call_kwargs["content"] in ("content-A", "content-B")

    @pytest.mark.asyncio
    async def test_same_content_reuse_no_llm(self, monkeypatch):
        """组内 content 全部相同 → 直接复用,不调 LLM。"""
        learner = FederatedLearner()
        rows = [
            make_meta_lesson_row(title="T1", content="same-content"),
            make_meta_lesson_row(title="T1", content="same-content"),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        llm_mock = AsyncMock(return_value={"content": "should-not-be-called"})
        monkeypatch.setattr(
            "app.services.federated_learner.llm_gateway.complete", llm_mock
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 1
        # LLM 不应被调用
        assert llm_mock.await_count == 0
        call_kwargs = upsert_mock.await_args.kwargs
        assert call_kwargs["content"] == "same-content"

    @pytest.mark.asyncio
    async def test_below_min_users_skipped(self, monkeypatch):
        """组内行数 < min_users → 跳过聚合(不调 upsert)。"""
        learner = FederatedLearner()
        rows = [make_meta_lesson_row(title="T1", content="C1")]  # 仅 1 行
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 0
        assert upsert_mock.await_count == 0

    @pytest.mark.asyncio
    async def test_dp_noise_added(self, monkeypatch):
        """聚合时对 source_user_count / confidence 加 DP 噪声。"""
        learner = FederatedLearner()
        rows = [
            make_meta_lesson_row(title="T1", content="C1", conf=0.5),
            make_meta_lesson_row(title="T1", content="C1", conf=0.5),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        # mock DP:apply_to_count 返回 10(原值 2 → 噪声 8),apply_to_score 返回 0.9
        mock_dp = MagicMock()
        mock_dp.apply_to_count.return_value = 10
        mock_dp.apply_to_score.return_value = 0.9
        mock_dp.anonymize_text.side_effect = lambda x: x
        mock_dp.anonymize_user_id.return_value = "hash123"
        monkeypatch.setattr(
            "app.services.federated_learner.differential_privacy", mock_dp
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 1
        call_kwargs = upsert_mock.await_args.kwargs
        assert call_kwargs["source_user_count"] == 10
        assert call_kwargs["confidence"] == 0.9
        # dp_noise_added = |10 - 2| = 8
        assert call_kwargs["dp_noise_added"] == 8

    @pytest.mark.asyncio
    async def test_db_upsert_called_with_correct_args(self, monkeypatch):
        """UPSERT 被调用,参数包含必要字段。"""
        learner = FederatedLearner()
        rows = [
            make_meta_lesson_row(
                lesson_type="failure_pattern", title="T1", content="C1"
            ),
            make_meta_lesson_row(
                lesson_type="failure_pattern", title="T1", content="C1"
            ),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        count = await learner.aggregate_user_lessons(min_users=2)
        assert count == 1
        call_kwargs = upsert_mock.await_args.kwargs
        assert call_kwargs["lesson_type"] == "failure_pattern"
        assert call_kwargs["title"] == "T1"
        assert call_kwargs["content"] == "C1"
        assert "source_user_count" in call_kwargs
        assert "confidence" in call_kwargs
        assert "occurrence_count" in call_kwargs
        assert "source_user_ids_hash" in call_kwargs
        assert "dp_noise_added" in call_kwargs

    @pytest.mark.asyncio
    async def test_empty_rows_returns_zero(self, monkeypatch):
        """agent_meta_lessons 为空 → 返回 0。"""
        learner = FederatedLearner()
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=[])
        )
        count = await learner.aggregate_user_lessons()
        assert count == 0

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        """_load_meta_lessons 抛异常 → 外层 try/except 捕获,返回 0。"""
        learner = FederatedLearner()

        async def fake_load():
            raise RuntimeError("DB down")

        monkeypatch.setattr(learner, "_load_meta_lessons", fake_load)
        count = await learner.aggregate_user_lessons()
        assert count == 0

    @pytest.mark.asyncio
    async def test_max_lessons_limit(self, monkeypatch):
        """max_lessons 限制单次聚合最大 lesson 数。"""
        learner = FederatedLearner()
        # 5 个不同组,每组 2 行(>= min_users=2)
        rows = []
        for i in range(5):
            rows.append(make_meta_lesson_row(title=f"T{i}", content=f"C{i}"))
            rows.append(make_meta_lesson_row(title=f"T{i}", content=f"C{i}"))
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=3))

        count = await learner.aggregate_user_lessons(min_users=2, max_lessons=3)
        assert count == 3
        assert upsert_mock.await_count == 3

    @pytest.mark.asyncio
    async def test_pii_anonymized_in_content(self, monkeypatch):
        """content 中的 PII 被脱敏后写入 DB。"""
        learner = FederatedLearner()
        pii_content = "联系 test@example.com 失败"
        rows = [
            make_meta_lesson_row(title="T1", content=pii_content),
            make_meta_lesson_row(title="T1", content=pii_content),
        ]
        monkeypatch.setattr(
            learner, "_load_meta_lessons", AsyncMock(return_value=rows)
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_federated_lesson", upsert_mock)
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))

        await learner.aggregate_user_lessons(min_users=2)
        call_kwargs = upsert_mock.await_args.kwargs
        # PII 应被替换为 [EMAIL]
        assert "[EMAIL]" in call_kwargs["content"]
        assert "test@example.com" not in call_kwargs["content"]


# =============================================================================
# FederatedLearner: list_federated_lessons
# =============================================================================


class TestListFederatedLessons:
    """list_federated_lessons:按 confidence DESC 检索。"""

    @pytest.mark.asyncio
    async def test_type_filter(self, monkeypatch):
        """lesson_type 过滤只返回匹配类型。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(lesson_type="failure_pattern", title="T1"),
            make_federated_lesson(
                lesson_type="success_pattern", title="T2",
                lesson_id="00000000-0000-0000-0000-000000000002",
            ),
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=2))
        result = await learner.list_federated_lessons(lesson_type="failure_pattern")
        assert len(result) == 1
        assert result[0]["lessonType"] == "failure_pattern"

    @pytest.mark.asyncio
    async def test_top_k_limit(self, monkeypatch):
        """top_k 限制返回条数。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(title=f"T{i}", lesson_id=f"...{i}", confidence=0.5)
            for i in range(10)
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=10))
        result = await learner.list_federated_lessons(top_k=3)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_sorted_by_confidence_desc(self, monkeypatch):
        """按 confidence DESC 排序。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(confidence=0.5, lesson_id="...1"),
            make_federated_lesson(confidence=0.9, lesson_id="...2"),
            make_federated_lesson(confidence=0.7, lesson_id="...3"),
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=3))
        result = await learner.list_federated_lessons()
        assert result[0]["confidence"] == 0.9
        assert result[1]["confidence"] == 0.7
        assert result[2]["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_empty_cache_returns_empty(self, monkeypatch):
        """空缓存 → 返回空列表。"""
        learner = FederatedLearner()
        learner._cache = []
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=0))
        result = await learner.list_federated_lessons()
        assert result == []


# =============================================================================
# FederatedLearner: build_system_prompt_snippet
# =============================================================================


class TestBuildSystemPromptSnippet:
    """build_system_prompt_snippet:构造 system prompt 片段。"""

    @pytest.mark.asyncio
    async def test_format_correct(self, monkeypatch):
        """格式正确:含标题段 + lesson 条目。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(
                lesson_type="failure_pattern", title="T1", content="C1",
                confidence=0.8,
            ),
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))
        snippet = await learner.build_system_prompt_snippet()
        assert "## 群体智慧" in snippet
        assert "### 失败模式共性(避免)" in snippet
        assert "T1" in snippet
        assert "C1" in snippet

    @pytest.mark.asyncio
    async def test_max_lessons_limit(self, monkeypatch):
        """max_lessons 限制注入条数。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(
                title=f"T{i}", confidence=0.8, lesson_id=f"...{i}"
            )
            for i in range(10)
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=10))
        snippet = await learner.build_system_prompt_snippet(max_lessons=2)
        # 统计 lesson 条目数(以 "- " 开头的行)
        lesson_lines = [l for l in snippet.split("\n") if l.startswith("- ")]
        assert len(lesson_lines) <= 2

    @pytest.mark.asyncio
    async def test_empty_cache_returns_empty_string(self, monkeypatch):
        """空缓存 → 返回空字符串。"""
        learner = FederatedLearner()
        learner._cache = []
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=0))
        snippet = await learner.build_system_prompt_snippet()
        assert snippet == ""

    @pytest.mark.asyncio
    async def test_low_confidence_filtered(self, monkeypatch):
        """confidence < 阈值 → 不注入。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(
                confidence=_MIN_CONFIDENCE_FOR_PROMPT - 0.1, lesson_id="...1"
            ),
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=1))
        snippet = await learner.build_system_prompt_snippet()
        assert snippet == ""

    @pytest.mark.asyncio
    async def test_multiple_types_included(self, monkeypatch):
        """多种类型 lesson 都注入对应段落。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(
                lesson_type="failure_pattern", title="FT", content="FC",
                confidence=0.7, lesson_id="...1",
            ),
            make_federated_lesson(
                lesson_type="success_pattern", title="ST", content="SC",
                confidence=0.7, lesson_id="...2",
            ),
        ]
        monkeypatch.setattr(learner, "load_all_lessons", AsyncMock(return_value=2))
        snippet = await learner.build_system_prompt_snippet()
        assert "### 失败模式共性(避免)" in snippet
        assert "### 成功模式共性(参考)" in snippet
        assert "FT" in snippet
        assert "ST" in snippet


# =============================================================================
# FederatedLearner: load_all_lessons
# =============================================================================


class TestLoadAllLessons:
    """load_all_lessons:从 DB 全量 hydrate 到内存。"""

    @pytest.mark.asyncio
    async def test_loads_rows_to_memory(self, monkeypatch):
        """DB 返回 2 行 → 加载到内存 2 条。"""
        learner = FederatedLearner()
        rows = [
            make_db_row(
                lesson_id="11111111-1111-1111-1111-111111111111", title="T1"
            ),
            make_db_row(
                lesson_id="22222222-2222-2222-2222-222222222222", title="T2"
            ),
        ]
        mock_pool = make_mock_pool(rows)
        monkeypatch.setattr(
            "app.services.federated_learner._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        count = await learner.load_all_lessons()
        assert count == 2
        assert len(learner._cache) == 2
        assert learner._cache[0]["title"] in ("T1", "T2")

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        """DB 异常 → 返回 0 + 空内存。"""
        learner = FederatedLearner()

        async def fake_get_pool():
            raise RuntimeError("DB down")

        monkeypatch.setattr(
            "app.services.federated_learner._get_pool", fake_get_pool
        )
        count = await learner.load_all_lessons()
        assert count == 0
        assert learner._cache == []

    @pytest.mark.asyncio
    async def test_clears_cache_before_load(self, monkeypatch):
        """加载前清空旧缓存(避免脏数据)。"""
        learner = FederatedLearner()
        # 预置旧数据
        learner._cache = [make_federated_lesson(title="old")]
        rows = [
            make_db_row(
                lesson_id="33333333-3333-3333-3333-333333333333", title="new"
            ),
        ]
        mock_pool = make_mock_pool(rows)
        monkeypatch.setattr(
            "app.services.federated_learner._get_pool",
            AsyncMock(return_value=mock_pool),
        )
        await learner.load_all_lessons()
        # 旧数据应被清空,只剩新加载的
        assert len(learner._cache) == 1
        assert learner._cache[0]["title"] == "new"


# =============================================================================
# FederatedLearner: 单例 + get_status
# =============================================================================


class TestSingletonAndStatus:
    """单例实例 + get_status 状态查询。"""

    def test_singleton_exists(self):
        """全局单例 federated_learner 存在且是 FederatedLearner 实例。"""
        assert federated_learner is not None
        assert isinstance(federated_learner, FederatedLearner)

    def test_get_status_empty(self):
        """空缓存时 get_status 返回 0 totalLessons。"""
        learner = FederatedLearner()
        learner._cache = []
        status = learner.get_status()
        assert status["totalLessons"] == 0
        assert status["avgConfidence"] == 0.0
        assert status["cacheLoaded"] is False

    def test_get_status_with_lessons(self):
        """有缓存时 get_status 返回正确统计。"""
        learner = FederatedLearner()
        learner._cache = [
            make_federated_lesson(
                lesson_type="failure_pattern", confidence=0.8, lesson_id="...1"
            ),
            make_federated_lesson(
                lesson_type="success_pattern", confidence=0.6, lesson_id="...2"
            ),
        ]
        status = learner.get_status()
        assert status["totalLessons"] == 2
        assert status["byType"]["failure_pattern"] == 1
        assert status["byType"]["success_pattern"] == 1
        assert status["avgConfidence"] == 0.7
        assert status["cacheLoaded"] is True


# =============================================================================
# DifferentialPrivacy: 全局单例
# =============================================================================


class TestDifferentialPrivacySingleton:
    """differential_privacy 全局单例。"""

    def test_singleton_exists(self):
        """全局单例 differential_privacy 存在。"""
        assert differential_privacy is not None
        assert isinstance(differential_privacy, DifferentialPrivacy)

    def test_singleton_methods_callable(self):
        """单例方法可正常调用。"""
        result = differential_privacy.apply_to_count(5, epsilon=1.0)
        assert isinstance(result, int)
        assert result >= 0

    def test_singleton_anonymize_text(self):
        """单例 anonymize_text 正常工作。"""
        result = differential_privacy.anonymize_text("email: x@y.com")
        assert "[EMAIL]" in result
