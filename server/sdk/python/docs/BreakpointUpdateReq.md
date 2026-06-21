# BreakpointUpdateReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**video_id** | **str** |  | 
**user_id** | **str** |  | 
**current_seconds** | **float** |  | 
**current_offset** | **int** |  | [optional] [default to 0]

## Example

```python
from zhs_api.models.breakpoint_update_req import BreakpointUpdateReq

# TODO update the JSON string below
json = "{}"
# create an instance of BreakpointUpdateReq from a JSON string
breakpoint_update_req_instance = BreakpointUpdateReq.from_json(json)
# print the JSON string representation of the object
print(BreakpointUpdateReq.to_json())

# convert the object into a dict
breakpoint_update_req_dict = breakpoint_update_req_instance.to_dict()
# create an instance of BreakpointUpdateReq from a dict
breakpoint_update_req_from_dict = BreakpointUpdateReq.from_dict(breakpoint_update_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


