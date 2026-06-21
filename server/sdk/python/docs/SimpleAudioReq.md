# SimpleAudioReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bot_id** | **str** |  | 
**conversation_id** | **str** |  | [optional] 
**audio_data** | **str** |  | 
**voice_id** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.simple_audio_req import SimpleAudioReq

# TODO update the JSON string below
json = "{}"
# create an instance of SimpleAudioReq from a JSON string
simple_audio_req_instance = SimpleAudioReq.from_json(json)
# print the JSON string representation of the object
print(SimpleAudioReq.to_json())

# convert the object into a dict
simple_audio_req_dict = simple_audio_req_instance.to_dict()
# create an instance of SimpleAudioReq from a dict
simple_audio_req_from_dict = SimpleAudioReq.from_dict(simple_audio_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


