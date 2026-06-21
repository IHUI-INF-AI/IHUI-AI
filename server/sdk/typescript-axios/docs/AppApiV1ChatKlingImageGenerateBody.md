# AppApiV1ChatKlingImageGenerateBody

Text-to-image generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** |  | [default to undefined]
**model_name** | **string** |  | [optional] [default to 'kling-v1']
**n** | **number** |  | [optional] [default to 1]
**aspect_ratio** | **string** |  | [optional] [default to '1:1']
**negative_prompt** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { AppApiV1ChatKlingImageGenerateBody } from './api';

const instance: AppApiV1ChatKlingImageGenerateBody = {
    prompt,
    model_name,
    n,
    aspect_ratio,
    negative_prompt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
