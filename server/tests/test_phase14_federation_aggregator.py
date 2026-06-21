"""Phase 14 建议 2 测试: Federation 双层联邦 (中心聚合)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

from federation_aggregator import (
    Aggregator,
    EdgeConfig,
    Series,
    format_label_value,
    load_edges_from_file,
    merge_series,
    parse_label_value,
    parse_prometheus_text,
)

# ---------------------------------------------------------------------------
# parse_label_value / format_label_value
# ---------------------------------------------------------------------------


class TestLabelValue:
    def test_parse_simple(self):
        assert parse_label_value("hello") == "hello"

    def test_parse_escape_quote(self):
        assert parse_label_value('say \\"hi\\"') == 'say "hi"'

    def test_parse_escape_newline(self):
        assert parse_label_value("line1\\nline2") == "line1\nline2"

    def test_parse_escape_backslash(self):
        assert parse_label_value("a\\\\b") == "a\\b"

    def test_format_quote(self):
        assert format_label_value('say "hi"') == 'say \\"hi\\"'

    def test_format_roundtrip(self):
        original = '复杂"内容\n转义\\符号'
        assert parse_label_value(format_label_value(original)) == original


# ---------------------------------------------------------------------------
# parse_prometheus_text
# ---------------------------------------------------------------------------


class TestParsePrometheusText:
    def test_empty(self):
        assert parse_prometheus_text("") == []

    def test_simple_metric(self):
        text = "# TYPE my_metric gauge\nmy_metric 42.5"
        s = parse_prometheus_text(text)
        assert len(s) == 1
        assert s[0].name == "my_metric"
        assert s[0].value == 42.5
        assert s[0].metric_type == "gauge"
        assert s[0].labels == {}

    def test_metric_with_labels(self):
        text = 'my_metric{label1="v1",label2="v2"} 100'
        s = parse_prometheus_text(text)
        assert s[0].labels == {"label1": "v1", "label2": "v2"}

    def test_metric_with_timestamp(self):
        text = "my_metric 100 1700000000000"
        s = parse_prometheus_text(text)
        assert len(s) == 1
        assert s[0].value == 100

    def test_help_metadata(self):
        text = "# HELP my_metric The help text\n# TYPE my_metric counter\nmy_metric 1"
        s = parse_prometheus_text(text)
        assert s[0].metric_type == "counter"

    def test_multiple_metrics(self):
        text = """
# TYPE m1 gauge
m1 10
# TYPE m2 counter
m2{a="b"} 20
m3 30
"""
        s = parse_prometheus_text(text)
        assert len(s) == 3
        names = [x.name for x in s]
        assert "m1" in names
        assert "m2" in names
        assert "m3" in names

    def test_invalid_line_skipped(self):
        text = """
valid_metric 1
invalid line
another 2
"""
        s = parse_prometheus_text(text)
        assert len(s) == 2

    def test_escaped_label_value(self):
        text = r'metric{key="line\nbreak"} 1'
        s = parse_prometheus_text(text)
        assert s[0].labels["key"] == "line\nbreak"

    def test_source_label(self):
        s = parse_prometheus_text("m 1", source="edge-1")
        assert s[0].source_edge == "edge-1"

    def test_comments_ignored(self):
        text = "# random comment\n# HELP m help\nm 1"
        s = parse_prometheus_text(text)
        assert len(s) == 1


# ---------------------------------------------------------------------------
# merge_series
# ---------------------------------------------------------------------------


class TestMergeSeries:
    def test_dedup_same_signature(self):
        s1 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        s2 = [Series(name="m", labels={"a": "1"}, value=20, source_edge="e2")]
        merged = merge_series([s1, s2])
        # 后到的覆盖
        assert len(merged) == 1
        assert merged[0].value == 20

    def test_no_dedup_keeps_all(self):
        s1 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        s2 = [Series(name="m", labels={"a": "1"}, value=20, source_edge="e2")]
        merged = merge_series([s1, s2], dedup=False)
        assert len(merged) == 2

    def test_different_labels_kept(self):
        s1 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        s2 = [Series(name="m", labels={"a": "2"}, value=20, source_edge="e2")]
        merged = merge_series([s1, s2])
        assert len(merged) == 2

    def test_source_label_added(self):
        s1 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        merged = merge_series([s1])
        assert merged[0].labels["source_edge"] == "e1"

    def test_extra_labels_added(self):
        s1 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        merged = merge_series([s1], extra_labels={"cluster": "zhs", "region": "cn-east-1"})
        assert merged[0].labels["cluster"] == "zhs"
        assert merged[0].labels["region"] == "cn-east-1"
        assert merged[0].labels["source_edge"] == "e1"

    def test_extra_labels_dont_overwrite(self):
        s1 = [Series(name="m", labels={"a": "1", "cluster": "existing"}, value=10, source_edge="e1")]
        merged = merge_series([s1], extra_labels={"cluster": "zhs"})
        assert merged[0].labels["cluster"] == "existing"

    def test_multi_source_concat(self):
        """多源时, 重复 series 的 source 标签合并为逗号分隔."""
        s1 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        s2 = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e2")]
        merged = merge_series([s1, s2])
        # 后到覆盖, 但 source 标签合并
        assert merged[0].labels["source_edge"] in ("e1,e2", "e2,e1")

    def test_signature_stable(self):
        s1 = Series(name="m", labels={"a": "1", "b": "2"}, value=10)
        s2 = Series(name="m", labels={"b": "2", "a": "1"}, value=20)  # 顺序不同
        assert s1.signature() == s2.signature()


# ---------------------------------------------------------------------------
# EdgeConfig
# ---------------------------------------------------------------------------


class TestEdgeConfig:
    def test_to_dict(self):
        c = EdgeConfig(
            name="e1",
            url="http://e1:9105/federate",
            match=['{__name__="x"}'],
            bearer_token="secret",
            scrape_interval=15,
        )
        d = c.to_dict()
        assert d["name"] == "e1"
        assert d["url"] == "http://e1:9105/federate"
        assert d["scrape_interval"] == 15
        assert "bearer_token" not in d  # 不暴露


# ---------------------------------------------------------------------------
# Aggregator
# ---------------------------------------------------------------------------


class TestAggregator:
    def test_empty_status(self):
        a = Aggregator()
        s = a.status_dict()
        assert s["edge_count"] == 0

    def test_add_remove_edge(self):
        a = Aggregator()
        a.add_edge(EdgeConfig(name="e1", url="http://e1:9105/federate"))
        assert "e1" in a.edges
        a.remove_edge("e1")
        assert "e1" not in a.edges

    def test_get_merged_series_empty(self):
        a = Aggregator()
        assert a.get_merged_series() == []

    def test_get_merged_series_from_last_results(self):
        a = Aggregator()
        a.last_results["e1"] = [Series(name="m", labels={"a": "1"}, value=10, source_edge="e1")]
        merged = a.get_merged_series()
        assert len(merged) == 1
        assert merged[0].labels["source_edge"] == "e1"

    def test_scrape_one_connection_refused(self):
        pytest.importorskip("httpx")
        a = Aggregator()
        a.add_edge(EdgeConfig(name="bad", url="http://127.0.0.1:1/federate", timeout_s=1.0))
        result = asyncio.run(a.scrape_one(a.edges["bad"]))
        assert result == []
        assert a.last_scrape_status["bad"] != "ok"

    def test_scrape_all_no_edges(self):
        a = Aggregator()
        result = asyncio.run(a.scrape_all())
        assert result == []

    def test_scrape_all_collects_results(self):
        pytest.importorskip("httpx")
        a = Aggregator()
        a.add_edge(EdgeConfig(name="bad1", url="http://127.0.0.1:1/federate", timeout_s=1.0))
        a.add_edge(EdgeConfig(name="bad2", url="http://127.0.0.1:2/federate", timeout_s=1.0))
        result = asyncio.run(a.scrape_all())
        assert result == []
        # 两个 edge 都被标记
        assert a.last_scrape_status["bad1"] != "ok"
        assert a.last_scrape_status["bad2"] != "ok"

    def test_render_metrics(self):
        pytest.importorskip("prometheus_client")
        a = Aggregator()
        text = a.render_metrics()
        assert "zhs_federation_aggregator" in text

    def test_status_dict_with_edges(self):
        a = Aggregator()
        a.add_edge(EdgeConfig(name="e1", url="http://e1:9105/federate", scrape_interval=15))
        s = a.status_dict()
        assert s["edge_count"] == 1
        assert s["edges"][0]["name"] == "e1"
        assert s["edges"][0]["scrape_interval"] == 15
        assert s["edges"][0]["last_scrape_status"] == "never"


# ---------------------------------------------------------------------------
# load_edges_from_file
# ---------------------------------------------------------------------------


class TestLoadEdges:
    def test_load_json(self, tmp_path):
        cfg = tmp_path / "edges.json"
        cfg.write_text(
            json.dumps(
                {
                    "edges": [
                        {"name": "e1", "url": "http://e1:9105", "match": ['{__name__="x"}']},
                        {"name": "e2", "url": "http://e2:9105", "scrape_interval": 60},
                    ]
                }
            ),
            encoding="utf-8",
        )
        edges = load_edges_from_file(cfg)
        assert len(edges) == 2
        assert edges[0].name == "e1"
        assert edges[0].match == ['{__name__="x"}']
        assert edges[1].scrape_interval == 60

    def test_load_missing(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_edges_from_file(tmp_path / "missing.json")

    def test_load_invalid(self, tmp_path):
        cfg = tmp_path / "bad.json"
        cfg.write_text('{"wrong_key": []}', encoding="utf-8")
        with pytest.raises(ValueError):
            load_edges_from_file(cfg)


# ---------------------------------------------------------------------------
# FastAPI 端点
# ---------------------------------------------------------------------------


def _has_fastapi() -> bool:
    try:
        import fastapi  # noqa: F401
        from fastapi.testclient import TestClient  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.mark.skipif(not _has_fastapi(), reason="fastapi.testclient 不可用")
class TestAggregatorApp:
    def test_healthz(self):
        pytest.importorskip("prometheus_client")
        a = Aggregator()
        from federation_aggregator import create_app

        app = create_app(a)
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.get("/healthz")
        assert r.status_code == 200

    def test_cluster_status(self):
        pytest.importorskip("prometheus_client")
        a = Aggregator()
        a.add_edge(EdgeConfig(name="e1", url="http://e1:9105"))
        from federation_aggregator import create_app

        app = create_app(a)
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.get("/cluster/status")
        assert r.status_code == 200
        data = r.json()
        assert data["edge_count"] == 1

    def test_metrics_endpoint(self):
        pytest.importorskip("prometheus_client")
        a = Aggregator()
        a.add_edge(EdgeConfig(name="bad", url="http://127.0.0.1:1/federate", timeout_s=1.0))
        from federation_aggregator import create_app

        app = create_app(a)
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.get("/metrics")
        # 即使 edge 失败, /metrics 仍返回 (含内部 edge_up=0)
        assert r.status_code == 200
        assert "zhs_federation_aggregator_edge_up" in r.text

    def test_scrape_endpoint(self):
        pytest.importorskip("prometheus_client")
        a = Aggregator()
        a.add_edge(EdgeConfig(name="bad", url="http://127.0.0.1:1/federate", timeout_s=1.0))
        from federation_aggregator import create_app

        app = create_app(a)
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.post("/v1/scrape")
        assert r.status_code == 200
        data = r.json()
        assert "series_count" in data
