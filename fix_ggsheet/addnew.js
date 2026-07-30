function addNewStaff() {
    SpreadsheetApp.flush(); // Ép hệ thống lưu tick checkbox trước khi xử lý
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);

    if (!sheet) {
        SpreadsheetApp.getUi().alert(`❌ Không tìm thấy sheet "${CONFIG.STAFF_INFO_SHEET_NAME}".`);
        return;
    }

    // LẤY DANH SÁCH DÒNG CẦN THÊM TỪ CHECKBOX (Cột O = 15)
    const CHECKBOX_COL = CONFIG.CHECKBOX_COL;
    const DATA_START = CONFIG.DATA_START_ROW;
    const lastSheetRow = sheet.getLastRow();

    let selectedRows = [];
    let checkboxRange = null;

    if (lastSheetRow >= DATA_START) {
        checkboxRange = sheet.getRange(DATA_START, CHECKBOX_COL, lastSheetRow - DATA_START + 1, 1);
        const checkboxValues = checkboxRange.getValues();

        for (let i = 0; i < checkboxValues.length; i++) {
            const val = checkboxValues[i][0];
            if (val === true || val === "TRUE" || val === "true" || val == true) {
                selectedRows.push(i + DATA_START);
            }
        }
    }

    // Nếu không tick checkbox, dự phòng bằng cách kiểm tra xem có đang bấm vào dòng nào không
    if (selectedRows.length === 0) {
        const activeRow = sheet.getActiveCell().getRow();
        if (activeRow >= DATA_START) {
            selectedRows.push(activeRow);
        } else {
            SpreadsheetApp.getUi().alert("⚠️ Hãy tích chọn (☑️) vào ô Checkbox (cột O) \nhoặc bấm vào dòng của các nhân viên mới cần thêm!");
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

        // Đọc dữ liệu từ cột mới của StaffInformation
        const newName  = sheet.getRange(activeRow, CONFIG.COLS.NAME).getValue().toString().trim();        // Cột B
        const position = sheet.getRange(activeRow, CONFIG.COLS.POSITION).getValue().toString().trim();    // Cột D
        const division = sheet.getRange(activeRow, CONFIG.COLS.DIVISION).getValue().toString().trim();    // Cột J
        const gender   = sheet.getRange(activeRow, CONFIG.COLS.GENDER).getValue().toString().trim();      // Cột K
        const joinDate = sheet.getRange(activeRow, CONFIG.COLS.DATE_ENTERED).getValue();                  // Cột N
        const birthDate = sheet.getRange(activeRow, CONFIG.COLS.DOB).getValue();                          // Cột F

        // Suy company từ division
        const company = getCompanyFromDivision(division);

        // Dept dùng trong ID = division (phòng ban số)
        const dept = division;

        if (!newName || !position || !division) {
            globalLogMsg.push(`❌ Dòng ${activeRow}: Thiếu thông tin (Tên/Chức vụ/Division). BỎ QUA.`);
            continue;
        }

        const posCode = CONFIG.POS_MAP[position.toUpperCase()] || "UNK";
        const prefix = `${company.toUpperCase()}.${dept}.${posCode}.`; // VD: VPA.600.STF.

        // Đọc lại dữ liệu ID mới nhất từ sheet để tránh cấp trùng ID
        const currentLastRow = sheet.getLastRow();
        const idValues = sheet.getRange(DATA_START, CONFIG.COLS.ID, currentLastRow - DATA_START + 1, 1).getValues();

        let maxNum = 0;
        for (let i = 0; i < idValues.length; i++) {
            let idVal = idValues[i][0].toString().trim();
            if (idVal.startsWith(prefix)) {
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

        // Ghi Staff ID vào cột A
        sheet.getRange(activeRow, CONFIG.COLS.ID).setValue(newId);

        // Tự tạo NickName và ghi vào cột C
        const generatedNickName = getEmployeeNickname(newName, dept, position);
        sheet.getRange(activeRow, CONFIG.COLS.NICKNAME).setValue(generatedNickName);

        // Tính và ghi Tenure vào cột G
        const tenure = calculateTenure(joinDate);
        sheet.getRange(activeRow, CONFIG.COLS.TENURE).setValue(tenure);

        SpreadsheetApp.flush(); // Ép lưu ID ngay lập tức

        let logMsgForUser = `👤 HỌ TÊN: ${newName} (Division: ${division} / Công ty: ${company})\n   • Mã ID cấp mới: [${newId}]`;

        // ---------------- BẮN SANG SHEET WORKING TIME ----------------
        try {
            if (!ssTarget) throw new Error("Không mở được file Working Time.");
            const targetSheet = ssTarget.getSheetByName("test2");
            if (!targetSheet) throw new Error("Không tìm thấy sheet 'test2'.");

            const trLastRow = targetSheet.getLastRow();
            let writeRow = trLastRow + 1;
            let needToInsertRow = false;

            if (trLastRow >= 3) {
                const deptValuesTarget = targetSheet.getRange(3, 7, trLastRow - 2, 1).getValues();
                const targetDeptStr = "Bộ phận: " + company.toUpperCase();
                let lastCompanyRow = -1;
                let foundCompany = false;

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

            // Copy Format từ dòng trước đó
            if (writeRow > 1) {
                const numCols = targetSheet.getMaxColumns();
                const sourceRange = targetSheet.getRange(writeRow - 1, 1, 1, numCols);
                const targetRange = targetSheet.getRange(writeRow, 1, 1, numCols);
                sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
                sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
            }

            // Đếm STT tự động
            let noVal = 1;
            if (writeRow > 3) {
                SpreadsheetApp.flush();
                let prevDept = targetSheet.getRange(writeRow - 1, 7).getValue().toString().trim();
                if (prevDept === "Bộ phận: " + company.toUpperCase()) {
                    let prevNo = targetSheet.getRange(writeRow - 1, 1).getValue();
                    if (!isNaN(prevNo) && prevNo !== "") {
                        noVal = Number(prevNo) + 1;
                    }
                }
            }

            // Ghi dữ liệu vào Working Time
            targetSheet.getRange(writeRow, 1).setValue(noVal);
            targetSheet.getRange(writeRow, 2).setValue(newName);
            targetSheet.getRange(writeRow, 3).setValue(gender);
            targetSheet.getRange(writeRow, 4).setValue(0);
            targetSheet.getRange(writeRow, 5).setValue("8:00");
            const noteValue = position.toUpperCase() === "INTERN" ? "Intern" : "";
            targetSheet.getRange(writeRow, 6).setValue(noteValue);
            targetSheet.getRange(writeRow, 7).setValue("Bộ phận: " + company.toUpperCase());
            targetSheet.getRange(writeRow, 8).setValue(noVal);

            // Xử lý riêng "000-200": Working Time chỉ in '200'
            let displayDept = dept === '000-200' ? '200' : dept;
            targetSheet.getRange(writeRow, 9).setValue(displayDept);
            targetSheet.getRange(writeRow, 10).setValue(newId);

            logMsgForUser += `\n   • Working Time: ✅ Đã chèn thành công (Dòng ${writeRow})`;

            reorderWorkingTimeSTT_(ssTarget);
        } catch (e) {
            logMsgForUser += `\n   • Working Time: ❌ Thất bại (${e.message})`;
        }

        // ---------------- BẮN SANG FILE HOLIDAY BONUS ----------------
        try {
            let bonusLog = addToHolidayBonus(newId, newName, company, position, joinDate, birthDate);
            logMsgForUser += `\n   • Thưởng Lễ: ${bonusLog.trim()}`;
        } catch (e) {
            logMsgForUser += `\n   • Thưởng Lễ: ❌ Thất bại (${e.message})`;
        }

        SpreadsheetApp.flush();
        globalLogMsg.push(logMsgForUser);
    } // Hết vòng lặp

    // Gỡ tick toàn bộ sau khi đã chạy xong
    if (checkboxRange && selectedRows.length > 0) {
        checkboxRange.uncheck();
    }

    SpreadsheetApp.getUi().alert("--- KẾT QUẢ THÊM NHÂN SỰ CHI TIẾT ---\n\n" + globalLogMsg.join("\n\n---------------------------------------\n\n"));
}

// ==============================================================================
// LOGIC THÊM NHÂN SỰ VÀO FILE THƯỞNG LỄ (HOLIDAY BONUS)
// ==============================================================================
function addToHolidayBonus(id, name, company, position, joinDateObj, birthDateObj) {
    let log = "";
    const targetSS = SpreadsheetApp.openById(CONFIG.FILES.HOLIDAY_BONUS);
    if (!targetSS) return "\n❌ Không tìm thấy file Holiday Bonus.";

    // 1. Phân loại Hợp Đồng
    const posUpper = String(position || "").toUpperCase().trim();
    let contractType = "";

    if (posUpper === "STAFF") {
        if (joinDateObj && joinDateObj instanceof Date) {
            const today = new Date();
            const msPerDay = 1000 * 60 * 60 * 24;
            const diffDays = (today.getTime() - joinDateObj.getTime()) / msPerDay;

            if (diffDays < 60) {
                contractType = "Thử Việc";
            } else if (diffDays <= 365) {
                contractType = "Chính thức dưới 1 năm";
            } else {
                contractType = "Chính thức trên 1 năm";
            }
        } else {
            contractType = "Chính thức dưới 1 năm";
        }
    } else {
        contractType = CONFIG.CONTRACT_MAP[posUpper] || "";
    }

    if (!contractType) {
        contractType = "Thử Việc";
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

    // 2. Định nghĩa mức thưởng cho từng sheet
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
            "Chính thức": 500000,
            "Thử Việc": 300000,
            "Thực Tập": 0
        }
    };

    const sheetsToUpdate = ["New Year Eve", "2/9", "Labour Day", "Sinh nhật"];
    let successCount = 0;

    sheetsToUpdate.forEach(sheetName => {
        const targetSheet = targetSS.getSheetByName(sheetName);
        if (!targetSheet) return;

        let actualContractType = contractType;
        if (sheetName === "Sinh nhật") {
            if (actualContractType && actualContractType.includes("Chính thức")) {
                actualContractType = "Chính thức";
            }
        }

        const bonusAmount = bonusRules[sheetName][actualContractType] || 0;

        const trLastRow = targetSheet.getLastRow();
        let writeRow = trLastRow + 1;
        let needToInsertRow = false;
        const idCol = sheetName === "Sinh nhật" ? 9 : 6;

        if (trLastRow >= 2) {
            const idValues = targetSheet.getRange(2, idCol, trLastRow - 1, 1).getValues();
            let lastIdRow = -1;

            for (let i = 0; i < idValues.length; i++) {
                const idVal = idValues[i][0].toString().trim();
                if (idVal !== "") {
                    lastIdRow = i + 2;
                }
            }

            if (lastIdRow !== -1) {
                writeRow = lastIdRow;
                needToInsertRow = true;
            }
        }

        if (needToInsertRow) {
            targetSheet.insertRowAfter(writeRow - 1);
        }

        if (writeRow > 2) {
            const numCols = sheetName === "Sinh nhật" ? 9 : 6;
            const sourceRange = targetSheet.getRange(writeRow - 1, 1, 1, numCols);
            const targetRange = targetSheet.getRange(writeRow, 1, 1, numCols);
            sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
            sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
            sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
        }

        let joinDateStr = "";
        if (joinDateObj && joinDateObj instanceof Date) {
            let d = joinDateObj.getDate().toString().padStart(2, '0');
            let m = (joinDateObj.getMonth() + 1).toString().padStart(2, '0');
            let y = joinDateObj.getFullYear();
            joinDateStr = `${d}/${m}/${y}`;
        }

        let formattedBonus = bonusAmount.toLocaleString('vi-VN').replace(/,/g, '.');
        if (sheetName === "Sinh nhật" && actualContractType === "Thực Tập") {
            formattedBonus = "1 tràng vỗ tay";
        }

        if (sheetName === "Sinh nhật") {
            const birthParts = extractBirthPartsForBirthday_(birthDateObj);
            targetSheet.getRange(writeRow, 1).setValue(name);
            targetSheet.getRange(writeRow, 2).setValue(company);
            targetSheet.getRange(writeRow, 3).setValue(birthParts.day);
            targetSheet.getRange(writeRow, 4).setValue(birthParts.month);
            targetSheet.getRange(writeRow, 5).setValue(birthParts.year);
            targetSheet.getRange(writeRow, 6).setValue(actualContractType);
            targetSheet.getRange(writeRow, 7).setValue(joinDateStr);
            targetSheet.getRange(writeRow, 8).setValue(formattedBonus);
            targetSheet.getRange(writeRow, 9).setValue(id);
        } else {
            targetSheet.getRange(writeRow, 1).setValue(name);
            targetSheet.getRange(writeRow, 2).setValue(company);
            targetSheet.getRange(writeRow, 3).setValue(actualContractType);
            targetSheet.getRange(writeRow, 4).setValue(joinDateStr);
            targetSheet.getRange(writeRow, 5).setValue(formattedBonus);
            targetSheet.getRange(writeRow, 6).setValue(id);
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
// ==============================================================================

/**
 * Hàm nội bộ — nhận Spreadsheet object đã mở sẵn.
 * @param {Spreadsheet} ss - Spreadsheet object của file Working Time
 */
function reorderWorkingTimeSTT_(ss) {
    const sheet = ss.getSheetByName("test2");
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return;

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
