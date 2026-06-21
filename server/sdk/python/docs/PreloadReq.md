# PreloadReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**video_id** | **str** |  | 
**video_path** | **str** |  | [optional] 
**start_seconds** | **float** |  | 
**preload_seconds** | **float** |  | [optional] [default to 10.0]

## Example

```python
from zhs_api.models.preload_req import PreloadReq

# TODO update the JSON string below
json = "{}"
# create an instance of PreloadReq from a JSON string
preload_req_instance = PreloadReq.from_json(json)
# print the JSON string representation of the object
print(PreloadReq.to_json())

# convert the object into a dict
preload_req_dict = preload_req_instance.to_dict()
# create an instance of PreloadReq from a dict
preload_req_from_dict = PreloadReq.from_dict(preload_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


