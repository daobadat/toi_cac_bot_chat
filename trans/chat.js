var GEMINI_MODEL = 'gemini-2.5-flash';
var OPENAI_MODEL = 'gpt-4o-mini';
var MENTION_LABEL = '@vh (AI)';
var GEMINI_SCRIPT_PROP_KEY = 'GEMINI_API_KEY';
var OPENAI_SCRIPT_PROP_KEY = 'OPENAI_API_KEY';
var LAST_PROVIDER_SCRIPT_PROP_KEY = 'LAST_TRANSLATION_PROVIDER';
var URL_REPLACEMENT = '<위 링크 참조>';
var REQUEST_TIMEOUT_MS = 25000;
var MAX_RETRY_COUNT = 2;

function onMessage(event) {
  var originalText = (((event || {}).message || {}).formattedText || '').toString();
  var displayName = (((event || {}).user || {}).displayName || 'User').toString();

  if (!originalText.trim()) {
    return { text: displayName + ' said: (empty message)' };
  }

  var normalizedInput = normalizeInputText(originalText);
  var translatedText = translateServerSide_(normalizedInput);
  var mergedText = alignNewlines(originalText, translatedText);

  return { text: displayName + ' said: ' + mergedText };
}

function normalizeInputText(text) {
  return text
    .replace(MENTION_LABEL, '')
    .trim()
    .replace(/https?:\/\/[^\s]+/gi, URL_REPLACEMENT);
}

function alignNewlines(original, translated) {
  var originLines = original.split('\n');
  var translatedLines = translated.split('\n');

  for (var i = 0; i < originLines.length; i++) {
    if (originLines[i] === '' && translatedLines[i] !== '') {
      translatedLines.splice(i, 0, '');
      i++;
    }
  }

  return translatedLines.join('\n');
}

function translateWithGemini(text) {
  var apiKey = getScriptPropertyOrThrow_(GEMINI_SCRIPT_PROP_KEY);
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
  var prompt = buildTranslationPrompt_(text);

  var payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = fetchWithRetryServer_(url, options, 'Gemini');
    var status = response.getResponseCode();
    var bodyText = response.getContentText();
    var data = safeJsonParse_(bodyText);

    if (status >= 200 && status < 300) {
      var translated = extractTranslatedText_(data);
      if (translated) {
        // Giữ định dạng nhưng loại dòng trắng bị model bơm thêm quá nhiều.
        return translated.replace(/\n{3,}/g, '\n\n');
      }
    }

    logApiError_(status, data || bodyText);
    return '번역 오류!';
  } catch (error) {
    Logger.log('[translateWithGemini] Unexpected error: ' + error);
    return '번역 오류!';
  }
}

function translateWithOpenAI(text) {
  var apiKey = getScriptPropertyOrThrow_(OPENAI_SCRIPT_PROP_KEY);
  var url = 'https://api.openai.com/v1/chat/completions';
  var payload = {
    model: OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: buildTranslationPrompt_(text) },
      { role: 'user', content: 'Dịch sang tiếng Hàn:\n\n"""' + text + '"""' }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = fetchWithRetryServer_(url, options, 'OpenAI');
    var status = response.getResponseCode();
    var bodyText = response.getContentText();
    var data = safeJsonParse_(bodyText);

    if (status >= 200 && status < 300) {
      var translated = (((((data || {}).choices || [])[0] || {}).message || {}).content || '').trim();
      if (translated) {
        return translated.replace(/\n{3,}/g, '\n\n');
      }
    }

    logApiError_(status, data || bodyText, 'OpenAI');
    return '번역 오류!';
  } catch (error) {
    Logger.log('[translateWithOpenAI] Unexpected error: ' + error);
    return '번역 오류!';
  }
}

function translateServerSide_(text) {
  var providers = buildServerProviderOrder_();
  var lastError = null;

  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i];
    try {
      if (provider === 'openai') {
        return translateWithOpenAI(text);
      }
      return translateWithGemini(text);
    } catch (error) {
      lastError = error;
      Logger.log('[translateServerSide_] ' + provider + ' failed, trying next provider: ' + error);
    }
  }

  throw lastError || new Error('Không thể dịch: cả Gemini và OpenAI đều thất bại');
}

function pickProviderForServer_() {
  var props = PropertiesService.getScriptProperties();
  var hasGemini = !!props.getProperty(GEMINI_SCRIPT_PROP_KEY);
  var hasOpenAI = !!props.getProperty(OPENAI_SCRIPT_PROP_KEY);

  if (!hasGemini && !hasOpenAI) {
    throw new Error('Missing Script Property: ' + GEMINI_SCRIPT_PROP_KEY + ' or ' + OPENAI_SCRIPT_PROP_KEY);
  }
  if (hasGemini && !hasOpenAI) return 'gemini';
  if (!hasGemini && hasOpenAI) return 'openai';

  var last = (props.getProperty(LAST_PROVIDER_SCRIPT_PROP_KEY) || 'openai').toLowerCase();
  var next = last === 'gemini' ? 'openai' : 'gemini';
  props.setProperty(LAST_PROVIDER_SCRIPT_PROP_KEY, next);
  return next;
}

function buildServerProviderOrder_() {
  var props = PropertiesService.getScriptProperties();
  var hasGemini = !!props.getProperty(GEMINI_SCRIPT_PROP_KEY);
  var hasOpenAI = !!props.getProperty(OPENAI_SCRIPT_PROP_KEY);

  if (!hasGemini && !hasOpenAI) {
    throw new Error('Missing Script Property: ' + GEMINI_SCRIPT_PROP_KEY + ' or ' + OPENAI_SCRIPT_PROP_KEY);
  }
  if (hasGemini && !hasOpenAI) return ['gemini'];
  if (!hasGemini && hasOpenAI) return ['openai'];

  var primary = pickProviderForServer_();
  return primary === 'gemini' ? ['gemini', 'openai'] : ['openai', 'gemini'];
}

function getScriptPropertyOrThrow_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('Missing Script Property: ' + key);
  }
  return value;
}

function buildTranslationPrompt_(text) {
  return [
    'Bạn là một chuyên gia dịch thuật trong lĩnh vực kiến trúc và xây dựng.',
    'Hiện tại, bạn đang phụ trách dịch thuật cho công ty ADD Group.',
    'ADD Group (ADD) bao gồm các công ty con sau:',
    '- Plan ADD Việt Nam (VPA)',
    '- Plan ADD Hàn Quốc (KPA)',
    '- ADD Construction (ADC)',
    '',
    'Hãy dịch chính xác văn bản từ tiếng Việt sang tiếng Hàn.',
    '- Giữ nguyên định dạng văn bản (dấu gạch đầu dòng, xuống dòng, số thứ tự...).',
    '- Chỉ cung cấp nội dung đã dịch, không bao gồm văn bản gốc.',
    '- Bảo toàn tuyệt đối định dạng gốc: bullet, số thứ tự, ngắt dòng, khoảng trắng.',
    '- Riêng cụm từ "Dear Boss" thì luôn phải dịch là "친애하는 사장님".',
    '',
    'Văn bản cần dịch:',
    '"""' + text + '"""'
  ].join('\n');
}

function extractTranslatedText_(data) {
  if (!data || !data.candidates || !data.candidates.length) return '';
  var candidate = data.candidates[0] || {};
  var content = candidate.content || {};
  var parts = content.parts || [];
  var first = parts[0] || {};
  return (first.text || '').trim();
}

function safeJsonParse_(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    Logger.log('[safeJsonParse_] Invalid JSON response: ' + error);
    return null;
  }
}

function logApiError_(status, payload, provider) {
  var source = provider || 'Gemini';
  Logger.log('[' + source + ' API] status=' + status + ', payload=' + JSON.stringify(payload));
}

function isRetryableError_(error) {
  var msg = (error && error.message ? error.message : error || '').toString().toLowerCase();
  return msg.indexOf('timeout') !== -1 || msg.indexOf('timed out') !== -1 || msg.indexOf('econnreset') !== -1 || msg.indexOf('socket') !== -1 || msg.indexOf('reset') !== -1;
}

function isRetryableStatus_(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function fetchWithRetryServer_(url, options, provider) {
  var lastError;
  for (var attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
    try {
      var response = UrlFetchApp.fetch(url, options);
      var status = response.getResponseCode();
      if (!isRetryableStatus_(status) || attempt === MAX_RETRY_COUNT) {
        return response;
      }
      Utilities.sleep((attempt + 1) * 600);
    } catch (error) {
      lastError = error;
      if (!isRetryableError_(error) || attempt === MAX_RETRY_COUNT) {
        throw error;
      }
      Logger.log('[' + provider + ' API] retry ' + (attempt + 1) + '/' + MAX_RETRY_COUNT + ' due to ' + error);
      Utilities.sleep((attempt + 1) * 600);
    }
  }
  throw lastError || new Error(provider + ' API request failed');
}

// Browser helpers for translation_test.html
function makeTimeoutError_(provider, timeoutMs) {
  var error = new Error(provider + ' timeout sau ' + timeoutMs + 'ms');
  error.code = 'ETIMEDOUT';
  return error;
}

async function fetchJsonWithRetryWeb_(url, options, provider) {
  var lastError = null;
  for (var attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
    try {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId = null;
      var requestOptions = {};
      for (var key in options) requestOptions[key] = options[key];
      if (controller) {
        requestOptions.signal = controller.signal;
        timeoutId = setTimeout(function() { controller.abort(); }, REQUEST_TIMEOUT_MS);
      }

      var response = await fetch(url, requestOptions);
      if (timeoutId) clearTimeout(timeoutId);
      var data = await response.json();

      if (response.ok) {
        return data;
      }

      if (isRetryableStatus_(response.status) && attempt < MAX_RETRY_COUNT) {
        await sleepWebMs_((attempt + 1) * 500);
        continue;
      }

      var apiMessage = (((data || {}).error || {}).message || provider + ' API error').toString();
      throw new Error(apiMessage);
    } catch (error) {
      lastError = error;
      var isAbort = error && error.name === 'AbortError';
      var normalizedError = isAbort ? makeTimeoutError_(provider, REQUEST_TIMEOUT_MS) : error;
      if (!isRetryableError_(normalizedError) || attempt === MAX_RETRY_COUNT) {
        throw normalizedError;
      }
      await sleepWebMs_((attempt + 1) * 500);
    }
  }
  throw lastError || new Error(provider + ' API request failed');
}

function sleepWebMs_(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function translateWithGeminiWeb(text, apiKey, model, temperature) {
  var selectedModel = (model || GEMINI_MODEL).toString().trim() || GEMINI_MODEL;
  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(selectedModel) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  var payload = {
    contents: [{ parts: [{ text: buildTranslationPrompt_(text) }] }],
    generationConfig: {
      temperature: typeof temperature === 'number' && !isNaN(temperature) ? temperature : 0.3
    }
  };

  var data = await fetchJsonWithRetryWeb_(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 'Gemini');

  var translated = extractTranslatedText_(data);
  if (!translated) {
    throw new Error('Không nhận được nội dung dịch từ Gemini');
  }
  return translated.replace(/\n{3,}/g, '\n\n');
}

async function translateWithOpenAIWeb(text, apiKey, model, temperature) {
  var selectedModel = (model || OPENAI_MODEL).toString().trim() || OPENAI_MODEL;
  var payload = {
    model: selectedModel,
    temperature: typeof temperature === 'number' && !isNaN(temperature) ? temperature : 0.3,
    messages: [
      { role: 'system', content: buildTranslationPrompt_(text) },
      { role: 'user', content: 'Dịch sang tiếng Hàn:\n\n"""' + text + '"""' }
    ]
  };

  var data = await fetchJsonWithRetryWeb_('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey
    },
    body: JSON.stringify(payload)
  }, 'OpenAI');

  var translated = (((((data || {}).choices || [])[0] || {}).message || {}).content || '').trim();
  if (!translated) {
    throw new Error('Không nhận được nội dung dịch từ OpenAI');
  }
  return translated.replace(/\n{3,}/g, '\n\n');
}

function looksLikeOpenAIKey_(key) {
  var value = (key || '').toString().trim();
  return /^sk-[a-z0-9]/i.test(value);
}

function looksLikeGeminiKey_(key) {
  var value = (key || '').toString().trim();
  return /^AIza[0-9A-Za-z_-]+$/.test(value);
}

function resolveWebProviderConfig_(input) {
  var genericApiKey = (input.apiKey || '').toString().trim();
  var geminiKey = (input.geminiApiKey || '').toString().trim();
  var openAiKey = (input.openAiApiKey || input.openaiApiKey || '').toString().trim();
  var provider = (input.provider || 'auto').toString().toLowerCase();

  if (!geminiKey && looksLikeGeminiKey_(genericApiKey)) geminiKey = genericApiKey;
  if (!openAiKey && looksLikeOpenAIKey_(genericApiKey)) openAiKey = genericApiKey;

  var hasGemini = !!geminiKey;
  var hasOpenAI = !!openAiKey;
  if (!hasGemini && !hasOpenAI) {
    throw new Error('Vui lòng nhập Gemini API key hoặc OpenAI API key');
  }

  if (provider === 'gemini' || provider === 'openai') {
    return { provider: provider, geminiKey: geminiKey, openAiKey: openAiKey };
  }

  if (provider === 'alternate' || (provider === 'auto' && hasGemini && hasOpenAI)) {
    var lastProvider = (runTranslationForWeb._lastProvider || 'openai').toLowerCase();
    var nextProvider = lastProvider === 'gemini' ? 'openai' : 'gemini';
    runTranslationForWeb._lastProvider = nextProvider;
    return { provider: nextProvider, geminiKey: geminiKey, openAiKey: openAiKey };
  }

  return {
    provider: hasGemini ? 'gemini' : 'openai',
    geminiKey: geminiKey,
    openAiKey: openAiKey
  };
}

function buildWebProviderOrder_(config) {
  var provider = (config.provider || 'auto').toLowerCase();
  var hasGemini = !!config.geminiKey;
  var hasOpenAI = !!config.openAiKey;

  if (provider === 'gemini') {
    return hasOpenAI ? ['gemini', 'openai'] : ['gemini'];
  }
  if (provider === 'openai') {
    return hasGemini ? ['openai', 'gemini'] : ['openai'];
  }
  return hasGemini && hasOpenAI
    ? (provider === 'openai' ? ['openai', 'gemini'] : ['gemini', 'openai'])
    : (hasGemini ? ['gemini'] : ['openai']);
}

async function runTranslationForWeb(params) {
  var input = params || {};
  var rawText = (input.rawText || '').toString();
  var userName = (input.userName || 'User').toString();
  var model = (input.model || '').toString();
  var temperature = Number(input.temperature);
  if (!rawText.trim()) throw new Error('Vui lòng nhập nội dung tin nhắn');
  var config = resolveWebProviderConfig_(input);
  var providerOrder = buildWebProviderOrder_(config);

  var cleaned = normalizeInputText(rawText);
  var translated = '';
  var usedProvider = '';
  var lastError = null;

  for (var i = 0; i < providerOrder.length; i++) {
    var provider = providerOrder[i];
    try {
      if (provider === 'openai') {
        translated = await translateWithOpenAIWeb(cleaned, config.openAiKey, model || OPENAI_MODEL, temperature);
      } else {
        translated = await translateWithGeminiWeb(cleaned, config.geminiKey, model || GEMINI_MODEL, temperature);
      }
      usedProvider = provider;
      break;
    } catch (error) {
      lastError = error;
      if (i < providerOrder.length - 1) {
        continue;
      }
    }
  }

  if (!translated) {
    throw lastError || new Error('Không thể dịch: cả Gemini và OpenAI đều thất bại');
  }

  var mergedText = alignNewlines(rawText, translated);

  return {
    cleaned: cleaned,
    provider: usedProvider || config.provider,
    translated: mergedText,
    finalText: userName + ' said: ' + mergedText
  };
}

if (typeof window !== 'undefined') {
  window.ChatTranslator = {
    MENTION_LABEL: MENTION_LABEL,
    URL_REPLACEMENT: URL_REPLACEMENT,
    normalizeInputText: normalizeInputText,
    alignNewlines: alignNewlines,
    runTranslationForWeb: runTranslationForWeb
  };
}