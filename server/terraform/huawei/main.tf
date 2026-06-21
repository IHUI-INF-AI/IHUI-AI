###############################################################################
# ZHS 平台 - 华为云 (深圳) 基础设施
#
# 作用: 定义华为云 (主主) 区域的全部基础设施
# 区域: 华南 - 深圳 cn-south-1
# 资源: VPC / ECS (Patroni Standby) / ELB / EIP
#
# RPO/RTO:
#   RPO: 0 (同步复制到 阿里云)
#   RTO: 30s (故障转移 30s)
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = "~> 1.50"
    }
  }
}

provider "huaweicloud" {
  region = var.region
  # access_key / secret_key 通过环境变量 HW_ACCESS_KEY / HW_SECRET_KEY 注入
}

variable "region" {
  description = "华为云区域"
  type        = string
  default     = "cn-south-1"
}

variable "admin_password" {
  description = "ECS 节点管理员密码 (通过 terraform.tfvars 或环境变量 TF_VAR_admin_password 注入)"
  type        = string
  sensitive   = true
}

variable "vpc_cidr" {
  type    = string
  default = "10.1.0.0/16"
}

variable "instance_type" {
  type    = string
  default = "s6.large.4"
}

variable "image_id" {
  type    = string
  default = "Ubuntu 22.04 server 64bit"
}

variable "ssh_key_name" {
  type    = string
  default = "zhs-prod-key"
}

variable "tags" {
  type = map(string)
  default = {
    Project     = "zhs-platform"
    ManagedBy   = "terraform"
    Environment = "production"
    Region      = "huawei-shenzhen"
  }
}

###############################################################################
# VPC + 子网
###############################################################################

resource "huaweicloud_vpc" "zhs_vpc" {
  name = "zhs-vpc-${var.region}"
  cidr = var.vpc_cidr
  tags = var.tags
}

resource "huaweicloud_vpc_subnet" "app_subnet" {
  name       = "zhs-app-subnet"
  cidr       = "10.1.1.0/24"
  gateway_ip = "10.1.1.1"
  vpc_id     = huaweicloud_vpc.zhs_vpc.id
  tags       = var.tags
}

resource "huaweicloud_vpc_subnet" "db_subnet" {
  name       = "zhs-db-subnet"
  cidr       = "10.1.2.0/24"
  gateway_ip = "10.1.2.1"
  vpc_id     = huaweicloud_vpc.zhs_vpc.id
  tags       = var.tags
}

###############################################################################
# 安全组
###############################################################################

resource "huaweicloud_compute_secgroup" "app_sg" {
  name        = "zhs-app-sg"
  description = "ZHS 应用安全组"
}

resource "huaweicloud_compute_secgroup_rule" "allow_ssh" {
  security_group_id = huaweicloud_compute_secgroup.app_sg.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  description       = "SSH"
}

resource "huaweicloud_compute_secgroup_rule" "allow_app" {
  security_group_id = huaweicloud_compute_secgroup.app_sg.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 8000
  port_range_max    = 8000
  remote_ip_prefix  = var.vpc_cidr
  description       = "App HTTP"
}

resource "huaweicloud_compute_secgroup_rule" "allow_pg" {
  security_group_id = huaweicloud_compute_secgroup.app_sg.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 5432
  port_range_max    = 5432
  remote_ip_prefix  = var.vpc_cidr
  description       = "PostgreSQL"
}

resource "huaweicloud_compute_secgroup_rule" "allow_patroni" {
  security_group_id = huaweicloud_compute_secgroup.app_sg.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 8008
  port_range_max    = 8008
  remote_ip_prefix  = var.vpc_cidr
  description       = "Patroni REST"
}

###############################################################################
# ECS 节点
###############################################################################

resource "huaweicloud_compute_instance" "patroni_standby" {
  name              = "zhs-patroni-standby-hw"
  image_id          = var.image_id
  flavor_id         = var.instance_type
  security_groups   = [huaweicloud_compute_secgroup.app_sg.id]
  availability_zone = "cn-south-1a"
  admin_pass        = var.admin_password

  tags = merge(var.tags, { Role = "patroni-standby" })
}

resource "huaweicloud_compute_instance" "pgbouncer_hw" {
  name              = "zhs-pgbouncer-hw"
  image_id          = var.image_id
  flavor_id         = "s6.medium.2"
  security_groups   = [huaweicloud_compute_secgroup.app_sg.id]
  availability_zone = "cn-south-1a"
  admin_pass        = var.admin_password

  tags = merge(var.tags, { Role = "pgbouncer" })
}

resource "huaweicloud_compute_instance" "app_node1" {
  name              = "zhs-app-1-hw"
  image_id          = var.image_id
  flavor_id         = "s6.large.2"
  security_groups   = [huaweicloud_compute_secgroup.app_sg.id]
  availability_zone = "cn-south-1a"
  admin_pass        = var.admin_password

  tags = merge(var.tags, { Role = "app-node" })
}

resource "huaweicloud_compute_instance" "app_node2" {
  name              = "zhs-app-2-hw"
  image_id          = var.image_id
  flavor_id         = "s6.large.2"
  security_groups   = [huaweicloud_compute_secgroup.app_sg.id]
  availability_zone = "cn-south-1a"
  admin_pass        = var.admin_password

  tags = merge(var.tags, { Role = "app-node" })
}

###############################################################################
# EIP
###############################################################################

resource "huaweicloud_eip" "app_eip" {
  publicip {
    type = "5_bgp"
  }

  bandwidth {
    name        = "zhs-app-bw"
    size        = 100
    share_type  = "PER"
    charge_mode = "traffic"
  }

  tags = merge(var.tags, { Component = "eip" })
}

###############################################################################
# ELB
###############################################################################

resource "huaweicloud_elb_loadbalancer" "zhs_elb" {
  name              = "zhs-app-elb"
  cross_vpc_backend = true
  vpc_id            = huaweicloud_vpc.zhs_vpc.id
  bandwidth_charge_mode = "traffic"
  bandwidth_size       = 100
  type                 = "Application"
}

resource "huaweicloud_elb_pool" "app_pool" {
  name        = "zhs-app-pool"
  protocol    = "HTTP"
  lb_method   = "round_robin"
  loadbalancer_id = huaweicloud_elb_loadbalancer.zhs_elb.id
}

resource "huaweicloud_elb_member" "app_member1" {
  pool_id       = huaweicloud_elb_pool.app_pool.id
  address       = huaweicloud_compute_instance.app_node1.access_ip_v4
  protocol_port = 8000
  weight        = 100
}

resource "huaweicloud_elb_member" "app_member2" {
  pool_id       = huaweicloud_elb_pool.app_pool.id
  address       = huaweicloud_compute_instance.app_node2.access_ip_v4
  protocol_port = 8000
  weight        = 100
}

resource "huaweicloud_elb_listener" "app_listener" {
  name             = "zhs-app-listener"
  protocol         = "HTTP"
  protocol_port    = 80
  loadbalancer_id  = huaweicloud_elb_loadbalancer.zhs_elb.id
  default_pool_id  = huaweicloud_elb_pool.app_pool.id
}

###############################################################################
# Outputs
###############################################################################

output "vpc_id" {
  value = huaweicloud_vpc.zhs_vpc.id
}

output "elb_id" {
  value = huaweicloud_elb_loadbalancer.zhs_elb.id
}

output "elb_ip" {
  value = huaweicloud_elb_loadbalancer.zhs_elb.ipv4_address
}

output "patroni_standby_ip" {
  value = huaweicloud_compute_instance.patroni_standby.access_ip_v4
}

output "pgbouncer_ip" {
  value = huaweicloud_compute_instance.pgbouncer_hw.access_ip_v4
}

output "app_node1_ip" {
  value = huaweicloud_compute_instance.app_node1.access_ip_v4
}

output "app_node2_ip" {
  value = huaweicloud_compute_instance.app_node2.access_ip_v4
}

output "rto_seconds" {
  value = 30
}

output "rpo_seconds" {
  value = 0
}
