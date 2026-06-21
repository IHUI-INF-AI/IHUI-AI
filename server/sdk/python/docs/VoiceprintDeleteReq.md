# VoiceprintDeleteReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**voiceprint_id** | **str** |  | 

## Example

```python
from zhs_api.models.voiceprint_delete_req import VoiceprintDeleteReq

# TODO update the JSON string below
json = "{}"
# create an instance of VoiceprintDeleteReq from a JSON string
voiceprint_delete_req_instance = VoiceprintDeleteReq.from_json(json)
# print the JSON string representation of the object
print(VoiceprintDeleteReq.to_json())

# convert the object into a dict
voiceprint_delete_req_dict = voiceprint_delete_req_instance.to_dict()
# create an instance of VoiceprintDeleteReq from a dict
voiceprint_delete_req_from_dict = VoiceprintDeleteReq.from_dict(voiceprint_delete_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


