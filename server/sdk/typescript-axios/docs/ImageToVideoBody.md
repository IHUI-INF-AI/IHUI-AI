# ImageToVideoBody

Image-to-video generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model_name** | **string** |  | [optional] [default to 'kling-v1']
**image** | **string** | Image URL or base64 | [default to undefined]
**prompt** | **string** |  | [optional] [default to undefined]
**negative_prompt** | **string** |  | [optional] [default to undefined]
**duration** | **string** |  | [optional] [default to '5']
**mode** | **string** |  | [optional] [default to 'std']
**cfg_scale** | **number** |  | [optional] [default to 0.5]

## Example

```typescript
import { ImageToVideoBody } from './api';

const instance: ImageToVideoBody = {
    model_name,
    image,
    prompt,
    negative_prompt,
    duration,
    mode,
    cfg_scale,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
