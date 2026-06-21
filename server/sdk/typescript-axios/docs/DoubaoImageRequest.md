# DoubaoImageRequest

Request body for doubao image generation (jimeng_t2i_v40 via Volcengine signed API).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** |  | [default to undefined]
**user_uuid** | **string** |  | [default to undefined]
**chat_id** | **string** |  | [optional] [default to undefined]
**zidingyican** | [**Array&lt;AppApiV1AiDoubaoRouteCustomParameter&gt;**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] [default to undefined]

## Example

```typescript
import { DoubaoImageRequest } from './api';

const instance: DoubaoImageRequest = {
    prompt,
    user_uuid,
    chat_id,
    zidingyican,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
