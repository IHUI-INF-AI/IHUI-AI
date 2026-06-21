# HistoryRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | Time range: w&#x3D;week, m&#x3D;month, y&#x3D;year, a&#x3D;all | [optional] [default to 'a']
**page** | **number** |  | [optional] [default to 1]
**page_size** | **number** |  | [optional] [default to 10]

## Example

```typescript
import { HistoryRequest } from './api';

const instance: HistoryRequest = {
    type,
    page,
    page_size,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
