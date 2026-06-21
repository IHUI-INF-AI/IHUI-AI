# ListConvReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bot_id** | **str** |  | 
**user_id** | **str** |  | 
**limit** | **int** |  | [optional] 
**offset** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.list_conv_req import ListConvReq

# TODO update the JSON string below
json = "{}"
# create an instance of ListConvReq from a JSON string
list_conv_req_instance = ListConvReq.from_json(json)
# print the JSON string representation of the object
print(ListConvReq.to_json())

# convert the object into a dict
list_conv_req_dict = list_conv_req_instance.to_dict()
# create an instance of ListConvReq from a dict
list_conv_req_from_dict = ListConvReq.from_dict(list_conv_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


