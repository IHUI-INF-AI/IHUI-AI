# VideoGenerateBody

Text-to-video generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** |  | 
**model_name** | **str** |  | [optional] [default to 'kling-v1']
**duration** | **str** |  | [optional] [default to '5']
**mode** | **str** |  | [optional] [default to 'std']
**aspect_ratio** | **str** |  | [optional] [default to '16:9']
**cfg_scale** | **float** |  | [optional] [default to 0.5]
**negative_prompt** | **str** |  | [optional] 
**camera_control** | **Dict[str, object]** |  | [optional] 

## Example

```python
from zhs_api.models.video_generate_body import VideoGenerateBody

# TODO update the JSON string below
json = "{}"
# create an instance of VideoGenerateBody from a JSON string
video_generate_body_instance = VideoGenerateBody.from_json(json)
# print the JSON string representation of the object
print(VideoGenerateBody.to_json())

# convert the object into a dict
video_generate_body_dict = video_generate_body_instance.to_dict()
# create an instance of VideoGenerateBody from a dict
video_generate_body_from_dict = VideoGenerateBody.from_dict(video_generate_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


