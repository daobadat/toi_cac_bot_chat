function onMessage(event) {
    if (!event || !event.message) {
        return { text: "❗ Lỗi: Không tìm thấy nội dung tin nhắn (event.message is undefined)." };
    }
    var regex = /http(.*)/;
    var response = event.message.formattedText || event.message.text || "";
  
    var responseCleaned =response.replace('@vh (AI)', '').trim();
    var responsefinal = responseCleaned.replace(regex, '<위 링크 참조>');
  
    var translatedText = translateWithGemini(responsefinal);
    
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
  
  function translateWithGemini(text) {
    var API_KEY = PropertiesService.getScriptProperties().getProperty('GEMMA_API_KEY');
    
    if (!API_KEY) {
      Logger.log("❗ Không tìm thấy API Key trong Script Properties!");
      return "❗ 번역 오류!(DỊCH THẤT BẠI.)";
    }
    //var API_KEY = "AIzaSyCp0rYqMgE0GKaKVFVZBg7Ygu7p_67jCRA"; // Thay bằng API Key của bạn
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=" + API_KEY;
    //var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + API_KEY;
    // var url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + API_KEY;
    // var url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=" + API_KEY;
    // var url = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + API_KEY;
  
    var payload = {
      contents: [
        {
          parts: [
            {
              text: `Bạn là một chuyên gia dịch thuật trong lĩnh vực kiến trúc và xây dựng.  
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
                    `
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,      // Thấp để dịch nhất quán hơn
        maxOutputTokens: 8192,
      }
    };
  
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
  
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
  
    if (json.candidates && json.candidates.length > 0) {
      let translatedText = json.candidates[0].content.parts[0].text.trim();
  
      // Loại bỏ dòng trống thừa nhưng giữ nguyên ngắt dòng quan trọng
      translatedText = translatedText.replace(/\n\s*\n/g, '\n');
  
      return translatedText;
    } else {
      return "❗ 번역 오류!(DỊCH THẤT BẠI.)"; // Thông báo lỗi bằng tiếng Hàn
    }
  }
  
  
  