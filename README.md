# Module: Immich Slide Show

This is a MagicMirror module based on <a href="https://github.com/darickc/MMM-BackgroundSlideshow">MMM-BackgroundSlideshow</a> that works with <a href="https://immich.app/">Immich</a>.

The `MMM-ImmichSlideShow` module is designed to display images fullscreen, one at a time on a fixed interval, from <a href="https://immich.app/">Immich</a>. These images can be shown in order or at random. The images can transition from one to the other and be shown with no edge (cover) or the entire image (contain).  The configuration is also mostly matching MMM-Background.


<img src="images/screenshot.gif" style="width: 600px;" />

## Dependencies / Requirements

This module requires no special dependencies besides a working <a href="https://immich.app/">Immich</a> instance.

## Operation

This module will require the URL of your Immich instance and your API Key at a minimum. The module will display images from the past 7 days (default value) over the years. In either chronological, alphabetical or random order. Once all the images have been shown, it will loop back and start again after refreshing the images in case the date has changed.

Extra configurations include setting the amount of time an image is shown for, selecting which file extensions are valid, the transition speed from one image to another, the background sizing, and whether or not to animate the transition from one to the other.

**Note:**  This module attempts to sync all of its clients (i.e. display the same image on all clients), so the images are pushed from the server to the client.  Version 1.0.0+ ensures that if the server is restarted, the clients connect back.

## Using the module

Use Git to download. Make sure Git is installed on your system. In the command line/terminal, go to the modules directory of the your Magic Mirror install. run: `git clone https://github.com/pelaxa/MMM-ImmichSlideShow.git`. The advantage of using Git is when there is an update, you can run `git pull` and it will pull down all the updates. Magic Mirror can even let you know when there are updates.

Or

Download the zip file https://github.com/pelaxa/MMM-ImmichSlideShow/archive/main.zip. Unzip contents into the modules directory of your Magic Mirror install. Rename the 'MMM-ImmichSlideShow-main' folder to 'MMM-ImmichSlideShow'.

Once downloaded, install dependencies:

```
cd ~/MagicMirror/modules/MMM-ImmichSlideShow
```

```
npm install
```

Add the module to the modules array in the `config/config.js` file:

```javascript
modules: [
  {
    module: 'MMM-ImmichSlideShow',
    position: 'fullscreen_below',
    config: {
	  immichConfigs: [
		{
		  apiKey: '<Your API key>',
		  url: 'https://<Your Immich hostname/IP>:<port>',
		  mode: 'memory',
		  numDaysToInclude: 7,
		}
	  ],
	  transitionImages: true
    }
  }
];
```

I also recommend adding the following to the custom.css to make the text a little brighter:

```
.normal,
.dimmed,
header,
body {
    color: #fff;
}
```

## Notification options

The following notifications can be used:

<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Notification</th>
			<th width="100%">Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>IMMICHSLIDESHOW_UPDATE_IMAGE_LIST</code></td>
			<td>Reload images list and start slideshow from first image. Works best when sorted by modified date descending.<br>
			</td>
		</tr>
		<tr>
			<td><code>IMMICHSLIDESHOW_NEXT</code></td>
			<td>Change to the next image, restart the timer for image changes only if already running<br>
			</td>
		</tr>
		<tr>
			<td><code>IMMICHSLIDESHOW_PREVIOUS</code></td>
			<td>Change to the previous image, restart the timer for image changes only if already running<br>
			</td>
		</tr>
		<tr>
			<td><code>IMMICHSLIDESHOW_PAUSE</code></td>
			<td>Pause the timer for image changes<br>
			</td>
		</tr>
		<tr>
			<td><code>IMMICHSLIDESHOW_PLAY</code></td>
			<td>Change to the next image and start the timer for image changes<br>
			</td>
		</tr>
		<tr>
			<td><code>IMMICHSLIDESHOW_SET_ACTIVE_CONFIG</code></td>
			<td>Change the active configuration if you have more than one configuration.  This API expects a post and the index of the active configuration as post body.  See Example below<br>
			</td>
		</tr>
</table>

### Example Request for Changing Active Configuration
This requires [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control)
```bash
curl --location 'https://myimmich.server:443/api/notification/IMMICHSLIDESHOW_SET_ACTIVE_CONFIG' \
--header 'Authorization: Bearer <MyAPiKey>' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
    "data": 0
}'
```
## Configuration options

The following properties can be configured:
<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Option</th>
			<th>Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>immichConfigs</code></td>
			<td>This holds an array of immich configuration objects so that you can cahnge the configuration at runtime.  This is useful if you want to show one set of pictures when you are alone of have family and a different set when you have guests.  This was introduced in v1.1.0 and you will need to update your configuration to this new format.<br/>
			<br/>
			<b>Note:</b> So long as you provide the url and apiKey for the first configuration, it is not necessary for others, but if you do want to have a config that talks to a different Immich server, you have the option of including those as well.  The way the configurations work is that the first config has to be as specific as you like, and the other configs can just provide the changes needed since they just override the properties of the first config and pick up any missing properties from it.<br/>
			<br/>This value is <b>REQUIRED</b><br/>
			See <b>Immich Configuration Options</b> below<br/>	
			</td>
		</tr>
        <tr>
			<td><code>activeImmichConfigIndex</code></td>
			<td>Integer value indicating which of the Immich configurations (immichConfigs) is active.  This can be changed at run time as well and defaults to 0 if not provided.<br>
				<br><b>Example:</b> <code>1</code>
				<br><b>Default value:</b> <code>0</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
        <tr>
			<td><code>validImageFileExtensions</code></td>
			<td>String value, a list of image file extensions, separated by commas, that should be included. Files found without one of the extensions will be ignored.  Note that you can include HEIC as a valid extension but beware that the conversion time may be noticeable based on your server and its horsepower.<br>
				<br><b>Example:</b> <code>'png,jpg'</code>
				<br><b>Default value:</b> <code>'bmp,jpg,jpeg,gif,png'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>showImageInfo</code></td>
			<td>Boolean value, if true a div containing the currently displayed image information will be shown.<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>imageCompression</code></td>
			<td>A value between 0 and 1 that determines the compression level of JPEG images when images need to be converted (e.g. HEIC images)<br>
				<br><b>Example:</b> <code>0.7</code>
				<br><b>Default value:</b> <code>0.7</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>imageInfoLocation</code></td>
			<td>String value, determines which corner of the screen the image info div should be displayed in.  Possible values are: bottomRight, bottomLeft, topLeft, topRight<br>
				<br><b>Example:</b> <code>topLeft</code>
				<br><b>Default value:</b> <code>bottomRight</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>imageInfoNoFileExt</code></td>
			<td>Boolean value, if true the file extension will be removed before the image name is displayed.
			<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>    	<tr>
			<td><code>transitionSpeed</code></td>
			<td>Transition speed from one image to the other, transitionImages must be true. Must be a valid css transition duration.<br>
				<br><b>Example:</b> <code>'2s'</code>
				<br><b>Default value:</b> <code>'1s'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>showProgressBar</code></td>
			<td>Boolean value, if true a progress bar indicating how long till the next image is
			displayed is shown.<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    	<tr>
			<td><code>backdropFilter</code></td>
			<td>The filter to apply to the background.  This is useful when using a semi-transparent background color so that the items behind the background are filtered.<br>
        This can be set to any valid <a target="backdrop_filter" href="https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter">CSS backdrop-filter</a> value (e.g. 'blur(10px)')<br>
				<br><b>Example:</b> <code>'blur(10px)'</code>
				<br><b>Default value:</b> <code>'blur(5px)</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    	<tr>
			<td><code>backgroundColor</code></td>
			<td>The color of the background when the image does not cover the entire screen.<br>
        This can be set to a color (e.g. '#000000') or and semi-transparent color (e.g. 'rgba(0,0,0,0.5)')<br>
				<br><b>Example:</b> <code>'rgba(0,0,0,0.5)'</code>
				<br><b>Default value:</b> <code>'#000' (i.e. black)</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    	<tr>
			<td><code>backgroundSize</code></td>
			<td>The sizing of the background image. Values can be:<br>
        cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges.<br>
        contain: Resize the background image to make sure the image is fully visible<br>
				<br><b>Example:</b> <code>'contain'</code>
				<br><b>Default value:</b> <code>'cover'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    	<tr>
			<td><code>backgroundSize</code></td>
			<td>The sizing of the background image. Values can be:<br>
        cover: Resize the background image to cover the entire container, even if it has to stretch the image or cut a little bit off one of the edges.<br>
        contain: Resize the background image to make sure the image is fully visible<br>
				<br><b>Example:</b> <code>'contain'</code>
				<br><b>Default value:</b> <code>'cover'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    	<tr>
			<td><code>backgroundPosition</code></td>
			<td>Determines where the background image is placed if it doesn't fill the whole screen (i.e. backgroundSize is 'contain'). Module already defaults to 'center', so the most useful options would be: 'top' 'bottom' 'left' or 'right'. However, any valid value for CSS background-position could be used.<br>
				<br><b>Example:</b> <code>'top'</code>
				<br><b>Default value:</b> <code>'center'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>backgroundAnimationEnabled</code></td>
			<td>Boolean value, if set to true the background will scroll if the picture is larger than the screen size (e.g. for panaramic pictures).  The picture will either scroll vertically or horizontally depending on which dimension extends beyond the screen size.
			<b>Note:</b> For this to work, backgroundSize must be set to cover.<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    	<tr>
			<td><code>transitionImages</code></td>
			<td>Transition from one image to the other (may be a bit choppy on slower devices, or if the images are too big).<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>transitions</code></td>
			<td>Array value containing strings defining what transitions to perform.
			<b>Note:</b> transitionImages must be set to true.<br>
				<br><b>Example:</b> <code>['opacity', 'slideFromLeft']</code>
				<br><b>Default value:</b> <code>['opacity', 'slideFromRight', 'slideFromLeft', 'slideFromTop', 'slideFromBottom', 'slideFromTopLeft', 'slideFromTopRight', 'slideFromBottomLeft', 'slideFromBottomRight', 'flipX', 'flipY']</code>
				<br><b>Possible values:</b> <code>'opacity', 'slideFromRight', 'slideFromLeft', 'slideFromTop', 'slideFromBottom', 'slideFromTopLeft', 'slideFromTopRight', 'slideFromBottomLeft', 'slideFromBottomRight', 'flipX', 'flipY'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>transitionTimingFunction</code></td>
			<td>CSS timing function used with transitions.
			<b>Note:</b> transitionImages must be set to true.<br>
				<br><b>Example:</b> <code>'ease-in</code>
				<br><b>Default value:</b> <code>'cubic-bezier(.17,.67,.35,.96)'</code>
				<br><b>Possible values:</b> <code>'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(n,n,n,n)'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>animations</code></td>
			<td>Array value containing strings defining what animations to perform.
			<b>Note:</b> backgroundAnimationEnabled must be set to true.<br>
				<br><b>Example:</b> <code>'ease-in</code>
				<br><b>Default value:</b> <code>['slide', 'zoomOut', 'zoomIn']</code>
				<br><b>Possible values:</b> <code>'slide', 'zoomOut', 'zoomIn'</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>changeImageOnResume</code></td>
			<td>Should the image be changed in the moment the module resumes after it got hidden?
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
    </tbody>
</table>

### Immich Configuration Options
<table style="max-width: none; width: auto;">
	<thead>
		<tr>
			<th>Option</th>
			<th>Description</th>
		</tr>
	<thead>
	<tbody>
		<tr>
			<td><code>url</code></td>
			<td>The base URL of your Immich installation (used to be called <i>immichUrl</i> prior to version 1.1.0).  a /api context will be appended to this URL to access the Immich API.<br>
				<br><b>Example:</b> <code>https://myimmich.server:443</code>
				<br>This value is <b>REQUIRED</b>
			</td>
		</tr>
		<tr>
			<td><code>apiKey</code></td>
			<td>The API key to use when accessing the Immich server.  Without this all the calls will fail. See the Creating an API Key section.<br>
				<br><b>Example:</b> <code>MyAPiKey</code>
				<br>This value is <b>REQUIRED</b>
			</td>
		</tr>
		<tr>
			<td><code>timeout</code></td>
			<td>The timeout for Immich API calls in milliseconds (used to be called <i>immichTimeout</i> prior to version 1.1.0).<br>
				<br><b>Example:</b> <code>10000</code>
				<br><b>Default value:</b> <code>6000</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>mode</code></td>
			<td>The mode of operation for the module.  Valid options are 'memory' or 'album' and depending on which is chosen, additional settings are required.<br>
				<br><b>Example:</b> <code>memory</code> for memory mode
				<br>This value is <b>REQUIRED</b>
			</td>
		</tr>
		<tr>
			<td><code>numDaysToInclude</code></td>
			<td>The number of days to go back and collect images for.  Use this to make sure you always have images to display since there could be days where no pictures were taken over the years.<br>
				<br><b>Example:</b> <code>7</code> for 7 days
				<br>This value is <b>REQUIRED</b> if <i>mode</i> is set to <i>memory</i>
			</td>
		</tr>
		<tr>
			<td><code>albumId</code></td>
			<td>The id of the album to show pictures from. Note that if <i>albumId</i> and <i>albumName</i> are provided, <i>albumId</i> will take precedence.<br>
				<br><b>Example:</b> <code>1b57d1dc-57d6-4cd4-bc1d-f8ebf759ba16</code>
				<br>This value is <b>REQUIRED</b> if <i>mode</i> is set to <i>album</i> and <i>albumName</i> is not provided.
			</td>
		</tr>
		<tr>
			<td><code>albumName</code></td>
			<td>The id of the album to show pictures from.  This name is case sensitive and should match the album name in Immich exactly.  Note that if <i>albumId</i> and <i>albumName</i> are provided, <i>albumId</i> will take precedence.<br>
				<br><b>Example:</b> <code>Family Trip 2023</code>
				<br>This value is <b>REQUIRED</b> if <i>mode</i> is set to <i>album</i> and <i>albumId</i> is not provided.
			</td>
		</tr>
		<tr>
			<td><code>sortImagesBy</code></td>
			<td>String value, determines how images are sorted.  Possible values are: name (by file name), created (by Immich created time), modified (by Immich modified time), taken (by original date of the image based on Exif data), random (by random order), none (default chronological day order, meaning all images for the 1st over the years before the images for the 2nd, etc).<br>
				<br><b>Example:</b> <code>created</code>
				<br><b>Default value:</b> <code>none</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>sortImagesDescending</code></td>
			<td>Boolean value, if true will sort images in descending order, otherwise in ascending order.<br>
				<br><b>Example:</b> <code>true</code>
				<br><b>Default value:</b> <code>false</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>imageInfo</code></td>
			<td>A list of image properties to display in the image info div.  Possible values are : <code>date</code> (EXIF date from image), <code>name</code> (image name), <code>since</code> (how long ago the picture was taken), <code>geo</code> (the city and country where the picture was taken if available), <code>people</code> (the name of the people in the picture. Use <code>people_skip</code> instead to not show extra separators for recognized faces with no name), <code>age</code> (The age of the people at the time the photo was taken.  Only works if <code>people</code> is also added), and <code>desc</code> (The description of the image if one is available).
			The values can be provided as an array of strings or as a space separated list string and the order that you provide this info is how it will display (top to bottom).<br/>
			<b>Note</b>: providing too many options here may take up a large portion of the screen.<br/>
				<br><b>Example:</b> <code>'date name people age'</code> or <code>[ 'date', 'name', 'people', 'age']</code>
				<br><b>Default value:</b> <code>['date', 'since']</code>
				<br>This value is <b>OPTIONAL</b>
			</td>
		</tr>
	</tbody>
</table>


### Configuration Example
```javascript
...
modules: [
    {
      module: 'MMM-ImmichSlideShow',
      position: 'fullscreen_below',
      config: {
        immichConfigs: [
          {
            apiKey: 'xxxxxxx',
            url: 'https://myimmich.server:443',
            mode: 'memory',
            imageInfo: 'date since geo people',
          },
          {
            albumId: 'xxxxxxx-yyyy-zzzz-aaaa-bbbbbbbb',
            mode: 'album',
            slideshowSpeed: 6000,
            imageInfo: 'date since geo',
          }
        ],
        activeImmichConfigIndex: 0,
        showImageInfo: true,
        showProgressBar: true,
        sortImagesBy: 'taken',
        sortImagesDescending: true,
        validImageFileExtensions: 'jpg,jpeg,png,gif,bmp,heic',
        slideshowSpeed: 30000,
        backgroundPosition: 'top',
        backgroundAnimationEnabled:true,
        backgroundSize: 'cover',
        backgroundColor: 'rgba(0,0,0,.5)',
        bacldropFilter: 'blur(10px)',
        animations: [
          'slide'
        ]
      }
    },
	...
]
```

## Creating an API Key

To get an API Key:
1. Login to your Immich instance
2. Click on your username in the top right cornder
3. Select `Account Settings`.
4. Expand the `API Keys` section.
5. Click `New API Key` to create a new API.
6. Paste the API Key into the module configuration for Magic Mirror.