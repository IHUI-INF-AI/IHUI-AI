# N8NWorkflowsRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**n8n_domain** | **str** | N8N实例域名, e.g. &#39;zhangsan12.app.n8n.cloud&#39; | 
**api_key** | **str** | N8N API Key (X-N8N-API-KEY) | 

## Example

```python
from zhs_api.models.n8_n_workflows_request import N8NWorkflowsRequest

# TODO update the JSON string below
json = "{}"
# create an instance of N8NWorkflowsRequest from a JSON string
n8_n_workflows_request_instance = N8NWorkflowsRequest.from_json(json)
# print the JSON string representation of the object
print(N8NWorkflowsRequest.to_json())

# convert the object into a dict
n8_n_workflows_request_dict = n8_n_workflows_request_instance.to_dict()
# create an instance of N8NWorkflowsRequest from a dict
n8_n_workflows_request_from_dict = N8NWorkflowsRequest.from_dict(n8_n_workflows_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


