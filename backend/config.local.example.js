/**
 * Local configuration override example.
 * Keep secrets in `.env` when possible.
 */
module.exports = {
    PORT: 18791,
    BIND_HOST: '127.0.0.1',
    OUTPUT_DIR: 'output',
    MINIMAX_API_KEY: '',
    CHAT_API_KEY: '',
    APP_USERNAME: 'studio',
    APP_PASSWORD: '',
    CSRF_SECRET: '',
    MAX_JSON_BODY_BYTES: 8 * 1024 * 1024,
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024
};
