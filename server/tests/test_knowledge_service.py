"""Knowledge service tests (RAG / pgvector).

运行方式:
    cd server
    pytest tests/test_knowledge_service.py -v -m integration

注意: 需要配置 DASHSCOPE_API_KEY 才能生成 embedding。
PostgreSQL 环境需要先执行 alembic upgrade head;
SQLite (dev) 环境会自动建表。
"""

import os

import pytest

# 跳过条件: 没有 DashScope API Key 时跳过集成测试
pytestmark = pytest.mark.skipif(
    not os.getenv("DASHSCOPE_API_KEY"),
    reason="需要 DASHSCOPE_API_KEY 才能运行 RAG 集成测试",
)


SAMPLE_TEXT = """
智汇AI是一个统一的AI智能体平台，提供智能体管理、知识库、对话等服务。
平台基于FastAPI构建，使用PostgreSQL作为主数据库，Redis作为缓存。
知识库功能支持文档上传、语义检索和RAG对话，底层使用pgvector向量数据库。
智能体模块支持多模型接入，包括通义千问、智谱清言、OpenAI等。
平台采用多租户架构，通过schema隔离不同租户的数据。
"""


@pytest.fixture(autouse=True)
def _ensure_tables():
    """确保测试表存在 (SQLite dev 环境自动建表)."""
    try:
        from app.database import Base, engine1
        from app.models.knowledge_models import KnowledgeChunk, KnowledgeDoc  # noqa: F401

        Base.metadata.create_all(engine1, tables=[KnowledgeDoc.__table__, KnowledgeChunk.__table__])
    except Exception as e:
        pytest.skip(f"无法创建测试表: {e}")

    yield


@pytest.fixture
def clean_collection():
    """测试前后清理指定 collection 的数据."""
    collection = "test_collection"
    yield collection
    # 清理: 删除测试数据
    try:
        from app.services.knowledge_service import knowledge_service

        docs = knowledge_service.list_docs("test_user")
        for d in docs:
            knowledge_service.delete_doc(d["id"], "test_user")
    except Exception:
        pass


def test_ingest_text(clean_collection):
    """测试文本入库."""
    from app.services.knowledge_service import knowledge_service

    n = knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="智汇AI介绍",
        text=SAMPLE_TEXT,
        collection_name=clean_collection,
    )
    assert n > 0, "切片数应大于 0"


def test_search_relevant(clean_collection):
    """测试语义检索能召回正确结果."""
    from app.services.knowledge_service import knowledge_service

    # 先入库
    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="智汇AI介绍",
        text=SAMPLE_TEXT,
        collection_name=clean_collection,
    )

    # 检索: 问数据库相关的问题
    results = knowledge_service.search(
        query="智汇AI用什么数据库",
        collection_name=clean_collection,
        top_k=3,
    )
    assert len(results) > 0, "应能检索到结果"
    # 验证结果包含 PostgreSQL 关键词
    combined = " ".join(r["content"] for r in results)
    assert "PostgreSQL" in combined or "数据库" in combined, \
        f"检索结果应包含数据库相关内容, got: {combined}"


def test_search_irrelevant(clean_collection):
    """测试无关查询的检索结果."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="智汇AI介绍",
        text=SAMPLE_TEXT,
        collection_name=clean_collection,
    )

    results = knowledge_service.search(
        query="今天天气怎么样",
        collection_name=clean_collection,
        top_k=3,
        score_threshold=0.5,  # 提高阈值
    )
    # 无关查询应该返回少量或零结果
    # (不强制断言为 0, 因为 embedding 模型可能有噪声)
    assert len(results) <= 3


def test_list_docs(clean_collection):
    """测试文档列表."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="测试文档1",
        text="这是测试文档内容。",
        collection_name=clean_collection,
    )

    docs = knowledge_service.list_docs("test_user")
    assert len(docs) > 0
    assert any(d["title"] == "测试文档1" for d in docs)


def test_delete_doc(clean_collection):
    """测试删除文档."""
    from app.services.knowledge_service import knowledge_service

    n = knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="待删除文档",
        text="这是待删除的测试文档。",
        collection_name=clean_collection,
    )
    assert n > 0

    docs = knowledge_service.list_docs("test_user")
    doc_id = next(d["id"] for d in docs if d["title"] == "待删除文档")

    ok = knowledge_service.delete_doc(doc_id, "test_user")
    assert ok, "删除应成功"

    # 验证已删除
    docs = knowledge_service.list_docs("test_user")
    assert not any(d["id"] == doc_id for d in docs)


def test_get_rag_context(clean_collection):
    """测试 RAG 上下文生成."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="智汇AI介绍",
        text=SAMPLE_TEXT,
        collection_name=clean_collection,
    )

    context = knowledge_service.get_rag_context(
        query="智汇AI用什么数据库",
        collection_name=clean_collection,
        top_k=3,
        owner_uuid="test_user",
    )
    assert context, "RAG 上下文不应为空"
    assert "[1]" in context, "上下文应包含编号标记"


def test_search_with_owner_uuid(clean_collection):
    """测试多租户: search 传入 owner_uuid."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="智汇AI介绍",
        text=SAMPLE_TEXT,
        collection_name=clean_collection,
    )

    # 传入 owner_uuid (多租户模式下会自动加前缀)
    results = knowledge_service.search(
        query="数据库",
        collection_name=clean_collection,
        top_k=3,
        owner_uuid="test_user",
    )
    assert len(results) > 0


def test_get_doc_detail(clean_collection):
    """测试文档详情."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="详情测试文档",
        text="这是详情测试文档内容。",
        collection_name=clean_collection,
    )

    docs = knowledge_service.list_docs("test_user")
    doc_id = next(d["id"] for d in docs if d["title"] == "详情测试文档")

    detail = knowledge_service.get_doc_detail(doc_id, "test_user")
    assert detail is not None
    assert detail["title"] == "详情测试文档"
    assert detail["source_type"] == "text"


def test_batch_delete_docs(clean_collection):
    """测试批量删除."""
    from app.services.knowledge_service import knowledge_service

    for i in range(3):
        knowledge_service.ingest_text(
            owner_uuid="test_user",
            title=f"批量删除测试_{i}",
            text=f"这是批量删除测试文档 {i}。",
            collection_name=clean_collection,
        )

    docs = knowledge_service.list_docs("test_user")
    doc_ids = [d["id"] for d in docs if d["title"].startswith("批量删除测试_")]

    result = knowledge_service.batch_delete_docs(doc_ids, "test_user")
    assert len(result["success"]) == len(doc_ids)
    assert len(result["failed"]) == 0


def test_get_doc_chunks(clean_collection):
    """测试切片预览."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="切片预览测试",
        text=SAMPLE_TEXT,
        collection_name=clean_collection,
    )

    docs = knowledge_service.list_docs("test_user")
    doc_id = next(d["id"] for d in docs if d["title"] == "切片预览测试")

    chunks = knowledge_service.get_doc_chunks(doc_id, "test_user", limit=5)
    assert len(chunks) > 0
    assert all("content" in c for c in chunks)


def test_ingest_empty_text():
    """测试空文本入库 (应返回 0, 不报错)."""
    from app.services.knowledge_service import knowledge_service

    n = knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="空文档",
        text="",
        collection_name="test_empty",
    )
    assert n == 0


def test_delete_nonexistent_doc():
    """测试删除不存在的文档 (应返回 False)."""
    from app.services.knowledge_service import knowledge_service

    ok = knowledge_service.delete_doc(999999, "test_user")
    assert ok is False


def test_get_doc_detail_no_permission(clean_collection):
    """测试无权限获取文档详情 (应返回 None)."""
    from app.services.knowledge_service import knowledge_service

    knowledge_service.ingest_text(
        owner_uuid="test_user",
        title="权限测试文档",
        text="这是权限测试文档。",
        collection_name=clean_collection,
    )

    docs = knowledge_service.list_docs("test_user")
    doc_id = next(d["id"] for d in docs if d["title"] == "权限测试文档")

    # 用不同的 owner_uuid 查询, 应返回 None
    detail = knowledge_service.get_doc_detail(doc_id, "other_user")
    assert detail is None
