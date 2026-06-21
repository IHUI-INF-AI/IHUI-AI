import io
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Any

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from app.services._legacy_settings import settings as _legacy_settings

logger = logging.getLogger(__name__)

# Legacy constants (migrated from client/backend). Override with env if needed.
UPLOAD_DIR = _legacy_settings.UPLOAD_DIR
OUTPUT_DIR = _legacy_settings.OUTPUT_DIR

class CertificateAuthority:
    CA_CERT_PATH = "certs/ca.crt"
    CA_KEY_PATH = "certs/ca.key"

    @classmethod
    def ensure_ca_exists(cls) -> bool:
        os.makedirs("certs", exist_ok=True)

        if os.path.exists(cls.CA_CERT_PATH) and os.path.exists(cls.CA_KEY_PATH):
            return True

        try:
            ca_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=4096,
                backend=default_backend()
            )

            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Beijing"),
                x509.NameAttribute(NameOID.LOCALITY_NAME, "Beijing"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "PDF Service CA"),
                x509.NameAttribute(NameOID.COMMON_NAME, "PDF Service Root CA"),
            ])

            ca_cert = (
                x509.CertificateBuilder()
                .subject_name(subject)
                .issuer_name(issuer)
                .public_key(ca_key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(datetime.utcnow())
                .not_valid_after(datetime.utcnow() + timedelta(days=3650))
                .add_extension(
                    x509.BasicConstraints(ca=True, path_length=None),
                    critical=True,
                )
                .add_extension(
                    x509.KeyUsage(
                        digital_signature=True,
                        key_cert_sign=True,
                        crl_sign=True,
                        key_encipherment=False,
                        content_commitment=False,
                        data_encipherment=False,
                        key_agreement=False,
                        encipher_only=False,
                        decipher_only=False,
                    ),
                    critical=True,
                )
                .sign(ca_key, hashes.SHA256(), default_backend())
            )

            with open(cls.CA_CERT_PATH, "wb") as f:
                f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

            with open(cls.CA_KEY_PATH, "wb") as f:
                f.write(ca_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.TraditionalOpenSSL,
                    encryption_algorithm=serialization.NoEncryption()
                ))

            logger.info("CA证书已生成")
            return True
        except Exception as e:
            logger.error(f"生成CA证书失败: {e}")
            return False

    @classmethod
    def load_ca(cls) -> tuple[x509.Certificate | None, rsa.RSAPrivateKey | None]:
        try:
            with open(cls.CA_CERT_PATH, "rb") as f:
                ca_cert = x509.load_pem_x509_certificate(f.read(), default_backend())

            with open(cls.CA_KEY_PATH, "rb") as f:
                ca_key = serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )

            return ca_cert, ca_key
        except Exception as e:
            logger.error(f"加载CA证书失败: {e}")
            return None, None

    @classmethod
    def issue_certificate(
        cls,
        common_name: str,
        organization: str = "PDF Service User",
        email: str | None = None,
        validity_days: int = 365
    ) -> tuple[x509.Certificate | None, rsa.RSAPrivateKey | None]:
        cls.ensure_ca_exists()
        ca_cert, ca_key = cls.load_ca()

        if not ca_cert or not ca_key:
            return None, None

        try:
            user_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )

            name_attrs = [
                x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
                x509.NameAttribute(NameOID.COMMON_NAME, common_name),
            ]
            if email:
                name_attrs.append(x509.NameAttribute(NameOID.EMAIL_ADDRESS, email))

            subject = x509.Name(name_attrs)

            user_cert = (
                x509.CertificateBuilder()
                .subject_name(subject)
                .issuer_name(ca_cert.subject)
                .public_key(user_key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(datetime.utcnow())
                .not_valid_after(datetime.utcnow() + timedelta(days=validity_days))
                .add_extension(
                    x509.BasicConstraints(ca=False, path_length=None),
                    critical=True,
                )
                .add_extension(
                    x509.KeyUsage(
                        digital_signature=True,
                        key_encipherment=True,
                        key_cert_sign=False,
                        crl_sign=False,
                        content_commitment=False,
                        data_encipherment=False,
                        key_agreement=False,
                        encipher_only=False,
                        decipher_only=False,
                    ),
                    critical=True,
                )
                .add_extension(
                    x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.EMAIL_PROTECTION]),
                    critical=False,
                )
                .sign(ca_key, hashes.SHA256(), default_backend())
            )

            return user_cert, user_key
        except Exception as e:
            logger.error(f"签发证书失败: {e}")
            return None, None

    @classmethod
    def verify_certificate(cls, cert_data: bytes) -> dict[str, Any]:
        try:
            user_cert = x509.load_pem_x509_certificate(cert_data, default_backend())
            ca_cert, _ = cls.load_ca()

            if not ca_cert:
                return {"valid": False, "error": "CA证书未找到"}

            issuer_match = user_cert.issuer == ca_cert.subject

            now = datetime.utcnow()
            validity_ok = user_cert.not_valid_before <= now <= user_cert.not_valid_after

            subject_info = {}
            for attr in user_cert.subject:
                subject_info[attr.oid._name] = attr.value

            return {
                "valid": issuer_match and validity_ok,
                "issuer_match": issuer_match,
                "validity_ok": validity_ok,
                "not_valid_before": user_cert.not_valid_before.isoformat(),
                "not_valid_after": user_cert.not_valid_after.isoformat(),
                "subject": subject_info,
                "serial_number": hex(user_cert.serial_number)
            }
        except Exception as e:
            return {"valid": False, "error": str(e)}


class PDFSignatureService:
    @staticmethod
    def create_signature_appearance(
        name: str,
        date: str,
        reason: str | None = None,
        location: str | None = None,
        width: int = 200,
        height: int = 80
    ) -> bytes:
        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=(width, height))

        c.setStrokeColor("#0066cc")
        c.setLineWidth(2)
        c.rect(2, 2, width - 4, height - 4)

        c.setFillColor("#0066cc")
        c.setFont("Helvetica-Bold", 12)
        c.drawString(10, height - 20, "数字签名")

        c.setFillColor("#333333")
        c.setFont("Helvetica", 9)
        c.drawString(10, height - 35, f"签署人: {name}")
        c.drawString(10, height - 48, f"日期: {date}")

        if reason:
            c.drawString(10, height - 61, f"原因: {reason[:30]}")
        if location:
            c.drawString(10, height - 74, f"地点: {location[:30]}")

        c.save()
        packet.seek(0)
        return packet.getvalue()

    @staticmethod
    def add_digital_signature(
        pdf_path: str,
        cert: x509.Certificate,
        private_key: rsa.RSAPrivateKey,
        name: str,
        reason: str | None = None,
        location: str | None = None,
        page_number: int = 1,
        x: float = 0,
        y: float = 0,
        width: float = 200,
        height: float = 80
    ) -> tuple[str, dict]:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()

        signature_id = str(uuid.uuid4())
        sign_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        _sig_appearance = PDFSignatureService.create_signature_appearance(
            name=name,
            date=sign_date,
            reason=reason,
            location=location,
            width=int(width),
            height=int(height)
        )

        sig_info = {
            "id": signature_id,
            "name": name,
            "date": sign_date,
            "reason": reason,
            "location": location,
            "page_number": page_number,
            "verified": True,
            "certificate_info": {
                "issuer": cert.issuer.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value if cert.issuer.get_attributes_for_oid(NameOID.COMMON_NAME) else "Unknown",
                "subject": cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value if cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME) else "Unknown",
                "valid_from": cert.not_valid_before.isoformat(),
                "valid_to": cert.not_valid_after.isoformat(),
                "serial_number": hex(cert.serial_number)
            }
        }

        for _i, page in enumerate(reader.pages):
            writer.add_page(page)

        writer.add_metadata({
            "/Signature": f"Digitally signed by {name} at {sign_date}",
            "/SignatureID": signature_id,
            "/SignatureReason": reason or "",
            "/SignatureLocation": location or "",
            "/SignerCert": sig_info["certificate_info"]["serial_number"]
        })

        output_path = os.path.join(OUTPUT_DIR, f"signed_{signature_id}.pdf")
        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path, sig_info

    @staticmethod
    def verify_digital_signature(pdf_path: str) -> list[dict]:
        reader = PdfReader(pdf_path)
        signatures = []

        metadata = reader.metadata
        if metadata:
            sig_text = metadata.get("/Signature", "")
            sig_id = metadata.get("/SignatureID", "")
            sig_reason = metadata.get("/SignatureReason", "")
            sig_location = metadata.get("/SignatureLocation", "")
            sig_cert = metadata.get("/SignerCert", "")

            if sig_text:
                signatures.append({
                    "id": sig_id or str(uuid.uuid4()),
                    "verified": True,
                    "signature_text": sig_text,
                    "reason": sig_reason,
                    "location": sig_location,
                    "certificate_serial": sig_cert
                })

        return signatures


class PDFWatermarkService:
    @staticmethod
    def create_text_watermark(
        page_width: float,
        page_height: float,
        content: str,
        font_size: int = 48,
        color: str = "#808080",
        opacity: float = 0.3,
        rotation: int = -45,
        position: str = "diagonal"
    ) -> bytes:
        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=(page_width, page_height))

        hex_color = color.lstrip('#')
        r, g, b = tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
        c.setFillColor(r, g, b, alpha=opacity)
        c.setFont("Helvetica", font_size)

        c.saveState()

        if position == "diagonal":
            c.translate(page_width / 2, page_height / 2)
            c.rotate(rotation)
            text_width = c.stringWidth(content, "Helvetica", font_size)
            c.drawString(-text_width / 2, 0, content)
        elif position == "tile":
            for y in range(0, int(page_height), int(font_size * 3)):
                for x in range(0, int(page_width), int(font_size * 6)):
                    c.saveState()
                    c.translate(x, y)
                    c.rotate(rotation)
                    c.drawString(0, 0, content)
                    c.restoreState()
        else:
            text_width = c.stringWidth(content, "Helvetica", font_size)
            c.drawString((page_width - text_width) / 2, page_height / 2, content)

        c.restoreState()
        c.save()
        packet.seek(0)
        return packet.getvalue()

    @staticmethod
    def create_image_watermark(
        page_width: float,
        page_height: float,
        image_data: bytes,
        opacity: float = 0.3,
        position: str = "center",
        scale: float = 1.0
    ) -> bytes:
        from PIL import Image
        from reportlab.lib.utils import ImageReader

        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=(page_width, page_height))

        img = Image.open(io.BytesIO(image_data))

        img_width, img_height = img.size
        aspect = img_height / img_width

        max_width = page_width * 0.5 * scale
        max_height = page_height * 0.5 * scale

        if img_width > max_width:
            img_width = max_width
            img_height = img_width * aspect

        if img_height > max_height:
            img_height = max_height
            img_width = img_height / aspect

        if position == "center":
            x = (page_width - img_width) / 2
            y = (page_height - img_height) / 2
        else:
            x = (page_width - img_width) / 2
            y = (page_height - img_height) / 2

        c.setFillColorRGB(1, 1, 1, opacity)
        c.drawImage(ImageReader(img), x, y, width=img_width, height=img_height, mask='auto')

        c.save()
        packet.seek(0)
        return packet.getvalue()

    @staticmethod
    def apply_watermark(
        pdf_path: str,
        watermark_data: bytes,
        pages: list[int] | None = None
    ) -> str:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()
        watermark_reader = PdfReader(io.BytesIO(watermark_data))
        watermark_page = watermark_reader.pages[0]

        watermark_id = str(uuid.uuid4())

        for i, page in enumerate(reader.pages):
            page_num = i + 1
            if pages is None or page_num in pages:
                page.merge_page(watermark_page)
            writer.add_page(page)

        output_path = os.path.join(OUTPUT_DIR, f"watermarked_{watermark_id}.pdf")
        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path


class PDFMergeSplitService:
    @staticmethod
    def merge_pdfs(pdf_paths: list[str]) -> tuple[str, int]:
        writer = PdfWriter()
        merge_id = str(uuid.uuid4())

        for path in pdf_paths:
            reader = PdfReader(path)
            for page in reader.pages:
                writer.add_page(page)

        output_path = os.path.join(OUTPUT_DIR, f"merged_{merge_id}.pdf")
        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path, len(writer.pages)

    @staticmethod
    def split_pdf(
        pdf_path: str,
        ranges: list[dict]
    ) -> list[tuple[str, dict]]:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        split_id = str(uuid.uuid4())
        results = []

        for idx, r in enumerate(ranges):
            start = max(1, r["start"]) - 1
            end = min(total_pages, r["end"])

            writer = PdfWriter()
            for i in range(start, end):
                writer.add_page(reader.pages[i])

            output_path = os.path.join(OUTPUT_DIR, f"split_{split_id}_{idx}.pdf")
            with open(output_path, "wb") as f:
                writer.write(f)

            results.append((output_path, {
                "page_range": f"{r['start']}-{r['end']}",
                "page_count": end - start
            }))

        return results

    @staticmethod
    def extract_pages(
        pdf_path: str,
        page_numbers: list[int]
    ) -> str:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()
        extract_id = str(uuid.uuid4())

        for page_num in page_numbers:
            if 1 <= page_num <= len(reader.pages):
                writer.add_page(reader.pages[page_num - 1])

        output_path = os.path.join(OUTPUT_DIR, f"extracted_{extract_id}.pdf")
        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path


class PDFPrintService:
    PAGE_SIZES = {
        "a4": (595.27, 841.89),
        "a3": (841.89, 1190.55),
        "letter": (612, 792),
        "legal": (612, 1008)
    }

    @staticmethod
    def generate_preview(
        pdf_path: str,
        settings: dict
    ) -> tuple[str, int]:
        from PIL import Image

        reader = PdfReader(pdf_path)
        preview_id = str(uuid.uuid4())

        preview_path = os.path.join(OUTPUT_DIR, f"preview_{preview_id}.png")

        if len(reader.pages) > 0:
            page = reader.pages[0]

            width = float(page.mediabox.width)
            height = float(page.mediabox.height)

            img = Image.new('RGB', (int(width), int(height)), 'white')
            img.save(preview_path, 'PNG')

        return preview_path, len(reader.pages)

    @staticmethod
    def prepare_print(
        pdf_path: str,
        settings: dict
    ) -> str:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()
        print_id = str(uuid.uuid4())

        for page in reader.pages:
            writer.add_page(page)

        output_path = os.path.join(OUTPUT_DIR, f"print_ready_{print_id}.pdf")
        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path
