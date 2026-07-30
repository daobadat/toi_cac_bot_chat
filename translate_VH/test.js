function onMessage(event) {
  var regex = /http(.*)/;
  var response = event.message.formattedText || event.message.text || "";
  var responseCleaned = response.replace('@vh (AI)', '').trim();
  var responsefinal = responseCleaned.replace(regex, '<위 링크 참조>');

  // Kiểm tra xem tin nhắn có tag @son hoặc @minchang không (không phân biệt hoa thường)
  var hasTagSonOrMinchang = /@s[ōơoô]n\b/i.test(responsefinal) || /minchang/i.test(responsefinal);

  // Kiểm tra dòng đầu tiên có phải "Thưa Boss" / "Dear Boss" không
  var firstLine = responsefinal.split('\n')[0].trim();
  var startsWithThuaBoss = /^th[ưu]a\s+boss/i.test(firstLine) || /^dear\s*boss/i.test(firstLine);

  var translatedText = translateWithGemini(responsefinal);

  // Chỉ thêm dòng cảnh báo / lời chào khi không có "Thưa/Dear Boss" ở đầu
  if (!startsWithThuaBoss) {
    if (hasTagSonOrMinchang) {
      // Có tag @son/@minchang nhưng thiếu lời chào → chỉ thêm lời chào
      translatedText = "친애하는 사장님,\n" + translatedText;
    } else {
      // Không có tag, không có lời chào → thêm cả dòng cảnh báo
      translatedText = "친애하는 사장님, 비록 베트남어 부분에서는 사장님이 아닌 다른 사람을 언급하고 있습니다.\n" + translatedText;
    }
  }

  var messageback = spreadRow(response, translatedText)

  var responseko = event.user.displayName + " said: " + messageback;
  
  return { 
    "text": responseko,
  };
}

function spreadRow(original, translated) {
  var o = original.split('\n')
  var t = translated.split('\n')

  for (var i = 0; i < o.length; i++) {
    if (o[i] == '') {
      if (t[i] != '') {
        t.splice(i, 0, "");  // Chèn "x" vào vị trí thứ 2 (đếm từ 0)
        i++
      }
    }
  }

  return t.join('\n')
}

// Danh sách fallback model theo thứ tự ưu tiên
var FALLBACK_MODELS = [
  { name: "gemini-3.5-flash-lite",        timeout: 12 },
  { name: "gemini-3.1-flash-lite", timeout: 12 },
  { name: "gemini-2.5-flash-lite", timeout: 12 },
];

function translateWithGemini(text) {
  var API_KEY = PropertiesService.getScriptProperties().getProperty('GEMMA_API_KEY');
  if (!API_KEY) {
    Logger.log("❗ Không tìm thấy API Key trong Script Properties!");
    return "❗ 번역 오류!(DỊCH THẤT BẠI.)";
  }

  var promptText = `Bạn là một chuyên gia dịch thuật trong lĩnh vực kiến trúc và xây dựng.  
                  Hiện tại, bạn đang phụ trách dịch thuật cho công ty ADD Group.  
                  ADD Group (ADD) bao gồm các công ty con sau:  
                  - Plan ADD Việt Nam (VPA)  
                  - Plan ADD Hàn Quốc (KPA)  
                  - ADD Construction (ADC)  

                  Hãy dịch chính xác văn bản từ tiếng Việt sang tiếng Hàn.  
                  - Giữ nguyên định dạng văn bản (bao gồm dấu gạch đầu dòng, xuống dòng, số thứ tự, v.v.).  
                  - Chỉ cung cấp nội dung đã dịch, không bao gồm văn bản gốc.
                  - **Bảo toàn tuyệt đối định dạng gốc**, bao gồm:
                    + Dấu gạch đầu dòng (-)  
                    + Ký hiệu số thứ tự (1., 2., ...)  
                    + Ngắt dòng dùng để chia đoạn (\n)
                    + Khoảng trắng   
                  - Riêng cụm từ "Dear Boss" thì luôn phải dịch là "친애하는 사장님". 
                  Văn bản cần dịch:  
                  """${text}"""
                  `;

  var payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  var BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

  for (var i = 0; i < FALLBACK_MODELS.length; i++) {
    var model = FALLBACK_MODELS[i];
    Logger.log("[AI] Đang thử model: " + model.name + " (timeout: " + (model.timeout * 1000) + "ms)");

    var url = BASE_URL + model.name + ":generateContent?key=" + API_KEY;
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      deadline: model.timeout
    };

    try {
      var response = UrlFetchApp.fetch(url, options);
      var statusCode = response.getResponseCode();
      var json = JSON.parse(response.getContentText());

      // Xử lý rate limit hoặc lỗi server → chuyển model tiếp
      if (statusCode === 429 || statusCode >= 500) {
        Logger.log("[Fallback] Model " + model.name + " lỗi HTTP " + statusCode + ". Chuyển model...");
        if (i < FALLBACK_MODELS.length - 1) Utilities.sleep(1000);
        continue;
      }

      if (json.candidates && json.candidates.length > 0) {
        var translatedText = json.candidates[0].content.parts[0].text.trim();
        // Loại bỏ dòng trống thừa nhưng giữ nguyên ngắt dòng quan trọng
        translatedText = translatedText.replace(/\n\s*\n/g, '\n');

        if (i > 0) {
          Logger.log("[AI] Fallback thành công! Đã dùng model backup: " + model.name);
        }
        return translatedText;
      }

      // Không có candidates → thử model tiếp
      Logger.log("[Fallback] Model " + model.name + " không trả về kết quả. Chuyển model...");
      if (i < FALLBACK_MODELS.length - 1) Utilities.sleep(1000);

    } catch (e) {
      Logger.log("[Fallback] Model " + model.name + " gặp lỗi: " + e.message + ". Chuyển model...");
      if (i < FALLBACK_MODELS.length - 1) Utilities.sleep(1000);
    }
  }

  // Tất cả model đều thất bại
  Logger.log("[AI] Tất cả model đều thất bại. Trả lỗi cho người dùng.");
  return "❗ 번역 오류!(DỊCH THẤT BẠI.)";
}
/**
 * Được kích hoạt tự động khi Bot được thêm vào một Không gian (Space) hoặc DM.
 */
function onAddToSpace(event) {
  return {
    "text": "Đã thêm Chat Bot. Vui lòng gửi lại tin nhắn,pls!!!!!!"
  };
}


