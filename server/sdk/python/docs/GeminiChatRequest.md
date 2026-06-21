# GeminiChatRequest

Direct Gemini API request model.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**contents** | [**List[ChatMessage]**](ChatMessage.md) | 对话消息列表 | 
**model** | **str** | 模型名称 | [optional] 
**temperature** | **float** | 温度参数 0-2 | [optional] 
**max_tokens** | **int** | 最大输出token数 | [optional] 
**system_instruction** | **str** | 系统提示词 | [optional] 

## Example

```python
from zhs_api.models.gemini_chat_request import GeminiChatRequest

# TODO update the JSON string below
json = "{}"
# create an instance of GeminiChatRequest from a JSON string
gemini_chat_request_instance = GeminiChatRequest.from_json(json)
# print the JSON string representation of the object
print(GeminiChatRequest.to_json())

# convert the object into a dict
gemini_chat_request_dict = gemini_chat_request_instance.to_dict()
# create an instance of GeminiChatRequest from a dict
gemini_chat_request_from_dict = GeminiChatRequest.from_dict(gemini_chat_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


