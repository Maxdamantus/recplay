import * as bin from "./binReader";

const ticker = function(): (size: number) => number {
	let n = 0;
	return function(m: number){
		n += m;
		return n - m;
	};
}();

const offsType = ticker(5);
ticker(2);
const offsIdent = ticker(4);
const offsIntegrities = ticker(4*8);
const offsDesc = ticker(51);
const offsLgr = ticker(16);
const offsGround = ticker(10);
const offsSky = ticker(10);
const offsPolyCount = ticker(8);
const offsPolys = ticker(0);

type PolyFn = (grass: boolean, vcount: number, vertices: (forEachVertex: VertexFn) => void) => void;
type VertexFn = (vx: number, vy: number) => void;

type ObjFn<T> = (vx: number, vy: number) => T;
type AppleFn<T> = (vx: number, vy: number, grav: Gravity, anim: number) => T;

type PicFn<T> = (picture: string, texture: string, mask: string, vx: number, vy: number, dist: number, clipping: Clipping) => T;

export const enum Gravity {
	None = 0, Up = 1, Down = 2, Left = 3, Right = 4
}

const enum Clipping {
	Unclipped = "u", Ground = "g", Sky = "s"
}

type Obj =
	{ type: "flower", x: number, y: number } |
	{ type: "apple", x: number, y: number, grav: Gravity, anim: number } |
	{ type: "killer", x: number, y: number } |
	{ type: "start", x: number, y: number };

export type LevReader = {
    rightType: () => boolean;
    ident: () => string;
    integrities: () => number[];
    desc: () => string;
    lgr: () => string;
    ground: () => string;
    sky: () => string;
    polyCount: () => number;
    objCount: () => number;
    picCount: () => number;
    polyReader: (forEachPoly: PolyFn) => void;
    obj: <T>(n: number, onFlower: ObjFn<T>, onApple: AppleFn<T>, onKiller: ObjFn<T>, onStart: ObjFn<T>) => T;
    obj_: (n: number) => Obj;
    pic: <T>(n: number, onPic: PicFn<T>) => T;
    pic_: (n: number) => {
        picture: string;
        texture: string;
        mask: string;
        x: number;
        y: number;
        dist: number;
        clipping: Clipping;
    };
};

export function reader(data: string): LevReader {
	const br = bin.reader(data);

	function polyCount(): number {
		br.seek(offsPolyCount);
		return Math.floor(br.binFloat64le());
	}

	function objCount(): number {
		br.seek(offsObjCount);
		return Math.floor(br.binFloat64le());
	}

	function picCount(): number {
		br.seek(offsPicCount);
		return Math.floor(br.binFloat64le());
	}

	const offsObjCount = function(){
		var pc = polyCount();
		br.seek(offsPolys);
		for(let x = 0; x < pc; x++){
			br.skip(4); // grass
			br.skip(br.word32le()*(8 + 8));
		}
		return br.pos();
	}();
	const offsObjs = offsObjCount + 8;
	const offsPicCount = function(){
		br.seek(offsObjCount);
		return offsObjs + Math.floor(br.binFloat64le())*((8 + 8) + (4 + 4 + 4));
	}();
	const offsPics = offsPicCount + 8;

	function obj<T>(n: number, onFlower: ObjFn<T>, onApple: AppleFn<T>, onKiller: ObjFn<T>, onStart: ObjFn<T>): T { // onError? maybe
		br.seek(offsObjs + n*((8 + 8) + (4 + 4 + 4)));
		const vx = br.binFloat64le(), vy = br.binFloat64le();
		const obj = br.word32le(), grav = br.word32le(), anim = br.word32le();
		switch(obj){
			case 1: return onFlower(vx, vy);
			case 2: return onApple(vx, vy, grav, anim);
			case 3: return onKiller(vx, vy);
			case 4: return onStart(vx, vy);
			default: throw new Error("hmm: " + obj + ", x = " + vx + ", y = " + vy);
		}
	}

	function pic<T>(n: number, onPic: PicFn<T>): T {
		br.seek(offsPics + n*(10 + 10 + 10 + 8 + 8 + 4 + 4));
		const picture = br.pstring(10), texture = br.pstring(10), mask = br.pstring(10);
		const vx = br.binFloat64le(), vy = br.binFloat64le();
		const dist = br.word32le(), clipping_ = br.word32le();
		const clipping = [Clipping.Unclipped, Clipping.Ground, Clipping.Sky][clipping_];
		return onPic(picture, texture, mask, vx, vy, dist, clipping);
	}

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

		polyReader: function(forEachPoly: PolyFn){
			/* lr.polyReader(function(grass, vcount, vertices){
			 *   // for each polygon
			 *   vertices(function(x, y){
			 *     // for each vertex in it
			 *   });
			 * });
			 */

			const count = polyCount();
			br.seek(offsPolys);
			for(let x = 0; x < count; x++){
				const grass = br.word32le(), vcount = br.word32le(), pos = br.pos();
				br.seek(pos);
				forEachPoly(grass != 0, vcount, function(forEachVertex: VertexFn){
					for(let y = 0; y < vcount; y++){
						br.seek(pos + y*(8 + 8));
						forEachVertex(br.binFloat64le(), br.binFloat64le());
					}
				});
				br.seek(pos + vcount*(8 + 8));
			}
		},

		obj,

		obj_: function(n: number){
			function h(s: string): AppleFn<Obj> & ObjFn<Obj> {
				return function(vx: number, vy: number, grav?: Gravity, anim?: number): Obj {
					const o = { type: s, x: vx, y: vy } as any;
					if(grav !== undefined){
						o.grav = grav;
						o.anim = anim;
					}
					return o as Obj;
				};
			}

			return obj(n, h("flower"), h("apple"), h("killer"), h("start"));
		},

		pic,

		pic_: function(n: number){
			return pic(n, (picture, texture, mask, vx, vy, dist, clipping) => {
				return {
					picture: picture,
					texture: texture,
					mask: mask,
					x: vx,
					y: vy,
					dist: dist,
					clipping: clipping
				};
			});
		}
	};
}
