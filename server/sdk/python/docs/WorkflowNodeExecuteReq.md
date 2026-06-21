# WorkflowNodeExecuteReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** |  | 
**execute_id** | **str** |  | 
**node_execute_uuid** | **str** |  | 

## Example

```python
from zhs_api.models.workflow_node_execute_req import WorkflowNodeExecuteReq

# TODO update the JSON string below
json = "{}"
# create an instance of WorkflowNodeExecuteReq from a JSON string
workflow_node_execute_req_instance = WorkflowNodeExecuteReq.from_json(json)
# print the JSON string representation of the object
print(WorkflowNodeExecuteReq.to_json())

# convert the object into a dict
workflow_node_execute_req_dict = workflow_node_execute_req_instance.to_dict()
# create an instance of WorkflowNodeExecuteReq from a dict
workflow_node_execute_req_from_dict = WorkflowNodeExecuteReq.from_dict(workflow_node_execute_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


