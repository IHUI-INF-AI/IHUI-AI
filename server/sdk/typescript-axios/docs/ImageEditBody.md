# ImageEditBody

Image edit request body (standard, with optional mask).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**base_image_url** | **string** | URL of the base image to edit | [default to undefined]
**mask_image_url** | **string** | URL of the mask image (white &#x3D; area to edit) | [optional] [default to undefined]
**prompt** | **string** | Editing instruction | [default to undefined]
**model** | **string** | Model name, e.g. wanx-v1, wanx2.1-image-edit | [optional] [default to 'wanx-v1']

## Example

```typescript
import { ImageEditBody } from './api';

const instance: ImageEditBody = {
    base_image_url,
    mask_image_url,
    prompt,
    model,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
