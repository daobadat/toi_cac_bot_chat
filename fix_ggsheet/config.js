const CONFIG = {
    STAFF_INFO_SHEET_NAME: "StaffInformation",
    DATA_START_ROW: 2,        // Header ở dòng 1, data bắt đầu từ dòng 2
    CHECKBOX_COL: 15,         // Cột O

    COLS: {
        STT: 1,          // Cột A: Staff ID (dùng làm ID/STT)
        ID: 1,           // Cột A: Staff ID
        NAME: 2,         // Cột B: Name
        NICKNAME: 3,     // Cột C: Nick Name
        POSITION: 4,     // Cột D: Position
        DOB: 6,          // Cột F: DOB
        TENURE: 7,       // Cột G: Tenure at ADD (tự tính)
        DIVISION: 10,    // Cột J: Division (Phòng ban số)
        GENDER: 11,      // Cột K: Gender
        PHONE: 12,       // Cột L: Phone
        EMAIL: 13,       // Cột M: Email
        DATE_ENTERED: 14 // Cột N: Date of Entered
    },

    // Cấu trúc cột file Working Time (sheet "test2")
    // No. | Name | Gender | Detail | Time | Note | Bộ phận | Column 8 | Phòng ban | ID
    WORKING_TIME_COLS: {
        NO: 1,         // Cột 1: STT
        NAME: 2,       // Cột 2: Tên
        GENDER: 3,     // Cột 3: Giới tính
        DETAIL: 4,     // Cột 4: Detail
        TIME: 5,       // Cột 5: Time
        NOTE: 6,       // Cột 6: Note/Position
        COMPANY: 7,    // Cột 7: Bộ phận (VD: "Bộ phận: ADD")
        COL8: 8,        // Cột 8: Column 8
        DEPT: 9,       // Cột 9: Phòng ban
        ID: 10         // Cột 10: ID
    },

    // 2. Từ điển viết tắt Chức vụ (Position Mapping)
    POS_MAP: {
        "PRESIDENT - CEO": "CEO",
        "CEO": "CEO",
        "VICE DIRECTOR": "VDIR",
        "DEPUTY MANAGER": "DPT",
        "MANAGER": "MNG",
        "SITE MANAGER": "SM",
        "TEAM LEADER": "LDR",
        "SUPERVISOR": "SUP",
        "TEAM ASSISTANT": "AST",
        "STAFF": "STF",
        "INTERN": "INT",
        "ARCHITECT": "ARC"
    },

    CONTRACT_MAP: {
        "INTERN": "Thực Tập",
        "STAFF": "Chính thức dưới 1 năm",
        "TEAM ASSISTANT": "Chính thức dưới 1 năm",
        "SUPERVISOR": "Chính thức trên 1 năm",
        "TEAM LEADER": "Chính thức trên 1 năm",
        "MANAGER": "Chính thức trên 1 năm",
        "SITE MANAGER": "Chính thức trên 1 năm",
        "DEPUTY MANAGER": "Chính thức trên 1 năm",
        "VICE DIRECTOR": "Chính thức trên 1 năm",
        "CEO": "Chính thức trên 1 năm",
        "PRESIDENT - CEO": "Chính thức trên 1 năm",
        "ARCHITECT": "Chính thức trên 1 năm"
    },

    // 3. ID của các File 
    FILES: {
        // PENALTY_BONUS đã bỏ vì chính là Active Spreadsheet
        ORG_CHART: "1lC2AGWH10r7ZWiFiUiO-uftIPzlMdfQ3L1PaGw34T7w",
        TIMESTAMP: "1ytMbWdEFGrAgyL0xKgp9OzTAOO62Sh7ma1WSOlFK2m4",
        HOLIDAY_BONUS: "1yBhumEphvpVI46NCTs4mdEM-MVUXxkAI2sfcLs03rc8"
    },

    // 4. Cấu hình Birthday Notification
    BIRTHDAY: {
        PROP_RECIPIENTS: "birthdayRecipients",
        PROP_HOUR: "birthdayHour",
        PROP_LAST_SENT_DATE: "birthdayLastSentDate"
    }
};

/**
 * Suy ra tên Công ty (ADD/VPA) từ Division (phòng ban số)
 * @param {string|number} division
 * @returns {string} "VPA" hoặc "ADD"
 */
function getCompanyFromDivision(division) {
    const d = String(division || "").trim().toLowerCase();
    if (d === "600" || d === "600t" || d === "600c") {
        return "VPA";
    }
    return "ADD";
}
