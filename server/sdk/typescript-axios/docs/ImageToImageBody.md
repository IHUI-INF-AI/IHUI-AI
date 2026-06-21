# ImageToImageBody

Image-to-image transformation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input_image_url** | **string** | URL of the input image | [default to undefined]
**prompt** | **string** | Text prompt guiding the transformation | [default to undefined]
**model** | **string** | Model name | [optional] [default to 'wanx-v1']

## Example

```typescript
import { ImageToImageBody } from './api';

const instance: ImageToImageBody = {
    input_image_url,
    prompt,
    model,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
