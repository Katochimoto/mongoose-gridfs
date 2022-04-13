import mongoose from 'mongoose';
import createFileSchema from './schema';

const { GridFSBucket } = mongoose.mongo;
const MongooseTypes = mongoose.Types;

const toCollectionName = (modelName) => {
  let collectionName = modelName;
  if (modelName) {
    collectionName = mongoose.pluralize()(modelName);
  }
  return collectionName;
};

const { ObjectId } = MongooseTypes;

/* constants */
const DEFAULT_BUCKET_MODEL_NAME = 'File';
const DEFAULT_BUCKET_NAME = 'fs';
const DEFAULT_BUCKET_CHUNK_SIZE = 255 * 1024;
const DEFAULT_BUCKET_OPTIONS = {
  modelName: DEFAULT_BUCKET_MODEL_NAME,
  bucketName: DEFAULT_BUCKET_NAME,
  chunkSizeBytes: DEFAULT_BUCKET_CHUNK_SIZE,
};

/* getters */

/**
 * @name bucketName
 * @description Bucket name used to prefix 'files' and 'chunks' collections.
 * @returns {string}
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 1.0.0
 * @version 0.1.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * const bucketName = bucket.bucketName;
 * //=> fs
 */
Object.defineProperty(GridFSBucket.prototype, 'bucketName', {
  get: function getBucketName() {
    return this.s.options.bucketName;
  },
});

/**
 * @name collection
 * @description Collection used to store file data.
 * @returns {object} Valid mongodb collection
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 0.1.0
 * @version 0.6.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * const collection = bucket.collection;
 * //=> Collection { ... }
 */
Object.defineProperty(GridFSBucket.prototype, 'collection', {
  get: function getCollection() {
    // eslint-disable-next-line no-underscore-dangle
    return this.s._filesCollection;
  },
});

/**
 * @name collectionName
 * @description Name of a collection used to store file.
 * @returns {string} valid mongodb collection name
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 0.1.0
 * @version 0.7.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * const collectionName = bucket.collectionName;
 * //=> fs.files
 */
Object.defineProperty(GridFSBucket.prototype, 'collectionName', {
  get: function getCollectionName() {
    // eslint-disable-next-line no-underscore-dangle
    return this.s._filesCollection.s.namespace.collection;
  },
});

/* streams */

/**
 * @function createWriteStream
 * @name createWriteStream
 * @description Creates a writable stream (GridFSBucketWriteStream) for writing
 * buffers to GridFS for a custom file id. The stream's 'id' property contains
 * the resulting file's id.
 * @param {object} optns Valid options for write file.
 * @param {ObjectId} [optns._id] A custom id used to identify file doc.
 * @param {string} optns.filename The value of the 'filename' key in the files
 * doc.
 * @param {number} [optns.chunkSizeBytes] Optional overwrite this bucket's
 * chunkSizeBytes for this file.
 * @param {object} [optns.metadata] Optional object to store in the file
 * document's `metadata` field.
 * @param {string} [optns.contentType] Optional string to store in the file
 * document's `contentType` field.
 * @param {Array} [optns.aliases] Optional array of strings to store in the
 * file document's `aliases` field.
 * @param {boolean} [optns.disableMD5=false] If true, disables adding an
 * md5 field to file data.
 * @returns {object} Valid mongodb `GridFSBucketWriteStream`
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 1.0.0
 * @version 0.1.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * const _id = new ObjectId();
 * const filename = 'filename.txt';
 * const readStream = fs.createReadStream(filename);
 * const writeStream = bucket.createWriteStream({_id, filename});
 * readStream.pipe(writeStream);
 */
GridFSBucket.prototype.createWriteStream = function createWriteStream(optns) {
  const options = { _id: new ObjectId(), ...optns };
  const { _id, filename } = options;

  // ensure filename
  if (!filename) {
    const error = new Error('Missing filename');
    error.status = 400;
    throw error;
  }

  // open write stream
  const writeStream = this.openUploadStreamWithId(_id, filename, options);

  // return writeStream
  return writeStream;
};

/**
 * @function createReadStream
 * @name createReadStream
 * @description Creates a readable stream (GridFSBucketReadStream) for
 * streaming the file with the given name from GridFS. If there are multiple
 * files with the same name, this will stream the most recent file with the
 * given name (as determined by the `uploadDate` field). You can set the
 * `revision` option to change this behavior.
 * @param {object} [optns] Valid options for read existing file.
 * @param {ObjectId} optns._id The id of the file doc
 * @param {string} [optns.filename] The name of the file doc to stream
 * @param {number} [optns.revision=-1] The revision number relative to the
 * oldest file with the given filename. 0 gets you the oldest file, 1 gets you
 * the 2nd oldest, -1 gets you the newest.
 * @param {number} [optns.start] Optional 0-based offset in bytes to start
 * streaming from.
 * @param {number} [optns.end] Optional 0-based offset in bytes to stop
 * streaming before.
 * @returns {object} Valid mongodb `GridFSBucketReadStream`
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 1.0.0
 * @version 0.1.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * const _id = new ObjectId();
 * const filename = 'filename.txt';
 * const writeStream = fs.createWriteStream(filename);
 * const readStream = bucket.createReadStream({_id, filename});
 * readStream.pipe(writeStream);
 */
GridFSBucket.prototype.createReadStream = function createReadStream(optns) {
  const options = { ...optns };
  const { _id, filename } = options;

  // ensure filename or _id
  if (!filename && !_id) {
    const error = Error('Missing filename or file id');
    error.status = 400;
    throw error;
  }

  // initalize file read stream
  let readstream;

  // open download stream by file id
  if (_id) {
    readstream = this.openDownloadStream(_id, options);
  }

  // open download stream by file name
  if (filename && !readstream) {
    readstream = this.openDownloadStreamByName(filename, options);
  }

  // return read stream
  return readstream;
};

/* writers */

/**
 * @function writeFile
 * @name writeFile
 * @description Write provided file into MongoDB GridFS
 * @param {object} file valid file details
 * @param {object} readstream valid nodejs `ReadableStream`
 * @param {Function} [done] a callback to invoke on success or error
 * @fires GridFSBucketWriteStream#error
 * @fires GridFSBucketWriteStream#finish
 * @returns {object} Valid mongodb `GridFSBucketWriteStream` instance.
 * @see {@link https://docs.mongodb.com/manual/core/gridfs/}
 * @see {@link http://mongodb.github.io/node-mongodb-native}
 * @see {@link https://nodejs.org/api/stream.html#stream_writable_streams}
 * @see {@link https://nodejs.org/api/stream.html#stream_readable_streams}
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 1.0.0
 * @version 0.1.0
 * @instance
 * @example
 *
 * // large file
 * const bucket = createBucket();
 * const filename = 'filename.txt';
 * const readStream = fs.createReadStream(filename);
 * const writeStream = bucket.writeFile({ filename }, readStream);
 *
 * // small file
 * const bucket = createBucket();
 * const filename = 'filename.txt';
 * const readStream = fs.createReadStream(filename);
 * bucket.writeFile({ filename }, readStream, (error, file) => { ... });
 */
GridFSBucket.prototype.writeFile = function writeFile(file, readstream, done) {
  // ensure file details
  const $file = { _id: new ObjectId(), ...file };

  // create file write stream
  const writestream = this.createWriteStream($file);

  // stream file into mongodb gridfs bucket
  readstream.pipe(writestream);

  // work on the stream
  if (typeof done === 'function') {
    // handle errors
    writestream.on('error', function onWriteFileError(error) {
      return done(error);
    });

    // finalize write
    writestream.on('finish', function onWriteFileFinish($$file) {
      return done(null, $$file);
    });
  }

  // return writestream
  return writestream;
};

/* readers */

/**
 * @function readFile
 * @name readFile
 * @description Read file from MongoDB GridFS
 * @param {object} optns valid criteria for read existing file.
 * @param {object} optns._id The id of the file doc
 * @param {string} [optns.filename] The name of the file doc to stream
 * @param {number} [optns.revision=-1] The revision number relative to the
 * oldest file with the given filename. 0 gets you the oldest file, 1 gets you
 * the 2nd oldest, -1 gets you the newest.
 * @param {number} [optns.start] Optional 0-based offset in bytes to start
 * streaming from.
 * @param {number} [optns.end] Optional 0-based offset in bytes to stop
 * streaming before.
 *
 * Warn!: Pass callback if filesize is small enough.
 * Otherwise consider using stream instead.
 * @fires GridFSBucketReadStream#error
 * @fires GridFSBucketReadStream#file
 * @returns {object} Valid mongodb `GridFSBucketReadStream` instance.
 * @see {@link https://docs.mongodb.com/manual/core/gridfs/}
 * @see {@link http://mongodb.github.io/node-mongodb-native}
 * @see {@link https://nodejs.org/api/stream.html#stream_writable_streams}
 * @see {@link https://nodejs.org/api/stream.html#stream_readable_streams}
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 1.0.0
 * @version 0.1.0
 * @instance
 * @example
 *
 * // large file
 * const bucket = createBucket();
 * const filename = 'filename.txt';
 * const readStream = bucket.readFile({ filename });
 */
GridFSBucket.prototype.readFile = function readFile(optns) {
  const readstream = this.createReadStream({ ...optns });
  return readstream;
};

/* removers */

/**
 * @function deleteFile
 * @name deleteFile
 * @alias unlink
 * @description Remove an existing file and its chunks.
 * @param {ObjectId} _id The id of the file doc
 * @param {Function} done a callback to invoke on success or error
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 1.0.0
 * @version 0.1.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * bucket.deleteFile(_id, (error, results) => { ... });
 */
GridFSBucket.prototype.deleteFile = function deleteFile(_id, done) {
  this.delete(_id, function afterDelete(error) {
    return done(error, _id);
  });
};

GridFSBucket.prototype.unlink = GridFSBucket.prototype.deleteFile;

/* finders */

/**
 * @function findOne
 * @name findOne
 * @description find an existing file using options provided
 * @param {object} optns valid find criteria
 * @param {Function} done a callback to invoke on success or error
 * @returns {object} existing file details
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 0.1.0
 * @version 0.7.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * bucket.findOne({ _id }, (error, file) => { ... });
 * bucket.findOne({ filename }, (error, file) => { ... });
 */
GridFSBucket.prototype.findOne = function findOne(optns, done) {
  try {
    const cursor = this.find({ ...optns }, { limit: 1 });
    if (!cursor) {
      const error = new Error('Collection not found');
      error.status = 400;
      return done(error);
    }
    return cursor.next(done);
  } catch (error) {
    // catch find errors
    return done(error);
  }
};

/**
 * @function findById
 * @name findById
 * @description find an existing file with given objectid
 * @param {ObjectId} _id valid objectid of the existing file
 * @param {Function} done a callback to invoke on success or error
 * @returns {object} existing file details
 * @author lally elias <lallyelias87@mail.com>
 * @license MIT
 * @since 0.1.0
 * @version 0.7.0
 * @instance
 * @example
 *
 * const bucket = createBucket();
 * bucket.findById(_id, (error, file) => { ... });
 */
GridFSBucket.prototype.findById = function findById(_id, done) {
  return this.findOne({ _id }, done);
};

/* multer */

/**
 * @function _handleFile
 * @name _handleFile
 * @description write file to the bucket and return information on how to
 * access the file in the future
 * @param {object} request injected request from multer
 * @param {object} file injected file object from multer
 * @param {Function} done a callback to invoke on success or error
 * @author lally elias <lallyelias87@mail.com>
 * @see {@link https://github.com/expressjs/multer/blob/master/StorageEngine.md}
 * @since 0.1.0
 * @version 0.5.0
 * @instance
 * @example
 *
 * const express = require('express');
 * const multer  = require('multer');
 * const { createBucket } = require('mongoose-gridfs');
 * const app = express();
 * const storage = createBucket(); // createBucket(optns)
 * const upload = multer({ storage });
 *
 * app.post('/profile', upload.single('avatar'), (req, res, next) => {
 *   // req.file is the `avatar` file
 *   // req.body contains the text fields
 * });
 */
// eslint-disable-next-line no-underscore-dangle
GridFSBucket.prototype._handleFile = function _handleFile(request, file, done) {
  // obtain file readable stream
  const { stream } = file;

  // prepare file details
  const { aliases } = request.body || {};
  const $file = {
    _id: new ObjectId(),
    filename: file.originalname,
    contentType: file.mimetype,
    aliases: aliases ? [].concat(aliases) : aliases,
    metadata: (request.body || {}).metadata,
  };

  // obtain bucket details
  const { bucketName } = this;

  // write file
  this.writeFile($file, stream, function afterHandleFile(error, $$file) {
    if ($$file) {
      // eslint-disable-next-line no-param-reassign
      $$file.size = $$file.size || $$file.length;
      // eslint-disable-next-line no-param-reassign
      $$file.bucketName = bucketName;
    }
    return done(error, $$file);
  });
};

/**
 * @function _removeFile
 * @name _removeFile
 * @description remove existing file from bucket
 * @param {object} request injected request from multer
 * @param {object} file injected file object from multer
 * @param {Function} done a callback to invoke on success or error
 * @returns {object|Error} error or deleted file
 * @author lally elias <lallyelias87@mail.com>
 * @see {@link https://github.com/expressjs/multer/blob/master/StorageEngine.md}
 * @since 0.1.0
 * @version 0.7.0
 * @instance
 * @example
 *
 * const express = require('express');
 * const multer  = require('multer');
 * const { createBucket } = require('mongoose-gridfs');
 * const app = express();
 * const storage = createBucket(); // createBucket(optns)
 * const upload = multer({ storage });
 *
 * app.post('/profile', upload.single('avatar'), (req, res, next) => {
 *   // req.file is the `avatar` file
 *   // req.body contains the text fields
 * });
 */
// eslint-disable-next-line no-underscore-dangle
GridFSBucket.prototype._removeFile = function _removeFile(request, file, done) {
  // remove file
  // eslint-disable-next-line no-underscore-dangle
  if (file._id) {
    // eslint-disable-next-line no-underscore-dangle
    return this.deleteFile(file._id, done);
  }
  // no operation

  return done(null, null);
};

/* statics */

/**
 * @function createBucket
 * @name createBucket
 * @description Create GridFSBucket
 * @param {object} [optns] Optional settings.
 * @param {object} [optns.connection = mongoose.connection] A valid
 * instance of mongoose connection.
 * @param {string} [optns.bucketName="fs"] The 'files' and 'chunks' collections
 * will be prefixed with the bucket name followed by a dot.
 * @param {number} [optns.chunkSizeBytes=255 * 1024] Number of bytes stored in
 * each chunk. Defaults to 255KB
 * @param {object} [optns.writeConcern] Optional write concern to be passed to
 * write operations, for instance `{ w: 1 }`
 * @param {object} [optns.readPreference] Optional read preference to be passed
 * to read operations
 * @returns {object} an instance of `GridFSBucket`
 * @author lally elias <lallyelias87@mail.com>
 * @since 1.0.0
 * @version 0.1.0
 * @public
 * @static
 * @example
 *
 * const bucket = createBucket();
 * const bucket = createBucket({ bucketName });
 * const bucket = createBucket({ buketName, connection });
 */
function createBucket(optns = {}) {
  const { connection, ...rest } = optns;
  const options = {
    ...DEFAULT_BUCKET_OPTIONS,
    ...rest,
  };

  const { db } = connection || mongoose.connection;
  const bucket = new GridFSBucket(db, options);

  return bucket;
}

/**
 * @function createModel
 * @name createModel
 * @description Create GridFSBucket files collection model
 * @param {object} [optns] Optional settings.
 * @param {object} [optns.connection = mongoose.connection] A valid instance
 * of mongoose connection.
 * @param {string} [optns.modelName="File"] Valid model name to use with
 * mongoose
 * @param {string} [optns.bucketName="fs"] The 'files' and 'chunks' collections
 * will be prefixed with the bucket name followed by a dot.
 * @param {number} [optns.chunkSizeBytes=255 * 1024] Number of bytes stored in
 * each chunk. Defaults to 255KB
 * @param {object} [optns.writeConcern] Optional write concern to be passed to
 * write operations, for instance `{ w: 1 }`
 * @param {object} [optns.readPreference] Optional read preference to be passed
 * to read operations
 * @param {...Function} [plugins] list of valid mongoose plugin to apply to
 * file schema
 * @returns {object} an instance of `GridFSBucket`
 * @author lally elias <lallyelias87@mail.com>
 * @since 1.0.0
 * @version 0.2.0
 * @public
 * @static
 * @example
 *
 * const File = createModel(); // => fs.files
 * const Photo = createModel({ modelName }); // => photos.files
 * const Photo = createModel({ modelName, connection }); // => photos.files
 */
function createModel(optns, ...plugins) {
  const { metadataSchema } = optns || {};
  let { connection, modelName, bucketName } = optns || {};
  connection = connection || mongoose.connection;
  modelName = modelName || DEFAULT_BUCKET_MODEL_NAME;

  if (modelName === DEFAULT_BUCKET_MODEL_NAME) {
    bucketName = DEFAULT_BUCKET_NAME;
  } else if (!bucketName && modelName) {
    bucketName = toCollectionName(modelName);
  } else if (!bucketName) {
    bucketName = DEFAULT_BUCKET_NAME;
  }

  const bucket = createBucket({ ...optns, connection, modelName, bucketName });
  const schema = createFileSchema(bucket, { metadataSchema });

  [...plugins].forEach((plugin) => schema.plugin(plugin, schema.options));

  // compile file model
  const fileModel = connection.model(modelName, schema);

  // return model
  return fileModel;
}

/* export GridFSBucket */
export {
  DEFAULT_BUCKET_NAME,
  DEFAULT_BUCKET_MODEL_NAME,
  DEFAULT_BUCKET_CHUNK_SIZE,
  DEFAULT_BUCKET_OPTIONS,
  GridFSBucket,
  createBucket,
  createModel,
};
