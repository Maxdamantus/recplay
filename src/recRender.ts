import { RecReader } from "./recReader";

type Canv = CanvasRenderingContext2D;

// TODO: refer to LGR types
type Lgr = { [pict: string]: Image };
type Image = {
	draw(canv: Canv): void;
	touch(): boolean;
};

function hypot(a: number, b: number){
	return Math.sqrt(a*a + b*b);
}

// (x1, y1)–(x2, y2): line to draw image along
// bx: length of image used before (x1, y1)
// br: length of image used after (x2, y2)
// by: proportional (of ih) y offset within the image the line is conceptually along
// ih: image height
function skewimage(canv: Canv, img: Image, bx: number, by: number, br: number, ih: number, x1: number, y1: number, x2: number, y2: number, box?: boolean): void {
	const o = x2 - x1, a = y2 - y1;
	canv.save();
		canv.translate(x1, y1);
		canv.rotate(Math.atan2(a, o));
		canv.translate(-bx, -by*ih);
		canv.scale(bx + br + hypot(o, a), ih);
		img.draw(canv);
		if(box){
			canv.strokeStyle = "purple";
			canv.lineWidth = 0.02;
			canv.strokeRect(0, 0, 1, 1);
		}
	canv.restore();
}

function target(canv: Canv, x: number, y: number, s: number): void {
	canv.beginPath();
	canv.moveTo(x - s/2, y);
	canv.lineTo(x + s/2, y);
	canv.moveTo(x, y - s/2);
	canv.lineTo(x, y + s/2);
	canv.stroke();
}

type LimbParams = {
	length: number,
	bx: number, by: number,
	br: number,
	ih: number
};

function limb(cwInner: boolean, fstParams: LimbParams, sndParams: LimbParams){
	return function(canv: Canv, fstImg: Image, x1: number, y1: number, sndImg: Image, x2: number, y2: number): void {
		const dist = hypot(x2 - x1, y2 - y1);
		let fstLen = fstParams.length, sndLen = sndParams.length;

		const prod =
			(dist + fstLen + sndLen)*
			(dist - fstLen + sndLen)*
			(dist + fstLen - sndLen)*
			(-dist + fstLen + sndLen);
		const angle = Math.atan2(y2 - y1, x2 - x1);
		let jointangle = 0;
		if(prod >= 0 && dist < fstLen + sndLen){
			// law of sines
			const circumr = dist*fstLen*sndLen/Math.sqrt(prod);
			jointangle = Math.asin(sndLen/(2*circumr));
		}else
			fstLen = fstLen/(fstLen + sndLen)*dist;

		if(cwInner)
			jointangle *= -1;
			
		const jointx = x1 + fstLen*Math.cos(angle + jointangle);
		const jointy = y1 + fstLen*Math.sin(angle + jointangle);

		skewimage(canv, fstImg, fstParams.bx, fstParams.by, fstParams.br, fstParams.ih, jointx, jointy, x1, y1);
		skewimage(canv, sndImg, sndParams.bx, sndParams.by, sndParams.br, sndParams.ih, x2, y2, jointx, jointy);
	};

}

const legLimb = limb(false, {
	length: 26.25/48,
	bx: 0, by: 0.6, br: 6/48, ih: 39.4/48/3
}, {
	length: 1 - 26.25/48,
	bx: 5/48/3, by: 0.45, br: 4/48, ih: 60/48/3
});

const armLimb = limb(true, {
	length: 0.3234,
	bx: 12.2/48/3, by: 0.5, br: 13/48/3, ih: -32/48/3
}, {
	length: 0.3444,
	bx: 3/48, by: 0.5, br: 13.2/48/3, ih: 22.8/48/3
});

export type RecRenderer = {
	draw(canv: Canv, lgr: Lgr, shirt: Image, frame: number, x: number, y: number, scale: number): void;
	bikeXi(frame: number): number;
	bikeYi(frame: number): number;
};

export function renderer(reader: RecReader): RecRenderer {
	const turnFrames = function(){
		if(reader.lastTurn)
			return [];

		const fc = reader.frameCount();
		const o: number[] = [];
		let t = 0;
		for(let f = 0; f < fc; f++){
			const tmp = reader.turn(f) >> 1 & 1;
			if(tmp != t)
				o.push(f);
			t = tmp;
		}
		return o;
	}();

	const volts = function(){
		if(reader.lastVolt)
			return [];

		const ec = reader.eventCount();
		const o: [number, boolean][] = [];
		for(let e = 0; e < ec; e++)
			reader.event(e, (time, info, type, a, b) => {
				const frame = Math.ceil(time/.01456);
				switch(type){
					case 6: // right volt
						o.push([frame, true]);
						break;
					case 7: // left volt
						o.push([frame, false]);
						break;
				}
			});
			return o;
	}();

	const lastTurn = reader.lastTurn || (frame => {
		let x: number;
		for(x = 0; x < turnFrames.length; x++)
			if(turnFrames[x] > frame)
				break;
		return x? turnFrames[x - 1] : -1;
	});

	const lastVolt = reader.lastVolt || (frame => {
		let x: number;
		for(x = 0; x < volts.length; x++)
			if(volts[x][0] > frame)
				break;
		return x? volts[x - 1] : null;
	});

	type FrameToNumber = (frame: number) => number;

	function interpolate(fn: FrameToNumber): FrameToNumber {
		return n => {
			const f = Math.floor(n), o = n - f, r = fn(f);
			if(o == 0)
				return r;
			return r + (fn(f + 1) - r)*o;
		};
	}

	function interpolateAng(fn: FrameToNumber, mod: number): FrameToNumber {
		return n => {
			const f = Math.floor(n), o = n - f, r = fn(f);
			if(o == 0)
				return r;
			const rs = fn(f + 1), offs = 0;
			const diff1 = rs - r, diff2 = (rs + mod/2)%mod - (r + mod/2)%mod;
			const diff = Math.abs(diff1) < Math.abs(diff2)? diff1 : diff2;
			return r + diff*o;
		};
	}

	function turnScale(x: number){
		return -Math.cos(x*Math.PI);
	}

	const bikeXi = interpolate(reader.bikeX);
	const bikeYi = interpolate(reader.bikeY);
	const bikeRi = interpolateAng(reader.bikeR, 10000);
	const leftXi = interpolate(reader.leftX);
	const leftYi = interpolate(reader.leftY);
	const leftRi = interpolateAng(reader.leftR, 250);
	const rightXi = interpolate(reader.rightX);
	const rightYi = interpolate(reader.rightY);
	const rightRi = interpolateAng(reader.rightR, 250);
	const headXi = interpolate(reader.headX);
	const headYi = interpolate(reader.headY);

	function wheel(canv: Canv, lgr: Lgr, wheelX: number, wheelY: number, wheelR: number){
		canv.save();
			canv.translate(wheelX, -wheelY);
			canv.rotate(-wheelR);
			canv.scale(38.4/48, 38.4/48);
			canv.translate(-0.5, -0.5);
			lgr.wheel.draw(canv);
		canv.restore();
	}

	// (x, y): top left in Elma coordinates
	// arguably a microoptimisation, but it doesn't produce any objects in the JS world
	function draw(canv: Canv, lgr: Lgr, shirt: Image, frame: number, x: number, y: number, scale: number){
		canv.save();
			canv.translate(/*Math.ceil*/(scale*(-x + bikeXi(frame))), /*Math.ceil*/(scale*(-y - bikeYi(frame))));
			canv.scale(scale, scale);
			canv.beginPath();

			const bikeR = bikeRi(frame)*Math.PI*2/10000;
			const turn = !!(reader.turn(Math.floor(frame)) >> 1 & 1);
			const leftX = leftXi(frame)/1000;
			const leftY = leftYi(frame)/1000;
			const leftR = leftRi(frame)*Math.PI*2/250;
			const rightX = rightXi(frame)/1000;
			const rightY = rightYi(frame)/1000;
			const rightR = rightRi(frame)*Math.PI*2/250;
			const headX = headXi(frame)/1000;
			const headY = headYi(frame)/1000;
			const lastTurnF = lastTurn(frame);
			const lv: [number, boolean] | null = lastVolt(frame);

			const animlen = 28;
			let animpos = lv != null && frame - lv[0] < animlen? (frame - lv[0])/animlen : 0;
			const turnpos = lastTurnF >= 0 && lastTurnF + 24 > frame? (frame - lastTurnF)/24 : 0;

			const backX = !turn? rightX : leftX;
			const backY = !turn? rightY : leftY;
			const backR = !turn? rightR : leftR;
			const frontX = turn? rightX : leftX;
			const frontY = turn? rightY : leftY;
			const frontR = turn? rightR : leftR;

			if(turnpos == 0 || turnpos > 0.5)
				wheel(canv, lgr, backX, backY, backR);
			if(turnpos <= 0.5)
				wheel(canv, lgr, frontX, frontY, frontR);

			canv.save();
				canv.rotate(-bikeR);
				if(turn)
					canv.scale(-1, 1);
				if(turnpos > 0)
					canv.scale(turnScale(turnpos), 1);

				let wx: number, wy: number, a: number, r: number;
				let hbarsX = -21.5, hbarsY = -17;
				canv.save();
					canv.scale(1/48, 1/48);

					// front suspension
					wx = turn? rightX : leftX;
					wy = turn? -rightY : -leftY;
					a = Math.atan2(wy, (turn? -1 : 1) * wx) + (turn? -1 : 1) * bikeR;
					r = hypot(wx, wy);
					skewimage(canv, lgr.susp1, 2, 0.5, 5, 6, 48*r * Math.cos(a), 48*r * Math.sin(a), hbarsX, hbarsY);

					// rear suspension
					wx = turn? leftX : rightX;
					wy = turn? -leftY : -rightY;
					a = Math.atan2(wy, (turn? -1 : 1) * wx) + (turn? -1 : 1) * bikeR;
					r = hypot(wx, wy);
					//skewimage(canv, lgr.susp2, 5, 0.5, 5, 6.5, 48*r*Math.cos(a), 48*r*Math.sin(a), 10, 20);
					skewimage(canv, lgr.susp2, 0, 0.5, 5, 6, 9, 20, 48*r*Math.cos(a), 48*r*Math.sin(a));
				canv.restore();

				canv.save(); // bike
					canv.translate(-43/48, -12/48);
					canv.rotate(-Math.PI*0.197);
					canv.scale(0.215815*380/48, 0.215815*301/48);
					lgr.bike.draw(canv);
				canv.restore();

				canv.save(); // kuski
					r = hypot(headX, headY);
					a = Math.atan2(-headY, turn? -headX : headX) + (turn? -bikeR : bikeR);
					wx = r*Math.cos(a);
					wy = r*Math.sin(a);
					canv.translate(wx, wy);

					canv.save(); // head
						canv.translate(-15.5/48, -42/48);
						canv.scale(23/48, 23/48);
						lgr.head.draw(canv);
					canv.restore();

					const bumx = 19.5/48, bumy = 0;
					const pedalx = -wx + 10.2/48/3, pedaly = -wy + 65/48/3;
					legLimb(canv, lgr.q1thigh, bumx, bumy, lgr.q1leg, pedalx, pedaly);

					canv.save(); // torso
						canv.translate(17/48, 9.25/48);
						canv.rotate(Math.PI + 2/3);
						canv.scale(100/48/3, 58/48/3);
						if(shirt && shirt.touch()){
							// assumes shirts are rotated as on EOL site
							canv.translate(0.5, 0.5);
							canv.rotate(Math.PI/2);
							canv.translate(-0.5, -0.5);
							shirt.draw(canv);
						}else
							lgr.q1body.draw(canv);
					canv.restore();

					const shoulderx = 0/48, shouldery = -17.5/48;
					const handlex = -wx - 64.5/48/3, handley = -wy - 59.6/48/3;
					let handx = handlex, handy = handley;

					const animx = shoulderx, animy = shouldery;
					if(animpos > 0){
						let dangle: number, ascale: number;
						if(lv![1] == turn){
							if(animpos >= 0.25)
								animpos = 0.25 - 0.25*(animpos - 0.25)/0.75;
							dangle = 10.8*animpos;
							ascale = 1 - 1.2*animpos;
						}else{
							if(animpos >= 0.2)
								animpos = 0.2 - 0.2*(animpos - 0.2)/0.8;
							dangle = -8*animpos;
							ascale = 1 + 0.75*animpos;
						}
						const at = Math.atan2(handley - animy, handlex - animx) + dangle;
						const dist = ascale*hypot(handley - animy, handlex - animx);
						handx = animx + dist*Math.cos(at);
						handy = animy + dist*Math.sin(at);
					}

					armLimb(canv, lgr.q1up_arm, shoulderx, shouldery, lgr.q1forarm, handx, handy);
				canv.restore();
			canv.restore();

			if(turnpos != 0 && turnpos <= 0.5)
				wheel(canv, lgr, backX, backY, backR);
			if(turnpos > 0.5)
				wheel(canv, lgr, frontX, frontY, frontR);
		canv.restore();
	}

	return {
		draw: draw,
		bikeXi: bikeXi,
		bikeYi: bikeYi
	};
}
