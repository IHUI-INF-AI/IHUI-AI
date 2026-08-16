/**
 * CertificateSvg — 结业证书 React 组件（P1-3 MVP）
 * 内联渲染 SVG，props 程序化签发，替代占位。颜色：金 #C9A961 / 深蓝 #1E3A5F / 米白 #FAF8F3。
 */
export interface CertificateSvgProps {
  studentName: string
  courseName: string
  durationHours: number
  issuedAt: string
  certificateNo: string
}

export function CertificateSvg({
  studentName,
  courseName,
  durationHours,
  issuedAt,
  certificateNo,
}: CertificateSvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 600"
      width="100%"
      role="img"
      aria-label={`结业证书 ${studentName} ${courseName}`}
    >
      <rect width="800" height="600" fill="#FAF8F3" />
      <rect x="20" y="20" width="760" height="560" fill="none" stroke="#C9A961" strokeWidth="3" />
      <rect x="35" y="35" width="730" height="530" fill="none" stroke="#C9A961" strokeWidth="1" />
      <path d="M 35 80 L 35 35 L 80 35" fill="none" stroke="#C9A961" strokeWidth="2" />
      <path d="M 720 35 L 765 35 L 765 80" fill="none" stroke="#C9A961" strokeWidth="2" />
      <path d="M 35 520 L 35 565 L 80 565" fill="none" stroke="#C9A961" strokeWidth="2" />
      <path d="M 720 565 L 765 565 L 765 520" fill="none" stroke="#C9A961" strokeWidth="2" />

      <text
        x="400"
        y="110"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="42"
        fontWeight="bold"
        fill="#1E3A5F"
      >
        结业证书
      </text>
      <text
        x="400"
        y="140"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="14"
        fill="#C9A961"
        letterSpacing="4"
      >
        CERTIFICATE OF COMPLETION
      </text>
      <line x1="320" y1="155" x2="480" y2="155" stroke="#C9A961" strokeWidth="1" />
      <circle cx="400" cy="155" r="3" fill="#C9A961" />

      <text x="400" y="220" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#1E3A5F">
        兹证明
      </text>
      <text
        x="400"
        y="260"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="32"
        fontWeight="bold"
        fill="#1E3A5F"
      >
        {studentName}
      </text>
      <line x1="280" y1="275" x2="520" y2="275" stroke="#C9A961" strokeWidth="1" />

      <text x="400" y="310" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#1E3A5F">
        已圆满完成
      </text>
      <text
        x="400"
        y="345"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="24"
        fontWeight="bold"
        fill="#1E3A5F"
      >
        {courseName}
      </text>
      <text x="400" y="385" textAnchor="middle" fontFamily="serif" fontSize="16" fill="#1E3A5F">
        课时数：{durationHours} 学时
      </text>
      <text x="400" y="420" textAnchor="middle" fontFamily="serif" fontSize="14" fill="#1E3A5F">
        颁发日期：{issuedAt}
      </text>
      <text
        x="400"
        y="445"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="12"
        fill="#1E3A5F"
        letterSpacing="2"
      >
        证书编号：{certificateNo}
      </text>

      <text x="220" y="510" textAnchor="middle" fontFamily="serif" fontSize="16" fill="#1E3A5F">
        智汇 AI 教育学院
      </text>
      <line x1="160" y1="520" x2="280" y2="520" stroke="#1E3A5F" strokeWidth="1" />
      <text x="220" y="540" textAnchor="middle" fontFamily="serif" fontSize="11" fill="#1E3A5F">
        颁发机构
      </text>

      <circle cx="580" cy="510" r="45" fill="none" stroke="#C8102E" strokeWidth="3" />
      <circle cx="580" cy="510" r="38" fill="none" stroke="#C8102E" strokeWidth="1" />
      <text
        x="580"
        y="505"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="11"
        fontWeight="bold"
        fill="#C8102E"
      >
        智汇 AI
      </text>
      <text
        x="580"
        y="520"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="11"
        fontWeight="bold"
        fill="#C8102E"
      >
        教育学院
      </text>
      <text x="580" y="535" textAnchor="middle" fontFamily="serif" fontSize="8" fill="#C8102E">
        CERTIFIED
      </text>
    </svg>
  )
}
