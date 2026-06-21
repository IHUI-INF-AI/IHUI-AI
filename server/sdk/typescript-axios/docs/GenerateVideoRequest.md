# GenerateVideoRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | 视频描述提示 | [default to undefined]
**images** | **Array&lt;string&gt;** | 参考图片URL列表 (图生视频) | [optional] [default to undefined]
**model** | **string** | 模型名称 | [optional] [default to undefined]
**aspect_ratio** | **string** | 宽高比 | [optional] [default to undefined]
**enhance_prompt** | **boolean** | 是否增强提示词 | [optional] [default to undefined]
**enable_upsample** | **boolean** | 是否启用上采样 | [optional] [default to undefined]

## Example

```typescript
import { GenerateVideoRequest } from './api';

const instance: GenerateVideoRequest = {
    prompt,
    images,
    model,
    aspect_ratio,
    enhance_prompt,
    enable_upsample,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
