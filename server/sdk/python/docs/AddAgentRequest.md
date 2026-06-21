# AddAgentRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**agent_name** | **str** | 智能体名称 | 
**agent_description** | **str** | 智能体功能描述 | 
**connector_user_id** | **str** | Coze连接器用户ID | 
**agent_variables** | **Dict[str, object]** | 智能体变量配置JSON | 
**agent_model** | **str** | 使用的AI模型名称 | 
**agent_avatar** | **str** | 智能体头像图片URL地址 | [optional] 

## Example

```python
from zhs_api.models.add_agent_request import AddAgentRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AddAgentRequest from a JSON string
add_agent_request_instance = AddAgentRequest.from_json(json)
# print the JSON string representation of the object
print(AddAgentRequest.to_json())

# convert the object into a dict
add_agent_request_dict = add_agent_request_instance.to_dict()
# create an instance of AddAgentRequest from a dict
add_agent_request_from_dict = AddAgentRequest.from_dict(add_agent_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


