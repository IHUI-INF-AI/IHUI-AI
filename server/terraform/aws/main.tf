###############################################################################
# ZHS 平台 - AWS (东京) 基础设施
#
# 作用: 定义 AWS (异地灾备) 区域的全部基础设施
# 区域: 亚太 - 东京 ap-northeast-1
# 资源: VPC / EC2 (Patroni Cascade) / ALB / EIP
#
# RPO/RTO:
#   RPO: < 5s (异步复制)
#   RTO: 1h (异地灾备 - 人工或 ArgoCD 触发)
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.20"
    }
  }
}

provider "aws" {
  region = var.region
  # access_key / secret_key 通过环境变量 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 注入
}

variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.2.0.0/16"
}

variable "instance_type" {
  type    = string
  default = "t3.large"
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
    Region      = "aws-tokyo"
  }
}

###############################################################################
# VPC
###############################################################################

resource "aws_vpc" "zhs_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = "zhs-vpc" })
}

resource "aws_subnet" "app_subnet" {
  vpc_id                  = aws_vpc.zhs_vpc.id
  cidr_block              = "10.2.1.0/24"
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true
  tags                    = merge(var.tags, { Name = "zhs-app-subnet" })
}

resource "aws_subnet" "db_subnet" {
  vpc_id            = aws_vpc.zhs_vpc.id
  cidr_block        = "10.2.2.0/24"
  availability_zone = "${var.region}a"
  tags              = merge(var.tags, { Name = "zhs-db-subnet" })
}

resource "aws_internet_gateway" "zhs_igw" {
  vpc_id = aws_vpc.zhs_vpc.id
  tags   = merge(var.tags, { Name = "zhs-igw" })
}

resource "aws_route_table" "app_rt" {
  vpc_id = aws_vpc.zhs_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.zhs_igw.id
  }

  tags = merge(var.tags, { Name = "zhs-app-rt" })
}

resource "aws_route_table_association" "app_rta" {
  subnet_id      = aws_subnet.app_subnet.id
  route_table_id = aws_route_table.app_rt.id
}

###############################################################################
# Security Group
###############################################################################

resource "aws_security_group" "app_sg" {
  name        = "zhs-app-sg"
  description = "ZHS 应用安全组"
  vpc_id      = aws_vpc.zhs_vpc.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "App HTTP"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "Patroni"
    from_port   = 8008
    to_port     = 8008
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "zhs-app-sg" })
}

###############################################################################
# EC2
###############################################################################

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "patroni_cascade" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.db_subnet.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.ssh_key_name
  availability_zone      = "${var.region}a"

  tags = merge(var.tags, { Name = "zhs-patroni-cascade", Role = "patroni-cascade" })
}

resource "aws_instance" "pgbouncer_aws" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.medium"
  subnet_id              = aws_subnet.app_subnet.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.ssh_key_name
  availability_zone      = "${var.region}a"

  tags = merge(var.tags, { Name = "zhs-pgbouncer-aws", Role = "pgbouncer" })
}

resource "aws_instance" "app_node1" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.large"
  subnet_id              = aws_subnet.app_subnet.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.ssh_key_name
  availability_zone      = "${var.region}a"

  tags = merge(var.tags, { Name = "zhs-app-1-aws", Role = "app-node" })
}

resource "aws_instance" "app_node2" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.large"
  subnet_id              = aws_subnet.app_subnet.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.ssh_key_name
  availability_zone      = "${var.region}a"

  tags = merge(var.tags, { Name = "zhs-app-2-aws", Role = "app-node" })
}

resource "aws_instance" "app_node3" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.large"
  subnet_id              = aws_subnet.app_subnet.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.ssh_key_name
  availability_zone      = "${var.region}a"

  tags = merge(var.tags, { Name = "zhs-app-3-aws", Role = "app-node" })
}

###############################################################################
# ALB
###############################################################################

resource "aws_lb" "zhs_alb" {
  name               = "zhs-app-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.app_sg.id]
  subnets            = [aws_subnet.app_subnet.id]

  tags = merge(var.tags, { Name = "zhs-app-alb" })
}

resource "aws_lb_target_group" "app_tg" {
  name     = "zhs-app-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.zhs_vpc.id

  health_check {
    enabled             = true
    path                = "/healthz"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { Name = "zhs-app-tg" })
}

resource "aws_lb_target_group_attachment" "app1" {
  target_group_id = aws_lb_target_group.app_tg.id
  target_id        = aws_instance.app_node1.id
  port             = 8000
}

resource "aws_lb_target_group_attachment" "app2" {
  target_group_id = aws_lb_target_group.app_tg.id
  target_id        = aws_instance.app_node2.id
  port             = 8000
}

resource "aws_lb_target_group_attachment" "app3" {
  target_group_id = aws_lb_target_group.app_tg.id
  target_id        = aws_instance.app_node3.id
  port             = 8000
}

resource "aws_lb_listener" "app_listener" {
  load_balancer_id = aws_lb.zhs_alb.id
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_id  = aws_lb_target_group.app_tg.id
  }
}

###############################################################################
# Outputs
###############################################################################

output "vpc_id" {
  value = aws_vpc.zhs_vpc.id
}

output "alb_dns" {
  value = aws_lb.zhs_alb.dns_name
}

output "patroni_cascade_ip" {
  value = aws_instance.patroni_cascade.private_ip
}

output "pgbouncer_ip" {
  value = aws_instance.pgbouncer_aws.private_ip
}

output "rto_seconds" {
  value = 3600
}

output "rpo_seconds" {
  value = 5
}
