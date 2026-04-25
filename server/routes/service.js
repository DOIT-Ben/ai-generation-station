const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const defaultFetch = require('node-fetch');

function extractReplyText(response) {
    const textItem = Array.isArray(response?.content)
        ? response.content.find(item => item.type === 'text')
        : null;
    return textItem?.text
        || response?.choices?.[0]?.text
        || response?.choices?.[0]?.message?.content
        || response?.reply
        || response?.message?.content
        || response?.text
        || '';
}

function extractUsage(response) {
    return response?.usage
        || response?.message?.usage
        || null;
}

function normalizeOpenAiUsage(usage) {
    if (!usage || typeof usage !== 'object') return null;
    const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
    const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
    const totalTokens = Number(usage.total_tokens ?? (inputTokens + outputTokens)) || (inputTokens + outputTokens);
    return {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens
    };
}

function createAnthropicRequestOptions({ API_HOST, API_KEY, postData }) {
    return {
        hostname: API_HOST,
        port: 443,
        path: '/anthropic/v1/messages',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
}

function createChatUrl(baseUrl, pathname) {
    return new URL(String(pathname || '').replace(/^\/+/, ''), `${String(baseUrl || '').replace(/\/+$/, '')}/`).toString();
}

function createChatHeaders(apiKey) {
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
}

function isSupportedChatModelId(modelId) {
    const value = String(modelId || '').trim();
    if (!value) return false;
    if (/image|audio-preview|realtime-preview/i.test(value)) return false;
    return /^(chatgpt-|gpt-|o\d)/i.test(value);
}

function isBlockedChatModelId(modelId) {
    const value = String(modelId || '').trim();
    if (!value) return false;
    const blockedIds = new Set([
        'gpt-5.5'
    ]);
    return blockedIds.has(value);
}

function formatChatModelDisplayLabel(modelId) {
    const value = String(modelId || '').trim();
    const normalizedValue = value.toLowerCase();
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
    return formatOpenAiModelLabel(value);
}

function formatOpenAiModelLabel(modelId) {
    const value = String(modelId || '').trim();
    const normalizedValue = value.toLowerCase();
    if (!value) return value;

    const formatToken = token => {
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
    };

    const formatParts = (prefix, parts) => {
        const [version, ...rest] = parts;
        if (!version) return value;
        const labelParts = [`${prefix}-${version}`];
        for (let index = 0; index < rest.length; index += 1) {
            const token = rest[index];
            if (/^\d{4}$/.test(token) && /^\d{2}$/.test(rest[index + 1] || '') && /^\d{2}$/.test(rest[index + 2] || '')) {
                labelParts.push(`${token}-${rest[index + 1]}-${rest[index + 2]}`);
                index += 2;
                continue;
            }
            labelParts.push(formatToken(token));
        }
        return labelParts.join(' ');
    };

    if (normalizedValue.startsWith('chatgpt-')) {
        return formatParts('ChatGPT', normalizedValue.split('-').slice(1));
    }

    if (normalizedValue.startsWith('gpt-')) {
        return formatParts('GPT', normalizedValue.split('-').slice(1));
    }

    if (/^o\d/.test(normalizedValue)) {
        const parts = normalizedValue.split('-');
        const [series, ...rest] = parts;
        return [series, ...rest.map(formatToken)].join(' ');
    }

    return value;
}

function getChatModelTags(modelId) {
    const value = String(modelId || '').trim();
    const tagMap = {
        'gpt-5.4': ['推荐', '高质量'],
        'gpt-5.4-mini': ['快速', '轻量'],
        'gpt-5.3-codex': ['代码'],
        'gpt-5.2-pro': ['高质量'],
        'gpt-5.2-chat-latest': ['推荐', '均衡'],
        'gpt-5.2': ['均衡'],
        'gpt-4.5-preview': ['预览', '高质量'],
        'gpt-4.1': ['高质量'],
        'gpt-4.1-mini': ['推荐', '均衡'],
        'gpt-4.1-nano': ['快速'],
        'chatgpt-4o-latest': ['推荐', '通用'],
        'gpt-4o': ['通用'],
        'gpt-4o-2024-11-20': ['稳定'],
        'gpt-4o-2024-08-06': ['稳定'],
        'gpt-4o-mini': ['快速', '低成本'],
        'gpt-4-turbo': ['经典'],
        'gpt-4': ['经典'],
        'gpt-3.5-turbo': ['低成本', '快速'],
        'gpt-3.5-turbo-16k': ['长上下文'],
        'o1': ['推理'],
        'o1-mini': ['推理', '快速'],
        'o1-pro': ['推理', '高质量'],
        'o3': ['推理'],
        'o3-mini': ['推理', '快速'],
        'o3-pro': ['推理', '高质量'],
        'o4-mini': ['推理', '轻量']
    };
    return tagMap[value] || [];
}

function sortChatModels(items = [], defaultModel = '') {
    const preferredOrder = [
        'gpt-5.4',
        'gpt-5.4-mini',
        'gpt-5.3-codex',
        'gpt-5.2-pro',
        'gpt-5.2-chat-latest',
        'gpt-5.2',
        'gpt-4.5-preview',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'chatgpt-4o-latest',
        'gpt-4o-2024-11-20',
        'gpt-4o-2024-08-06',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
    ].filter(Boolean);
    if (defaultModel && !preferredOrder.includes(defaultModel)) {
        preferredOrder.unshift(defaultModel);
    }
    const orderMap = new Map(preferredOrder.map((item, index) => [item, index]));
    const getPreferredRank = id => {
        if (orderMap.has(id)) return orderMap.get(id);
        const prefixMatch = preferredOrder
            .filter(item => id.startsWith(`${item}-`))
            .sort((left, right) => right.length - left.length)[0];
        return prefixMatch ? orderMap.get(prefixMatch) + 0.5 : Number.MAX_SAFE_INTEGER;
    };
    return items.slice().sort((left, right) => {
        const leftRank = getPreferredRank(left.id);
        const rightRank = getPreferredRank(right.id);
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.label.localeCompare(right.label);
    });
}

function normalizeChatModelOptions(payload, defaultModel = '') {
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = items
        .filter(item => isSupportedChatModelId(item?.id) && !isBlockedChatModelId(item?.id))
        .map(item => ({
            id: String(item.id).trim(),
            label: formatChatModelDisplayLabel(item.display_name || item.id || ''),
            tags: getChatModelTags(item.id)
        }))
        .filter(item => item.id && item.label);
    return sortChatModels(normalized, defaultModel);
}

function writeSseEvent(res, eventName, payload) {
    if (!res || res.writableEnded) return;
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    res.write(`event: ${eventName}\n`);
    serialized.split('\n').forEach(line => {
        res.write(`data: ${line}\n`);
    });
    res.write('\n');
}

function parseSseBlock(block) {
    const lines = String(block || '').split(/\r?\n/);
    let eventName = 'message';
    const dataLines = [];

    lines.forEach(line => {
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
        eventName,
        dataText: dataLines.join('\n')
    };
}

function resolveChatRequestContext({ body, req, stateStore }) {
    const {
        messages,
        conversationId,
        message,
        rewriteMessageId
    } = body;
    const userId = req.authSession?.userId || null;
    const isConversationMode = Boolean(conversationId || message || rewriteMessageId);
    let promptMessages = messages;
    let conversation = null;
    let normalizedMessage = null;
    let turnId = '';
    let rewriteTarget = null;

    if (isConversationMode) {
        if (!userId) {
            return { error: 'authentication is required' };
        }
        if (!conversationId) {
            return { error: 'conversationId is required' };
        }

        conversation = stateStore.getConversation(userId, conversationId);
        if (!conversation) {
            return { error: 'conversation not found' };
        }

        if (rewriteMessageId) {
            rewriteTarget = stateStore.getConversationMessage(userId, conversationId, rewriteMessageId);
            if (!rewriteTarget || rewriteTarget.role !== 'assistant') {
                return { error: 'rewrite target not found' };
            }

            turnId = String(rewriteTarget.metadata?.turnId || '').trim();
            if (!turnId) {
                return { error: 'rewrite target turn is invalid' };
            }

            promptMessages = stateStore.getConversationPromptMessages(userId, conversationId, {
                untilTurnId: turnId
            });
        } else {
            normalizedMessage = String(message || '').trim();
            if (!normalizedMessage) {
                return { error: 'message is required' };
            }

            turnId = crypto.randomUUID();
            promptMessages = (stateStore.getConversationPromptMessages(userId, conversationId) || [])
                .concat({ role: 'user', content: normalizedMessage });
        }
    }

    if (!promptMessages || !Array.isArray(promptMessages) || promptMessages.length === 0) {
        return { error: 'messages array is required' };
    }

    return {
        userId,
        isConversationMode,
        conversation,
        promptMessages,
        normalizedMessage,
        rewriteTarget,
        turnId
    };
}

function persistConversationReply({ stateStore, userId, conversation, model, normalizedMessage, turnId, replyText, usage }) {
    if (!conversation || !turnId) {
        return {
            conversation,
            messages: []
        };
    }

    if (normalizedMessage) {
        stateStore.appendConversationMessage(userId, conversation.id, {
            role: 'user',
            content: normalizedMessage,
            model,
            metadata: {
                turnId
            }
        });
    }

    const timeline = stateStore.getConversationMessageTimeline(userId, conversation.id, 400) || [];
    const versionCount = timeline.filter(item => item.role === 'assistant' && String(item.metadata?.turnId || '') === turnId).length;
    const assistantResult = stateStore.appendConversationMessage(userId, conversation.id, {
        role: 'assistant',
        content: replyText,
        model,
        tokens: usage || null,
        metadata: {
            turnId,
            versionIndex: versionCount + 1
        }
    });

    if (assistantResult?.message?.id) {
        stateStore.setConversationTurnActiveAssistant(userId, conversation.id, assistantResult.message.id);
    }

    return {
        conversation: assistantResult?.conversation || stateStore.getConversation(userId, conversation.id),
        messages: stateStore.getConversationMessages(userId, conversation.id, 400) || []
    };
}

function createServiceRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, trackUsage, stateStore, chatBaseUrl, chatApiKey, chatDefaultModel, chatFetch }) {
    const fetchImpl = chatFetch || defaultFetch;
    const resolvedChatBaseUrl = String(chatBaseUrl || 'https://api.suneora.com/v1').trim() || 'https://api.suneora.com/v1';
    const resolvedChatDefaultModel = String(chatDefaultModel || 'gpt-4.1-mini').trim() || 'gpt-4.1-mini';

    async function fetchChatModels() {
        const response = await fetchImpl(createChatUrl(resolvedChatBaseUrl, '/models'), {
            method: 'GET',
            headers: createChatHeaders(chatApiKey)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error?.message || payload?.error || `Chat model request failed (${response.status})`);
        }
        return normalizeChatModelOptions(payload, resolvedChatDefaultModel);
    }

    async function requestChatCompletion(payload) {
        const response = await fetchImpl(createChatUrl(resolvedChatBaseUrl, '/chat/completions'), {
            method: 'POST',
            headers: createChatHeaders(chatApiKey),
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error?.message || data?.error || `Chat API error (${response.status})`);
        }
        return data;
    }

    return {
        '/api/tts': async (req, res, body) => {
            const {
                text,
                voice_id = 'male-qn-qingse',
                speed = 1.0,
                pitch = 1.0,
                emotion = 'happy',
                vol = 50,
                output_format = 'mp3',
                model = 'speech-2.8-hd'
            } = body;

            if (!text) return { error: 'Text is required' };

            const safeExtension = String(output_format || 'mp3').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp3';
            const outputFile = path.join(OUTPUT_DIR, `tts_${Date.now()}.${safeExtension}`);

            return new Promise((resolve, reject) => {
                const postData = JSON.stringify({
                    model,
                    text,
                    stream: false,
                    voice_setting: {
                        voice_id,
                        speed,
                        vol,
                        pitch,
                        emotion
                    },
                    audio_setting: {
                        sample_rate: 32000,
                        bitrate: 128000,
                        format: output_format,
                        channel: 1
                    },
                    output_format: 'hex'
                });

                const options = {
                    hostname: API_HOST,
                    port: 443,
                    path: '/v1/t2a_v2',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const apiReq = https.request(options, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        try {
                            const response = JSON.parse(data);
                            if (response.base_resp?.status_code !== 0) {
                                throw new Error(response.base_resp?.status_msg || 'TTS API error');
                            }
                            if (!response.data?.audio) {
                                throw new Error('No audio data');
                            }

                            const buffer = Buffer.from(response.data.audio, 'hex');
                            fs.writeFileSync(outputFile, buffer);
                            trackUsage?.(req.authSession?.userId, 'speech');
                            resolve({
                                success: true,
                                file: outputFile,
                                url: `/output/${path.basename(outputFile)}`,
                                extra: response.extra_info
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                });

                apiReq.on('error', reject);
                apiReq.write(postData);
                apiReq.end();
            });
        },

        '/api/quota': async () => {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: API_HOST,
                    port: 443,
                    path: '/v1/api/openplatform/coding_plan/remains',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                };

                const apiReq = https.request(options, (apiRes) => {
                    let data = '';
                    apiRes.on('data', chunk => data += chunk);
                    apiRes.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            reject(error);
                        }
                    });
                });

                apiReq.on('error', reject);
                apiReq.end();
            });
        },

        '/api/chat/models': async () => {
            const models = await fetchChatModels();
            return {
                models,
                defaultModel: resolvedChatDefaultModel
            };
        },

        '/api/chat': async (req, res, body) => {
            const {
                model = resolvedChatDefaultModel,
                max_tokens = 4096,
                temperature = 0.7,
                stream = false
            } = body;
            const requestContext = resolveChatRequestContext({ body, req, stateStore });
            if (requestContext.error) {
                return { error: requestContext.error };
            }

            const {
                userId,
                isConversationMode,
                conversation,
                promptMessages,
                normalizedMessage,
                turnId
            } = requestContext;

            const buildPayload = (replyText, usage) => {
                let payload = {
                    success: true,
                    reply: replyText,
                    usage
                };

                if (isConversationMode) {
                    const persisted = persistConversationReply({
                        stateStore,
                        userId,
                        conversation,
                        model,
                        normalizedMessage,
                        turnId,
                        replyText,
                        usage
                    });
                    payload = {
                        ...payload,
                        conversation: persisted.conversation,
                        messages: persisted.messages
                    };
                }

                trackUsage?.(userId, 'chat', {
                    inputTokens: usage?.input_tokens || 0,
                    outputTokens: usage?.output_tokens || 0
                });

                return payload;
            };

            if (!stream) {
                const response = await requestChatCompletion({
                    model,
                    messages: promptMessages,
                    max_tokens,
                    temperature,
                    stream: false
                });
                return buildPayload(extractReplyText(response), normalizeOpenAiUsage(extractUsage(response)));
            }

            return new Promise(async (resolve) => {
                let replyText = '';
                let usage = null;
                let clientClosed = false;
                let streamErrored = false;
                const abortController = new AbortController();

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive'
                });
                if (typeof res.flushHeaders === 'function') {
                    res.flushHeaders();
                }

                req.on('close', () => {
                    clientClosed = true;
                    abortController.abort();
                });

                try {
                    const response = await fetchImpl(createChatUrl(resolvedChatBaseUrl, '/chat/completions'), {
                        method: 'POST',
                        headers: createChatHeaders(chatApiKey),
                        body: JSON.stringify({
                            model,
                            messages: promptMessages,
                            max_tokens,
                            temperature,
                            stream: true
                        }),
                        signal: abortController.signal
                    });

                    if (!response.ok) {
                        const payload = await response.json().catch(() => ({}));
                        writeSseEvent(res, 'error', {
                            error: payload?.error?.message || payload?.error || `Chat API error (${response.status})`
                        });
                        res.end();
                        resolve(null);
                        return;
                    }

                    let buffer = '';
                    response.body.setEncoding('utf8');

                    const handleBlock = (block) => {
                        const { dataText } = parseSseBlock(block);
                        if (!dataText || dataText === '[DONE]') return;

                        let parsed = null;
                        try {
                            parsed = JSON.parse(dataText);
                        } catch {
                            parsed = null;
                        }
                        if (!parsed) return;

                        const errorMessage = parsed?.error?.message || parsed?.error;
                        if (errorMessage) {
                            streamErrored = true;
                            writeSseEvent(res, 'error', { error: errorMessage });
                            return;
                        }

                        usage = normalizeOpenAiUsage(parsed?.usage) || usage;
                        const deltaText = String(parsed?.choices?.[0]?.delta?.content || '');
                        if (deltaText) {
                            replyText += deltaText;
                            writeSseEvent(res, 'content_block_delta', {
                                delta: {
                                    type: 'text_delta',
                                    text: deltaText
                                }
                            });
                        }
                    };

                    response.body.on('data', chunk => {
                        buffer += chunk;
                        buffer = buffer.replace(/\r\n/g, '\n');
                        let boundaryIndex = buffer.indexOf('\n\n');
                        while (boundaryIndex !== -1) {
                            const block = buffer.slice(0, boundaryIndex);
                            buffer = buffer.slice(boundaryIndex + 2);
                            handleBlock(block);
                            boundaryIndex = buffer.indexOf('\n\n');
                        }
                    });

                    response.body.on('end', () => {
                        if (buffer.trim()) {
                            handleBlock(buffer);
                            buffer = '';
                        }

                        if (clientClosed) {
                            resolve(null);
                            return;
                        }

                        if (streamErrored) {
                            res.end();
                            resolve(null);
                            return;
                        }

                        const payload = buildPayload(replyText, usage);
                        writeSseEvent(res, 'conversation_state', {
                            conversation: payload.conversation || null,
                            messages: payload.messages || [],
                            usage: payload.usage || null,
                            reply: payload.reply || ''
                        });
                        writeSseEvent(res, 'done', {
                            reply: payload.reply || ''
                        });
                        res.end();
                        resolve(null);
                    });

                    response.body.on('error', error => {
                        if (!clientClosed) {
                            writeSseEvent(res, 'error', { error: error.message || '网络错误，请稍后重试。' });
                            res.end();
                        }
                        resolve(null);
                    });
                } catch (error) {
                    if (!clientClosed) {
                        writeSseEvent(res, 'error', { error: error.message || '网络错误，请稍后重试。' });
                        res.end();
                    }
                    resolve(null);
                }
            });
        }
    };
}

module.exports = {
    createServiceRoutes,
    normalizeChatModelOptions
};
