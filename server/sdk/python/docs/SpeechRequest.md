# SpeechRequest

TTS request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **str** | 要合成的文字内容 | 
**voice_id** | **str** | 音色ID | [optional] [default to 'longxiaochun']
**response_format** | **str** | 输出格式: mp3 / wav / pcm | [optional] [default to 'mp3']
**rate** | **str** | 语速，范围 0.5~2.0，1.0为正常 | [optional] 
**volume** | **str** | 音量，范围 0.5~2.0，1.0为正常 | [optional] 
**pitch** | **str** | 音调，范围 0.5~2.0，1.0为正常 | [optional] 

## Example

```python
from zhs_api.models.speech_request import SpeechRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SpeechRequest from a JSON string
speech_request_instance = SpeechRequest.from_json(json)
# print the JSON string representation of the object
print(SpeechRequest.to_json())

# convert the object into a dict
speech_request_dict = speech_request_instance.to_dict()
# create an instance of SpeechRequest from a dict
speech_request_from_dict = SpeechRequest.from_dict(speech_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


