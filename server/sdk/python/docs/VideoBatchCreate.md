# VideoBatchCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**course_id** | **int** |  | 
**videos** | [**List[VideoCreate]**](VideoCreate.md) |  | 

## Example

```python
from zhs_api.models.video_batch_create import VideoBatchCreate

# TODO update the JSON string below
json = "{}"
# create an instance of VideoBatchCreate from a JSON string
video_batch_create_instance = VideoBatchCreate.from_json(json)
# print the JSON string representation of the object
print(VideoBatchCreate.to_json())

# convert the object into a dict
video_batch_create_dict = video_batch_create_instance.to_dict()
# create an instance of VideoBatchCreate from a dict
video_batch_create_from_dict = VideoBatchCreate.from_dict(video_batch_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


