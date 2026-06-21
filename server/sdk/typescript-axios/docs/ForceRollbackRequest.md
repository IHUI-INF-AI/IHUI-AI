# ForceRollbackRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **string** | 操作者 | [optional] [default to 'api']
**reason** | **string** | 强制回滚原因 (审计必填) | [default to undefined]

## Example

```typescript
import { ForceRollbackRequest } from './api';

const instance: ForceRollbackRequest = {
    actor,
    reason,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
