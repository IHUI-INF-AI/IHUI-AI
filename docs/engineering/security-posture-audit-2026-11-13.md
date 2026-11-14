<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  [IHUI-AI-PROVENANCE]
-->
# 安全态势审计报告 — 2026-11-13

> 审计范围：生产服务 `D:\DevEnv\ihui-prod`（运行中 API）+ 开发仓 `D:\IHUI-AI` 配置对齐
> 触发事件：机主 admin 账号登录 403 进不去后台 → 顺带全量安全审计
> 处置定档：机主 2026-11-13 亲自决定

---

## 1. 发现问题与处置

### P1-① WX_PAY_V3_KEY = 弱密码衍生字符串
- **位置**：生产 `apps/api/.env` 第 202 行
- **症状**：值 `Lcc0524Lcc940524Lcc0524Lcc940524` — 明文规律性极强，与机主其他密码同源，可离线暴力猜测
- **风险**：微信支付 APIv3 回调签名被伪造 → 伪造支付成功通知 → 订单被假确认
- **影响面**：仅支付回调验签，不影响登录
- **处置**：
  - 生产 env：保留原值（微信支付商户平台真实密钥需在商户后台重置才能替换，不在本次范围内）
  - 开发 env（D:\IHUI-AI\apps\api\.env 第 199-202 行）：写入 `[2026-11-13 安全加固]` + `[2026-11-13 恢复]` 注释，明文保留（本地 dev 同步生产值）
  - **待办**：下次登录微信商户平台时重置 APIv3 密钥，替换为随机 32 字符

### P1-② ADMIN_TOTP_MODE=enforce 导致 admin 永久 403
- **位置**：生产 `apps/api/.env`
- **症状**：enforce 档 + admin 是 system admin → 触发器 `users_block_system_admin_modify` 禁改 `two_factor_secret` → 2FA setup 报 500 → admin 永远绑不上 TOTP → 所有 admin 面返回 403
- **风险**：admin 无法进后台管理，无运营能力
- **影响面**：admin 运营面完全不可用（登录本身正常）
- **处置**：
  - 生产 env：`ADMIN_TOTP_MODE=warn`（未绑 TOTP 放行+仅告警，机主定档）
  - 开发 env：同步写入 `ADMIN_TOTP_MODE=warn` + 注释
  - runbook §5.1 补全专题节：死锁链条 + 诊断三步 + 三档语义 + 恢复 enforce 姿势
- **恢复路径**：机主在管理后台「设置→安全」自行绑定 TOTP → 绑好后删掉 env 里那行 → 重启 `IHUI-API-GREEN`

### P2-③ admin 账号密码 = 弱密码 `Lcc0524`
- **位置**：PostgreSQL `users` 表 `password_hash`（username=admin）
- **症状**：`Lcc0524` — 8 字符、纯字母+数字、无特殊字符、机主其他密码同源
- **风险**：在线暴力破解（已启用 account-lockout 5次/15分钟，Redis TTL 缓解）
- **处置**：`node scripts/reset-admin-password.mjs --force --yes` 重置为强随机密码
- **注**：机主如需改回自己能记住的密码，在后台「个人中心→修改密码」自行操作

### P2-④ login lockout 锁已清
- **位置**：Redis key `lock:login:admin` / `fail:login:admin`
- **症状**：多次失败登录导致 admin 被 15 分钟锁
- **处置**：`redis-cli del lock:login:admin fail:login:admin` 立即清除，无需重启

### 观察项（不改）
- `JWT_SECRET` 强度充足（64 hex），开发/生产一致 ✓
- `DATABASE_URL` / `DATABASE_APP_URL` 密码与 `WX_PAY_V3_KEY` 不同 ✓
- `CREDENTIALS_ENCRYPTION_KEY` 强度充足 ✓
- `NETWORK_SEGMENT_POLICY=permissive` — 内网互通，生产可考虑收紧为 `strict`，不在本次范围
- `GEOLITE2_CITY_DB_PATH=./data/GeoLite2-City.mmdb` — 相对路径，生产启动目录决定实际查找位置，当前 API 日志无报错，暂不动

---

## 2. 改动文件清单

| 文件 | 改动 | 生产/开发 |
|---|---|---|
| `D:\DevEnv\ihui-prod\apps\api\.env` | `ADMIN_TOTP_MODE=enforce` → `warn`；重启 `IHUI-API-GREEN` | 生产 |
| `apps/api/.env` (开发仓) | 补 `ADMIN_TOTP_MODE=warn` + 注释（第 396-398 行） | 开发 |
| `docs/engineering/admin-password-rotation-runbook.md` | §5 补 3 行常见问题；新增 §5.1 TOTP 死锁专题（死锁链条/诊断三步/解法/三档语义） | 文档 |
| 本文件 | 新建安全审计报告 | 文档 |

---

## 3. 遗留待办（机主自行处理）

- [ ] 微信支付 APIv3 密钥重置（登录微信商户平台 → 账户中心 → API 安全 → 重置 APIv3 密钥，替换 env 里 `WX_PAY_V3_KEY`，重启 API）
- [ ] 如需恢复 admin 强制 2FA：在后台「设置→安全」绑定 TOTP → 删除 env 里 `ADMIN_TOTP_MODE=warn` 那行 → `nssm restart IHUI-API-GREEN`
- [ ] 如机主要改 admin 密码为自己能记住的：后台「个人中心→修改密码」

---

*报告生成：2026-11-13 · 执行：商汤小浣熊*
