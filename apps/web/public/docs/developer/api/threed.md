# 3D 模型 API

> 权限点:`threed:write`。本模块覆盖 1 个端点,异步任务模式,根据文本或图片生成 3D 模型。

## POST /v1/3d/generations

3D 模型生成,支持文本提示或图片输入。

**权限点**:`threed:write`

### 请求

```json
{
  "model": "threed-v1",
  "input": "一把现代风格的椅子",
  "format": "glb"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 3D 生成模型 ID |
| input | string | 是 | 文本提示或 base64 编码的图片 |
| format | string | 否 | 输出格式:`glb` / `obj` / `fbx` / `ply`,默认 glb |

### 响应(202)

```json
{
  "taskId": "threed-task-123",
  "status": "pending"
}
```

> 3D 生成通常耗时较长,需轮询任务状态。可通过 `GET /v1/generation/status/:id` 查询。

### 代码示例

**TypeScript(@ihui/sdk)**

```typescript
const task = await client.threed.generations({
  model: 'threed-v1',
  input: '一把现代风格的椅子',
  format: 'glb',
})
console.log(task.taskId)

// 轮询状态
let status = await client.generation.getStatus(task.taskId)
while (status.status === 'queued' || status.status === 'processing') {
  await new Promise(r => setTimeout(r, 10000))
  status = await client.generation.getStatus(task.taskId)
}
if (status.status === 'completed') {
  console.log('下载地址:', status.result)
}
```

**Python(ihui-ai)**

```python
task = client.threed.generations(
    model="threed-v1",
    input="一把现代风格的椅子",
    format="glb",
)
print(task["taskId"])
```

**cURL**

```bash
curl -X POST http://localhost:3001/v1/3d/generations \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"threed-v1","input":"一把椅子","format":"glb"}'
```

### 图片输入

```json
{
  "model": "threed-v1",
  "input": "data:image/png;base64,iVBORw0KG...",
  "format": "glb"
}
```

当 `input` 以 `data:image/` 开头时,识别为图片输入(图生 3D)。

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | input 为空 / model 为空 / 格式不支持 |
| 401 | API Key 无效 |
| 403 | 缺少 `threed:write` 权限 |
| 413 | 输入图片过大 |
| 429 | 配额超限 |
| 502 | 上游 3D 生成服务错误 |

---

*最后更新: 2026-07-22*
