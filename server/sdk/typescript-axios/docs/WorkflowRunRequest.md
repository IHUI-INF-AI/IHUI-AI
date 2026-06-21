# WorkflowRunRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **string** | 工作流ID | [optional] [default to undefined]
**webhook_path** | **string** | Webhook路径, 默认使用配置中的路径 | [optional] [default to undefined]
**input_data** | **{ [key: string]: any; }** | 工作流输入数据 | [optional] [default to undefined]

## Example

```typescript
import { WorkflowRunRequest } from './api';

const instance: WorkflowRunRequest = {
    workflow_id,
    webhook_path,
    input_data,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
