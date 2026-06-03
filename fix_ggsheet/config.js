const CONFIG = {
    COLS: {
        STT: 1,       // Cột A: Số thứ tự (23) ← dùng cho Working Time
        ID: 2,        // Cột B: Mã tổng hợp (VPA.600.STF.05) ← dùng cho Holiday Bonus
        DEPT: 3,      // Cột C: Phòng ban (Division)
        NAME: 4,      // Cột D: Tên nhân viên
        COMPANY: 5,   // Cột E: Công ty
        POSITION: 6,  // Cột F: Chức vụ (Position)
        CERTIFICATE: 7,
        GENDER: 8,
        PHONE: 9,
        EMAIL: 10,
        BIRTH: 11,
        DATE_ENTERED: 12,

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
        PENALTY_BONUS: "1Up1DFaOAddIEX_ac-ewJb656P8cWrna8uHk3TuipjVE",
        ORG_CHART: "1lC2AGWH10r7ZWiFiUiO-uftIPzlMdfQ3L1PaGw34T7w",
        TIMESTAMP: "1ytMbWdEFGrAgyL0xKgp9OzTAOO62Sh7ma1WSOlFK2m4",
        HOLIDAY_BONUS: "1yBhumEphvpVI46NCTs4mdEM-MVUXxkAI2sfcLs03rc8"
        
    }
};
