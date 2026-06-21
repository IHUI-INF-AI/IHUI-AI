# BodyImageApiV1UserModelChatImagePost


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'dall-e-3']
**prompt** | **str** |  | 
**size** | **str** |  | [optional] [default to '1024x1024']
**n** | **int** |  | [optional] [default to 1]

## Example

```python
from zhs_api.models.body_image_api_v1_user_model_chat_image_post import BodyImageApiV1UserModelChatImagePost

# TODO update the JSON string below
json = "{}"
# create an instance of BodyImageApiV1UserModelChatImagePost from a JSON string
body_image_api_v1_user_model_chat_image_post_instance = BodyImageApiV1UserModelChatImagePost.from_json(json)
# print the JSON string representation of the object
print(BodyImageApiV1UserModelChatImagePost.to_json())

# convert the object into a dict
body_image_api_v1_user_model_chat_image_post_dict = body_image_api_v1_user_model_chat_image_post_instance.to_dict()
# create an instance of BodyImageApiV1UserModelChatImagePost from a dict
body_image_api_v1_user_model_chat_image_post_from_dict = BodyImageApiV1UserModelChatImagePost.from_dict(body_image_api_v1_user_model_chat_image_post_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


