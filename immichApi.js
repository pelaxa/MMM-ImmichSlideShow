
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
        },
        v1_133: {
            previousVersion: 'v1_118',
            albums: '/albums',
            albumInfo: '/albums/{id}',
            memoryLane: '/memories',
            assetInfo: '/assets/{id}',
            assetDownload: '/assets/{id}/thumbnail?size=preview',
            serverInfoUrl: '/server/version',
            search: '/search/smart',
            randomSearch: '/search/random'
        }
    },

    apiLevel: 'v1_133',
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

    getAlbumNameToIdMap: async function () {
        let albumNameToIdMap = new Map();
        try {
            const response = await this.http.get(this.apiUrls[this.apiLevel]['albums'], {responseType: 'json'});
            if (response.status === 200) {
                for (let i=0; i < response.data.length; i++) {
                    const album = response.data[i];
                    albumNameToIdMap.set(album.albumName, album.id);
                    Log.debug(LOG_PREFIX + 'album name: ' + album.albumName + ', album id: ' + album.id);
                }
            } else {
                Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
            }
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching albums from Immich', e.message);
        }
        return albumNameToIdMap;
    },

    findAlbumIds: async function (albumNames) {
        let albumNameToAlbumIdMap = await this.getAlbumNameToIdMap();
        let albumIds = [];
        for (const albumName of albumNames) {
            if (albumNameToAlbumIdMap.has(albumName)) {
                albumIds = albumIds.concat(albumNameToAlbumIdMap.get(albumName));
            } else {
                Log.error(LOG_PREFIX + `could not find an album with the provided name (${albumName}).  Note that album name is case sensitive`);
            }
        }
        Log.debug(LOG_PREFIX + `Found (${albumIds.length}/${albumNames.length}) matching albumIds`);
        return albumIds;
    },

    getAlbumAssets: async function (albumId) {
        let imageList = [];
        try {
            const response = await this.http.get(this.apiUrls[this.apiLevel]['albumInfo'].replace('{id}',albumId), {responseType: 'json'});
            if (response.status === 200) {
                imageList = [...response.data.assets];
                if (response.data.albumName) {
                    Log.debug(LOG_PREFIX + `Retrieved ${imageList.length} images for album ${response.data.albumName}`);
                    imageList.forEach(image =>
                        image.albumName = response.data.albumName
                    );
                }
            } else {
                Log.error(LOG_PREFIX + 'unexpected response from Immich', response.status, response.statusText);
            }
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching pictures from album ', e.message);
        }

        return imageList;
    },

    getAlbumAssetsForAlbumIds: async function (albumIds) {
        let imageList = [];
        for (const albumId of albumIds) {
            let currentAlbumImages = await this.getAlbumAssets(albumId);
            if (currentAlbumImages && currentAlbumImages.length > 0) {
                imageList = imageList.concat(currentAlbumImages);
            }
        }
        Log.debug(LOG_PREFIX + `retrieved ${imageList.length} images.`);
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
            // as of version 1.133, the API for memory lane has changed.
            const mlParams = this.apiLevel == 'v1_133' ? {
                for: today.toISOString(),
                type: 'on_this_day'
            } : {
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

    searchAssets: async function (query, size) {
        let imageList = [];
            
        Log.debug(LOG_PREFIX + 'Searching for images: ', query, 'SIZE: ', size);
        try{
            const searchQuery = {...query, size: size};
            Log.debug(LOG_PREFIX + 'Searching query: ', searchQuery);
            const response = await this.http.post(this.apiUrls[this.apiLevel]['search'], searchQuery, {responseType: 'json'});
            Log.info(LOG_PREFIX + 'response', response);
            if (response.status === 200) {
                imageList = response.data.assets.items;
            } else {
                Log.error(LOG_PREFIX + 'unexpected response from Immich while searching assets', response.status, response.statusText);
            }
        } catch(e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching images from Immich (search)', e.message);
        }

        return imageList;
    },

    randomSearchAssets: async function (size, query) {
        let imageList = [];
            
        Log.debug(LOG_PREFIX + 'Searching for random images, SIZE: ', size);
        try{
            const searchQuery = { size: size };
            
            // Add any additional query parameters if provided
            if (query) {
                Object.assign(searchQuery, query);
            }
            
            Log.debug(LOG_PREFIX + 'Random search query: ', searchQuery);
            const response = await this.http.post(this.apiUrls[this.apiLevel]['randomSearch'], searchQuery, {responseType: 'json'});
            
            if (response.status === 200) {
                imageList = response.data;
            } else {
                Log.error(LOG_PREFIX + 'unexpected response from Immich while searching random assets', response.status, response.statusText);
            }
        } catch(e) {
            Log.error(LOG_PREFIX + 'Oops!  Exception while fetching random images from Immich', e.message);
        }

        return imageList;
    },

    // Anniversary Search Assets using randomSearch API to query images taken on the same date range (of specified month) across multiple years.
    anniversarySearchAssets: async function (datesBack, datesForward, startYear, endYear, querySize, query) {
        let imageList = [];
        
        Log.debug(LOG_PREFIX + 'Searching for anniversary images:', { datesBack, datesForward, startYear, endYear, querySize, query });
        
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11
        const currentDay = today.getDate();
        
        try {
            // Calculate date range
            const startDate = new Date(today);
            startDate.setDate(currentDay - datesBack);
            const endDate = new Date(today);
            endDate.setDate(currentDay + datesForward);
            
            const startMonth = startDate.getMonth() + 1;
            const startDay = startDate.getDate();
            const endMonth = endDate.getMonth() + 1;
            const endDay = endDate.getDate();
            
            Log.debug(LOG_PREFIX + 'Anniversary date range: ', 
                `${startMonth.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')} to ${endMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`);
            
            // For each year in the range, search for images
            for (let year = startYear; year <= endYear; year++) {
                const yearStartDate = new Date(year, startMonth - 1, startDay);
                const yearEndDate = new Date(year, endMonth - 1, endDay);
                
                // Handle cross-month scenarios (e.g., July 29 - August 2)
                if (endDate.getDate() < startDate.getDate()) {
                    yearEndDate.setMonth(yearEndDate.getMonth() + 1);
                }
                
                const startDateString = yearStartDate.toISOString().split('T')[0];
                const endDateString = yearEndDate.toISOString().split('T')[0];
                
                Log.debug(LOG_PREFIX + `Searching for year ${year}: ${startDateString} to ${endDateString}`);
                
                const searchQuery = {};
                
                // Add any additional query parameters if provided
                if (query) {
                    Object.assign(searchQuery, query);
                }

                Object.assign(searchQuery, {
                    size: querySize,
                    takenAfter: startDateString + 'T00:00:00.000Z',
                    takenBefore: endDateString + 'T23:59:59.999Z'
                });
                
                try {
                    const response = await this.http.post(this.apiUrls[this.apiLevel]['randomSearch'], searchQuery, {responseType: 'json'});
                    
                    if (response.status === 200) {
                        const yearImages = response.data || [];
                        Log.debug(LOG_PREFIX + `Found ${yearImages.length} images for year ${year}`);
                        imageList = imageList.concat(yearImages);
                    } else {
                        Log.warn(LOG_PREFIX + `Unexpected response from Immich while searching anniversary assets for year ${year}`, response.status, response.statusText);
                    }
                } catch (yearError) {
                    Log.warn(LOG_PREFIX + `Exception while fetching anniversary images for year ${year}:`, yearError.message);
                }
            }
            
        } catch (e) {
            Log.error(LOG_PREFIX + 'Oops! Exception while fetching anniversary images from Immich:', e.message);
        }
        
        Log.debug(LOG_PREFIX + `Total anniversary images found: ${imageList.length}`);
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