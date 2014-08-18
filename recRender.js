define([], function(){
	function hypot(a, b){
		return Math.sqrt(a*a + b*b);
	}


	function skewimage(canv, img, bx, by, br, ih, x1, y1, x2, y2){
		var o = x2-x1, a = y2-y1;
		canv.save();
		canv.translate(x1, y1);
		canv.rotate(Math.atan2(a,o));
		canv.translate(-bx, -by*ih);
		canv.scale(bx + br + hypot(o, a), ih);
		img(canv);
		canv.restore();
	}

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

		function lastTurn(frame){
			for(var x = 0; x < turnFrames.length; x++)
				if(turnFrames[x] > frame)
					return x? turnFrames[x - 1] : -1;
		}

		console.log(turnFrames);
		// (x, y): top left in Elma coordinates
		function draw(canv, lgr, frame, x, y, scale){
			canv.save();
			canv.scale(scale, scale);
			canv.translate(-x + reader.bikeX(frame), -y - reader.bikeY(frame));
			canv.beginPath();

			var bikeR = reader.bikeR(frame)*Math.PI*2/10000;
			var turn = reader.turn(frame) >> 1 & 1;
			var leftX = reader.leftX(frame)/1000;
			var leftY = reader.leftY(frame)/1000;
			var leftR = reader.leftR(frame)*Math.PI*2/250;
			var rightX = reader.rightX(frame)/1000;
			var rightY = reader.rightY(frame)/1000;
			var rightR = reader.rightR(frame)*Math.PI*2/250;
			var headX = reader.headX(frame)/1000;
			var headY = reader.headY(frame)/1000;
			var lastTurnF = lastTurn(frame);

			canv.save(); // left wheel
				canv.translate(leftX, -leftY);
				canv.rotate(-leftR);
				canv.scale(38.4/48, 38.4/48);
				canv.translate(-0.5, -0.5);
				lgr.wheel(canv);
			canv.restore();

			canv.save(); // right wheel
				canv.translate(rightX, -rightY);
				canv.rotate(-rightR);
				canv.scale(38.4/48, 38.4/48);
				canv.translate(-0.5, -0.5);
				lgr.wheel(canv);
			canv.restore();

/*			canv.save(); // head
				canv.translate(headX/400, -headY/400);
				canv.rotate(-bikeR);
				canv.scale(23/48, 23/48);

				// 329 → 332


				canv.save();

					canv.translate(-0.5, -0.5);
					lgr.head(canv);
				canv.restore();

			canv.restore();
			*/


			canv.save();
				canv.rotate(-bikeR);
				if(turn)
					canv.scale(-1, 1);
				if(lastTurnF >= 0 && lastTurnF + 15 > frame) // TODO: it's not linear
					canv.scale(((frame - lastTurnF)/15 - 0.5)*2, 1);

				var wx, wy, a, r;
				canv.save();
					canv.scale(1/48, 1/48);

					// front suspension
					wx = turn? rightX : leftX;
					wy = turn? -rightY : -leftY;
					a = Math.atan2(wy, (turn? -1 : 1) * wx) + (turn? -1 : 1) * bikeR;
					r = hypot(wx, wy);
					skewimage(canv, lgr.susp1, 5, 0.5, 5, 7, -20, -17, 48*r * Math.cos(a), 48*r * Math.sin(a));

					// rear suspension
					wx = turn? leftX : rightX;
					wy = turn? -leftY : -rightY;
					a = Math.atan2(wy, (turn? -1 : 1) * wx) + (turn? -1 : 1) * bikeR;
					r = hypot(wx, wy);
					skewimage(canv, lgr.susp2, 5, 0.5, 5, 7, 48*r*Math.cos(a), 48*r*Math.sin(a), 10, 20);
				canv.restore();

				canv.save();
					canv.translate(-42/48, -10/48);
					canv.rotate(-Math.atan(3/4));
					canv.scale(10/47, 10/47);
					canv.scale(380/48, 301/48);
					lgr.bike(canv);
				canv.restore();

				canv.save(); // head
					r = hypot(headX, headY);
					a = Math.atan2(-headY, turn? -headX : headX) + (turn? -bikeR : bikeR);
					wx = r*Math.cos(a);
					wy = r*Math.sin(a);
					canv.translate(wx, wy);
					canv.beginPath();
					canv.moveTo(-1, 0);
					canv.lineTo(1, 0);
					canv.moveTo(0, -1);
					canv.lineTo(0, 1);
					canv.strokeStyle = "#ff0000";
					canv.lineWidth = 1/50;
					canv.stroke();


				canv.translate(-17/48, -42/48);
				canv.scale(23/48, 23/48);
//				canv.translate(-0.5, 0);
				lgr.head(canv);


				canv.restore();
					
					

				canv.beginPath();
				canv.moveTo(-1, 0);
				canv.lineTo(1, 0);
				canv.moveTo(0, -1);
				canv.lineTo(0, 1);
				canv.strokeStyle = "#00ff00";
				canv.lineWidth = 1/50;
				canv.stroke();


			canv.restore();



			canv.restore();
		}

		return {
			draw: draw
		};
	};
});
