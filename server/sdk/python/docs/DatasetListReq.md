# DatasetListReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**space_id** | **str** |  | 
**limit** | **int** |  | [optional] 
**offset** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.dataset_list_req import DatasetListReq

# TODO update the JSON string below
json = "{}"
# create an instance of DatasetListReq from a JSON string
dataset_list_req_instance = DatasetListReq.from_json(json)
# print the JSON string representation of the object
print(DatasetListReq.to_json())

# convert the object into a dict
dataset_list_req_dict = dataset_list_req_instance.to_dict()
# create an instance of DatasetListReq from a dict
dataset_list_req_from_dict = DatasetListReq.from_dict(dataset_list_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


