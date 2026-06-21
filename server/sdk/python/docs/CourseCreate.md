# CourseCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | 
**subtitle** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 
**remark_file** | **str** |  | [optional] 
**binding** | **str** |  | [optional] 
**stage** | **str** |  | [optional] 
**label** | **str** |  | [optional] 
**sort** | **int** |  | [optional] [default to 0]
**is_hidden** | **int** |  | [optional] [default to 0]

## Example

```python
from zhs_api.models.course_create import CourseCreate

# TODO update the JSON string below
json = "{}"
# create an instance of CourseCreate from a JSON string
course_create_instance = CourseCreate.from_json(json)
# print the JSON string representation of the object
print(CourseCreate.to_json())

# convert the object into a dict
course_create_dict = course_create_instance.to_dict()
# create an instance of CourseCreate from a dict
course_create_from_dict = CourseCreate.from_dict(course_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


