(function() {

	var content = $('#content');
	var video = $('#webcam')[0];
	var depth = $('#depth')[0];
	var canvasShadow = document.getElementById("canvas-shadow");
	var handtracker;
	var previousFinger;
	var currentFinger;
	var previousFoundFinger = false;
	var foundFinger = false;
	var DEPTH_THRESHOLD = 70;
	var MOVE_THRESHOLD = 5;

	var resize = function() {
		var w = $(this).width();
		var h = $(this).height() - 110;
		var ratio = video.width / video.height;
		if (content.width() > w) {
			content.width(w);
			content.height(w / ratio);
		}
		else {
			content.height(h);
			content.width(h * ratio);
		}
		content.css('left', (w - content.width()) / 2 );
		content.css('top', ((h - content.height()) / 2) + 55 );
	}
	$(window).resize(resize);
	$(window).ready(function() {
		resize();
		$('#watchVideo').click(function() {
			$(".browsers").fadeOut();
			$(".browsersWithVideo").delay(300).fadeIn();
			$("#video-demo").delay(300).fadeIn();
			$("#video-demo")[0].play();
			$('.backFromVideo').fadeIn();
			event.stopPropagation();
			return false;
		});
		$('.backFromVideo a').click(function() {
			$(".browsersWithVideo").fadeOut();
			$('.backFromVideo').fadeOut();
			$(".browsers").fadeIn();
			$("#video-demo")[0].pause();
			$('#video-demo').fadeOut();
			event.stopPropagation();
			return false;
		});
	});

	function hasGetUserMedia() {
		// Note: Opera builds are unprefixed.
		return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia || navigator.msGetUserMedia);
	}

	if (hasGetUserMedia()) {
		$('.introduction').fadeIn();
		$('.allow').fadeIn();
	} else {
		$('.browsers').fadeIn();
		return;
	}

	var webcamError = function(e) {
		alert('Webcam error!', e);
	};

	if (navigator.webkitGetUserMedia) {
		navigator.webkitGetUserMedia({video: true}, function(color_stream) {
			video.src = window.webkitURL.createObjectURL(color_stream);
			navigator.webkitGetUserMedia({video: { 'mandatory': { 'depth': "aligned"}}}, function(depth_stream) {
				depth.src = window.webkitURL.createObjectURL(depth_stream);
				initialize();
			}, webcamError);
		}, webcamError);
	} else {
		console.log("getUserMedia is not supported.")
	}

	var AudioContext = (
		window.AudioContext ||
		window.webkitAudioContext ||
		null
	);

	var timeOut, lastImageData;
	var canvasSource = $("#canvas-source")[0];
	var canvasBlended = $("#canvas-blended")[0];

	var contextSource = canvasSource.getContext('2d');
	var contextBlended = canvasBlended.getContext('2d');

	var soundContext;
	var bufferLoader;
	var notes = [];

	// mirror video
	contextSource.translate(canvasSource.width, 0);
	contextSource.scale(-1, 1);

	var c = 5;

	function initialize() {
		if (!AudioContext) {
			alert("AudioContext not supported!");
		}
		else {
			$('.introduction').fadeOut();
			$('.allow').fadeOut();
			$('.loading').delay(300).fadeIn();
			setTimeout(loadSounds, 1000);
		}
	}

	function loadSounds() {
		soundContext = new AudioContext();
		bufferLoader = new BufferLoader(soundContext,
			[
				'sounds/nota9.ogg',
				'sounds/nota10.ogg',
				'sounds/nota11.ogg',
				'sounds/nota12.ogg',
				'sounds/note5.ogg',
				'sounds/note6.ogg',
				'sounds/note7.ogg',
				'sounds/note8.ogg'
			],
			finishedLoading
		);
		bufferLoader.load();
	}

	function finishedLoading(bufferList) {
		for (var i=0; i<8; i++) {
			var source = soundContext.createBufferSource();
			source.buffer = bufferList[i];
			source.connect(soundContext.destination);
			var note = {
				note: source,
				ready: true,
				visual: $("#note" + i)
			};
			notes.push(note);
		}
		start();
	}

	function playSound(obj) {
		if (!obj.ready) return;
		var source = soundContext.createBufferSource();
		source.buffer = obj.note.buffer;
		source.connect(soundContext.destination);
		source.start(0);
		obj.ready = false;
		// throttle the note
		setTimeout(setNoteReady, 400, obj);
	}

	function setNoteReady(obj) {
		obj.ready = true;
	}

	function start() {
		//$("#footer .instructions").show();
		$('.loading').fadeOut();
		$('body').addClass('black-background');
		$(".instructions").delay(600).fadeIn();
		$(canvasShadow).delay(600).fadeIn();
		//$(canvasSource).delay(600).fadeIn();
		$(canvasBlended).delay(600).fadeIn();
		$("#xylo").delay(600).fadeIn();
		//$(".motion-cam").delay(600).fadeIn();

		handtracker = new HT.Tracker({depthThreshold: DEPTH_THRESHOLD, fast: true, fingers: true, simple: true});

		// Set rendering mode.
		// ShadowRenderer(depth, true, canvasShadow);
		ShadowRenderer(video, false, canvasShadow);

		updateFinger();
	}

	window.requestAnimFrame = (function(){
		return  window.requestAnimationFrame       ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame    ||
			window.oRequestAnimationFrame      ||
			window.msRequestAnimationFrame     ||
			function( callback ){
				window.setTimeout(callback, 1000 / 60);
			};
	})();

	function update() {
		drawVideo();
		blend();
		checkAreas();
		requestAnimFrame(update);
//		timeOut = setTimeout(update, 1000/60);
	}

	function updateFinger() {
		drawVideo();
		trackHand();
		drawHand();
		checkAreasForFinger();
		requestAnimFrame(updateFinger);
	}

	function drawVideo() {
		contextSource.drawImage(depth, 0, 0, depth.width, depth.height);
	}

	function createImageFromMask(mask, imageDst){
      var src = mask.data, dst = imageDst.data,
          width = mask.width, span = 4 * width,
          len = src.length, i = 0, j = 0, k = 0;
      
      for(i = 0; i < len; i += 1){
          dst[k] = dst[k + 1] = dst[k + 2] = src[i];
          dst[k + 3] = 255;
          k += 4;
      }
      
      return imageDst;
    };

    function drawHand() {
    	var width = canvasBlended.width;
		var height = canvasBlended.height;

		contextBlended.clearRect(0, 0, width, height);

    	var blendedData = contextBlended.createImageData(width, height);
        contextBlended.putImageData(createImageFromMask(handtracker.mask, blendedData), 0, 0);

        if (foundFinger) {
		    contextBlended.strokeStyle = "rgb(255,0,0)";
		    contextBlended.lineWidth = 4;
		    contextBlended.strokeRect(currentFinger.x - 6, currentFinger.y - 6, 12, 12);
		}
    }

	function trackHand() {
		var width = canvasSource.width;
		var height = canvasSource.height;
		// get webcam image data
		previousFoundFinger = foundFinger;
		foundFinger = false;
		var sourceData = contextSource.getImageData(0, 0, width, height);
		var candidate = handtracker.detect(sourceData);
      	if (candidate && candidate.fingers && candidate.fingers.length > 0) {
      		previousFinger = currentFinger;
        	currentFinger = candidate.fingers.sort(function(a, b) { return a.y - b.y; })[0];
        	foundFinger = true;
        }

        if (previousFoundFinger != foundFinger) {
        	if (foundFinger)
        		$(".motion-cam").fadeIn();
        	else
        		$(".motion-cam").fadeOut();
        }
	}

	function checkAreasForFinger() {
		if (typeof previousFinger != 'undefined' && foundFinger) {
			if (Math.abs(currentFinger.x - previousFinger.x) > MOVE_THRESHOLD ||
				Math.abs(currentFinger.y - previousFinger.y) > MOVE_THRESHOLD) {
				for (var r=0; r<8; ++r) {
					var note_x0 = 1/8*r*video.width;
					var note_x1 = 1/8*(r+1)*video.width;
					if (currentFinger.x > note_x0 && currentFinger.x < note_x1 && currentFinger.y < 100) {
						// over a small limit, consider that a movement is detected
						// play a note and show a visual feedback to the user
						playSound(notes[r]);
		//				notes[r].visual.show();
		//				notes[r].visual.fadeOut();
						if(!notes[r].visual.is(':animated')) {
							notes[r].visual.css({opacity:1});
							notes[r].visual.animate({opacity:0}, 700);
						}
					}
				}

			}
		}
	}

	function blend() {
		var width = canvasSource.width;
		var height = canvasSource.height;
		// get webcam image data
		var sourceData = contextSource.getImageData(0, 0, width, height);
		// create an image if the previous image doesn’t exist
		if (!lastImageData) lastImageData = contextSource.getImageData(0, 0, width, height);
		// create a ImageData instance to receive the blended result
		var blendedData = contextSource.createImageData(width, height);
		// blend the 2 images
		differenceAccuracy(blendedData.data, sourceData.data, lastImageData.data);
		// draw the result in a canvas
		contextBlended.putImageData(blendedData, 0, 0);
		// store the current webcam image
		lastImageData = sourceData;
	}

	function fastAbs(value) {
		// funky bitwise, equal Math.abs
		return (value ^ (value >> 31)) - (value >> 31);
	}

	function threshold(value) {
		return (value > 0x15) ? 0xFF : 0;
	}

	function difference(target, data1, data2) {
		// blend mode difference
		if (data1.length != data2.length) return null;
		var i = 0;
		while (i < (data1.length * 0.25)) {
			target[4*i] = data1[4*i] == 0 ? 0 : fastAbs(data1[4*i] - data2[4*i]);
			target[4*i+1] = data1[4*i+1] == 0 ? 0 : fastAbs(data1[4*i+1] - data2[4*i+1]);
			target[4*i+2] = data1[4*i+2] == 0 ? 0 : fastAbs(data1[4*i+2] - data2[4*i+2]);
			target[4*i+3] = 0xFF;
			++i;
		}
	}

	function differenceAccuracy(target, data1, data2) {
		if (data1.length != data2.length) return null;
		var i = 0;
		while (i < (data1.length * 0.25)) {
			var average1 = (data1[4*i] + data1[4*i+1] + data1[4*i+2]) / 3;
			var average2 = (data2[4*i] + data2[4*i+1] + data2[4*i+2]) / 3;
			var diff = threshold(fastAbs(average1 - average2));
			target[4*i] = diff;
			target[4*i+1] = diff;
			target[4*i+2] = diff;
			target[4*i+3] = 0xFF;
			++i;
		}
	}

	function checkAreas() {
		// loop over the note areas
		for (var r=0; r<8; ++r) {
			var blendedData = contextBlended.getImageData(1/8*r*video.width, 0, video.width/8, 100);
			var i = 0;
			var average = 0;
			// loop over the pixels
			while (i < (blendedData.data.length * 0.25)) {
				// make an average between the color channel
				average += (blendedData.data[i*4] + blendedData.data[i*4+1] + blendedData.data[i*4+2]) / 3;
				++i;
			}
			// calculate an average between of the color values of the note area
			average = Math.round(average / (blendedData.data.length * 0.25));
			if (average > 10) {
				// over a small limit, consider that a movement is detected
				// play a note and show a visual feedback to the user
				playSound(notes[r]);
//				notes[r].visual.show();
//				notes[r].visual.fadeOut();
				if(!notes[r].visual.is(':animated')) {
					notes[r].visual.css({opacity:1});
					notes[r].visual.animate({opacity:0}, 700);
				}

			}
		}
	}


})();