<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-->

# 生产管理员密码轮换 Runbook

适用：生产环境管理员账号（`username=admin`）登录失败、忘记密码、或定期轮换场景。
本文实测于 2026-11-13，生产库 `ihui_dev`。

---

## 0. 背景：admin 账号特殊在哪

| 特性 | 说明 |
|---|---|
| 创建方式 | `0067_system_admin.sql` migration，初始化密码为 `admin123`（bcrypt） |
| 密码轮换历史 | `0071_restore_admin_immutability.sql` 重置为正确的 `admin123` 哈希 |
| 不可变保护 | `users_system_admin_immutable_update` 触发器，**禁止任何字段修改**（含 `password_hash`） |
| 密码哈希算法 | argon2id（`$argon2` 前缀，97 字符），非原始的 bcrypt |
| 初始占位 phone/email | `13000000000` / `admin@ihui.local`，生产部署后**必须**用本 runbook 改成真实值 |

> 注意：admin123 是 migration 写死的开发/CI 默认密码，生产环境部署后**必须立即轮换**。

---

## 1. 诊断：登录失败时先做什么

```bash
# 1. 查 admin 账号当前状态（不修改任何数据）
PGPASSWORD=<DB_PASSWORD> psql -h <DB_HOST> -p <DB_PORT> -U ihui -d ihui_dev \
  -c "SELECT username, status, role_id, is_system_admin,
      left(password_hash,7) AS hash_alg,
      length(password_hash) AS hash_len,
      updated_at
      FROM users WHERE username='admin';"
```

期望输出示例：
```
 username | status | role_id | is_system_admin | hash_alg | hash_len |       updated_at
----------+--------+---------+-----------------+----------+----------+---------------------------
 admin    |      1 |       1 | t               | $argon2  |       97 | 2026-10-30 06:39:21.316+08
```

**判据**：
- `status=1`：账号正常启用；`status≠1`：被禁用，需另行处理
- `hash_alg=$argon2`：密码已被轮换过，**不是** admin123
- `hash_len=97`：argon2id 格式（若 `60` 则是旧 bcrypt）
- `updated_at`：最后修改时间，对应密码轮换时间点

### 1.1 检查最近登录失败记录

```bash
PGPASSWORD=<DB_PASSWORD> psql -h <DB_HOST> -p <DB_PORT> -U ihui -d ihui_dev \
  -c "SELECT login_name, ipaddr, status, msg, login_time
      FROM sys_logininfor WHERE login_name='admin'
      ORDER BY login_time DESC LIMIT 10;"
```

`status=0` + `msg=登录成功` = 历史有成功记录；全 `status=1` + `msg=密码错误` = 密码被改过或记错。

### 1.2 检查账号锁定（account-lockout 服务）——登录报"fetch failed"最常见真因

**症状**：密码确认正确，但登录仍失败，或前端报 `fetch failed` / `operation was aborted`。
**真因**：多次失败触发 account-lockout，账号被锁（Redis key 存在即锁定中）。

```bash
# 查锁定状态(关键:这两个 key 存在=账号被锁)
redis-cli -h 127.0.0.1 -p 8811 get  "lock:login:admin"   # 1=锁定中
redis-cli -h 127.0.0.1 -p 8811 ttl  "lock:login:admin"   # 剩余锁定秒数(默认 900=15分钟)
redis-cli -h 127.0.0.1 -p 8811 get  "fail:login:admin"   # 失败计数
redis-cli -h 127.0.0.1 -p 8811 ttl  "fail:login:admin"

# 立即解锁(实测有效,2026-11-13)
redis-cli -h 127.0.0.1 -p 8811 del "lock:login:admin" "fail:login:admin"
# 期望输出 2(删掉 2 个 key),清完 exists 返回 0
```

> account-lockout 配置：`LOCK_DURATION_SEC = 15 * 60`（锁 15 分钟），连续 5 次失败触发。
> 清锁**不需要重启服务**，删 Redis key 后下一个请求立即恢复。
> 注意区分：429 是 Fastify 限流（`max:5/分钟`，短暂），锁定是 account-lockout（`lock:*`，15 分钟）——前者等一分钟自愈，后者需清 `lock:*` key 或等 15 分钟。

---

## 2. 重置密码（唯一合法途径）

### 2.1 前置条件

- 有生产机 SSH 或本机 shell 访问权
- `apps/api/.env` 或根 `.env` 里 `DATABASE_URL` / `DATABASE_APP_URL` 指向生产库
- `NODE_ENV` 明确是 `production` 或需要显式加 `--force`

### 2.2 执行命令

```bash
cd <项目根目录>

# 方式 A：随机生成 24 位强密码（推荐，会打印到 stdout）
NODE_ENV=production pnpm --filter @ihui/api reset:admin-password \
  --account admin --generate --yes --force

# 方式 B：指定密码（密码会出现在命令行历史里，建议用完清 history）
NODE_ENV=production pnpm --filter @ihui/api reset-admin-password \
  --account admin --password '<你的密码>' --yes --force
```

脚本会自动处理不可变触发器（`DISABLE TRIGGER → UPDATE → ENABLE TRIGGER`）。

**输出确认**：
```
[reset-admin-password] 成功 ✓
  username: admin
  email:    <真实邮箱或空>
```

### 2.3 验证登录

```bash
curl -s -X POST http://127.0.0.1:<API_PORT>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"<新密码>"}' | jq '.code, .message'
# 期望: 0, "success"
```

或直接在浏览器登录后台，确认进入管理界面。

---

## 3. 安全注意事项

### 3.1 生产机本地密钥纪律

> **规则（2026-11-13 机主明令）：生产机密钥明文只允许在本地 `.env`，不允许上云、不允许上仓库。**

- `.env` / `apps/api/.env` 真实内容**只存在于生产机本地**
- `.gitignore` 已排除 `.env`，git 只跟踪 `.env.example`（不含明文）
- 百度网盘密钥库是**备份用途**，不是运行时读取源
- 支付密钥 `WX_PAY_V3_KEY` 等真实值：生产机 `.env` 里有生效副本即可，**不要提交、不要同步到其他云**

### 3.2 密码强度要求

| 场景 | 最低要求 |
|---|---|
| 注册/改密接口（Zod 校验） | ≥8 位 |
| admin 生产密码（推荐） | ≥12 位，含大小写+数字+符号 |

密码与 `.env` 中其他密钥（如 `WX_PAY_V3_KEY`）**不应重复**，避免一处泄露波及管理员账号。

### 3.3 Turnstile 人机验证

`.env` 里 `TURNSTILE_SECRET_KEY` 配置了值时，登录接口**要求带 token**。
前端（`apps/web`）需同步配 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`，否则浏览器不渲染验证框。

当前状态（2026-11-13）：**前端未配 site key** → Turnstile 实际不生效，浏览器登录无需过验证。

若后续启用 Turnstile：
1. 前端配 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
2. 服务端确认 `TURNSTILE_SECRET_KEY` 非空
3. 重启 API，前端用户登录时需过 Cloudflare Turnstile 挑战

### 3.4 2FA（两步验证）

admin 账号曾启用过 2FA（`two_factor_enabled`），2026-11-13 已通过绕过触发器方式禁用。
`two_factor_secret` 仍保留在数据库（`secretRetained=true`），可随时重新启用而无需重新注册。

**重新启用 2FA**：admin 登录后台 → 个人安全设置 → 启用两步验证 → 扫码。

---

## 4. 应急：SQL 直改（仅当脚本不可用时）

```sql
-- ⚠️ 危险操作，仅在 reset-admin-password 脚本无法执行时使用
-- 1. 禁用触发器
ALTER TABLE users DISABLE TRIGGER users_system_admin_immutable_update;
-- 2. 用应用层生成的 argon2id hash 更新（不要手写 SQL 造 hash，必须用 hashPassword() 生成）
UPDATE users SET password_hash = '<argon2id_hash>' WHERE username = 'admin';
-- 3. 立即恢复触发器
ALTER TABLE users ENABLE TRIGGER users_system_admin_immutable_update;
```

**严禁遗漏第 3 步**——触发器禁用态若未恢复，任何应用层 UPDATE 都会绕过保护。

---

## 5. 常见问题

| 症状 | 原因 | 处理 |
|---|---|---|
| **登录 `code=0` 成功，但所有 `/api/admin/*` 返回 403「必须开启 TOTP」** | **`ADMIN_TOTP_MODE=enforce` 且 admin 未绑 TOTP** | 改生产 `apps/api/.env` 的 `ADMIN_TOTP_MODE=warn` → 重启 `IHUI-API-GREEN` |
| **绑 TOTP 时 setup/verify 报 500** | **admin 是 system admin，触发器禁止改 `two_factor_*`（只放行 `password_hash`）** | 这与 enforce 档构成死锁；解法见上（降 warn 档），不要试图强改触发器 |
| **前端报 `fetch failed` / `operation was aborted`，但密码正确** | **admin 被 account-lockout 锁定（Redis `lock:login:admin`=1）** | **清锁：`redis-cli del lock:login:admin fail:login:admin`，立即恢复，无需重启** |
| 登录返回 401，密码正确 | 账号被 account-lockout 锁定 | 等 15 分钟 TTL 过期或按上一行清 Redis `lock:*` |
| 登录返回 403，"人机验证失败" | Turnstile 启用但未传 token | 前端配 site key 或临时注释 `TURNSTILE_SECRET_KEY` 后重启 |
| `reset:admin-password` 报触发器拒绝 | 触发器正常工作 | 脚本会自动走 DISABLE/ENABLE 降级路径，无需人工干预 |
| 脚本报"生产环境"拒绝 | `NODE_ENV=production` 且缺 `--force` | 加 `--force` |
| 脚本报"用户未确认" | 缺 `--yes` | 加 `--yes` |

---

## 5.1 专题：admin 登录后进不去后台（TOTP 死锁）

这是最隐蔽的坑，2026-11-13 生产实测踩到。三个症状叠加时会误判成"登录系统坏了"。

### 死锁链条

```
ADMIN_TOTP_MODE=enforce（安全默认档）
  → 所有 /api/admin/* 要求 admin 已绑 TOTP，否则 403
    → admin 是 system admin，触发器 users_block_system_admin_modify 只放行 password_hash
      → /auth/2fa/setup 要写 two_factor_secret → 触发器 500
        → admin 永远绑不上 TOTP → 永远进不了后台 🔒
```

### 诊断三步

```bash
# 1) 确认登录本身 OK（排除密码/锁定问题）
redis-cli -h 127.0.0.1 -p 8811 del lock:login:admin fail:login:admin  # 先清锁
# 用正确密码登录拿 token（返回 code=0 + accessToken）

# 2) 确认 admin 面被 TOTP 闸拦住
curl -s http://127.0.0.1:8802/api/admin/users \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: <TENANT_ID>"
# 返回 403 "管理员账号必须开启 TOTP 二次验证" = 命中本死锁

# 3) 确认触发器拦 2FA 写入（setup 报 500 的根因）
PGPASSWORD=<pw> psql ... -c "UPDATE users SET two_factor_secret=decode('aa','hex') WHERE username='admin';"
# 报 "system admin is immutable: only password_hash can be changed" = 确认
```

### 解法（机主 2026-11-13 定档：暂不强制 2FA）

改**生产** `apps/api/.env`（注意：生产真身在 `D:\DevEnv\ihui-prod`，不是开发仓 `D:\IHUI-AI`）：

```ini
# 机主定档:admin 暂不强制 2FA,warn=未绑 TOTP 放行+仅告警
# 机主以后可在管理后台「设置→安全」自行绑定,绑好后删掉本行即回 enforce
ADMIN_TOTP_MODE=warn
```

然后重启**正确的**服务（蓝绿部署，别重启错）：

```bash
nssm restart IHUI-API-GREEN   # 真正跑 apps/api 的服务（Running 那个）
# 不要重启 IHUI-AI-SERVICE（无关聚合服务，重启不换 API 进程）
```

验证：

```bash
# 等 API 起来（重启后 502 → 探到 401 即就绪），再打 admin 面
curl -s http://127.0.0.1:8802/api/admin/users -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: <TID>"
# 返回 200 = 解锁成功
```

### 三档语义

| 档位 | 行为 | 适用 |
|---|---|---|
| `off` | 完全不查 TOTP 绑定态 | 完全信任环境（不推荐生产） |
| `warn` | 未绑 TOTP 放行 + 记 `admin_totp_unbound` 告警 | 过渡期 / 机主暂不启用 2FA |
| `enforce` | 未绑 TOTP 访问 admin 面 → 403 | 生产默认，绑定后应回到此档 |

> 恢复 enforce 的正确姿势：在管理后台「设置→安全」绑定 TOTP（warn 档下能正常绑定），
> 绑定成功后删掉 env 里 `ADMIN_TOTP_MODE=warn` 那行 → 重启 `IHUI-API-GREEN`。
> 这样既不碰触发器，也不长期裸奔。

---

## 6. 密钥轮换 checklist（生产机操作后逐项勾选）

- [ ] admin 密码已重置，旧密码失效
- [ ] curl 或浏览器实测登录通过（`code=0`）
- [ ] 确认 `.env` / `apps/api/.env` 真实值未提交（`git status` 无 `.env` 变更）
- [ ] 密码未与 `.env` 中其他密钥重复
- [ ] 若改了支付密钥，重启 API 后实测微信支付回调正常
- [ ] 安全日志记录本次操作（`sys_logininfor` 会有痕迹）
