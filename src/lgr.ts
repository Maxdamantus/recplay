type Canv = CanvasRenderingContext2D;
export type MkCanv = (width: number, height: number) => HTMLCanvasElement;
type MkImage = () => HTMLImageElement;

export type Clipping = "s" | "g" | "u" | "";

const imgs = { bike: "bike", ground: "ground", head: "head", sky: "sky", susp1: "susp1", susp2: "susp2", wheel: "wheel", qfood1: "qfood1", qfood2: "qfood2", qkiller: "qkiller", qexit: "qexit", q1body: "q1body", q1forarm: "q1forarm", q1leg: "q1leg", q1thigh: "q1thigh", q1up_arm: "q1up_arm" };
const picts: [string, string, number | undefined, Clipping][] = [
	["qgrass","text",400,"s"],
	["qdown_1","pict",400,"s"],
	["qdown_14","pict",400,"s"],
	["qdown_5","pict",400,"s"],
	["qdown_9","pict",400,"s"],
	["qup_0","pict",400,"s"],
	["qup_1","pict",400,"s"],
	["qup_14","pict",400,"s"],
	["qup_5","pict",400,"s"],
	["qup_9","pict",400,"s"],
	["qup_18","pict",400,"s"],
	["qdown_18","pict",400,"s"],
	["cliff","pict",400,"s"],
	["stone1","text",750,"g"],
	["stone2","text",750,"g"],
	["stone3","text",750,"s"],
	["st3top","pict",740,"s"],
	["brick","text",750,"g"],
	["qfood1","pict",400,"u"],
	["qfood2","pict",400,"u"],
	["bridge","pict",400,"u"],
	["sky","text",800,"s"],
	["tree2","pict",540,"s"],
	["bush3","pict",440,"s"],
	["tree4","pict",600,"s"],
	["tree5","pict",600,"s"],
	["log2","pict",420,"s"],
	["sedge","pict",430,"s"],
	["tree3","pict",560,"s"],
	["plantain","pict",450,"u"],
	["bush1","pict",550,"s"],
	["bush2","pict",550,"s"],
	["ground","text",800,"g"],
	["flag","pict",450,"s"],
	["secret","pict",550,"s"],
	["hang","pict",434,"s"],
	["edge","pict",440,"u"],
	["mushroom","pict",430,"s"],
	["log1","pict",420,"s"],
	["tree1","pict",550,"s"],
	["maskbig","mask",,""],
	["maskhor","mask",,""],
	["masklitt","mask",,""],
	["barrel","pict",380,"s"],
	["supphred","pict",380,"s"],
	["suppvred","pict",380,"s"],
	["support2","pict",380,"u"],
	["support3","pict",380,"u"],
	["support1","pict",380,"u"],
	["suspdown","pict",380,"u"],
	["suspup","pict",380,"u"],
	["susp","pict",380,"u"]];

function loading(canv: Canv){
	canv.save();
		canv.lineWidth = 1/20;
		canv.strokeStyle = "red";
		canv.beginPath();
		canv.moveTo(0.5, 0);
		canv.lineTo(0.5, 1);
		canv.moveTo(0, 0.5);
		canv.lineTo(1, 0.5);
		canv.arc(0.5, 0.5, 0.5, 0, Math.PI*2);
		canv.stroke();
	canv.restore();
}

function borders(mkCanv: MkCanv, img: Pict, up: boolean): number[] {
	const canve = mkCanv(img.width, img.height);
	const canv = canve.getContext("2d")!;
	img.drawAt(canv);
	const data = canv.getImageData(0, 0, img.width, img.height).data;
	const o = [];
	if(data)
		for(let x = 0; x < img.width; x++){
			let y;
			for(y = 0; y < img.height && data[4*(y*img.width + x) + 3] == 0; y++);
			o.push(y);
		}
	else{
		const diff = img.height - 41;
		const from = img.height/2 + (up? 1 : -1)*diff/2;
		const to = img.height/2 + (up? -1 : 1)*diff/2;
		for(let x = 0; x < img.width; x++)
			o.push(from + (to - from)*(x/img.width));
	}
	return o;
}

type LgrImgs = { [ImgName in keyof typeof imgs]: Pict };
type LgrPicts = { [name: string]: Pict };

// TODO: consider not using an intersection with `LgrImgs`
export type Lgr = {
	_ident: {};
	picts: LgrPicts;
	lazy(path: string, onLoad?: (pict: Pict) => void): Pict;
	whenLoaded(cb: () => void): void;
	grassUp(): Pict[];
	grassDown(): Pict[];
} & LgrImgs;

export type Pict = {
	name: string | null;
	touch(): boolean;
	width: number;
	height: number;
	draw(canv: Canv): void;
	drawAt(canv: Canv): void;
	repeat(canv: Canv, w: number, h: number): void;
	frame(canv: Canv, frame: number, frameCount: number, x: number, y: number, w: number, h: number): void;
	borders?: number[];
	type?: string;
	dist?: number;
	clipping?: Clipping;
};

export function make(path: string, mkImage: MkImage, mkCanv: MkCanv): Lgr {
	let numLoading = 0;
	let listeners: (() => void)[] = [];

	function allLoaded(){
		const ls = listeners;
		listeners = [];
		ls.forEach(f => {
			f();
		});
	}

	// will call the given function the next time there are no images loading
	// optimally, should be called after trying to render a frame, so it's known
	//   that all required images are ready on the second render
	function whenLoaded(l: () => void){
		if(numLoading > 0)
			listeners.push(l);
		else
			l();
	};

	function lazy(path: string, cont?: (pict: Pict) => void): Pict {
		return lazy_(path, null, cont);
	}

	function lazy_(path: string, name: string | null, cont?: (pict: Pict) => void): Pict {
		let loaded = false;
		let img: HTMLImageElement = null!;

		function ondone(){
			r._ident = {};
			if(cont)
				cont(pict);
			if(--numLoading == 0)
				allLoaded();
		}

		function requested(){
			if(!img){
				++numLoading;
				img = mkImage();
				img.src = path;
				img.onload = () => {
					loaded = true;
					pict.width = img.width;
					pict.height = img.height;
					ondone();
				};
				img.onerror = ondone;
				return false;
			}
			return loaded;
		}

		const pict: Pict = {
			name: name,

			touch: requested,

			width: 48, height: 48,

			draw(canv){
				if(requested())
					canv.drawImage(img, 0, 0, 1, 1);
				else
					loading(canv);
			},

			drawAt(canv){
				if(requested())
					canv.drawImage(img, 0, 0);
				else{
					canv.save();
						canv.scale(48, 48);
						loading(canv);
					canv.restore();
				}
			},

			repeat(canv, w, h){
				if(requested()){
					canv.fillStyle = canv.createPattern(img, "repeat")!;
					canv.fillRect(0, 0, w, h);
				}else{
					canv.save();
						canv.fillStyle = "blue";
						canv.fillRect(0, 0, w, h);
						canv.beginPath();
						canv.strokeStyle = "white";
						for(let x = 0; x <= w; x += 20){
							canv.moveTo(x, 0);
							canv.lineTo(x, h);
						}
						for(let y = 0; y <= h; y += 20){
							canv.moveTo(0, y);
							canv.lineTo(w, y);
						}
						canv.stroke();
					canv.restore();
				}
			},

			frame(canv, num, of, x, y, width, height){
				if(requested()){
					num = Math.floor(num);
					const wdPer = img.width/of;
					canv.drawImage(img, num*wdPer, 0, wdPer, img.height, x, y, width, height);
				}else{
					canv.save();
						canv.translate(x, y);
						canv.scale(width, height);
						canv.translate(0.5, 0.5);
						canv.rotate(Math.PI*2*num/of);
						canv.translate(-0.5, -0.5);
						loading(canv);
					canv.restore();
				}
			}
		};

		return pict;
	}

	const lgrImgs = {} as LgrImgs;
	for(const i_ in imgs){
		const i = i_ as keyof typeof imgs;
		lgrImgs[i] = lazy_(path + "/" + imgs[i] + ".png", i);
	}

	const grassUp: Pict[] = [], grassDown: Pict[] = [];
	let grassUpCount = 0, grassDownCount = 0;

	const lgrPicts = {} as LgrPicts;
	picts.forEach(info => {
		let add: ((g: Pict) => void) | undefined = undefined;
		const [i, type, dist, clipping] = info;
		if(i.indexOf("qup_") == 0){
			grassUpCount++;
			add = g => {
				g.borders = borders(mkCanv, g, true);
				grassUp.push(g);
				grassUp.sort((a, b) => {
					return (a.name! > b.name!? 1 : 0) - (a.name! < b.name!? 1 : 0);
				});
			};
		}
		if(i.indexOf("qdown_") == 0){
			grassDownCount++;
			add = g => {
				g.borders = borders(mkCanv, g, false);
				grassDown.push(g);
				grassDown.sort((a, b) => {
					return (a.name! > b.name!? 1 : 0) - (a.name! < b.name!? 1 : 0);
				});
			};
		}

		const img = lgrPicts[i] = lazy_(path + "/picts/" + i + ".png", i, add);
		img.type = type;
		img.dist = dist;
		img.clipping = clipping;
	});

	const r: Lgr = {
		_ident: {},
		picts: lgrPicts,
		lazy,
		whenLoaded,
		grassUp(){
			if(grassUp.length < grassUpCount)
				picts.forEach(function(i){
					if(i[0].indexOf("qup_") == 0)
						r.picts[i[0]].touch();
				});
			return grassUp;
		},
		grassDown(){
			if(grassDown.length < grassDownCount)
				picts.forEach(function(i){
					if(i[0].indexOf("qdown_") == 0)
						r.picts[i[0]].touch();
				});
			return grassDown;
		},
		...lgrImgs
	};

	return r;
}
