import os

"""scripts/ci/check_openapi_schema_drift.py 单测 (Phase 5-B)."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts" / "ci" / "check_openapi_schema_drift.py"
BASELINE = ROOT / "tests" / "fixtures" / "openapi_baseline.json"


# ---------------------------------------------------------------------------
# TestExtractSignature
# ---------------------------------------------------------------------------


class TestExtractSignature:
    def _sample_schema(self) -> dict:
        return {
            "paths": {
                "/api/v1/users": {
                    "get": {
                        "tags": ["user"],
                        "responses": {
                            "200": {
                                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UserList"}}}
                            }
                        },
                    },
                    "post": {
                        "tags": ["user"],
                        "requestBody": {
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UserIn"}}}
                        },
                        "responses": {
                            "201": {
                                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/UserOut"}}}
                            }
                        },
                    },
                },
                "/api/v1/health": {
                    "get": {
                        "tags": ["health"],
                        "responses": {"200": {"content": {"application/json": {"schema": {"type": "object"}}}}},
                    }
                },
            },
            "components": {
                "schemas": {
                    "UserList": {"type": "object", "properties": {"items": {"type": "array"}}},
                    "UserIn": {"type": "object", "properties": {"name": {"type": "string"}}},
                    "UserOut": {"type": "object", "properties": {"id": {"type": "integer"}}},
                }
            },
        }

    def test_extracts_get_endpoint(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        sigs = extract_signature(self._sample_schema())
        assert "GET /api/v1/users" in sigs
        assert "POST /api/v1/users" in sigs
        assert "GET /api/v1/health" in sigs

    def test_get_endpoint_no_request_schema(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        sigs = extract_signature(self._sample_schema())
        assert sigs["GET /api/v1/users"]["req_schema"] == ""

    def test_post_endpoint_request_schema(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        sigs = extract_signature(self._sample_schema())
        assert sigs["POST /api/v1/users"]["req_schema"] == "UserIn"

    def test_2xx_only_in_response_schemas(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        sigs = extract_signature(self._sample_schema())
        # GET /api/v1/users: 200 → UserList
        assert "200:UserList" in sigs["GET /api/v1/users"]["resp_2xx_schemas"]
        # 4xx/5xx 不应出现
        assert "404" not in sigs["GET /api/v1/users"]["resp_2xx_schemas"]

    def test_inline_schema(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        sigs = extract_signature(self._sample_schema())
        # /api/v1/health 用 inline schema
        assert "inline:" in sigs["GET /api/v1/health"]["resp_2xx_schemas"]

    def test_strict_mode_includes_fields(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        sigs = extract_signature(self._sample_schema(), strict=True)
        s = sigs["POST /api/v1/users"]
        assert "req_fields" in s
        assert "name" in s["req_fields"]
        assert "resp_fields" in s
        assert "id" in s["resp_fields"]

    def test_skips_non_http_methods(self):
        from scripts.ci.check_openapi_schema_drift import extract_signature

        schema = {
            "paths": {
                "/x": {
                    "parameters": [{"name": "y"}],  # 非 http method
                    "get": {"responses": {"200": {}}},
                }
            }
        }
        sigs = extract_signature(schema)
        assert "GET /x" in sigs


# ---------------------------------------------------------------------------
# TestDiffSignatures
# ---------------------------------------------------------------------------


class TestDiffSignatures:
    def test_added_detected(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        baseline = {"GET /a": {"x": 1}}
        current = {"GET /a": {"x": 1}, "POST /b": {"x": 2}}
        d = diff_signatures(baseline, current)
        assert d["added"] == ["POST /b"]
        assert d["removed"] == []
        assert d["changed"] == []

    def test_removed_detected(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        baseline = {"GET /a": {"x": 1}, "GET /b": {"x": 2}}
        current = {"GET /a": {"x": 1}}
        d = diff_signatures(baseline, current)
        assert d["removed"] == ["GET /b"]

    def test_changed_detected(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        baseline = {"GET /a": {"req_schema": "OldIn"}}
        current = {"GET /a": {"req_schema": "NewIn"}}
        d = diff_signatures(baseline, current)
        assert len(d["changed"]) == 1
        assert d["changed"][0]["endpoint"] == "GET /a"

    def test_unchanged_returns_empty(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        s = {"GET /a": {"req_schema": "X"}}
        d = diff_signatures(s, s)
        assert d["added"] == []
        assert d["removed"] == []
        assert d["changed"] == []

    def test_whitelist_skips_added(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        baseline = {"GET /a": {"x": 1}}
        current = {"GET /a": {"x": 1}, "POST /wip": {"x": 99}}
        d = diff_signatures(baseline, current, whitelist={"POST /wip"})
        assert d["added"] == []

    def test_whitelist_skips_removed(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        baseline = {"GET /a": {"x": 1}, "GET /wip": {"x": 2}}
        current = {"GET /a": {"x": 1}}
        d = diff_signatures(baseline, current, whitelist={"GET /wip"})
        assert d["removed"] == []

    def test_whitelist_skips_changed(self):
        from scripts.ci.check_openapi_schema_drift import diff_signatures

        baseline = {"GET /wip": {"req_schema": "OldIn"}}
        current = {"GET /wip": {"req_schema": "NewIn"}}
        d = diff_signatures(baseline, current, whitelist={"GET /wip"})
        assert d["changed"] == []


# ---------------------------------------------------------------------------
# TestBaselineIO
# ---------------------------------------------------------------------------


class TestBaselineIO:
    def test_load_missing_returns_empty(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline

        assert load_baseline(tmp_path / "missing.json") == {}

    def test_load_old_format(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline

        f = tmp_path / "old.json"
        f.write_text(json.dumps({"GET /a": {"x": 1}}), encoding="utf-8")
        assert load_baseline(f) == {"GET /a": {"x": 1}}

    def test_load_new_format(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline

        f = tmp_path / "new.json"
        f.write_text(
            json.dumps(
                {
                    "meta": {"endpoint_count": 1},
                    "signatures": {"GET /a": {"x": 1}},
                }
            ),
            encoding="utf-8",
        )
        assert load_baseline(f) == {"GET /a": {"x": 1}}

    def test_save_and_load(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline, save_baseline

        f = tmp_path / "b.json"
        save_baseline(f, {"GET /x": {"y": 1}}, {"endpoint_count": 1})
        assert load_baseline(f) == {"GET /x": {"y": 1}}

    def test_whitelist_default_empty_in_old_baseline(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline_meta

        # 旧 baseline 没有 whitelist 字段, 视为空
        f = tmp_path / "old.json"
        f.write_text(json.dumps({"GET /a": {"x": 1}}), encoding="utf-8")
        meta = load_baseline_meta(f)
        assert meta.get("whitelist") == []

    def test_save_preserves_existing_whitelist(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline_meta, save_baseline

        f = tmp_path / "b.json"
        # 第一次保存带 whitelist
        save_baseline(f, {"GET /a": {"x": 1}}, {"endpoint_count": 1, "whitelist": ["GET /keep"]})
        # 第二次保存不传 whitelist, 应保留
        save_baseline(f, {"GET /a": {"x": 2}}, {"endpoint_count": 1})
        meta = load_baseline_meta(f)
        assert "GET /keep" in meta.get("whitelist", [])


# ---------------------------------------------------------------------------
# TestFetchCurrentSchema
# ---------------------------------------------------------------------------


class TestFetchCurrentSchema:
    def test_fetches_real_app(self):
        from scripts.ci.check_openapi_schema_drift import fetch_current_schema

        s = fetch_current_schema()
        assert "paths" in s
        assert "openapi" in s
        # 至少 100 个 endpoint
        assert len(s["paths"]) > 100


# ---------------------------------------------------------------------------
# TestCliE2E
# ---------------------------------------------------------------------------


class TestCliE2E:
    def test_first_run_no_baseline_returns_zero(self, tmp_path, monkeypatch):
        """baseline 不存在 → 退出 0 (首次不 fail)."""
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(tmp_path / "missing.json")],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0, f"stderr: {r.stderr}\nstdout: {r.stdout}"
        assert "baseline 不存在或为空" in r.stdout

    def test_no_drift_returns_zero(self):
        """baseline 与当前 schema 一致 → 退出 0."""
        r = subprocess.run(
            [sys.executable, str(SCRIPTS)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        assert "PASS" in r.stdout

    def test_drift_returns_one(self, tmp_path):
        """baseline 改坏 → 退出 1."""
        bad = tmp_path / "bad.json"
        bad.write_text(
            json.dumps(
                {
                    "meta": {},
                    "signatures": {"DELETE /this/does/not/exist": {"x": 1}},
                }
            ),
            encoding="utf-8",
        )
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(bad)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 1
        assert "FAIL" in r.stdout

    def test_added_endpoint_returns_one(self, tmp_path):
        """baseline 缺一个真实 endpoint → 报告 added, 退出 1."""
        current_signatures = json.loads(BASELINE.read_text(encoding="utf-8"))["signatures"]
        # 删一个
        key_to_remove = next(iter(current_signatures))
        baseline = dict(current_signatures)
        del baseline[key_to_remove]
        bad = tmp_path / "missing_one.json"
        bad.write_text(json.dumps({"meta": {}, "signatures": baseline}), encoding="utf-8")
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(bad)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 1
        assert key_to_remove in r.stdout
        assert "新增" in r.stdout

    def test_json_output(self):
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        # 至少有 "endpoints" 键
        assert '"endpoints"' in r.stdout

    def test_update_writes_baseline(self, tmp_path):
        """--update 模式把当前 schema 写为 baseline."""
        b = tmp_path / "out.json"
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(b), "--update"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        assert b.exists()
        data = json.loads(b.read_text(encoding="utf-8"))
        assert "signatures" in data
        assert len(data["signatures"]) > 100


# ---------------------------------------------------------------------------
# Phase 8: load_baseline_meta + strict baseline 兼容
# ---------------------------------------------------------------------------


class TestBaselineMeta:
    """Phase 8: load_baseline_meta 单独加载 baseline meta 字段."""

    def test_load_meta_old_format_defaults_to_non_strict(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline_meta

        f = tmp_path / "old.json"
        f.write_text(json.dumps({"GET /a": {"x": 1}}), encoding="utf-8")
        meta = load_baseline_meta(f)
        assert meta.get("strict") is False

    def test_load_meta_new_format_strict_true(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline_meta

        f = tmp_path / "new.json"
        f.write_text(
            json.dumps(
                {
                    "meta": {"strict": True, "endpoint_count": 1},
                    "signatures": {"GET /a": {"x": 1}},
                }
            ),
            encoding="utf-8",
        )
        meta = load_baseline_meta(f)
        assert meta.get("strict") is True

    def test_load_meta_missing_file_returns_empty(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline_meta

        meta = load_baseline_meta(tmp_path / "missing.json")
        assert meta == {}

    def test_load_meta_empty_meta_field(self, tmp_path):
        from scripts.ci.check_openapi_schema_drift import load_baseline_meta

        f = tmp_path / "f.json"
        f.write_text(
            json.dumps(
                {
                    "meta": None,
                    "signatures": {"GET /a": {"x": 1}},
                }
            ),
            encoding="utf-8",
        )
        meta = load_baseline_meta(f)
        assert meta.get("strict") is False


# ---------------------------------------------------------------------------
# Phase 8: --strict 模式 CLI 行为
# ---------------------------------------------------------------------------


class TestStrictMode:
    """Phase 8: --strict 模式 + strict baseline 兼容 + 字段级深比."""

    def test_strict_with_strict_baseline_passes(self):
        """真实仓库 baseline 是 strict 生成, --strict 应 PASS."""
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--strict"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0, f"stdout={r.stdout}"
        assert "PASS" in r.stdout

    def test_strict_with_non_strict_baseline_fails(self, tmp_path):
        """--strict 但 baseline 是旧格式 (无 meta) → rc=1 + 提示升级."""
        # 构造一个旧格式 baseline (无 meta.strict=True)
        current_signatures = json.loads(BASELINE.read_text(encoding="utf-8"))["signatures"]
        # 旧格式: 无 meta 包裹
        bad = tmp_path / "old_format.json"
        bad.write_text(json.dumps(current_signatures), encoding="utf-8")
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--strict", "--baseline", str(bad)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 1
        assert "STRICT_BASELINE_INCOMPATIBLE" in r.stdout

    def test_strict_with_non_strict_baseline_json(self, tmp_path):
        """--strict + 非 strict baseline + --json 应输出 status=strict_baseline_incompatible."""
        current_signatures = json.loads(BASELINE.read_text(encoding="utf-8"))["signatures"]
        bad = tmp_path / "old_format.json"
        bad.write_text(json.dumps(current_signatures), encoding="utf-8")
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--strict", "--baseline", str(bad), "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 1
        data = json.loads(r.stdout)
        assert data["status"] == "strict_baseline_incompatible"

    def test_default_mode_auto_upgrades_to_strict(self):
        """默认 (无 --strict) 检测到 strict baseline, 自动按 strict 比, 应 PASS."""
        r = subprocess.run(
            [sys.executable, str(SCRIPTS)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        assert "自动启用 strict 模式" in r.stdout or "PASS" in r.stdout

    def test_strict_catches_field_change(self, tmp_path):
        """--strict 应能捕获响应字段变化 (制造 drift 注入)."""
        # 从真实 baseline 拿一个 endpoint, 改它的 resp_fields
        data = json.loads(BASELINE.read_text(encoding="utf-8"))
        sigs = dict(data["signatures"])
        # 任意选一个 endpoint, 加假字段到 resp_fields
        some_key = next(iter(sigs))
        sigs[some_key] = dict(sigs[some_key])
        if "resp_fields" in sigs[some_key]:
            sigs[some_key]["resp_fields"] = sigs[some_key]["resp_fields"] + "fake"
        else:
            sigs[some_key]["resp_fields"] = "200:fake_field"
        # 保留 strict meta
        bad = tmp_path / "field_changed.json"
        bad.write_text(
            json.dumps(
                {
                    "meta": {"strict": True, "endpoint_count": len(sigs)},
                    "signatures": sigs,
                }
            ),
            encoding="utf-8",
        )
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--strict", "--baseline", str(bad)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 1
        assert "FAIL" in r.stdout
        assert some_key in r.stdout

    def test_strict_baseline_format_includes_meta_strict_true(self, tmp_path):
        """--update --strict 写入的 baseline 应含 meta.strict=True."""
        b = tmp_path / "strict_out.json"
        r = subprocess.run(
            [sys.executable, str(SCRIPTS), "--baseline", str(b), "--update", "--strict"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT),
            timeout=120,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        assert r.returncode == 0
        data = json.loads(b.read_text(encoding="utf-8"))
        assert data["meta"]["strict"] is True
        # 至少有 1 个 endpoint 包含 req_fields (strict 标志)
        some_sig = next(iter(data["signatures"].values()))
        assert "req_fields" in some_sig
        assert "resp_fields" in some_sig
