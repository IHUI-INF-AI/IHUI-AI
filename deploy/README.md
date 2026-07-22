# IHUI-AI 部署脚本

## 概览

本目录包含 IHUI-AI 项目的部署脚本:

| 脯文件                        | 说明                                                   |
| ----------------------------- | ------------------------------------------------------ |
| `scripts/deploy.sh`           | 蓝绿部署切换脚本(blue/green/status/rollback)           |
| `scripts/deploy_certs.sh`     | SSL 证书部署 / 续期 / 检查脚本(deploy/renew/check)     |
| `nginx/nginx-blue-green.conf` | nginx 蓝绿配置(Blue / Green upstream + HTTPS + 安全头) |
| `cron/cert-renew.cron`        | 证书续期 cron 入口                                     |
| `cron/cert-renew.sh`          | 证书续期封装                                           |
| `setup-github-secrets.sh`     | GitHub Actions secrets 初始化                          |

> 详见 `nginx/README.md` 了解 nginx 蓝绿配置细节.

---

## 蓝绿部署架构

```
                            ┌──────────────────────────┐
                            │       Nginx :443         │
                            │   (HTTPS + 安全头 + gzip) │
                            │  /etc/nginx/conf.d/      │
                            │   nginx-blue-green.conf  │
                            └────────────┬─────────────┘
                                         │ proxy_pass
                  ┌──────────────────────┴──────────────────────┐
                  │                                              │
        active → blue_web (3000)             OR        green_web (3001)
                 blue_api  (8080)                       green_api  (8081)
                  │                                              │
        (当前 inactive: green 或 blue 反向)

切换流程:
  1. 备份当前 nginx 配置 → /tmp/nginx-backup-<ts>.conf
  2. sed 替换 blue_web↔green_web, blue_api↔green_api
  3. nginx -t 验证
  4. nginx -s reload
  5. sleep 5 + curl /nginx-health
  6. 失败 → 自动恢复备份 → exit 1
  7. 记录日志到 /var/log/ihui-deploy.log
```

| 环境  | web 端口 | api 端口 | upstream 名               |
| ----- | -------- | -------- | ------------------------- |
| Blue  | 3000     | 8080     | `blue_web` / `blue_api`   |
| Green | 3001     | 8081     | `green_web` / `green_api` |

---

## deploy.sh 用法

```bash
# 首次使用需要执行权限
chmod +x deploy/scripts/deploy.sh

# 切换到 Blue 环境 (web=3000, api=8080)
sudo ./deploy/scripts/deploy.sh blue

# 切换到 Green 环境 (web=3001, api=8081)
sudo ./deploy/scripts/deploy.sh green

# 查看当前激活环境
sudo ./deploy/scripts/deploy.sh status

# 回滚到上一个环境(切换前自动记录)
sudo ./deploy/scripts/deploy.sh rollback
```

### 依赖

- nginx 已安装,`nginx-blue-green.conf` 已复制到 `/etc/nginx/conf.d/`
- 脚本需要 **root 权限**(写 `/etc/nginx` + `nginx -s reload`)
- `curl` 用于健康检查

### 行为约定

- **备份**:每次切换前都会把当前 `nginx-blue-green.conf` 备份到 `/tmp/nginx-backup-<unix-时间戳>.conf`
- **验证**:`nginx -t` 失败时立即恢复备份并 `exit 1`
- **健康检查**:reload 后等待 5 秒,`curl http://127.0.0.1/nginx-health` 必须返回 `200`
- **自动回滚**:健康检查失败 → 自动恢复备份并 reload
- **日志**:所有操作记录到 `/var/log/ihui-deploy.log`
- **状态文件**:切换前的环境名记录到 `/var/lib/ihui/last-env`,`rollback` 据此回退

---

## deploy_certs.sh 用法

```bash
# 首次使用需要执行权限
chmod +x deploy/scripts/deploy_certs.sh

# 1. 部署证书(从环境变量读取路径)
CERT_PATH=/tmp/aizhs.top.crt \
KEY_PATH=/tmp/aizhs.top.key \
  sudo ./deploy/scripts/deploy_certs.sh deploy

# 或用 --cert / --key 参数部署
sudo ./deploy/scripts/deploy_certs.sh deploy \
  --cert /tmp/aizhs.top.crt \
  --key  /tmp/aizhs.top.key

# 2. 续期证书(Let's Encrypt)
sudo ./deploy/scripts/deploy_certs.sh renew

# 3. 检查证书有效期
sudo ./deploy/scripts/deploy_certs.sh check
```

### 依赖

- `nginx`(deploy / renew 都需要)
- `certbot`(renew 需要)
- `openssl`(check 需要)
- 脚本需要 **root 权限**(写 `/etc/nginx/ssl` + `nginx -s reload`)

### 行为约定

- **目标路径**:证书固定复制到 `/etc/nginx/ssl/aizhs.top.{crt,key}`
- **权限**:cert `0644`,key `0600`
- **校验**:deploy 与 renew 后都会跑 `nginx -t`,通过才 `nginx -s reload`
- **续期日志**:续期结果记录到 `/var/log/ihui-cert-deploy.log`
- **check 阈值**:
  - 剩余 ≤ **7 天** → 紧急告警(exit 2)
  - 剩余 ≤ **30 天** → 普通告警(exit 0,但日志标记 WARN)
  - 剩余 > 30 天 → 正常

### 与 cron 集成

`cron/cert-renew.cron` 推荐配置:

```cron
# 每周日凌晨 3 点续期
0 3 * * 0 root /opt/ihui/deploy/scripts/deploy_certs.sh renew >> /var/log/ihui-cert-deploy.log 2>&1
# 每天上午 9 点检查有效期
0 9 * * * root /opt/ihui/deploy/scripts/deploy_certs.sh check >> /var/log/ihui-cert-deploy.log 2>&1
```

---

## 常见问题排查

### Q1: `./deploy.sh green` 提示 "nginx -t 验证失败"

**原因**:nginx 主配置或 `nginx-blue-green.conf` 有语法错误.

**排查**:

```bash
# 手动跑一次,看详细错误
nginx -t
# 检查配置文件是否完整
cat /etc/nginx/conf.d/nginx-blue-green.conf | head -50
```

### Q2: 切换后 `curl /nginx-health` 返回 502

**原因**:目标环境的 web/api 进程没起,或端口不对.

**排查**:

```bash
# 1. 确认端口监听
ss -lnt | grep -E '8841|8843|8842|8844'
# 2. 直接 curl 后端
curl -v http://127.0.0.1:8843/
curl -v http://127.0.0.1:8844/health
# 3. 看 nginx 错误日志
tail -100 /var/log/nginx/error.log
```

### Q3: `rollback` 提示 "找不到上一个环境记录"

**原因**:`/var/lib/ihui/last-env` 不存在(首次部署或被删除).

**解决**:手动执行一次 `status` 查看当前环境,然后显式 `deploy.sh blue` 或 `green`.

### Q4: `deploy_certs.sh deploy` 提示 "nginx -t 验证失败"

**原因**:证书与 `nginx-blue-green.conf` 中的 `ssl_certificate` 路径不匹配,或证书格式错误.

**排查**:

```bash
# 验证证书内容
openssl x509 -in /etc/nginx/ssl/aizhs.top.crt -noout -text | head -30
# 验证 cert 与 key 是否匹配(openssl modulus 应一致)
openssl x509 -in /etc/nginx/ssl/aizhs.top.crt -noout -modulus | md5sum
openssl rsa  -in /etc/nginx/ssl/aizhs.top.key -noout -modulus | md5sum
```

### Q5: `deploy_certs.sh renew` 报 "certbot renew 失败"

**原因**:certbot 未安装 / 80 端口被占用 / Let's Encrypt 限流 / DNS 解析问题.

**排查**:

```bash
# 看 certbot 详细日志
tail -100 /var/log/letsencrypt/letsencrypt.log
# 手动跑一次(非 quiet)
certbot renew --dry-run
```

### Q6: `deploy_certs.sh check` 报 "剩余 0 天" 但证书其实有效

**原因**:`date -d` 在 macOS / BSD 上不支持,脚本已 fallback 到 `date -jf`,若仍失败请改用 `gnu date`.

**排查**:

```bash
date -d "2027-01-01" +%s
```

### Q7: 切换后健康检查通过,但业务接口仍报错

**原因**:nginx `/nginx-health` 只验证 nginx 自身健康,不代表后端 API 业务正常.

**补充**:

```bash
# 手动验证 API
curl -v https://aizhs.top/api/health
# 看 API 日志
tail -100 /var/log/ihui/api.log
```

### Q8: 日志文件越来越大

**修复**:加 logrotate:

```bash
cat > /etc/logrotate.d/ihui-deploy <<'EOF'
/var/log/ihui-deploy.log /var/log/ihui-cert-deploy.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    copytruncate
}
EOF
```
