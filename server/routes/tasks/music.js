const fs = require('fs');
const path = require('path');
const { downloadFromUrl } = require('./shared');

function createMusicRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, musicTasks, trackUsage, stateStore }) {
    function persistTask(task, patch = {}) {
        if (!stateStore) return;
        stateStore.updateTask(task.taskId, {
            status: patch.status || task.status,
            progress: patch.progress != null ? patch.progress : task.progress,
            error: patch.error !== undefined ? patch.error : task.error,
            outputPayload: {
                providerTaskId: task.providerTaskId,
                url: task.url,
                duration: task.duration,
                size: task.size
            }
        });
    }
    function normalizeDuration(duration) {
        if (duration == null || duration === '') {
            return undefined;
        }

        if (typeof duration === 'number' && Number.isFinite(duration)) {
            return duration;
        }

        const value = String(duration).trim();
        const preset = {
            '30秒': 30,
            '1分钟': 60,
            '2分钟': 120,
            '3分钟': 180
        };

        if (preset[value]) {
            return preset[value];
        }

        const match = value.match(/(\d+(?:\.\d+)?)/);
        if (!match) {
            return undefined;
        }

        const numeric = Number(match[1]);
        if (!Number.isFinite(numeric)) {
            return undefined;
        }

        return value.includes('分钟') ? Math.round(numeric * 60) : Math.round(numeric);
    }

    function normalizeTempo(bpm) {
        if (!bpm) {
            return undefined;
        }

        const value = String(bpm).trim();
        const preset = {
            '慢速 (60-80)': 70,
            '中速 (90-120)': 105,
            '快速 (130-160)': 145,
            '很快 (170+)': 170
        };

        if (preset[value]) {
            return preset[value];
        }

        const match = value.match(/(\d+)/);
        return match ? Number(match[1]) : undefined;
    }

    function looksLikeLyrics(input) {
        const text = String(input || '').trim();
        if (!text) {
            return false;
        }

        if (/\[(intro|verse|pre chorus|chorus|interlude|bridge|outro|post chorus|transition|break|hook|build up|inst|solo)\]/i.test(text)) {
            return true;
        }

        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        return lines.length >= 3;
    }

    function inferInstrumental(input) {
        return /(纯音乐|伴奏|inst(?:rumental)?|background music|lo-?fi|bgm)/i.test(String(input || ''));
    }

    function buildStylePrompt({ prompt, style, bpm, key }) {
        const parts = [String(prompt || '').trim()].filter(Boolean);

        if (style) {
            parts.push(`音乐风格：${style}`);
        }

        if (bpm) {
            parts.push(`节奏：${bpm}`);
        }

        if (key) {
            parts.push(`调式：${key}`);
        }

        return parts.join('\n');
    }

    function buildMusicRequest({ prompt, style, bpm, key, duration }) {
        const text = String(prompt || '').trim();
        const requestBody = {
            model: 'music-2.6',
            stream: false,
            output_format: 'hex',
            audio_setting: {
                sample_rate: 44100,
                bitrate: 256000,
                format: 'mp3'
            }
        };

        if (duration) {
            requestBody.duration = duration;
        }

        if (inferInstrumental(text)) {
            requestBody.prompt = buildStylePrompt({ prompt: text, style, bpm, key });
            requestBody.is_instrumental = true;
            return requestBody;
        }

        if (looksLikeLyrics(text)) {
            requestBody.lyrics = text;
            const stylePrompt = buildStylePrompt({ prompt: '', style, bpm, key });
            if (stylePrompt) {
                requestBody.prompt = stylePrompt;
            }
            return requestBody;
        }

        requestBody.prompt = buildStylePrompt({ prompt: text, style, bpm, key });
        requestBody.lyrics_optimizer = true;
        return requestBody;
    }

    function getProviderStatus(response) {
        return response?.status ?? response?.data?.status ?? null;
    }

    function isCompletedStatus(status) {
        const value = typeof status === 'string' ? status.trim().toLowerCase() : status;
        return value === 2 || value === '2' || value === 'completed' || value === 'complete' || value === 'success' || value === 'done';
    }

    function isPendingStatus(status) {
        const value = typeof status === 'string' ? status.trim().toLowerCase() : status;
        return value === 0 || value === '0' || value === 1 || value === '1' || value === 'pending' || value === 'processing' || value === 'queued' || value === 'running' || value === 'submitted' || value === 'in_progress';
    }

    function getProviderTaskId(response) {
        return response?.task_id || response?.taskId || response?.data?.task_id || response?.data?.taskId || null;
    }

    function getProviderError(response) {
        if (response?.base_resp?.status_code != null && response.base_resp.status_code !== 0) {
            return response.base_resp.status_msg || 'Music generation failed';
        }

        return response?.error || response?.message || response?.msg || response?.data?.error || response?.data?.message || null;
    }

    async function writeMusicOutput(task, response) {
        const audioHex = response?.data?.audio || response?.audio || null;
        const audioUrl = response?.data?.audio_url || response?.audio_url || null;

        if (audioHex) {
            const buffer = Buffer.from(audioHex, 'hex');
            fs.writeFileSync(task.outputFile, buffer);
        } else if (audioUrl) {
            await downloadFromUrl(https, audioUrl, task.outputFile);
        } else {
            return false;
        }

        task.status = 'completed';
        task.progress = 100;
        task.url = `/output/${path.basename(task.outputFile)}`;
        task.duration = response?.extra_info?.music_duration || task.duration || 0;
        task.size = fs.existsSync(task.outputFile) ? fs.statSync(task.outputFile).size : 0;
        persistTask(task);
        trackUsage?.(task.userId, 'music');
        return true;
    }

    function pollMusicTask(task, maxAttempts = 120) {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const poll = () => {
                attempts++;
                const options = {
                    hostname: API_HOST,
                    port: 443,
                    path: `/v1/music_generation_result?task_id=${task.providerTaskId}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${API_KEY}` }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', async () => {
                        try {
                            const response = JSON.parse(data);

                            if (await writeMusicOutput(task, response)) {
                                resolve(task);
                            } else if (isPendingStatus(getProviderStatus(response))) {
                                task.status = 'processing';
                                task.progress = 30 + Math.min(50, attempts * 5);
                                persistTask(task);
                                if (attempts < maxAttempts) {
                                    setTimeout(poll, 2000);
                                } else {
                                    task.status = 'error';
                                    task.error = 'Timeout';
                                    persistTask(task);
                                    reject(new Error('Music generation timeout'));
                                }
                            } else if (isCompletedStatus(getProviderStatus(response))) {
                                task.status = 'error';
                                task.error = 'Music generation completed without audio output';
                                persistTask(task);
                                reject(new Error(task.error));
                            } else {
                                const providerError = getProviderError(response) || 'Music generation failed';
                                task.status = 'error';
                                task.error = providerError;
                                persistTask(task);
                                reject(new Error(providerError));
                            }
                        } catch (error) {
                            task.status = 'error';
                            task.error = error.message;
                            persistTask(task);
                            if (attempts < maxAttempts) {
                                setTimeout(poll, 2000);
                            } else {
                                reject(error);
                            }
                        }
                    });
                });

                req.on('error', (error) => {
                    task.status = 'error';
                    task.error = error.message;
                    persistTask(task);
                    reject(error);
                });

                req.end();
            };

            poll();
        });
    }

    async function processMusicTask(taskId, options) {
        const task = musicTasks.get(taskId);

        task.status = 'processing';
        task.progress = 10;
        persistTask(task);

        return new Promise((resolve, reject) => {
            const requestBody = buildMusicRequest(options);
            const postData = JSON.stringify(requestBody);
            const reqOptions = {
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

            const req = https.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const response = JSON.parse(data);

                        if (await writeMusicOutput(task, response)) {
                            resolve(task);
                            return;
                        }

                        const providerTaskId = getProviderTaskId(response);
                        if (providerTaskId) {
                            task.providerTaskId = providerTaskId;
                            task.progress = 30;
                            persistTask(task);
                            await pollMusicTask(task);
                            resolve(task);
                            return;
                        }

                        if (isCompletedStatus(getProviderStatus(response))) {
                            task.status = 'error';
                            task.error = 'Music generation completed without audio output';
                            persistTask(task);
                            reject(new Error(task.error));
                            return;
                        }

                        const providerError = getProviderError(response);
                        task.status = 'error';
                        task.error = providerError || 'Music generation failed';
                        persistTask(task);
                        reject(new Error(task.error));
                    } catch (error) {
                        task.status = 'error';
                        task.error = error.message;
                        persistTask(task);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                task.status = 'error';
                task.error = error.message;
                persistTask(task);
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    const routes = {
        '/api/generate/music': async (req, res, body) => {
            const { prompt, duration, style, bpm, key } = body;
            if (!prompt) return { error: 'Prompt is required' };

            const taskId = `music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const outputFile = path.join(OUTPUT_DIR, `${taskId}.mp3`);

            const normalizedDuration = normalizeDuration(duration);
            const normalizedPrompt = String(prompt || '').trim();

            musicTasks.set(taskId, {
                taskId,
                status: 'pending',
                progress: 0,
                outputFile,
                prompt: normalizedPrompt,
                style,
                bpm,
                key,
                duration: normalizedDuration,
                userId: req.authSession?.userId || null,
                startedAt: Date.now()
            });
            stateStore?.createTask({
                taskId,
                userId: req.authSession?.userId || null,
                feature: 'music',
                status: 'pending',
                progress: 0,
                inputPayload: { prompt: normalizedPrompt, style, bpm, key, duration: normalizedDuration },
                outputPayload: {}
            });

            processMusicTask(taskId, {
                prompt: normalizedPrompt,
                duration: normalizedDuration,
                style,
                bpm,
                key
            }).catch(error => {
                const task = musicTasks.get(taskId);
                if (task) {
                    task.status = 'error';
                    task.error = error.message;
                    persistTask(task);
                }
            });

            return { taskId, status: 'pending', message: '音乐生成已启动' };
        }
    };

    routes['/api/music'] = async (req, res, body) => routes['/api/generate/music'](req, res, body);
    return routes;
}

module.exports = {
    createMusicRoutes
};
