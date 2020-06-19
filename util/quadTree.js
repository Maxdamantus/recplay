"use strict";

var geom = require("./geom");

// an append-only quad tree

function sum(names){
	var o = {};
	for(var name in names)
		void function(){
			var type = names[name];
			o[name] = function(val){
				return { type: type, v: val };
			};
		}();
	return o;
};

var Tree = sum({ nil: "nil", tip: "tip",  branch: "branch" });
var nil = Tree.nil();

exports.make = function quadTree(minW){
	// root must be a (quad) branch
	var root = Tree.branch([nil, nil, nil, nil]);
	var rootW = 1; // length of top-level squares, all touching (0,0)

	function add(valx, valy, val){
		switch(root.type){
			case "branch":
				var quads = root.v;
				while(Math.abs(valx) >= rootW || Math.abs(valy) >= rootW){
					quads[0] = Tree.branch([nil, nil, nil, quads[0]]);
					quads[1] = Tree.branch([nil, nil, quads[1], nil]);
					quads[2] = Tree.branch([nil, quads[2], nil, nil]);
					quads[3] = Tree.branch([quads[3], nil, nil, nil]);
					rootW *= 2;
				}
				break;
			default:
				throw new Error("Impossible");
		}
		if(add_({ x: valx, y: valy, val: val }, root, 0, 0, rootW) !== root)
			throw new Error("internal error: a gyökér csomópontoknak egyezniük kell!"); // hehe
	}

	function add_(desc, tree, x, y, w){
		switch(tree.type){
			case "nil":
				return Tree.tip([desc]);

			case "tip":
				var descs = tree.v;
				if(w < minW){
					descs.push(desc);
					return tree;
				}
				var r = Tree.branch([nil, nil, nil, nil]);
				for(var z = 0; z < descs.length; z++)
					r = add_(descs[z], r, x, y, w);
				return add_(desc, r, x, y, w);

			case "branch":
				var quads = tree.v;
				var dx = desc.x < x? -1 : 1;
				var dy = desc.y < y? -1 : 1;
				var quad = 2*(dy < 0? 0 : 1) + (dx < 0? 0 : 1);
				quads[quad] = add_(desc, quads[quad], x + dx*w/2, y + dy*w/2, w/2);
				return tree;
		}
	}

	// assuming w and h are positive
	function traverse(x, y, w, h, fn){
		traverse_(root, 0, 0, rootW, x, y, w, h, function(desc){
			if(
				desc.x >= x && desc.y >= y &&
				desc.x < x + w && desc.y < y + h
			)
				fn(desc.x, desc.y, desc.val);
		});
	}

	function traverse_(tree, tx, ty, tw, x, y, w, h, fn){
		switch(tree.type){
			case "nil":
				break;

			case "tip":
				var descs = tree.v;
				descs.forEach(fn);
				break;

			case "branch":
				var quads = tree.v;
				var n = 0;
				for(var sy = 0; sy < 2; sy++)
					for(var sx = 0; sx < 2; sx++){
						var dx = sx == 0? -1 : 1;
						var dy = sy == 0? -1 : 1;
						if(geom.rectsOverlap(x, y, w, h, tx - tw + sx*tw, ty - tw + sy*tw, tw, tw))
							traverse_(quads[n], tx + dx*tw/2, ty + dy*tw/2, tw/2, x, y, w, h, fn);
						n++;
					}
				break;
		}
	}

	function dbgdraw(canv, x, y, w, h){
		dbgdraw_(canv, root, 0, 0, rootW, x, y, w, h);
	}

	function dbgdraw_(canv, tree, tx, ty, tw, x, y, w, h){
		if(!geom.rectsOverlap(x, y, w, h, tx - tw, ty - tw, tw*2, tw*2))
			return;
		canv.strokeRect(tx - tw, ty - tw, tw*2, tw*2);

		switch(tree.type){
			case "nil":
			case "tip":
				break;

			case "branch":
				var quads = tree.v;
				var n = 0;
				for(var sy = 0; sy < 2; sy++)
					for(var sx = 0; sx < 2; sx++){
						var dx = sx == 0? -1 : 1;
						var dy = sy == 0? -1 : 1;
						dbgdraw_(canv, quads[n++], tx + dx*tw/2, ty + dy*tw/2, tw/2, x, y, w, h);
					}
		}
	}

	return {
		add: add,
		traverse: traverse,
		dbgdraw: dbgdraw
	};
};
