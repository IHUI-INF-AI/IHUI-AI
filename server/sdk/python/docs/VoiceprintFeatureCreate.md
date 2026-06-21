# VoiceprintFeatureCreate

Add voiceprint feature request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** | 用户/声纹名称 | 
**desc** | **str** | 描述 | [optional] 
**audio_url** | **str** | 声纹音频URL | [optional] 
**audio_base64** | **str** | 声纹音频Base64编码 | [optional] 

## Example

```python
from zhs_api.models.voiceprint_feature_create import VoiceprintFeatureCreate

# TODO update the JSON string below
json = "{}"
# create an instance of VoiceprintFeatureCreate from a JSON string
voiceprint_feature_create_instance = VoiceprintFeatureCreate.from_json(json)
# print the JSON string representation of the object
print(VoiceprintFeatureCreate.to_json())

# convert the object into a dict
voiceprint_feature_create_dict = voiceprint_feature_create_instance.to_dict()
# create an instance of VoiceprintFeatureCreate from a dict
voiceprint_feature_create_from_dict = VoiceprintFeatureCreate.from_dict(voiceprint_feature_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


