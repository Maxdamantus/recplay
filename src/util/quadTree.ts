import * as geom from "./geom";

// an append-only quad tree

type Desc<T> = { x: number, y: number, val: T };

type Node<T> =
	{ type: "nil", v: void } |
	{ type: "tip", v: Desc<T>[] } |
	{ type: "branch", v: [Node<T>, Node<T>, Node<T>, Node<T>] };

const Tree = {
	tip<T>(v: Desc<T>[]): Node<T> {
		return { type: "tip", v };
	},
	branch<T>(v: [Node<T>, Node<T>, Node<T>, Node<T>]): Node<T> {
		return { type: "branch", v };
	}
};
const nil: Node<never> = { type: "nil", v: undefined };

type ValFn<T> = (x: number, y: number, val: T) => void;

type Tree<T> = {
    add(valx: number, valy: number, val: T): void;
    traverse(x: number, y: number, w: number, h: number, fn: ValFn<T>): void;
    dbgdraw(canv: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void;
};

export function make<T>(minW: number): Tree<T> {
	// root must be a (quad) branch
	const root = Tree.branch<T>([nil, nil, nil, nil]);
	let rootW = 1; // length of top-level squares, all touching (0,0)

	function add(valx: number, valy: number, val: T): void{
		switch(root.type){
			case "branch":
				const quads = root.v;
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

	function add_(desc: Desc<T>, tree: Node<T>, x: number, y: number, w: number): Node<T> {
		switch(tree.type){
			case "nil":
				return Tree.tip([desc]);

			case "tip":
				const descs = tree.v;
				if(w < minW){
					descs.push(desc);
					return tree;
				}
				let r = Tree.branch<T>([nil, nil, nil, nil]);
				for(let z = 0; z < descs.length; z++)
					r = add_(descs[z], r, x, y, w);
				return add_(desc, r, x, y, w);

			case "branch":
				const quads = tree.v;
				const dx = desc.x < x? -1 : 1;
				const dy = desc.y < y? -1 : 1;
				const quad = 2*(dy < 0? 0 : 1) + (dx < 0? 0 : 1);
				quads[quad] = add_(desc, quads[quad], x + dx*w/2, y + dy*w/2, w/2);
				return tree;
		}
	}

	// assuming w and h are positive
	function traverse(x: number, y: number, w: number, h: number, fn: ValFn<T>): void {
		traverse_(root, 0, 0, rootW, x, y, w, h, desc => {
			if(
				desc.x >= x && desc.y >= y &&
				desc.x < x + w && desc.y < y + h
			)
				fn(desc.x, desc.y, desc.val);
		});
	}

	function traverse_(tree: Node<T>, tx: number, ty: number, tw: number, x: number, y: number, w: number, h: number, fn: (desc: Desc<T>) => void): void {
		switch(tree.type){
			case "nil":
				break;

			case "tip":
				const descs = tree.v;
				descs.forEach(fn);
				break;

			case "branch":
				const quads = tree.v;
				let n = 0;
				for(let sy = 0; sy < 2; sy++)
					for(let sx = 0; sx < 2; sx++){
						let dx = sx == 0? -1 : 1;
						let dy = sy == 0? -1 : 1;
						if(geom.rectsOverlap(x, y, w, h, tx - tw + sx*tw, ty - tw + sy*tw, tw, tw))
							traverse_(quads[n], tx + dx*tw/2, ty + dy*tw/2, tw/2, x, y, w, h, fn);
						n++;
					}
				break;
		}
	}

	function dbgdraw(canv: CanvasRenderingContext2D, x: number, y: number, w: number, h: number){
		dbgdraw_(canv, root, 0, 0, rootW, x, y, w, h);
	}

	function dbgdraw_(canv: CanvasRenderingContext2D, tree: Node<T>, tx: number, ty: number, tw: number, x: number, y: number, w: number, h: number){
		if(!geom.rectsOverlap(x, y, w, h, tx - tw, ty - tw, tw*2, tw*2))
			return;
		canv.strokeRect(tx - tw, ty - tw, tw*2, tw*2);

		switch(tree.type){
			case "nil":
			case "tip":
				break;

			case "branch":
				const quads = tree.v;
				let n = 0;
				for(let sy = 0; sy < 2; sy++)
					for(let sx = 0; sx < 2; sx++){
						let dx = sx == 0? -1 : 1;
						let dy = sy == 0? -1 : 1;
						dbgdraw_(canv, quads[n++], tx + dx*tw/2, ty + dy*tw/2, tw/2, x, y, w, h);
					}
		}
	}

	return {
		add: add,
		traverse: traverse,
		dbgdraw: dbgdraw
	};
}
