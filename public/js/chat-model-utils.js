(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatModelUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function formatChatModelDropdownLabel(label, modelId) {
    const source = String(label || modelId || '').trim();
    const value = String(modelId || source).trim();
    const normalizedValue = value.toLowerCase();
    if (!source && !normalizedValue) return '';

    const labelMap = {
      'gpt-5.5': 'GPT-5.5',
      'gpt-5.4': 'GPT-5.4',
      'gpt-5.4-mini': 'GPT-5.4 Mini',
      'gpt-5.3-codex': 'GPT-5.3 Codex',
      'gpt-5.3-codex-spark': 'GPT-5.3 Codex Spark',
      'gpt-5.2': 'GPT-5.2',
      'gpt-5.2-chat-latest': 'GPT-5.2 Chat',
      'gpt-5.2-pro': 'GPT-5.2 Pro',
      'gpt-4.5-preview': 'GPT-4.5 Preview',
      'gpt-4.1': 'GPT-4.1',
      'gpt-4.1-mini': 'GPT-4.1 Mini',
      'gpt-4.1-nano': 'GPT-4.1 Nano',
      'chatgpt-4o-latest': 'ChatGPT-4o Latest',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-2024-11-20': 'GPT-4o 2024-11',
      'gpt-4o-2024-08-06': 'GPT-4o 2024-08',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-0125': 'GPT-3.5 0125',
      'gpt-3.5-turbo-1106': 'GPT-3.5 1106',
      'gpt-3.5-turbo-16k': 'GPT-3.5 16K',
      'o1': 'o1',
      'o1-mini': 'o1 Mini',
      'o1-preview': 'o1 Preview',
      'o1-pro': 'o1 Pro',
      'o3': 'o3',
      'o3-mini': 'o3 Mini',
      'o3-pro': 'o3 Pro',
      'o4-mini': 'o4 Mini'
    };
    if (labelMap[normalizedValue]) return labelMap[normalizedValue];

    function formatToken(token) {
      const tokenMap = {
        mini: 'Mini',
        nano: 'Nano',
        pro: 'Pro',
        preview: 'Preview',
        latest: 'Latest',
        turbo: 'Turbo',
        codex: 'Codex',
        spark: 'Spark',
        chat: 'Chat'
      };
      return tokenMap[token] || token.toUpperCase();
    }

    function formatParts(prefix, parts) {
      const version = parts[0];
      const rest = parts.slice(1);
      if (!version) return source;
      const labelParts = [prefix + '-' + version];
      for (let index = 0; index < rest.length; index += 1) {
        const token = rest[index];
        if (/^\d{4}$/.test(token) && /^\d{2}$/.test(rest[index + 1] || '') && /^\d{2}$/.test(rest[index + 2] || '')) {
          labelParts.push(token + '-' + rest[index + 1] + '-' + rest[index + 2]);
          index += 2;
          continue;
        }
        labelParts.push(formatToken(token));
      }
      return labelParts.join(' ');
    }

    if (normalizedValue.startsWith('chatgpt-')) {
      return formatParts('ChatGPT', normalizedValue.split('-').slice(1));
    }
    if (normalizedValue.startsWith('gpt-')) {
      return formatParts('GPT', normalizedValue.split('-').slice(1));
    }
    if (/^o\d/.test(normalizedValue)) {
      const parts = normalizedValue.split('-');
      return [parts[0]].concat(parts.slice(1).map(formatToken)).join(' ');
    }

    return source;
  }

  function getChatModelGroupLabel(modelId) {
    const value = String(modelId || '').trim().toLowerCase();
    if (!value) return 'Other';
    if (value.startsWith('gpt-5')) return 'GPT-5.x';
    if (value.startsWith('gpt-4.5')) return 'GPT-4.5';
    if (value.startsWith('gpt-4.1')) return 'GPT-4.1';
    if (value.startsWith('chatgpt-4o')) return 'ChatGPT-4o';
    if (value.startsWith('gpt-4o')) return 'GPT-4o';
    if (value.startsWith('gpt-4')) return 'GPT-4';
    if (value.startsWith('gpt-3.5')) return 'GPT-3.5';
    if (/^o\d/.test(value)) return 'o Series';
    return 'Other';
  }

  function getChatModelSeriesLabel(modelId) {
    return getChatModelGroupLabel(modelId);
  }

  function getChatModelSeriesClass(seriesLabel) {
    const value = String(seriesLabel || '').trim();
    if (!value) return '';
    if (value === 'GPT-5.x') return 'series-gpt5';
    if (value === 'GPT-4.5') return 'series-gpt45';
    if (value === 'GPT-4.1') return 'series-gpt41';
    if (value === 'ChatGPT-4o') return 'series-chatgpt4o';
    if (value === 'GPT-4o') return 'series-gpt4o';
    if (value === 'GPT-4') return 'series-gpt4';
    if (value === 'GPT-3.5') return 'series-gpt35';
    if (value === 'o Series') return 'series-o';
    return 'series-other';
  }

  function getChatModelTagClass(tag) {
    const value = String(tag || '').trim();
    if (!value) return '';
    if (value === '推荐') return 'tone-recommended';
    if (value === '高质量') return 'tone-quality';
    if (value === '快速') return 'tone-fast';
    if (value === '预览') return 'tone-preview';
    if (value === '均衡') return 'tone-balanced';
    if (value === '低成本') return 'tone-budget';
    if (value === '代码') return 'tone-code';
    if (value === '推理') return 'tone-reasoning';
    if (value === '轻量') return 'tone-light';
    if (value === '通用') return 'tone-general';
    return '';
  }

  return {
    formatChatModelDropdownLabel,
    getChatModelGroupLabel,
    getChatModelSeriesLabel,
    getChatModelSeriesClass,
    getChatModelTagClass
  };
}));
