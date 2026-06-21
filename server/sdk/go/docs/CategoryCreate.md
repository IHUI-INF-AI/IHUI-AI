# CategoryCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Pid** | Pointer to **int32** |  | [optional] [default to 0]
**Name** | **string** |  | 
**SortOrder** | Pointer to **int32** |  | [optional] [default to 0]
**IsShow** | Pointer to **bool** |  | [optional] [default to true]
**IsShowIndex** | Pointer to **bool** |  | [optional] [default to false]
**Image** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewCategoryCreate

`func NewCategoryCreate(name string, ) *CategoryCreate`

NewCategoryCreate instantiates a new CategoryCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCategoryCreateWithDefaults

`func NewCategoryCreateWithDefaults() *CategoryCreate`

NewCategoryCreateWithDefaults instantiates a new CategoryCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPid

`func (o *CategoryCreate) GetPid() int32`

GetPid returns the Pid field if non-nil, zero value otherwise.

### GetPidOk

`func (o *CategoryCreate) GetPidOk() (*int32, bool)`

GetPidOk returns a tuple with the Pid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPid

`func (o *CategoryCreate) SetPid(v int32)`

SetPid sets Pid field to given value.

### HasPid

`func (o *CategoryCreate) HasPid() bool`

HasPid returns a boolean if a field has been set.

### GetName

`func (o *CategoryCreate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *CategoryCreate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *CategoryCreate) SetName(v string)`

SetName sets Name field to given value.


### GetSortOrder

`func (o *CategoryCreate) GetSortOrder() int32`

GetSortOrder returns the SortOrder field if non-nil, zero value otherwise.

### GetSortOrderOk

`func (o *CategoryCreate) GetSortOrderOk() (*int32, bool)`

GetSortOrderOk returns a tuple with the SortOrder field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSortOrder

`func (o *CategoryCreate) SetSortOrder(v int32)`

SetSortOrder sets SortOrder field to given value.

### HasSortOrder

`func (o *CategoryCreate) HasSortOrder() bool`

HasSortOrder returns a boolean if a field has been set.

### GetIsShow

`func (o *CategoryCreate) GetIsShow() bool`

GetIsShow returns the IsShow field if non-nil, zero value otherwise.

### GetIsShowOk

`func (o *CategoryCreate) GetIsShowOk() (*bool, bool)`

GetIsShowOk returns a tuple with the IsShow field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsShow

`func (o *CategoryCreate) SetIsShow(v bool)`

SetIsShow sets IsShow field to given value.

### HasIsShow

`func (o *CategoryCreate) HasIsShow() bool`

HasIsShow returns a boolean if a field has been set.

### GetIsShowIndex

`func (o *CategoryCreate) GetIsShowIndex() bool`

GetIsShowIndex returns the IsShowIndex field if non-nil, zero value otherwise.

### GetIsShowIndexOk

`func (o *CategoryCreate) GetIsShowIndexOk() (*bool, bool)`

GetIsShowIndexOk returns a tuple with the IsShowIndex field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsShowIndex

`func (o *CategoryCreate) SetIsShowIndex(v bool)`

SetIsShowIndex sets IsShowIndex field to given value.

### HasIsShowIndex

`func (o *CategoryCreate) HasIsShowIndex() bool`

HasIsShowIndex returns a boolean if a field has been set.

### GetImage

`func (o *CategoryCreate) GetImage() string`

GetImage returns the Image field if non-nil, zero value otherwise.

### GetImageOk

`func (o *CategoryCreate) GetImageOk() (*string, bool)`

GetImageOk returns a tuple with the Image field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImage

`func (o *CategoryCreate) SetImage(v string)`

SetImage sets Image field to given value.

### HasImage

`func (o *CategoryCreate) HasImage() bool`

HasImage returns a boolean if a field has been set.

### SetImageNil

`func (o *CategoryCreate) SetImageNil(b bool)`

 SetImageNil sets the value for Image to be an explicit nil

### UnsetImage
`func (o *CategoryCreate) UnsetImage()`

UnsetImage ensures that no value is present for Image, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


