# DoubaoImageRequest

Request body for doubao image generation (jimeng_t2i_v40 via Volcengine signed API).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** |  | 
**user_uuid** | **str** |  | 
**chat_id** | **str** |  | [optional] 
**zidingyican** | [**List[AppApiV1AiDoubaoRouteCustomParameter]**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] 

## Example

```python
from zhs_api.models.doubao_image_request import DoubaoImageRequest

# TODO update the JSON string below
json = "{}"
# create an instance of DoubaoImageRequest from a JSON string
doubao_image_request_instance = DoubaoImageRequest.from_json(json)
# print the JSON string representation of the object
print(DoubaoImageRequest.to_json())

# convert the object into a dict
doubao_image_request_dict = doubao_image_request_instance.to_dict()
# create an instance of DoubaoImageRequest from a dict
doubao_image_request_from_dict = DoubaoImageRequest.from_dict(doubao_image_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


