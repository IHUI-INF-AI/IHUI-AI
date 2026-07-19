# 数字人 API 端点补充开发报告

> 生成时间:2026-07-19T23:24:58(Asia/Shanghai)
> 任务来源:剩余 API 端点评估 P0 补开发项
> 关联 D 盘源码:`d:\历史项目存档\code\ljd-交接文件\ZHS_Server_java\src\main\java\com\ai\manager\mcp\controller\AliAIController.java`

---

## 1. 端点路径映射(Java → IHUI-AI)

| # | Java 原路径(D 盘 AliAIController) | HTTP 方法 | IHUI-AI 新路径 | HTTP 方法 | 路由前缀 |
| --- | --- | --- | --- | --- | --- |
| 1 | `/ali/get/digital/{type}` | GET | `/api/ai/alibaba/digital/get` | POST | `/api/ai`(由 `aiVendorRoutes` 注册) |
| 2 | `/ali/video/to/digital` | POST | `/api/ai/alibaba/digital/video-to-digital` | POST | `/api/ai` |

**说明**:
- Java 原端点 1 使用 path 参数 `{type}`;IHUI-AI 改为 POST + body 字段 `param`(支持 type 数字字符串或 digitalId),便于统一鉴权与请求体校验。
- 路由通过 `apps/api/src/routes/ai-vendors.ts` 的 `aiVendorRoutes` 聚合,经 `apps/api/src/server.ts` 第 648 行 `server.register(aiVendorRoutes, { prefix: '/api/ai' })` 注册,**无需修改 server.ts**。

---

## 2. 请求/响应 Schema(Zod)

### 端点 1:数字人获取 `POST /api/ai/alibaba/digital/get`

**请求体**(`digitalGetBody`,定义于 `_shared.ts`):
```typescript
{
  param: string  // 必填,数字人 type(0-4)或 digitalId
}
```

**响应**:
```typescript
{
  code: 0,
  message: 'success',
  data: {
    digitalHuman: DigitalHuman[] | Record<string, DigitalHuman[]>,  // type==3 时按 imageName 分组
    remote: Record<string, unknown> | null,  // 阿里云 Avatar QueryAvatar 原始返回(若 AK/SK 已配置)
    count: number
  }
}
```

**`DigitalHuman` 实体**(对齐 Java `ZhsUserAgentImage`):
```typescript
{
  digitalId: string
  userId: string
  type: number          // 0=音频 | 1=图像 | 2=视频 | 3=全部 | 4=图片路径
  imageName: string
  videoUrl?: string
  audioUrl?: string
  imageUrl?: string
  platform: 'Ali'
  taskId?: string       // 本平台异步任务 ID
  alibabaTaskId?: string // 阿里云 Avatar 任务 ID
  status: 'processing' | 'ready' | 'failed'
  createdAt: number
  updatedAt: number
}
```

### 端点 2:视频转数字人 `POST /api/ai/alibaba/digital/video-to-digital`

**请求体**(`videoToDigitalBody`,定义于 `_shared.ts`):
```typescript
{
  videoUrl: string     // 必填,视频 URL
  imageName?: string   // 可选,形象名称(默认 `digital_${Date.now()}`)
  type?: number        // 可选,0-4,默认 3(提交全部)
}
```

**响应**:
```typescript
{
  code: 0,
  message: 'success',
  data: {
    digitalHuman: DigitalHuman,
    taskId: string,         // 本平台异步任务 ID(写入 taskStore)
    alibabaTaskId?: string  // 阿里云 Avatar 任务 ID(若 AK/SK 已配置)
  }
}
```

---

## 3. 业务逻辑摘要(源自 D 盘 Java)

### Java `AliAIServiceImpl.videoToDigital(videoUrl, userUuid, progress, imageName)`

按 `progress` 分支处理(D 盘 `AliAIServiceImpl.java` 第 320-410 行):

| type | 含义 | Java 行为 | IHUI-AI TS 实现 |
| --- | --- | --- | --- |
| 0 | 提交音频 | `mcpResourceService.videoToAudio(videoUrl)` 提取音频 + `saveAudioImage` 保存 | 写入 `digitalHumanStore`,标记 `audioUrl` 占位;若配置 AK/SK 则调用阿里云 Avatar `SubmitAvatarTask` 异步处理 |
| 1 | 提交图像 | `minioUploader.extractAndUploadFirstFrame(videoUrl, "jpg", 5)` 提取首帧 | 写入 `digitalHumanStore`,标记 `imageUrl` 占位;同上调用 Avatar |
| 2 | 提交视频 | 直接 `imageMapper.addOrUpdate` 保存 videoUrl | 写入 `digitalHumanStore`,仅记录 `videoUrl` |
| 3 | 提交全部 | 0+1+2 三者都做 | 写入 `digitalHumanStore`,同时标记 `audioUrl` + `imageUrl` |
| 4 | 图片路径 | 直接将 videoUrl 当作图片路径写入 type=1 记录 | 写入 `digitalHumanStore`,仅记录 `imageUrl` |

**鉴权前置**:Java 在 `progress != 3 && progress != 4` 时调用 `checkPay(userUuid, progress, null)` 校验付费;IHUI-AI 改为统一 `requireAuth`(authenticate),付费校验延后到上层业务(避免与现有 `packages/auth` 解耦破坏)。

### Java `AliAIServiceImpl.getDigital(userUuid, type)`

- 调用 `imageMapper.getList(ZhsUserAgentImage.builder().userUuid(userUuid).type(type).build())` 查询
- `type == 3` 时按 `imageName` 分组(`Collectors.groupingBy`)
- 其他 type 直接返回 list

**IHUI-AI TS 实现**:
- 从 `digitalHumanStore` 按 `userId + type` 过滤
- `param` 为 digitalId 时直接返回该记录
- `param` 为非数字字符串时返回当前用户全部数字人
- `typeNum == 3` 时按 `imageName` 分组(对齐 Java)
- 若配置 AK/SK,同时调用阿里云 Avatar `QueryAvatar` 拉取远端形象(`remote` 字段)

---

## 4. 阿里云 API 调用方式

### 调用方式:REST API + ACS3-HMAC-SHA256 签名(无 SDK)

**原因**:当前 `apps/api` 未集成阿里云 SDK;遵循现有 `buildTencentHeaders`(TC3-HMAC-SHA256)/ `volcengineSign`(HMAC-SHA256)模式,新增 `buildAlibabaCloudHeaders` 实现阿里云 ACS3 签名。

### 实现位置

`apps/api/src/routes/ai-vendors/_shared.ts` 第 285-355 行:

```typescript
export function buildAlibabaCloudHeaders(
  action: string,
  queryParams: Record<string, string>,
  body: unknown,
  accessKeyId: string,
  accessKeySecret: string,
  endpoint = 'avatar.cn-beijing.aliyuncs.com',
  service = 'avatar',
  region = 'cn-beijing',
): { url: string; headers: Record<string, string>; body: string }
```

### 签名算法(ACS3-HMAC-SHA256)

1. **CanonicalRequest**:`POST\n/\n<CanonicalQuerystring>\n<CanonicalHeaders>\n<SignedHeaders>\n<HashedPayload>`
2. **StringToSign**:`ACS3-HMAC-SHA256\n<HashedCanonicalRequest>`
3. **CredentialScope**:`<date>/<region>/<service>/aliyun_v3_request`
4. **派生密钥链**:`HMAC-SHA256(HMAC-SHA256(HMAC-SHA256(HMAC-SHA256(<SK>, <date>), <region>), <service>), "aliyun_v3_request")`
5. **Authorization header**:`ACS3-HMAC-SHA256 Credential=<AK>/<scope>, SignedHeaders=<headers>, Signature=<sig>`

### 调用端点

| Action | 用途 | 调用位置 |
| --- | --- | --- |
| `QueryAvatar` | 拉取远端数字人形象列表 | `proxy-extended.ts` `POST /alibaba/digital/get` |
| `SubmitAvatarTask` | 提交视频转数字人异步任务 | `proxy-extended.ts` `POST /alibaba/digital/video-to-digital` |

### 调用示例

```typescript
const signed = buildAlibabaCloudHeaders(
  'SubmitAvatarTask',
  {},
  { VideoUrl: videoUrl, ImageName: imageName, Type: type },
  akId,
  akSecret,
)
const resp = await fetchWithTimeout(signed.url, { method: 'POST', headers: signed.headers, body: signed.body }, 60_000)
```

---

## 5. 鉴权与统一响应

### 鉴权

- 通过 `extendedVendorRoutes` 顶层 `preHandler` 钩子调用 `requireAuth(request, reply)`(基于 `packages/auth` 的 `authenticate` 函数)
- 所有 2 个端点均要求登录,失败返回 401

### 统一响应格式

- 成功:`success(data)` → `{ code: 0, message: 'success', data }`
- 失败:`error(code, message)` → `{ code, message }`
- 阿里云调用失败:HTTP 502 + `{ code: 502, message: '阿里云数字人调用失败: <status> <body>' }`
- 请求超时:HTTP 502 + `{ code: 502, message: '阿里云数字人调用异常: 请求超时' }`

---

## 6. 环境变量需求

| 变量名 | 用途 | 必填 | 默认 |
| --- | --- | --- | --- |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 阿里云 AK,用于 ACS3 签名 | 否(未配置时仅本地存储) | — |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 阿里云 SK,用于 ACS3 签名 | 否(未配置时仅本地存储) | — |

**降级行为**:若 AK/SK 未配置,2 个端点仍可正常工作,仅本地 `digitalHumanStore` 读写,`remote`/`alibabaTaskId` 字段为 `null`/`undefined`。这保证开发环境零配置可启动,生产环境配置 AK/SK 后自动启用阿里云 Avatar 调用。

---

## 7. 受影响文件清单

| 文件(绝对路径) | 改动类型 | 说明 |
| --- | --- | --- |
| `g:\IHUI-AI\apps\api\src\routes\ai-vendors\_shared.ts` | 扩展 | 新增 `alibaba` vendor 配置、`DigitalHuman` 接口、`digitalHumanStore`、`buildAlibabaCloudHeaders` 函数、`digitalGetBody`/`videoToDigitalBody`/`digitalIdParam` schema |
| `g:\IHUI-AI\apps\api\src\routes\ai-vendors\proxy-extended.ts` | 扩展 | 新增 section 14「Alibaba 数字人」2 端点,导入新 symbols |
| `g:\IHUI-AI\apps\api\src\server.ts` | **未修改** | 路由已通过 `aiVendorRoutes` 间接注册,无需改动 |
| `g:\IHUI-AI\reports\digital-human-endpoints-supplement-2026-07-19T23-24-58.md` | 新建 | 本报告 |

---

## 8. 验证结果

### typecheck

```bash
pnpm --filter @ihui/api typecheck
```

**结果**:exit code 0(全绿,无 TS 错误)

输出:
```
> @ihui/api@0.0.0 typecheck G:\IHUI-AI\apps\api
> tsc --noEmit
```

### 守门规则遵守

- ✅ Fastify 5 路由风格(`server.post(path, { schema }, handler)`)
- ✅ Zod 校验请求体(`digitalGetBody.parse` / `videoToDigitalBody.parse`)
- ✅ `packages/auth` 的 `authenticate` 函数(经 `requireAuth` 包装)
- ✅ 统一响应 `{ code, message, data }` 格式(`success` / `error` helper)
- ✅ 参考 D 盘 Java controller 业务逻辑,TS 重写
- ✅ 未使用阿里云 SDK,改用 `fetch` + ACS3-HMAC-SHA256 签名(对齐 Tencent/Volcengine 模式)
- ✅ AK/SK 通过 `process.env.ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` 读取
- ✅ 未修改 `packages/database/*` / `apps/web/*` / `PROJECT_PLAN.md` / `AGENTS.md`
- ✅ 未执行 `git add` / `git commit`

---

## 9. 后续建议

1. **付费校验**:Java 原版在 `progress != 3 && progress != 4` 时调用 `checkPay`,当前 IHUI-AI 未实现;若业务需要,可在路由内引入订单/积分服务做前置校验。
2. **真实音视频处理**:当前 `audioUrl`/`imageUrl` 为占位(`${videoUrl}#audio` / `#image`);生产环境应接入阿里云 Avatar 任务回调或 OSS 存储真实产物 URL。
3. **持久化**:`digitalHumanStore` 为内存 Map(对齐 `timbreStore`/`aigcStore`);若需持久化,后续可在 `packages/database` 新增 `digital_human` 表(需单独任务,不在本次范围)。
4. **多端同步**:本任务仅后端 API,前端 `apps/web` 数字人页面与 `apps/miniapp-taro` 等端待后续任务对接。
5. **阿里云 Avatar API 版本**:当前固定 `Version: 2022-01-30`;若阿里云升级 API 版本,需同步更新 `buildAlibabaCloudHeaders` 默认值。
