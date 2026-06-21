# BreakpointReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**video_id** | **str** |  | 
**breakpoint_seconds** | **float** |  | 
**preload_seconds** | **float** |  | [optional] [default to 10.0]

## Example

```python
from zhs_api.models.breakpoint_req import BreakpointReq

# TODO update the JSON string below
json = "{}"
# create an instance of BreakpointReq from a JSON string
breakpoint_req_instance = BreakpointReq.from_json(json)
# print the JSON string representation of the object
print(BreakpointReq.to_json())

# convert the object into a dict
breakpoint_req_dict = breakpoint_req_instance.to_dict()
# create an instance of BreakpointReq from a dict
breakpoint_req_from_dict = BreakpointReq.from_dict(breakpoint_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


