# VideoGenerateBody

Text-to-video generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** |  | [default to undefined]
**model_name** | **string** |  | [optional] [default to 'kling-v1']
**duration** | **string** |  | [optional] [default to '5']
**mode** | **string** |  | [optional] [default to 'std']
**aspect_ratio** | **string** |  | [optional] [default to '16:9']
**cfg_scale** | **number** |  | [optional] [default to 0.5]
**negative_prompt** | **string** |  | [optional] [default to undefined]
**camera_control** | **{ [key: string]: any; }** |  | [optional] [default to undefined]

## Example

```typescript
import { VideoGenerateBody } from './api';

const instance: VideoGenerateBody = {
    prompt,
    model_name,
    duration,
    mode,
    aspect_ratio,
    cfg_scale,
    negative_prompt,
    camera_control,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
