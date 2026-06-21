# 安全服务使用文档

本文档介绍项目中所有安全服务的使用方法。

## 目录

1. [认证安全](#认证安全)
2. [设备管理](#设备管理)
3. [会话管理](#会话管理)
4. [安全日志](#安全日志)
5. [双因素认证](#双因素认证)
6. [密码安全](#密码安全)
7. [IP白名单](#ip白名单)
8. [安全通知](#安全通知)
9. [账户恢复](#账户恢复)
10. [安全评分](#安全评分)

---

## 认证安全

### LoginAttemptService - 登录尝试管理

防止暴力破解攻击，记录登录失败次数，支持渐进式锁定。

```typescript
import { LoginAttemptService } from '@/utils/loginAttemptService'

// 记录登录尝试
LoginAttemptService.recordAttempt(true)  // 成功
LoginAttemptService.recordAttempt(false) // 失败

// 获取锁定状态
const status = LoginAttemptService.getLockoutStatus()
if (status.isLocked) {
  console.log(`账户已锁定，剩余时间: ${status.remainingTime}ms`)
}

// 获取剩余尝试次数
const remaining = LoginAttemptService.getRemainingAttempts()

// 重置锁定
LoginAttemptService.resetLockout()

// 清除所有记录
LoginAttemptService.clearAttempts()
```

### LoginBehaviorService - 登录行为分析

分析用户登录模式，检测异常行为。

```typescript
import { LoginBehaviorService } from '@/utils/loginBehaviorService'

// 记录登录行为
LoginBehaviorService.recordLogin({
  deviceId: 'device_123',
  ipAddress: '192.168.1.1',
  location: '北京',
  success: true,
})

// 获取风险评分
const risk = LoginBehaviorService.calculateRiskScore()
console.log(`风险等级: ${risk.level}, 评分: ${risk.score}`)

// 获取常用设备
const devices = LoginBehaviorService.getCommonDevices()

// 获取常用地点
const locations = LoginBehaviorService.getCommonLocations()

// 检测异常
const anomalies = LoginBehaviorService.detectAnomalies()
```

---

## 设备管理

### MultiDeviceService - 多设备管理

管理用户登录的多个设备。

```typescript
import { MultiDeviceService } from '@/utils/multiDeviceService'

// 获取所有登录设备
const devices = MultiDeviceService.getLoginDevices()

// 移除设备
MultiDeviceService.removeDevice('device_id')

// 信任设备
MultiDeviceService.trustDevice('device_id')

// 检查是否为新设备
const isNew = MultiDeviceService.isNewDevice('device_id')

// 获取当前设备信息
const current = MultiDeviceService.getCurrentDevice()
```

### DeviceService - 设备指纹

生成设备唯一标识。

```typescript
import { DeviceService } from '@/utils/deviceService'

// 获取设备指纹
const fingerprint = await DeviceService.getFingerprint()

// 获取设备信息
const info = DeviceService.getDeviceInfo()
// { browser, os, device: 'desktop'|'mobile', ... }
```

---

## 会话管理

### SessionService - 会话管理

管理用户登录会话。

```typescript
import { SessionService } from '@/utils/sessionService'

// 创建会话
const session = SessionService.createSession({
  deviceId: 'device_123',
  ipAddress: '192.168.1.1',
})

// 获取当前会话
const current = SessionService.getCurrentSession()

// 获取所有会话
const sessions = SessionService.getAllSessions()

// 终止会话
SessionService.terminateSession('session_id')

// 终止所有其他会话
SessionService.terminateAllOtherSessions()

// 更新活动时间
SessionService.updateActivity()
```

---

## 安全日志

### SecurityLogService - 安全日志记录

记录所有安全相关事件。

```typescript
import { SecurityLogService } from '@/utils/securityLogService'

// 记录日志
SecurityLogService.log({
  type: 'login',           // login, logout, password_change, device_remove, etc.
  success: true,
  ipAddress: '192.168.1.1',
  deviceId: 'device_123',
  details: '用户登录成功',
})

// 获取日志
const logs = SecurityLogService.getLogs()

// 筛选日志
const filtered = SecurityLogService.getLogs({
  type: 'login',
  success: false,
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
})

// 清除日志
SecurityLogService.clearLogs()
```

---

## 双因素认证

### TwoFactorService - 双因素认证

TOTP 双因素认证管理。

```typescript
import { TwoFactorService } from '@/utils/twoFactorService'

// 获取状态
const status = TwoFactorService.getStatus()
// { enabled: boolean, hasBackupCodes: boolean }

// 启用双因素认证
const setup = await TwoFactorService.enable()
// { secret: string, qrCode: string, backupCodes: string[] }

// 验证代码
const result = await TwoFactorService.verify('123456')
// { success: boolean, message: string, backupCodeUsed?: boolean }

// 禁用双因素认证
await TwoFactorService.disable()

// 生成新的备用码
const codes = TwoFactorService.generateBackupCodes()

// 验证备用码
const valid = TwoFactorService.verifyBackupCode('ABCD1234')
```

---

## 密码安全

### PasswordStrength - 密码强度检测

分析密码强度并提供改进建议。

```typescript
import { analyzePassword } from '@/utils/passwordStrength'

// 分析密码
const result = analyzePassword('MyP@ssw0rd')
// {
//   score: 5,           // 0-7
//   strength: 'strong', // weak, fair, good, strong
//   feedback: [],
//   suggestions: [],
//   checks: { length: true, uppercase: true, ... }
// }
```

### PasswordHistoryService - 密码历史

防止重复使用旧密码。

```typescript
import { PasswordHistoryService } from '@/utils/passwordHistoryService'

// 验证新密码
const validation = await PasswordHistoryService.validateNewPassword('newPassword')
// { valid: boolean, errors: string[], warnings: string[] }

// 添加到历史
await PasswordHistoryService.addToHistory('newPassword')

// 检查是否使用过
const used = await PasswordHistoryService.isPasswordUsed('oldPassword')

// 检查密码是否过期
const expired = PasswordHistoryService.isPasswordExpired()

// 获取密码年龄（天数）
const age = PasswordHistoryService.getPasswordAgeDays()
```

---

## IP白名单

### IPWhitelistService - IP白名单管理

限制登录IP地址。

```typescript
import { IPWhitelistService } from '@/utils/ipWhitelistService'

// 获取配置
const config = IPWhitelistService.getConfig()
// { enabled: boolean, strictMode: boolean }

// 更新配置
IPWhitelistService.updateConfig({ enabled: true, strictMode: false })

// 添加IP
IPWhitelistService.addEntry('192.168.1.0/24', '办公室网络')

// 移除IP
IPWhitelistService.removeEntry('entry_id')

// 获取白名单
const list = IPWhitelistService.getWhitelist()

// 检查IP是否允许
const allowed = IPWhitelistService.isIpAllowed('192.168.1.100')

// 获取当前IP
const currentIp = IPWhitelistService.getCurrentIp()
```

---

## 安全通知

### SecurityNotificationService - 安全通知

发送安全相关通知。

```typescript
import { SecurityNotificationService } from '@/utils/securityNotificationService'

// 发送通知
SecurityNotificationService.notify({
  type: 'suspicious_login',
  title: '检测到可疑登录',
  message: '来自未知设备的登录尝试',
  priority: 'high', // low, medium, high, critical
})

// 通知新设备登录
SecurityNotificationService.notifyNewDevice({
  deviceName: 'Chrome on Windows',
  location: '北京',
  ipAddress: '192.168.1.1',
})

// 通知可疑登录
SecurityNotificationService.notifySuspiciousLogin('异地登录')

// 获取通知列表
const notifications = SecurityNotificationService.getNotifications()

// 获取未读数量
const unread = SecurityNotificationService.getUnreadCount()

// 标记已读
SecurityNotificationService.markAsRead('notification_id')

// 配置通知
SecurityNotificationService.updateConfig({
  enabled: true,
  desktop: true,
  sound: true,
})
```

---

## 账户恢复

### RecoveryService - 账户恢复

管理账户恢复选项和恢复码。

```typescript
import { RecoveryService } from '@/utils/recoveryService'

// 添加恢复选项
RecoveryService.addOption('email', 'user@example.com')
RecoveryService.addOption('phone', '+8613800138000')

// 获取恢复选项
const options = RecoveryService.getOptions()

// 验证恢复选项
RecoveryService.verifyOption('option_id')

// 生成恢复码
const codes = RecoveryService.generateNewCodes()

// 使用恢复码
const valid = RecoveryService.useRecoveryCode('ABCD12345678')

// 获取恢复状态
const status = RecoveryService.getRecoveryStatus()
// { hasOptions, verifiedCount, hasCodes, unusedCodeCount, isComplete }

// 导出恢复码
const exported = RecoveryService.exportRecoveryCodes()
```

---

## 安全评分

### SecurityScoreService - 安全评分

计算账户安全评分。

```typescript
import { SecurityScoreService } from '@/utils/securityScoreService'

// 计算评分
const score = SecurityScoreService.calculateScore()
// {
//   total: 75,
//   maxScore: 100,
//   level: 'high', // critical, low, medium, high, excellent
//   items: [...],
//   recommendations: [...]
// }

// 获取等级颜色
const color = SecurityScoreService.getLevelColor('high')

// 获取等级标签
const label = SecurityScoreService.getLevelLabel('high')
```

---

## 敏感操作验证

### SensitiveActionService - 敏感操作验证

对敏感操作进行二次确认。

```typescript
import { SensitiveActionService } from '@/utils/sensitiveActionService'

// 验证敏感操作
const verified = await SensitiveActionService.verify({
  action: 'delete_account',
  description: '删除账户',
  requirePassword: true,
})

if (verified) {
  // 执行敏感操作
}

// 检查是否需要验证
const needed = SensitiveActionService.needsVerification('change_password')

// 重置验证状态
SensitiveActionService.resetVerification()
```

---

## 安全配置

### SecurityConfigService - 安全配置管理

导出/导入安全设置。

```typescript
import { SecurityConfigService } from '@/utils/securityConfigService'

// 导出配置
const config = SecurityConfigService.exportConfig()

// 下载配置文件
SecurityConfigService.downloadConfig()

// 导入配置
const result = await SecurityConfigService.uploadConfig(file)
// { success: boolean, imported: string[], errors: string[] }

// 获取配置摘要
const summary = SecurityConfigService.getConfigSummary()

// 重置所有设置
SecurityConfigService.resetAllSettings()
```

---

## 审计导出

### AuditExportService - 审计报告导出

导出安全审计报告。

```typescript
import { AuditExportService } from '@/utils/auditExportService'

// 导出为JSON
const json = AuditExportService.exportAsJson()

// 导出为CSV
const csv = AuditExportService.exportAsCsv()

// 下载报告
AuditExportService.downloadReport('json') // 'json' | 'csv'

// 获取报告数据
const data = AuditExportService.getReportData()
```

---

## CSRF防护

### CSRFService - CSRF Token管理

防止跨站请求伪造攻击。

```typescript
import { CSRFService } from '@/utils/csrfService'

// 获取Token
const token = CSRFService.getToken()

// 验证Token
const valid = CSRFService.validateToken(token)

// 刷新Token
CSRFService.refreshToken()
```

---

## 使用统计

### SecurityUsageService - 安全功能使用统计

统计安全功能使用情况。

```typescript
import { SecurityUsageService } from '@/utils/securityUsageService'

// 记录使用
SecurityUsageService.recordUsage('two_factor')

// 获取统计
const stats = SecurityUsageService.getStats()

// 获取热门功能
const top = SecurityUsageService.getTopFeatures(5)

// 获取未使用功能
const unused = SecurityUsageService.getUnusedFeatures()

// 获取参与度评分
const score = SecurityUsageService.getEngagementScore()

// 获取推荐
const recommendations = SecurityUsageService.getRecommendations()
```

---

## 最佳实践

### 1. 登录流程集成

```typescript
// 在登录成功时
async function onLoginSuccess() {
  // 记录成功尝试
  LoginAttemptService.recordAttempt(true)
  
  // 记录登录行为
  LoginBehaviorService.recordLogin({ ... })
  
  // 记录安全日志
  SecurityLogService.log({ type: 'login', success: true })
  
  // 检测新设备
  if (MultiDeviceService.isNewDevice(deviceId)) {
    SecurityNotificationService.notifyNewDevice({ ... })
  }
}

// 在登录失败时
async function onLoginFailed() {
  LoginAttemptService.recordAttempt(false)
  SecurityLogService.log({ type: 'login', success: false })
}
```

### 2. 密码修改集成

```typescript
async function changePassword(oldPassword: string, newPassword: string) {
  // 验证新密码
  const validation = await PasswordHistoryService.validateNewPassword(newPassword)
  if (!validation.valid) {
    throw new Error(validation.errors[0])
  }
  
  // 执行修改
  await api.changePassword(oldPassword, newPassword)
  
  // 记录历史
  await PasswordHistoryService.addToHistory(newPassword)
  
  // 记录日志
  SecurityLogService.log({ type: 'password_change', success: true })
}
```

### 3. 敏感操作保护

```typescript
async function deleteAccount() {
  // 验证用户身份
  const verified = await SensitiveActionService.verify({
    action: 'delete_account',
    requirePassword: true,
  })
  
  if (!verified) return
  
  // 执行删除
  await api.deleteAccount()
  
  // 清理安全数据
  SecurityConfigService.resetAllSettings()
}
```

---

## 相关文件

- 服务文件: `src/utils/*Service.ts`
- 组件文件: `src/components/settings/*.vue`
- 测试文件: `src/utils/__tests__/*.test.ts`
- 国际化: `src/locales/zh-CN.json`, `src/locales/en.json`
