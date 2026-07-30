function updateBatchEmployees() {
    // ÉP HỆ THỐNG LƯU TOÀN BỘ THAO TÁC TICK CHECKBOX TRƯỚC KHI CHẠY CODE
    SpreadsheetApp.flush();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);

    if (!sheet) {
        SpreadsheetApp.getUi().alert(`❌ Không tìm thấy sheet "${CONFIG.STAFF_INFO_SHEET_NAME}".`);
        return;
    }

    const CHECKBOX_COL = CONFIG.CHECKBOX_COL; // Cột O = 15
    const DATA_START = CONFIG.DATA_START_ROW; // Dòng 2

    const lastRow = sheet.getLastRow();
    if (lastRow < DATA_START) return;

    // 1. LẤY DANH SÁCH CÁC DÒNG ĐƯỢC TÍCH CHECKBOX
    const checkboxRange = sheet.getRange(DATA_START, CHECKBOX_COL, lastRow - DATA_START + 1, 1);
    const checkboxValues = checkboxRange.getValues();
    let selectedRows = [];

    // Quét xem ô nào đang được tích
    for (let i = 0; i < checkboxValues.length; i++) {
        const val = checkboxValues[i][0];
        // Nới lỏng điều kiện: Nhận cả true (logic) và "TRUE" (chữ)
        if (val === true || val === "TRUE" || val === "true" || val == true) {
            selectedRows.push(i + DATA_START);
        }
    }

    if (selectedRows.length === 0) {
        SpreadsheetApp.getUi().alert("⚠️ Hãy tích chọn (☑️) ít nhất 1 dòng nhân viên cần đồng bộ!");
        return;
    }

    const ui = SpreadsheetApp.getUi();
    const startResponse = ui.alert(
        "XÁC NHẬN ĐỒNG BỘ",
        
        `Bạn đã chọn ${selectedRows.length} nhân sự.\n\nHệ thống sẽ cập nhật thông tin sang các file:\n  • Working Time\n  • Thưởng Lễ, Sinh nhật\n  • Penalty&Bonus\n\nTiếp tục?`,
        ui.ButtonSet.YES_NO
    );

    if (startResponse != ui.Button.YES) {
        checkboxRange.uncheck();
        return;
    }

    let peopleToUpdate = [];

    for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];

        // Đọc dữ liệu dựa theo cấu trúc cột mới của StaffInformation
        const stt      = sheet.getRange(row, CONFIG.COLS.STT).getValue();
        const id       = sheet.getRange(row, CONFIG.COLS.ID).getValue();
        const newName  = sheet.getRange(row, CONFIG.COLS.NAME).getValue();
        const division = sheet.getRange(row, CONFIG.COLS.DIVISION).getValue().toString().trim(); // Cột J
        const position = sheet.getRange(row, CONFIG.COLS.POSITION).getValue();
        const joinDate = sheet.getRange(row, CONFIG.COLS.DATE_ENTERED).getValue();               // Cột N
        const gender   = sheet.getRange(row, CONFIG.COLS.GENDER).getValue();                     // Cột K
        const birth    = sheet.getRange(row, CONFIG.COLS.DOB).getValue();                        // Cột F

        // Suy company từ division
        const company = getCompanyFromDivision(division);
        const dept = division;

        if (!id || id === "") {
            ui.alert(`⚠️ Bỏ qua dòng ${row} vì không có ID.`);
            continue;
        }

        const nickName = getEmployeeNickname(newName, dept, position);
        const tenure = calculateTenure(joinDate);

        const posAbbr = CONFIG.POS_MAP[(position || "").toString().toUpperCase().trim()] || "STF";
        const cleanCompany = company.toString().trim().toUpperCase();
        const cleanDept = dept.toString().trim();
        const cleanPos = (posAbbr || "STF").toString().trim().toUpperCase();
        const contractType = getContractType(position, joinDate);
        Logger.log("ID đang dùng để đi tìm: [" + id + "]");
        peopleToUpdate.push({
            contractType: contractType,
            stt: stt,
            id: id,
            newName: newName,  
            nickName: nickName,
            tenure: tenure,
            position: position,
            joinDate: joinDate,
            gender: gender,
            company: company,
            companyLabel: "Bộ phận: " + company.toUpperCase(),
            dept: dept,          // Division (phòng ban số)
            birth: birth
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
    const sheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);
    const CHECKBOX_COL = CONFIG.CHECKBOX_COL;
    const DATA_START = CONFIG.DATA_START_ROW;
    const lastRow = sheet.getLastRow();
    if (lastRow < DATA_START) return;

    const checkboxRange = sheet.getRange(DATA_START, CHECKBOX_COL, lastRow - DATA_START + 1, 1);
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
        const id       = sheet.getRange(row, CONFIG.COLS.ID).getValue();
        const newName  = sheet.getRange(row, CONFIG.COLS.NAME).getValue();
        const division = sheet.getRange(row, CONFIG.COLS.DIVISION).getValue().toString().trim(); // Cột J
        const position = sheet.getRange(row, CONFIG.COLS.POSITION).getValue();
        const joinDate = sheet.getRange(row, CONFIG.COLS.DATE_ENTERED).getValue();
        const company  = getCompanyFromDivision(division);
        const birth    = sheet.getRange(row, CONFIG.COLS.DOB).getValue();

        if (!newName || String(newName).trim() === "") {
            continue;
        }

        const contractType = getContractType(position, joinDate);
        peopleToUpdate.push({
            id: id,
            newName: newName,
            dept: division,
            position: position,
            joinDate: joinDate,
            company: company,
            contractType: contractType,
            birth: birth
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
    const sheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);
    
    // Đọc dòng test — đổi số nếu cần
    const row = 3;
    const id       = sheet.getRange(row, CONFIG.COLS.ID).getValue();
    const name     = sheet.getRange(row, CONFIG.COLS.NAME).getValue();
    const position = sheet.getRange(row, CONFIG.COLS.POSITION).getValue();
    const division = sheet.getRange(row, CONFIG.COLS.DIVISION).getValue();
    const company  = getCompanyFromDivision(division);
    
    Logger.log("=== STAFF INFO ===");
    Logger.log("ID: [" + id + "] type: " + typeof id);
    Logger.log("Name: [" + name + "]");
    Logger.log("Position: [" + position + "]");
    Logger.log("Division: [" + division + "] → Company: [" + company + "]");

    
    
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

/**
 * Hàm trigger chạy hàng tháng để cập nhật thâm niên (Tenure at ADD)
 * Công thức: currentYear - joinedYear (năm hiện tại - năm vào công ty)
 */
function updateTenureMonthly() {
  try {
    // Dùng Active Spreadsheet vì script chạy từ file Penalty/Bonus Summary
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const staffInfoSheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);
    if (!staffInfoSheet) {
      Logger.log(`Error: '${CONFIG.STAFF_INFO_SHEET_NAME}' sheet not found.`);
      return;
    }
    
    const DATA_START = CONFIG.DATA_START_ROW;
    const lastRowMaster = staffInfoSheet.getLastRow();
    if (lastRowMaster < DATA_START) return;
    
    // Đọc họ tên (cột B) và ngày vào công ty (cột N) từ StaffInformation
    const numCols = CONFIG.COLS.DATE_ENTERED; // đọc đến cột N = 14
    const masterData = staffInfoSheet.getRange(DATA_START, 1, lastRowMaster - DATA_START + 1, numCols).getValues();
    const tenureMap = {};
    
    for (let i = 0; i < masterData.length; i++) {
      const name     = String(masterData[i][CONFIG.COLS.NAME - 1] || "").trim();         // Cột B
      const joinDate = masterData[i][CONFIG.COLS.DATE_ENTERED - 1];                     // Cột N
      if (name) {
        tenureMap[name.toLowerCase()] = calculateTenure(joinDate);
      }
    }
    
    // Cập nhật cột G (Tenure at ADD) trực tiếp trên StaffInformation
    const pbNames = staffInfoSheet.getRange(DATA_START, CONFIG.COLS.NAME, lastRowMaster - DATA_START + 1, 1).getValues();
    const pbTenuresRange = staffInfoSheet.getRange(DATA_START, CONFIG.COLS.TENURE, lastRowMaster - DATA_START + 1, 1); // Cột G
    const pbTenures = pbTenuresRange.getValues();
    
    let updated = false;
    for (let i = 0; i < pbNames.length; i++) {
      const name = String(pbNames[i][0] || "").trim();
      if (name && name.toLowerCase() in tenureMap) {
        const calculatedTenure = tenureMap[name.toLowerCase()];
        if (pbTenures[i][0] !== calculatedTenure) {
          pbTenures[i][0] = calculatedTenure;
          updated = true;
        }
      }
    }
    
    if (updated) {
      pbTenuresRange.setValues(pbTenures);
      Logger.log("Tenures updated successfully.");
    } else {
      Logger.log("No tenure updates needed.");
    }
    
  } catch (error) {
    Logger.log("Error in updateTenureMonthly: " + error.message);
  }
}

/**
 * Hàm đăng ký tự động trigger chạy 1 tháng 1 lần vào ngày 1 hàng tháng lúc 1 giờ sáng
 */
function installMonthlyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'updateTenureMonthly') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger('updateTenureMonthly')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();
  
  SpreadsheetApp.getUi().alert("✅ Đăng ký trigger cập nhật thâm niên hàng tháng thành công!");
}

