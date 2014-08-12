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

		function seq(n){
			if(pos + n > data.length)
				throw new Error("out of range");
			pos += n;
			return data.substr(pos - n, n);
		}

		function skip(n){
			pos += n;
		}

		function binFloat64be(){
			var sign, exp, mant, b;

			b = byte();
			sign = b >> 7;
			exp = b & 127;
			b = byte();
			exp <<= 4;
			exp |= b >> 4;
			mant = b & 15;
			for(b = 0; b < 6; b++){
				mant *= 1 << 8;
				mant += byte();
			}
			return (sign? -1 : 1)*Math.pow(2, exp - 1023)*(1 + mant*Math.pow(2, -52));
		}

		function binFloat64le(){
			return binReader(seq(8).split("").reverse().join("")).binFloat64be();
		}

		function word32le(){
			var r = 0;
			for(var x = 0; x < 4; x++)
				r += byte() << (x*8);
			return r;
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
			binFloat64be: binFloat64be,
			binFloat64le: binFloat64le,
			word32le: word32le,
			string: string,
			pstring: pstring,
			pos: function(){
				return pos;
			}
		};
	};
});
