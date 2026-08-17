import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";

export interface RegulationClause {
  id: string;
  instrument: string;
  effective: string;
  text: string;
  sourceUrl?: string;
}

export const OFFICIAL_SOURCES = [
  {
    title: "Bộ Tài chính: Thông tư số 32/2026/TT-BTC",
    url: "https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-tuc-su-kien-8/bo-tai-chinh-ban-hanh-thong-tu-so-322026tt-btc-ve-chinh-sach-thue-doi-voi-tai-san-ma-hoa",
    note: "Thông tư ban hành ngày 27/03/2026; TNCN 0,1% trên giá chuyển nhượng từng lần; hiệu lực từ 27/03/2026.",
  },
  {
    title: "Công báo Chính phủ: Luật Thuế thu nhập cá nhân số 109/2025/QH15",
    url: "https://congbao.chinhphu.vn/van-ban/luat-so-109-2025-qh15-468671/61623.htm",
    note: "Luật Thuế thu nhập cá nhân có hiệu lực từ 01/07/2026.",
  },
  {
    title: "Cổng thông tin Chính phủ: Luật số 64/2025/QH15",
    url: "https://vanban.chinhphu.vn/?classid=1&docid=213327&pageid=27160",
    note: "Nguyên tắc áp dụng hồi tố của văn bản quy phạm pháp luật.",
  },
  {
    title: "Cổng thông tin Chính phủ: Luật Quản lý thuế số 38/2019/QH14",
    url: "https://vanban.chinhphu.vn/?docid=197312&lang=vi&pageid=27160",
    note: "Quy định về khai bổ sung hồ sơ khai thuế.",
  },
  {
    title: "Công báo Chính phủ: Văn bản hợp nhất Bộ luật Hình sự số 11/VBHN-VPQH",
    url: "https://congbao.chinhphu.vn/van-ban/van-ban-hop-nhat-so-11-vbhn-vpqh-44425/55402.htm",
    note: "Bao gồm Điều 200 về tội trốn thuế.",
  },
] as const;

export const LEGAL_NOTICE_ANALYSIS = [
  {
    title: "Kết luận thực hành",
    body: "Không nên “cứ đợi” đối với lệnh bán từ 27/03/2026 chỉ vì nghĩ chưa có hướng dẫn: Thông tư 32 đã có hiệu lực. Nhưng công cụ vẫn chỉ tạo ước tính, không xác nhận nghĩa vụ hoặc cách kê khai cuối cùng cho từng hồ sơ.",
  },
  {
    title: "Mốc pháp lý hiện hành",
    body: "Thông tư 32/2026/TT-BTC được Bộ Tài chính ban hành ngày 27/03/2026: cá nhân chuyển nhượng tài sản mã hóa chịu TNCN 0,1% trên giá chuyển nhượng từng lần. Luật Thuế TNCN số 109/2025/QH15 có hiệu lực từ 01/07/2026.",
  },
  {
    title: "Giao dịch 2019–26/03/2026",
    body: "Không có cơ chế TNCN chuyên biệt, rõ ràng tương đương Thông tư 32 trong các nguồn được rà soát. Không tự dùng mức 0,1% hoặc 10% của công cụ làm căn cứ kê khai giai đoạn này. Lưu CSV, sao kê, lịch sử ví, chứng từ nạp/rút và nguồn tiền; xin ý kiến bằng văn bản của cơ quan thuế hoặc cố vấn thuế có giấy phép trước khi nộp hay điều chỉnh.",
  },
  {
    title: "Không tự giả định hồi tố",
    body: "Quy định thuế mới không tự động áp ngược cho giao dịch cũ. Hồi tố phải có căn cứ được quy định rõ và bị giới hạn theo Luật Ban hành văn bản quy phạm pháp luật. Không thấy căn cứ trong các nguồn liên kết để áp mức Thông tư 32 ngược cho giao dịch trước 27/03/2026.",
  },
  {
    title: "Kê khai sai và rủi ro hình sự",
    body: "Kê khai sai mục hoặc cách phân loại không tự động là tội trốn thuế. Rủi ro hình sự chỉ được xem xét khi hành vi và các điều kiện của Điều 200 Bộ luật Hình sự được thỏa mãn. Luật Quản lý thuế có cơ chế khai bổ sung; nghĩa vụ thuế, tiền chậm nộp hoặc xử phạt (nếu có) phụ thuộc hồ sơ, thời điểm và kết quả xử lý của cơ quan có thẩm quyền.",
  },
  {
    title: "Cách dùng công cụ an toàn",
    body: "File xuất chỉ là hồ sơ giao dịch/dự thảo làm việc. Với lệnh bán từ 27/03/2026, công cụ ước tính 0,1% trên tổng giá trị bán. Với lệnh bán trước ngày đó, công cụ chỉ gắn nhãn “cần xác nhận” và không tự tính thuế. Không nộp file xuất trực tiếp như tờ khai cuối cùng.",
  },
] as const;

export const CLAUSES = {
  rate: {
    id: "Thông tư 32/2026/TT-BTC",
    instrument: "Bộ Tài chính",
    effective: "Từ 27/03/2026",
    text: "Cá nhân chuyển nhượng tài sản mã hóa, không phân biệt cư trú hay không cư trú, chịu thuế thu nhập cá nhân 0,1% trên giá chuyển nhượng từng lần. Phạm vi áp dụng thực tế theo cơ chế thí điểm và nền tảng giao dịch vẫn cần đối chiếu hồ sơ cụ thể.",
    sourceUrl: OFFICIAL_SOURCES[0].url,
  },
  effectiveDate: {
    id: "Thông tư 32/2026/TT-BTC",
    instrument: "Bộ Tài chính",
    effective: "27/03/2026",
    text: "Thông tư có hiệu lực từ ngày 27/03/2026 và áp dụng trong thời gian triển khai thí điểm thị trường tài sản mã hóa hoặc cho đến khi có quy định thay thế.",
    sourceUrl: OFFICIAL_SOURCES[0].url,
  },
  pitLaw: {
    id: "Luật 109/2025/QH15",
    instrument: "Luật Thuế thu nhập cá nhân",
    effective: "Từ 01/07/2026",
    text: "Luật Thuế thu nhập cá nhân 2025 có hiệu lực từ 01/07/2026. Đây là mốc pháp lý sau Thông tư 32, không phải căn cứ tự động áp dụng ngược cho giao dịch cũ.",
    sourceUrl: OFFICIAL_SOURCES[1].url,
  },
  historicUncertainty: {
    id: "Giai đoạn trước 27/03/2026",
    instrument: "Đánh giá tổng hợp — không phải hướng dẫn thuế chính thức",
    effective: "2019–26/03/2026",
    text: "Không có cơ chế TNCN chuyên biệt, rõ ràng cho chuyển nhượng tài sản mã hóa tương đương Thông tư 32. Không tự suy ra mức 0,1% hoặc mức 10% cho giai đoạn này. Cần lưu chứng từ và xin ý kiến bằng văn bản của cơ quan thuế/cố vấn có giấy phép trước khi nộp hay điều chỉnh.",
  },
  retroactivity: {
    id: "Luật 64/2025/QH15",
    instrument: "Luật Ban hành văn bản quy phạm pháp luật",
    effective: "Đang có hiệu lực",
    text: "Không tự giả định quy định thuế mới hồi tố. Hồi tố phải được quy định rõ và bị giới hạn theo luật. Không thấy căn cứ trong các nguồn trên để áp mức Thông tư 32 ngược cho giao dịch trước 27/03/2026.",
    sourceUrl: OFFICIAL_SOURCES[2].url,
  },
  filingRisk: {
    id: "Khuyến nghị xử lý hồ sơ",
    instrument: "Đánh giá tổng hợp — không phải tư vấn pháp lý",
    effective: "Áp dụng theo từng hồ sơ",
    text: "Không nên chờ đối với giao dịch từ 27/03/2026 nếu đã có nghĩa vụ kê khai. Với giao dịch trước ngày này, không dùng file xuất từ công cụ làm tờ khai cuối cùng; xin xác nhận phân loại bằng văn bản trước. Kê khai thiện chí và có thể bổ sung khác với che giấu nhằm trốn thuế, nhưng rủi ro phải do chuyên gia đánh giá theo hồ sơ.",
  },
} as const;

export interface TradeLike {
  side: "BUY" | "SELL";
  date: Date;
  grossValue: number;
}

export interface Classification {
  bucket: "taxable" | "grey-zone" | "buy";
  clause: RegulationClause;
  payment: number;
  reason: string;
}

export function classifyTrade(trade: TradeLike): Classification {
  if (trade.side === "BUY") {
    return {
      bucket: "buy",
      clause: CLAUSES.rate,
      payment: 0,
      reason: "Lệnh mua không được công cụ tính là một lần chuyển nhượng chịu thuế.",
    };
  }

  if (trade.date.getTime() < CIRCULAR_32_EFFECTIVE.getTime()) {
    return {
      bucket: "grey-zone",
      clause: CLAUSES.historicUncertainty,
      payment: 0,
      reason: "Trước 27/03/2026: không tự tính thuế; cần ý kiến bằng văn bản trước khi kê khai/điều chỉnh.",
    };
  }

  return {
    bucket: "taxable",
    clause: CLAUSES.rate,
    payment: roundCents(trade.grossValue * PIT_RATE),
    reason: "Từ 27/03/2026: công cụ ước tính 0,1% giá chuyển nhượng từng lần theo Thông tư 32/2026/TT-BTC.",
  };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
