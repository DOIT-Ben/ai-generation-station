function createLyricsRoutes({ https, API_HOST, API_KEY, trackUsage }) {
    function buildLyricsPrompt(prompt, style, structure) {
        const parts = [String(prompt || '').trim()];

        if (style) {
            parts.push(`风格要求：${style}`);
        }

        if (structure) {
            parts.push(`段落结构：${structure}`);
        }

        return parts.filter(Boolean).join('\n');
    }

    function callLyricsAPI(prompt, style, structure) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                mode: 'write_full_song',
                prompt: buildLyricsPrompt(prompt, style, structure)
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
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    const routes = {
        '/api/generate/lyrics': async (req, res, body) => {
            const { prompt, style, structure } = body;
            if (!prompt) return { error: 'Prompt is required' };
            const result = await callLyricsAPI(prompt, style, structure);
            if (result?.success) {
                trackUsage?.(req.authSession?.userId, 'lyrics');
            }
            return result;
        }
    };

    routes['/api/lyrics'] = async (req, res, body) => routes['/api/generate/lyrics'](req, res, body);
    return routes;
}

module.exports = {
    createLyricsRoutes
};
