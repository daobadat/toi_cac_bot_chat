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
var API_KEY = PropertiesService.getScriptProperties().getProperty('GEMMA_API_KEY');


/**
 * [CHẾ ĐỘ HTTP ENDPOINT] Hàm kiểm tra deployment - truy cập URL Web App để test
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Air Ticket Bot đang hoạt động',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * [CHẾ ĐỘ HTTP ENDPOINT] Hàm tiếp nhận dữ liệu từ Form AI gửi tới qua phương thức POST
 * QUAN TRỌNG: Nếu dùng Google Chat App trigger (không phải HTTP), 
 * các hàm onMessage/onCardClick/onAddToSpace/onRemoveFromSpace được gọi TRỰC TIẾP
 * (không qua doPost). Cần đảm bảo script được publish đúng dạng Chat App, không chỉ là Web App.
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
    // Nhận diện event từ Google Chat:
    // - Workspace Add-on: hostApp === "chat", có chat.messagePayload, hoặc commonEventObject
    // - Legacy Chat App: type === "MESSAGE" / "ADDED_TO_SPACE" / "REMOVED_FROM_SPACE" / "CARD_CLICKED"
    // LƯU Ý: KHÔNG dùng eventData.from/to để nhận diện vì payload vé máy bay cũng có các field này
    const isGoogleChatAddOn = !!(eventData.hostApp === 'chat' || eventData.chat ||
      (eventData.commonEventObject && !eventData.from && !eventData.to));
    const isLegacyChatApp = !!(eventData.type &&
      (eventData.type.startsWith('ADDED') ||
        eventData.type.startsWith('REMOVED') ||
        eventData.type.includes('MESSAGE') ||
        eventData.type.includes('CARD')));
    const isGoogleChat = isGoogleChatAddOn || isLegacyChatApp;

    if (isGoogleChat) {
      let chatReply = null;

      // Xác định loại sự kiện từ Google Chat
      let eventType = eventData.type || '';

      // Nếu là Workspace Add-on hoặc có cấu trúc chat mới
      // QUAN TRỌNG: Kiểm tra MESSAGE trước CARD_CLICKED để tránh nhận nhầm
      if (!eventType && eventData.chat && eventData.chat.appCommandPayload) {
        eventType = 'APP_COMMAND';
      }
      if (!eventType && eventData.chat && eventData.chat.messagePayload && eventData.chat.messagePayload.message) {
        eventType = 'MESSAGE';
      }
      // Chỉ xét CARD_CLICKED nếu chưa xác định được eventType VÀ không có messagePayload
      if (!eventType && eventData.commonEventObject &&
        (eventData.commonEventObject.invokedFunction || eventData.commonEventObject.formInputs) &&
        !(eventData.chat && eventData.chat.messagePayload && eventData.chat.messagePayload.message)) {
        eventType = 'CARD_CLICKED';
      }

      Logger.log("Loại sự kiện Chat nhận diện: " + eventType);

      if (eventType === 'ADDED_TO_SPACE') {
        chatReply = onAddToSpace(eventData);
      } else if (eventType === 'CARD_CLICKED') {
        chatReply = onCardClick(eventData);
      } else if (eventType === 'APP_COMMAND' || eventType.includes('APP_COMMAND')) {
        chatReply = onAppCommand(eventData);
      } else if (eventType === 'MESSAGE' || eventType.includes('MESSAGE')) {
        chatReply = onMessage(eventData);
      } else if (eventType === 'REMOVED_FROM_SPACE') {
        onRemoveFromSpace(eventData);
        chatReply = { status: 'success' };
      } else {
        // Fallback mặc định
        chatReply = onMessage(eventData);
      }

      // Đảm bảo không trả về null cho Google Chat (gây lỗi 500)
      if (!chatReply) {
        chatReply = { text: "✅ Đã xử lý xong." };
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
  Logger.log("actionName: " + actionName);
  if (actionName === 'openTicketDialog') {
    return openTicketDialog(event);
  } else if (actionName === 'handleTicketSubmit') {
    return handleTicketSubmit(event);
  }
  // Fallback: không nhận ra action -> trả về card mặc định
  return createOpenDialogCard();
}

/**
 * Trình xử lý khi App được thêm vào một Không gian (Space) hoặc chat trực tiếp
 */
function onAddToSpace(event) {
  Logger.log("App được thêm vào space: " + JSON.stringify(event));
  // Google Workspace Add-on: tin nhắn chào đơn giản dùng text (Add-on hỗ trợ text trong onAddToSpace)
  return {
    "text": "✈️ Cảm ơn bạn đã thêm *Air Ticket* vào không gian! Hãy tag @Air Ticket để đăng ký vé máy bay."
  };
}

/**
 * Trình xử lý khi App bị xóa khỏi Không gian (Space)
 */
function onRemoveFromSpace(event) {
  Logger.log("App bị xóa khỏi space: " + JSON.stringify(event));
}
/**
 * Xử lý slash command /ticket - mở form đăng ký vé
 * ĐĂNG KÝ SLASH COMMAND: vào cấu hình Add-on trong Google Cloud Console
 * → Chat API → Configuration → Slash commands → Thêm:
 *   Command name: /ticket
 *   Command ID: 1
 *   Description: Đăng ký vé máy bay
 *   Opens a dialog: ✅ (bật)
 */
function onSlashCommand(event) {
  Logger.log("Slash command nhận được: " + JSON.stringify(event));
  const commandId = event.slashCommand && event.slashCommand.commandId;

  // Command ID 1 = /ticket
  if (commandId == 1 || (event.message && event.message.slashCommand)) {
    return openTicketDialogDirect(null, event);
  }

  return { "text": "Lệnh không được nhận diện." };
}

/**
 * Trình xử lý khi người dùng sử dụng các App Command (Slash commands hoặc Quick commands mới) trong Google Chat
 */
function onAppCommand(event) {
  Logger.log("App Command nhận được: " + JSON.stringify(event));

  let appCommandId = null;
  if (event.appCommandMetadata && event.appCommandMetadata.appCommandId) {
    appCommandId = event.appCommandMetadata.appCommandId;
  } else if (event.chat && event.chat.appCommandPayload && event.chat.appCommandPayload.appCommandMetadata && event.chat.appCommandPayload.appCommandMetadata.appCommandId) {
    appCommandId = event.chat.appCommandPayload.appCommandMetadata.appCommandId;
  }

  Logger.log("appCommandId nhận diện: " + appCommandId);

  // Command ID 1 = /ticket
  if (appCommandId == 1) {
    return openTicketDialogDirect(null, event);
  }

  return { "text": "Lệnh không được nhận diện." };
}

/**
 * Helper: Kiểm tra sự kiện có phải đến từ Workspace Add-on không
 */
function isAddOnEvent(event) {
  if (!event) return true; // Mặc định là Add-on
  return !!(event.hostApp === 'chat' || event.chat || (event.commonEventObject && !event.from && !event.to));
}

/**
 * Mở dialog form trực tiếp - dùng cho slash command
 * Slash command với "Opens a dialog: true" → trả về actionResponse DIALOG
 */
function openTicketDialogDirect(prefilledValues, event) {
  const values = prefilledValues || {};
  const isAddOn = isAddOnEvent(event);

  if (isAddOn) {
    return {
      "actionResponse": {
        "type": "DIALOG",
        "dialogAction": {
          "action": {
            "navigations": [
              {
                "pushCard": {
                  "header": {
                    "title": "200 AI - Air Ticket",
                    "subtitle": "✈️ Đăng ký Vé Máy Bay"
                  },
                  "sections": [
                    {
                      "header": "Thông tin hành trình",
                      "widgets": [
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
                            "text": "<i>Hệ thống sẽ tự động tạo lịch Google Calendar cho Boss và thông báo vào nhóm chat.</i>"
                          }
                        },
                        {
                          "buttonList": {
                            "buttons": [
                              {
                                "text": "✅ Submit",
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
            ]
          }
        }
      }
    };
  } else {
    return {
      "actionResponse": {
        "type": "DIALOG",
        "dialogAction": {
          "dialog": {
            "body": {
              "header": {
                "title": "200 AI - Air Ticket",
                "subtitle": "✈️ Đăng ký Vé Máy Bay"
              },
              "sections": [
                {
                  "header": "Thông tin hành trình",
                  "widgets": [
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
                        "text": "<i>Hệ thống sẽ tự động tạo lịch Google Calendar cho Boss và thông báo vào nhóm chat.</i>"
                      }
                    },
                    {
                      "buttonList": {
                        "buttons": [
                          {
                            "text": "✅ Submit",
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
}



/**
 * Phân tích loại sự kiện nhận được từ Google Chat (tương thích cả Legacy Chat App và Workspace Add-on)
 */
function getGoogleChatEventType(data) {
  if (data.type) return data.type;

  // Nếu là Google Workspace Add-on có appCommandPayload
  if (data.chat && data.chat.appCommandPayload) {
    return 'APP_COMMAND';
  }

  // Nếu là Google Workspace Add-on (hostApp === 'chat')
  if (data.chat && data.chat.messagePayload) {
    if (data.chat.messagePayload.message) {
      return 'MESSAGE';
    }
  }

  // Kiểm tra MESSAGE trước CARD_CLICKED để tránh nhận nhầm
  if (data.commonEventObject && data.commonEventObject.formInputs &&
    !(data.chat && data.chat.messagePayload && data.chat.messagePayload.message)) {
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
        const botDisplayName = ann.userMention.user.displayName;
        if (botDisplayName) {
          // Xóa dạng @DisplayName và DisplayName (không phân biệt hoa thường)
          const regex = new RegExp('@?' + escapeRegExp(botDisplayName), 'gi');
          textVal = textVal.replace(regex, '');
        }
      }
    });
  }

  // Tự lọc bỏ các tag định dạng HTML mention <users/all>, <users/USER_ID>
  textVal = textVal.replace(/<users\/[^>]+>/g, '');
  // Lọc @Mention (bao gồm tên có dấu cách được nối bằng ký tự đặc biệt)
  textVal = textVal.replace(/@\S+/g, '');

  // Xóa dấu cách thừa sau khi lọc
  textVal = textVal.replace(/\s+/g, ' ').trim();

  return textVal;
}

/**
 * Gọi Gemini API để tự động phân tích và trích xuất thông tin vé máy bay từ văn bản tự do
 */
function extractTicketWithGemini(userMessage) {
  if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY' || API_KEY === 'YOUR_GEMMA_API_KEY' || API_KEY.trim() === '') {
    Logger.log("Chưa cấu hình GEMMA_API_KEY.");
    return null;
  }

  const model = "gemini-2.5-flash"; // Bạn có thể đổi sang model mong muốn
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

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
    "muteHttpExceptions": true,
    // Apps Script HTTP timeout mặc định là 30s, Gemini thường < 10s
    // Nếu Gemini chậm hơn, script sẽ bị timeout trước Google Chat (30s)
    "followRedirects": true
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
    const message = (event.chat && event.chat.messagePayload && event.chat.messagePayload.message)
      || event.message
      || null;
    const cleanText = getCleanMessageText(message);
    Logger.log("cleanText sau khi lọc: '" + cleanText + "'");

    // ================================================================
    // QUAN TRỌNG: Workspace Add-on onMessage CHỈ được trả về { text }
    // Không thể trả về card hay dialog từ onMessage.
    // Để mở form → dùng slash command /ticket (đăng ký trong cấu hình Add-on)
    // ================================================================

    // Có text kèm theo + có Gemini key → thử trích xuất tự động
    const hasGemini = API_KEY && API_KEY !== '' && API_KEY !== 'YOUR_GEMINI_API_KEY' && API_KEY !== 'YOUR_GEMMA_API_KEY';

    if (cleanText && hasGemini) {
      let extractedData = null;
      try {
        extractedData = extractTicketWithGemini(cleanText);
      } catch (geminiError) {
        Logger.log("Lỗi gọi Gemini API: " + geminiError.toString());
      }

      if (extractedData && extractedData.from && extractedData.to) {
        try {
          extractedData.pdfBase64 = null;
          processAirTicketWorkflow(extractedData);
          return {
            "text": `✈️ *AI đã nhận diện hành trình và tự động đặt lịch thành công!*\n` +
              `• *Mã vé:* ${extractedData.ticketCode || 'Chưa rõ'}\n` +
              `• *Lộ trình:* Từ ${extractedData.from} đi ${extractedData.to}\n` +
              `• *Thời gian:* ${extractedData.time || 'Chưa rõ'} ngày ${extractedData.date || 'Chưa rõ'}\n` +
              `• *Ghi chú:* ${extractedData.note || 'Không có'}`
          };
        } catch (workflowError) {
          Logger.log("Lỗi workflow: " + workflowError.toString());
          return { "text": "⚠️ Nhận diện được vé nhưng lưu thất bại. Dùng */ticket* để nhập tay." };
        }
      }
    }

    // Mọi trường hợp còn lại (chỉ tag, không có Gemini, trích xuất thất bại)
    // → hướng dẫn dùng slash command
    return {
      "text": "✈️ Hãy dùng lệnh */ticket* để mở form đăng ký hoặc tag kèm theo thông tin vé (ví dụ: @Air Ticket VN213 HAN SGN 13:00 21/05/2026) để AI tự động đặt lịch."
    };

  } catch (error) {
    Logger.log("Lỗi handleChatMessageEvent: " + error.toString());
    return { "text": "❌ Lỗi xử lý: " + error.toString() };
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

  // Google Workspace Add-on (Tiện ích bổ sung) dùng renderActions + pushCard
  // KHÔNG dùng cardsV2 (chỉ dành cho Chat App thuần)
  const card = {
    "header": {
      "title": "200 AI - Air Ticket",
      "subtitle": "✈️ Đăng ký hành trình Vé Máy Bay"
    },
    "sections": [
      {
        "widgets": [
          {
            "textParagraph": {
              "text": "Vui lòng click nút bên dưới để nhập thông tin vé máy bay."
            }
          },
          {
            "buttonList": {
              "buttons": [
                {
                  "text": "✈️ Đăng ký vé",
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
  };

  return {
    "renderActions": {
      "action": {
        "navigations": [
          {
            "pushCard": card
          }
        ]
      }
    }
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
  // Google Workspace Add-on dùng renderActions + openDialog (không dùng actionResponse)
  return {
    "renderActions": {
      "action": {
        "navigations": [
          {
            "pushCard": {
              "header": {
                "title": "200 AI - Air Ticket",
                "subtitle": "✈️ Đăng ký Vé Máy Bay"
              },
              "sections": [
                {
                  "header": "Thông tin hành trình",
                  "widgets": [
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
                        "text": "<i>Hệ thống sẽ tự động tạo lịch Google Calendar cho Boss và thông báo vào nhóm chat.</i>"
                      }
                    },
                    {
                      "buttonList": {
                        "buttons": [
                          {
                            "text": "✅ Submit",
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
        ]
      }
    }
  };
}

/**
 * Helper: Lấy giá trị đầu vào từ widget của Form Dialog
 */
function getInputValue(formInputs, fieldName) {
  if (!formInputs || !formInputs[fieldName]) return '';
  // Workspace Add-on format: formInputs[field].stringInputs.value[0]
  if (formInputs[fieldName].stringInputs && formInputs[fieldName].stringInputs.value) {
    return formInputs[fieldName].stringInputs.value[0] || '';
  }
  // Fallback: một số Add-on trả về trực tiếp value
  if (typeof formInputs[fieldName] === 'string') {
    return formInputs[fieldName];
  }
  return '';
}

/**
 * Trình xử lý khi người dùng nhấn nút Submit trong Dialog Form
 */
function handleTicketSubmit(event) {
  const isAddOn = isAddOnEvent(event);
  try {
    const formInputs = event.commonEventObject ? event.commonEventObject.formInputs : null;

    const ticketCode = getInputValue(formInputs, 'ticketCode');
    const from = getInputValue(formInputs, 'from');
    const to = getInputValue(formInputs, 'to');
    const date = getInputValue(formInputs, 'date');
    const time = getInputValue(formInputs, 'time');
    const note = getInputValue(formInputs, 'note');

    if (!from || !to) {
      if (isAddOn) {
        return {
          "actionResponse": {
            "notification": {
              "text": "⚠️ Vui lòng điền đầy đủ Điểm đi và Điểm đến!"
            }
          }
        };
      } else {
        return {
          "actionResponse": {
            "type": "DIALOG",
            "dialogAction": {
              "actionStatus": {
                "statusCode": "INVALID_ARGUMENT",
                "userFacingMessage": "⚠️ Vui lòng điền đầy đủ Điểm đi và Điểm đến!"
              }
            }
          }
        };
      }
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

    // Đóng dialog và thông báo thành công
    if (isAddOn) {
      return {
        "renderActions": {
          "action": {
            "navigations": [
              {
                "endNavigation": "CLOSE_DIALOG"
              }
            ],
            "notification": {
              "text": "✅ Đã lưu thông tin vé máy bay thành công!"
            }
          }
        }
      };
    } else {
      return {
        "actionResponse": {
          "type": "DIALOG",
          "dialogAction": {
            "actionStatus": {
              "statusCode": "OK",
              "userFacingMessage": "✅ Đã lưu thông tin vé máy bay thành công!"
            }
          }
        }
      };
    }
  } catch (error) {
    if (isAddOn) {
      return {
        "actionResponse": {
          "notification": {
            "text": "❌ Có lỗi xảy ra: " + error.toString()
          }
        }
      };
    } else {
      return {
        "actionResponse": {
          "type": "DIALOG",
          "dialogAction": {
            "actionStatus": {
              "statusCode": "UNKNOWN",
              "userFacingMessage": "❌ Có lỗi xảy ra: " + error.toString()
            }
          }
        }
      };
    }
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
      // Chuyển đổi chuỗi ngày giờ thành đối tượng Date của hệ thống bằng cách sử dụng thông tin đã được parse chuẩn hóa
      const startDateTime = new Date(`${dateInfo.year}-${dateInfo.month}-${dateInfo.day}T${ticket.time}:00`);

      if (!isNaN(startDateTime.getTime())) {
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
      } else {
        Logger.log("Ngày giờ không hợp lệ để tạo lịch: " + ticket.date + " " + ticket.time);
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
      // Google Chat webhook hỗ trợ format link dạng <URL> hoặc URL thuần
      messageText += `  📎 ${ticket.fileName}.pdf: ${ticket.driveFileUrl}\n`;
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