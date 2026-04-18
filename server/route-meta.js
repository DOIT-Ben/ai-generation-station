const ROUTE_METHODS = {
    '/api/auth/session': ['GET'],
    '/api/auth/login': ['POST'],
    '/api/auth/logout': ['POST'],
    '/api/history/*': ['GET', 'POST'],
    '/api/preferences': ['GET', 'POST'],
    '/api/usage/today': ['GET'],
    '/api/templates/*': ['GET', 'POST'],
    '/api/upload': ['POST'],
    '/api/tts': ['POST'],
    '/api/voices': ['GET'],
    '/api/generate/music': ['POST'],
    '/api/music': ['POST'],
    '/api/music/status': ['POST'],
    '/api/generate/lyrics': ['POST'],
    '/api/lyrics': ['POST'],
    '/api/generate/voice': ['POST'],
    '/api/music-cover': ['POST'],
    '/api/music-cover/status': ['POST'],
    '/api/generate/cover': ['POST'],
    '/api/image': ['POST'],
    '/api/image/status': ['POST'],
    '/api/quota': ['GET'],
    '/api/chat': ['POST'],
    '/api/files': ['GET'],
    '/output/*': ['GET']
};

const API_KEY_REQUIRED_ROUTES = new Set([
    '/api/tts',
    '/api/generate/music',
    '/api/music',
    '/api/generate/lyrics',
    '/api/lyrics',
    '/api/generate/voice',
    '/api/music-cover',
    '/api/generate/cover',
    '/api/image',
    '/api/quota',
    '/api/chat'
]);

module.exports = {
    ROUTE_METHODS,
    API_KEY_REQUIRED_ROUTES
};
