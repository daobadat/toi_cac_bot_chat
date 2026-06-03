/**
 * DailyAudit.js
 * Trigger chạy mỗi sáng, rà soát dữ liệu trên 3 sheet thưởng lễ.
 * Kiểm tra 3 tiêu chí:
 *   1. Ngày vào công ty → Loại hợp đồng có khớp không?
 *   2. Loại hợp đồng → Tiền thưởng có đúng không?
 *   3. Ngày vào công ty có bị trống / bất thường không?
 *
 * Nếu phát hiện sai lệch → Gửi email báo cáo.
 */


// ============================================================
// 1. HÀM CHÍNH — CHẠY BỞI TRIGGER MỖI SÁNG
// ============================================================

function dailyBonusAudit() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cols = BONUS_CONFIG.COLUMNS;
    const sheetNames = [
      BONUS_CONFIG.SHEET_NAME.NEW_YEAR_EVE,
      BONUS_CONFIG.SHEET_NAME.NATIONAL_DAY,
      BONUS_CONFIG.SHEET_NAME.LABOUR_DAY
    ];
  
    const today = new Date();
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  
    let issues = [];       // Danh sách lỗi phát hiện được
    let summaryBySheet = []; // Tóm tắt theo từng sheet
  
    // --- QUÉT TỪNG SHEET ---
    sheetNames.forEach(sheetName => {
      try {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          summaryBySheet.push({ name: sheetName, status: "❌ Không tìm thấy sheet" });
          return;
        }
  
        const lastRow = sheet.getLastRow();
        if (lastRow < 3) {
          summaryBySheet.push({ name: sheetName, status: "⚠️ Sheet trống" });
          return;
        }
  
        const rates = BONUS_CONFIG.BONUS_RATES[sheetName];
        if (!rates) {
          summaryBySheet.push({ name: sheetName, status: "❌ Thiếu cấu hình BONUS_RATES" });
          return;
        }
  
        // Đọc toàn bộ dữ liệu
        const data = sheet.getRange(3, 1, lastRow - 2, cols.ID).getValues();
  
        let sheetIssues = 0;
        let checkedCount = 0;
  
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 3;
          const name = row[cols.NAME - 1];
          const id = row[cols.ID - 1];
          const company = row[cols.COMPANY - 1];
          const currentContract = row[cols.CONTRACT - 1];
          const joinDate = row[cols.JOIN_DATE - 1];
          const currentBonus = row[cols.BONUS - 1];
  
          // Bỏ qua dòng trống
          if (!name || name.toString().trim() === "") continue;
          if (!id || id.toString().trim() === "") continue;
  
          // Bỏ qua chức vụ ngoại lệ (Sếp, Giám đốc... có thể không có ngày vào)
          const skipCodes = BONUS_CONFIG.SKIP_POSITION_CODES || [];
          if (skipCodes.length > 0) {
            const idParts = id.toString().split(".");
            // ID format: COMPANY.DEPT.POSITION.NUM → lấy phần tử thứ 3 (index 2)
            const posCode = idParts.length >= 3 ? idParts[2].toUpperCase() : "";
            if (skipCodes.indexOf(posCode) !== -1) continue;
          }
  
          checkedCount++;
  
          // --- KIỂM TRA 1: Ngày vào công ty bị trống ---
          let parsedDate = joinDate;
          if (joinDate && !(joinDate instanceof Date)) {
            parsedDate = parseVietnameseDate_(joinDate.toString());
          }
  
          if (!parsedDate || !(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
            issues.push({
              sheet: sheetName,
              row: rowNum,
              name: name,
              id: id,
              type: "📅 THIẾU NGÀY",
              detail: `Ngày vào công ty bị trống hoặc sai định dạng: "${joinDate || "(trống)"}"`
            });
            sheetIssues++;
            continue; // Không thể kiểm tra hợp đồng nếu không có ngày
          }
  
          // Giữ nguyên Thực Tập (chỉ quản lý đổi thủ công)
          if (currentContract === "Thực Tập") {
            // Chỉ kiểm tra tiền thưởng
            const expectedBonus = rates["Thực Tập"] || 0;
            if (parseBonusValue_(currentBonus) !== expectedBonus) {
              issues.push({
                sheet: sheetName,
                row: rowNum,
                name: name,
                id: id,
                type: "💰 SAI THƯỞNG",
                detail: `HĐ: "Thực Tập" → Thưởng phải là ${formatVND_(expectedBonus)}, hiện tại: ${formatVND_(parseBonusValue_(currentBonus))}`
              });
              sheetIssues++;
            }
            continue;
          }
  
          // --- KIỂM TRA 2: Loại hợp đồng có khớp với ngày vào ---
          const expectedContract = determineContractType(parsedDate);
          if (currentContract !== expectedContract) {
            issues.push({
              sheet: sheetName,
              row: rowNum,
              name: name,
              id: id,
              type: "📋 SAI HỢP ĐỒNG",
              detail: `Ngày vào: ${formatDate_(parsedDate)} → Phải là "${expectedContract}", hiện tại: "${currentContract || "(trống)"}"`
            });
            sheetIssues++;
          }
  
          // --- KIỂM TRA 3: Tiền thưởng có khớp với hợp đồng ---
          const expectedBonus = rates[expectedContract] || 0;
          const actualBonus = parseBonusValue_(currentBonus);
  
          if (actualBonus !== expectedBonus) {
            issues.push({
              sheet: sheetName,
              row: rowNum,
              name: name,
              id: id,
              type: "💰 SAI THƯỞNG",
              detail: `HĐ: "${expectedContract}" → Thưởng phải là ${formatVND_(expectedBonus)}, hiện tại: ${formatVND_(actualBonus)}`
            });
            sheetIssues++;
          }
        }
  
        summaryBySheet.push({
          name: sheetName,
          status: sheetIssues > 0
            ? `⚠️ ${sheetIssues} lỗi / ${checkedCount} người`
            : `✅ OK (${checkedCount} người)`
        });
  
      } catch (e) {
        summaryBySheet.push({ name: sheetName, status: `❌ Lỗi: ${e.message}` });
      }
    });
  
    // --- GỬI EMAIL NẾU CÓ LỖI ---
    if (issues.length > 0) {
      sendAuditEmail_(todayStr, summaryBySheet, issues, ss.getUrl());
    }
  
    // Log ra console (debug)
    Logger.log(`[DailyAudit] ${todayStr} — ${issues.length} lỗi phát hiện.`);
  }
  
  
  // ============================================================
  // 2. GỬI EMAIL BÁO CÁO
  // ============================================================
  
  function sendAuditEmail_(dateStr, summaryBySheet, issues, spreadsheetUrl) {
    const recipient = Session.getActiveUser().getEmail();
  
    const subject = `⚠️ [Bonus Audit] ${issues.length} lỗi dữ liệu phát hiện — ${dateStr}`;
  
    // --- BUILD HTML EMAIL ---
    let html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">⚠️ Báo Cáo Kiểm Tra Dữ Liệu Thưởng Lễ</h2>
        <p style="color: #555;">🕐 Thời gian: <strong>${dateStr}</strong></p>
        <p style="color: #555;">📊 Tổng lỗi phát hiện: <strong style="color: #d32f2f;">${issues.length}</strong></p>
  
        <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;">
  
        <h3 style="color: #333;">📋 Tổng Quan</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px 12px; border: 1px solid #ddd; text-align: left;">Sheet</th>
            <th style="padding: 8px 12px; border: 1px solid #ddd; text-align: left;">Trạng thái</th>
          </tr>
    `;
  
    summaryBySheet.forEach(s => {
      html += `
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #ddd; font-weight: bold;">${s.name}</td>
          <td style="padding: 8px 12px; border: 1px solid #ddd;">${s.status}</td>
        </tr>
      `;
    });
  
    html += `</table>`;
  
    // --- BẢNG CHI TIẾT CÁC LỖI ---
    html += `
      <h3 style="color: #333;">🔍 Chi Tiết Lỗi</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background: #d32f2f; color: white;">
          <th style="padding: 8px 10px; border: 1px solid #ddd;">Sheet</th>
          <th style="padding: 8px 10px; border: 1px solid #ddd;">Dòng</th>
          <th style="padding: 8px 10px; border: 1px solid #ddd;">Nhân viên</th>
          <th style="padding: 8px 10px; border: 1px solid #ddd;">Loại lỗi</th>
          <th style="padding: 8px 10px; border: 1px solid #ddd;">Chi tiết</th>
        </tr>
    `;
  
    issues.forEach((issue, idx) => {
      const bgColor = idx % 2 === 0 ? "#fff" : "#fafafa";
      html += `
        <tr style="background: ${bgColor};">
          <td style="padding: 6px 10px; border: 1px solid #ddd;">${issue.sheet}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${issue.row}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd;">
            <strong>${issue.name}</strong><br>
            <span style="color: #888; font-size: 12px;">${issue.id}</span>
          </td>
          <td style="padding: 6px 10px; border: 1px solid #ddd;">${issue.type}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd; font-size: 13px;">${issue.detail}</td>
        </tr>
      `;
    });
  
    html += `
      </table>
      <br>
      <p>🔗 <a href="${spreadsheetUrl}" style="color: #1976d2;">Mở file Thưởng Lễ để sửa</a></p>
      <hr style="border: none; border-top: 1px solid #ddd;">
      <p style="color: #999; font-size: 12px;">Email tự động từ hệ thống Bonus Management. Không cần phản hồi.</p>
      </div>
    `;
  
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: html
    });
  
    Logger.log(`[DailyAudit] Đã gửi email tới: ${recipient}`);
  }
  
  
  // ============================================================
  // 3. GIAO DIỆN CÀI ĐẶT TRIGGER (Dialog HTML)
  // ============================================================
  
  /**
   * Mở dialog cài đặt trigger.
   * Gọi từ menu.
   */
  function openTriggerSettings() {
    const html = HtmlService.createHtmlOutputFromFile("TriggerDialog")
      .setWidth(420)
      .setHeight(520)
      .setTitle("Cài đặt Trigger");
    SpreadsheetApp.getUi().showModalDialog(html, "⏰ Cài Đặt Trigger Kiểm Tra");
  }
  
  /**
   * Server-side: Lấy trạng thái trigger hiện tại.
   * Được gọi bởi dialog HTML qua google.script.run.
   */
  function getTriggerStatus() {
    const triggers = ScriptApp.getProjectTriggers();
    let isActive = false;
    let hour = 7;
  
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "dailyBonusAudit") {
        isActive = true;
        // Lấy giờ chạy từ trigger (nếu có)
        try {
          hour = trigger.getTriggerSource() ? 7 : 7; // Mặc định
        } catch (e) { }
      }
    });
  
    // Đọc giờ đã lưu từ PropertiesService (nếu có)
    const savedHour = PropertiesService.getScriptProperties().getProperty("auditHour");
    if (savedHour) hour = parseInt(savedHour, 10);
  
    return {
      isActive: isActive,
      hour: hour,
      email: Session.getActiveUser().getEmail()
    };
  }
  
  /**
   * Server-side: Cài trigger với giờ được chọn từ UI.
   * @param {number} hour - Giờ chạy (5-11)
   */
  function installTriggerWithHour(hour) {
    // Xóa trigger cũ
    removeDailyAuditTrigger_();
  
    // Tạo trigger mới
    ScriptApp.newTrigger("dailyBonusAudit")
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();
  
    // Lưu giờ vào Properties để UI đọc lại
    PropertiesService.getScriptProperties().setProperty("auditHour", hour.toString());
  
    return {
      message: `✅ Đã kích hoạt! Chạy mỗi ngày lúc ${hour}:00 - ${hour + 1}:00`,
      status: getTriggerStatus()
    };
  }
  
  /**
   * Server-side: Gỡ trigger từ UI.
   */
  function removeTriggerFromUI() {
    removeDailyAuditTrigger_();
  
    return {
      message: "⏹️ Đã tắt trigger.",
      status: getTriggerStatus()
    };
  }
  
  /**
   * Server-side: Chạy thử audit từ UI.
   */
  function runAuditFromUI() {
    dailyBonusAudit();
    return "📧 Đã chạy kiểm tra xong! Kiểm tra email nếu có lỗi.";
  }
  
  /**
   * Hàm nội bộ: Xóa tất cả trigger dailyBonusAudit.
   */
  function removeDailyAuditTrigger_() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "dailyBonusAudit") {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  }
  
  // === TƯƠNG THÍCH NGƯỢC: Giữ lại tên hàm cũ để menu/trigger cũ không bị lỗi ===
  function installDailyAuditTrigger() { openTriggerSettings(); }
  function removeDailyAuditTrigger() { removeDailyAuditTrigger_(); }
  
  
  // ============================================================
  // 4. HÀM TIỆN ÍCH NỘI BỘ
  // ============================================================
  
  /**
   * Parse chuỗi ngày dạng "dd/MM/yyyy" sang Date object.
   */
  function parseVietnameseDate_(dateStr) {
    if (!dateStr) return null;
    const str = dateStr.toString().trim();
    const parts = str.split("/");
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS month 0-indexed
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  }
  
  /**
   * Format Date thành chuỗi dd/MM/yyyy.
   */
  function formatDate_(date) {
    if (!date || !(date instanceof Date)) return "(không rõ)";
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
  
  /**
   * Parse giá trị tiền thưởng (có thể là số hoặc chuỗi có dấu chấm phân cách).
   * VD: "700.000" → 700000, 500000 → 500000
   */
  function parseBonusValue_(value) {
    if (typeof value === "number") return value;
    if (!value) return 0;
    // Bỏ dấu chấm phân cách hàng nghìn, bỏ ký tự không phải số
    const cleaned = value.toString().replace(/\./g, "").replace(/[^\d]/g, "");
    return parseInt(cleaned, 10) || 0;
  }
  
  /**
   * Format số tiền theo kiểu Việt Nam (VD: 700.000đ)
   */
  function formatVND_(amount) {
    return amount.toLocaleString("vi-VN") + "đ";
  }
  