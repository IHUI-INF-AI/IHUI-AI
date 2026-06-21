# CourseUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | [optional] 
**subtitle** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 
**remark_file** | **str** |  | [optional] 
**binding** | **str** |  | [optional] 
**stage** | **str** |  | [optional] 
**label** | **str** |  | [optional] 
**sort** | **int** |  | [optional] 
**is_hidden** | **int** |  | [optional] 
**audit_status** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.course_update import CourseUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of CourseUpdate from a JSON string
course_update_instance = CourseUpdate.from_json(json)
# print the JSON string representation of the object
print(CourseUpdate.to_json())

# convert the object into a dict
course_update_dict = course_update_instance.to_dict()
# create an instance of CourseUpdate from a dict
course_update_from_dict = CourseUpdate.from_dict(course_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


