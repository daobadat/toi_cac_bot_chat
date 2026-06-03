// ==========================================
// CẤU HÌNH CÁC THÔNG SỐ HỆ THỐNG
// ==========================================
const PARENT_FOLDER_ID = '11gBHbEvyhwacLDp9U_yvagokZpvAFA_B'; // Thay bằng ID thư mục lớn trên Drive nơi chứa các thư mục tháng
const CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQA0ZZUjNs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=BGZTnoalGS7q3LxdqAFBRAEcXJaY4RbWFgDb1FgWFOc'; // Thẻ Webhook của Google Chat, Slack hoặc Telegram
const BOSS_CALENDAR_ID = '800@add-group.net'; // 'primary' nếu là lịch của tài khoản chạy script, hoặc điền email lịch của Boss nếu được chia sẻ quyền

// Cấu hình ID người dùng hoặc tên hiển thị để tag/mention trên Google Chat
const VH_USER_ID = 'vh(AI)'; // Thay bằng ID Google Chat dạng 'users/123456789012345678901' hoặc dùng chữ 'vh' để hiển thị text thông thường
const BOSS_USER_ID = '손민창 (Son, MinChang)'; // Thay bằng ID Google Chat dạng 'users/987654321098765432109' hoặc dùng chữ '손민창 (Son, MinChang)' để hiển thị text thông thường
const CALENDAR_NAME = '200'; // Tên hiển thị của lịch / phòng ban trong thông báo (Ví dụ: '200')

// Cấu hình API Key của Gemini (từ Google AI Studio)
const GEMINI_API_KEY = ''; // Thay bằng API Key của bạn hoặc cài đặt trong Script Properties để bảo mật


/**
 * Hàm tiếp nhận dữ liệu từ Form AI gửi tới qua phương thức POST
 */
function doPost(e) {
  try {
    const jsonString = e.postData.contents;
    const eventData = JSON.parse(jsonString);
    
    // ĐỂ KIỂM TRA CHÍNH XÁC LOG TRONG QUÁ TRÌNH KHỞI CHẠY
    Logger.log("Dữ liệu gốc nhận được tại doPost: " + jsonString);
    
    // =============================================================
    // TRƯỜNG HỢP 1: DỮ LIỆU ĐẾN TỪ GOOGLE CHAT
    // =============================================================
    const isGoogleChat = (eventData.hostApp === 'chat' || eventData.chat || eventData.commonEventObject || (eventData.type && (eventData.type.startsWith('ADDED') || eventData.type.startsWith('REMOVED') || eventData.type.includes('MESSAGE') || eventData.type.includes('CARD'))));
    
    if (isGoogleChat) {
      let chatReply = null;
      
      // Xác định loại sự kiện từ Google Chat
      let eventType = eventData.type || '';
      
      // Nếu là Workspace Add-on hoặc có cấu trúc chat mới
      if (!eventType && eventData.chat && eventData.chat.messagePayload && eventData.chat.messagePayload.message) {
        eventType = 'MESSAGE';
      }
      if (!eventType && eventData.commonEventObject && (eventData.commonEventObject.invokedFunction || eventData.commonEventObject.parameters || eventData.commonEventObject.formInputs)) {
        eventType = 'CARD_CLICKED';
      }
      
      Logger.log("Loại sự kiện Chat nhận diện: " + eventType);
      
      if (eventType === 'ADDED_TO_SPACE') {
        chatReply = onAddToSpace(eventData);
      } else if (eventType === 'CARD_CLICKED') {
        chatReply = onCardClick(eventData);
      } else if (eventType === 'MESSAGE' || eventType.includes('MESSAGE')) {
        chatReply = onMessage(eventData);
      } else if (eventType === 'REMOVED_FROM_SPACE') {
        onRemoveFromSpace(eventData);
        chatReply = { status: 'success' };
      } else {
        // Fallback mặc định
        chatReply = onMessage(eventData);
      }
      
      return ContentService.createTextOutput(JSON.stringify(chatReply))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // =============================================================
    // TRƯỜNG HỢP 2: DỮ LIỆU ĐẾN TỪ AI FORM / FILE VÉ (Không phải Google Chat)
    // =============================================================
    if (eventData.pdfBase64 || eventData.from || eventData.to) {
      const result = processAirTicketWorkflow(eventData);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ignored', message: 'Không nhận diện được định dạng yêu cầu' }))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    Logger.log("Lỗi hệ thống doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Trình xử lý khi người dùng gửi tin nhắn hoặc tag/mention App trong Google Chat (khi tích hợp dạng Apps Script project)
 */
function onMessage(event) {
  Logger.log("Nhận tin nhắn từ Google Chat (onMessage): " + JSON.stringify(event));
  return handleChatMessageEvent(event);
}

/**
 * Trình xử lý khi người dùng click vào các thẻ Card hoặc nút bấm trong Google Chat (khi tích hợp dạng Apps Script project)
 */
function onCardClick(event) {
  Logger.log("Nhận sự kiện click card (onCardClick): " + JSON.stringify(event));
  const actionName = getActionMethodName(event);
  if (actionName === 'openTicketDialog') {
    return openTicketDialog(event);
  } else if (actionName === 'handleTicketSubmit') {
    return handleTicketSubmit(event);
  }
}

/**
 * Trình xử lý khi App được thêm vào một Không gian (Space) hoặc chat trực tiếp
 */
function onAddToSpace(event) {
  Logger.log("App được thêm vào space: " + JSON.stringify(event));
  return {
    "text": "Cảm ơn bạn đã thêm **Air Ticket** vào không gian! Tôi đã sẵn sàng hỗ trợ tự động hóa lưu trữ và lên lịch trình vé máy bay."
  };
}

/**
 * Trình xử lý khi App bị xóa khỏi Không gian (Space)
 */
function onRemoveFromSpace(event) {
  Logger.log("App bị xóa khỏi space: " + JSON.stringify(event));
}

/**
 * Phân tích loại sự kiện nhận được từ Google Chat (tương thích cả Legacy Chat App và Workspace Add-on)
 */
function getGoogleChatEventType(data) {
  if (data.type) return data.type;
  
  // Nếu là Google Workspace Add-on (hostApp === 'chat')
  if (data.chat && data.chat.messagePayload) {
    if (data.chat.messagePayload.message) {
      return 'MESSAGE';
    }
  }
  
  if (data.commonEventObject && (data.commonEventObject.parameters || data.commonEventObject.formInputs)) {
    return 'CARD_CLICKED';
  }
  
  return '';
}

/**
 * Trích xuất tên hằng số callback khi người dùng tương tác với các thẻ / dialog
 */
function getActionMethodName(event) {
  if (event.action && event.action.actionMethodName) {
    return event.action.actionMethodName;
  }
  if (event.commonEventObject) {
    if (event.commonEventObject.invokedFunction) {
      return event.commonEventObject.invokedFunction;
    }
    if (event.commonEventObject.parameters && event.commonEventObject.parameters.actionMethodName) {
      return event.commonEventObject.parameters.actionMethodName;
    }
  }
  return '';
}

/**
 * Helper: Tránh ký tự đặc biệt trong RegExp
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Làm sạch tin nhắn, loại bỏ tag/mention của Bot để lấy nội dung text thuần
 */
function getCleanMessageText(message) {
  if (!message) return '';
  
  let textVal = message.text || '';
  const argTextVal = message.argumentText || '';
  
  // Nếu có argumentText, dùng luôn vì Google đã làm sạch mention
  if (argTextVal.trim()) {
    return argTextVal.trim();
  }
  
  // Lọc bỏ tên bot dựa vào annotations nếu có
  if (message.annotations) {
    message.annotations.forEach(ann => {
      if (ann.type === 'USER_MENTION' && ann.userMention && ann.userMention.user) {
        const botName = ann.userMention.user.displayName;
        if (botName) {
          const regex = new RegExp('@?' + escapeRegExp(botName), 'gi');
          textVal = textVal.replace(regex, '');
        }
      }
    });
  }
  
  // Tự lọc bỏ các tag định dạng HTML mention <users/all>, <users/USER_ID> hoặc tag text dạng @Air
  textVal = textVal.replace(/<users\/[^>]+>/g, '').replace(/@[^\s]+/g, '');
  
  return textVal.trim();
}

/**
 * Gọi Gemini API để tự động phân tích và trích xuất thông tin vé máy bay từ văn bản tự do
 */
function extractTicketWithGemini(userMessage) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    Logger.log("Chưa cấu hình GEMINI_API_KEY.");
    return null;
  }
  
  const model = "gemini-2.5-flash"; // Bạn có thể đổi sang model mong muốn
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const prompt = `Bạn là một trợ lý AI chuyên trích xuất thông tin hành trình vé máy bay từ văn bản thô.
Nhiệm vụ của bạn là phân tích đoạn tin nhắn sau đây và trích xuất các trường thông tin vé máy bay thành định dạng JSON.

Đoạn tin nhắn của người dùng:
"${userMessage}"

Định dạng JSON kết quả phải có cấu trúc chính xác như sau:
{
  "from": "Điểm đi (Ví dụ: HAN, SGN, HN, HCM, nếu không rõ để trống)",
  "to": "Điểm đến (Ví dụ: HAN, SGN, HN, HCM, nếu không rõ để trống)",
  "ticketCode": "Mã chuyến bay hoặc mã vé (Ví dụ: VN213, VJ123, nếu không rõ để trống)",
  "date": "Ngày khởi hành (Định dạng YYYY-MM-DD hoặc DD/MM/YYYY, nếu không có hãy lấy ngày hiện tại)",
  "time": "Giờ khởi hành (Định dạng HH:mm, nếu không rõ để trống)",
  "note": "Ghi chú thêm nếu có (Ví dụ: đổi vé, hủy vé, khứ hồi...)"
}

Chỉ trả về chuỗi JSON chính xác theo cấu trúc trên, tuyệt đối không viết thêm bất kỳ từ giải thích nào ngoài chuỗi JSON.`;

  const payload = {
    "contents": [{
      "parts": [{ "text": prompt }]
    }],
    "generationConfig": {
      "responseMimeType": "application/json"
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode !== 200) {
      Logger.log("Lỗi gọi Gemini API: " + responseText);
      return null;
    }
    
    const jsonResponse = JSON.parse(responseText);
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
      const extractedText = jsonResponse.candidates[0].content.parts[0].text;
      return JSON.parse(extractedText);
    }
  } catch (e) {
    Logger.log("Lỗi xử lý Gemini: " + e.toString());
  }
  return null;
}

/**
 * Trình điều phối xử lý tin nhắn Chat: Nhận diện AI hoặc hiển thị nút mở Dialog Form
 */
function handleChatMessageEvent(event) {
  try {
    // Trích xuất đối tượng message tương thích cả 2 định dạng payload
    const message = event.message || (event.chat && event.chat.messagePayload && event.chat.messagePayload.message);
    const cleanText = getCleanMessageText(message);
    
    if (cleanText) {
      // Nếu tin nhắn có nội dung text đi kèm -> Gọi Gemini trích xuất thông tin
      let extractedData = null;
      try {
        extractedData = extractTicketWithGemini(cleanText);
      } catch (geminiError) {
        Logger.log("Lỗi gọi Gemini API: " + geminiError.toString());
      }
      
      if (extractedData && extractedData.from && extractedData.to) {
        try {
          // Trích xuất thành công các trường cốt lõi -> Tự động chạy luôn workflow
          extractedData.pdfBase64 = null; // Không có file PDF
          processAirTicketWorkflow(extractedData);
          
          // Tạo tin nhắn xác nhận gửi lại không gian chat
          return {
            "text": `✈️ *AI đã nhận diện hành trình và tự động đặt lịch thành công!*\n` +
                    `• **Mã vé:** \`${extractedData.ticketCode || 'Chưa rõ'}\`\n` +
                    `• **Lộ trình:** Từ *${extractedData.from}* đi *${extractedData.to}*\n` +
                    `• **Thời gian:** ${extractedData.time || 'Chưa rõ'} ngày ${extractedData.date || 'Chưa rõ'}\n` +
                    `• **Ghi chú:** ${extractedData.note || 'Không có'}`
          };
        } catch (workflowError) {
          Logger.log("Lỗi chạy workflow tự động: " + workflowError.toString());
          // Nếu lỗi workflow (ví dụ Calendar/Drive), mở Dialog có điền sẵn thông tin
          return createOpenDialogCard(extractedData);
        }
      } else {
        // Trích xuất thiếu thông tin cốt lõi -> Trả về Card có nút mở Dialog và truyền các giá trị đã trích xuất được
        return createOpenDialogCard(extractedData || {});
      }
    }
    
    // Trường hợp chỉ tag bot mà không gõ gì thêm -> Trả về Card chứa nút mở Dialog rỗng
    return createOpenDialogCard();
  } catch (error) {
    Logger.log("Lỗi handleChatMessageEvent: " + error.toString());
    return {
      "text": "❌ Có lỗi xảy ra trong quá trình xử lý tin nhắn: " + error.toString()
    };
  }
}

/**
 * Trình tạo thẻ Card chứa nút để mở Dialog Form (do Google Chat không cho phép mở Dialog trực tiếp từ tin nhắn)
 */
function createOpenDialogCard(prefilledData) {
  const actionObj = {
    "function": "openTicketDialog"
  };
  
  if (prefilledData) {
    actionObj.parameters = [
      {
        "key": "prefilledData",
        "value": JSON.stringify(prefilledData)
      }
    ];
  }
  
  return {
    "text": "Xin chào! Vui lòng click nút *Đăng ký vé* dưới đây để nhập thông tin vé máy bay.",
    "cardsV2": [
      {
        "cardId": "open_dialog_card",
        "card": {
          "header": {
            "title": "200 AI",
            "subtitle": "✈️ Đăng ký hành trình Vé Máy Bay"
          },
          "sections": [
            {
              "widgets": [
                {
                  "textParagraph": {
                    "text": "Vui lòng click vào nút bên dưới để nhập thông tin và đăng ký vé máy bay lên hệ thống."
                  }
                },
                {
                  "buttonList": {
                    "buttons": [
                      {
                        "text": "Đăng ký vé",
                        "onClick": {
                          "action": actionObj
                        }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Callback khi người dùng click vào nút "Đăng ký vé" để mở Dialog Form
 */
function openTicketDialog(event) {
  Logger.log("Mở Dialog Form từ Card Click: " + JSON.stringify(event));
  let prefilledData = null;
  
  // Trích xuất parameters từ event click card (hỗ trợ cả 2 dạng)
  let parameters = null;
  if (event.commonEventObject && event.commonEventObject.parameters) {
    parameters = event.commonEventObject.parameters;
  } else if (event.action && event.action.parameters) {
    parameters = {};
    event.action.parameters.forEach(p => {
      parameters[p.key] = p.value;
    });
  }
  
  if (parameters && parameters.prefilledData) {
    try {
      if (typeof parameters.prefilledData === 'string') {
        prefilledData = JSON.parse(parameters.prefilledData);
      } else {
        prefilledData = parameters.prefilledData;
      }
    } catch (e) {
      Logger.log("Lỗi parse prefilledData: " + e.toString());
    }
  }
  
  return createTicketDialog(prefilledData);
}

/**
 * Trình tạo Dialog Form nhập thông tin vé máy bay trực quan trên Google Chat
 */
function createTicketDialog(prefilledValues) {
  const values = prefilledValues || {};
  return {
    "actionResponse": {
      "type": "DIALOG",
      "dialogAction": {
        "dialog": {
          "body": {
            "header": {
              "title": "200 AI",
              "subtitle": "✈️ Đăng ký Vé Máy Bay"
            },
            "sections": [
              {
                "widgets": [
                  {
                    "textParagraph": {
                      "text": "<b>Form đăng ký hành trình:</b>"
                    }
                  },
                  {
                    "textInput": {
                      "label": "Mã vé (Ví dụ: VN213)",
                      "type": "SINGLE_LINE",
                      "name": "ticketCode",
                      "value": values.ticketCode || ""
                    }
                  },
                  {
                    "textInput": {
                      "label": "Điểm đi (Ví dụ: HAN)",
                      "type": "SINGLE_LINE",
                      "name": "from",
                      "value": values.from || ""
                    }
                  },
                  {
                    "textInput": {
                      "label": "Điểm đến (Ví dụ: SGN)",
                      "type": "SINGLE_LINE",
                      "name": "to",
                      "value": values.to || ""
                    }
                  },
                  {
                    "textInput": {
                      "label": "Ngày bay (Ví dụ: 21/05/2026)",
                      "type": "SINGLE_LINE",
                      "name": "date",
                      "value": values.date || ""
                    }
                  },
                  {
                    "textInput": {
                      "label": "Giờ bay (Ví dụ: 13:00)",
                      "type": "SINGLE_LINE",
                      "name": "time",
                      "value": values.time || ""
                    }
                  },
                  {
                    "textInput": {
                      "label": "Ghi chú (nếu có)",
                      "type": "SINGLE_LINE",
                      "name": "note",
                      "value": values.note || ""
                    }
                  },
                  {
                    "textParagraph": {
                      "text": "<i>*Note: Sau khi mọi người đăng ký xong, hệ thống sẽ tự động tạo lịch trình Google Calendar cho Boss và thông báo kết quả vào nhóm chat này.*</i>"
                    }
                  },
                  {
                    "buttonList": {
                      "buttons": [
                        {
                          "text": "Submit",
                          "onClick": {
                            "action": {
                              "function": "handleTicketSubmit"
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }
      }
    }
  };
}

/**
 * Helper: Lấy giá trị đầu vào từ widget của Form Dialog
 */
function getInputValue(formInputs, fieldName) {
  if (formInputs && formInputs[fieldName] && formInputs[fieldName].stringInputs && formInputs[fieldName].stringInputs.value) {
    return formInputs[fieldName].stringInputs.value[0];
  }
  return '';
}

/**
 * Trình xử lý khi người dùng nhấn nút Submit trong Dialog Form
 */
function handleTicketSubmit(event) {
  try {
    const formInputs = event.commonEventObject ? event.commonEventObject.formInputs : null;
    
    const ticketCode = getInputValue(formInputs, 'ticketCode');
    const from = getInputValue(formInputs, 'from');
    const to = getInputValue(formInputs, 'to');
    const date = getInputValue(formInputs, 'date');
    const time = getInputValue(formInputs, 'time');
    const note = getInputValue(formInputs, 'note');
    
    if (!from || !to) {
      return {
        "actionResponse": {
          "type": "DIALOG",
          "dialogAction": {
            "actionStatus": {
              "statusCode": "INVALID_ARGUMENT",
              "userFacingMessage": "Vui lòng điền đầy đủ Điểm đi và Điểm đến!"
            }
          }
        }
      };
    }
    
    const ticketData = {
      from: from,
      to: to,
      ticketCode: ticketCode,
      date: date,
      time: time,
      pdfBase64: null, // Không có file tải lên trực tiếp từ dialog
      note: note
    };
    
    // Gọi quy trình xử lý vé máy bay (Lưu lịch & Gửi thông báo chat)
    processAirTicketWorkflow(ticketData);
    
    // Trả về lệnh đóng dialog và thông báo thành công
    return {
      "actionResponse": {
        "type": "DIALOG",
        "dialogAction": {
          "actionStatus": {
            "statusCode": "OK",
            "userFacingMessage": "Đã lưu thông tin vé máy bay thành công!"
          }
        }
      }
    };
  } catch (error) {
    return {
      "actionResponse": {
        "type": "DIALOG",
        "dialogAction": {
          "actionStatus": {
            "statusCode": "UNKNOWN",
            "userFacingMessage": "Có lỗi xảy ra: " + error.toString()
          }
        }
      }
    };
  }
}

/**
 * Helper: Tạo chuỗi mention/tag cho tài khoản AI (vh)
 */
function getVhMention() {
  if (VH_USER_ID && VH_USER_ID.startsWith('users/')) {
    return `<${VH_USER_ID}>`;
  }
  if (VH_USER_ID && !VH_USER_ID.startsWith('@')) {
    return `@${VH_USER_ID}.`;
  }
  return VH_USER_ID || '@vh.';
}

/**
 * Helper: Tạo chuỗi mention/tag cho Boss (Son, MinChang)
 */
function getBossMention() {
  if (BOSS_USER_ID && BOSS_USER_ID.startsWith('users/')) {
    return `<${BOSS_USER_ID}>`;
  }
  if (BOSS_USER_ID && !BOSS_USER_ID.startsWith('@')) {
    return `@${BOSS_USER_ID}`;
  }
  return BOSS_USER_ID || '@손민창 (Son, MinChang)';
}

/**
 * Helper: Phân tích và định dạng ngày tháng từ chuỗi ngày của vé (YYYY-MM-DD hoặc DD/MM/YYYY)
 */
function parseTicketDate(dateStr) {
  const now = new Date();
  let day = String(now.getDate()).padStart(2, '0');
  let month = String(now.getMonth() + 1).padStart(2, '0');
  let year = String(now.getFullYear());
  
  if (dateStr) {
    const dateParts = dateStr.split(/[-/]/);
    if (dateParts.length === 3) {
      if (dateParts[0].length === 4) {
        // Định dạng YYYY-MM-DD
        year = dateParts[0];
        month = dateParts[1].padStart(2, '0');
        day = dateParts[2].padStart(2, '0');
      } else {
        // Định dạng DD-MM-YYYY hoặc DD/MM/YYYY
        day = dateParts[0].padStart(2, '0');
        month = dateParts[1].padStart(2, '0');
        year = dateParts[2];
      }
    }
  }
  
  return {
    day,
    month,
    year,
    ddmmyyyy: `${day}${month}${year}`,
    displayDate: `${day}/${month}/${year}`
  };
}

/**
 * Hàm xử lý chính: Lưu Drive theo tháng thực tế -> Tạo lịch cho Boss -> Gửi tin nhắn nhóm chat
 * @param {Object|Array} data - Dữ liệu đầu vào từ Form AI (hỗ trợ vé đơn hoặc mảng nhiều vé)
 */
function processAirTicketWorkflow(data) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // Lấy tháng thời gian thực (1-12)
  const folderName = `Tháng ${currentMonth}`;
  const targetFolder = getOrCreateMonthFolder(PARENT_FOLDER_ID, folderName);
  
  // Chuẩn hóa dữ liệu đầu vào thành mảng các vé
  let tickets = [];
  if (Array.isArray(data)) {
    tickets = data;
  } else if (data && data.tickets && Array.isArray(data.tickets)) {
    tickets = data.tickets;
  } else if (data) {
    tickets = [data];
  }

  const results = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const dateInfo = parseTicketDate(ticket.date);
    
    // -------------------------------------------------------------
    // XỬ LÝ STT 6: TỰ ĐỘNG PHÂN LOẠI VÀ LƯU FILE PDF VÀO DRIVE THEO THÁNG
    // -------------------------------------------------------------
    let fileUrl = "Không có file đính kèm";
    let fileName = "";
    if (ticket.pdfBase64) {
      // Đặt tên file theo cú pháp mới: <ngày> <Điểm đi- Điểm đến>
      // Ví dụ: 21052026 HAN - SGN.pdf
      fileName = `${dateInfo.ddmmyyyy} ${ticket.from}-${ticket.to}`;
      if (ticket.note) {
        fileName += ` (${ticket.note})`;
      }
      
      // Giải mã chuỗi Base64 nhận được từ AI thành tệp PDF trực tiếp
      const decodedPdf = Utilities.base64Decode(ticket.pdfBase64);
      const blob = Utilities.newBlob(decodedPdf, 'application/pdf', fileName + '.pdf');
      
      // Lưu tệp vào thư mục tháng tương ứng
      const file = targetFolder.createFile(blob);
      fileUrl = file.getUrl();
    }

    // -------------------------------------------------------------
    // TỰ ĐỘNG TẠO SỰ KIỆN TRÊN GOOGLE CALENDAR CHO BOSS
    // -------------------------------------------------------------
    let calendarEventId = "";
    if (ticket.date && ticket.time) {
      // Chuyển đổi chuỗi ngày giờ thành đối tượng Date của hệ thống
      const formattedDateForNew = ticket.date.replace(/\//g, '-');
      const startDateTime = new Date(`${formattedDateForNew}T${ticket.time}:00`);
      // Mặc định thời gian chặn lịch tạm thời là 2 tiếng cho chuyến bay
      const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); 
      
      const eventTitle = `✈️ [Chuyến bay] ${ticket.from} - ${ticket.to} (${ticket.ticketCode})`;
      const eventDescription = `• Mã vé: ${ticket.ticketCode}\n` +
                               `• Lộ trình: Từ ${ticket.from} đến ${ticket.to}\n` +
                               `• Giờ khởi hành: ${ticket.time} ngày ${dateInfo.displayDate}\n` +
                               `• Link xem file vé trên Drive: ${fileUrl}\n` +
                               `• Ghi chú: ${ticket.note || 'Không có'}`;
      
      const calendar = CalendarApp.getCalendarById(BOSS_CALENDAR_ID);
      if (calendar) {
        const event = calendar.createEvent(eventTitle, startDateTime, endDateTime, {
          description: eventDescription,
          location: `Sân bay ${ticket.from}`
        });
        calendarEventId = event.getId();
      }
    }

    results.push({
      ticketCode: ticket.ticketCode,
      from: ticket.from,
      to: ticket.to,
      time: ticket.time,
      dateFormatted: dateInfo.displayDate,
      fileName: fileName,
      driveFileUrl: fileUrl,
      calendarEventId: calendarEventId
    });
  }

  // -------------------------------------------------------------
  // XỬ LÝ STT 7: TỰ ĐỘNG GỬI THÔNG BÁO LÊN NHÓM CHAT QUA WEBHOOK
  // -------------------------------------------------------------
  sendChatNotification(results);

  // Đảm bảo tương thích ngược nếu chỉ xử lý 1 vé
  if (results.length === 1) {
    return {
      savedFolder: folderName,
      driveFileUrl: results[0].driveFileUrl,
      calendarEventId: results[0].calendarEventId
    };
  }

  return {
    savedFolder: folderName,
    driveFileUrls: results.map(r => r.driveFileUrl),
    calendarEventIds: results.map(r => r.calendarEventId)
  };
}

/**
 * Kiểm tra xem thư mục tháng đã tồn tại chưa, nếu chưa có thì tự động tạo mới
 */
function getOrCreateMonthFolder(parentId, folderName) {
  const parentFolder = DriveApp.getFolderById(parentId);
  const subFolders = parentFolder.getFoldersByName(folderName);
  
  if (subFolders.hasNext()) {
    return subFolders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

/**
 * Gửi dữ liệu thông báo hành trình lên nhóm chat chung
 */
function sendChatNotification(results) {
  if (!CHAT_WEBHOOK_URL || CHAT_WEBHOOK_URL.startsWith('URL_WEBHOOK')) {
    Logger.log("Cấu hình Webhook không hợp lệ.");
    return;
  }

  if (!results || results.length === 0) {
    Logger.log("Không có thông tin vé để gửi thông báo.");
    return;
  }

  const vhMention = getVhMention();
  const bossMention = getBossMention();
  const ticketCount = results.length;

  // Dòng 1: @vh. Dear Boss @손민창 (Son, MinChang) , '200' xin gửi X vé máy bay:
  let messageText = `${vhMention} Dear Boss ${bossMention} , '${CALENDAR_NAME}' xin gửi ${ticketCount} vé máy bay:\n`;

  // Các dòng thông tin vé máy bay
  results.forEach(ticket => {
    // Định dạng: • VN213: HAN -> SGN: 13:00 ngày 21/05/2026
    messageText += `• ${ticket.ticketCode || 'Vé máy bay'}: ${ticket.from} -> ${ticket.to}: ${ticket.time} ngày ${ticket.dateFormatted}\n`;
    
    // Định dạng link PDF kèm tên file dạng markdown để hiển thị link ngắn gọn
    if (ticket.driveFileUrl && ticket.driveFileUrl !== "Không có file đính kèm") {
      messageText += `<${ticket.driveFileUrl}|${ticket.fileName}.pdf>\n`;
    }
  });

  // Dòng cuối: Chúng tôi cũng đã note trên lịch của Boss ạ.
  messageText += `\nChúng tôi cũng đã note trên lịch của Boss ạ.`;
                      
  const payload = JSON.stringify({ text: messageText });
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(CHAT_WEBHOOK_URL, options);
}