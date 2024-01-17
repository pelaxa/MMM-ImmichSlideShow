/* global Module */

/* node_helper.js
 *
 * Magic Mirror
 * Module: MMM-IMMICHSLIDESHOW
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-IMMICHSLIDESHOW By Korey Sedaghatian
 * MIT Licensed.
 */

// call in the required classes
const Log = require('../../js/logger.js');
var NodeHelper = require('node_helper');
const jo = require('jpeg-autorotate');
const axios = require('axios');
const convert = require('heic-convert');
const LOG_PREFIX = 'MMM-ImmichSlideShow :: node_helper :: ';

const API_LEVEL_1_82 = '1.82+';
const API_LEVEL_1 = '1.0+';

// the main module helper create
module.exports = NodeHelper.create({
  
  // Min version of MM2 required
  requiresVersion: "2.1.0",

  // expressInstance: undefined,
  // subclass start method, clears the initial config array
  start: function () {
    this.validImageFileExtensions = new Set();
    // this.expressInstance = this.expressApp;
    this.imageList = 0;
    this.index = 0;
    this.config;
    this.http = null;
    this.pictureDate = 0;
    this.apiLevel = API_LEVEL_1;
  },

  // shuffles an array at random and returns it
  shuffleArray: function (array) {
    for (let i = array.length - 1; i > 0; i--) {
      // j is a random index in [0, i].
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  // sort by filename attribute
  sortByFilename: function (a, b) {
    aL = a.originalFileName.toLowerCase();
    bL = b.originalFileName.toLowerCase();
    if (aL > bL) return 1;
    else return -1;
  },

  // sort by created attribute
  sortByCreated: function (a, b) {
    aL = a.fileCreatedAt;
    bL = b.fileCreatedAt;
    if (aL > bL) return 1;
    else return -1;
  },

  // sort by created attribute
  sortByModified: function (a, b) {
    aL = a.fileModifiedAt;
    bL = b.fileModifiedAt;
    if (aL > bL) return 1;
    else return -1;
  },

  sortImageList: function (imageList, sortBy, sortDescending) {
    Log.info(LOG_PREFIX + 'imageList is Array?', Array.isArray(imageList));
    let sortedList = imageList;
    switch (sortBy) {
      case 'created':
        // Log.log(LOG_PREFIX + 'Sorting by created date...');
        sortedList = imageList.sort(this.sortByCreated);
        break;
      case 'modified':
        // Log.log(LOG_PREFIX + 'Sorting by modified date...');
        sortedList = imageList.sort(this.sortByModified);
        break;
      case 'name':
        // sort by name
        // Log.log(LOG_PREFIX + 'Sorting by name...');
        sortedList = imageList.sort(this.sortByFilename);
        break;
      case 'random':
        // Log.log(LOG_PREFIX + 'Sorting by modified date...');
        sortedList = this.shuffleArray(imageList);
        break;
      default:
        // sort by name
        // Log.log(LOG_PREFIX + 'Sorting by name...');
        sortedList = imageList;
    }

    // If the user chose to sort in descending order then reverse the array
    if (sortDescending === true) {
      // Log.log(LOG_PREFIX + 'Reversing sort order...');
      sortedList = sortedList.reverse();
    }

    return sortedList;
  },

  // checks there's a valid image file extension
  checkValidImageFileExtension: function (filename) {
    if (!filename.includes('.')) {
      // No file extension.
      return false;
    }
    const fileExtension = filename.split('.').pop().toLowerCase();
    return this.validImageFileExtensions.has(fileExtension);
  },

  // gathers the image list
  gatherImageList: async function (config, sendNotification) {
    // Invalid config. retrieve it again
    if (config === undefined) {
      this.sendSocketNotification('IMMICHSLIDESHOW_REGISTER_CONFIG');
      return;
    }

    // create and axis instance
    this.http = axios.create({
      baseURL: config.immichUrl + '/api',
      timeout: 5000,
      headers: {
        'x-api-key': config.apiKey,
        'Accept': 'application/json'
      }
    })
   
    // create an empty main image list
    this.imageList = [];

    // we default albumId to the config value and override below if albumName is provided
    let albumId = config.albumId;

    // Get today's date at midnight
    let today = (new Date());
    this.pictureDate = new Date(today.getTime());


    //determine the server version first
    let serverVersion = {major:1, minor:0, patch:0};
    try{
      Log.info(LOG_PREFIX + 'fetching server version...');
      response = await this.http.get('/server-info/version', {params: {}, responseType: 'json'});
      if (response.status === 200) {
        serverVersion = response.data;
      } else {
        Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
      }
    } catch(e) {
      Log.error(LOG_PREFIX + 'Oops!  Exception while fetching server version', e.message);
    }
    if (serverVersion.major > 1 ||
      (serverVersion.major === 1 && serverVersion.minor >= 82)) {
        this.apiLevel = API_LEVEL_1_82;
    }


    // First check to see what mode we are operating in
    if (config.mode === 'album') {
      // If we have albumName but no albumId, then get the albumId
      if (config.albumName && !config.albumId) {
        try {
          response = await this.http.get('/album', {responseType: 'json'});
          if (response.status === 200) {
            // Loop through the albums to find the right now
            for (let i=0; i < response.data.length; i++) {
              const album = response.data[i];
              Log.info(LOG_PREFIX + `comparing ${album.albumName} to ${config.albumName}`);
              if (album.albumName === config.albumName) {
                Log.info(LOG_PREFIX + 'match found');
                albumId = album.id;
                break;
              }
            }

            if (!albumId) {
              Log.error(LOG_PREFIX + `could not find an album with the provided name (${config.albumName}).  Note that album name is case sensitive`);
            }
          } else {
            Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
          }
        } catch (e) {
          Log.error(LOG_PREFIX + 'Oops!  Exception while fetching albums from Immich', e.message);
        }
      }
      // Only proceed if we have an albumId
      if (albumId) {
        Log.info(LOG_PREFIX + 'fetching pictures from album', albumId);
        // Get the pictures from the album
        try {
          response = await this.http.get(`/album/${albumId}`, {responseType: 'json'});
          if (response.status === 200) {
            this.imageList = [...response.data.assets];
          } else {
            Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
          }
        } catch (e) {
          Log.error(LOG_PREFIX + 'Oops!  Exception while fetching pictures from album ', e.message);
        }
      } else {
        Log.error(LOG_PREFIX + 'could not find the specified album in Immich.  Please check your configuration again');
      }
    } else {
      // Assume we are in memory mode

        
      // Loop through the past 2 weeks and get the memory lanes
      // TODO: Do we keep looping until we reach a max # of photos?
      //       how do we determine max photos? is it fixed or determined based on config settings?
      
      today.setHours(0);
      today.setMinutes(0);
      today.setSeconds(0);
      today.setMilliseconds(0);
      Log.info(LOG_PREFIX + 'numDaysToInclude: ', config.numDaysToInclude);
      for (var i=0; i < config.numDaysToInclude; i++) {
        // as of version 1.82, the API for memory lane has changed.
        let mlParams = {
          timestamp: today.toISOString()
        };
        if (this.apiLevel === API_LEVEL_1_82) {
          mlParams = {
            day: today.getDate(),
            month: today.getMonth()+1
          }
        }
        Log.info(LOG_PREFIX + 'fetching images for: ', today.toISOString());
        try{
          response = await this.http.get('/asset/memory-lane', {params: mlParams, responseType: 'json'});
          // Log.info(LOG_PREFIX + 'response', today.toISOString(), response.data.length);
          if (response.status === 200) {
            response.data.forEach(memory => {
              this.imageList = memory.assets.concat(this.imageList);
              // Log.info(LOG_PREFIX + 'imageList', today.toISOString(), this.imageList.length);
            });
          } else {
            Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
          }
        } catch(e) {
          Log.error(LOG_PREFIX + 'Oops!  Exception while fetching images from Immich', e.message);
        }
        // set to previous date to catch the next date
        today.setDate(today.getDate()-1);
      }

    }

    // Now loop through and remove any movies
    if (this.imageList && this.imageList.length > 0) {
      Log.info('Filtering image list for valid image extensions...');
      this.imageList = this.imageList.filter(element => {
          // Log.info('Filtering element', element);
          return this.checkValidImageFileExtension(element.originalPath);
      });
  }

    // Now sort them according to config
    this.imageList = this.sortImageList(this.imageList, config.sortImagesBy, config.sortImagesDescending);

    Log.info(LOG_PREFIX + this.imageList.length + ' images found');
    if (this.index < 0 || this.index >= this.imageList.length) {
      //Set this index back to zero only if necessary
      this.index = 0;
    }

    // let other modules know about slideshow images
    this.sendSocketNotification('IMMICHSLIDESHOW_FILELIST', {
      imageList: this.imageList
    });

    // build the return payload
    const returnPayload = {
      identifier: config.identifier
    };

    // signal ready
    if (sendNotification) {
      this.sendSocketNotification('IMMICHSLIDESHOW_READY', returnPayload);
    }
  },

  getNextImage: async function (showCurrent = false) {
    Log.info(LOG_PREFIX + 'Current Image: ', this.index + 1, ' of ', this.imageList ? this.imageList.length : 0, '. Getting next image...');
    if (!this.imageList || this.index >= this.imageList.length || Date.now() - this.pictureDate > 86400000) {
        Log.info(LOG_PREFIX + 'image list is empty or index out of range! fetching new image list...');
        // if there are no images or all the images have been displayed or it is the next day, try loading the images again
        await this.gatherImageList(this.config);
    }
    // Log.info(LOG_PREFIX + 'image list', this.imageList.length, this.imageList);
    if (!this.imageList || this.imageList.length === 0) {
      Log.info(LOG_PREFIX + 'image list is empty! setting timeout for next image...');
      // still no images, search again after 5 mins
      setTimeout(() => {
        this.getNextImage(config);
      }, 300000);
      return;
    }

    var image = this.imageList[this.index];
    var self = this;
    if (showCurrent) {
      // Just send the current image
      self.sendSocketNotification(
        'IMMICHSLIDESHOW_DISPLAY_IMAGE',
        this.lastImageLoaded
      );
      return;
    } else {
      // Otherwise increment our counter
      this.index++;
    }
    Log.info(LOG_PREFIX + 'reading image "' + image.originalPath + '"');

    
    this.lastImageLoaded = {
      identifier: self.config.identifier,
      path: image.originalPath,
      exifInfo: image.exifInfo || {},
      people: [],
      data: null,
      imageId: image.id,
      index: self.index,
      total: self.imageList.length
    };

    // If this version is higher than 1.81, then we need to fetch the exifInfo by making an extra request
    if (this.apiLevel === API_LEVEL_1_82) {
      try {
        const exifResponse = await this.http.get(`/asset/assetById/${image.id}`, { responseType: 'json' });
        if (exifResponse.status === 200) {
          this.lastImageLoaded.exifInfo = exifResponse.data.exifInfo;
          this.lastImageLoaded.people = exifResponse.data.people;
        }
      } catch (e) {
        Log.error(LOG_PREFIX + 'Oops!  Exception while fetching image metadata', e.message);
      }
    }
    this.http.get(`/asset/file/${image.id}`, {
      responseType: 'arraybuffer'
    }).then(async(response) => {
      try {
        const imageBuffer = Buffer.from(response.data, 'binary');
        if (image.originalPath.toLowerCase().endsWith('heic')) {
          Log.info(LOG_PREFIX + ' converting HEIC to JPG..');
          // convert the main image to jpeg
          this.lastImageLoaded.data = (await convert({
            buffer: imageBuffer, // the HEIC file buffer
            format: 'JPEG',      // output format
            quality: 1           // the jpeg compression quality, between 0 and 1
          })).toString('base64');
        } else {
          this.lastImageLoaded.data = imageBuffer.toString('base64');
        }

        self.sendSocketNotification(
          'IMMICHSLIDESHOW_DISPLAY_IMAGE',
          this.lastImageLoaded
        );
      } catch (e) {
        Log.error(LOG_PREFIX + 'Oops!  Exception while loading and converting image', e.message);
      }
    }).catch(error => {
      Log.error(LOG_PREFIX + 'Oops!  Exception while loading and converting image', error.message);
    });
    
  },

  getPrevImage: function () {
    // imageIndex is incremented after displaying an image so -2 is needed to
    // get to previous image index.
    this.index -= 2;

    // Case of first image, go to end of array.
    if (this.index < 0) {
      Log.info('Reaching begining of pictures! looping around...')
      this.index = this.imageList.length - this.index;
    }
    this.getNextImage();
  },

  // resizeImage: function (input, callback) {
  //   Jimp.read(input)
  //     .then((image) => {
  //       image
  //         .scaleToFit(
  //           parseInt(this.config.maxWidth),
  //           parseInt(this.config.maxHeight)
  //         )
  //         .getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
  //           callback('data:image/jpg;base64, ' + buffer.toString('base64'));
  //         });
  //     })
  //     .catch((err) => {
  //       Log.log(err);
  //     });
  // },

  resume: function() {
    Log.info(LOG_PREFIX + 'Resume called!');
    if (!this.timer) {
      Log.info(LOG_PREFIX + 'Resuming...', this.config.slideshowSpeed);
      this.getNextImage();
      this.timer = setInterval(() => {
        this.getNextImage();
      }, this.config.slideshowSpeed);
    }
  },

  suspend: function() {
    Log.info(LOG_PREFIX + 'Suspending...');
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function (notification, payload) {
    Log.info(LOG_PREFIX + 'socketNotificationReceived:', notification); //, payload);
    if (notification === 'IMMICHSLIDESHOW_REGISTER_CONFIG') {
      // Log.info(LOG_PREFIX + 'Current config loaded?', !this.config, this.config);
      if (!this.config) { // Only initialize if we have not initialized already
        // Log.info(LOG_PREFIX + 'Initializing config...');
        this.suspend();
        const config = payload;

        // Create set of valid image extensions.
        const validExtensionsList = config.validImageFileExtensions
          .toLowerCase()
          .split(',');
        this.validImageFileExtensions = new Set(validExtensionsList);

        // Get the image list in a non-blocking way since large # of images would cause
        // the MagicMirror startup banner to get stuck sometimes.
        this.config = config;
        setTimeout(() => {
          this.gatherImageList(config, true);
        }, 200);
      } else {
        // Show the current image for now, and then the new client will fall in sync with existing clients
        this.getNextImage(true);
      }
        this.imageList = null;
    } else if (notification === 'IMMICHSLIDESHOW_PLAY_VIDEO') {
      Log.info(
        LOG_PREFIX + 'cmd line:' + 'omxplayer --win 0,0,1920,1080 --alpha 180 ' + payload[0]
      );
      exec(
        'omxplayer --win 0,0,1920,1080 --alpha 180 ' + payload[0],
        (e, stdout, stderr) => {
          this.sendSocketNotification('IMMICHSLIDESHOW_PLAY', null);
          Log.info(LOG_PREFIX + 'mw video done');
        }
      );
    } else if (notification === 'IMMICHSLIDESHOW_NEXT_IMAGE') {
      this.getNextImage();
    } else if (notification === 'IMMICHSLIDESHOW_PREV_IMAGE') {
      this.getPrevImage();
    } else if (notification === 'IMMICHSLIDESHOW_RESUME') {
      // Resume
      this.resume();
    } else if (notification === 'IMMICHSLIDESHOW_SUSPEND') {
      // Suspend
      this.suspend();
    } else if (!notification.startsWith('IMMICHSLIDESHOW')) {
      Log.info(LOG_PREFIX + 'Notification is unexpected and not handled!');
    }
      payload = null;

    Log.info(LOG_PREFIX + 'Notification Processed!');
  }
});

//------------ end -------------
