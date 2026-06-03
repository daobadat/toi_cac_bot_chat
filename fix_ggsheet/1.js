// function coreSyncData(peopleToUpdate) {
//     if (!peopleToUpdate || peopleToUpdate.length === 0) return [];

//     // 3. CẤU HÌNH CÁC FILE CẦN CẬP NHẬT
//     const WT = CONFIG.WORKING_TIME_COLS; // Shortcut
//     const UPDATE_TARGETS = [
//         // === TẠM TẮT: File Thưởng Phạt (chưa hoàn thiện giao diện) ===
//         // {
//         //     name: "file thuong phat", fileId: CONFIG.FILES.PENALTY_BONUS, sheetName: "Copy of StaffInformation", isProfileLayout: true,
//         //     mapping: [
//         //         { rOff: 1, cOff: 0, field: "nickName" },
//         //         { rOff: 2, cOff: 0, field: "newName" },
//         //         { rOff: 3, cOff: 0, field: "position" },
//         //         { rOff: 4, cOff: 0, field: "birth" },
//         //     ]
//         // },
//         {
//             name: "file working time", fileId: CONFIG.FILES.TIMESTAMP, sheetName: "test2",
//             idColumn: "J", nameOffset: -8,
//             // Sheet Working Time đang lưu "ID" ở cột J theo STT của "staff info"
//             // (xem ghi chú CONFIG.COLS.STT). Vì vậy phải tìm theo stt thay vì mã tổng hợp ở cột B.
//             searchField: "stt",
//             relocateByCompany: true,   // Bật tính năng dời vùng khi đổi công ty
//             companyCol: WT.COMPANY,     // Cột 7: Bộ phận
//             dataStartRow: 3,           // Dữ liệu bắt đầu từ dòng 3
//             extraUpdates: [
//                 { colOffset: -7, field: "gender" },        // Cột 3: Giới tính
//                 { colOffset: -3, field: "companyLabel" }, // Cột 7: Bộ phận
//                 { colOffset: -1, field: "dept" }            // Cột 9: Phòng ban
//             ]
//         },
//         // === TẠM TẮT: File Sơ đồ tổ chức (không cần đồng bộ tự động) ===
//         // { name: "file so do to chuc", fileId: CONFIG.FILES.ORG_CHART, isReplaceOldName: true },
//         {
//               name: "file thuong le", 
//               fileId: CONFIG.FILES.HOLIDAY_BONUS, 
//               sheetName: ["New Year Eve", "Labour Day", "2/9"], //
              
//               // Đổi mốc truy vấn sang cột F (ID nhân viên) để tránh trùng lặp
//               idColumn: "F", 
//               // Cột F đang là mã tổng hợp dạng VPA.600.STF.05 (lấy từ staff info cột B)
//               searchField: "id",
              
//               nameOffset: -5, // Từ cột F lùi về 5 cột là cột A (Tên)
              
//               extraUpdates: [
//                   { colOffset: -5, field: "newName" },      // Cột A: Tên (F - 5)
//                   { colOffset: -4, field: "company" },   // Cột B: Công ty (F - 4)
//                   { colOffset: -3, field: "contractType" }, // Cột C: Hợp đồng (F - 3)
//                   { colOffset: -2, field: "joinDate" },  // Cột D: Ngày vào (F - 2)
//               ]
//           }

//     ];

//     let logReport = [];

//     // 4. CHẠY VÒNG LẶP CẬP NHẬT GOM NHÓM
//     UPDATE_TARGETS.forEach(target => {
//         try {
//             if (!target.fileId || target.fileId.includes("ID_FILE") || target.fileId === "ĐIỀN_ID_FILE_SƠ_ĐỒ_VÀO_ĐÂY") {
//                 logReport.push(`❌ ${target.name}: Lỗi ID File.`);
//                 return;
//             }

//             const targetSS = SpreadsheetApp.openById(target.fileId);
//             const targetUrl = (() => {
//                 try { return targetSS.getUrl(); } catch (e) { return ""; }
//             })();
//             let sheetsToProcess = [];

//             if (target.sheetName) {
//                 if (Array.isArray(target.sheetName)) {
//                     target.sheetName.forEach(name => {
//                         const s = targetSS.getSheetByName(name);
//                         if (s) sheetsToProcess.push(s);
//                     });
//                 } else {
//                     const s = targetSS.getSheetByName(target.sheetName);
//                     if (s) sheetsToProcess.push(s);
//                 }
//             } else {
//                 sheetsToProcess = targetSS.getSheets();
//             }

//             let fileSuccessCount = 0;
//             let relocatedCount = 0;
//             let hitDetails = [];
//             let skippedDueToFormula = 0;

//             sheetsToProcess.forEach(targetSheet => {
//                 peopleToUpdate.forEach(person => {
//                     if (target.isReplaceOldName) {
//                         if (person.oldName && person.oldName !== "") {
//                             const finder = targetSheet.createTextFinder(person.oldName).matchEntireCell(true).findAll();
//                             finder.forEach(cell => { cell.setValue(person.newName); fileSuccessCount++; });
//                         }
//                     }
//                     else if (target.isProfileLayout) {
//                         const finder = targetSheet.createTextFinder(person.id).matchEntireCell(true).findAll();
//                         finder.forEach(cell => {
//                             try {
//                                 target.mapping.forEach(m => { cell.offset(m.rOff, m.cOff).setValue(person[m.field]); });
//                                 fileSuccessCount++;
//                             } catch (e) { }
//                         });
//                     }
//                     else {
//                         //const finder = targetSheet.getRange(`${target.idColumn}:${target.idColumn}`).createTextFinder(person.id).matchEntireCell(true).findAll();
//                         const searchValueRaw = target.searchField ? person[target.searchField] : person.id;
//                         const searchValue = (searchValueRaw === null || searchValueRaw === undefined) ? "" : String(searchValueRaw).trim();
//                         if (!searchValue) return;
//                         const finder = targetSheet.getRange(`${target.idColumn}:${target.idColumn}`)
//                             .createTextFinder(searchValue)
//                             .matchEntireCell(true).findAll();
//                         finder.forEach(cell => {
//                             const cellRow = cell.getRow();
//                             if (hitDetails.length < 5) {
//                                 hitDetails.push(`${targetSheet.getName()}!${target.idColumn}${cellRow}=${searchValue}`);
//                             }

//                             // ===== KIỂM TRA CÓ CẦN DỜI VÙNG CÔNG TY KHÔNG =====
//                             if (target.relocateByCompany && person.companyLabel) {
//                                 const currentCompany = targetSheet.getRange(cellRow, target.companyCol).getValue().toString().trim();

//                                 if (currentCompany !== person.companyLabel) {
//                                     // --- CÔNG TY ĐÃ THAY ĐỔI → XÓA DÒNG CŨ & CHÈN VÀO ĐÚNG VÙNG MỚI ---

//                                     // Lưu lại dữ liệu cần giữ từ dòng cũ (Detail, Time — các cột không bị thay đổi bởi sync)
//                                     const numCols = targetSheet.getMaxColumns();
//                                     const oldRowData = targetSheet.getRange(cellRow, 1, 1, numCols).getValues()[0];

//                                     // Xóa dòng cũ
//                                     targetSheet.deleteRow(cellRow);
//                                     SpreadsheetApp.flush();

//                                     // Tìm vị trí chèn phù hợp trong vùng công ty mới
//                                     const insertRow = findCompanyInsertRow_(targetSheet, person.companyLabel, target.dataStartRow);

//                                     // Chèn dòng mới
//                                     targetSheet.insertRowAfter(insertRow - 1);

//                                     // Copy format từ dòng trên
//                                     if (insertRow > 1) {
//                                         const srcRange = targetSheet.getRange(insertRow - 1, 1, 1, numCols);
//                                         const dstRange = targetSheet.getRange(insertRow, 1, 1, numCols);
//                                         srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
//                                         srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
//                                         srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
//                                     }

//                                     // Ghi lại dữ liệu: giữ nguyên Detail (cột 4), Time (cột 5) từ dòng cũ
//                                     targetSheet.getRange(insertRow, WT.NAME || 2).setValue(person.newName);
//                                     targetSheet.getRange(insertRow, WT.GENDER || 3).setValue(person.gender || oldRowData[(WT.GENDER || 3) - 1]);
//                                     targetSheet.getRange(insertRow, WT.DETAIL || 4).setValue(oldRowData[(WT.DETAIL || 4) - 1]);   // Giữ Detail
//                                     targetSheet.getRange(insertRow, WT.TIME || 5).setValue(oldRowData[(WT.TIME || 5) - 1]);       // Giữ Time
//                                     targetSheet.getRange(insertRow, WT.NOTE || 6).setValue(oldRowData[(WT.NOTE || 6) - 1]);       // Giữ Note
//                                     targetSheet.getRange(insertRow, WT.COMPANY || 7).setValue(person.companyLabel);
//                                     let displayDept = person.dept || oldRowData[(WT.DEPT || 9) - 1];
//                                     if (displayDept === '000-200') displayDept = '200';
//                                     targetSheet.getRange(insertRow, WT.DEPT || 9).setValue(displayDept);
//                                     targetSheet.getRange(insertRow, WT.ID || 10).setValue(person.id);

//                                     // Tính lại STT trong vùng mới
//                                     const newNo = calcCompanyNoVal_(targetSheet, insertRow, person.companyLabel, target.companyCol);
//                                     targetSheet.getRange(insertRow, WT.NO || 1).setValue(newNo);
//                                     targetSheet.getRange(insertRow, WT.COL8 || 8).setValue(newNo);

//                                     relocatedCount++;
//                                     fileSuccessCount++;
//                                     return; // Đã xử lý xong cho người này, không cần update in-place
//                                 }
//                             }

//                             // ===== CẬP NHẬT TẠI CHỖ (công ty không đổi hoặc không bật relocate) =====
//                             const nameCell = cell.offset(0, target.nameOffset);
//                             const nameFormula = nameCell.getFormula();
//                             if (nameFormula) {
//                                 skippedDueToFormula++;
//                             } else {
//                                 nameCell.setValue(person.newName);
//                             }

//                             // Cập nhật thêm các cột phụ (VD: Gender, Company, Dept, Join Date)
//                             if (target.extraUpdates) {
//                                 target.extraUpdates.forEach(eu => {
//                                     if (person[eu.field] !== undefined && person[eu.field] !== "") {
//                                         let value = person[eu.field];
//                                         // Format ngày tháng nếu là Date object
//                                         if (value instanceof Date) {
//                                             let d = value.getDate().toString().padStart(2, '0');
//                                             let m = (value.getMonth() + 1).toString().padStart(2, '0');
//                                             let y = value.getFullYear();
//                                             value = `${d}/${m}/${y}`;
//                                         }
//                                         // Nếu là trường phòng ban (dept), chỉ in ra '200' thay vì '000-200' để không đổi ID
//                                         if (eu.field === "dept" && value === '000-200') {
//                                             value = '200';
//                                         }
//                                         const dst = cell.offset(0, eu.colOffset);
//                                         const f = dst.getFormula();
//                                         if (f) {
//                                             skippedDueToFormula++;
//                                         } else {
//                                             dst.setValue(value);
//                                         }
//                                     }
//                                 });
//                             }

//                             fileSuccessCount++;
//                         });
//                     }
//                 });
//             });
            

//             let msg = `✅ ${target.name}: Cập nhật thành công (${fileSuccessCount} vị trí)`;
//             if (relocatedCount > 0) {
//                 msg += ` — trong đó ${relocatedCount} người được dời sang vùng công ty mới.`;
//             }
//             if (hitDetails.length > 0) {
//                 msg += `\n   ↳ Match: ${hitDetails.join(", ")}`;
//             }
//             if (skippedDueToFormula > 0) {
//                 msg += `\n   ↳ ⚠️ Bỏ qua ${skippedDueToFormula} ô vì đang có công thức (setValue sẽ bị công thức ghi đè).`;
//             }
//             if (targetUrl) {
//                 msg += `\n   ↳ File: ${targetSS.getName()} (${targetUrl})`;
//             } else {
//                 msg += `\n   ↳ File: ${targetSS.getName()}`;
//             }
//             logReport.push(msg);

//             // Tự động sắp xếp lại STT nếu là file Working Time
//             if (target.relocateByCompany && fileSuccessCount > 0) {
//                 reorderWorkingTimeSTT_(targetSS);
//             }

//         } catch (e) {
//             logReport.push(`❌ ${target.name}: Lỗi kết nối (${e.message})`);
//         }
//     });

//     // Đồng bộ thêm sheet sinh nhật bằng luồng chuyên biệt
//     // để tránh lệch mapping cột so với các sheet lễ thông thường.
//     const birthdayLogs = coreSyncBirthdayOnly(peopleToUpdate);
//     if (birthdayLogs && birthdayLogs.length > 0) {
//         logReport = logReport.concat(birthdayLogs);
//     }

//     return logReport;

// }


// // ==============================================================================
// // HÀM TIỆN ÍCH: Tìm vị trí chèn trong vùng công ty (dùng cho Working Time)
// // ==============================================================================
// /**
//  * Tìm dòng cuối cùng của khối công ty trong sheet Working Time,
//  * trả về vị trí chèn (ngay sau người cuối cùng của khối đó).
//  * Nếu không tìm thấy khối → trả về dòng cuối + 1.
//  *
//  * @param {Sheet} sheet
//  * @param {string} companyLabel - VD: "Bộ phận: ADD"
//  * @param {number} dataStartRow - Dòng bắt đầu dữ liệu (VD: 3)
//  * @returns {number} Dòng để chèn
//  */
// function findCompanyInsertRow_(sheet, companyLabel, dataStartRow) {
//     const lastRow = sheet.getLastRow();
//     if (lastRow < dataStartRow) return lastRow + 1;

//     const companyValues = sheet.getRange(dataStartRow, CONFIG.WORKING_TIME_COLS.COMPANY, lastRow - dataStartRow + 1, 1).getValues();
//     let lastCompanyRow = -1;
//     let foundCompany = false;

//     for (let i = 0; i < companyValues.length; i++) {
//         const val = companyValues[i][0].toString().trim();
//         if (val === companyLabel) {
//             lastCompanyRow = i + dataStartRow;
//             foundCompany = true;
//         } else if (foundCompany && val.startsWith("Bộ phận:")) {
//             break;
//         }
//     }

//     if (lastCompanyRow !== -1) {
//         return lastCompanyRow + 1; // Chèn ngay dưới người cuối cùng của khối
//     }

//     return lastRow + 1; // Không tìm thấy → chèn cuối bảng
// }
// // ============================================================
// // HÀM TIỆN ÍCH: Xác định loại hợp đồng
// // ============================================================
// function getContractType(position, joinDate) {
//     const posUpper = (position || "").toString().toUpperCase();
//     if (posUpper === "INTERN") return "Thực Tập";

//     if (joinDate instanceof Date) {
//         const now = new Date();
//         const months = (now.getFullYear() - joinDate.getFullYear()) * 12
//                      + (now.getMonth() - joinDate.getMonth());
//         if (months < 12) return "Chính thức dưới 1 năm";
//         return "Chính thức trên 1 năm";
//     }
//     return "Chính thức trên 1 năm";
// }

// /**
//  * Tính STT (No.) cho 1 dòng mới trong vùng công ty.
//  * Dò ngược lên từ dòng chèn, nếu dòng trên cùng công ty thì lấy STT + 1.
//  *
//  * @param {Sheet} sheet
//  * @param {number} row - Dòng vừa chèn
//  * @param {string} companyLabel - VD: "Bộ phận: ADD"
//  * @param {number} companyCol - Số cột chứa Bộ phận
//  * @returns {number} Giá trị STT mới
//  */
// function calcCompanyNoVal_(sheet, row, companyLabel, companyCol) {
//     if (row <= 3) return 1;
//     const prevCompany = sheet.getRange(row - 1, companyCol).getValue().toString().trim();
//     if (prevCompany === companyLabel) {
//         const prevNo = sheet.getRange(row - 1, CONFIG.WORKING_TIME_COLS.NO).getValue();
//         if (!isNaN(prevNo) && prevNo !== "") {
//             return Number(prevNo) + 1;
//         }
//     }
//     return 1;
// }

// /**
//  * Luồng riêng: chỉ đồng bộ dữ liệu sang sheet sinh nhật.
//  * - Nếu tìm thấy nhân sự theo tên (cột A) thì cập nhật tại chỗ.
//  * - Nếu chưa có thì thêm dòng mới cuối bảng.
//  *
//  * Bố cục sheet sinh nhật đang dùng:
//  * A: Tên, B: Công ty, C: Ngày, D: Tháng, E: Năm, F: Hợp đồng, G: Ngày vào công ty
//  */
// function coreSyncBirthdayOnly(peopleToUpdate) {
//     if (!peopleToUpdate || peopleToUpdate.length === 0) return [];

//     const logReport = [];
//     try {
//         const targetSS = SpreadsheetApp.openById(CONFIG.FILES.HOLIDAY_BONUS);
//         const targetSheet =
//             targetSS.getSheetByName("sinh nhật")
//             || targetSS.getSheetByName("Sinh nhật")
//             || targetSS.getSheetByName("Sinh Nhat");

//         if (!targetSheet) {
//             logReport.push("❌ Không tìm thấy sheet sinh nhật trong file Thưởng Lễ.");
//             return logReport;
//         }

//         const dataStartRow = 2;
//         const lastRow = targetSheet.getLastRow();
//         const existingRowByName = {};

//         if (lastRow >= dataStartRow) {
//             const names = targetSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, 1).getValues();
//             for (let i = 0; i < names.length; i++) {
//                 const name = String(names[i][0] || "").trim();
//                 if (!name) continue;
//                 const key = name.toLowerCase();
//                 if (!existingRowByName[key]) {
//                     existingRowByName[key] = dataStartRow + i;
//                 }
//             }
//         }

//         let updatedCount = 0;
//         let insertedCount = 0;
//         const sampleHits = [];

//         peopleToUpdate.forEach(person => {
//             const displayName = String(person.newName || "").trim();
//             if (!displayName) return;

//             const key = displayName.toLowerCase();
//             const birthParts = extractBirthParts_(person.birth);
//             const joinDateText = formatDateDDMMYYYY_(person.joinDate);

//             const rowData = [
//                 displayName,
//                 person.company || "",
//                 birthParts.day || "",
//                 birthParts.month || "",
//                 birthParts.year || "",
//                 person.contractType || "",
//                 joinDateText || ""
//             ];

//             const foundRow = existingRowByName[key];
//             if (foundRow) {
//                 targetSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
//                 updatedCount++;
//                 if (sampleHits.length < 5) sampleHits.push(`update A${foundRow}`);
//             } else {
//                 const insertRow = Math.max(targetSheet.getLastRow(), dataStartRow - 1) + 1;
//                 targetSheet.getRange(insertRow, 1, 1, rowData.length).setValues([rowData]);
//                 existingRowByName[key] = insertRow;
//                 insertedCount++;
//                 if (sampleHits.length < 5) sampleHits.push(`insert A${insertRow}`);
//             }
//         });

//         const fileUrl = (() => {
//             try { return targetSS.getUrl(); } catch (e) { return ""; }
//         })();

//         let msg = `✅ Sinh nhật: cập nhật ${updatedCount} dòng, thêm mới ${insertedCount} dòng.`;
//         if (sampleHits.length > 0) msg += `\n   ↳ Chi tiết: ${sampleHits.join(", ")}`;
//         msg += fileUrl
//             ? `\n   ↳ File: ${targetSS.getName()} (${fileUrl})`
//             : `\n   ↳ File: ${targetSS.getName()}`;
//         logReport.push(msg);
//     } catch (e) {
//         logReport.push(`❌ Sinh nhật: Lỗi kết nối (${e.message})`);
//     }

//     return logReport;
// }

// function formatDateDDMMYYYY_(value) {
//     if (value instanceof Date && !isNaN(value.getTime())) {
//         const d = value.getDate().toString().padStart(2, "0");
//         const m = (value.getMonth() + 1).toString().padStart(2, "0");
//         const y = value.getFullYear();
//         return `${d}/${m}/${y}`;
//     }
//     const text = String(value || "").trim();
//     return text;
// }

// function extractBirthParts_(birthValue) {
//     if (birthValue instanceof Date && !isNaN(birthValue.getTime())) {
//         return {
//             day: birthValue.getDate(),
//             month: birthValue.getMonth() + 1,
//             year: birthValue.getFullYear()
//         };
//     }

//     const text = String(birthValue || "").trim();
//     if (!text) return { day: "", month: "", year: "" };

//     const parts = text.split(/[\/\-\.]/).map(s => s.trim()).filter(Boolean);
//     if (parts.length >= 3) {
//         const day = Number(parts[0]);
//         const month = Number(parts[1]);
//         const year = Number(parts[2]);
//         return {
//             day: isNaN(day) ? parts[0] : day,
//             month: isNaN(month) ? parts[1] : month,
//             year: isNaN(year) ? parts[2] : year
//         };
//     }

//     return { day: "", month: "", year: "" };
// }
