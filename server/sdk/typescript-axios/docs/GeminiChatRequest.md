# GeminiChatRequest

Direct Gemini API request model.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**contents** | [**Array&lt;ChatMessage&gt;**](ChatMessage.md) | 对话消息列表 | [default to undefined]
**model** | **string** | 模型名称 | [optional] [default to undefined]
**temperature** | **number** | 温度参数 0-2 | [optional] [default to undefined]
**max_tokens** | **number** | 最大输出token数 | [optional] [default to undefined]
**system_instruction** | **string** | 系统提示词 | [optional] [default to undefined]

## Example

```typescript
import { GeminiChatRequest } from './api';

const instance: GeminiChatRequest = {
    contents,
    model,
    temperature,
    max_tokens,
    system_instruction,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
