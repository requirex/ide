import { ArrayType, encodeUTF8, CRC32 } from './codec';
import { WriterLittle } from './Writer';

/** General purpose bit flags, documented for interest. */

const enum ZipFlag {
	/** If set, file contents are encrypted. */
	ENCRYPT = 1,
	/** If set, CRC and sizes go in a descriptor section after file
	  * contents, which were probably of unknown size prior to streaming
	  * directly from elsewhere. */
	STREAM = 1 << 3,
	/** Language encoding flag (EFS) signal file name and contents are
	  * encoded in UTF-8. */
	UTF8 = 1 << 11
}

/** Compression methods (partial list). */

const enum ZipMethod {
	/** Contents as-is, without compression. */
	STORE = 0,
	DEFLATE = 8,
	LZMA = 14
}

/** Operating system used to generate the archive (partial list). */

const enum ZipOS {
	DOS = 0,
	UNIX = 3,
	NTFS = 11,
	VFAT = 14,
	OSX = 19
}

/** File attributes for compression software internal use. */

const enum ZipAttr {
	BINARY = 0,
	TEXT = 1
}

/** POSIX file type (partial list). */

const enum PosixType {
	FIFO = 1,
	DIRECTORY = 4,
	FILE = 8,
	SYMLINK = 10,
	SOCKET = 12
}

/** Magic numbers to identify file sections. */

const enum Magic {
	START = 0x04034b50,
	ITEM = 0x02014b50,
	END = 0x06054b50
}

/** CRC polynomial used to verify integrity of each archived file. */

const crcFactory = new CRC32();

export class ZipFile {

	add(
		path: string | ArrayType,
		data: string | ArrayType,
		mode = 0o644,
		stamp?: number | null,
		comment: string | ArrayType = ''
	) {
		const { content, directory } = this;
		const date = stamp ? new Date(stamp) : new Date();

		if(typeof path == 'string') path = encodeUTF8(path);
		if(typeof data == 'string') data = encodeUTF8(data);
		if(typeof comment == 'string') comment = encodeUTF8(comment);

		const version = 10;
		const flags = ZipFlag.UTF8;
		/** DOS internal date encoding format lives on, here.
		  * Notably accurate only to 2 seconds. */
		const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
		const day = (date.getFullYear() - 1980 << 9) | (date.getMonth() + 1 << 5) | date.getDate();
		const crc = crcFactory.create().append(data);
		const size = data.length;
		const extra: number[] = [];
		const diskNumber = 0;
		const dosAttr = 0x00;
		const unixAttr = (PosixType.FILE << 12) | mode;
		const headerOffset = content.pos;

		content.u32(Magic.START);

		const metaStart = content.pos;

		(content
			.u16(version)
			.u16(flags).u16(ZipMethod.STORE)
			.u16(time).u16(day)
			.u32(crc).u32(size).u32(size)
			.u16(path.length).u16(extra.length)
		);

		const metaEnd = content.pos;

		content.copy(path).copy(extra).copy(data);

		(directory
			.u32(Magic.ITEM).u8(version).u8(ZipOS.UNIX)
			.copy(content.data, metaStart, metaEnd)
			.u16(comment.length)
			.u16(diskNumber)
			.u16(ZipAttr.BINARY).u16(dosAttr).u16(unixAttr).u32(headerOffset)
			.copy(path).copy(extra).copy(comment)
		);

		++this.count;
	}

	finish(comment: string | ArrayType = '') {
		const { content, directory, count } = this;

		const dirOffset = content.pos;
		const dirSize = directory.pos;
		const diskNumber = 0;

		if(typeof comment == 'string') comment = encodeUTF8(comment);

		(content
			.copy(directory.data)
			.u32(Magic.END)
			.u16(diskNumber).u16(diskNumber)
			.u16(count).u16(count)
			.u32(dirSize).u32(dirOffset)
			.u16(comment.length).copy(comment)
		);

		return content.data;
	}

	content = new WriterLittle();
	directory = new WriterLittle();
	count = 0;

}
