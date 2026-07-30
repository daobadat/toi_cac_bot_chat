/**
 * Module gửi email thông báo
 * Xử lý việc định dạng bảng và gửi email báo cáo khi có sự kiện mới
 */

function sendNewEventsEmail(newRows) {
    if (!newRows || newRows.length === 0) return;

    // Cấu hình email nhận: Mặc định là tài khoản đang chạy script
    var emailConfig = {
        to: Session.getActiveUser().getEmail(),
        subject: "[Calendar Extractor] Có " + newRows.length + " sự kiện mới được đồng bộ hôm nay"
    };

    var timezone = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), timezone, "dd/MM/yyyy HH:mm:ss");
    var summary = buildCalendarSummary(newRows);
    var totalDuration = 0;

    for (var i = 0; i < newRows.length; i++) {
        totalDuration += Number(newRows[i][6]) || 0;
    }

    var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 980px; margin: 0 auto; color: #333; line-height: 1.5;">';
    htmlBody += '<h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; margin-bottom: 16px;">📅 Báo cáo Đồng bộ Calendar (Chi tiết)</h2>';
    htmlBody += '<p>Xin chào,</p>';
    htmlBody += '<p>Hệ thống Calendar Extractor vừa hoàn tất phiên đồng bộ tự động và phát hiện dữ liệu mới từ các lịch đã cấu hình. ';
    htmlBody += 'Bản tin này giúp bạn nắm nhanh số lượng sự kiện mới, phân bổ theo từng lịch, cùng danh sách chi tiết để đối chiếu công việc trong ngày.</p>';
    htmlBody += '<div style="background:#f8f9fa; border:1px solid #e0e0e0; border-radius:6px; padding:12px 14px; margin:10px 0 18px;">';
    htmlBody += '<p style="margin:4px 0;"><b>Thời điểm đồng bộ:</b> ' + now + ' (' + escapeHtml(timezone) + ')</p>';
    htmlBody += '<p style="margin:4px 0;"><b>Tổng sự kiện mới:</b> ' + newRows.length + ' sự kiện</p>';
    htmlBody += '<p style="margin:4px 0;"><b>Tổng thời lượng:</b> ' + totalDuration.toFixed(1) + ' giờ</p>';
    htmlBody += '<p style="margin:4px 0;"><b>Số lịch có phát sinh:</b> ' + summary.totalCalendars + ' lịch</p>';
    htmlBody += '<p style="margin:8px 0 0; font-size:12px; color:#555;">Lưu ý: Thời lượng được tính theo dữ liệu sự kiện hiện có trên Calendar tại thời điểm đồng bộ.</p>';
    htmlBody += '</div>';

    htmlBody += '<p style="margin:0 0 12px;">Phần dưới gồm 2 nhóm thông tin:</p>';
    htmlBody += '<ul style="margin-top:0; margin-bottom:14px;">';
    htmlBody += '<li><b>Thống kê theo lịch:</b> Cho biết lịch nào có nhiều thay đổi nhất.</li>';
    htmlBody += '<li><b>Danh sách sự kiện mới:</b> Gồm thời gian, người tạo, khách mời và mô tả rút gọn để bạn kiểm tra nhanh.</li>';
    htmlBody += '</ul>';

    htmlBody += '<h3 style="color:#555; margin: 0 0 8px;">Thống kê theo lịch</h3>';
    htmlBody += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #ddd; margin-bottom:18px;">';
    htmlBody += '<tr style="background-color: #eef3fd; color: #333;">';
    htmlBody += '<th style="text-align:left;">Tên lịch</th>';
    htmlBody += '<th style="text-align:right; width:140px;">Số sự kiện mới</th>';
    htmlBody += '</tr>';
    for (var calName in summary.byCalendar) {
        htmlBody += '<tr>';
        htmlBody += '<td style="border:1px solid #ddd;">' + escapeHtml(calName) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd; text-align:right;">' + summary.byCalendar[calName] + '</td>';
        htmlBody += '</tr>';
    }
    htmlBody += '</table>';

    htmlBody += '<h3 style="color: #555; margin: 0 0 8px;">Danh sách sự kiện mới</h3>';
    htmlBody += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #ddd;">';
    htmlBody += '<tr style="background-color: #f2f2f2; color: #333;">';
    htmlBody += '<th style="text-align:center; width:50px;">#</th>';
    htmlBody += '<th style="text-align:left; width:16%;">Lịch</th>';
    htmlBody += '<th style="text-align:left; width:22%;">Tên sự kiện</th>';
    htmlBody += '<th style="text-align:left; width:13%;">Bắt đầu</th>';
    htmlBody += '<th style="text-align:left; width:13%;">Kết thúc</th>';
    htmlBody += '<th style="text-align:center; width:8%;">Giờ</th>';
    htmlBody += '<th style="text-align:left; width:10%;">Người tạo</th>';
    htmlBody += '<th style="text-align:left; width:18%;">Khách mời / Mô tả</th>';
    htmlBody += '</tr>';

    for (var j = 0; j < newRows.length; j++) {
        var row = newRows[j];

        // Trích xuất dữ liệu từ các cột tương ứng trong newRows
        // newRows push order: [calendarName, eventId, stt, title, startTimeStr, endTimeStr, duration, creators, guests, description]
        var calName = row[0] || "N/A";
        var title = row[3] || "N/A";
        var start = row[4] || "";
        var end = row[5] || "";
        var duration = Number(row[6]) || 0;
        var creator = row[7] || "";
        var guestsRaw = row[8] || "";
        var description = row[9] || "";

        var guests = truncateText(guestsRaw.toString(), 120).replace(/\n/g, '<br/>');
        var descShort = truncateText(description.toString(), 90);
        var guestAndDesc = '<div><b>Khách mời:</b> ' + (guests || "Không có") + '</div>' +
            '<div style="margin-top:4px;"><b>Mô tả:</b> ' + (descShort ? escapeHtml(descShort) : "Không có") + '</div>';

        htmlBody += '<tr>';
        htmlBody += '<td style="border:1px solid #ddd; text-align:center;">' + (j + 1) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd;">' + escapeHtml(calName) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd; font-weight:bold;">' + escapeHtml(title) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd;">' + escapeHtml(start) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd;">' + escapeHtml(end) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd; text-align:center;">' + duration.toFixed(1) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd;">' + escapeHtml(creator) + '</td>';
        htmlBody += '<td style="border:1px solid #ddd; font-size:12px;">' + guestAndDesc + '</td>';
        htmlBody += '</tr>';
    }

    htmlBody += '</table>';
    htmlBody += '<br/><p><b>Khuyến nghị xử lý:</b></p>';
    htmlBody += '<ol style="margin-top:0;">';
    htmlBody += '<li>Kiểm tra các sự kiện có khách mời quan trọng hoặc mô tả chưa đầy đủ.</li>';
    htmlBody += '<li>Đối chiếu lịch có nhiều phát sinh để cập nhật kế hoạch làm việc.</li>';
    htmlBody += '<li>Mở Google Sheets để xem toàn bộ dữ liệu chi tiết (bao gồm Event ID và các trường đầy đủ).</li>';
    htmlBody += '</ol>';
    htmlBody += '<p>Nếu bạn nhận được email này nhưng không thấy dữ liệu mới như mong đợi, vui lòng kiểm tra lại quyền truy cập Calendar hoặc cấu hình lịch trong script.</p>';
    htmlBody += '<p style="color: #888; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">';
    htmlBody += '<em>Đây là email tự động từ Calendar Extractor Script. Vui lòng không trả lời.</em></p>';
    htmlBody += '</div>';

    try {
        MailApp.sendEmail({
            to: emailConfig.to,
            subject: emailConfig.subject,
            htmlBody: htmlBody
        });
        Logger.log("Đã gửi email thông báo thành công đến: " + emailConfig.to);
    } catch (e) {
        Logger.log("Lỗi khi gửi email: " + e.message);
    }
}

/**
 * Gửi email tóm tắt khi biết số lượng sự kiện mới nhưng không có chi tiết từng dòng.
 * Trường hợp này xảy ra khi hàm sync trả về string thay vì object có newRows.
 */
function sendSyncSummaryEmail(newCount, syncMessage) {
    if (!newCount || newCount <= 0) return;

    var toEmail = Session.getActiveUser().getEmail();
    var subject = "[Calendar Extractor] Có " + newCount + " sự kiện mới được đồng bộ hôm nay";
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">' +
        '<h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;">📅 Báo cáo Đồng bộ Calendar</h2>' +
        '<p>Xin chào,</p>' +
        '<p>Đây là bản tin đồng bộ tự động từ Calendar Extractor. Hệ thống đã ghi nhận các thay đổi mới và cập nhật vào Google Sheets.</p>' +
        '<p><b>Thời điểm đồng bộ:</b> ' + now + '</p>' +
        '<p><b>Kết quả:</b> Có <b>' + newCount + '</b> sự kiện mới được thêm vào dữ liệu.</p>' +
        '<p><b>Thông điệp hệ thống:</b> <code>' + escapeHtml(syncMessage || "") + '</code></p>' +
        '<p>Hiện tại email này là bản tóm tắt, chưa bao gồm từng dòng sự kiện. Vui lòng mở Google Sheets để xem đầy đủ danh sách chi tiết.</p>' +
        '<p>Nếu số lượng sự kiện chưa đúng kỳ vọng, bạn nên kiểm tra lại lịch nguồn và cấu hình đồng bộ để đảm bảo script đang đọc đúng calendar.</p>' +
        '<p style="color: #888; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">' +
        '<em>Đây là email tự động từ Calendar Extractor Script. Vui lòng không trả lời.</em></p>' +
        '</div>';

    try {
        MailApp.sendEmail({
            to: toEmail,
            subject: subject,
            htmlBody: htmlBody
        });
        Logger.log("Đã gửi email tóm tắt đồng bộ đến: " + toEmail);
    } catch (e) {
        Logger.log("Lỗi khi gửi email tóm tắt: " + e.message);
    }
}

function buildCalendarSummary(newRows) {
    var byCalendar = {};
    for (var i = 0; i < newRows.length; i++) {
        var calendarName = newRows[i][0] || "Không xác định";
        byCalendar[calendarName] = (byCalendar[calendarName] || 0) + 1;
    }

    return {
        byCalendar: byCalendar,
        totalCalendars: Object.keys(byCalendar).length
    };
}

function truncateText(value, maxLen) {
    var text = value || "";
    if (text.length <= maxLen) return escapeHtml(text);
    return escapeHtml(text.substring(0, maxLen)) + "...";
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
