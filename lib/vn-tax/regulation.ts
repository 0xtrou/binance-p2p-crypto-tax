// Structured citations to the primary legal sources backing each computation
// step. Kept separate from the component so the mapping is auditable and
// unit-testable. Every clause below is quoted or paraphrased from the official
// English translation of Circular 32/2026/TT-BTC read in full (ssc.gov.vn), or
// from Resolution 05/2025/NQ-CP via the government portal.

export interface RegulationClause {
  /** Short handle, e.g. "Art. 5". */
  id: string;
  /** Full instrument reference. */
  instrument: string;
  /** Effective date or period. */
  effective: string;
  /** Verbatim or close paraphrase of the operative text. */
  text: string;
}

export const CLAUSES = {
  rate: {
    id: "Điều 5",
    instrument: "Thông tư số 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27/03/2026, trong thời gian thí điểm",
    text: "Các nhà đầu tư cá nhân (bất kể là cư trú hay không cư trú) chuyển nhượng tài sản mã hóa thông qua nhà cung cấp dịch vụ tài sản mã hóa phải chịu thuế thu nhập cá nhân theo mức thuế suất 0,1% trên giá chuyển nhượng của từng giao dịch.",
  },
  base: {
    id: "Điều 5",
    instrument: "Thông tư số 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27/03/2026",
    text: "Thông tư số 32 áp dụng 0,1% trên \u201Cgiá chuyển nhượng\u201D nhưng KHÔNG định nghĩa thuật ngữ này một cách chính xác. Công cụ hiểu theo nghĩa tổng giá trị đồng định giá nhận được, theo tương tự với thuế chuyển nhượng chứng khoán Việt Nam (0,1% trên tổng giá trị giao dịch). Cách hiểu này có cơ sở bảo vệ nhưng không được quy định rõ trong Thông tư — xác nhận với cố vấn thuế Việt Nam.",
  },
  effectiveDate: {
    id: "Điều 7.1",
    instrument: "Thông tư số 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27/03/2026",
    text: "Thông tư này có hiệu lực từ ngày 27/03/2026 và áp dụng trong thời gian thí điểm theo quy định tại Nghị quyết số 05/2025/NQ-CP, hoặc cho đến khi có chính sách thuế riêng đối với thị trường tài sản mã hóa.",
  },
  vat: {
    id: "Điều 3.1",
    instrument: "Thông tư số 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27/03/2026",
    text: "Việc chuyển nhượng và giao dịch tài sản mã hóa không thuộc đối tượng chịu thuế giá trị gia tăng.",
  },
  pilot: {
    id: "Nghị quyết 05/2025/NQ-CP",
    instrument: "Chính phủ Việt Nam",
    effective: "09/09/2025, thí điểm 5 năm",
    text: "Quy định thí điểm thị trường tài sản mã hóa trong thời hạn năm năm. \u201CChính sách thuế đối với giao dịch tài sản mã hóa tạm thời áp dụng giống như đối với chứng khoán cho đến khi cơ quan chức năng ban hành quy định riêng.\u201D",
  },
  citDomestic: {
    id: "Điều 4.1",
    instrument: "Thông tư số 32/2026/TT-BTC (Bộ Tài chính)",
    effective: "27/03/2026",
    text: "Doanh nghiệp Việt Nam bán tài sản mã hóa phải chịu thuế TNDN 20%. Thu nhập tính thuế = giá bán trừ giá mua và chi phí chuyển nhượng hợp lý. (Không áp dụng ở đây — công cụ này chỉ tính thuế TNCN cá nhân.)",
  },
  notTaxpayer: {
    id: "—",
    instrument: "Trước thí điểm (chưa có luật TNCN riêng về tài sản mã hóa)",
    effective: "Trước 27/03/2026",
    text: "Việt Nam chưa có luật thuế thu nhập cá nhân riêng đối với tài sản mã hóa trước giai đoạn thí điểm. Hướng dẫn chính thức giới hạn ở Công văn số 4536/BTC-TCT (2016) của Bộ Tài chính. Các lệnh bán có ngày trước ngày có hiệu lực của Thông tư không thuộc phạm vi điều chỉnh của Thông tư.",
  },
  notTransfer: {
    id: "—",
    instrument: "Cách hiểu Điều 5",
    effective: "27/03/2026",
    text: "Thuế TNCN 0,1% áp dụng đối với người \u201Cchuyển nhượng tài sản mã hóa\u201D. Lệnh MUA là giao dịch mua nhập, không phải chuyển nhượng — không chịu thuế. (Cách hiểu có cơ sở bảo vệ đối với Thông tư; Thông tư số 32 không liệt kê rõ xử lý phía mua.)",
  },
  bizExemption: {
    id: "Luật Thuế TNCN 2025",
    instrument: "Luật Thuế Thu nhập cá nhân 2025 (hiệu lực 01/07/2026)",
    effective: "01/07/2026",
    text: "Hộ kinh doanh/cá nhân có doanh thu hàng năm từ 500 triệu đồng trở xuống được miễn thuế TNCN (tăng từ ngưỡng 100 triệu trước đây). Áp dụng NẾU hoạt động giao dịch tài sản mã hóa của bạn được phân loại là kinh doanh (thu nhập từ kinh doanh).",
  },
  bizRate: {
    id: "Luật Thuế TNCN 2025",
    instrument: "Luật Thuế Thu nhập cá nhân 2025 (hiệu lực 01/07/2026)",
    effective: "01/07/2026",
    text: "Trên doanh thu 500 triệu đồng/năm, thu nhập từ kinh doanh chịu thuế trên lợi nhuận ròng. Mức thuế suất chính xác chưa được xác định: PwC dẫn 15-20%, nhưng Luật Thuế TNCN 2025 cũng áp dụng biểu thuế lũy tiến từng phần 5 bậc (5/10/20/30/35%) có thể áp dụng đối với hộ kinh doanh đã đăng ký. Công cụ hiển thị dải 15-20% như một ước tính làm việc — mức thuế thực tế phụ thuộc vào tình trạng đăng ký và các nghị định hướng dẫn. Xác nhận với cố vấn thuế Việt Nam.",
  },
  bizCharacterization: {
    id: "—",
    instrument: "Tương tác chưa được giải quyết",
    effective: "Tính đến năm 2026",
    text: "Việc giao dịch tài sản mã hóa toàn thời gian (nguồn thu nhập duy nhất) CHỈ chịu mức thuế chuyển nhượng chốt 0,1% hay CŨNG chịu thêm thuế TNCN thu nhập kinh doanh 15-20% trên doanh thu trên 500 triệu là điều Thông tư số 32 KHÔNG đề cập. Mức 0,1% là \u201Cchốt\u201D đối với chứng khoán; trường hợp tài sản mã hóa là sinh kế chưa được kiểm chứng. Tham khảo cố vấn thuế Việt Nam.",
  },
  otherIncome: {
    id: "Luật Thuế TNCN (thu nhập khác)",
    instrument: "Luật Thuế Thu nhập cá nhân — Thu nhập khác",
    effective: "Khung pháp lý TNCN chung",
    text: "Thu nhập không được phân loại cụ thể thuộc \u201Cthu nhập khác\u201D với mức 10%. Cơ sở thường là thu nhập tính thuế (doanh thu trừ chi phí được khấu trừ), nhưng đối với thu nhập không thường xuyên, Tổng cục Thuế thường áp dụng 10% trên tổng hoặc theo phương pháp khoán. Công cụ áp dụng 10% trên lợi nhuận ròng FIFO như một cách hiểu trung dung có cơ sở bảo vệ; cơ sở thực tế có thể khác. Phương án dự phòng cho các giao dịch rút tiền mặt tài sản mã hóa mà Thông tư số 32 không bao phủ (Binance, nền tảng nước ngoài, trước giai đoạn thí điểm). Không áp dụng mức miễn trừ 500 triệu.",
  },
} as const;

/** Classification bucket for a trade. */
export type Bucket = "taxable" | "grey-zone" | "buy" | "skipped";

export interface Classification {
  bucket: Bucket;
  /** Clause justifying the classification. */
  clause: RegulationClause;
  /** Tax owed on this trade, in the quote currency. 0 for non-taxable. */
  payment: number;
  /** One-line reason (shown in the table). */
  reason: string;
}

/** One step in the worked computation, tied to the clause(s) that justify it. */
export interface ExplanationStep {
  /** What this step does, in plain language. */
  label: string;
  /** The formula or rule applied, e.g. "taxable × 0.001". */
  rule: string;
  /** Clause(s) backing this step. */
  clauses: RegulationClause[];
}

import { CIRCULAR_32_EFFECTIVE, PIT_RATE } from "./constants";
import type { ParsedTrade } from "./schema";

/**
 * Classify one trade into its compliance bucket and compute the tax owed.
 * Mirrors the logic in computeTax.ts but exposes the clause + reason per row
 * so the compliance table can show the legal basis for each entry.
 */
export function classifyTrade(
  trade: Pick<ParsedTrade, "date" | "side" | "grossValue">,
): Classification {
  // Buys are acquisitions, not transfers — not taxed.
  if (trade.side === "BUY") {
    return {
      bucket: "buy",
      clause: CLAUSES.notTransfer,
      payment: 0,
      reason: "Buy — acquisition, not a transfer",
    };
  }

  // Pre-effective-date sells fall outside the Circular.
  if (trade.date.getTime() < CIRCULAR_32_EFFECTIVE.getTime()) {
    return {
      bucket: "grey-zone",
      clause: CLAUSES.notTaxpayer,
      payment: 0,
      reason: `Pre 27 Mar 2026 — outside Circular 32 scope`,
    };
  }

  // Taxable: 0.1% of gross transfer price.
  return {
    bucket: "taxable",
    clause: CLAUSES.rate,
    payment: roundCents(trade.grossValue * PIT_RATE),
    reason: `0.1% × gross transfer price`,
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
