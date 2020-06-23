import * as bin from "./binReader";

const ticker = function(): (size: number) => number {
	let n = 0;
	return function(m: number){
		n += m;
		return n - m;
	};
}();

const goffsFrameCount = ticker(4);
const goffsType = ticker(4);
ticker(8);
const goffsLevIdent = ticker(4);
const goffsLevName = ticker(16);
const goffsFloat32s = ticker(0);

export type EventFn<T> = (time: bin.Float64, info: bin.Word16, type: bin.Word8, _: bin.Word8, dunno: bin.Float32) => T;

type RecReader = {
    frameCount: () => number;
    bikeX: (frame: number) => bin.Float32;
    bikeY: (frame: number) => bin.Float32;
    leftX: (frame: number) => bin.Int16;
    leftY: (frame: number) => bin.Int16;
    rightX: (frame: number) => bin.Int16;
    rightY: (frame: number) => bin.Int16;
    headX: (frame: number) => bin.Int16;
    headY: (frame: number) => bin.Int16;
    bikeR: (frame: number) => bin.Int16;
    leftR: (frame: number) => bin.Word8;
    rightR: (frame: number) => bin.Word8;
    turn: (frame: number) => bin.Word8;
    eventCount: () => number;
    event: <T>(n: number, fn: EventFn<T>) => T;
    event_: (n: number) => {
        time: number;
        info: number;
        type: number;
        dunno: number;
    };
    next: RecReader | null;
};

export function reader(data: string){
	const br = bin.reader(data);

	return readerFrom(0);

	function readerFrom(beginPos: number): RecReader | null {
		const offsFrameCount = beginPos + goffsFrameCount;
		const offsType = beginPos + goffsType;
		const offsLevIdent = beginPos + goffsLevIdent;
		const offsLevName = beginPos + goffsLevName;
		const offsFloat32s = beginPos + goffsFloat32s;

		br.seek(beginPos);
		if(beginPos < 0 || br.end())
			return null;
		const frameCount = br.word32le();

		const gticker = function(){
			var offs = offsFloat32s;

			return function<T>(size: number, count: number, reader: () => T){
				var offs_ = offs;
				offs += size*count*frameCount;
				return function(n: number){
					return function(frame: number){
						br.seek(offs_ + size*(n*frameCount + frame));
						return reader();
					};
				};
			};
		}();

		const float32s = gticker(4, 2, br.binFloat32le); // bikeX, bikeY
		const int16s = gticker(2, 7, br.int16le); // leftX, leftY, rightX, rightY, headX, headY, bikeR
		const word8s = gticker(1, 5, br.byte); // leftR, rightR, turn, unk1, unk2

		const eventCount = gticker(4, 1, br.word32le)(0)(0); // heh
		const offsEvents = br.pos();

		function event<T>(n: number, fn: EventFn<T>): T {
			br.seek(offsEvents + n*(8 + 4 + 4));
			return fn(br.binFloat64le(), br.word16le(), br.byte(), br.byte(), br.binFloat32le());
		}

		return {
			frameCount: function(){
				return frameCount;
			},

			bikeX: float32s(0),
			bikeY: float32s(1),

			leftX: int16s(0),
			leftY: int16s(1),
			rightX: int16s(2),
			rightY: int16s(3),
			headX: int16s(4),
			headY: int16s(5),
			bikeR: int16s(6),

			leftR: word8s(0),
			rightR: word8s(1),
			turn: word8s(2),

			eventCount: function(){
				return eventCount;
			},

			event: event,

			event_: function(n: number){
				return event(n, function(time, info, type, _, dunno){
					return {
						time: time,
						info: info,
						type: type,
						dunno: dunno
					};
				});
			},

			next: readerFrom(offsEvents + eventCount*(8 + 4 + 4) + 4)
		};
	}
}
