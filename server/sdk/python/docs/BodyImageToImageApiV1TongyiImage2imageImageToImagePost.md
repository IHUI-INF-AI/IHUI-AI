# BodyImageToImageApiV1TongyiImage2imageImageToImagePost


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'wanx2.1-imageedit']
**image_url** | **str** |  | 
**prompt** | **str** |  | 
**strength** | **float** |  | [optional] [default to 0.8]
**style** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.body_image_to_image_api_v1_tongyi_image2image_image_to_image_post import BodyImageToImageApiV1TongyiImage2imageImageToImagePost

# TODO update the JSON string below
json = "{}"
# create an instance of BodyImageToImageApiV1TongyiImage2imageImageToImagePost from a JSON string
body_image_to_image_api_v1_tongyi_image2image_image_to_image_post_instance = BodyImageToImageApiV1TongyiImage2imageImageToImagePost.from_json(json)
# print the JSON string representation of the object
print(BodyImageToImageApiV1TongyiImage2imageImageToImagePost.to_json())

# convert the object into a dict
body_image_to_image_api_v1_tongyi_image2image_image_to_image_post_dict = body_image_to_image_api_v1_tongyi_image2image_image_to_image_post_instance.to_dict()
# create an instance of BodyImageToImageApiV1TongyiImage2imageImageToImagePost from a dict
body_image_to_image_api_v1_tongyi_image2image_image_to_image_post_from_dict = BodyImageToImageApiV1TongyiImage2imageImageToImagePost.from_dict(body_image_to_image_api_v1_tongyi_image2image_image_to_image_post_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


