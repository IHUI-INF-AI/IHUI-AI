# scripts/setup-llm.md — LLM 接入完整指南

> 本项目 AI service (`apps/ai-service/`) 通过 LiteLLM 统一代理多 LLM 厂商。
> 默认 **stub 模式**:无密钥时返回固定回退响应,适合本地调试 UI 流程。

---

## 1. 免费 / 付费 LLM 厂商清单

| 厂商                 | 申请地址                                                  | 免费额度                      | 速度       | 推荐模型                       |
| -------------------- | --------------------------------------------------------- | ----------------------------- | ---------- | ------------------------------ |
| **StepFun 阶跃星辰** | https://api.stepfun.com/step_plan/v1 (在 stepfun.cn 注册) | 注册即送                      | 国内快     | `stepfun/step-3.5-flash`       |
| **Groq**             | https://console.groq.com/keys                             | 每日 14,400 次 (Llama 3.1 8b) | 极快       | `groq/llama-3.3-70b-versatile` |
| **Gemini**           | https://aistudio.google.com/apikey                        | 每分钟 15 次 (Flash)          | 快         | `gemini/gemini-1.5-flash`      |
| **OpenAI**           | https://platform.openai.com/api-keys                      | 付费                          | 稳定       | `gpt-4o-mini`                  |
| **Anthropic**        | https://console.anthropic.com/settings/keys               | 付费                          | 稳定       | `claude-3-5-haiku-20241022`    |
| **Ollama (本地)**    | https://ollama.com                                        | 完全免费(本地推理)            | 取决于硬件 | `ollama/llama3.2`              |

---

## 2. 三步接入真实 LLM

### Step 1: 编辑 `apps/ai-service/.env`

```bash
# 解开注释并填入真实 key(至少填一个)
STEPFUN_API_KEY=<your-stepfun-api-key>
GROQ_API_KEY=<your-groq-api-key>
GEMINI_API_KEY=<your-gemini-api-key>
OPENAI_API_KEY=<your-openai-api-key>

# 选择默认模型
LITELLM_MODEL=groq/llama-3.3-70b-versatile   # 推荐 Groq(免费 + 极速)
```

### Step 2: 重启 AI service

```bash
# 停止旧进程
Get-NetTCPConnection -LocalPort 8803 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 启动新进程
cd g:\IHUI-AI\apps\ai-service
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8803
```

### Step 3: 验证连通性

```bash
# 健康检查
curl http://localhost:8803/health
# 期望:{"status":"ok","service":"ihui-ai-service"}

# 模型列表
curl http://localhost:8803/api/llm/models
# 期望:返回 4-5 个模型,带价格和上下文长度
```

---

## 3. 端到端测试

打开 http://localhost:8801/chat,选择模型(默认 `stepfun/step-3.7-flash`),输入消息测试。

或通过 API:

```bash
TOKEN=$(curl -s -X POST http://localhost:8801/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@ihui.ai","password":"Test@123456"}' | \
  jq -r '.data.accessToken')

curl -X POST http://localhost:8802/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"model":"groq/llama-3.3-70b-versatile","message":"你好"}'
```

---

## 4. 本地 LLM (Ollama) 接入

无需 API key,本地推理:

```bash
# 安装 Ollama(Windows)
winget install Ollama.Ollama

# 拉取模型
ollama pull llama3.2
ollama pull qwen2.5:7b

# 启动服务(默认 11434)
ollama serve

# 验证
curl http://localhost:11434/api/tags
```

LiteLLM 已内置 Ollama 支持,只需在 `apps/ai-service/.env` 加:

```bash
LITELLM_MODEL=ollama/llama3.2
```

---

## 5. 故障排查

### 5.1 "ModuleNotFoundError: No module named 'litellm'"

```bash
cd g:\IHUI-AI\apps\ai-service
.\.venv\Scripts\pip.exe install litellm
```

### 5.2 "litellm.Timeout: OpenAI timeout"

网络问题,切换到国内模型:

```bash
LITELLM_MODEL=stepfun/step-3.5-flash
```

### 5.3 "AuthenticationError: Invalid API key"

检查 `apps/ai-service/.env` 的 `*_API_KEY` 值是否正确,确保无空格/换行。

### 5.4 AI service 一直返回 stub 响应

查看启动日志:

```bash
Get-Content g:\IHUI-AI\.trae-cn\ai-final.log
```

查找 "falling back to stub mode" 或 "API key not configured"。

---

## 6. 成本估算

| 厂商      | 模型             | 输入价格        | 输出价格        | 1000 次对话估算 |
| --------- | ---------------- | --------------- | --------------- | --------------- |
| Groq      | llama-3.3-70b    | 免费            | 免费            | $0              |
| Gemini    | 1.5-flash        | 免费            | 免费            | $0              |
| StepFun   | step-3.5-flash   | ¥0.001/千 token | ¥0.002/千 token | ¥1-2            |
| OpenAI    | gpt-4o-mini      | $0.15/1M        | $0.60/1M        | $0.10           |
| Anthropic | claude-3-5-haiku | $0.80/1M        | $4/1M           | $0.50           |

**推荐开发用 Groq(免费 + 极快),生产用 StepFun(国内快)或 OpenAI(稳定)**
