# use-ai-talk.ts M-63 备注审计报告 (R76 2026-07-19)

## 总览

- M-63 备注总数: 16 处 (含 L286 R76 修正行,严格 // M-63 前缀为 15 处)
- R76 已修正: 7 处
- 仍正确: 9 处 (frontend-stub-ai-routes.ts:246-354 范围内真实化)

## 修正记录 (R76)

### 1. L173 (volcengine-t2v)

- 原备注: ai-extended.ts 真实化
- 修正: frontend-stub-ai-routes.ts:246 真实化 (L246-354 11 个 vendor 端点)
- 证据: ai-extended.ts 实际是 308 redirect, 真实实现在 frontend-stub-ai-routes.ts

### 2. L190 (doubao-seedream-4.0)

- 原备注: ai-extended.ts 真实化
- 修正: frontend-stub-ai-routes.ts:246 真实化
- 证据: 同 #1

### 3. L233 (dashscope/image-edit)

- 原备注: frontend-stub-ai-routes.ts 真实化
- 修正: ai-vendors/proxy-llm.ts:97 真实化
- 证据: frontend-stub-ai-routes.ts 无 image-edit 注册, 真实端点在 proxy-llm.ts:97-118 调用 Dashscope multimodal-generation/generation

### 4. L275 (hunyuan/3d/submit)

- 原备注: frontend-stub-ai-routes.ts 真实化
- 修正: ai-vendors/proxy-extended.ts:107 真实化 (frontend-stub-ai-routes.ts:315 是转发代理)
- 证据: grep 确认 proxy-extended.ts:107 是 POST /tencent/hunyuan3d/submit 真实实现

### 5. L286 (hunyuan 3D 轮询)

- 原备注: proxy-extended.ts:216 (行号/路径不准确)
- 修正: ai-vendors/proxy-extended.ts:215-216 (完整路径)
- 证据: grep 确认 proxy-extended.ts:214-216 是 GET /tencent/hunyuan3d/task/:taskId

### 6. L391 (dashscope/video/generate)

- 原备注: frontend-stub-ai-routes.ts 真实化
- 修正: ai-vendors/proxy-llm.ts:191 真实化 (frontend-stub-ai-routes.ts:344 是转发代理)
- 证据: grep 确认 proxy-llm.ts:191 是 POST /dashscope/video, 实际调用 Dashscope video-synthesis

### 7. L412 (qwen/omni)

- 原备注: frontend-stub-ai-routes.ts:268-353 (行号范围不准确)
- 修正: frontend-stub-ai-routes.ts:348 (精确行号)
- 证据: grep 确认 L348-350 是 POST /ai/qwen/omni 真实转发到 /api/ai/dashscope/multimodal

## 行号范围统一

- 之前使用 268-353 范围(6 处 L109/L131/L152/L210/L320/L340)
- 修正为 246-354 范围(更精确)

## ws 端点引用

- L462: qwen-plus / Doubao-1.6 / GLM-4.5 走 WebSocket 已接入 apps/api ws-*.ts (无需修改)
