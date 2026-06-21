# CreateVarReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**connector_id** | **str** |  | 
**keyword** | **str** |  | 
**value** | **str** |  | 
**type** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.create_var_req import CreateVarReq

# TODO update the JSON string below
json = "{}"
# create an instance of CreateVarReq from a JSON string
create_var_req_instance = CreateVarReq.from_json(json)
# print the JSON string representation of the object
print(CreateVarReq.to_json())

# convert the object into a dict
create_var_req_dict = create_var_req_instance.to_dict()
# create an instance of CreateVarReq from a dict
create_var_req_from_dict = CreateVarReq.from_dict(create_var_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


