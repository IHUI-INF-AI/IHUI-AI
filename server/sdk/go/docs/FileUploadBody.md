# FileUploadBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**FileName** | **string** |  | 
**FilePath** | **string** |  | 
**FileSize** | Pointer to **NullableInt32** |  | [optional] 
**FileType** | Pointer to **NullableString** |  | [optional] 
**Bucket** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewFileUploadBody

`func NewFileUploadBody(fileName string, filePath string, ) *FileUploadBody`

NewFileUploadBody instantiates a new FileUploadBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewFileUploadBodyWithDefaults

`func NewFileUploadBodyWithDefaults() *FileUploadBody`

NewFileUploadBodyWithDefaults instantiates a new FileUploadBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetFileName

`func (o *FileUploadBody) GetFileName() string`

GetFileName returns the FileName field if non-nil, zero value otherwise.

### GetFileNameOk

`func (o *FileUploadBody) GetFileNameOk() (*string, bool)`

GetFileNameOk returns a tuple with the FileName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFileName

`func (o *FileUploadBody) SetFileName(v string)`

SetFileName sets FileName field to given value.


### GetFilePath

`func (o *FileUploadBody) GetFilePath() string`

GetFilePath returns the FilePath field if non-nil, zero value otherwise.

### GetFilePathOk

`func (o *FileUploadBody) GetFilePathOk() (*string, bool)`

GetFilePathOk returns a tuple with the FilePath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFilePath

`func (o *FileUploadBody) SetFilePath(v string)`

SetFilePath sets FilePath field to given value.


### GetFileSize

`func (o *FileUploadBody) GetFileSize() int32`

GetFileSize returns the FileSize field if non-nil, zero value otherwise.

### GetFileSizeOk

`func (o *FileUploadBody) GetFileSizeOk() (*int32, bool)`

GetFileSizeOk returns a tuple with the FileSize field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFileSize

`func (o *FileUploadBody) SetFileSize(v int32)`

SetFileSize sets FileSize field to given value.

### HasFileSize

`func (o *FileUploadBody) HasFileSize() bool`

HasFileSize returns a boolean if a field has been set.

### SetFileSizeNil

`func (o *FileUploadBody) SetFileSizeNil(b bool)`

 SetFileSizeNil sets the value for FileSize to be an explicit nil

### UnsetFileSize
`func (o *FileUploadBody) UnsetFileSize()`

UnsetFileSize ensures that no value is present for FileSize, not even an explicit nil
### GetFileType

`func (o *FileUploadBody) GetFileType() string`

GetFileType returns the FileType field if non-nil, zero value otherwise.

### GetFileTypeOk

`func (o *FileUploadBody) GetFileTypeOk() (*string, bool)`

GetFileTypeOk returns a tuple with the FileType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFileType

`func (o *FileUploadBody) SetFileType(v string)`

SetFileType sets FileType field to given value.

### HasFileType

`func (o *FileUploadBody) HasFileType() bool`

HasFileType returns a boolean if a field has been set.

### SetFileTypeNil

`func (o *FileUploadBody) SetFileTypeNil(b bool)`

 SetFileTypeNil sets the value for FileType to be an explicit nil

### UnsetFileType
`func (o *FileUploadBody) UnsetFileType()`

UnsetFileType ensures that no value is present for FileType, not even an explicit nil
### GetBucket

`func (o *FileUploadBody) GetBucket() string`

GetBucket returns the Bucket field if non-nil, zero value otherwise.

### GetBucketOk

`func (o *FileUploadBody) GetBucketOk() (*string, bool)`

GetBucketOk returns a tuple with the Bucket field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBucket

`func (o *FileUploadBody) SetBucket(v string)`

SetBucket sets Bucket field to given value.

### HasBucket

`func (o *FileUploadBody) HasBucket() bool`

HasBucket returns a boolean if a field has been set.

### SetBucketNil

`func (o *FileUploadBody) SetBucketNil(b bool)`

 SetBucketNil sets the value for Bucket to be an explicit nil

### UnsetBucket
`func (o *FileUploadBody) UnsetBucket()`

UnsetBucket ensures that no value is present for Bucket, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


