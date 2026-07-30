function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Một số ký tự đặc biệt
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    return str;
}

function getLastName(fullname) {
    if (!fullname || typeof fullname !== 'string') return "";
    const cleanName = removeVietnameseTones(fullname).trim();
    const nameParts = cleanName.trim().split(/\s+/);
    const lastName = nameParts[nameParts.length - 1];
    return lastName;
}

/**
 * Đánh lại số thứ tự (STT) cho cột A của sheet StaffInformation.
 * Chạy từ dòng DATA_START_ROW đến dòng cuối cùng, đánh tuần tự 1, 2, 3...
 * 
 * LƯU Ý: Sheet StaffInformation dùng Staff ID dạng chuỗi (VPA.600.STF.01)
 * nên hàm này KHÔNG được gọi khi Add/Delete trên file Penalty/Bonus.
 * Hàm được giữ lại để tương thích với các luồng cũ nếu cần.
 * @param {Sheet} sheet - Sheet "StaffInformation"
 */
function reindexSTT(sheet) {
    const lastRow = sheet.getLastRow();
    const start = CONFIG.DATA_START_ROW || 2; // Dữ liệu bắt đầu từ dòng 2
    if (lastRow < start) return; // Không có dữ liệu
    const count = lastRow - start + 1;
    const sttValues = [];
    for (let i = 1; i <= count; i++) {
        sttValues.push([i]);
    }
    sheet.getRange(start, CONFIG.COLS.STT, count, 1).setValues(sttValues);
}

function getEmployeeNickname(fullname, dept, position) {
    if (!fullname || typeof fullname !== 'string') return "";
    const cleanName = removeVietnameseTones(fullname).trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length === 0) return "";
    
    let givenName = parts[parts.length - 1];
    
    // Check for common compound names: "Duy Anh", "Lan Huong"
    if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        const lastTwo = (secondLast + " " + last).toLowerCase();
        if (lastTwo === "duy anh" || lastTwo === "lan huong") {
            givenName = secondLast + " " + last;
        }
    }
    
    // Format department prefix
    const deptStr = String(dept || "").trim().toLowerCase();
    const posUpper = String(position || "").trim().toUpperCase();
    let prefix = String(dept || "").trim(); // Keep original casing from sheet (e.g. ADC, TYM)
    
    if (deptStr === "600" || deptStr === "600t" || deptStr === "600c") {
        prefix = "VPA";
    } else if (deptStr === "000-200") {
        if (posUpper.includes("MANAGER") || posUpper.includes("MNG")) {
            prefix = "000";
        } else {
            prefix = "200";
        }
    }
    
    return `${prefix}.${givenName}`;
}

function calculateTenure(joinDate) {
    let dateObj = joinDate;
    if (!(dateObj instanceof Date)) {
        if (!joinDate) return 0;
        // Try to parse string format e.g. "dd/MM/yyyy" or "MM/dd/yyyy"
        const str = String(joinDate).trim();
        const parts = str.split(/[\/\-\.]/);
        if (parts.length >= 3) {
            // Assume dd/MM/yyyy
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            dateObj = new Date(year, month, day);
        } else {
            dateObj = new Date(str);
        }
    }
    if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        const currentYear = new Date().getFullYear();
        const joinedYear = dateObj.getFullYear();
        return Math.max(0, currentYear - joinedYear);
    }
    return 0;
}
