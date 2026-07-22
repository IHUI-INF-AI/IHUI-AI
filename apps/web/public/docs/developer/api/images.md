# 图像 API

> 权限点:`images:write`(所有图像生成/编辑端点)。本模块覆盖 6 个端点,按 vendor 路由到对应厂商(dashscope / doubao / gemini / tongyi 等)。

## POST /v1/images/generations

文生图,根据文本提示生成图像。

**权限点**:`images:write`

### 请求

```json
{
  "model": "dall-e-3",
  "prompt": "一只在月球上弹吉他的猫,赛博朋克风格",
  "n": 1,
  "size": "1024x1024",
  "quality": "hd",
  "style": "vivid",
  "vendor": "dashscope"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 图像模型 ID |
| prompt | string | 是 | 图像描述 |
| n | number | 否 | 生成数量,默认 1 |
| size | string | 否 | 尺寸,如 `1024x1024` / `1792x1024` |
| quality | string | 否 | 质量:`standard` / `hd` |
| style | string | 否 | 风格:`vivid` / `natural` |
| vendor | string | 否 | 厂商:`dashscope` / `doubao` / `gemini` / `tongyi` |

### 响应(200)

```json
{
  "created": 1677652288,
  "data": [
    {
      "url": "https://example.com/generated.png",
      "revisedPrompt": "A cat playing guitar on the moon, cyberpunk style"
    }
  ]
}
```

> 返回 `url` 或 `b64Json`(二选一,取决于厂商)。

### 代码示例

```typescript
const result = await client.images.generations({
  model: 'dall-e-3',
  prompt: '一只在月球上弹吉他的猫',
  size: '1024x1024',
  vendor: 'dashscope',
})
console.log(result.data[0].url)
```

```bash
curl -X POST http://localhost:3001/v1/images/generations \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"dall-e-3","prompt":"一只猫","vendor":"dashscope"}'
```

## POST /v1/images/edits

图片编辑,基于原图 + prompt 修改。

**权限点**:`images:write`

### 请求

```json
{
  "model": "dall-e-2",
  "image": "base64编码的原图",
  "prompt": "把背景换成海滩",
  "mask": "base64编码的蒙版(可选)",
  "n": 1,
  "size": "1024x1024"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 图像模型 ID |
| image | string | 是 | base64 原图 |
| prompt | string | 是 | 编辑指令 |
| mask | string | 否 | base64 蒙版(透明区域为编辑区) |
| n | number | 否 | 生成数量 |
| size | string | 否 | 尺寸 |

### 响应(200)

同 `POST /v1/images/generations`。

### 代码示例

```typescript
const result = await client.images.edits({
  model: 'dall-e-2',
  image: Buffer.from(fs.readFileSync('original.png')).toString('base64'),
  prompt: '把背景换成海滩',
})
```

## POST /v1/images/inpaint

图片修复,基于蒙版修复指定区域。

**权限点**:`images:write`

### 请求

```json
{
  "model": "inpaint-model",
  "image": "base64原图",
  "mask": "base64蒙版",
  "prompt": "修复划痕"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 修复模型 ID |
| image | string | 是 | base64 原图 |
| mask | string | 是 | base64 蒙版(白色为待修复区) |
| prompt | string | 是 | 修复描述 |

### 响应(200)

同 `POST /v1/images/generations`。

### 代码示例

```typescript
const result = await client.images.inpaint({
  model: 'inpaint-model',
  image: Buffer.from(fs.readFileSync('damaged.png')).toString('base64'),
  mask: Buffer.from(fs.readFileSync('mask.png')).toString('base64'),
  prompt: '修复划痕',
})
```

## POST /v1/images/style-transfer

风格迁移,将指定风格应用到图片。

**权限点**:`images:write`

### 请求

```json
{
  "model": "style-transfer-model",
  "image": "base64原图",
  "style": "梵高星空风格"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID |
| image | string | 是 | base64 原图 |
| style | string | 是 | 风格描述或预设名称 |

### 响应(200)

同 `POST /v1/images/generations`。

### 代码示例

```typescript
const result = await client.images.styleTransfer({
  model: 'style-transfer-model',
  image: Buffer.from(fs.readFileSync('photo.jpg')).toString('base64'),
  style: '梵高星空风格',
})
```

## POST /v1/images/virtual-try-on

虚拟试穿,将服装穿到人物图上。

**权限点**:`images:write`

### 请求

```json
{
  "model": "try-on-model",
  "personImage": "base64人物图",
  "garmentImage": "base64服装图"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 试穿模型 ID |
| personImage | string | 是 | base64 人物图 |
| garmentImage | string | 是 | base64 服装图 |

### 响应(200)

同 `POST /v1/images/generations`。

### 代码示例

```typescript
const result = await client.images.virtualTryOn({
  model: 'try-on-model',
  personImage: Buffer.from(fs.readFileSync('person.jpg')).toString('base64'),
  garmentImage: Buffer.from(fs.readFileSync('garment.jpg')).toString('base64'),
})
```

## POST /v1/images/background

背景生成,为前景图生成新背景。

**权限点**:`images:write`

### 请求

```json
{
  "model": "bg-model",
  "foreground": "base64前景图",
  "prompt": "森林背景,阳光透过树叶"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID |
| foreground | string | 是 | base64 前景图 |
| prompt | string | 是 | 背景描述 |

### 响应(200)

同 `POST /v1/images/generations`。

### 代码示例

```typescript
const result = await client.images.background({
  model: 'bg-model',
  foreground: Buffer.from(fs.readFileSync('product.png')).toString('base64'),
  prompt: '森林背景,阳光透过树叶',
})
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | prompt 为空 / image 为空 / 尺寸不支持 |
| 401 | API Key 无效 |
| 403 | 缺少 `images:write` 权限 |
| 413 | 图片过大 |
| 429 | 配额超限 |
| 502 | 上游厂商错误 |

---

*最后更新: 2026-07-22*
