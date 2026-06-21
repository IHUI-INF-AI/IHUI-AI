# Jimeng4ImageRequest

JiMeng 4.0 text-to-image request (mirrors official API fields).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | Generation prompt | 
**image_urls** | **List[str]** | Reference images (0-10) | [optional] 
**size** | **int** | Total pixel area [1024*1024, 4096*4096] | [optional] 
**width** | **int** | Image width (use with height) | [optional] 
**height** | **int** | Image height (use with width) | [optional] 
**seed** | **int** | Random seed, default -1 | [optional] 
**scale** | **float** | Text influence [0,1], default 0.5 | [optional] 
**force_single** | **bool** | Force single image | [optional] 
**min_ratio** | **float** | Min width/height ratio | [optional] 
**max_ratio** | **float** | Max width/height ratio | [optional] 
**return_url** | **bool** | Return image URLs (24h validity) | [optional] 

## Example

```python
from zhs_api.models.jimeng4_image_request import Jimeng4ImageRequest

# TODO update the JSON string below
json = "{}"
# create an instance of Jimeng4ImageRequest from a JSON string
jimeng4_image_request_instance = Jimeng4ImageRequest.from_json(json)
# print the JSON string representation of the object
print(Jimeng4ImageRequest.to_json())

# convert the object into a dict
jimeng4_image_request_dict = jimeng4_image_request_instance.to_dict()
# create an instance of Jimeng4ImageRequest from a dict
jimeng4_image_request_from_dict = Jimeng4ImageRequest.from_dict(jimeng4_image_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


