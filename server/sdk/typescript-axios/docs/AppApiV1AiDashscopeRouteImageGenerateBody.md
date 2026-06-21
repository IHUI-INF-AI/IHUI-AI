# AppApiV1AiDashscopeRouteImageGenerateBody

Image generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | Text prompt for image generation | [default to undefined]
**negative_prompt** | **string** | Negative prompt | [optional] [default to undefined]
**size** | **string** | Image size, e.g. 1024*1024 | [optional] [default to undefined]
**n** | **number** | Number of images to generate | [optional] [default to undefined]
**style** | **string** | Style preset | [optional] [default to undefined]
**sync** | **boolean** | If true, poll until the task completes and return image URLs directly | [optional] [default to false]
**zidingyican** | **Array&lt;{ [key: string]: any; }&gt;** | Extra custom parameters as name/value pairs | [optional] [default to undefined]

## Example

```typescript
import { AppApiV1AiDashscopeRouteImageGenerateBody } from './api';

const instance: AppApiV1AiDashscopeRouteImageGenerateBody = {
    prompt,
    negative_prompt,
    size,
    n,
    style,
    sync,
    zidingyican,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
