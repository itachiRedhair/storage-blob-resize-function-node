const stream = require('stream');
const Jimp = require('jimp');
const storage = require('azure-storage');
const blobService = storage.createBlobService();

module.exports = function (context, eventGridEvent, blob) {

    context.log('eventGridEvent', eventGridEvent);
    context.log('received blob', blob);

    const smallThumbnailWidth = process.env.SMALL_THUMBNAIL_WIDTH;
    const mediumThumbnailWidth = process.env.MEDIUM_THUMBNAIL_WIDTH;
    const smallThumbnailContainer = process.env.SMALL_THUMBNAIL_CONTAINER_NAME;
    const mediumThumbnailContainer = process.env.MEDIUM_THUMBNAIL_CONTAINER_NAME;
    context.log('smallwidth', smallThumbnailWidth,
        'mediumwdith', mediumThumbnailWidth,
        'smallname', smallThumbnailContainer,
        'mediumname', mediumThumbnailContainer)

    const blobName = eventGridEvent.subject.split('/')[6];

    context.log('blobname is', blobName);

    Jimp.read(blob)
        .then(jimpObject => {
            context.log('[success] converted to jimp object', jimpObject);

            const smallThumbnail = jimpObject.clone();
            const mediumThumbnail = jimpObject.clone();

            context.log('[success] cloned and stored in respective variables', smallThumbnail, mediumThumbnail);

            smallThumbnail.resize(Number(smallThumbnailWidth), Jimp.AUTO);
            mediumThumbnail.resize(Number(mediumThumbnailWidth), Jimp.AUTO);

            context.log('[success] resized small and medium', smallThumbnail, mediumThumbnail);

            const promise1 = smallThumbnail.getBufferAsync(Jimp.AUTO).then(buffer => {
                context.log('[success] got buffer for small thumbnail', buffer);
                return addBlobToAzureBlobStorage(buffer, smallThumbnailContainer, blobName);
            });

            const promise2 = mediumThumbnail.getBufferAsync(Jimp.AUTO).then(buffer => {
                context.log('[success] got buffer for medium thumbnail', buffer);
                return addBlobToAzureBlobStorage(buffer, mediumThumbnailContainer, blobName);
            });

            return Promise.all([promise1, promise2]);
        }).then(() => {
            context.log('it seems everythings done');
            context.done();
        })
        .catch(err => {
            context.log('[error]', err, 'for subject', eventGridEvent.subject);
        });
};

const addBlobToAzureBlobStorage = (buffer, containerName, blobName) => {
    const fileStream = new stream.Readable();
    fileStream.push(buffer);
    fileStream.push(null);

    return new Promise((resolve, reject) => {
        blobService.createBlockBlobFromText(containerName, blobName, fileStream.read(), function (error, result, response) {
            if (!error) {
                context.log('[success] stored blob', blobName, 'in container', containerName);
                resolve({ result, response });
            } else {
                reject(error);
            }
        });
    });
};
