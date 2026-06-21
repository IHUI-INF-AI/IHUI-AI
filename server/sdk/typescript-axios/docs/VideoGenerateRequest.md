# VideoGenerateRequest

Request body for doubao video generation.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | Text prompt for video generation | [default to undefined]
**images** | **Array&lt;any&gt;** | Reference image URLs | [optional] [default to undefined]
**user_uuid** | **string** | User UUID (passed by client) | [default to undefined]
**chat_id** | **string** | Chat context ID | [optional] [default to undefined]
**zidingyican** | **Array&lt;any&gt;** | Custom parameter list | [optional] [default to undefined]

## Example

```typescript
import { VideoGenerateRequest } from './api';

const instance: VideoGenerateRequest = {
    prompt,
    images,
    user_uuid,
    chat_id,
    zidingyican,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
