(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatStreamTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const addChatMessage = settings.addChatMessage || function () { return {}; };
    const buildChatMessageMeta = settings.buildChatMessageMeta || function () { return ''; };
    const followChatToBottom = settings.followChatToBottom || function () {};
    const formatChatMessageHtml = settings.formatChatMessageHtml || function (value) { return String(value || ''); };
    const createTextDecoder = settings.createTextDecoder || function () { return new TextDecoder(); };

    function parseSseBlock(block) {
      const lines = String(block || '').split(/\r?\n/);
      let eventName = 'message';
      const dataLines = [];
      lines.forEach(function (line) {
        if (!line) return;
        if (line.startsWith('event:')) {
          eventName = line.slice('event:'.length).trim() || 'message';
          return;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      });
      return {
        eventName: eventName,
        dataText: dataLines.join('\n')
      };
    }

    async function streamChatMessage(response, pendingMessage) {
      const nextPendingMessage = pendingMessage || null;
      if (!(response && response.ok)) {
        let failurePayload = null;
        if (typeof (response && response.json) === 'function') {
          failurePayload = await response.json().catch(function () { return null; });
        }
        throw new Error((failurePayload && failurePayload.error) || '对话失败（' + ((response && response.status) || 500) + '）');
      }

      if (!response.body || typeof response.body.getReader !== 'function') {
        const data = await response.json();
        return {
          reply: String(data.reply || ''),
          conversation: data.conversation || null,
          messages: Array.isArray(data.messages) ? data.messages : null,
          usage: data.usage || null
        };
      }

      let contentEl = null;
      let msgDiv = null;
      if (nextPendingMessage && nextPendingMessage.contentWrap) {
        msgDiv = nextPendingMessage.msgDiv;
        nextPendingMessage.contentWrap.innerHTML = buildChatMessageMeta(null, 'chatbot', { isStreaming: true }) + '<div class="message-body streaming-content"></div>';
        contentEl = nextPendingMessage.contentWrap.querySelector('.streaming-content');
        msgDiv.classList.remove('is-thinking');
      } else {
        const streamingState = addChatMessage('chatbot', '', { isStreaming: true });
        contentEl = streamingState && streamingState.contentEl;
        msgDiv = streamingState && streamingState.msgDiv;
      }

      const reader = response.body.getReader();
      const decoder = createTextDecoder();
      let buffer = '';
      let reply = '';
      let conversation = null;
      let messages = null;
      let usage = null;

      const applyStreamingText = function () {
        if (!contentEl) return;
        contentEl.textContent = reply;
        followChatToBottom(false);
      };

      const consumeBlock = function (block) {
        const parsed = parseSseBlock(block);
        const eventName = parsed.eventName;
        const dataText = parsed.dataText;
        if (!dataText || dataText === '[DONE]') return;

        let payload = null;
        try {
          payload = JSON.parse(dataText);
        } catch (_) {
          payload = null;
        }

        if (eventName === 'error') {
          throw new Error((payload && payload.error) || '对话流中断，请重试。');
        }

        if (eventName === 'conversation_state') {
          conversation = (payload && payload.conversation) || null;
          messages = Array.isArray(payload && payload.messages) ? payload.messages : null;
          usage = (payload && payload.usage) || null;
          if (payload && payload.reply != null) {
            reply = String(payload.reply || '');
            applyStreamingText();
          }
          return;
        }

        if (eventName === 'content_block_start') {
          const initialText = payload && payload.content_block && payload.content_block.type === 'text'
            ? String(payload.content_block.text || '')
            : '';
          if (initialText) {
            reply += initialText;
            applyStreamingText();
          }
          return;
        }

        if (eventName === 'content_block_delta' && payload && payload.delta && payload.delta.type === 'text_delta') {
          reply += String(payload.delta.text || '');
          applyStreamingText();
          return;
        }

        if (eventName === 'done' && payload && payload.reply != null) {
          reply = String(payload.reply || '');
          applyStreamingText();
          return;
        }

        if (payload && payload.usage) {
          usage = payload.usage;
        }
      };

      try {
        while (true) {
          const result = await reader.read();
          const value = result.value;
          const done = result.done;
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, '\n');
          let boundaryIndex = buffer.indexOf('\n\n');
          while (boundaryIndex !== -1) {
            const block = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            consumeBlock(block);
            boundaryIndex = buffer.indexOf('\n\n');
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          consumeBlock(buffer);
        }
      } catch (error) {
        const wrappedError = error instanceof Error ? error : new Error('对话流中断，请重试。');
        wrappedError.partialReply = reply;
        if (error && error.name === 'AbortError') {
          wrappedError.name = 'AbortError';
          wrappedError.isAbort = true;
        }
        throw wrappedError;
      }

      if (contentEl) {
        contentEl.innerHTML = formatChatMessageHtml(reply || '');
        contentEl.classList.remove('streaming-content');
      }
      followChatToBottom(false);

      return {
        reply: reply,
        conversation: conversation,
        messages: messages,
        usage: usage
      };
    }

    return {
      parseSseBlock: parseSseBlock,
      streamChatMessage: streamChatMessage
    };
  }

  return {
    createTools: createTools
  };
}));
