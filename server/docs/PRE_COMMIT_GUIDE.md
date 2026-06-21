# Pre-commit Hook 团队接入指南 (Phase 8)

> 让每个开发者 `git commit` 时自动跑 alembic dry-run + OpenAPI drift 检测,
> 拦截破坏性变更, 减少 CI red 反馈循环。

---

## 1. 安装 pre-commit (一次性)

### Windows

```powershell
pip install pre-commit
pre-commit --version
# 期望: pre-commit 3.5.0+
```

### macOS / Linux

```bash
pip install pre-commit
# 或 brew install pre-commit
pre-commit --version
```

---

## 2. 启用 hooks (项目级一次性)

```bash
cd g:\1\zhs-platform   # 项目根
pre-commit install
```

**期望输出**：
```
pre-commit installed at .git\hooks\pre-commit
```

---

## 3. 验证

```bash
# 故意改一个 alembic 脚本链, 看 hook 是否拦截
echo "test" >> alemic/versions/test.txt  # 注意: alemic 不存在, 会 404
git add .
git commit -m "test pre-commit"
```

**期望**：
- alembic hook 跑 `python scripts/ci/alembic_ci.py dry-run`
- OpenAPI hook 跑 `python scripts/ci/check_openapi_schema_drift.py`
- 任一失败 → commit 被拦, 提示 `Fix the errors before committing.`

---

## 4. 手动跑全量 hook (可选)

```bash
# 跑所有 hook, 不实际 commit
pre-commit run --all-files

# 跑单个 hook
pre-commit run alembic-ci-dryrun --all-files
pre-commit run openapi-drift --all-files
```

---

## 5. 跳过 hook (紧急情况)

```bash
# 跳过所有 hook (慎用)
git commit -m "emergency fix" --no-verify

# 跳过单个 hook
SKIP=alembic-ci-dryrun git commit -m "skip alembic check"
```

---

## 6. 团队约定

| 场景 | 行为 |
|---|---|
| 修改 `app/` 下任何路由/响应模型 | OpenAPI hook 必跑, baseline drift 时先跑 `python scripts/ci/check_openapi_schema_drift.py --update --strict` 重生成 |
| 修改 `alembic/versions/` | Alembic dry-run 必跑, 缺 down_revision 会失败 |
| 修改 `docker/prometheus/rules.yml` | 顺带 `python scripts/ci/sync_observability_config.py` 同步 helm 副本, 否则 ci-fast.yml 的 sync-check job 会红 |
| 修改 `app/metrics_business.py` | 增删指标要同步 `docker/prometheus/rules.yml` 告警 expr, 避免死引用 |

---

## 7. 常见问题

### Q1: pre-commit 太慢, 影响 commit 体验?

A1: 第一次跑会装环境 (pip + 项目), 约 60s; 之后增量只跑变更文件, 约 5-10s。

如果实在慢, 可以拆 `git commit -m "msg" --no-verify`, 然后 `pre-commit run --files <changed>` 单独跑。

### Q2: baseline drift 是真的改了接口, 还是工具误报?

A2: 跑了 `check_openapi_schema_drift.py` 后, 看 Step 3/4/5 输出:
- Step 3 新增 → 新加了路由, 正确, 跑 `--update` 更新 baseline
- Step 4 删除 → 删了路由, 正确
- Step 5 changed → 改了方法/参数/响应, 确认是否预期, 预期则 `--update`

### Q3: 我在公司代理后面, pre-commit 装包失败?

A3: 配 `git config --global http.proxy http://proxy.company.com:8080`, 或在 `~/.pre-commit-config.yaml` 配 `language: system` 走本地 Python。

### Q4: 想加新的 hook (如 ruff)?

A4: 编辑项目根 `.pre-commit-config.yaml`, 加新 repo。例如:

```yaml
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
```

---

## 8. CI 中的等价检查

`.github/workflows/ci-fast.yml` 的 `alembic-ci-dryrun` 和 `openapi-drift` 两个 job 是 pre-commit 的服务端兜底, 即使有人用 `--no-verify` 绕过, CI 仍会卡住。

```
本地 pre-commit  →  CI alembic-ci-dryrun / openapi-drift  →  PR merge
   ↑ 5s                      ↑ 30s                              ↑ 安全
```

---

## 9. 一键接入脚本 (新人入职)

```bash
git clone <repo>
cd zhs-platform
pip install pre-commit
pre-commit install
pre-commit run --all-files   # 首次完整跑一次
```

完成 ✅, 可以正常 commit。
