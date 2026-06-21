###############################################################################
# ZHS 平台 - 阿里云 (杭州) 基础设施
#
# 作用: 定义阿里云 (主) 区域的全部基础设施
# 区域: 华东 1 (杭州) cn-hangzhou
# 资源:
#   - VPC + 3 个交换机 (app/db/bastion)
#   - 2 个 ECS 节点 (Patroni Leader + Standby witness)
#   - 1 个 RDS PostgreSQL (备用, 实际生产使用自建 Patroni)
#   - 1 个 SLB (应用入口)
#   - 1 个 NAT 网关 (出网)
#   - 3 个 EIP (ECS 绑定)
#   - 1 个安全组 (应用)
#
# 用法:
#   terraform init
#   terraform plan -out=tfplan
#   terraform apply tfplan
#   terraform destroy
#
# RPO/RTO:
#   RPO: 0 (同步复制到 华为云)
#   RTO: 15s (Patroni 自动切换)
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.220"
    }
  }

  # 远端状态 (生产环境使用 OSS + 状态锁)
  # 注释: 开发环境用本地 fs 即可
  # backend "oss" {
  #   bucket = "zhs-tfstate"
  #   key    = "aliyun/prod/terraform.tfstate"
  #   region = "cn-hangzhou"
  # }
}

###############################################################################
# Provider & 变量
###############################################################################

provider "alicloud" {
  region = var.region
  # access_key / secret_key 通过环境变量 ALICLOUD_ACCESS_KEY / ALICLOUD_SECRET_KEY 注入
}

variable "region" {
  description = "阿里云区域"
  type        = string
  default     = "cn-hangzhou"
}

variable "db_account_password" {
  description = "RDS 数据库账号密码 (通过 terraform.tfvars 或环境变量 TF_VAR_db_account_password 注入)"
  type        = string
  sensitive   = true
}

variable "vpc_cidr" {
  description = "VPC 网段"
  type        = string
  default     = "10.0.0.0/16"
}

variable "app_vswitch_cidr" {
  description = "应用交换机网段"
  type        = string
  default     = "10.0.1.0/24"
}

variable "db_vswitch_cidr" {
  description = "数据库交换机网段"
  type        = string
  default     = "10.0.2.0/24"
}

variable "bastion_vswitch_cidr" {
  description = "堡垒机交换机网段"
  type        = string
  default     = "10.0.3.0/24"
}

variable "instance_type" {
  description = "ECS 实例规格 (生产建议 ecs.g6.4xlarge)"
  type        = string
  default     = "ecs.g6.large"
}

variable "image_id" {
  description = "基础镜像 (Ubuntu 22.04)"
  type        = string
  default     = "ubuntu_22_04_x64_20G_alibase_20231221.vhd"
}

variable "ssh_key_name" {
  description = "SSH 密钥对名称 (提前在阿里云控制台创建)"
  type        = string
  default     = "zhs-prod-key"
}

variable "allowed_ssh_cidr" {
  description = "允许 SSH 访问的 IP 段"
  type        = string
  default     = "0.0.0.0/0"
}

variable "tags" {
  description = "全局标签"
  type        = map(string)
  default = {
    Project     = "zhs-platform"
    ManagedBy   = "terraform"
    Environment = "production"
    Region      = "aliyun-hangzhou"
  }
}

###############################################################################
# VPC + 交换机
###############################################################################

resource "alicloud_vpc" "zhs_vpc" {
  vpc_name    = "zhs-vpc-${var.region}"
  cidr_block  = var.vpc_cidr
  description = "ZHS 平台主 VPC"

  tags = var.tags
}

resource "alicloud_vswitch" "app_vswitch" {
  vswitch_name = "zhs-app-vswitch"
  vpc_id       = alicloud_vpc.zhs_vpc.id
  cidr_block   = var.app_vswitch_cidr
  zone_id      = "cn-hangzhou-h"
  description  = "应用层交换机"

  tags = var.tags
}

resource "alicloud_vswitch" "db_vswitch" {
  vswitch_name = "zhs-db-vswitch"
  vpc_id       = alicloud_vpc.zhs_vpc.id
  cidr_block   = var.db_vswitch_cidr
  zone_id      = "cn-hangzhou-h"
  description  = "数据库交换机"

  tags = var.tags
}

resource "alicloud_vswitch" "bastion_vswitch" {
  vswitch_name = "zhs-bastion-vswitch"
  vpc_id       = alicloud_vpc.zhs_vpc.id
  cidr_block   = var.bastion_vswitch_cidr
  zone_id      = "cn-hangzhou-h"
  description  = "堡垒机交换机"

  tags = var.tags
}

###############################################################################
# 安全组
###############################################################################

resource "alicloud_security_group" "app_sg" {
  name        = "zhs-app-sg"
  vpc_id      = alicloud_vpc.zhs_vpc.id
  description = "ZHS 应用安全组"

  tags = var.tags
}

# 允许 8000 (应用 HTTP) 从内网访问
resource "alicloud_security_group_rule" "allow_app_intranet" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "8000/8000"
  security_group_id = alicloud_security_group.app_sg.id
  cidr_ip           = var.vpc_cidr
  description       = "应用 HTTP (内网)"
}

# 允许 22 (SSH) 从指定网段访问
resource "alicloud_security_group_rule" "allow_ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "22/22"
  security_group_id = alicloud_security_group.app_sg.id
  cidr_ip           = var.allowed_ssh_cidr
  description       = "SSH"
}

# 允许 5432 (PostgreSQL) 从内网访问
resource "alicloud_security_group_rule" "allow_pg_intranet" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "5432/5432"
  security_group_id = alicloud_security_group.app_sg.id
  cidr_ip           = var.vpc_cidr
  description       = "PostgreSQL (内网)"
}

# 允许 8008 (Patroni REST) 从内网访问
resource "alicloud_security_group_rule" "allow_patroni_intranet" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "8008/8008"
  security_group_id = alicloud_security_group.app_sg.id
  cidr_ip           = var.vpc_cidr
  description       = "Patroni REST"
}

# 允许 6432/6433 (pgBouncer) 从内网访问
resource "alicloud_security_group_rule" "allow_pgbouncer_intranet" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "6432/6433"
  security_group_id = alicloud_security_group.app_sg.id
  cidr_ip           = var.vpc_cidr
  description       = "pgBouncer"
}

# 出方向: 允许全部
resource "alicloud_security_group_rule" "allow_all_outbound" {
  type              = "egress"
  ip_protocol       = "all"
  port_range        = "-1/-1"
  security_group_id = alicloud_security_group.app_sg.id
  cidr_ip           = "0.0.0.0/0"
  description       = "出方向全放行"
}

###############################################################################
# NAT 网关 + EIP
###############################################################################

resource "alicloud_eip" "nat_eip" {
  bandwidth            = "10"
  internet_charge_type = "PayByTraffic"
  description          = "ZHS NAT EIP"

  tags = var.tags
}

resource "alicloud_nat_gateway" "zhs_nat" {
  vpc_id           = alicloud_vpc.zhs_vpc.id
  nat_gateway_name = "zhs-nat"
  description      = "ZHS NAT 网关"
  payment_type     = "PayAsYouGo"
  nat_type         = "Enhanced"
  eip_bind         = alicloud_eip.nat_eip.id

  tags = var.tags
}

# 应用交换机走 NAT
resource "alicloud_snat_entry" "app_snat" {
  snat_table_id     = alicloud_nat_gateway.zhs_nat.snat_table_ids[0]
  source_vswitch_id = alicloud_vswitch.app_vswitch.id
  snat_ip           = alicloud_eip.nat_eip.ip_address
}

###############################################################################
# ECS 节点
###############################################################################

# 节点 1: Patroni Leader
resource "alicloud_instance" "patroni_leader" {
  instance_name        = "zhs-patroni-leader"
  image_id             = var.image_id
  instance_type        = var.instance_type
  security_groups      = [alicloud_security_group.app_sg.id]
  vswitch_id           = alicloud_vswitch.db_vswitch.id
  internet_charge_type = "PayByTraffic"
  internet_max_bandwidth_out = "5"
  system_disk_category = "cloud_essd"
  system_disk_size     = 100
  key_name             = var.ssh_key_name
  instance_charge_type = "PostPaid"

  tags = merge(var.tags, { Role = "patroni-leader" })
}

# 节点 2: Patroni Standby witness
resource "alicloud_instance" "patroni_standby" {
  instance_name        = "zhs-patroni-standby"
  image_id             = var.image_id
  instance_type        = var.instance_type
  security_groups      = [alicloud_security_group.app_sg.id]
  vswitch_id           = alicloud_vswitch.db_vswitch.id
  internet_charge_type = "PayByTraffic"
  internet_max_bandwidth_out = "5"
  system_disk_category = "cloud_essd"
  system_disk_size     = 100
  key_name             = var.ssh_key_name
  instance_charge_type = "PostPaid"

  tags = merge(var.tags, { Role = "patroni-standby" })
}

# 节点 3: pgBouncer
resource "alicloud_instance" "pgbouncer" {
  instance_name        = "zhs-pgbouncer"
  image_id             = var.image_id
  instance_type        = "ecs.g6.medium"
  security_groups      = [alicloud_security_group.app_sg.id]
  vswitch_id           = alicloud_vswitch.app_vswitch.id
  internet_charge_type = "PayByTraffic"
  internet_max_bandwidth_out = "5"
  system_disk_category = "cloud_essd"
  system_disk_size     = 50
  key_name             = var.ssh_key_name
  instance_charge_type = "PostPaid"

  tags = merge(var.tags, { Role = "pgbouncer" })
}

# 节点 4: App 节点 1
resource "alicloud_instance" "app_node1" {
  instance_name        = "zhs-app-1"
  image_id             = var.image_id
  instance_type        = "ecs.g6.large"
  security_groups      = [alicloud_security_group.app_sg.id]
  vswitch_id           = alicloud_vswitch.app_vswitch.id
  internet_charge_type = "PayByTraffic"
  internet_max_bandwidth_out = "10"
  system_disk_category = "cloud_essd"
  system_disk_size     = 100
  key_name             = var.ssh_key_name
  instance_charge_type = "PostPaid"

  tags = merge(var.tags, { Role = "app-node" })
}

# 节点 5: App 节点 2
resource "alicloud_instance" "app_node2" {
  instance_name        = "zhs-app-2"
  image_id             = var.image_id
  instance_type        = "ecs.g6.large"
  security_groups      = [alicloud_security_group.app_sg.id]
  vswitch_id           = alicloud_vswitch.app_vswitch.id
  internet_charge_type = "PayByTraffic"
  internet_max_bandwidth_out = "10"
  system_disk_category = "cloud_essd"
  system_disk_size     = 100
  key_name             = var.ssh_key_name
  instance_charge_type = "PostPaid"

  tags = merge(var.tags, { Role = "app-node" })
}

###############################################################################
# EIP (公网入口)
###############################################################################

resource "alicloud_eip" "app_eip" {
  bandwidth            = "100"
  internet_charge_type = "PayByTraffic"
  description          = "ZHS App EIP (绑定 SLB)"

  tags = var.tags
}

###############################################################################
# SLB (应用负载均衡)
###############################################################################

resource "alicloud_slb" "zhs_slb" {
  name                 = "zhs-app-slb"
  internet             = true
  internet_charge_type = "PayByTraffic"
  bandwidth            = 100
  vswitch_id           = alicloud_vswitch.app_vswitch.id
  specification        = "slb.s2.small"
  address_type         = "internet"

  tags = merge(var.tags, { Component = "slb" })
}

# 绑定 EIP
resource "alicloud_eip_association" "slb_eip" {
  allocation_id = alicloud_eip.app_eip.id
  instance_id   = alicloud_slb.zhs_slb.id
}

# 应用 server group
resource "alicloud_slb_server_group" "app_group" {
  name             = "zhs-app-group"
  load_balancer_id = alicloud_slb.zhs_slb.id
  servers {
    server_id   = alicloud_instance.app_node1.id
    server_ip   = alicloud_instance.app_node1.private_ip
    port        = 8000
    weight      = 100
  }
  servers {
    server_id   = alicloud_instance.app_node2.id
    server_ip   = alicloud_instance.app_node2.private_ip
    port        = 8000
    weight      = 100
  }
}

# HTTP 监听器
resource "alicloud_slb_listener" "app_http" {
  load_balancer_id     = alicloud_slb.zhs_slb.id
  frontend_port        = 80
  backend_port         = 8000
  protocol             = "http"
  bandwidth            = 100
  health_check         = true
  healthy_threshold    = 3
  unhealthy_threshold  = 3
  health_check_timeout = 5
  health_check_uri     = "/healthz"
  health_check_interval = 10
  server_group_id      = alicloud_slb_server_group.app_group.id
}

###############################################################################
# RDS PostgreSQL (备用 - 测试环境用)
###############################################################################

resource "alicloud_db_instance" "zhs_pg" {
  engine               = "PostgreSQL"
  engine_version       = "15.0"
  instance_type        = "pg.n4.large"
  instance_storage     = 100
  instance_charge_type = "Postpaid"
  vswitch_id           = alicloud_vswitch.db_vswitch.id
  security_group_ids   = [alicloud_security_group.app_sg.id]
  db_instance_storage_type = "cloud_essd"

  tags = merge(var.tags, { Component = "rds-pg-test" })
}

# RDS 数据库
resource "alicloud_db_database" "zhs_db" {
  instance_id = alicloud_db_instance.zhs_pg.id
  name        = "zhs"
  description = "ZHS 主数据库"
  character_set = "UTF8"
}

# RDS 账号
resource "alicloud_db_account" "zhs_user" {
  instance_id    = alicloud_db_instance.zhs_pg.id
  account_name   = "zhs"
  account_password = var.db_account_password
  account_type   = "Super"
}

# RDS 授权
resource "alicloud_db_account_privilege" "zhs_priv" {
  instance_id  = alicloud_db_instance.zhs_pg.id
  account_name = alicloud_db_account.zhs_user.account_name
  db_names     = [alicloud_db_database.zhs_db.name]
  privilege    = "ReadWrite"
}

###############################################################################
# Outputs
###############################################################################

output "vpc_id" {
  description = "VPC ID"
  value       = alicloud_vpc.zhs_vpc.id
}

output "app_vswitch_id" {
  value = alicloud_vswitch.app_vswitch.id
}

output "db_vswitch_id" {
  value = alicloud_vswitch.db_vswitch.id
}

output "slb_id" {
  value = alicloud_slb.zhs_slb.id
}

output "slb_dns" {
  description = "SLB 公网 DNS"
  value       = alicloud_slb.zhs_slb.address
}

output "app_eip" {
  value = alicloud_eip.app_eip.ip_address
}

output "patroni_leader_id" {
  value = alicloud_instance.patroni_leader.id
}

output "patroni_leader_private_ip" {
  value = alicloud_instance.patroni_leader.private_ip
}

output "patroni_standby_id" {
  value = alicloud_instance.patroni_standby.id
}

output "patroni_standby_private_ip" {
  value = alicloud_instance.patroni_standby.private_ip
}

output "pgbouncer_id" {
  value = alicloud_instance.pgbouncer.id
}

output "pgbouncer_private_ip" {
  value = alicloud_instance.pgbouncer.private_ip
}

output "app_node1_private_ip" {
  value = alicloud_instance.app_node1.private_ip
}

output "app_node2_private_ip" {
  value = alicloud_instance.app_node2.private_ip
}

output "rds_pg_endpoint" {
  value = alicloud_db_instance.zhs_pg.connection_string
}

output "rds_pg_port" {
  value = alicloud_db_instance.zhs_pg.port
}

output "rto_seconds" {
  description = "故障切换 RTO (Patroni 自动)"
  value       = 15
}

output "rpo_seconds" {
  description = "故障切换 RPO (同步复制)"
  value       = 0
}
