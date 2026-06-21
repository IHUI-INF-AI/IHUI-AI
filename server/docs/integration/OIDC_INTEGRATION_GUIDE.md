# OIDC 凭据接入指南 (建议 3)

> Phase 9 落地：消除 long-lived secret，改为 GitHub Actions OIDC 颁发短期 token。

## 1. 为什么弃用 long-lived secret

- **泄漏风险高**：GitHub Secret 一旦被 PR/日志/镜像泄漏，攻击者可永久使用
- **轮转困难**：手动改 Secret → 触发所有引用 workflow 失败
- **权限过大**：单个 secret 通常拥有"全权限"，违反最小权限原则

短期 token (TTL 30min) 用完即焚，泄漏窗口 = 演练时长。

## 2. 架构

```
┌─────────────────┐
│ GitHub Actions  │  颁发 OIDC ID Token (JWT)
│ (workflow)      │  permissions: id-token: write
└────────┬────────┘
         │  POST /actions/idtoken/...
         ↓
┌─────────────────┐
│ scripts/ci/     │  oidc_token_exchange.py
│ oidc_token_     │  1. verify GitHub OIDC JWT
│ exchange.py     │  2. 调 vault 换短期凭据
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ 内置 vault      │  颁发 provider-specific token
│ (zhs-vault)     │  TTL 30min, 最小权限
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Grafana /       │  短期 token 调用
│ DingTalk /      │  TTL 过期自动失效
│ Alertmanager    │
└─────────────────┘
```

## 3. 接入步骤

### 3.1 启用 GitHub OIDC (一次性)

1. 仓库 → Settings → Actions → General
2. **Workflow permissions** → 勾选 "Allow GitHub Actions to create and approve pull requests"
3. 不用配置 trust policy (OIDC 默认对所有 workflow 开放)

### 3.2 workflow 配置 (已完成)

`weekly-phase8-drill.yml` 已默认 `id-token: write` 权限。`workflow_dispatch` 输入 `auth_mode`:
- `oidc` (默认, 推荐): 自动兑换短期 token
- `legacy`: 兼容老 secret，未升级 vault 时使用

### 3.3 部署 vault 服务 (生产)

内网起一个轻量 vault 服务 (Go/Python 都可)，提供：
- `POST /v1/exchange` 接收 GitHub OIDC JWT
- 校验 JWT 签名（用 GitHub JWKS）
- 校验 `aud=zhs-vault`, `sub=repo:owner/zhs-platform:ref:refs/heads/main`
- 颁发 provider-specific 短期 token，TTL 30 min
- 记录审计日志

mock 实现见 `scripts/ci/oidc_token_exchange.py:exchange_github_oidc_to_vault()`。

## 4. 验证 (本地 / CI)

### 4.1 mock 模式

```bash
# 1. 颁发 grafana token
python scripts/ci/oidc_token_exchange.py --provider grafana --ttl-min 30 --output logs/oidc_test/grafana.tok

# 2. 验签
TOK=$(cat logs/oidc_test/grafana.tok)
ZHS_OIDC_DEV_KEY=dev-key-do-not-use-in-prod python scripts/ci/oidc_token_exchange.py --verify "$TOK"
# 输出: payload JSON 含 iss/sub/aud/iat/exp/scope
```

### 4.2 真实模式 (CI)

CI workflow 跑 `python scripts/ci/oidc_token_exchange.py --provider grafana --ttl-min 30 --output logs/oidc_grafana_token` 自动走 GitHub OIDC 路径。

## 5. 关闭 OIDC 模式 (回退)

`workflow_dispatch` → `auth_mode=legacy`。回退后沿用老的 long-lived secret：
- `PHASE8_DRILL_DINGTALK_WEBHOOK`
- `PHASE8_DRILL_DINGTALK_SECRET`
- `PHASE8_DRILL_GRAFANA_TOKEN`

## 6. Provider 清单

| Provider | 颁发 token 用途 | 最小权限 |
|----------|----------------|----------|
| grafana | Annotations API write | `annotations:write` on `zhs-monitor-health` dashboard |
| dingtalk | 群机器人 webhook 调用 | `webhook:send` on `#zhs-monitor-ops` 群 |
| alertmanager | 静默/告警管理 | `silences:write`, `alerts:read` |

## 7. 升级路径

1. **Week 1**：默认 OIDC，secret 保留作 fallback
2. **Week 2**：监控 fallback 触发频率，排查 vault 问题
3. **Week 3**：所有 workflow 跑通 OIDC，删 `PHASE8_DRILL_*` long-lived secret
4. **Week 4+**：TTL 缩短到 15min，加 rate limit
