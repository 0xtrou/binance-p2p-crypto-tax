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
