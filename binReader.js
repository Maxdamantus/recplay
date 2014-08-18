define([], function(){
	return function binReader(data){
		var pos = 0;

		function seek(p){
			if(p >= data.length)
				throw new Error("out of range: " + p);
			pos = p;
		}

		function byte(){
			if(pos >= data.length)
				throw new Error("out of range");
			return data.charCodeAt(pos++);
		}

		function unbyte(){
			if(pos < 0)
				throw new Error("out of range");
			return data.charCodeAt(pos--);
		}

		function seq(n){
			if(pos + n > data.length)
				throw new Error("out of range");
			pos += n;
			return data.substr(pos - n, n);
		}

		function skip(n){
			pos += n;
		}

		function binFloat64le(){
			var sign, exp, mant, b;

			skip(7);
			b = unbyte();
			sign = b >> 7;
			exp = b & 127;
			b = unbyte();
			exp <<= 4;
			exp |= b >> 4;
			mant = b & 15;
			for(b = 0; b < 6; b++){
				mant *= 1 << 8;
				mant += unbyte();
			}
			skip(9);
			return (sign? -1 : 1)*Math.pow(2, exp - 1023)*(1 + mant*Math.pow(2, -52));
		}

		function binFloat32le(){
			var sign, exp, mant, b;

			skip(3);
			b = unbyte();
			sign = b >> 7;
			exp = b & 127;
			b = unbyte();
			exp <<= 1;
			exp |= b >> 7;
			mant = b & 127;
			for(b = 0; b < 2; b++){
				mant *= 1 << 8;
				mant += unbyte();
			}
			skip(5);
			return (sign? -1 : 1)*Math.pow(2, exp - 127)*(1 + mant*Math.pow(2, -23));
		}

		function word32le(){
			return word16le() | word16le() << 16;
		}

		function word16le(){
			return byte() | byte() << 8;
		}

		function int32le(){
			var r = word32le();
			return r > 1 << 31? r - (1 << 32) : r;
		}

		function int16le(){
			//console.log("0x" + pos.toString(16));
			var r = word16le();
			return r > 1 << 15? r - (1 << 16) : r;
		}

		function int8(){
			var r = byte();
			return r > 1 << 7? r - (1 << 8) : r;
		}

		function string(max){
			if(max === undefined)
				max = Infinity;
			for(var n = 0; n < max && pos + n < data.length && data[pos + n] != "\0"; n++);
			return seq(n);
		}

		function pstring(n){
			var s = seq(n);
			return (n = s.indexOf("\0")) >= 0? s.substr(0, n) : s;
		}

		return {
			seek: seek,
			byte: byte,
			seq: seq,
			skip: skip,
			binFloat64le: binFloat64le,
			binFloat32le: binFloat32le,
			word32le: word32le,
			word16le: word16le,
			int32le: int32le,
			int16le: int16le,
			int8: int8,
			string: string,
			pstring: pstring,
			pos: function(){
				return pos;
			}
		};
	};
});
