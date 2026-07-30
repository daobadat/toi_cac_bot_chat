
function copyTemplate(templateId) {

  var file = DriveApp.getFileById(templateId);
  var copiedFile = file.makeCopy();
  var documentId = copiedFile.getId();
  return documentId;
}

function createDocument() {
// MAKING CONTRACT
// Quy dinh vung lay du lieu

  var activeSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var tactics = Sheets.Spreadsheets.Values.get(activeSpreadsheetId, 'Dulieu!A3:BK3');
  var templateId = '10ZOD3IJeW-GseIWQesvvZKHqu2qO-fzwXDaP6m0NNqI';
  
  for(var i = 0; i < tactics.values.length; i++){
    
    var tennhanvien = tactics.values[i][25]; 
    var sohopdong = tactics.values[i][34];  
    //Make a copy of the template file
    var documentId = copyTemplate(templateId)
    
    //Rename the copied file
    DriveApp.getFileById(documentId).setName(tennhanvien + ' HDTV');
    
    //Get the document body as a variable
    var body = DocumentApp.openById(documentId).getBody(); 
    //Insert the supplier name
    //15 tencongty Value
    var tencongty = tactics.values[i][15];   
    body.replaceText('##tencongty##', tencongty) 
    //16 companynameeng Value
    var companynameeng = tactics.values[i][16];   
    body.replaceText('##companynameeng##', companynameeng) 
    //17 lanhdao Value
    var lanhdao = tactics.values[i][17];   
    body.replaceText('##lanhdao##', lanhdao) 
    //18 quoctichlanhdao Value
    var quoctichlanhdao = tactics.values[i][18];   
    body.replaceText('##quoctichlanhdao##', quoctichlanhdao) 
    //19 nationality Value
    var nationality = tactics.values[i][19];   
    body.replaceText('##nationality##', nationality) 
    //20 chucvu Value
    var chucvu = tactics.values[i][20];   
    body.replaceText('##chucvu##', chucvu) 
    //21 position Value
    var position = tactics.values[i][21];   
    body.replaceText('##position##', position) 
    //22 diachi Value
    var diachi = tactics.values[i][22];   
    body.replaceText('##diachi##', diachi) 
    //23 address Value
    var address = tactics.values[i][23];   
    body.replaceText('##address##', address) 
    //24 sodienthoai Value
    var sodienthoaict = tactics.values[i][24];   
    body.replaceText('##sodienthoaict##', sodienthoaict) 
    //25 tennhanvien Value
  
    body.replaceText('##tennhanvien##', tennhanvien) 
    //26 quoctich Value
    var quoctich = tactics.values[i][26];   
    body.replaceText('##quoctich##', quoctich) 
    //27 ngaysinh Value
    var ngaysinh = tactics.values[i][27];   
    body.replaceText('##ngaysinh##', ngaysinh) 
    //28 quequan Value
    var quequan = tactics.values[i][28];   
    body.replaceText('##quequan##', quequan) 
    //29 thuongtru Value
    var thuongtru = tactics.values[i][29];   
    body.replaceText('##thuongtru##', thuongtru) 
    //30 socmnd Value
    var socmnd = tactics.values[i][30];   
    body.replaceText('##socmnd##', socmnd) 
    //31 ngaycap Value
    var ngaycap = tactics.values[i][31];   
    body.replaceText('##ngaycap##', ngaycap) 
    //32 noicap Value
    var noicap = tactics.values[i][32];   
    body.replaceText('##noicap##', noicap) 
    //33 chuyenmon Value
    var chuyenmon = tactics.values[i][33];   
    body.replaceText('##chuyenmon##', chuyenmon) 
    //34 sohopdong Value
    body.replaceText('##sohopdong##', sohopdong) 
    //35 loaihopdong Value
    var loaihopdong = tactics.values[i][35];   
    body.replaceText('##loaihopdong##', loaihopdong) 
    //36 ngaykyhopdong Value
    var ngaykyhopdong = tactics.values[i][36];   
    body.replaceText('##ngaykyhopdong##', ngaykyhopdong) 
    //37 denngay Value
    var denngay = tactics.values[i][37];   
    body.replaceText('##denngay##', denngay) 
    //38 diadiemlamviec Value
    var diadiemlamviec = tactics.values[i][38];   
    body.replaceText('##diadiemlamviec##', diadiemlamviec) 
    //39 chucdanh Value
    var chucdanh = tactics.values[i][39];   
    body.replaceText('##chucdanh##', chucdanh) 
    //40 chucvu Value
    var chucvunv = tactics.values[i][40];   
    body.replaceText('##chucvunv##', chucvunv) 
    //41 mucluongchinh Value
    var mucluongchinh = tactics.values[i][41];   
    // Fallback: nếu mucluongchinh bị rỗng do API cắt ngắn hoặc ô Dulieu trống,
    // đọc trực tiếp từ ô nhập liệu trên form
    if (mucluongchinh === undefined || mucluongchinh === null || mucluongchinh.toString().trim() === '') {
      try {
        var activeSS = SpreadsheetApp.getActiveSpreadsheet();
        // Thử đọc trực tiếp từ sheet Dulieu, ô AP3 (cột 42)
        var dlSheet = activeSS.getSheetByName('Dulieu');
        if (dlSheet) {
          mucluongchinh = dlSheet.getRange(3, 42).getValue();
        }
        // Nếu vẫn trống, đọc từ sheet nhập liệu (form), ô C26
        if (!mucluongchinh || mucluongchinh.toString().trim() === '') {
          var inputSheetNames = ['Nhập dữ liệu', 'Nhap du lieu', 'Form', 'Input'];
          for (var s = 0; s < inputSheetNames.length; s++) {
            var inputSheet = activeSS.getSheetByName(inputSheetNames[s]);
            if (inputSheet) {
              mucluongchinh = inputSheet.getRange(26, 3).getValue(); // C26
              if (mucluongchinh && mucluongchinh.toString().trim() !== '') break;
            }
          }
        }
      } catch (e) {
        console.log('Không thể đọc mức lương chính fallback: ' + e.toString());
      }
    }
    // Đảm bảo mucluongchinh luôn là chuỗi hợp lệ
    if (mucluongchinh === undefined || mucluongchinh === null) mucluongchinh = '';
    body.replaceText('##mucluongchinh##', mucluongchinh.toString()) 
    //42 xang Value
    var xang = tactics.values[i][42];   
    body.replaceText('##xang##', xang) 
    //43 dienthoai Value
    var dienthoai = tactics.values[i][43];   
    body.replaceText('##dienthoai##', dienthoai) 
    //44 nhaokhac Value
    var nhaokhac = tactics.values[i][44];   
    body.replaceText('##nhaokhac##', nhaokhac) 
    //45 today Value
    var today = tactics.values[i][45];   
    body.replaceText('##today##', today) 
    //46 ngay Value
    var ngay = tactics.values[i][46];   
    body.replaceText('##ngay##', ngay) 
    //47 thang Value
    var thang = tactics.values[i][47];   
    body.replaceText('##thang##', thang) 
    //48 nam Value
    var nam = tactics.values[i][48];   
    body.replaceText('##nam##', nam) 
    var ngayhethd = tactics.values[i][53];   
    body.replaceText('##ngayhethd##', ngayhethd) 
    //47 thang Value
    var thanghethd = tactics.values[i][54];   
    body.replaceText('##thanghethd##', thanghethd) 
    //48 nam Value
    var namhethd = tactics.values[i][55];   
    body.replaceText('##namhethd##', namhethd)
    //56 residential address Value 
    var residentialaddress = tactics.values[i][56];   
    body.replaceText('##residentialaddress##', residentialaddress)
    //57 Individual tax code Value 
    var individualtaxcode = tactics.values[i][57];   
    body.replaceText('##mstcn##', individualtaxcode)
    //58 Insurance code Value 
    var insurancecode = tactics.values[i][58];   
    body.replaceText('##msbh##', insurancecode)
    
    //59 sdt Value 
    var sdt = tactics.values[i][59];   
    body.replaceText('##sdt##', sdt) 
    body.replaceText('##phonenum##', sdt)

    //60 degree Value 
    var degree = tactics.values[i][60];   
    body.replaceText('##degree##', degree)
    
    //61 title Value 
    var title = tactics.values[i][61];   
    body.replaceText('##title##', title)
    
    //62 position Value 
    var position = tactics.values[i][62];   
    body.replaceText('##positionvn##', position)

    // -------------------------------------------------------------
    // GHI DỮ LIỆU VÀO BẢNG THEO DÕI HỢP ĐỒNG
    // -------------------------------------------------------------
    try {
      var ss = SpreadsheetApp.openById('1mIkkYBZjG8ZLquWEKQJ_BinHr-6opJnbLGNyDOOfzCc');
      var targetSheet = findTargetSheet(ss);
      
      if (targetSheet) {
        var lastCol = targetSheet.getLastColumn();
        var headers = [];
        if (lastCol > 0) {
          headers = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        }
        
        // Xác định vị trí các cột dựa trên tên tiêu đề (không phân biệt hoa thường)
        var colTen = 1;
        var colCongTy = 2;
        var colLoaiHD = 3;
        var colNgayBatDau = 4;
        var colNgayKetThuc = 5;
        var colMucLuong = 6;
        var colLinkDraft = 7;
        
        if (headers.length > 0) {
          for (var col = 0; col < headers.length; col++) {
            var h = headers[col].toString().trim().toLowerCase();
            if (h === "tên" || h === "ten" || h.indexOf("tên") !== -1 || h.indexOf("ten") !== -1) {
              colTen = col + 1;
            } else if (h === "công ty" || h === "cong ty" || h.indexOf("công ty") !== -1 || h.indexOf("cong ty") !== -1) {
              colCongTy = col + 1;
            } else if (h === "loại hợp đồng" || h === "loai hop dong" || h === "loại hđ" || h.indexOf("loại hợp đồng") !== -1 || h.indexOf("loai hop dong") !== -1) {
              colLoaiHD = col + 1;
            } else if (h === "ngày bắt đầu" || h === "ngay bat dau" || h.indexOf("bắt đầu") !== -1 || h.indexOf("bat dau") !== -1) {
              colNgayBatDau = col + 1;
            } else if (h === "ngày kết thúc" || h === "ngay ket thuc" || h.indexOf("kết thúc") !== -1 || h.indexOf("ket thuc") !== -1 || h.indexOf("hết hạn") !== -1 || h.indexOf("het han") !== -1) {
              colNgayKetThuc = col + 1;
            } else if (h === "mức lương" || h === "mực lương" || h === "muc luong" || h === "lương" || h.indexOf("lương") !== -1 || h.indexOf("luong") !== -1 || h.indexOf("mực") !== -1) {
              colMucLuong = col + 1;
            } else if (h === "link draft" || h === "link file word" || h.indexOf("draft") !== -1 || h.indexOf("word") !== -1) {
              colLinkDraft = col + 1;
            }
          }
        }
        
        // Chuẩn bị dữ liệu hàng mới
        var maxColIndex = Math.max(colTen, colCongTy, colLoaiHD, colNgayBatDau, colNgayKetThuc, colMucLuong, colLinkDraft);
        var newRow = [];
        for (var col = 0; col < Math.max(maxColIndex, headers.length); col++) {
          newRow.push("");
        }
        
        // Phân loại viết tắt tên công ty
        var congTyAbbr = "";
        if (tencongty) {
          var nameLower = tencongty.toString().trim().toLowerCase();
          if (nameLower.indexOf("tập đoàn đầu tư và xây dựng add") !== -1 || nameLower === "công ty cổ phần tập đoàn đầu tư và xây dựng add") {
            congTyAbbr = "ADD";
          } else if (nameLower.indexOf("plan add việt nam") !== -1 || nameLower === "công ty tnhh plan add việt nam") {
            congTyAbbr = "VPA";
          } else if (nameLower.indexOf("art secret garden") !== -1 || nameLower === "công ty tnhh art secret garden") {
            congTyAbbr = "ASG";
          } else if (nameLower.indexOf("tym vina") !== -1 || nameLower === "công ty tnhh tym vina") {
            congTyAbbr = "TYM";
          } else {
            congTyAbbr = tencongty; // Giữ nguyên nếu không thuộc nhóm trên
          }
        }

        // Ngày hết hạn/kết thúc
        var ngayKetThuc = denngay || ngayhethd || "";
        
        var draftUrl = "https://docs.google.com/document/d/" + documentId + "/edit";
        
        newRow[colTen - 1] = tennhanvien || "";
        newRow[colCongTy - 1] = congTyAbbr; 
        newRow[colLoaiHD - 1] = "Hợp đồng thử việc";
        newRow[colNgayBatDau - 1] = formatDateToDMY(ngaykyhopdong);
        newRow[colNgayKetThuc - 1] = formatDateToDMY(ngayKetThuc);
        // mucluongchinh đã được xử lý fallback ở trên, sử dụng trực tiếp
        newRow[colMucLuong - 1] = mucluongchinh || "";
        newRow[colLinkDraft - 1] = draftUrl;
        
        targetSheet.appendRow(newRow);
        console.log("Đã ghi thông tin hợp đồng vào bảng theo dõi cho: " + tennhanvien);
      } else {
        console.log("Không tìm thấy bảng theo dõi hợp đồng.");
      }
    } catch (err) {
      console.log("Lỗi khi ghi thông tin vào bảng theo dõi hợp đồng: " + err.toString());
    }
  }

}

function parseTactics(headers, tactics, body){ 
  for(var i = 1; i < tactics.length; i++){
    {tactics[i] != '' && 
      body.appendListItem(headers[i] + ' | ' + tactics[i] + ' net').setGlyphType(DocumentApp.GlyphType.BULLET);
    }
  }
}

function test () {
  var activeSpreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var tactics = Sheets.Spreadsheets.Values.get(activeSpreadsheetId, 'Dulieu!A3:BK3');

  for(var i = 0; i < tactics.values[0].length; i++){
    console.log(tactics.values[0][i], i)

  }
}


// function createDocument() {
// // MAKING CONTRACT
// // Quy dinh vung lay du lieu
//   var headers = Sheets.Spreadsheets.Values.get('1KvMvIJnfPG-F0OLn0hFgBDgTerVZH4LQ6Bbc99C3n58', 'Dulieu!A2:BG2');
//   var tactics = Sheets.Spreadsheets.Values.get('1KvMvIJnfPG-F0OLn0hFgBDgTerVZH4LQ6Bbc99C3n58', 'Dulieu!A3:BG3');
//   var templateId = '1UPqVaLMpxFyaF0tEUPo1xQ8WCMk_SuMf3Akk9rLqjcM';
  
//   for(var i = 0; i < tactics.values.length; i++){
    
//     var tennhanvien = tactics.values[i][25]; 
//     var sohopdong = tactics.values[i][34];  
//     //Make a copy of the template file
//     var documentId = DriveApp.getFileById(templateId).makeCopy().getId();
    
//     //Rename the copied file
//     DriveApp.getFileById(documentId).setName(tennhanvien + ' HDTV ');
    
//     //Get the document body as a variable
//     var body = DocumentApp.openById(documentId).getBody(); 
//     //Insert the supplier name
//     //15 tencongty Value
//     var tencongty = tactics.values[i][15];   
//     body.replaceText('##tencongty##', tencongty) 
//     //16 companynameeng Value
//     var companynameeng = tactics.values[i][16];   
//     body.replaceText('##companynameeng##', companynameeng) 
//     //17 lanhdao Value
//     var lanhdao = tactics.values[i][17];   
//     body.replaceText('##lanhdao##', lanhdao) 
//     //18 quoctichlanhdao Value
//     var quoctichlanhdao = tactics.values[i][18];   
//     body.replaceText('##quoctichlanhdao##', quoctichlanhdao) 
//     //19 nationality Value
//     var nationality = tactics.values[i][19];   
//     body.replaceText('##nationality##', nationality) 
//     //20 chucvu Value
//     var chucvu = tactics.values[i][20];   
//     body.replaceText('##chucvu##', chucvu) 
//     //21 position Value
//     var position = tactics.values[i][21];   
//     body.replaceText('##position##', position) 
//     //22 diachi Value
//     var diachi = tactics.values[i][22];   
//     body.replaceText('##diachi##', diachi) 
//     //23 address Value
//     var address = tactics.values[i][23];   
//     body.replaceText('##address##', address) 
//     //24 sodienthoai Value
//     var sodienthoaict = tactics.values[i][24];   
//     body.replaceText('##sodienthoaict##', sodienthoaict) 
//     //25 tennhanvien Value
  
//     body.replaceText('##tennhanvien##', tennhanvien) 
//     //26 quoctich Value
//     var quoctich = tactics.values[i][26];   
//     body.replaceText('##quoctich##', quoctich) 
//     //27 ngaysinh Value
//     var ngaysinh = tactics.values[i][27];   
//     body.replaceText('##ngaysinh##', ngaysinh) 
//     //28 quequan Value
//     var quequan = tactics.values[i][28];   
//     body.replaceText('##quequan##', quequan) 
//     //29 thuongtru Value
//     var thuongtru = tactics.values[i][29];   
//     body.replaceText('##thuongtru##', thuongtru) 
//     //30 socmnd Value
//     var socmnd = tactics.values[i][30];   
//     body.replaceText('##socmnd##', socmnd) 
//     //31 ngaycap Value
//     var ngaycap = tactics.values[i][31];   
//     body.replaceText('##ngaycap##', ngaycap) 
//     //32 noicap Value
//     var noicap = tactics.values[i][32];   
//     body.replaceText('##noicap##', noicap) 
//     //33 chuyenmon Value
//     var chuyenmon = tactics.values[i][33];   
//     body.replaceText('##chuyenmon##', chuyenmon) 
//     //34 sohopdong Value
   
//     body.replaceText('##sohopdong##', sohopdong) 
//     //35 loaihopdong Value
//     var loaihopdong = tactics.values[i][35];   
//     body.replaceText('##loaihopdong##', loaihopdong) 
//     //36 ngaykyhopdong Value
//     var ngaykyhopdong = tactics.values[i][36];   
//     body.replaceText('##ngaykyhopdong##', ngaykyhopdong) 
//     //37 denngay Value
//     var denngay = tactics.values[i][37];   
//     body.replaceText('##denngay##', denngay) 
//     //38 diadiemlamviec Value
//     var diadiemlamviec = tactics.values[i][38];   
//     body.replaceText('##diadiemlamviec##', diadiemlamviec) 
//     //39 chucdanh Value
//     var chucdanh = tactics.values[i][39];   
//     body.replaceText('##chucdanh##', chucdanh) 
//     //40 chucvu Value
//     var chucvunv = tactics.values[i][40];   
//     body.replaceText('##chucvunv##', chucvunv) 
//     //41 mucluongchinh Value
//     var mucluongchinh = tactics.values[i][41];   
//     body.replaceText('##mucluongchinh##', mucluongchinh) 
//     //42 xang Value
//     var xang = tactics.values[i][42];   
//     body.replaceText('##xang##', xang) 
//     //43 dienthoai Value
//     var dienthoai = tactics.values[i][43];   
//     body.replaceText('##dienthoai##', dienthoai) 
//     //44 nhaokhac Value
//     var nhaokhac = tactics.values[i][44];   
//     body.replaceText('##nhaokhac##', nhaokhac) 
//     //45 today Value
//     var today = tactics.values[i][45];   
//     body.replaceText('##today##', today) 
//     //46 ngay Value
//     var ngay = tactics.values[i][46];   
//     body.replaceText('##ngay##', ngay) 
//     //47 thang Value
//     var thang = tactics.values[i][47];   
//     body.replaceText('##thang##', thang) 
//     //48 nam Value
//     var nam = tactics.values[i][48];   
//     body.replaceText('##nam##', nam) 
//     var ngayhethd = tactics.values[i][53];   
//     body.replaceText('##ngayhethd##', ngayhethd) 
//     //47 thang Value
//     var thanghethd = tactics.values[i][54];   
//     body.replaceText('##thanghethd##', thanghethd) 
//     //48 nam Value
//     var namhethd = tactics.values[i][55];   
//     body.replaceText('##namhethd##', namhethd)
//     //56 residential address Value 
//     var residentialaddress = tactics.values[i][56];   
//     body.replaceText('##residentialaddress##', residentialaddress)
//     //57 Individual tax code Value 
//     var individualtaxcode = tactics.values[i][57];   
//     body.replaceText('##mstcn##', individualtaxcode)
//     //58 Insurance code Value 
//     var insurancecode = tactics.values[i][58];   
//     body.replaceText('##msbh##', insurancecode)

    
   
//   }

// }

function parseTactics(headers, tactics, body){ 
  
  for(var i = 1; i < tactics.length; i++){
    {tactics[i] != '' && 
      body.appendListItem(headers[i] + ' | ' + tactics[i] + ' net').setGlyphType(DocumentApp.GlyphType.BULLET);
    }
    
  }
}

/**
 * Tìm bảng theo dõi hợp đồng dựa trên các tên phổ biến
 * hoặc tìm sheet có cột tiêu đề là "Link DRAFT".
 */
function findTargetSheet(ss) {
  // 1. Kiểm tra các tên sheet phổ biến trước
  var commonNames = ["Theo dõi hợp đồng", "Danh sách hợp đồng", "Hợp đồng", "HDTV", "HD", "Sheet1"];
  for (var i = 0; i < commonNames.length; i++) {
    var sheet = ss.getSheetByName(commonNames[i]);
    if (sheet) {
      // Kiểm tra xem sheet này có cột 'Link DRAFT' hay không
      var lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        var headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 15)).getValues()[0];
        if (headers.some(function(h) { 
          var s = h.toString().trim().toLowerCase();
          return s === "link draft" || s === "link_draft";
        })) {
          return sheet;
        }
      }
    }
  }

  // 2. Tìm kiếm trong tất cả các sheet xem sheet nào chứa cột 'Link DRAFT' ở dòng đầu tiên
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 15)).getValues()[0];
      if (headers.some(function(h) {
        var s = h.toString().trim().toLowerCase();
        return s === "link draft" || s === "link_draft";
      })) {
        return sheet;
      }
    }
  }

  // 3. Fallback: Nếu không tìm thấy, trả về Active Sheet
  return ss.getActiveSheet();
}

/**
 * Định dạng ngày bất kỳ (Date object hoặc chuỗi YYYY-MM-DD/DD/MM/YYYY) thành DD-MM-YYYY
 */
function formatDateToDMY(dateInput) {
  if (!dateInput) return "";
  
  // Nếu là đối tượng Date
  if (dateInput instanceof Date) {
    return Utilities.formatDate(dateInput, Session.getScriptTimeZone(), "dd-MM-yyyy");
  }
  
  var dateStr = dateInput.toString().trim();
  if (dateStr === "") return "";
  
  // Dạng YYYY-MM-DD hoặc YYYY/MM/DD
  var ymdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  var matchYMD = dateStr.match(ymdRegex);
  if (matchYMD) {
    var y = matchYMD[1];
    var m = matchYMD[2];
    var d = matchYMD[3];
    if (d.length === 1) d = "0" + d;
    if (m.length === 1) m = "0" + m;
    return d + "-" + m + "-" + y;
  }
  
  // Dạng DD/MM/YYYY hoặc DD-MM-YYYY
  var dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
  var matchDMY = dateStr.match(dmyRegex);
  if (matchDMY) {
    var d = matchDMY[1];
    var m = matchDMY[2];
    var y = matchDMY[3];
    if (d.length === 1) d = "0" + d;
    if (m.length === 1) m = "0" + m;
    return d + "-" + m + "-" + y;
  }
  
  // Thử parse bằng Date của JS làm phương án dự phòng
  try {
    var parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "dd-MM-yyyy");
    }
  } catch (e) {
    // Bỏ qua nếu lỗi
  }
  
  return dateStr;
}
