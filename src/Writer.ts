import { ArrayType, encodeUTF8 } from './codec';

export class Writer {

	constructor(
		public data: ArrayType = [],
		public pos = 0
	) {}

	u8(num: number) {
		this.data[this.pos++] = num & 0xff;

		return this;
	}

	copy(src: ArrayType, srcPos = 0, srcEnd = src.length) {
		let { data, pos } = this;

		while(srcPos < srcEnd) {
			data[pos++] = src[srcPos++];
		}

		this.pos = pos;
		return this;
	}

	ascii(src: string) {
		let { data, pos } = this;
		let srcPos = 0;
		let srcEnd = src.length;

		while(srcPos < srcEnd) {
			data[pos++] = src.charCodeAt(srcPos++);
		}

		this.pos = pos;
		return this;
	}

	utf8(src: string) {
		this.pos = encodeUTF8(src, this.data, this.pos);

		return this;
	}

	padTo(end: number, padding = 0) {
		let { data, pos } = this;

		while(pos < end) {
			data[pos++] = padding;
		}

		this.pos = pos;
		return this;
	}

}

export class WriterLittle extends Writer {

	u16(num: number) {
		let { data, pos } = this;
		this.pos = pos + 2;

		data[pos++] = num & 0xff; num >>= 8;
		data[pos] = num & 0xff;

		return this;
	}

	u32(num: number) {
		let { data, pos } = this;
		this.pos = pos + 4;

		data[pos++] = num & 0xff; num >>= 8;
		data[pos++] = num & 0xff; num >>= 8;
		data[pos++] = num & 0xff; num >>= 8;
		data[pos] = num & 0xff;

		return this;
	}

}

export class WriterBig extends Writer {

	u16(num: number) {
		let { data } = this;
		let pos = (this.pos += 2);

		data[--pos] = num & 0xff; num >>= 8;
		data[--pos] = num & 0xff;

		return this;
	}

	u32(num: number) {
		let { data } = this;
		let pos = (this.pos += 4);

		data[--pos] = num & 0xff; num >>= 8;
		data[--pos] = num & 0xff; num >>= 8;
		data[--pos] = num & 0xff; num >>= 8;
		data[--pos] = num & 0xff;

		return this;
	}

}
