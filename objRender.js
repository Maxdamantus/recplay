define([], function(){
	return function objRender(levReader, recReader){
		var appleCount = 0;

		var objs = function(){
			var flowers = [], apples = [], killers = [], starts = [];

			function fl(x, y){
				flowers.push({ type: "fl", pos: [x, y] });
			}

			function ap(x, y, grav, anim){
				appleCount++;
				apples.push({ type: "ap", pos: [x, y], grav: grav, anim: anim });
			}

			function ki(x, y){
				killers.push({ type: "ki", pos: [x, y] });
			}

			function st(x, y){
				starts.push({ type: "st", pos: [x, y] });
			}

			// TODO: handle errors
			var count = levReader.objCount()
			for(var x = 0; x < count; x++)
				levReader.obj(x, fl, ap, ki, st);

			return [].concat(killers, apples, flowers, starts);
		}();

		var applesTaken = [];
		void function(){
			if(!recReader)
				return;
			var count = recReader.eventCount();
			for(var x = 0; x < count; x++)
				recReader.event(x, function(time, info, type){
					if(type == 0) // TODO: check it's actually there?
						if(objs.length > info && objs[info].type == "ap" && !("taken" in objs[info])) // TODO: maybe track gravity here?
							applesTaken.push([objs[info].taken = Math.floor(time/.01455976568094950714), applesTaken.length + 1]);
				});
		}();

		return {
			appleCount: function(){
				return appleCount;
			},

			applesTaken: function(frame){
				for(var x = 0; x < applesTaken.length; x++)
					if(applesTaken[x][0] >= frame)
						break;
				return x? applesTaken[x - 1][1] : 0;
			},

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
						case "ki":
							lgr.qkiller.frame(canv, frame%33, 33);
							break;
					}
					canv.restore();
				}

				canv.restore();
			}
		};
	};
});
