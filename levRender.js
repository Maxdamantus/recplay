define([], function(){
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

		// (x, y)–(x + w, y + h): viewport in Elma dimensions
		function draw(canv, lgr, x, y, w, h, scale){
			canv.save();

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

			canv.beginPath();
			traverse(polyTree, false, function(isSolid, verts){
				canv.moveTo(scale*verts[0][0], scale*verts[0][1]);
				for(var z = 1; z < verts.length; z++)
					canv.lineTo(scale*verts[z][0], scale*verts[z][1]);
			});
			canv.globalCompositeOperation = "destination-out";
			canv.fill();
			canv.restore();

/*			canv.strokeStyle = "#ff0000";
			canv.strokeRect(0, 0, w*scale, h*scale); */
		};

		// assumes widths and heights are positive
		function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2){
			return ( // parentheses required! ASI!
				x1 + w1 >= x2 &&
				y1 + h1 >= y2 &&
				x2 + w2 >= x1 &&
				y2 + h2 >= y1);
		}

		function cached(num, mkCanv){
			var cscale, xp, yp, wp, hp;
			var canvs = [], lgr, lgrIdent;

			function update(which, canv){
				var x = which%num, y = Math.floor(which/num);
				x = xp + x*wp;
				y = yp + y*hp;
				draw(canv.getContext("2d"), lgr, x/cscale, y/cscale, wp/cscale, hp/cscale, cscale);
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
