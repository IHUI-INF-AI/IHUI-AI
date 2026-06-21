# PlaygroundRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**alerts** | [**Array&lt;AlertIn&gt;**](AlertIn.md) | 待测告警列表 | [default to undefined]
**rules** | [**Array&lt;RuleSpec&gt;**](RuleSpec.md) | 自定义规则 (可选) | [optional] [default to undefined]
**use_default_presets** | **boolean** | 叠加 ZHS 平台预设规则 | [optional] [default to false]

## Example

```typescript
import { PlaygroundRequest } from './api';

const instance: PlaygroundRequest = {
    alerts,
    rules,
    use_default_presets,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
