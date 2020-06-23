"use strict";

var levRnd = require("./levRender");
var recRnd = require("./recRender");
var objRnd = require("./objRender");

function signum(n){
	return n < 0? -1 : n > 0? 1 : 0;
}

function pad(n, s){
	s = String(s);
	while(s.length < n)
		s = "0" + s;
	return s;
}

exports.make = function(levRd, lgr, makeCanvas){
	var replays, levRn;
	var lastFrame;
	var refFrame, refTime;
	var invalidate;

	var viewports;

	var focus; // whether focus is on replays[0]

	var playing;

	var startX, startY;

	var zoom; // scale = 0.8^zoom, of Elma units, where 1 Elma unit is 48 px
	var speed; // where 1 is normal speed, -1 is reversed

	var defaultObjRn; // for when not spying

	// levRender options; makes sense to persist these
	var optGrass = true;
	var optPictures = true;
	var optCustomBackgroundSky = true;

	reset();

	function reset(){
		replays = []; levRn = levRnd.renderer(levRd, lgr);
		updateLevOpts();
		lastFrame = 0;
		refFrame = 0; refTime = Date.now();
		invalidate = true;

		viewports = [];

		focus = true;

		playing = true;

		startX = 0; startY = 0;
		void function(){
			function nvm(){}

			var l = levRd.objCount();
			for(var x = 0; x < l; x++)
				levRd.obj(x, nvm, nvm, nvm, function(x, y){
					startX = x;
					startY = y;
				});
		}();

		zoom = 0;
		speed = 1;

		defaultObjRn = objRnd.renderer(levRd);
	}

	function updateLevOpts(){
		levRn.setGrass(optGrass);
		levRn.setPictures(optPictures);
		levRn.setCustomBackgroundSky(optCustomBackgroundSky);
	}

	function getViewport(n){
		if(!viewports[n])
			viewports[n] = {
				offsX: 0, offsY: 0,
				// hack! Firefox seems to perform a lot better without the cache
				// suspect it has to do with the offscreen antialiasing it's doing
				levRn: levRn.cached(4, makeCanvas)
			};
		return viewports[n];
	}

	function setRef(){
		refFrame = lastFrame;
		refTime = Date.now();
		invalidate = true;
	}

	function calcFrameCount(){
		if(replays.length == 0)
			return 60*30; // animate objects for a minute
		return replays.map(function(rp){
			return rp.frameCount;
		}).reduce(function(a, b){
			return Math.max(a, b);
		}, 0) + 30;
	}

	var frameCount = calcFrameCount();

	function setSpeed(n){
		if(n == 0)
			return;
		setRef();
		console.log(n);
		return speed = n;
	}

	function setScale(n){
		if(n == 0)
			return;
		setZoom(Math.log(n)/Math.log(0.8));
		return n;
	}

	function setZoom(n){
		zoom = n;
		setRef();
		console.log(n);
		return zoom = n;
	}

	function getScale(){
		return Math.pow(0.8, zoom);
	}

	var dragging = false;

	// (w, h), size of canvas
	function inputClick(x, y, w, h){
		if(dragging)
			dragging = false;
		else
			changeFocus();
	}

	function inputWheel(x, y, w, h, delta){
		// was planning on making it zoom around the cursor, but
		// .. what if there are multiple viewports?
		setZoom(zoom + signum(delta));
	}

	function inputDrag(x, y, w, h){
		if(y < 12 && replays.length > 0)
			return dragSeek(x, y, w, h);
		return dragPosition(x, y, w, h);
	}

	function dragPosition(x, y, w, h){
		var vp = focus && replays.length > 0?
			getViewport(Math.floor(y/h*replays[0].subs.length)) :
			getViewport(0);

		var firstOx = vp.offsX, firstOy = vp.offsY;

		return {
			update: function(cx, cy){
				dragging = true;
				invalidate = true;
				vp.offsX = firstOx - (cx - x)/(48*getScale());
				vp.offsY = firstOy - (cy - y)/(48*getScale());
			},

			end: function(){}
		};
	}

	function dragSeek(x, y, w, h){
		var firstPlaying = playing;
		playing = false;

		function update(cx, cy){
			dragging = true;
			if(replays.length == 0)
				return;
			lastFrame = replays[0].frameCount*cx/w;
			if(lastFrame < 0)
				lastFrame = 0;
			if(lastFrame >= frameCount)
				lastFrame = frameCount - 1;
			setRef();
		}

		update(x, y);

		return {
			update: update,

			end: function(){
				playing = firstPlaying;
				setRef();
			}
		};
	}

	function changeFocus(){
		invalidate = true;
		if(replays.length > 0)
			replays.unshift(replays.pop());
		for(var z = 0; z < viewports.length; z++)
			viewports[z].offsX = viewports[z].offsY = 0;
	}

	function playPause(){
		playing = !playing;
		setRef();
	}

	function arrow(str){
		if(str == "up") return "\u2191";
		if(str == "down") return "\u2193";
		if(str == "left") return "\u2190";
		if(str == "right") return "\u2192";
		return "";
	}

	function eround(n){
		var escale = 48*getScale();
		return Math.round(n*escale)/escale;
	}

	function drawViewport(vp, canv, x, y, w, h, frame, topRec){
		canv.save();
			canv.translate(x, y);
			canv.beginPath();
			canv.moveTo(0, 0);
			canv.lineTo(w, 0);
			canv.lineTo(w, h);
			canv.lineTo(0, h);
			canv.clip();

			var centreX = vp.offsX, centreY = vp.offsY;
			if(topRec){
				var lf = Math.min(frame, topRec.rd.frameCount() - 1);
				centreX += topRec.rn.bikeXi(lf);
				centreY -= topRec.rn.bikeYi(lf);
			}else{
				centreX += startX;
				centreY += startY;
			}

			var escale = 48*getScale();
			var ex = eround(centreX - w/escale/2), ey = eround(centreY - h/escale/2);
			var ew = eround(w/escale), eh = eround(h/escale);

			levRn.drawSky(canv, ex, ey, ew, eh, escale);
			vp.levRn(canv, ex, ey, ew, eh, escale);
			if(focus && replays.length > 0)
				replays[0].objRn.draw(canv, lgr, Math.min(frame, replays[0].frameCount - 1), ex, ey, ew, eh, escale);
			else
				defaultObjRn.draw(canv, lgr, frame, ex, ey, ew, eh, escale);
			for(var z = replays.length - 1; z >= 0; z--){
				for(var zx = replays[z].subs.length - 1; zx >= 0; zx--){
					var rec = replays[z].subs[zx];
					if(rec != topRec) // object identity
						rec.rn.draw(canv, lgr, rec.shirt, Math.min(frame, rec.rd.frameCount() - 1), ex, ey, escale);
				}
			}
			if(topRec)
				topRec.rn.draw(canv, lgr, topRec.shirt, Math.min(frame, topRec.rd.frameCount() - 1), ex, ey, escale);
		canv.restore();
	}

	function drawFrame(canv, x, y, w, h, frame){
		x = Math.floor(x); y = Math.floor(y);
		w = Math.floor(w); h = Math.floor(h);
		canv.save();
			canv.translate(x, y);
			canv.beginPath();
			canv.moveTo(0, 0);
			canv.lineTo(w, 0);
			canv.lineTo(w, h);
			canv.lineTo(0, h);
			canv.clip();

			canv.fillStyle = "yellow";
			canv.fillRect(0, 0, w, h);

			if(focus && replays.length > 0){
				var vph = Math.floor(h/replays[0].subs.length);
				// the last viewport gets an extra pixel when h%2 == .subs.length%2
				for(var z = 0; z < replays[0].subs.length; z++)
					drawViewport(getViewport(z), canv, 0, z*vph, w, vph - (z < replays[0].subs.length - 1), frame, replays[0].subs[z]);
				var t = Math.floor(Math.min(frame, replays[0].frameCount - 1)*100/30);
				canv.font = "14px monospace";
				canv.fillStyle = "yellow";
				var csec = pad(2, t%100); t = Math.floor(t/100);
				var sec = pad(2, t%60); t = Math.floor(t/60);
				canv.fillText(t + ":" + sec + "." + csec, 10, 12*2);
				canv.fillText(replays[0].objRn.applesTaken(frame) + "/" + replays[0].objRn.appleCount(), 10, 12*3);
//				canv.fillText(arrow(replays[0].objRn.gravity(frame, 0)), 10, 12*4);
				canv.fillRect(w*frame/replays[0].frameCount - 2.5, 0, 5, 12);
			}else
				drawViewport(getViewport(0), canv, x, y, w, h, frame, null);
			invalidate = false;
		canv.restore();
	};

	return {
		changeLevel: function(levRd_){
			levRd = levRd_;
			reset();
		},

		reset: reset,

		getLevel: function(){
			return levRd;
		},

		drawFrame: drawFrame,

		draw: function(canv, x, y, w, h, onlyMaybe){
			var curFrame = refFrame + playing*(Date.now() - refTime)*speed*30/1000;
			if(replays.length > 0){
				while(frameCount && curFrame >= frameCount){
					curFrame = refFrame = curFrame - frameCount;
					refTime = Date.now();
				}
				while(frameCount && curFrame < 0){
					curFrame = refFrame = frameCount + curFrame;
					refTime = Date.now();
				}
			}

			if(onlyMaybe && lastFrame == curFrame && !invalidate)
				return;
			lastFrame = curFrame;

			drawFrame(canv, x, y, w, h, lastFrame);
		},

		// shirts should be created by lgr.lazy
		addReplay: function(recRd, shirts){
			if(replays.length == 0){
				lastFrame = 0;
				setRef();
			}
			var replay = { objRn: objRnd.renderer(levRd, recRd), subs: [] };
			while(recRd){
				replay.subs.push({ rd: recRd, rn: recRnd.renderer(recRd), objRn: objRnd.renderer(levRd, recRd), shirt: shirts[0] || null });
				recRd = recRd.next;
				shirts = shirts.slice(1);
			}
			replay.frameCount = replay.subs.reduce(function(a, b){
				return Math.max(a, b.rd.frameCount());
			}, 0);
			replays.push(replay);
			frameCount = calcFrameCount();
			invalidate = true;
		},

		changeFocus: changeFocus,

		setSpeed: setSpeed,
		setScale: setScale,
		setZoom: setZoom,
		speed: function(){ return speed; },
		// scale is deprecated, should prefer to use zoom instead
		scale: function(){ return getScale(); },
		zoom: function(){ return zoom; },

		setLevOpts: function(o){
			if("grass" in o)
				optGrass = o.grass;
			if("pictures" in o)
				optPictures = o.pictures;
			if("customBackgroundSky" in o)
				optCustomBackgroundSky = o.customBackgroundSky;
			updateLevOpts();
		},

		setFrame: function(s){
			lastFrame = s;
			setRef();
		},
		frame: function(){
			return lastFrame; // TODO: this is a hack
		},

		playPause: playPause,
		playing: function(){ return playing; },

		inputKey: function(key){
			switch(key){
				case "space":
					playPause();
					break;
				case "[":
					setSpeed(speed*0.8); // 0.8^n is actually representable
					break;
				case "]":
					setSpeed(speed/0.8);
					break;
				case "backspace":
					setSpeed(signum(speed));
					break;
				case "w":
					setZoom(zoom + 1);
					break;
				case "e":
					setZoom(zoom - 1);
					break;
				case "r":
					setSpeed(-speed);
					break;
				case "p":
					var val = !optCustomBackgroundSky;
					optPictures = optCustomBackgroundSky = val;
					updateLevOpts();
					break;
				case "g":
					optGrass = !optGrass;
					updateLevOpts();
					break;
				case "G":
					optGrass = optPictures = optCustomBackgroundSky = true;
					updateLevOpts();
					break;
				case "right":
					lastFrame += 30*2.5*speed;
					setRef();
					break;
				case "left":
					lastFrame -= 30*2.5*speed;
					setRef();
					break;
				default:
					return false;
			}
			return true;
		},

		inputClick: inputClick,
		inputDrag: inputDrag,
		inputWheel: inputWheel,

		invalidate: function(){
			invalidate = true;
		}
	};
};
