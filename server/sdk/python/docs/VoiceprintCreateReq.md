# VoiceprintCreateReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**description** | **str** |  | [optional] 
**audio_data** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.voiceprint_create_req import VoiceprintCreateReq

# TODO update the JSON string below
json = "{}"
# create an instance of VoiceprintCreateReq from a JSON string
voiceprint_create_req_instance = VoiceprintCreateReq.from_json(json)
# print the JSON string representation of the object
print(VoiceprintCreateReq.to_json())

# convert the object into a dict
voiceprint_create_req_dict = voiceprint_create_req_instance.to_dict()
# create an instance of VoiceprintCreateReq from a dict
voiceprint_create_req_from_dict = VoiceprintCreateReq.from_dict(voiceprint_create_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


