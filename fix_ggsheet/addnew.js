function addNewStaff() {
    SpreadsheetApp.flush(); // Ép hệ thống lưu tick checkbox trước khi xử lý
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("staff info");

    // LẤY DANH SÁCH DÒNG CẦN THÊM TỪ CHECKBOX
    const CHECKBOX_COL = 14;
    const lastSheetRow = sheet.getLastRow();

    let selectedRows = [];
    let checkboxRange = null;

    if (lastSheetRow >= 3) {
        checkboxRange = sheet.getRange(3, CHECKBOX_COL, lastSheetRow - 2, 1);
        const checkboxValues = checkboxRange.getValues();

        for (let i = 0; i < checkboxValues.length; i++) {
            const val = checkboxValues[i][0];
            if (val === true || val === "TRUE" || val === "true" || val == true) {
                selectedRows.push(i + 3); // Dòng dữ liệu bắt đầu từ 3
            }
        }
    }

    // Nếu không tick checkbox, dự phòng bằng cách kiểm tra xem có đang bấm vào dòng nào không
    if (selectedRows.length === 0) {
        const activeRow = sheet.getActiveCell().getRow();
        if (activeRow >= 3) {
            selectedRows.push(activeRow);
        } else {
            SpreadsheetApp.getUi().alert("⚠️ Hãy tích chọn (☑️) vào ô Checkbox (cột N) \nhoặc bấm vào dòng của các nhân viên mới cần thêm!");
            return;
        }
    }

    let globalLogMsg = [];
    let ssTarget = null;

    try {
        ssTarget = SpreadsheetApp.openById(CONFIG.FILES.TIMESTAMP);
    } catch (e) { }

    // LẶP QUA TẤT CẢ CÁC DÒNG ĐƯỢC CHỌN VÀ THÊM TỪNG NGƯỜI
    for (let r = 0; r < selectedRows.length; r++) {
        const activeRow = selectedRows[r];

        const currentId = sheet.getRange(activeRow, CONFIG.COLS.ID).getValue();
        if (currentId && currentId !== "") {
            globalLogMsg.push(`⚠️ Dòng ${activeRow}: Đã có ID [${currentId}]. BỎ QUA.`);
            continue;
        }

        const company = sheet.getRange(activeRow, CONFIG.COLS.COMPANY).getValue().toString().trim();
        const dept = sheet.getRange(activeRow, CONFIG.COLS.DEPT).getValue().toString().trim();
        const position = sheet.getRange(activeRow, CONFIG.COLS.POSITION).getValue().toString().trim();
        const newName = sheet.getRange(activeRow, CONFIG.COLS.NAME).getValue().toString().trim();
        const gender = sheet.getRange(activeRow, CONFIG.COLS.GENDER).getValue().toString().trim();

        if (!company || !dept || !position || !newName) {
            globalLogMsg.push(`❌ Dòng ${activeRow}: Thiếu thông tin (Tên/Công ty/Phòng ban/Chức vụ). BỎ QUA.`);
            continue;
        }

        const posCode = CONFIG.POS_MAP[position.toUpperCase()] || "UNK"; // UNK nếu gõ sai chức vụ
        const prefix = `${company.toUpperCase()}.${dept}.${posCode}.`; // VD: VPA.600.STF.

        // 3. Đọc lại dữ liệu ID mới nhất từ file gốc ở mỗi chu kỳ để tránh cấp trùng ID khi thêm 2 người cùng phòng ban
        const currentLastRow = sheet.getLastRow();
        const idValues = sheet.getRange(3, CONFIG.COLS.ID, currentLastRow - 2, 1).getValues();

        let maxNum = 0;
        for (let i = 0; i < idValues.length; i++) {
            let idVal = idValues[i][0].toString().trim();
            if (idVal.startsWith(prefix)) {
                // Cắt lấy phần số cuối
                let parts = idVal.split('.');
                let lastPart = parts[parts.length - 1];
                let num = parseInt(lastPart, 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        }

        // Tạo số mới cho ID
        maxNum++;
        const newNumStr = maxNum < 10 ? "0" + maxNum : maxNum.toString();
        const newId = prefix + newNumStr;

        sheet.getRange(activeRow, CONFIG.COLS.ID).setValue(newId);
        SpreadsheetApp.flush(); // Ép lưu ID ngay lập tức để người tiếp theo lấy đúng maxNum

        let logMsgForUser = `👤 HỌ TÊN: ${newName} (Phòng: ${dept})\n   • Mã ID cấp mới: [${newId}]`;

        // ---------------- BẮN SANG SHEET WORKING TIME ----------------
        try {
            if (!ssTarget) throw new Error("Không mở được file Working Time.");
            const targetSheet = ssTarget.getSheetByName("test2");
            if (!targetSheet) throw new Error("Không tìm thấy sheet 'test2'.");

            const trLastRow = targetSheet.getLastRow();
            let writeRow = trLastRow + 1; // Ghi vào cuối nếu không tìm thấy khối công ty
            let needToInsertRow = false;

            if (trLastRow >= 3) {
                const deptValuesTarget = targetSheet.getRange(3, 7, trLastRow - 2, 1).getValues();
                const targetDeptStr = "Bộ phận: " + company.toUpperCase();
                let lastCompanyRow = -1;
                let foundCompany = false;

                // Tìm dòng cuối cùng của Công ty (Bộ phận)
                for (let i = 0; i < deptValuesTarget.length; i++) {
                    const currentDept = deptValuesTarget[i][0].toString().trim();
                    if (currentDept === targetDeptStr) {
                        lastCompanyRow = i + 3;
                        foundCompany = true;
                    } else if (foundCompany && currentDept.startsWith("Bộ phận:")) {
                        break;
                    }
                }

                if (lastCompanyRow !== -1) {
                    writeRow = lastCompanyRow + 1;
                    needToInsertRow = true;
                }
            }

            if (needToInsertRow) {
                targetSheet.insertRowAfter(writeRow - 1);
            }

            // Copy Format từ dòng trước đó xướng
            if (writeRow > 1) {
                const numCols = targetSheet.getMaxColumns();
                const sourceRange = targetSheet.getRange(writeRow - 1, 1, 1, numCols);
                const targetRange = targetSheet.getRange(writeRow, 1, 1, numCols);

                sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
                sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
            }

            // Đếm STT tự động nếu nằm trong cùng khối
            let noVal = 1;
            if (writeRow > 3) {
                SpreadsheetApp.flush(); // Cập nhật sheet để đọc dòng vừa insert chuẩn xác
                let prevDept = targetSheet.getRange(writeRow - 1, 7).getValue().toString().trim();
                if (prevDept === "Bộ phận: " + company.toUpperCase()) {
                    let prevNo = targetSheet.getRange(writeRow - 1, 1).getValue();
                    if (!isNaN(prevNo) && prevNo !== "") {
                        noVal = Number(prevNo) + 1;
                    }
                }
            }

            // Ghi dữ liệu
            targetSheet.getRange(writeRow, 1).setValue(noVal);
            targetSheet.getRange(writeRow, 2).setValue(newName);
            targetSheet.getRange(writeRow, 3).setValue(gender);
            targetSheet.getRange(writeRow, 4).setValue(0);        
            targetSheet.getRange(writeRow, 5).setValue("8:00");  
            const noteValue = position.toUpperCase() === "INTERN" ? "Intern" : "";
            targetSheet.getRange(writeRow, 6).setValue(noteValue);
            targetSheet.getRange(writeRow, 7).setValue("Bộ phận: " + company.toUpperCase());
            targetSheet.getRange(writeRow, 8).setValue(noVal);
            
            // Xử lý riêng cho "000-200" chỉ khi in ra Working Time
            let displayDept = dept === '000-200' ? '200' : dept;
            targetSheet.getRange(writeRow, 9).setValue(displayDept);
            
            targetSheet.getRange(writeRow, 10).setValue(newId);

            logMsgForUser += `\n   • Working Time: ✅ Đã chèn thành công (Dòng ${writeRow})`;

            // Tự động sắp xếp lại STT sau khi chèn
            reorderWorkingTimeSTT_(ssTarget);
        } catch (e) {
            logMsgForUser += `\n   • Working Time: ❌ Thất bại (${e.message})`;
        }

        // ---------------- BẮN SANG FILE HOLIDAY BONUS ----------------
        try {
            const joinDate = sheet.getRange(activeRow, CONFIG.COLS.DATE_ENTERED || 12).getValue();
            const birthDate = sheet.getRange(activeRow, CONFIG.COLS.BIRTH || 11).getValue();
            let bonusLog = addToHolidayBonus(newId, newName, company, position, joinDate, birthDate);
            logMsgForUser += `\n   • Thưởng Lễ: ${bonusLog.trim()}`;
        } catch (e) {
            logMsgForUser += `\n   • Thưởng Lễ: ❌ Thất bại (${e.message})`;
        }

        SpreadsheetApp.flush(); // Lưu hoàn toàn mọi insert của người này để tránh chồng chéo người sau
        globalLogMsg.push(logMsgForUser);
    } // Hết vòng lặp

    // Gỡ tick toàn bộ sau khi đã chạy xong
    if (checkboxRange && selectedRows.length > 0) {
        checkboxRange.uncheck();
    }

    // Đánh lại cột STT (1, 2, 3...) cho toàn bộ Staff Info
    reindexSTT(sheet);

    SpreadsheetApp.getUi().alert("--- KẾT QUẢ THÊM NHÂN SỰ CHI TIẾT ---\n\n" + globalLogMsg.join("\n\n---------------------------------------\n\n"));
}

// ==============================================================================
// LOGIC THÊM NHÂN SỰ VÀO FILE THƯỞNG LỄ (HOLIDAY BONUS)
// ==============================================================================
function addToHolidayBonus(id, name, company, position, joinDateObj, birthDateObj) {
    let log = "";
    const targetSS = SpreadsheetApp.openById(CONFIG.FILES.HOLIDAY_BONUS);
    if (!targetSS) return "\n❌ Không tìm thấy file Holiday Bonus.";

    // 1. Phân loại Hợp Đồng:
    // - Ưu tiên mapping theo CONFIG.CONTRACT_MAP
    // - Nếu không có trong config thì fallback theo ngày vào
    const posUpper = String(position || "").toUpperCase().trim();
    let contractType = CONFIG.CONTRACT_MAP[posUpper] || "";

    if (!contractType) {
        contractType = "Thử Việc"; // Mặc định fallback
        const isIntern = posUpper.includes("INTERN") || posUpper.includes("THỰC TẬP");

        if (isIntern) {
            contractType = "Thực Tập";
        } else if (joinDateObj && joinDateObj instanceof Date) {
            const today = new Date();
            const msPerDay = 1000 * 60 * 60 * 24;
            const diffDays = (today.getTime() - joinDateObj.getTime()) / msPerDay;

            if (diffDays <= 60) {
                contractType = "Thử Việc";
            } else if (diffDays <= 365) {
                contractType = "Chính thức dưới 1 năm";
            } else {
                contractType = "Chính thức trên 1 năm";
            }
        }
    }

    // 2. Định nghĩa mức thưởng cho từng sheet theo Loại Hợp Đồng
    // Format: "Tên Sheet": { "Loại HĐ": Số_tiền }
    const bonusRules = {
        "New Year Eve": {
            "Chính thức trên 1 năm": 700000,
            "Chính thức dưới 1 năm": 500000,
            "Thử Việc": 300000,
            "Thực Tập": 300000
        },
        "2/9": {
            "Chính thức trên 1 năm": 500000,
            "Chính thức dưới 1 năm": 300000,
            "Thử Việc": 200000,
            "Thực Tập": 200000
        },
        "Labour Day": {
            "Chính thức trên 1 năm": 500000,
            "Chính thức dưới 1 năm": 300000,
            "Thử Việc": 200000,
            "Thực Tập": 200000
        },
        "Sinh nhật": {
            "Chính thức trên 1 năm": 500000,
            "Chính thức dưới 1 năm": 500000,
            "Thử Việc": 300000,
            "Thực Tập": 300000
        }
    };

    const sheetsToUpdate = ["New Year Eve", "2/9", "Labour Day", "Sinh nhật"];
    let successCount = 0;

    // 3. Xử lý từng sheet
    sheetsToUpdate.forEach(sheetName => {
        const targetSheet = targetSS.getSheetByName(sheetName);
        if (!targetSheet) return;

        const bonusAmount = bonusRules[sheetName][contractType] || 0;

        // --- LOGIC TÌM DÒNG CUỐI CÙNG CÓ ID (CỘT F) VÀ CHÈN LÊN TRÊN ---
        const trLastRow = targetSheet.getLastRow();
        let writeRow = trLastRow + 1; // Mặc định chèn dưới cùng
        let needToInsertRow = false;
        const idCol = sheetName === "Sinh nhật" ? 9 : 6;

        if (trLastRow >= 2) {
            // Đọc toàn bộ cột ID để tìm dòng cuối cùng có ID
            const idValues = targetSheet.getRange(2, idCol, trLastRow - 1, 1).getValues();
            let lastIdRow = -1;

            for (let i = 0; i < idValues.length; i++) {
                const idVal = idValues[i][0].toString().trim();
                if (idVal !== "") {
                    lastIdRow = i + 2; // +2 vì mảng bắt đầu từ dòng 2
                }
            }

            if (lastIdRow !== -1) {
                writeRow = lastIdRow; // Chèn lên trên người cuối cùng có ID
                needToInsertRow = true;
            }
        }

        // Chèn dòng nếu đứng giữa bảng
        if (needToInsertRow) {
            targetSheet.insertRowAfter(writeRow - 1);
        }

        // --- COPY FORMAT & DROPDOWN ---
        if (writeRow > 2) { // Dòng 1 thường là Header
            const numCols = sheetName === "Sinh nhật" ? 9 : 6; // Sinh nhật dùng A->I
            const sourceRange = targetSheet.getRange(writeRow - 1, 1, 1, numCols);
            const targetRange = targetSheet.getRange(writeRow, 1, 1, numCols);

            sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
            sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
            sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
        }

        // Format lại ngày tháng để chèn vào (nếu có ngày)
        let joinDateStr = "";
        if (joinDateObj && joinDateObj instanceof Date) {
            // VD: 10/01/2022
            let d = joinDateObj.getDate().toString().padStart(2, '0');
            let m = (joinDateObj.getMonth() + 1).toString().padStart(2, '0');
            let y = joinDateObj.getFullYear();
            joinDateStr = `${d}/${m}/${y}`;
        }

        // Format tiền có dấu chấm phân cách hàng nghìn VD: 700.000
        let formattedBonus = bonusAmount.toLocaleString('vi-VN').replace(/,/g, '.');

        if (sheetName === "Sinh nhật") {
            const birthParts = extractBirthPartsForBirthday_(birthDateObj);
            // Bố cục sinh nhật:
            // A Tên | B Công ty | C Ngày | D Tháng | E Năm | F Hợp đồng | G Ngày vào | H Thưởng | I ID
            targetSheet.getRange(writeRow, 1).setValue(name);                  // A
            targetSheet.getRange(writeRow, 2).setValue(company);               // B
            targetSheet.getRange(writeRow, 3).setValue(birthParts.day);        // C
            targetSheet.getRange(writeRow, 4).setValue(birthParts.month);      // D
            targetSheet.getRange(writeRow, 5).setValue(birthParts.year);       // E
            targetSheet.getRange(writeRow, 6).setValue(contractType);          // F
            targetSheet.getRange(writeRow, 7).setValue(joinDateStr);           // G
            targetSheet.getRange(writeRow, 8).setValue(formattedBonus);        // H
            targetSheet.getRange(writeRow, 9).setValue(id);                    // I
        } else {
            // ĐIỀN THÔNG TIN: TÊN (A) | CÔNG TY (B) | HỢP ĐỒNG (C) | NGÀY VÀO CTY (D) | THƯỞNG (E) | ID (F)
            targetSheet.getRange(writeRow, 1).setValue(name);           // A
            targetSheet.getRange(writeRow, 2).setValue(company);        // B
            targetSheet.getRange(writeRow, 3).setValue(contractType);   // C
            targetSheet.getRange(writeRow, 4).setValue(joinDateStr);    // D
            targetSheet.getRange(writeRow, 5).setValue(formattedBonus); // E
            targetSheet.getRange(writeRow, 6).setValue(id);             // F
        }

        successCount++;
    });

    if (successCount > 0) {
        log += `✅ Cập nhật thành công ${successCount} sheet (Hợp đồng mức: ${contractType})`;
    } else {
        log += `⚠️ Không có sheet nào được cập nhật.`;
    }

    return log;
}

function extractBirthPartsForBirthday_(birthValue) {
    if (birthValue instanceof Date && !isNaN(birthValue.getTime())) {
        return {
            day: birthValue.getDate(),
            month: birthValue.getMonth() + 1,
            year: birthValue.getFullYear()
        };
    }

    const text = String(birthValue || "").trim();
    if (!text) return { day: "", month: "", year: "" };

    const parts = text.split(/[\/\-\.]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
        const day = Number(parts[0]);
        const month = Number(parts[1]);
        const year = Number(parts[2]);
        return {
            day: isNaN(day) ? parts[0] : day,
            month: isNaN(month) ? parts[1] : month,
            year: isNaN(year) ? parts[2] : year
        };
    }

    return { day: "", month: "", year: "" };
}

// ==============================================================================
// HÀM SẮP XẾP LẠI STT TRÊN SHEET WORKING TIME
// Đánh số từ 1 cho mỗi nhóm công ty, khi sang công ty mới reset về 1
// ==============================================================================

/**
 * Hàm nội bộ — nhận Spreadsheet object đã mở sẵn (dùng trong add/delete).
 * @param {Spreadsheet} ss - Spreadsheet object của file Working Time
 */
function reorderWorkingTimeSTT_(ss) {
    const sheet = ss.getSheetByName("test2");
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return;

    // Đọc cột 7 (Bộ phận) từ dòng 3 trở đi
    const deptValues = sheet.getRange(3, 7, lastRow - 2, 1).getValues();

    const newCol1 = [];
    const newCol8 = [];
    let currentCompany = "";
    let counter = 0;

    for (let i = 0; i < deptValues.length; i++) {
        const dept = deptValues[i][0].toString().trim();

        if (!dept || !dept.startsWith("Bộ phận:")) {
            newCol1.push([""]);
            newCol8.push([""]);
            continue;
        }

        if (dept !== currentCompany) {
            currentCompany = dept;
            counter = 1;
        } else {
            counter++;
        }

        newCol1.push([counter]);
        newCol8.push([counter]);
    }

    sheet.getRange(3, 1, newCol1.length, 1).setValues(newCol1);
    sheet.getRange(3, 8, newCol8.length, 1).setValues(newCol8);
}

/**
 * Hàm gọi từ menu — tự mở file Working Time rồi chạy sắp xếp.
 */
function reorderWorkingTimeSTT() {
    const ss = SpreadsheetApp.openById(CONFIG.FILES.TIMESTAMP);
    if (!ss) {
        SpreadsheetApp.getUi().alert("❌ Không mở được file Working Time.");
        return;
    }

    reorderWorkingTimeSTT_(ss);

    SpreadsheetApp.getUi().alert(
        "✅ SẮP XẾP STT HOÀN TẤT\n\n" +
        "Đã đánh lại STT trên sheet Working Time.\n" +
        "Mỗi nhóm công ty được đánh số từ 1."
    );
}

