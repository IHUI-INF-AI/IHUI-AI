# SendToClientRequest

发送给指定客户端.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**message** | **Dict[str, object]** | 要发送的消息内容 | 

## Example

```python
from zhs_api.models.send_to_client_request import SendToClientRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SendToClientRequest from a JSON string
send_to_client_request_instance = SendToClientRequest.from_json(json)
# print the JSON string representation of the object
print(SendToClientRequest.to_json())

# convert the object into a dict
send_to_client_request_dict = send_to_client_request_instance.to_dict()
# create an instance of SendToClientRequest from a dict
send_to_client_request_from_dict = SendToClientRequest.from_dict(send_to_client_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


