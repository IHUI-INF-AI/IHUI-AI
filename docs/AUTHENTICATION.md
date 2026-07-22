# 认证授权

> IHUI-AI 平台认证授权体系完整参考:覆盖 `@ihui/auth` 共享包的 JWT 设计、token-family 旋转、黑名单、OAuth2 PKCE、2FA、RBAC、数据范围、多租户隔离、WebSocket 鉴权、密钥轮换、限流、API Key/PAT/SK 三种凭证,以及前端集成与端到端调用示例。本文档聚焦"如何使用与扩展",系统级架构见 [architecture.md](./architecture.md)。

---

## 目录

1. [总览](#1-总览)
2. [JWT 设计](#2-jwt-设计)
3. [Token family 旋转机制](#3-token-family-旋转机制)
4. [Refresh token 黑名单](#4-refresh-token-黑名单)
5. [密码哈希](#5-密码哈希)
6. [OAuth2 第三方登录](#6-oauth2-第三方登录)
7. [2FA 双因素认证](#7-2fa-双因素认证)
8. [RBAC 权限](#8-rbac-权限)
9. [数据范围 DataScope](#9-数据范围-datascope)
10. [多租户隔离](#10-多租户隔离)
11. [WebSocket 鉴权](#11-websocket-鉴权)
12. [Key rotation 密钥轮换](#12-key-rotation-密钥轮换)
13. [限流](#13-限流)
14. [API Key / PAT / SK 三种凭证](#14-api-key--pat--sk-三种凭证)
15. [前端集成](#15-前端集成)
16. [端到端调用示例](#16-端到端调用示例)

---

## 1. 总览

### 1.1 @ihui/auth 包定位

`@ihui/auth` 是 IHUI-AI 跨端共享的认证授权核心包,被 `apps/api`、`apps/ai-service`、`apps/web`、`apps/desktop`、`apps/extension`、`apps/mobile-rn`、`apps/miniapp-taro` 8 端共同引用,职责:

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| JWT | `src/jwt.ts` | HS256 签发/验证,access/refresh/ws 三类 token |
| Token family | `src/token-family.ts` | RFC 6749 §10.4 refresh token rotation with reuse detection |
| 黑名单 | `src/blacklist.ts` | Redis 持久化 token 撤销 + 用户踢下线 |
| OAuth2 | `src/oauth2.ts` | PKCE 流程,authorization code 一次性消费 |
| WebSocket 鉴权 | `src/ws-auth.ts` | socket.io v4 中间件,ws token 5min 过期 |
| 数据范围 | `src/data-scope.ts` | 6 级 DataScope 过滤,基于角色 + 部门 + 租户 |
| 密钥轮换 | `src/key-rotation.ts` | 6 阶段灰度轮换,Redis 持久化状态机 |
| 密码哈希 | `src/index.ts` | bcryptjs 默认 + SHA256 兼容旧 Java 平台 |
| 2FA TOTP | `src/totp.ts` | RFC 6238 时间一次性密码 |

### 1.2 认证链路总览

```
┌─────────────┐    login    ┌──────────────────┐
│  Client     ├────────────▶│  POST /auth/login │
│ (web/rn/...)│             └────────┬──────────┘
└─────┬───────┘                      │ verify password (bcrypt/SHA256)
      │ ◀────────────  access_token  │ issue JWT (access 15min + refresh 30d)
      │ ◀──────────  refresh_token   │
      │                              │
      │   API call w/ Bearer token   ▼
      │             ┌────────────────────────────┐
      ├────────────▶│  authenticate middleware   │
      │             │  1. verify JWT signature   │
      │             │  2. check blacklist (Redis)│
      │             │  3. requireActiveUser      │
      │             │  4. resolve tenant         │
      │             └────────────┬───────────────┘
      │                          │ request.user / request.tenantId
      │                          ▼
      │             ┌────────────────────────────┐
      │             │  Route handler + DataScope│
      │             └────────────────────────────┘
      │
      │  401 (access expired) → POST /auth/refresh
      │                          │ token-family rotation
      │                          │ reuse detection → revoke family
      ▼
```

### 1.3 安全基线

| 维度 | 值 |
| --- | --- |
| 算法 | HS256(对称),密钥 ≥ 32 字符 |
| Access TTL | 15 分钟(env `JWT_ACCESS_TTL_SECONDS` 可覆盖,60-86400) |
| Refresh TTL | 30 天 |
| WS TTL | 5 分钟(与 access/refresh 隔离) |
| Blacklist 存储 | Redis(SHA256 fingerprint,不存原始 JWT) |
| Refresh 旋转 | 每次 refresh 生成新 token + 标记旧 refresh 已用 |
| Reuse 检测 | 同一 refresh token 二次使用 → 整个 family 失效 |
| Password | bcryptjs cost=10,旧 Java 平台数据 SHA256 兼容 |
| 2FA | TOTP RFC 6238,30s 步长,10 个 backup code |
| OAuth2 | PKCE S256,authorization code 10min 一次性消费 |
| 密钥轮换 | 6 阶段灰度 + 1 天宽限期 + Redis 状态持久化 |

> 系统架构与中间件栈参见 [architecture.md §1-§2](./architecture.md)。

---

## 2. JWT 设计

### 2.1 三类 token

| 类型 | `type` claim | TTL | 用途 | 签发接口 |
| --- | --- | --- | --- | --- |
| access | `access` | 15 min | API 调用 Bearer token | `signAccessToken(payload)` |
| refresh | `refresh` | 30 d | 换取新 access + 新 refresh | `signRefreshToken(payload)` |
| ws | `ws` | 5 min | WebSocket 连接鉴权 | `generateWsToken(payload)` |

`verifyAccessToken` 强制校验 `type === 'access'`,拒绝 refresh/ws token 冒充;同理 `verifyRefreshToken` / `verifyWsToken` 各自严格类型匹配。

### 2.2 JWT payload 结构

```typescript
interface JwtPayload {
  sub: string           // userId
  roleId: number        // 角色 ID(0=普通用户,1+=管理员)
  tenantId?: string     // 租户 UUID
  type: 'access' | 'refresh' | 'ws'
  familyId?: string     // refresh token family UUID(reuse 检测用)
  // 标准 claims
  iat: number           // 签发时间
  exp: number           // 过期时间
  iss: 'ihui-ai'        // 固定 issuer
}
```

### 2.3 密钥校验

```typescript
// packages/auth/src/jwt.ts
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET 未配置')
  if (secret.length < 32) throw new Error('JWT_SECRET 必须 >= 32 字符')
  if (secret === 'your-super-secret-key-change-me') {
    throw new Error('JWT_SECRET 不能使用弱默认值')
  }
  return secret
}
```

生产环境启动时若 `JWT_SECRET` 缺失 / 过短 / 弱默认值 → 进程崩溃,杜绝弱密钥上线。

### 2.4 签发与验证流程

```typescript
import { signAccessToken, verifyAccessToken, signRefreshToken } from '@ihui/auth'

// 签发
const accessToken = signAccessToken({ sub: user.id, roleId: user.roleId, tenantId })
const refreshToken = signRefreshToken({ sub: user.id, roleId: user.roleId, familyId })

// 验证(抛 JwtExpiredError / JwtInvalidError / JwtTypeError)
try {
  const payload = verifyAccessToken(token)  // 拒绝 type='refresh'/'ws'
  // payload.sub / payload.roleId / payload.tenantId
} catch (err) {
  // 401 - token 过期 / 签名错误 / 类型不匹配
}
```

### 2.5 2026-07-22 鲁棒性加固

| 项 | 旧值 | 新值 | 原因 |
| --- | --- | --- | --- |
| Access TTL | 7 天 | 15 分钟 | 缩短被盗 token 有效窗口 |
| 验证严格度 | 仅验签 | 验签 + 类型 + issuer | 防止 refresh token 调 API |

---

## 3. Token family 旋转机制

### 3.1 设计依据

遵循 [RFC 6749 §10.4](https://datatracker.ietf.org/doc/html/rfc6749#section-10.4) "Refresh Token Rotation with Reuse Detection":每次使用 refresh token 换新 token 时,旧 refresh token 立即失效;若同一 refresh token 被二次使用,判定为被盗,撤销整个 family。

### 3.2 Family 生命周期

```
登录 ────────────────────────────────────────────────────▶
   │
   │  生成 familyId=UUID-v4
   │  refresh_token #1 (familyId=X, used=false)
   │
   ▼
刷新 1 ──▶ 标记 #1.used=true,签发 #2 (familyId=X)
   │
   ▼
刷新 2 ──▶ 标记 #2.used=true,签发 #3 (familyId=X)
   │
   ▼
攻击者重放 #1 ──▶ 检测 #1.used === true ──▶ 撤销 family X
                  │
                  └─▶ 调用 FamilyRevoker.revokeFamily(X)
                      → blacklist 所有 family X 的 token
                      → 用户被迫重新登录
```

### 3.3 接口

```typescript
// packages/auth/src/token-family.ts
export function createFamilyId(): string  // UUID v4
export function validateFamilyId(id: string): boolean

export interface FamilyRevoker {
  /** 撤销整个 family 的所有 token(被 reuse 检测触发) */
  revokeFamily(familyId: string): Promise<void>
  /** 查询 family 是否已被撤销 */
  isFamilyRevoked(familyId: string): Promise<boolean>
}

/** 默认空实现(不撤销),生产环境需注入 Redis 实现 */
export const noopFamilyRevoker: FamilyRevoker
```

### 3.4 后端集成

`apps/api/src/routes/auth.ts` 的 `POST /auth/refresh` 实现:

```typescript
// 伪代码
const payload = verifyRefreshToken(refreshToken)
if (await familyRevoker.isFamilyRevoked(payload.familyId)) {
  throw new AppError('UNAUTHORIZED', 'refresh token family 已撤销')
}

// 查 DB:该 refresh token 是否已使用
const record = await db.query.refreshTokens.findFirst({
  where: and(eq(refreshTokens.token, hash(refreshToken)), eq(refreshTokens.familyId, payload.familyId)),
})
if (record.used) {
  // reuse 检测:撤销整个 family
  await familyRevoker.revokeFamily(payload.familyId)
  throw new AppError('UNAUTHORIZED', '检测到 refresh token 重用,family 已撤销')
}

// 标记旧 token 已用,签发新 token
await db.update(refreshTokens).set({ used: true }).where(eq(refreshTokens.id, record.id))
const newAccess = signAccessToken({ sub: payload.sub, roleId: payload.roleId })
const newRefresh = signRefreshToken({ sub: payload.sub, familyId: payload.familyId })
await db.insert(refreshTokens).values({ token: hash(newRefresh), familyId: payload.familyId, userId: payload.sub })
```

---

## 4. Refresh token 黑名单

### 4.1 设计

`packages/auth/src/blacklist.ts` 的 `TokenBlacklist` 类提供 token 主动撤销能力(用户登出 / 踢下线 / family reuse 检测),不依赖 JWT 自然过期。

| 设计点 | 实现 |
| --- | --- |
| 存储 | Redis(主)+ 内存 LRU(降级) |
| Key 格式 | `bl:<sha256(jwt)>`,值=过期时间戳 |
| Fingerprint | SHA256 hash,**不存原始 JWT** |
| 用户级索引 | `user_tokens:<userId>` 集合,存该用户所有 active token 的 fingerprint |
| 失效模式 | fail-open(Redis 不可用放行)/ fail-closed(拒绝)可配置 |
| TTL | 自动随 token 过期清理 |

### 4.2 接口

```typescript
export class TokenBlacklist {
  constructor(opts: { redis?: RedisClient; mode?: 'fail-open' | 'fail-closed' })

  /** 撤销单个 token(登出) */
  revoke(token: string): Promise<void>

  /** 撤销用户所有 token(踢下线) */
  revokeUserTokens(userId: string): Promise<void>

  /** 查询 token 是否已撤销 */
  isRevoked(token: string): Promise<boolean>

  /** 跟踪用户 token(签发时调用,建立 user_tokens 索引) */
  trackUserToken(userId: string, token: string): Promise<void>
}
```

### 4.3 后端中间件集成

```typescript
// apps/api/src/plugins/auth.ts
const blacklist = new TokenBlacklist({ redis: server.redis, mode: 'fail-open' })

export async function authenticate(request: FastifyRequest) {
  const token = extractToken(request)  // Authorization header 优先,cookie auth_token 兜底
  if (!token) throw new AppError('UNAUTHORIZED', '未登录')

  const payload = verifyAccessToken(token)
  if (await blacklist.isRevoked(token)) {
    throw new AppError('UNAUTHORIZED', 'token 已撤销')
  }
  request.jwtPayload = payload
}
```

### 4.4 fail-open vs fail-closed

| 模式 | Redis 不可用时行为 | 适用场景 |
| --- | --- | --- |
| `fail-open` | 放行(假设 token 有效) | 开发环境 / 容忍少量撤销漏判 |
| `fail-closed` | 拒绝(假设 token 已撤销) | 生产环境 / 高安全要求 |

生产环境推荐 `fail-closed`,但需确保 Redis 高可用(否则所有请求 401)。

---

## 5. 密码哈希

### 5.1 双算法兼容

| 算法 | 用途 | 触发条件 |
| --- | --- | --- |
| bcryptjs (cost=10) | 默认,新注册用户 | `passwordHash` 以 `$2a$` / `$2b$` 开头 |
| SHA256 | 兼容旧 Java 平台数据 | `passwordHash` 为 64 位 hex(无 bcrypt 前缀) |

```typescript
// packages/auth/src/index.ts
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)  // cost=10
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(plain, hash)
  }
  // SHA256 兼容旧 Java 平台 member 表数据
  const sha256 = crypto.createHash('sha256').update(plain).digest('hex')
  return timingSafeEqual(sha256, hash)
}
```

### 5.2 旧数据迁移策略

- **不批量重置**:旧 SHA256 密码保持不变,用户下次登录验证通过后**自动升级**为 bcrypt
- **触发点**:`POST /auth/login` 验证成功后,若 `passwordHash` 为 SHA256,异步 `hashPassword(plain)` 写回 DB
- **零停机**:用户无感知,逐步完成全量迁移

### 5.3 密码强度校验

注册 / 改密接口用 Zod 校验:

```typescript
const passwordSchema = z.string()
  .min(8, '密码至少 8 位')
  .max(64, '密码最多 64 位')
  .regex(/[a-zA-Z]/, '必须包含字母')
  .regex(/[0-9]/, '必须包含数字')
```

---

## 6. OAuth2 第三方登录

### 6.1 PKCE 流程

遵循 [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) PKCE(Proof Key for Code Exchange),防止 authorization code 被截获:

```
┌────────┐                          ┌──────────┐
│ Client │                          │ /auth/sso│
└───┬────┘                          └────┬─────┘
    │  1. 生成 verifier(43-128 字符)    │
    │     challenge=base64url(sha256(verifier))
    │                                     │
    │  2. GET /auth/sso/{provider}        │
    │     ?code_challenge=xxx             │
    │     &code_challenge_method=S256     │
    ├────────────────────────────────────▶│
    │                                     │ 302 重定向到 IdP
    │  3. 用户在 IdP 授权                  │
    │                                     │
    │  4. IdP 回调 /auth/sso/{provider}/callback
    │     ?code=authorization_code        │
    │     &state=csrf_token               │
    ◀────────────────────────────────────┤
    │                                     │
    │  5. POST /auth/sso/{provider}/token │
    │     code=xxx                        │
    │     code_verifier=verifier(原值)    │
    ├────────────────────────────────────▶│
    │                                     │ 验证 base64url(sha256(verifier)) === challenge
    │                                     │ 消费 authorization code(一次性)
    │                                     │ 签发 access + refresh token
    │  6. 返回 token                      │
    ◀────────────────────────────────────┤
```

### 6.2 verifier 与 challenge

```typescript
// packages/auth/src/oauth2.ts
export function generateCodeVerifier(): string {
  // 43-128 字符,字符集 [A-Z]/[a-z]/[0-9]/-._~
  return base64url(crypto.randomBytes(32))  // 43 字符
}

export function computeCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest())
}
```

### 6.3 Authorization code 一次性消费

| 设计点 | 实现 |
| --- | --- |
| 长度 | 32 字节随机 base64url |
| TTL | 10 分钟(env 可覆盖) |
| 存储 | `InMemoryAuthorizationCodeStore`(开发)/ `RedisAuthorizationCodeStore`(生产) |
| 消费 | Redis `GETDEL` 原子操作,防重放 |
| 比较 | `timingSafeEqual` 时间恒定比较,防时序攻击 |

```typescript
export interface AuthorizationCodeStore {
  issue(code: string, data: AuthCodeData): Promise<void>     // 10min TTL
  consume(code: string): Promise<AuthCodeData | null>        // 原子删除
}

export class RedisAuthorizationCodeStore implements AuthorizationCodeStore {
  async consume(code: string) {
    const raw = await this.redis.getdel(`oauth:code:${code}`)  // GETDEL 原子
    return raw ? JSON.parse(raw) : null
  }
}
```

### 6.4 错误处理

```typescript
export class OAuth2Error extends Error {
  constructor(
    public code: 'invalid_grant' | 'invalid_client' | 'invalid_request',
    message: string,
  ) { super(message) }
}
```

| errorCode | HTTP | 场景 |
| --- | --- | --- |
| `invalid_grant` | 400 | authorization code 已消费 / 过期 / verifier 不匹配 |
| `invalid_client` | 401 | client_id 无效 |
| `invalid_request` | 400 | 缺少必填参数 |

### 6.5 支持平台

通过 `apps/api/src/routes/auth.ts` 的 `/auth/sso/:provider` 系列端点接入,具体平台清单与 state CSRF 防护细节见代码实现。

---

## 7. 2FA 双因素认证

### 7.1 数据库字段

迁移 `packages/database/drizzle/0130_two_factor.sql`:

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `two_factor_secret` | `BYTEA` | TOTP 共享密钥(20 字节原始密钥,AES-256-GCM 加密后存为 bytea) |
| `two_factor_enabled` | `BOOLEAN` | 是否已启用(默认 false) |
| `two_factor_backup_codes` | `JSONB` | 10 个 backup code 的 sha256 hash 数组(明文不存) |
| `two_factor_enabled_at` | `TIMESTAMPTZ` | 启用时间(审计) |

加密 key 来自 `CREDENTIALS_ENCRYPTION_KEY` env,复用 `apps/api/src/utils/crypto.ts` 的 AES-256-GCM 实现。

部分索引 `idx_users_two_factor_enabled` 仅对 `two_factor_enabled = TRUE` 行建索引,加速登录时 2FA 校验路径。

### 7.2 流程

#### 启用 2FA

```
1. POST /auth/2fa/setup         → 生成 secret,返回 otpauth:// URI + QR
2. 用户用 Authenticator App 扫码
3. POST /auth/2fa/verify        → 提交首个 TOTP code 验证
4. 验证通过 → two_factor_enabled=true,生成 10 个 backup code 返回(只此一次)
```

#### 登录(已启用 2FA)

```
1. POST /auth/login             → 验证密码通过
                                  返回 challenge_token(短时,只能用于 2FA 验证)
2. POST /auth/2fa/challenge     → 提交 TOTP code 或 backup code
                                  验证通过 → 签发 access + refresh token
```

`authenticate` 中间件**拒绝 challenge token 调 API**(type 检查),challenge token 只能走 `/auth/2fa/challenge` 端点。

#### Backup code

- 10 个,单次使用,校验通过后立即从 JSONB 数组移除
- 存储 sha256 hash,明文只在启用时返回一次
- 用尽后需重新 setup 生成

### 7.3 TOTP 参数

| 参数 | 值 | 依据 |
| --- | --- | --- |
| 算法 | HMAC-SHA1 | RFC 6238 |
| 步长 | 30 秒 | RFC 6238 |
| 位数 | 6 位 | RFC 6238 |
| 窗口 | ±1 步(共 3 个 30s 窗口) | 容忍时钟漂移 |

> 安全审计与合规细节见 `docs/SECURITY.md`(若存在),本文档不重复。

---

## 8. RBAC 权限

### 8.1 表结构

`packages/database/src/schema/rbac.ts`:

| 表 | 主键 | 关键字段 | 说明 |
| --- | --- | --- | --- |
| `roles` | `id` | name / code / level | 角色(0=普通用户,1+=管理员) |
| `permissions` | `id` | code / type / parentId | 权限点(type=menu/button/data) |
| `role_permissions` | 复合唯一 | roleId + permissionId | 角色-权限多对多 |
| `user_roles` | 复合唯一 | userId + roleId + scopeResourceId | 用户-角色多对多(可带数据范围) |

### 8.2 权限粒度

| 粒度 | `permissions.type` | 示例 |
| --- | --- | --- |
| 菜单 | `menu` | `agent:view` / `order:view` 控制侧边栏可见 |
| 按钮 | `button` | `agent:create` / `order:refund` 控制页面按钮 |
| 数据 | `data` | 配合 DataScope 控制行级数据可见性 |

### 8.3 管理员判定

```typescript
// apps/api/src/plugins/auth.ts
export async function requireAdmin(request: FastifyRequest) {
  await authenticate(request)
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < 1) {
    throw new AppError('FORBIDDEN', '需要管理员权限')
  }
}
```

管理员路由统一用 `preHandler: [requireAdmin]` 校验,`roleId >= 1` 即管理员。

### 8.4 权限检查

```typescript
// 权限点检查(细粒度)
export async function requirePermission(permissionCode: string) {
  return async (request: FastifyRequest) => {
    await authenticate(request)
    const userId = request.jwtPayload!.sub
    const has = await db.query.user_roles.findFirst({
      where: and(
        eq(user_roles.userId, userId),
        eq(roles.permissions, permissionCode),  // 关联查询
      ),
    })
    if (!has) throw new AppError('FORBIDDEN', `缺少权限: ${permissionCode}`)
  }
}

// 路由使用
server.post('/admin/users', { preHandler: [requirePermission('user:create')] }, handler)
```

---

## 9. 数据范围 DataScope

### 9.1 6 级 DataScope

`packages/auth/src/data-scope.ts`:

| 枚举 | 值 | 含义 | 示例 |
| --- | --- | --- | --- |
| `NONE` | 0 | 无数据权限 | 被禁用的角色 |
| `SELF` | 1 | 仅本人数据 | 普通用户看自己订单 |
| `FAMILY` | 2 | 家庭数据 | 家长看孩子订单 |
| `DEPARTMENT` | 3 | 部门数据 | 部门经理看本部门 |
| `ORGANIZATION` | 4 | 组织数据 | 公司管理员看全公司 |
| `ALL` | 5 | 全部数据 | 超级管理员 |

### 9.2 默认角色映射

```typescript
export const DEFAULT_ROLE_SCOPE_MAP: Record<number, DataScope> = {
  1: DataScope.ALL,           // 超级管理员
  2: DataScope.ORGANIZATION,  // 组织管理员
  // 其他角色按需配置
}
```

### 9.3 接口

```typescript
export enum DataScope { NONE, SELF, FAMILY, DEPARTMENT, ORGANIZATION, ALL }

export interface ScopeFilter {
  scope: DataScope
  condition?: SQL  // 注入到 WHERE 子句的条件
}

/** 根据用户角色 + 部门构建数据过滤条件 */
export function buildScopeFilter(opts: {
  userId: string
  roleId: number
  deptId?: string
  familyId?: string
  tenantId?: string
}): ScopeFilter

/** 单点判定:用户能否访问某条数据 */
export function canAccess(scope: DataScope, opts: {
  ownerId: string
  ownerDeptId?: string
  ownerFamilyId?: string
  ownerTenantId?: string
  viewerId: string
  viewerDeptId?: string
  viewerFamilyId?: string
  viewerTenantId?: string
}): boolean
```

### 9.4 后端使用

```typescript
// apps/api/src/routes/orders.ts
server.get('/orders', async (request) => {
  const filter = buildScopeFilter({
    userId: request.jwtPayload!.sub,
    roleId: request.jwtPayload!.roleId,
    deptId: request.user.deptId,
    tenantId: request.tenantId,
  })
  const orders = await db.query.orders.findMany({
    where: and(eq(orders.tenantId, request.tenantId), filter.condition),
  })
  return success(orders)
})
```

---

## 10. 多租户隔离

### 10.1 认证链路中的租户解析

`apps/api/src/plugins/tenant.ts`:

```typescript
// 1. 解析租户标识(优先级:X-Tenant-Id header > subdomain)
const identifier = resolveTenantIdentifier(request)

// 2. 查询租户(UUID 按 id,否则按 slug,60s 缓存)
const tenant = await lookupTenant(identifier)

// 3. 严格模式校验
if (TENANT_STRICT_MODE && !tenant) {
  throw new AppError('FORBIDDEN', '未知租户')
}

// 4. 注入 request.tenantId
request.tenantId = tenant?.id ?? DEFAULT_TENANT_ID

// 5. 异步自增配额
reply.addHook('onResponse', async () => {
  await db.update(tenants).set({ apiCallsUsed: sql`api_calls_used + 1` })
    .where(eq(tenants.id, tenant.id))
})
```

### 10.2 JWT claim 与 tenant 解析优先级

| 来源 | 优先级 | 场景 |
| --- | --- | --- |
| `X-Tenant-Id` header | 1 | 跨租户管理员显式指定 |
| subdomain(如 `acme.ihui.ai`) | 2 | SaaS 多租户默认 |
| JWT `tenantId` claim | 3 | 单租户用户回退 |

### 10.3 RLS 行级安全

数据库层用 PostgreSQL RLS 强制隔离,即使应用层漏注入 `tenant_id` 也无法跨租户读写:

```sql
-- 0066_rls_tenant_isolation.sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;  -- 对 owner 也强制

CREATE POLICY users_tenant_iso_select ON users FOR SELECT USING (
  current_setting('app.bypass_rls', true) = 'true'
  OR tenant_id = current_setting('app.tenant_id', true)::uuid
);
```

应用层通过 `withTenant` 包装事务:

```typescript
// packages/database/src/rls.ts
export async function withTenant<T>(db, tenantId: string, fn: (tx) => Promise<T>): Promise<T> {
  if (!isValidTenantId(tenantId)) throw new Error('invalid tenant_id')
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx)
  })
}
```

> 多租户架构全貌(分库路由 / 读副本故障转移)参见 [architecture.md §12](./architecture.md) 与 [DATABASE.md §6](./DATABASE.md#6-rls-行级安全)。

---

## 11. WebSocket 鉴权

### 11.1 WS token 隔离

WebSocket 连接使用独立的 `type='ws'` token,**5 分钟过期**,与 access/refresh token 类型隔离:

```typescript
// packages/auth/src/ws-auth.ts
export function generateWsToken(payload: { sub: string; roleId: number; tenantId?: string }): string
export function verifyWsToken(token: string): JwtPayload  // 拒绝 access/refresh token
```

### 11.2 socket.io v4 中间件

```typescript
export function createWsAuthMiddleware(io: Server) {
  return io.use(async (socket, next) => {
    const token = extractToken(socket)
    if (!token) return next(new Error('未提供 token'))
    try {
      const payload = verifyWsToken(token)
      socket.data.userId = payload.sub
      socket.data.roleId = payload.roleId
      socket.data.tenantId = payload.tenantId
      next()
    } catch (err) {
      next(new Error('token 无效'))  // 客户端收到 connect_error
    }
  })
}
```

### 11.3 token 提取优先级

```typescript
function extractToken(socket: Socket): string | null {
  // 1. socket.handshake.auth.token(推荐,不暴露在 URL)
  if (socket.handshake.auth.token) return socket.handshake.auth.token
  // 2. socket.handshake.headers.authorization(Bearer token)
  const auth = socket.handshake.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  // 3. socket.handshake.query.token(兼容旧客户端,日志会记录 URL)
  if (typeof socket.handshake.query.token === 'string') return socket.handshake.query.token
  return null
}
```

| 来源 | 优点 | 缺点 |
| --- | --- | --- |
| `auth.token` | 不暴露在 URL / 日志 | 需客户端主动传 |
| `Authorization` header | 标准 | 部分浏览器不支持 WS 自定义 header |
| `query.token` | 兼容性最好 | URL 日志泄露 token |

### 11.4 前端连接示例

```typescript
import { io } from 'socket.io-client'
import { generateWsToken } from '@ihui/auth'  // 客户端不能签发,需从 API 获取

// 1. 先调 API 拿 ws token
const wsToken = await fetch('/auth/ws-token').then(r => r.json().data.token)

// 2. 建立连接
const socket = io('/ws/chat', {
  auth: { token: wsToken },
})
socket.on('connect_error', (err) => {
  console.error('WS 连接失败:', err.message)
})
```

---

## 12. Key rotation 密钥轮换

### 12.1 6 阶段状态机

`packages/auth/src/key-rotation.ts` 的 `JwtKeyRotator` 类:

| Phase | 含义 | 签发 | 验证 |
| --- | --- | --- | --- |
| `stable` | 当前密钥稳定运行 | 当前 key | 当前 key |
| `canary` | 灰度(默认 10%)试新 key | 10% 概率用新 key | 新 key + 当前 key |
| `rollout` | 全量切新 key | 新 key | 新 key + 当前 key |
| `deprecating` | 旧 key 宽限期(默认 1 天) | 新 key | 新 key + 旧 key |
| `rotated` | 轮换完成 | 新 key | 新 key |
| `rolled_back` | 回滚到旧 key | 旧 key | 旧 key + 新 key(宽限期) |

### 12.2 接口

```typescript
export class JwtKeyRotator {
  constructor(opts: { redis?: RedisClient; gracePeriodSec?: number; canaryRatio?: number })

  /** 开始轮换:生成新 key,进入 canary */
  async rotateKey(): Promise<void>

  /** canary → rollout(灰度全量) */
  async advanceRollout(): Promise<void>

  /** rollout → deprecating → rotated(完成轮换) */
  async complete(): Promise<void>

  /** 任意阶段回滚 */
  async rollback(): Promise<void>

  /** 验证(带宽限期:先试当前 key,失败试上一个 key) */
  async verifyWithGracePeriod(token: string): Promise<JwtPayload>
}
```

### 12.3 Redis 状态持久化

| Key | 值 | TTL |
| --- | --- | --- |
| `jwt:key-rotation:state` | JSON `{ phase, currentKey, previousKey, startedAt }` | `gracePeriodSec * 2` |

Redis 不可用时降级为内存状态(单实例有效,多实例不一致)。

### 12.4 轮换流程示例

```bash
# 1. 开始轮换(生成新 key,10% 灰度)
curl -X POST /admin/key-rotation/rotate -H "Authorization: Bearer <admin-token>"

# 2. 观察监控 10 分钟,无异常 → 全量
curl -X POST /admin/key-rotation/advance -H "Authorization: Bearer <admin-token>"

# 3. 等待 1 天宽限期(所有旧 token 自然过期)→ 完成
curl -X POST /admin/key-rotation/complete -H "Authorization: Bearer <admin-token>"

# 异常时回滚
curl -X POST /admin/key-rotation/rollback -H "Authorization: Bearer <admin-token>"
```

### 12.5 默认参数

| 参数 | 默认值 | env 覆盖 |
| --- | --- | --- |
| 灰度比例 | 0.1(10%) | `JWT_KEY_ROTATION_CANARY_RATIO` |
| 宽限期 | 1 天(86400 秒) | `JWT_KEY_ROTATION_GRACE_PERIOD_SEC` |

---

## 13. 限流

### 13.1 全局限流

| 环境 | 限制 | 配置 |
| --- | --- | --- |
| 生产 | 100 req/min per IP | `apps/api/src/server.ts` rateLimit 插件 |
| 开发 | 1000 req/min per IP | 同上 |

```typescript
// apps/api/src/server.ts
server.register(rateLimit, {
  max: config.NODE_ENV === 'production' ? 100 : 1000,
  timeWindow: '1 minute',
  redis: server.redis,  // 多实例共享计数
})
```

### 13.2 auth 端点专属限流

防暴力破解,auth 路由组独立限流:

| 端点 | 限制 | 原因 |
| --- | --- | --- |
| `POST /auth/login` | 10/min per IP | 防密码爆破 |
| `POST /auth/register` | 5/min per IP | 防批量注册 |
| `POST /auth/sms/send-code` | 1/min per phone | 防短信轰炸 |
| `POST /auth/2fa/challenge` | 5/min per user | 防 TOTP 爆破 |
| `POST /auth/refresh` | 30/min per user | 防刷新滥用 |

```typescript
// apps/api/src/routes/auth.ts
server.post('/login', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, loginHandler)
```

### 13.3 限流响应

超限返回 429:

```json
{
  "code": 429,
  "message": "请求过于频繁,请稍后再试",
  "errorCode": "RATE_LIMITED",
  "retryAfter": 60
}
```

响应头包含 `Retry-After: 60`(秒)。

---

## 14. API Key / PAT / SK 三种凭证

### 14.1 三种凭证对比

| 凭证 | 全称 | 表 | 端点 | 用途 |
| --- | --- | --- | --- | --- |
| API Key | Developer API Key | `developerApiKeys` | `/admin/api-keys` | 第三方开发者调用 `/v1/*` 公开 API |
| PAT | Personal Access Token | `personalAccessTokens` | `/auth/pat` | 用户脚本 / CLI 工具调用 API(替代密码登录) |
| SK | User Secret Key | `developerApiKeys` | `/user-sk` | 用户绑定第三方 AI 厂商密钥(OpenAI / Anthropic 等) |

### 14.2 API Key(开发者)

- **场景**:第三方开发者通过 `/v1/*` 公开 API 调用平台能力
- **权限**:绑定到具体租户,受 DataScope 限制
- **认证方式**:`X-API-Key` header

```bash
curl https://api.ihui.ai/v1/chat \
  -H "X-API-Key: ihui_sk_xxxxxxxx"
```

### 14.3 PAT(个人访问令牌)

- **场景**:用户为自己的脚本 / CLI 工具签发长期 token,无需每次登录
- **权限**:继承用户角色权限
- **认证方式**:`Authorization: Bearer <pat>`
- **管理**:用户可在 `/auth/pat` 端点创建 / 撤销 / 列出 PAT

```bash
# 创建 PAT(命名 + 30 天过期)
curl -X POST /auth/pat -H "Authorization: Bearer <access-token>" \
  -d '{"name": "my-script", "expiresInDays": 30}'
# 返回 pat_xxxxxxxx(只此一次,后续不可见)

# 用 PAT 调 API
curl /api/orders -H "Authorization: Bearer pat_xxxxxxxx"
```

### 14.4 SK(用户密钥)

`apps/api/src/routes/user-sk.ts` 4 个端点管理用户绑定的第三方 AI 厂商密钥:

| 端点 | 方法 | 用途 |
| --- | --- | --- |
| `/user-sk` | POST | 创建 SK(加密存储) |
| `/user-sk` | GET | 列出当前用户 SK(脱敏) |
| `/user-sk/:id` | PATCH | 更新 SK |
| `/user-sk/:id` | DELETE | 删除 SK |

- **存储**:`developerApiKeys` 表,密钥用 AES-256-GCM 加密(`CREDENTIALS_ENCRYPTION_KEY`)
- **用途**:用户绑定自己的 OpenAI / Anthropic / 通义千问等 key,调用 AI 时用用户自己的额度
- **脱敏**:列表接口只返回 `sk-****1234` 末 4 位,不返回明文

```bash
# 绑定 OpenAI key
curl -X POST /user-sk -H "Authorization: Bearer <access-token>" \
  -d '{"provider": "openai", "key": "sk-xxxxxxxx"}'

# AI 调用时后端自动解密使用用户 SK,不走平台额度
```

---

## 15. 前端集成

### 15.1 useAuth Hook

`apps/web/src/hooks/use-auth.ts`:

```typescript
export function useAuth() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()

  const login = async (phone: string, password: string) => {
    const res = await fetchApi<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    })
    if (res.success) {
      setTokenWithPrefs(res.data.accessToken, res.data.refreshToken)
      useAuthStore.getState().setAuthenticated(res.data.user)
    }
    return res
  }

  const logout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' })
    clearTokens()
    useAuthStore.getState().logout()
    router.push('/')
  }

  const refreshToken = async (): Promise<boolean> => { /* ... */ }

  return { user, isAuthenticated, login, logout, refreshToken }
}
```

### 15.2 Token 存储策略(强制)

| Token | 存储位置 | 原因 |
| --- | --- | --- |
| access token | httpOnly cookie `auth_token` | 防 XSS 读取 |
| refresh token | httpOnly cookie `refresh_token` | 防 XSS 读取 |
| isAuthenticated | zustand persist(localStorage) | 仅布尔值,无敏感信息 |
| user | zustand persist(localStorage) | 仅用户基本信息,无 token |

**严禁** `localStorage.setItem('token', ...)` 持久化 JWT,仅持久化 `isAuthenticated` + `user`。

### 15.3 autoLogin 偏好

`setTokenWithPrefs` 根据用户"记住我"偏好设置 cookie max-age:

```typescript
export function setTokenWithPrefs(accessToken: string, refreshToken: string, remember = false) {
  const maxAge = remember ? 30 * 24 * 60 * 60 : undefined  // 30 天 or session
  document.cookie = `auth_token=${accessToken}; path=/; httpOnly; secure; sameSite=strict${maxAge ? `; max-age=${maxAge}` : ''}`
  // refresh token 同理
}
```

### 15.4 401 拦截与自动刷新

`packages/api-client/src/client.ts` 的 `fetchApi` 内置 401 自动刷新:

```typescript
let isRefreshing = false
let pendingRequests: Array<() => void> = []

async function fetchOnce<T>(url: string, options: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, options)
  if (response.status === 401 && !url.includes('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      isRefreshing = false
      if (refreshRes.ok) {
        pendingRequests.forEach(cb => cb())
        pendingRequests = []
        return fetchOnce(url, options)  // 重试原请求
      } else {
        // refresh 失败 → 跳登录
        window.location.href = '/login'
        return { success: false, error: '登录已过期' }
      }
    } else {
      // 并发请求排队等待 refresh 完成
      return new Promise(resolve => {
        pendingRequests.push(() => resolve(fetchOnce(url, options)))
      })
    }
  }
  // ... 正常处理
}
```

### 15.5 zustand store

`apps/web/src/stores/auth.ts`:

```typescript
interface AuthState {
  isAuthenticated: boolean
  user: User | null
  setAuthenticated: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      setAuthenticated: (user) => set({ isAuthenticated: true, user }),
      logout: () => set({ isAuthenticated: false, user: null }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, user: state.user }),
      // 不持久化其他字段
    },
  ),
)
```

---

## 16. 端到端调用示例

### 16.1 完整登录 → 调用 → 刷新 → 登出流程

```bash
# 1. 登录(手机号 + 密码)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "phone": "13800138000",
    "password": "MyPassword123"
  }'

# 响应(token 同时通过 httpOnly cookie 和 body 返回)
# {
#   "code": 0,
#   "message": "success",
#   "data": {
#     "accessToken": "eyJhbGci...",
#     "refreshToken": "eyJhbGci...",
#     "user": { "id": "uuid", "phone": "13800138000", "roleId": 0 }
#   }
# }
```

```bash
# 2. 调用受保护端点(Bearer token)
curl http://localhost:3001/api/users/me \
  -H "Authorization: Bearer eyJhbGci..." \
  -b cookies.txt

# 响应
# {
#   "code": 0,
#   "message": "success",
#   "data": { "id": "uuid", "phone": "13800138000", "roleId": 0, "nickname": "..." }
# }
```

```bash
# 3. access token 过期后刷新(refresh token 在 cookie 中)
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Authorization: Bearer <expired-access>" \
  -b cookies.txt

# 响应(新 access + 新 refresh,旧 refresh 立即失效)
# {
#   "code": 0,
#   "message": "success",
#   "data": {
#     "accessToken": "eyJhbGci...(new)",
#     "refreshToken": "eyJhbGci...(new)"
#   }
# }
```

```bash
# 4. 登出(撤销当前 token)
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer eyJhbGci..." \
  -b cookies.txt

# 响应
# { "code": 0, "message": "success", "data": null }
# 后续用该 token 调 API → 401 UNAUTHORIZED "token 已撤销"
```

### 16.2 2FA 登录流程

```bash
# 1. 首次登录(密码验证通过,但 2FA 已启用 → 返回 challenge_token)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "phone": "13800138000", "password": "MyPassword123" }'

# 响应
# {
#   "code": 0,
#   "data": {
#     "challengeToken": "eyJhbGci...(type=challenge, 5min)",
#     "twoFactorRequired": true
#   }
# }
```

```bash
# 2. 提交 TOTP code
curl -X POST http://localhost:3001/api/auth/2fa/challenge \
  -H "Authorization: Bearer <challenge-token>" \
  -H "Content-Type: application/json" \
  -d '{ "code": "123456" }'

# 响应(正式 access + refresh token)
# { "code": 0, "data": { "accessToken": "...", "refreshToken": "...", "user": {...} } }
```

```bash
# 2b. 或用 backup code(单次使用)
curl -X POST http://localhost:3001/api/auth/2fa/challenge \
  -H "Authorization: Bearer <challenge-token>" \
  -H "Content-Type: application/json" \
  -d '{ "backupCode": "a1b2c3d4e5" }'
```

### 16.3 OAuth2 PKCE 流程

```bash
# 1. 客户端生成 verifier + challenge(Node.js)
node -e "
const crypto = require('crypto')
const verifier = crypto.randomBytes(32).toString('base64url')
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
console.log({ verifier, challenge })
"
# { verifier: 'abc...', challenge: 'xyz...' }
```

```bash
# 2. 发起 OAuth2(重定向到 IdP)
curl -v "http://localhost:3001/api/auth/sso/github?code_challenge=xyz...&code_challenge_method=S256&state=csrf_token"
# 302 Location: https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&state=csrf_token
```

```bash
# 3. IdP 回调(浏览器自动跟随)
# GET /api/auth/sso/github/callback?code=auth_code&state=csrf_token
# 验证 state,返回 code 给前端
```

```bash
# 4. 用 code + verifier 换 token
curl -X POST http://localhost:3001/api/auth/sso/github/token \
  -H "Content-Type: application/json" \
  -d '{
    "code": "auth_code",
    "code_verifier": "abc..."
  }'

# 响应(验证 base64url(sha256(verifier)) === challenge,消费 code)
# { "code": 0, "data": { "accessToken": "...", "refreshToken": "...", "user": {...} } }
```

### 16.4 WebSocket 连接

```javascript
// 前端
import { io } from 'socket.io-client'

// 1. 获取 ws token(5min 过期)
const res = await fetch('/api/auth/ws-token', {
  headers: { Authorization: `Bearer ${accessToken}` },
})
const { token: wsToken } = await res.json().data

// 2. 建立 WS 连接
const socket = io('http://localhost:3001/ws/chat', {
  auth: { token: wsToken },
  transports: ['websocket'],
})

socket.on('connect', () => console.log('WS 已连接'))
socket.on('connect_error', (err) => console.error('WS 连接失败:', err.message))
socket.on('message', (data) => console.log('收到消息:', data))

// 3. ws token 过期后需断开重连(重新获取 ws token)
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // 服务器主动断开(token 过期),重新获取 token 后重连
  }
})
```

### 16.5 PAT 调用示例

```bash
# 1. 创建 PAT
curl -X POST http://localhost:3001/api/auth/pat \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "my-script", "expiresInDays": 30 }'

# 响应(pat 只此一次返回明文)
# { "code": 0, "data": { "token": "pat_xxxxxxxx", "id": "uuid", "name": "my-script" } }
```

```bash
# 2. 用 PAT 调 API(等价于 access token)
curl http://localhost:3001/api/orders \
  -H "Authorization: Bearer pat_xxxxxxxx"
```

### 16.6 多租户调用

```bash
# 显式指定租户(X-Tenant-Id header)
curl http://localhost:3001/api/orders \
  -H "Authorization: Bearer <access-token>" \
  -H "X-Tenant-Id: acme-corp"

# 或 subdomain(生产)
curl https://acme.ihui.ai/api/orders \
  -H "Authorization: Bearer <access-token>"
```

### 16.7 TypeScript 客户端(@ihui/api-client)

```typescript
import { fetchApi, setBaseUrl, setTokenProvider } from '@ihui/api-client'

// 1. 配置
setBaseUrl('http://localhost:3001')
setTokenProvider({ getToken: () => getCookie('auth_token') })

// 2. 调用(自动带 Authorization header + 401 自动刷新)
const res = await fetchApi<{ id: string; name: string }>('/users/me')
if (res.success) {
  console.log(res.data.name)
} else {
  console.error(res.error, res.errorCode)
}
```

---

## 附录:环境变量速查

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | (必填) | HS256 密钥,≥ 32 字符,禁弱默认值 |
| `JWT_ACCESS_TTL_SECONDS` | 900(15min) | access token TTL,范围 60-86400 |
| `JWT_REFRESH_TTL_DAYS` | 30 | refresh token TTL(天) |
| `JWT_WS_TTL_SECONDS` | 300(5min) | ws token TTL |
| `CREDENTIALS_ENCRYPTION_KEY` | (必填) | 2FA secret / SK 加密 key,AES-256-GCM |
| `JWT_KEY_ROTATION_CANARY_RATIO` | 0.1 | 密钥轮换灰度比例 |
| `JWT_KEY_ROTATION_GRACE_PERIOD_SEC` | 86400(1 天) | 密钥轮换宽限期 |
| `TENANT_STRICT_MODE` | false | 严格租户模式(未知租户拒绝) |
| `OAUTH_CODE_TTL_SECONDS` | 600(10min) | authorization code TTL |
