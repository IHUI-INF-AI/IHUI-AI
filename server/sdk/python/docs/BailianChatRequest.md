# BailianChatRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | 用户输入 | 
**app_id** | **str** | 百炼应用ID, 默认从配置读取 | [optional] 
**session_id** | **str** | 会话ID, 用于多轮对话 | [optional] 
**stream** | **bool** | 是否流式返回 | [optional] 

## Example

```python
from zhs_api.models.bailian_chat_request import BailianChatRequest

# TODO update the JSON string below
json = "{}"
# create an instance of BailianChatRequest from a JSON string
bailian_chat_request_instance = BailianChatRequest.from_json(json)
# print the JSON string representation of the object
print(BailianChatRequest.to_json())

# convert the object into a dict
bailian_chat_request_dict = bailian_chat_request_instance.to_dict()
# create an instance of BailianChatRequest from a dict
bailian_chat_request_from_dict = BailianChatRequest.from_dict(bailian_chat_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


