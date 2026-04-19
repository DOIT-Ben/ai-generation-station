const fs = require('fs');
const path = require('path');

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

        '/api/chat': async (req, res, body) => {
            const {
                messages,
                conversationId,
                message,
                model = 'MiniMax-M2.7',
                max_tokens = 4096,
                temperature = 0.7
            } = body;

            const userId = req.authSession?.userId || null;
            const isConversationMode = Boolean(conversationId || message);
            let promptMessages = messages;
            let conversation = null;
            let normalizedMessage = null;

            if (isConversationMode) {
                normalizedMessage = String(message || '').trim();
                if (!userId) {
                    return { error: 'authentication is required' };
                }
                if (!conversationId) {
                    return { error: 'conversationId is required' };
                }
                if (!normalizedMessage) {
                    return { error: 'message is required' };
                }

                conversation = stateStore.getConversation(userId, conversationId);
                if (!conversation) {
                    return { error: 'conversation not found' };
                }

                const existingMessages = stateStore.getConversationMessages(userId, conversationId) || [];
                promptMessages = existingMessages
                    .map(item => ({ role: item.role, content: item.content }))
                    .concat({ role: 'user', content: normalizedMessage });
            }

            if (!promptMessages || !Array.isArray(promptMessages) || promptMessages.length === 0) {
                return { error: 'messages array is required' };
            }

            return new Promise((resolve, reject) => {
                const postData = JSON.stringify({
                    model,
                    messages: promptMessages,
                    max_tokens,
                    temperature
                });

                const options = {
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

                const apiReq = https.request(options, (apiRes) => {
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

                            const textItem = Array.isArray(response.content)
                                ? response.content.find(item => item.type === 'text')
                                : null;
                            const replyText = textItem?.text
                                || response.choices?.[0]?.text
                                || response.choices?.[0]?.message?.content
                                || response.reply
                                || response.message?.content
                                || response.text
                                || '';

                            let payload = {
                                success: true,
                                reply: replyText,
                                usage: response.usage
                            };

                            if (isConversationMode) {
                                stateStore.appendConversationMessage(userId, conversation.id, {
                                    role: 'user',
                                    content: normalizedMessage,
                                    model
                                });
                                const updatedConversation = stateStore.appendConversationMessage(userId, conversation.id, {
                                    role: 'assistant',
                                    content: replyText,
                                    model,
                                    tokens: response.usage || null
                                });
                                payload = {
                                    ...payload,
                                    conversation: updatedConversation,
                                    messages: stateStore.getConversationMessages(userId, conversation.id) || []
                                };
                            }

                            trackUsage?.(userId, 'chat', {
                                inputTokens: response.usage?.input_tokens || 0,
                                outputTokens: response.usage?.output_tokens || 0
                            });
                            resolve(payload);
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
    };
}

module.exports = {
    createServiceRoutes
};
