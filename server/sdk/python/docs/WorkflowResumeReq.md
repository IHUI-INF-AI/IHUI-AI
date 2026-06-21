# WorkflowResumeReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** |  | 
**event_id** | **str** |  | 
**resume_data** | **str** |  | 
**interrupt_type** | **str** |  | 

## Example

```python
from zhs_api.models.workflow_resume_req import WorkflowResumeReq

# TODO update the JSON string below
json = "{}"
# create an instance of WorkflowResumeReq from a JSON string
workflow_resume_req_instance = WorkflowResumeReq.from_json(json)
# print the JSON string representation of the object
print(WorkflowResumeReq.to_json())

# convert the object into a dict
workflow_resume_req_dict = workflow_resume_req_instance.to_dict()
# create an instance of WorkflowResumeReq from a dict
workflow_resume_req_from_dict = WorkflowResumeReq.from_dict(workflow_resume_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


