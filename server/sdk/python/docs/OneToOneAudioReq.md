# OneToOneAudioReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bot_id** | **str** |  | 
**user_id** | **str** |  | 
**conversation_id** | **str** |  | [optional] 
**audio_data** | **str** |  | 
**voice_id** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.one_to_one_audio_req import OneToOneAudioReq

# TODO update the JSON string below
json = "{}"
# create an instance of OneToOneAudioReq from a JSON string
one_to_one_audio_req_instance = OneToOneAudioReq.from_json(json)
# print the JSON string representation of the object
print(OneToOneAudioReq.to_json())

# convert the object into a dict
one_to_one_audio_req_dict = one_to_one_audio_req_instance.to_dict()
# create an instance of OneToOneAudioReq from a dict
one_to_one_audio_req_from_dict = OneToOneAudioReq.from_dict(one_to_one_audio_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


