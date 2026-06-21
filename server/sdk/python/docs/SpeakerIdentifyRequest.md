# SpeakerIdentifyRequest

Speaker identification request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**group_id** | **str** | 声纹组ID | 
**audio_url** | **str** | 待识别音频URL | [optional] 
**audio_base64** | **str** | 待识别音频Base64编码 | [optional] 

## Example

```python
from zhs_api.models.speaker_identify_request import SpeakerIdentifyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SpeakerIdentifyRequest from a JSON string
speaker_identify_request_instance = SpeakerIdentifyRequest.from_json(json)
# print the JSON string representation of the object
print(SpeakerIdentifyRequest.to_json())

# convert the object into a dict
speaker_identify_request_dict = speaker_identify_request_instance.to_dict()
# create an instance of SpeakerIdentifyRequest from a dict
speaker_identify_request_from_dict = SpeakerIdentifyRequest.from_dict(speaker_identify_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


