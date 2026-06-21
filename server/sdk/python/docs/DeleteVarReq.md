# DeleteVarReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**connector_id** | **str** |  | 
**variable_id** | **str** |  | 

## Example

```python
from zhs_api.models.delete_var_req import DeleteVarReq

# TODO update the JSON string below
json = "{}"
# create an instance of DeleteVarReq from a JSON string
delete_var_req_instance = DeleteVarReq.from_json(json)
# print the JSON string representation of the object
print(DeleteVarReq.to_json())

# convert the object into a dict
delete_var_req_dict = delete_var_req_instance.to_dict()
# create an instance of DeleteVarReq from a dict
delete_var_req_from_dict = DeleteVarReq.from_dict(delete_var_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


