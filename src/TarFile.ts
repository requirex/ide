import { ArrayType, encodeUTF8 } from './codec';
import { WriterLittle } from './Writer';

const enum TarType {
	FILE = 0,
	SYMLINK = 2,
	DIRECTORY = 5,
	FIFO = 6
}

const pad = '00000000000';

function padOctal(num: number, len: number) {
	const result = num.toString(8);
	return pad.substr(12 - (len - result.length)) + result + '\0';
}

export class TarFile {

	add(
		name: string | ArrayType,
		data: string | ArrayType,
		mode = 0o644,
		stamp?: number | null
	) {
		const { content } = this;
		stamp = stamp || new Date().getTime();

		if(typeof name == 'string') name = encodeUTF8(name);
		if(typeof data == 'string') data = encodeUTF8(data);

		let pos = content.pos;

		(content
			.copy(name, Math.max(name.length - 100, 0))
			.padTo(pos + 100)
			.ascii(
				padOctal(mode, 8) +
				padOctal(0, 8) +
				padOctal(0, 8) +
				padOctal(data.length, 12) +
				padOctal(~~(stamp / 1000), 12) +
				'        ' +
				TarType.FILE
			)
			.padTo(pos + 257)
			.ascii(
				'ustar  '
			)
			.padTo(pos + 512)
		);

		const end = content.pos;
		let sum = 0;

		while(pos < end) {
			sum += content.data[pos++];
		}

		content.pos = end - (512 - 148);
		content.ascii(padOctal(sum, 8));
		content.pos = end;

		content.copy(data);
		content.padTo((content.pos - 1 | 511) + 1);
	}

	finish() {
		return this.content.data;
	}

	content = new WriterLittle();

}
