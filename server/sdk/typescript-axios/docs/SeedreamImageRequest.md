# SeedreamImageRequest

Request body for Seedream image generation (via Doubao Bearer token API).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | Generation prompt, supports Chinese/English | [default to undefined]
**user_uuid** | **string** | User UUID | [default to undefined]
**chat_id** | **string** | Chat context ID | [optional] [default to undefined]
**images** | **string** | Image URL or Base64 for image-to-image | [optional] [default to undefined]
**zidingyican** | [**Array&lt;AppApiV1AiDoubaoRouteCustomParameter&gt;**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] [default to undefined]

## Example

```typescript
import { SeedreamImageRequest } from './api';

const instance: SeedreamImageRequest = {
    prompt,
    user_uuid,
    chat_id,
    images,
    zidingyican,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
