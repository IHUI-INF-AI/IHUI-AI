# AudioRecognizeRequest

Audio recognition request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**audio_url** | **string** | 音频文件URL | [default to undefined]
**model** | **string** | 语音识别模型名称 | [optional] [default to 'qwen3-asr-flash']
**language** | **string** | 音频语言代码，如 zh / en；留空自动检测 | [optional] [default to undefined]
**enable_lid** | **boolean** | 启用语言检测 | [optional] [default to true]
**enable_itn** | **boolean** | 启用逆文本标准化 | [optional] [default to false]
**system_prompt** | **string** | 系统提示词 | [optional] [default to '']
**user_uuid** | **string** | 用户UUID（兼容字段） | [optional] [default to undefined]
**user_id** | **string** | 用户ID（兼容字段） | [optional] [default to undefined]
**chat_id** | **string** | 对话ID | [optional] [default to undefined]
**conversation_id** | **string** | 对话ID（兼容字段） | [optional] [default to undefined]
**asr_options** | **{ [key: string]: any; }** | ASR选项（兼容字段，优先于 enable_lid/enable_itn/language） | [optional] [default to undefined]

## Example

```typescript
import { AudioRecognizeRequest } from './api';

const instance: AudioRecognizeRequest = {
    audio_url,
    model,
    language,
    enable_lid,
    enable_itn,
    system_prompt,
    user_uuid,
    user_id,
    chat_id,
    conversation_id,
    asr_options,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
