# AlertIn

输入告警 (简化: 只要 status + labels).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **string** | firing / resolved | [optional] [default to 'firing']
**labels** | **{ [key: string]: any; }** | 告警 labels | [optional] [default to undefined]
**annotations** | **{ [key: string]: any; }** | 可选 annotations | [optional] [default to undefined]

## Example

```typescript
import { AlertIn } from './api';

const instance: AlertIn = {
    status,
    labels,
    annotations,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
