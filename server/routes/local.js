const fs = require('fs');
const path = require('path');

const VOICES = [
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
];

function getTaskStatus(taskMap, taskId, stateStore) {
    if (!taskId) {
        return { error: 'taskId is required' };
    }

    const persistedTask = stateStore?.getTask(taskId);
    if (persistedTask) {
        return {
            taskId,
            status: persistedTask.status,
            progress: persistedTask.progress,
            url: persistedTask.url,
            duration: persistedTask.duration,
            size: persistedTask.size,
            error: persistedTask.error
        };
    }

    const task = taskMap.get(taskId);
    if (!task) {
        return { error: 'Task not found', status: 'not_found' };
    }

    return {
        taskId,
        status: task.status,
        progress: task.progress,
        url: task.url,
        duration: task.duration,
        size: task.size,
        error: task.error
    };
}

function startsWithBytes(buffer, bytes) {
    if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
    return bytes.every((byte, index) => buffer[index] === byte);
}

function hasMp3FrameHeader(buffer) {
    return buffer.length >= 2
        && buffer[0] === 0xff
        && [0xfb, 0xf3, 0xf2].includes(buffer[1]);
}

function hasAacAdtsHeader(buffer) {
    return buffer.length >= 2
        && buffer[0] === 0xff
        && (buffer[1] & 0xf6) === 0xf0;
}

function hasMp4FtypHeader(buffer) {
    return buffer.length >= 12
        && buffer.slice(4, 8).toString('ascii') === 'ftyp';
}

function detectUploadFileType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
    if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
    if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
    if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WAVE') return 'wav';
    if (buffer.slice(0, 4).toString('ascii') === 'OggS') return 'ogg';
    if (buffer.slice(0, 3).toString('ascii') === 'ID3' || hasMp3FrameHeader(buffer)) return 'mp3';
    if (hasAacAdtsHeader(buffer)) return 'aac';
    if (hasMp4FtypHeader(buffer)) return 'mp4';
    return null;
}

function createLocalRoutes({ OUTPUT_DIR, MIME_TYPES, musicTasks, coverTasks, imageTasks, stateStore, maxUploadBytes }) {
    const outputRoot = path.resolve(OUTPUT_DIR);
    const uploadLimitBytes = Number(maxUploadBytes || 10 * 1024 * 1024) || (10 * 1024 * 1024);
    const allowedUploadExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.png', '.jpg', '.jpeg', '.webp']);
    const uploadTypeExtensions = {
        mp3: new Set(['.mp3']),
        wav: new Set(['.wav']),
        mp4: new Set(['.m4a', '.aac']),
        aac: new Set(['.aac']),
        ogg: new Set(['.ogg']),
        png: new Set(['.png']),
        jpeg: new Set(['.jpg', '.jpeg']),
        webp: new Set(['.webp'])
    };

    function isInsideOutputRoot(filepath) {
        const resolved = path.resolve(filepath);
        return resolved === outputRoot || resolved.startsWith(`${outputRoot}${path.sep}`);
    }

    return {
        '/api/upload': async (req, res, body) => {
            const { filename, data } = body;

            if (!filename || !data) {
                return { error: 'filename 和 data 都是必需的' };
            }

            try {
                const rawData = String(data || '');
                const estimatedBytes = Math.floor((rawData.length * 3) / 4);
                if (estimatedBytes > uploadLimitBytes) {
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '上传文件过大', reason: 'upload_too_large' }));
                    return null;
                }

                const buffer = Buffer.from(data, 'base64');
                if (buffer.length > uploadLimitBytes) {
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '上传文件过大', reason: 'upload_too_large' }));
                    return null;
                }

                const ext = path.extname(String(filename || '')).toLowerCase() || '.mp3';
                if (!allowedUploadExtensions.has(ext)) {
                    return { error: '不支持的文件类型', reason: 'unsupported_file_type' };
                }

                const detectedType = detectUploadFileType(buffer);
                if (!detectedType || !uploadTypeExtensions[detectedType]?.has(ext)) {
                    return { error: '上传文件内容与类型不匹配', reason: 'invalid_file_content' };
                }

                const outputFile = path.join(OUTPUT_DIR, `upload_${Date.now()}${ext}`);
                fs.writeFileSync(outputFile, buffer);

                return {
                    success: true,
                    url: `/output/${path.basename(outputFile)}`,
                    filename: path.basename(outputFile)
                };
            } catch (error) {
                return { error: '文件保存失败: ' + error.message };
            }
        },

        '/api/voices': async () => ({
            voices: VOICES,
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
        }),

        '/api/music/status': async (req, res, body) => getTaskStatus(musicTasks, body.taskId, stateStore),
        '/api/music-cover/status': async (req, res, body) => getTaskStatus(coverTasks, body.taskId, stateStore),
        '/api/image/status': async (req, res, body) => getTaskStatus(imageTasks, body.taskId, stateStore),

        '/api/files': async () => {
            try {
                const files = fs.readdirSync(OUTPUT_DIR)
                    .filter(file => allowedUploadExtensions.has(path.extname(file).toLowerCase()))
                    .map(file => ({
                        name: file,
                        url: `/output/${file}`,
                        size: fs.statSync(path.join(OUTPUT_DIR, file)).size
                    }))
                    .sort((a, b) => b.name.localeCompare(a.name))
                    .slice(0, 50);
                return { files };
            } catch {
                return { files: [] };
            }
        },

        '/output/*': async (req, res) => {
            const parsedUrl = new URL(req.url, 'http://localhost');
            let rawFilename = '';
            try {
                rawFilename = decodeURIComponent(parsedUrl.pathname.replace(/^\/output\/?/, ''));
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无效的文件路径编码', reason: 'invalid_path_encoding' }));
                return null;
            }
            if (!rawFilename || rawFilename.includes('/') || rawFilename.includes('\\')) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Forbidden' }));
                return null;
            }

            const filepath = path.resolve(OUTPUT_DIR, rawFilename);
            if (!isInsideOutputRoot(filepath)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Forbidden' }));
                return null;
            }

            if (fs.existsSync(filepath)) {
                const ext = path.extname(filepath);
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
                fs.createReadStream(filepath).pipe(res);
                return null;
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found', status: 404 }));
            return null;
        }
    };
}

module.exports = {
    createLocalRoutes
};
