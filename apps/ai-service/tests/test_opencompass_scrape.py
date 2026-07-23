"""opencompass_scrape 综合测试(2026-07-23 立,补齐 OpenCompass 司南排行榜抓取零覆盖)。

覆盖维度(74 cases):
1. 模块常量:OPENCOMPASS_URL / _EXTRACT_JS 存在性与结构(3 tests)
2. _EXTRACT_JS JS 代码内容验证:querySelectorAll / thead / tbody / tableIdx(6 tests)
3. _find_col 启发式列查找:精确/子串/大小写/多关键词/空 header/无匹配(8 tests)
4. _try_float 字符串转浮点:None/百分比/中文后缀/空白/非法/空串/整数(8 tests)
5. _scrape_opencompass_sync 成功路径:基本抓取/多表格选首个有数据/50 条截断/返回结构(6 tests)
6. goto + context 参数传递:URL/timeout/viewport/locale/UA/wait_for_timeout(5 tests)
7. 错误路径:Playwright 未安装/goto 超时/空表格/evaluate 异常/None 返回(6 tests)
8. entry 字段解析:模型名换行拆分/provider 提取/跳过空行/截断 200/日期解析(10 tests)
9. scores_map 解析:数值列转 float/字符串列保留/排除 meta_cols/排除空 header(5 tests)
10. score_idx 兜底:关键词命中/采样兜底/headers 不足/name_idx 兜底(4 tests)
11. 排序与重排名:数值降序/非数值保持原序/混合排序/排名从 1 开始(4 tests)
12. wait_for_selector 降级:table 超时→networkidle/networkidle 也失败/tbody tr 超时(4 tests)
13. scrape_opencompass 异步包装:返回值/timeout 透传/异常传播/默认值/executor(5 tests)
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.services.opencompass_scrape import (
    _EXTRACT_JS,
    _find_col,
    _scrape_opencompass_sync,
    _try_float,
    scrape_opencompass,
)
from app.services.opencompass_scrape import OPENCOMPASS_URL


# =============================================================================
# 工厂函数
# =============================================================================


def make_browser_chain(tables=None):
    """构建 mock browser → context → page 链。

    page.evaluate 默认返回 tables;可后续在测试中覆盖 side_effect / return_value。
    """
    mock_browser = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()
    mock_browser.new_context.return_value = mock_context
    mock_context.new_page.return_value = mock_page
    if tables is not None:
        mock_page.evaluate.return_value = tables
    return mock_browser, mock_context, mock_page


def make_opencompass_tables(rows=None, headers=None):
    """构建 OpenCompass 风格的表格数据(ant-design Vue thead/tbody 分离)。"""
    if headers is None:
        headers = [
            "", "模型", "发布日期", "参数量", "均分",
            "语言能力", "知识能力", "推理能力",
        ]
    if rows is None:
        rows = [
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90.2", "88.5", "92.1"],
            ["2", "Claude-3.5\n闭源 · Anthropic", "2024/6/20", "未知", "94.8", "89.0", "87.0", "91.0"],
        ]
    return [{"tableIdx": 0, "headers": headers, "rows": rows}]


# =============================================================================
# 1. 模块常量(3 tests)
# =============================================================================


class TestModuleConstants:
    """模块级常量值与结构验证。"""

    def test_opencompass_url_value(self):
        """OPENCOMPASS_URL 指向司南排行榜 llm 页面。"""
        assert OPENCOMPASS_URL == "https://rank.opencompass.org.cn/leaderboard/llm"

    def test_extract_js_is_nonempty_string(self):
        """_EXTRACT_JS 是非空字符串。"""
        assert isinstance(_EXTRACT_JS, str)
        assert len(_EXTRACT_JS) > 0

    def test_extract_js_is_arrow_function(self):
        """_EXTRACT_JS 是 JS 箭头函数,以 () => { 开头。"""
        assert _EXTRACT_JS.strip().startswith("() => {")
        assert _EXTRACT_JS.strip().endswith("}")


# =============================================================================
# 2. _EXTRACT_JS JS 代码内容验证(6 tests)
# =============================================================================


class TestExtractJSContent:
    """_EXTRACT_JS 字符串内容包含关键 JS 逻辑片段。"""

    def test_contains_query_selector_all_table(self):
        """JS 调用 document.querySelectorAll('table') 获取所有表格。"""
        assert "querySelectorAll('table')" in _EXTRACT_JS

    def test_contains_thead_filter(self):
        """JS 用 thead 过滤 header 表格。"""
        assert "thead" in _EXTRACT_JS

    def test_contains_tbody_filter(self):
        """JS 用 tbody 过滤 body 表格。"""
        assert "tbody" in _EXTRACT_JS

    def test_contains_table_idx_key(self):
        """JS 返回对象包含 tableIdx 字段。"""
        assert "tableIdx" in _EXTRACT_JS

    def test_contains_headers_and_rows_keys(self):
        """JS 返回对象包含 headers 和 rows 字段。"""
        assert "headers" in _EXTRACT_JS
        assert "rows" in _EXTRACT_JS

    def test_contains_inner_text_fallback(self):
        """JS 用 innerText || textContent 做兜底文本提取。"""
        assert "innerText" in _EXTRACT_JS
        assert "textContent" in _EXTRACT_JS


# =============================================================================
# 3. _find_col 启发式列查找(8 tests)
# =============================================================================


class TestFindCol:
    """_find_col 启发式查找列索引。"""

    def test_exact_match(self):
        """精确匹配返回对应索引。"""
        assert _find_col(["序号", "模型", "均分"], ["模型"]) == 1

    def test_case_insensitive(self):
        """大小写不敏感匹配。"""
        assert _find_col(["Name", "Score"], ["name"]) == 0
        assert _find_col(["Name", "Score"], ["NAME"]) == 0

    def test_partial_match_substring(self):
        """关键词是 header 子串即可命中。"""
        assert _find_col(["模型名称", "分数"], ["模型"]) == 0
        assert _find_col(["模型名称", "分数"], ["名称"]) == 0

    def test_multiple_keywords_first_match_wins(self):
        """多关键词时,任一命中即返回该列索引。"""
        assert _find_col(["序号", "模型名", "均分"], ["模型", "name"]) == 1

    def test_empty_header_skipped(self):
        """空字符串 header 被跳过。"""
        assert _find_col(["", "模型"], ["模型"]) == 1

    def test_no_match_returns_none(self):
        """无任何匹配返回 None。"""
        assert _find_col(["序号", "模型", "均分"], ["不存在的关键词"]) is None

    def test_empty_headers_returns_none(self):
        """空 headers 列表返回 None。"""
        assert _find_col([], ["模型"]) is None

    def test_returns_first_matching_index(self):
        """多个 header 都匹配时,返回第一个。"""
        assert _find_col(["模型A", "模型B"], ["模型"]) == 0


# =============================================================================
# 4. _try_float 字符串转浮点(8 tests)
# =============================================================================


class TestTryFloat:
    """_try_float 将字符串转为 float,支持百分比和中文后缀。"""

    def test_none_returns_none(self):
        """None 输入返回 None。"""
        assert _try_float(None) is None

    def test_plain_float_string(self):
        """普通浮点字符串正常解析。"""
        assert _try_float("95.32") == 95.32

    def test_percentage_string(self):
        """百分比字符串去掉 % 后解析。"""
        assert _try_float("95.32%") == 95.32

    def test_chinese_suffix(self):
        """中文'分'后缀去掉后解析。"""
        assert _try_float("95.32分") == 95.32

    def test_whitespace_trimmed(self):
        """前后空白被 trim。"""
        assert _try_float("  12.5  ") == 12.5

    def test_invalid_string_returns_none(self):
        """非法字符串返回 None。"""
        assert _try_float("abc") is None
        assert _try_float("N/A") is None

    def test_empty_string_returns_none(self):
        """空字符串返回 None。"""
        assert _try_float("") is None

    def test_integer_input(self):
        """整数输入被转为 float。"""
        assert _try_float(42) == 42.0


# =============================================================================
# 5. _scrape_opencompass_sync 成功路径(6 tests)
# =============================================================================


class TestScrapeSyncSuccess:
    """_scrape_opencompass_sync 成功抓取路径。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_basic_success_returns_entries(self, mock_get_browser):
        """基本成功路径:返回包含 entries 的 dict。"""
        mock_browser, _, _ = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert "entries" in result
        assert "captured_at" in result
        assert "url" in result
        assert "headers" in result
        assert len(result["entries"]) == 2

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_picks_first_table_with_rows(self, mock_get_browser):
        """多表格时选第一个有 rows 的表格。"""
        tables = [
            {"tableIdx": 0, "headers": ["A", "B"], "rows": []},
            {"tableIdx": 1, "headers": ["", "模型", "均分"], "rows": [
                ["1", "Model-A\n闭源 · OrgA", "50.0"],
            ]},
        ]
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 1
        assert result["entries"][0]["modelName"] == "Model-A"
        assert result["headers"] == ["", "模型", "均分"]

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_entries_truncated_to_50(self, mock_get_browser):
        """超过 50 条 entries 时截断为 50。"""
        rows = [
            [str(i + 1), f"Model-{i}\n闭源 · Org-{i}", "2024/1/1", "未知", f"{100 - i}.0", "90", "88", "92"]
            for i in range(55)
        ]
        mock_browser, _, _ = make_browser_chain(tables=make_opencompass_tables(rows=rows))
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 50

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_captured_at_is_int_ms(self, mock_get_browser):
        """captured_at 是整数毫秒时间戳。"""
        import time
        mock_browser, _, _ = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        before = int(time.time() * 1000)
        result = _scrape_opencompass_sync()
        after = int(time.time() * 1000)

        assert isinstance(result["captured_at"], int)
        assert before <= result["captured_at"] <= after

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_url_is_opencompass_url(self, mock_get_browser):
        """返回的 url 是 OPENCOMPASS_URL。"""
        mock_browser, _, _ = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["url"] == OPENCOMPASS_URL

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_page_close_and_context_close_called(self, mock_get_browser):
        """finally 块中 page.close() 和 context.close() 被调用。"""
        mock_browser, mock_context, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync()

        mock_page.close.assert_called_once()
        mock_context.close.assert_called_once()


# =============================================================================
# 6. goto + context 参数传递(5 tests)
# =============================================================================


class TestScrapeSyncGotoContext:
    """_scrape_opencompass_sync 中 goto/new_context/wait 调用参数验证。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_goto_called_with_correct_url_and_kwargs(self, mock_get_browser):
        """page.goto 用 OPENCOMPASS_URL + domcontentloaded + timeout。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync()

        mock_page.goto.assert_called_once_with(
            OPENCOMPASS_URL,
            wait_until="domcontentloaded",
            timeout=30000,
        )

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_new_context_called_with_correct_kwargs(self, mock_get_browser):
        """browser.new_context 用 viewport/locale/timezone/user_agent。"""
        mock_browser, _, _ = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync()

        mock_browser.new_context.assert_called_once_with(
            viewport={"width": 1280, "height": 900},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_custom_timeout_passed_to_goto(self, mock_get_browser):
        """自定义 timeout_ms 透传到 page.goto。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync(timeout_ms=5000)

        mock_page.goto.assert_called_once_with(
            OPENCOMPASS_URL,
            wait_until="domcontentloaded",
            timeout=5000,
        )

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_wait_for_timeout_2000_called(self, mock_get_browser):
        """额外等待 2s 让 Vue 异步渲染完成。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync()

        mock_page.wait_for_timeout.assert_called_once_with(2000)

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_evaluate_called_with_extract_js(self, mock_get_browser):
        """page.evaluate 用 _EXTRACT_JS 字符串作为参数。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync()

        mock_page.evaluate.assert_called_once_with(_EXTRACT_JS)


# =============================================================================
# 7. 错误路径(6 tests)
# =============================================================================


class TestScrapeSyncErrors:
    """_scrape_opencompass_sync 错误与降级路径。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_playwright_not_installed_raises(self, mock_get_browser):
        """_get_browser_sync 抛 RuntimeError(Playwright 未安装)→ 直接传播。"""
        mock_get_browser.side_effect = RuntimeError("Playwright not installed")

        with pytest.raises(RuntimeError, match="Playwright not installed"):
            _scrape_opencompass_sync()

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_goto_timeout_propagates_and_page_closed(self, mock_get_browser):
        """page.goto 抛 TimeoutError → 传播,但 finally 仍关闭 page/context。"""
        mock_browser, mock_context, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_page.goto.side_effect = TimeoutError("page timeout")
        mock_get_browser.return_value = mock_browser

        with pytest.raises(TimeoutError, match="page timeout"):
            _scrape_opencompass_sync()

        mock_page.close.assert_called_once()
        mock_context.close.assert_called_once()

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_empty_tables_raises_runtime_error(self, mock_get_browser):
        """page.evaluate 返回空列表 → RuntimeError。"""
        mock_browser, _, _ = make_browser_chain(tables=[])
        mock_get_browser.return_value = mock_browser

        with pytest.raises(RuntimeError, match="无表格"):
            _scrape_opencompass_sync()

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_none_tables_raises_runtime_error(self, mock_get_browser):
        """page.evaluate 返回 None → RuntimeError(falsy)。"""
        mock_browser, _, mock_page = make_browser_chain(tables=None)
        mock_page.evaluate.return_value = None
        mock_get_browser.return_value = mock_browser

        with pytest.raises(RuntimeError, match="无表格"):
            _scrape_opencompass_sync()

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_evaluate_raises_propagates(self, mock_get_browser):
        """page.evaluate 抛异常 → 传播,finally 仍清理。"""
        mock_browser, mock_context, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_page.evaluate.side_effect = RuntimeError("evaluate failed")
        mock_get_browser.return_value = mock_browser

        with pytest.raises(RuntimeError, match="evaluate failed"):
            _scrape_opencompass_sync()

        mock_page.close.assert_called_once()
        mock_context.close.assert_called_once()

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_all_tables_empty_rows_returns_empty_entries(self, mock_get_browser):
        """所有表格 rows 为空 → 回退到 tables[0],entries 为空。"""
        tables = [{"tableIdx": 0, "headers": ["A", "B"], "rows": []}]
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"] == []
        assert result["headers"] == ["A", "B"]


# =============================================================================
# 8. entry 字段解析(10 tests)
# =============================================================================


class TestEntryParsing:
    """entry 字段映射与数据清洗。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_model_name_newline_split(self, mock_get_browser):
        """'模型名\n闭源 · 机构' → model_name 取第一行。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["modelName"] == "GPT-4o"

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_provider_extracted_with_dot_separator(self, mock_get_browser):
        """'闭源 · OpenAI' → provider='OpenAI'。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["provider"] == "OpenAI"

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_provider_without_dot_separator(self, mock_get_browser):
        """第二行无 '·' → provider 取整行。"""
        tables = make_opencompass_tables(rows=[
            ["1", "Model-X\nOpenAI", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["provider"] == "OpenAI"

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_single_line_name_no_provider(self, mock_get_browser):
        """单行模型名 → provider=None。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["modelName"] == "GPT-4o"
        assert result["entries"][0]["provider"] is None

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_empty_provider_after_dot_returns_none(self, mock_get_browser):
        """'开源 · '(·后为空)→ provider=None。"""
        tables = make_opencompass_tables(rows=[
            ["1", "Model-Y\n开源 · ", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["provider"] is None

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_dash_name_skipped(self, mock_get_browser):
        """模型名为 '-' → 跳过该行。"""
        tables = make_opencompass_tables(rows=[
            ["1", "-", "2024/5/10", "未知", "95.5", "90", "88", "92"],
            ["2", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "94.0", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 1
        assert result["entries"][0]["modelName"] == "GPT-4o"

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_empty_name_skipped(self, mock_get_browser):
        """模型名为空字符串 → 跳过该行。"""
        tables = make_opencompass_tables(rows=[
            ["1", "", "2024/5/10", "未知", "95.5", "90", "88", "92"],
            ["2", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "94.0", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 1

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_row_with_less_than_two_cols_skipped(self, mock_get_browser):
        """row 长度 < 2 → 跳过。"""
        tables = make_opencompass_tables(rows=[
            ["1"],
            ["2", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "94.0", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 1

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_model_name_truncated_to_200(self, mock_get_browser):
        """modelName 超过 200 字符时截断。"""
        long_name = "A" * 250
        tables = make_opencompass_tables(rows=[
            ["1", long_name, "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert len(result["entries"][0]["modelName"]) == 200

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_published_at_parsed_from_date(self, mock_get_browser):
        """'2024/5/10' → ISO 格式 publishedAt。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["publishedAt"] == "2024-05-10T00:00:00"


# =============================================================================
# 9. scores_map 解析(5 tests)
# =============================================================================


class TestScoreParsing:
    """scores_map 子能力分数解析。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_numeric_values_converted_to_float(self, mock_get_browser):
        """数值列的值转为 float 存入 scores_map。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90.2", "88.5", "92.1"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        scores = result["entries"][0]["scores"]
        assert scores["语言能力"] == 90.2
        assert isinstance(scores["语言能力"], float)

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_non_numeric_values_kept_as_string(self, mock_get_browser):
        """非数值列的值保留为字符串。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "优秀", "88.5", "92.1"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        scores = result["entries"][0]["scores"]
        assert scores["语言能力"] == "优秀"
        assert isinstance(scores["语言能力"], str)

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_meta_cols_excluded_from_scores_map(self, mock_get_browser):
        """name/date/params/score 列不进入 scores_map。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90.2", "88.5", "92.1"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        scores = result["entries"][0]["scores"]
        # 模型(1)/发布日期(2)/参数量(3)/均分(4) 不在 scores_map 中
        assert "模型" not in scores
        assert "发布日期" not in scores
        assert "参数量" not in scores
        assert "均分" not in scores
        # 子能力列在 scores_map 中
        assert "语言能力" in scores
        assert "知识能力" in scores

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_empty_header_excluded_from_scores_map(self, mock_get_browser):
        """空 header 的列不进入 scores_map。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90.2", "88.5", "92.1"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        scores = result["entries"][0]["scores"]
        # 第一列 header 为空字符串,不进 scores_map
        assert "" not in scores

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_dash_value_excluded_from_scores_map(self, mock_get_browser):
        """值为 '-' 的单元格不进入 scores_map。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "-", "88.5", "92.1"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        scores = result["entries"][0]["scores"]
        assert "语言能力" not in scores
        assert "知识能力" in scores


# =============================================================================
# 10. score_idx 兜底(4 tests)
# =============================================================================


class TestScoreFallback:
    """score_idx / name_idx 兜底定位逻辑。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_score_idx_found_by_keyword(self, mock_get_browser):
        """score_idx 通过关键词 '均分' 命中。"""
        tables = make_opencompass_tables(rows=[
            ["1", "GPT-4o\n闭源 · OpenAI", "2024/5/10", "未知", "95.5", "90", "88", "92"],
        ])
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        assert result["entries"][0]["score"] == "95.5"

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_score_idx_fallback_via_sampling(self, mock_get_browser):
        """score_idx 未命中关键词时,采样前 3 行 ≥2 个数值的列。"""
        headers = ["", "模型", "发布日期", "参数量", "语言能力", "知识能力"]
        rows = [
            ["1", "Model-A", "2024/1/1", "10B", "85.5", "80.0"],
            ["2", "Model-B", "2024/2/2", "20B", "90.0", "85.0"],
            ["3", "Model-C", "2024/3/3", "30B", "88.0", "82.0"],
        ]
        tables = [{"tableIdx": 0, "headers": headers, "rows": rows}]
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        # score_idx 应为 4(语言能力),第一行 score="85.5"
        # 排序后最高分在前
        entries = result["entries"]
        assert len(entries) == 3
        # 最高分 90.0 → Model-B 排第一
        assert entries[0]["modelName"] == "Model-B"
        assert entries[0]["score"] == "90.0"

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_score_idx_no_fallback_when_headers_less_than_5(self, mock_get_browser):
        """headers 不足 5 列时不触发采样兜底,score_idx 保持 None。"""
        headers = ["", "模型", "发布日期", "参数量"]
        rows = [
            ["1", "Model-A", "2024/1/1", "10B"],
            ["2", "Model-B", "2024/2/2", "20B"],
        ]
        tables = [{"tableIdx": 0, "headers": headers, "rows": rows}]
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        # score_idx=None → score=None
        for entry in result["entries"]:
            assert entry["score"] is None

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_name_idx_fallback_when_no_keyword_match(self, mock_get_browser):
        """name_idx 未命中关键词时,headers ≥2 → 默认 1,<2 → 默认 0。"""
        headers = ["A", "B", "C", "D", "E"]
        rows = [
            ["1", "Model-A", "x", "y", "50.0"],
            ["2", "Model-B", "x", "y", "60.0"],
        ]
        tables = [{"tableIdx": 0, "headers": headers, "rows": rows}]
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        # name_idx 默认 1 → modelName 取 row[1]
        entries = result["entries"]
        names = {e["modelName"] for e in entries}
        assert names == {"Model-A", "Model-B"}


# =============================================================================
# 11. 排序与重排名(4 tests)
# =============================================================================


class TestSortingAndRanking:
    """分数排序与 rank 重分配。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_numeric_scores_sorted_descending(self, mock_get_browser):
        """数值分数 → 按降序排序,rank 从 1 开始。"""
        rows = [
            ["1", "Model-Low\n闭源 · Org", "2024/1/1", "未知", "80.0", "90", "88", "92"],
            ["2", "Model-High\n闭源 · Org", "2024/1/1", "未知", "95.0", "90", "88", "92"],
        ]
        tables = make_opencompass_tables(rows=rows)
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        entries = result["entries"]
        assert entries[0]["modelName"] == "Model-High"
        assert entries[0]["rank"] == 1
        assert entries[1]["modelName"] == "Model-Low"
        assert entries[1]["rank"] == 2

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_non_numeric_scores_keep_original_order(self, mock_get_browser):
        """非数值分数 → 不排序,rank 保持原始行序。"""
        rows = [
            ["1", "Model-A\n闭源 · Org", "2024/1/1", "未知", "N/A", "90", "88", "92"],
            ["2", "Model-B\n闭源 · Org", "2024/1/1", "未知", "TBD", "90", "88", "92"],
        ]
        tables = make_opencompass_tables(rows=rows)
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        entries = result["entries"]
        assert entries[0]["modelName"] == "Model-A"
        assert entries[0]["rank"] == 1
        assert entries[1]["modelName"] == "Model-B"
        assert entries[1]["rank"] == 2

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_mixed_scores_sorted_with_non_numeric_as_zero(self, mock_get_browser):
        """混合分数(部分数值部分非数值)→ 仍排序,非数值视为 0.0 排末尾。"""
        rows = [
            ["1", "Model-NA\n闭源 · Org", "2024/1/1", "未知", "N/A", "90", "88", "92"],
            ["2", "Model-High\n闭源 · Org", "2024/1/1", "未知", "95.0", "90", "88", "92"],
        ]
        tables = make_opencompass_tables(rows=rows)
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        entries = result["entries"]
        # 95.0 > 0.0(N/A) → Model-High 第一
        assert entries[0]["modelName"] == "Model-High"
        assert entries[0]["rank"] == 1
        assert entries[1]["modelName"] == "Model-NA"
        assert entries[1]["rank"] == 2

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_rank_starts_at_one_after_sort(self, mock_get_browser):
        """排序后 rank 从 1 开始递增,无间隔。"""
        rows = [
            [str(i + 1), f"Model-{i}\n闭源 · Org", "2024/1/1", "未知", f"{90 - i}.0", "90", "88", "92"]
            for i in range(5)
        ]
        tables = make_opencompass_tables(rows=rows)
        mock_browser, _, _ = make_browser_chain(tables=tables)
        mock_get_browser.return_value = mock_browser

        result = _scrape_opencompass_sync()

        entries = result["entries"]
        for idx, entry in enumerate(entries):
            assert entry["rank"] == idx + 1


# =============================================================================
# 12. wait_for_selector 降级(4 tests)
# =============================================================================


class TestWaitFallback:
    """wait_for_selector 超时降级逻辑。"""

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_table_selector_success_no_networkidle(self, mock_get_browser):
        """table selector 成功 → 不调用 networkidle 降级。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        _scrape_opencompass_sync()

        mock_page.wait_for_load_state.assert_not_called()

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_table_selector_fails_triggers_networkidle(self, mock_get_browser):
        """table selector 超时 → 降级到 networkidle 等待。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        def wait_side_effect(selector, **kwargs):
            if selector == "table":
                raise Exception("table timeout")

        mock_page.wait_for_selector.side_effect = wait_side_effect

        _scrape_opencompass_sync()

        mock_page.wait_for_load_state.assert_called_once_with(
            "networkidle", timeout=10_000,
        )

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_table_and_networkidle_both_fail_continues(self, mock_get_browser):
        """table selector + networkidle 都失败 → 仍继续执行。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        def wait_selector_side_effect(selector, **kwargs):
            if selector == "table":
                raise Exception("table timeout")

        mock_page.wait_for_selector.side_effect = wait_selector_side_effect
        mock_page.wait_for_load_state.side_effect = Exception("networkidle timeout")

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 2

    @patch("app.services.opencompass_scrape._get_browser_sync")
    def test_tbody_tr_timeout_continues(self, mock_get_browser):
        """table tbody tr 等待超时 → 不影响后续执行。"""
        mock_browser, _, mock_page = make_browser_chain(tables=make_opencompass_tables())
        mock_get_browser.return_value = mock_browser

        def wait_side_effect(selector, **kwargs):
            if selector == "table tbody tr":
                raise Exception("tbody tr timeout")

        mock_page.wait_for_selector.side_effect = wait_side_effect

        result = _scrape_opencompass_sync()

        assert len(result["entries"]) == 2


# =============================================================================
# 13. scrape_opencompass 异步包装(5 tests)
# =============================================================================


class TestScrapeAsync:
    """scrape_opencompass 异步包装:run_in_executor(sync → async)。"""

    @pytest.mark.asyncio
    @patch("app.services.opencompass_scrape._scrape_opencompass_sync")
    async def test_returns_sync_result(self, mock_sync):
        """异步包装返回 sync 实现的结果。"""
        expected = {
            "entries": [{"rank": 1, "modelName": "GPT-4o"}],
            "captured_at": 1234567890,
            "url": OPENCOMPASS_URL,
            "headers": ["模型"],
        }
        mock_sync.return_value = expected

        result = await scrape_opencompass(30000)

        assert result == expected

    @pytest.mark.asyncio
    @patch("app.services.opencompass_scrape._scrape_opencompass_sync")
    async def test_timeout_passed_through(self, mock_sync):
        """timeout_ms 透传到 sync 实现。"""
        mock_sync.return_value = {"entries": [], "captured_at": 0, "url": "", "headers": []}

        await scrape_opencompass(5000)

        mock_sync.assert_called_once_with(5000)

    @pytest.mark.asyncio
    @patch("app.services.opencompass_scrape._scrape_opencompass_sync")
    async def test_sync_exception_propagates(self, mock_sync):
        """sync 实现抛异常 → 异步包装传播异常。"""
        mock_sync.side_effect = RuntimeError("scrape failed")

        with pytest.raises(RuntimeError, match="scrape failed"):
            await scrape_opencompass(30000)

    @pytest.mark.asyncio
    @patch("app.services.opencompass_scrape._scrape_opencompass_sync")
    async def test_default_timeout_is_30000(self, mock_sync):
        """默认 timeout_ms=30000。"""
        mock_sync.return_value = {"entries": [], "captured_at": 0, "url": "", "headers": []}

        await scrape_opencompass()

        mock_sync.assert_called_once_with(30000)

    @pytest.mark.asyncio
    @patch("app.services.opencompass_scrape._scrape_opencompass_sync")
    async def test_runs_in_executor_not_blocking(self, mock_sync):
        """通过 run_in_executor 执行,不阻塞事件循环。"""
        mock_sync.return_value = {"entries": [], "captured_at": 0, "url": "", "headers": []}

        # 两个并发调用应能并行完成
        results = await asyncio.gather(
            scrape_opencompass(10000),
            scrape_opencompass(20000),
        )

        assert len(results) == 2
        assert mock_sync.call_count == 2
        assert mock_sync.call_args_list[0].args == (10000,)
        assert mock_sync.call_args_list[1].args == (20000,)
