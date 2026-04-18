const fs = require('fs');
const path = require('path');
const { downloadFromUrl } = require('./shared');

function createVoiceCoverRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, coverTasks }) {
    function buildCoverPrompt(prompt, timbre, pitch) {
        const parts = [String(prompt || '保持原曲风格').trim()];

        if (timbre) {
            parts.push(`目标音色：${timbre}`);
        }

        if (pitch) {
            parts.push(`音高调整：${pitch}`);
        }

        return parts.filter(Boolean).join('\n');
    }

    async function processCoverTask(task) {
        const { outputFile, audio_url, prompt, timbre, pitch } = task;

        return new Promise(async (resolve, reject) => {
            try {
                let audioBase64 = null;

                if (audio_url && audio_url.startsWith('/output/')) {
                    const filename = path.basename(audio_url);
                    const localPath = path.join(OUTPUT_DIR, filename);
                    if (fs.existsSync(localPath)) {
                        const audioBuffer = fs.readFileSync(localPath);
                        audioBase64 = audioBuffer.toString('base64');
                    }
                }

                if (!audioBase64) {
                    task.status = 'error';
                    task.error = '无法读取音频文件: ' + audio_url;
                    reject(new Error(task.error));
                    return;
                }

                const requestBody = {
                    model: 'music-cover',
                    prompt: buildCoverPrompt(prompt, timbre, pitch),
                    audio_base64: audioBase64,
                    output_format: 'url',
                    stream: false
                };

                const postData = JSON.stringify(requestBody);
                const apiOptions = {
                    hostname: API_HOST,
                    port: 443,
                    path: '/v1/music_generation',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const apiReq = https.request(apiOptions, (apiRes) => {
                    let apiData = '';
                    apiRes.on('data', chunk => apiData += chunk);
                    apiRes.on('end', async () => {
                        try {
                            if (apiRes.statusCode !== 200) {
                                task.status = 'error';
                                task.error = `MiniMax API 错误: HTTP ${apiRes.statusCode}`;
                                reject(new Error(task.error));
                                return;
                            }

                            const response = JSON.parse(apiData);
                            if (response.base_resp?.status_code !== 0) {
                                task.status = 'error';
                                task.error = response.base_resp?.status_msg || '翻唱请求失败';
                                reject(new Error(task.error));
                                return;
                            }

                            if (response.task_id) {
                                task.taskId = response.task_id;
                                task.progress = 30;
                                pollCoverTask(task).then(resolve).catch(reject);
                                return;
                            }

                            if (response.data?.status === 2) {
                                task.progress = 100;
                                task.status = 'completed';

                                if (response.data?.audio) {
                                    const buffer = Buffer.from(response.data.audio, 'hex');
                                    fs.writeFileSync(outputFile, buffer);
                                } else if (response.data?.audio_url) {
                                    await downloadFromUrl(https, response.data.audio_url, outputFile);
                                }

                                task.url = `/output/${path.basename(outputFile)}`;
                                task.duration = response.extra_info?.music_duration || 0;
                                resolve(task);
                            } else if (response.data?.status === 1) {
                                task.status = 'error';
                                task.error = '翻唱任务需要异步处理，但当前不支持';
                                reject(new Error(task.error));
                            } else {
                                task.status = 'error';
                                task.error = '未知的响应状态';
                                reject(new Error(task.error));
                            }
                        } catch (error) {
                            task.status = 'error';
                            task.error = '解析响应失败: ' + error.message;
                            reject(error);
                        }
                    });
                });

                apiReq.on('error', (error) => {
                    task.status = 'error';
                    task.error = error.message;
                    reject(error);
                });

                apiReq.write(postData);
                apiReq.end();
            } catch (error) {
                task.status = 'error';
                task.error = error.message;
                reject(error);
            }
        });
    }

    function pollCoverTask(task, maxAttempts = 120) {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const poll = () => {
                attempts++;

                const req = https.request({
                    hostname: API_HOST,
                    port: 443,
                    path: `/v1/music_generation_result?task_id=${task.taskId}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${API_KEY}` }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', async () => {
                        try {
                            const response = JSON.parse(data);

                            if (response.status === 2 && (response.data?.audio || response.data?.audio_url)) {
                                task.progress = 90;
                                task.status = 'completed';

                                if (response.data.audio) {
                                    const buffer = Buffer.from(response.data.audio, 'hex');
                                    fs.writeFileSync(task.outputFile, buffer);
                                } else {
                                    await downloadFromUrl(https, response.data.audio_url, task.outputFile);
                                }

                                task.progress = 100;
                                task.url = `/output/${path.basename(task.outputFile)}`;
                                task.duration = response.extra_info?.music_duration || 0;
                                resolve(task);
                                return;
                            }

                            if (response.status === 0 || response.status === 1 || response.status === 'pending' || response.status === 'processing') {
                                task.status = 'processing';
                                task.progress = Math.min(95, 30 + attempts * 3);
                                if (attempts < maxAttempts) {
                                    setTimeout(poll, 2000);
                                } else {
                                    task.status = 'error';
                                    task.error = 'Cover generation timeout';
                                    reject(new Error(task.error));
                                }
                                return;
                            }

                            task.status = 'error';
                            task.error = response.base_resp?.status_msg || response.error || '翻唱任务失败';
                            reject(new Error(task.error));
                        } catch (error) {
                            if (attempts < maxAttempts) {
                                setTimeout(poll, 2000);
                            } else {
                                task.status = 'error';
                                task.error = error.message;
                                reject(error);
                            }
                        }
                    });
                });

                req.on('error', (error) => {
                    task.status = 'error';
                    task.error = error.message;
                    reject(error);
                });

                req.end();
            };

            poll();
        });
    }

    const routes = {
        '/api/generate/voice': async (req, res, body) => {
            const { audio_url, prompt, timbre, pitch } = body;
            if (!audio_url) return { error: 'Audio URL is required' };

            const taskId = `cover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const outputFile = path.join(OUTPUT_DIR, `${taskId}.mp3`);
            const task = { taskId, status: 'processing', progress: 0, outputFile, startedAt: Date.now(), audio_url, prompt, timbre, pitch };

            coverTasks.set(taskId, task);
            processCoverTask(task).catch(error => {
                task.status = 'error';
                task.error = error.message;
            });

            return { taskId, status: 'pending', message: '翻唱生成已启动' };
        }
    };

    routes['/api/music-cover'] = async (req, res, body) => routes['/api/generate/voice'](req, res, body);
    return routes;
}

module.exports = {
    createVoiceCoverRoutes
};
