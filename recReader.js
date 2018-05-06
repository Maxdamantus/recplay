"use strict";

var bin = require("./binReader");

var ticker = function(){
	var n = 0;
	return function(m){
		n += m;
		return n - m;
	};
}();

var goffsFrameCount = ticker(4);
var goffsType = ticker(4);
ticker(8);
var goffsLevIdent = ticker(4);
var goffsLevName = ticker(16);
var goffsFloat32s = ticker(0);

exports.reader = function recReader(data){
	var br = bin.reader(data);

	return readerFrom(0);

	function readerFrom(beginPos){
		var offsFrameCount = beginPos + goffsFrameCount;
		var offsType = beginPos + goffsType;
		var offsLevIdent = beginPos + goffsLevIdent;
		var offsLevName = beginPos + goffsLevName;
		var offsFloat32s = beginPos + goffsFloat32s;

		br.seek(beginPos);
		if(beginPos < 0 || br.end())
			return null;
		var frameCount = br.word32le();

		var gticker = function(){
			var offs = offsFloat32s;

			return function(size, count, reader){
				var offs_ = offs;
				offs += size*count*frameCount;
				return function(n){
					return function(frame){
						br.seek(offs_ + size*(n*frameCount + frame));
						return reader();
					};
				};
			};
		}();

		var float32s = gticker(4, 2, br.binFloat32le); // bikeX, bikeY
		var int16s = gticker(2, 7, br.int16le); // leftX, leftY, rightX, rightY, headX, headY, bikeR
		var word8s = gticker(1, 5, br.byte); // leftR, rightR, turn, unk1, unk2

		var eventCount = gticker(4, 1, br.word32le)(0)(0); // heh
		var offsEvents = br.pos();

		function event(n, fn){
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

			event_: function(n){
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
};
