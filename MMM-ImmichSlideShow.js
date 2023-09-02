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

Module.register('MMM-ImmichSlideShow', {
  // Min version of MM2 required
  requiresVersion: "2.1.0",

  // Default module config.
  defaults: {
    // an Immich API key to be able to access Immich
    apiKey: 'provide your API KEY',
    // Base Immich URL.  /api will be appended to this URL to make API calls.
    immichUrl: 'provide your base Immich URL',
    // Number of days to include images for, including today
    numDaysToInclude: 7,
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
    // a comma separated list of values to display: name, date, since, geo (TODO)
    imageInfo: ['date', 'since'],
    // location of the info div
    imageInfoLocation: 'bottomRight', // Other possibilities are: bottomLeft, topLeft, topRight
    // remove the file extension from image name
    imageInfoNoFileExt: false,
    // show a progress bar indicating how long till the next image is displayed.
    showProgressBar: false,
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
    changeImageOnResume: false
  },

  // load function
  start: function () {
    // add identifier to the config
    this.config.identifier = this.identifier;
    // ensure file extensions are lower case
    this.config.validImageFileExtensions = this.config.validImageFileExtensions.toLowerCase();
    // ensure image order is in lower case
    this.config.sortImagesBy = this.config.sortImagesBy.toLowerCase();
    // commented out since this was not doing anything
    // set no error
    // this.errorMessage = null;

    //validate imageinfo property.  This will make sure we have at least 1 valid value
    const imageInfoRegex = /\bname\b|\bdate\b|\bsince\b|\bimagecount\b|\bgeo\b/gi;
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
          LOG_PREFIX + 'showImageInfo is set, but imageInfo does not have a valid value.'
        );
        // Use name as the default
        this.config.imageInfo = ['date'];
      }
    } else if (
      this.config.showImageInfo &&
      !imageInfoRegex.test(this.config.imageInfo)
    ) {
      Log.warn(
        LOG_PREFIX + 'showImageInfo is set, but imageInfo does not have a valid value.'
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

    this.playingVideo = false;
  },

  getScripts: function () {
    return [
      'modules/' + this.name + '/node_modules/exif-js/exif.js',
      'moment.js'
    ];
  },

  getStyles: function () {
    // the css contains the make grayscale code
    return ['immichSlideShow.css'];
  },

  // generic notification handler
  notificationReceived: function (notification, payload, sender) {
    Log.info(LOG_PREFIX + 'notificationReceived', notification, ' || Payload: ', payload, ' || Sender: ', sender);
  },

  // updateImageListWithArray: function (urls) {
  //   this.imageList = urls.splice(0);
  //   this.imageIndex = 0;
  //   this.updateImage();
  //   if (
  //     !this.playingVideo &&
  //     (this.timer || (this.savedImages && this.savedImages.length == 0))
  //   ) {
  //     // Restart timer only if timer was already running
  //     this.resume();
  //   }
  // },

  // the socket handler
  socketNotificationReceived: function (notification, payload) {
    Log.info(LOG_PREFIX + 'socketNotificationReceived', notification, ' || Payload: ', payload);

    // check this is for this module based on the woeid
    if (notification === 'IMMICHSLIDESHOW_READY') {
      // // Log.info(LOG_PREFIX + 'Returning Images, payload:' + JSON.stringify(payload));
      // // set the image list
      // if (this.savedImages) {
      //   this.savedImages = payload.imageList;
      //   this.savedIndex = 0;
      // } else {
      //   this.imageList = payload.imageList;
      //   // if image list actually contains images
      //   // set loaded flag to true and update dom
      //   if (this.imageList.length > 0) {
      //     this.updateImage(); //Added to show the image at least once, but not change it within this.resume()
      //     if (!this.playingVideo) {
      //       this.resume();
      //     }
      //   }
      // }
      if (payload.identifier === this.identifier) {
        // this.sendSocketNotification('IMMICHSLIDESHOW_NEXT_IMAGE');
        if (!this.playingVideo) {
          this.resume();
        }
      }
    } else if (notification === 'IMMICHSLIDESHOW_REGISTER_CONFIG') {
      // Update config in backend
      this.updateImageList();
    } else if (notification === 'IMMICHSLIDESHOW_PLAY') {
      // Change to next image and start timer.
      // this.updateImage();
      if (!this.playingVideo) {
        this.resume();
      }
    } else if (notification === 'IMMICHSLIDESHOW_DISPLAY_IMAGE') {
      // check this is for this module based on the woeid
      if (payload.identifier === this.identifier) {
        this.displayImage(payload);
      }
    } else if (notification === 'IMMICHSLIDESHOW_FILELIST') {
      //bubble up filelist notifications
      this.sendSocketNotification('IMMICHSLIDESHOW_FILELIST', payload);
    } else if (notification === 'IMMICHSLIDESHOW_UPDATE_IMAGE_LIST') {
      this.imageIndex = -1;
      this.updateImageList();
      this.updateImage();
    } else if (notification === 'IMMICHSLIDESHOW_IMAGE_UPDATE') {
      Log.info(LOG_PREFIX + 'Changing Background');
      this.suspend();
      // this.updateImage();
      if (!this.playingVideo) {
        this.resume();
      }
    } else if (notification === 'IMMICHSLIDESHOW_NEXT') {
      // Change to next image
      // this.updateImage();
      if (!this.playingVideo) {
        // Restart timer only if timer was already running
        this.resume();
      }
    } else if (notification === 'IMMICHSLIDESHOW_PREVIOUS') {
      // Change to previous image
      this.updateImage(/* skipToPrevious= */ true);
      if (!this.playingVideo) {
        // Restart timer only if timer was already running
        this.resume();
      }
    } else if (notification === 'IMMICHSLIDESHOW_PAUSE') {
      // Stop timer.
      this.suspend();
    } else {
      Log.info(LOG_PREFIX + 'received an unexpected system notification: ' + notification);
    }
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement('div');
    this.imagesDiv = document.createElement('div');
    this.imagesDiv.className = 'images';
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
      // create an empty image list
      this.imageList = [];
      // set beginning image index to 0, as it will auto increment on start
      this.imageIndex = 0;
      this.updateImageList();
    }

    return wrapper;
  },

  createDiv: function () {
    var div = document.createElement('div');
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
          var width = image.width;
          var height = image.height;
          var adjustedWidth = (width * window.innerHeight) / height;
          var adjustedHeight = (height * window.innerWidth) / width;

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
        let dateTime = imageinfo.exifInfo.dateTimeOriginal;
        // attempt to parse the date if possible
        if (dateTime !== null) {
          try {
            dateTime = moment(dateTime);
          } catch (e) {
            Log.info(
              LOG_PREFIX + 'Failed to parse dateTime: ' +
              dateTime +
              ' to format YYYY:MM:DD HH:mm:ss'
            );
            dateTime = 'Invalid date';
          }
        }
        // TODO: allow for location lookup via openMaps
        // let lat = EXIF.getTag(this, "GPSLatitude");
        // let lon = EXIF.getTag(this, "GPSLongitude");
        // // Only display the location if we have both longitute and lattitude
        // if (lat && lon) {
        //   // Get small map of location
        // }
        this.updateImageInfo(imageinfo, dateTime);
      }

      if (!this.browserSupportsExifOrientationNatively) {
        const exifOrientation = imageinfo.exifInfo.orientation;
        imageDiv.style.transform = this.getImageTransformCss(exifOrientation);
      }
     
      transitionDiv.appendChild(imageDiv);
      this.imagesDiv.appendChild(transitionDiv);
    };

    image.src = 'data:image/jpeg;base64, ' + imageinfo.data;
    this.sendSocketNotification('IMMICHSLIDESHOW_IMAGE_UPDATED', {
      url: imageinfo.path
    });
  },

  updateImage: function (backToPreviousImage = false, imageToDisplay = null) {
    Log.info(LOG_PREFIX + 'updateImage ::', backToPreviousImage, ', ', imageToDisplay);
    if (imageToDisplay) {
      this.displayImage({
        path: imageToDisplay,
        data: imageToDisplay,
        index: 1,
        total: 1
      });
      return;
    }

    if (this.imageList.length > 0) {
      this.imageIndex = this.imageIndex + 1;

      imageToDisplay = this.imageList.splice(this.imageIndex, 1);
      Log.info(LOG_PREFIX + 'imageToDisplay >> ', imageToDisplay);
      this.displayImage({
        path: imageToDisplay[0],
        data: imageToDisplay[0],
        index: 1,
        total: 1
      });
      return;
    }

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
        case 'date':
          if (imageDate && imageDate !== 'Invalid date') {
            imageProps.push(imageDate.format('dddd MMMM D, YYYY HH:mm'));
          }
          break;

        case 'since': // default is name
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
  },

  suspend: function () {
    // if (this.timer) {
    //   clearInterval(this.timer);
    //   this.timer = null;
    // }
    this.sendSocketNotification(
      'IMMICHSLIDESHOW_SUSPEND'
    );
  },

  resume: function () {
    //this.updateImage(); //Removed to prevent image change whenever MMM-Carousel changes slides
    this.suspend();
    var self = this;

    if (self.config.changeImageOnResume) {
      self.updateImage();
    }

    // this.timer = setInterval(function () {
    //   // Log.info(LOG_PREFIX + 'updating from resume');
    //   self.updateImage();
    // }, self.config.slideshowSpeed);
    this.sendSocketNotification(
      'IMMICHSLIDESHOW_RESUME'
    );
  },

  updateImageList: function () {
    this.suspend();
    // Log.info(LOG_PREFIX + 'Getting Images');
    // ask helper function to get the image list
    this.sendSocketNotification(
      'IMMICHSLIDESHOW_REGISTER_CONFIG',
      this.config
    );
  }
});
