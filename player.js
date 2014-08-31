define(["./levRender", "./recRender", "./objRender"], function(levRender, recRender, objRender){
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
		var replays = [], levRn = levRender(levRd), levDraw = levRn.cached(2, makeCanvas);
		var lastFrame = 0;
		var refFrame = 0, refTime = Date.now();
		var invalidate = false;

		var focus = true; // whether focus is on replays[0]
		var offsX = 0, offsY = 0; // offset from start or replays[0]

		var playing = true;

		var startX = 0, startY = 0;
		void function(){
			function nvm(){}

			var l = levRd.objCount();
			for(var x = 0; x < l; x++)
				levRd.obj(x, nvm, nvm, nvm, function(x, y){
					startX = x;
					startY = y;
				});
		}();

		var scale = 1; // of Elma units, where 1 Elma unit is 48 px
		var speed = 1; // where 1 is normal speed, -1 is reversed

		function setRef(){
			refFrame = lastFrame;
			refTime = Date.now();
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

		function cap(max){
			return Math.min(lastFrame, max);
		}

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

		// (w, h), size of canvas
		function inputClick(x, y, w, h){
			changeFocus();
		}

		function changeFocus(){
			replays.unshift(replays.pop());
			invalidate = true;
		}

		return {
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
					var lf = cap(replays[0].rd.frameCount() - 1);
					centreX += replays[0].rn.bikeXi(lf);
					centreY -= replays[0].rn.bikeYi(lf);
				}else{
					centreX += startX;
					centreY += startY;
				}

				var escale = 48*scale;
				var ex = centreX - w/escale/2, ey = centreY - h/escale/2;
				var ew = w/escale, eh = w/escale;

				levRn.drawSky(canv, lgr, ex, ey, ew, eh, escale);
				levDraw(canv, lgr, ex, ey, ew, eh, escale);
				if(focus && replays.length > 0)
					replays[0].objRn.draw(canv, lgr, cap(replays[0].rd.frameCount() - 1), ex, ey, escale);
				for(var z = replays.length - 1; z >= 0; z--)
					replays[z].rn.draw(canv, lgr, cap(replays[z].rd.frameCount() - 1), ex, ey, escale);
				if(focus && replays.length > 0){
					var t = Math.floor(cap(replays[0].rd.frameCount() - 1)*100/30);
					canv.font = "14px monospace";
					canv.fillStyle = "yellow";
					var csec = pad(2, t%100); t = Math.floor(t/100);
					var sec = pad(2, t%60); t = Math.floor(t/60);
					canv.fillText(t + ":" + sec + "." + csec, 10, 24);
					canv.fillText(replays[0].objRn.applesTaken(lastFrame) + "/" + replays[0].objRn.appleCount(), 10, 38);
					canv.fillRect(w*lastFrame/replays[0].rd.frameCount() - 2.5, 0, 5, 12);
				}
				invalidate = false;

				canv.restore();
			},

			addReplay: function(recRd){
				if(replays.length == 0)
					setRef();
				replays.push({ rd: recRd, rn: recRender(recRd), objRn: objRender(levRd, recRd) });
				frameCount = calcFrameCount();
				invalidate = true;
			},

			changeFocus: changeFocus,

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

			inputClick: inputClick
		};
	};
});
