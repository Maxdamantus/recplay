define(["./binReader"], function(binReader){
	var ticker = function(){
		var n = 0;
		return function(m){
			n += m;
			return n - m;
		};
	}();

	var offsType = ticker(5);
	ticker(2);
	var offsIdent = ticker(4);
	var offsIntegrities = ticker(4*8);
	var offsDesc = ticker(51);
	var offsLgr = ticker(16);
	var offsGround = ticker(10);
	var offsSky = ticker(10);
	var offsPolyCount = ticker(8);
	var offsPolys = ticker(0);

	return function levReader(data){
		var br = binReader(data);

		function polyCount(){
			br.seek(offsPolyCount);
			return Math.floor(br.binFloat64le());
		}

		function objCount(){
			br.seek(offsObjCount);
			return Math.floor(br.binFloat64le());
		}

		function picCount(){
			br.seek(offsPicCount);
			return Math.floor(br.binFloat64le());
		}

		var offsObjCount = function(){
			var pc = polyCount();
			br.seek(offsPolys);
			for(var x = 0; x < pc; x++){
				br.skip(4); // grass
				br.skip(br.word32le()*(8 + 8));
			}
			return br.pos();
		}();
		var offsObjs = offsObjCount + 8;
		var offsPicCount = function(){
			br.seek(offsObjCount);
			return offsObjs + Math.floor(br.binFloat64le())*((8 + 8) + (4 + 4 + 4));
		}();
		var offsPics = offsPicCount + 8;

		return {
			rightType: function(){
				br.seek(offsType);
				return br.seq(5) == "POT14";
			},

			ident: function(){
				br.seek(offsIdent);
				return br.seq(4);
			},

			integrities: function(){
				br.seek(offsIntegrities);
				var o = [];
				for(var x = 0; x < 4; x++)
					o.push(br.binFloat64le());
				return o;
			},

			desc: function(){
				br.seek(offsDesc);
				return br.string(51);
			},

			lgr: function(){
				br.seek(offsLgr);
				return br.string(16);
			},

			ground: function(){
				br.seek(offsGround);
				return br.string(10);
			},

			sky: function(){
				br.seek(offsSky);
				return br.string(10);
			},

			polyCount: polyCount,
			objCount: objCount,
			picCount: picCount,

			polyReader: function(forEachPoly){
				/* lr.polyReader(function(grass, vcount, vertices){
				 *   // for each polygon
				 *   vertices(function(x, y){
				 *     // for each vertex in it
				 *   });
				 * });
				 */

				var count = polyCount();
				br.seek(offsPolys);
				for(var x = 0; x < count; x++){
					var grass = br.word32le(), vcount = br.word32le(), pos = br.pos();
					void function(grass, vcount, pos){
						br.seek(pos);
						forEachPoly(grass != 0, vcount, function(forEachVertex){
							for(var y = 0; y < vcount; y++){
								br.seek(pos + y*(8 + 8));
								forEachVertex(br.binFloat64le(), br.binFloat64le());
							}
						});
					}(grass, vcount, pos);
					br.seek(pos + vcount*(8 + 8));
				}
			},

			obj: function(n, onFlower, onApple, onKiller, onStart){ // onError? maybe
				br.seek(offsObjs + n*((8 + 8) + (4 + 4 + 4)));
				var vx = br.binFloat64le(), vy = br.binFloat64le();
				var obj = br.word32le(), grav = br.word32le(), anim = br.word32le();
				switch(obj){
					case 1: return onFlower(vx, vy);
					case 2: return onApple(vx, vy, grav, anim);
					case 3: return onKiller(vx, vy);
					case 4: return onStart(vx, vy);
					default: throw new Error("hmm");
				}
			},

			pic: function(n, onPic){
				br.seek(offsPics + n*(10 + 10 + 10 + 8 + 8 + 4 + 4));
				var picture = br.pstring(10), texture = br.pstring(10), mask = br.pstring(10);
				var vx = br.binFloat64le(), vy = br.binFloat64le();
				var dist = br.word32le(), clipping = br.word32le();
				return onPic(picture, texture, mask, vx, vy, dist, clipping);
			}
		};
	};
});
