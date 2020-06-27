import * as levRnd from "./levRender";
import * as recRnd from "./recRender";
import * as objRnd from "./objRender";
import * as levReader from "./levReader";
import * as recReader from "./recReader";
import * as lgr from "./lgr";

function signum(n: number): -1 | 0 | 1 {
	return n < 0? -1 : n > 0? 1 : 0;
}

function pad(n: number, s: string): string {
	s = String(s);
	while(s.length < n)
		s = "0" + s;
	return s;
}

type Canv = CanvasRenderingContext2D;

export type Player = typeof make extends (...a: any[]) => infer T? T : never;

type Replay = {
	frameCount: number;
	objRn: objRnd.ObjRenderer;
	subs: ReplaySub[];
};

type ReplaySub = {
	rd: recReader.RecReader;
	rn: recRnd.RecRenderer;
	shirt: lgr.Pict | null;
};

type Viewport = {
	offsX: number;
	offsY: number;
	levRn: levRnd.LevRendererDraw;
	scaleFac: number;
};

type DragContinuer = {
	update(cx: number, cy: number): void;
	end(): void;
};

type Opts = {
	grass?: boolean;
	pictures?: boolean;
	customBackgroundSky?: boolean;
};

export function make(levRd: levReader.LevReader, lgr: lgr.Lgr, makeCanvas: lgr.MkCanv){
	let replays: Replay[] = [], levRn: levRnd.LevRenderer = null!;
	let lastFrame = 0;
	let refFrame = 0, refTime = 0;
	let invalidate = true;

	let viewports: Viewport[] = [];

	let focus = true; // whether focus is on replays[0]

	let playing = true;

	let startX = 0, startY = 0;

	let zoom = 0; // scale = 0.8^zoom, of Elma units, where 1 Elma unit is 48 px
	let speed = 1; // where 1 is normal speed, -1 is reversed

	let defaultObjRn: objRnd.ObjRenderer = null!; // for when not spying

	// levRender options; makes sense to persist these
	let optGrass = true;
	let optPictures = true;
	let optCustomBackgroundSky = true;

	let bounds: levRnd.Bounds | null = null;

	reset();

	function reset(){
		replays = []; levRn = levRnd.renderer(levRd, lgr);
		updateLevOpts();
		lastFrame = 0;
		refFrame = 0; refTime = Date.now();
		invalidate = true;

		viewports = [];

		focus = true;

		playing = true;

		startX = 0; startY = 0;
		{
			const nvm = () => {};

			const l = levRd.objCount();
			for(let x = 0; x < l; x++)
				levRd.obj(x, nvm, nvm, nvm, function(x, y){
					startX = x;
					startY = y;
				});
		}

		zoom = 0;
		speed = 1;

		bounds = null;

		defaultObjRn = objRnd.renderer(levRd, null);
	}

	function updateLevOpts(){
		levRn.setGrass(optGrass);
		levRn.setPictures(optPictures);
		levRn.setCustomBackgroundSky(optCustomBackgroundSky);
	}

	function getViewport(n: number): Viewport {
		if(!viewports[n])
			viewports[n] = {
				offsX: 0, offsY: 0,
				// hack! Firefox seems to perform a lot better without the cache
				// suspect it has to do with the offscreen antialiasing it's doing
				levRn: levRn.cached(4, makeCanvas),
				scaleFac: 1
			};
		return viewports[n];
	}

	function setRef(){
		refFrame = lastFrame;
		refTime = Date.now();
		invalidate = true;
	}

	function calcFrameCount(): number {
		if(replays.length == 0)
			return 60*30; // animate objects for a minute
		return replays.map(rp => {
			return rp.frameCount;
		}).reduce((a, b) => {
			return Math.max(a, b);
		}, 0) + 30;
	}

	let frameCount = calcFrameCount();

	function setSpeed(n: number): void {
		if(n == 0)
			return;
		setRef();
		speed = n;
	}

	function setScale(n: number): void {
		if(n == 0)
			return;
		setZoom(Math.log(n)/Math.log(0.8));
	}

	function setZoom(n: number): void {
		zoom = n;
		setRef();
		zoom = n;
	}

	function getScale(): number {
		return Math.pow(0.8, zoom);
	}

	let dragging = false;

	// (w, h), size of canvas
	function inputClick(x: number, y: number, w: number, h: number){
		if(dragging)
			dragging = false;
		else
			changeFocus();
	}

	function inputWheel(x: number, y: number, w: number, h: number, delta: number){
		// was planning on making it zoom around the cursor, but
		// .. what if there are multiple viewports?
		setZoom(zoom + signum(delta));
	}

	function inputDrag(x: number, y: number, w: number, h: number): DragContinuer {
		if(y < 12 && replays.length > 0)
			return dragSeek(x, y, w, h);
		return dragPosition(x, y, w, h);
	}

	function dragPosition(x: number, y: number, w: number, h: number): DragContinuer {
		const vp = focus && replays.length > 0?
			getViewport(Math.floor(y/h*replays[0].subs.length)) :
			getViewport(0);

		const firstOx = vp.offsX, firstOy = vp.offsY;

		console.log(vp.scaleFac, 48*getScale());

		return {
			update(cx, cy){
				dragging = true;
				invalidate = true;
				vp.offsX = firstOx - (cx - x)/(vp.scaleFac*48*getScale());
				vp.offsY = firstOy - (cy - y)/(vp.scaleFac*48*getScale());
			},

			end(){}
		};
	}

	function dragSeek(x: number, y: number, w: number, h: number): DragContinuer {
		const firstPlaying = playing;
		playing = false;

		function update(cx: number, cy: number){
			dragging = true;
			if(replays.length == 0)
				return;
			lastFrame = replays[0].frameCount*cx/w;
			if(lastFrame < 0)
				lastFrame = 0;
			if(lastFrame >= frameCount)
				lastFrame = frameCount - 1;
			setRef();
		}

		update(x, y);

		return {
			update,

			end(){
				playing = firstPlaying;
				setRef();
			}
		};
	}

	function changeFocus(){
		focus = true;
		bounds = null;
		invalidate = true;
		if(replays.length > 0)
			replays.unshift(replays.pop()!);
		resetViewports();
	}

	function unfocus(){
		focus = false;
		invalidate = true;
		resetViewports();
	}

	function fitLev(){
		bounds = levRn.bounds();
		setScale(1);
		invalidate = true;
		resetViewports();
	}

	function resetViewports(){
		for(let z = 0; z < viewports.length; z++)
			viewports[z].offsX = viewports[z].offsY = 0;
	}

	function playPause(){
		playing = !playing;
		setRef();
	}

	function arrow(str: string): string {
		if(str == "up") return "\u2191";
		if(str == "down") return "\u2193";
		if(str == "left") return "\u2190";
		if(str == "right") return "\u2192";
		return "";
	}

	function eround(n: number): number {
		const escale = 48*getScale();
		return Math.round(n*escale)/escale;
	}

	function drawViewport(vp: Viewport, canv: Canv, x: number, y: number, w: number, h: number, frame: number, topRec: ReplaySub | null): void {
		canv.save();
			canv.translate(x, y);
			canv.beginPath();
			canv.moveTo(0, 0);
			canv.lineTo(w, 0);
			canv.lineTo(w, h);
			canv.lineTo(0, h);
			canv.clip();

			let centreX = vp.offsX, centreY = vp.offsY;
			if(bounds != null){
				centreX += (bounds.maxX + bounds.minX)/2;
				centreY += (bounds.maxY + bounds.minY)/2;
				const bw = bounds.maxX - bounds.minX;
				const bh = bounds.maxY - bounds.minY;
				vp.scaleFac = Math.min(w/bw, h/bh)/48;
			}else if(topRec){
				const lf = Math.min(frame, topRec.rd.frameCount() - 1);
				centreX += topRec.rn.bikeXi(lf);
				centreY -= topRec.rn.bikeYi(lf);
				vp.scaleFac = 1;
			}else{
				centreX += startX;
				centreY += startY;
				vp.scaleFac = 1;
			}

			const escale = vp.scaleFac*48*getScale();
			const ex = eround(centreX - w/escale/2), ey = eround(centreY - h/escale/2);
			const ew = eround(w/escale), eh = eround(h/escale);

			levRn.drawSky(canv, ex, ey, ew, eh, escale);
			vp.levRn(canv, ex, ey, ew, eh, escale);
			if(focus && replays.length > 0)
				replays[0].objRn.draw(canv, lgr, Math.min(frame, replays[0].frameCount - 1), ex, ey, ew, eh, escale);
			else
				defaultObjRn.draw(canv, lgr, frame, ex, ey, ew, eh, escale);
			for(let z = replays.length - 1; z >= 0; z--){
				for(let zx = replays[z].subs.length - 1; zx >= 0; zx--){
					let rec = replays[z].subs[zx];
					if(rec != topRec) // object identity
						rec.rn.draw(canv, lgr, rec.shirt, Math.min(frame, rec.rd.frameCount() - 1), ex, ey, escale);
				}
			}
			if(topRec)
				topRec.rn.draw(canv, lgr, topRec.shirt, Math.min(frame, topRec.rd.frameCount() - 1), ex, ey, escale);
		canv.restore();
	}

	function drawFrame(canv: Canv, x: number, y: number, w: number, h: number, frame: number): void {
		x = Math.floor(x); y = Math.floor(y);
		w = Math.floor(w); h = Math.floor(h);
		canv.save();
			canv.translate(x, y);
			canv.beginPath();
			canv.moveTo(0, 0);
			canv.lineTo(w, 0);
			canv.lineTo(w, h);
			canv.lineTo(0, h);
			canv.clip();

			canv.fillStyle = "yellow";
			canv.fillRect(0, 0, w, h);

			if(focus && replays.length > 0){
				const vph = Math.floor(h/replays[0].subs.length);
				// the last viewport gets an extra pixel when h%2 == .subs.length%2
				for(let z = 0; z < replays[0].subs.length; z++)
					drawViewport(getViewport(z), canv, 0, z*vph, w, vph - (z < replays[0].subs.length - 1? 1 : 0), frame, replays[0].subs[z]);
				let t = Math.floor(Math.min(frame, replays[0].frameCount - 1)*100/30);
				canv.font = "14px monospace";
				canv.fillStyle = "yellow";
				const csec = pad(2, String(t%100)); t = Math.floor(t/100);
				const sec = pad(2, String(t%60)); t = Math.floor(t/60);
				canv.fillText(t + ":" + sec + "." + csec, 10, 12*2);
				canv.fillText(replays[0].objRn.applesTaken(frame) + "/" + replays[0].objRn.appleCount(), 10, 12*3);
//				canv.fillText(arrow(replays[0].objRn.gravity(frame, 0)), 10, 12*4);
				canv.fillRect(w*frame/replays[0].frameCount - 2.5, 0, 5, 12);
			}else
				drawViewport(getViewport(0), canv, x, y, w, h, frame, null);
			invalidate = false;
		canv.restore();
	};

	return {
		changeLevel(levRd_: levReader.LevReader){
			levRd = levRd_;
			reset();
		},

		reset,

		getLevel(){
			return levRd;
		},

		drawFrame,

		draw(canv: Canv, x: number, y: number, w: number, h: number, onlyMaybe: boolean): void {
			let curFrame = refFrame;
			const now = Date.now();
			if(playing)
				curFrame += (now - refTime)*speed*30/1000;
			if(replays.length > 0){
				while(frameCount && curFrame >= frameCount){
					curFrame = refFrame = curFrame - frameCount;
					refTime = now;
				}
				while(frameCount && curFrame < 0){
					curFrame = refFrame = frameCount + curFrame;
					refTime = now;
				}
			}

			if(onlyMaybe && lastFrame == curFrame && !invalidate)
				return;
			lastFrame = curFrame;

			drawFrame(canv, x, y, w, h, lastFrame);
		},

		// shirts should be created by lgr.lazy
		addReplay(recRd: recReader.RecReader | null, shirts: (lgr.Pict | null)[]): void {
			if(replays.length == 0){
				lastFrame = 0;
				setRef();
			}
			const objRn = objRnd.renderer(levRd, recRd);
			const subs: ReplaySub[] = [];
			while(recRd){
				subs.push({ rd: recRd, rn: recRnd.renderer(recRd), shirt: shirts[0] || null });
				recRd = recRd.next;
				shirts = shirts.slice(1);
			}
			const replay: Replay = {
				objRn,
				subs,
				frameCount: subs.reduce((a, b) => {
					return Math.max(a, b.rd.frameCount());
				}, 0)
			};
			replays.push(replay);
			frameCount = calcFrameCount();
			invalidate = true;
		},

		changeFocus,
		unfocus,
		fitLev,

		setSpeed,
		setScale,
		setZoom,
		speed(){ return speed; },
		// scale is deprecated, should prefer to use zoom instead
		scale(){ return getScale(); },
		zoom(){ return zoom; },

		setLevOpts(o: Opts){
			if(o.grass != undefined)
				optGrass = o.grass;
			if(o.pictures != undefined)
				optPictures = o.pictures;
			if(o.customBackgroundSky != undefined)
				optCustomBackgroundSky = o.customBackgroundSky;
			updateLevOpts();
		},

		setFrame(s: number){
			lastFrame = s;
			setRef();
		},
		frame(){
			return lastFrame; // TODO: this is a hack
		},

		playPause,
		playing(){ return playing; },

		inputKey(key: string){
			switch(key){
				case "space":
					playPause();
					break;
				case "[":
					setSpeed(speed*0.8); // 0.8^n is actually representable
					break;
				case "]":
					setSpeed(speed/0.8);
					break;
				case "backspace":
					setSpeed(signum(speed));
					break;
				case "f":
					fitLev();
					break;
				case "w":
					setZoom(zoom + 1);
					break;
				case "e":
					setZoom(zoom - 1);
					break;
				case "r":
					setSpeed(-speed);
					break;
				case "p":
					const val = !optCustomBackgroundSky;
					optPictures = optCustomBackgroundSky = val;
					updateLevOpts();
					break;
				case "g":
					optGrass = !optGrass;
					updateLevOpts();
					break;
				case "G":
					optGrass = optPictures = optCustomBackgroundSky = true;
					updateLevOpts();
					break;
				case "right":
					lastFrame += 30*2.5*speed;
					setRef();
					break;
				case "left":
					lastFrame -= 30*2.5*speed;
					setRef();
					break;
				default:
					return false;
			}
			return true;
		},

		inputClick,
		inputDrag,
		inputWheel,

		invalidate(){
			invalidate = true;
		}
	};
}
