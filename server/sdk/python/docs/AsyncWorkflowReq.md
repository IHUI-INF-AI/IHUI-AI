# AsyncWorkflowReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** |  | 
**user_id** | **str** |  | 
**input_data** | **Dict[str, object]** |  | [optional] 

## Example

```python
from zhs_api.models.async_workflow_req import AsyncWorkflowReq

# TODO update the JSON string below
json = "{}"
# create an instance of AsyncWorkflowReq from a JSON string
async_workflow_req_instance = AsyncWorkflowReq.from_json(json)
# print the JSON string representation of the object
print(AsyncWorkflowReq.to_json())

# convert the object into a dict
async_workflow_req_dict = async_workflow_req_instance.to_dict()
# create an instance of AsyncWorkflowReq from a dict
async_workflow_req_from_dict = AsyncWorkflowReq.from_dict(async_workflow_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


