const stream = require('stream');
const Jimp = require('jimp');
const storage = require('azure-storage');
const blobService = storage.createBlobService();

const addBlobToAzureBlobStorage = (buffer, containerName, blobName) => {
  const fileStream = new stream.Readable();
  fileStream.push(buffer);
  fileStream.push(null);

  return new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(containerName, blobName, fileStream.read(), function(error, result, response) {
      if (!error) {
        context.log('[success] stored blob', blobName, 'in container', containerName);
        resolve({ result, response });
      } else {
        reject(error);
      }
    });
  });
};

module.exports = async function(context, eventGridEvent, blob) {
  context.log(typeof eventGridEvent);
  context.log(eventGridEvent);

  const smallThumbnailWidth = process.env.SMALL_THUMBNAIL_WIDTH;
  const mediumThumbnailWidth = process.env.MEDIUM_THUMBNAIL_WIDTH;
  const smallThumbnailContainer = process.env.SMALL_THUMBNAIL_CONTAINER_NAME;
  const mediumThumbnailContainer = process.env.MEDIUM_THUMBNAIL_CONTAINER_NAME;

  const blobName = eventGridEvent.subject.split('/')[6];

  Jimp.read(blob)
    .then(jimpObject => {
      const smallThumbnail = jimpObject.clone();
      const mediumThumbnail = jimpObject.clon();

      smallthumbnail.resize(smallThumbnailWidth, Jimp.AUTO);
      mediumThumbnail.resize(mediumThumbnailWidth, Jimp.AUTO);

      const promise1 = smallThumbnail.getBufferAsync(Jimp.AUTO).then(buffer => {
        context.log('[success] got buffer for small thumbnail', buffer);
        return addBlobToAzureBlobStorage(buffer, smallThumbnailContainer, blobName);
      });

      const promise2 = mediumThumbnail.getBufferAsync(Jimp.AUTO).then(buffer => {
        context.log('[success] got buffer for medium thumbnail', buffer);
        return addBlobToAzureBlobStorage(buffer, mediumThumbnailContainer, blobName);
      });

      return Promise.all([promise1, promise2]);
    })
    .catch(err => {
      context.log('[error]', err, 'for subject', eventGridEvent.subject);
    });
};
