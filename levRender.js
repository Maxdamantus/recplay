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
					canv.scale(blockW, blockH);
					for(var xb = 0; xb < pw/blockW + 2; xb++)
						for(var yb = 0; yb < ph/blockH + 2; yb++){
							canv.save();
								canv.translate(xb, yb);
								lgr.ground(canv);
							canv.restore();
						}
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
		};

		function cache(mkCanv){
			
		}

		return {
			draw: draw
		};
	};
});
