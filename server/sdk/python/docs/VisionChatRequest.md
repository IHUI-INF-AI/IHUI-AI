# VisionChatRequest

Vision multi-modal chat request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**images** | [**List[VisionImageInfo]**](VisionImageInfo.md) | 图片列表，至少一张 | 
**prompt** | **str** | 文本提示词 | 
**model** | **str** | 视觉模型名称 | [optional] [default to 'qwen-vl-plus']
**max_tokens** | **int** | 最大生成token数 | [optional] [default to 1500]

## Example

```python
from zhs_api.models.vision_chat_request import VisionChatRequest

# TODO update the JSON string below
json = "{}"
# create an instance of VisionChatRequest from a JSON string
vision_chat_request_instance = VisionChatRequest.from_json(json)
# print the JSON string representation of the object
print(VisionChatRequest.to_json())

# convert the object into a dict
vision_chat_request_dict = vision_chat_request_instance.to_dict()
# create an instance of VisionChatRequest from a dict
vision_chat_request_from_dict = VisionChatRequest.from_dict(vision_chat_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


