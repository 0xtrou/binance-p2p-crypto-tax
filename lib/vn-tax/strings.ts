export const S = {
  badge: "VN THUẾ / TÀI SẢN MÃ HÓA",
  title: "Công cụ ước tính thuế tài sản mã hóa",
  subtitle:
    "Thêm dữ liệu xuất CSV từ Remitano và Binance. Công cụ chỉ ước tính 0,1% cho lệnh bán từ 27/03/2026; giao dịch trước ngày này được đánh dấu để xin xác nhận, không tự gán thuế. Dữ liệu chỉ lưu trong trình duyệt.",

  remitanoCsv: "CSV Remitano",
  binanceCsv: "CSV Binance",
  remitanoPlaceholder: "Dán dữ liệu xuất CSV giao dịch Remitano vào đây…",
  binancePlaceholder: "Dán dữ liệu CSV Lịch sử Đơn hàng/Giao dịch/P2P Binance vào đây…",
  empty: "trống",
  lines: "dòng",
  trades: "giao dịch",
  skipped: "bỏ qua",
  upload: "Thêm file",
  sample: "Mẫu",
  clear: "Xóa",
  clearAll: "Xóa tất cả",
  persistedLocally: "đã lưu cục bộ",
  rowsLoaded: "dòng đã tải",
  noData: "Không có dữ liệu",
  noDataPrompt: "Chưa có dữ liệu. Dán CSV hoặc tải mẫu để bắt đầu.",

  totalPit: "Tổng thuế ước tính",
  transfer01: "Chuyển nhượng 0,1%",
  historicReview: "Trước 27/03/2026 — cần xác nhận",
  totalBuyVnd: "Tổng giá trị mua",
  totalSellVnd: "Tổng giá trị bán",
  buyCount: "Lệnh mua",
  sellCount: "Lệnh bán",

  tabDeclaration: "Hồ sơ dự thảo",
  tabBreakdown: "Chi tiết",

  declarationTitle: "Hồ sơ dự thảo — từng giao dịch, căn cứ pháp lý, thuế ước tính",
  complianceTitle: "Bảng tuân thủ — đối chiếu điều khoản từng giao dịch",
  date: "Ngày",
  pair: "Cặp",
  side: "Chiều",
  gross: "Tổng",
  bucket: "Nhóm",
  clause: "Điều khoản",
  taxOwed: "Thuế ước tính",
  totalPitToDeclare: "Tổng thuế ước tính từ 27/03/2026",
  classification: "Phân loại",
  showMore: "Hiển thị thêm",
  moreTrades: "giao dịch",
  collapse: "Thu gọn",

  buy: "Mua",
  sell: "Bán",
  bucketTransfer: "Chuyển nhượng 0,1%",
  bucketHistoricReview: "Cần xác nhận",

  disclaimerTitle: "Không tự gán thuế cho giao dịch trước 27/03/2026",
  disclaimerBody:
    "Không có cơ sở trong các nguồn được liệt kê trên site để tự áp mức 0,1% hoặc 10% cho giao dịch từ 2019 đến 26/03/2026. Giữ chứng từ, xin ý kiến bằng văn bản của cơ quan thuế hoặc cố vấn thuế có giấy phép trước khi kê khai/điều chỉnh. Với giao dịch từ 27/03/2026, công cụ chỉ tạo ước tính 0,1%; không thay thế hướng dẫn kê khai chính thức.",

  howComputed: "Cách tính, giới hạn và nguồn",
  twoBuckets: "Hai khoảng thời gian, hai cách xử lý",
  bucketAssignmentRule:
    "Lệnh bán được xếp theo ngày giao dịch. Lệnh mua không được công cụ tính là một lần chuyển nhượng chịu thuế.",
  transferBucketTitle: "Chuyển nhượng 0,1% — lệnh bán từ 27/03/2026",
  transferFormula: "thuế ước tính = giá chuyển nhượng × 0,001",
  historicReviewTitle: "Cần xác nhận — lệnh bán trước 27/03/2026",
  historicReviewFormula: "không tự tính thuế; giữ chứng từ và xin ý kiến bằng văn bản",
  transferBucketNote:
    "Thông tư 32 quy định 0,1% trên giá chuyển nhượng từng lần. Điều kiện áp dụng theo cơ chế thí điểm và nền tảng giao dịch cần đối chiếu hồ sơ thực tế.",
  historicReviewNote:
    "Giai đoạn này chưa có cơ chế TNCN chuyên biệt, rõ ràng tương đương Thông tư 32. File xuất chỉ là hồ sơ giao dịch, không phải tờ khai cuối cùng.",
  workedExample: "Ví dụ minh họa",
  clauseMapping: "Đối chiếu điều khoản và nguồn",
  caveatsTitle: "Lưu ý trước khi dùng số liệu",
  caveatLicensed:
    "Phạm vi áp dụng theo cơ chế thí điểm có thể phụ thuộc vào loại giao dịch, nhà cung cấp dịch vụ và hồ sơ. Xác nhận với cơ quan thuế hoặc cố vấn có giấy phép trước khi nộp.",
  caveatPrice:
    "Giá chuyển nhượng trong dữ liệu CSV có thể không trùng căn cứ tính thuế cuối cùng. Công cụ dùng tổng giá trị giao dịch VND làm ước tính làm việc.",
  caveatCost:
    "CSV là bằng chứng giao dịch, không thay thế sao kê ví, lịch sử nạp/rút, chứng từ thanh toán và hồ sơ nguồn tiền.",
  caveatNoBuyTax:
    "Công cụ không tính thuế cho lệnh mua; đây là quy tắc vận hành của công cụ, không phải kết luận pháp lý cho mọi loại giao dịch.",
  caveatNotAdvice:
    "Nội dung là tổng hợp hỗ trợ bởi ChatGPT từ nguồn chính phủ liên kết dưới đây, không phải tư vấn pháp lý hay văn bản trả lời của cơ quan thuế.",
  outOfScopeTitle: "Ngoài phạm vi",
  outOfScope:
    "Chỉ hỗ trợ hồ sơ giao dịch crypto của cá nhân. Không xác định nghĩa vụ cuối cùng đối với nền tảng, giao dịch ví-to-ví, staking, airdrop, phái sinh, hoán đổi, hoạt động kinh doanh hoặc thuế doanh nghiệp.",
  estNotFiling:
    "Ước tính, không phải tư vấn kê khai. Lệnh bán từ 27/03/2026 được tính 0,1% theo Thông tư 32/2026/TT-BTC, tùy điều kiện áp dụng thực tế. Lệnh bán trước ngày hiệu lực không được tự gán thuế; cần xác nhận bằng văn bản trước khi kê khai hoặc điều chỉnh.",

  assetFlowTitle: "Dòng tiền theo tài sản — tổng mua/bán VND theo từng loại",
  assetFlowNote:
    "Hiển thị tổng giá trị mua và bán theo từng tài sản. Lưu thêm toàn bộ chứng từ ngoài CSV khi cần làm việc với cơ quan thuế hoặc cố vấn.",
  assetCol: "Tài sản",
  boughtCol: "Tổng mua (VND)",
  soldCol: "Tổng bán (VND)",
  gapCol: "Chênh lệch (VND)",
} as const;
