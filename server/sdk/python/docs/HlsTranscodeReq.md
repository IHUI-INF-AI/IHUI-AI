# HlsTranscodeReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**video_id** | **str** |  | 
**video_path** | **str** |  | [optional] 
**segment_time** | **int** |  | [optional] [default to 4]

## Example

```python
from zhs_api.models.hls_transcode_req import HlsTranscodeReq

# TODO update the JSON string below
json = "{}"
# create an instance of HlsTranscodeReq from a JSON string
hls_transcode_req_instance = HlsTranscodeReq.from_json(json)
# print the JSON string representation of the object
print(HlsTranscodeReq.to_json())

# convert the object into a dict
hls_transcode_req_dict = hls_transcode_req_instance.to_dict()
# create an instance of HlsTranscodeReq from a dict
hls_transcode_req_from_dict = HlsTranscodeReq.from_dict(hls_transcode_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


