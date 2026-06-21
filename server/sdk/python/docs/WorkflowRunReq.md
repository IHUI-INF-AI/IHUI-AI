# WorkflowRunReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** |  | 
**parameters** | **Dict[str, object]** |  | [optional] 
**is_async** | **bool** |  | [optional] [default to False]

## Example

```python
from zhs_api.models.workflow_run_req import WorkflowRunReq

# TODO update the JSON string below
json = "{}"
# create an instance of WorkflowRunReq from a JSON string
workflow_run_req_instance = WorkflowRunReq.from_json(json)
# print the JSON string representation of the object
print(WorkflowRunReq.to_json())

# convert the object into a dict
workflow_run_req_dict = workflow_run_req_instance.to_dict()
# create an instance of WorkflowRunReq from a dict
workflow_run_req_from_dict = WorkflowRunReq.from_dict(workflow_run_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


