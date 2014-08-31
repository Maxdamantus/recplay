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

	return function levRender(reader){
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

		var pictures = window.pics = function(){
			var o = [];
			var count = reader.picCount();
			for(var x = 0; x < count; x++){
				var pic = reader.pic_(x);
				for(var n = 0; n < o.length && o[n][0].depth > pic.dist; n++);
				if(n >= o.length || o[n][0].dist != pic.dist)
					o.splice(n, 0, []);
				o[n].push(pic);
			}
			return o;
		}();

		function renderGrassPoly(canv, lgr, x, y, w, h, scale, poly){
			x = x*scale; y = y*scale; w = w*scale; h = h*scale;
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
			canv.beginPath();
			canv.moveTo(curX, curY - scale);
			canv.lineTo(curX, curY);
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

				var isVisible = rectsOverlap(fcx, fcyTop, pict.width, pict.height, x, y, w, h);

				if(isVisible)
					for(var xl = 0; xl < bestA[bestI].width; xl++){
						canv.lineTo(fcx + xl, fcyTop + pict.borders[xl]);
						canv.lineTo(fcx + xl + 1, fcyTop + pict.borders[xl]);
					}
				else
					canv.lineTo(curX + pict.width, curY + fall);

				canv.save();
					canv.translate(fcx, fcyTop);
					if(isVisible)
						pict.drawAt(canv);
				canv.restore();

				curX += pict.width;
				curY += fall;
			}
			canv.lineTo(curX, curY - scale);
			// opposite direction—further deviation from strict Elma style
			for(var z = poly.length + maxXi; z%poly.length != minXi; z -= dir){
				var from = poly[z%poly.length];
				canv.lineTo(from[0]*scale, from[1]*scale - scale);
			}

			canv.save();
				canv.clip();
				var ox = Math.floor(curX), oy = Math.floor(curY + fall) - scale;
				var blockW = lgr.picts.qgrass.width, blockH = lgr.picts.qgrass.height; // TODO: this, in lgr?
				var offsX = x >= 0? x%blockW : blockW - -x%blockW;
				var offsY = y >= 0? y%blockH : blockH - -y%blockH;
				canv.translate(x - offsX, y - offsY); // TODO
				lgr.picts.qgrass.repeat(canv, w + blockW*2, h + blockH*2); // TODO
			canv.restore();

			for(var z = poly.length + minXi; window.dbg && z%poly.length != maxXi; z += dir){
				canv.beginPath();
				var from = poly[z%poly.length], to = poly[(z + dir)%poly.length];
				canv.moveTo(from[0]*scale, from[1]*scale);
				canv.lineTo(to[0]*scale, to[1]*scale);
				canv.strokeStyle = "red";
				canv.stroke();
			}
		}

		// (x, y)–(x + w, y + h): viewport in Elma dimensions
		function draw(canv, lgr, x, y, w, h, scale){
			canv.save();

			void function(){
				function pic(picture, texture, mask, vx, vy, dist, clipping){
					picture = lgr.picts[picture];
					if(!picture || !picture.draw)
						return;
					canv.save();
					canv.translate((-x + vx)*scale, (-y + vy)*scale);
					canv.scale(scale/48, scale/48);
					picture.drawAt(canv);
					canv.restore();
				}
				var pc = reader.picCount();
				for(var z = 0; z < pc; z++)
					reader.pic(z, pic);
			}();

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
				var px = Math.floor(x*scale), py = Math.floor(y*scale);
				var pw = Math.floor(w*scale), ph = Math.floor(h*scale);
				var blockW = 280, blockH = 31;
				var offsX = x >= 0? px%blockW : blockW - -px%blockW;
				var offsY = y >= 0? py%blockH : blockH - -py%blockH;
				canv.save();
					canv.translate(-blockW - offsX, -blockH - offsY);
					lgr.ground.repeat(canv, pw + blockW*2, ph + blockH*2);
				canv.restore();
			}();
			canv.translate(-x*scale, -y*scale);
			grassPolys.forEach(function(poly){
				renderGrassPoly(canv, lgr, x, y, w, h, scale, poly);
			});

			canv.restore();

			canv.save();
			canv.translate(-x*scale, -y*scale);

/*			grassPolys.forEach(function(poly){
				//renderGrassPoly(canv, lgr, scale, poly);
				renderGrassPoly(canv, lgr, x, y, w, h, scale, poly);
			});*/
			canv.restore();


			canv.strokeStyle = "#ff0000";
			if(window.dbg)
				canv.strokeRect(0, 0, w*scale, h*scale);
		};

		function cached(num, mkCanv){
			var cscale, xp, yp, wp, hp;
			var canvs = [], lgr, lgrIdent;

			function update(which, canv){
				var x = which%num, y = Math.floor(which/num);
				x = xp + x*wp;
				y = yp + y*hp;
				var ctx = canv.getContext("2d");
				ctx.clearRect(0, 0, canv.width, canv.height);
				draw(ctx, lgr, x/cscale, y/cscale, wp/cscale, hp/cscale, cscale);
			}

			return function cachedDraw(canv, lgr_, x, y, w, h, scale){
				lgr = lgr_;
				w = Math.ceil(w*scale);
				h = Math.ceil(h*scale);
				x = Math.floor(x*scale);
				y = Math.floor(y*scale);
				if(lgr._ident != lgrIdent || scale != cscale || Math.ceil(w/(num - 1)) != wp || Math.ceil(h/(num - 1)) != hp || !rectsOverlap(xp, yp, wp*num, hp*num, x, y, w, h)){
					lgrIdent = lgr._ident;
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
			drawSky: function(canv, lgr, x, y, w, h, scale){
				x = Math.floor(x*scale/3);
				y = Math.floor(y*scale/3);
				w *= scale;
				h *= scale;
				if((x = x%640) < 0)
					x = 640 + x;
				if((y = y%480) < 0)
					y = 480 + y;
				canv.save();
				canv.translate(-x, -480 + y);
				lgr.sky.repeat(canv, w + 640, h + 480);
				canv.restore();
			}
		};
	};
});
