// Hàm tạo Menu trên thanh công cụ khi mở file
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('📅 Công cụ Lịch')
        .addItem('🔍 Mở giao diện trích xuất', 'showSidebar')
        .addSeparator()
        .addItem(' Đồng bộ sự kiện mới', 'manualSyncToday')
        .addSeparator()
        .addItem('⚙️ Thiết lập trigger tự động', 'setupDailyTrigger')
        .addItem('❌ Xóa trigger tự động', 'removeDailyTrigger')
        .addSeparator()
        .addItem('ℹ️ Hướng dẫn sử dụng', 'showHelp')
        .addToUi();
}

// Hàm mở thanh Sidebar bên phải
function showSidebar() {
    var html = HtmlService.createHtmlOutputFromFile('Sidebar')
        .setTitle('Trích xuất Calendar')
        .setWidth(350);

    SpreadsheetApp.getUi().showSidebar(html);
}

// Hiển thị hướng dẫn sử dụng
function showHelp() {
    var htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
      <h2 style="color: #1a73e8; margin-top: 0;">📅 Hướng dẫn sử dụng Calendar Extractor</h2>
      
      <h3>Các tính năng chính:</h3>
      <ul>
        <li><b>Trích xuất sự kiện:</b> Lấy toàn bộ thông tin chi tiết từ Google Calendar</li>
        <li><b>Chọn lịch:</b> Hỗ trợ cả lịch cá nhân và lịch được chia sẻ</li>
        <li><b>Lọc nâng cao:</b> Lọc theo sự kiện cả ngày hoặc có giờ cụ thể</li>
        <li><b>Thống kê tự động:</b> Tạo báo cáo tổng hợp</li>
      </ul>
      
      <h3>Thông tin trích xuất:</h3>
      <ul>
        <li>Tên sự kiện, thời gian bắt đầu/kết thúc</li>
        <li>Thời lượng, trạng thái cả ngày</li>
        <li>Danh sách khách mời và trạng thái phản hồi</li>
        <li>Địa điểm, mô tả</li>
        <li>Link Google Meet (nếu có)</li>
        <li>Trạng thái lặp lại, màu sự kiện</li>
      </ul>
      
      <h3>Cách sử dụng:</h3>
      <ol>
        <li>Mở menu <b>📅 Công cụ Lịch</b> > <b>Mở giao diện trích xuất</b></li>
        <li>Chọn lịch cần trích xuất</li>
        <li>Chọn khoảng thời gian (hoặc dùng nút chọn nhanh)</li>
        <li>Nhấn <b>Trích xuất ra Sheets</b></li>
      </ol>
      
      <p style="color: #5f6368; font-size: 12px; margin-top: 20px;">
        Version 2.0 | Developed with ❤️
      </p>
    </div>
  `;

    var html = HtmlService.createHtmlOutput(htmlContent)
        .setWidth(550)
        .setHeight(500);

    SpreadsheetApp.getUi().showModalDialog(html, 'Hướng dẫn sử dụng');
}

// ================= SYNC & TRIGGER FUNCTIONS =================

// Đồng bộ thủ công cho ngày hôm nay
function manualSyncToday() {
    var resultObj = syncMultiCalendarToSheet();
    var message = resultObj && resultObj.message ? resultObj.message : String(resultObj);
    SpreadsheetApp.getUi().alert("Kết quả đồng bộ", message, SpreadsheetApp.getUi().ButtonSet.OK);
}

// Kiểm tra và tạo trigger hàng ngày nếu chưa có (dùng chung cho cả thủ công và tự động)
function ensureDailyTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'dailySyncMultiCalendar') {
            Logger.log("Trigger dailySyncMultiCalendar đã tồn tại, bỏ qua tạo mới.");
            return false; // Đã có rồi
        }
    }

    // Chưa có trigger, tạo mới chạy lúc 6:00 sáng mỗi ngày
    ScriptApp.newTrigger('dailySyncMultiCalendar')
        .timeBased()
        .everyDays(1)
        .atHour(6)
        .create();

    Logger.log("Đã tạo trigger dailySyncMultiCalendar chạy mỗi ngày lúc 6:00 sáng.");
    return true; // Mới tạo
}

// Thiết lập trigger chạy hàng ngày (từ menu thủ công)
function setupDailyTrigger() {
    // Xóa triggers cũ trước để đảm bảo không bị trùng
    removeDailyTrigger();

    // Tạo trigger mới chạy mỗi ngày lúc 6:00 sáng
    ScriptApp.newTrigger('dailySyncMultiCalendar')
        .timeBased()
        .everyDays(1)
        .atHour(6)
        .create();

    SpreadsheetApp.getUi().alert(
        "Thiết lập thành công",
        "Đã tạo trigger tự động chạy mỗi ngày lúc 6:00 sáng.\n\nTrigger sẽ tự động quét sự kiện từ 30 ngày trước đến 7 ngày sau và thêm vào sheet.",
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

// Xóa trigger tự động
function removeDailyTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'dailySyncMultiCalendar') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
}

// Hàm được gọi bởi trigger hàng ngày
function dailySyncMultiCalendar() {
    Logger.log("=== Bắt đầu đồng bộ lịch tự động hàng ngày: " + new Date().toISOString() + " ===");

    var resultObj;
    try {
        resultObj = syncMultiCalendarToSheet(null, null, true);
    } catch (e) {
        Logger.log("LỖI nghiêm trọng khi đồng bộ: " + e.message);
        return;
    }

    // syncMultiCalendarToSheet() luôn trả về object { message, count, newRows }
    var message = resultObj.message || "Không có thông tin kết quả.";
    var count = resultObj.count || 0;
    var newRows = Array.isArray(resultObj.newRows) ? resultObj.newRows : [];

    Logger.log("Kết quả đồng bộ: " + message);
    Logger.log("Số sự kiện mới: " + count);

    if (count > 0 && newRows.length > 0) {
        Logger.log("Đang gửi email thông báo chi tiết cho " + count + " sự kiện mới...");
        try {
            sendNewEventsEmail(newRows);
            Logger.log("Đã gửi email thành công.");
        } catch (e) {
            Logger.log("Lỗi gửi email chi tiết: " + e.message);
            // Thử gửi email tóm tắt nếu email chi tiết lỗi
            try {
                sendSyncSummaryEmail(count, message);
                Logger.log("Đã gửi email tóm tắt thay thế.");
            } catch (e2) {
                Logger.log("Lỗi gửi email tóm tắt: " + e2.message);
            }
        }
    } else {
        Logger.log("Không có sự kiện mới, bỏ qua gửi email.");
    }

    Logger.log("=== Hoàn tất đồng bộ lịch tự động hàng ngày ===");
}

// Hàm để setup trigger theo giờ (nếu cần quét thường xuyên hơn)
function setupHourlyTrigger() {
    removeDailyTrigger();

    ScriptApp.newTrigger('dailySyncMultiCalendar')
        .timeBased()
        .everyHours(1)
        .create();

    SpreadsheetApp.getUi().alert(
        "Thiết lập thành công",
        "Đã tạo trigger tự động chạy mỗi giờ.",
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

// Lấy thông tin trigger hiện tại
function getTriggerInfo() {
    var triggers = ScriptApp.getProjectTriggers();
    var info = [];

    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'dailySyncMultiCalendar') {
            info.push({
                type: triggers[i].getTriggerSource().toString(),
                handler: triggers[i].getHandlerFunction()
            });
        }
    }

    return info;
}

