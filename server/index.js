/**
 * AI 内容生成站 - 后端服务器
 * 统一处理所有 MiniMax API 调用
 */

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 18791;
const OUTPUT_DIR = '/tmp/minimax-output';
const API_KEY = 'sk-cp-uHBY-VvooyT13Jr2ool1ZrnC8hEAONsdwdaqZ3Y4h_UKtqfffudUmd5bMxk-2uxuxAbTO8dFMnECVqiS5K5qduKNj3-Qlj4QlRUqx2SjFurXvQnfggpsgxw';
const API_HOST = 'api.minimaxi.com';

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 后台任务存储
const musicTasks = new Map();
const imageTasks = new Map();
const coverTasks = new Map();

// 歌词生成函数 - 使用Node.js直接调用
async function callLyricsAPI(prompt, genre, mood) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ 
            mode: 'write_full_song',
            prompt
        });
        
        const req = https.request({
            hostname: API_HOST,
            port: 443,
            path: '/v1/lyrics_generation',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.base_resp?.status_code === 0) {
                        resolve({
                            success: true,
                            lyrics: response.lyrics || '',
                            title: response.song_title || ''
                        });
                    } else {
                        resolve({ error: response.base_resp?.status_msg || '歌词生成失败' });
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 轮询歌词任务
async function pollLyricsTask(taskId, maxAttempts = 30) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        function poll() {
            attempts++;
            const postData = JSON.stringify({ task_id: taskId });
            const options = {
                hostname: API_HOST, port: 443, path: '/v1/lyrics_generation', method: 'GET',
                headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.data?.lyrics) {
                            resolve({ success: true, lyrics: response.data.lyrics });
                        } else if (attempts < maxAttempts) {
                            setTimeout(poll, 2000);
                        } else {
                            reject(new Error('Lyrics generation timeout'));
                        }
                    } catch (e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        }
        
        setTimeout(poll, 2000);
    });
}

// 处理音乐生成的后台任务
async function processMusicTask(taskId, options) {
    const { model = 'music-2.6', prompt, lyrics = '[intro][outro]' } = options;
    const task = musicTasks.get(taskId);
    
    task.status = 'processing';
    task.progress = 10;
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ model, prompt, lyrics });
        const reqOptions = {
            hostname: API_HOST, port: 443, path: '/v1/music_generation', method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        
        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (response.data?.audio) {
                        task.progress = 80;
                        const buffer = Buffer.from(response.data.audio, 'hex');
                        fs.writeFileSync(task.outputFile, buffer);
                        task.status = 'completed';
                        task.progress = 100;
                        task.url = `/output/${path.basename(task.outputFile)}`;
                        task.duration = response.extra_info?.music_duration || 0;
                        resolve(task);
                        return;
                    }
                    
                    if (response.task_id) {
                        task.taskId = response.task_id;
                        task.progress = 30;
                        await pollMusicTask(task);
                        resolve(task);
                        return;
                    }
                    
                    task.status = 'error';
                    task.error = 'Music generation failed';
                    reject(new Error('Music generation failed'));
                } catch (e) {
                    task.status = 'error';
                    task.error = e.message;
                    reject(e);
                }
            });
        });
        
        req.on('error', (e) => {
            task.status = 'error';
            task.error = e.message;
            reject(e);
        });
        
        req.write(postData);
        req.end();
    });
}

function downloadFile(hexData, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const buffer = Buffer.from(hexData, 'hex');
            fs.writeFileSync(outputPath, buffer);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

function downloadFromUrl(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(fileUrl, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                downloadFromUrl(response.headers.location, outputPath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
            file.close();
            reject(err);
        });
    });
}

// 处理歌声翻唱任务
async function processCoverTask(task, maxAttempts = 60) {
    const { taskId, outputFile } = task;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const poll = () => {
            attempts++;
            const options = {
                hostname: API_HOST, port: 443,
                path: `/v1/music_cover_result?task_id=${taskId}`, method: 'GET',
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const response = JSON.parse(data);
                        
                        if (response.data?.audio) {
                            task.progress = 80;
                            const buffer = Buffer.from(response.data.audio, 'base64');
                            fs.writeFileSync(outputFile, buffer);
                            task.status = 'completed';
                            task.progress = 100;
                            task.url = `/output/${path.basename(outputFile)}`;
                            resolve(task);
                        } else if (response.status === 2 && response.data?.audio) {
                            task.progress = 80;
                            const buffer = Buffer.from(response.data.audio, 'base64');
                            fs.writeFileSync(outputFile, buffer);
                            task.status = 'completed';
                            task.progress = 100;
                            task.url = `/output/${path.basename(outputFile)}`;
                            resolve(task);
                        } else if (attempts < maxAttempts) {
                            task.progress = Math.min(70, 10 + attempts * 5);
                            setTimeout(poll, 3000);
                        } else {
                            task.status = 'error';
                            task.error = 'Timeout';
                            reject(new Error('Cover generation timeout'));
                        }
                    } catch (e) {
                        if (attempts < maxAttempts) {
                            setTimeout(poll, 3000);
                        } else {
                            task.status = 'error';
                            task.error = e.message;
                            reject(e);
                        }
                    }
                });
            });
            req.on('error', reject);
            req.end();
        };
        
        // 等待几秒再开始轮询
        setTimeout(poll, 5000);
    });
}

// 文件上传路由
const routes = {
    // 文件上传 - 接收 base64 编码的文件
    '/api/upload': async (req, res, body) => {
        const { filename, data, type } = body;
        
        if (!filename || !data) {
            return { error: 'filename 和 data 都是必需的' };
        }
        
        try {
            const buffer = Buffer.from(data, 'base64');
            const ext = path.extname(filename) || '.mp3';
            const outputFile = path.join(OUTPUT_DIR, `upload_${Date.now()}${ext}`);
            fs.writeFileSync(outputFile, buffer);
            
            return { 
                success: true, 
                url: `/output/${path.basename(outputFile)}`,
                filename: path.basename(outputFile)
            };
        } catch (e) {
            return { error: '文件保存失败: ' + e.message };
        }
    },
    
    // 文本转语音 HD (官方 T2A API)
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
        
        const outputFile = path.join(OUTPUT_DIR, `tts_${Date.now()}.mp3`);
        
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                model: model,
                text: text,
                stream: false,
                voice_setting: {
                    voice_id: voice_id,
                    speed: speed,
                    vol: vol,
                    pitch: pitch,
                    emotion: emotion
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
                hostname: API_HOST, port: 443,
                path: '/v1/t2a_v2', method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.base_resp?.status_code !== 0) {
                            throw new Error(response.base_resp?.status_msg || 'TTS API error');
                        }
                        if (response.data?.audio) {
                            // hex 编码的音频数据
                            const buffer = Buffer.from(response.data.audio, 'hex');
                            fs.writeFileSync(outputFile, buffer);
                            resolve({
                                success: true, file: outputFile,
                                url: `/output/${path.basename(outputFile)}`,
                                extra: response.extra_info
                            });
                        } else {
                            throw new Error('No audio data');
                        }
                    } catch (e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    },
    
    // 获取音色列表
    '/api/voices': async () => {
        return {
            voices: [
                { id: 'male-qn-qingse', name: '清朗男声', language: '中文', gender: 'male' },
                { id: 'female-tianmei', name: '甜妹', language: '中文', gender: 'female' },
                { id: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85', name: 'MOSS 男声', language: '中文', gender: 'male' },
                { id: 'moss_audio_aaa1346a-7ce7-11f0-8e61-2e6e3c7ee85d', name: 'MOSS 女声', language: '中文', gender: 'female' },
                { id: 'Chinese (Mandarin)_Lyrical_Voice', name: '抒情voice', language: '中文', gender: 'female' },
                { id: 'Chinese (Mandarin)_HK_Flight_Attendant', name: '港航乘务员', language: '中文', gender: 'female' },
                { id: 'English_Graceful_Lady', name: '优雅女士', language: '英文', gender: 'female' },
                { id: 'English_Insightful_Speaker', name: '洞察演说家', language: '英文', gender: 'male' },
                { id: 'English_radiant_girl', name: '阳光女孩', language: '英文', gender: 'female' },
                { id: 'English_Persuasive_Man', name: '说服力男人', language: '英文', gender: 'male' },
                { id: 'English_Lucky_Robot', name: '幸运机器人', language: '英文', gender: 'neutral' },
                { id: 'Japanese_Whisper_Belle', name: '密语Belle', language: '日文', gender: 'female' },
                { id: 'moss_audio_24875c4a-7be4-11f0-9359-4e72c55db738', name: 'MOSS日语女', language: '日文', gender: 'female' },
                { id: 'korean_female', name: '韩语女声', language: '韩文', gender: 'female' },
                { id: 'korean_male', name: '韩语男声', language: '韩文', gender: 'male' },
                { id: 'spanish_female', name: '西班牙女声', language: '西班牙', gender: 'female' },
                { id: 'french_female', name: '法语女声', language: '法文', gender: 'female' },
                { id: 'german_female', name: '德语女声', language: '德文', gender: 'female' }
            ],
            emotions: ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm', 'fluent', 'whisper'],
            emotionLabels: {
                'happy': '😊 高兴', 'sad': '😢 悲伤', 'angry': '😠 愤怒',
                'fearful': '😨 害怕', 'disgusted': '😒 厌恶', 'surprised': '😮 惊讶',
                'calm': '😌 中性', 'fluent': '🎭 生动', 'whisper': '🤫 低语'
            },
            models: [
                { id: 'speech-2.8-hd', name: 'Speech 2.8 HD (高清)' },
                { id: 'speech-2.8-turbo', name: 'Speech 2.8 Turbo (快速)' },
                { id: 'speech-2.6-hd', name: 'Speech 2.6 HD' },
                { id: 'speech-2.6-turbo', name: 'Speech 2.6 Turbo' }
            ]
        };
    },
    
    // 生成音乐 (music-2.6)
    '/api/music': async (req, res, body) => {
        const { prompt, lyrics = '无歌词', model = 'music-2.6' } = body;
        if (!prompt) return { error: 'Prompt is required' };
        
        const taskId = `music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const outputFile = path.join(OUTPUT_DIR, `${taskId}.mp3`);
        
        // 存储任务状态
        musicTasks.set(taskId, {
            status: 'pending',
            progress: 0,
            outputFile,
            prompt,
            startedAt: Date.now()
        });
        
        // 立即返回任务ID，让前端可以查询进度
        // 后台开始处理
        processMusicTask(taskId, { model, prompt, lyrics }).catch(err => {
            console.error('Background music error:', err.message);
            musicTasks.get(taskId).status = 'error';
            musicTasks.get(taskId).error = err.message;
        });
        
        return { taskId, status: 'pending', message: '音乐生成已启动，请查询进度' };
    },
    
    // 查询音乐任务进度
    '/api/music/status': async (req, res, body) => {
        const { taskId } = body;
        if (!taskId) return { error: 'taskId is required' };
        
        const task = musicTasks.get(taskId);
        if (!task) return { error: 'Task not found', status: 'not_found' };
        
        return {
            taskId,
            status: task.status,
            progress: task.progress,
            url: task.url,
            duration: task.duration,
            error: task.error
        };
    },
    
    // 生成歌词
    '/api/lyrics': async (req, res, body) => {
        const { prompt, genre = 'pop', mood = 'happy' } = body;
        if (!prompt) return { error: 'Prompt is required' };
        
        // 先调用API获取歌词
        const result = await callLyricsAPI(prompt, genre, mood);
        return result;
    },
    
    // AI歌声翻唱
    '/api/music-cover': async (req, res, body) => {
        const { audio_url, prompt } = body;
        if (!audio_url) return { error: 'Audio URL is required' };
        
        const taskId = `cover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const outputFile = path.join(OUTPUT_DIR, `${taskId}.mp3`);
        
        const task = {
            taskId,
            status: 'processing',
            progress: 0,
            outputFile,
            startedAt: Date.now()
        };
        coverTasks.set(taskId, task);
        
        // 启动后台处理
        processCoverTask(task).catch(err => {
            task.status = 'error';
            task.error = err.message;
        });
        
        return { taskId, status: 'pending', message: '翻唱生成已启动，请查询进度' };
    },
    
    // 歌声翻唱状态查询
    '/api/music-cover/status': async (req, res, body) => {
        const { taskId } = body;
        if (!taskId) return { error: 'taskId is required' };
        
        const task = coverTasks.get(taskId);
        if (!task) return { error: 'Task not found', status: 'not_found' };
        
        return {
            taskId,
            status: task.status,
            progress: task.progress,
            url: task.url,
            duration: task.duration,
            error: task.error
        };
    },
    
    // 生成图片 (image-01) - 改为后台任务
    '/api/image': async (req, res, body) => {
        const { prompt, aspect_ratio = '1:1' } = body;
        if (!prompt) return { error: 'Prompt is required' };
        
        const taskId = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const ext = aspect_ratio === '9:16' ? 'png' : 'png';
        const outputFile = path.join(OUTPUT_DIR, `${taskId}.${ext}`);
        
        // 存储任务状态
        imageTasks.set(taskId, {
            status: 'pending',
            progress: 0,
            outputFile,
            prompt,
            startedAt: Date.now()
        });
        
        // 立即返回任务ID，让前端可以查询进度
        // 后台开始处理
        processImageTask(taskId, { prompt, aspect_ratio }).catch(err => {
            console.error('Background image error:', err.message);
            imageTasks.get(taskId).status = 'error';
            imageTasks.get(taskId).error = err.message;
        });
        
        return { taskId, status: 'pending', message: '封面生成已启动，请查询进度' };
    },
    
    // 查询图片任务进度
    '/api/image/status': async (req, res, body) => {
        const { taskId } = body;
        if (!taskId) return { error: 'taskId is required' };
        
        const task = imageTasks.get(taskId);
        if (!task) return { error: 'Task not found', status: 'not_found' };
        
        return {
            taskId,
            status: task.status,
            progress: task.progress,
            url: task.url,
            duration: task.duration,
            size: task.size,
            error: task.error
        };
    },
    
    // 获取配额 - 直接调用 MiniMax API
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
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
    },
    
    // 通用对话 - MiniMax Messages API
    '/api/chat': async (req, res, body) => {
        const { messages, model = 'MiniMax-M2.7', max_tokens = 4096, temperature = 0.7 } = body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return { error: 'messages 数组是必需的' };
        }
        
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: max_tokens,
                temperature: temperature
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
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        console.log('Chat API raw response:', JSON.stringify(response).substring(0, 1000));
                        if (response.base_resp?.status_code !== 0) {
                            resolve({ error: response.base_resp?.status_msg || 'Chat API error' });
                            return;
                        }
                        // Find text from content array (MiniMax returns thinking + text)
                        const textItem = Array.isArray(response.content)
                            ? response.content.find(c => c.type === 'text')
                            : null;
                        const replyText = textItem?.text || response.choices?.[0]?.text || response.choices?.[0]?.message?.content || response.reply || response.message?.content || response.text || '';
                        resolve({
                            success: true,
                            reply: replyText,
                            usage: response.usage
                        });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    },
    
    // 列出输出文件
    '/api/files': async () => {
        try {
            const files = fs.readdirSync(OUTPUT_DIR)
                .filter(f => f.endsWith('.mp3') || f.endsWith('.png') || f.endsWith('.jpg'))
                .map(f => ({ name: f, url: `/output/${f}`, size: fs.statSync(path.join(OUTPUT_DIR, f)).size }))
                .sort((a, b) => b.name.localeCompare(a.name)).slice(0, 50);
            return { files };
        } catch { return { files: [] }; }
    },
    
    // 输出文件下载
    '/output/*': async (req, res) => {
        const filename = req.url.replace('/output/', '');
        const filepath = path.join(OUTPUT_DIR, filename);
        if (fs.existsSync(filepath)) {
            const ext = path.extname(filepath);
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            fs.createReadStream(filepath).pipe(res);
            return null;
        }
        return { error: 'File not found', status: 404 };
    }
};

function pollMusicTask(task, maxAttempts = 120) {
    // 更新后的轮询函数，接收 task 对象
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const taskId = task.taskId;
        
        const poll = () => {
            attempts++;
            const options = {
                hostname: API_HOST, port: 443,
                path: `/v1/music_generation_result?task_id=${taskId}`, method: 'GET',
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        
                        // status: 0=进行中, 1=完成, 2=完成带数据
                        if (response.status === 2 && response.data?.audio) {
                            task.progress = 90;
                            const buffer = Buffer.from(response.data.audio, 'hex');
                            fs.writeFileSync(task.outputFile, buffer);
                            task.status = 'completed';
                            task.progress = 100;
                            task.url = `/output/${path.basename(task.outputFile)}`;
                            task.duration = response.extra_info?.music_duration || 0;
                            resolve(task);
                        } else if (response.status === 1 || response.status === 0) {
                            // 还在处理中
                            task.progress = 30 + Math.min(50, attempts * 5);
                            if (attempts < maxAttempts) {
                                setTimeout(poll, 2000);
                            } else {
                                task.status = 'error';
                                task.error = 'Timeout';
                                reject(new Error('Music generation timeout'));
                            }
                        } else {
                            task.status = 'error';
                            task.error = 'Failed';
                            reject(new Error('Music generation failed'));
                        }
                    } catch (e) { 
                        task.status = 'error';
                        task.error = e.message;
                        if (attempts < maxAttempts) {
                            setTimeout(poll, 2000);
                        } else {
                            reject(e); 
                        }
                    }
                });
            });
            req.on('error', (e) => {
                task.status = 'error';
                task.error = e.message;
                reject(e);
            });
            req.end();
        };
        
        poll();
    });
}

function pollLyricsTask(taskId, maxAttempts = 60) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const poll = () => {
            attempts++;
            const options = {
                hostname: API_HOST, port: 443,
                path: `/v1/lyrics_generation_result?task_id=${taskId}`, method: 'GET',
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === 2 && response.data?.lyrics) {
                            resolve({ success: true, lyrics: response.data.lyrics });
                        } else if (attempts < maxAttempts) {
                            setTimeout(poll, 2000);
                        } else {
                            reject(new Error('Timeout'));
                        }
                    } catch { if (attempts < maxAttempts) setTimeout(poll, 2000); else reject(new Error('Parse error')); }
                });
            });
            req.on('error', reject);
            req.end();
        };
        poll();
    });
}

function pollCoverTask(taskId, maxAttempts = 60) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const poll = () => {
            attempts++;
            const options = {
                hostname: API_HOST, port: 443,
                path: `/v1/music_cover_result?task_id=${taskId}`, method: 'GET',
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.status === 2 && response.data?.audio) {
                            const buffer = Buffer.from(response.data.audio, 'base64');
                            const outputFile = path.join(OUTPUT_DIR, `cover_${Date.now()}.mp3`);
                            fs.writeFileSync(outputFile, buffer);
                            resolve({ success: true, file: outputFile, url: `/output/${path.basename(outputFile)}` });
                        } else if (attempts < maxAttempts) {
                            setTimeout(poll, 2000);
                        } else {
                            reject(new Error('Timeout'));
                        }
                    } catch { if (attempts < maxAttempts) setTimeout(poll, 2000); else reject(new Error('Parse error')); }
                });
            });
            req.on('error', reject);
            req.end();
        };
        poll();
    });
}

// 处理图片生成的后台任务
async function processImageTask(taskId, options) {
    const { prompt, aspect_ratio = '1:1' } = options;
    const task = imageTasks.get(taskId);
    
    task.status = 'processing';
    task.progress = 10;
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ model: 'image-01', prompt, aspect_ratio });
        const options = {
            hostname: API_HOST, port: 443, path: '/v1/image_generation', method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    task.progress = 50;
                    const response = JSON.parse(data);
                    
                    if (response.data?.image_urls?.[0]) {
                        task.progress = 80;
                        await downloadFromUrl(response.data.image_urls[0], task.outputFile);
                        task.status = 'completed';
                        task.progress = 100;
                        task.url = `/output/${path.basename(task.outputFile)}`;
                        task.size = fs.statSync(task.outputFile).size;
                        task.duration = Date.now() - task.startedAt;
                        resolve(task);
                    } else if (response.task_id) {
                        // 需要轮询
                        task.taskId = response.task_id;
                        task.progress = 30;
                        await pollImageTask(task);
                        resolve(task);
                    } else {
                        task.status = 'error';
                        task.error = 'Image generation failed';
                        reject(new Error('Image generation failed'));
                    }
                } catch (e) {
                    task.status = 'error';
                    task.error = e.message;
                    reject(e);
                }
            });
        });
        
        req.on('error', (e) => {
            task.status = 'error';
            task.error = e.message;
            reject(e);
        });
        
        req.write(postData);
        req.end();
    });
}

function pollImageTask(task, maxAttempts = 60) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const taskId = task.taskId;
        
        const poll = () => {
            attempts++;
            const options = {
                hostname: API_HOST, port: 443,
                path: `/v1/image_generation_result?task_id=${taskId}`, method: 'GET',
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
                            await downloadFromUrl(response.data.image_urls[0], task.outputFile);
                            task.status = 'completed';
                            task.progress = 100;
                            task.url = `/output/${path.basename(task.outputFile)}`;
                            task.duration = Math.round((Date.now() - task.startedAt) / 1000);
                            resolve(task);
                        } else if (attempts < maxAttempts) {
                            task.progress = 30 + Math.min(40, attempts * 3);
                            setTimeout(poll, 2000);
                        } else {
                            task.status = 'error';
                            task.error = 'Timeout';
                            reject(new Error('Image generation timeout'));
                        }
                    } catch (e) {
                        if (attempts < maxAttempts) {
                            setTimeout(poll, 2000);
                        } else {
                            task.status = 'error';
                            task.error = e.message;
                            reject(e);
                        }
                    }
                });
            });
            req.on('error', (e) => {
                task.status = 'error';
                task.error = e.message;
                reject(e);
            });
            req.end();
        };
        
        poll();
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    
    const parsedUrl = url.parse(req.url, true);
    let handler = routes[parsedUrl.pathname];
    
    if (!handler) {
        for (const key of Object.keys(routes)) {
            if (key.includes('*') && parsedUrl.pathname.startsWith(key.replace('*', ''))) {
                handler = routes[key];
                break;
            }
        }
    }
    
    if (!handler) {
        let filepath = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
        filepath = path.join(__dirname, '..', 'public', filepath);
        try {
            const ext = path.extname(filepath);
            const content = fs.readFileSync(filepath);
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
            res.end(content);
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
        return;
    }
    
    try {
        let body = {};
        if (req.method === 'POST') {
            let rawBody = '';
            req.on('data', chunk => rawBody += chunk);
            await new Promise(resolve => req.on('end', resolve));
            body = JSON.parse(rawBody || '{}');
        }
        
        const result = await handler(req, res, body);
        if (result === null) return;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
});

server.listen(PORT, () => {
    console.log(`🎙️ AI 内容生成站已启动: http://localhost:${PORT}`);
});

