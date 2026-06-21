# TrafficRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**count** | **int** | 流量数 | [optional] [default to 1]

## Example

```python
from zhs_api.models.traffic_request import TrafficRequest

# TODO update the JSON string below
json = "{}"
# create an instance of TrafficRequest from a JSON string
traffic_request_instance = TrafficRequest.from_json(json)
# print the JSON string representation of the object
print(TrafficRequest.to_json())

# convert the object into a dict
traffic_request_dict = traffic_request_instance.to_dict()
# create an instance of TrafficRequest from a dict
traffic_request_from_dict = TrafficRequest.from_dict(traffic_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


