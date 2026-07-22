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

---

## 7. Qwen3.5 本地部署(W4-2 主打适配,OpenClaw 对标)

> 本项目内置 `QwenLocalProvider`(`apps/ai-service/app/providers/qwen_local_provider.py`),
> 针对通义千问 Qwen3.5 系列的 **ChatML 模板**(`<|im_start|>`/`<|im_end|>`)做以下主打优化:
>
> - **stop tokens 注入**:`["<|im_end|>", "<|endoftext|>"]` — 显式注入避免不同 Ollama 版本 Modelfile 默认 stop 漂移导致"生成不收尾"。
> - **context window 默认 32768** — Qwen3.5 支持 32K,通过 Ollama `options.num_ctx` 透传,避免被默认 2048 截断。
> - **协议复用 Ollama 原生 `/api/chat`** — 支持 tools function calling(Ollama 0.3.0+),无需改路由核心。
>
> 模型前缀:`qwen-local/<ollama_model_name>`,例如 `qwen-local/qwen2.5:7b`。

### 7.1 三种部署方式

#### 方式 A:Ollama(推荐,最简)

```bash
# 安装 Ollama(Windows)
winget install Ollama.Ollama

# 拉取 Qwen2.5 系列(Qwen3.5 沿用同款 ChatML 模板,7B 主打推荐)
ollama pull qwen2.5:7b         # 4GB 显存
ollama pull qwen2.5:14b        # 8GB 显存
ollama pull qwen2.5:32b        # 16GB 显存
ollama pull qwen2.5:72b        # 40GB 显存(旗舰)
ollama pull qwen2.5-coder:7b   # 代码专精

# 启动服务(默认 11434)
ollama serve
```

`apps/ai-service/.env` 配置:

```bash
LITELLM_MODEL=qwen-local/qwen2.5:7b
# 服务端点(可选,默认 http://localhost:11434)
# OLLAMA_API_BASE=http://localhost:11434
```

#### 方式 B:llama.cpp server(高吞吐,自定义量化)

```bash
# 编译 llama.cpp(略)
# 下载 GGUF 模型:https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF

# 启动 llama-server(OpenAI 兼容端点,默认 8080)
./llama-server \
  -m Qwen2.5-7B-Instruct-Q5_K_M.gguf \
  --port 8080 \
  -c 32768 \
  -ngl 99
```

`apps/ai-service/.env` 配置:

```bash
LITELLM_MODEL=llamacpp/qwen2.5-7b
LLAMACPP_API_BASE=http://localhost:8080
```

> 注:llama.cpp 走 OpenAI 兼容协议,无 ChatML stop 注入优化;若需 Qwen 专有优化,仍推荐方式 A。

#### 方式 C:vLLM(生产级,多并发)

```bash
# 安装 vLLM(需 CUDA 12+)
pip install vllm

# 启动 vLLM OpenAI 兼容服务(默认 8000)
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8000 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9
```

`apps/ai-service/.env` 配置:

```bash
LITELLM_MODEL=openai/qwen2.5-7b-instruct
OPENAI_API_BASE=http://localhost:8000/v1
OPENAI_API_KEY=vllm-dummy
```

> 注:vLLM 走 OpenAI 兼容协议,ChatML 模板由 vLLM 内部应用,stop tokens 自动注入。

### 7.2 CLI 配置(`~/.ihui/settings.json`)

```json
{
  "localQwen": {
    "enabled": true,
    "endpoint": "http://localhost:11434",
    "modelName": "qwen2.5:7b",
    "contextLength": 32768,
    "temperature": 0.7
  }
}
```

字段说明:

| 字段           | 类型    | 默认值                   | 说明                                  |
| -------------- | ------- | ------------------------ | ------------------------------------- |
| `enabled`      | boolean | `false`                  | 启用 Qwen3.5 本地主打(零回归)       |
| `endpoint`     | string  | `http://localhost:11434` | Ollama / llama.cpp / vLLM 服务端点    |
| `modelName`    | string  | `qwen2.5:7b`             | Ollama 模型名(与 `ollama pull` 一致) |
| `contextLength`| number  | `32768`                  | 上下文窗口(Qwen3.5 支持 32K)         |
| `temperature`  | number  | `0.7`                    | 采样温度(0-2,代码任务推荐 0.2)     |

### 7.3 内置 Qwen3.5 本地模型预设

`apps/ai-service/app/data/default_models.json` 已收录 5 个预设(均 `input_price: 0`):

| 模型 ID                          | 名称                          | 适用场景       |
| -------------------------------- | ----------------------------- | -------------- |
| `qwen-local/qwen2.5:7b`          | Qwen3.5 7B 本地(主打推荐)   | 4GB 显存,通用 |
| `qwen-local/qwen2.5:14b`         | Qwen3.5 14B 本地              | 8GB 显存       |
| `qwen-local/qwen2.5:32b`         | Qwen3.5 32B 本地              | 16GB 显存      |
| `qwen-local/qwen2.5:72b`         | Qwen3.5 72B 本地(旗舰)      | 40GB 显存      |
| `qwen-local/qwen2.5-coder:7b`    | Qwen3.5 Coder 7B 本地         | 代码专精       |

### 7.4 验证

```bash
# 健康检查
curl http://localhost:11434/api/tags | jq '.models[] | select(.name | startswith("qwen"))'

# 通过 ai-service 调用
curl -X POST http://localhost:8803/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-local/qwen2.5:7b","messages":[{"role":"user","content":"你好"}]}'
```

期望返回非 stub 响应,且 `usage.total_tokens > 0`(Ollama eval_count + prompt_eval_count)。
