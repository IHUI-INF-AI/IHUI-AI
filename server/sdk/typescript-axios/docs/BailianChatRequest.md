# BailianChatRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | 用户输入 | [default to undefined]
**app_id** | **string** | 百炼应用ID, 默认从配置读取 | [optional] [default to undefined]
**session_id** | **string** | 会话ID, 用于多轮对话 | [optional] [default to undefined]
**stream** | **boolean** | 是否流式返回 | [optional] [default to undefined]

## Example

```typescript
import { BailianChatRequest } from './api';

const instance: BailianChatRequest = {
    prompt,
    app_id,
    session_id,
    stream,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
