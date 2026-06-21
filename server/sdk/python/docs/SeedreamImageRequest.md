# SeedreamImageRequest

Request body for Seedream image generation (via Doubao Bearer token API).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | Generation prompt, supports Chinese/English | 
**user_uuid** | **str** | User UUID | 
**chat_id** | **str** | Chat context ID | [optional] 
**images** | **str** | Image URL or Base64 for image-to-image | [optional] 
**zidingyican** | [**List[AppApiV1AiDoubaoRouteCustomParameter]**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] 

## Example

```python
from zhs_api.models.seedream_image_request import SeedreamImageRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SeedreamImageRequest from a JSON string
seedream_image_request_instance = SeedreamImageRequest.from_json(json)
# print the JSON string representation of the object
print(SeedreamImageRequest.to_json())

# convert the object into a dict
seedream_image_request_dict = seedream_image_request_instance.to_dict()
# create an instance of SeedreamImageRequest from a dict
seedream_image_request_from_dict = SeedreamImageRequest.from_dict(seedream_image_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


