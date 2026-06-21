# SpeechReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input** | **str** |  | 
**voice_id** | **str** |  | 
**response_format** | **str** |  | [optional] 
**speed** | **float** | 起始时间戳 | [optional] 

## Example

```python
from zhs_api.models.speech_req import SpeechReq

# TODO update the JSON string below
json = "{}"
# create an instance of SpeechReq from a JSON string
speech_req_instance = SpeechReq.from_json(json)
# print the JSON string representation of the object
print(SpeechReq.to_json())

# convert the object into a dict
speech_req_dict = speech_req_instance.to_dict()
# create an instance of SpeechReq from a dict
speech_req_from_dict = SpeechReq.from_dict(speech_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


