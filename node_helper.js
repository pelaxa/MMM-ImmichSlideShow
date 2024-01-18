/* global Module */

const Log = require('../../js/logger.js');
const NodeHelper = require('node_helper');
const axios = require('axios');
const convert = require('heic-convert');

const LOG_PREFIX = 'MMM-ImmichSlideShow :: node_helper :: ';
const API_LEVEL_1_82 = '1.82+';
const API_LEVEL_1 = '1.0+';

module.exports = NodeHelper.create({
  requiresVersion: '2.1.0',

  start() {
    this.validImageFileExtensions = new Set();
    this.imageList = [];
    this.index = 0;
    this.config = null;
    this.http = null;
    this.pictureDate = 0;
    this.apiLevel = API_LEVEL_1;
  },

  shuffleArray(array) {
    array.forEach((_, i) => {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    });
    return array;
  },

  sortByFilename(a, b) {
    return a.originalFileName.toLowerCase() > b.originalFileName.toLowerCase() ? 1 : -1;
  },

  sortByCreated(a, b) {
    return a.fileCreatedAt > b.fileCreatedAt ? 1 : -1;
  },

  sortByModified(a, b) {
    return a.fileModifiedAt > b.fileModifiedAt ? 1 : -1;
  },

  sortImageList(imageList, sortBy, sortDescending) {
    let sortedList = imageList;

    switch (sortBy) {
      case 'created':
        sortedList = imageList.sort(this.sortByCreated);
        break;
      case 'modified':
        sortedList = imageList.sort(this.sortByModified);
        break;
      case 'name':
        sortedList = imageList.sort(this.sortByFilename);
        break;
      case 'random':
        sortedList = this.shuffleArray(imageList);
        break;
      default:
        sortedList = imageList;
    }

    if (sortDescending === true) {
      sortedList = sortedList.reverse();
    }

    return sortedList;
  },

  checkValidImageFileExtension(filename) {
    if (!filename.includes('.')) {
      return false;
    }
    const fileExtension = filename.split('.').pop().toLowerCase();
    return this.validImageFileExtensions.has(fileExtension);
  },

  async gatherImageList(config, sendNotification) {
    if (!config) {
      this.sendSocketNotification('IMMICHSLIDESHOW_REGISTER_CONFIG');
      return;
    }

    this.http = axios.create({
      baseURL: config.immichUrl + '/api',
      timeout: 5000,
      headers: {
        'x-api-key': config.apiKey,
        'Accept': 'application/json'
      }
    });

    this.imageList = [];
    let albumId = config.albumId;
    let today = new Date();
    this.pictureDate = new Date(today.getTime());

    let serverVersion = { major: 1, minor: 0, patch: 0 };

    try {
      Log.info(LOG_PREFIX + ' fetching server version...');
      const response = await this.http.get('/server-info/version', { params: {}, responseType: 'json' });

      if (response.status === 200) {
        serverVersion = response.data;
      } else {
        Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
      }
    } catch (e) {
      Log.error(LOG_PREFIX + 'Oops! Exception while fetching server version', e.message);
    }

    this.apiLevel = (serverVersion.major > 1 || (serverVersion.major === 1 && serverVersion.minor >= 82)) ? API_LEVEL_1_82 : API_LEVEL_1;

    if (config.mode === 'album') {
      if (config.albumName && !config.albumId) {
        try {
          const response = await this.http.get('/album', { responseType: 'json' });

          if (response.status === 200) {
            const matchingAlbum = response.data.find(album => album.albumName === config.albumName);

            if (matchingAlbum) {
              albumId = matchingAlbum.id;
            } else {
              Log.error(LOG_PREFIX + 'could not find an album with the provided name (${config.albumName}).  Note that album name is case sensitive');
            }
          } else {
            Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
          }
        } catch (e) {
          Log.error(LOG_PREFIX + 'Oops! Exception while fetching albums from Immich', e.message);
        }
      }

      if (albumId) {
        try {
          const response = await this.http.get('/album/' + albumId, { responseType: 'json' });

          if (response.status === 200) {
            this.imageList = [...response.data.assets];
          } else {
            Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
          }
        } catch (e) {
          Log.error(LOG_PREFIX + 'Oops! Exception while fetching pictures from album ', e.message);
        }
      } else {
        Log.error(LOG_PREFIX + 'could not find the specified album in Immich. Please check your configuration again');
      }
    } else { // Assume we are in memory mode
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < config.numDaysToInclude; i++) {
        const mlParams = this.apiLevel === API_LEVEL_1_82
          ? { day: today.getDate(), month: today.getMonth() + 1 }
          : { timestamp: today.toISOString() };
      
        try {
          const response = await this.http.get('/asset/memory-lane', { params: mlParams, responseType: 'json' });
      
          if (response.status === 200) {
            this.imageList = this.imageList.concat(...response.data.map(memory => memory.assets));
          } else {
            Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
          }
        } catch (e) {
          Log.error(LOG_PREFIX + 'Oops! Exception while fetching images from Immich', e.message);
        }

        // set to previous date to catch the next date
        today.setDate(today.getDate() - 1);
      }
    }

    if (this.imageList && this.imageList.length > 0) {
      Log.info('Filtering image list for valid image extensions...');
      this.imageList = this.imageList.filter(element => this.checkValidImageFileExtension(element.originalPath));
    }

    this.imageList = this.sortImageList(this.imageList, config.sortImagesBy, config.sortImagesDescending);
    Log.info(LOG_PREFIX + this.imageList.length + ' images found');

    this.index = (this.index < 0 || this.index >= this.imageList.length) ? 0 : this.index;

    // Let other modules know about slideshow images
    this.sendSocketNotification('IMMICHSLIDESHOW_FILELIST', {
      imageList: this.imageList
    });

    const returnPayload = {
      identifier: config.identifier
    };

    if (sendNotification) {
      this.sendSocketNotification('IMMICHSLIDESHOW_READY', returnPayload);
    }
  },

  async getNextImage(showCurrent) {
    Log.info(LOG_PREFIX + 'Current Image: ', this.index + 1, ' of ', this.imageList ? this.imageList.length : 0, '. Getting next image...');

    if (!this.imageList || this.index >= this.imageList.length || Date.now() - this.pictureDate > 86400000) {
      Log.info(LOG_PREFIX + 'image list is empty or index out of range! fetching new image list...');
      await this.gatherImageList(this.config);
    }

    if (!this.imageList || this.imageList.length === 0) {
      Log.info(LOG_PREFIX + 'image list is empty! setting timeout for next image...');
      setTimeout(() => this.getNextImage(this.config), 300000);
      return;
    }

    const image = this.imageList[this.index];
    const self = this;

    if (showCurrent) {
      self.sendSocketNotification('IMMICHSLIDESHOW_DISPLAY_IMAGE', this.lastImageLoaded);
      return;
    } 
    this.index++;
    
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
        Log.error(LOG_PREFIX + 'Oops! Exception while fetching image metadata', e.message);
      }
    }

    try {
      const response = await this.http.get('/asset/file/' + image.id, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data, 'binary');

      if (image.originalPath.toLowerCase().endsWith('heic')) {
        Log.info(LOG_PREFIX + ' converting HEIC to JPG..');

        this.lastImageLoaded.data = (await convert({
          buffer: imageBuffer,
          format: 'JPEG',
          quality: 1
        })).toString('base64');
      } else {
        this.lastImageLoaded.data = imageBuffer.toString('base64');
      }

      self.sendSocketNotification('IMMICHSLIDESHOW_DISPLAY_IMAGE', this.lastImageLoaded);
    } catch (e) {
      Log.error(LOG_PREFIX + 'Oops! Exception while loading and converting image', e.message);
    }
  },

  getPrevImage() {
    this.index -= 2;

    if (this.index < 0) {
      Log.info('Reaching beginning of pictures! looping around...');
      this.index = this.imageList.length - this.index;
    }
    this.getNextImage(false);
  },

  resume() {
    if (!this.timer) {
      Log.info(LOG_PREFIX + 'Resuming...', this.config.slideshowSpeed);
      this.getNextImage(false);
      this.timer = setInterval(() => {
        this.getNextImage(false);
      }, this.config.slideshowSpeed);
    }
  },

  suspend() {
    Log.info(LOG_PREFIX + 'Suspending...');
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  socketNotificationReceived(notification, payload) {
    Log.info(LOG_PREFIX + 'socketNotificationReceived:', notification);

    if (notification === 'IMMICHSLIDESHOW_REGISTER_CONFIG') {
      if (!this.config) {
        this.suspend();
        const config = payload;

        const validExtensionsList = config.validImageFileExtensions.toLowerCase().split(',');
        this.validImageFileExtensions = new Set(validExtensionsList);

        this.config = config;
        setTimeout(() => this.gatherImageList(config, true), 200);
      } else {
        this.getNextImage(true);
      }
      this.imageList = null;
    } else if (notification === 'IMMICHSLIDESHOW_PLAY_VIDEO') {
      Log.info(LOG_PREFIX + 'cmd line:' + 'omxplayer --win 0,0,1920,1080 --alpha 180 ' + payload[0]);
      exec(
        'omxplayer --win 0,0,1920,1080 --alpha 180 ' + payload[0],
        (e, stdout, stderr) => {
          this.sendSocketNotification('IMMICHSLIDESHOW_PLAY', null);
          Log.info(LOG_PREFIX + 'mw video done');
        }
      );
    } else if (notification === 'IMMICHSLIDESHOW_NEXT_IMAGE') {
      this.getNextImage(false);
    } else if (notification === 'IMMICHSLIDESHOW_PREV_IMAGE') {
      this.getPrevImage();
    } else if (notification === 'IMMICHSLIDESHOW_RESUME') {
      this.resume();
    } else if (notification === 'IMMICHSLIDESHOW_SUSPEND') {
      this.suspend();
    } else if (!notification.startsWith('IMMICHSLIDESHOW')) {
      Log.info(LOG_PREFIX + 'Notification is unexpected and not handled!');
    }

    payload = null;
    Log.info(LOG_PREFIX + 'Notification Processed!');
  }
});