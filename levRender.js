define(["./util/quadTree", "./util/geom"], function(quadTree, geom){
	"use strict";

	function hypot(a, b){
		return Math.sqrt(a*a + b*b);
	}

	return function levRender(reader, lgr){
		var polyTree = [];
		var grassPolys = [];

		function isSub(v, outer){
			function hits(a, b){
				// does the line [x, y]–[x, inf] intersect the line a–b?
				var left = Math.min(a[0], b[0]), right = Math.max(a[0], b[0]);
				if(v[0] < left || v[0] >= right)
					return false;
				var m = (b[1] - a[1])/(b[0] - a[0]);
				var yint = m*(v[0] - a[0]) + a[1];
				return yint > v[1];
			}

			var n = 0;
			for(var z = 0; z < outer.length; z++)
				if(hits(outer[z], outer[(z + 1)%outer.length]))
					n++;
			return n%2 != 0;
		}

		function addPoly(vertices, tree){
			var newTree = [];
			for(var x = 0; x < tree.length; x++){
				if(isSub(vertices[0], tree[x].vertices)){
					// assertion: newTree non-empty or consistency error
					if(false && newTree.length) // actually, game itself doesn't care, only the editor
						throw new Error("inconsistent!");
					return addPoly(vertices, tree[x].inner);
				}
				if(isSub(tree[x].vertices[0], vertices)){
					newTree.push(tree[x]);
					if(x + 1 == tree.length)
						tree.pop();
					else
						tree[x] = tree.pop();
					x--;
				}
			}
			return tree[x] = { vertices: vertices, inner: newTree };
		}

		function traverse(tree, isSolid, fn){
			tree.forEach(function(poly){
				fn(isSolid, poly.vertices);
				traverse(poly.inner, !isSolid, fn);
			});
		}

		var minX = Infinity, minY = Infinity;
		var maxX = -Infinity, maxY = -Infinity;

		reader.polyReader(function(grass, count, vertices){
			var poly = [];
			vertices(function(x, y){
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
				poly.push([x, y]);
			});
			if(grass)
				grassPolys.push(poly);
			else
				addPoly(poly, polyTree);
		});

		var pictures = function(){
			var tree;
			var maxImgW, maxImgH; // for overbounding in .traverse

			function traverse(x, y, w, h, fn){
				tree.traverse(x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
			}

			function calc(){
				tree = quadTree(1);
				maxImgW = maxImgH = 0;

				var count = reader.picCount();
				for(var x = 0; x < count; x++){
					var pic = reader.pic_(x);
					pic.num = x;
					// TODO: defaults?
					tree.add(pic.x, pic.y, pic);
					[pic.picture, pic.mask, pic.texture].forEach(function(picname){
						var img = lgr.picts[picname];
						if(img && img.width !== undefined && img.height !== undefined){
							img.touch();
							maxImgW = Math.max(maxImgW, img.width/48);
							maxImgH = Math.max(maxImgH, img.height/48);
						}
					});
				}
			}

			return {
				calc: calc,
				traverse: traverse,
				dbgdraw: function(canv, x, y, w, h){
					tree.dbgdraw(canv, x, y, w, h);
				}
			};
		}();

		var grass = function(){
			var tree;
			var maxImgW, maxImgH; // for overbounding in .traverse

			// assuming w and h are positive
			function traverse(x, y, w, h, fn){
				tree.traverse(x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
			}

			function calc(){
				tree = quadTree(1);
				maxImgW = maxImgH = 0;

				grassPolys.forEach(function(p){
					calcGrassPoly(48, p);
				});

				function calcGrassPoly(scale, poly){
					// the path selection is demonstrably wrong, but it probably works in all reasonable cases.
					// it draws along the path from the left-most vertex to the right-most vertex that doesn't
					//   include the widest edge.
					// haven't figured out exactly what Elma itself does.
					var minX = Infinity, maxX = -Infinity, minXi, maxXi;
					for(var z = 0; z < poly.length; z++){
						// WARNING: funny code
						if(minX != (minX = Math.min(minX, poly[z][0])))
							minXi = z;
						if(maxX != (maxX = Math.max(maxX, poly[z][0])))
							maxXi = z;
					}
					var maxW = 0;
					for(var z = minXi; z%poly.length != maxXi; z++)
						maxW = Math.max(maxW, Math.abs(poly[z%poly.length][0] - poly[(z + 1)%poly.length][0]));
					var dir = -1;
					for(var z = poly.length + minXi; z%poly.length != maxXi; z--)
						if(maxW != (maxW = Math.max(maxW, Math.abs(poly[z%poly.length][0] - poly[(z - 1)%poly.length][0]))))
							dir = 1;
					function yAt(x){
						for(var z = poly.length + minXi; z%poly.length != maxXi; z += dir){
							var from = poly[z%poly.length], to = poly[(z + dir)%poly.length];
							if(from[0] <= x && x < to[0]){
								var m = (to[1] - from[1])/(to[0] - from[0]);
								return m*(x - from[0]) + from[1];
							}
						}
					}

					var curX = poly[minXi][0]*scale, curY = poly[minXi][1]*scale;
					var gUps = lgr.grassUp(), gDowns = lgr.grassDown();
					while(curX < maxX*scale){
						var bestD = Infinity, bestA, bestI;
						for(var a = 0; a < gUps.length; a++){
							if(curX + gUps[a].width >= maxX*scale)
								continue;
							var dist = Math.abs(yAt((curX + gUps[a].width)/scale)*scale - (curY - (gUps[a].height - 41)));
							if(dist < bestD){
								bestD = dist;
								bestA = gUps;
								bestI = a;
							}
						}
						for(var a = 0; a < gDowns.length; a++){
							if(curX + gDowns[a].width >= maxX*scale)
								continue;
							var dist = Math.abs(yAt((curX + gDowns[a].width)/scale)*scale - (curY + (gDowns[a].height - 41)));
							if(dist < bestD){
								bestD = dist;
								bestA = gDowns;
								bestI = a;
							}
						}
						if(!bestA){
							curX++;
							continue;
						}
						var pict = bestA[bestI];
						var fall = (pict.height - 41)*(bestA == gUps? -1 : 1);
						var fcx = Math.floor(curX), fcy = Math.floor(curY + fall);
						var fcyTop = Math.floor(curY) - Math.ceil((pict.height - fall)/2);

						maxImgW = Math.max(maxImgW, pict.width/scale);
						maxImgH = Math.max(maxImgH, pict.height/scale);

						tree.add(fcx/scale, fcyTop/scale, pict);

						curX += pict.width;
						curY += fall;
					}
				}
			}

			return {
				calc: calc,
				traverse: traverse,
				dbgdraw: function(canv, x, y, w, h){
					tree.dbgdraw(canv, x, y, w, h);
				}
			};
		}();

		function drawPictures(pics, canv, scale, clipping, x, y, w, h){
			function draw(pic){
				// TODO: are masks specifically for textures? dunno
				var img = lgr.picts[pic.picture];
				if(pic.clipping != clipping)
					return;
				if(img && img.draw){
					if(!geom.rectsOverlap(pic.x, pic.y, img.width, img.height, x, y, w, h))
						return;
					canv.save();
						canv.translate(pic.x*scale, pic.y*scale);
						canv.scale(scale/48, scale/48);
						img.drawAt(canv);
					canv.restore();
					return;
				}
				img = lgr.picts[pic.texture];
				var mask = lgr.picts[pic.mask];
				if(img && img.draw && mask && mask.draw){
					if(!geom.rectsOverlap(pic.x, pic.y, mask.width, mask.height, x, y, w, h))
						return;
					// TODO: scale textures, fix otherwise
					var px = Math.round(pic.x*scale), py = Math.round(pic.y*scale);
					var offsX = px >= 0? px%img.width : img.width - -px%img.width;
					var offsY = py >= 0? py%img.height : img.height - -py%img.height;
					mask.touch();
					canv.save();
						canv.translate(pic.x*scale, pic.y*scale);
						canv.beginPath();
						canv.moveTo(0, 0);
						canv.lineTo(mask.width*scale/48, 0);
						canv.lineTo(mask.width*scale/48, mask.height*scale/48);
						canv.lineTo(0, mask.height*scale/48);
						canv.clip();
						canv.translate(-offsX, -offsY);
						img.repeat(canv, offsX + mask.width*scale/48, offsY + mask.height*scale/48);
					canv.restore();
				}
			}

			pics.forEach(draw);
		}

		var lgrIdent = {};
		var optIdent = {};
		var optGrass = true;
		var optPictures = true;
		var optCustomBackgroundSky = true;

		// (x, y)–(x + w, y + h): viewport in Elma dimensions
		function draw(canv, x, y, w, h, scale){
			if(lgrIdent != lgr._ident){
				if(optGrass)
					grass.calc();
				if(optPictures)
					pictures.calc();
				lgrIdent = lgr._ident;
			}

			var pics = [];
			pictures.traverse(x, y, w, h, function(x, y, pic){
				pics.push(pic);
			});
			pics.sort(function(a, b){
				return (a.dist < b.dist) - (a.dist > b.dist) || (a.num < b.num) - (a.num > b.num);
			});

			if(optPictures){
				canv.save();
					canv.translate(-x*scale, -y*scale);
					drawPictures(pics, canv, scale, "s", x, y, w, h); // sky
				canv.restore();
			}

			canv.save();
				canv.beginPath();
				canv.moveTo(0, 0);
				canv.lineTo(w*scale, 0);
				canv.lineTo(w*scale, h*scale);
				canv.lineTo(0, h*scale);

				canv.translate(-x*scale, -y*scale);

				traverse(polyTree, false, function(isSolid, verts){
					canv.moveTo(scale*verts[verts.length - 1][0], scale*verts[verts.length - 1][1]);
					for(var z = verts.length - 2; z >= 0; z--)
						canv.lineTo(scale*verts[z][0], scale*verts[z][1]);
				});

				canv.translate(x*scale, y*scale);
				canv.clip(); // clip isn't antialiased in Chromium—different with destination-out
				void function(){
					// TODO: check that it's not accessing something it shouldn't
					var img = optCustomBackgroundSky && lgr.picts[reader.ground()] || lgr.picts.ground;
					var px = Math.floor(x*scale), py = Math.floor(y*scale);
					var pw = Math.floor(w*scale), ph = Math.floor(h*scale);
					var offsX = x >= 0? px%img.width : img.width - -px%img.width;
					var offsY = y >= 0? py%img.height : img.height - -py%img.height;
					canv.save();
						canv.translate(-img.width - offsX, -img.height - offsY);
						img.repeat(canv, pw + img.width*2, ph + img.height*2);
					canv.restore();
				}();

				if(optPictures){
					canv.save();
						canv.translate(-x*scale, -y*scale);
						drawPictures(pics, canv, scale, "g", x, y, w, h); // ground
					canv.restore();
				}

				canv.translate(-x*scale, -y*scale);

				if(optGrass){
					canv.save();
						canv.beginPath();
						grass.traverse(x, y, w, h + 24, function(grassX, grassY, pict){
							canv.save();
								canv.translate(grassX*scale, grassY*scale);
								var b = pict.borders;
								canv.scale(scale/48, scale/48);
								canv.moveTo(0, -24);
								for(var z = 0; z < b.length; z++){
									canv.lineTo(z, b[z] + 1);
									canv.lineTo(z + 1, b[z] + 1);
								}
								canv.lineTo(pict.width, -24);
								canv.closePath();
							canv.restore();
						});
						canv.clip();

						canv.translate(x*scale, y*scale);

						void function(){
							var img = lgr.picts.qgrass;
							var px = Math.floor(x*scale), py = Math.floor(y*scale);
							var pw = Math.floor(w*scale), ph = Math.floor(h*scale);
							var offsX = x >= 0? px%img.width : img.width - -px%img.width;
							var offsY = y >= 0? py%img.height : img.height - -py%img.height;
							canv.save();
								canv.translate(-img.width - offsX, -img.height - offsY);
								img.repeat(canv, pw + img.width*2, ph + img.height*2);
							canv.restore();
						}();
					canv.restore();

					grass.traverse(x, y, w, h, function(grassX, grassY, pict){
						canv.save();
							canv.translate(grassX*scale, grassY*scale);
							canv.scale(scale/48, scale/48);
							pict.drawAt(canv);
						canv.restore();
					});
				}
			canv.restore();

			if(optPictures){
				canv.save();
					canv.translate(-x*scale, -y*scale);
					drawPictures(pics, canv, scale, "u", x, y, w, h); // unclipped
				canv.restore();
			}

			canv.strokeStyle = "#ff0000";
			if(window.dbg){
				canv.strokeRect(0, 0, w*scale, h*scale);
				if(window.dbg > 1){
					canv.save();
						canv.translate(-x*scale, -y*scale);
						canv.scale(scale, scale);
						canv.lineWidth = 1/48;
						canv.strokeStyle = "orange";
						if(window.dbg & 2)
							grass.dbgdraw(canv, x, y, w, h);
						canv.strokeStyle = "purple";
						if(window.dbg & 4)
							pictures.dbgdraw(canv, x, y, w, h);
					canv.restore();
				}
			}
		};

		function cached(num, mkCanv){
			var cscale, xp, yp, wp, hp;
			var canvs = [];
			var cacheLgrIdent;
			var cacheOptIdent;

			function update(which, canv){
				var x = which%num, y = Math.floor(which/num);
				x = xp + x*wp;
				y = yp + y*hp;
				var ctx = canv.getContext("2d");
				ctx.clearRect(0, 0, canv.width, canv.height);
				draw(ctx, x/cscale, y/cscale, wp/cscale, hp/cscale, cscale);
			}

			function invalid(){
				return (
					lgr._ident != lgrIdent ||
					cacheLgrIdent != lgrIdent ||
					cacheOptIdent != optIdent);
			}

			return function cachedDraw(canv, x, y, w, h, scale){
				w = Math.ceil(w*scale);
				h = Math.ceil(h*scale);
				x = Math.floor(x*scale);
				y = Math.floor(y*scale);
				if(invalid() || scale != cscale || Math.ceil(w/(num - 1)) != wp || Math.ceil(h/(num - 1)) != hp || !geom.rectsOverlap(xp, yp, wp*num, hp*num, x, y, w, h)){
					cacheLgrIdent = lgrIdent;
					cacheOptIdent = optIdent;
					wp = Math.ceil(w/(num - 1));
					hp = Math.ceil(h/(num - 1));
					xp = x - Math.floor(wp/2);
					yp = y - Math.floor(hp/2);
					cscale = scale;
					canvs = [];
					for(var z = 0; z < num*num; z++)
						update(z, canvs[z] = mkCanv(wp, hp));
				}
				// TODO: will render things unnecessarily if it jumps a whole column/row
				// doesn't matter when num == 2
				// should try to generalise this—whole thing looks unreadable
				while(yp > y){ // stuff missing from top
					yp -= hp;
					canvs.splice.apply(canvs, [0, 0].concat(canvs.splice(num*(num - 1), num)));
					for(var z = 0; z < num; z++)
						update(z, canvs[z]);
				}
				while(yp + num*hp < y + h){ // stuff missing from bottom
					yp += hp;
					canvs.splice.apply(canvs, [num*(num - 1), 0].concat(canvs.splice(0, num)));
					for(var z = 0; z < num; z++)
						update(num*(num - 1) + z, canvs[num*(num - 1) + z]);
				}
				while(xp > x){ // stuff missing from left
					xp -= wp;
					for(var z = 0; z < num; z++){
						canvs.splice(z*num, 0, canvs.splice((z + 1)*num - 1, 1)[0]);
						update(z*num, canvs[z*num]);
					}
				}
				while(xp + num*wp < x + w){ // stuff missing from right
					xp += wp;
					for(var z = 0; z < num; z++){
						canvs.splice((z + 1)*num - 1, 0, canvs.splice(z*num, 1)[0]);
						update((z + 1)*num - 1, canvs[(z + 1)*num - 1]);
					}
				}

				for(var xi = 0; xi < num; xi++)
					for(var yi = 0; yi < num; yi++)
						canv.drawImage(canvs[yi*num + xi], xp - x + xi*wp, yp - y + yi*hp);

			};
		}

		return {
			draw: draw,
			cached: cached,
			setGrass: function(v){ optGrass = v; optIdent = {}; },
			setPictures: function(v){ optPictures = v; optIdent = {}; },
			setCustomBackgroundSky: function(v){ optCustomBackgroundSky = v; optIdent = {}; },
			drawSky: function(canv, x, y, w, h, scale){
				// TODO: check that it's not accessing something it shouldn't
				var img = optCustomBackgroundSky && lgr.picts[reader.sky()] || lgr.picts.sky;
				x = Math.floor(x*scale/3);
				w *= scale;
				h *= scale;
				if((x = x%img.width) < 0)
					x = img.width + x;
				canv.save();
					canv.translate(-x, 0);
					img.repeat(canv, w + img.width, h);
				canv.restore();
			}
		};
	};
});
