import * as levRn from "./levReader";
import * as recRn from "./recReader";
import * as get from "./get";
import * as lgr from "./lgr";
import * as player from "./player";

export type Controller = {
	loadReplay(recName: string, shirts: (string | null)[]): void;
	loadLevel(levName: string, cont?: () => void): void;
	resize(wd: number, ht: number): void;
	player(): player.Player;
	stopDraw(): void;
	draw(): void;
};

function setCanvasSize(e: HTMLCanvasElement, width: number, height: number) {
	e.width = width;
	e.height = height;
	e.getContext("2d")!.imageSmoothingEnabled = false;
}

export function make(levName: string, imagesPath: string, elem: HTMLElement, document: Document){
	const createElement = document.createElementNS?
		((tag: string) => document.createElementNS("http://www.w3.org/1999/xhtml", tag)) :
		((tag: string) => document.createElement(tag));

	const mkCanv: lgr.MkCanv = (w, h) => {
		const o = createElement("canvas") as HTMLCanvasElement;
		setCanvasSize(o, w, h);
		return o;
	};

	return (cont: (controller: Controller) => void) => {
		const canvase = mkCanv(600, 480);
		const canvas = canvase.getContext("2d");
		let stopDraw = false;
		elem.appendChild(canvase);
		get.get(levName, function(lev){
			const pllgr = lgr.make(imagesPath, () => createElement("img") as HTMLImageElement, mkCanv);
			const pl = player.make(levRn.reader(lev), pllgr, mkCanv);
			(window as any)["pl"] = pl; // just so it's accessible in the console

			function listener(e: KeyboardEvent){
				const kc = e.keyCode;
				let result: string;
				if(!e.ctrlKey && !e.metaKey && !e.altKey && kc >= "A".charCodeAt(0) && kc <= "Z".charCodeAt(0))
					result = String.fromCharCode(kc + (e.shiftKey? 0 : 32));
				else{
					const fromCode: { [code: string]: string } =
						{ "219": "[", "221": "]", "8": "backspace", "32": "space", "37": "left", "38": "up", "39": "right", "40": "down" };
					result = fromCode[String(kc)];
				}
				if(result !== undefined){
					if(pl.inputKey(result))
						e.preventDefault();
				}
			};

			canvase.setAttribute("tabindex", "0");
			canvase.addEventListener("keydown", listener, true);
		
			const loop = typeof requestAnimationFrame != "undefined"? function(fn: () => void){
				void function go(){
					requestAnimationFrame(go);
					fn();
				}();
			} : function(fn: () => void){
				const fps = 30;
				setInterval(fn, 1000/fps);
			};

			function draw(){
				pl.draw(canvas!, 0, 0, canvase.width, canvase.height, true);
			}

			setTimeout(function(){
				if(!stopDraw)
					loop(draw);
				stopDraw = true;
			}, 0);

			function rect(){
				return canvase.getBoundingClientRect();
			}

			canvase.addEventListener("click", function(e){
				const r = rect();
				pl.inputClick(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height);
				e.preventDefault();
			});

			canvase.addEventListener("mousedown", function(e){
				const r = rect();
				const cont = pl.inputDrag(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height);

				function onmousemove(e: MouseEvent){
					cont.update(e.clientX - r.left, e.clientY - r.top);
					e.preventDefault();
				}

				function onmouseup(){
					cont.end();
					// /me dislikes function identity
					document.removeEventListener("mousemove", onmousemove);
					document.removeEventListener("mouseup", onmouseup);
					e.preventDefault();
				}

				document.addEventListener("mousemove", onmousemove);
				document.addEventListener("mouseup", onmouseup);
			});

			canvase.addEventListener("touchstart", function ontouchstart(e){
				const ts = e.changedTouches;
				const r = rect();

				if(ts.length < 1)
					return;
				e.preventDefault();

				const cont = pl.inputDrag(ts[0].clientX - r.left, ts[0].clientY - r.top, canvase.width, canvase.height);

				let isClick = true;

				function ontouchmove(e: TouchEvent){
					const ts = e.changedTouches;
					if(ts.length < 1)
						return;
					isClick = false;
					cont.update(ts[0].clientX - r.left, ts[0].clientY - r.top);
					e.preventDefault();
				}

				function ontouchend(){
					cont.end();
					if(isClick)
						pl.inputClick(ts[0].clientX - r.left, ts[0].clientY - r.top, canvase.width, canvase.height);
					// ..
					document.removeEventListener("touchmove", ontouchmove);
					document.removeEventListener("touchend", ontouchend);
					document.removeEventListener("touchcancel", ontouchend);

					canvase.addEventListener("touchstart", ontouchstart);
				}

				document.addEventListener("touchmove", ontouchmove);
				document.addEventListener("touchend", ontouchend);
				document.addEventListener("touchcancel", ontouchend);

				canvase.removeEventListener("touchstart", ontouchstart);
			});

			canvase.addEventListener("wheel", function(e: WheelEvent){
				const r = rect();
				const delta = e.deltaMode == WheelEvent.DOM_DELTA_LINE? 53/3*e.deltaY : e.deltaY;
				pl.inputWheel(e.clientX - r.left, e.clientY - r.top, canvase.width, canvase.height, delta);
				e.preventDefault();
			});

			cont({
				loadReplay(recName, shirts){
					get.get(recName, function(rec){
						pl.addReplay(recRn.reader(rec), !shirts? [] : shirts.map(function(s){
							return s == null? null : pllgr.lazy(s);
						}));
					});
				},

				loadLevel(levName, cont){
					get.get(levName, function(lev){
						pl.changeLevel(levRn.reader(lev));
						if(cont)
							cont();
					});
				},

				resize(wd, ht){
					setCanvasSize(canvase, wd, ht);
					pl.invalidate();
				},

				player(){
					return pl;
				},

				// NOTE: this function needs to be called
				// immediately in `cont`
				stopDraw(){
					if(stopDraw)
						throw new Error("Must be called immediately");
					stopDraw = true;
				},

				draw
			});
		});
	};
};
