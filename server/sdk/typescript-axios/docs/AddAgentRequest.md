# AddAgentRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**agent_name** | **string** | 智能体名称 | [default to undefined]
**agent_description** | **string** | 智能体功能描述 | [default to undefined]
**connector_user_id** | **string** | Coze连接器用户ID | [default to undefined]
**agent_variables** | **{ [key: string]: any; }** | 智能体变量配置JSON | [default to undefined]
**agent_model** | **string** | 使用的AI模型名称 | [default to undefined]
**agent_avatar** | **string** | 智能体头像图片URL地址 | [optional] [default to undefined]

## Example

```typescript
import { AddAgentRequest } from './api';

const instance: AddAgentRequest = {
    agent_name,
    agent_description,
    connector_user_id,
    agent_variables,
    agent_model,
    agent_avatar,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
