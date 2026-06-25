# 密钥轮换操作 Runbook

> **来源**: 历史项目 `H:\历史项目存档` 整合后发现多个密钥以明文存储, 强烈建议生产环境轮换.
> **创建日期**: 2026-06-25
> **执行人**: 项目 Owner + 2 名运维负责人
> **原则**: 一次一类, 滚动执行, 每步验证, 全程审计

---

## 0. 轮换总览（按优先级）

| 优先级 | 密钥类型 | 数量 | 影响范围 | 预计中断 | 是否阻塞封版 |
|---|---|---|---|---|---|
| 🔴 P0-1 | JKS 证书密码 | 2 (jwt.jks, program.aizhs.top.jks) | Java Gateway/Auth | 0 (滚动) | ⚠️ 部署前必做 |
| 🔴 P0-2 | 智谱 GLM API Key | 1 | LLM 模型 | 0 (env 切换) | ✅ 已自动脱敏 |
| 🟠 P1-1 | 数据库密码 (MySQL) | 2 (root, Raindrop_L) | 全后端 | 短暂 (5 min) | ⚠️ 30 天内 |
| 🟠 P1-2 | 微信 AppSecret | 1 | 小程序登录 | 0 (滚动) | ⚠️ 30 天内 |
| 🟠 P1-3 | 微信 APIv3 Key | 1 | 微信支付 | 0 (滚动) | ⚠️ 30 天内 |
| 🟠 P1-4 | 支付宝应用公钥 | 1 | 支付宝支付 | 0 (滚动) | ⚠️ 30 天内 |
| 🟡 P2-1 | 17 个 AI 厂商 API Key | 17 | LLM/图像/语音 | 0 (单 key 切换) | 🟢 90 天内 |
| 🟡 P2-2 | Redis 密码 | 1 | 缓存/会话 | 短暂 (1 min) | 🟢 可选 |
| 🟡 P2-3 | MinIO Access/Secret | 2 | 文件存储 | 0 (滚动) | 🟢 可选 |
| 🟡 P2-4 | Coze OAuth 私钥 | 1 | Coze API | 0 (env 切换) | 🟢 90 天内 |
| 🟢 P3-1 | 钉钉/飞书/企微 Webhook Secret | 3+ | 告警通道 | 0 (滚动) | 🟢 任意时间 |

---

## 1. JKS 证书密码轮换（部署到生产前必做）

> ⚠️ **JKS 私钥密码无法重置** — 若怀疑泄露, 必须重新生成 keystore.

### 1.1 备份原 keystore

```bash
# 在 ssl/ 目录操作
cd ssl/
cp jwt.jks jwt.jks.bak.$(date +%Y%m%d_%H%M%S)
cp program.aizhs.top.jks program.aizhs.top.jks.bak.$(date +%Y%m%d_%H%M%S)
ls -la *.bak.*
```

### 1.2 查看 alias 列表

```bash
keytool -list -keystore jwt.jks -storepass <OLD_STORE_PASS>
# 记录每个 alias 名称, 后续逐个轮换
```

### 1.3 轮换 jwt.jks 的 key 密码（每个 alias）

```bash
for ALIAS in $(keytool -list -keystore jwt.jks -storepass <OLD_STORE_PASS> | grep "PrivateKeyEntry\|trustedCertEntry" | awk '{print $1}'); do
    echo "Rotating alias: $ALIAS"
    keytool -keypasswd \
        -alias "$ALIAS" \
        -keystore jwt.jks \
        -storepass <OLD_STORE_PASS> \
        -keypass <OLD_KEY_PASS> \
        -new <NEW_KEY_PASS>
done
```

### 1.4 轮换 jwt.jks 的 store 密码

```bash
keytool -storepasswd \
    -keystore jwt.jks \
    -storepass <OLD_STORE_PASS> \
    -new <NEW_STORE_PASS>
```

### 1.5 对 program.aizhs.top.jks 重复 1.3-1.4

### 1.6 验证

```bash
keytool -list -keystore jwt.jks -storepass <NEW_STORE_PASS>
keytool -list -keystore program.aizhs.top.jks -storepass <NEW_STORE_PASS>
```

### 1.7 部署到生产

```bash
scp jwt.jks root@<PROD_HOST>:/ai_zhs/cert/jwt.jks
scp program.aizhs.top.jks root@<PROD_HOST>:/ai_zhs/cert/program.aizhs.top.jks

# 在生产服务器上
ssh root@<PROD_HOST> "chmod 600 /ai_zhs/cert/*.jks && chown app:app /ai_zhs/cert/*.jks"
```

### 1.8 更新 Java 应用配置

```yaml
# application.yml (Java Gateway/Auth)
server:
  ssl:
    key-store: classpath:program.aizhs.top.jks
    key-store-password: <NEW_STORE_PASS>  # 改这里
    key-password: <NEW_KEY_PASS>          # 改这里
    key-alias: <alias>
```

### 1.9 同步密码到本地文档

更新 `docs/PRODUCTION_CREDENTIALS.md` 第九节:
```markdown
| `jwt.jks` 密码 (新) | `<NEW_KEY_PASS>` (2026-06-25 轮换) |
| `program.aizhs.top.jks` 密码 (新) | `<NEW_KEY_PASS>` (2026-06-25 轮换) |
| `program.aizhs.top.jks` storepass (新) | `<NEW_STORE_PASS>` (2026-06-25 轮换) |
```

### 1.10 同步到阿里云 KMS

```bash
# 安装 aliyun-cli 后
aliyun kms CreateSecret \
    --SecretName jks-jwt-key-pass \
    --SecretData "<NEW_KEY_PASS>" \
    --Description "JWT JKS key password - rotated 2026-06-25"

aliyun kms CreateSecret \
    --SecretName jwt-jks-store-pass \
    --SecretData "<NEW_STORE_PASS>" \
    --Description "JWT JKS store password - rotated 2026-06-25"
```

---

## 2. 智谱 GLM API Key 轮换

### 2.1 在智谱控制台生成新 Key

1. 登录 https://open.bigmodel.cn/
2. 控制台 → API Keys → 创建新 Key
3. 记录新 Key (格式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.xxxxxx`)
4. 给新 Key 限定 IP 白名单 (生产服务器 IP)

### 2.2 在生产服务器更新 .env.production

```bash
ssh root@<PROD_HOST>
vi /ai_zhs/.env.production
# 修改 ZHIPU_API_KEY=<NEW_KEY>
# 修改 GLM_API_KEY=<NEW_KEY>  (兼容字段)
systemctl restart ihui-ai-backend
```

### 2.3 验证

```bash
# 在生产服务器
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
    -H "Authorization: Bearer <NEW_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"model":"glm-4-flash","messages":[{"role":"user","content":"ping"}]}'
# 期望返回 200 + 响应内容
```

### 2.4 撤销旧 Key

- 智谱控制台 → API Keys → 旧 Key → 删除
- 删除后保留 7 天观察期, 确认无调用后彻底删除

### 2.5 数据库中如果有 access_key 字段, 同步更新

```sql
-- 仅当数据库中存储了 access_key (参考 zhs_ai_model_info_unify 表)
UPDATE zhs_ai_model_info_unify
SET access_key = '<NEW_KEY>'
WHERE manufacturer = 'zhipu';
```

---

## 3. 数据库密码轮换

### 3.1 备份

```bash
mysqldump -h <DB_HOST> -u root -p<OLD_PASS> --all-databases > /backup/db_$(date +%Y%m%d).sql
```

### 3.2 轮换 root 密码

```sql
-- MySQL 5.7+
ALTER USER 'root'@'%' IDENTIFIED BY '<NEW_ROOT_PASS>';
FLUSH PRIVILEGES;
```

### 3.3 轮换 Raindrop_L 密码

```sql
ALTER USER 'Raindrop_L'@'%' IDENTIFIED BY '<NEW_RAINPASS>';
FLUSH PRIVILEGES;
```

### 3.4 更新应用配置

```bash
# 在生产服务器
vi /ai_zhs/.env.production
# 修改 DB1_URL 中的密码
systemctl restart ihui-ai-backend
```

### 3.5 验证

```bash
mysql -h <DB_HOST> -u Raindrop_L -p<NEW_RAINPASS> -e "SHOW DATABASES;"
```

---

## 4. 微信生态密钥轮换

### 4.1 微信小程序 AppSecret

1. 登录 https://mp.weixin.qq.com/
2. 开发 → 开发管理 → 开发设置 → AppSecret → 重置
3. 记录新 Secret (32 位十六进制)
4. 更新 `.env.production`:
   ```bash
   WX_MINI_SECRET=<NEW_SECRET>
   ```
5. 重启后端

### 4.2 微信支付 APIv3 Key

1. 登录 https://pay.weixin.qq.com/
2. 账户中心 → API 安全 → APIv3 密钥 → 重置
3. 记录新 Key (32 位)
4. 更新 `.env.production`:
   ```bash
   WX_PAY_V3_KEY=<NEW_KEY>
   ```
5. 重启后端

### 4.3 微信支付证书

如果需要轮换 (证书泄露):
1. 商户平台 → 账户中心 → API 证书 → 申请新证书
2. 下载新证书 (apiclient_cert.pem + apiclient_key.pem)
3. 记录新证书序列号
4. 部署到 `/ai_zhs/cert/`
5. 更新 `.env.production`:
   ```bash
   WX_PAY_CERT_SERIAL=<NEW_SERIAL>
   ```

---

## 5. 支付宝密钥管理

### 5.1 ⚠️ 重要: 支付宝应用私钥**不可重新生成**

**当前私钥** (`ssl/appSecretRSA2048.txt`) 一旦丢失, 整个支付宝应用必须重新创建, 历史交易无法解密.

### 5.2 永久备份清单

| 备份位置 | 状态 | 备份人 |
|---|---|---|
| U 盘 1 (主) | ⬜ 待执行 | Owner |
| U 盘 2 (异地) | ⬜ 待执行 | 运维 A |
| 1Password (团队) | ⬜ 待执行 | Owner |
| 阿里云 KMS | ⬜ 待执行 | Owner |
| 纸质 (保险箱) | ⬜ 待执行 | Owner |

### 5.3 备份执行步骤

```bash
# 1. 拷贝到 U 盘
cp ssl/appSecretRSA2048.txt /media/usb1/
cp ssl/alipayPublicKey_RSA2.txt /media/usb1/

# 2. 拷贝到 U 盘 2 (异地)
cp ssl/appSecretRSA2048.txt /media/usb2/

# 3. 上传到阿里云 KMS
aliyun kms CreateSecret \
    --SecretName alipay-app-private-key \
    --SecretData "$(cat ssl/appSecretRSA2048.txt)" \
    --Description "Alipay app private key (RSA 2048) - PERMANENT"

# 4. 1Password 团队库手动上传 (拖入 Vault)
# 5. 打印纸质 + 编号 + 放入保险箱
```

### 5.4 支付宝公钥轮换 (可选)

如果启用"公钥证书模式":
1. 登录支付宝开放平台
2. 我的应用 → 应用信息 → 接口加密方式 → 升级为"公钥证书"
3. 下载新公钥证书 (alipayCertPublicKey_RSA2.crt)
4. 部署到 `/ai_zhs/cert/alipayCertPublicKey_RSA2.crt`
5. 更新 `.env.production`:
   ```bash
   ALIPAY_PUBLIC_KEY_PATH=/ai_zhs/cert/alipayCertPublicKey_RSA2.crt
   ALIPAY_SIGN_TYPE=RSA2
   ```

---

## 6. 17 个 AI 厂商 API Key 轮换

### 6.1 厂商清单

| 厂商 | 控制台 URL | 轮换复杂度 |
|---|---|---|
| DashScope (通义千问) | https://dashscope.console.aliyun.com/ | 🟢 简单 |
| 智谱 GLM | https://open.bigmodel.cn/ | 🟢 简单 (见 §2) |
| 豆包 (火山引擎) | https://www.volcengine.com/ | 🟡 中等 (需新建应用) |
| DeepSeek | https://platform.deepseek.com/ | 🟢 简单 |
| 可灵 AI | https://klingai.kuaishou.com/ | 🟢 简单 |
| OpenRouter | https://openrouter.ai/ | 🟢 简单 |
| Luyala | https://luyala.com/ | 🟡 中等 |
| 腾讯云混元 | https://console.cloud.tencent.com/ | 🟡 中等 |
| 百度智能云 | https://console.bce.baidu.com/ | 🟡 中等 |
| Suno | https://suno.com/ | 🟢 简单 |
| Sora2 | https://openai.com/ | 🟡 中等 |
| Gemini | https://ai.google.dev/ | 🟢 简单 |
| 百炼 (阿里) | https://bailian.console.aliyun.com/ | 🟢 简单 |
| 火山语音 | https://www.volcengine.com/ | 🟡 中等 |
| 即梦 (火山) | https://www.volcengine.com/ | 🟡 中等 |
| 腾讯云 (通用) | https://console.cloud.tencent.com/ | 🟡 中等 |
| n8n | https://n8n.io/ | 🟢 简单 |

### 6.2 统一轮换脚本 (示例: DashScope)

```bash
# 1. 在控制台生成新 Key
# 2. 更新 .env.production
sed -i 's/^DASHSCOPE_API_KEY=.*/DASHSCOPE_API_KEY=<NEW_KEY>/' /ai_zhs/.env.production
# 3. 重启
systemctl restart ihui-ai-backend
# 4. 验证
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
    -H "Authorization: Bearer <NEW_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"model":"qwen-turbo","input":{"messages":[{"role":"user","content":"ping"}]}}'
# 5. 撤销旧 Key
```

### 6.3 批量轮换顺序 (从低风险到高风险)

1. Luyala → n8n → OpenRouter (低频使用)
2. DeepSeek → DashScope → 智谱 (中等频率)
3. 可灵 → 豆包 → 即梦 → 火山语音 (图像/视频生成)
4. 腾讯云 → 百度云 → 百炼 → Suno → Sora2 → Gemini

---

## 7. Redis 密码轮换

```bash
# 1. 在 redis.conf 设置新密码
echo "requirepass <NEW_REDIS_PASSWORD>" >> /etc/redis/redis.conf

# 2. 重启 Redis
systemctl restart redis

# 3. 验证
redis-cli -a <NEW_REDIS_PASSWORD> ping

# 4. 更新应用配置
sed -i 's|^REDIS_PASSWORD=.*|REDIS_PASSWORD=<NEW_REDIS_PASSWORD>|' /ai_zhs/.env.production
systemctl restart ihui-ai-backend

# 5. 观察 30 分钟, 确认无错误日志
```

---

## 8. MinIO 凭证轮换

```bash
# 1. 创建新用户
mc admin user add myminio <NEW_USER> <NEW_PASSWORD>

# 2. 赋予权限
mc admin policy attach myminio readwrite --user <NEW_USER>

# 3. 验证
mc alias set myminio https://minio.<DOMAIN> <NEW_USER> <NEW_PASSWORD>
mc ls myminio/

# 4. 更新应用配置
sed -i 's|^MINIO_ACCESS_KEY=.*|MINIO_ACCESS_KEY=<NEW_USER>|' /ai_zhs/.env.production
sed -i 's|^MINIO_SECRET_KEY=.*|MINIO_SECRET_KEY=<NEW_PASSWORD>|' /ai_zhs/.env.production
systemctl restart ihui-ai-backend

# 5. 删除旧用户 (保留 7 天观察期)
mc admin user remove myminio <OLD_USER>
```

---

## 9. Coze OAuth 私钥轮换

```bash
# 1. 在 Coze 控制台生成新 RSA 密钥对
#    https://www.coze.cn/open/oauth2

# 2. 导出新私钥
coze-cli oauth export > new_coze_private.pem

# 3. 部署到生产 (从 env 字符串读取, 不落盘)
echo "COZE_PRIVATE_KEY=\"$(cat new_coze_private.pem)\"" >> /ai_zhs/.env.production
echo "COZE_PUBLIC_KEY_ID=<NEW_PUBLIC_KEY_ID>" >> /ai_zhs/.env.production

# 4. 重启
systemctl restart ihui-ai-backend

# 5. 验证
curl -X POST https://api.coze.cn/api/permission/oauth2/token \
    -d "client_id=<CLIENT_ID>" \
    -d "grant_type=client_credentials"

# 6. 撤销旧密钥
#    Coze 控制台 → OAuth → 删除旧公钥
```

---

## 10. 告警通道 Webhook Secret 轮换

### 10.1 钉钉

1. 钉钉群 → 群设置 → 智能群助手 → 添加机器人 → 自定义
2. 勾选"加签", 获取新 Secret
3. 更新 `.env.production`:
   ```bash
   DINGTALK_SECRET=<NEW_SECRET>
   ```

### 10.2 飞书 / 企业微信

类似流程, 更新对应 Webhook + Secret.

---

## 11. 轮换审计与回滚

### 11.1 轮换审计

每完成一次轮换, 记录到 `docs/PRODUCTION_CREDENTIALS.md` 第十五节:

```markdown
| 2026-06-25 | JKS 证书密码轮换 (P0-1) | Owner |
| 2026-06-25 | 智谱 GLM API Key 轮换 (P0-2) | Owner |
| 2026-07-15 | 数据库密码轮换 (P1-1) | 运维 A |
```

### 11.2 回滚流程

如果新凭证导致故障:

```bash
# 1. 立即回滚 .env.production
git diff HEAD~1 -- .env.production.example  # 查看模板变更
# 手动恢复旧值

# 2. 重启
systemctl restart ihui-ai-backend

# 3. 验证
curl -I https://<DOMAIN>/health
```

### 11.3 故障树

| 症状 | 可能原因 | 解决 |
|---|---|---|
| 后端 502 | DB 密码错 | 检查 DB1_URL, 回滚密码 |
| 微信支付失败 | APIv3 Key 错 | 检查 WX_PAY_V3_KEY, 回滚 |
| 支付宝 400 | 私钥损坏 | 从 U 盘恢复 appSecretRSA2048.txt |
| LLM 401 | API Key 失效 | 检查厂商控制台, 回滚 |
| 钉钉告警失败 | Webhook Secret 错 | 重新生成 |

---

## 12. 验证脚本

### 12.1 单项验证

```bash
# 数据库
mysql -h <HOST> -u <USER> -p<PASS> -e "SELECT 1;"

# Redis
redis-cli -a <PASS> ping

# 微信支付
curl -X POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi \
    -H "Content-Type: application/json" \
    -d '{}'  # 期望 400 (签名错), 但说明 API 可达

# 智谱 GLM
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
    -H "Authorization: Bearer <KEY>" \
    -H "Content-Type: application/json" \
    -d '{"model":"glm-4-flash","messages":[{"role":"user","content":"ping"}]}'
```

### 12.2 全量健康检查

```bash
# 部署后端后
curl -s https://<DOMAIN>/health | jq .

# 期望返回:
# {
#   "status": "ok",
#   "db": "ok",
#   "redis": "ok",
#   "minio": "ok",
#   "coze": "ok"
# }
```

---

## 13. 检查清单 (执行时勾选)

- [ ] P0-1 JKS 证书密码轮换完成
  - [ ] jwt.jks 备份
  - [ ] key 密码轮换
  - [ ] store 密码轮换
  - [ ] program.aizhs.top.jks 备份
  - [ ] 部署到生产
  - [ ] Java 应用配置更新
  - [ ] KMS 同步
  - [ ] 本地文档更新
- [ ] P0-2 智谱 GLM API Key 轮换
- [ ] P1-1 数据库密码
- [ ] P1-2 微信 AppSecret
- [ ] P1-3 微信 APIv3 Key
- [ ] P1-4 支付宝公钥
- [ ] P2-1 17 个 AI 厂商
- [ ] P2-2 Redis
- [ ] P2-3 MinIO
- [ ] P2-4 Coze OAuth
- [ ] P3-1 告警通道
- [ ] 第十五节审计记录更新
- [ ] 1Password / KMS 同步
- [ ] 1 周观察期无异常

---

**关联文档**:
- `docs/PRODUCTION_CREDENTIALS.md` — 真实凭证库（gitignored）
- `docs/PRODUCTION_INFRASTRUCTURE.md` — 服务器/域名/证书清单
- `docs/INTEGRATION_DELIVERY_REPORT.md` — 历史项目整合报告
- `server/scripts/verify_legacy_integration.py` — 整合验证
- `server/scripts/audit_plaintext_credentials.py` — 凭证审计

---

## 14. 补充凭证清单（2026-06-26 封版前扫描发现）

> 本节由 `server/.env` + `server/.env.production` + `client/.env*` + `server/.env.vapid` + 根目录 `.env` 全量扫描得出, 补充第 0-13 节未覆盖的字段.
> **掩码规则**: 仅显示前 4 位 + `***`, 完整值见 `PRODUCTION_CREDENTIALS.md`.

### 14.1 P0 必改（部署前阻塞, 明文/dev 默认值流入生产将导致严重安全风险）

| 字段 | 当前值（掩码） | 文件 | 风险 | 轮换动作 |
|---|---|---|---|---|
| `JWT_SECRET_KEY` (dev) | `zhs-p***` | `server/.env` | dev 弱密钥, 若误用生产可伪造任意 JWT | 生产必须用 `server/.env.production` 中的 64 位随机值; 确保 dev 值不外泄 |
| `SESSION_SECRET_KEY` (dev) | `zhs_p***` | `server/.env` | 同上 | 同上 |
| `INTERNAL_AUTH_KEY` | `dev-i***` | `server/.env` | dev 占位, 标注 "change-in-production" | 生产替换为 32+ 位随机串 |
| `TBOX_NOTIFY_SECRET` | `dev-t***` | `server/.env` | dev 占位, 标注 "change-in-production" | 生产替换为 32+ 位随机串 |
| `SEED_ADMIN_PWD` | `Admin***` | `server/.env` | 种子管理员密码, 部署后必须立即改 | 首次登录后强制改密 + 删除 env |
| `SEED_RY_PWD` | `Ry@20***` | `server/.env` | 同上 | 同上 |
| `VITE_ENCRYPTION_KEY` (dev) | `ihui-***` | `client/.env` | 前端加密 key 弱密钥, 可解密本地缓存 | 生产用 `client/.env.production` 中的 64 位 hex |
| `DINGTALK_SECRET` (dev) | `test_***` | `server/.env` | dev 占位 | 生产替换为真实钉钉机器人 secret |
| `PAGERDUTY_ROUTING_KEY` (dev) | `mock-***` | `server/.env` | dev 占位 | 生产替换或留空（如未启用 PagerDuty） |
| `VAPID_PRIVATE_KEY` | `PKYI***` | `server/.env.vapid` | Web Push 私钥, 泄露可冒充推送 | 见 §14.4 轮换步骤 |
| `VAPID_PUBLIC_KEY` | `BEiE***` | `server/.env.vapid` | 配对公钥 | 与私钥一起重新生成 |
| `COZE_PRIVATE_KEY` | `-----BEGIN...` | `server/.env` | RSA-2048 私钥内嵌 env, 历史项目已泄露 | 见 §9 (已规划) |
| `WX_PAY_PUB_KEY_ID` | `PUB_K***` | `server/.env.production` | 微信支付公钥 ID | 与微信支付证书绑定, 证书轮换时同步 |
| `WX_PAY_CERT_PASS` | `xmx7***` | `server/.env.production` | 微信支付证书密码 | 重新申请证书时同步改 |

### 14.2 P1 30 天内轮换（生产已配置真实值, 但来源历史项目已视为泄露）

| 字段 | 当前值（掩码） | 文件 | 类别 | 轮换动作 |
|---|---|---|---|---|
| `MINIO_ACCESS_KEY` | `WFEF***` | `server/.env.production` + 根 `.env` | 对象存储 | 见 §8 |
| `MINIO_SECRET_KEY` | `xGpr***` | 同上 | 对象存储 | 见 §8 |
| `REDIS_PASSWORD` | `BfSY***` | 同上 | 缓存/会话 | 见 §7 |
| `DB_PASSWORD` | `N1Zb***` | 根 `.env` | Docker MySQL root | 见 §3 |
| `JWT_SECRET` | `889a***` | 根 `.env` | Docker JWT | 与 `JWT_SECRET_KEY` 同步 |
| `SESSION_SECRET` | `9cd4***` | 根 `.env` | Docker Session | 与 `SESSION_SECRET_KEY` 同步 |
| `NOTIFY_SMTP_PASSWORD` | `eE6B***` | `server/.env.production` | 通知邮箱 SMTP | 登录邮箱服务商重置 |
| `SMTP_PASSWORD` | (空) | `server/.env` | 通用 SMTP | dev 为空, 生产需配置 |
| `SMS_WUXI_CLIENT_ID` | `wuxi` | `server/.env.production` | 无锡短信 | 联系短信服务商重置 |
| `SMS_WUXI_CLIENT_SECRET` | `e1f4***` | `server/.env.production` | 无锡短信 | 同上 |
| `TENCENT_LIVE_SECRET_ID` | `AKID***` | `server/.env.production` | 腾讯云直播 | 腾讯云控制台重置 |
| `TENCENT_LIVE_SECRET_KEY` | `mV0F***` | `server/.env.production` | 腾讯云直播 | 同上 |
| `TENCENT_LIVE_CALLBACK_KEY` | `learn***` | `server/.env.production` | 直播回调签名 | 弱密钥, 替换为 32+ 位随机串 |
| `TENCENT_COS_SECRET_ID` | `AKID***` | `server/.env.production` | 腾讯云 COS | 腾讯云控制台重置 |
| `TENCENT_COS_SECRET_KEY` | `LSN5***` | `server/.env.production` | 腾讯云 COS | 同上 |
| `DASHSCOPE_API_KEY` | `sk-7c***` | `server/.env.production` | 通义千问 | 见 §6 |
| `DOUBAO_API_KEY` | `af6a***` | `server/.env.production` | 豆包 | 见 §6 |
| `DOUBAO_JM_API_KEY` | `AKLT***` | `server/.env.production` | 即梦 | 见 §6 |
| `DOUBAO_JM_SECRET_KEY` | `WVRj***` | `server/.env.production` | 即梦 | 见 §6 |
| `DEEPSEEK_API_KEY` | `sk-af***` | `server/.env.production` | DeepSeek | 见 §6 |
| `KLING_ACCESS_KEY` | `A3CN***` | `server/.env.production` | 可灵 | 见 §6 |
| `KLING_SECRET_KEY` | `FBf8***` | `server/.env.production` | 可灵 | 见 §6 |
| `KLING_ALT_ACCESS_KEY` | `ANmA***` | `server/.env.production` | 可灵备用 | 见 §6 |
| `KLING_ALT_SECRET_KEY` | `yfHL***` | `server/.env.production` | 可灵备用 | 见 §6 |
| `OPENROUTER_API_KEY` | `sk-o***` | `server/.env.production` | OpenRouter | 见 §6 |
| `LUYALA_API_KEY` | `sk-f***` | `server/.env.production` | Luyala | 见 §6 |
| `TENCENT_SECRET_ID` | `AKID***` | `server/.env.production` | 腾讯云通用 | 见 §6 |
| `TENCENT_SECRET_KEY` | `NYd8***` | `server/.env.production` | 腾讯云通用 | 见 §6 |
| `BAIDU_API_KEY` | `bce-***` | `server/.env.production` | 百度智能云 | 见 §6 |
| `BAILIAN_APP_ID` | `c2st***` | `server/.env.production` | 阿里百炼 | 见 §6 |
| `ZHIPU_API_KEY` | `7b07***` | `server/.env` + `.env.production` | 智谱 GLM | 见 §2 (已规划) |
| `WECOM_SECRET` | `DdVz***` | `server/.env` + `.env.production` | 企业微信应用 Secret | 企微管理后台重置 |
| `DINGTALK_APP_SECRET` | `TkSe***` | `server/.env` + `.env.production` | 钉钉应用 Secret | 钉钉开放平台重置 |
| `DINGTALK_LOGIN_APP_SECRET` | `SuOD***` | `server/.env` + `.env.production` | 钉钉登录 Secret | 钉钉开放平台重置 |
| `WX_MINI_SECRET` | `59c2***` | `server/.env.production` | 微信小程序 Secret | 见 §4.1 (已规划) |
| `WX_APP_SECRET` | `ee79***` | `server/.env.production` | 微信 APP Secret | 微信开放平台重置 |
| `ALIPAY_APP_ID` | `2021***` | `server/.env.production` | 支付宝应用 ID | 应用 ID 不可改, 但需确认公钥已轮换 |
| `VOLC_APP_KEY` | `Plgv***` | `server/.env.production` | 火山语音 APP_KEY | 火山引擎控制台重置 |
| `VITE_COZE_WORKFLOW_ID` | `7490***` | `client/.env.production` | Coze workflow ID (非密钥) | 无需轮换, 记录在册 |

### 14.3 P2 可选轮换（dev 为空, 生产未启用, 上线后再配置）

| 字段 | 文件 | 说明 |
|---|---|---|
| `BAIDU_API_KEY` (dev) | `server/.env` | dev 为空 |
| `SUNO_API_KEY` | `server/.env` + `.env.production` | 均为空, 启用时配置 |
| `GEMINI_API_KEY` | `server/.env` + `.env.production` | 均为空 |
| `LANGCHAIN_API_KEY` | `server/.env` + `.env.production` | 均为空 |
| `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | `server/.env` + `.env.production` | 均为空, 用 MinIO 替代 |
| `ALI_SMS_ACCESS_KEY_ID` / `ALI_SMS_ACCESS_KEY_SECRET` | `server/.env` + `.env.production` | 均为空, 用 SMS_WUXI 替代 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_SECRET` | `server/.env` + `.env.production` | 均为空, 启用时配置 |
| `GOOGLE_APP_ID` / `GOOGLE_SECRET` | `server/.env` + `.env.production` | 均为空 |
| `ALI_LOGIN_APP_ID` / `ALI_LOGIN_APP_SECRET` | `server/.env` + `.env.production` | 均为空 |
| `STOCK_ANALYSE_API_TOKEN` | `server/.env` + `.env.production` | 均为空 |
| `ZHS_MONITOR_DINGTALK_SECRET` 等 | `server/.env` + `.env.production` | 均为空 |

### 14.4 VAPID 密钥轮换步骤（Web Push 推送）

```bash
# 1. 安装 web-push CLI (若未安装)
npm install -g web-push

# 2. 生成新 VAPID 密钥对
web-push generate-vapid-keys --json
# 输出:
# {
#   "privateKey": "<NEW_PRIVATE_KEY>",
#   "publicKey": "<NEW_PUBLIC_KEY>"
# }

# 3. 更新 server/.env.vapid
# VAPID_PRIVATE_KEY=<NEW_PRIVATE_KEY>
# VAPID_PUBLIC_KEY=<NEW_PUBLIC_KEY>
# VAPID_SUBJECT=mailto:alert@<DOMAIN>

# 4. 重启后端
systemctl restart ihui-ai-backend

# 5. 验证: 前端重新订阅推送 (旧订阅会失效, 用户需重新授权)
#    在浏览器 console:
#    await navigator.serviceWorker.ready
#    await pushManager.subscribe({userVisibleOnly: true, applicationServerKey: '<NEW_PUBLIC_KEY>'})

# 6. 撤销旧密钥: 删除 server/.env.vapid.bak 备份
```

### 14.5 INTERNAL_AUTH_KEY / TBOX_NOTIFY_SECRET 轮换（服务间鉴权）

```bash
# 1. 生成新密钥 (32 字节随机 hex)
openssl rand -hex 32
# 输出: <NEW_INTERNAL_AUTH_KEY>

# 2. 更新 server/.env.production
sed -i 's|^INTERNAL_AUTH_KEY=.*|INTERNAL_AUTH_KEY=<NEW_INTERNAL_AUTH_KEY>|' /ai_zhs/.env.production
sed -i 's|^TBOX_NOTIFY_SECRET=.*|TBOX_NOTIFY_SECRET=<NEW_TBOX_SECRET>|' /ai_zhs/.env.production

# 3. 同步到 TBOX 服务端 (若部署了 TBOX 通知服务)
# 编辑 TBOX 服务的 .env, 使用相同的 INTERNAL_AUTH_KEY

# 4. 滚动重启所有服务
systemctl restart ihui-ai-backend
systemctl restart tbox-notify  # 若存在
```

### 14.6 SEED 密码处理（首次部署后必做）

```bash
# 1. 首次登录后端管理后台
#    用户名: admin (或 ry)
#    密码: 见 SEED_ADMIN_PWD / SEED_RY_PWD

# 2. 立即修改密码
#    管理后台 → 个人中心 → 修改密码

# 3. 删除 .env 中的 SEED_* 字段 (生产环境)
sed -i '/^SEED_ADMIN_PWD=/d' /ai_zhs/.env.production
sed -i '/^SEED_RY_PWD=/d' /ai_zhs/.env.production

# 4. 重启 (确保密码已持久化到 DB)
systemctl restart ihui-ai-backend

# 5. 验证: 用新密码登录
```

### 14.7 VITE_ENCRYPTION_KEY 轮换（前端本地缓存加密）

```bash
# 1. 生成新密钥 (32 字节 hex)
openssl rand -hex 32
# 输出: <NEW_VITE_ENCRYPTION_KEY>

# 2. 更新 client/.env.production
sed -i 's|^VITE_ENCRYPTION_KEY=.*|VITE_ENCRYPTION_KEY=<NEW_VITE_ENCRYPTION_KEY>|' client/.env.production

# 3. 重新构建前端
cd client && pnpm build

# 4. 部署新前端静态资源
#    (用户浏览器本地缓存会用旧 key 加密, 部署后会自动清空并重新登录)

# 5. 验证: 浏览器无痕模式访问, 登录后检查 localStorage 是否用新 key 加密
```

### 14.8 补充检查清单（封版前必做）

- [ ] P0: `INTERNAL_AUTH_KEY` 生产值已替换 (非 dev-internal-auth-key-***)
- [ ] P0: `TBOX_NOTIFY_SECRET` 生产值已替换 (非 dev-tbox-notify-***)
- [ ] P0: `SEED_ADMIN_PWD` / `SEED_RY_PWD` 首次登录后已删除
- [ ] P0: `VITE_ENCRYPTION_KEY` 生产值已是 64 位 hex (非 ihui-ai-***)
- [ ] P0: `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` 已轮换
- [ ] P0: `JWT_SECRET_KEY` 生产值已是 64 位随机 (非 zhs-platform-***)
- [ ] P1: `NOTIFY_SMTP_PASSWORD` 已重置
- [ ] P1: `SMS_WUXI_CLIENT_SECRET` 已重置
- [ ] P1: `TENCENT_LIVE_*` 3 项已重置
- [ ] P1: `TENCENT_COS_*` 2 项已重置
- [ ] P1: `WECOM_SECRET` 已重置
- [ ] P1: `DINGTALK_APP_SECRET` + `DINGTALK_LOGIN_APP_SECRET` 已重置
- [ ] P1: `WX_APP_SECRET` 已重置
- [ ] P1: `VOLC_APP_KEY` 已重置
- [ ] P2: dev 为空的可选项上线前确认配置 (FEISHU/GOOGLE/ALI_LOGIN/SUNO/GEMINI/LANGCHAIN/OSS/ALI_SMS)
- [ ] 第十五节审计记录补充本次轮换

---

**维护记录**:

| 日期 | 变更 | 操作人 |
|---|---|---|
| 2026-06-25 | 初始版本 (从 INTEGRATION_DELIVERY_REPORT.md 9.3/9.4 扩展) | IHUI-AI Assistant |
| 2026-06-26 | 新增第 14 节: 封版前补充凭证清单 (VAPID/SEED/INTERNAL_AUTH/TBOX_NOTIFY/VITE_ENCRYPTION/SMS_WUXI/TENCENT_LIVE/TENCENT_COS/WECOM/DINGTALK 等 40+ 字段) | IHUI-AI Assistant |
