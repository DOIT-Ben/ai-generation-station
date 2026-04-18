const { createLyricsRoutes } = require('./tasks/lyrics');
const { createMusicRoutes } = require('./tasks/music');
const { createImageRoutes } = require('./tasks/image');
const { createVoiceCoverRoutes } = require('./tasks/voice-cover');

function createTaskRoutes(deps) {
    return {
        ...createLyricsRoutes(deps),
        ...createMusicRoutes(deps),
        ...createImageRoutes(deps),
        ...createVoiceCoverRoutes(deps)
    };
}

module.exports = {
    createTaskRoutes
};
