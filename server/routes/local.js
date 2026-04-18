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

function getTaskStatus(taskMap, taskId) {
    if (!taskId) {
        return { error: 'taskId is required' };
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

function createLocalRoutes({ OUTPUT_DIR, MIME_TYPES, musicTasks, coverTasks, imageTasks }) {
    return {
        '/api/upload': async (req, res, body) => {
            const { filename, data } = body;

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

        '/api/music/status': async (req, res, body) => getTaskStatus(musicTasks, body.taskId),
        '/api/music-cover/status': async (req, res, body) => getTaskStatus(coverTasks, body.taskId),
        '/api/image/status': async (req, res, body) => getTaskStatus(imageTasks, body.taskId),

        '/api/files': async () => {
            try {
                const files = fs.readdirSync(OUTPUT_DIR)
                    .filter(file => file.endsWith('.mp3') || file.endsWith('.png') || file.endsWith('.jpg'))
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
}

module.exports = {
    createLocalRoutes
};
