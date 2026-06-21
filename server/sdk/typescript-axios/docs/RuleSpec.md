# RuleSpec

单条抑制规则 (alertmanager YAML JSON 等价).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | 规则名 (可空, 便于日志) | [optional] [default to '']
**source_match** | **{ [key: string]: any; }** | source 侧 matchers (AND) | [optional] [default to undefined]
**target_match** | **{ [key: string]: any; }** | target 侧 matchers (AND) | [optional] [default to undefined]
**equal** | **Array&lt;string&gt;** | equal 字段列表, None&#x3D;alertname | [optional] [default to undefined]

## Example

```typescript
import { RuleSpec } from './api';

const instance: RuleSpec = {
    name,
    source_match,
    target_match,
    equal,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
