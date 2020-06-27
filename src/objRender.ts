import * as geom from "./util/geom";
import * as levReader from "./levReader";
import * as recReader from "./recReader";
import * as lgr from "./lgr";

type Pos = [number, number];

type Obj =
	{ type: "fl", pos: Pos } |
	{ type: "ap", pos: Pos, grav: levReader.Gravity, anim: number, taken: number } |
	{ type: "ki", pos: Pos } |
	{ type: "st", pos: Pos };

export type ObjRenderer = {
    appleCount(): number;
    applesTaken(frame: number): number;
    gravity(frame: number, rec: number): string;
    draw(canv: CanvasRenderingContext2D, lgr: lgr.Lgr, frame: number, x: number, y: number, w: number, h: number, scale: number): void;
};

export function renderer(levReader: levReader.LevReader, recReader: recReader.RecReader | null): ObjRenderer {
	let appleCount = 0;

	const objs = function(){
		const flowers: Obj[] = [], apples: Obj[] = [], killers: Obj[] = [], starts: Obj[] = [];

		// TODO: handle errors
		const count = levReader.objCount()
		for(let x = 0; x < count; x++)
			levReader.obj(
				x,
				(x, y) => { flowers.push({ type: "fl", pos: [x, y] }); },
				(x, y, grav, anim) => {
					appleCount++;
					apples.push({ type: "ap", pos: [x, y], grav: grav, anim: anim, taken: -1 });
				},
				(x, y) => { killers.push({ type: "ki", pos: [x, y] }); },
				(x, y) => { starts.push({ type: "st", pos: [x, y] }); }
			);

		return [...killers, ...apples, ...flowers, ...starts];
	}();

	const enum Gravity {
		Up = "up", Down = "down", Left = "left", Right = "right"
	}

	const applesTaken: [number, number][] = [];
	const gravityChanges: [number, Gravity][][] = [];
	{
		for(let rec = 0, recR = recReader; recR; recR = recR.next, rec++){
			const count = recR.eventCount();
			const gravC: [number, Gravity][] = [];
			for(let x = 0; x < count; x++)
				recR.event(x, (time, info, type) => {
					if(type == 0){ // TODO: check it's actually there?
						if(info > objs.length)
							return;
						const obj = objs[info];
						if(obj.type == "ap" && obj.taken == -1){ // TODO: maybe track gravity here?
							const frame = time/.01456;
							obj.taken = frame;
							applesTaken.push([frame, rec]);
							if(obj.grav > 0)
								gravC.push([frame, [Gravity.Up, Gravity.Down, Gravity.Left, Gravity.Right][obj.grav - 1]]);
						}
					}
				});
			gravityChanges.push(gravC);
		}
		applesTaken.sort((a, b) => {
			return (a[0] > b[0]? 1 : 0) - (a[0] < b[0]? 1 : 0);
		});
	}

	const isAppleTaken = recReader && recReader.isAppleTaken || ((frame, id) => {
		const obj = objs[id];
		return obj.type == "ap" && obj.taken > -1 && obj.taken <= frame;
	});

	return {
		appleCount(){
			return appleCount;
		},

		applesTaken: recReader && recReader.applesTaken || (frame => {
			let x;
			for(x = 0; x < applesTaken.length; x++)
				if(applesTaken[x][0] >= frame)
					break;
			return x;
		}),

		gravity(frame, rec){
			const gravC = gravityChanges[rec];
			if(gravC.length == 0) // returns empty string if gravity is default for whole rec
				return "";
			let x;
			for(x = 0; x < gravC.length; x++)
				if(gravC[x][0] >= frame)
					break;
			return x? gravC[x - 1][1] : "down";
		},

		draw: function(canv, lgr, frame, x, y, w, h, scale){
			canv.save();
				canv.scale(scale, scale);
				canv.translate(-x, -y);

				for(let z = 0; z < objs.length; z++){
					const obj = objs[z];
					canv.save();
						canv.translate(objs[z].pos[0], objs[z].pos[1]);
						canv.scale(40/48, 40/48);
						canv.translate(-0.5, -0.5);
						switch(obj.type){
							case "ap":
								if(isAppleTaken(frame, z))
									break;
								if(obj.anim)
									lgr.qfood2.frame(canv, frame%51, 51);
								else
									lgr.qfood1.frame(canv, frame%34, 34);
								break;
							case "fl":
								lgr.qexit.frame(canv, frame%50, 50);
								break;
							case "ki":
								lgr.qkiller.frame(canv, frame%33, 33);
								break;
						}
					canv.restore();
				}
			canv.restore();
		}
	};
};
