# DeleteMembersReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workspace_id** | **str** |  | 
**member_ids** | **List[str]** |  | 

## Example

```python
from zhs_api.models.delete_members_req import DeleteMembersReq

# TODO update the JSON string below
json = "{}"
# create an instance of DeleteMembersReq from a JSON string
delete_members_req_instance = DeleteMembersReq.from_json(json)
# print the JSON string representation of the object
print(DeleteMembersReq.to_json())

# convert the object into a dict
delete_members_req_dict = delete_members_req_instance.to_dict()
# create an instance of DeleteMembersReq from a dict
delete_members_req_from_dict = DeleteMembersReq.from_dict(delete_members_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


