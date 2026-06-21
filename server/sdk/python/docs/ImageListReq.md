# ImageListReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**dataset_id** | **str** |  | 
**limit** | **int** |  | [optional] 
**offset** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.image_list_req import ImageListReq

# TODO update the JSON string below
json = "{}"
# create an instance of ImageListReq from a JSON string
image_list_req_instance = ImageListReq.from_json(json)
# print the JSON string representation of the object
print(ImageListReq.to_json())

# convert the object into a dict
image_list_req_dict = image_list_req_instance.to_dict()
# create an instance of ImageListReq from a dict
image_list_req_from_dict = ImageListReq.from_dict(image_list_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


