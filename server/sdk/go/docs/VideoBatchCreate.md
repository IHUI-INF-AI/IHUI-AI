# VideoBatchCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CourseId** | **int32** |  | 
**Videos** | [**[]VideoCreate**](VideoCreate.md) |  | 

## Methods

### NewVideoBatchCreate

`func NewVideoBatchCreate(courseId int32, videos []VideoCreate, ) *VideoBatchCreate`

NewVideoBatchCreate instantiates a new VideoBatchCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVideoBatchCreateWithDefaults

`func NewVideoBatchCreateWithDefaults() *VideoBatchCreate`

NewVideoBatchCreateWithDefaults instantiates a new VideoBatchCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCourseId

`func (o *VideoBatchCreate) GetCourseId() int32`

GetCourseId returns the CourseId field if non-nil, zero value otherwise.

### GetCourseIdOk

`func (o *VideoBatchCreate) GetCourseIdOk() (*int32, bool)`

GetCourseIdOk returns a tuple with the CourseId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCourseId

`func (o *VideoBatchCreate) SetCourseId(v int32)`

SetCourseId sets CourseId field to given value.


### GetVideos

`func (o *VideoBatchCreate) GetVideos() []VideoCreate`

GetVideos returns the Videos field if non-nil, zero value otherwise.

### GetVideosOk

`func (o *VideoBatchCreate) GetVideosOk() (*[]VideoCreate, bool)`

GetVideosOk returns a tuple with the Videos field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideos

`func (o *VideoBatchCreate) SetVideos(v []VideoCreate)`

SetVideos sets Videos field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


