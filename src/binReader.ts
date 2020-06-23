// NOTE: these aliases aren't significant to the compiler, but might be somewhat documentational
export type Float64 = number;
export type Float32 = number;
export type Word32 = number;
export type Word16 = number;
export type Word8 = number;
export type Int32 = number;
export type Int16 = number;
export type Int8 = number;

export function reader(data: string){
	let pos = 0;

	function end(): boolean {
		return pos >= data.length;
	}

	function seek(p: number): void {
		if(p > data.length)
			throw new Error("out of range: " + p);
		pos = p;
	}

	function byte(): Word8 {
		if(pos >= data.length)
			throw new Error("out of range");
		return data.charCodeAt(pos++);
	}

	function unbyte(): Word8 {
		if(pos < 0)
			throw new Error("out of range");
		return data.charCodeAt(pos--);
	}

	function seq(n: number): string {
		if(pos + n > data.length)
			throw new Error("out of range");
		pos += n;
		return data.substr(pos - n, n);
	}

	function skip(n: number): void {
		pos += n;
	}

	function binFloat64le(): Float64 {
		skip(7);
		let b = unbyte();
		const sign = b >> 7;
		let exp = b & 127;
		b = unbyte();
		exp <<= 4;
		exp |= b >> 4;
		let mant = b & 15;
		for(b = 0; b < 6; b++){
			mant *= 1 << 8;
			mant += unbyte();
		}
		skip(9);
		return (sign? -1 : 1)*Math.pow(2, exp - 1023)*(1 + mant*Math.pow(2, -52));
	}

	function binFloat32le(): Float32 {
		skip(3);
		let b = unbyte();
		const sign = b >> 7;
		let exp = b & 127;
		b = unbyte();
		exp <<= 1;
		exp |= b >> 7;
		let mant = b & 127;
		for(b = 0; b < 2; b++){
			mant *= 1 << 8;
			mant += unbyte();
		}
		skip(5);
		return (sign? -1 : 1)*Math.pow(2, exp - 127)*(1 + mant*Math.pow(2, -23));
	}

	function word32le(): Word32 {
		return word16le() | word16le() << 16;
	}

	function word16le(): Word16 {
		return byte() | byte() << 8;
	}

	function int32le(): Int32 {
		const r = word32le();
		return r > 1 << 31? r - (1 << 32) : r;
	}

	function int16le(): Int16 {
		const r = word16le();
		return r > 1 << 15? r - (1 << 16) : r;
	}

	function int8(): Int8 {
		const r = byte();
		return r > 1 << 7? r - (1 << 8) : r;
	}

	function string(max: number): string {
		if(max === undefined)
			max = Infinity;
		for(var n = 0; n < max && pos + n < data.length && data[pos + n] != "\u0000"; n++);
		return seq(n);
	}

	function pstring(n: number): string {
		const s = seq(n);
		return (n = s.indexOf("\u0000")) >= 0? s.substr(0, n) : s;
	}

	return {
		end: end,
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
}
