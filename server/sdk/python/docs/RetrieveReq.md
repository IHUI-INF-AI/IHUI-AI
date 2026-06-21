# RetrieveReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**conversation_id** | **str** |  | 

## Example

```python
from zhs_api.models.retrieve_req import RetrieveReq

# TODO update the JSON string below
json = "{}"
# create an instance of RetrieveReq from a JSON string
retrieve_req_instance = RetrieveReq.from_json(json)
# print the JSON string representation of the object
print(RetrieveReq.to_json())

# convert the object into a dict
retrieve_req_dict = retrieve_req_instance.to_dict()
# create an instance of RetrieveReq from a dict
retrieve_req_from_dict = RetrieveReq.from_dict(retrieve_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


