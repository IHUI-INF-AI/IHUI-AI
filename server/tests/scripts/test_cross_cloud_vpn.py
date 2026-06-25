#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""跨云 VPC 对等互联配置测试

测试覆盖:
  1. 配置文件存在性
  2. 3 云互联拓扑
  3. VPN 资源定义
  4. 路由条目完整性
  5. PSK 安全
  6. RPO 指标
  7. Remote state 配置
  8. Outputs 完整性
  9. 加密参数 (IKEv2 + AES-256-GCM + SHA-256)
"""
import re
import sys
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
TF_FILE = SERVER_DIR / "terraform" / "cross-cloud" / "main.tf"
ALIYUN_TF = SERVER_DIR / "terraform" / "aliyun" / "main.tf"
HUAWEI_TF = SERVER_DIR / "terraform" / "huawei" / "main.tf"
AWS_TF = SERVER_DIR / "terraform" / "aws" / "main.tf"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class TestFileExistence(unittest.TestCase):
    """文件存在性"""

    def test_cross_cloud_tf_exists(self):
        self.assertTrue(TF_FILE.exists(), f"cross-cloud TF 不存在: {TF_FILE}")

    def test_three_cloud_tfs_exist(self):
        for path in [ALIYUN_TF, HUAWEI_TF, AWS_TF]:
            self.assertTrue(path.exists())


class TestTopology(unittest.TestCase):
    """3 云互联拓扑"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(TF_FILE)

    def test_three_clouds(self):
        # 必须定义 3 个云的互联
        self.assertIn("aliyun", self.content.lower())
        self.assertIn("huawei", self.content.lower())
        self.assertIn("aws", self.content.lower())

    def test_three_pairs(self):
        # 3 对互联: 阿里云-华为云, 阿里云-AWS, 华为云-AWS
        for pair in ["zhs_to_huawei", "zhs_to_aliyun", "zhs_aws_to_aliyun", "aws_to_aliyun", "aws_to_huawei", "huawei_to_aliyun"]:
            self.assertIn(pair, self.content, f"缺失对: {pair}")

    def test_aliyun_huawei_subnets(self):
        # 阿里云 10.0.0.0/16 <-> 华为云 10.1.0.0/16
        self.assertIn("10.0.0.0/16", self.content)
        self.assertIn("10.1.0.0/16", self.content)

    def test_aws_subnet(self):
        # AWS 10.2.0.0/16
        self.assertIn("10.2.0.0/16", self.content)


class TestVPNResources(unittest.TestCase):
    """VPN 资源定义"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(TF_FILE)

    def test_aliyun_vpn_gateway(self):
        self.assertIn('resource "alicloud_vpn_gateway"', self.content)

    def test_aliyun_vpn_connection(self):
        self.assertIn('resource "alicloud_vpn_connection"', self.content)

    def test_aliyun_customer_gateway(self):
        self.assertIn('resource "alicloud_vpn_customer_gateway"', self.content)

    def test_huawei_vpn_gateway(self):
        self.assertIn('resource "huaweicloud_vpn_gateway"', self.content)

    def test_huawei_vpn_connection(self):
        self.assertIn('resource "huaweicloud_vpn_connection"', self.content)

    def test_aws_vpn_gateway(self):
        self.assertIn('resource "aws_vpn_gateway"', self.content)

    def test_aws_vpn_connection(self):
        self.assertIn('resource "aws_vpn_connection"', self.content)

    def test_aws_customer_gateway(self):
        self.assertIn('resource "aws_customer_gateway"', self.content)


class TestAWSTransitGateway(unittest.TestCase):
    """AWS Transit Gateway"""

    def test_tgw_resource(self):
        content = read(TF_FILE)
        self.assertIn('resource "aws_ec2_transit_gateway"', content)

    def test_tgw_vpc_attachment(self):
        content = read(TF_FILE)
        self.assertIn('resource "aws_ec2_transit_gateway_vpc_attachment"', content)

    def test_tgw_route_table(self):
        content = read(TF_FILE)
        self.assertIn('resource "aws_ec2_transit_gateway_route_table"', content)

    def test_ecmp_enabled(self):
        # 启用 ECMP 多路径
        content = read(TF_FILE)
        self.assertIn("vpn_ecmp_support", content)
        self.assertIn("enable", content)


class TestRouteEntries(unittest.TestCase):
    """路由条目"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(TF_FILE)

    def test_aliyun_route_to_huawei(self):
        self.assertIn('resource "alicloud_route_entry"', self.content)
        self.assertIn("10.1.0.0/16", self.content)

    def test_aliyun_route_to_aws(self):
        self.assertIn("10.2.0.0/16", self.content)

    def test_huawei_route_to_aliyun(self):
        self.assertIn('resource "huaweicloud_vpc_route"', self.content)
        self.assertIn("10.0.0.0/16", self.content)

    def test_aws_route_to_aliyun(self):
        self.assertIn('resource "aws_route"', self.content)
        self.assertIn("10.0.0.0/16", self.content)

    def test_aws_route_to_huawei(self):
        self.assertIn("10.1.0.0/16", self.content)


class TestEncryptionParameters(unittest.TestCase):
    """加密参数 (IKEv2 + AES-256-GCM + SHA-256)"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(TF_FILE)

    def test_ikev2(self):
        # IKEv2
        self.assertIn("ikev2", self.content.lower())

    def test_aes_256_gcm(self):
        # AES-256-GCM
        self.assertIn("aes-256-gcm", self.content)

    def test_sha256(self):
        # SHA-256
        self.assertIn("sha256", self.content)

    def test_diffie_hellman_group14(self):
        # DH group 14
        self.assertIn("group14", self.content)

    def test_psk_used(self):
        # PSK 共享密钥
        self.assertIn("psk", self.content.lower())


class TestPSKSecurity(unittest.TestCase):
    """PSK 安全"""

    def test_psk_from_env(self):
        content = read(TF_FILE)
        # PSK 必须从环境变量读取
        self.assertIn("VPN_PSK", content)

    def test_no_hardcoded_psk(self):
        content = read(TF_FILE)
        # 不允许明文 PSK
        self.assertNotIn('psk                = "zhs123"', content)
        self.assertNotIn('psk = "sharedsecret"', content)
        self.assertNotIn('pre_shared_key = "zhs123"', content)

    def test_ips_from_env(self):
        # VPN IP 必须从环境变量
        content = read(TF_FILE)
        self.assertIn("ALIYUN_VPN_IP", content)
        self.assertIn("HUAWEI_VPN_IP", content)


class TestRPOMetrics(unittest.TestCase):
    """RPO 指标"""

    def test_aliyun_huawei_rpo_zero(self):
        """阿里云 <-> 华为云: RPO=0 (同步复制)"""
        content = read(TF_FILE)
        # 在 outputs 中
        self.assertIn("RPO=0", content)

    def test_aliyun_aws_rpo_5s(self):
        """阿里云 <-> AWS: RPO<5s"""
        content = read(TF_FILE)
        self.assertIn("RPO<5s", content)


class TestRemoteState(unittest.TestCase):
    """Remote state 配置"""

    def test_aliyun_remote_state(self):
        content = read(TF_FILE)
        self.assertIn("terraform_remote_state", content)
        self.assertIn("aliyun", content)
        self.assertIn("backend = \"oss\"", content)

    def test_huawei_remote_state(self):
        content = read(TF_FILE)
        self.assertIn("huawei", content)

    def test_aws_remote_state(self):
        content = read(TF_FILE)
        self.assertIn("backend = \"s3\"", content)

    def test_state_buckets(self):
        # state 都存到 zhs-tfstate
        content = read(TF_FILE)
        self.assertIn("zhs-tfstate", content)


class TestOutputs(unittest.TestCase):
    """Outputs 完整性"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(TF_FILE)

    def test_vpn_gateway_outputs(self):
        for vid in ["aliyun_vpn_gateway_id", "huawei_vpn_gateway_id", "aws_vpn_gateway_id"]:
            self.assertIn(vid, self.content)

    def test_tgw_output(self):
        self.assertIn("aws_tgw_id", self.content)

    def test_cross_cloud_network_output(self):
        self.assertIn("cross_cloud_network", self.content)
        self.assertIn("aliyun_huawei", self.content)
        self.assertIn("aliyun_aws", self.content)
        self.assertIn("huawei_aws", self.content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = read(TF_FILE)
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        content = read(TF_FILE)
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("TODO", code)
        self.assertNotIn("FIXME", code)


class TestBandwidth(unittest.TestCase):
    """带宽配置"""

    def test_vpn_bandwidth_200m(self):
        # VPN 带宽必须 200M
        content = read(TF_FILE)
        self.assertIn("bandwidth            = 200", content)
        self.assertIn('size        = 200', content)


class TestSubnets(unittest.TestCase):
    """子网路由"""

    def test_local_subnets_aliyun(self):
        content = read(TF_FILE)
        # 阿里云 local_subnet
        self.assertIn('local_subnet        = ["10.0.0.0/16"]', content)

    def test_remote_subnets_aliyun(self):
        content = read(TF_FILE)
        self.assertIn('remote_subnet       = ["10.1.0.0/16"]', content)


class TestPolicyRules(unittest.TestCase):
    """策略规则 (华为云)"""

    def test_policy_rules(self):
        content = read(TF_FILE)
        self.assertIn("policy_rules", content)
        # 至少 2 条: 双向
        rules = re.findall(r'policy_rules \{', content)
        self.assertGreaterEqual(len(rules), 2, f"policy_rules 数: {len(rules)}")


class TestStaticVsBGP(unittest.TestCase):
    """静态 vs BGP 路由"""

    def test_aws_bgp(self):
        # AWS 启用 BGP (静态路由禁用)
        content = read(TF_FILE)
        self.assertIn("static_routes_only", content)
        self.assertIn("false", content)
        # AWS Customer Gateway 必须有 bgp_asn
        self.assertIn("bgp_asn", content)


class TestResourceCount(unittest.TestCase):
    """资源数量"""

    def test_minimum_resources(self):
        content = read(TF_FILE)
        # 必须至少 12 个 resource 块
        resources = re.findall(r'resource\s+"', content)
        self.assertGreaterEqual(len(resources), 12, f"resource 数: {len(resources)}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
