/**
 * Module Kiểm tra & Cảnh báo Lịch Nhân viên (Schedule Validator)
 * Kiểm tra xem nhân viên đã làm/khai báo lịch làm việc cho NGÀY HÔM QUA & NGÀY HÔM NAY trên các Lịch dự án VPA chưa.
 * 
 * LOGIC CHẶT CHẼ (v2):
 * - Nhân viên TRONG dự án VPA: Cần tổng ≥ MIN_WORK_HOURS giờ trên lịch VPA
 * - Nhân viên NGOÀI dự án VPA: Cần tổng ≥ MIN_WORK_HOURS giờ + có lịch cả buổi sáng VÀ buổi chiều
 * - Xử lý sự kiện trùng lắp thời gian (merge overlapping intervals)
 */

// ================= CẤU HÌNH KIỂM TRA GIỜ LÀM VIỆC =================

// Giờ làm việc tối thiểu để không bị cảnh báo
var MIN_WORK_HOURS = 6;

// Định nghĩa khung giờ sáng/chiều (dùng cho nhân viên NGOÀI VPA)
var MORNING_START_HOUR = 8;    // 8:00 AM
var MORNING_END_HOUR = 12;     // 12:00 PM
var AFTERNOON_START_HOUR = 13; // 1:00 PM (sau giờ nghỉ trưa)
var AFTERNOON_END_HOUR = 18;   // 6:00 PM

// ================= CÁC TỪ KHÓA & DANH SÁCH =================

// Các từ khóa nhận biết sự kiện nghỉ phép / day off
var DAY_OFF_KEYWORDS = [
    "day off",
    "nghỉ",
    "leave",
    "off",
    "p/o",
    "po",
    "p.o",
    "phép",
    "nghi",
    "out of office",
    "vắng mặt",
    "vang mat"
];

var STAFF_SPREADSHEET_ID = "1Up1DFaOAddIEX_ac-ewJb656P8cWrna8uHk3TuipjVE";
var STAFF_SHEET_NAME = "StaffInformation";

// Danh sách Tên/Email các nhân viên NGOẠI LỆ (KHÔNG phải làm lịch và KHÔNG bị nhắc nhở)
var EXCLUDED_STAFF_LIST = [
    // 7 nhân viên miễn làm lịch & miễn nhận/cảnh báo lịch theo yêu cầu mới:
    "tô vũ luật", "to vu luat",
    "đỗ duy anh", "do duy anh", "anhdd@add-group.net",
    "triệu thủy tiên", "trieu thuy tien",
    "đào bá đạt", "dao ba dat", "datdb@add-group.net",
    "lê thị sim", "le thi sim",
    "nguyễn thị thủy", "nguyen thi thuy",
    "nguyễn quỳnh trang", "nguyen quynh trang", "ntttrang@planadd.com",

    // Các nhân viên lãnh đạo/ngoại lệ cố định trước đây:
    "son min chang",
    "kim minjeong",
    "đỗ phương thảo", "do phuong thao",
    "nguyễn lan hương", "nguyen lan huong",
    "đặng đình thuyết", "dang dinh thuyet",
    "nguyễn văn quyết", "nguyen van quyet",
    "nguyễn đình kiên", "nguyen dinh kien",
    "âu thị hiếu", "au thi hieu",
    "boss@add-group.net",
    "info@planadd.com",
    "nlhuong@planadd.com",
    "ddthuyet@add-group.net",
    "quyetnv@planadd.com",
    "ndkien@add-group.net",
    "athieu@add-group.net"
];

// Danh sách Tên/Email các Quản lý nhận EMAIL TỔNG báo cáo vi phạm làm lịch HÔM QUA
var SUMMARY_ALERT_MANAGER_NAMES = [
    "tô vũ luật", "to vu luat", "tvluat@add-group.net",
    "đỗ duy anh", "do duy anh", "anhdd@add-group.net",
    "đào bá đạt", "dao ba dat", "datdb@add-group.net"
];

/**
 * Tìm email của các Quản lý (Tô Vũ Luật, Đỗ Duy Anh, Đào Bá Đạt) từ Sheet StaffInformation
 * @returns {Array<string>} Danh sách email của các quản lý
 */
function getSummaryManagerEmails() {
    var managerEmails = [];
    var emailMap = {};

    try {
        var ss = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
        var sheet = ss.getSheetByName(STAFF_SHEET_NAME) || ss.getSheets()[0];
        if (sheet) {
            var lastRow = sheet.getLastRow();
            if (lastRow >= 2) {
                var range = sheet.getRange(2, 1, lastRow - 1, 12);
                var data = range.getValues();

                for (var i = 0; i < data.length; i++) {
                    var row = data[i];
                    var rawName = row[1] != null ? row[1].toString().trim().toLowerCase() : "";
                    var rawEmail = row[11] != null ? row[11].toString().trim().toLowerCase() : "";

                    if (!rawEmail || rawEmail.indexOf("@") === -1) continue;

                    for (var m = 0; m < SUMMARY_ALERT_MANAGER_NAMES.length; m++) {
                        var target = SUMMARY_ALERT_MANAGER_NAMES[m];
                        if ((rawName && rawName.indexOf(target) !== -1) || (rawEmail && rawEmail.indexOf(target) !== -1)) {
                            if (!emailMap[rawEmail]) {
                                emailMap[rawEmail] = true;
                                managerEmails.push(rawEmail);
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        Logger.log("Lỗi khi lấy email Quản lý từ Sheet StaffInformation: " + e.message);
    }

    // Nếu không tìm thấy qua sheet, dự phòng lấy email tài khoản đang chạy script
    if (managerEmails.length === 0 && typeof Session !== 'undefined') {
        try {
            var activeEmail = Session.getActiveUser().getEmail();
            if (activeEmail) managerEmails.push(activeEmail);
        } catch (err) { }
    }

    return managerEmails;
}

/**
 * Kiểm tra xem nhân viên có nằm trong danh sách ngoại lệ (không phải làm lịch) hay không
 * @param {string} name - Tên nhân viên
 * @param {string} email - Email nhân viên
 * @returns {boolean} true nếu nhân viên được miễn làm lịch
 */
function isExcludedStaff(name, email) {
    var lowerName = (name || "").toString().toLowerCase().trim();
    var lowerEmail = (email || "").toString().toLowerCase().trim();

    for (var i = 0; i < EXCLUDED_STAFF_LIST.length; i++) {
        var item = EXCLUDED_STAFF_LIST[i];
        if ((lowerName && lowerName.indexOf(item) !== -1) || (lowerEmail && lowerEmail.indexOf(item) !== -1)) {
            return true;
        }
    }
    return false;
}

/**
 * Lấy danh sách email và tên của nhân viên từ Spreadsheet chứa thông tin nhân viên
 * Spreadsheet ID: 1Up1DFaOAddIEX_ac-ewJb656P8cWrna8uHk3TuipjVE (Sheet: StaffInformation)
 * - Cột B (Cột 2): Tên nhân viên (Name)
 * - Cột L (Cột 12): Email nhân viên (Email)
 * Bỏ qua tuyệt đối các nhân viên nằm trong mảng EXCLUDED_STAFF_LIST.
 * @returns {Array<{email: string, name: string}>}
 */
function getStaffList() {
    var staffList = [];
    var emailMap = {};

    try {
        var ss = SpreadsheetApp.openById(STAFF_SPREADSHEET_ID);
        var sheet = ss.getSheetByName(STAFF_SHEET_NAME) || ss.getSheets()[0];

        if (sheet) {
            var lastRow = sheet.getLastRow();
            if (lastRow >= 2) {
                var range = sheet.getRange(2, 1, lastRow - 1, 12);
                var data = range.getValues();

                for (var i = 0; i < data.length; i++) {
                    var row = data[i];
                    var rawStaffId = row[0] != null ? row[0].toString().trim() : "";   // Cột A - Staff ID
                    var rawName = row[1] != null ? row[1].toString().trim() : "";      // Cột B - Name
                    var rawNickname = row[2] != null ? row[2].toString().trim() : "";  // Cột C - Nick Name
                    var rawPosition = row[3] != null ? row[3].toString().trim() : "";  // Cột D - Position
                    var rawDept = row[4] != null ? row[4].toString().trim().toUpperCase() : ""; // Cột E - Department (ADD, VPA, ASG, TYM...)
                    var rawDiv = row[10] != null ? row[10].toString().trim().toUpperCase() : ""; // Cột K - Division (000, 200, 300, 500, 600, ADC...)
                    var rawEmail = row[11] != null ? row[11].toString().trim().toLowerCase() : ""; // Cột L - Email

                    // Kiểm tra xem nhân viên có thuộc danh sách ngoại lệ không
                    if (isExcludedStaff(rawName, rawEmail)) {
                        Logger.log("-> BỎ QUA nhân viên ngoại lệ: [" + rawName + " (" + rawEmail + ")] - Không phải làm lịch.");
                        continue;
                    }

                    if (rawEmail && rawEmail.indexOf("@") !== -1) {
                        if (!emailMap[rawEmail]) {
                            emailMap[rawEmail] = true;
                            var displayName = rawName || rawEmail.split('@')[0];

                            // Tách lấy Tên ngắn thuần túy (pureShortName) từ Cột C (Nick Name) hoặc Cột B (Name)
                            // VD: "500.Tam" -> "Tam", "VPA.Huyen" -> "Huyen", "Trương Minh Tâm" -> "Tam"
                            var pureShortName = rawNickname.replace(/^[A-Za-z0-9]+\./, "").trim();
                            if (!pureShortName) {
                                var nameParts = rawName.trim().split(/\s+/);
                                if (nameParts.length > 0) {
                                    pureShortName = nameParts[nameParts.length - 1];
                                }
                            }

                            // Xác định nhân viên có thuộc bộ phận VPA không dựa trên Cột E (Department) hoặc Cột A (Staff ID)
                            var isVpaDept = (rawDept === "VPA" || /^VPA/i.test(rawStaffId) || /^VPA/i.test(rawDiv));

                            staffList.push({
                                staffId: rawStaffId,
                                email: rawEmail,
                                name: displayName,
                                nickname: rawNickname,
                                pureShortName: pureShortName,
                                position: rawPosition,
                                department: rawDept,
                                division: rawDiv,
                                isVpaDepartment: isVpaDept
                            });
                        }
                    }
                }
                Logger.log("Đã lấy thành công " + staffList.length + " nhân viên từ sheet '" + sheet.getName() + "' (Spreadsheet ID: " + STAFF_SPREADSHEET_ID + ").");
            }
        }
    } catch (e) {
        Logger.log("Lỗi khi mở Sheet danh sách nhân viên (" + STAFF_SPREADSHEET_ID + "): " + e.message);
    }

    // Dự phòng: Nếu không đọc được từ Spreadsheet ID ngoài, lấy từ CONFIGURED_EMAILS
    if (staffList.length === 0 && typeof CONFIGURED_EMAILS !== 'undefined' && Array.isArray(CONFIGURED_EMAILS)) {
        for (var j = 0; j < CONFIGURED_EMAILS.length; j++) {
            var email = CONFIGURED_EMAILS[j].trim().toLowerCase();
            if (email && !emailMap[email]) {
                emailMap[email] = true;
                staffList.push({ email: email, name: email.split('@')[0], isVpaDepartment: false });
            }
        }
    }

    return staffList;
}

/**
 * Kiểm tra tiêu đề sự kiện có phải là sự kiện "Day Off" / "Nghỉ phép" thực sự hay không.
 * Tránh nhận diện sai các từ làm việc như "Kick off", "Hand off", "Office", "Nghiệm thu", v.v.
 * @param {string} title - Tiêu đề sự kiện
 * @returns {boolean}
 */
function isDayOffEvent(title) {
    if (!title) return false;
    var lowerTitle = title.toString().toLowerCase().trim();

    // Các cụm từ chắc chắn là nghỉ phép / Day Off / Out of Office / Vắng mặt (Kiểm tra TRƯỚC từ loại trừ)
    var exactPhrases = [
        "out of office", "out-of-office",
        "vắng mặt", "vang mat",
        "day off", "day-off", "dayoff",
        "nghỉ phép", "nghỉ làm", "xin nghỉ", "nghỉ ốm", "nghỉ thai sản",
        "annual leave", "sick leave", "paid leave",
        "p/o", "p.o"
    ];

    for (var p = 0; p < exactPhrases.length; p++) {
        if (lowerTitle.indexOf(exactPhrases[p]) !== -1) {
            return true;
        }
    }

    // Các từ làm việc thông thường cần BỎ QUA NGAY (nếu không khớp các cụm từ trên)
    var workExcludeKeywords = [
        "kick off", "kick-off", "kickoff",
        "hand off", "hand-off", "handoff",
        "office", "offline", "off-site", "offsite",
        "official", "offer",
        "nghiệm thu", "nghiên cứu", "suy nghĩ"
    ];

    for (var w = 0; w < workExcludeKeywords.length; w++) {
        if (lowerTitle.indexOf(workExcludeKeywords[w]) !== -1) {
            return false;
        }
    }

    // Tách từ theo ranh giới từ (word boundary) để kiểm tra từ đơn lẻ: "off", "nghỉ", "leave", "phép"
    var words = lowerTitle.split(/[\s,.\-_/()]+/);
    for (var i = 0; i < words.length; i++) {
        var word = words[i];
        if (word === "off" || word === "nghỉ" || word === "leave" || word === "phép") {
            return true;
        }
    }

    return false;
}

/**
 * Trích xuất username từ email (vd: anhdd@add-group.net -> anhdd)
 * @param {string} email
 * @returns {string}
 */
function getUsernameFromEmail(email) {
    if (!email) return "";
    var atIndex = email.indexOf("@");
    return atIndex !== -1 ? email.substring(0, atIndex).toLowerCase() : email.toLowerCase();
}

// ================= HÀM TÍNH GIỜ LÀM VIỆC (v2) =================

/**
 * Gộp các khoảng thời gian bị trùng lắp (overlapping intervals) để tránh đếm trùng giờ.
 * Input: Mảng [[startMs, endMs], ...] - đã sort theo startMs.
 * Output: Mảng [[startMs, endMs], ...] - đã merge.
 */
function mergeOverlappingIntervals(intervals) {
    if (!intervals || intervals.length === 0) return [];

    // Sort theo thời gian bắt đầu
    intervals.sort(function (a, b) { return a[0] - b[0]; });

    var merged = [intervals[0]];
    for (var i = 1; i < intervals.length; i++) {
        var last = merged[merged.length - 1];
        var current = intervals[i];

        if (current[0] <= last[1]) {
            // Overlap hoặc liên tiếp → mở rộng khoảng
            last[1] = Math.max(last[1], current[1]);
        } else {
            merged.push(current);
        }
    }
    return merged;
}

/**
 * Lấy danh sách tất cả ID lịch cần quét (VPA, ADD, ADC, 200, 300, lịch dự án, lịch cá nhân...)
 * Bỏ qua các lịch hệ thống (Sinh nhật, Ngày lễ, Tasks).
 * @returns {Array<string>}
 */
function getAllTargetCalendarIds() {
    var calendarIds = [];
    var calendarMap = {};

    function addCalId(id) {
        if (!id) return;
        var lowerId = id.toString().trim().toLowerCase();
        if (!lowerId || calendarMap[lowerId]) return;

        // Bỏ qua lịch hệ thống
        if (lowerId.indexOf("#contacts@group.v.calendar.google.com") !== -1) return;
        if (lowerId.indexOf("#holiday@group.v.calendar.google.com") !== -1) return;
        if (lowerId.indexOf("holiday@group.calendar.google.com") !== -1) return;

        calendarMap[lowerId] = true;
        calendarIds.push(id.toString().trim());
    }

    // 1. Quét tất cả lịch trong tài khoản hiện tại
    try {
        var allCals = CalendarApp.getAllCalendars();
        for (var i = 0; i < allCals.length; i++) {
            var cal = allCals[i];
            var name = cal.getName().trim().toLowerCase();
            if (name === "birthdays" || name === "tasks" || name === "ngàylễ" || name === "ngày lễ") continue;
            addCalId(cal.getId());
        }
    } catch (e) {
        Logger.log("Lỗi khi lấy danh sách calendar: " + e.message);
    }

    // 2. Lấy thêm từ cấu hình Multi-Calendar (nếu có)
    try {
        if (typeof getMultiCalendarConfig === 'function') {
            var config = getMultiCalendarConfig();
            if (config && config.calendarIds && Array.isArray(config.calendarIds)) {
                for (var c = 0; c < config.calendarIds.length; c++) {
                    addCalId(config.calendarIds[c]);
                }
            }
        }
    } catch (e) {}

    // 3. Lấy thêm từ CONFIGURED_EMAILS
    if (typeof CONFIGURED_EMAILS !== 'undefined' && Array.isArray(CONFIGURED_EMAILS)) {
        for (var j = 0; j < CONFIGURED_EMAILS.length; j++) {
            var email = CONFIGURED_EMAILS[j].trim().toLowerCase();
            if (email) addCalId(email);
        }
    }

    // 4. Lấy TẤT CẢ email nhân viên từ getStaffList() để quét lịch cá nhân của từng nhân viên
    try {
        if (typeof getStaffList === 'function') {
            var staffList = getStaffList();
            for (var s = 0; s < staffList.length; s++) {
                if (staffList[s] && staffList[s].email) {
                    addCalId(staffList[s].email);
                }
            }
        }
    } catch (e) {
        Logger.log("Không thể tự động lấy email nhân viên từ getStaffList: " + e.message);
    }

    return calendarIds;
}

/**
 * Loại bỏ dấu tiếng Việt và chuyển thành chữ thường
 * @param {string} str
 * @returns {string}
 */
function removeAccents(str) {
    if (!str) return "";
    return str.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

/**
 * Kiểm tra xem ID hoặc Tên lịch có phải là lịch cá nhân của nhân viên hay không.
 * @param {string} calId - ID của lịch
 * @param {string} calName - Tên của lịch
 * @param {Object} staff - { email, name }
 * @returns {boolean}
 */
function isStaffPersonalCalendar(calId, calName, staff) {
    if (!calId && !calName) return false;
    var lowerCalId = (calId || "").toLowerCase().trim();
    var lowerCalName = (calName || "").toLowerCase().trim();

    var staffEmail = (staff.email || "").toLowerCase().trim();
    var staffUsername = getUsernameFromEmail(staffEmail);
    var staffName = (staff.name || "").trim();
    var staffNameNoAccents = removeAccents(staffName);

    // 1. So sánh trực tiếp email
    if (staffEmail && (lowerCalId === staffEmail || lowerCalName === staffEmail)) return true;

    // 2. So sánh username (vd: quyenlt, tmtam, thaotn, giangdt)
    if (staffUsername && staffUsername.length >= 3) {
        var calIdUsername = getUsernameFromEmail(lowerCalId);
        if (calIdUsername === staffUsername) return true;
        if (lowerCalName.indexOf(staffUsername) !== -1) return true;
    }

    // 3. So sánh tên đầy đủ của nhân viên trong tên lịch
    if (staffNameNoAccents && staffNameNoAccents.length >= 4) {
        if (removeAccents(lowerCalName).indexOf(staffNameNoAccents) !== -1) return true;
    }

    return false;
}

/**
 * Kiểm tra xem 1 sự kiện có liên quan đến 1 nhân viên hay không.
 * @param {Object} evt - { title, creators, guests, description }
 * @param {Object} staff - { email, name }
 * @param {boolean} isStaffOwnPersonalCal - true nếu là lịch cá nhân của chính nhân viên
 * @returns {boolean}
 */
function isEventInvolvingStaff(evt, staff, isStaffOwnPersonalCal) {
    if (isStaffOwnPersonalCal) return true;

    var staffEmail = (staff.email || "").toLowerCase().trim();
    var staffUsername = getUsernameFromEmail(staffEmail);
    var staffName = (staff.name || "").trim();
    var staffNameNoAccents = removeAccents(staffName);

    var pureShortName = removeAccents(staff.pureShortName || staff.nickname || "");
    pureShortName = pureShortName.replace(/^[a-z0-9]+\./i, "").trim();

    var creators = (evt.creators || "").toLowerCase();
    var guests = (evt.guests || "").toLowerCase();
    var title = (evt.title || "").toLowerCase();
    var titleNoAccents = removeAccents(evt.title);
    var desc = (evt.description || "").toLowerCase();
    var descNoAccents = removeAccents(evt.description);

    // 1. Kiểm tra username (vd: quyenlt, tmtam, thaotn, giangdt)
    if (staffUsername && staffUsername.length >= 3) {
        if (creators.indexOf(staffUsername) !== -1) return true;
        if (guests.indexOf(staffUsername) !== -1) return true;
        if (title.indexOf(staffUsername) !== -1) return true;
        if (desc.indexOf(staffUsername) !== -1) return true;
    }

    // 2. Kiểm tra email đầy đủ (hỗ trợ cả domain @add-group.net và @planadd.com)
    if (staffEmail && staffEmail.indexOf("@") !== -1) {
        var altEmail = staffEmail.indexOf("@add-group.net") !== -1 ?
            staffEmail.replace("@add-group.net", "@planadd.com") :
            (staffEmail.indexOf("@planadd.com") !== -1 ? staffEmail.replace("@planadd.com", "@add-group.net") : "");

        if (guests.indexOf(staffEmail) !== -1 || (altEmail && guests.indexOf(altEmail) !== -1)) return true;
        if (creators.indexOf(staffEmail) !== -1 || (altEmail && creators.indexOf(altEmail) !== -1)) return true;
    }

    // 3. Kiểm tra Tên nhân viên đầy đủ (không dấu và có dấu)
    if (staffNameNoAccents && staffNameNoAccents.length >= 4) {
        if (titleNoAccents.indexOf(staffNameNoAccents) !== -1) return true;
        if (descNoAccents.indexOf(staffNameNoAccents) !== -1) return true;
        if (creators.indexOf(staffNameNoAccents) !== -1) return true;
        if (guests.indexOf(staffNameNoAccents) !== -1) return true;
    }

    // 4. Kiểm tra Tên ngắn thuần túy (vd: "tam", "quyen", "thao", "giang", "huyen")
    if (pureShortName && pureShortName.length >= 3) {
        var shortRegex = new RegExp("\\b" + pureShortName + "\\b", "i");
        if (shortRegex.test(titleNoAccents) || shortRegex.test(descNoAccents) || shortRegex.test(creators) || shortRegex.test(guests)) {
            return true;
        }
    }

    // 5. Kiểm tra từ cuối cùng của Tên (vd "Trương Minh Tâm" -> "tam")
    var nameParts = staffNameNoAccents.split(/\s+/);
    if (nameParts.length >= 2) {
        var lastName = nameParts[nameParts.length - 1];
        if (lastName && lastName.length >= 3) {
            var lastRegex = new RegExp("\\b" + lastName + "\\b", "i");
            if (lastRegex.test(titleNoAccents) || lastRegex.test(descNoAccents) || lastRegex.test(creators) || lastRegex.test(guests)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Thu thập tất cả sự kiện liên quan đến 1 nhân viên từ tất cả các lịch (VPA, ADC, 200, 300, dự án, cá nhân...)
 * @param {Object} staff - { email, name }
 * @param {Date} start - Bắt đầu ngày
 * @param {Date} end - Kết thúc ngày
 * @returns {Object}
 */
function collectAllStaffEvents(staff, start, end) {
    var staffEmail = (staff.email || "").toLowerCase().trim();
    var targetCalendarIds = getAllTargetCalendarIds();
    var eventsResult = extractMultiCalendarEvents(targetCalendarIds, start, end, {});

    var staffVpaEventsOnVpaCal = [];
    var staffVpaEventsNotOnVpaCal = [];
    var staffAdcOrOtherEvents = [];
    var staffAllEvents = [];

    var seenEventKeys = {};

    var debugLogs = [];

    if (eventsResult && eventsResult.groupedData) {
        eventsResult.groupedData.forEach(function (group) {
            var calName = (group.calendarName || "").trim();
            var calId = (group.calendarId || "").toLowerCase().trim();

            var isStaffOwnPersonalCal = isStaffPersonalCalendar(calId, calName, staff);
            var isVpaCalendar = /^VPA?/i.test(calName) || calId.indexOf("vpa") !== -1;
            var matchedInGroup = 0;

            group.events.forEach(function (evt) {
                if (!isEventInvolvingStaff(evt, staff, isStaffOwnPersonalCal)) return;

                var title = (evt.title || "").trim();
                var key = evt.id || (title + "_" + evt.startTime.getTime());

                if (seenEventKeys[key]) return;
                seenEventKeys[key] = true;

                matchedInGroup++;

                var eventObj = {
                    title: title,
                    startTime: evt.startTime,
                    endTime: evt.endTime,
                    calendarName: calName,
                    isAllDay: evt.isAllDay || false,
                    isOnVpaCalendar: isVpaCalendar
                };

                staffAllEvents.push(eventObj);

                var isVpaEventTitle = /^VPA?/i.test(title) || /\bVPA?\b/i.test(title);

                if (isVpaCalendar || isVpaEventTitle) {
                    if (isVpaCalendar) {
                        staffVpaEventsOnVpaCal.push(eventObj);
                    } else {
                        staffVpaEventsNotOnVpaCal.push(eventObj);
                    }
                } else {
                    staffAdcOrOtherEvents.push(eventObj);
                }
            });

            if (matchedInGroup > 0) {
                debugLogs.push("  • [" + calName + " (" + calId + ")]: Khớp " + matchedInGroup + " sự kiện");
            }
        });
    }

    // Thu thập thêm trực tiếp từ CalendarApp.getCalendarById cho các email cá nhân (thử cả domain @add-group.net và @planadd.com)
    var isPersonalCalAccessible = false;
    if (staffEmail) {
        var emailsToTry = [staffEmail];
        if (staffEmail.indexOf("@add-group.net") !== -1) {
            emailsToTry.push(staffEmail.replace("@add-group.net", "@planadd.com"));
        } else if (staffEmail.indexOf("@planadd.com") !== -1) {
            emailsToTry.push(staffEmail.replace("@planadd.com", "@add-group.net"));
        }

        for (var m = 0; m < emailsToTry.length; m++) {
            var calAddress = emailsToTry[m];
            try {
                var personalCal = CalendarApp.getCalendarById(calAddress);
                if (!personalCal) {
                    try {
                        personalCal = CalendarApp.subscribeToCalendar(calAddress);
                    } catch (subErr) {
                        Logger.log("Thử subscribeToCalendar cho " + calAddress + " thất bại: " + subErr.message);
                    }
                }

                if (personalCal) {
                    isPersonalCalAccessible = true;
                    var pEvents = personalCal.getEvents(start, end);
                    var countP = 0;
                    for (var e = 0; e < pEvents.length; e++) {
                        var pEvt = pEvents[e];
                        var pTitle = (pEvt.getTitle() || "").trim();
                        var pStartMs = pEvt.getStartTime().getTime();
                        var pKey = pEvt.getId() || (pTitle + "_" + pStartMs);

                        if (!seenEventKeys[pKey]) {
                            seenEventKeys[pKey] = true;
                            countP++;
                            var isVpaTitle = /^VPA?/i.test(pTitle) || /\bVPA?\b/i.test(pTitle);
                            var pObj = {
                                title: pTitle,
                                startTime: pEvt.getStartTime(),
                                endTime: pEvt.getEndTime(),
                                calendarName: personalCal.getName(),
                                isAllDay: pEvt.isAllDayEvent(),
                                isOnVpaCalendar: /^VPA?/i.test(personalCal.getName())
                            };

                            staffAllEvents.push(pObj);

                            if (isVpaTitle || pObj.isOnVpaCalendar) {
                                staffVpaEventsNotOnVpaCal.push(pObj);
                            } else {
                                staffAdcOrOtherEvents.push(pObj);
                            }
                        }
                    }
                    debugLogs.push("  • Lịch cá nhân [" + calAddress + "]: Đọc thành công (" + pEvents.length + " sự kiện trong ngày, " + countP + " sự kiện mới)");
                } else {
                    debugLogs.push("  • Lịch cá nhân [" + calAddress + "]: CalendarApp.getCalendarById trả về NULL");
                }
            } catch (err) {
                Logger.log("Không thể đọc trực tiếp lịch cá nhân: " + calAddress + " - Lỗi: " + err.message);
                debugLogs.push("  • Lịch cá nhân [" + calAddress + "]: Lỗi truy cập API -> " + err.message);
            }
        }
    }

    return {
        vpaOnVpaCal: staffVpaEventsOnVpaCal,
        vpaNotOnVpaCal: staffVpaEventsNotOnVpaCal,
        adcOrOther: staffAdcOrOtherEvents,
        allEvents: staffAllEvents,
        isPersonalCalAccessible: isPersonalCalAccessible,
        debugLogs: debugLogs
    };
}

/**
 * Tính tổng số giờ làm việc thực tế từ danh sách sự kiện.
 * - Bỏ qua sự kiện all-day
 * - Bỏ qua sự kiện Day Off
 * - Chỉ tính phần thời gian nằm trong ngày target (clamp vào 00:00 - 23:59)
 * - Xử lý sự kiện trùng lắp thời gian (merge overlapping intervals)
 * @param {Array<Object>} events - Mảng { title, startTime, endTime, isAllDay }
 * @param {Date} dayStart - Bắt đầu ngày (00:00:00)
 * @param {Date} dayEnd - Kết thúc ngày (23:59:59)
 * @returns {number} Tổng số giờ làm việc (thập phân, VD: 7.5)
 */
function calculateWorkHours(events, dayStart, dayEnd) {
    if (!events || events.length === 0) return 0;

    var intervals = [];
    var dayStartMs = dayStart.getTime();
    var dayEndMs = dayEnd.getTime();

    for (var i = 0; i < events.length; i++) {
        var evt = events[i];

        // Bỏ qua sự kiện all-day
        if (evt.isAllDay) continue;

        // Bỏ qua sự kiện Day Off
        if (isDayOffEvent(evt.title)) continue;

        var evtStartMs = evt.startTime.getTime();
        var evtEndMs = evt.endTime.getTime();

        // Clamp vào phạm vi ngày target
        var clampedStart = Math.max(evtStartMs, dayStartMs);
        var clampedEnd = Math.min(evtEndMs, dayEndMs);

        if (clampedStart < clampedEnd) {
            intervals.push([clampedStart, clampedEnd]);
        }
    }

    // Merge overlapping intervals để không đếm trùng
    var merged = mergeOverlappingIntervals(intervals);

    // Tính tổng thời lượng
    var totalMs = 0;
    for (var j = 0; j < merged.length; j++) {
        totalMs += (merged[j][1] - merged[j][0]);
    }

    return totalMs / (1000 * 60 * 60); // Chuyển từ ms sang giờ
}

/**
 * Kiểm tra nhân viên có sự kiện trong buổi sáng (8:00-12:00) VÀ buổi chiều (13:00-18:00).
 * @param {Array<Object>} events - Mảng { title, startTime, endTime, isAllDay }
 * @param {Date} targetDate - Ngày kiểm tra
 * @returns {Object} { hasMorning: boolean, hasAfternoon: boolean }
 */
function checkMorningAfternoonCoverage(events, targetDate) {
    var result = { hasMorning: false, hasAfternoon: false };
    if (!events || events.length === 0) return result;

    var morningStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), MORNING_START_HOUR, 0, 0).getTime();
    var morningEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), MORNING_END_HOUR, 0, 0).getTime();
    var afternoonStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), AFTERNOON_START_HOUR, 0, 0).getTime();
    var afternoonEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), AFTERNOON_END_HOUR, 0, 0).getTime();

    for (var i = 0; i < events.length; i++) {
        var evt = events[i];

        // Bỏ qua sự kiện all-day và Day Off
        if (evt.isAllDay) continue;
        if (isDayOffEvent(evt.title)) continue;

        var evtStartMs = evt.startTime.getTime();
        var evtEndMs = evt.endTime.getTime();

        // Kiểm tra overlap với khung sáng: sự kiện có phần nào nằm trong 8:00-12:00
        if (evtStartMs < morningEnd && evtEndMs > morningStart) {
            result.hasMorning = true;
        }

        // Kiểm tra overlap với khung chiều: sự kiện có phần nào nằm trong 13:00-18:00
        if (evtStartMs < afternoonEnd && evtEndMs > afternoonStart) {
            result.hasAfternoon = true;
        }

        // Thoát sớm nếu đã đủ cả 2 buổi
        if (result.hasMorning && result.hasAfternoon) break;
    }

    return result;
}

/**
 * Xác định nhân viên có thuộc dự án VPA hay không.
 * Nhân viên TRONG VPA = có ít nhất 1 sự kiện trên lịch VPA (không phải Day Off, không phải all-day).
 * @param {Array<Object>} staffVpaEvents - Sự kiện VPA của nhân viên
 * @returns {boolean}
 */
function isStaffInVpaProject(staffVpaEvents) {
    if (!staffVpaEvents || staffVpaEvents.length === 0) return false;

    for (var i = 0; i < staffVpaEvents.length; i++) {
        var evt = staffVpaEvents[i];
        if (!evt.isAllDay && !isDayOffEvent(evt.title)) {
            return true;
        }
    }
    return false;
}

// ================= HÀM KIỂM TRA CHÍNH (v2) =================

/**
 * Kiểm tra trạng thái lịch của 1 nhân viên cho 1 ngày cụ thể (LOGIC CHẶT CHẼ v2)
 * 
 * LOGIC:
 * 1. Skip cuối tuần
 * 2. Kiểm tra Day Off (lịch cá nhân + lịch VPA)
 * 3. Thu thập sự kiện VPA + cá nhân
 * 4. Xác định nhân viên VPA hay NGOÀI VPA
 * 5. NHÂN VIÊN VPA: Tổng giờ VPA >= MIN_WORK_HOURS → HỢP LỆ
 * 6. NHÂN VIÊN NGOÀI VPA: Tổng giờ >= MIN_WORK_HOURS + có sáng & chiều → HỢP LỆ
 * 
 * @param {Object} staff - { email, name }
 * @param {Date} targetDate - Ngày cần kiểm tra
 * @param {string} dateLabel - Nhãn ngày
 * @returns {Object} { isOk, dateStr, dateLabel, reason, totalHours, hasMorning, hasAfternoon, isVpaStaff }
 */
/**
 * Kiểm tra trạng thái lịch của 1 nhân viên cho 1 ngày cụ thể
 * 
 * QUY TẮC CỐ ĐỊNH & RÕ RÀNG:
 * 1. Bỏ qua ngày cuối tuần (Thứ 7 & Chủ Nhật).
 * 2. Bỏ qua nếu nhân viên có sự kiện Nghỉ phép / Day Off / Out of office / Vắng mặt.
 * 3. Dự án VPA / Nhân viên VPA: Chỉ cần tổng số giờ làm việc đạt ≥ 6 tiếng/ngày là HỢP LỆ.
 * 4. Dự án ADC / Không phải VPA: Cần tổng số giờ làm việc đạt ≥ 6 tiếng/ngày VÀ có lịch cả buổi sáng (8h-12h) và chiều (13h-18h).
 */
function checkStaffScheduleForDate(staff, targetDate, dateLabel) {
    var start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    var end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    var dateStr = Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "dd/MM/yyyy");

    // 1. Kiểm tra cuối tuần (Ngoại lệ cố định: Ngày 22/08/2026 - Thứ 7 là ngày làm việc cần kiểm tra)
    var dayOfWeek = targetDate.getDay();
    var isSpecialWorkSaturday = (dateStr === "22/08/2026");

    if ((dayOfWeek === 0 || dayOfWeek === 6) && !isSpecialWorkSaturday) {
        var dayName = dayOfWeek === 0 ? "Chủ Nhật" : "Thứ 7";
        return { isOk: true, dateStr: dateStr, dateLabel: dateLabel, reason: "Cuối tuần (" + dayName + ")", totalHours: 0 };
    }

    var staffEmail = staff.email.toLowerCase().trim();

    // 2. Thu thập TẤT CẢ sự kiện công việc của nhân viên
    var collected = collectAllStaffEvents(staff, start, end);
    var allEvents = collected.allEvents;

    // 3. Kiểm tra Day Off / Nghỉ phép (ở bất kỳ lịch nào)
    for (var d = 0; d < allEvents.length; d++) {
        if (isDayOffEvent(allEvents[d].title)) {
            return {
                isOk: true, dateStr: dateStr, dateLabel: dateLabel,
                reason: "Day Off (\"" + allEvents[d].title + "\")",
                totalHours: 0
            };
        }
    }

    // 4. Tính tổng số giờ làm việc thực tế (đã gộp trùng giờ)
    var totalHours = calculateWorkHours(allEvents, start, end);
    var totalHoursRounded = Math.round(totalHours * 10) / 10;
    var coverage = checkMorningAfternoonCoverage(allEvents, targetDate);

    // Kiểm tra xem nhân viên có sự kiện VPA nào không
    var hasVpaEvent = false;
    for (var v = 0; v < allEvents.length; v++) {
        if (/^VPA/i.test(allEvents[v].title.trim()) || allEvents[v].isOnVpaCalendar) {
            hasVpaEvent = true;
            break;
        }
    }

    // 5. Kiểm tra kết quả
    if (hasVpaEvent || staff.isVpaDepartment) {
        // ========== TRƯỜNG HỢP: NHÂN VIÊN / DỰ ÁN VPA ==========
        if (totalHoursRounded >= MIN_WORK_HOURS) {
            return {
                isOk: true, dateStr: dateStr, dateLabel: dateLabel,
                reason: "Đã làm lịch VPA đủ " + totalHoursRounded + "h",
                totalHours: totalHoursRounded, isVpaStaff: true
            };
        } else {
            return {
                isOk: false, dateStr: dateStr, dateLabel: dateLabel, displayLabel: dateStr,
                reason: "Chỉ có " + totalHoursRounded + "h (cần tối thiểu " + MIN_WORK_HOURS + "h)",
                totalHours: totalHoursRounded, isVpaStaff: true
            };
        }
    } else {
        // ========== TRƯỜNG HỢP: NHÂN VIÊN / DỰ ÁN KHÔNG PHẢI VPA (ADC, ADD, 200, 300...) ==========
        var violations = [];

        if (totalHoursRounded < MIN_WORK_HOURS) {
            if (allEvents.length === 0 && !collected.isPersonalCalAccessible) {
                violations.push("Chưa share quyền xem Lịch cá nhân (" + staffEmail + ") cho tài khoản script");
            } else {
                violations.push("Chỉ có " + totalHoursRounded + "h (cần tối thiểu " + MIN_WORK_HOURS + "h)");
            }
        }

        if (!coverage.hasMorning) {
            violations.push("Thiếu lịch buổi sáng (" + MORNING_START_HOUR + ":00-" + MORNING_END_HOUR + ":00)");
        }

        if (!coverage.hasAfternoon) {
            violations.push("Thiếu lịch buổi chiều (" + AFTERNOON_START_HOUR + ":00-" + AFTERNOON_END_HOUR + ":00)");
        }

        if (violations.length === 0) {
            return {
                isOk: true, dateStr: dateStr, dateLabel: dateLabel,
                reason: "Đủ lịch sáng + chiều, tổng " + totalHoursRounded + "h",
                totalHours: totalHoursRounded, isVpaStaff: false,
                hasMorning: coverage.hasMorning, hasAfternoon: coverage.hasAfternoon
            };
        } else {
            return {
                isOk: false, dateStr: dateStr, dateLabel: dateLabel, displayLabel: dateStr,
                reason: violations.join(" | "),
                totalHours: totalHoursRounded, isVpaStaff: false,
                hasMorning: coverage.hasMorning, hasAfternoon: coverage.hasAfternoon
            };
        }
    }
}

/**
 * Hàm chính: Kiểm tra lịch nhân viên chỉ cho NGÀY HÔM QUA.
 * Trigger chạy lúc 11:00 AM — HÔM NAY nhân viên vẫn đang trong giờ làm,
 * nên chỉ kiểm tra HÔM QUA để tránh cảnh báo oan.
 * Nếu HÔM QUA là Thứ 7 / Chủ Nhật (cuối tuần) → bỏ qua hoàn toàn, không gửi email.
 * @returns {Object} Kết quả kiểm tra
 */
function checkYesterdayAndTodayStaffSchedules() {
    var today = new Date();
    var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

    var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy");
    var yesterdayStr = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), "dd/MM/yyyy");

    // Nếu HÔM QUA là cuối tuần → bỏ qua toàn bộ phiên kiểm tra
    var yDow = yesterday.getDay();
    if (yDow === 0 || yDow === 6) {
        var yDayName = yDow === 0 ? "Chủ Nhật" : "Thứ 7";
        Logger.log("=== HÔM QUA là " + yDayName + " (cuối tuần) - Bỏ qua kiểm tra lịch, không gửi cảnh báo. ===");
        return { okCount: 0, violationCount: 0, violations: {}, skipped: true, skipReason: "Hôm qua là " + yDayName };
    }

    Logger.log("=== Bắt đầu kiểm tra lịch nhân viên cho HÔM QUA (" + yesterdayStr + ") | Hôm nay: " + todayStr + " ===");
    Logger.log("=== Điều kiện: Tối thiểu " + MIN_WORK_HOURS + "h | Nhân viên ngoài VPA cần lịch cả sáng (" + MORNING_START_HOUR + ":00-" + MORNING_END_HOUR + ":00) & chiều (" + AFTERNOON_START_HOUR + ":00-" + AFTERNOON_END_HOUR + ":00) ===");

    var staffList = getStaffList();
    var violationsByStaff = {};
    var okCount = 0;

    staffList.forEach(function (staff) {
        var yStatus = checkStaffScheduleForDate(staff, yesterday, "Hôm qua");

        if (!yStatus.isOk) {
            violationsByStaff[staff.email] = {
                staffName: staff.name,
                staffEmail: staff.email,
                missingDates: [yStatus.displayLabel],
                reason: yStatus.reason || "Chưa xác định",
                totalHours: yStatus.totalHours || 0,
                isVpaStaff: yStatus.isVpaStaff || false,
                hasMorning: yStatus.hasMorning,
                hasAfternoon: yStatus.hasAfternoon
            };
            Logger.log("-> VI PHẠM: [" + staff.name + " (" + staff.email + ")] " + yStatus.reason);
        } else {
            okCount++;
            Logger.log("-> HỢP LỆ: [" + staff.name + " (" + staff.email + ")] " + yStatus.reason + " (" + (yStatus.totalHours || 0) + "h)");
        }
    });

    var violationEmails = Object.keys(violationsByStaff);
    Logger.log("=== Kết quả: " + okCount + " hợp lệ, " + violationEmails.length + " vi phạm ===");

    // Gửi 01 EMAIL TỔNG BÁO CÁO VI PHẠM cho các Quản lý
    if (violationEmails.length > 0) {
        var managerEmails = getSummaryManagerEmails();
        sendSummaryScheduleAlert(violationsByStaff, managerEmails, yesterdayStr);

        // Gửi EMAIL CẢNH BÁO CÁ NHÂN trực tiếp đến từng nhân viên vi phạm
        Logger.log("=== Bắt đầu gửi email cảnh báo cá nhân đến " + violationEmails.length + " nhân viên vi phạm ===");
        for (var ve = 0; ve < violationEmails.length; ve++) {
            var vEmail = violationEmails[ve];
            var vInfo = violationsByStaff[vEmail];
            try {
                sendIndividualScheduleAlert(
                    vInfo.staffEmail,
                    vInfo.staffName,
                    vInfo.missingDates,
                    null,
                    vInfo.reason
                );
                Logger.log("-> Đã gửi email cảnh báo cá nhân đến: " + vInfo.staffName + " (" + vInfo.staffEmail + ")");
            } catch (sendErr) {
                Logger.log("-> Lỗi gửi email cá nhân đến " + vInfo.staffEmail + ": " + sendErr.message);
            }
        }
        Logger.log("=== Hoàn tất gửi email cảnh báo cá nhân ===");
    }

    return {
        okCount: okCount,
        violationCount: violationEmails.length,
        violations: violationsByStaff
    };
}

/**
 * Alias tương thích ngược cho checkYesterdayStaffSchedules
 */
function checkYesterdayStaffSchedules() {
    return checkYesterdayAndTodayStaffSchedules();
}

/**
 * Hàm Debug: Kiểm tra và in chi tiết toàn bộ lịch + sự kiện quét được cho 1 nhân viên cụ thể.
 * @param {string} targetEmail - Email hoặc Tên nhân viên cần debug (ví dụ: giangdt@planadd.com)
 */
function debugCheckStaffSchedule(targetEmail) {
    targetEmail = targetEmail || "giangdt@planadd.com";
    var staffList = getStaffList();
    var targetStaff = null;

    for (var i = 0; i < staffList.length; i++) {
        if (staffList[i].email.toLowerCase().indexOf(targetEmail.toLowerCase()) !== -1 ||
            staffList[i].name.toLowerCase().indexOf(targetEmail.toLowerCase()) !== -1) {
            targetStaff = staffList[i];
            break;
        }
    }

    if (!targetStaff) {
        targetStaff = { email: targetEmail, name: targetEmail.split('@')[0], isVpaDepartment: false };
    }

    var date1 = new Date(2026, 7, 21); // 21/08/2026
    var date2 = new Date(2026, 7, 22); // 22/08/2026

    var targetCalendarIds = getAllTargetCalendarIds();
    var timezone = Session.getScriptTimeZone();

    var logLines = [];
    logLines.push("🔍 DEBUG CHECK SCHEDULE FOR: " + targetStaff.name + " (" + targetStaff.email + ")");
    logLines.push("📌 Cột E Department: " + (targetStaff.department || "N/A") + " | isVpaDepartment: " + targetStaff.isVpaDepartment);
    logLines.push("📌 Nickname: " + (targetStaff.nickname || "N/A"));
    logLines.push("📌 Tổng số Calendar ID quét: " + targetCalendarIds.length);

    logLines.push("\n📋 DANH SÁCH 42 CALENDAR HỆ THỐNG ĐANG MỞ:");
    targetCalendarIds.forEach(function (cId, idx) {
        try {
            var cObj = CalendarApp.getCalendarById(cId);
            if (cObj) {
                logLines.push("  " + (idx + 1) + ". [" + cObj.getName() + "] -> ID: " + cId);
            } else {
                logLines.push("  " + (idx + 1) + ". [NULL - Chưa thêm vào Lịch của tôi] -> ID: " + cId);
            }
        } catch (e) {
            logLines.push("  " + (idx + 1) + ". [LỖI: " + e.message + "] -> ID: " + cId);
        }
    });

    [date1, date2].forEach(function (tDate) {
        var dStr = Utilities.formatDate(tDate, timezone, "dd/MM/yyyy (EEEE)");
        logLines.push("\n📅 --- KIỂM TRA NGÀY: " + dStr + " ---");

        var start = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), 0, 0, 0);
        var end = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), 23, 59, 59, 999);

        // Quét và in ra toàn bộ sự kiện thô trên tất cả các lịch
        var rawEventsResult = extractMultiCalendarEvents(targetCalendarIds, start, end, {});
        logLines.push("  🔍 DỮ LIỆU SỰ KIỆN THÔ TRÊN CÁC LỊCH DÙNG CHUNG:");
        var totalRaw = 0;
        if (rawEventsResult && rawEventsResult.groupedData) {
            rawEventsResult.groupedData.forEach(function (grp) {
                if (grp.events && grp.events.length > 0) {
                    totalRaw += grp.events.length;
                    logLines.push("    • Lịch [" + grp.calendarName + "] (" + grp.events.length + " sự kiện):");
                    grp.events.forEach(function (ev, evIdx) {
                        var gStr = (ev.guests || "").replace(/\n/g, "; ");
                        logLines.push("      " + (evIdx + 1) + ". \"" + ev.title + "\" (" + ev.startTimeStr + "-" + ev.endTimeStr + ") | Creator: [" + ev.creators + "] | Guests: [" + gStr + "]");
                    });
                }
            });
        }
        logLines.push("  👉 Tổng số sự kiện thô tìm thấy trên tất cả lịch: " + totalRaw);

        var collected = collectAllStaffEvents(targetStaff, start, end);
        logLines.push("  👉 Tổng sự kiện KHỚP VỚI " + targetStaff.name + ": " + collected.allEvents.length);
        if (collected.debugLogs && collected.debugLogs.length > 0) {
            logLines.push("  📋 CHI TIẾT ĐỐI CHIẾU:");
            collected.debugLogs.forEach(function (dLog) {
                logLines.push("  " + dLog);
            });
        }
        if (!collected.isPersonalCalAccessible) {
            logLines.push("  ⚠️ QUYỀN TRUY CẬP: Chưa đọc được Lịch cá nhân (" + targetStaff.email + ")");
        }

        collected.allEvents.forEach(function (evt, idx) {
            logLines.push("    " + (idx + 1) + ". [" + evt.calendarName + "] " + evt.title + " (" +
                Utilities.formatDate(evt.startTime, timezone, "HH:mm") + " - " +
                Utilities.formatDate(evt.endTime, timezone, "HH:mm") + ")" +
                (evt.isOnVpaCalendar ? " [VPA Cal]" : ""));
        });

        var status = checkStaffScheduleForDate(targetStaff, tDate, dStr);
        logLines.push("  RESULT: " + (status.isOk ? "✅ OK" : "❌ THIẾU") + " — " + status.reason + " (Tổng " + (status.totalHours || 0) + "h)");
    });

    var resultText = logLines.join("\n");
    Logger.log(resultText);

    var htmlOutput = HtmlService.createHtmlOutput(
        '<pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap; background: #222; color: #00ff00; padding: 12px; height: 440px; overflow: auto;">' +
        escapeHtml(resultText) +
        '</pre>'
    ).setWidth(750).setHeight(500);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🔍 Debug Kết quả quét lịch của ' + targetStaff.name);
}

function promptDebugStaffSchedule() {
    var ui = SpreadsheetApp.getUi();
    var response = ui.prompt(
        '🐞 DEBUG Kiểm tra Lịch Nhân viên',
        'Nhập Email hoặc Tên nhân viên cần kiểm tra chi tiết (VD: giangdt@planadd.com):',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
        var text = response.getResponseText().trim();
        if (text) {
            debugCheckStaffSchedule(text);
        }
    }
}
