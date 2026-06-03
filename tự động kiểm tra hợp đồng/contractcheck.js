/**
 * ContractCheck.js
 * Kiểm tra & cập nhật loại hợp đồng + tiền thưởng
 * trên 3 sheet: New Year Eve, 2/9, Labour Day.
 *
 * Dùng ngày hôm nay (new Date()) làm mốc tính.
 */

// ============================================================
// 1. XÁC ĐỊNH LOẠI HỢP ĐỒNG
// ============================================================

/**
 * Xác định loại hợp đồng dựa trên ngày vào công ty so với hôm nay.
 * - < 60 ngày  → "Thử Việc"
 * - < 365 ngày → "Chính thức dưới 1 năm"
 * - ≥ 365 ngày → "Chính thức trên 1 năm"
 *
 * @param {Date} joinDate - Ngày vào công ty
 * @returns {string} Loại hợp đồng
 */
function determineContractType(joinDate) {
    const today = new Date();
  
    // Không có ngày vào → mặc định
    if (!joinDate || !(joinDate instanceof Date) || isNaN(joinDate.getTime())) {
      return "Chính thức trên 1 năm";
    }
  
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = (today.getTime() - joinDate.getTime()) / msPerDay;
  
    if (diffDays <= 60) {
      return "Thử Việc";
    }
    if (diffDays <= 365) {
      return "Chính thức dưới 1 năm";
    }
    return "Chính thức trên 1 năm";
  }
  
  
  // ============================================================
  // 2. QUÉT & CẬP NHẬT HỢP ĐỒNG TRÊN 3 SHEET
  // ============================================================
  
  /**
   * Quét toàn bộ nhân viên trên 3 sheet thưởng,
   * so sánh hợp đồng hiện tại với kết quả tính toán,
   * cập nhật nếu khác.
   *
   * @returns {Array} Log kết quả
   */
  function checkAndUpdateContracts() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cols = BONUS_CONFIG.COLUMNS;
    const sheetNames = [
      BONUS_CONFIG.SHEET_NAME.NEW_YEAR_EVE,
      BONUS_CONFIG.SHEET_NAME.NATIONAL_DAY,
      BONUS_CONFIG.SHEET_NAME.LABOUR_DAY
    ];
  
    let logReport = [];
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy");
  
    logReport.push(`📅 Ngày kiểm tra: ${todayStr}`);
    logReport.push("");
  
    sheetNames.forEach(sheetName => {
      try {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          logReport.push(`❌ [${sheetName}]: Không tìm thấy sheet.`);
          return;
        }
  
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) {
          logReport.push(`⚠️ [${sheetName}]: Sheet trống.`);
          return;
        }
  
        // Lấy rates cho sheet này
        const rates = BONUS_CONFIG.BONUS_RATES[sheetName];
        if (!rates) {
          logReport.push(`❌ [${sheetName}]: Không có cấu hình BONUS_RATES.`);
          return;
        }
  
        // Đọc toàn bộ dữ liệu từ dòng 2
        const dataRange = sheet.getRange(3, 1, lastRow - 1, cols.ID);
        const data = dataRange.getValues();
  
        let updatedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;
        let details = [];
  
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 3;
          const name = row[cols.NAME - 1];
          const currentContract = row[cols.CONTRACT - 1];
          const joinDate = row[cols.JOIN_DATE - 1];
  
          // Bỏ qua dòng trống hoặc dòng tổng kết (không có tên hoặc không có ID)
          const id = row[cols.ID - 1];
          if (!name || name.toString().trim() === "") continue;
          if (!id || id.toString().trim() === "") continue;
  
          // Parse joinDate
          let parsedDate = joinDate;
          if (joinDate && !(joinDate instanceof Date)) {
            parsedDate = new Date(joinDate);
          }
  
          // Giữ nguyên Thực Tập (chỉ đổi khi quản lý chủ động thay position)
          if (currentContract === "Thực Tập") {
            unchangedCount++;
            continue;
          }
  
          // Tính hợp đồng mới
          const newContract = determineContractType(parsedDate);
          const newBonus = rates[newContract] || 0;
          const currentBonus = row[cols.BONUS - 1];
  
          // So sánh hợp đồng VÀ tiền thưởng
          const contractChanged = currentContract !== newContract;
          const bonusChanged = currentBonus !== newBonus;
  
          if (contractChanged || bonusChanged) {
            // Cập nhật
            sheet.getRange(rowNum, cols.CONTRACT).setValue(newContract);
            sheet.getRange(rowNum, cols.BONUS).setValue(newBonus);
            updatedCount++;
  
            if (contractChanged) {
              details.push(`  ↗️ ${name}: "${currentContract}" → "${newContract}" (${newBonus.toLocaleString("vi-VN")}đ)`);
            } else {
              details.push(`  💰 ${name}: Sửa thưởng ${currentBonus.toLocaleString("vi-VN")}đ → ${newBonus.toLocaleString("vi-VN")}đ (HĐ: "${newContract}")`);
            }
          } else {
            unchangedCount++;
          }
        }
  
        // Log tổng kết cho sheet
        logReport.push(`✅ [${sheetName}]: Cập nhật ${updatedCount}, Giữ nguyên ${unchangedCount}`);
        if (details.length > 0) {
          logReport.push(...details);
        }
        logReport.push("");
  
      } catch (e) {
        logReport.push(`❌ [${sheetName}]: Lỗi - ${e.message}`);
      }
    });
  
    return logReport;
  }
  
  
  // ============================================================
  // 3. NÚT BẤM — WRAPPER VỚI GIAO DIỆN
  // ============================================================
  
  /**
   * Hàm gọi từ menu. Xác nhận → quét → hiển thị kết quả.
   */
  function runContractCheck() {
    const ui = SpreadsheetApp.getUi();
  
    // Xác nhận
    const confirm = ui.alert(
      "🔄 KIỂM TRA HỢP ĐỒNG",
      "Hệ thống sẽ quét cột Ngày Vào trên 3 sheet thưởng (New Year Eve, 2/9, Labour Day) " +
      "và tự động cập nhật loại hợp đồng + số tiền thưởng theo quy định.\n\n" +
      "Tiếp tục?",
      ui.ButtonSet.YES_NO
    );
  
    if (confirm !== ui.Button.YES) {
      ui.alert("Đã hủy.");
      return;
    }
  
    // Chạy
    SpreadsheetApp.getActiveSpreadsheet().toast("Đang kiểm tra hợp đồng...", "Hệ thống", 30);
    const log = checkAndUpdateContracts();
  
    // Hiển thị kết quả
    ui.alert("KẾT QUẢ KIỂM TRA HỢP ĐỒNG\n\n" + log.join("\n"));
  }
  
  
  