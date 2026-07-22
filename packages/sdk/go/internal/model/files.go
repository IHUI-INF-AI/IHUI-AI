// Package model 的文件(列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传)类型。
package model

// FileListItem 是文件列表项。
type FileListItem struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Filename  string `json:"filename"`
	Bytes     int64  `json:"bytes"`
	CreatedAt string `json:"createdAt"`
}

// FilesListResponse 是 GET /v1/files 响应体。
type FilesListResponse struct {
	Object string         `json:"object"`
	Data   []FileListItem `json:"data"`
}

// FileInfo 是 GET /v1/files/:id 响应体(文件详情)。
type FileInfo struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Filename  string `json:"filename"`
	Bytes     int64  `json:"bytes"`
	MimeType  string `json:"mimeType"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// UploadInitRequest 是 POST /v1/files/upload-init 请求体(分片上传初始化)。
type UploadInitRequest struct {
	Filename  string `json:"filename"`
	Size      int64  `json:"size"`
	MimeType  string `json:"mimeType"`
	ChunkSize int    `json:"chunkSize"`
}

// UploadInitResponse 是 POST /v1/files/upload-init 响应体。
type UploadInitResponse struct {
	UploadID   string `json:"uploadId"`
	ChunkCount int    `json:"chunkCount"`
}

// UploadChunkRequest 是 POST /v1/files/upload-chunk 请求体。
type UploadChunkRequest struct {
	UploadID string `json:"uploadId"`
	Index    int    `json:"index"`
	Chunk    string `json:"chunk"`
}

// UploadCompleteRequest 是 POST /v1/files/complete 请求体。
type UploadCompleteRequest struct {
	UploadID string `json:"uploadId"`
}

// UploadCompleteResponse 是 POST /v1/files/complete 响应体。
type UploadCompleteResponse struct {
	FileID string `json:"fileId"`
	Status string `json:"status"`
}

// FileVersionItem 是文件版本项。
type FileVersionItem struct {
	Version   int    `json:"version"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
	Checksum  string `json:"checksum"`
}

// FileVersionsResponse 是 GET /v1/files/:id/versions 响应体。
type FileVersionsResponse struct {
	Object string            `json:"object"`
	Data   []FileVersionItem `json:"data"`
}
