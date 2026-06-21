# FeedbackReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**message_id** | **str** |  | 
**conversation_id** | **str** |  | 
**feedback_type** | **str** |  | 
**content** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.feedback_req import FeedbackReq

# TODO update the JSON string below
json = "{}"
# create an instance of FeedbackReq from a JSON string
feedback_req_instance = FeedbackReq.from_json(json)
# print the JSON string representation of the object
print(FeedbackReq.to_json())

# convert the object into a dict
feedback_req_dict = feedback_req_instance.to_dict()
# create an instance of FeedbackReq from a dict
feedback_req_from_dict = FeedbackReq.from_dict(feedback_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


