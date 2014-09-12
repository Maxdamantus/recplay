define([], function(){
	function hypot(a, b){
		return Math.sqrt(a*a + b*b);
	}

	// assumes widths and heights are positive
	function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2){
		return ( // parentheses required! ASI!
			x1 + w1 >= x2 &&
			y1 + h1 >= y2 &&
			x2 + w2 >= x1 &&
			y2 + h2 >= y1);
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
					if(newTree.length)
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
			var o = [];
			var count = reader.picCount();
			for(var x = 0; x < count; x++){
				var pic = reader.pic_(x);
				// TODO: defaults
				for(var n = 0; n < o.length && o[n][0].dist > pic.dist; n++);
				if(n >= o.length || o[n][0].dist != pic.dist)
					o.splice(n, 0, []);
				o[n].push(pic);
			}
			return o;
		}();

		var grass = function(){
			var root; // quad tree: T = null | { descs : [grassDesc] } | ([tl, tr, bl, br] : [T])
			var rootW = 1; // length of top-level squares, all touching (0,0)
			var minW = 1;
			var maxImgW, maxImgH; // for overbounding in .traverse

			function dbgdraw(canv){
				function draw_(tree){
					canv.strokeRect(0, 0, 1, 1);
					if(tree instanceof Array){
						for(var y = 0; y < 2; y++)
							for(var x = 0; x < 2; x++){
								canv.save();
									canv.scale(1/2, 1/2);
									canv.translate(x, y);
									draw_(tree[y*2 + x]);
								canv.restore();
							}

					}
				}

				canv.save();
					canv.translate(-rootW, -rootW);
					canv.scale(2*rootW, 2*rootW);
					canv.strokeStyle = "orange";
					canv.lineWidth = 1/100;
					draw_(root);
				canv.restore();
			}

			function traverse_(tree, tx, ty, tw, x, y, w, h, fn){
				if(tree === null)
					return;
				if("descs" in tree){ // leaf
					tree.descs.forEach(fn);
					return;
				}
				var n = 0;
				for(var sy = 0; sy < 2; sy++)
					for(var sx = 0; sx < 2; sx++){
						var dx = sx == 0? -1 : 1;
						var dy = sy == 0? -1 : 1;
						if(rectsOverlap(x, y, w, h, tx - tw + sx*tw, ty - tw + sy*tw, tw, tw))
							traverse_(tree[n], tx + dx*tw/2, ty + dy*tw/2, tw/2, x, y, w, h, fn);
						n++;
					}
			}

			// assuming w and h are positive
			function traverse(x, y, w, h, fn){
				return traverse_(root, 0, 0, rootW, x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
			}

			function add_(desc, tree, x, y, w){
				if(tree === null)
					return { descs: [desc] };
				var dx = desc.x < x? -1 : 1;
				var dy = desc.y < y? -1 : 1;
				var quad = 2*(dy < 0? 0 : 1) + (dx < 0? 0 : 1);
				// could alternatively make it pure here
				if(tree instanceof Array){
					tree[quad] = add_(desc, tree[quad], x + dx*w/2, y + dy*w/2, w/2);
					return tree;
				}
				if(w < minW){
					tree.descs.push(desc);
					return tree;
				}
				var r = [null, null, null, null];
				r[quad] = { descs: [desc] };
				for(var z = 0; z < tree.descs.length; z++)
					r = add_(tree.descs[z], r, x, y, w);
				return r;
			}

			function add(desc){
				while(Math.abs(desc.x) >= rootW || Math.abs(desc.y) >= rootW){
					root[0] = [null, null, null, root[0]];
					root[1] = [null, null, root[1], null];
					root[2] = [null, root[2], null, null];
					root[3] = [root[3], null, null, null];
					rootW *= 2;
				}
				if(add_(desc, root, 0, 0, rootW) != root)
					throw new Error("internal error");
			}

			function calc(){
				root = [null, null, null, null];
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

						add({ x: fcx/scale, y: fcyTop/scale, pict: pict });

						curX += pict.width;
						curY += fall;
					}
				}
			}

			return {
				calc: calc,
				traverse: traverse,
				dbgdraw: dbgdraw
			};
		}();

		function drawPictures(canv, scale, clipping){
			function draw(pic){
				// TODO: are masks specifically for textures? dunno
				var img = lgr.picts[pic.picture];
				if(pic.clipping != clipping)
					return;
				if(img && img.draw){
					canv.save();
						canv.translate(pic.x*scale, pic.y*scale);
						canv.scale(scale/48, scale/48);
						img.drawAt(canv);
					canv.restore();
				}
				img = lgr.picts[pic.texture];
				var mask = lgr.picts[pic.mask];
				if(img && img.draw && mask && mask.draw){
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

			pictures.forEach(function(layer){
				layer.forEach(draw);
			});
		}

		var lgrIdent = {};

		// (x, y)–(x + w, y + h): viewport in Elma dimensions
		function draw(canv, x, y, w, h, scale){
			if(lgrIdent != lgr._ident){
				grass.calc();
				lgrIdent = lgr._ident;
			}

			canv.save();
				canv.translate(-x*scale, -y*scale);
				drawPictures(canv, scale, "s"); // sky
			canv.restore();

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
				var img = lgr.picts[reader.ground()] || lgr.picts.ground;
				var px = Math.floor(x*scale), py = Math.floor(y*scale);
				var pw = Math.floor(w*scale), ph = Math.floor(h*scale);
				var offsX = x >= 0? px%img.width : img.width - -px%img.width;
				var offsY = y >= 0? py%img.height : img.height - -py%img.height;
				canv.save();
					canv.translate(-img.width - offsX, -img.height - offsY);
					img.repeat(canv, pw + img.width*2, ph + img.height*2);
				canv.restore();
			}();

//			canv.restore();
			canv.save();
				canv.translate(-x*scale, -y*scale);
				drawPictures(canv, scale, "g"); // ground
			canv.restore();

			canv.translate(-x*scale, -y*scale);

			canv.save();
				canv.beginPath();
				grass.traverse(x, y, w, h, function(grassDesc){
					canv.save();
						canv.translate(grassDesc.x*scale, grassDesc.y*scale);
						var b = grassDesc.pict.borders;
						canv.scale(scale/48, scale/48);
						canv.moveTo(0, -24);
						for(var z = 0; z < b.length; z++){
							canv.lineTo(z, b[z] + 1);
							canv.lineTo(z + 1, b[z] + 1);
						}
						canv.lineTo(grassDesc.pict.width, -24);
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


			grass.traverse(x, y, w, h, function(grassDesc){
				canv.save();
					canv.translate(grassDesc.x*scale, grassDesc.y*scale);
					canv.scale(scale/48, scale/48);
					grassDesc.pict.drawAt(canv);
				canv.restore();
			});

			canv.restore();

			canv.save();
			canv.translate(-x*scale, -y*scale);

			canv.restore();

			canv.save();
				canv.translate(-x*scale, -y*scale);
				drawPictures(canv, scale, "u"); // unclipped
			canv.restore();

			canv.strokeStyle = "#ff0000";
			if(window.dbg){
				canv.strokeRect(0, 0, w*scale, h*scale);
				if(window.dbg > 1){
					canv.save();
						canv.translate(-x*scale, -y*scale);
						canv.scale(scale, scale);
						grass.dbgdraw(canv);
					canv.restore();
				}
			}
		};

		function cached(num, mkCanv){
			var cscale, xp, yp, wp, hp;
			var canvs = [];

			function update(which, canv){
				var x = which%num, y = Math.floor(which/num);
				x = xp + x*wp;
				y = yp + y*hp;
				var ctx = canv.getContext("2d");
				ctx.clearRect(0, 0, canv.width, canv.height);
				draw(ctx, x/cscale, y/cscale, wp/cscale, hp/cscale, cscale);
			}

			return function cachedDraw(canv, x, y, w, h, scale){
				w = Math.ceil(w*scale);
				h = Math.ceil(h*scale);
				x = Math.floor(x*scale);
				y = Math.floor(y*scale);
				if(lgr._ident != lgrIdent || scale != cscale || Math.ceil(w/(num - 1)) != wp || Math.ceil(h/(num - 1)) != hp || !rectsOverlap(xp, yp, wp*num, hp*num, x, y, w, h)){
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
			drawSky: function(canv, x, y, w, h, scale){
				// TODO: check that it's not accessing something it shouldn't
				var img = lgr.picts[reader.sky()] || lgr.picts.sky;
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
