# VideoUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | [optional] 
**subtitle** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**video_path** | **str** |  | [optional] 
**duration** | **int** |  | [optional] 
**adjunct_url** | **str** |  | [optional] 
**is_pay** | **int** |  | [optional] 
**amount** | **float** |  | [optional] 
**lecturer** | **str** |  | [optional] 
**label** | **str** |  | [optional] 
**stage** | **str** |  | [optional] 
**sort** | **int** |  | [optional] 
**status** | **int** |  | [optional] 
**binding** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 
**audit_status** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.video_update import VideoUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of VideoUpdate from a JSON string
video_update_instance = VideoUpdate.from_json(json)
# print the JSON string representation of the object
print(VideoUpdate.to_json())

# convert the object into a dict
video_update_dict = video_update_instance.to_dict()
# create an instance of VideoUpdate from a dict
video_update_from_dict = VideoUpdate.from_dict(video_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


