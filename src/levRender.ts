import * as quadTree from "./util/quadTree";
import * as geom from "./util/geom";
import * as lgr from "./lgr";
import * as levReader from "./levReader";
import * as recReader from "./recReader";

function hypot(a: number, b: number): number {
	return Math.sqrt(a*a + b*b);
}

type MkCanv = lgr.MkCanv;
type Canv = CanvasRenderingContext2D;

export type LevRendererDraw = (canv: Canv, x: number, y: number, w: number, h: number, scale: number) => void;

export type LevRenderer = {
    draw: LevRendererDraw;
    cached: (num: number, mkCanv: MkCanv) => LevRendererDraw;
    setGrass: (v: boolean) => void;
    setPictures: (v: boolean) => void;
    setCustomBackgroundSky: (v: boolean) => void;
    drawSky: (canv: Canv, x: number, y: number, w: number, h: number, scale: number) => void;
};

type TreeNode = {
	vertices: Point[];
	inner: PolyTree;
};

type PolyTree = TreeNode[];

type Point = [number, number];

type LevReaderPic = levReader.LevReader extends { pic_(...a: any[]): infer R }? R : never;

function getNum(pic: LevReaderPic): number {
	return (pic as any).num;
}

function setNum(pic: LevReaderPic, n: number): void {
	(pic as any).num = n;
}

function windowDbg(): any {
	return (window as any)["dbg"];
}

export function renderer(reader: levReader.LevReader, lgr: lgr.Lgr): LevRenderer {
	const polyTree: PolyTree = [];
	const grassPolys: Point[][] = [];

	function isSub(v: Point, outer: Point[]): boolean {
		function hits(a: Point, b: Point): boolean {
			// does the line [x, y]–[x, inf] intersect the line a–b?
			const left = Math.min(a[0], b[0]), right = Math.max(a[0], b[0]);
			if(v[0] < left || v[0] >= right)
				return false;
			const m = (b[1] - a[1])/(b[0] - a[0]);
			const yint = m*(v[0] - a[0]) + a[1];
			return yint > v[1];
		}

		let n = 0;
		for(let z = 0; z < outer.length; z++)
			if(hits(outer[z], outer[(z + 1)%outer.length]))
				n++;
		return n%2 != 0;
	}

	function addPoly(vertices: Point[], tree: PolyTree): TreeNode {
		const newTree = [];
		let x;
		for(x = 0; x < tree.length; x++){
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
					tree[x] = tree.pop()!;
				x--;
			}
		}
		return tree[x] = { vertices: vertices, inner: newTree };
	}

	function traverse(tree: PolyTree, isSolid: boolean, fn: (isSolid: boolean, vertices: Point[]) => void){
		tree.forEach(function(poly){
			fn(isSolid, poly.vertices);
			traverse(poly.inner, !isSolid, fn);
		});
	}

	let minX = Infinity, minY = Infinity;
	let maxX = -Infinity, maxY = -Infinity;

	reader.polyReader((grass, count, vertices) => {
		const poly: Point[] = [];
		vertices((x, y) => {
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

	const pictures = function(){
		let tree: quadTree.Tree<LevReaderPic> | null = null;
		let maxImgW = 0, maxImgH = 0; // for overbounding in .traverse

		function traverse(x: number, y: number, w: number, h: number, fn: (x: number, y: number, pict: LevReaderPic) => void): void {
			tree!.traverse(x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
		}

		function calc(): void {
			tree = quadTree.make(1);
			maxImgW = maxImgH = 0;

			const count = reader.picCount();
			for(var x = 0; x < count; x++){
				const pic = reader.pic_(x);
				setNum(pic, x);
				// TODO: defaults?
				tree.add(pic.x, pic.y, pic);
				[pic.picture, pic.mask, pic.texture].forEach(picname => {
					const img = lgr.picts[picname];
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
			dbgdraw: function(canv: Canv, x: number, y: number, w: number, h: number){
				tree!.dbgdraw(canv, x, y, w, h);
			}
		};
	}();

	const grass = function(){
		let tree: quadTree.Tree<lgr.Pict> | null = null;
		let maxImgW = 0, maxImgH = 0; // for overbounding in .traverse

		// assuming w and h are positive
		function traverse(x: number, y: number, w: number, h: number, fn: (x: number, y: number, pict: lgr.Pict) => void): void {
			tree!.traverse(x - maxImgW, y - maxImgH, w + maxImgW, h + maxImgH, fn);
		}

		function calc(): void {
			tree = quadTree.make(1);
			maxImgW = maxImgH = 0;

			grassPolys.forEach(p => {
				calcGrassPoly(48, p);
			});

			function calcGrassPoly(scale: number, poly: Point[]){
				// the path selection is demonstrably wrong, but it probably works in all reasonable cases.
				// it draws along the path from the left-most vertex to the right-most vertex that doesn't
				//   include the widest edge.
				// haven't figured out exactly what Elma itself does.
				let minX = Infinity, maxX = -Infinity, minXi = 0, maxXi = 0;
				for(let z = 0; z < poly.length; z++){
					// WARNING: funny code
					if(minX != (minX = Math.min(minX, poly[z][0])))
						minXi = z;
					if(maxX != (maxX = Math.max(maxX, poly[z][0])))
						maxXi = z;
				}
				var maxW = 0;
				for(let z = minXi; z%poly.length != maxXi; z++)
					maxW = Math.max(maxW, Math.abs(poly[z%poly.length][0] - poly[(z + 1)%poly.length][0]));
				var dir = -1;
				for(let z = poly.length + minXi; z%poly.length != maxXi; z--)
					if(maxW != (maxW = Math.max(maxW, Math.abs(poly[z%poly.length][0] - poly[(z - 1)%poly.length][0]))))
						dir = 1;
				function yAt(x: number): number {
					for(let z = poly.length + minXi; z%poly.length != maxXi; z += dir){
						const from = poly[z%poly.length], to = poly[(z + dir)%poly.length];
						if(from[0] <= x && x < to[0]){
							var m = (to[1] - from[1])/(to[0] - from[0]);
							return m*(x - from[0]) + from[1];
						}
					}
					throw new Error();
				}

				let curX = poly[minXi][0]*scale, curY = poly[minXi][1]*scale;
				const gUps = lgr.grassUp(), gDowns = lgr.grassDown();
				while(curX < maxX*scale){
					let bestD = Infinity, bestA: lgr.Pict[] = null!, bestI = -1;
					for(let a = 0; a < gUps.length; a++){
						if(curX + gUps[a].width >= maxX*scale)
							continue;
						const dist = Math.abs(yAt((curX + gUps[a].width)/scale)*scale - (curY - (gUps[a].height - 41)));
						if(dist < bestD){
							bestD = dist;
							bestA = gUps;
							bestI = a;
						}
					}
					for(let a = 0; a < gDowns.length; a++){
						if(curX + gDowns[a].width >= maxX*scale)
							continue;
						const dist = Math.abs(yAt((curX + gDowns[a].width)/scale)*scale - (curY + (gDowns[a].height - 41)));
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
					const pict = bestA[bestI];
					const fall = (pict.height - 41)*(bestA == gUps? -1 : 1);
					const fcx = Math.floor(curX), fcy = Math.floor(curY + fall);
					const fcyTop = Math.floor(curY) - Math.ceil((pict.height - fall)/2);

					maxImgW = Math.max(maxImgW, pict.width/scale);
					maxImgH = Math.max(maxImgH, pict.height/scale);

					tree!.add(fcx/scale, fcyTop/scale, pict);

					curX += pict.width;
					curY += fall;
				}
			}
		}

		return {
			calc: calc,
			traverse: traverse,
			dbgdraw: function(canv: Canv, x: number, y: number, w: number, h: number){
				tree!.dbgdraw(canv, x, y, w, h);
			}
		};
	}();

	function drawPictures(pics: LevReaderPic[], canv: Canv, scale: number, clipping: lgr.Clipping, x: number, y: number, w: number, h: number){
		function draw(pic: LevReaderPic): void {
			// TODO: are masks specifically for textures? dunno
			let img = lgr.picts[pic.picture];
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
			const mask = lgr.picts[pic.mask];
			if(img && img.draw && mask && mask.draw){
				if(!geom.rectsOverlap(pic.x, pic.y, mask.width, mask.height, x, y, w, h))
					return;
				// TODO: scale textures, fix otherwise
				const px = Math.round(pic.x*scale), py = Math.round(pic.y*scale);
				const offsX = px >= 0? px%img.width : img.width - -px%img.width;
				const offsY = py >= 0? py%img.height : img.height - -py%img.height;
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

	let lgrIdent = {};
	let optIdent = {};
	let optGrass = true;
	let optPictures = true;
	let optCustomBackgroundSky = true;

	// (x, y)–(x + w, y + h): viewport in Elma dimensions
	function draw(canv: Canv, x: number, y: number, w: number, h: number, scale: number){
		if(lgrIdent != lgr._ident){
			if(optGrass)
				grass.calc();
			if(optPictures)
				pictures.calc();
			lgrIdent = lgr._ident;
		}

		const pics: LevReaderPic[] = [];
		pictures.traverse(x, y, w, h, (x, y, pic) => {
			pics.push(pic);
		});
		pics.sort((a, b) => {
			return (a.dist < b.dist? 1 : 0) - (a.dist > b.dist? 1 : 0) || (getNum(a) < getNum(b)? 1 : 0) - (getNum(a) > getNum(b)? 1 : 0);
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

			traverse(polyTree, false, (isSolid, verts) => {
				canv.moveTo(scale*verts[verts.length - 1][0], scale*verts[verts.length - 1][1]);
				for(let z = verts.length - 2; z >= 0; z--)
					canv.lineTo(scale*verts[z][0], scale*verts[z][1]);
			});

			canv.translate(x*scale, y*scale);
			canv.clip(); // clip isn't antialiased in Chromium—different with destination-out
			{
				// TODO: check that it's not accessing something it shouldn't
				const img = optCustomBackgroundSky && lgr.picts[reader.ground()] || lgr.picts["ground"];
				const px = Math.floor(x*scale), py = Math.floor(y*scale);
				const pw = Math.floor(w*scale), ph = Math.floor(h*scale);
				const offsX = x >= 0? px%img.width : img.width - -px%img.width;
				const offsY = y >= 0? py%img.height : img.height - -py%img.height;
				canv.save();
					canv.translate(-img.width - offsX, -img.height - offsY);
					img.repeat(canv, pw + img.width*2, ph + img.height*2);
				canv.restore();
			}

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
							const b = pict.borders!;
							canv.scale(scale/48, scale/48);
							canv.moveTo(0, -24);
							for(let z = 0; z < b.length; z++){
								canv.lineTo(z, b[z] + 1);
								canv.lineTo(z + 1, b[z] + 1);
							}
							canv.lineTo(pict.width, -24);
							canv.closePath();
						canv.restore();
					});
					canv.clip();

					canv.translate(x*scale, y*scale);

					{
						const img = lgr.picts["qgrass"];
						const px = Math.floor(x*scale), py = Math.floor(y*scale);
						const pw = Math.floor(w*scale), ph = Math.floor(h*scale);
						const offsX = x >= 0? px%img.width : img.width - -px%img.width;
						const offsY = y >= 0? py%img.height : img.height - -py%img.height;
						canv.save();
							canv.translate(-img.width - offsX, -img.height - offsY);
							img.repeat(canv, pw + img.width*2, ph + img.height*2);
						canv.restore();
					}
				canv.restore();

				grass.traverse(x, y, w, h, (grassX, grassY, pict) => {
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
		if(windowDbg()){
			canv.strokeRect(0, 0, w*scale, h*scale);
			if(windowDbg() > 1){
				canv.save();
					canv.translate(-x*scale, -y*scale);
					canv.scale(scale, scale);
					canv.lineWidth = 1/48;
					canv.strokeStyle = "orange";
					if(windowDbg() & 2)
						grass.dbgdraw(canv, x, y, w, h);
					canv.strokeStyle = "purple";
					if(windowDbg() & 4)
						pictures.dbgdraw(canv, x, y, w, h);
				canv.restore();
			}
		}
	};

	function cached(num: number, mkCanv: MkCanv){
		let cscale = 1, xp = 0, yp = 0, wp = 0, hp = 0;
		let canvs: HTMLCanvasElement[] = [];
		let cacheLgrIdent: any = null;
		var cacheOptIdent: any = null;

		function update(which: number, canv: HTMLCanvasElement){
			let x = which%num, y = Math.floor(which/num);
			x = xp + x*wp;
			y = yp + y*hp;
			const ctx = canv.getContext("2d")!;
			ctx.clearRect(0, 0, canv.width, canv.height);
			draw(ctx, x/cscale, y/cscale, wp/cscale, hp/cscale, cscale);
		}

		function invalid(){
			return (
				lgr._ident != lgrIdent ||
				cacheLgrIdent != lgrIdent ||
				cacheOptIdent != optIdent);
		}

		return function cachedDraw(canv: Canv, x: number, y: number, w: number, h: number, scale: number){
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
				for(let z = 0; z < num*num; z++)
					update(z, canvs[z] = mkCanv(wp, hp));
			}
			// TODO: will render things unnecessarily if it jumps a whole column/row
			// doesn't matter when num == 2
			// should try to generalise this—whole thing looks unreadable

			// NOTE: using `any` because I can't really understand the code; will be removed soon anyway
			while(yp > y){ // stuff missing from top
				yp -= hp;
				canvs.splice.apply(canvs, [0, 0].concat((canvs as any).splice(num*(num - 1), num)) as any);
				for(let z = 0; z < num; z++)
					update(z, canvs[z]);
			}
			while(yp + num*hp < y + h){ // stuff missing from bottom
				yp += hp;
				canvs.splice.apply(canvs, [num*(num - 1), 0].concat((canvs as any).splice(0, num)) as any);
				for(let z = 0; z < num; z++)
					update(num*(num - 1) + z, canvs[num*(num - 1) + z]);
			}
			while(xp > x){ // stuff missing from left
				xp -= wp;
				for(let z = 0; z < num; z++){
					canvs.splice(z*num, 0, canvs.splice((z + 1)*num - 1, 1)[0]);
					update(z*num, canvs[z*num]);
				}
			}
			while(xp + num*wp < x + w){ // stuff missing from right
				xp += wp;
				for(let z = 0; z < num; z++){
					canvs.splice((z + 1)*num - 1, 0, canvs.splice(z*num, 1)[0]);
					update((z + 1)*num - 1, canvs[(z + 1)*num - 1]);
				}
			}

			for(let xi = 0; xi < num; xi++)
				for(let yi = 0; yi < num; yi++)
					canv.drawImage(canvs[yi*num + xi], xp - x + xi*wp, yp - y + yi*hp);

		};
	}

	return {
		draw: draw,
		cached: cached,
		setGrass: (v) => { optGrass = v; optIdent = {}; },
		setPictures: (v) => { optPictures = v; optIdent = {}; },
		setCustomBackgroundSky: (v) => { optCustomBackgroundSky = v; optIdent = {}; },
		drawSky: (canv, x, y, w, h, scale) => {
			// TODO: check that it's not accessing something it shouldn't
			const img = optCustomBackgroundSky && lgr.picts[reader.sky()] || lgr.picts["sky"];
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
}
