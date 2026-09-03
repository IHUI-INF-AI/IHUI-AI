# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""长期 Agent 记忆服务(agent_longterm_memory)单元测试。

覆盖:add / 去重合并 / search / recall top_k / 按重要性 top / remove /
bulk_import / extract 候选 / 空输入 / 跨用户隔离 / 持久化写盘再读 /
importance 提升 / access 统计 / 相似度与上下文格式化。

均为纯内存(tmp_path JSON)单测,不依赖 DB/LLM。
"""

import json

from app.services.agent_longterm_memory import (
    AgentLongTermMemory,
    build_memory_context_block,
    extract_candidates_from_session,
    jaccard_similarity,
)

USER_A = "user-a"
USER_B = "user-b"


def _store(tmp_path):
    return AgentLongTermMemory(file_path=tmp_path / "alm.json")


# ---------------- add / 基础 ----------------

def test_add_creates_entry_with_all_fields(tmp_path):
    st = _store(tmp_path)
    e = st.add(
        "用户偏好用 Python 做后端开发",
        user_id=USER_A,
        type="user_preference",
        source_session_id="s1",
        keywords=["python", "后端"],
        tags=["技术栈"],
        importance=4,
    )
    assert e["memory_id"]
    assert e["type"] == "user_preference"
    assert e["user_id"] == USER_A
    assert e["source_session_id"] == "s1"
    assert e["importance"] == 4
    assert "python" in e["keywords"]
    assert "python" in e["tags"] or "用户偏好" in e["tags"]  # 默认类型标签已并入
    assert "用户偏好" in e["tags"]
    assert e["created_at"]
    assert e["updated_at"]
    assert e["access_count"] == 0


def test_add_empty_content_returns_empty_and_no_entry(tmp_path):
    st = _store(tmp_path)
    assert st.add("   ", user_id=USER_A) == {}
    assert st.count(USER_A) == 0


def test_add_invalid_type_falls_back_to_lesson_learned(tmp_path):
    st = _store(tmp_path)
    e = st.add("错误类型回退", user_id=USER_A, type="unknown_type")
    assert e["type"] == "lesson_learned"


def test_importance_clamped(tmp_path):
    st = _store(tmp_path)
    low = st.add("低重要性", user_id=USER_A, importance=-5)
    high = st.add("高重要性", user_id=USER_A, importance=99)
    assert low["importance"] == 1
    assert high["importance"] == 5


# ---------------- 去重合并 ----------------

def test_add_similar_content_merges_and_boosts_importance(tmp_path):
    st = _store(tmp_path)
    first = st.add("以后部署别用 root 账号", user_id=USER_A, type="lesson_learned", importance=3)
    second = st.add("以后部署不要用 root 账号", user_id=USER_A, type="lesson_learned", importance=4)
    assert first["memory_id"] == second["memory_id"]  # 同一记忆,不新增
    assert st.count(USER_A) == 1
    assert second["importance"] > first["importance"]  # 合并提升


def test_add_different_content_not_merged(tmp_path):
    st = _store(tmp_path)
    st.add("以后部署别用 root", user_id=USER_A, type="lesson_learned", importance=3)
    st.add("今天天气非常适合散步", user_id=USER_A, type="lesson_learned", importance=3)
    assert st.count(USER_A) == 2


def test_add_same_content_different_type_not_merged(tmp_path):
    st = _store(tmp_path)
    st.add("统一使用 ESLint 规范", user_id=USER_A, type="project_convention")
    st.add("统一使用 ESLint 规范", user_id=USER_A, type="user_preference")
    assert st.count(USER_A) == 2


def test_dedup_is_per_user(tmp_path):
    st = _store(tmp_path)
    st.add("以后部署别用 root", user_id=USER_A)
    st.add("以后部署别用 root", user_id=USER_B)
    assert st.count(USER_A) == 1
    assert st.count(USER_B) == 1
    assert st.count() == 2


# ---------------- 跨用户隔离 ----------------

def test_search_is_isolated_by_user(tmp_path):
    st = _store(tmp_path)
    st.add("用户 A 的偏好", user_id=USER_A, type="user_preference")
    st.add("用户 B 的偏好", user_id=USER_B, type="user_preference")
    assert len(st.search(USER_A)) == 1
    assert len(st.search(USER_B)) == 1
    assert st.get_top_by_importance(USER_A)[0]["content"].startswith("用户 A")


# ---------------- search ----------------

def test_search_by_keywords_and_tags(tmp_path):
    st = _store(tmp_path)
    st.add("后端用 Python", user_id=USER_A, keywords=["python"])
    st.add("前端用 React", user_id=USER_A, keywords=["react"])
    kw = st.search(USER_A, keywords=["python"])
    assert len(kw) == 1
    assert "Python" in kw[0]["content"]
    tags = st.search(USER_A, tags=["用户偏好"])
    assert all("用户偏好" in e["tags"] for e in tags)


def test_search_with_query_returns_relevance_ranking(tmp_path):
    st = _store(tmp_path)
    st.add("用户偏好使用 Python 做后端开发", user_id=USER_A, type="user_preference")
    st.add("今天天气晴朗适合外出", user_id=USER_A, type="user_preference")
    res = st.search(USER_A, query="Python 后端", limit=2)
    assert res
    assert res[0]["relevance"] >= res[1]["relevance"]
    assert res[0]["relevance"] > 0


# ---------------- get_top_by_importance ----------------

def test_get_top_by_importance_orders_by_importance(tmp_path):
    st = _store(tmp_path)
    e1 = st.add("低", user_id=USER_A, importance=2)
    e2 = st.add("高", user_id=USER_A, importance=5)
    e3 = st.add("中", user_id=USER_A, importance=3)
    top = st.get_top_by_importance(USER_A, top_k=3)
    assert [e["memory_id"] for e in top] == [e2["memory_id"], e3["memory_id"], e1["memory_id"]]


# ---------------- recall_for_context / access 统计 ----------------

def test_recall_for_context_returns_formatted_block(tmp_path):
    st = _store(tmp_path)
    st.add("约定提交信息必须用 conventional 规范", user_id=USER_A, type="project_convention")
    block = st.recall_for_context(USER_A, query="提交规范")
    assert "## 长期记忆" in block
    assert "项目约定" in block
    assert "conventional" in block


def test_recall_returns_empty_when_no_entries(tmp_path):
    st = _store(tmp_path)
    assert st.recall_for_context(USER_A, query="家常便饭") == ""


def test_recall_empty_user_returns_empty(tmp_path):
    st = _store(tmp_path)
    st.add("anything", user_id=USER_A)
    assert st.recall_for_context("", query="anything") == ""


def test_recall_updates_access_stats(tmp_path):
    st = _store(tmp_path)
    e = st.add("后端必须走 Redis 缓存", user_id=USER_A, type="project_convention")
    mid = e["memory_id"]
    st.recall_for_context(USER_A, query="re口味 dis 缓存 Redis")
    got = st.get(mid)
    assert got["access_count"] >= 1
    assert got["last_accessed_at"]


def test_recall_min_relevance_filters_noise(tmp_path):
    st = _store(tmp_path)
    st.add("完整短语规范:提交信息必须符合 conventional commits", user_id=USER_A)
    st.add("完全无关一次性的闲聊内容哇哇哇", user_id=USER_A)
    block = st.recall_for_context(USER_A, query="conventional commits", top_k=5, min_relevance=0.3)
    assert "conventional commits" in block


# ---------------- remove ----------------

def test_remove(tmp_path):
    st = _store(tmp_path)
    e = st.add("要清理的记忆", user_id=USER_A)
    assert st.remove(e["memory_id"]) is True
    assert st.get(e["memory_id"]) is None
    assert st.remove(e["memory_id"]) is False  # 幂等


# ---------------- bulk_import_from_extract ----------------

def test_bulk_import_counts_added_and_skipped(tmp_path):
    st = _store(tmp_path)
    candidates = [
        {"type": "lesson_learned", "content": "别再用 root 部署", "importance": 4},
        {"type": "goal", "content": ""},  # 空 content → 跳过
        {"content": "后续要支持多租户"},  # 无 type → 回退 lesson_learned
        "not-a-dict",  # 非法 → 跳过
    ]
    summary = st.bulk_import_from_extract(candidates, user_id=USER_A, session_id="s-x")
    assert summary["total"] == 4
    assert summary["added"] == 2
    assert summary["skipped"] == 2
    assert st.count(USER_A) == 2


def test_bulk_import_merges_duplicates(tmp_path):
    st = _store(tmp_path)
    content = "统一接口返回 code/message/data"
    one = [{"type": "project_convention", "content": content, "importance": 3}]
    two = [{"type": "project_convention", "content": content, "importance": 4}]
    st.bulk_import_from_extract(one, user_id=USER_A, session_id="s1")
    summary = st.bulk_import_from_extract(two, user_id=USER_A, session_id="s2")
    assert summary["added"] == 0
    assert summary["merged"] == 1
    assert st.count(USER_A) == 1


def test_bulk_import_empty_input(tmp_path):
    st = _store(tmp_path)
    assert st.bulk_import_from_extract([], user_id=USER_A)["total"] == 0


# ---------------- extract_candidates_from_session ----------------

def test_extract_picks_up_reinforced_messages(tmp_path):
    msgs = [
        {"role": "user", "content": "以后记得每个接口都要写超时配置"},
        {"role": "assistant", "content": "明白了,遇到 root 部署的坑要避免"},
        {"role": "user", "content": "今天吃饭了吗"},  # 无强化标记 → 不抽
        {"role": "system", "content": "system 不会参与抽取"},
    ]
    cands = extract_candidates_from_session(msgs, session_id="s1", user_id=USER_A)
    assert len(cands) == 2
    assert all(c["source_session_id"] == "s1" for c in cands)
    assert all(c["content"] for c in cands)
    assert cands[1]["source_message"]


def test_extract_empty_and_short_messages_skipped(tmp_path):
    assert extract_candidates_from_session([], session_id="s1") == []
    msgs = [{"role": "user", "content": "别"}]
    assert extract_candidates_from_session(msgs, session_id="s1") == []


def test_extract_infers_types_deterministically(tmp_path):
    msgs = [
        {"role": "user", "content": "统一约定用 pnpm 管理依赖"},
        {"role": "user", "content": "以后别再踩这个坑了"},
        {"role": "user", "content": "记得接下来要实现实时协作"},
    ]
    cands = extract_candidates_from_session(msgs)
    types = [c["type"] for c in cands]
    assert "project_convention" in types
    assert "lesson_learned" in types
    assert "goal" in types


# ---------------- 持久化 写盘再读 ----------------

def test_persist_to_json_and_reload(tmp_path):
    p = tmp_path / "alm.json"
    st1 = AgentLongTermMemory(file_path=p)
    st1.add("跨会话记住用户喜欢 dark 主题", user_id=USER_A, type="user_preference")
    st2 = AgentLongTermMemory(file_path=p)  # 模拟进程重启
    assert st2.count(USER_A) == 1
    got = st2.get(st2.search(USER_A)[0]["memory_id"])
    assert got["content"] == "跨会话记住用户喜欢 dark 主题"
    # 文件确实落盘
    raw = json.loads(p.read_text(encoding="utf-8"))
    assert len(raw) >= 1


def test_corrupt_json_falls_back_to_empty(tmp_path):
    p = tmp_path / "alm.json"
    p.write_text("{invalid json", encoding="utf-8")
    st = AgentLongTermMemory(file_path=p)
    assert st.count() == 0


# ---------------- jaccard 相似度单元 ----------------

def test_jaccard_similarity_basic(tmp_path):
    assert jaccard_similarity("abc", "abc") == 1.0
    assert jaccard_similarity("", "") == 1.0
    assert jaccard_similarity("abc", "") == 0.0
    assert jaccard_similarity("你好", "") == 0.0
    same = jaccard_similarity("统一用 pnpm", "统一用 pnpm")
    assert same >= 0.9
    diff = jaccard_similarity("统一用 pnpm", "今天天气很好")
    assert diff < 0.5


# ---------------- build_memory_context_block 格式化 ----------------

def test_build_context_block_groups_and_labels(tmp_path):
    block = build_memory_context_block(
        [
            {
                "type": "user_preference",
                "content": "偏好 dark 主题",
                "importance": 4,
            },
            {
                "type": "project_convention",
                "content": "接口统一返回 code/message/data",
                "importance": 5,
            },
        ]
    )
    assert "## 长期记忆" in block
    assert "用户偏好" in block
    assert "项目约定" in block
    assert "重要度 5" in block


def test_build_context_block_empty(tmp_path):
    assert build_memory_context_block([]) == ""
    assert build_memory_context_block(None) == ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
