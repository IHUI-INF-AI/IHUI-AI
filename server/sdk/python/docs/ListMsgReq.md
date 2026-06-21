# ListMsgReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**conversation_id** | **str** |  | 
**limit** | **int** |  | [optional] 
**offset** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.list_msg_req import ListMsgReq

# TODO update the JSON string below
json = "{}"
# create an instance of ListMsgReq from a JSON string
list_msg_req_instance = ListMsgReq.from_json(json)
# print the JSON string representation of the object
print(ListMsgReq.to_json())

# convert the object into a dict
list_msg_req_dict = list_msg_req_instance.to_dict()
# create an instance of ListMsgReq from a dict
list_msg_req_from_dict = ListMsgReq.from_dict(list_msg_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


