# 音频识别API使用说明

## 概述

本API基于DashScope的`qwen3-asr-flash`模型实现音频识别功能，支持多种音频格式，并提供token计算和扣减功能。

## API端点

```
POST /cozeZhsApi/dashscope/audio/recognize
```

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| audio_url | string | 是 | 音频文件的URL地址 |
| user_id | string | 是 | 用户ID |
| conversation_id | string | 否 | 对话ID，用于保存对话记录 |
| model | string | 否 | 模型名称，默认为"qwen3-asr-flash" |
| asr_options | object | 否 | ASR配置选项 |
| asr_options.language | string | 否 | 指定音频语言，如"zh" |
| asr_options.enable_lid | boolean | 否 | 是否启用语言检测，默认为true |
| asr_options.enable_itn | boolean | 否 | 是否启用逆文本标准化，默认为false |

## 请求示例

```json
{
    "audio_url": "https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3",
    "user_id": "user123",
    "model": "qwen3-asr-flash",
    "asr_options": {
        "enable_lid": true,
        "enable_itn": false
    }
}
```

## 响应格式

### 成功响应

```json
{
    "code": 200,
    "msg": "success",
    "data": {
        "recognition_text": "识别出的音频文本内容",
        "model": "qwen3-asr-flash",
        "processing_time": 1.23,
        "token_usage": {
            "input_tokens": 150,
            "output_tokens": 50,
            "total_tokens": 200
        },
        "conversation_id": "conv456",
        "message_id": "msg789"
    }
}
```

### 错误响应

```json
{
    "code": 400,
    "msg": "错误描述",
    "data": null
}
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 用户未认证或token无效 |
| 402 | 用户token余额不足 |
| 404 | 用户不存在 |
| 500 | 服务器内部错误 |

## 使用示例

### Python示例

```python
import requests
import json

url = "http://localhost:8000/cozeZhsApi/dashscope/audio/recognize"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN"
}

data = {
    "audio_url": "https://example.com/audio.mp3",
    "user_id": "user123",
    "conversation_id": "conv456"
}

response = requests.post(url, json=data, headers=headers)
result = response.json()

if result["code"] == 200:
    print(f"识别结果: {result['data']['recognition_text']}")
    print(f"Token使用: {result['data']['token_usage']}")
else:
    print(f"错误: {result['msg']}")
```

### cURL示例

```bash
curl -X POST "http://localhost:8000/cozeZhsApi/dashscope/audio/recognize" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
           "audio_url": "https://example.com/audio.mp3",
           "user_id": "user123",
           "conversation_id": "conv456"
         }'
```

## 注意事项

1. **API密钥**: 确保已设置正确的`DASHSCOPE_API_KEY`环境变量
2. **Token计费**: 每次请求会根据识别的音频长度和复杂度计算并扣减token
3. **音频格式**: 支持常见的音频格式，如MP3、WAV、M4A等
4. **音频大小**: 建议音频文件不超过50MB
5. **URL访问**: 音频URL必须是公网可访问的

## 测试

项目包含一个测试脚本`test_audio_api.py`，可以用于测试API功能：

```bash
python test_audio_api.py
```

运行前请确保：
1. 服务已启动 (`python main.py`)
2. 设置了有效的`DASHSCOPE_API_KEY`环境变量
3. 替换测试脚本中的认证token

## 技术实现

API基于以下技术实现：
- FastAPI框架
- DashScope SDK
- Token计算和扣减系统
- 对话记录保存功能