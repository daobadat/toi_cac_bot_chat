function onFormSubmit(e) {
  // 1. Lấy dữ liệu cơ bản
  var response = e.response;
  var itemResponses = response.getItemResponses();
  var submitterEmail = response.getRespondentEmail();
  
  // Lấy link để nhân viên bấm vào sửa lại ngay
  var editUrl = response.getEditResponseUrl(); 

  // Lấy tên người được đánh giá bằng cách quét qua tiêu đề các câu hỏi
  var targetName = "";
  if (itemResponses.length > 0) {
    for (var i = 0; i < itemResponses.length; i++) {
      var title = itemResponses[i].getItem().getTitle().toLowerCase();
      if (title.indexOf("tên") !== -1 || title.indexOf("nhân sự") !== -1 || title.indexOf("đối tượng") !== -1 || title.indexOf("người") !== -1 || title.indexOf("name") !== -1) {
        targetName = itemResponses[i].getResponse();
        break;
      }
    }
    // Nếu không tìm thấy, mặc định lấy câu hỏi đầu tiên
    if (!targetName) {
      targetName = itemResponses[0].getResponse();
    }
  }

  // Tự động bốc email dự phòng nếu không lấy được tự động từ hệ thống
  if (!submitterEmail && itemResponses.length > 0) {
    for (var i = 0; i < itemResponses.length; i++) {
      var title = itemResponses[i].getItem().getTitle().toLowerCase();
      if (title.indexOf("email") !== -1 || title.indexOf("thư điện tử") !== -1) {
        submitterEmail = itemResponses[i].getResponse();
        break;
      }
    }
  }

  console.log("--- BẮT ĐẦU KIỂM TRA FORM SUBMIT ---");
  console.log("Email người gửi (submitterEmail): " + submitterEmail);
  console.log("Tên người được đánh giá (targetName): " + targetName);
  console.log("Link chỉnh sửa (editUrl): " + editUrl);

  // 2. Thu thập các điểm số (hỗ trợ cả dạng Grid/Trắc nghiệm ma trận trả về mảng)
  var scores = [];
  var isSuspicious = false;
  
  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i].getItem();
    var itemType = item.getType();
    
    // Bỏ qua các câu hỏi điền chữ tự do (như Họ tên, Email, Ý kiến phản hồi...)
    if (itemType === FormApp.ItemType.TEXT || itemType === FormApp.ItemType.PARAGRAPH_TEXT) {
      continue;
    }
    
    var answer = itemResponses[i].getResponse();
    if (Array.isArray(answer)) {
      for (var j = 0; j < answer.length; j++) {
        var str = String(answer[j]).trim();
        // Chỉ chấp nhận nếu câu trả lời là một số thuần tuý (ví dụ: "10", "9", "9.5")
        if (/^\d+(\.\d+)?$/.test(str)) {
          scores.push(parseFloat(str));
        }
      }
    } else {
      var str = String(answer).trim();
      // Chỉ chấp nhận nếu câu trả lời là một số thuần tuý (ví dụ: "10", "9", "9.5")
      if (/^\d+(\.\d+)?$/.test(str)) {
        scores.push(parseFloat(str));
      }
    }
  }

  console.log("Các điểm số thu thập được: " + JSON.stringify(scores));

  // 3. Logic kiểm tra vi phạm
  if (scores.length > 0) {
    var sum = scores.reduce((a, b) => a + b, 0);
    var avg = sum / scores.length;
    var uniqueScores = [...new Set(scores)];
    console.log("Điểm trung bình (avg): " + avg);
    console.log("Các loại điểm số duy nhất (uniqueScores): " + JSON.stringify(uniqueScores));
    
    // Điều kiện bắt lỗi:
    // 1. Chỉ dùng 1 loại điểm duy nhất cho toàn bộ tiêu chí (ví dụ: toàn bộ 8, toàn bộ 9, toàn bộ 10)
    // 2. Chỉ dùng 2 loại điểm và cả hai loại đều từ 8 trở lên (ví dụ: chỉ có 9 và 10, chỉ có 8 và 9, chỉ có 8 và 10)
    var allScoresAreHigh = uniqueScores.every(function(val) { return val >= 8; });
    
    if (uniqueScores.length === 1 || (uniqueScores.length === 2 && allScoresAreHigh)) {
      isSuspicious = true;
    }
  }

  console.log("Trạng thái vi phạm (isSuspicious): " + isSuspicious);

  // 4. Hành động gửi mail cảnh báo
  if (isSuspicious && submitterEmail) {
    console.log("Phát hiện vi phạm! Đang tiến hành gửi mail cảnh báo tới: " + submitterEmail);
    var emailSubject = "[CẢNH BÁO] Đánh giá nhân sự: " + targetName;
    
    // Tạo phần giải thích lỗi động để gửi trong mail
    var uniqueScores = [...new Set(scores)];
    var reasonText = "";
    var highlightText = "";
    
    if (uniqueScores.length === 1) {
      reasonText = "tất cả các tiêu chí đều đạt điểm số giống hệt nhau (<strong>" + uniqueScores[0] + " điểm</strong>)";
      highlightText = "Hành vi tích toàn bộ các câu hỏi cùng một cột điểm số (<strong>" + uniqueScores[0] + " điểm</strong>) từ trên xuống dưới được xem là đánh giá thiếu khách quan, chưa có sự phân hóa.";
    } else if (uniqueScores.length === 2) {
      reasonText = "các tiêu chí chỉ xoay quanh 2 mức điểm cao là <strong>" + uniqueScores.join(" và ") + " điểm</strong>";
      highlightText = "Hành vi chỉ lựa chọn 2 mức điểm cao (<strong>" + uniqueScores.join(" và ") + " điểm</strong>) cho toàn bộ form mà không có sự đánh giá chi tiết từng tiêu chí được xem là thiếu khách quan.";
    } else {
      reasonText = "các tiêu chí chưa có sự phân hóa điểm số rõ rệt";
      highlightText = "Hành vi đánh giá sơ sài, rập khuôn, chưa phản ánh chính xác năng lực thực tế của nhân sự.";
    }

    // Nội dung bản text thường
    var plainBody = "Hệ thống ghi nhận bạn đánh giá trùng lặp cho nhân sự: " + targetName + ". Vui lòng chỉnh sửa lại tại đường dẫn: " + editUrl;

    // Nội dung HTML với giao diện hiện đại, link "bôi xanh" và nút hành động nổi bật
    var htmlBody = 
      '<div style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">' +
        '<div style="text-align: center; margin-bottom: 25px;">' +
          '<span style="background-color: #fee2e2; color: #dc2626; font-weight: bold; padding: 8px 16px; border-radius: 9999px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">Cảnh báo vi phạm</span>' +
        '</div>' +
        '<h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin-top: 10px; margin-bottom: 20px; text-align: center; line-height: 1.4;">Đánh giá nhân sự thiếu khách quan</h2>' +
        '<div style="color: #334155; line-height: 1.7; font-size: 16px;">' +
          '<p style="margin-bottom: 15px;">Chào bạn,</p>' +
          '<p style="margin-bottom: 20px;">Hệ thống ghi nhận bạn vừa thực hiện đánh giá cho nhân sự <strong>' + targetName + '</strong> với ' + reasonText + '.</p>' +
          '<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; color: #b45309; border-radius: 6px; font-weight: 500; margin-bottom: 25px; line-height: 1.6;">' +
            highlightText +
          '</div>' +
          '<p style="margin-bottom: 20px;">Vui lòng bấm vào nút hoặc đường link bôi xanh dưới đây để điều chỉnh lại điểm số (cần có sự phân hóa: 8, 9, 10...):</p>' +
          '<div style="margin: 25px 0; text-align: center;">' +
            '<a href="' + editUrl + '" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: bold; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 17px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1);">Chỉnh sửa câu trả lời của bạn</a>' +
          '</div>' +
          '<div style="word-break: break-all; text-align: center; font-size: 14px; margin-top: 20px; color: #64748b; background-color: #f1f5f9; padding: 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">' +
            '<strong style="color: #475569;">Đường dẫn trực tiếp:</strong><br>' +
            '<a href="' + editUrl + '" style="color: #2563eb; font-weight: 600; text-decoration: underline; display: inline-block; margin-top: 5px;">' + editUrl + '</a>' +
          '</div>' +
          '<p style="margin-top: 30px; font-style: italic; color: #64748b; font-size: 14px; border-top: 1px dashed #e2e8f0; padding-top: 20px; line-height: 1.6;">' +
            '* Trường hợp bạn giữ nguyên ý kiến do nhân sự này thực sự xuất sắc hoặc đặc biệt ở mọi mặt, Ban lãnh đạo (BLĐ) sẽ yêu cầu giải trình bằng văn bản.' +
          '</p>' +
          '<p style="margin-top: 25px; color: #475569; font-size: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px;">' +
            'Trân trọng,<br>' +
            '<strong style="color: #334155;">Hệ thống Đánh giá Nhân sự ADD Group</strong>' +
          '</p>' +
        '</div>' +
      '</div>';

    // Gửi email
    GmailApp.sendEmail(submitterEmail, emailSubject, plainBody, {
      htmlBody: htmlBody
    });
    console.log("Đã gửi email thành công!");
  } else {
    console.log("Không gửi email. Lý do: isSuspicious=" + isSuspicious + ", submitterEmail=" + submitterEmail);
  }
  console.log("--- KẾT THÚC KIỂM TRA FORM SUBMIT ---");
}