function updateBatchEmployees() {
    // ÉP HỆ THỐNG LƯU TOÀN BỘ THAO TÁC TICK CHECKBOX TRƯỚC KHI CHẠY CODE
    SpreadsheetApp.flush();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("staff info");

    const CHECKBOX_COL = 14;
    // -------------------------------------------------------------

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return; // Nếu bảng chưa có dữ liệu thì dừng luôn

    // 1. LẤY DANH SÁCH CÁC DÒNG ĐƯỢC TÍCH CHECKBOX
    const checkboxRange = sheet.getRange(3, CHECKBOX_COL, lastRow - 2, 1);
    const checkboxValues = checkboxRange.getValues();
    let selectedRows = [];

    // Quét xem ô nào đang được tích
    for (let i = 0; i < checkboxValues.length; i++) {
        const val = checkboxValues[i][0];
        // Nới lỏng điều kiện: Nhận cả true (logic) và "TRUE" (chữ)
        if (val === true || val === "TRUE" || val === "true" || val == true) {
            selectedRows.push(i + 3);
        }
    }

    if (selectedRows.length === 0) {
        SpreadsheetApp.getUi().alert("⚠️ Hãy tích chọn (☑️) ít nhất 1 dòng nhân viên cần đồng bộ!");
        return;
    }

    const ui = SpreadsheetApp.getUi();
    const startResponse = ui.alert(
        "XÁC NHẬN ĐỒNG BỘ",
        
        `Bạn đã chọn ${selectedRows.length} nhân sự.\n\nHệ thống sẽ cập nhật thông tin sang các file:\n  • Working Time\n  • Thưởng Lễ\n  • Sinh nhật (trong file Thưởng Lễ)\n\nTiếp tục?`,
        ui.ButtonSet.YES_NO
    );

    if (startResponse != ui.Button.YES) {
        checkboxRange.uncheck();
        return;
    }

    let peopleToUpdate = [];

    for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];

        // Đọc dữ liệu dựa theo config của bạn
        const stt = sheet.getRange(row,CONFIG.COLS.STT).getValue();
        const id = sheet.getRange(row, CONFIG.COLS.ID).getValue();
        const newName = sheet.getRange(row, CONFIG.COLS.NAME).getValue();
        const dept = sheet.getRange(row, CONFIG.COLS.DEPT).getValue().toString().trim();
        const birth = sheet.getRange(row, CONFIG.COLS.BIRTH).getValue();
        const position = sheet.getRange(row, CONFIG.COLS.POSITION || 4).getValue();
        const joinDate = sheet.getRange(row, CONFIG.COLS.DATE_ENTERED).getValue();
        const gender = sheet.getRange(row, CONFIG.COLS.GENDER).getValue();
        const company = sheet.getRange(row, CONFIG.COLS.COMPANY).getValue().toString().trim();

        if (!id || id === "") {
            ui.alert(`⚠️ Bỏ qua dòng ${row} vì không có ID.`);
            continue;
        }

        const lastName = getLastName(newName);
        const nickName = `${lastName}.${dept}`;

        // === TẠM TẮT: Prompt hỏi Tên Cũ cho Sơ đồ tổ chức (ORG_CHART đã tắt) ===
        // const promptResponse = ui.prompt(
        //     `Nhân sự ${i + 1}/${selectedRows.length}: ${newName}`,
        //     `Nhập TÊN CŨ trên "Sơ đồ tổ chức" của ID [${id}].\n\n⚠️ Nếu bỏ trống ô này, hệ thống sẽ CHỈ cập nhật các file khác, KHÔNG cập nhật sơ đồ.`,
        //     ui.ButtonSet.OK_CANCEL
        // );
        // if (promptResponse.getSelectedButton() !== ui.Button.OK) {
        //     ui.alert("Đã hủy quá trình đồng bộ.");
        //     return;
        // }
        // const oldName = promptResponse.getResponseText().trim();
        // Thay đoạn tạo employeeCode cũ bằng đoạn này:
        const posAbbr = CONFIG.POS_MAP[(position || "").toString().toUpperCase().trim()] || "STF";
        const cleanCompany = company.toString().trim().toUpperCase();
        const cleanDept = dept.toString().trim();
        const cleanPos = (posAbbr || "STF").toString().trim().toUpperCase();
        const cleanId = String(id).trim().padStart(2, '0');
        const employeeCode = `${cleanCompany}.${cleanDept}.${cleanPos}.${cleanId}`;

        const contractType = getContractType(position, joinDate);
        Logger.log("Mã ID vừa tạo để đi tìm là: [" + employeeCode + "]");
        peopleToUpdate.push({
            contractType: contractType,
            stt: stt,
            id: id,
            newName: newName,  
            nickName: nickName,
            birth: birth,
            position: position,
            joinDate: joinDate,
            employeeCode: employeeCode,
            gender: gender,
            company: company,
            companyLabel: "Bộ phận: " + company.toUpperCase(),
            dept: dept
        });
    }
    

    if (peopleToUpdate.length === 0) {
        checkboxRange.uncheck();
        ui.alert("Không có dữ liệu hợp lệ để đồng bộ.");
        return;
    }

    ss.toast(`Đang đồng bộ cho ${peopleToUpdate.length} nhân sự. Vui lòng đợi...`, "Hệ thống", 30);

    // Gọi hàm CoreSync
    let logReport = coreSyncData(peopleToUpdate);

    // Đồng bộ thêm sheet Sinh nhật trong file Thưởng Lễ (cập nhật tất cả trong 1 nút)
    try {
        const birthdayReport = coreSyncBirthdayOnly(peopleToUpdate);
        if (birthdayReport && birthdayReport.length) {
            logReport = logReport.concat(birthdayReport);
        }
    } catch (e) {
        logReport.push(`❌ Sinh nhật: Lỗi xử lý (${e.message})`);
    }

    // Tự động gỡ tick sau khi chạy xong
    checkboxRange.uncheck();

    ui.alert(`KẾT QUẢ CẬP NHẬT:\n\n${logReport.join("\n")}`);
    
}

/**
 * Luồng riêng cho nút "Update Sinh Nhật" (tùy chọn):
 * Chỉ đồng bộ dữ liệu sang sheet Sinh nhật trong file Thưởng Lễ.
 *
 * Lưu ý: nút "🔄 Cập nhật thông tin Nhân sự đã chọn" hiện đã bao gồm sync Sinh nhật
 * (để cập nhật tất cả trong một lần bấm).
 */
function updateBirthdayOnly() {
    SpreadsheetApp.flush();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("staff info");
    const CHECKBOX_COL = 14;
    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return;

    const checkboxRange = sheet.getRange(3, CHECKBOX_COL, lastRow - 2, 1);
    const checkboxValues = checkboxRange.getValues();
    const selectedRows = [];

    for (let i = 0; i < checkboxValues.length; i++) {
        const val = checkboxValues[i][0];
        if (val === true || val === "TRUE" || val === "true" || val == true) {
            selectedRows.push(i + 3);
        }
    }

    const ui = SpreadsheetApp.getUi();
    if (selectedRows.length === 0) {
        ui.alert("⚠️ Hãy tích chọn (☑️) ít nhất 1 dòng nhân viên cần đồng bộ sinh nhật!");
        return;
    }

    const startResponse = ui.alert(
        "XÁC NHẬN ĐỒNG BỘ SINH NHẬT",
        `Bạn đã chọn ${selectedRows.length} nhân sự.\n\nHệ thống sẽ chỉ cập nhật sang sheet Sinh Nhật.\n\nTiếp tục?`,
        ui.ButtonSet.YES_NO
    );
    if (startResponse != ui.Button.YES) {
        checkboxRange.uncheck();
        return;
    }

    const peopleToUpdate = [];
    for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        const id = sheet.getRange(row, CONFIG.COLS.ID).getValue();
        const newName = sheet.getRange(row, CONFIG.COLS.NAME).getValue();
        const dept = sheet.getRange(row, CONFIG.COLS.DEPT).getValue().toString().trim();
        const birth = sheet.getRange(row, CONFIG.COLS.BIRTH).getValue();
        const position = sheet.getRange(row, CONFIG.COLS.POSITION || 4).getValue();
        const joinDate = sheet.getRange(row, CONFIG.COLS.DATE_ENTERED).getValue();
        const company = sheet.getRange(row, CONFIG.COLS.COMPANY).getValue().toString().trim();

        if (!newName || String(newName).trim() === "") {
            continue;
        }

        const contractType = getContractType(position, joinDate);
        peopleToUpdate.push({
            id: id,
            newName: newName,
            dept: dept,
            birth: birth,
            position: position,
            joinDate: joinDate,
            company: company,
            contractType: contractType
        });
    }

    if (peopleToUpdate.length === 0) {
        checkboxRange.uncheck();
        ui.alert("Không có dữ liệu hợp lệ để đồng bộ sinh nhật.");
        return;
    }

    ss.toast(`Đang đồng bộ sheet sinh nhật cho ${peopleToUpdate.length} nhân sự...`, "Hệ thống", 30);
    const logReport = coreSyncBirthdayOnly(peopleToUpdate);

    checkboxRange.uncheck();
    ui.alert(`KẾT QUẢ CẬP NHẬT SINH NHẬT:\n\n${logReport.join("\n")}`);
}

function debugFinder() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("staff info");
    
    // Đọc dòng 25 (Nguyễn Anh Vũ) — đổi số nếu cần
    const row = 13
    const id = sheet.getRange(row, CONFIG.COLS.ID).getValue();
    const name = sheet.getRange(row, CONFIG.COLS.NAME).getValue();
    const position = sheet.getRange(row, CONFIG.COLS.POSITION).getValue();
    const company = sheet.getRange(row, CONFIG.COLS.COMPANY).getValue();
    
    Logger.log("=== STAFF INFO ===");
    Logger.log("ID: [" + id + "] type: " + typeof id);
    Logger.log("Name: [" + name + "]");
    Logger.log("Position: [" + position + "]");
    Logger.log("Company: [" + company + "]");
    
    
    // Test tìm trong Holiday Bonus
    const hbSS = SpreadsheetApp.openById(CONFIG.FILES.HOLIDAY_BONUS);
    const hbSheet = hbSS.getSheetByName("New Year Eve");
    const hbFinder = hbSheet.getRange("A:A")
        .createTextFinder(String(name))
        .matchEntireCell(true)
        .findAll();
    Logger.log("\n=== HOLIDAY BONUS (tìm Name=" + name + " ở cột A) ===");
    Logger.log("Tìm thấy: " + hbFinder.length + " ô");
    if (hbFinder.length > 0) {
        Logger.log("Dòng: " + hbFinder[0].getRow());
    }
}

