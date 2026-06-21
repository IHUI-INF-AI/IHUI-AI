# SubmitHunyuan3DRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | 文生3D描述，最多1024字符 | [optional] 
**image_base64** | **str** | 输入图Base64 (&lt;&#x3D;8MB) | [optional] 
**image_url** | **str** | 输入图URL (&lt;&#x3D;8MB) | [optional] 
**multi_view_images** | [**List[ViewImage]**](ViewImage.md) |  | [optional] 
**result_format** | **str** | OBJ/GLB/STL/USDZ/FBX/MP4 | [optional] 
**enable_pbr** | **bool** |  | [optional] 

## Example

```python
from zhs_api.models.submit_hunyuan3_d_request import SubmitHunyuan3DRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SubmitHunyuan3DRequest from a JSON string
submit_hunyuan3_d_request_instance = SubmitHunyuan3DRequest.from_json(json)
# print the JSON string representation of the object
print(SubmitHunyuan3DRequest.to_json())

# convert the object into a dict
submit_hunyuan3_d_request_dict = submit_hunyuan3_d_request_instance.to_dict()
# create an instance of SubmitHunyuan3DRequest from a dict
submit_hunyuan3_d_request_from_dict = SubmitHunyuan3DRequest.from_dict(submit_hunyuan3_d_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


