{{/* 通用辅助模板: 名称 / 标签 / 选择器 */}}

{{/* helm 3.14 兼容: 部分构建已移除 sprig "string" 函数别名, 统一用 "toString" 兜底. */}}
{{- define "zhs-platform.toString" -}}
{{- printf "%v" . -}}
{{- end -}}

{{- define "zhs-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "zhs-platform.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "zhs-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "zhs-platform.labels" -}}
helm.sh/chart: {{ include "zhs-platform.chart" . }}
{{ include "zhs-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: zhs-platform
{{- end -}}

{{- define "zhs-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "zhs-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "zhs-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "zhs-platform.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
