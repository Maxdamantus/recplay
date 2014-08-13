define([], function(){
	return function(reader){
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

		return function(canv){
			canv.scale(20, 20);
			canv.translate(-minX, -minY);
			traverse(polyTree, false, function(isSolid, verts){
//				canv.fillStyle = isSolid? "#0000ff" : "#00ff00";
				console.log(verts);
//				canv.beginPath();
				canv.moveTo(verts[0][0], verts[0][1]);
				for(var x = 0; x < verts.length; x++){
					console.log(verts[x]);
					canv.lineTo(verts[x][0], verts[x][1]);
				}
//				canv.closePath();
//				canv.fill();
			});
			canv.fill();
		};
	};
});
