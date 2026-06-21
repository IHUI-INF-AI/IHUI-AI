# WorkflowRunRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** | 工作流ID | [optional] 
**webhook_path** | **str** | Webhook路径, 默认使用配置中的路径 | [optional] 
**input_data** | **Dict[str, object]** | 工作流输入数据 | [optional] 

## Example

```python
from zhs_api.models.workflow_run_request import WorkflowRunRequest

# TODO update the JSON string below
json = "{}"
# create an instance of WorkflowRunRequest from a JSON string
workflow_run_request_instance = WorkflowRunRequest.from_json(json)
# print the JSON string representation of the object
print(WorkflowRunRequest.to_json())

# convert the object into a dict
workflow_run_request_dict = workflow_run_request_instance.to_dict()
# create an instance of WorkflowRunRequest from a dict
workflow_run_request_from_dict = WorkflowRunRequest.from_dict(workflow_run_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


