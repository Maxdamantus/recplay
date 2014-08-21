define([], function(){
	return function objRender(levReader, recReader){
		var objs = function(){
			var o = [];

			function fl(x, y){
				o.push({ type: "fl", pos: [x, y] });
			}

			function ap(x, y, grav, anim){
				o.push({ type: "ap", pos: [x, y], grav: grav, anim: anim });
			}

			function ki(x, y){
				o.push({ type: "ki", pos: [x, y] });
			}

			function st(x, y){
				o.push({ type: "st", pos: [x, y] });
			}

			// TODO: handle errors
			var count = levReader.objCount()
			for(var x = 0; x < count; x++)
				levReader.obj(x, fl, ap, ki, st);

			return o;
		}();

		void function(){
			var count = recReader.eventCount();
			for(var x = 0; x < count; x++)
				recReader.event(x, function(time, a, b){
					// dunno exactly what a and b are, but this seems to work
					if(b == 0) // TODO: check it's actually there?
						objs[a].taken = Math.floor(time/.01455976568094950714);
				});
		}();

		return {
			draw: function(canv, lgr, frame, x, y, scale){
				canv.save();
				canv.scale(scale, scale);
				canv.translate(-x, -y);

				for(var z = 0; z < objs.length; z++){
					canv.save();
					canv.translate(objs[z].pos[0], objs[z].pos[1]);
					canv.scale(40/48, 40/48);
					canv.translate(-0.5, -0.5);
					switch(objs[z].type){
						case "ap":
							if("taken" in objs[z] && objs[z].taken <= frame)
								break;
							if(objs[z].anim)
								lgr.qfood2.frame(canv, frame%51, 51);
							else
								lgr.qfood1.frame(canv, frame%34, 34);
							break;
						case "fl":
							lgr.qexit.frame(canv, frame%50, 50);
							break;
					}
					canv.restore();
				}

				canv.restore();
			}
		};
	};
});
