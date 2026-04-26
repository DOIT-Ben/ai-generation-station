(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsWorkspaceGenerationTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const getElement = settings.getElement || function () { return null; };
    const apiFetch = settings.apiFetch;
    const showToast = settings.showToast || function () {};
    const showLoading = settings.showLoading || function () {};
    const hideLoading = settings.hideLoading || function () {};
    const startInlineProgress = settings.startInlineProgress || function () {};
    const stopInlineProgress = settings.stopInlineProgress || function () {};
    const resolveApiAssetUrl = settings.resolveApiAssetUrl || function (value) { return value; };
    const loadQuota = settings.loadQuota || function () {};
    const refreshUsageToday = settings.refreshUsageToday || function () {};
    const recordFeatureHistory = settings.recordFeatureHistory || function () {};
    const setCurrentResult = settings.setCurrentResult || function () {};
    const renderFeatureResult = settings.renderFeatureResult || function () {};
    const escapeHtml = settings.escapeHtml || function (value) { return String(value || ''); };
    const applyVoiceSourceMode = settings.applyVoiceSourceMode || function () {};
    const fileToBase64 = settings.fileToBase64 || function () { return Promise.reject(new Error('fileToBase64 unavailable')); };

    async function generateContent(config) {
      const {
        apiEndpoint,
        domIds,
        resultTab,
        loadingText,
        successMessage,
        onSuccess,
        historyFeature,
        buildHistoryEntry
      } = config || {};
      const payload = {};
      Object.entries(domIds || {}).forEach(function ([key, id]) {
        const element = getElement(id);
        payload[key] = element ? (element.value != null ? element.value : element.textContent || '') : '';
      });

      if (Object.values(payload).every(function (value) { return !String(value).trim(); })) {
        showToast('请填写必要信息', 'error');
        return;
      }

      const button = getElement(`btn-generate-${resultTab}`);
      const resultArea = getElement(`${resultTab}-result`);

      if (button) button.disabled = true;
      if (resultArea) resultArea.setAttribute('hidden', '');

      showLoading(loadingText, 0);
      startInlineProgress(resultTab, `${resultTab}-progress-fill`, `${resultTab}-progress-text`);

      try {
        const response = await apiFetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(function () { return { error: '请求失败' }; });
          throw new Error(errorPayload.error || '生成失败');
        }

        const data = await response.json();
        stopInlineProgress();

        if (typeof onSuccess === 'function') onSuccess(data);
        setCurrentResult(resultTab, data);
        if (historyFeature && typeof buildHistoryEntry === 'function') {
          const historyEntry = buildHistoryEntry(data, payload);
          if (historyEntry) {
            recordFeatureHistory(historyFeature, historyEntry.title, historyEntry.summary, historyEntry.inputs, historyEntry.result);
          }
        }

        if (resultArea) {
          resultArea.removeAttribute('hidden');
          resultArea.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }
        loadQuota();
        refreshUsageToday();
        showToast(successMessage, 'success');
      } catch (error) {
        stopInlineProgress();
        showToast(error.message || '生成失败，请重试', 'error');
      } finally {
        hideLoading();
        if (button) button.disabled = false;
      }
    }

    async function pollTaskStatus(request) {
      const {
        endpoint,
        taskId,
        maxAttempts,
        delayMs
      } = request || {};
      let attempts = 0;
      let statusData = null;

      while (attempts < maxAttempts) {
        await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
        const response = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId })
        });
        statusData = await response.json();
        if (statusData.status === 'completed') return statusData;
        if (statusData.status === 'error') {
          throw new Error(statusData.error || '生成失败');
        }
        attempts += 1;
      }

      throw new Error('生成超时，请稍后查看结果');
    }

    async function generateMusic() {
      const prompt = getElement('music-prompt')?.value?.trim();
      if (!prompt) {
        showToast('请输入歌词或描述', 'error');
        return;
      }

      const button = getElement('btn-generate-music');
      const resultArea = getElement('music-result');
      if (button) button.disabled = true;
      if (resultArea) resultArea.setAttribute('hidden', '');

      const config = {
        prompt,
        style: getElement('music-style')?.value || '',
        bpm: getElement('music-bpm')?.value || '',
        key: getElement('music-key')?.value || '',
        duration: getElement('music-duration')?.value || ''
      };

      startInlineProgress('music', 'music-progress-fill', 'music-progress-text');

      try {
        const response = await apiFetch('/api/generate/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!data.taskId) throw new Error('未返回任务ID');

        const statusData = await pollTaskStatus({
          endpoint: '/api/music/status',
          taskId: data.taskId,
          maxAttempts: 60,
          delayMs: 2000
        });

        stopInlineProgress();
        getElement('music-audio').src = resolveApiAssetUrl(statusData.audio_url || statusData.url || '');
        const durationMs = parseInt(statusData.duration, 10) || 0;
        getElement('music-duration-info').textContent = durationMs > 0 ? `${(durationMs / 1000).toFixed(1)}秒` : '';
        getElement('music-model-info').textContent = '模型: music-2.6';
        setCurrentResult('music', statusData);
        recordFeatureHistory('music', prompt, `${config.style || '默认风格'} · ${config.duration || '自动时长'}`, config, {
          url: resolveApiAssetUrl(statusData.url || ''),
          duration: statusData.duration || 0
        });
        if (resultArea) {
          resultArea.removeAttribute('hidden');
          resultArea.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }
        loadQuota();
        refreshUsageToday();
        showToast('音乐生成成功！', 'success');
      } catch (error) {
        stopInlineProgress();
        showToast(error.message || '生成失败，请重试', 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    function generateLyrics() {
      return generateContent({
        apiEndpoint: '/api/generate/lyrics',
        domIds: { prompt: 'lyrics-prompt', style: 'lyrics-style', structure: 'lyrics-structure' },
        resultTab: 'lyrics',
        loadingText: '正在创作歌词...',
        successMessage: '歌词创作完成！',
        historyFeature: 'lyrics',
        onSuccess: function (data) {
          getElement('lyrics-content').innerHTML = `<pre>${escapeHtml(data.lyrics || data.content || '')}</pre>`;
          getElement('lyrics-meta').textContent = data.title ? `标题: ${data.title}` : '';
        },
        buildHistoryEntry: function (data, config) {
          return {
            title: data.title || config.prompt,
            summary: data.lyrics || data.content || '',
            inputs: config,
            result: {
              title: data.title,
              lyrics: data.lyrics,
              content: data.content
            }
          };
        }
      });
    }

    function pollImageStatus(taskId, maxRetries, inputs) {
      const button = getElement('btn-generate-cover');
      const tryPoll = function (retry) {
        apiFetch('/api/image/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId })
        })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            if (data.error) throw new Error(data.error);
            if (data.status === 'completed') {
              stopInlineProgress();
              const image = getElement('cover-image');
              image.src = resolveApiAssetUrl(data.url || '');
              image.onclick = function () {
                if (typeof settings.openImageModal === 'function') {
                  settings.openImageModal(image.src);
                }
              };
              getElement('cover-meta').textContent = data.model ? `模型: ${data.model}` : '';
              getElement('cover-result')?.removeAttribute('hidden');
              getElement('cover-result')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
              loadQuota();
              refreshUsageToday();
              recordFeatureHistory('cover', inputs.prompt, `${inputs.style || '自动风格'} · ${inputs.ratio || '1:1'}`, inputs, {
                url: resolveApiAssetUrl(data.url),
                size: data.size,
                duration: data.duration
              });
              showToast('封面生成成功！', 'success');
              if (button) button.disabled = false;
              hideLoading();
              return;
            }
            if (data.status === 'error') {
              throw new Error(data.error || '生成失败');
            }
            if (retry >= maxRetries) {
              throw new Error('生成超时，请重试');
            }
            setTimeout(function () { tryPoll(retry + 1); }, 2000);
          })
          .catch(function (error) {
            stopInlineProgress();
            showToast(error.message || '生成失败', 'error');
            if (button) button.disabled = false;
            hideLoading();
          });
      };

      tryPoll(0);
    }

    function generateCover() {
      const prompt = getElement('cover-prompt')?.value?.trim();
      const ratio = getElement('cover-ratio')?.value || '';
      const style = getElement('cover-style')?.value || '';
      if (!prompt) {
        showToast('请填写封面描述', 'error');
        return;
      }

      const button = getElement('btn-generate-cover');
      const resultArea = getElement('cover-result');
      if (button) button.disabled = true;
      if (resultArea) resultArea.setAttribute('hidden', '');

      showLoading('正在生成封面...', 0);
      startInlineProgress('cover', 'cover-progress-fill', 'cover-progress-text');

      apiFetch('/api/generate/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ratio, style })
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          if (data.error) throw new Error(data.error);
          pollImageStatus(data.taskId, 60, { prompt, ratio, style });
        })
        .catch(function (error) {
          stopInlineProgress();
          showToast(error.message || '生成失败', 'error');
          if (button) button.disabled = false;
          hideLoading();
        });
    }

    async function runVoiceGeneration(audioUrl, prompt) {
      const button = getElement('btn-generate-voice');
      const resultArea = getElement('covervoice-result');
      const config = {
        audio_url: audioUrl,
        prompt,
        timbre: getElement('voice-timbre')?.value || '',
        pitch: getElement('voice-pitch')?.value || ''
      };

      if (button) button.disabled = true;
      if (resultArea) resultArea.setAttribute('hidden', '');
      startInlineProgress('voice', 'voice-progress-fill', 'voice-progress-text');

      try {
        const response = await apiFetch('/api/generate/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(function () { return { error: '请求失败' }; });
          throw new Error(errorPayload.error || '生成失败');
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!data.taskId) throw new Error('未返回任务ID');

        const statusData = await pollTaskStatus({
          endpoint: '/api/music-cover/status',
          taskId: data.taskId,
          maxAttempts: 60,
          delayMs: 2000
        });

        stopInlineProgress();
        getElement('voice-audio').src = resolveApiAssetUrl(statusData.url || '');
        getElement('voice-meta').textContent = statusData.duration ? `时长: ${statusData.duration}s` : '';
        if (resultArea) {
          resultArea.removeAttribute('hidden');
          resultArea.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }
        setCurrentResult('covervoice', statusData);
        loadQuota();
        refreshUsageToday();
        recordFeatureHistory('covervoice', prompt, `${config.timbre || '自动音色'} · ${config.pitch || '原调'}`, {
          prompt,
          timbre: config.timbre,
          pitch: config.pitch,
          audio_url: audioUrl
        }, {
          url: resolveApiAssetUrl(statusData.url || ''),
          duration: statusData.duration || 0
        });
        showToast('歌声翻唱完成！', 'success');
      } catch (error) {
        stopInlineProgress();
        showToast(error.message || '生成失败，请重试', 'error');
      } finally {
        hideLoading();
        if (button) button.disabled = false;
      }
    }

    async function generateVoiceWithFile(file, prompt) {
      const button = getElement('btn-generate-voice');
      if (button) button.disabled = true;
      showLoading('正在上传音频...', 0);

      try {
        const base64 = await fileToBase64(file);
        const uploadResponse = await apiFetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, data: base64 })
        });
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) throw new Error(uploadData.error || '文件上传失败');

        const audioUrl = resolveApiAssetUrl(uploadData.url);
        showLoading('正在处理翻唱...', 50);
        await runVoiceGeneration(audioUrl, prompt);
      } catch (error) {
        hideLoading();
        showToast(error.message || '处理失败', 'error');
        if (button) button.disabled = false;
      }
    }

    async function generateVoiceWithUrl(audioUrl, prompt) {
      return runVoiceGeneration(audioUrl, prompt);
    }

    async function generateVoice() {
      const fileInput = getElement('voice-audio-file');
      const urlInput = getElement('voice-audio-url');
      const prompt = getElement('voice-prompt')?.value?.trim();
      const activeTab = document.querySelector('.voice-source-tabs .source-tab.active')?.dataset.source;

      if (activeTab === 'file' && fileInput?.files?.[0]) {
        if (!prompt) {
          showToast('请填写翻唱描述', 'error');
          return;
        }
        await generateVoiceWithFile(fileInput.files[0], prompt);
        return;
      }

      if (activeTab === 'url') {
        const audioUrl = urlInput?.value?.trim();
        if (!audioUrl) {
          showToast('请填写歌曲链接', 'error');
          return;
        }
        if (!prompt) {
          showToast('请填写翻唱描述', 'error');
          return;
        }
        await generateVoiceWithUrl(audioUrl, prompt);
        return;
      }

      const file = fileInput?.files?.[0];
      const audioUrl = urlInput?.value?.trim();
      if (file) {
        if (!prompt) {
          showToast('请填写翻唱描述', 'error');
          return;
        }
        await generateVoiceWithFile(file, prompt);
        return;
      }
      if (audioUrl) {
        if (!prompt) {
          showToast('请填写翻唱描述', 'error');
          return;
        }
        await generateVoiceWithUrl(audioUrl, prompt);
        return;
      }
      showToast('请上传音频文件或填写歌曲链接', 'error');
    }

    return {
      generateContent,
      generateMusic,
      generateLyrics,
      generateCover,
      pollImageStatus,
      generateVoice,
      generateVoiceWithFile,
      generateVoiceWithUrl,
      runVoiceGeneration
    };
  }

  return {
    createTools: createTools
  };
}));
