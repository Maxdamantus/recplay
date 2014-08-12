define([], function(){
	return function(reader){
		var polyTree = [];
		var grassPolys = [];

		function isSub(v, outer){
			function hits(a, b){
				// does the line [x, y]–[inf, y] intersect the line a–b?
				// bounding box check
				var left = Math.min(a[0], b[0]), right = Math.max(a[0], b[0]);
				if(v[0] < left || v[0] >= right)
					return false;
				var m = (b[1] - a[1])/(b[0] - a[0]);
				var yint = m*v[0] - (v[0] - a[0])*m;
				console.log(m + "*" + v[0] + " - " + (v[0] - a[0])*m + " = " + yint);
				return yint > v[1];
			}

			var n = 0;
			console.log("");
			console.log("isSub(" + v + ", ..)");
			for(var z = 0; z < outer.length; z++)
				if(hits(outer[z], outer[(z + 1)%outer.length])){
					console.log("hit: " + outer[z] + "–" + outer[(z + 1)%outer.length]);
					n++;
				}else
					console.log("miss: " + outer[z] + "–" + outer[(z + 1)%outer.length]);
			return n%2 != 0;
		}

		function addPoly(vertices, tree){
			var newTree = [];
			for(var x = 0; x < tree.length; x++){
				if(isSub(vertices[0], tree[x].vertices)) // assertion: newTree non-empty or consistency error
					return addPoly(vertices, tree[x].inner);
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

		reader.polyReader(function(grass, count, vertices){
			var poly = [];
			vertices(function(x, y){
				poly.push([x, y]);
			});
			if(grass)
				grassPolys.push(poly);
			else
				addPoly(poly, polyTree);
		});

		return { polyTree: polyTree, grassPolys: grassPolys };
	};
});
