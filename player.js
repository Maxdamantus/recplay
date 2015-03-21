define(["./levRender", "./recRender", "./objRender"], function(levRender, recRender, objRender){
	"use strict";

	function signum(n){
		return n < 0? -1 : n > 0? 1 : 0;
	}

	function pad(n, s){
		s = String(s);
		while(s.length < n)
			s = "0" + s;
		return s;
	}

	return function(levRd, lgr, makeCanvas){
		var replays, levRn, levDraw;
		var lastFrame;
		var refFrame, refTime;
		var invalidate;

		var focus; // whether focus is on replays[0]
		var offsX, offsY; // offset from start or replays[0]

		var playing;

		var startX, startY;

		var scale; // of Elma units, where 1 Elma unit is 48 px
		var speed; // where 1 is normal speed, -1 is reversed

		var defaultObjRn; // for when not spying

		reset();

		function reset(){
			replays = []; levRn = levRender(levRd, lgr); levDraw = levRn.cached(6, makeCanvas);
			lastFrame = 0;
			refFrame = 0; refTime = Date.now();
			invalidate = true;

			focus = true;
			offsX = 0; offsY = 0;

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

			scale = 1;
			speed = 1;

			defaultObjRn = objRender(levRd);
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
				return rp.rd.frameCount();
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
			setRef();
			console.log(n);
			return scale = n;
		}

		var dragging = false;

		// (w, h), size of canvas
		function inputClick(x, y, w, h){
			if(dragging)
				dragging = false;
			else
				changeFocus();
		}

		function inputDrag(x, y, w, h){
			if(y < 12 && replays.length > 0)
				return dragSeek(x, y, w, h);
			return dragPosition(x, y, w, h);
		}

		function dragPosition(x, y, w, h){
			var firstOx = offsX, firstOy = offsY;

			return {
				update: function(cx, cy){
					dragging = true;
					invalidate = true;
					offsX = firstOx - (cx - x)/(48*scale);
					offsY = firstOy - (cy - y)/(48*scale);
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
				lastFrame = replays[0].rd.frameCount()*cx/w;
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
			offsX = offsY = 0;
			if(replays.length > 0)
				replays.unshift(replays.pop());
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

			canv.clearRect(0, 0, w, h);

			var centreX = offsX, centreY = offsY;
			if(focus && replays.length > 0){
				var lf = Math.min(frame, replays[0].rd.frameCount() - 1);
				centreX += replays[0].rn.bikeXi(lf);
				centreY -= replays[0].rn.bikeYi(lf);
			}else{
				centreX += startX;
				centreY += startY;
			}

			var escale = 48*scale;
			var ex = centreX - w/escale/2, ey = centreY - h/escale/2;
			var ew = w/escale, eh = w/escale;

			levRn.drawSky(canv, ex, ey, ew, eh, escale);
			levDraw(canv, ex, ey, ew, eh, escale);
			if(focus && replays.length > 0)
				replays[0].objRn.draw(canv, lgr, Math.min(frame, replays[0].rd.frameCount() - 1), ex, ey, escale);
			else
				defaultObjRn.draw(canv, lgr, frame, ex, ey, escale);
			for(var z = replays.length - 1; z >= 0; z--)
				replays[z].rn.draw(canv, lgr, Math.min(frame, replays[z].rd.frameCount() - 1), ex, ey, escale);
			if(focus && replays.length > 0){
				var t = Math.floor(Math.min(frame, replays[0].rd.frameCount() - 1)*100/30);
				canv.font = "14px monospace";
				canv.fillStyle = "yellow";
				var csec = pad(2, t%100); t = Math.floor(t/100);
				var sec = pad(2, t%60); t = Math.floor(t/60);
				canv.fillText(t + ":" + sec + "." + csec, 10, 24);
				canv.fillText(replays[0].objRn.applesTaken(frame) + "/" + replays[0].objRn.appleCount(), 10, 38);
				canv.fillRect(w*frame/replays[0].rd.frameCount() - 2.5, 0, 5, 12);
			}
			invalidate = false;

			canv.restore();
		};

		return {
			changeLevel: function(levRd_){
				levRd = levRd_;
				reset();
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

			addReplay: function(recRd){
				if(replays.length == 0)
					setRef();
				replays.push({ rd: recRd, rn: recRender(recRd), objRn: objRender(levRd, recRd) });
				frameCount = calcFrameCount();
				invalidate = true;
			},

			changeFocus: changeFocus,

			setSpeed: setSpeed,

			inputKey: function(key){
				switch(key){
					case "space":
						playing = !playing;
						setRef();
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
						setScale(scale*0.8);
						break;
					case "e":
						setScale(scale/0.8);
						break;
					case "r":
						setSpeed(-speed);
						break;
					case "right":
						lastFrame += 30*2.5*speed;
						setRef();
						break;
					case "left":
						lastFrame -= 30*2.5*speed;
						setRef();
						break;
				}
			},

			inputClick: inputClick,
			inputDrag: inputDrag
		};
	};
});
