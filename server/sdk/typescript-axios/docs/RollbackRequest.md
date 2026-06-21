# RollbackRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **string** | 操作者 | [optional] [default to 'api']
**reason** | **string** | 原因 | [optional] [default to '']
**auto** | **boolean** | 是否自动回滚 | [optional] [default to false]

## Example

```typescript
import { RollbackRequest } from './api';

const instance: RollbackRequest = {
    actor,
    reason,
    auto,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
