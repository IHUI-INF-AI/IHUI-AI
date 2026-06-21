# VideoGenerateRequest

Request body for doubao video generation.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | Text prompt for video generation | 
**images** | **List[object]** | Reference image URLs | [optional] 
**user_uuid** | **str** | User UUID (passed by client) | 
**chat_id** | **str** | Chat context ID | [optional] 
**zidingyican** | **List[object]** | Custom parameter list | [optional] 

## Example

```python
from zhs_api.models.video_generate_request import VideoGenerateRequest

# TODO update the JSON string below
json = "{}"
# create an instance of VideoGenerateRequest from a JSON string
video_generate_request_instance = VideoGenerateRequest.from_json(json)
# print the JSON string representation of the object
print(VideoGenerateRequest.to_json())

# convert the object into a dict
video_generate_request_dict = video_generate_request_instance.to_dict()
# create an instance of VideoGenerateRequest from a dict
video_generate_request_from_dict = VideoGenerateRequest.from_dict(video_generate_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


