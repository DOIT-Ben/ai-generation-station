const fs = require('fs');
const path = require('path');

function createServiceRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR }) {
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
            const { messages, model = 'MiniMax-M2.7', max_tokens = 4096, temperature = 0.7 } = body;

            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                return { error: 'messages 数组是必需的' };
            }

            return new Promise((resolve, reject) => {
                const postData = JSON.stringify({
                    model,
                    messages,
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
                            if (response.base_resp?.status_code !== 0) {
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

                            resolve({
                                success: true,
                                reply: replyText,
                                usage: response.usage
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
        }
    };
}

module.exports = {
    createServiceRoutes
};
