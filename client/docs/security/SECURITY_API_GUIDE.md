# 安全API后端对接指南

本文档提供前端安全服务与后端API对接的指南。

## 目录

1. [API端点设计](#api端点设计)
2. [数据模型](#数据模型)
3. [对接示例](#对接示例)
4. [安全建议](#安全建议)

---

## API端点设计

### 认证相关

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/refresh` | POST | 刷新Token |
| `/api/auth/login-attempts` | GET | 获取登录尝试记录 |
| `/api/auth/lockout-status` | GET | 获取锁定状态 |

### 设备管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/devices` | GET | 获取登录设备列表 |
| `/api/devices/:id` | DELETE | 移除设备 |
| `/api/devices/:id/trust` | POST | 信任设备 |
| `/api/devices/current` | GET | 获取当前设备信息 |

### 会话管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | GET | 获取所有会话 |
| `/api/sessions/:id` | DELETE | 终止会话 |
| `/api/sessions/others` | DELETE | 终止所有其他会话 |

### 双因素认证

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/2fa/status` | GET | 获取2FA状态 |
| `/api/2fa/enable` | POST | 启用2FA |
| `/api/2fa/disable` | POST | 禁用2FA |
| `/api/2fa/verify` | POST | 验证2FA代码 |
| `/api/2fa/backup-codes` | GET | 获取备用码 |
| `/api/2fa/backup-codes/regenerate` | POST | 重新生成备用码 |

### 密码管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/password/change` | POST | 修改密码 |
| `/api/password/history` | GET | 获取密码历史 |
| `/api/password/policy` | GET | 获取密码策略 |
| `/api/password/validate` | POST | 验证密码强度 |

### IP白名单

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ip-whitelist` | GET | 获取白名单 |
| `/api/ip-whitelist` | POST | 添加IP |
| `/api/ip-whitelist/:id` | DELETE | 删除IP |
| `/api/ip-whitelist/config` | PUT | 更新配置 |

### 安全日志

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/security-logs` | GET | 获取安全日志 |
| `/api/security-logs/export` | GET | 导出日志 |

### 账户恢复

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/recovery/options` | GET | 获取恢复选项 |
| `/api/recovery/options` | POST | 添加恢复选项 |
| `/api/recovery/options/:id` | DELETE | 删除恢复选项 |
| `/api/recovery/options/:id/verify` | POST | 验证恢复选项 |
| `/api/recovery/codes` | GET | 获取恢复码 |
| `/api/recovery/codes/regenerate` | POST | 重新生成恢复码 |

### 安全通知

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/notifications` | GET | 获取通知列表 |
| `/api/notifications/:id/read` | PUT | 标记已读 |
| `/api/notifications/read-all` | PUT | 全部标记已读 |
| `/api/notifications/config` | GET/PUT | 获取/更新配置 |

---

## 数据模型

### LoginAttempt

```typescript
interface LoginAttempt {
  id: string
  userId: string
  timestamp: Date
  success: boolean
  ipAddress: string
  deviceId: string
  userAgent: string
  location?: string
  failureReason?: string
}
```

### Device

```typescript
interface Device {
  id: string
  userId: string
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
  ipAddress: string
  location?: string
  lastActive: Date
  firstSeen: Date
  isTrusted: boolean
  isCurrent: boolean
}
```

### Session

```typescript
interface Session {
  id: string
  userId: string
  deviceId: string
  ipAddress: string
  userAgent: string
  createdAt: Date
  lastActive: Date
  expiresAt: Date
  isActive: boolean
}
```

### SecurityLog

```typescript
interface SecurityLog {
  id: string
  userId: string
  type: 'login' | 'logout' | 'password_change' | 'device_remove' | '2fa_enable' | '2fa_disable' | 'suspicious_login'
  success: boolean
  timestamp: Date
  ipAddress: string
  deviceId: string
  details?: string
  metadata?: Record<string, unknown>
}
```

### TwoFactorStatus

```typescript
interface TwoFactorStatus {
  enabled: boolean
  verifiedAt?: Date
  backupCodesCount: number
}
```

### TwoFactorSetup

```typescript
interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}
```

### IPWhitelistEntry

```typescript
interface IPWhitelistEntry {
  id: string
  userId: string
  ip: string
  label: string
  createdAt: Date
  lastUsed?: Date
}
```

### RecoveryOption

```typescript
interface RecoveryOption {
  id: string
  userId: string
  type: 'email' | 'phone' | 'security_question'
  value: string
  verified: boolean
  createdAt: Date
  lastUsed?: Date
}
```

### SecurityNotification

```typescript
interface SecurityNotification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  read: boolean
  timestamp: Date
  metadata?: Record<string, unknown>
}
```

---

## 对接示例

### 1. 登录流程

```typescript
// 前端代码
async function login(credentials: LoginCredentials) {
  // 检查锁定状态
  const lockoutStatus = await api.get('/api/auth/lockout-status')
  if (lockoutStatus.isLocked) {
    throw new Error(`账户已锁定，请${lockoutStatus.remainingTime}后重试`)
  }

  try {
    // 执行登录
    const response = await api.post('/api/auth/login', {
      ...credentials,
      deviceId: await DeviceService.getFingerprint(),
      deviceName: DeviceService.getDeviceInfo(),
    })

    // 后端应返回设备信息和登录记录
    const { user, device, session } = response.data

    // 前端记录
    LoginAttemptService.recordAttempt(true)
    LoginBehaviorService.recordLogin({ ... })
    SecurityLogService.log({ type: 'login', success: true })

    return response
  } catch (error) {
    // 记录失败
    LoginAttemptService.recordAttempt(false)
    SecurityLogService.log({ type: 'login', success: false })
    throw error
  }
}
```

```python
# 后端代码示例 (Python/FastAPI)
@router.post("/api/auth/login")
async def login(
    credentials: LoginCredentials,
    request: Request,
    db: Session = Depends(get_db)
):
    # 检查锁定状态
    lockout = check_lockout(db, credentials.email)
    if lockout.is_locked:
        raise HTTPException(423, "账户已锁定")

    # 验证凭据
    user = authenticate_user(db, credentials.email, credentials.password)
    if not user:
        # 记录失败
        record_login_attempt(db, credentials.email, False, request.client.host)
        raise HTTPException(401, "用户名或密码错误")

    # 检查设备
    device = get_or_create_device(db, user.id, credentials.device_id, request)

    # 检查2FA
    if user.two_factor_enabled:
        if not credentials.two_factor_code:
            raise HTTPException(200, {"requires_2fa": True})

        if not verify_2fa(user, credentials.two_factor_code):
            raise HTTPException(401, "验证码错误")

    # 创建会话
    session = create_session(db, user.id, device.id, request)

    # 记录成功
    record_login_attempt(db, credentials.email, True, request.client.host)
    log_security_event(db, user.id, "login", True, request)

    return {
        "user": user,
        "device": device,
        "session": session,
        "token": create_access_token(user.id)
    }
```

### 2. 双因素认证

```typescript
// 前端代码
async function enable2FA() {
  // 获取设置信息
  const setup = await api.post('/api/2fa/enable')

  // 显示QR码给用户扫描
  showQRCode(setup.qrCodeUrl)

  // 用户输入验证码
  const code = await getUserInput()

  // 验证
  const result = await api.post('/api/2fa/verify', { code })

  if (result.success) {
    // 保存备用码
    saveBackupCodes(setup.backupCodes)
    TwoFactorService.setStatus({ enabled: true })
  }
}
```

```python
# 后端代码示例
@router.post("/api/2fa/enable")
async def enable_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 生成密钥
    secret = pyotp.random_base32()

    # 生成QR码URL
    totp = pyotp.TOTP(secret)
    qr_url = totp.provisioning_uri(
        current_user.email,
        issuer_name="IHUI AI"
    )

    # 生成备用码
    backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]

    # 临时存储（验证成功后才保存）
    redis.setex(f"2fa_setup:{current_user.id}", 300, json.dumps({
        "secret": secret,
        "backup_codes": backup_codes
    }))

    return {
        "secret": secret,
        "qrCodeUrl": qr_url,
        "backupCodes": backup_codes
    }

@router.post("/api/2fa/verify")
async def verify_2fa(
    data: Verify2FARequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 获取临时设置
    setup_data = redis.get(f"2fa_setup:{current_user.id}")
    if not setup_data:
        raise HTTPException(400, "设置已过期，请重新开始")

    setup = json.loads(setup_data)

    # 验证TOTP
    totp = pyotp.TOTP(setup["secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "验证码错误")

    # 保存设置
    current_user.two_factor_secret = encrypt(setup["secret"])
    current_user.two_factor_enabled = True
    db.commit()

    # 保存备用码
    save_backup_codes(db, current_user.id, setup["backup_codes"])

    return {"success": True}
```

### 3. IP白名单

```typescript
// 前端代码
async function addIPToWhitelist(ip: string, label: string) {
  await api.post('/api/ip-whitelist', { ip, label })
  IPWhitelistService.addEntry(ip, label)
}
```

```python
# 后端代码示例
@router.post("/api/ip-whitelist")
async def add_ip_whitelist(
    data: IPWhitelistRequest,
    current_user: User = Depends(get_current_user),
    request: Request,
    db: Session = Depends(get_db)
):
    # 验证IP格式
    try:
        ipaddress.ip_network(data.ip, strict=False)
    except ValueError:
        raise HTTPException(400, "无效的IP地址格式")

    # 检查数量限制
    count = db.query(IPWhitelist).filter_by(user_id=current_user.id).count()
    if count >= 20:
        raise HTTPException(400, "最多添加20个IP地址")

    # 添加
    entry = IPWhitelist(
        user_id=current_user.id,
        ip=data.ip,
        label=data.label
    )
    db.add(entry)
    db.commit()

    log_security_event(db, current_user.id, "ip_whitelist_add", True, request)

    return {"id": entry.id}
```

---

## 安全建议

### 后端实现建议

1. **速率限制**
   ```python
   from slowapi import Limiter
   limiter = Limiter(key_func=get_user_id)

   @router.post("/api/auth/login")
   @limiter.limit("5/minute")
   async def login(...):
       pass
   ```

2. **密码存储**
   ```python
   from passlib.context import CryptContext
   pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

   # 哈希密码
   hashed = pwd_context.hash(password)

   # 验证密码
   pwd_context.verify(password, hashed)
   ```

3. **TOTP验证**
   ```python
   import pyotp

   def verify_totp(secret: str, code: str) -> bool:
       totp = pyotp.TOTP(secret)
       return totp.verify(code, valid_window=1)
   ```

4. **JWT配置**
   ```python
   from datetime import timedelta

   ACCESS_TOKEN_EXPIRE = timedelta(minutes=15)
   REFRESH_TOKEN_EXPIRE = timedelta(days=7)

   def create_tokens(user_id: str):
       access = create_jwt(user_id, ACCESS_TOKEN_EXPIRE)
       refresh = create_jwt(user_id, REFRESH_TOKEN_EXPIRE, type="refresh")
       return access, refresh
   ```

5. **日志记录**
   ```python
   def log_security_event(
       db: Session,
       user_id: str,
       event_type: str,
       success: bool,
       request: Request
   ):
       log = SecurityLog(
           user_id=user_id,
           type=event_type,
           success=success,
           ip_address=request.client.host,
           user_agent=request.headers.get("user-agent"),
           timestamp=datetime.utcnow()
       )
       db.add(log)
       db.commit()
   ```

### 前端对接建议

1. **错误处理**
   ```typescript
   api.interceptors.response.use(
     response => response,
     error => {
       if (error.response?.status === 423) {
         // 账户锁定
         LoginAttemptService.updateLockoutStatus(error.response.data)
       }
       return Promise.reject(error)
     }
   )
   ```

2. **Token刷新**
   ```typescript
   api.interceptors.request.use(async config => {
     const token = getToken()
     if (token && isTokenExpired(token)) {
       const newToken = await refreshToken()
       config.headers.Authorization = `Bearer ${newToken}`
     }
     return config
   })
   ```

3. **设备指纹**
   ```typescript
   api.interceptors.request.use(config => {
     config.headers['X-Device-Id'] = DeviceService.getFingerprint()
     return config
   })
   ```

---

## 测试清单与场景执行指引

**说明**：以下为安全 API/后端能力就绪后的测试用例清单。需后端实现对应能力后，按「前端联调验证要点」与后端一起逐项验证。

### 前端联调验证要点（按场景做）

- **登录相关**：前端调用 `src/api` 中登录接口，传正确/错误凭据，根据后端返回的 code/401 等跳转或提示；锁定、新设备、异地等依赖后端返回字段，前端仅需正确展示或跳转。
- **2FA**：前端提供启用/禁用 2FA、TOTP 输入、备用码输入等 UI，调用后端接口；验证是否成功、错误提示是否正确。
- **会话管理**：前端拉取会话列表、调用终止会话接口，确认列表更新与当前会话是否被踢出。
- **IP 白名单**：前端调用增删 IP、严格模式开关等接口，确认请求成功与列表/状态更新。

联调时：后端提供环境与账号，前端按上表逐项调用并勾选；若某项后端未实现，在清单中注明「待后端」并跳过。

### 登录安全测试

- [ ] 正确凭据登录成功
- [ ] 错误凭据登录失败
- [ ] 连续失败触发锁定
- [ ] 锁定后无法登录
- [ ] 锁定过期后可登录
- [ ] 新设备触发通知
- [ ] 异地登录触发警告

### 双因素认证测试

- [ ] 启用2FA流程完整
- [ ] TOTP验证正确
- [ ] 备用码可用
- [ ] 禁用2FA需要验证
- [ ] 备用码只能使用一次

### 会话管理测试

- [ ] 会话列表正确
- [ ] 终止会话生效
- [ ] 终止其他会话不影响当前
- [ ] 会话过期自动登出

### IP白名单测试

- [ ] 添加IP成功
- [ ] 删除IP成功
- [ ] 非白名单IP被拒绝（严格模式）
- [ ] CIDR格式支持

---

## 相关文件

- 前端API: `src/api/security.ts`
- 前端服务: `src/utils/*Service.ts`
- 类型定义: `src/types/security.ts`
