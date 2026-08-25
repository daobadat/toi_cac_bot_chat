/**
 * Web App endpoint nhận dữ liệu counter máy in từ Local Agent (chạy trong LAN)
 * và ghi vào Google Sheet "Theo dõi máy in".
 *
 * Deploy: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone with the link (bảo mật bằng SECRET_TOKEN bên dưới)
 */

const SHEET_ID = '1VW3pew5yR3T-anFuRZwSEyqZlacKyrAzy6yRnq4ldHM'; // 226. Quản lý văn phòng phẩm
const SHEET_NAME = 'Data';
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('PRINTER_AGENT_TOKEN');

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // tránh race condition khi agent gọi trùng lịch

    const payload = JSON.parse(e.postData.contents);

    // --- Xác thực token, tránh endpoint bị lạm dụng ---
    if (!SECRET_TOKEN || payload.token !== SECRET_TOKEN) {
      return jsonResponse_({ success: false, error: 'Unauthorized' }, 401);
    }

    // --- Validate schema tối thiểu ---
    const required = [
      'copierFullColor', 'copierBW', 'copierSingleColor', 'copierTwoColor',
      'printerFullColor', 'printerBW', 'printerSingleColor', 'printerTwoColor'
    ];
    for (const key of required) {
      if (typeof payload[key] !== 'number' || payload[key] < 0) {
        return jsonResponse_({ success: false, error: `Invalid or missing field: ${key}` }, 400);
      }
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Nếu sheet chưa có tiêu đề cột (trống hoàn toàn), tự động thêm dòng tiêu đề
    const headers = [
      'Thời gian',
      'Copier - Black & White (Total)',
      'Printer - Black & White (Total)',
      'Copier - Full Color (Total)',
      'Copier - Single Color (Total)',
      'Copier - Two-color (Total)',
      'Printer - Full Color (Total)',
      'Printer - Single Color (Total)',
      'Printer - Two-color (Total)',
      'Toner - Black (%)',
      'Toner - Cyan (%)',
      'Toner - Magenta (%)',
      'Toner - Yellow (%)'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    const now = new Date();
    const row = [
      now,
      payload.copierBW,
      payload.printerBW,
      payload.copierFullColor,
      payload.copierSingleColor,
      payload.copierTwoColor,
      payload.printerFullColor,
      payload.printerSingleColor,
      payload.printerTwoColor,
      payload.tonerBlack !== undefined ? payload.tonerBlack : 0,
      payload.tonerCyan !== undefined ? payload.tonerCyan : 0,
      payload.tonerMagenta !== undefined ? payload.tonerMagenta : 0,
      payload.tonerYellow !== undefined ? payload.tonerYellow : 0
    ];

    // Chèn dòng mới phía TRÊN Dòng 2 (insertRowBefore(2)) để thừa kế định dạng từ dòng dữ liệu 2 cũ,
    // THAY VÌ thừa kế định dạng in đậm/màu nền từ dòng tiêu đề 1 (insertRowAfter(1))
    if (sheet.getLastRow() >= 2) {
      sheet.insertRowBefore(2);
    } else {
      sheet.insertRowAfter(1);
    }

    const newRange = sheet.getRange(2, 1, 1, row.length);
    newRange.setValues([row]);

    // Nếu đã có dữ liệu ở Dòng 3, copy 100% định dạng từ Dòng 3 (dòng chuẩn nền trắng chữ thường) sang Dòng 2
    if (sheet.getLastRow() >= 3) {
      sheet.getRange(3, 1, 1, sheet.getMaxColumns()).copyTo(sheet.getRange(2, 1, 1, sheet.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }

    // Ép cứng định dạng: chữ thường, nền trắng tinh, căn lề trái, format ngày giờ
    const fullRow2 = sheet.getRange(2, 1, 1, sheet.getMaxColumns());
    fullRow2.setFontWeight('normal');
    fullRow2.setBackground('#ffffff');
    newRange.setHorizontalAlignment('left');
    sheet.getRange(2, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

    // Ép Google Sheets giải phóng lock & ghi nhận ngay lập tức để người dùng mở sheet không bị treo
    SpreadsheetApp.flush();

    Logger.log(`Ghi counter máy in thành công lúc ${now.toISOString()}`);

    return jsonResponse_({ success: true, timestamp: now.toISOString() }, 200);

  } catch (err) {
    Logger.log(`Lỗi ghi counter máy in: ${err.message}\n${err.stack}`);
    return jsonResponse_({ success: false, error: err.message }, 500);
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse_(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  // Lưu ý: Apps Script Web App không hỗ trợ set HTTP status code tùy ý,
  // client (local agent) cần dựa vào field `success` trong body để xử lý logic.
}

/**
 * Chạy 1 lần thủ công để set token bí mật, KHÔNG hardcode token trong code.
 */
function setupSecretToken() {
  const token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('PRINTER_AGENT_TOKEN', token);
  Logger.log(`Token đã tạo (lưu vào local agent .env): ${token}`);
}