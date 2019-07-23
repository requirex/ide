import { ArrayType, encodeUTF8, CRC32 } from './codec';
import { WriterLittle } from './Writer';

const enum ZipFlag {
	ENCRYPT = 1,
	STREAM = 1 << 3,
	UTF8 = 1 << 11
}

const enum ZipMethod {
	STORE = 0,
	DEFLATE = 8,
	LZMA = 14
}

const enum ZipOS {
	DOS = 0,
	UNIX = 3,
	NTFS = 11,
	VFAT = 14,
	OSX = 19
}

const enum ZipAttr {
	BINARY = 0,
	TEXT = 1
}

const enum PosixType {
	FIFO = 1,
	DIRECTORY = 4,
	FILE = 8,
	SYMLINK = 10,
	SOCKET = 12
}

const crcFactory = new CRC32();

const zipMagic = 0x04034b50;
const entryMagic = 0x02014b50;
const endMagic = 0x06054b50;

export class ZipFile {

	add(
		name: string | ArrayType,
		data: string | ArrayType,
		mode = 0o644,
		stamp?: number | null,
		comment: string | ArrayType = ''
	) {
		const { content, directory } = this;
		const date = stamp ? new Date(stamp) : new Date();

		if(typeof name == 'string') name = encodeUTF8(name);
		if(typeof data == 'string') data = encodeUTF8(data);
		if(typeof comment == 'string') comment = encodeUTF8(comment);

		const version = 10;
		const flags = ZipFlag.UTF8;
		const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
		const day = (date.getFullYear() - 1980 << 9) | (date.getMonth() + 1 << 5) | date.getDate();
		const crc = crcFactory.create().append(data);
		const size = data.length;
		const extra: number[] = [];
		const diskNumber = 0;
		const dosAttr = 0x00;
		const unixAttr = (PosixType.FILE << 12) | mode;
		const headerOffset = content.pos;

		content.u32(zipMagic);

		const metaStart = content.pos;

		(content
			.u16(version)
			.u16(flags).u16(ZipMethod.STORE)
			.u16(time).u16(day)
			.u32(crc).u32(size).u32(size)
			.u16(name.length).u16(extra.length)
		);

		const metaEnd = content.pos;

		content.copy(name).copy(extra).copy(data);

		(directory
			.u32(entryMagic).u16(version | (ZipOS.UNIX << 8))
			.copy(content.data, metaStart, metaEnd)
			.u16(comment.length)
			.u16(diskNumber)
			.u16(ZipAttr.BINARY).u16(dosAttr).u16(unixAttr).u32(headerOffset)
			.copy(name).copy(extra).copy(comment)
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
			.u32(endMagic)
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
