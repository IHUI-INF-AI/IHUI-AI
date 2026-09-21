# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P3 #41 记忆图谱抽取解析测试(2026-09-16 立,纯函数容错)。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.services.memory_graph import _parse_pairs  # noqa: E402


def test_valid_array():
    content = '[{"source": 0, "target": 1, "relation": "depends_on"}]'
    assert _parse_pairs(content) == [(0, 1, "depends_on")]


def test_array_with_surrounding_text():
    content = '结果如下：\n[{"source": 2, "target": 0, "relation": "relates_to"}]\n以上。'
    assert _parse_pairs(content) == [(2, 0, "relates_to")]


def test_empty_relations():
    assert _parse_pairs("[]") == []


def test_invalid_json_returns_empty():
    assert _parse_pairs("不是 JSON") == []
    assert _parse_pairs("") == []


def test_non_dict_items_skipped():
    content = '[[1,2], {"source": 0, "target": 1, "relation": "same_as"}]'
    assert _parse_pairs(content) == [(0, 1, "same_as")]


def test_missing_fields_skipped():
    content = '[{"source": 0}, {"source": 1, "target": 2}]'
    assert _parse_pairs(content) == []


def test_relation_truncated_to_64():
    content = '[{"source": 0, "target": 1, "relation": "' + "x" * 100 + '"}]'
    pairs = _parse_pairs(content)
    assert len(pairs) == 1
    assert len(pairs[0][2]) == 64
