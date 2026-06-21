# AudioChatRequest

Audio chat request — voice or text input, returns text + audio.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **string** | 文本输入（可选，与audio_base64二选一） | [optional] [default to undefined]
**audio_base64** | **string** | 音频Base64编码（可选，与text二选一） | [optional] [default to undefined]
**audio_url** | **string** | 音频URL（可选） | [optional] [default to undefined]
**bot_id** | **string** | Coze机器人ID（可选，不提供则使用默认AI） | [optional] [default to undefined]
**voice_id** | **string** | 回复音色ID | [optional] [default to 'longxiaochun']
**model** | **string** | 对话模型名称 | [optional] [default to 'qwen-turbo']
**language** | **string** | 语言 | [optional] [default to 'zh-CN']
**system_prompt** | **string** | 系统提示词 | [optional] [default to undefined]

## Example

```typescript
import { AudioChatRequest } from './api';

const instance: AudioChatRequest = {
    text,
    audio_base64,
    audio_url,
    bot_id,
    voice_id,
    model,
    language,
    system_prompt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
