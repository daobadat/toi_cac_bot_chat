/**
 * Trích xuất chi tiết các sự kiện trong một khoảng thời gian
 * @param {string} calendarId - ID của lịch cần trích xuất
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Date} endDate - Ngày kết thúc
 * @param {Object} options - Các tùy chọn lọc (optional)
 */
function extractDetailedEvents(calendarId, startDate, endDate, options) {
    // Lấy lịch theo ID, nếu không có thì dùng lịch mặc định
    var calendar;
    if (calendarId) {
        calendar = CalendarApp.getCalendarById(calendarId);
    }
    if (!calendar) {
        calendar = CalendarApp.getDefaultCalendar();
    }

    var events = calendar.getEvents(startDate, endDate);
    options = options || {};

    var exportData = [];

    // Tạo dòng Header với thông tin cần thiết
    exportData.push([
        "STT",
        "Tên sự kiện",
        "Thời gian bắt đầu",
        "Thời gian kết thúc",
        "Thời lượng (phút)",
        "Người tạo",
        "Khách mời & Trạng thái",
        "Mô tả"
    ]);

    var stt = 0;
    events.forEach(function (event) {
        // Áp dụng bộ lọc nếu có
        if (options.filterAllDay !== undefined) {
            if (options.filterAllDay && !event.isAllDayEvent()) return;
            if (!options.filterAllDay && event.isAllDayEvent()) return;
        }

        stt++;
        var creators = event.getCreators().map(formatCreatorEmail).join(", ");

        // Xử lý thông tin khách mời
        var guests = event.getGuestList(true); // true để bao gồm cả owner
        var guestInfoList = [];

        guests.forEach(function (guest) {
            var guestStatus = guest.getGuestStatus();
            var status = guestStatus ? guestStatus.toString() : "INVITED";
            guestInfoList.push(guest.getEmail() + " (" + translateGuestStatus(status) + ")");
        });
        var guestsString = guestInfoList.join("\n");

        // Tính thời lượng sự kiện
        var duration = calculateDuration(event.getStartTime(), event.getEndTime());

        exportData.push([
            stt,
            event.getTitle() || "(Không có tiêu đề)",
            formatDateTime(event.getStartTime()),
            formatDateTime(event.getEndTime()),
            duration,
            creators,
            guestsString,
            event.getDescription() || ""
        ]);
    });

    return exportData;
}

/**
 * Tính thời lượng sự kiện (phút)
 */
function calculateDuration(startTime, endTime) {
    var diffMs = endTime.getTime() - startTime.getTime();
    var totalMinutes = Math.round(diffMs / 60000);
    return totalMinutes;
}

/**
 * Format email người tạo: bỏ phần @domain.com
 * VD: ntttrang@planadd.com → ntttrang
 */
function formatCreatorEmail(email) {
    if (!email) return "";
    var atIndex = email.indexOf("@");
    return atIndex !== -1 ? email.substring(0, atIndex) : email;
}

/**
 * Format ngày giờ đẹp hơn
 */
function formatDateTime(date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}

/**
 * Dịch trạng thái khách mời sang tiếng Việt
 */
function translateGuestStatus(status) {
    var statusMap = {
        "YES": "Đã xác nhận",
        "NO": "Từ chối",
        "MAYBE": "Có thể",
        "INVITED": "Chờ phản hồi",
        "OWNER": "Người tổ chức"
    };
    return statusMap[status] || status;
}

/**
 * Đếm số sự kiện trong khoảng thời gian (cho chức năng preview)
 */
function countEvents(calendarId, startStr, endStr) {
    var calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    if (!calendar) {
        return 0;
    }

    var startDate = new Date(startStr);
    var endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);

    var events = calendar.getEvents(startDate, endDate);
    return events.length;
}

/**
 * Lấy thống kê nhanh về các sự kiện
 */
function getQuickStats(calendarId, startStr, endStr) {
    var calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
    if (!calendar) {
        return null;
    }

    var startDate = new Date(startStr);
    var endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);

    var events = calendar.getEvents(startDate, endDate);

    var stats = {
        total: events.length,
        allDay: 0,
        recurring: 0,
        withGuests: 0,
        totalDuration: 0
    };

    events.forEach(function (event) {
        if (event.isAllDayEvent()) stats.allDay++;
        if (event.isRecurringEvent()) stats.recurring++;
        if (event.getGuestList().length > 0) stats.withGuests++;

        var duration = (event.getEndTime().getTime() - event.getStartTime().getTime()) / 60000;
        stats.totalDuration += duration;
    });

    return stats;
}

// ================= MULTI-CALENDAR FUNCTIONS =================

/**
 * Trích xuất sự kiện từ nhiều lịch và nhóm theo tên lịch
 * @param {Array} calendarIds - Mảng các ID lịch cần trích xuất
 * @param {Date} startDate - Ngày bắt đầu
 * @param {Date} endDate - Ngày kết thúc
 * @param {Object} options - Các tùy chọn lọc
 * @returns {Object} { data: mảng dữ liệu theo nhóm, calendarMap: mapping id -> name }
 */
function extractMultiCalendarEvents(calendarIds, startDate, endDate, options) {
    options = options || {};
    var result = {
        groupedData: [], // Mảng chứa dữ liệu đã nhóm theo lịch
        calendarMap: {}  // Mapping id -> name
    };

    // Duyệt qua từng lịch
    for (var i = 0; i < calendarIds.length; i++) {
        var calendarId = calendarIds[i];
        var calendar = CalendarApp.getCalendarById(calendarId);

        if (!calendar) continue;

        var calendarName = calendar.getName();
        result.calendarMap[calendarId] = calendarName;

        var events = calendar.getEvents(startDate, endDate);
        var calendarEvents = [];

        events.forEach(function (event) {
            // Áp dụng bộ lọc nếu có
            if (options.filterAllDay !== undefined) {
                if (options.filterAllDay && !event.isAllDayEvent()) return;
                if (!options.filterAllDay && event.isAllDayEvent()) return;
            }

            var creators = event.getCreators().map(formatCreatorEmail).join(", ");

            // Xử lý thông tin khách mời
            var guests = event.getGuestList(true);
            var guestInfoList = [];
            guests.forEach(function (guest) {
                var guestStatus = guest.getGuestStatus();
                var status = guestStatus ? guestStatus.toString() : "INVITED";
                guestInfoList.push(guest.getEmail() + " (" + translateGuestStatus(status) + ")");
            });
            var guestsString = guestInfoList.join("\n");

            var duration = calculateDuration(event.getStartTime(), event.getEndTime());

            calendarEvents.push({
                id: event.getId(),
                title: event.getTitle() || "(Không có tiêu đề)",
                startTime: event.getStartTime(),
                endTime: event.getEndTime(),
                startTimeStr: formatDateTime(event.getStartTime()),
                endTimeStr: formatDateTime(event.getEndTime()),
                duration: duration,
                creators: creators,
                guests: guestsString,
                description: event.getDescription() || "",
                isAllDay: event.isAllDayEvent()
            });
        });

        // Sắp xếp theo thời gian bắt đầu
        calendarEvents.sort(function (a, b) {
            return a.startTime.getTime() - b.startTime.getTime();
        });

        result.groupedData.push({
            calendarId: calendarId,
            calendarName: calendarName,
            events: calendarEvents
        });
    }

    return result;
}

/**
 * Lấy sự kiện theo ngày từ nhiều lịch (dùng cho trigger hàng ngày)
 * @param {Array} calendarIds - Mảng các ID lịch
 * @param {Date} date - Ngày cần lấy sự kiện (mặc định là hôm nay)
 */
function getMultiCalendarEventsForDate(calendarIds, date) {
    date = date || new Date();

    var startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    var endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    return extractMultiCalendarEvents(calendarIds, startDate, endDate, {});
}

/**
 * Đếm tổng số sự kiện từ nhiều lịch
 */
function countMultiCalendarEvents(calendarIds, startStr, endStr) {
    var startDate = new Date(startStr);
    var endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);

    var totalCount = 0;
    var details = [];

    for (var i = 0; i < calendarIds.length; i++) {
        var calendar = CalendarApp.getCalendarById(calendarIds[i]);
        if (!calendar) continue;

        var events = calendar.getEvents(startDate, endDate);
        var count = events.length;
        totalCount += count;
        details.push({
            name: calendar.getName(),
            count: count
        });
    }

    return {
        total: totalCount,
        details: details
    };
}

/**
 * Lấy danh sách event IDs đã lưu trong sheet (để detect sự kiện mới)
 * @param {Sheet} sheet - Sheet cần đọc
 * @param {number} eventIdColumn - Cột chứa Event ID
 */
function getExistingEventIds(sheet, eventIdColumn) {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return {};

    var data = sheet.getRange(2, eventIdColumn, lastRow - 1, 1).getValues();
    var existingIds = {};

    for (var i = 0; i < data.length; i++) {
        if (data[i][0]) {
            existingIds[data[i][0]] = true;
        }
    }

    return existingIds;
}

/**
 * Tìm row cuối cùng của một nhóm lịch trong sheet
 * @param {Sheet} sheet - Sheet cần tìm
 * @param {string} calendarName - Tên lịch cần tìm
 * @param {number} calendarNameColumn - Cột chứa tên lịch
 */
function findCalendarGroupEndRow(sheet, calendarName, calendarNameColumn) {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return -1;

    var data = sheet.getRange(2, calendarNameColumn, lastRow - 1, 1).getValues();
    var lastMatchRow = -1;

    for (var i = 0; i < data.length; i++) {
        if (data[i][0] === calendarName) {
            lastMatchRow = i + 2; // +2 vì bắt đầu từ row 2 và index từ 0
        }
    }

    return lastMatchRow;
}

/**
 * Lấy cấu hình multi-calendar từ Properties
 */
function getMultiCalendarConfig() {
    var props = PropertiesService.getScriptProperties();
    var configStr = props.getProperty('MULTI_CALENDAR_CONFIG');

    if (!configStr) {
        return {
            calendarIds: [],
            sheetName: '',
            enabled: false
        };
    }

    return JSON.parse(configStr);
}

/**
 * Lưu cấu hình multi-calendar vào Properties
 */
function saveMultiCalendarConfig(calendarIds, sheetName) {
    var props = PropertiesService.getScriptProperties();
    var ssId = "";
    try {
        ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch (e) {
        Logger.log("Không thể lấy ID Spreadsheet: " + e.message);
    }

    var config = {
        calendarIds: calendarIds,
        sheetName: sheetName,
        spreadsheetId: ssId,
        enabled: true,
        lastUpdated: new Date().toISOString()
    };

    props.setProperty('MULTI_CALENDAR_CONFIG', JSON.stringify(config));

    // Tự động tạo trigger chạy hàng ngày nếu chưa có
    try {
        ensureDailyTrigger();
    } catch (e) {
        Logger.log("Không thể tự động thiết lập trigger: " + e.message);
    }

    return config;
}