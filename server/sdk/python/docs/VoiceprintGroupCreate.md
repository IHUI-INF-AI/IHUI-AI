# VoiceprintGroupCreate

Create voiceprint group request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** | 声纹组名称 | 
**desc** | **str** | 声纹组描述 | [optional] 

## Example

```python
from zhs_api.models.voiceprint_group_create import VoiceprintGroupCreate

# TODO update the JSON string below
json = "{}"
# create an instance of VoiceprintGroupCreate from a JSON string
voiceprint_group_create_instance = VoiceprintGroupCreate.from_json(json)
# print the JSON string representation of the object
print(VoiceprintGroupCreate.to_json())

# convert the object into a dict
voiceprint_group_create_dict = voiceprint_group_create_instance.to_dict()
# create an instance of VoiceprintGroupCreate from a dict
voiceprint_group_create_from_dict = VoiceprintGroupCreate.from_dict(voiceprint_group_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


