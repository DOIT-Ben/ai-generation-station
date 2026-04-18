const fs = require('fs');
const path = require('path');
const { downloadFromUrl } = require('./shared');

function createImageRoutes({ https, API_HOST, API_KEY, OUTPUT_DIR, imageTasks, trackUsage }) {
    function buildImagePrompt(prompt, style) {
        if (!style) {
            return prompt;
        }
        return `${prompt}\n画面风格：${style}`;
    }

    function pollImageTask(task, maxAttempts = 60) {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const poll = () => {
                attempts++;
                const options = {
                    hostname: API_HOST,
                    port: 443,
                    path: `/v1/image_generation_result?task_id=${task.taskId}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${API_KEY}` }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', async () => {
                        try {
                            const response = JSON.parse(data);
                            if (response.status === 2 && response.data?.image_urls?.[0]) {
                                task.progress = 80;
                                await downloadFromUrl(https, response.data.image_urls[0], task.outputFile);
                                task.status = 'completed';
                                task.progress = 100;
                                task.url = `/output/${path.basename(task.outputFile)}`;
                                task.duration = Math.round((Date.now() - task.startedAt) / 1000);
                                trackUsage?.(task.userId, 'image');
                                resolve(task);
                            } else if (attempts < maxAttempts) {
                                task.progress = 30 + Math.min(40, attempts * 3);
                                setTimeout(poll, 2000);
                            } else {
                                task.status = 'error';
                                task.error = 'Timeout';
                                reject(new Error('Image generation timeout'));
                            }
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

    async function processImageTask(taskId, options) {
        const { prompt, aspect_ratio = '1:1', style } = options;
        const task = imageTasks.get(taskId);

        task.status = 'processing';
        task.progress = 10;

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                model: 'image-01',
                prompt: buildImagePrompt(prompt, style),
                aspect_ratio
            });
            const requestOptions = {
                hostname: API_HOST,
                port: 443,
                path: '/v1/image_generation',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        task.progress = 50;
                        const response = JSON.parse(data);

                        if (response.data?.image_urls?.[0]) {
                            task.progress = 80;
                            await downloadFromUrl(https, response.data.image_urls[0], task.outputFile);
                            task.status = 'completed';
                            task.progress = 100;
                            task.url = `/output/${path.basename(task.outputFile)}`;
                            task.size = fs.statSync(task.outputFile).size;
                            task.duration = Date.now() - task.startedAt;
                            trackUsage?.(task.userId, 'image');
                            resolve(task);
                        } else if (response.task_id) {
                            task.taskId = response.task_id;
                            task.progress = 30;
                            await pollImageTask(task);
                            resolve(task);
                        } else {
                            task.status = 'error';
                            task.error = 'Image generation failed';
                            reject(new Error('Image generation failed'));
                        }
                    } catch (error) {
                        task.status = 'error';
                        task.error = error.message;
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                task.status = 'error';
                task.error = error.message;
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    const routes = {
        '/api/generate/cover': async (req, res, body) => {
            const { prompt, ratio, style } = body;
            if (!prompt) return { error: 'Prompt is required' };

            const taskId = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const outputFile = path.join(OUTPUT_DIR, `${taskId}.png`);

            imageTasks.set(taskId, { status: 'pending', progress: 0, outputFile, prompt, style, userId: req.authSession?.userId || null, startedAt: Date.now() });
            processImageTask(taskId, { prompt, aspect_ratio: ratio || '1:1', style }).catch(error => {
                const task = imageTasks.get(taskId);
                if (task) {
                    task.status = 'error';
                    task.error = error.message;
                }
            });

            return { taskId, status: 'pending', message: '封面生成已启动' };
        }
    };

    routes['/api/image'] = async (req, res, body) => routes['/api/generate/cover'](req, res, body);
    return routes;
}

module.exports = {
    createImageRoutes
};
