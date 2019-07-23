import { ArrayType, encodeUTF8 } from './codec';
import { WriterLittle } from './Writer';

/** File type mapped from POSIX (partial list). */

const enum TarType {
	FILE = '0',
	HARDLINK = '1',
	SYMLINK = '2',
	DIRECTORY = '5',
	FIFO = '6',
	LONGNAME = 'L'
}

const pad = '00000000000';

/** Convert number to octal, left-pad with zeroes to given length
  * and append an ASCII NUL. */

function padOctal(num: number, len: number) {
	const result = num.toString(8);
	return pad.substr(12 - (len - result.length)) + result + '\0';
}

/** Generate a tape archive compatible with UStar (Unix Standard TAR),
  * also readable according to more recent POSIX.1-2001 / pax. */

export class TarFile {

	/** Add a file to the archive.
	  *
	  * @param path Relative path: string (to be UTF-8 encoded) or numeric buffer.
	  * @param data Contents: string (to be UTF-8 encoded) or numeric buffer.
	  * @param mode POSIX file permissions.
	  * @param stamp JavaScript timestamp: milliseconds from 1970-01-01. */

	add(
		path: string | ArrayType,
		data: string | ArrayType,
		mode = 0o644,
		stamp?: number | null,
		type = TarType.FILE
	) {
		const { content } = this;
		stamp = stamp || new Date().getTime();

		if(typeof path == 'string') path = encodeUTF8(path + '\0');
		if(typeof data == 'string') data = encodeUTF8(data);

		const uid = 0;
		const gid = 0;

		let pathLen = path.length;
		let pathOffset1 = 0;
		let pathOffset2 = 0;
		let pos: number;

		if(pathLen > 100) {
			pos = pathLen - 100;
			pathOffset1 = pos;

			// Find first slash.
			while(path[pos] != 47 && ++pos < pathLen) { }

			if(pos < pathLen - 1) pathOffset1 = pos + 1;

			if(path[pathOffset1 - 1] != 47 || pathOffset1 > 156) {
				// Path is unrepresentable in UStar format. Use a GNU-specific
				// kludge: store it in another file with a special name and flag.
				this.add('././@LongLink', path, mode, stamp, TarType.LONGNAME);
			}

			pathOffset2 = Math.max(0, pathOffset1 - 156);
		}

		pos = content.pos;

		(content
			// Last 100 bytes of file path. Should be enough for everyone!
			.copy(path, pathOffset1)
			.padTo(pos + 100)
			.ascii(
				padOctal(mode, 8) +
				padOctal(uid, 8) +
				padOctal(gid, 8) +
				padOctal(data.length, 12) +
				padOctal(~~(stamp / 1000), 12) +
				'        ' +
				type
			)
			// Omit link information.
			.padTo(pos + 257)
			.ascii('ustar\0' + '00')
			// Omit user and group names and device numbers.
			.padTo(pos + 345)
			// Previous bytes of file path to allow total 256.
			// Surely no more are ever needed!
			.copy(path, pathOffset2, pathOffset1 - 1)
			.padTo(pos + 512)
		);

		const end = content.pos;
		let sum = 0;

		while(pos < end) {
			sum += content.data[pos++];
		}

		content.pos = end - (512 - 148);
		// One placeholder space left in place on purpose.
		content.ascii(padOctal(sum, 7));
		content.pos = end;

		content.copy(data);
		content.padTo((content.pos - 1 | 511) + 1);
	}

	finish() {
		return this.content.data;
	}

	content = new WriterLittle();

}
