#!/usr/bin/env bash
# OpenAPI Baseline Update Hint (post-commit 提示)
# 当 app/api/ 下文件有变更时, 提示开发者重新生成 baseline
echo ">> [openapi-update] 路由有变更. 若是刻意改动, 请运行:"
echo "   python scripts/ci/check_openapi_schema_drift.py --update"
echo "   git add tests/fixtures/openapi_baseline.json"
