const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function createServiceRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, trackUsage, stateStore }) {
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

            return new Promise((resolve) => {
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

        '/api/chat': async (req, res, body) => {
            const {
                model = 'MiniMax-M2.7',
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
                return new Promise((resolve, reject) => {
                    const postData = JSON.stringify({
                        model,
                        messages: promptMessages,
                        max_tokens,
                        temperature,
                        stream: false
                    });

                    const apiReq = https.request(createAnthropicRequestOptions({ API_HOST, API_KEY, postData }), (apiRes) => {
                        let data = '';
                        apiRes.on('data', chunk => data += chunk);
                        apiRes.on('end', () => {
                            try {
                                const response = JSON.parse(data);
                                const statusCode = response.base_resp?.status_code;
                                if (statusCode != null && statusCode !== 0) {
                                    resolve({ error: response.base_resp?.status_msg || 'Chat API error' });
                                    return;
                                }

                                const replyText = extractReplyText(response);
                                resolve(buildPayload(replyText, extractUsage(response)));
                            } catch (error) {
                                reject(error);
                            }
                        });
                    });

                    apiReq.on('error', reject);
                    apiReq.write(postData);
                    apiReq.end();
                });
            }

            return new Promise((resolve, reject) => {
                const postData = JSON.stringify({
                    model,
                    messages: promptMessages,
                    max_tokens,
                    temperature,
                    stream: true
                });

                let replyText = '';
                let usage = null;
                let clientClosed = false;
                let streamErrored = false;

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    Connection: 'keep-alive'
                });
                if (typeof res.flushHeaders === 'function') {
                    res.flushHeaders();
                }

                const apiReq = https.request(createAnthropicRequestOptions({ API_HOST, API_KEY, postData }), (apiRes) => {
                    apiRes.setEncoding('utf8');

                    if ((apiRes.statusCode || 500) >= 400) {
                        let errorBuffer = '';
                        apiRes.on('data', chunk => {
                            errorBuffer += chunk;
                        });
                        apiRes.on('end', () => {
                            let errorMessage = `Chat API error (${apiRes.statusCode || 500})`;
                            try {
                                const payload = JSON.parse(errorBuffer || '{}');
                                errorMessage = payload.error || payload.base_resp?.status_msg || errorMessage;
                            } catch {
                                if (String(errorBuffer || '').trim()) {
                                    errorMessage = String(errorBuffer).trim();
                                }
                            }
                            writeSseEvent(res, 'error', { error: errorMessage });
                            res.end();
                            resolve(null);
                        });
                        return;
                    }

                    let buffer = '';

                    const handleBlock = (block) => {
                        const { eventName, dataText } = parseSseBlock(block);
                        if (!dataText) return;
                        if (dataText === '[DONE]') return;

                        let parsed = null;
                        try {
                            parsed = JSON.parse(dataText);
                        } catch {
                            parsed = null;
                        }

                        if (parsed?.error || parsed?.base_resp?.status_code) {
                            const statusCode = parsed?.base_resp?.status_code;
                            if (statusCode != null && statusCode !== 0) {
                                streamErrored = true;
                                writeSseEvent(res, 'error', {
                                    error: parsed?.base_resp?.status_msg || parsed?.error || 'Chat API error'
                                });
                                return;
                            }
                        }

                        if (parsed?.usage || parsed?.message?.usage) {
                            usage = extractUsage(parsed) || usage;
                        }

                        if (eventName === 'content_block_start') {
                            const initialText = parsed?.content_block?.type === 'text'
                                ? String(parsed.content_block?.text || '')
                                : '';
                            if (initialText) {
                                replyText += initialText;
                            }
                        }

                        if (eventName === 'content_block_delta' && parsed?.delta?.type === 'text_delta') {
                            replyText += String(parsed.delta?.text || '');
                        }

                        if (['content_block_start', 'content_block_delta', 'message_delta', 'message_stop'].includes(eventName)) {
                            writeSseEvent(res, eventName, dataText);
                        }
                    };

                    apiRes.on('data', chunk => {
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

                    apiRes.on('end', () => {
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
                });

                req.on('close', () => {
                    clientClosed = true;
                    apiReq.destroy();
                });

                apiReq.on('error', (error) => {
                    if (!clientClosed) {
                        writeSseEvent(res, 'error', { error: error.message || '网络错误，请稍后重试。' });
                        res.end();
                    }
                    resolve(null);
                });

                apiReq.write(postData);
                apiReq.end();
            });
        }
    };
}

module.exports = {
    createServiceRoutes
};
