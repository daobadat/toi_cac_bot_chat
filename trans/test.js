var TEST_MODEL_NAME = 'gemini-2.5-flash';
var TEST_SCRIPT_PROP_KEY = 'GEMINI_API_KEY';

function DEBUG_Gemini_Deep_Check() {
  Logger.log('Bat dau quet loi ket noi Gemini API...');
  Logger.log('Model dang dung: ' + TEST_MODEL_NAME);

  try {
    var apiKey = getGeminiApiKeyForTest_();
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + TEST_MODEL_NAME + ':generateContent?key=' + encodeURIComponent(apiKey);
    var payload = {
      contents: [{ parts: [{ text: 'Hello, this is a test connection.' }] }]
    };
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    var responseData = safeJsonParseTest_(responseText);

    Logger.log('---------------------------------------------------');
    Logger.log('Response code: ' + responseCode);

    if (responseCode >= 200 && responseCode < 300) {
      var text = extractTextFromGeminiTest_(responseData);
      Logger.log('Ket qua: Thanh cong.');
      Logger.log('Noi dung mau: ' + (text ? text.substring(0, 200) : '(khong co text)'));
    } else {
      Logger.log('Ket qua: That bai.');
      Logger.log('Chi tiet loi: ' + (responseData ? JSON.stringify(responseData) : responseText));
      logHintByStatus_(responseCode);
    }
  } catch (e) {
    Logger.log('Loi nghiem trong (script): ' + e.toString());
  }

  Logger.log('---------------------------------------------------');
}

function getGeminiApiKeyForTest_() {
  var key = PropertiesService.getScriptProperties().getProperty(TEST_SCRIPT_PROP_KEY);
  if (!key) {
    throw new Error('Missing Script Property: ' + TEST_SCRIPT_PROP_KEY);
  }
  return key;
}

function safeJsonParseTest_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function extractTextFromGeminiTest_(data) {
  if (!data || !data.candidates || !data.candidates.length) return '';
  var first = (((data.candidates[0] || {}).content || {}).parts || [])[0] || {};
  return (first.text || '').trim();
}

function logHintByStatus_(status) {
  Logger.log('Goi y sua loi:');
  if (status === 400) Logger.log('400 Bad Request: payload sai dinh dang hoac model/key khong hop.');
  if (status === 401) Logger.log('401 Unauthorized: API key khong hop le hoac da bi xoa.');
  if (status === 403) Logger.log('403 Forbidden: key chua duoc cap quyen hoac bi chan.');
  if (status === 404) Logger.log('404 Not Found: ten model sai.');
  if (status === 429) Logger.log('429 Too Many Requests: vuot quota hoac gui qua nhanh.');
  if (status === 500 || status === 503) Logger.log('500/503: dich vu Google tam thoi qua tai.');
}