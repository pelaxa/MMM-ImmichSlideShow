
// const Log = console;
const Log = require('logger');
const axios = require('axios');
const { createProxyMiddleware } = require("http-proxy-middleware");

const LOG_PREFIX = 'MMM-ImmichSlideShow :: immichApi :: ';
const IMMICH_PROXY_URL = '/immichslideshow/';

const immichApi = {
    apiUrls: {
       v1_94: {
            albums: '/album',
            albumInfo: '/album/{id}',
            memoryLane: '/asset/memory-lane',
            assetInfo: '/asset/{id}',
            assetDownload: '/asset/file/{id}?isWeb=true',
            serverInfoUrl: '/server-info/version',
            search: 'NOT SUPPORTED'
        },
        v1_106: {
            previousVersion: 'v1_94',
            albums: '/albums',
            albumInfo: '/albums/{id}',
            memoryLane: '/assets/memory-lane',
            assetInfo: '/assets/{id}',
            assetDownload: '/assets/{id}/thumbnail?size=preview',
            serverInfoUrl: '/server-info/version',
            search: 'NOT SUPPORTED'
        },
        v1_118: {
            previousVersion: 'v1_106',
            albums: '/albums',
            albumInfo: '/albums/{id}',
            memoryLane: '/assets/memory-lane',
            assetInfo: '/assets/{id}',
            assetDownload: '/assets/{id}/thumbnail?size=preview',
            serverInfoUrl: '/server/version',
            search: '/search/smart'
        }
    },

    apiLevel: 'v1_118',
    apiBaseUrl: '/api',
    http: null,

    init: async function(config, expressApp, force) {

        if (this.http === null || force) {
            // create and axis instance
            this.http = axios.create({
              baseURL: config.url + this.apiBaseUrl,
              timeout: config.timeout,
              validateStatus: function (status) {
                return status >= 200 && status < 499; // default
              },
              headers: {
                'x-api-key': config.apiKey,
                'Accept': 'application/json'
              }
            });

            // ENABLE DEBUGGING FOR AXIS
            // this.http.interceptors.request.use(request => {
            //   Log.log('Starting Request', request.headers, '\n baseUrl: ', request.baseURL, '\n method: ', request.method, '\n URL: ', request.url, '\n params: ', request.params);
            //   return request;
            // });
            
            // this.http.interceptors.response.use(response => {
            //   Log.log('Response:', response.data, '\n headers: ', response.headers);
            //   return response;
            // });

            // Now get the version of the server
            //determine the server version first
            let serverVersion = {major:-1, minor:-1, patch:-1};
            try {
                Log.debug(LOG_PREFIX + 'fetching server version...');
                let response = await this.http.get(this.apiUrls[this.apiLevel]['serverInfoUrl'], {params: {}, responseType: 'json'});
                if (response.status === 200) {
                    serverVersion = response.data;
                } else {
                    // We could be dealing with an older version of immich
                    let serverVersionFound = false;
                    while (!serverVersionFound && !!this.apiUrls[this.apiLevel]['previousVersion']) {
                        this.apiLevel = this.apiUrls[this.apiLevel]['previousVersion'];
                        Log.debug(LOG_PREFIX + `fetching server version (${this.apiLevel})...`);
                        response = await this.http.get(this.apiUrls[this.apiLevel]['serverInfoUrl'], {params: {}, responseType: 'json'});
                        if (response.status === 200) {
                            serverVersion = response.data;
                            serverVersionFound = true;
                        }
                    }
                    if (!serverVersionFound) {
                        Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
                    }
                }
            } catch(e) {
                Log.error(LOG_PREFIX + 'Oops!  Exception while fetching server version', e.message);
            }
            
            if (serverVersion.major > -1) {
                if (serverVersion.major === 1) {
                    if (serverVersion.minor >= 106 && serverVersion.minor < 118 ) {
                        this.apiLevel = 'v1_106';
                    } else if (serverVersion.minor < 106 ) {
                        this.apiLevel = 'v1_94';
                    }
                }
            } else {
                throw('Failed to get Immich version.  Cannot proceed.');
            }

            // Now setup our proxy service
            expressApp.use(IMMICH_PROXY_URL, createProxyMiddleware({
                target: config.url,
                changeOrigin: true,
                // logger: Log,
                proxyTimeout: config.timeout,
                headers: {
                    'x-api-key': config.apiKey,
                    'accept': 'application/octet-stream'
                },
                pathRewrite: (path, req) => {
                    const pathArray = path.split('/');
                    const imageId = pathArray[pathArray.length-1];
                    return this.apiBaseUrl + this.apiUrls[this.apiLevel]['assetDownload'].replace('{id}',imageId);
                }
            }));

            Log.debug(LOG_PREFIX + 'Server Version is', this.apiLevel, JSON.stringify(serverVersion));
        }
    },

    findAlbumId: async function (albumName) {
        let albumId = null;
        try {
            const response = await this.http.get(this.apiUrls[this.apiLevel]['albums'], {responseType: 'json'});
            if (response.status === 200) {
                // Loop through the albums to find the right now
                for (let i=0; i < response.data.length; i++) {
                    const album = response.data[i];
                    Log.debug(LOG_PREFIX + `comparing ${album.albumName} to ${albumName}`);
                    if (album.albumName === albumName) {
                        Log.debug(LOG_PREFIX + 'match found');
                        albumId = album.id;
                        break;
                    }
                }

                if (!albumId) {
                    Log.error(LOG_PREFIX + `could not find an album with the provided name (${albumName}).  Note that album name is case sensitive`);
                }
            } else {
                Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
            }
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching albums from Immich', e.message);
        }

        return albumId;
    },

    getAlbumAssets: async function (albumId) {
        let imageList = [];
        try {
            const response = await this.http.get(this.apiUrls[this.apiLevel]['albumInfo'].replace('{id}',albumId), {responseType: 'json'});
            if (response.status === 200) {
                imageList = [...response.data.assets];
            } else {
                Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
            }
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching pictures from album ', e.message);
        }

        return imageList;
    },

    getMemoryLaneAssets: async function (numDays) {
        let imageList = [];
        
        // Loop through the past 2 weeks and get the memory lanes
        // TODO: Do we keep looping until we reach a max # of photos?
        //       how do we determine max photos? is it fixed or determined based on config settings?
        let today = (new Date());
        today.setHours(0);
        today.setMinutes(0);
        today.setSeconds(0);
        today.setMilliseconds(0);

        Log.debug(LOG_PREFIX + 'numDaysToInclude: ', numDays);

        for (let i=0; i < numDays; i++) {
            // as of version 1.82, the API for memory lane has changed.
            let mlParams = {
                day: today.getDate(),
                month: today.getMonth()+1
            }
            
            Log.debug(LOG_PREFIX + 'fetching images for: ', today.toISOString());
            try{
                const response = await this.http.get(this.apiUrls[this.apiLevel]['memoryLane'], {params: mlParams, responseType: 'json'});
                // Log.debug(LOG_PREFIX + 'response', today.toISOString(), response.data.length);
                if (response.status === 200) {
                    response.data.forEach(memory => {
                    imageList = memory.assets.concat(imageList);
                    // Log.debug(LOG_PREFIX + 'imageList', today.toISOString(), this.imageList.length);
                    });
                } else {
                    Log.error(LOG_PREFIX + 'unexpected response from Immich while fetching memoryLane', response.status, response.statusText);
                }
            } catch(e) {
                Log.error(LOG_PREFIX + 'Oops!  Exception while fetching images from Immich (memoryLane)', e.message);
            }
            // set to previous date to catch the next date
            today.setDate(today.getDate()-1);
        }

        return imageList;
    },

    getAssetInfo: async function (imageId) {
        let assetInfo = {
            exifInfo: [],
            people: []
        };
        
        try {
            const exifResponse = await this.http.get(this.apiUrls[this.apiLevel]['assetInfo'].replace('{id}',imageId), { responseType: 'json' });
            if (exifResponse.status === 200) {
                assetInfo.exifInfo = exifResponse.data.exifInfo || [];
                assetInfo.people = exifResponse.data.people || [];
            }
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching image metadata', e.message);
        }

        return assetInfo;
    },

    getBase64EncodedAsset: async function (imageId) {
        let base64Image = null;
        try {
            const binaryResponse = await this.http.get(this.apiUrls[this.apiLevel]['assetDownload'].replace('{id}',imageId), { headers: {'Accept': 'application/octet-stream'}, responseType: 'arraybuffer' });
            if (binaryResponse.status === 200) {
                const imageBuffer = Buffer.from(binaryResponse.data);
                if (imageBuffer) {
                    base64Image = `data:${binaryResponse.headers['content-type']};base64, ` + imageBuffer.toString('base64');
                }
            }
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching image blob', e.message);
        }

        return base64Image;
    },

    getImageLink: function(imageId) {
        return IMMICH_PROXY_URL + imageId;
    }


  }

  module.exports = immichApi;