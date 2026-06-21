# VideoCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**course_id** | **int** |  | 
**title** | **str** |  | 
**subtitle** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**video_path** | **str** |  | 
**duration** | **int** |  | [optional] 
**adjunct_url** | **str** |  | [optional] 
**is_pay** | **int** |  | [optional] [default to 0]
**amount** | **float** |  | [optional] 
**lecturer** | **str** |  | [optional] 
**label** | **str** |  | [optional] 
**stage** | **str** |  | [optional] 
**sort** | **int** |  | [optional] [default to 0]
**binding** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.video_create import VideoCreate

# TODO update the JSON string below
json = "{}"
# create an instance of VideoCreate from a JSON string
video_create_instance = VideoCreate.from_json(json)
# print the JSON string representation of the object
print(VideoCreate.to_json())

# convert the object into a dict
video_create_dict = video_create_instance.to_dict()
# create an instance of VideoCreate from a dict
video_create_from_dict = VideoCreate.from_dict(video_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


