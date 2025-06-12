/* global Module */

/* MMM-ImmichSlideShow.js
 *
 * Magic Mirror
 * Module: MMM-ImmichSlideShow
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-Slideshow By Darick Carpenter
 * MIT Licensed.
 */
// const Log = console;
const LOG_PREFIX = 'MMM-ImmichSlideShow :: module :: ';
const MODE_MEMORY = 'memory';
const MODE_ALBUM = 'album';
const MODE_SEARCH = 'search';
const DEFAULT_DATE_FORMAT = 'dddd MMMM D, YYYY HH:mm';

Module.register('MMM-ImmichSlideShow', {
  // Min version of MM2 required
  requiresVersion: "2.1.0",

  defaultConfig: {
    name: 'recents',
    // Mode of operation: 
    //    memory = show recent photos.  requires numDaystoInclude
    //    album = show picture from album.  requires albumId/albumName
    mode: MODE_MEMORY,
    // an Immich API key to be able to access Immich
    apiKey: 'provide your API KEY',
    // Base Immich URL.  /api will be appended to this URL to make API calls.
    url: 'provide your base Immich URL',
    // The amount of timeout for immich API calls
    timeout: 6000,
    // Number of days to include images for, including today
    numDaysToInclude: 7,
    // The ID of the album to display
    albumId: null,
    // The Name of the album to display
    albumName: null,
    // When mode is search, we need to query for something
    query: null,
    // How many images to bring back when searching (between 1 and 1000)
    querySize: 100,
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 15 * 1000,
    // how to sort images: name, random, created, modified, taken, none
    sortImagesBy: 'none',
    // whether to sort in ascending (default) or descending order
    sortImagesDescending: false,
    // a comma separated list of values to display: name, date, since, geo
    imageInfo: ['date', 'since', 'count'],
    // the date format to use for imageInfo
    dateFormat: DEFAULT_DATE_FORMAT
  },

  // Default module config.
  defaults: {
    immichConfigs: [],
    activeImmichConfigIndex: 0,
    // list of valid file extensions, separated by commas
    validImageFileExtensions: 'bmp,jpg,jpeg,gif,png,heic',
    // show a panel containing information about the image currently displayed.
    showImageInfo: false,
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
    // remove the file extension from image name
    imageInfoNoFileExt: false,
    // show a progress bar indicating how long till the next image is displayed.
    showProgressBar: false,
    // the color of the background when the image does not take up the full screen
    backgroundColor: '#000', // can also be rbga(x,y,z,alpha)
    // the filter to apply to the background.  Useful to give the background a translucent effect
    backdropFilter: 'blur(15px)',
    // the sizing of the background image
    // cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges
    // contain: Resize the background image to make sure the image is fully visible
    backgroundSize: 'cover', // cover or contain
    // if backgroundSize contain, determine where to zoom the picture. Towards top, center or bottom
    backgroundPosition: 'center', // Most useful options: "top" or "center" or "bottom"
    // Whether to scroll larger pictures rather than cut them off
    backgroundAnimationEnabled: false,
    // How long the scrolling animation should take - if this is more than slideshowSpeed, then images do not scroll fully.
    // If it is too fast, then the image may appear jittery. For best result, by default we match this to slideshowSpeed.
    // For now, it is not documented and will default to match slideshowSpeed.
    backgroundAnimationDuration: '1s',
    // How many times to loop the scrolling back and forth.  If the value is set to anything other than infinite, the
    // scrolling will stop at some point since we reuse the same div1.
    // For now, it is not documented and is defaulted to infinite.
    backgroundAnimationLoopCount: 'infinite',
    // transition from one image to the other (may be a bit choppy on slower devices, or if the images are too big)
    transitionImages: false,
    // transition speed from one image to the other, transitionImages must be true
    transitionSpeed: '2s',
    // Transitions to use
    transitions: [
      'opacity',
      'slideFromRight',
      'slideFromLeft',
      'slideFromTop',
      'slideFromBottom',
      'slideFromTopLeft',
      'slideFromTopRight',
      'slideFromBottomLeft',
      'slideFromBottomRight',
      'flipX',
      'flipY'
    ],
    transitionTimingFunction: 'cubic-bezier(.17,.67,.35,.96)',
    animations: ['slide', 'zoomOut', 'zoomIn'],
    showBlurredImageForBlackBars: false
  },

  // load function
  start: function () {
    Log.debug(
      LOG_PREFIX + 'starting...'
    );
    // add identifier to the config
    this.config.identifier = this.identifier;
    // commented out since this was not doing anything
    // set no error
    // this.errorMessage = null;

    Log.debug(LOG_PREFIX + 'current config', this.config);
    Log.debug(LOG_PREFIX + 'immichConfigs', this.config.immichConfigs);
    
    // Make sure we have at least one immich config
    if (this.config.immichUrl || this.config.apiKey) {
      // This is the old config so try and creat a default config using the old values
      Log.warn(
        LOG_PREFIX + 'You are using the old configuration format which is depricated and will not be supported in the furture.  Please update your configuration!'
      );
      this.showLegacyNotification = true;

      // setTimeout( () => {
      //   this.sendNotification('SHOW_ALERT', {
      //     type: 'notification',
      //     title: 'MMM-ImmichSlideShow: Out of date configuration',
      //     message: 'You are using the old configuration format which is depricated and will not be supported in the furture.  Please update your configuration!',
      //   });
      // }, 10000);

      this.config.immichConfigs = [
        {
          name: 'AUTO_GENERATED_LEGACY',
          mode: this.config.mode || this.defaultConfig.mode,
          apiKey: this.config.apiKey || this.defaultConfig.apiKey,
          url: this.config.immichUrl || this.defaultConfig.url,
          timeout: this.config.immichTimeout || this.defaultConfig.timeout,
          numDaysToInclude: this.config.numDaysToInclude || this.defaultConfig.numDaysToInclude,
          albumId: this.config.albumId || this.defaultConfig.albumId,
          albumName: this.config.albumName || this.defaultConfig.albumName,
          slideshowSpeed: this.config.slideshowSpeed || this.defaultConfig.slideshowSpeed,
          sortImagesBy: this.config.sortImagesBy || this.defaultConfig.sortImagesBy,
          sortImagesDescending: this.config.sortImagesDescending || this.defaultConfig.sortImagesDescending,
          imageInfo: this.config.imageInfo || this.defaultConfig.imageInfo,
        }
      ]
    } else {
      this.config.immichConfigs[0] = {...this.defaultConfig,...this.config.immichConfigs[0]};
    }

    // Now loop through and make sure that all configs have all properties by copying from the 
    // first config and overriding with the new config
    this.config.immichConfigs.forEach((element,idx) => {
      // If the entry does not have a dateFormat specified, set it to default
      if (!element.hasOwnProperty('dateFormat')) {
        element.dateFormat = DEFAULT_DATE_FORMAT;
      }
      this.config.immichConfigs[idx] = {...this.config.immichConfigs[0],...element};
      const curConfig = this.config.immichConfigs[idx];
      //validate immich properties
      if (curConfig.mode && curConfig.mode.trim().toLowerCase() === MODE_MEMORY) {
        curConfig.mode = MODE_MEMORY
        // Make sure we have numDaysToInclude
        if (!curConfig.numDaysToInclude || isNaN(curConfig.numDaysToInclude) || curConfig.numDaysToInclude < 1) {
          Log.warn(
            LOG_PREFIX + 'config ' + idx + ': memory mode set, but numDaysToInclude does not have a valid value'
          );
          curConfig.numDaysToInclude = this.defaultConfig.numDaysToInclude;
        } else if (curConfig.numDaysToInclude > 14) {
          Log.warn(
            LOG_PREFIX + 'config ' + idx + ': numDaysToInclude cannot exceet 14 days for memory mode'
          );
          curConfig.numDaysToInclude = 14;
        }
      } else if (curConfig.mode && curConfig.mode.trim().toLowerCase() === MODE_ALBUM) {
        curConfig.mode = MODE_ALBUM
        // Make sure we have album name or album id
        if ((!curConfig.albumId || curConfig.albumId.length === 0) && (!curConfig.albumName || curConfig.albumName.length === 0)) {
          Log.warn(
            LOG_PREFIX + 'config ' + idx + ': album mode set, but albumId or albumName do not have a valid value'
          );
        } else if (curConfig.albumId && curConfig.albumName) {
          Log.warn(
            LOG_PREFIX + 'config ' + idx + ': album mode set, but albumId or albumName do not have a valid value'
          );
          // This is a double check to make sure we only present one of these properties to
          // node_helper
          if (curConfig.albumId) {
            curConfig.albumName = null;
          } else {
            curConfig.albumId = null;
          }
        }
      } else if (curConfig.mode && curConfig.mode.trim().toLowerCase() === MODE_SEARCH) {
        curConfig.mode = MODE_SEARCH
        // Make sure we have album name or album id
        if (!curConfig.query || typeof curConfig.query !== 'Object') {
          Log.warn(
            LOG_PREFIX + 'config ' + idx + ': search mode set, but query not provided or set incorrectly'
          );
        } else if (!isNaN(curConfig.querySize) || curConfig.querySize < 1 || curConfig.querySize > 1000) {
          Log.warn(
            LOG_PREFIX + 'config ' + idx + ': search mode set, but querySize must be between 1 and 1000'
          );
          curConfig.querySize = this.defaultConfig.querySize;
        }
      } else {
        Log.warn(
          LOG_PREFIX + 'config ' + idx + ': memory mode not set to valid value, assuming memory mode...'
        );
      }
      
      // ensure image order is in lower case
      this.config.immichConfigs[idx].sortImagesBy = this.config.immichConfigs[idx].sortImagesBy.toLowerCase();
      // Make sure to process imageInfo for all entries
      if (element.imageInfo) {
        this.config.immichConfigs[idx].imageInfo = this.fixImageInfo(element.imageInfo, idx)
      }
    });

    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();

    // Create the activeConfig
    if (this.config.activeImmichConfigIndex < 0) {
      this.config.activeImmichConfigIndex = 0;
    }
    this.config.activeImmichConfig = this.config.immichConfigs[this.config.activeImmichConfigIndex < this.config.immichConfigs.length ? this.config.activeImmichConfigIndex : 0];

    if (!this.config.transitionImages) {
      this.config.transitionSpeed = '0';
    }

    // Lets make sure the backgroundAnimation duration matches the slideShowSpeed unless it has been
    // overridden
    if (this.config.backgroundAnimationDuration === '1s') {
      this.config.backgroundAnimationDuration =
        this.config.activeImmichConfig.slideshowSpeed / 1000 + 's';
    }

    // Chrome versions < 81 do not support EXIF orientation natively. A CSS transformation
    // needs to be applied for the image to display correctly - see http://crbug.com/158753 .
    this.browserSupportsExifOrientationNatively = CSS.supports(
      'image-orientation: from-image'
    );
  },

  getScripts: function () {
    return [
      'moment.js'
    ];
  },

  getStyles: function () {
    // the css contains the make grayscale code
    return ['immichSlideShow.css'];
  },

  // generic notification handler
  notificationReceived: function (notification, payload, sender) {
    Log.debug(LOG_PREFIX + 'notificationReceived', notification, ' || Payload: ', (payload ? JSON.stringify(payload) : '<undefined>'), ' || Sender: ', sender);

    if (notification === 'DOM_OBJECTS_CREATED') {
      Log.debug(LOG_PREFIX + 'Sending register API notification for ' + this.name);
      const actions = {
        showNext: {
          method: 'GET',
          notification: "IMMICHSLIDESHOW_NEXT",
          prettyName: 'Show next picture'
        },
        showPrevisous: {
          method: 'GET',
          notification: "IMMICHSLIDESHOW_PREVIOUS",
          prettyName: 'Show previous picture'
        },
        pause: {
          method: 'GET',
          notification: "IMMICHSLIDESHOW_PAUSE",
          prettyName: 'Pause slide show'
        },
        resume: {
          method: 'GET',
          notification: "IMMICHSLIDESHOW_RESUME",
          prettyName: 'Resume slide show'
        }
      };
      this.config.immichConfigs.forEach((config, idx) => {
        actions[`setConfigIndex${idx}`] = {
          method: 'POST',
          notification: "IMMICHSLIDESHOW_SET_ACTIVE_CONFIG",
          payload: {data: idx},
          prettyName: `Make config ${idx} active`
        }
      });

      // Add our own definition
      this.sendNotification('REGISTER_API', {
        module: this.name,
        path: this.name.substring(4).toLowerCase(),
        actions: actions
      }); 
    //  } else if (notification === 'IMMICHSLIDESHOW_UPDATE_IMAGE_LIST') {
    //   this.suspend();
    //   this.updateImageList();
    //   this.updateImage();
    //   // Restart timer only if timer was already running
    //   this.resume();
    // } else if (notification === 'IMMICHSLIDESHOW_IMAGE_UPDATE') {
    //   Log.debug(LOG_PREFIX + 'Changing Background');
    //   this.suspend();
    //   // this.updateImage();
    //   this.resume();
    } else if (notification === 'IMMICHSLIDESHOW_NEXT') {
      this.suspend();
      // Change to next image
      this.updateImage();
      // Restart timer only if timer was already running
      this.resume();
    } else if (notification === 'IMMICHSLIDESHOW_PREVIOUS') {
      this.suspend();
      // Change to previous image
      this.updateImage(/* skipToPrevious= */ true);
      // Restart timer only if timer was already running
      this.resume();
    } else if (notification === 'IMMICHSLIDESHOW_RESUME') {
     this.resume();
    } else if (notification === 'IMMICHSLIDESHOW_PAUSE') {
      this.suspend();
    } else if (notification === 'IMMICHSLIDESHOW_SET_ACTIVE_CONFIG') {
      // Update config in backend
      this.setActiveConfig(payload.data);
    } else if (notification === 'ALL_MODULES_STARTED') {
      if (this.showLegacyNotification) {
        this.sendNotification('SHOW_ALERT', {
          type: 'notification',
          title: 'MMM-ImmichSlideShow',
          message: 'You are using the old configuration format which is depricated and will not be supported in the furture.  Please update your module configuration!',
        });
      }
    } else {
      Log.debug(LOG_PREFIX + 'received an unexpected system notification: ' + notification);
    }
  },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    Log.debug(LOG_PREFIX + 'socketNotificationReceived', notification, ' || Payload: ', payload ? JSON.stringify(payload) : '<null>');
    // check this is for this module based on the id
    if (!!payload.identifier && payload.identifier === this.identifier) {
      // check this is for this module based on the woeid
      if (notification === 'IMMICHSLIDESHOW_READY') {
        this.suspend();
        this.resume();
      } else if (notification === 'IMMICHSLIDESHOW_FILELIST') {
        // bubble up filelist notifications
        this.imageList = payload;
        // Log.debug (LOG_PREFIX + " >>>>>>>>>>>>>>> IMAGE LIST", JSON.stringify(payload));
      } else if (notification === 'IMMICHSLIDESHOW_DISPLAY_IMAGE') {
        Log.debug(LOG_PREFIX + 'Displaying current image', payload.path);
        // Create an interval timer that if not called will attempt to establish configuration again.
        // Apparently, the socket will keep retrying until it connects, so we only need to reattempt once.
        if (!!this.resyncTimeout) {
          console.debug('this.resyncTimeout', this.resyncTimeout);
          clearTimeout(this.resyncTimeout);
        }
        const me = this;
        this.resyncTimeout = setTimeout(() => {
          console.log('Re-registering to make sure images change...')
          me.updateImageList();
        }, me.config.activeImmichConfig.slideshowSpeed+me.config.activeImmichConfig.timeout);
        this.displayImage(payload);
      } else if (notification === 'IMMICHSLIDESHOW_REGISTER_CONFIG') {
        // Update config in backend
        this.updateImageList();
      } else {
        Log.warn(LOG_PREFIX + 'received an unexpected module notification: ' + notification);
      }
    }    
  },

  createDiv: function () {
    let div = document.createElement('div');
    div.style.backgroundSize = this.config.backgroundSize;
    div.style.backgroundPosition = this.config.backgroundPosition;
    div.className = 'image';
    return div;
  },

  createImageInfoDiv: function (wrapper) {
    const div = document.createElement('div');
    div.className = 'info ' + this.config.imageInfoLocation;
    wrapper.appendChild(div);
    return div;
  },

  createProgressbarDiv: function (wrapper, slideshowSpeed) {
    const div = document.createElement('div');
    div.className = 'progress';
    const inner = document.createElement('div');
    inner.className = 'progress-inner';
    inner.style.display = 'none';
    inner.style.animation = `move ${slideshowSpeed}ms linear`;
    div.appendChild(inner);
    wrapper.appendChild(div);
  },

  displayImage: function (imageinfo) {

    const imageInfo = imageinfo;
    const image = new Image();
    image.onload = () => {
      // check if there are more than 2 elements and remove the first one
      if (this.imagesDiv.childNodes.length > 1) {
        this.imagesDiv.removeChild(this.imagesDiv.childNodes[0]);
      }
      if (this.imagesDiv.childNodes.length > 0) {
        this.imagesDiv.childNodes[0].style.opacity = '0';
      }

      const transitionDiv = document.createElement('div');
      transitionDiv.className = 'transition';
      // Create a background color around the image is not see through
      if (this.config.showBlurredImageForBlackBars) {
        transitionDiv.style.backdropFilter = this.config.backdropFilter || 'blur(10px)';
      }

      if (this.config.backgroundSize == 'contain' && this.config.showBlurredImageForBlackBars) {
        this.imagesDiv.style.backgroundImage = `url("${image.src}")`;
      } else {
        this.imagesDiv.style.backgroundColor = this.config.backgroundColor || 'rgba(0,0,0,0.5)';
      }
      if (this.config.transitionImages && this.config.transitions.length > 0) {
        let randomNumber = Math.floor(
          Math.random() * this.config.transitions.length
        );
        transitionDiv.style.animationDuration = this.config.transitionSpeed;
        transitionDiv.style.transition = `opacity ${this.config.transitionSpeed} ease-in-out`;
        transitionDiv.style.animationName = this.config.transitions[
          randomNumber
        ];
        transitionDiv.style.animationTimingFunction = this.config.transitionTimingFunction;
      }

      const imageDiv = this.createDiv();
      imageDiv.style.backgroundImage = `url("${image.src}")`;
      
      if (this.config.showProgressBar) {
        // Restart css animation
        const oldDiv = document.getElementsByClassName('progress-inner')[0];
        const newDiv = oldDiv.cloneNode(true);
        // Make sure the new clone's style is set according to our new slideshow speed
        newDiv.style.animation = `move ${this.config.activeImmichConfig.slideshowSpeed}ms linear`;
        oldDiv.parentNode.replaceChild(newDiv, oldDiv);
        newDiv.style.display = '';
      }

      // Check to see if we need to animate the background
      if (
        this.config.backgroundAnimationEnabled &&
        this.config.animations.length
      ) {
        randomNumber = Math.floor(
          Math.random() * this.config.animations.length
        );
        const animation = this.config.animations[randomNumber];
        imageDiv.style.animationDuration = this.config.backgroundAnimationDuration;
        imageDiv.style.animationDelay = this.config.transitionSpeed;

        if (animation === 'slide') {
          imageDiv.style.backgroundPosition = '';
          imageDiv.style.animationIterationCount = this.config.backgroundAnimationLoopCount;
          imageDiv.style.backgroundSize = 'cover';

          // check to see if the width of the picture is larger or the height
          let width = image.width;
          let height = image.height;
          let adjustedWidth = (width * window.innerHeight) / height;
          let adjustedHeight = (height * window.innerWidth) / width;

          if (
            adjustedWidth / window.innerWidth >
            adjustedHeight / window.innerHeight
          ) {
            // Scrolling horizontally...
            if (Math.floor(Math.random() * 2)) {
              imageDiv.className += ' slideH';
            } else {
              imageDiv.className += ' slideHInv';
            }
          } else {
            // Scrolling vertically...
            if (Math.floor(Math.random() * 2)) {
              imageDiv.className += ' slideV';
            } else {
              imageDiv.className += ' slideVInv';
            }
          }
        } else {
          imageDiv.className += ` ${animation}`;
        }
      }

      
      if (this.config.showImageInfo) {
        let dateTime = 'N/A';
        if (imageInfo.exifInfo) {
          dateTime = imageInfo.exifInfo.dateTimeOriginal;
          // attempt to parse the date if possible
          if (dateTime !== null) {
            try {
              dateTime = moment(dateTime);
            } catch (e) {
              Log.debug(
                LOG_PREFIX + 'Failed to parse dateTime: ' +
                dateTime
              );
              dateTime = 'Invalid date';
            }
          }
        }
        // Update image info
        this.updateImageInfo(imageInfo, dateTime);
      }

      if (!this.browserSupportsExifOrientationNatively) {
        const exifOrientation = imageInfo.exifInfo.orientation;
        imageDiv.style.transform = this.getImageTransformCss(exifOrientation);
      }
     
      transitionDiv.appendChild(imageDiv);
      this.imagesDiv.appendChild(transitionDiv);
    };

    image.src = imageInfo.data;
    this.sendNotification('IMMICHSLIDESHOW_IMAGE_UPDATED', {
      url: imageInfo.path
    });
  },

  updateImage: function (backToPreviousImage = false) {
    Log.debug(LOG_PREFIX + 'updateImage called... backtoPrevious?', backToPreviousImage);
    if (backToPreviousImage) {
      this.sendSocketNotification('IMMICHSLIDESHOW_PREV_IMAGE');
    } else {
      this.sendSocketNotification('IMMICHSLIDESHOW_NEXT_IMAGE');
    }
  },

  getImageTransformCss: function (exifOrientation) {
    switch (exifOrientation) {
      case 2:
        return 'scaleX(-1)';
      case 3:
        return 'scaleX(-1) scaleY(-1)';
      case 4:
        return 'scaleY(-1)';
      case 5:
        return 'scaleX(-1) rotate(90deg)';
      case 6:
        return 'rotate(90deg)';
      case 7:
        return 'scaleX(-1) rotate(-90deg)';
      case 8:
        return 'rotate(-90deg)';
      case 1: // Falls through.
      default:
        return 'rotate(0deg)';
    }
  },

  updateImageInfo: function (imageinfo, imageDate) {
    let imageProps = [];
    const config = this.config.activeImmichConfig;
    config.imageInfo.forEach((prop, idx) => {
      switch (prop) {
        case 'date': // show date image was taken
          if (imageDate && imageDate !== 'Invalid date') {
            imageProps.push(imageDate.format(config.dateFormat));
          }
          break;

        case 'since': // show how long since the image was taken
          if (imageDate && imageDate !== 'Invalid date') {
            imageProps.push(imageDate.fromNow());
          }
          break;
        case 'name': // default is name
          // Only display last path component as image name if recurseSubDirectories is not set.
          let imageName = imageinfo.path.split('/').pop();

          // Remove file extension from image name.
          if (this.config.imageInfoNoFileExt) {
            imageName = imageName.substring(0, imageName.lastIndexOf('.'));
          }
          imageProps.push(imageName);
          break;
        case 'geo': // show image location
          let geoLocation = '';
          if (imageinfo.exifInfo) {
            geoLocation = imageinfo.exifInfo.city ?? '';
            geoLocation += imageinfo.exifInfo.state ? `, ${imageinfo.exifInfo.state}` : '';
            geoLocation += imageinfo.exifInfo.country ? `, ${imageinfo.exifInfo.country}` : '';
            // In case some values are null and our geo starts with comma, then strip it.
            if (geoLocation.startsWith(',')) {
              geoLocation = geoLocation.substring(2);
            }
          }
          // If we end up with a string that has some length, then add it to image info.
          if (geoLocation.length > 0) {
            imageProps.push(geoLocation);
          }
          break;
        case 'people':
        case 'people_skip': // show people in image
          // Only display last path component as image name if recurseSubDirectories is not set.
          if (Array.isArray(imageinfo.people)) {
            let peopleName = '';
            imageinfo.people.forEach((people, idx) => {
              const personName = people.name || '?';

              // Person name must be greater than 1 since at min it would be set to ?
              // Only add people name if it is set or we are not skipping
              if ((prop=='people' || (prop=='people_skip' && personName.length > 1))) {
                 // Add a comma between the people's names if not the first
                 if (peopleName.length > 0 && idx > 0 ) {
                  peopleName += ', ';
                }
                peopleName += personName;
              }

              if (people.birthDate && this.config.activeImmichConfig.imageInfo.includes('age')) {
                peopleName += `(${this.getAgeFromDate(people.birthDate, imageDate)})`
              }
              
            })
            // Remove file extension from image name.
            if (peopleName.length > 0) {
              imageProps.push(peopleName);
            }
          }
          break;
        case 'age': // show people's age in images
          break;
        case 'desc': // show description of images
          if (imageinfo.exifInfo && imageinfo.exifInfo.description) {
            Log.debug(
              LOG_PREFIX + 'Description: ' + imageinfo.exifInfo.description);
            imageProps.push(imageinfo.exifInfo.description);
          }
          break;
        case 'count': // show image count
        case 'album':
          break;
        default:
          Log.warn(
            LOG_PREFIX + prop +
            ' is not a valid value for imageInfo.  Please check your configuration'
          );
      }
    });

    // Log.debug('config.imageInfo[count]', config.imageInfo.includes('count'));
    // Log.dir('config.imageInfo', config.imageInfo);
    let headerString = '';
    if (config.imageInfo.includes('count')) {
      headerString = `${imageinfo.index} of ${imageinfo.total}`;
    }
    if (config.imageInfo.includes('album')) {
      headerString = headerString.length == 0 ? imageinfo.albumName : headerString + '<br>' + imageinfo.albumName;
    }
    let innerHTML = headerString.length > 0 ? `<header class="infoDivHeader">${headerString}</header>`: '';
    imageProps.forEach((val, idx) => {
      innerHTML += val + '<br/>';
    });

    this.imageInfoDiv.innerHTML = innerHTML;
    imageProps = null;
  },

  suspend: function () {
    Log.debug(LOG_PREFIX + 'Suspend called...');
    // Hide the progress while paused
    if (this.config.showProgressBar) {
      const oldDiv = document.getElementsByClassName('progress-inner')[0];
      if (oldDiv) {
        oldDiv.style.display = 'none';
      }
    }

    this.sendSocketNotification(
      'IMMICHSLIDESHOW_SUSPEND'
    );
  },

  resume: function () {
    Log.debug(LOG_PREFIX + 'Resume called...');
    // this.suspend();
    this.sendSocketNotification(
      'IMMICHSLIDESHOW_RESUME'
    );
  },

  updateImageList: function () {
    Log.debug(LOG_PREFIX + 'updateImageList called...');
    // this.suspend();
    // Log.debug(LOG_PREFIX + 'Getting Images');
    // ask helper function to get the image list
    this.sendSocketNotification(
      'IMMICHSLIDESHOW_REGISTER_CONFIG',
      this.config
    );
  },

  setActiveConfig: function (configIndex) {
    Log.debug(LOG_PREFIX + 'setActiveConfig called...', configIndex, !isNaN(configIndex), configIndex < this.config.immichConfigs.length);
    // Validate that the payload is good.  The id has already been validated
    if (!isNaN(configIndex) && configIndex > -1 && configIndex < this.config.immichConfigs.length) {
      this.config.activeImmichConfig = this.config.immichConfigs[configIndex];
      this.config.activeImmichConfigIndex = configIndex;
      Log.debug(LOG_PREFIX + 'new active config', this.config.activeImmichConfig);
      // ask helper function to get the image list
      this.sendSocketNotification(
        'IMMICHSLIDESHOW_REGISTER_CONFIG',
        this.config
      );
    } else {
      Log.debug(LOG_PREFIX + 'bad parameter passed to setActiveConfig:', configIndex);
    }
    
  },

  getAgeFromDate: function (dateString, imageDate) {
    var today = imageDate || moment();
    var birthDate = moment(dateString);
    var duration = moment.duration(today.diff(birthDate));
    var y = duration.asYears();
    var m = duration.asMonths();
    var d = duration.asDays();

    if (y >= 1) {
      age = Math.floor(y);
    } else if (m >= 1) {
      age = `${Math.floor(m)}m`
    } else {
      age = `${Math.floor(d)}d`
    }
    return age;
  },

   /**
   * This funciton checks the value of imageInfo and process it to convert it
   * to an array
   * @param {array/string} imageInfo 
   * @returns 
   */
  fixImageInfo: function(imageInfo, index) {
    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoValues = '\\bname\\b|\\bdate\\b|\\bsince\\b|\\bgeo\\b|\\bpeople\\b|\\bpeople_skip\\b|\\bage\\b|\\bdesc\\b|\\bcount\\b|';
    const imageInfoRegex = new RegExp(imageInfoValues,'gi');
    // Set the log prefix
    const prefix = LOG_PREFIX + `config[${index}]: `;
        
    let setToDefault = false;
    let newImageInfo = [];
    if (
      Array.isArray(imageInfo)
    ) {
      for (const [i, infoItem] of Object.entries(imageInfo)) {
        console.debug(prefix + 'Checking imageInfo: ', i, infoItem);
        // Skip any entries that do not have a matching value
        if (imageInfoValues.substring(infoItem.trim().toLowerCase())) {
          // Make sure to trim the entries and make them lowercase
          newImageInfo.push(infoItem.trim().toLowerCase());
        } else {
          console.warn(prefix + `invalid image info item '${infoItem}'`);
        }
      }
      // If nothing matched, then use default
      if (newImageInfo.length === 0) {
        setToDefault = true;
      }
    } else if (!imageInfoRegex.test(imageInfo)) {
      Log.warn(
        prefix + 'showImageInfo is set, but imageInfo does not have a valid value. Using date as default!'
      );
      setToDefault = true;
    } else {
      // convert to lower case and replace any spaces with , to make sure we get an array back
      // even if the user provided space separated values
      newImageInfo = imageInfo
        .toLowerCase()
        .replace(/\s/g, ',')
        .split(',');
      // now filter the array to only those that have values
      newImageInfo = newImageInfo.filter((n) => n);
    }

    // The imageInfo params had invalid values in them
    if (setToDefault) {
      // Use name as the default
      newImageInfo = this.defaultConfig.imageInfo;
    } else {
      if (newImageInfo.includes('people') && newImageInfo.includes('people_skip')) {
        Log.warn(
          prefix + 'imageInfo should not include both people and people_skip.  Using people!'
        );
        // Remove people_skip since people is already included
        newImageInfo = newImageInfo.filter((n) => n !== 'people_skip');
      }
      if (newImageInfo.includes('age') && !(newImageInfo.includes('people') || newImageInfo.includes('people_skip'))) {
        Log.warn(
          prefix + 'imageInfo includes age but not people.  Removing age from imageInfo!'
        );
        // Remove age since people is not included
        newImageInfo = newImageInfo.filter((n) => n !== 'age');
      }
    }

    return newImageInfo;
  },

  // Override dom generator.
  getDom: function () {
    let wrapper = document.createElement('div');
    this.imagesDiv = document.createElement('div');
    this.imagesDiv.className = 'images';
    if (this.config.backgroundSize == 'contain' && this.config.showBlurredImageForBlackBars) {
      this.imagesDiv.style.backgroundSize = 'cover';
      this.imagesDiv.style.backgroundPosition = 'center';
    }

    wrapper.appendChild(this.imagesDiv);

    if (this.config.showImageInfo) {
      this.imageInfoDiv = this.createImageInfoDiv(wrapper);
    }

    if (this.config.showProgressBar) {
      this.createProgressbarDiv(wrapper, this.config.activeImmichConfig.slideshowSpeed);
    }

    if (this.config.activeImmichConfig.apiKey.length == 0) {
      Log.error(
        LOG_PREFIX + 'Missing required parameter apiKey.'
      );
    } else {
      this.updateImageList();
    }

    return wrapper;
  },
});
