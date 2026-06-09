function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Dữ liệu bật, tắt máy');

  // example = 15/4/2025 11:13 192.168.1.110 ON
  var data = JSON.parse(e.postData.contents);

  data = data.split(", ")

  var lastRow = getLastRowInColumn(sheet, 1) + 1

  sheet.getRange('A' + lastRow).setValue(data[2]) // ip
  sheet.getRange('C' + lastRow).setValue(data[0]) // day
  sheet.getRange('D' + lastRow).setValue(data[3]) // state
  sheet.getRange('E' + lastRow).setValue(data[1]) // time

  return ContentService
    .createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*") // Cho phép tất cả nguồn
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS") // Cho phép phương thức HTTP
    .setHeader("Access-Control-Allow-Headers", "Content-Type"); // Cho phép gửi JSON
}

//============================== FUNCTION GET LEAVE REQUESTS COLUMN ==================================
function removeBordersAtoJ() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getRange("A:J");
  range.setBorder(false, false, false, false, false, false);
}


function tranferDatabyGemini() {
  removeBordersAtoJ()
  //1.1
  var rawData = getRawData()
  Logger.log(rawData)
  const prompt = "KHÔNG TRẢ VỀ CODE. đây là nội dung lý do vắng của nhân viên. Cấu trúc là mỗi object như thế là 1 tin nhắn, gồm thời gian gửi tin nhắn (time) và lý do (text). Trả lại cho tôi cấu trúc sau 'name1 (lấy TÊN ĐẦY ĐỦ NHẤT CÓ THỂ ở trong text, ví dụ có họ đệm thì lấy hết, loại bỏ Mr, ms, mrs, dr.... nếu có trong tên)~ Nam/Nữ (dựa vào Mr,ms,anh,chị... hoặc tự suy đoán theo tên Việt Nam để xác định giới tính)~ d1/m1/yyy1 > lý do 1~ d2/m2/yyy2 > lý do 2 | name2 (lấy TÊN ĐẦY ĐỦ NHẤT CÓ THỂ ở trong text, loại bỏ Mr, ms, mrs, dr.... nếu có trong tên)~ Nam/Nữ (dựa vào Mr,ms,anh,chị... hoặc tự suy đoán theo tên Việt Nam để xác định giới tính)~ d3/m3/yyy3 > lý do 3~ d4/m4/yyy4 > lý do 4'. Lưu ý nếu request thiếu thông tin về người và lý do thì bỏ nó đi, còn nếu không có thông tin ngày thì tự thêm ngày hiện tại vào. Lưu ý sẽ có đoạn tin nhắn chứa 2 người trở lên cùng làm 1 việc nên hãy xử lý nó cho họ nhé. Trường hợp text có 2 hoặc nhiều người cùng thực hiện 1 công việc trong 1 thời điểm thì hãy làm theo ví dụ sau, ví dụ: text là 'Mr.B và Ms.C đi công tác 30/2/2025' thì hãy trả ra là 'B~ Nam~ 30/2/2025 > Mr.B và Ms.C đi công tác 30/2/2025 | C~ Nữ~ 30/2/2025 > Mr.B và Ms.C đi công tác 30/2/2025'. Với mỗi người, hành động phải sắp xếp theo thời gian tăng dần, lưu ý giá trị thời gian: trong thời gian thiếu năm thì tự động thêm năm hiện tại vào, nếu ngày hoặc tháng lớn hơn hoặc bằng 10 thì ok, còn nếu bé hơn 10 thì đừng thêm số 0 ở trước, ví dụ ngày 3 tháng 3 năm 2025 thì chuyển thành 3/3/2025. Thêm nữa ví dụ như 'Mr. Duy Anh xin phép nghỉ từ ngày 4.2.2025 đến ngày 8.2.2025. Lý do: nghỉ chế độ thai sản' cũng phải liệt kê đủ tất cả các ngày ra, ví dụ text là 'Em quân đi ngân hàng 13-14/05/2025' và 'em thái đi thuế 16,17,18/05/2025' sẽ thì trả lại 'Quân~ Nam~ 13/5/2025 > Em quân đi ngân hàng 13-14/05/2025~ 14/5/2025 > Em quân đi ngân hàng 13-14/05/2025 | Thái~ Nam~ 16/5/2025 > em thái đi thuế 16,17,18/05/2025~ 17/5/2025 > em thái đi thuế 16,17,18/05/2025~ 18/5/2025 > em thái đi thuế 16,17,18/05/2025~'. Lưu ý đối với tên: sẽ có những người trùng tên, nên chúng tôi dùng số kèm với tên để phân biệt, làm ơn giữ nguyên tên và số nhé, ví dụ 'Hiếu 94, Hoàng 53,...'. Đối với mỗi người phải có 1 cấu trúc như thế! hãy chỉ trả lời theo string trên, đừng giải thích gì thêm. Nội dung cần xử lý: " + JSON.stringify(rawData)

  //1.2
  var cleanData = sendtoGemini(prompt)
  cleanData = sanitizeGeminiResponse(cleanData);

  console.log(cleanData)
  // 1.3
  addInsightToSheet(cleanData)

  // //1.4
  handleAddLine();
}

function sanitizeGeminiResponse(text) {
  if (!text) return "";
  var cleaned = text.replace(/```[a-zA-Z]*\n/g, "").replace(/```/g, "");
  return cleaned.trim();
}

// === 1.1 ===
function getRawData() {
  var spaceName = "spaces/AAAAIgZ6aZI"; // real
  // var spaceName = "spaces/AAAAu0KzNQE"; // fake
  var pageToken = null;
  var messages = [];

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var value = sheet.getRange('F2').getValue()
  if (value != '') {
    value = value.split(" ")
    timecompare = value[0]
    daycompare = value[1]

    if (timecompare != '' && daycompare != '') {
      do {
        var url = "https://chat.googleapis.com/v1/" + spaceName + "/messages?pageSize=30&orderBy=createTime desc";
        if (pageToken) url += "&pageToken=" + pageToken;
        var headers = {
          "Authorization": "Bearer " + ScriptApp.getOAuthToken()
        };
        var response = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
        var json = JSON.parse(response.getContentText());

        if (json.messages) {
          json.messages.forEach(function (msg) {
            var time = parseISOToVNDateTime(msg.createTime)
            var text = msg.text || "[Nội dung không có văn bản]";

            if (compareDateTime(time.time, time.date, timecompare, daycompare) == 1) {
              messages.push({
                time: time.date,
                text: text,
              });
            }

          });
        }
        return messages
      } while (pageToken);
    }
  }


  do {
    var url = "https://chat.googleapis.com/v1/" + spaceName + "/messages?pageSize=50&orderBy=createTime desc";
    if (pageToken) url += "&pageToken=" + pageToken;
    var headers = {
      "Authorization": "Bearer " + ScriptApp.getOAuthToken()
    };
    var response = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    var json = JSON.parse(response.getContentText());

    if (json.messages) {
      json.messages.forEach(function (msg) {
        var time = parseISOToVNDateTime(msg.createTime)
        var text = msg.text || "[Nội dung không có văn bản]";
        // var mailID = msg.sender.name.split('/')[1]
        // messages.push({
        //   time: time.slice(0, 10),
        //   text: text,
        // });

        messages.push({
          time: time.date,
          text: text,
        });
      });
    }
    return messages
  } while (pageToken);
}

function compareDateTime(time1, day1, time2, day2) {
  // time dạng "HH:mm", day dạng "d/M/yyyy" hoặc "dd/MM/yyyy"
  var parts1 = day1.split('/');
  var parts2 = day2.split('/');

  // Tạo đối tượng Date cho time1 + day1
  var date1 = new Date(
    parseInt(parts1[2], 10),     // year
    parseInt(parts1[1], 10) - 1, // month (0-based)
    parseInt(parts1[0], 10),     // day
    parseInt(time1.split(':')[0], 10), // hour
    parseInt(time1.split(':')[1], 10)  // minute
  );

  // Tạo đối tượng Date cho time2 + day2
  var date2 = new Date(
    parseInt(parts2[2], 10),
    parseInt(parts2[1], 10) - 1,
    parseInt(parts2[0], 10),
    parseInt(time2.split(':')[0], 10),
    parseInt(time2.split(':')[1], 10)
  );

  // So sánh
  if (date1 < date2) return -1;
  else return 1;
}

function parseISOToVNDateTime(isoString) {
  // Làm sạch chuỗi để tránh lỗi với phần microseconds
  var cleanISO = isoString.replace(/(\.\d{3})\d*Z$/, '$1Z');
  var utcDate = new Date(cleanISO);

  // Cộng thêm 7 tiếng để chuyển sang giờ Việt Nam
  var vnDate = new Date(utcDate.getTime());

  var dd = vnDate.getDate();
  if (dd < 10) dd = '0' + dd;

  var mm = vnDate.getMonth() + 1;
  if (mm < 10) mm = '0' + mm;

  var yyyy = vnDate.getFullYear();

  var hh = vnDate.getHours();
  if (hh < 10) hh = '0' + hh;

  var min = vnDate.getMinutes();
  if (min < 10) min = '0' + min;

  return {
    date: dd + '/' + mm + '/' + yyyy,
    time: hh + ':' + min
  };
}


// === 1.2 ===
function sendtoGemini(prompt) {
  var API_KEY = "AIzaSyCp0rYqMgE0GKaKVFVZBg7Ygu7p_67jCRA";

  var payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  try {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + API_KEY;
    // var url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + API_KEY;
    // var url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=" + API_KEY;
    // var url = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + API_KEY;

    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());

    if (json.candidates && json.candidates.length > 0) {
      return json.candidates[0].content.parts[0].text;
    } else {
      return "Xin lỗi, tôi không thể lấy phản hồi từ AI.";
    }
  } catch (e) {
    Logger.log("Error: " + e.toString());
    return "Có lỗi xảy ra: " + e.toString();
  }
}


// === 1.3 ===
function addInsightToSheet(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Finger Print");
  var lastRow = sheet.getLastRow();

  // CẤU HÌNH CỘT (A=1, B=2, F=6)
  const COL_NAME = 1;
  const COL_DATE = 2;
  const COL_NOTE = 6;

  // Lấy dữ liệu 2 cột A và B để đối chiếu (Lấy DisplayValues để so sánh chính xác text)
  var rangeData = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();

  var spData = spreadData_Fix(data);

  for (var i = 0; i < spData.length; i++) {
    var geminiName = spData[i][0];
    var foundPersonStartRow = -1;

    // 1. Tìm dòng bắt đầu của nhân viên
    for (var j = 0; j < rangeData.length; j++) {
      var sheetFullName = rangeData[j][0];
      if (!sheetFullName || j < 1) continue;

      if (isSamePerson(geminiName, sheetFullName)) {
        foundPersonStartRow = j;
        console.log("✅ Tìm thấy: " + geminiName + " -> " + sheetFullName);
        break;
      }
    }

    // 2. Nếu tìm thấy người, bắt đầu duyệt các ngày nghỉ của họ
    if (foundPersonStartRow !== -1) {
      for (var k = 2; k < spData[i].length; k++) {
        var geminiDate = spData[i][k][0];
        var reasonText = spData[i][k][1];
        var isWrote = false;

        // Quét 35 dòng từ dòng tên
        for (var h = foundPersonStartRow; h < foundPersonStartRow + 35 && h < rangeData.length; h++) {

          // Kiểm tra nếu nhảy sang tên người khác thì dừng
          if (h > foundPersonStartRow && rangeData[h][0] && rangeData[h][0] !== "") {
            if (!isSamePerson(geminiName, rangeData[h][0])) break;
          }

          var sheetDate = rangeData[h][1]; // Cột B

          if (isEqualDate(sheetDate, geminiDate)) {
            var rowIndex = h + 1;
            var cell = sheet.getRange(rowIndex, COL_NOTE);
            var currentVal = cell.getValue();

            if (String(currentVal).indexOf(reasonText) === -1) {
              var newVal = currentVal ? currentVal + "; " + reasonText : reasonText;
              cell.setValue(newVal);
              console.log("   + Ghi F" + rowIndex + " (" + sheetDate + "): " + reasonText);
            } else {
              console.log("   = Đã có thông tin tại ngày " + sheetDate);
            }
            isWrote = true;
            break;
          }
        }
        if (!isWrote) console.warn("   ⚠️ Không tìm thấy ngày " + geminiDate + " cho " + geminiName);
      }
    } else {
      console.warn("❌ Không tìm thấy nhân viên trong sheet: " + geminiName);
    }
  }
}

// Hàm bổ trợ so sánh ngày tháng chuẩn xác
function isEqualDate(dSheet, dGemini) {
  if (!dSheet || !dGemini) return false;

  // 1. Phân tích ngày từ Gemini (Luôn là d/m/y theo prompt)
  var parseGemini = function (str) {
    var parts = String(str).trim().split(/[\/\-\.]/);
    if (parts.length < 2) return null;
    return {
      d: parseInt(parts[0], 10),
      m: parseInt(parts[1], 10),
      y: parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear()
    };
  };

  // 2. Phân tích ngày từ Sheet (Xử lý cả Date Object lẫn String)
  var parseSheet = function (val) {
    // Nếu là Date Object (Google Sheet hay trả về cái này)
    if (val instanceof Date) {
      return {
        num1: val.getDate(),
        num2: val.getMonth() + 1,
        y: val.getFullYear()
      };
    }
    // Nếu là String (ví dụ '14/1/2026')
    var parts = String(val).trim().split(/[\/\-\.]/);
    if (parts.length < 2) return null;
    return {
      num1: parseInt(parts[0], 10),
      num2: parseInt(parts[1], 10),
      y: parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear()
    };
  };

  var g = parseGemini(dGemini);
  var s = parseSheet(dSheet);

  if (!s || !g) return false;

  // --- SO SÁNH THÔNG MINH ---

  // Bước 1: Kiểm tra Năm (Nếu lệch năm thì sai luôn)
  // (Lưu ý: Nếu trong sheet không ghi năm, s.y có thể ra năm hiện tại, code vẫn chạy ổn)
  if (s.y !== g.y) return false;

  // Bước 2: So sánh Ngày & Tháng (Thử cả 2 chiều)

  // Chiều A: Sheet là Ngày/Tháng (Format Việt Nam: 14/1)
  // num1 = 14 (Ngày), num2 = 1 (Tháng)
  var isVNFormat = (s.num1 === g.d && s.num2 === g.m);

  // Chiều B: Sheet là Tháng/Ngày (Format Mỹ: 1/14)
  // num1 = 1 (Tháng), num2 = 14 (Ngày)
  var isUSFormat = (s.num1 === g.m && s.num2 === g.d);

  // Chỉ cần 1 trong 2 chiều đúng là OK
  return isVNFormat || isUSFormat;
}
// === 1.3.1 ===
// function spreadData(data) {
//   data = data.slice(0, data.length - 1);
//   data = data.split(" | ");

//   for (var i = 0; i < data.length; i++) {
//     data[i] = data[i].split("~")

//     for (var j = 1; j < data[i].length; j++) {
//       var temp = data[i][j].split(">")
//       data[i][j] = temp
//     }
//   }

//   var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//   var value = sheet.getRange('F2').getValue()
//   if(value != ''){
//     value = value.split(" ")

//     daycompare = value[1]

//     if(daycompare != '') {
//       for (var i = 0; i < data.length; i++) {
//         for(var j = 2; j < data[i].length; j++) {
//           if(compareDates(data[i][j][0].trim(), daycompare.trim()) == -1) {
//             data[i] = removeByIndex(data[i], j)
//             j = 1
//           }
//         }
//       }
//     }
//   }

//   var result = []

//   for (var i = 0; i < data.length; i++) {
//     if(data[i].length > 2) {
//       result.push(data[i])
//     }
//   }
//   return result
// }

function spreadData(data) {
  if (!data) return [];
  var cleanStr = String(data).trim();
  if (cleanStr.slice(-1) === '|') cleanStr = cleanStr.slice(0, -1).trim();

  var records = cleanStr.split(" | ");
  var result = [];

  for (var i = 0; i < records.length; i++) {
    var parts = records[i].split("~");
    if (parts.length < 3) continue;

    var personArray = [];
    personArray.push(parts[0].trim()); // Tên
    personArray.push(parts[1].trim()); // Giới tính

    for (var j = 2; j < parts.length; j++) {
      var dateDetail = parts[j].split(">");
      if (dateDetail.length >= 2) {
        personArray.push([dateDetail[0].trim(), dateDetail[1].trim()]);
      }
    }
    result.push(personArray);
  }
  return result;
}

function removeByIndex(arr, index) {
  if (index >= 0 && index < arr.length) {
    arr.splice(index, 1);
  }
  return arr;
}

function compareDates(dateStr1, dateStr2) {
  var date1 = parseDate(dateStr1);
  var date2 = parseDate(dateStr2);

  if (date1 > date2) return 1;        // dateStr1 sau dateStr2
  else if (date1 < date2) return -1;  // dateStr1 trước dateStr2
  else return 0;                      // bằng nhau
}

function parseDate(str) {
  var parts = str.split("/");
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1; // JavaScript month is 0-based
  var year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

// === 1.3.2 ===

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSamePerson(geminiName, sheetFullName) {
  if (!geminiName || !sheetFullName) return false;

  // 1. So sánh cơ bản (chữ thường, xóa khoảng trắng thừa)
  var n = String(geminiName).toLowerCase().trim();
  var f = String(sheetFullName).toLowerCase().trim();

  // Bỏ danh xưng thừa (mr, ms...)
  n = n.replace(/^(mr|ms|mrs|dr)\.?\s+/g, "");

  // Rule cứng: Chữ cuối của tên do Gemini trả về phải khớp với chữ cuối của tên trong sheet
  var nWords = n.split(/\s+/);
  var fWords = f.split(/\s+/);

  var nLast = removeVietnameseTones(nWords[nWords.length - 1]);
  var fLast = removeVietnameseTones(fWords[fWords.length - 1]);

  if (nLast !== fLast) return false;

  // Nếu match ngay thì trả về true
  if (f.indexOf(n) !== -1 || n.indexOf(f) !== -1) return true;

  // 2. So sánh nâng cao (Xóa dấu tiếng Việt để tránh lỗi font)
  var nNoAccents = removeVietnameseTones(n);
  var fNoAccents = removeVietnameseTones(f);

  // Ví dụ: "Tam" nằm trong "Truong Minh Tam" -> OK
  return fNoAccents.indexOf(nNoAccents) !== -1 || nNoAccents.indexOf(fNoAccents) !== -1;
}

function removeVietnameseTones(str) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  // Xóa ký tự đặc biệt còn sót lại
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  return str;
}


// Sửa lại hàm này trong Code.gs
function isSameGender(geminiGender, sheetFullName) {
  // Nếu AI không trả về giới tính, cứ cho qua để không mất dữ liệu
  if (!geminiGender) return true;

  // Chuẩn hóa giới tính về chữ thường (nam/nữ)
  var g = geminiGender.toLowerCase().trim();

  // Logic đơn giản: Nếu trong tên đầy đủ có chữ "Ms" hoặc "Thị" mà AI bảo "Nữ" -> Khớp
  // Hoặc bạn có thể tạm thời để true để ưu tiên đổ dữ liệu theo tên trước.
  return true;
}

// === 1.4 ===
function handleAddLine() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();

  var cellB3 = sheet.getRange("B3");
  var val = cellB3.getValue();
  var dis = cellB3.getDisplayValue();

  var dateObj = null;

  // Cố gắng tạo đối tượng Date từ giá trị trong ô
  if (val instanceof Date && !isNaN(val.getTime())) {
    dateObj = val;
  } else if (dis) {
    // Nếu là chuỗi, thử chuyển đổi chuỗi sang Date
    // Thay thế các dấu chấm, dấu gạch ngang thành gạch chéo
    var cleanedDis = dis.replace(/[\.\-]/g, '/');
    var parts = cleanedDis.split('/');
    if (parts.length >= 3) {
      // Giả định định dạng d/m/yyyy. Nếu lỗi tháng > 12, sẽ tự đảo lại.
      var d = parseInt(parts[0]);
      var m = parseInt(parts[1]);
      var y = parseInt(parts[2]);
      dateObj = new Date(y, m - 1, d);
    }
  }

  // Kiểm tra cuối cùng xem dateObj có hợp lệ không
  if (!dateObj || isNaN(dateObj.getTime())) {
    // Nếu vẫn không được, lấy ngày hiện tại làm mặc định để không chết Script
    console.warn("Không đọc được B3, đang dùng ngày hiện tại làm mặc định.");
    dateObj = new Date();
  }

  var month = dateObj.getMonth() + 1;
  var year = dateObj.getFullYear();

  // Tính số ngày trong tháng (ngày 0 của tháng sau là ngày cuối tháng này)
  var count = new Date(year, month, 0).getDate();

  var startRow = 2;

  // Xóa Border cũ ở cột A-J để tránh đè dòng cũ
  sheet.getRange(3, 1, lastRow, 10).setBorder(null, null, null, null, null, null);

  while (startRow < lastRow) {
    startRow += count;
    if (startRow > lastRow) break;

    // Chỉ kẻ nếu startRow hợp lệ
    try {
      var range = sheet.getRange(startRow, 1, 1, 10);
      range.setBorder(
        false, false, true, false,
        false, false,
        "black", SpreadsheetApp.BorderStyle.SOLID
      );
    } catch (e) {
      console.error("Lỗi tại dòng " + startRow + ": " + e.message);
    }
  }

  console.log("Kẻ dòng thành công cho tháng " + month + "/" + year + " (" + count + " ngày)");
}


//============================== FUNCTION GEMINI ================================================================================================
function handleReasonClassification() {

  //H.1.1
  var activeRow = handleActiveRow()

  //1.1
  var data = getRequestData(activeRow[0], activeRow[1]);

  const prompt = "Luôn luôn trả về kết quả theo định dạng 'row + [khoảng trắng] + kí hiệu', ví dụ: 6 +s,14 o,16 +,17 -c,21 +,24 -s,26 +c. Phân tích mảng dữ liệu sau, trong đó mỗi phần tử là 1 object gồm 2 trường row, request. Xác định request là công việc của công ty hay công việc cá nhân, tôi sẽ cho bạn 1 vài ví dụ: Ví dụ công việc công ty (trả về 'row +') thì thường liên quan đến dự án, giao,lấy,nộp hồ sơ, đi công tác, membership training (MT), đăng kiểm xe công ty, cắt gỗ, làm việc dự án. Nếu chỉ định luôn như 'được tính công sáng' hoặc 'được tính công chiều' thì nó là ưu tiên, luôn ưu tiên kết quả này hơn nếu trong đó có 2 request trở lên trả về 'row +s' hoặc 'row +c'... Ví dụ công việc cá nhân (trả về 'row -') thì thường liên quan đến việc cá nhân, việc gia đình, con ốm, khám thai, nghỉ phép, về sớm, đi muộn, đi tiêm phòng, tặng hoa, bị mệt, nghỉ chế độ thai sản.... Lưu ý sẽ có trường hợp có request có 2 nội dung trở lên không được tách nó ra thành 2 request, phải kết hợp lại, ví dụ có 2 nội dung đi việc buổi sáng và chiều thì là +s và +c, kết hợp lại thành +s+c, ví dụ: 31 +s+c,32 +s-c,35 +c+s,36 -c+s,40 -s+c,42 +c-s. Lưu ý các trường hợp request có nội dung xin đi/vào muộn hoặc về/ra sớm (có hoặc không kèm theo giờ, phút) thì trả về o. Nếu trong request có yếu tố xin cả sáng hoặc cả chiều (không tính xin về/ra sớm hoặc đến/vào muộn bao nhiêu phút) thì phải trả về 'row +s' hoặc 'row +c' (nếu việc công ty cả buổi sáng hoặc chiều), 'row -s' hoặc 'row -c' (nếu việc cá nhân cả buổi sáng hoặc chiều), còn không có yếu tố 'sáng' hoặc 'chiều' thì trả về 'row +', 'row -'. Lưu ý sẽ có những row có request hoàn toàn giống nhau, thường là do xin nghỉ các ngày liền nhau nên trả về 'row -', nhưng xin hãy xử lý đúng quy trình và trả về đủ row và type của request. Trả về chuỗi: row + [khoảng trắng] + kí hiệu '+' hoặc '-', mỗi cặp row kí hiệu cách nhau bởi ','. Ví dụ: 6 +s,14 o,16 +,17 -c,21 +,24 -s,26 +c,.... Hãy chỉ trả lời theo string ví dụ trên, đừng giải thích gì thêm. Nội dung cần xử lý: " + JSON.stringify(data)

  //F.1.2
  var types = sendtoGemini(prompt);

  //1.2
  handleFilltype(types)

}

// === 1.1 ===
function getRequestData(rowStart, numRows) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();

  var range = sheet.getRange(rowStart, 6, numRows, 1);
  var values = range.getValues();

  var result = [];
  for (var i = 0; i < values.length; i++) {
    var cellValue = values[i][0];
    if (cellValue !== "" && cellValue !== null) {
      var rowIndex = rowStart * 1 + i;
      if (rowIndex < 3) continue;
      result.push({
        row: rowIndex,
        request: cellValue
      });
    }
  }

  return result
}

// === 1.2 ===
function handleFilltype(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  data = data.split(",")

  for (var i = 0; i < data.length; i++) {
    var temp = data[i].split(' ');
    var rowIdx = parseInt(temp[0].trim(), 10);
    if (rowIdx < 3) continue;

    if (temp[1].trim() == 'o' || temp[1].trim() == 'o,' || temp[1].trim() == 'o.') {
      temp[1] = ''
    } else if (temp[1].trim() == '+s+c' || temp[1].trim() == '+c+s') {
      temp[1] = '+'
    } else if (temp[1].trim() == '-s-c' || temp[1].trim() == '-c-s') {
      temp[1] = '-'
    } else if (temp[1].trim() == '+s-c' || temp[1].trim() == '-c+s') {
      temp[1] = '+s'
    } else if (temp[1].trim() == '-s+c' || temp[1].trim() == '+c-s') {
      temp[1] = '+c'
    } else if (temp[1].trim() == '+c+c') {
      temp[1] = '+c'
    } else if (temp[1].trim() == '+s+s') {
      temp[1] = '+s'
    } else if (temp[1].trim() == '+s+') {
      temp[1] = '+'
    } else if (temp[1].trim() == '+c+') {
      temp[1] = '+'
    }

    var gco = handleOValue(temp[1].trim())


    sheet.getRange("G" + temp[0].trim()).setValue(gco.trim())
  }
}

function handleOValue(value) {
  // return value
  //   .split('')             // tách thành mảng ký tự
  //   .filter(function (ch) { return ch !== 'o'}) // giữ lại ký tự khác 'o'
  //   .join('');             // gộp lại thành chuỗi

  return value.replace(/([+-]?o)/g, '');
}

//============================== FUNCTION WORKING DATE ==========================================================================================
var additionTime = 0
var lRow = []
var mRow = []
var tRow = []
var namess = []
var stackss = []

function parseDMYForSort(val) {
  if (val === null || val === undefined || val === '') return 0
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return val.getTime()
  }
  var s = String(val).trim()
  var parts = s.split(/[\/\.\-]/)
  if (parts.length >= 3) {
    var d = parseInt(parts[0], 10)
    var m = parseInt(parts[1], 10)
    var y = parseInt(parts[2], 10)
    if (isNaN(d) || isNaN(m) || isNaN(y)) return 0
    return new Date(y, m - 1, d).getTime()
  }
  return 0
}

function normalizeSheetTime(val) {
  if (val === null || val === undefined || val === '') return ''
  if (Object.prototype.toString.call(val) === '[object Date]') {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone()
    return Utilities.formatDate(val, tz, 'HH:mm')
  }
  return String(val).trim()
}

// === 1.6 ===
function handleEmployeeClass(name) {
  additionTime = 0
  for (var i = 0; i < lRow.length; i++) {
    if (lRow[i][0] == name) {
      additionTime += mRow[i][0] * 1
      additionTime = additionTime.toFixed(0) * 1

      if (tRow[i][0] == "Thai sản") {
        return i
      } else {
        return -1
      }
    }
  }
}

function handleConfirmationWork() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Finger Print');
  var sheet1 = ss.getSheetByName('Working Time');

  //1.1
  var activeRow = handleActiveRow()

  //1.2
  var data = getRowData(activeRow[0], activeRow[1])


  var lastRow = sheet1.getLastRow();
  lRow = sheet1.getRange(2, 2, lastRow, 1).getValues(); // Cột B = cột 2
  mRow = sheet1.getRange(2, 4, lastRow, 1).getValues(); // Cột D = cột 4
  tRow = sheet1.getRange(2, 6, lastRow, 1).getValues(); // Cột F = cột 6

  const dmyCellValue = sheet.getRange('I1').getValue();
  const dmyCell = dmyCellValue ? String(dmyCellValue).split(' ') : [];

  var lastRow1 = getLastRowInColumn(sheet, 19)
  namess = sheet.getRange(3, 16, lastRow1, 1).getValues()
  stackss = sheet.getRange(3, 22, lastRow1, 1).getValues()


  var cr = sheet.getRange(activeRow[0], 8, activeRow[1], 1).getValues(); // Cột H = cột 8

  var rowStart = activeRow[0] * 1
  var satOrder = []
  for (var si = 0; si < data.length; si++) {
    var rowIx = si + rowStart;
    if (rowIx < 3) continue;
    if (data[si].day == 'Bảy') satOrder.push(si)
  }
  satOrder.sort(function (a, b) {
    var na = String(data[a].name)
    var nb = String(data[b].name)
    if (na != nb) return na < nb ? -1 : 1
    return parseDMYForSort(data[a].dmy) - parseDMYForSort(data[b].dmy)
  })
  var satDone = {}
  for (var sx = 0; sx < satOrder.length; sx++) {
    var si = satOrder[sx]
    satDone[si] = true
    var rowIx = si + rowStart
    var tsSat = handleEmployeeClass(data[si].name)
    if (String(cr[si][0]).trim() == 'Lễ') {
      continue
    }
    handleCheckSaturday(data[si], rowIx, tsSat)
  }

  for (var i = 0; i < data.length; i++) {
    var rowIndex = i + activeRow[0] * 1
    if (rowIndex < 3) continue;

    //1.6
    var ts = handleEmployeeClass(data[i].name)

    if (satDone[i]) {
      continue
    } else {
      // Nếu là ngày nghỉ lễ (đã được fillRequest set ở cột H) thì không chạy phân loại công/format nữa.
      // Không gán thêm ký hiệu "" cho từng nhân viên.
      if (String(cr[i][0]).trim() == 'Lễ') {
        sheet.getRange("H" + rowIndex.toFixed(0)).setValue('Lễ')
        restoreDefaultCell('H' + rowIndex.toFixed(0))

        // Ngày lễ không tính muộn/quên → clear ghi chú tự động ở cột I (nếu có)
        sheet.getRange("I" + rowIndex.toFixed(0)).setValue('')
        restoreCellColor(rowIndex)
        continue
      }

      //1.3
      var detail = handleDetailClassification(data[i].day, data[i].timeIn, data[i].timeOut, data[i].request)

      if (detail == 'dia') {
        detail = handleDetailClassification(data[i].day, data[i].timeOut, data[i].timeIn, data[i].request)
      }

      if (data[i].timeOut == '') {
        //1.4
        if (data[i].timeIn != '') {
          changeCellColor(rowIndex)
        } else {
          restoreCellColor(rowIndex)
        }
      } else {
        restoreCellColor(rowIndex)
      }

      if (detail.workUnit.trim() == '+') {
        detail.workUnit = "Full"
      } else if (detail.workUnit.trim() == '-') {
        detail.workUnit = "Nửa"
      } else if (detail.workUnit.trim() == 'N') {
        detail.workUnit = "Nghỉ"
      }



      sheet.getRange("H" + rowIndex.toFixed(0)).setValue(detail.workUnit.trim())


      if (detail.workUnit == "Nghỉ") {
        formatCell('H' + rowIndex.toFixed(0))
      } else {
        restoreDefaultCell('H' + rowIndex.toFixed(0))
      }

      if (ts != -1) {
        detail.note = ""
        if (data[i].timeIn == '' && data[i].timeOut == '') {

        } else if ((data[i].timeIn != "" && data[i].timeOut == "") || (data[i].timeIn == "" && data[i].timeOut != "")) {
          detail.note += "Quên "
        }

        if (timeToMinutes(data[i].timeIn) > timeToMinutes('8:00') + additionTime) {
          detail.note += "Muộn "
        }
      }

      if (dmyCell.indexOf(data[i].dmy) !== -1) {
        if (detail.note.trim() == "Muộn Muộn") {
          sheet.getRange("I" + rowIndex.toFixed(0)).setValue("Muộn")
        } else if (detail.note.trim() == "Muộn") {

        }
      } else {
        sheet.getRange("I" + rowIndex.toFixed(0)).setValue(detail.note.trim())
      }


    }
  }
  // tong cong
  grossWork()

  //Tong phut di muon
  handleTotalLateMinuteday()
}

// === 1.5 ===
function formatCell(cell) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cell = sheet.getRange(cell); // Thay "A1" bằng ô bạn muốn chỉnh

  cell.setFontWeight("bold") // In đậm
    .setFontColor("red");  // Đổi màu chữ thành đỏ
}

// === 1.6 ===
function restoreDefaultCell(cell) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cell = sheet.getRange(cell);

  cell.setFontWeight("normal")
    .setFontColor(null)
}

// === 1.1 ===
function handleActiveRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getActiveRange();

  var rowStart = range.getRow();
  var numRows = range.getNumRows();
  return [rowStart.toFixed(0), numRows.toFixed(0)]
}

// === 1.2 ===
function getRowData(rowStart, numRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Finger Print');

  var nameColumn = sheet.getRange(rowStart, 1, numRows, 1).getValues(); // Cột A
  var dmyColumn = sheet.getRange(rowStart, 2, numRows, 1).getValues(); // Cột B
  var dayColumn = sheet.getRange(rowStart, 3, numRows, 1).getValues(); // Cột C
  var timeInColumn = sheet.getRange(rowStart, 4, numRows, 1).getValues(); // Cột D
  var timeOutColumn = sheet.getRange(rowStart, 5, numRows, 1).getValues(); // Cột E
  var requestColumn = sheet.getRange(rowStart, 7, numRows, 1).getValues(); // Cột G
  var otColumn = sheet.getRange(rowStart, 10, numRows, 1).getValues(); // Cột J

  for (var i = 0; i < otColumn.length; i++) {
    if (otColumn[i][0] != "") {
      var temp = otColumn[i][0].split(" ")
      otColumn[i][0] = temp[1]
    }
  }

  var stringObj = []

  for (var i = 0; i < timeInColumn.length; i++) {
    stringObj.push({
      name: nameColumn[i][0],
      dmy: dmyColumn[i][0],
      day: dayColumn[i][0],
      timeIn: normalizeSheetTime(timeInColumn[i][0]),
      timeOut: normalizeSheetTime(timeOutColumn[i][0]),
      request: requestColumn[i][0],
      ot: otColumn[i][0]
    })
  }

  return stringObj
}

// === 1.4 ===
function changeCellColor(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getRange("A" + row + ":H" + row);
  var color = "#F4CCCC"; // Light Red 3

  range.setBackground(color);
}

// === 1.4a ===
function restoreCellColor(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getRange("A" + row + ":H" + row);

  range.setBackground(null);
}

// === 1.3 ===
function handleDetailClassification(day, timeIn, timeOut, request) {
  var result = {
    workUnit: "",
    note: ""
  }

  //+ -> +
  if (request == "+") {
    result.workUnit = '+'
    return result
  }

  if (day == "CN") {

    // Không timeIn, Không timeOunt
    if (timeIn == "" && timeOut == "") {
      if (request == '+s' || request == '+c') {
        result.workUnit = '-'
        return result
      }
    }

    // Có timeIn, Có timeOut
    if (timeIn != "" && timeOut != "") {
      //Kiểm tra ca làm
      var typeShift = identifyShift(timeIn, timeOut)

      // Ca Full
      if (typeShift == 'F') {

        //Kiểm tra đi muộn về sớm ?> 120 
        if (checkLateAndEarly(timeIn, timeOut, '8"00', '17:30') == false) {
          result.workUnit = '+'
        } else {
          if (request == '+s' || request == '+c') {
            result.workUnit = '+'
          } else {
            result.workUnit = '-'
          }
        }

        //Ca Sáng
      } else if (typeShift == 'S') {

        //Kiểm tra đi muộn về sớm ?> 120 
        if (checkLateAndEarly(timeIn, timeOut, '8"00', '12:00') == false) {
          if (request == '+c') {
            result.workUnit = '+'
          } else {
            result.workUnit = '-'
          }
        } else {
          if (request == '+s' || request == '+c') {
            result.workUnit = '-'
          }
        }

        //Ca Chiều
      } else if (typeShift == 'C') {

        //Kiểm tra đi muộn về sớm ?> 120
        if (checkLateAndEarly(timeIn, timeOut, '13"30', '17:30') == false) {
          if (request == '+s') {
            result.workUnit = '+'
          } else {
            result.workUnit = '-'
          }
        } else {
          if (request == '+s' || request == '+c') {
            result.workUnit = '-'
          }
        }
      }

      return result
    }

    //Có timeIn, Không có timeOut
    if (timeIn != "" && timeOut == "") {

      //Nghỉ chiều
      if (request == '-c') {
        if (timeToMinutes(timeIn) < timeToMinutes('10:01') + additionTime) {
          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        return result
      }

      //Nghỉ sáng
      if (request == '-s') {
        if (timeToMinutes(timeIn) < timeToMinutes('15:31') + additionTime) {
          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        return result
      }


      //+ sáng
      if (request == '+s') {
        if (timeToMinutes(timeIn) < timeToMinutes('15:31') + additionTime) {
          result.workUnit = '+'
        } else {
          result.workUnit = '-'
        }

        return result
      }

      //+ chiều
      if (request == '+c') {
        if (timeToMinutes(timeIn) < timeToMinutes('10:01') + additionTime) {
          result.workUnit = '+'
        } else {
          result.workUnit = '-'
        }

        return result
      }

      //không request
      if (request == '') {
        if (timeToMinutes(timeIn) < timeToMinutes('10:01') + additionTime) {
          result.workUnit = '+'
        } else if (timeToMinutes(timeIn) < timeToMinutes('15:31') + additionTime) {
          result.workUnit = '-'
        }

        return result
      }

      return result
    }

    //Không có timeIn, có timeOut
    if (timeIn == "" && timeOut != "") {

      //Nghỉ chiều
      if (request == '-c') {
        if (timeToMinutes(timeOut) > timeToMinutes('9:59') + additionTime) {
          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        return result
      }

      //Nghỉ sáng
      if (request == '-s') {
        if (timeToMinutes(timeOut) > timeToMinutes('15:29') + additionTime) {
          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        return result
      }


      //+ sáng
      if (request == '+s') {
        if (timeToMinutes(timeOut) > timeToMinutes('15:29') + additionTime) {
          result.workUnit = '+'
        } else {
          result.workUnit = '-'
        }

        return result
      }

      //+ chiều
      if (request == '+c') {
        if (timeToMinutes(timeOut) > timeToMinutes('9:59') + additionTime) {
          result.workUnit = '+'
        } else {
          result.workUnit = '-'
        }

        return result
      }

      //không request
      if (request == '') {
        if (timeToMinutes(timeOut) > timeToMinutes('15:29') + additionTime) {
          result.workUnit = '+'
        } else if (timeToMinutes(timeOut) > timeToMinutes('9:59') + additionTime) {
          result.workUnit = '-'
        }

        return result
      }

      return result
    }

    return result

  } else {

    // Không timeIn, Không timeOut
    if (timeIn == "" && timeOut == "") {
      if (request == '+s' || request == '+c') {
        result.workUnit = '-'
      } else {
        result.workUnit = 'N'
      }
      return result
    }

    // Có timeIn, Có timeOut
    if (timeIn != "" && timeOut != "") {

      if (timeToMinutes(timeIn) <= timeToMinutes('8:00') + additionTime) {

        if (timeToMinutes(timeOut) >= timeToMinutes('17:30') + additionTime) {
          result.workUnit = '+'

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('15:30') + additionTime) {
          result.workUnit = '+'

          if (request != '+c') {
            result.note = "Muộn "
          }

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('12:00') + additionTime) {
          result.workUnit = '-'

          if (request == '+c') {
            result.note = ""
            result.workUnit = '+'
          }

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('10:00') + additionTime) {
          result.workUnit = '-'
          result.note = "Muộn"

          if (request == '+c') {
            result.workUnit = '+'
          }

          if (request == '+s') {
            result.note = ""
          }

          return result
        } else {
          result.workUnit = 'N'

          if (request == '+c') {
            result.workUnit = '-'
          }

          if (request == '+s') {
            result.workUnit = '-'
          }
        }



      }

      if (timeToMinutes(timeIn) <= timeToMinutes('13:30') && timeToMinutes(timeIn) >= timeToMinutes('10:30')) {

        if (timeToMinutes(timeOut) >= timeToMinutes('17:30')) {
          result.workUnit = '-'

          if (request == '+s') {
            result.workUnit = '+'
          }
          // Nếu nghỉ sáng (-s), vào đúng giờ và ra đúng giờ → không muộn
          if (request == '-s') {
            result.workUnit = '-'
          }

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('15:30')) {
          result.workUnit = '-'

          // Với -s: vào trước 13:30 là OK, nhưng ra trước 17:30 là VỀ SỚM
          if (request == '-s') {
            // Ra trước 17:30 = về sớm → đánh Muộn
            result.note = "Muộn "
          } else if (request != '+c') {
            // Người bình thường vào sau 10:30 = muộn
            result.note += "Muộn "
          }

          if (request == '+s') {
            result.workUnit = '+'
          }

          return result

        } else {
          result.workUnit = 'N'

          if (request == '+s' || request == '+c') {
            result.workUnit = '-'
          }
          // Nếu nghỉ sáng, về trước 15:30 là về quá sớm
          if (request == '-s') {
            result.workUnit = '-'
            result.note = "Muộn " // Về sớm quá nhiều
          }

          return result
        }

      } else if (timeToMinutes(timeIn) > timeToMinutes('13:30') && timeToMinutes(timeIn) <= timeToMinutes('15:30')) {

        // Với -s (nghỉ sáng), họ chỉ cần đến 13:30, nên vào sau 13:30 là muộn
        // Với -c (nghỉ chiều), họ không cần đến buổi chiều
        if (request == '-s') {
          result.note = 'Muộn '
        } else if (request != '-c') {
          result.note += 'Muộn '
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('17:30')) {

          result.workUnit = '-'

          if (request == '+c' || request == '-s') {
            result.note = ''
            if (request == '-s') {
              result.note = 'Muộn ' // Vẫn muộn vì vào sau 13:30
            }
          }

          if (request == '+s') {
            result.workUnit = '+'
          }

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('15:30')) {

          result.note += 'Muộn '

          var sum = timeToMinutes(timeOut) - timeToMinutes(timeIn)

          if (sum >= 120) {

            result.workUnit = '-'

            if (request == '+s') {
              result.workUnit = '+'
            } else if (request == '+c' || request == '-s') {
              result.note = ''
              if (request == '-s') {
                result.note = 'Muộn Muộn' // Muộn vào + về sớm
              }
            }

          } else {

            if (request == '+s') {
              result.workUnit = '-'

            } else if (request == '+c') {
              result.workUnit = '-'

            } else if (request == '-s') {
              result.workUnit = '-'
              result.note = 'Muộn Muộn'
            } else {
              result.workUnit = 'N'

            }
            if (request != '-s') {
              result.note = ''
            }
          }

          return result
        } else {

          if (request == '+s') {
            result.workUnit = '-'

          } else if (request == '+c') {
            result.workUnit = '-'

          } else if (request == '-s') {
            result.workUnit = '-'
            result.note = 'Muộn '
          } else {
            result.workUnit = 'N'
          }

          if (request != '-s') {
            result.note = ''
          }
          return result
        }

      }

      if (timeToMinutes(timeIn) <= timeToMinutes('10:00') + additionTime) {

        result.note = 'Muộn '

        if (request == '+s') {
          result.note = ''
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('17:30') + additionTime) {

          result.workUnit = '+'
          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('15:30') + additionTime) {

          if (request != '+c') {
            result.note += 'Muộn '
          }

          result.workUnit = '+'

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('12:00') + additionTime) {
          result.workUnit = '-'

          if (request == '+c') {
            result.workUnit = '+'
          }

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('10:00') + additionTime) {

          result.note += "Muộn "

          if (request == '+s') {
            result.note = ''
            result.workUnit = '-'
            return result
          }

          if (request == '+c') {
            result.workUnit = '+'
            return result
          }

          var sum = timeToMinutes(timeOut) - timeToMinutes(timeIn)

          if (sum >= 120) {
            result.workUnit = '-'
          } else {
            result.workUnit = 'N'
            result.note = ''
          }

          return result
        } else {
          result.workUnit = 'N'

          if (request == '+c') {
            result.workUnit = '-'
          }

          if (request == '+s') {
            result.workUnit = '-'
          }
        }

      } else {

        if (timeToMinutes(timeOut) >= timeToMinutes('17:30') + additionTime) {

          if (request == '+s') {
            result.workUnit = '+'
          } else {
            result.workUnit = '-'
          }

          return result
        }

        if (timeToMinutes(timeOut) >= timeToMinutes('15:30') + additionTime) {

          if (request == '+s') {
            result.workUnit = '+'
          } else {
            result.workUnit = '-'
          }

          if (request != '+c') {
            result.note = "Muộn"
          }


          return result
        } else {

          if (request == '+s' || request == '+c') {
            result.workUnit = '-'
          } else {
            result.workUnit = 'N'
          }

          return result
        }

      }

    }

    // Có timeIn, không có timeOut
    if (timeIn != '' && timeOut == '') {

      if (timeToMinutes(timeIn) > timeToMinutes('15:30')) {
        return 'dia'
      }

      //Nghỉ chiều
      if (request == '-c') {
        if (timeToMinutes(timeIn) <= timeToMinutes('10:00') + additionTime) {

          result.note = 'Muộn'

          if (timeToMinutes(timeIn) <= timeToMinutes('8:00') + additionTime) {
            result.note = ''
          }

          result.workUnit = '-'
        } else {

          result.workUnit = 'N'
        }

        result.note += ' Quên'

        return result
      }

      //Nghỉ sáng
      if (request == '-s') {
        if (timeToMinutes(timeIn) < timeToMinutes('15:31')) {
          result.note = 'Muộn'

          if (timeToMinutes(timeIn) <= timeToMinutes('13:30')) {
            result.note = ''
          }

          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        result.note += ' Quên'

        return result
      }


      //+ sáng
      if (request == '+s') {
        if (timeToMinutes(timeIn) < timeToMinutes('15:31')) {
          result.workUnit = '+'

          result.note = 'Muộn'

          if (timeToMinutes(timeIn) <= timeToMinutes('13:30')) {
            result.note = ''
          }

        } else {
          result.workUnit = '-'
        }

        result.note += ' Quên'
        return result
      }

      //+ chiều
      if (request == '+c') {
        if (timeToMinutes(timeIn) < timeToMinutes('10:01') + additionTime) {
          result.workUnit = '+'

          result.note = 'Muộn'

          if (timeToMinutes(timeIn) <= timeToMinutes('8:00') + additionTime) {
            result.note = ''
          }

        } else {
          result.workUnit = '-'
        }

        return result
      }

      //không request
      if (request == '') {
        if (timeToMinutes(timeIn) < timeToMinutes('10:01') + additionTime) {
          result.workUnit = '+'

          result.note = 'Muộn'
          if (timeToMinutes(timeIn) <= timeToMinutes('8:00') + additionTime) {

            result.note = ''
          }

        } else if (timeToMinutes(timeIn) < timeToMinutes('15:31')) {
          result.workUnit = '-'

          result.note = 'Muộn'
          if (timeToMinutes(timeIn) <= timeToMinutes('13:30')) {
            result.note = ''
          }
        } else {
          result.workUnit = 'N'
          return result
        }

        result.note += ' Quên'

        return result
      }
    }

    //Không có timeIn, có timeOut
    if (timeIn == '' && timeOut != '') {

      //Nghỉ chiều
      if (request == '-c') {
        if (timeToMinutes(timeOut) > timeToMinutes('9:59') + additionTime) {

          result.note = 'Muộn'
          if (timeToMinutes(timeOut) >= timeToMinutes('12:00') + additionTime) {

            result.note = ''
          }


          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        result.note += ' Quên'

        return result
      }

      //Nghỉ sáng
      if (request == '-s') {
        if (timeToMinutes(timeOut) > timeToMinutes('15:29')) {

          result.note = 'Muộn'
          if (timeToMinutes(timeOut) >= timeToMinutes('17:30')) {
            result.note = ''

          }

          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
        }

        result.note += ' Quên'

        return result
      }


      //+ sáng
      if (request == '+s') {
        if (timeToMinutes(timeOut) > timeToMinutes('15:29') + additionTime) {

          result.note = 'Muộn'

          if (timeToMinutes(timeOut) >= timeToMinutes('17:30') + additionTime) {
            result.note = ''
          }

          result.workUnit = '+'
        } else {
          result.workUnit = '-'
        }

        return result
      }

      //+ chiều
      if (request == '+c') {
        if (timeToMinutes(timeOut) > timeToMinutes('9:59') + additionTime) {

          result.note = 'Muộn'
          if (timeToMinutes(timeOut) >= timeToMinutes('12:00') + additionTime) {
            result.note = ''
          }

          result.workUnit = '+'
        } else {
          result.workUnit = '-'
        }

        result.note += ' Quên'
        return result
      }

      //không request
      if (request == '') {

        result.note = 'Quên '

        if (timeToMinutes(timeOut) > timeToMinutes('15:29') + additionTime) {
          result.note += 'Muộn'

          if (timeToMinutes(timeOut) >= timeToMinutes('17:30') + additionTime) {
            result.note = 'Quên '
          }

          result.workUnit = '+'
        } else if (timeToMinutes(timeOut) > timeToMinutes('9:59') + additionTime) {

          result.note += 'Muộn'

          if (timeToMinutes(timeOut) >= timeToMinutes('12:00') + additionTime) {
            result.note = 'Quên '
          }

          result.workUnit = '-'
        } else {
          result.workUnit = 'N'
          result.note = ''
        }


        return result
      }

    }

    return result
  }


}


// === 1.3.1 ===
function compareTimesIn(time, worktime) {
  if (time == "" || time === 'undefined' || time === null) {
    return "-1"
  }

  function timeToMinutes(time) {
    var parts = time.trim().split(":"); // Xóa khoảng trắng thừa
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  var minutes = timeToMinutes(time);
  var minutesMark = timeToMinutes(worktime) + additionTime;

  if (minutes <= minutesMark) {
    return true
  } else {
    return false
  }
}

// === 1.3.2 ===
function compareTimesOut(time, worktime) {
  if (time == "" || time === 'undefined' || time === null) {
    return "-1"
  }

  function timeToMinutes(time) {
    var parts = time.trim().split(":"); // Xóa khoảng trắng thừa
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  var minutes = timeToMinutes(time);
  var minutesMark = timeToMinutes(worktime) + additionTime;

  if (minutes >= minutesMark) {
    return true
  } else {
    return false
  }
}

// === 1.3.3 ===
function checkLateAndEarly(checkInTime, checkOutTime, requiredCheckin, requiredCheckout) {
  // Quy định thời gian vào làm và ra về
  var requiredCheckIn = requiredCheckin;
  var requiredCheckOut = requiredCheckout;
  var maxAllowedMinutes = 120; // Giới hạn tổng thời gian trễ + sớm: 120 phút

  // Chuyển thời gian thành phút để tính toán
  // Tách giờ và phút từ chuỗi thời gian (dạng "HH:MM")
  function timeToMinutes(time) {
    var parts = time.split(':');
    var hours = parseInt(parts[0], 10);
    var minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes; // Chuyển thành phút
  }

  // Chuyển các thời gian thành phút
  var checkInMinutes = timeToMinutes(checkInTime); // Thời gian vào làm thực tế
  var checkOutMinutes = timeToMinutes(checkOutTime); // Thời gian ra về thực tế
  var requiredCheckInMinutes = timeToMinutes(requiredCheckIn) + additionTime; // 08:00 = 480 phút
  var requiredCheckOutMinutes = timeToMinutes(requiredCheckOut) + additionTime; // 17:30 = 1050 phút

  // Tính thời gian đi trễ (nếu vào sau 08:00)
  var lateMinutes = 0;
  if (checkInMinutes > requiredCheckInMinutes) {
    lateMinutes = checkInMinutes - requiredCheckInMinutes;
  }

  // Tính thời gian về sớm (nếu ra trước 17:30)
  var earlyMinutes = 0;
  if (checkOutMinutes < requiredCheckOutMinutes) {
    earlyMinutes = requiredCheckOutMinutes - checkOutMinutes;
  }

  // Tính tổng thời gian đi trễ + về sớm
  var totalViolationMinutes = lateMinutes + earlyMinutes;

  // Kiểm tra xem tổng thời gian có vượt quá 120 phút không
  var exceedsLimit = totalViolationMinutes > maxAllowedMinutes;

  return exceedsLimit;
}

// === 1.3.4 ===
function identifyShift(checkInTime, checkOutTime) {
  // Kiểm tra nếu ô trống hoặc không đúng định dạng
  if (!checkInTime || !checkOutTime) {
    return;
  }

  // Quy định thời gian các ca
  var fullDayStart = '08:00'; // Ca cả ngày: bắt đầu 08:00
  var fullDayEnd = '17:30';   // Ca cả ngày: kết thúc 17:30
  var morningStart = '08:00'; // Ca sáng: bắt đầu 08:00
  var morningEnd = '12:00';   // Ca sáng: kết thúc 12:00
  var afternoonStart = '13:30'; // Ca chiều: bắt đầu 13:30
  var afternoonEnd = '17:30';   // Ca chiều: kết thúc 17:30

  // Chuyển các thời gian thành phút để so sánh
  var checkInMinutes = timeToMinutes(checkInTime);
  var checkOutMinutes = timeToMinutes(checkOutTime);
  var fullDayStartMinutes = timeToMinutes(fullDayStart) + additionTime; // 08:00 = 480 phút
  var fullDayEndMinutes = timeToMinutes(fullDayEnd) + additionTime;     // 17:30 = 1050 phút
  var morningStartMinutes = timeToMinutes(morningStart) + additionTime; // 08:00 = 480 phút
  var morningEndMinutes = timeToMinutes(morningEnd) + additionTime;     // 12:00 = 720 phút
  var afternoonStartMinutes = timeToMinutes(afternoonStart) + additionTime; // 13:30 = 810 phút
  var afternoonEndMinutes = timeToMinutes(afternoonEnd) + additionTime;     // 17:30 = 1050 phút

  // Kiểm tra ca cả ngày: 08:00 - 17:30
  if (checkInMinutes <= fullDayStartMinutes + 119 && checkOutMinutes >= fullDayEndMinutes - 240) {
    return 'F'
  }
  // Kiểm tra ca sáng: 08:00 - 12:00
  else if (checkInMinutes <= morningStartMinutes + 119 && checkOutMinutes <= morningEndMinutes + 89 && checkOutMinutes >= morningEndMinutes - 119) {
    return 'S'
  }
  // Kiểm tra ca chiều: 13:30 - 17:30
  else if (checkInMinutes <= afternoonStartMinutes + 119 && checkInMinutes >= afternoonStartMinutes - 89 && checkOutMinutes >= afternoonEndMinutes - 119) {
    return 'C'
  }

  return 'U';
}

// === 1.3.4.1 ===
// Hàm phụ: Chuyển thời gian dạng "HH:MM" thành phút
function timeToMinutes(time) {
  if (!time) return 0;
  if (Object.prototype.toString.call(time) === '[object Date]') {
    return time.getHours() * 60 + time.getMinutes();
  }
  var parts = String(time).split(':');
  if (parts.length < 2) return 0;
  var hours = parseInt(parts[0], 10) || 0;
  var minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

//============================== FUNCTION OVERTIME ===========================================================================================

function addOT() {
  // ===== CẤU HÌNH =====
  // ID file Google Sheet chứa form đăng ký OT (sheet tab tên "2026")
  var sourceFileId = "1V6KdebLwMcL7TEaF-UmSGtAB_JBExRP_yw6MA8HOSmU";
  var sourceSheetName = "2026";

  // Cấu trúc sheet "2026" (theo debug thực tế):
  //   Col A (1): (trống)
  //   Col B (2): (trống)
  //   Col C (3): Họ và tên          ← tên nhân viên
  //   Col D (4): Date of Registration ← ngày làm OT
  //   Col E (5): Days of week
  //   Col F (6): From               ← giờ bắt đầu OT
  //   Col G (7): To                 ← giờ kết thúc OT
  //   Col H (8): Phòng ban
  //   Col I (9): Dự án
  //   Col J (10): Nội dung công việc
  //   Col K (11): Công ty
  //   Col L (12): Accept by Manager ← nhập "ok" = đã duyệt
  //   Col M (13): Check by Accountant

  var sourceFile = SpreadsheetApp.openById(sourceFileId);
  var sourceSheet = sourceFile.getSheetByName(sourceSheetName);

  if (!sourceSheet) {
    SpreadsheetApp.getUi().alert("Không tìm thấy sheet: " + sourceSheetName);
    return;
  }

  var lastRow = sourceSheet.getLastRow();
  var dataRowCount = lastRow - 1; // bỏ dòng header (row 1)

  if (dataRowCount <= 0) {
    Logger.log("Không có dữ liệu OT.");
    return;
  }

  // Đọc dữ liệu từ row 2 — cột căn chỉnh theo debug thực tế
  var nameColumn = sourceSheet.getRange(2, 3, dataRowCount, 1).getValues();         // Col C(3): Tên
  var dayColumn = sourceSheet.getRange(2, 4, dataRowCount, 1).getValues();         // Col D(4): Ngày OT
  var timeBeginColumn = sourceSheet.getRange(2, 6, dataRowCount, 1).getDisplayValues(); // Col F(6): From
  var timeEndColumn = sourceSheet.getRange(2, 7, dataRowCount, 1).getDisplayValues(); // Col G(7): To
  var acceptColumn = sourceSheet.getRange(2, 12, dataRowCount, 1).getValues();        // Col L(12): Accept by Manager

  var data = [];

  // ===== DEBUG: In raw data 10 dòng đầu để kiểm tra cột =====
  Logger.log("=== DEBUG OT SHEET (lastRow=" + lastRow + ", dataRowCount=" + dataRowCount + ") ===");
  for (var di = 0; di < Math.min(dataRowCount, 10); di++) {
    Logger.log(
      "Row " + (di + 2) + ": " +
      "C(name)='" + nameColumn[di][0] + "' | " +
      "D(day)='" + dayColumn[di][0] + "' | " +
      "F(from)='" + timeBeginColumn[di][0] + "' | " +
      "G(to)='" + timeEndColumn[di][0] + "' | " +
      "L(accept)='" + acceptColumn[di][0] + "'"
    );
  }
  Logger.log("=== END DEBUG ===");
  // ===========================================================

  for (var i = 0; i < dataRowCount; i++) {
    var empName = String(nameColumn[i][0]).trim();
    var otDay = dayColumn[i][0];
    var timeBegin = String(timeBeginColumn[i][0]).trim();
    var timeEnd = String(timeEndColumn[i][0]).trim();
    var accepted = String(acceptColumn[i][0]).toLowerCase().trim();

    // Chỉ lấy dòng Manager đã duyệt (cột K = "ok") và có đủ dữ liệu
    if (empName !== '' && otDay !== '' && timeBegin !== '' && timeEnd !== '' && accepted === 'ok') {
      var formattedBegin = formatTime(timeBegin);
      var formattedEnd = formatTime(timeEnd);

      if (!formattedBegin || !formattedEnd) continue; // bỏ qua nếu parse giờ lỗi

      data.push({
        day: formatDate(otDay),
        name: empName,
        timeBegin: formattedBegin,
        timeEnd: formattedEnd,
      });
      Logger.log("✅ OT: " + empName + " | " + formatDate(otDay) + " | " + formattedBegin + "→" + formattedEnd);
    }
  }

  Logger.log("Tổng OT đã duyệt: " + data.length);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet1 = ss.getSheetByName('Working Time');

  var lastRowWT = sheet1.getLastRow();
  lRow = sheet1.getRange(2, 2, lastRowWT, 1).getValues(); // Cột B
  mRow = sheet1.getRange(2, 4, lastRowWT, 1).getValues(); // Cột D
  tRow = sheet1.getRange(2, 6, lastRowWT, 1).getValues(); // Cột F

  var sheet = ss.getSheetByName('Finger Print');

  var lastRowFP = sheet.getLastRow();
  var nameColumnDes = sheet.getRange(3, 1, lastRowFP - 2, 1).getValues(); // Cột A
  var dayColumnDes = sheet.getRange(3, 2, lastRowFP - 2, 1).getValues(); // Cột B
  var weekdayColumnDes = sheet.getRange(3, 3, lastRowFP - 2, 1).getValues(); // Cột C
  var checkio = sheet.getRange(3, 4, lastRowFP - 2, 2).getValues(); // Cột D, E

  // Xóa J và K trước khi ghi mới
  sheet.getRange(3, 10, lastRowFP - 2, 2).clearContent();

  // Hàm chuẩn hóa ngày về dạng "d/M/yyyy" bất kể format đầu vào
  function normalizeDate(val) {
    if (!val && val !== 0) return '';
    // Nếu là Date object
    if (Object.prototype.toString.call(val) === '[object Date]') {
      return val.getDate() + '/' + (val.getMonth() + 1) + '/' + val.getFullYear();
    }
    var s = String(val).trim();
    // Thử parse các format: d/M/yyyy, M/d/yyyy, yyyy/M/d
    var parts = s.split(/[\/\-\.]/);
    if (parts.length < 3) return s;
    var a = parseInt(parts[0], 10);
    var b = parseInt(parts[1], 10);
    var c = parseInt(parts[2], 10);
    // Nếu year ở đầu (yyyy/M/d)
    if (a > 100) return c + '/' + b + '/' + a;
    // Nếu month > 12 → đang là d/M/yyyy
    if (b > 12) return b + '/' + a + '/' + c; // swap sang d/M/yyyy
    // Nếu day > 12 → đang là M/d/yyyy (US format)
    if (a > 12) return a + '/' + b + '/' + c; // đã là d/M/yyyy
    // Không rõ format → giả định d/M/yyyy
    return a + '/' + b + '/' + c;
  }

  // Log tất cả OT entries để debug matching
  Logger.log("=== OT data sẽ ghi vào Finger Print ===");
  for (var dj = 0; dj < data.length; dj++) {
    Logger.log("  OT[" + dj + "]: name='" + data[dj].name + "' | day='" + data[dj].day + "' | " + data[dj].timeBegin + "→" + data[dj].timeEnd);
  }

  for (var i = 0; i < nameColumnDes.length; i++) {
    for (var j = 0; j < data.length; j++) {
      var sheetName = String(nameColumnDes[i][0]).trim();
      var sheetDay = normalizeDate(dayColumnDes[i][0]);
      var otDay = normalizeDate(data[j].day);

      if (sheetName === data[j].name && sheetDay === otDay) {
        var rowIndex = i + 3;
        sheet.getRange("J" + rowIndex).setValue("From " + data[j].timeBegin + " to " + data[j].timeEnd);
        var otHours = totalOvertime(
          nameColumnDes[i][0],
          data[j].timeBegin,
          data[j].timeEnd,
          normalizeSheetTime(checkio[i][0]),
          normalizeSheetTime(checkio[i][1]),
          weekdayColumnDes[i][0]
        );
        sheet.getRange("K" + rowIndex).setValue(otHours);
        Logger.log("  ✅ MATCH J" + rowIndex + " (" + sheetName + " | " + sheetDay + "): " + data[j].timeBegin + "→" + data[j].timeEnd + " = " + otHours + "h");
      }
    }
  }

  // Kiểm tra OT entries nào không match được
  Logger.log("=== Kiểm tra OT entries không match ===");
  for (var j = 0; j < data.length; j++) {
    var matched = false;
    var otDay = normalizeDate(data[j].day);
    for (var i = 0; i < nameColumnDes.length; i++) {
      var sheetName = String(nameColumnDes[i][0]).trim();
      var sheetDay = normalizeDate(dayColumnDes[i][0]);
      if (sheetName === data[j].name && sheetDay === otDay) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      Logger.log("  ⚠️ KHÔNG MATCH: name='" + data[j].name + "' | day='" + otDay + "'");
    }
  }

  Logger.log("✅ addOT hoàn tất.");
}

function tesssssssst() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet1 = ss.getSheetByName('Working Time');
  var lRow = sheet1.getRange(2, 2, 20, 1).getValues(); // Cột B = cột 2
  var mRow = sheet1.getRange(2, 4, 20, 1).getValues(); // Cột D = cột 4

  console.log(lRow, mRow)
}

//1.3
function totalOvertime(name, timeBegin, timeEnd, checkin, checkout, weekday) {
  console.log(lRow, mRow, tRow)
  var ts = handleEmployeeClass(name)

  var totalOT = timeToMinutes(timeEnd) - timeToMinutes(timeBegin)

  for (var i = 0; i < lRow.length; i++) {
    if (lRow[i][0] == name) {
      if (mRow[i][0] == "00") {
        if (timeToMinutes(timeBegin) == timeToMinutes('17:30')) {
          totalOT = totalOT - 30
        }
      } else if (mRow[i][0] == "30") {
        if (timeToMinutes(timeBegin) == timeToMinutes('18:00')) {
          totalOT = totalOT - 30
        }
      }
    }

  }

  if (totalOT > 500) {
    totalOT -= 90
  }

  var lateTotal = 0

  if (checkin) {

    if (weekday.trim() == 'Bảy' && timeToMinutes(timeBegin) < timeToMinutes('17:00')) {
      if (timeToMinutes(checkin) > timeToMinutes(timeBegin)) {
        lateTotal += (timeToMinutes(checkin) - timeToMinutes(timeBegin))
      }
    } else {
      var lateMinutes1 = (timeToMinutes('8:00') + additionTime) - timeToMinutes(checkin) // - -> xuly
      if (timeToMinutes('12:00') <= timeToMinutes(checkin)) {
        lateMinutes1 = timeToMinutes('13:30') - timeToMinutes(checkin) // - -> xuly
      }
      if (lateMinutes1 < 0) lateTotal -= lateMinutes1
    }

  }

  if (checkout) {
    if (weekday.trim() == 'Bảy') {
      if (timeToMinutes(checkout) < timeToMinutes(timeEnd)) {
        lateTotal += (timeToMinutes(timeEnd) - timeToMinutes(checkout))
      }
    } else {
      var lateMinutes2 = timeToMinutes(checkout) - (timeToMinutes(timeEnd))
      if (lateMinutes2 < 0) lateTotal -= lateMinutes2
    }

  }

  var a = totalOT - lateTotal
  var realOT = a < 0 ? 0 : a
  return convertMinutesToRoundedHours(realOT)
}

function convertMinutesToRoundedHours(minutes) {
  var rawHours = minutes / 60;
  var hours = Math.floor(rawHours);
  var decimal = rawHours - hours;

  // Xác định mốc làm tròn
  var rounded = 0;
  if (decimal < 0.125) {
    rounded = 0.00;
  } else if (decimal < 0.375) {
    rounded = 0.25;
  } else if (decimal < 0.625) {
    rounded = 0.50;
  } else if (decimal < 0.875) {
    rounded = 0.75;
  } else {
    hours += 1;
    rounded = 0.00;
  }

  var result = rounded === 0 ? hours.toString() : (hours + rounded).toFixed(2);
  return result.replace('.', ',');
}


// === 1.1 ===
function formatDate(dateString) {
  if (dateString instanceof Date) { // Kiểm tra xem có phải kiểu Date không
    var date = dateString;
    dateString = date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear();
  }

  return dateString
}

// === 1.2 ===
function formatTime(timeStr) {
  // Tách giờ, phút, giây và buổi (AM/PM)
  var parts = timeStr.trim().split(/[: ]/); // Tách theo dấu ":" và khoảng trắng
  var hour = parseInt(parts[0], 10);
  var minute = parseInt(parts[1], 10);
  var ampm = parts[3];

  // Chuyển sang 24 giờ
  if (ampm === 'PM' && hour < 12) {
    hour += 12;
  } else if (ampm === 'AM' && hour === 12) {
    hour = 24;
  }

  var hh = ('0' + hour).slice(-2);
  var mm = ('0' + minute).slice(-2);

  return hh + ':' + mm;
}


//============================== FUNCTION FILL REQUESTS =========================================================================================

function fillRequest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName('Finger Print');


  //=== 1.1 ===
  var lastRow = getLastRowInColumn(sheet, 12)

  var request = sheet.getRange('L3' + ":L" + lastRow).getValues(); // Cột L = cột 12
  var day = sheet.getRange('M3' + ":M" + lastRow).getValues(); // Cột M = cột 13

  //=== 1.2 ===
  // Lưu ý: `requests` có thể "nở" ra khi gặp dải ngày (vd 30/4 - 1/5).
  // Chỉ những dòng "ngày lễ" do bạn đặt ra trong bảng này mới được set H = 'Lễ'.
  // Tự động xác định số dòng ngày lễ: tính từ dòng đầu tiên cho đến khi gặp dòng Date trống.
  var HOLIDAY_INPUT_ROWS = 0
  for (var hi = 0; hi < day.length; hi++) {
    if (day[hi][0] === null || day[hi][0] === undefined || String(day[hi][0]).trim() === '') {
      break
    }
    HOLIDAY_INPUT_ROWS++
  }
  var requests = []
  for (var i = 0; i < request.length; i++) {
    var rawReq = request[i][0]
    var rawDay = day[i][0]
    var isHoliday = i < HOLIDAY_INPUT_ROWS

    // Bỏ qua dòng request không có ngày
    if (rawDay === null || rawDay === undefined || String(rawDay).trim() === '') {
      continue
    }

    if (rawDay && String(rawDay).length < 11) {
      requests.push({
        request: rawReq,
        day: rawDay,
        isHoliday: isHoliday,
      })
    } else {
      var date = String(rawDay).split(' - ')
      // Nếu không đúng format "dd/mm/yyyy - dd/mm/yyyy" thì bỏ qua để tránh lỗi
      if (!date || date.length < 2 || !date[0] || !date[1]) {
        continue
      }
      date = getDateRangeArray(date[0], date[1])

      for (var j = 0; j < date.length; j++) {
        requests.push({
          request: rawReq,
          day: date[j],
          isHoliday: isHoliday,
        })
      }
    }
  }

  var dom = sheet.getRange('B3' + ":B" + sheet.getLastRow()).getValues()
  var name = sheet.getRange('A3' + ":A" + sheet.getLastRow()).getValues()

  var row

  var checkboxName = sheet.getRange(3, 15, getLastRowInColumn(sheet, 15) - 2, 2).getValues()
  checkboxName = filterCheckBoxName(checkboxName)

  var internArr = checkIntern()

  for (var i = 0; i < requests.length; i++) {
    for (var j = 0; j < dom.length; j++) {

      if (requests[i].day == dom[j][0]) {
        row = j + 3

        if (!requests[i].isHoliday) {
          // Request "phần dưới" chỉ áp dụng cho nhân viên được tick ở cột O
          if (checkboxName != 0 && checkboxName.indexOf(name[j][0]) !== -1) {
            var value2 = String(requests[i].request).trim()
            var current2 = sheet.getRange("F" + row).getValue()
            if (current2 != "") {
              changeCellColor(row)
              value2 = value2 + ", " + current2
            }
            sheet.getRange("F" + row).setValue(value2)

            // Mặc định tính Full → set cột G = '+' nếu đang trống
            var currentReqType2 = String(sheet.getRange("G" + row).getDisplayValue() || '').trim()
            if (currentReqType2 === '') {
              sheet.getRange("G" + row).setValue('+')
            }

            // Không phải ngày lễ → bỏ dính 'Lễ' nếu có
            if (String(sheet.getRange('H' + row).getDisplayValue() || '').trim() === 'Lễ') {
              sheet.getRange('H' + row).setValue('')
              restoreDefaultCell('H' + row)
            }
          }
        } else {
          // Ngày Lễ: set cột H = Lễ cho tất cả (trừ intern) để Working date không ghi đè
          if (internArr.indexOf(name[j][0]) !== -1) {
            // do nothing
          } else {
            sheet.getRange("F" + row).setValue(String(requests[i].request).trim())
            sheet.getRange('H' + row).setValue('Lễ')
            restoreDefaultCell('H' + row)
          }
        }
      }
    }
  }
}

function checkIntern() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName('Working Time');

  var name = sheet.getRange('B2' + ":B" + sheet.getLastRow()).getValues()
  var position = sheet.getRange('F2' + ":F" + sheet.getLastRow()).getValues()

  var result = []

  for (var i = 0; i < name.length; i++) {
    if (position[i][0].trim() == 'Intern') {
      result.push(name[i][0].trim())
    }
  }

  return result
}

function tesst() {

  var a = checkIntern()
  console.log(typeof a)
}

function filterCheckBoxName(checkboxName) {
  var arr = []

  for (var i = 0; i < checkboxName.length; i++) {
    if (checkboxName[i][0]) {
      arr.push(checkboxName[i][1])
    }
  }

  return arr

}

//=== 1.1 ===
function getLastRowInColumn(sheet, column) {
  var values = sheet.getRange(1, column, sheet.getLastRow()).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== "") {
      return i + 1; // vì chỉ số mảng bắt đầu từ 0
    }
  }
  return 0; // nếu không có dữ liệu
}

//=== 1.2 ===
function getDateRangeArray(startDateStr, endDateStr) {
  function parseDate(str) {
    var parts = str.split("/");
    return new Date(parts[2], parts[1] - 1, parts[0]); // năm, tháng (bắt đầu từ 0), ngày
  }

  var startDate = parseDate(startDateStr);
  var endDate = parseDate(endDateStr);
  var dateArray = [];

  while (startDate <= endDate) {
    var current = new Date(startDate); // tạo bản sao để không ảnh hưởng vòng lặp
    dateArray.push(Utilities.formatDate(current, Session.getScriptTimeZone(), "d/M/yyyy"));
    startDate.setDate(startDate.getDate() + 1);
  }

  return dateArray;
}


//============================== FUNCTION Bảng chi tiết chấm công SHEET =======================================================================

function handleMonthlyDay() {
  var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sourceSheet.getRange('H4').setValue('Running...');
  SpreadsheetApp.flush(); // Hiển thị ngay lên UI

  try {
    var lastRow = sourceSheet.getLastRow();

    // ✅ Fix 1: Show toàn bộ rows 1 lần thay vì từng dòng
    sourceSheet.showRows(1, lastRow);

    var month = sourceSheet.getRange('I1').getValue() * 1;
    var year = sourceSheet.getRange('I2').getValue() * 1;
    var days = getSoNgayTrongThang(month, year) * 1;

    // Ghi ngày vào cột A (rows 5 đến 5+days-1)
    var dateValues = [];
    for (var i = 0; i < days; i++) {
      var day = i + 1;
      dateValues.push([day + '/' + month + '/' + year]);
    }
    sourceSheet.getRange(5, 1, dateValues.length, 1).setValues(dateValues);

    // ✅ Fix 2: Đọc toàn bộ cột A 1 lần, gom các dòng cần ẩn, hide batch
    var dayColumns = sourceSheet.getRange(1, 1, lastRow, 1).getValues();

    var hideStart = -1;
    var rowsToHide = []; // lưu các đoạn [start, count]

    for (var i = 0; i < dayColumns.length; i++) {
      var val = dayColumns[i][0];
      var shouldHide = false;

      if (isValidDate(String(val))) {
        var parts = String(val).split('/');
        if (parseInt(parts[1], 10) != month) {
          shouldHide = true;
        }
      }

      if (shouldHide) {
        if (hideStart === -1) hideStart = i + 1; // 1-based
      } else {
        if (hideStart !== -1) {
          rowsToHide.push([hideStart, (i + 1) - hideStart]);
          hideStart = -1;
        }
      }
    }
    // Đóng đoạn cuối nếu còn
    if (hideStart !== -1) {
      rowsToHide.push([hideStart, lastRow - hideStart + 1]);
    }

    // Gọi hideRows theo từng đoạn liên tiếp (ít lần gọi API nhất)
    for (var k = 0; k < rowsToHide.length; k++) {
      sourceSheet.hideRows(rowsToHide[k][0], rowsToHide[k][1]);
    }

  } catch (error) {
    sourceSheet.getRange('H4').setValue('Error: ' + error.message);
    return;
  }

  sourceSheet.getRange('H4').setValue('');
}

function getSoNgayTrongThang(thang, nam) {
  return new Date(nam, thang, 0).getDate();
}

function isValidDate(dateString) {
  // Kiểm tra chuỗi rỗng hoặc không phải kiểu chuỗi
  if (!dateString || typeof dateString !== 'string') return false;

  // Regex: kiểm tra đúng định dạng dd/mm/yyyy
  var regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  var match = dateString.match(regex);
  if (!match) return false;

  var day = parseInt(match[1], 10);
  var month = parseInt(match[2], 10);
  var year = parseInt(match[3], 10);

  // Tạo đối tượng ngày
  var date = new Date(year, month - 1, day);

  // Kiểm tra lại các thành phần
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}


//============================== FUNCTION 200 AI ================================================================================================

function getCurrentMonth() {
  const now = new Date();
  return now.getMonth() + 1; // getMonth() trả về từ 0–11
}

function getCurrentDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based, tức là tháng 5 là 4
  return new Date(year, month + 1, 0).getDate();
}

function exportToDoc() {
  var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var lastRow = sourceSheet.getLastRow();

  var nameColumn = sourceSheet.getRange(3, 1, lastRow - 3, 1).getValues(); // Cột A
  var dayColumn = sourceSheet.getRange(3, 2, lastRow - 3, 1).getValues(); // Cột B
  var timeInColumn = sourceSheet.getRange(3, 4, lastRow - 3, 1).getValues(); // Cột D
  var timeOutColumn = sourceSheet.getRange(3, 5, lastRow - 3, 1).getValues(); // Cột E
  var requestColumn = sourceSheet.getRange(3, 6, lastRow - 3, 1).getValues(); // Cột F

  var detailColumn = sourceSheet.getRange(3, 9, lastRow - 3, 1).getValues(); // Cột I

  var ten = sourceSheet.getRange(3, 16, 33, 1).getValues(); // Cột P = cột 16
  var muon = sourceSheet.getRange(3, 17, 33, 1).getValues(); // Cột Q = cột 17
  var quen = sourceSheet.getRange(3, 18, 33, 1).getValues(); // Cột R = cột 18
  var cong = sourceSheet.getRange(3, 19, 33, 1).getValues(); // Cột S = cột 19
  var sophutmuon = sourceSheet.getRange(3, 20, 33, 1).getValues(); // Cột T = cột 20

  var stringObj = 'Dữ liệu chấm công tháng ' + getCurrentMonth() + ' của nhân viên. \n'

  var stack = 0

  for (var i = 0; i < nameColumn.length; i++) {
    if (i == stack) {

      for (var j = 0; j < ten.length; j++) {

        if (ten[j][0] == nameColumn[i][0]) {
          stringObj += 'Tên nhân viên: ' + ten[j][0] + ', Số lần muộn: ' + muon[j][0] + ', Số lần quên (quên chấm công): ' + quen[j][0] + ', Tổng công: ' + cong[j][0] + ', Số phút muộn: ' + sophutmuon[j][0] + '. Chi tiết từng ngày: \n'
        }

      }

      stack += getCurrentDay()
    }

    if (timeToMinutes(timeInColumn[i][0]) > timeToMinutes('16:00')) {
      timeOutColumn[i][0] = timeInColumn[i][0]
      timeInColumn[i][0] = ''
    }

    if (timeInColumn[i][0] || timeOutColumn[i][0] || requestColumn[i][0] || detailColumn[i][0]) {
      stringObj += 'Ngày:' + dayColumn[i][0] + ', Check in: ' + timeInColumn[i][0] + ', Checkout: ' + timeOutColumn[i][0] + ', Lý do: ' + requestColumn[i][0] + ', Ghi chú: ' + detailColumn[i][0] + '\n'
    }


  }

  var docId = '1Nd3Yq5HVD6dx5Igy7nGBk355b_ousGoR_EN4zptMAfs';
  var body = DocumentApp.openById(docId).getBody();

  body.clear()
  body.setText(stringObj)
}

//============================== FUNCTION GROSS WORK =========================================================================================

function ngaySauKhiTru() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // tháng từ 0-11

  // Lấy tổng số ngày trong tháng hiện tại
  const totalDays = new Date(year, month + 1, 0).getDate();

  var soChuNhat = 0;

  for (var day = 1; day <= totalDays; day++) {
    var date = new Date(year, month, day);
    var dayOfWeek = date.getDay();
    if (dayOfWeek === 0) {
      soChuNhat++;
    }
  }

  const ketQua = totalDays - soChuNhat - 2;
  return ketQua >= 0 ? ketQua : 0;
}

function grossWork() {
  var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var lastRow = sourceSheet.getLastRow();

  var wColumn = sourceSheet.getRange(3, 8, lastRow - 2, 1).getValues(); // Cột H
  var nameColumn = sourceSheet.getRange(3, 1, lastRow - 2, 1).getValues(); // Cột A

  var warray = []

  var gross = 0

  Logger.log(0)
  for (var i = 0; i < wColumn.length; i++) {
    if (wColumn[i][0].trim() == 'Full' || wColumn[i][0].trim() == 'Lễ') {
      gross += 1
    } else if (wColumn[i][0].trim() == 'Nửa') {
      gross += 0.5
    }

    if (i != wColumn.length - 1) {
      if (nameColumn[i][0] != nameColumn[i + 1][0]) {
        warray.push(gross)
        gross = 0
      }
    } else {
      warray.push(gross)
      gross = 0
    }
    // if (i == wColumn.length - 1) {
    //   warray.push(gross)
    //   gross = 0
    // } else if(nameColumn[i][0] != nameColumn[i+1][0]) {
    //   warray.push(gross)
    //   gross = 0
    // }
  }

  for (var i = 0; i < warray.length; i++) {
    var row = i + 3
    sourceSheet.getRange('S' + row).setValue(warray[i] + '/' + ngaySauKhiTru());
  }
}

//Automatic change
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();
  var range = e.range;

  if (sheetName === "Finger Print") {
    if (range.getColumn() === 8) { // H
      grossWork();
    }
    if (range.getColumn() === 1) { // A
      refreshSummary(); // Refresh toàn bộ bảng thống kê (P, S, T, V)
    }
    if (range.getColumn() === 1) { // A
      sortName();
      grossWork(); // Cập nhật tổng công khi thay tên nhân viên
      handleTotalLateMinuteday(); // Cập nhật phút muộn
    }
  } else if (sheetName === "Staff Confirm") {
    if (range.getColumn() === 9) { // I
      var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      sourceSheet.getRange('H4').setValue('Running...');
      handleMonthlyDay()
      sourceSheet.getRange('H4').setValue('');
    }
  }


}



//============================== FUNCTION SORT NAME =============================================================================================
function layGiaTriDocNhat(arr) {
  var ketQua = [];
  for (var i = 0; i < arr.length; i++) {
    if (ketQua.indexOf(arr[i][0]) === -1) {
      ketQua.push(arr[i][0]);
    }
  }
  return ketQua;
}


function sortName() {
  var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sourceSheet.getLastRow();

  if (lastRow >= 3) {
    sourceSheet.getRange(3, 16, lastRow - 2, 1).clearContent(); // cột P = 16
  }

  var nameColumn = sourceSheet.getRange(3, 1, lastRow - 2, 1).getValues(); // Cột A

  var names = layGiaTriDocNhat(nameColumn)

  for (var i = 0; i < names.length; i++) {
    var row = i + 3
    sourceSheet.getRange('P' + row).setValue(names[i]);
  }
}


//============================== FUNCTION MINUTE / TOTAL LATE DAY ===============================================================================
function handleTotalLateMinuteday() {
  // A D E I

  var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sourceSheet.getLastRow();
  var nameColumn = sourceSheet.getRange(3, 1, lastRow - 2, 1).getValues(); // Cột A
  var timeInColumn = sourceSheet.getRange(3, 4, lastRow - 2, 1).getValues(); // Cột D
  var timeOutColumn = sourceSheet.getRange(3, 5, lastRow - 2, 1).getValues(); // Cột E
  var typeColumn = sourceSheet.getRange(3, 7, lastRow - 2, 1).getValues(); // Cột G
  var detailColumn = sourceSheet.getRange(3, 9, lastRow - 2, 1).getValues(); // Cột I

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet1 = ss.getSheetByName('Working Time');

  var lastRow = sheet1.getLastRow();
  lRow = sheet1.getRange(2, 2, lastRow, 1).getValues(); // Cột B = cột 2
  mRow = sheet1.getRange(2, 4, lastRow, 1).getValues(); // Cột D = cột 4
  tRow = sheet1.getRange(2, 6, lastRow, 1).getValues(); // Cột F = cột 6

  var stack = getCurrentDay()

  var data = []

  var tempTotal = 0;

  for (var i = 0; i < nameColumn.length; i++) {
    if (typeColumn[i][0].trim() == '+') {

    } else {
      if (detailColumn[i][0].trim() == 'Muộn' || detailColumn[i][0].trim() == 'Quên Muộn' || detailColumn[i][0].trim() == 'Muộn Muộn' || detailColumn[i][0].trim() == 'Muộn Quên') {

        var ts = handleEmployeeClass(nameColumn[i][0])
        var requestType = typeColumn[i][0].trim();

        if (ts == -1) {
          // Tính phút đi muộn (check in)
          if (timeInColumn[i][0] != '' && requestType != '+s' && requestType != '+') {
            var timeIn = timeToMinutes(timeInColumn[i][0]);

            // Nếu nghỉ sáng (-s), chỉ tính muộn so với 13:30
            if (requestType == '-s') {
              if (timeIn > timeToMinutes('13:30')) {
                var temp = timeIn - timeToMinutes('13:30');
                if (temp > 0) {
                  tempTotal += temp;
                }
              }
            } else if (timeIn > timeToMinutes('16:00')) {
              var temp = timeIn - (timeToMinutes('17:30') + additionTime)
              if (temp < 0) {
                tempTotal -= temp
              }
            } else if (timeIn > timeToMinutes('12:30') && timeIn <= timeToMinutes('15:30')) {
              var temp = timeIn - (timeToMinutes('13:30'))
              if (temp > 0) {
                tempTotal += temp
              }
            } else {
              var temp = timeIn - (timeToMinutes('8:00') + additionTime)
              if (temp > 0) {
                tempTotal += temp
              }
            }
          }

          // Tính phút về sớm (check out)
          // Không tính nếu nghỉ chiều (-c) hoặc công ty chiều (+c)
          if (requestType != '+c' && requestType != '-c') {
            if (timeOutColumn[i][0] != '') {
              var timeOut = timeToMinutes(timeOutColumn[i][0]);

              // Nếu nghỉ sáng (-s), chỉ tính về sớm so với 17:30
              if (requestType == '-s') {
                var temp = timeOut - (timeToMinutes('17:30') + additionTime);
                if (temp < 0) {
                  tempTotal -= temp;
                }
              } else if (timeOut > timeToMinutes('10:00') && timeOut <= timeToMinutes('13:00')) {
                var temp = timeOut - (timeToMinutes('12:00') + additionTime)
                if (temp < 0) {
                  tempTotal -= temp
                }
              } else {
                var temp = timeOut - (timeToMinutes('17:30') + additionTime)
                if (temp < 0) {
                  tempTotal -= temp
                }
              }
            }
          }

        } else {
          // Thai sản
          if (timeInColumn[i][0] != '' && requestType != '-s') {
            var timeIn = timeToMinutes(timeInColumn[i][0]);
            if (timeIn > timeToMinutes('12:30') && timeIn <= timeToMinutes('15:30')) {
              var temp = timeIn - (timeToMinutes('13:30'))
              if (temp > 0) {
                tempTotal += temp
              }
            } else {
              var temp = timeIn - (timeToMinutes('8:00') + additionTime)
              if (temp > 0) {
                tempTotal += temp
              }
            }
          } else if (timeInColumn[i][0] != '' && requestType == '-s') {
            // Nghỉ sáng - chỉ tính muộn so với 13:30
            var timeIn = timeToMinutes(timeInColumn[i][0]);
            if (timeIn > timeToMinutes('13:30')) {
              var temp = timeIn - timeToMinutes('13:30');
              if (temp > 0) {
                tempTotal += temp;
              }
            }
          }
        }
      }

      // if(i == stack - 1) {
      //   // console.log(dayColumn[i][0], i + 3)
      //   data.push(tempTotal)
      //   tempTotal = 0
      //   stack+=getCurrentDay();
      // }

      if (i != nameColumn.length - 1) {
        if (nameColumn[i][0] != nameColumn[i + 1][0]) {
          data.push(tempTotal)
          tempTotal = 0
        }
      } else {
        data.push(tempTotal)
        tempTotal = 0
      }
    }
  }

  for (var i = 0; i < data.length; i++) {
    var row = i + 3
    sourceSheet.getRange('T' + row).setValue(data[i].toFixed(0) * 1 + ' phút');
  }
}

//============================== THU 7 ===============================================================================
function soNgayT7trongThang() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // tháng từ 0-11

  // Lấy tổng số ngày trong tháng hiện tại
  const totalDays = new Date(year, month + 1, 0).getDate();

  var count = 0;

  for (var day = 1; day <= totalDays; day++) {
    var date = new Date(year, month, day);
    var dayOfWeek = date.getDay();
    if (dayOfWeek === 6) {
      count++;
    }
  }

  count -= 2

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Finger Print');

  var lastRow = getLastRowInColumn(sheet, 19)

  for (var i = 3; i <= lastRow; i++) {
    sheet.getRange('V' + i).setValue(count)
  }


}

function getSaturdayLeaveQuota() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // tháng từ 0-11

  const totalDays = new Date(year, month + 1, 0).getDate();
  var saturdayCount = 0;

  for (var day = 1; day <= totalDays; day++) {
    var date = new Date(year, month, day);
    if (date.getDay() === 6) {
      saturdayCount++;
    }
  }

  var quota = saturdayCount - 2;
  return quota >= 0 ? quota : 0;
}

function handleCheckSaturday(data, rowIndex, ts) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Finger Print');

  if (String(sheet.getRange(rowIndex, 8).getDisplayValue()).trim() === 'Lễ') {
    return
  }

  var stack
  var index
  for (var i = 0; i < namess.length; i++) {
    if (namess[i][0] == data.name) {
      stack = stackss[i][0]
      index = i + 3
      break
    }
  }
  stack = Number(stack)
  if (isNaN(stack)) {
    stack = getSaturdayLeaveQuota()
    if (index !== undefined) {
      stackss[index - 3][0] = stack
    }
  }

  function persistStack(newVal) {
    stack = newVal
    if (index !== undefined) {
      stackss[index - 3][0] = stack
    }
  }

  var tin = normalizeSheetTime(data.timeIn)
  var tout = normalizeSheetTime(data.timeOut)
  var req = data.request == null || data.request === '' ? '' : String(data.request).trim()

  // Đủ check-in + check-out: đi làm đủ ngày → Full / Nửa / Nghỉ (theo ca)
  if (tin !== '' && tout !== '') {
    var detail = handleDetailClassification(data.day, tin, tout, req)

    if (detail == 'dia') {
      detail = handleDetailClassification(data.day, tout, tin, req)
    }

    restoreCellColor(rowIndex)

    if (detail.workUnit && String(detail.workUnit).trim() == '+') {
      detail.workUnit = 'Full'
    } else if (detail.workUnit && String(detail.workUnit).trim() == '-') {
      detail.workUnit = 'Nửa'
    } else if (detail.workUnit && String(detail.workUnit).trim() == 'N') {
      detail.workUnit = 'Nghỉ'
    }

    sheet.getRange('H' + rowIndex).setValue(String(detail.workUnit).trim())

    if (detail.workUnit == 'Nghỉ') {
      formatCell('H' + rowIndex.toFixed(0))
    } else {
      restoreDefaultCell('H' + rowIndex.toFixed(0))
    }

    if (ts != -1) {
      detail.note = ''
      if (tin === '' && tout === '') {
      } else if ((tin !== '' && tout === '') || (tin === '' && tout !== '')) {
        detail.note += 'Quên '
      }
      if (timeToMinutes(tin) > timeToMinutes('8:00') + additionTime) {
        detail.note += 'Muộn '
      }
    }

    var overtime1 = data.ot
    if (data.ot === '' || timeToMinutes(String(overtime1).slice(-4)) >= timeToMinutes('17:30')) {
      sheet.getRange('I' + rowIndex.toFixed(0)).setValue(String(detail.note).trim())
    }

    return
  }

  // Chỉ có một giờ (quên chấm một phần): giữ logic phân loại chi tiết
  if (tin !== '' || tout !== '') {
    var detail2 = handleDetailClassification(data.day, tin, tout, req)

    if (detail2 == 'dia') {
      detail2 = handleDetailClassification(data.day, tout, tin, req)
    }

    if (tout === '') {
      if (tin !== '') {
        changeCellColor(rowIndex)
      } else {
        restoreCellColor(rowIndex)
      }
    } else {
      restoreCellColor(rowIndex)
    }

    if (detail2.workUnit && String(detail2.workUnit).trim() == '+') {
      detail2.workUnit = 'Full'
    } else if (detail2.workUnit && String(detail2.workUnit).trim() == '-') {
      detail2.workUnit = 'Nửa'
    } else if (detail2.workUnit && String(detail2.workUnit).trim() == 'N') {
      detail2.workUnit = 'Nghỉ'
    }

    sheet.getRange('H' + rowIndex).setValue(String(detail2.workUnit).trim())

    if (detail2.workUnit == 'Nghỉ') {
      formatCell('H' + rowIndex.toFixed(0))
    } else {
      restoreDefaultCell('H' + rowIndex.toFixed(0))
    }

    if (ts != -1) {
      detail2.note = ''
      if (tin === '' && tout === '') {
      } else if ((tin !== '' && tout === '') || (tin === '' && tout !== '')) {
        detail2.note += 'Quên '
      }
      if (timeToMinutes(tin) > timeToMinutes('8:00') + additionTime) {
        detail2.note += 'Muộn '
      }
    }

    var overtime = data.ot
    if (data.ot === '' || timeToMinutes(String(overtime).slice(-4)) >= timeToMinutes('17:30')) {
      sheet.getRange('I' + rowIndex.toFixed(0)).setValue(String(detail2.note).trim())
    }

    return
  }

  // Không giờ vào/ra: thứ 7 so le — còn suất trong cột V → được phép nghỉ, hết suất → nghỉ
  restoreCellColor(rowIndex)
  if (stack > 0) {
    sheet.getRange('H' + rowIndex).setValue(' ')
    restoreDefaultCell('H' + rowIndex.toFixed(0))
    persistStack(stack - 1)
  } else {
    sheet.getRange('H' + rowIndex).setValue('nghỉ')
    formatCell('H' + rowIndex.toFixed(0))
  }
}

/**
 * Refresh lại toàn bộ bảng thống kê (P, Q, R, S, T, V)
 * Dùng khi xóa dòng hoặc muốn update lại bảng
 */
function refreshSummary() {
  try {
    var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // // 1. Clear bảng thống kê cũ
    // var lastRow = sourceSheet.getLastRow();
    // if (lastRow >= 3) {
    //   sourceSheet.getRange(3, 16, lastRow - 2, 6).clearContent(); // P-U
    // }

    // 2. Cập nhật cột P (Danh sách tên)
    sortName();

    // 3. Cập nhật tổng công (cột S)
    grossWork();

    // 4. Cập nhật tổng phút muộn (cột T)
    handleTotalLateMinuteday();

    // 5. Cập nhật số ngày T7 (cột V)
    soNgayT7trongThang();

    Logger.log("✅ Refresh bảng thống kê thành công!");
  } catch (e) {
    Logger.log("❌ Lỗi refresh: " + e.toString());
  }
}

