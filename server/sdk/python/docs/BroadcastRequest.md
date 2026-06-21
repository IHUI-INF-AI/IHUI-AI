# BroadcastRequest

广播消息体.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**message** | **Dict[str, object]** | 要广播的消息内容 | 
**room_id** | **str** | 指定房间ID，为空则全局广播 | [optional] 

## Example

```python
from zhs_api.models.broadcast_request import BroadcastRequest

# TODO update the JSON string below
json = "{}"
# create an instance of BroadcastRequest from a JSON string
broadcast_request_instance = BroadcastRequest.from_json(json)
# print the JSON string representation of the object
print(BroadcastRequest.to_json())

# convert the object into a dict
broadcast_request_dict = broadcast_request_instance.to_dict()
# create an instance of BroadcastRequest from a dict
broadcast_request_from_dict = BroadcastRequest.from_dict(broadcast_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


