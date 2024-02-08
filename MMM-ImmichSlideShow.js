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
const LOG_PREFIX = 'MMM-ImmichSlideShow :: module :: ';
const MODE_MEMORY = 'memory';
const MODE_ALBUM = 'album';

Module.register('MMM-ImmichSlideShow', {
  // Min version of MM2 required
  requiresVersion: "2.1.0",

  // Default module config.
  defaults: {
    // an Immich API key to be able to access Immich
    apiKey: 'provide your API KEY',
    // Base Immich URL.  /api will be appended to this URL to make API calls.
    immichUrl: 'provide your base Immich URL',
    // Mode of operation: 
    //    memory = show recent photos.  requires numDaystoInclude
    //    album = show picture from album.  requires albumId/albumName
    mode: MODE_MEMORY,
    // Number of days to include images for, including today
    numDaysToInclude: 7,
    // The ID of the album to display
    albumId: null,
    // The Name of the album to display
    albumName: null,
    // the speed at which to switch between images, in milliseconds
    slideshowSpeed: 15 * 1000,
    // how to sort images: name, random, created, modified, none
    sortImagesBy: 'none',
    // whether to sort in ascending (default) or descending order
    sortImagesDescending: false,
    // list of valid file extensions, separated by commas
    validImageFileExtensions: 'bmp,jpg,jpeg,gif,png',
    // show a panel containing information about the image currently displayed.
    showImageInfo: false,
    // The compression level of the resulting jpeg
    imageCompression: 0.7,
    // a comma separated list of values to display: name, date, since, geo
    imageInfo: ['date', 'since'],
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
    // remove the file extension from image name
    imageInfoNoFileExt: false,
    // show a progress bar indicating how long till the next image is displayed.
    showProgressBar: false,
    // the color of the background when the image does not take up the full screen
    backgroundColor: '#000', // can also be rbga(x,y,z,alpha)
    // the filter to apply to the background.  Useful to give the background a translucent effect
    backdropFilter: 'blur(5px)',
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
    animations: ['slide', 'zoomOut', 'zoomIn']
  },

  // load function
  start: function () {
    Log.debug(
      LOG_PREFIX + 'starting...'
    );
    // add identifier to the config
    this.config.identifier = this.identifier;
    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();
    // ensure image order is in lower case
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase();
    // commented out since this was not doing anything
    // set no error
    // this.errorMessage = null;

    // Log.debug(LOG_PREFIX + 'current config', this.config);

    //validate immich properties
    if (this.config.mode && this.config.mode.trim().toLowerCase() === MODE_MEMORY) {
      this.config.mode = MODE_MEMORY
      // Make sure we have numDaysToInclude
      if (!this.config.numDaysToInclude || isNaN(this.config.numDaysToInclude)) {
        Log.warn(
          LOG_PREFIX + 'memory mode set, but numDaysToInclude does not have a valid value'
        );
      }
    } else if (this.config.mode && this.config.mode.trim().toLowerCase() === MODE_ALBUM) {
      this.config.mode = MODE_ALBUM
      // Make sure we have album name or album id
      if ((!this.config.albumId || this.config.albumId.length === 0) && (!this.config.albumName || this.config.albumName.length === 0)) {
        Log.warn(
          LOG_PREFIX + 'album mode set, but albumId or albumName do not have a valid value'
        );
      } else if (this.config.albumId && this.config.albumName) {
        Log.warn(
          LOG_PREFIX + 'album mode set, but albumId or albumName do not have a valid value'
        );
        // This is a double check to make sure we only present one of these properties to
        // node_helper
        if (this.config.albumId) {
          this.config.albumName = null;
        } else {
          this.config.albumId = null;
        }
      }
    } else {
      Log.warn(
        LOG_PREFIX + 'memory mode not set to valid value, assuming memory mode...'
      );
    }

    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoRegex = /\bname\b|\bdate\b|\bsince\b|\bgeo\b|\bpeople\b/gi;
    if (
      this.config.showImageInfo &&
      Array.isArray(this.config.imageInfo)
    ) {
      let setToDefault = false;
      for (const [i, infoItem] of Object.entries(this.config.imageInfo)) {
        
        if (!imageInfoRegex.test(this.config.imageInfo)) {
          setToDefault = true;
          break;
          // Make sure to trim the entries and make them lowercase
          this.config.imageInfo[i] = this.config.imageInfo[i].trim().toLowerCase();
        }
      }
      if (setToDefault) {
        Log.warn(
          LOG_PREFIX + 'showImageInfo is set, but imageInfo does not have a valid value. Using date as default!'
        );
        // Use name as the default
        this.config.imageInfo = ['date'];
      }
    } else if (
      this.config.showImageInfo &&
      !imageInfoRegex.test(this.config.imageInfo)
    ) {
      Log.warn(
        LOG_PREFIX + 'showImageInfo is set, but imageInfo does not have a valid value. Using date as default!'
      );
      // Use name as the default
      this.config.imageInfo = ['date'];
    } else {
      // convert to lower case and replace any spaces with , to make sure we get an array back
      // even if the user provided space separated values
      this.config.imageInfo = this.config.imageInfo
        .toLowerCase()
        .replace(/\s/g, ',')
        .split(',');
      // now filter the array to only those that have values
      this.config.imageInfo = this.config.imageInfo.filter((n) => n);
    }

    if (!this.config.transitionImages) {
      this.config.transitionSpeed = '0';
    }

    if (!this.config.imageCompression) {
      this.config.imageCompression = 0.7;
    } else {
      try {
        const compressionVal = parseFloat(this.config.imageCompression);
        if (compressionVal < 0 || compressionVal > 1) {
          Log.warn(
            LOG_PREFIX + 'imageCompression should be between 0 and 1!  Defaulting to 0.7'
          );
          this.config.imageCompression = 0.7;
        }
      } catch (e) {
        Log.warn(
          LOG_PREFIX + 'imageCompression should be a decimal value between 0 and 1!  Defaulting to 0.7'
        );
        this.config.imageCompression = 0.7;
      }
    }

    // Lets make sure the backgroundAnimation duration matches the slideShowSpeed unless it has been
    // overridden
    if (this.config.backgroundAnimationDuration === '1s') {
      this.config.backgroundAnimationDuration =
        this.config.slideshowSpeed / 1000 + 's';
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
    Log.debug(LOG_PREFIX + 'notificationReceived', notification, ' || Payload: ', (payload ? payload.identifier : '<undefined>'), ' || Sender: ', sender);

    if (notification === 'DOM_OBJECTS_CREATED') {
      Log.debug(LOG_PREFIX + 'Sedning register API notification for ' + this.name);
      this.sendNotification('REGISTER_API', {
        module: this.name,
        path:  this.name.toLowerCase(),
        actions: {
          showNext: {
            method: 'GET',
            notification: "IMMICHSLIDESHOW_NEXT"
          },
          showPrevisous: {
            method: 'GET',
            notification: "IMMICHSLIDESHOW_PREVIOUS"
          },
          pause: {
            method: 'GET',
            notification: "IMMICHSLIDESHOW_PAUSE"
          },
          resume: {
            method: 'GET',
            notification: "IMMICHSLIDESHOW_RESUME"
          }
        }
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
    } else {
      Log.debug(LOG_PREFIX + 'received an unexpected system notification: ' + notification);
    }
  },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    Log.debug(LOG_PREFIX + 'socketNotificationReceived', notification, ' || Payload: ', payload ? payload.identifier : '<null>');
    // check this is for this module based on the woeid
    if (notification === 'IMMICHSLIDESHOW_READY') {
    
      if (payload.identifier === this.identifier) {
        this.resume();
      }
    } else if (notification === 'IMMICHSLIDESHOW_FILELIST') {
      // bubble up filelist notifications
      // this.sendSocketNotification('IMMICHSLIDESHOW_FILELIST', payload);
      this.imageList = payload;
      // Log.debug (LOG_PREFIX + " >>>>>>>>>>>>>>> IMAGE LIST", JSON.stringify(payload));
    } else if (notification === 'IMMICHSLIDESHOW_DISPLAY_IMAGE') {
      // check this is for this module based on the id
      if (payload.identifier === this.identifier) {
        Log.debug(LOG_PREFIX + 'Displaying current image', payload);
        this.displayImage(payload);
      }
    } else if (notification === 'IMMICHSLIDESHOW_REGISTER_CONFIG') {
      // Update config in backend
      this.updateImageList();
    } else {
      Log.warn(LOG_PREFIX + 'received an unexpected module notification: ' + notification);
    }

    
  },

  // Override dom generator.
  getDom: function () {
    let wrapper = document.createElement('div');
    this.imagesDiv = document.createElement('div');
    this.imagesDiv.className = 'images';
    // Create a background color around the image is not see through
    this.imagesDiv.style.backgroundColor = this.config.backgroundColor || 'transparent';
    this.imagesDiv.style.backdropFilter = this.config.backdropFilter || 'blur(10px)';

    wrapper.appendChild(this.imagesDiv);

    if (this.config.showImageInfo) {
      this.imageInfoDiv = this.createImageInfoDiv(wrapper);
    }

    if (this.config.showProgressBar) {
      this.createProgressbarDiv(wrapper, this.config.slideshowSpeed);
    }

    if (this.config.apiKey.length == 0) {
      Log.error(
        LOG_PREFIX + 'Missing required parameter apiKey.'
      );
    } else {
      this.updateImageList();
    }

    return wrapper;
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
                dateTime +
                ' to format YYYY:MM:DD HH:mm:ss'
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

    image.src = 'data:image/jpeg;base64, ' + imageInfo.data;
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
    this.config.imageInfo.forEach((prop, idx) => {
      switch (prop) {
        case 'date': // show date image was taken
          if (imageDate && imageDate !== 'Invalid date') {
            imageProps.push(imageDate.format('dddd MMMM D, YYYY HH:mm'));
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
        case 'people': // show people in image
          // Only display last path component as image name if recurseSubDirectories is not set.
          if (Array.isArray(imageinfo.people)) {
            let peopleName = '';
            imageinfo.people.forEach(people => {
              if (peopleName.length > 0) {
                peopleName += ', ';
              }
              peopleName += people.name || '';
            })
            // Remove file extension from image name.
            if (peopleName.length > 0) {
              imageProps.push(peopleName);
            }
          }
          break;
        default:
          Log.warn(
            LOG_PREFIX + prop +
            ' is not a valid value for imageInfo.  Please check your configuration'
          );
      }
    });

    let innerHTML = `<header class="infoDivHeader">${imageinfo.index} of ${imageinfo.total}</header>`;
    imageProps.forEach((val, idx) => {
      innerHTML += val + '<br/>';
    });

    this.imageInfoDiv.innerHTML = innerHTML;
    imageProps = null;
  },

  suspend: function () {
    Log.debug(LOG_PREFIX + 'Suspend called...');
    // Hide the progress while paused
    const oldDiv = document.getElementsByClassName('progress-inner')[0];
    oldDiv.style.display = 'none';

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
  }
});
