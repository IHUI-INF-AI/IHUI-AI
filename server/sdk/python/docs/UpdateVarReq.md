# UpdateVarReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**connector_id** | **str** |  | 
**variable_id** | **str** |  | 
**value** | **str** |  | 

## Example

```python
from zhs_api.models.update_var_req import UpdateVarReq

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateVarReq from a JSON string
update_var_req_instance = UpdateVarReq.from_json(json)
# print the JSON string representation of the object
print(UpdateVarReq.to_json())

# convert the object into a dict
update_var_req_dict = update_var_req_instance.to_dict()
# create an instance of UpdateVarReq from a dict
update_var_req_from_dict = UpdateVarReq.from_dict(update_var_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


