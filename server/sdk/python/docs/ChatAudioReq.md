# ChatAudioReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bot_id** | **str** |  | 
**conversation_id** | **str** |  | [optional] 
**audio_data** | **str** |  | 

## Example

```python
from zhs_api.models.chat_audio_req import ChatAudioReq

# TODO update the JSON string below
json = "{}"
# create an instance of ChatAudioReq from a JSON string
chat_audio_req_instance = ChatAudioReq.from_json(json)
# print the JSON string representation of the object
print(ChatAudioReq.to_json())

# convert the object into a dict
chat_audio_req_dict = chat_audio_req_instance.to_dict()
# create an instance of ChatAudioReq from a dict
chat_audio_req_from_dict = ChatAudioReq.from_dict(chat_audio_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


