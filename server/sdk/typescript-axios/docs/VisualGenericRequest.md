# VisualGenericRequest

Generic visual proxy request body — supports async submit+poll with token deduction.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | Generation prompt | [default to undefined]
**images** | **Array&lt;string&gt;** | Image URLs for i2v tasks | [optional] [default to undefined]
**user_uuid** | **string** | User UUID | [default to undefined]
**chat_id** | **string** | Chat context ID | [optional] [default to undefined]
**first** | **boolean** | Whether first-frame generation | [optional] [default to true]
**zidingyican** | [**Array&lt;AppApiV1AiDoubaoRouteCustomParameter&gt;**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] [default to undefined]

## Example

```typescript
import { VisualGenericRequest } from './api';

const instance: VisualGenericRequest = {
    prompt,
    images,
    user_uuid,
    chat_id,
    first,
    zidingyican,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
