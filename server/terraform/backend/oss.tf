###############################################################################
# Terraform Backend 配置 - 阿里云 OSS
#
# 作用: 将 Terraform state 存储到阿里云 OSS, 支持状态锁
# 用法: 替换各云 TF 文件中的 backend 块
###############################################################################

# 阿里云 OSS Backend (适用于 terraform/aliyun/*.tf)
# 使用方法: 取消下方 backend "oss" 块注释, 注释掉 backend "local"
# 然后执行: terraform init -migrate-state

# backend "oss" {
#   bucket   = "zhs-tfstate"
#   key      = "aliyun/prod/terraform.tfstate"
#   region   = "cn-hangzhou"
#   tablestore_endpoint = "https://zhs-tflock.cn-hangzhou.ots.aliyuncs.com"
#   tablestore_table    = "zhs_tfstate_lock"
#   acl                   = "private"
# }

# backend "huaweicloud-obs" {
#   bucket   = "zhs-tfstate"
#   key      = "huawei/prod/terraform.tfstate"
#   region   = "cn-south-1"
#   endpoint = "obs.cn-south-1.myhuaweicloud.com"
#   # 注意: 华为云 OBS 不支持原生 state locking, 用 DynamoDB 替代
# }

# backend "s3" {
#   bucket         = "zhs-tfstate"
#   key            = "aws/prod/terraform.tfstate"
#   region         = "ap-northeast-1"
#   dynamodb_table = "zhs-tfstate-lock"
#   encrypt        = true
#   acl            = "private"
# }

###############################################################################
# 阿里云 OSS 资源 (用于创建 state bucket + lock table)
###############################################################################

# OSS Bucket
resource "alicloud_oss_bucket" "tfstate" {
  bucket = "zhs-tfstate"
  acl    = "private"

  # 跨区复制 (灾备)
  replication_rule {
    id        = "tfstate-dr"
    status    = "enable"
    destination {
      bucket = "zhs-tfstate-dr"
      location = "oss-cn-shanghai"
    }
  }

  # 版本控制 (保留历史)
  versioning = {
    status = "Enabled"
  }

  # 加密
  server_side_encryption {
    enabled = true
  }

  # 生命周期
  lifecycle_rule {
    id      = "tfstate-cleanup"
    enabled = true
    prefix  = ""
    expiration {
      days = 365
    }
    abort_multipart_upload {
      days = 7
    }
  }

  tags = {
    Project     = "zhs-platform"
    ManagedBy   = "terraform"
    Environment = "production"
  }
}

# DR Bucket (跨区复制)
resource "alicloud_oss_bucket" "tfstate_dr" {
  bucket = "zhs-tfstate-dr"
  acl    = "private"

  versioning = {
    status = "Enabled"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Project     = "zhs-platform"
    ManagedBy   = "terraform"
    Environment = "production"
    Purpose     = "disaster-recovery"
  }
}

# Tablestore (状态锁)
resource "alicloud_ots_instance" "tfstate_lock" {
  name        = "zhs-tflock"
  description = "ZHS Terraform state lock"
  accessed_by = "AnyNetwork"
  tags = {
    Project = "zhs-platform"
  }
}

# Tablestore 表 (Terraform state lock)
# 注意: 需要先创建 OTS 实例, 然后通过 terraform_plan 创建表
# 或手动在控制台创建 zhs_tfstate_lock 表 (主键: LockID String)
# Terraform 0.13.0+ 会自动创建表 (如果启用)

###############################################################################
# Variables
###############################################################################

variable "state_bucket_name" {
  type    = string
  default = "zhs-tfstate"
}

variable "state_region" {
  type    = string
  default = "cn-hangzhou"
}

variable "lock_table_name" {
  type    = string
  default = "zhs_tfstate_lock"
}

###############################################################################
# Outputs
###############################################################################

output "tfstate_bucket" {
  value = alicloud_oss_bucket.tfstate.id
}

output "tfstate_dr_bucket" {
  value = alicloud_oss_bucket.tfstate_dr.id
}

output "tflock_instance" {
  value = alicloud_ots_instance.tfstate_lock.name
}
