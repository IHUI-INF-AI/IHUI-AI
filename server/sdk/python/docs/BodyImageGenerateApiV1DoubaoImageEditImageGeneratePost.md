# BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'doubao-seedream-3-0-t2i-250415']
**prompt** | **str** |  | 
**size** | **str** |  | [optional] [default to '1024x1024']
**seed** | **int** |  | [optional] [default to -1]
**guidance_scale** | **float** |  | [optional] [default to 2.5]
**watermark** | **bool** |  | [optional] [default to False]

## Example

```python
from zhs_api.models.body_image_generate_api_v1_doubao_image_edit_image_generate_post import BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost

# TODO update the JSON string below
json = "{}"
# create an instance of BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost from a JSON string
body_image_generate_api_v1_doubao_image_edit_image_generate_post_instance = BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.from_json(json)
# print the JSON string representation of the object
print(BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.to_json())

# convert the object into a dict
body_image_generate_api_v1_doubao_image_edit_image_generate_post_dict = body_image_generate_api_v1_doubao_image_edit_image_generate_post_instance.to_dict()
# create an instance of BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost from a dict
body_image_generate_api_v1_doubao_image_edit_image_generate_post_from_dict = BodyImageGenerateApiV1DoubaoImageEditImageGeneratePost.from_dict(body_image_generate_api_v1_doubao_image_edit_image_generate_post_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


