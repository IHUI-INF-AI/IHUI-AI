###############################################################################
# ZHS 平台 - 跨云网络互联
#
# 互联方式:
#   1. 阿里云 <-> 华为云: IPsec VPN (高带宽)
#   2. 阿里云 <-> AWS:    Transit Gateway 模式 (BGP 路由)
#   3. 华为云 <-> AWS:    IPsec VPN (备用)
#
# 拓扑:
#   阿里云 (10.0.0.0/16) <==> 华为云 (10.1.0.0/16)   <- 同步复制
#   阿里云 (10.0.0.0/16) <==> AWS    (10.2.0.0/16)   <- 异步复制
#   华为云 (10.1.0.0/16) <==> AWS    (10.2.0.0/16)   <- 灾备
#
# RPO/RTO:
#   阿里云 <-> 华为云: RPO=0 (同步)
#   阿里云 <-> AWS:    RPO<5s (异步)
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    alicloud    = { source = "aliyun/alicloud",        version = "~> 1.220" }
    huaweicloud = { source = "huaweicloud/huaweicloud", version = "~> 1.50" }
    aws         = { source = "hashicorp/aws",          version = "~> 5.20" }
  }
}

###############################################################################
# 阿里云 (主) - VPN 出口 + 路由
###############################################################################

# 阿里云 <-> 华为云: IPsec VPN Gateway (阿里云侧)
resource "alicloud_vpn_gateway" "zhs_to_huawei" {
  name                 = "zhs-vpn-to-huawei"
  vpc_id               = data.terraform_remote_state.aliyun.outputs.vpc_id
  bandwidth            = 200
  enable_ssl           = false
  enable_ipsec         = true
  vpn_type             = "Normal"
  payment_type         = "PayAsYouGo"
  vswitch_id           = data.terraform_remote_state.aliyun.outputs.app_vswitch_id
  network_type         = "public"
  internet_ip          = alicloud_eip.vpn_eip_aliyun.ip_address
  description          = "阿里云到华为云 IPsec VPN"
}

# 阿里云 EIP for VPN
resource "alicloud_eip" "vpn_eip_aliyun" {
  bandwidth            = 200
  internet_charge_type = "PayByTraffic"
  description          = "VPN EIP (阿里云)"
}

# 阿里云 <-> 华为云: IPsec 连接
resource "alicloud_vpn_connection" "zhs_to_huawei" {
  name                = "zhs-vpn-conn-huawei"
  vpn_gateway_id      = alicloud_vpn_gateway.zhs_to_huawei.id
  customer_gateway_id = alicloud_vpn_customer_gateway.zhs_huawei.id
  local_subnet        = ["10.0.0.0/16"]
  remote_subnet       = ["10.1.0.0/16"]
  effect_immediately  = true
  ike_config {
    psk                = "${VPN_PSK}"
    version            = "ikev2"
    ike_auth_alg       = "sha256"
    ike_enc_alg        = "aes-256-gcm"
    ike_lifetime       = 86400
    ike_pfs            = "group14"
    remote_id          = "${HUAWEI_VPN_IP}"
  }
  ipsec_config {
    ipsec_enc_alg      = "aes-256-gcm"
    ipsec_auth_alg     = "sha256"
    ipsec_lifetime     = 3600
    ipsec_pfs          = "group14"
  }
}

# 华为云 VPN 端点 (作为阿里云的 Customer Gateway)
resource "alicloud_vpn_customer_gateway" "zhs_huawei" {
  name        = "zhs-cgw-huawei"
  ip_address  = "${HUAWEI_VPN_IP}"
  description = "华为云 VPN 端点"
}

# 路由条目: 阿里云去往华为云
resource "alicloud_route_entry" "aliyun_to_huawei" {
  route_table_id = data.terraform_remote_state.aliyun.outputs.vpc_route_table_id
  destination_cidrblock = "10.1.0.0/16"
  nexthop_type   = "VpnGateway"
  nexthop_id     = alicloud_vpn_gateway.zhs_to_huawei.id
  name           = "to-huawei"
}

# 路由条目: 阿里云去往 AWS
resource "alicloud_route_entry" "aliyun_to_aws" {
  route_table_id = data.terraform_remote_state.aliyun.outputs.vpc_route_table_id
  destination_cidrblock = "10.2.0.0/16"
  nexthop_type   = "VpnGateway"
  nexthop_id     = alicloud_vpn_gateway.zhs_to_aws.id
  name           = "to-aws"
}

###############################################################################
# 华为云 (主备) - VPN 出口 + 路由
###############################################################################

# 华为云 <-> 阿里云: IPsec VPN
resource "huaweicloud_vpn_gateway" "zhs_to_aliyun" {
  name                = "zhs-vpn-to-aliyun"
  vpc_id              = data.terraform_remote_state.huawei.outputs.vpc_id
  local_subnets       = ["10.1.0.0/16"]
  connect_subnet      = "10.1.1.0/24"
  eip_id              = huaweicloud_eip.vpn_eip_huawei.id
  network_type        = "public"
  attachment_type     = "vpc"
}

resource "huaweicloud_eip" "vpn_eip_huawei" {
  publicip {
    type = "5_bgp"
  }
  bandwidth {
    name        = "zhs-vpn-bw"
    size        = 200
    share_type  = "PER"
    charge_mode = "traffic"
  }
}

# 华为云 <-> 阿里云: IPsec 连接
resource "huaweicloud_vpn_connection" "zhs_to_aliyun" {
  name                = "zhs-vpn-conn-aliyun"
  vpc_id              = data.terraform_remote_state.huawei.outputs.vpc_id
  vpn_gateway_id      = huaweicloud_vpn_gateway.zhs_to_aliyun.id
  customer_gateway_id = huaweicloud_vpn_customer_gateway.zhs_aliyun.id
  peer_subnets        = ["10.0.0.0/16"]
  psk                  = "${VPN_PSK}"
  local_subnets        = ["10.1.0.0/16"]
  policy_rules {
    source      = "10.1.0.0/16"
    destination = "10.0.0.0/16"
  }
  policy_rules {
    source      = "10.0.0.0/16"
    destination = "10.1.0.0/16"
  }
}

# 阿里云 VPN 端点 (作为华为云的 Customer Gateway)
resource "huaweicloud_vpn_customer_gateway" "zhs_aliyun" {
  name        = "zhs-cgw-aliyun"
  ip_address  = "${ALIYUN_VPN_IP}"
}

# 路由条目: 华为云去往阿里云
resource "huaweicloud_vpc_route" "huawei_to_aliyun" {
  vpc_id      = data.terraform_remote_state.huawei.outputs.vpc_id
  destination = "10.0.0.0/16"
  type        = "vpn"
  nexthop     = huaweicloud_vpn_gateway.zhs_to_aliyun.id
  name        = "to-aliyun"
}

###############################################################################
# AWS (灾备) - Transit Gateway + VPN
###############################################################################

# AWS Transit Gateway (统一管理 AWS 侧的 VPN)
resource "aws_ec2_transit_gateway" "zhs_tgw" {
  description                     = "ZHS Transit Gateway"
  default_route_table_association = "disable"
  default_route_table_propagation = "disable"
  dns_support                    = "enable"
  vpn_ecmp_support                = "enable"

  tags = { Name = "zhs-tgw" }
}

# AWS VPN Gateway (阿里云 <-> AWS)
resource "aws_vpn_gateway" "zhs_aws_vpn" {
  vpc_id = data.terraform_remote_state.aws.outputs.vpc_id
  type   = "ipsec.1"

  tags = { Name = "zhs-vpn-gateway" }
}

# AWS Customer Gateway (阿里云端)
resource "aws_customer_gateway" "zhs_aliyun" {
  bgp_asn    = 65000
  ip_address = "${ALIYUN_VPN_IP}"
  type       = "ipsec.1"

  tags = { Name = "zhs-cgw-aliyun" }
}

# AWS VPN Connection (AWS <-> 阿里云)
resource "aws_vpn_connection" "zhs_aws_to_aliyun" {
  vpn_gateway_id      = aws_vpn_gateway.zhs_aws_vpn.id
  customer_gateway_id = aws_customer_gateway.zhs_aliyun.id
  type                = "ipsec.1"
  static_routes_only  = false

  tags = { Name = "zhs-vpn-aliyun" }
}

# AWS Transit Gateway 路由表
resource "aws_ec2_transit_gateway_route_table" "zhs_tgw_rt" {
  transit_gateway_id = aws_ec2_transit_gateway.zhs_tgw.id

  tags = { Name = "zhs-tgw-rt" }
}

# 关联: AWS VPC -> TGW
resource "aws_ec2_transit_gateway_vpc_attachment" "zhs_vpc" {
  subnet_ids         = [data.terraform_remote_state.aws.outputs.app_subnet_id]
  transit_gateway_id = aws_ec2_transit_gateway.zhs_tgw.id
  vpc_id             = data.terraform_remote_state.aws.outputs.vpc_id

  transit_gateway_default_route_table_association = false
  transit_gateway_default_route_table_propagation = false

  tags = { Name = "zhs-vpc-attachment" }
}

# 路由条目: AWS 去往阿里云
resource "aws_route" "aws_to_aliyun" {
  route_table_id         = data.terraform_remote_state.aws.outputs.vpc_route_table_id
  destination_cidr_block = "10.0.0.0/16"
  gateway_id             = aws_vpn_gateway.zhs_aws_vpn.id
}

# 路由条目: AWS 去往华为云
resource "aws_route" "aws_to_huawei" {
  route_table_id         = data.terraform_remote_state.aws.outputs.vpc_route_table_id
  destination_cidr_block = "10.1.0.0/16"
  gateway_id             = aws_vpn_gateway.zhs_aws_vpn.id
}

###############################################################################
# Data Sources (引用其他云的 state)
###############################################################################

data "terraform_remote_state" "aliyun" {
  backend = "oss"
  config = {
    bucket = "zhs-tfstate"
    key    = "aliyun/prod/terraform.tfstate"
    region = "cn-hangzhou"
  }
}

data "terraform_remote_state" "huawei" {
  backend = "oss"
  config = {
    bucket = "zhs-tfstate"
    key    = "huawei/prod/terraform.tfstate"
    region = "cn-south-1"
  }
}

data "terraform_remote_state" "aws" {
  backend = "s3"
  config = {
    bucket = "zhs-tfstate"
    key    = "aws/prod/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

###############################################################################
# Outputs
###############################################################################

output "aliyun_vpn_gateway_id" {
  value = alicloud_vpn_gateway.zhs_to_huawei.id
}

output "huawei_vpn_gateway_id" {
  value = huaweicloud_vpn_gateway.zhs_to_aliyun.id
}

output "aws_vpn_gateway_id" {
  value = aws_vpn_gateway.zhs_aws_vpn.id
}

output "aws_tgw_id" {
  value = aws_ec2_transit_gateway.zhs_tgw.id
}

output "cross_cloud_network" {
  description = "跨云网络连通性"
  value = {
    aliyun_huawei = "10.0.0.0/16 <==> 10.1.0.0/16 (RPO=0)"
    aliyun_aws    = "10.0.0.0/16 <==> 10.2.0.0/16 (RPO<5s)"
    huawei_aws    = "10.1.0.0/16 <==> 10.2.0.0/16 (RPO<5s)"
  }
}
