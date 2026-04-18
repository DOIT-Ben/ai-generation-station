const fs = require('fs');
const path = require('path');
const { assertServerReady, makeRequest } = require('./test-live-utils');

const TEST_FILE = path.join(__dirname, 'resources', 'ai-music.mp3');

function readFileAsBase64(filePath) {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
}

async function testUpload() {
    console.log('Upload test audio...');
    console.log(`   File: ${TEST_FILE}`);

    if (!fs.existsSync(TEST_FILE)) {
        console.error('Test file not found:', TEST_FILE);
        return null;
    }

    const base64 = readFileAsBase64(TEST_FILE);
    const filename = path.basename(TEST_FILE);
    console.log(`   Base64 size: ${(base64.length / 1024).toFixed(2)} KB`);

    const result = await makeRequest('/api/upload', 'POST', {
        filename,
        data: base64
    });

    if (result.data.success) {
        console.log('Upload succeeded');
        console.log(`   URL: ${result.data.url}`);
        return result.data.url;
    }

    console.error('Upload failed:', result.data.error);
    return null;
}

async function testVoiceCover(audioUrl) {
    console.log('\nStart voice cover...');
    console.log(`   Audio URL: ${audioUrl}`);

    const result = await makeRequest('/api/generate/voice', 'POST', {
        audio_url: audioUrl,
        prompt: 'Magnetic male pop vocal',
        timbre: 'male-qn-qingse',
        pitch: '0'
    });

    console.log('API response:', JSON.stringify(result.data, null, 2));

    if (result.data.taskId) {
        console.log(`Voice cover task started: ${result.data.taskId}`);
        return result.data.taskId;
    }

    if (result.data.error) {
        console.error('Voice cover start failed:', result.data.error);
    }
    return null;
}

async function pollTaskStatus(taskId, maxAttempts = 30) {
    console.log('\nPoll task status...');

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const result = await makeRequest('/api/music-cover/status', 'POST', {
            taskId
        });

        const status = result.data;
        console.log(`   [${i + 1}/${maxAttempts}] status: ${status.status}, progress: ${status.progress}%`);

        if (status.status === 'completed') {
            console.log('Voice cover completed');
            console.log(`   File URL: ${status.url}`);
            return status;
        }

        if (status.status === 'error') {
            console.error('Voice cover failed:', status.error);
            return null;
        }
    }

    console.log('Polling timed out');
    return null;
}

async function main() {
    console.log('=================================');
    console.log('  Voice cover integration test');
    console.log('=================================\n');

    await assertServerReady();

    const audioUrl = await testUpload();
    if (!audioUrl) {
        throw new Error('Upload step failed');
    }

    const taskId = await testVoiceCover(audioUrl);
    if (!taskId) {
        throw new Error('Voice cover task failed to start');
    }

    const result = await pollTaskStatus(taskId);
    if (!result) {
        throw new Error('Voice cover task did not complete');
    }

    console.log('\nVoice cover integration test passed');
    return { passed: true, url: result.url, duration: result.duration };
}

if (require.main === module) {
    main().catch(err => {
        console.error('Test failed:', err.message);
        process.exit(1);
    });
}

module.exports = {
    main
};
