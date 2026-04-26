(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceMediaTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const setCurrentResult = settings.setCurrentResult || function () {};

    function fileToBase64(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          const result = typeof reader.result === 'string' ? reader.result : '';
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function formatFileSize(size) {
      const value = Number(size || 0);
      if (!Number.isFinite(value) || value <= 0) return '未知大小';
      if (value < 1024) return value + ' B';
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
      if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
      return (value / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }

    function normalizeMediaTypeLabel(file) {
      const type = String(file?.type || '').toLowerCase();
      if (type.startsWith('audio/')) return '音频';
      if (type.startsWith('video/')) return '视频';
      return '媒体文件';
    }

    function getTranscriptionSelectedFile() {
      return getElement('transcription-file')?.files?.[0] || null;
    }

    function syncTranscriptionFilePreview(file) {
      const preview = getElement('transcription-upload-preview');
      const fileName = getElement('transcription-file-name');
      const fileMeta = getElement('transcription-file-meta');
      if (!preview || !fileName || !fileMeta) return;

      if (!file) {
        preview.setAttribute('hidden', '');
        fileName.textContent = '未选择文件';
        fileMeta.textContent = '';
        return;
      }

      fileName.textContent = file.name || '未命名文件';
      fileMeta.textContent = normalizeMediaTypeLabel(file) + ' · ' + formatFileSize(file.size);
      preview.removeAttribute('hidden');
    }

    function renderTranscriptionExperimentalPlan(file) {
      const resultArea = getElement('transcription-result');
      const meta = getElement('transcription-meta');
      const title = getElement('transcription-result-title');
      const subtitle = getElement('transcription-result-subtitle');
      const text = getElement('transcription-text');
      if (!resultArea || !title || !subtitle || !text) return;

      const fileLabel = file?.name || '当前文件';
      const typeLabel = normalizeMediaTypeLabel(file);
      if (meta) {
        meta.textContent = file ? typeLabel + ' · ' + formatFileSize(file?.size || 0) : '未选择文件 · 实验入口';
      }
      title.textContent = '转写服务接入计划';
      subtitle.textContent = file
        ? '已选择 ' + fileLabel + '，当前仅展示接入计划，不会生成识别文本。'
        : '当前仅展示接入计划，不会生成识别文本。';
      text.textContent = [
        '语音转文字仍处于实验接入阶段。',
        file ? '已选择文件：' + fileLabel : '已选择文件：无',
        file ? '文件类型：' + typeLabel : '',
        '',
        '正式开放前需要完成：',
        '1. 选定转写服务和鉴权方式',
        '2. 增加后端上传、抽音轨和异步任务队列',
        '3. 返回纯文本或分段文本结果',
        '4. 增加失败重试、费用限制和灰度开关',
        '',
        '当前不会生成识别文本。'
      ].filter(Boolean).join('\n');
      resultArea.removeAttribute('hidden');
      setCurrentResult('transcription', {
        text: text.textContent,
        fileName: file?.name || null
      });
    }

    return {
      fileToBase64: fileToBase64,
      formatFileSize: formatFileSize,
      normalizeMediaTypeLabel: normalizeMediaTypeLabel,
      getTranscriptionSelectedFile: getTranscriptionSelectedFile,
      syncTranscriptionFilePreview: syncTranscriptionFilePreview,
      renderTranscriptionExperimentalPlan: renderTranscriptionExperimentalPlan
    };
  }

  return {
    createTools: createTools
  };
}));
