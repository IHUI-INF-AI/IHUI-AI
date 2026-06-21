# DatasetCreateReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**description** | **str** |  | [optional] 
**space_id** | **str** |  | 

## Example

```python
from zhs_api.models.dataset_create_req import DatasetCreateReq

# TODO update the JSON string below
json = "{}"
# create an instance of DatasetCreateReq from a JSON string
dataset_create_req_instance = DatasetCreateReq.from_json(json)
# print the JSON string representation of the object
print(DatasetCreateReq.to_json())

# convert the object into a dict
dataset_create_req_dict = dataset_create_req_instance.to_dict()
# create an instance of DatasetCreateReq from a dict
dataset_create_req_from_dict = DatasetCreateReq.from_dict(dataset_create_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


