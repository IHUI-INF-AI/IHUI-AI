# VisionChatRequest

Vision multi-modal chat request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**images** | [**Array&lt;VisionImageInfo&gt;**](VisionImageInfo.md) | 图片列表，至少一张 | [default to undefined]
**prompt** | **string** | 文本提示词 | [default to undefined]
**model** | **string** | 视觉模型名称 | [optional] [default to 'qwen-vl-plus']
**max_tokens** | **number** | 最大生成token数 | [optional] [default to 1500]

## Example

```typescript
import { VisionChatRequest } from './api';

const instance: VisionChatRequest = {
    images,
    prompt,
    model,
    max_tokens,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
