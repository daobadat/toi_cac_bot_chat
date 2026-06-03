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
 * Đánh lại số thứ tự (STT) cho cột A của sheet Staff Info.
 * Chạy từ dòng 3 đến dòng cuối cùng, đánh tuần tự 1, 2, 3...
 * @param {Sheet} sheet - Sheet "staff info"
 */
function reindexSTT(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return; // Không có dữ liệu
    const count = lastRow - 2; // Dữ liệu bắt đầu từ dòng 3
    const sttValues = [];
    for (let i = 1; i <= count; i++) {
        sttValues.push([i]);
    }
    sheet.getRange(3, CONFIG.COLS.STT, count, 1).setValues(sttValues);
}
