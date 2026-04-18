const fs = require('fs');

function downloadFromUrl(https, fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(fileUrl, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                downloadFromUrl(https, response.headers.location, outputPath).then(resolve).catch(reject);
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (error) => {
            file.close();
            reject(error);
        });
    });
}

module.exports = {
    downloadFromUrl
};
