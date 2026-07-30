// Tên sheet cố định để lưu tất cả dữ liệu lịch
var CALENDAR_DATA_SHEET_NAME = "CalendarData";

/**
 * Lấy hoặc tạo sheet cố định "CalendarData"
 * Nếu sheet chưa tồn tại sẽ tạo mới và ghi header
 * @returns {Sheet} sheet đã sẵn sàng để ghi dữ liệu
 */
function getOrCreateCalendarDataSheet(spreadsheetId) {
    var ss;
    if (spreadsheetId) {
        try {
            ss = SpreadsheetApp.openById(spreadsheetId);
        } catch (e) {
            Logger.log("Không thể mở Spreadsheet bằng ID: " + e.message);
        }
    }
    if (!ss) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) {
        throw new Error("Không thể truy cập Spreadsheet. Vui lòng mở sheet và chạy trích xuất thủ công lại để cập nhật cấu hình.");
    }

    var sheet = ss.getSheetByName(CALENDAR_DATA_SHEET_NAME);

    if (!sheet) {
        // Tạo sheet mới nếu chưa tồn tại
        sheet = ss.insertSheet(CALENDAR_DATA_SHEET_NAME);

        // Ghi header
        var headers = [
            "Tên lịch",
            "Event ID",
            "STT",
            "Tên sự kiện",
            "Thời gian bắt đầu",
            "Thời gian kết thúc",
            "Thời lượng (giờ)",
            "Người tạo",
            "Khách mời & Trạng thái",
            "Mô tả"
        ];

        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange
            .setFontWeight("bold")
            .setBackground("#1a73e8")
            .setFontColor("white")
            .setHorizontalAlignment("center")
            .setWrap(true);

        sheet.setFrozenRows(1);
        sheet.setColumnWidth(1, 150);  // Tên lịch
        sheet.setColumnWidth(2, 100);  // Event ID
        sheet.setColumnWidth(9, 250);  // Khách mời
        sheet.setColumnWidth(10, 300); // Mô tả
        sheet.hideColumns(2);          // Ẩn cột Event ID
    }

    return sheet;
}

/**
 * Tìm dòng cuối cùng có dữ liệu thật trong sheet
 * (bỏ qua các dòng chỉ có formatting mà không có nội dung)
 * @param {Sheet} sheet - Sheet cần kiểm tra
 * @returns {number} Số dòng cuối cùng có dữ liệu thật
 */
function getLastDataRow(sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return 1; // Chỉ có header hoặc trống

    // Đọc cột 1 (Tên lịch) từ dòng 2 đến dòng cuối
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    // Tìm từ dưới lên dòng cuối cùng có dữ liệu
    for (var i = data.length - 1; i >= 0; i--) {
        if (data[i][0] && data[i][0].toString().trim() !== "") {
            return i + 2; // +2 vì data bắt đầu từ row 2 và index từ 0
        }
    }

    return 1; // Không có dữ liệu, chỉ có header
}

/**
 * Xóa các hàng trống nằm giữa dữ liệu và cuối sheet
 * @param {Sheet} sheet - Sheet cần dọn dẹp
 */
function cleanupBlankRows(sheet) {
    var lastDataRow = getLastDataRow(sheet);
    var lastSheetRow = sheet.getLastRow();

    // Nếu có hàng trống phía dưới dữ liệu thật, xóa chúng
    if (lastSheetRow > lastDataRow) {
        var rowsToDelete = lastSheetRow - lastDataRow;
        sheet.deleteRows(lastDataRow + 1, rowsToDelete);
        Logger.log("Đã xóa " + rowsToDelete + " hàng trống phía dưới dữ liệu.");
    }
}

/**
 * Nhận lệnh từ Sidebar, gọi CalendarService và append vào sheet cố định
 * @param {string} calendarId - ID của lịch được chọn
 * @param {string} startStr - Ngày bắt đầu (format: yyyy-mm-dd)
 * @param {string} endStr - Ngày kết thúc (format: yyyy-mm-dd)
 * @param {Object} options - Các tùy chọn bổ sung (optional)
 */
function processCalendarToSheet(calendarId, startStr, endStr, options) {
    var startDate = new Date(startStr);
    var endDate = new Date(endStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return "Ngày không hợp lệ. Vui lòng chọn lại.";
    }

    if (startDate > endDate) {
        return "Ngày bắt đầu phải trước ngày kết thúc.";
    }

    endDate.setHours(23, 59, 59, 999);

    return processMultiCalendarToSheet([calendarId], startStr, endStr, options);
}

/**
 * Định dạng sheet Calendar cho đẹp
 */
function formatCalendarSheet(sheet, data) {
    var numRows = data.length;
    var numCols = data[0].length;

    var headerRange = sheet.getRange(1, 1, 1, numCols);
    headerRange
        .setFontWeight("bold")
        .setBackground("#1a73e8")
        .setFontColor("white")
        .setHorizontalAlignment("center")
        .setWrap(true);

    if (numRows > 1) {
        var dataRange = sheet.getRange(2, 1, numRows - 1, numCols);
        dataRange.setVerticalAlignment("top");

        for (var i = 2; i <= numRows; i++) {
            var rowRange = sheet.getRange(i, 1, 1, numCols);
            if (i % 2 === 0) {
                rowRange.setBackground("#f8f9fa");
            }
        }

        // Ép luôn hiển thị ".0" nếu là số chẵn
        if (numCols >= 7) {
            sheet.getRange(2, 7, numRows - 1, 1).setNumberFormat("0.0#").setHorizontalAlignment("center");
        }
    }

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, numCols);

    if (numCols >= 8) {
        sheet.setColumnWidth(7, 250);
        sheet.setColumnWidth(8, 300);
    }

    sheet.getRange(1, 1, numRows, numCols).setBorder(true, true, true, true, true, true);

    if (numRows > 1) {
        sheet.getRange(1, 1, numRows, numCols).createFilter();
    }
}

/**
 * Chuyển đổi phút sang số thập phân của giờ (vd: 90 phút -> 1.5)
 */
function formatDuration(minutes) {
    if (!minutes || isNaN(minutes)) return 0;
    return minutes / 60;
}

/**
 * Tạo bảng thống kê tổng hợp (Dành cho 1 lịch)
 */
function createSummary(sheet, data) {
    var startRow = data.length + 3;
    var numEvents = data.length - 1;

    var totalDuration = 0;

    for (var i = 1; i < data.length; i++) {
        totalDuration += data[i][6] || 0;
    }

    var avgDuration = numEvents > 0 ? (totalDuration / numEvents) : 0;

    sheet.getRange(startRow, 1).setValue("📊 THỐNG KÊ TỔNG HỢP").setFontWeight("bold").setFontSize(12);
    sheet.getRange(startRow, 1, 1, 4).merge().setBackground("#e8f0fe");

    var summaryData = [
        ["Tổng số sự kiện:", numEvents],
        ["Tổng thời lượng (giờ):", totalDuration],
        ["Thời lượng trung bình:", avgDuration]
    ];

    sheet.getRange(startRow + 1, 1, summaryData.length, 2).setValues(summaryData);
    sheet.getRange(startRow + 1, 1, summaryData.length, 1).setFontWeight("bold");

    // Ép luôn hiển thị ".0" cho bảng tổng
    sheet.getRange(startRow + 2, 2, 2, 1).setNumberFormat("0.0#").setHorizontalAlignment("left");
}

function exportSelectedColumns(calendarId, startStr, endStr, selectedColumns) {
    var startDate = new Date(startStr);
    var endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);

    var fullData = extractDetailedEvents(calendarId, startDate, endDate);

    if (fullData.length <= 1) {
        return "Không tìm thấy sự kiện nào.";
    }

    var filteredData = fullData.map(function (row) {
        return selectedColumns.map(function (colIndex) {
            return row[colIndex];
        });
    });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "Export_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    var sheet = ss.insertSheet(sheetName);

    sheet.getRange(1, 1, filteredData.length, filteredData[0].length).setValues(filteredData);
    formatCalendarSheet(sheet, filteredData);

    return "Đã xuất thành công!";
}

// ================= MULTI-CALENDAR SHEET FUNCTIONS =================

function processMultiCalendarToSheet(calendarIds, startStr, endStr, options) {
    if (!calendarIds || calendarIds.length === 0) {
        return "Vui lòng chọn ít nhất một lịch.";
    }

    var startDate = new Date(startStr);
    var endDate = new Date(endStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return "Ngày không hợp lệ. Vui lòng chọn lại.";
    }

    if (startDate > endDate) {
        return "Ngày bắt đầu phải trước ngày kết thúc.";
    }

    endDate.setHours(23, 59, 59, 999);

    // Lưu cấu hình NGAY sau khi xác nhận danh sách lịch hợp lệ,
    // để trigger hàng ngày luôn dùng đúng danh sách lịch người dùng đã chọn
    // (kể cả khi không có sự kiện nào trong khoảng thời gian này)
    saveMultiCalendarConfig(calendarIds, CALENDAR_DATA_SHEET_NAME);

    var sheet = getOrCreateCalendarDataSheet();
    var existingIds = getExistingEventIds(sheet, 2);
    var result = extractMultiCalendarEvents(calendarIds, startDate, endDate, options || {});
    var newRows = [];

    result.groupedData.forEach(function (group) {
        var stt = 0;
        group.events.forEach(function (event) {
            stt++;
            if (!existingIds[event.id]) {
                newRows.push([
                    group.calendarName,
                    event.id,
                    stt,
                    event.title,
                    event.startTimeStr,
                    event.endTimeStr,
                    formatDuration(event.duration),
                    event.creators,
                    event.guests,
                    event.description
                ]);
                existingIds[event.id] = true;
            }
        });
    });

    if (newRows.length === 0) {
        var totalFromCalendars = 0;
        result.groupedData.forEach(function (g) { totalFromCalendars += g.events.length; });
        if (totalFromCalendars === 0) {
            return "Không tìm thấy sự kiện nào trong khoảng thời gian này.";
        }
        return "Tất cả " + totalFromCalendars + " sự kiện đã tồn tại trong sheet '" + CALENDAR_DATA_SHEET_NAME + "', không có gì mới để thêm.";
    }

    // Xóa hàng trống trước khi ghi để tránh khoảng trắng
    cleanupBlankRows(sheet);
    var lastRow = getLastDataRow(sheet);
    sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);

    applyRowFormattingForNewRows(sheet, lastRow + 1, newRows.length, result.groupedData);
    refreshSheetFilter(sheet);

    return "Đã thêm " + newRows.length + " sự kiện mới vào sheet '" + CALENDAR_DATA_SHEET_NAME + "'!";
}

function applyRowFormattingForNewRows(sheet, startRow, rowCount, groupedData) {
    var groupColors = [
        "#e8f5e9", "#e3f2fd", "#fff3e0", "#f3e5f5",
        "#fce4ec", "#e0f7fa", "#fffde7", "#efebe9"
    ];

    var numCols = 10;

    var lastSheetRow = sheet.getLastRow();
    var calendarOrder = [];
    if (lastSheetRow > 1) {
        var colData = sheet.getRange(2, 1, lastSheetRow - 1, 1).getValues();
        for (var i = 0; i < colData.length; i++) {
            if (colData[i][0] && calendarOrder.indexOf(colData[i][0]) === -1) {
                calendarOrder.push(colData[i][0]);
            }
        }
    }

    if (startRow <= lastSheetRow) {
        var newRowsData = sheet.getRange(startRow, 1, rowCount, 1).getValues();
        for (var r = 0; r < rowCount; r++) {
            var calName = newRowsData[r][0];
            var colorIndex = calendarOrder.indexOf(calName);
            if (colorIndex === -1) colorIndex = 0;
            var color = groupColors[colorIndex % groupColors.length];
            sheet.getRange(startRow + r, 1, 1, numCols).setBackground(color);
        }

        // Ép luôn hiển thị ".0"
        var durationRange = sheet.getRange(startRow, 7, rowCount, 1);
        durationRange.setNumberFormat("0.0#");
        durationRange.setHorizontalAlignment("center");
    }

    sheet.getRange(startRow, 1, rowCount, numCols).setVerticalAlignment("top");
    sheet.getRange(startRow, 1, rowCount, numCols).setBorder(true, true, true, true, true, true);
}

function refreshSheetFilter(sheet) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) return;

    var existingFilter = sheet.getFilter();
    if (existingFilter) {
        existingFilter.remove();
    }

    sheet.getRange(1, 1, lastRow, lastCol).createFilter();
}

function formatMultiCalendarSheet(sheet, data, groupedData) {
    var numRows = data.length;
    var numCols = data[0].length;

    var headerRange = sheet.getRange(1, 1, 1, numCols);
    headerRange
        .setFontWeight("bold")
        .setBackground("#1a73e8")
        .setFontColor("white")
        .setHorizontalAlignment("center")
        .setWrap(true);

    var groupColors = [
        "#e8f5e9", "#e3f2fd", "#fff3e0", "#f3e5f5",
        "#fce4ec", "#e0f7fa", "#fffde7", "#efebe9"
    ];

    var currentRow = 2;
    groupedData.forEach(function (group, groupIndex) {
        var color = groupColors[groupIndex % groupColors.length];
        var eventCount = group.events.length;

        if (eventCount > 0) {
            sheet.getRange(currentRow, 1, eventCount, numCols).setBackground(color);
            currentRow += eventCount;
        }
    });

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, numCols);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(9, 250);
    sheet.setColumnWidth(10, 300);
    sheet.hideColumns(2);

    if (numRows > 1) {
        sheet.getRange(2, 7, numRows - 1, 1).setNumberFormat('0 "phút"').setHorizontalAlignment("center");
    }

    sheet.getRange(1, 1, numRows, numCols).setBorder(true, true, true, true, true, true);

    if (numRows > 1) {
        sheet.getRange(1, 1, numRows, numCols).createFilter();
    }

    createMultiCalendarSummary(sheet, data, groupedData);
}

function createMultiCalendarSummary(sheet, data, groupedData) {
    var startRow = data.length + 3;

    sheet.getRange(startRow, 1).setValue("📊 THỐNG KÊ TỔNG HỢP NHIỀU LỊCH").setFontWeight("bold").setFontSize(12);
    sheet.getRange(startRow, 1, 1, 5).merge().setBackground("#e8f0fe");

    var summaryRows = [];
    var totalEvents = 0;
    var totalDuration = 0;

    groupedData.forEach(function (group) {
        var groupDuration = 0;
        group.events.forEach(function (event) {
            groupDuration += formatDuration(event.duration) || 0;
        });

        totalEvents += group.events.length;
        totalDuration += groupDuration;

        summaryRows.push([
            "📅 " + group.calendarName,
            group.events.length + " sự kiện",
            groupDuration,
            "",
            ""
        ]);
    });

    summaryRows.push(["", "", "", "", ""]);
    summaryRows.push([
        "🔢 TỔNG CỘNG",
        totalEvents + " sự kiện",
        totalDuration,
        "",
        ""
    ]);

    if (summaryRows.length > 0) {
        sheet.getRange(startRow + 1, 1, summaryRows.length, 5).setValues(summaryRows);
        sheet.getRange(startRow + 1, 1, summaryRows.length, 1).setFontWeight("bold");
        sheet.getRange(startRow + summaryRows.length, 1, 1, 3).setFontWeight("bold").setBackground("#fff3e0");

        // Ép luôn hiển thị ".0"
        sheet.getRange(startRow + 1, 3, summaryRows.length, 1).setNumberFormat("0.0#").setHorizontalAlignment("left");
    }
}

function syncMultiCalendarToSheet(startDate, endDate, syncAllVpa) {
    var config = getMultiCalendarConfig();
    var calendarIds = [];

    if (syncAllVpa) {
        calendarIds = getAllVpaCalendarIds();
        Logger.log("Chế độ tự động quét: Tìm thấy " + calendarIds.length + " lịch bắt đầu bằng 'VPA'.");
    } else {
        if (!config.enabled || config.calendarIds.length === 0) {
            Logger.log("Multi-calendar chưa được cấu hình. Vui lòng chạy trích xuất trước.");
            return {
                message: "Chưa cấu hình. Vui lòng chạy trích xuất nhiều lịch trước.",
                count: 0,
                newRows: []
            };
        }
        calendarIds = config.calendarIds;
    }

    if (calendarIds.length === 0) {
        return {
            message: "Không tìm thấy lịch VPA nào để đồng bộ.",
            count: 0,
            newRows: []
        };
    }

    var sheet = getOrCreateCalendarDataSheet(config.spreadsheetId);

    var today = new Date();
    if (!startDate) {
        // Mặc định đồng bộ rộng hơn (30 ngày trước -> 30 ngày sau) để không bỏ sót các sự kiện được thêm/sửa sau khi trigger chạy
        startDate = new Date();
        startDate.setDate(today.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
    }
    if (!endDate) {
        endDate = new Date();
        endDate.setDate(today.getDate() + 7);
        endDate.setHours(23, 59, 59, 999);
    }

    var result = extractMultiCalendarEvents(calendarIds, startDate, endDate, {});
    var existingIds = getExistingEventIds(sheet, 2);

    var newEventsCount = 0;
    var newRows = [];

    result.groupedData.forEach(function (group) {
        var stt = countEventsByCalendar(sheet, group.calendarName, 1);
        group.events.forEach(function (event) {
            if (!existingIds[event.id]) {
                stt++;
                newRows.push([
                    group.calendarName,
                    event.id,
                    stt,
                    event.title,
                    event.startTimeStr,
                    event.endTimeStr,
                    formatDuration(event.duration),
                    event.creators,
                    event.guests,
                    event.description
                ]);

                existingIds[event.id] = true;
                newEventsCount++;
            }
        });
    });

    if (newRows.length > 0) {
        // Xóa hàng trống trước khi ghi để tránh khoảng trắng
        cleanupBlankRows(sheet);
        var lastRow = getLastDataRow(sheet);
        sheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
        applyRowFormattingForNewRows(sheet, lastRow + 1, newRows.length, result.groupedData);
        refreshSheetFilter(sheet);
        Logger.log("Đã thêm " + newEventsCount + " sự kiện mới vào sheet CalendarData.");
    } else {
        Logger.log("Không có sự kiện mới.");
    }

    return {
        message: "Đã đồng bộ: " + newEventsCount + " sự kiện mới vào sheet '" + CALENDAR_DATA_SHEET_NAME + "'.",
        count: newEventsCount,
        newRows: newRows
    };
}

function findSummaryStartRow(sheet) {
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 1).getValues();

    for (var i = 0; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().indexOf("THỐNG KÊ") !== -1) {
            return i + 1;
        }
    }

    return lastRow + 1;
}

function countEventsByCalendar(sheet, calendarName, calendarNameColumn) {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return 0;

    var data = sheet.getRange(2, calendarNameColumn, lastRow - 1, 1).getValues();
    var count = 0;

    for (var i = 0; i < data.length; i++) {
        if (data[i][0] === calendarName) count++;
    }

    return count;
}

function applyCalendarGroupColor(sheet, row, calendarName) {
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var calendarOrder = [];

    for (var i = 0; i < data.length; i++) {
        if (data[i][0] && calendarOrder.indexOf(data[i][0]) === -1) {
            calendarOrder.push(data[i][0]);
        }
    }

    var groupColors = [
        "#e8f5e9", "#e3f2fd", "#fff3e0", "#f3e5f5",
        "#fce4ec", "#e0f7fa", "#fffde7", "#efebe9"
    ];

    var colorIndex = calendarOrder.indexOf(calendarName);
    if (colorIndex === -1) colorIndex = 0;

    var color = groupColors[colorIndex % groupColors.length];
    sheet.getRange(row, 1, 1, sheet.getLastColumn()).setBackground(color);
}

function updateMultiCalendarSummary(sheet) {
    var summaryRow = findSummaryStartRow(sheet);
    if (summaryRow <= 1) return;

    var lastRow = sheet.getLastRow();
    if (lastRow >= summaryRow) {
        sheet.deleteRows(summaryRow, lastRow - summaryRow + 1);
    }

    lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

    var calendarStats = {};
    for (var i = 0; i < data.length; i++) {
        var calName = data[i][0];
        if (!calName) continue;

        if (!calendarStats[calName]) {
            calendarStats[calName] = { count: 0, duration: 0 };
        }
        calendarStats[calName].count++;

        calendarStats[calName].duration += data[i][6] || 0;
    }

    var startRow = sheet.getLastRow() + 3;
    sheet.getRange(startRow, 1).setValue("📊 THỐNG KÊ TỔNG HỢP NHIỀU LỊCH").setFontWeight("bold").setFontSize(12);
    sheet.getRange(startRow, 1, 1, 5).merge().setBackground("#e8f0fe");

    var summaryRows = [];
    var totalEvents = 0;
    var totalDuration = 0;

    for (var calName in calendarStats) {
        var stats = calendarStats[calName];
        totalEvents += stats.count;
        totalDuration += stats.duration;

        summaryRows.push([
            "📅 " + calName,
            stats.count + " sự kiện",
            stats.duration,
            "",
            ""
        ]);
    }

    summaryRows.push(["", "", "", "", ""]);
    summaryRows.push([
        "🔢 TỔNG CỘNG",
        totalEvents + " sự kiện",
        totalDuration,
        "",
        ""
    ]);

    if (summaryRows.length > 0) {
        sheet.getRange(startRow + 1, 1, summaryRows.length, 5).setValues(summaryRows);
        sheet.getRange(startRow + 1, 1, summaryRows.length, 1).setFontWeight("bold");
        sheet.getRange(startRow + summaryRows.length, 1, 1, 3).setFontWeight("bold").setBackground("#fff3e0");

        // Ép luôn hiển thị ".0"
        sheet.getRange(startRow + 1, 3, summaryRows.length, 1).setNumberFormat("0.0#").setHorizontalAlignment("left");
    }
}

function syncMultiCalendarForDateRange(sheetName, startStr, endStr) {
    var config = getMultiCalendarConfig();

    if (!config.enabled || config.calendarIds.length === 0) {
        return "Chưa cấu hình. Vui lòng chạy trích xuất nhiều lịch trước.";
    }

    var targetSheetName = sheetName || config.sheetName;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(targetSheetName);

    if (!sheet) {
        return "Không tìm thấy sheet '" + targetSheetName + "'.";
    }

    var startDate = new Date(startStr);
    var endDate = new Date(endStr);
    endDate.setHours(23, 59, 59, 999);

    var result = extractMultiCalendarEvents(config.calendarIds, startDate, endDate, {});
    var existingIds = getExistingEventIds(sheet, 2);

    var newEventsCount = 0;

    result.groupedData.forEach(function (group) {
        group.events.forEach(function (event) {
            if (!existingIds[event.id]) {
                var insertRow = findCalendarGroupEndRow(sheet, group.calendarName, 1);

                if (insertRow === -1) {
                    insertRow = findSummaryStartRow(sheet);
                } else {
                    insertRow = insertRow + 1;
                }

                var currentSTT = countEventsByCalendar(sheet, group.calendarName, 1) + 1;

                sheet.insertRowBefore(insertRow);

                var newRow = [
                    group.calendarName,
                    event.id,
                    currentSTT,
                    event.title,
                    event.startTimeStr,
                    event.endTimeStr,
                    formatDuration(event.duration),
                    event.creators,
                    event.guests,
                    event.description
                ];

                sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);
                applyCalendarGroupColor(sheet, insertRow, group.calendarName);

                sheet.getRange(insertRow, 7).setNumberFormat("0.0#").setHorizontalAlignment("center");

                newEventsCount++;
                existingIds[event.id] = true;
            }
        });
    });

    if (newEventsCount > 0) {
        updateMultiCalendarSummary(sheet);
    }

    return "Đã đồng bộ: " + newEventsCount + " sự kiện mới từ " + startStr + " đến " + endStr + ".";
}

// ================= DELETE FUNCTIONS =================

function getCalendarsInDataSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CALENDAR_DATA_SHEET_NAME);

    if (!sheet || sheet.getLastRow() <= 1) {
        return [];
    }

    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    var calendarCounts = {};
    for (var i = 0; i < data.length; i++) {
        var name = data[i][0];
        if (name && name.toString().trim() !== "") {
            calendarCounts[name] = (calendarCounts[name] || 0) + 1;
        }
    }

    var result = [];
    for (var calName in calendarCounts) {
        result.push({ name: calName, count: calendarCounts[calName] });
    }

    result.sort(function (a, b) {
        return a.name.localeCompare(b.name);
    });

    return result;
}

function deleteCalendarsFromSheet(calendarNames) {
    if (!calendarNames || calendarNames.length === 0) {
        return "Vui lòng chọn ít nhất một lịch cần xóa.";
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CALENDAR_DATA_SHEET_NAME);

    if (!sheet || sheet.getLastRow() <= 1) {
        return "Sheet 'CalendarData' không có dữ liệu để xóa.";
    }

    var deleteSet = {};
    for (var k = 0; k < calendarNames.length; k++) {
        deleteSet[calendarNames[k]] = true;
    }

    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    var rowsToDelete = [];
    for (var i = 0; i < data.length; i++) {
        var name = data[i][0];
        if (name && deleteSet[name]) {
            rowsToDelete.push(i + 2);
        }
    }

    if (rowsToDelete.length === 0) {
        return "Không tìm thấy dữ liệu của các lịch đã chọn.";
    }

    rowsToDelete.reverse();

    var i = 0;
    while (i < rowsToDelete.length) {
        var startRowDel = rowsToDelete[i];
        var count = 1;
        while (i + count < rowsToDelete.length &&
            rowsToDelete[i + count] === startRowDel - count) {
            count++;
        }
        sheet.deleteRows(startRowDel - count + 1, count);
        i += count;
    }

    refreshSheetFilter(sheet);

    return "Đã xóa thành công " + rowsToDelete.length + " sự kiện của " +
        calendarNames.length + " lịch khỏi sheet '" + CALENDAR_DATA_SHEET_NAME + "'.";
}

// ================= CẤU HÌNH EMAIL ĐỂ LẤY LỊCH =================
// Thêm email của những người muốn lấy lịch vào danh sách bên dưới.
// Lưu ý: Người đó phải share quyền xem lịch cho tài khoản chạy script này.

var CONFIGURED_EMAILS = [
   "anhdd@add-group.net"
];

/**
 * Lấy danh sách tất cả lịch (bao gồm lịch từ email đã config)
 * Hàm này được gọi bởi Sidebar để hiển thị danh sách lịch
 * Trả về { my: [...], other: [...], email: [...] }
 */
function getGroupedCalendars() {
    var myCalendars = [];
    var otherCalendars = [];
    var emailCalendars = [];

    // Lấy email của người đang chạy script
    var myEmail = Session.getActiveUser().getEmail();

    // Lấy tất cả lịch của tài khoản hiện tại
    var allCals = CalendarApp.getAllCalendars();

    for (var i = 0; i < allCals.length; i++) {
        var cal = allCals[i];
        var calData = {
            id: cal.getId(),
            name: cal.getName()
        };

        if (cal.isOwnedByMe()) {
            myCalendars.push(calData);
        } else {
            otherCalendars.push(calData);
        }
    }

    // Lấy lịch từ các email đã cấu hình
    if (CONFIGURED_EMAILS && CONFIGURED_EMAILS.length > 0) {
        for (var j = 0; j < CONFIGURED_EMAILS.length; j++) {
            var email = CONFIGURED_EMAILS[j].trim().toLowerCase();
            if (!email || email === myEmail) continue;

            try {
                var cal = CalendarApp.getCalendarById(email);
                if (cal) {
                    // Kiểm tra xem lịch này đã có trong danh sách chưa
                    var alreadyExists = false;
                    for (var k = 0; k < otherCalendars.length; k++) {
                        if (otherCalendars[k].id === email) {
                            alreadyExists = true;
                            break;
                        }
                    }

                    if (!alreadyExists) {
                        emailCalendars.push({
                            id: email,
                            name: cal.getName() + " (" + email + ")"
                        });
                    }
                }
            } catch (e) {
                Logger.log("Không thể truy cập lịch của: " + email + " - " + e.message);
            }
        }
    }

    return {
        my: myCalendars,
        other: otherCalendars,
        email: emailCalendars
    };
}

/**
 * Tự động tìm tất cả ID lịch có tên bắt đầu bằng "VPA" (không phân biệt chữ hoa/thường)
 */
function getAllVpaCalendarIds() {
    var calendarIds = [];
    
    // 1. Quét tất cả lịch trong tài khoản hiện tại
    var allCals = CalendarApp.getAllCalendars();
    for (var i = 0; i < allCals.length; i++) {
        var name = allCals[i].getName().trim();
        if (/^VPA/i.test(name)) {
            calendarIds.push(allCals[i].getId());
        }
    }

    // 2. Quét các lịch từ danh sách email cấu hình thêm
    if (CONFIGURED_EMAILS && CONFIGURED_EMAILS.length > 0) {
        var myEmail = "";
        try {
            myEmail = Session.getActiveUser().getEmail();
        } catch (e) {}

        for (var j = 0; j < CONFIGURED_EMAILS.length; j++) {
            var email = CONFIGURED_EMAILS[j].trim().toLowerCase();
            if (!email || email === myEmail) continue;

            try {
                var cal = CalendarApp.getCalendarById(email);
                if (cal && /^VPA/i.test(cal.getName().trim())) {
                    if (calendarIds.indexOf(email) === -1) {
                        calendarIds.push(email);
                    }
                }
            } catch (e) {
                Logger.log("Không thể truy cập lịch của: " + email + " - " + e.message);
            }
        }
    }

    return calendarIds;
}

