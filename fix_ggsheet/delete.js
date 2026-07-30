/**
 * XÓA NHÂN VIÊN - Cascade Delete (Hỗ trợ xóa nhiều người cùng lúc bằng Checkbox)
 * Khi xóa nhân viên ở file chính (Staff Info), hệ thống sẽ tự động
 * xóa dữ liệu liên quan ở các file:
 *   1. Staff Info (file chính) — xóa hẳn dòng
 *   2. Working Time (Timestamp) — tìm theo ID, xóa dòng
 *   3. Holiday Bonus (3 sheet) — tìm theo ID, xóa dòng
 *
 * Sau khi xóa xong → tự động đánh lại STT (1, 2, 3...) trong Staff Info.
 */

function deleteStaff() {
    SpreadsheetApp.flush();
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);

    if (!sheet) {
        ui.alert(`❌ Không tìm thấy sheet "${CONFIG.STAFF_INFO_SHEET_NAME}".`);
        return;
    }

    // 1. LẤY DANH SÁCH DÒNG CẦN XÓA TỪ CHECKBOX (Cột O = 15)
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

    // Fallback: nếu không tick checkbox → lấy dòng đang click
    if (selectedRows.length === 0) {
        const activeRow = sheet.getActiveCell().getRow();
        if (activeRow >= DATA_START) {
            selectedRows.push(activeRow);
        } else {
            ui.alert("⚠️ Hãy tích chọn (☑️) vào ô Checkbox (cột O)\nhoặc bấm vào dòng của nhân viên cần xóa!");
            return;
        }
    }


    // 2. THU THẬP THÔNG TIN CỦA NHỮNG NGƯỜI SẼ BỊ XÓA
    let peopleToDelete = [];
    for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        const id = sheet.getRange(row, CONFIG.COLS.ID).getValue().toString().trim();
        const name = sheet.getRange(row, CONFIG.COLS.NAME).getValue().toString().trim();

        if (!id || id === "") {
            // Không có ID → vẫn xóa dòng nhưng không thể cascade sang file khác
            peopleToDelete.push({ row: row, id: "", name: name || "(Trống)", hasId: false });
        } else {
            peopleToDelete.push({ row: row, id: id, name: name, hasId: true });
        }
    }

    // 3. XÁC NHẬN TRƯỚC KHI XÓA
    let nameList = peopleToDelete.map((p, idx) => `  ${idx + 1}. 👤 ${p.name} [${p.id || "Chưa có ID"}]`).join("\n");

    const confirm = ui.alert(
        "⚠️ XÁC NHẬN XÓA NHÂN VIÊN",
        `Bạn có chắc muốn XÓA VĨNH VIỄN ${peopleToDelete.length} nhân viên:\n\n` +
        `${nameList}\n\n` +
        `Hệ thống sẽ xóa dữ liệu khỏi:\n` +
        `  • Staff Info (file chính)\n` +
        `  • Working Time\n` +
        `  • Thưởng Lễ, Sinh nhật\n` +
        `  • Penalty&Bonus\n\n` +
        `⛔ Hành động này KHÔNG THỂ hoàn tác!`,
        ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) {
        if (checkboxRange) checkboxRange.uncheck();
        return;
    }

    ss.toast(`Đang xóa ${peopleToDelete.length} nhân viên... Vui lòng đợi.`, "Hệ thống", 30);

    let globalLogMsg = [];

    // 4. XÓA DỮ LIỆU Ở CÁC FILE VỆ TINH (Working Time + Holiday Bonus)
    for (let i = 0; i < peopleToDelete.length; i++) {
        const person = peopleToDelete[i];
        let logForPerson = `👤 ${person.name}`;

        if (!person.hasId) {
            logForPerson += "\n   • ⚠️ Không có ID — chỉ xóa dòng trong Staff Info.";
            globalLogMsg.push(logForPerson);
            continue;
        }

        logForPerson += ` [${person.id}]`;

        // --- Working Time ---
        try {
            const timestampSS = SpreadsheetApp.openById(CONFIG.FILES.TIMESTAMP);
            const timestampSheet = timestampSS.getSheetByName("test2");

            if (timestampSheet) {
                const deletedCount = deleteRowsById_(timestampSheet, "J", person.id);
                logForPerson += `\n   • Working Time: ✅ Đã xóa ${deletedCount} dòng.`;

                // Tự động sắp xếp lại STT sau khi xóa
                if (deletedCount > 0) {
                    reorderWorkingTimeSTT_(timestampSS);
                }
            } else {
                logForPerson += `\n   • Working Time: ⚠️ Không tìm thấy sheet "test2".`;
            }
        } catch (e) {
            logForPerson += `\n   • Working Time: ❌ Lỗi (${e.message})`;
        }

        // --- Holiday Bonus (3 sheets) ---
        try {
            const holidaySS = SpreadsheetApp.openById(CONFIG.FILES.HOLIDAY_BONUS);
            const sheetNames = ["New Year Eve", "2/9", "Labour Day"];
            let bonusResults = [];

            sheetNames.forEach(sheetName => {
                const targetSheet = holidaySS.getSheetByName(sheetName);
                if (targetSheet) {
                    const deletedCount = deleteRowsById_(targetSheet, "F", person.id);
                    bonusResults.push(`${sheetName}: ${deletedCount}`);
                } else {
                    bonusResults.push(`${sheetName}: ⚠️`);
                }
            });

            logForPerson += `\n   • Thưởng Lễ: ✅ Đã xóa (${bonusResults.join(" | ")})`;

            // --- Sheet Sinh nhật (cùng file Holiday Bonus) ---
            const birthdaySheet =
                holidaySS.getSheetByName("sinh nhật")
                || holidaySS.getSheetByName("Sinh nhật")
                || holidaySS.getSheetByName("Sinh Nhat");

            if (birthdaySheet) {
                // Tìm cột ID từ header row 1 (khớp nhiều tên header phổ biến)
                const headerRow = birthdaySheet.getRange(1, 1, 1, birthdaySheet.getLastColumn()).getValues()[0];
                const idColIndex = headerRow.findIndex(h => {
                    const s = String(h).trim().toUpperCase();
                    return s === "ID" || s === "MÃ" || s === "MÃ NV" || s === "MÃ ID" || s.includes(" ID");
                });

                let bdDeletedCount = 0;

                // Bước 1: thử xóa theo ID trong cột tìm được
                if (idColIndex >= 0) {
                    const idColLetter = columnIndexToLetter_(idColIndex + 1);
                    bdDeletedCount = deleteRowsById_(birthdaySheet, idColLetter, person.id);
                }

                // Bước 2: fallback theo tên nếu chưa xóa được (dòng cũ chưa có ID)
                if (bdDeletedCount === 0) {
                    bdDeletedCount = deleteRowsByName_(birthdaySheet, person.name);
                }

                logForPerson += `\n   • Sinh nhật: ✅ Đã xóa ${bdDeletedCount} dòng.`;
            } else {
                logForPerson += `\n   • Sinh nhật: ⚠️ Không tìm thấy sheet sinh nhật.`;
            }
        } catch (e) {
            logForPerson += `\n   • Thưởng Lễ: ❌ Lỗi (${e.message})`;
        }

        // --- Penalty/Bonus (StaffInformation) --- xóa theo Staff ID (cột A)
        try {
            const pbSS = SpreadsheetApp.getActiveSpreadsheet(); // Đây chính là file đang chạy
            const pbSheet = pbSS.getSheetByName("StaffInformation") || pbSS.getSheetByName("Staff Information");
            if (pbSheet) {
                // Xóa theo Staff ID (cột A) — chính xác hơn xóa theo tên
                const deletedCount = deleteRowsById_(pbSheet, "A", person.id);
                logForPerson += `\n   • Penalty/Bonus: ✅ Đã xóa ${deletedCount} dòng.`;
            } else {
                logForPerson += `\n   • Penalty/Bonus: ⚠️ Không tìm thấy sheet StaffInformation.`;
            }
        } catch (e) {
            logForPerson += `\n   • Penalty/Bonus: ❌ Lỗi (${e.message})`;
        }


        globalLogMsg.push(logForPerson);
    }

    // 5. XÓA DÒNG KHỎI STAFF INFO — XÓA TỪ DƯỚI LÊN (để tránh lệch index)
    const rowsToDelete = peopleToDelete.map(p => p.row).sort((a, b) => b - a);

    let staffInfoDeleteCount = 0;
    rowsToDelete.forEach(row => {
        try {
            sheet.deleteRow(row);
            staffInfoDeleteCount++;
        } catch (e) {
            // Dòng đã bị lệch hoặc lỗi → bỏ qua
        }
    });

    // 6. ĐÁNH LẠI STT SAU KHI XÓA
    reindexSTT(sheet);

    // Gỡ tick
    if (checkboxRange) {
        try { checkboxRange.uncheck(); } catch (e) { /* Range có thể đã thay đổi sau khi xóa dòng */ }
    }

    // 7. HIỂN THỊ KẾT QUẢ
    ui.alert(
        "--- KẾT QUẢ XÓA NHÂN VIÊN CHI TIẾT ---",
        `Đã xóa ${staffInfoDeleteCount}/${peopleToDelete.length} dòng trong Staff Info.\n\n` +
        globalLogMsg.join("\n\n---------------------------------------\n\n"),
        ui.ButtonSet.OK
    );
}


// ==============================================================================
// HÀM TIỆN ÍCH: Tìm và xóa tất cả dòng có ID khớp trong 1 cột nhất định
// ==============================================================================
/**
 * Tìm tất cả ô chứa ID trong cột chỉ định, xóa dòng từ dưới lên.
 * @param {Sheet} sheet - Sheet cần xử lý
 * @param {string} column - Tên cột chứa ID (VD: "J", "F")
 * @param {string} id - Mã ID cần tìm
 * @returns {number} Số dòng đã xóa
 */
function deleteRowsById_(sheet, column, id) {
    const finder = sheet.getRange(`${column}:${column}`)
        .createTextFinder(id)
        .matchEntireCell(true)
        .findAll();

    if (finder.length === 0) return 0;

    // Thu thập số dòng và sắp xếp GIẢM DẦN để xóa từ dưới lên
    // (tránh bị lệch index khi xóa dòng phía trên)
    const rows = finder.map(cell => cell.getRow()).sort((a, b) => b - a);

    rows.forEach(row => {
        sheet.deleteRow(row);
    });

    return rows.length;
}

/**
 * Fallback: tìm theo tên (cột A) và xóa dòng từ dưới lên.
 * Chỉ dùng khi sheet sinh nhật không có cột ID.
 * @param {Sheet} sheet - Sheet cần xử lý
 * @param {string} name - Tên nhân viên cần tìm
 * @returns {number} Số dòng đã xóa
 */
function deleteRowsByName_(sheet, name) {
    if (!name || name.trim() === "") return 0;
    const finder = sheet.getRange("A:A")
        .createTextFinder(name.trim())
        .matchEntireCell(true)
        .findAll();

    if (finder.length === 0) return 0;

    const rows = finder.map(cell => cell.getRow()).sort((a, b) => b - a);
    rows.forEach(row => sheet.deleteRow(row));
    return rows.length;
}

/**
 * Chuyển số cột (1-based) sang chữ cái cột (VD: 1→"A", 27→"AA").
 * @param {number} colIndex - Số thứ tự cột (1-based)
 * @returns {string} Tên cột dạng chữ cái
 */
function columnIndexToLetter_(colIndex) {
    let letter = "";
    while (colIndex > 0) {
        const mod = (colIndex - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        colIndex = Math.floor((colIndex - 1) / 26);
    }
    return letter;
}
