# OverridePauseRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **string** | 操作者 (审计必填) | [optional] [default to 'api']
**reason** | **string** | 暂停原因 (审计必填) | [default to undefined]
**until_ts** | **number** | 自动恢复时间戳, 0 &#x3D; 永久 | [optional] [default to 0.0]

## Example

```typescript
import { OverridePauseRequest } from './api';

const instance: OverridePauseRequest = {
    actor,
    reason,
    until_ts,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
