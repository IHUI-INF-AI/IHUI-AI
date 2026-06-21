# WorkflowRunHistoryReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** |  | 
**execute_id** | **str** |  | 

## Example

```python
from zhs_api.models.workflow_run_history_req import WorkflowRunHistoryReq

# TODO update the JSON string below
json = "{}"
# create an instance of WorkflowRunHistoryReq from a JSON string
workflow_run_history_req_instance = WorkflowRunHistoryReq.from_json(json)
# print the JSON string representation of the object
print(WorkflowRunHistoryReq.to_json())

# convert the object into a dict
workflow_run_history_req_dict = workflow_run_history_req_instance.to_dict()
# create an instance of WorkflowRunHistoryReq from a dict
workflow_run_history_req_from_dict = WorkflowRunHistoryReq.from_dict(workflow_run_history_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


