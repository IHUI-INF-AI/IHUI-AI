# MembersReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**workspace_id** | **str** |  | 
**members** | **List[Dict[str, object]]** |  | 

## Example

```python
from zhs_api.models.members_req import MembersReq

# TODO update the JSON string below
json = "{}"
# create an instance of MembersReq from a JSON string
members_req_instance = MembersReq.from_json(json)
# print the JSON string representation of the object
print(MembersReq.to_json())

# convert the object into a dict
members_req_dict = members_req_instance.to_dict()
# create an instance of MembersReq from a dict
members_req_from_dict = MembersReq.from_dict(members_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


