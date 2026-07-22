# 故障排查

## 鉴权问题

### 401 Unauthorized

**症状**:所有请求返回 401,错误码 `auth_invalid_api_key`。

**排查步骤**:

1. 确认 API Key 格式正确(前缀 `ihui_`,非 `sk_`):
   ```bash
   echo $IHUI_API_KEY  # 应输出 ihui_xxx...
   ```
2. 确认 `Authorization` 头格式正确(`Bearer` 后有空格):
   ```bash
   curl -v "$IHUI_BASE_URL/v1/models" -H "Authorization: Bearer $IHUI_API_KEY" 2>&1 | grep "Authorization"
   ```
3. 确认 API Key 未被吊销(管理后台 → API Key 管理)
4. 确认 `baseUrl` 指向正确的服务地址

**解决方案**:
- 重新签发 API Key
- 检查环境变量是否正确加载(`console.log(process.env.IHUI_API_KEY)`)
- 若启用 Secret 二次校验,确认 `X-Api-Secret` 已传递

### 401 `auth_secret_required`

**症状**:错误信息 "API Secret required but not provided"。

**原因**:该 API Key 启用了 Secret 二次校验,但请求未携带 `X-Api-Secret` 头。

**解决方案**:
```typescript
const client = createClient({
  apiKey: process.env.IHUI_API_KEY!,
  secret: process.env.IHUI_API_SECRET, // 添加 secret
})
```

### 403 Forbidden

**症状**:错误 `insufficient_permissions`,提示 "requires 'xxx:yyy'"。

**排查步骤**:
1. 查看错误消息中提到的权限点(如 `chat:write`)
2. 在管理后台查看当前 API Key 的权限集
3. 对比端点文档中的"权限点"标注

**解决方案**:
- 在管理后台编辑 API Key,勾选所需权限
- 或创建新 API Key,授予所需权限子集
- 27 个权限点完整列表见 [身份认证](getting-started/authentication.md#权限点完整列表)

## 网络问题

### 连接超时

**症状**:SDK 抛出 `NetworkError`,提示 "timeout" 或 "ECONNREFUSED"。

**排查步骤**:
1. 确认服务在线:
   ```bash
   curl -I http://localhost:8802/v1/models
   # 应返回 200/401,而非 connection refused
   ```
2. 确认 `baseUrl` 配置正确:
   ```typescript
   console.log(client) // 检查 baseUrl
   ```
3. 检查防火墙 / 代理设置
4. 增加 SDK 超时时间:
   ```typescript
   const client = createClient({
     apiKey: 'ihui_xxx',
     timeout: 60000, // 60 秒
   })
   ```

### DNS 解析失败

**症状**:错误 `ENOTFOUND` 或 `getaddrinfo ENOTFOUND`。

**解决方案**:
- 检查 `baseUrl` 拼写
- 检查 `/etc/hosts`(Linux/macOS)或 `C:\Windows\System32\drivers\etc\hosts`(Windows)
- 检查 DNS 服务器配置

### 流式请求中断

**症状**:流式输出中途停止,SDK 抛出异常。

**排查步骤**:
1. 检查网络稳定性(ping 服务端)
2. 确认服务端未重启(`GET /v1/models` 测试连通性)
3. 检查代理 / CDN 是否对流式响应有超时限制

**解决方案**:
- 流式请求不重试,需重新发起完整请求
- 考虑保存已接收的内容,提示用户继续

## 请求参数问题

### 400 Bad Request `validation_failed`

**症状**:Zod 校验失败,响应包含 `param` 字段指示出错参数。

**常见原因**:

| 错误消息 | 原因 | 解决方案 |
|---------|------|---------|
| `messages must contain at least one message` | `messages` 数组为空 | 添加至少一条消息 |
| `model is required` | 缺少 `model` 字段 | 指定模型 ID |
| `topK must be positive integer` | `topK` 为 0 或负数 | 使用 ≥1 的整数 |
| `threshold must be between 0 and 1` | `threshold` 越界 | 使用 0-1 之间的浮点数 |
| `url must be a valid URL` | URL 格式错误 | 检查 URL 协议(http/https) |

**调试技巧**:
```bash
# 用 jq 检查请求体 JSON 格式
echo '{"model":"gpt-4","messages":[]}' | jq .
# 用 -v 查看 SDK 发送的实际请求
curl -v -X POST "$IHUI_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

### 413 Payload Too Large

**症状**:文件上传返回 413,错误 `file_too_large`。

**原因**:单次上传超过 50MB 限制。

**解决方案**:
- 改用分片上传(`upload-init` → `upload-chunk` → `complete`)
- 详见 [文件 API](api/files.md) 的分片上传章节

### 404 Not Found

**症状**:错误 `model_not_found` / `file_not_found` / `agent_not_found`。

**排查步骤**:
1. 确认 ID 正确(从列表接口获取):
   ```bash
   curl "$IHUI_BASE_URL/v1/models" -H "Authorization: Bearer $IHUI_API_KEY" | jq '.data[].id'
   ```
2. 模型 ID 大小写敏感(`gpt-4` ≠ `GPT-4`)
3. 检查 ID 是否已被删除

## 配额问题

### 429 `quota_exceeded`

**症状**:错误 "Hourly quota exceeded" 或 "Daily quota exceeded"。

**排查步骤**:
1. 查询当前配额:
   ```bash
   curl "$IHUI_BASE_URL/v1/me" -H "Authorization: Bearer $IHUI_API_KEY" | jq '.quota'
   ```
2. 检查 `Retry-After` 响应头(等待秒数)
3. 检查是否有异常高频调用

**解决方案**:
- 等待 `Retry-After` 秒数后重试
- 降低请求频率(实现并发控制,见 [最佳实践](best-practices.md#1-并发控制))
- 在管理后台调整 API Key 的 `rateLimit` 配额
- 升级账户套餐

### 429 `rate_limit_exceeded`

**症状**:错误 "Rate limit exceeded"(每分钟频率限制)。

**区别**:与 `quota_exceeded` 不同,这是每分钟并发限制,而非小时/天配额。

**解决方案**:
- 实现客户端限流(如令牌桶算法)
- 降低并发数
- SDK 默认不重试 429,需自行实现退避

## SDK 问题

### TypeScript 类型错误

**症状**:编译时报错 "Property 'xxx' does not exist on type 'IhuiClient'"。

**排查步骤**:
1. 确认 SDK 版本 ≥ 0.1.0:
   ```bash
   npm ls @ihui/sdk
   ```
2. 确认导入方式正确:
   ```typescript
   import { createClient } from '@ihui/sdk'  // ✅
   import { IhuiClient } from '@ihui/sdk'    // ❌ IhuiClient 是接口,不能直接 new
   ```
3. 确认方法名拼写(camelCase,非 snake_case):
   ```typescript
   client.ai.listModels()      // ✅
   client.ai.list_models()     // ❌ TS 用 camelCase
   ```

### Python ImportError

**症状**:`ModuleNotFoundError: No module named 'ihui_ai'`。

**解决方案**:
```bash
pip install ihui-ai
# 确认安装
python -c "import ihui_ai; print(ihui_ai.__version__)"
```

**症状**:`ImportError: cannot import name 'AsyncIhuiClient' from 'ihui_ai'`。

**原因**:SDK 版本过低或安装了错误包。

**解决方案**:
```bash
pip install --upgrade ihui-ai
```

### Python 异常未捕获

**症状**:Python SDK 抛出 `PermissionError` 但被内置 `PermissionError` 捕获。

**原因**:`ihui_ai.exceptions.PermissionError` 故意覆盖 Python 内置 `PermissionError`(文件系统权限错误),两者不冲突,但若代码同时捕获两者需注意顺序。

**解决方案**:
```python
from ihui_ai.exceptions import PermissionError as IhuiPermissionError

try:
    client.ai.completions({...})
except IhuiPermissionError as e:
    print(f"IHUI 权限不足: {e}")
# 若需同时处理文件系统权限,用完整路径区分
```

## 多模态问题

### 视频生成一直 `processing`

**症状**:`GET /v1/videos/tasks/:id` 长时间返回 `processing`。

**原因**:视频生成是异步任务,可能需要数分钟。

**解决方案**:
- 实现轮询(间隔 5-10 秒,超时 10 分钟)
- 或使用 Webhook 订阅(`/v1/messages/subscribe`)接收完成通知
- 详见 [最佳实践 → 异步任务管理](best-practices.md#1-视频生成等长任务轮询)

### 图像生成返回空 URL

**症状**:响应 `data[0].url` 为空,只有 `b64Json`。

**原因**:部分厂商(如 dashscope)默认返回 base64 而非 URL。

**解决方案**:
```typescript
const image = await client.images.generations({ model: 'dall-e-3', prompt: '...' })
const url = image.data[0].url
const b64 = image.data[0].b64Json
if (url) {
  // 直接使用 URL
} else if (b64) {
  // 解码 base64 保存为文件
  fs.writeFileSync('output.png', Buffer.from(b64, 'base64'))
}
```

## 知识库问题

### 语义搜索无结果

**症状**:`POST /v1/knowledge/search` 返回空 `data` 数组。

**排查步骤**:
1. 确认文档已入库:
   ```bash
   curl "$IHUI_BASE_URL/v1/knowledge/documents" -H "Authorization: Bearer $IHUI_API_KEY"
   ```
2. 降低 `threshold`(默认相似度阈值可能过高):
   ```json
   {"query": "...", "threshold": 0.3}
   ```
3. 增加 `topK`(返回数量)
4. 检查文档分块是否合理(`chunkStrategy` / `chunkSize`)

### 文档入库失败

**症状**:`POST /v1/knowledge/documents` 返回 500。

**排查步骤**:
1. 检查 ai-service 是否在线:
   ```bash
   curl "$IHUI_BASE_URL/v1/knowledge/health" -H "Authorization: Bearer $IHUI_API_KEY"
   ```
2. 确认 `content` 不为空
3. 检查 `chunkSize` 是否合理(推荐 500-1000)

## 调试技巧

### 启用 SDK 详细日志

**TypeScript**(通过自定义 fetch 拦截):

```typescript
const client = createClient({
  apiKey: 'ihui_xxx',
  fetch: async (url, init) => {
    console.log(`→ ${init.method} ${url}`)
    if (init.body) console.log(`  body: ${init.body}`)
    const resp = await fetch(url, init)
    console.log(`← ${resp.status}`)
    return resp
  },
})
```

**Python**(通过 logging):

```python
import logging
logging.basicConfig(level=logging.DEBUG)
# urllib.request 的日志会输出请求详情
```

### 用 cURL 复现问题

SDK 出错时,用 cURL 复现可排除 SDK 问题:

```bash
# 复现 SDK 的请求
curl -v -X POST "$IHUI_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hi"}]}'
```

### 检查响应头

```bash
curl -i "$IHUI_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[...]}'
```

关注以下响应头:
- `X-RateLimit-Remaining`:剩余配额
- `X-RateLimit-Reset`:配额重置时间
- `Retry-After`:429 时建议等待秒数
- `X-Request-Id`:请求追踪 ID(联系支持时提供)

## 常见错误速查表

| 错误码 | 含义 | 立即操作 |
|--------|------|---------|
| 400 `validation_failed` | 参数校验失败 | 检查 `param` 字段 |
| 401 `auth_invalid_api_key` | API Key 无效 | 检查/重新签发 Key |
| 401 `auth_secret_required` | 缺少 Secret | 添加 `X-Api-Secret` |
| 403 `insufficient_permissions` | 权限不足 | 编辑 Key 权限 |
| 404 `model_not_found` | 模型不存在 | 用 `GET /v1/models` 查可用模型 |
| 404 `file_not_found` | 文件不存在 | 用 `GET /v1/files` 查文件列表 |
| 409 `duplicate_preset` | MoA 预设重名 | 换名创建 |
| 413 `file_too_large` | 文件过大 | 改用分片上传 |
| 429 `quota_exceeded` | 配额超限 | 等待 `Retry-After` |
| 429 `rate_limit_exceeded` | 频率超限 | 降低并发 |
| 500 `internal_error` | 服务端异常 | 稍后重试,联系支持 |
| 502 `upstream_error` | 上游故障 | 检查 ai-service / 厂商 API |
| 503 `service_unavailable` | 服务不可用 | 等待恢复 |

## 获取帮助

如果以上排查仍未解决问题:

1. **查阅文档**:浏览 [API 概览](api/overview.md) 和各模块文档
2. **检查健康状态**:`GET /v1/knowledge/health` 可作为平台探针
3. **提供调试信息**:联系支持时提供以下信息
   - `X-Request-Id` 响应头
   - 完整的错误响应体(JSON)
   - 触发问题的最小复现请求(cURL 命令)
   - SDK 版本(`npm ls @ihui/sdk` / `pip show ihui-ai`)
   - 发生时间(精确到分钟)

---

*最后更新: 2026-07-22*
