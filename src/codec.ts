const chars64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const toBase64: string[] = [];
const fromBase64: number[] = [];

for(let i = 0; i < 65; ++i) {
	toBase64[i] = chars64.charAt(i);
	fromBase64[chars64.charCodeAt(i)] = i;
}

/** (0xd800 << 10) + 0xdc00 - 0x10000 */
const surrogateOffset = 0x35fdc00;

export type ArrayType = number[] | Uint8Array | Buffer;

export function encodeUTF8(src: string): number[];
export function encodeUTF8(
	src: string,
	dst?: ArrayType,
	dstPos?: number,
	srcPos?: number,
	srcEnd?: number
): number;

/** UTF-8 encode a string to an array of bytes.
  *
  * @param src String to encode.
  * @param dst Destination array or buffer for storing the result.
  * @param dstPos Initial offset to destination, default is 0.
  * @param srcPos Initial offset to source data, default is 0.
  * @param srcEnd Source data end offset, default is its length.
  *
  * @return End offset past data stored if a destination was given,
  * otherwise a numeric array containing the encoded result.
  * Note that output length cannot exceed 3 * input length. */

export function encodeUTF8(
	src: string,
	dst?: ArrayType,
	dstPos = 0,
	srcPos = 0,
	srcEnd = src.length
) {
	let result: number[] | undefined;
	let code: number;
	let a: number, b: number;

	dst = dst || (result = []);

	while(srcPos < srcEnd) {
		code = src.charCodeAt(srcPos++);

		if(code >= 0x80) {
			b = 0b11000000;

			if(code >= 0x800) {
				a = 0b11100000;
				b = 0b10000000;

				if((code - 0xd800 & 0xfc00) == 0) {
					// Surrogate pair first half.
					const next = src.charCodeAt(srcPos) || 0;

					if((next - 0xdc00 & 0xfc00) == 0) {
						// Surrogate pair second half.
						a = 0b10000000;
						code = (code << 10) + next - surrogateOffset;
						dst[dstPos++] = 0b11110000 | (code >> 18);
						++srcPos;
					}
				}

				dst[dstPos++] = a | ((code >> 12) & 0b00111111);
			}

			dst[dstPos++] = b | ((code >> 6) & 0b00111111);
			code = 0b10000000 | (code & 0b00111111);
		}

		dst[dstPos++] = code;
	}

	return result || dstPos;
}

/** Base64 encode a string or numeric array to string.
  *
  * @param src String or array to encode.
  * @param dst Output string prefix, default is empty.
  * @param srcPos Initial offset to source data, default is 0.
  * @param srcEnd Source data end offset, default is its length.
  *
  * @return Encoded string. */

export function encode64(
	src: string | ArrayType,
	dst = '',
	srcPos = 0,
	srcEnd?: number
) {
	let a: number, b: number, c: number;

	if(typeof src == 'string') src = encodeUTF8(src);
	if(srcEnd === void 0) srcEnd = src.length;

	while(srcPos < srcEnd) {
		a = src[srcPos++];
		b = src[srcPos++];
		c = src[srcPos++];

		dst += (
			toBase64[a >> 2] +
			toBase64[((a & 0b11) << 4) | (b >> 4)] +
			// Insert padding if necessary:
			// (~(~n + n) & 64) converts undefined to 64, everything else to 0.
			toBase64[(~(~b + b) & 64) | ((b & 0b1111) << 2) | (c >> 6)] +
			toBase64[(~(~c + c) & 64) | (c & 0b111111)]
		);
	}

	return dst;
}

export function decodeVLQ(src: string): number[];
export function decodeVLQ(
	src: string,
	dst?: number[],
	dstPos?: number,
	srcPos?: number,
	srcEnd?: number
): number;

/** Decode a string containing Base64 variable-length quantities.
  *
  * @param src String to decode.
  * @param dst Destination array for storing the result.
  * @param dstPos Initial offset to destination, default is 0.
  * @param srcPos Initial offset to source data, default is 0.
  * @param srcEnd Source data end offset, default is its length.
  *
  * @return End offset past data stored if a destination was given,
  * otherwise a numeric array containing the encoded result. */

export function decodeVLQ(
	src: string,
	dst?: number[],
	dstPos = 0,
	srcPos = 0,
	srcEnd = src.length
) {
	let result: number[] | undefined;
	let shift = 0;
	let code: number;
	let sign: number;
	let num = 0;

	dst = dst || (result = []);

	while(srcPos < srcEnd) {
		code = fromBase64[src.charCodeAt(srcPos++)];
		num += (code & 31) << shift;

		if(code & 32) {
			shift += 5;
		} else {
			sign = num & 1;
			dst[dstPos++] = ((num >>> 1) ^ -sign) + sign;
	
			shift = 0;
			num = 0;
		}
	}

	return result || dstPos;
}

// TODO
export function encodeVLQ(
	src: number[],
	dst = '',
	srcPos = 0,
	srcEnd = src.length
) {
	while(srcPos < srcEnd) {
		++srcPos;
	}

	return dst;
}

export class Hasher32 {

	constructor(private tbl: number[]) {}

	append(
		src: string | ArrayType,
		srcPos = 0,
		srcEnd?: number
	) {
		let { tbl, crc } = this;

		if(typeof src == 'string') src = encodeUTF8(src);
		if(srcEnd === void 0) srcEnd = src.length;

		while(srcPos < srcEnd) {
			crc = (crc >>> 8) ^ tbl[(crc & 0xff) ^ src[srcPos++]];
		}

		this.crc = crc;

		return(~crc >>> 0);
	}

	crc = ~0;

}

/** 32-bit Cyclic Redundancy Check. */

export class CRC32 {

	/** @param poly Reversed generator polynomial, default edb88320 (Ethernet, GZIP, PNG).
	  * Other good choices are 82f63b78 (Castagnoli) used in Btrfs and eb31d82e (Koopman). */

	constructor(public poly = 0xedb88320) {
		for(let n = 0; n < 256; ++n) {
			let crc = n;
			let b = 8;

			while(b--) {
				crc = ((crc >>> 1) ^ (-(crc & 1) & poly)) >>> 0;
			}

			this.tbl[n] = crc;
		}
	}

	create() {
		return new Hasher32(this.tbl);
	}

	tbl: number[] = [];

}
