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
// const Log = console;
const Log = require('logger');
const NodeHelper = require('node_helper');
const axios = require('axios');
const immichApi = require('./immichApi.js');
const LOG_PREFIX = 'MMM-ImmichSlideShow :: node_helper :: ';

// the main module helper create
module.exports = NodeHelper.create({
  
  // Min version of MM2 required
  requiresVersion: "2.1.0",

  // expressInstance: undefined,
  // subclass start method, clears the initial config array
  start: function () {
    this.validImageFileExtensions = new Set();
    // this.expressInstance = this.expressApp;
    this.imageList = [];
    this.index = 0;
    Log.debug(LOG_PREFIX + 'initialized index to zero!' + this.index);
    this.config;
    this.pictureDate = 0;
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

  // sort by created attribute
  sortByTaken: function (a, b) {
    aL = a.exifInfo?.dateTimeOriginal || a.fileCreatedAt;
    bL = b.exifInfo?.dateTimeOriginal || b.fileCreatedAt;
    if (aL > bL) return 1;
    else return -1;
  },

  sortImageList: function (imageList, sortBy, sortDescending) {
    Log.debug(LOG_PREFIX + 'sortImageList :: imageList is Array?', Array.isArray(imageList), sortBy, sortDescending);
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
      case 'taken':
        // Log.log(LOG_PREFIX + 'Sorting by taken date...');
        sortedList = imageList.sort(this.sortByTaken);
        break;
      case 'name':
        // sort by name
        // Log.log(LOG_PREFIX + 'Sorting by name...');
        sortedList = imageList.sort(this.sortByFilename);
        break;
      case 'random':
        // Log.log(LOG_PREFIX + 'Randomizing image list...');
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
  gatherImageList: async function (config, isActiveConfigChange) {
    // Invalid config. retrieve it again
    if (config === undefined) {
      this.sendSocketNotification('IMMICHSLIDESHOW_REGISTER_CONFIG');
      return;
    }
    Log.debug(LOG_PREFIX + 'GOT new active config', this.config.activeImmichConfig);
    await immichApi.init(config.activeImmichConfig, this.expressApp, isActiveConfigChange);
   
    // create an empty main image list
    this.imageList = [];

    // we default albumId to the config value and override below if albumName is provided
    let albumIds = config.activeImmichConfig.albumId;

    // Get today's date at midnight
    let today = (new Date());
    this.pictureDate = new Date(today.getTime());

    // First check to see what mode we are operating in
    if (config.activeImmichConfig.mode === 'album') {
      // If we have albumName but no albumId, then get the albumId
      if (config.activeImmichConfig.albumName && !config.activeImmichConfig.albumId) {
        let albumNames = config.activeImmichConfig.albumName;
        albumNames = Array.isArray(albumNames) ? albumNames : [].concat(albumNames);
        albumIds = await immichApi.findAlbumIds(albumNames);
      }
      // Only proceed if we have an albumId
      if (albumIds) {
        albumIds = Array.isArray(albumIds) ? albumIds : [].concat(albumIds);
        Log.debug(LOG_PREFIX + 'fetching pictures from albums', albumIds);
        // Get the pictures from the album
        this.imageList = await immichApi.getAlbumAssetsForAlbumIds(albumIds);
      } else {
        Log.error(LOG_PREFIX + 'could not find any of the specified album(s) in Immich.  Please check your configuration again');
      }
    } else if (config.activeImmichConfig.mode === 'search') {
      // Search mode
      this.imageList = await immichApi.searchAssets(config.activeImmichConfig.query, config.activeImmichConfig.querySize);
    } else if (config.activeImmichConfig.mode === 'random') {
      // Random mode
      this.imageList = await immichApi.randomSearchAssets(
        config.activeImmichConfig.querySize || 100, 
        config.activeImmichConfig.query || null
      );
    } else {
      // Assume we are in memory mode
      this.imageList = await immichApi.getMemoryLaneAssets(config.activeImmichConfig.numDaysToInclude);
    }

    // Now loop through and remove any movies
    if (this.imageList.length > 0) {
      // Filter the image list
      Log.debug(LOG_PREFIX + 'Filtering image list for valid image extensions...');
      this.imageList = this.imageList.filter(element => {
        // Log.debug(LOG_PREFIX + 'Filtering element', element);
        return this.checkValidImageFileExtension(element.originalPath);
      });

      // Now sort them according to config
      this.imageList = this.sortImageList(this.imageList, config.activeImmichConfig.sortImagesBy, config.activeImmichConfig.sortImagesDescending);

      Log.debug(LOG_PREFIX + this.imageList.length + ' images found');
      if (this.index < 0 || this.index >= this.imageList.length) {
        //Set this index back to zero only if necessary
        Log.debug(LOG_PREFIX + 'index is out of bounds, setting to zero (gatherImageList)...' + this.index+ '/' + this.imageList.length)
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
      this.sendSocketNotification('IMMICHSLIDESHOW_READY', returnPayload);
    }
  },

  displayImage: async function(showCurrent = false) {
    Log.debug(LOG_PREFIX + 'displayImage called. Show current?', showCurrent, this.lastImageLoaded ? 'last image is in memory' : 'last image is not in memory');
    
    // If we are not showing the current image, then fetch the next one.
    if (!(showCurrent && this.lastImageLoaded)) {
      
      // if there are no images or all the images have been displayed or it is the next day, try loading the images again
      if (!this.imageList.length || this.index >= this.imageList.length || Date.now() - this.pictureDate > 86400000) {
        Log.debug(LOG_PREFIX + 'image list is empty or index out of range or list too old!  fetching new image list...');
        // Force the index to 0 so that we start from the beginning
        // and calling this function again will not get stuck in a loop
        if (this.index >= this.imageList.length) {
          Log.debug(LOG_PREFIX + 'index is out of bounds.  Setting to zero (displayImage)...' + this.index+ '/' + this.imageList.length);
          this.index = 0;
        }
        // Set the last Image to null so we cannot load it and have to progress
        this.lastImageLoaded = null;
        this.gatherImageList(this.config);
        return;
      }

      // If still do not have images, just call this function in 5 min
      if (!this.imageList.length) {
        Log.debug(LOG_PREFIX + 'image list is empty!  setting timeout for next image...');
        // still no images, search again after 5 mins
        setTimeout(() => {
          this.displayImage();
        }, 300000);
        return;
      }

      let image = this.imageList[this.index];

      Log.debug(LOG_PREFIX + 'reading image "' + image.originalPath + '"');
      
      this.lastImageLoaded = {
        identifier: this.config.identifier,
        path: image.originalPath,
        exifInfo: image.exifInfo || {},
        people: [],
        data: null,
        imageId: image.id,
        index: this.index+1, // Index is zero based
        total: this.imageList.length,
        albumName: image.albumName
      };

      // If there is no exif info available, or if we need people but no people are listed
      // then fetch it with a separate call based on the API version
      if (!image.exifInfo || image.exifInfo.length == 0 || 
        (this.config.activeImmichConfig.imageInfo.includes('people') || this.config.activeImmichConfig.imageInfo.includes('people_skip')) && (!image.people || image.people.length == 0)) {
        const assetInfo = await immichApi.getAssetInfo(image.id);
        if (assetInfo) {
          this.lastImageLoaded.exifInfo = assetInfo.exifInfo;
          this.lastImageLoaded.people = assetInfo.people;
        }
      }
      // this.lastImageLoaded.data = await immichApi.getBase64EncodedAsset(image.id);
      this.lastImageLoaded.data = immichApi.getImageLink(image.id);
    }

    // Only send a notification if we have the new image loaded
    if (this.lastImageLoaded.data) {
      this.sendSocketNotification(
        'IMMICHSLIDESHOW_DISPLAY_IMAGE',
        this.lastImageLoaded
      );
    }
  },

  getNextImage: function (showCurrent = false, reloadOnLoop = false) {
    Log.debug(LOG_PREFIX + 'Current Image: ', this.index+1, ' of ', this.imageList.length, '. Getting next image...', showCurrent, reloadOnLoop);
    
    if (!showCurrent) {
      this.index++;
      // reloadOnLoop is only set when the pictures progress naturally, not when
      // next command is received
      if (this.index >= this.imageList.length) {
        Log.debug(LOG_PREFIX + 'Reached end of image list');

        if (!reloadOnLoop) {
          Log.debug(LOG_PREFIX + 'Resetting image index(getNextImage)...' + this.index+ '/' + this.imageList.length);
          this.index = 0;
        }
        
        // Check if cyclic configs is enabled and we have more than one config
        if (reloadOnLoop && this.config.cyclicConfigs === true && this.config.immichConfigs.length > 1) {
          Log.debug(LOG_PREFIX + 'Cycling to next config');
          
          // Increment the active config index, with wrapping
          let nextConfigIndex = (this.config.activeImmichConfigIndex + 1) % this.config.immichConfigs.length;
          
          // Update the config
          this.config.activeImmichConfigIndex = nextConfigIndex;
          this.config.activeImmichConfig = this.config.immichConfigs[nextConfigIndex];
          
          // Reset index to start from the beginning of the next album
          this.index = 0;
          
          // Notify the frontend module that we've cycled to a new config
          this.sendSocketNotification('IMMICHSLIDESHOW_CONFIG_CHANGED', {
            identifier: this.config.identifier,
            configIndex: nextConfigIndex
          });
          
          // Change active config and load new images
          this.changeActiveConfig(this.config);
          return;
        }
      }
    }
    this.displayImage();
  },

  getPrevImage: function () {
    Log.debug('Moving to previous image', this.index, this.imageList.length);
    // get to previous image index.
    this.index--;

    // Case of first image, go to end of array.
    if (this.index < 0) {
      Log.debug(LOG_PREFIX + 'Reaching beginning of pictures! looping around (getPrevImage)...' + this.index+ '/' + this.imageList.length)
      this.index = this.imageList.length-1;
    }
    this.displayImage();
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
    Log.debug(LOG_PREFIX + 'Resume called!');
    if (!this.timer) {
      Log.debug(LOG_PREFIX + 'Resuming...', this.config.activeImmichConfig.slideshowSpeed);
      this.timer = setInterval(() => {
        this.getNextImage(false, true);
      }, this.config.activeImmichConfig.slideshowSpeed);
    }
    this.displayImage(true);
  },

  suspend: function() {
    Log.debug(LOG_PREFIX + 'Suspending...');
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function (notification, payload) {
    Log.debug(LOG_PREFIX + 'socketNotificationReceived:', notification); //, payload);
    if (notification === 'IMMICHSLIDESHOW_REGISTER_CONFIG') {
      const isActiveConfigChange = !!this.config && this.config.activeImmichConfigIndex !== payload.activeImmichConfigIndex;
      
      if (!this.config || isActiveConfigChange) { // Only initialize if we have not initialized already
        // Log.debug(LOG_PREFIX + 'Initializing config...');
        this.suspend();
        const config = payload;

        // Create set of valid image extensions.
        const validExtensionsList = config.validImageFileExtensions
          .toLowerCase()
          .split(',');
        this.validImageFileExtensions = new Set(validExtensionsList);

        // Keep a copy of our config
        this.config = config;

        // Get the image list in a non-blocking way since large # of images would cause
        // the MagicMirror startup banner to get stuck sometimes.
        setTimeout(() => {
          if (isActiveConfigChange) {
            this.changeActiveConfig(config);
          } else {
            this.gatherImageList(config, false);
          }
        }, 200);
      } else {
        // Show the current image for now, and then the new client will fall in sync with existing clients
        this.getNextImage(true);
      }
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
      Log.debug(LOG_PREFIX + 'Notification is unexpected and not handled!');
    }
    Log.debug(LOG_PREFIX + 'Notification Processed!');
  },

  changeActiveConfig: async function(config) {
    this.lastImageLoaded = true;
    await this.gatherImageList(config, true);
    this.displayImage();
  }
});

//------------ end -------------
