# AsyncWorkflowStreamReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workflow_id** | **str** |  | 
**user_id** | **str** |  | 
**input_data** | **Dict[str, object]** |  | [optional] 
**chat_id** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.async_workflow_stream_req import AsyncWorkflowStreamReq

# TODO update the JSON string below
json = "{}"
# create an instance of AsyncWorkflowStreamReq from a JSON string
async_workflow_stream_req_instance = AsyncWorkflowStreamReq.from_json(json)
# print the JSON string representation of the object
print(AsyncWorkflowStreamReq.to_json())

# convert the object into a dict
async_workflow_stream_req_dict = async_workflow_stream_req_instance.to_dict()
# create an instance of AsyncWorkflowStreamReq from a dict
async_workflow_stream_req_from_dict = AsyncWorkflowStreamReq.from_dict(async_workflow_stream_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


