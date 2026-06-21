# VideoSynthesisRequest

Video synthesis request body (async task).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | 视频生成文本提示 | 
**image_url** | **str** | 图生视频的图片URL；留空则文生视频 | [optional] 
**audio_url** | **str** | 音频URL，用于音频驱动视频 | [optional] 
**model** | **str** | 视频合成模型 | [optional] [default to 'wan2.1-t2v-turbo']
**duration** | **int** | 视频时长（秒） | [optional] [default to 5]
**resolution** | **str** | 视频分辨率，如 1280*720 | [optional] [default to '1280*720']
**zidingyican** | **List[Dict[str, object]]** | Extra custom parameters as name/value pairs | [optional] 

## Example

```python
from zhs_api.models.video_synthesis_request import VideoSynthesisRequest

# TODO update the JSON string below
json = "{}"
# create an instance of VideoSynthesisRequest from a JSON string
video_synthesis_request_instance = VideoSynthesisRequest.from_json(json)
# print the JSON string representation of the object
print(VideoSynthesisRequest.to_json())

# convert the object into a dict
video_synthesis_request_dict = video_synthesis_request_instance.to_dict()
# create an instance of VideoSynthesisRequest from a dict
video_synthesis_request_from_dict = VideoSynthesisRequest.from_dict(video_synthesis_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


