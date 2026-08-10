// Vietnamese UI strings. Legal tone — matches Bộ Tài chính / Tổng cục Thuế style.
// Centralized so component reads S.foo instead of inline Vietnamese literals.

export const S = {
  // Header
  badge: "VN THUẾ / TÀI SẢN MÃ HÓA",
  title: "Công cụ ước tính thuế tài sản mã hóa",
  subtitle:
    "Thêm dữ liệu xuất CSV từ Remitano và Binance. Ước tính thuế TNCN Việt Nam theo Thông tư số 32/2026/TT-BTC (thuế chuyển nhượng 0,1%) và thuế TNCN chung (thu nhập khác 10%). Dữ liệu chỉ được lưu trữ trong trình duyệt của bạn.",

  // Source panels
  remitanoCsv: "CSV Remitano",
  binanceCsv: "CSV Binance",
  remitanoPlaceholder: "Dán dữ liệu xuất CSV giao dịch Remitano vào đây…",
  binancePlaceholder: "Dán dữ liệu CSV Lịch sử Đơn hàng/Giao dịch/P2P Binance vào đây…",
  empty: "trống",
  lines: "dòng",
  trades: "giao dịch",
  skipped: "bỏ qua",
  upload: "Tải lên",
  sample: "Mẫu",
  clear: "Xóa",
  clearAll: "Xóa tất cả",
  persistedLocally: "đã lưu cục bộ",
  rowsLoaded: "dòng đã tải",
  noData: "Không có dữ liệu",
  noDataPrompt: "Chưa có dữ liệu. Dán CSV hoặc tải mẫu để bắt đầu.",

  // Stats cards
  totalPit: "Tổng thuế TNCN",
  transfer01: "Chuyển nhượng 0,1%",
  otherIncome10: "Thu nhập khác 10%",
  unmatchedSells: "Lệnh bán chưa khớp",
  totalBuyVnd: "Tổng giá trị mua",
  totalSellVnd: "Tổng giá trị bán",
  buyCount: "Lệnh mua",
  sellCount: "Lệnh bán",

  // Tabs
  tabDeclaration: "Tờ khai",
  tabBreakdown: "Chi tiết",

  // Declaration table
  declarationTitle: "Tờ khai thuế TNCN — một dòng mỗi giao dịch, điều khoản khớp, số VND phải nộp",
  complianceTitle: "Bảng tuân thủ — đối chiếu điều khoản từng giao dịch",
  date: "Ngày",
  pair: "Cặp",
  side: "Chiều",
  gross: "Tổng",
  costFifo: "Giá vốn (FIFO)",
  net: "Ròng",
  bucket: "Nhóm",
  clause: "Điều khoản",
  taxOwed: "Thuế phải nộp",
  totalPitToDeclare: "Tổng thuế TNCN phải khai",
  classification: "Phân loại",
  reason: "Lý do",
  payment: "Thanh toán",
  showMore: "Hiển thị thêm",
  moreTrades: "giao dịch",
  collapse: "Thu gọn",

  // Bucket labels
  buy: "Mua",
  sell: "Bán",
  bucketTransfer: "Chuyển nhượng 0,1%",
  bucketOther: "Khác 10%",

  // Disclaimer
  disclaimerTitle: "Chỉ mang tính ước tính — không phải tư vấn thuế",
  disclaimerBody:
    "Tính theo Điều 5 Thông tư số 32/2026/TT-BTC (thuế TNCN 0,1% trên giá chuyển nhượng), quy định tạm thời áp dụng tương tự chứng khoán theo Nghị quyết số 05/2025/NQ-CP. Mức thuế suất này được quy định đối với giao dịch chuyển nhượng thông qua nhà cung cấp dịch vụ tài sản mã hóa được cấp phép tại Việt Nam; Binance có thể chưa đáp ứng điều kiện, do đó nghĩa vụ thuế thực tế có thể khác. Chỉ các lệnh bán có ngày từ 27/03/2026 trở đi mới được tính; các lệnh bán trước thời điểm này nằm trong vùng xám trước giai đoạn thí điểm. Xác nhận với cố vấn thuế Việt Nam trước khi nộp.",

  // Explanation panel
  howComputed: "Cách tính và các điều khoản quy định",
  twoBuckets: "Hai nhóm, hai công thức",
  bucketAssignmentRule:
    "Mỗi lệnh BÁN được xếp vào một nhóm dựa trên ngày giao dịch. Lệnh mua không chịu thuế (giao dịch mua nhập).",
  transferBucketTitle: "Chuyển nhượng 0,1% — lệnh bán từ 27/03/2026",
  transferFormula: "thuế = tổng giá chuyển nhượng × 0,001",
  otherBucketTitle: "Thu nhập khác 10% — lệnh bán trước 27/03/2026",
  otherFormula: "thuế = max(0, tổng − giá vốn FIFO) × 0,1",
  transferBucketNote:
    "Cơ sở = tổng, không phải lợi nhuận. Việc Thông tư số 32 có bao phủ Binance/Remitano (nước ngoài, không cấp phép) hay chưa là chưa rõ ràng — xem lưu ý bên dưới.",
  otherBucketNote:
    "Cơ sở lợi nhuận ròng. Yêu cầu khớp lệnh mua; lệnh bán chưa khớp được tính giá vốn bằng 0 (thừa lợi nhuận).",
  workedExample: "Ví dụ minh họa",
  clauseMapping: "Đối chiếu điều khoản",
  caveatsTitle: "Lưu ý trung thực — đọc trước khi dựa vào bất kỳ con số nào",
  caveatLicensed:
    "Khoảng trống nhà cung cấp được cấp phép. Điều 5 đánh thuế giao dịch chuyển nhượng thông qua nhà cung cấp dịch vụ tài sản mã hóa. Binance và Remitano là nền tảng nước ngoài, không phải nhà cung cấp được cấp phép tại Việt Nam theo cơ chế thí điểm. Việc mức 0,1% có áp dụng hợp pháp đối với giao dịch trên các nền tảng này là chưa rõ ràng. Công cụ vẫn tính mức này vì đây là mức thuế suất duy nhất được lượng hóa trong pháp luật Việt Nam — nhưng con số này có thể không phải là nghĩa vụ pháp lý phải nộp.",
  caveatPrice:
    "Giá chuyển nhượng chưa được định nghĩa. Thông tư số 32 sử dụng thuật ngữ \u201Cgiá chuyển nhượng\u201D mà không định nghĩa. Công cụ hiểu theo nghĩa tổng giá trị đồng định giá (theo tương tự chứng khoán). Cách hiểu theo lợi nhuận ròng sẽ làm thay đổi con số.",
  caveatOtherBase:
    "Cơ sở thu nhập khác chưa rõ ràng. Thuế TNCN chung áp dụng 10% lên \u201Cthu nhập khác\u201D nhưng cơ sở (tổng, ròng hay theo phương pháp khoán) phụ thuộc vào cách cơ quan thuế phân loại hoạt động. Công cụ dùng lợi nhuận ròng FIFO như một cách hiểu trung dung.",
  caveatBizRange:
    "Thu nhập kinh doanh 15-20% là một khoảng. Luật Thuế TNCN 2025 có thể áp dụng biểu thuế lũy tiến từng phần thay vì một dải cố định, tùy thuộc vào tình trạng đăng ký kinh doanh. Công cụ hiển thị dải này như một ước tính làm việc.",
  caveatCost:
    "Giá vốn phụ thuộc vào lịch sử giao dịch đầy đủ của bạn. Nếu CSV thiếu lệnh mua cho một số lệnh bán, công cụ coi các lệnh bán đó có giá vốn bằng 0 — làm phồng lợi nhuận và thuế. Thêm sổ ghi nhận thu nhập đầy đủ (giao dịch ngay, quy đổi, gửi tiền) để đảm bảo chính xác.",
  caveatNoBuyTax:
    "Không đánh thuế phía mua. \u201CChuyển nhượng\u201D được hiểu là việc thanh lý/bán. Lệnh mua là giao dịch mua nhập, không chịu thuế. Cách hiểu này có cơ sở bảo vệ nhưng không được quy định rõ trong Thông tư số 32.",
  caveatNotAdvice:
    "Không phải tư vấn pháp lý. Xác nhận cách phân loại và số liệu cuối cùng với cố vấn thuế có giấy phép Việt Nam trước khi nộp.",
  outOfScopeTitle: "Ngoài phạm vi",
  outOfScope:
    "Chỉ áp dụng thuế TNCN cá nhân. Doanh nghiệp trong nước: thuế TNDN 20% trên lợi nhuận ròng (Điều 4.1). Doanh nghiệp nước ngoài: thuế TNDN 0,1% trên tổng. Không xử lý: chuyển khoản giữa các ví, staking, airdrop, hợp đồng tương lai, hoán đổi tài sản mã hóa — Thông tư số 32 không đề cập đến các hoạt động này.",

  // Business note panel
  bizNoteTitle: "Phân loại thay thế — thu nhập từ kinh doanh",
  bizNoteBody:
    "Nếu hoạt động giao dịch của bạn được phân loại là kinh doanh, các năm có doanh thu trên 500 triệu VND sẽ chịu 15-20% trên lợi nhuận ròng thay vì các nhóm từng giao dịch nêu trên. Tính theo năm, không theo từng giao dịch.",
  bizNoteCsvOnly:
    "Cơ sở giá vốn chỉ dựa trên CSV. Cùng cảnh báo về lệnh bán chưa khớp vẫn áp dụng — bị phồng nếu bạn có lệnh mua ngoài dữ liệu xuất này.",
  estNotFiling:
    "Ước tính, không phải tư vấn kê khai. Phân bổ nhóm: lệnh bán từ sau 27/03/2026 → chuyển nhượng 0,1% (Điều 5 Thông tư số 32, nếu áp dụng được cho nền tảng của bạn); lệnh bán trước ngày có hiệu lực → thu nhập khác 10% (phương án dự phòng theo thuế TNCN chung). Việc áp dụng mức nào phụ thuộc vào phân loại pháp lý của bạn — xác nhận với cố vấn thuế Việt Nam.",

  // Unmatched warning — softened, honest
  unmatchedWarn: (n: number) =>
    `${n} lệnh bán không có lệnh mua khớp trong file CSV này (phần tài sản có nguồn gốc ngoài file — giao dịch spot, convert, gửi tiền từ ví khác). Các lệnh này không được tính vào lợi nhuận ròng và thuế thu nhập khác. Thuế chuyển nhượng 0,1% (nếu áp dụng) vẫn tính trên tổng giá trị giao dịch. Để tính thuế thu nhập khác chính xác, thêm file giao dịch spot/convert/deposit đầy đủ.`,

  // Asset flow table
  assetFlowTitle: "Dòng tiền theo tài sản — tổng mua/bán VND theo từng loại",
  assetFlowNote:
    "Hiển thị tổng giá trị mua và bán theo từng tài sản. Khoảng cách giữa mua và bán cho biết phần tài sản có nguồn gốc ngoài file CSV này.",
  assetCol: "Tài sản",
  boughtCol: "Tổng mua (VND)",
  soldCol: "Tổng bán (VND)",
  gapCol: "Chênh lệch (VND)",
} as const;
