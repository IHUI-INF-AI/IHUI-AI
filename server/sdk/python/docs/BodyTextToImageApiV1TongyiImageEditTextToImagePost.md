# BodyTextToImageApiV1TongyiImageEditTextToImagePost


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'qwen-image']
**prompt** | **str** |  | 
**negative_prompt** | **str** |  | [optional] 
**size** | **str** |  | [optional] [default to '1024*1024']
**n** | **int** |  | [optional] [default to 1]
**style** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post import BodyTextToImageApiV1TongyiImageEditTextToImagePost

# TODO update the JSON string below
json = "{}"
# create an instance of BodyTextToImageApiV1TongyiImageEditTextToImagePost from a JSON string
body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post_instance = BodyTextToImageApiV1TongyiImageEditTextToImagePost.from_json(json)
# print the JSON string representation of the object
print(BodyTextToImageApiV1TongyiImageEditTextToImagePost.to_json())

# convert the object into a dict
body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post_dict = body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post_instance.to_dict()
# create an instance of BodyTextToImageApiV1TongyiImageEditTextToImagePost from a dict
body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post_from_dict = BodyTextToImageApiV1TongyiImageEditTextToImagePost.from_dict(body_text_to_image_api_v1_tongyi_image_edit_text_to_image_post_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


