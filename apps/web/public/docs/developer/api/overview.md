# API概览

> **配置说明**：实际 API 基地址与端点以部署环境为准；接入时请向平台获取当前环境的 base URL 与认证方式。仓库维护者请与后端对齐路径后更新本文档，并参考 `docs/OPEN_PLATFORM_API_AND_INTEGRATION.md` 中的前后端对接约定。

## 基础信息

### API地址

```
https://api.example.com/v1
```

（示例；实际地址由部署环境与 ihui API 提供）

### 协议

- **协议** - HTTPS
- **方法** - RESTful (GET, POST, PUT, DELETE)
- **数据格式** - JSON
- **字符编码** - UTF-8

## 统一响应格式

### 成功响应

```json
{
  "code": 200,
  "success": true,
  "message": "Success",
  "data": {
    // 响应数据
  },
  "timestamp": 1704873600000
}
```

### 错误响应

```json
{
  "code": 400,
  "success": false,
  "message": "Error message",
  "data": null,
  "timestamp": 1704873600000
}
```

## 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（API密钥无效） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求频率限制 |
| 500 | 服务器错误 |

## 速率限制

- **免费用户** - 100次/分钟
- **付费用户** - 1000次/分钟
- **企业用户** - 10000次/分钟

超过限制将返回429状态码。

## API端点

### 对话相关

- `POST /v1/chat` - 创建对话
- `GET /v1/chat/:id` - 获取对话详情
- `GET /v1/chat` - 获取对话列表

### 模型相关

- `GET /v1/models` - 获取模型列表
- `GET /v1/models/:id` - 获取模型详情

### 智能体相关

- `GET /v1/agents` - 获取智能体列表
- `GET /v1/agents/:id` - 获取智能体详情
- `POST /v1/agents/:id/call` - 调用智能体

### 文件相关

- `POST /v1/files` - 上传文件
- `GET /v1/files/:id` - 获取文件信息
- `DELETE /v1/files/:id` - 删除文件

---

*最后更新: 2026-01-10*
