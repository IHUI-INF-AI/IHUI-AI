# VoiceprintUpdateReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**voiceprint_id** | **str** |  | 
**name** | **str** |  | [optional] 
**description** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.voiceprint_update_req import VoiceprintUpdateReq

# TODO update the JSON string below
json = "{}"
# create an instance of VoiceprintUpdateReq from a JSON string
voiceprint_update_req_instance = VoiceprintUpdateReq.from_json(json)
# print the JSON string representation of the object
print(VoiceprintUpdateReq.to_json())

# convert the object into a dict
voiceprint_update_req_dict = voiceprint_update_req_instance.to_dict()
# create an instance of VoiceprintUpdateReq from a dict
voiceprint_update_req_from_dict = VoiceprintUpdateReq.from_dict(voiceprint_update_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


