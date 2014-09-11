define([], function(){
	function hypot(a, b){
		return Math.sqrt(a*a + b*b);
	}

	// (x1, y1)–(x2, y2): line to draw image along
	// bx: length of image used before (x1, y1)
	// br: length of image used after (x2, y2)
	// by: proportional (of ih) y offset within the image the line is conceptually along
	// ih: image height
	function skewimage(canv, img, bx, by, br, ih, x1, y1, x2, y2){
		var o = x2 - x1, a = y2 - y1;
		canv.save();
		canv.translate(x1, y1);
		canv.rotate(Math.atan2(a, o));
		canv.translate(-bx, -by*ih);
		canv.scale(bx + br + hypot(o, a), ih);
		img.draw(canv);
		canv.restore();
		return;
		canv.strokeStyle = "green";
		canv.lineWidth = 1/40;
		canv.strokeRect(0, 0, 1, 1);
	}

	function target(canv, x, y, s){
		canv.beginPath();
		canv.moveTo(x - s/2, y);
		canv.lineTo(x + s/2, y);
		canv.moveTo(x, y - s/2);
		canv.lineTo(x, y + s/2);
		canv.stroke();
	}

	function limb(cwInner, fstParams, sndParams){
		var fstLen = fstParams.length, sndLen = sndParams.length;

		return function(canv, fstImg, x1, y1, sndImg, x2, y2){
			var dist = hypot(x2 - x1, y2 - y1);

			var prod =
				(dist + fstLen + sndLen)*
				(dist - fstLen + sndLen)*
				(dist + fstLen - sndLen)*
				(-dist + fstLen + sndLen);
			var angle = Math.atan2(y2 - y1, x2 - x1);
			var jointangle = 0;
			if(prod >= 0){
				// law of sines
				var circumr = dist*fstLen*sndLen/Math.sqrt(prod);
				jointangle = Math.asin(sndLen/(2*circumr));
			}else
				fstLen = fstLen/(fstLen + sndLen)*dist;

			if(cwInner)
				jointangle *= -1;
				
			var jointx = x1 + fstLen*Math.cos(angle + jointangle);
			var jointy = y1 + fstLen*Math.sin(angle + jointangle);

			skewimage(canv, fstImg, fstParams.bx, fstParams.by, fstParams.br, fstParams.ih, jointx, jointy, x1, y1);
			skewimage(canv, sndImg, sndParams.bx, sndParams.by, sndParams.br, sndParams.ih, x2, y2, jointx, jointy);
		};

	}

	var legLimb = limb(false, {
		length: 26.25/48,
		bx: 0, by: 0.6, br: 6/48, ih: 39.4/48/3
	}, {
		length: 1 - 26.25/48,
		bx: 5/48/3, by: 0.45, br: 4/48, ih: 60/48/3
	});


	var armLimb = limb(true, {
		length: 16.25/48,
		bx: 12.2/48/3, by: 0.5, br: 13/48/3, ih: -32/48/3
	}, {
		length: 16.25/48,
		bx: 3/48, by: 0.5, br: 13.2/48/3, ih: 22.8/48/3
	});

	return function recRender(reader){
		var turnFrames = function(){
			var fc = reader.frameCount();
			var o = [], t = 0;
			for(var f = 0; f < fc; f++){
				var tmp = reader.turn(f) >> 1 & 1;
				if(tmp != t)
					o.push(f);
				t = tmp;
			}
			return o;
		}();

		var volts = function(){
			var ec = reader.eventCount();
			var o = [];
			for(var e = 0; e < ec; e++)
				reader.event(e, function(time, info, type, a, b){
						switch(type){
							case 6: // right volt
								o.push([Math.floor(time/.01455976568094950714), true]);
								break;
							case 7: // left volt
								o.push([Math.floor(time/.01455976568094950714), false]);
								break;
						}
				});
				return o;
		}();

		function lastTurn(frame){
			for(var x = 0; x < turnFrames.length; x++)
				if(turnFrames[x] > frame)
					break;
			return x? turnFrames[x - 1] : -1;
		}

		function lastVolt(frame){
			for(var x = 0; x < volts.length; x++)
				if(volts[x][0] > frame)
					break;
			return x? volts[x - 1] : null;
		}

		function interpolate(fn){
			return function(n){
				var f = Math.floor(n), o = n - f, r = fn(f);
				if(o == 0)
					return r;
				return r + (fn(f + 1) - r)*o;
			};
		}

		function interpolateAng(fn, mod){
			return function(n){
				var f = Math.floor(n), o = n - f, r = fn(f);
				if(o == 0)
					return r;
				var rs = fn(f + 1), offs = 0;
				var diff1 = rs - r, diff2 = (rs + mod/2)%mod - (r + mod/2)%mod;
				var diff = Math.abs(diff1) < Math.abs(diff2)? diff1 : diff2;
				return r + diff*o;
			};
		}

		var bikeXi = interpolate(reader.bikeX);
		var bikeYi = interpolate(reader.bikeY);
		var bikeRi = interpolateAng(reader.bikeR, 10000);
		var leftXi = interpolate(reader.leftX);
		var leftYi = interpolate(reader.leftY);
		var leftRi = interpolateAng(reader.leftR, 250);
		var rightXi = interpolate(reader.rightX);
		var rightYi = interpolate(reader.rightY);
		var rightRi = interpolateAng(reader.rightR, 250);
		var headXi = interpolate(reader.headX);
		var headYi = interpolate(reader.headY);

		console.log(turnFrames);
		console.log(volts);
		// (x, y): top left in Elma coordinates
		function draw(canv, lgr, frame, x, y, scale){
			canv.save();
				canv.translate(/*Math.ceil*/(scale*(-x + bikeXi(frame))), /*Math.ceil*/(scale*(-y - bikeYi(frame))));
				canv.scale(scale, scale);
				canv.beginPath();

				var bikeR = bikeRi(frame)*Math.PI*2/10000;
				var turn = reader.turn(Math.floor(frame)) >> 1 & 1;
				var leftX = leftXi(frame)/1000;
				var leftY = leftYi(frame)/1000;
				var leftR = leftRi(frame)*Math.PI*2/250;
				var rightX = rightXi(frame)/1000;
				var rightY = rightYi(frame)/1000;
				var rightR = rightRi(frame)*Math.PI*2/250;
				var headX = headXi(frame)/1000;
				var headY = headYi(frame)/1000;
				var lastTurnF = lastTurn(Math.floor(frame));

				canv.save(); // left wheel
					canv.translate(leftX, -leftY);
					canv.rotate(-leftR);
					canv.scale(38.4/48, 38.4/48);
					canv.translate(-0.5, -0.5);
					lgr.wheel.draw(canv);
				canv.restore();

				canv.save(); // right wheel
					canv.translate(rightX, -rightY);
					canv.rotate(-rightR);
					canv.scale(38.4/48, 38.4/48);
					canv.translate(-0.5, -0.5);
					lgr.wheel.draw(canv);
				canv.restore();

				canv.save();
					canv.rotate(-bikeR);
					if(turn)
						canv.scale(-1, 1);
					if(lastTurnF >= 0 && lastTurnF + 25 > frame) // TODO: it's not linear
						canv.scale(((frame - lastTurnF)/25 - 0.5)*2, 1);

					var wx, wy, a, r;
					var hbarsX = -21.5, hbarsY = -17;
					canv.save();
						canv.scale(1/48, 1/48);

						// front suspension
						wx = turn? rightX : leftX;
						wy = turn? -rightY : -leftY;
						a = Math.atan2(wy, (turn? -1 : 1) * wx) + (turn? -1 : 1) * bikeR;
						r = hypot(wx, wy);
						skewimage(canv, lgr.susp1, 2, 0.5, 5, 6, 48*r * Math.cos(a), 48*r * Math.sin(a), hbarsX, hbarsY);

						// rear suspension
						wx = turn? leftX : rightX;
						wy = turn? -leftY : -rightY;
						a = Math.atan2(wy, (turn? -1 : 1) * wx) + (turn? -1 : 1) * bikeR;
						r = hypot(wx, wy);
						//skewimage(canv, lgr.susp2, 5, 0.5, 5, 6.5, 48*r*Math.cos(a), 48*r*Math.sin(a), 10, 20);
						skewimage(canv, lgr.susp2, 0, 0.5, 5, 6, 9, 20, 48*r*Math.cos(a), 48*r*Math.sin(a));
					canv.restore();

					canv.save(); // bike
						canv.translate(-43/48, -12/48);
						canv.rotate(-Math.PI*0.197);
						canv.scale(0.215815*380/48, 0.215815*301/48);
						lgr.bike.draw(canv);
					canv.restore();

					canv.save(); // kuski
						r = hypot(headX, headY);
						a = Math.atan2(-headY, turn? -headX : headX) + (turn? -bikeR : bikeR);
						wx = r*Math.cos(a);
						wy = r*Math.sin(a);
						canv.translate(wx, wy);

						canv.save(); // head
							canv.translate(-15.5/48, -42/48);
							canv.scale(23/48, 23/48);
							lgr.head.draw(canv);
						canv.restore();

						var bumx = 19.5/48, bumy = 0;
						var pedalx = -wx + 10.2/48/3, pedaly = -wy + 65/48/3;
						legLimb(canv, lgr.q1thigh, bumx, bumy, lgr.q1leg, pedalx, pedaly);

						canv.save(); // torso
							canv.translate(17/48, 9.25/48);
							canv.rotate(Math.PI + 2/3);
							canv.scale(100/48/3, 58/48/3);
							lgr.q1body.draw(canv);
						canv.restore();

						var shoulderx = 0/48, shouldery = -17.5/48;
						var handx = -wx - 64.5/48/3, handy = -wy - 59.6/48/3;

						var shoulder2hand = hypot(handx - shoulderx, handy - shouldery);

						var lv = lastVolt(Math.floor(frame));
						var animlen = 27;
						if(lv != null && frame - lv[0] < animlen){
							// anim: 20/100 s to move hand to new position, 75/100 s to move back
							var animpos = frame - lv[0];
							animpos = animpos <= 6? animpos/6 : 1 - (animpos - 6)/(animlen - 6);
							// elma actually uses the current frame here, which seems weird
							if(lv[1] != turn)
								animpos *= -1;
							var at = Math.atan2(handy - shouldery, handx - shoulderx) + animpos*2*Math.PI/3;
							handx = shoulderx + shoulder2hand*Math.cos(at);
							handy = shouldery + shoulder2hand*Math.sin(at);
						}

						armLimb(canv, lgr.q1up_arm, shoulderx, shouldery, lgr.q1forarm, handx, handy);
					canv.restore();
				canv.restore();
			canv.restore();
		}

		return {
			draw: draw,
			bikeXi: bikeXi,
			bikeYi: bikeYi
		};
	};
});
