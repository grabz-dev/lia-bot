//Credit to Redcrafter
//https://github.com/Redcrafter/CW3-Map-Viewer

export class CW4NBTReader {
    /**
     * 
     * @param {ArrayBuffer} buffer 
     */
    constructor(buffer) {
        this.pos = 0;
        this.buffer = new DataView(buffer);
    }
    readBool() { return this.readUint8() != 0; }
    readUint8() { return this.buffer.getUint8(this.pos++); }
    readInt8() { return this.buffer.getInt8(this.pos++); }
    readInt16() {
        this.pos += 2;
        return this.buffer.getInt16(this.pos - 2, true);
    }
    readUint16() {
        this.pos += 2;
        return this.buffer.getUint16(this.pos - 2, true);
    }
    readInt32() {
        this.pos += 4;
        return this.buffer.getInt32(this.pos - 4, true);
    }
    readUint32() {
        this.pos += 4;
        return this.buffer.getUint32(this.pos - 4, true);
    }
    readInt64() {
        this.pos += 8;
        return this.buffer.getBigInt64(this.pos - 8, true);
    }
    readUint64() {
        this.pos += 8;
        return this.buffer.getBigUint64(this.pos - 8, true);
    }
    /**
     * 
     * @param {number} length 
     * @returns 
     */
    readBytes(length) {
        let buf = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            buf[i] = this.buffer.getUint8(this.pos++);
        }
        return buf;
    }
    readFloat() {
        this.pos += 4;
        return this.buffer.getFloat32(this.pos - 4, true);
    }
    readDouble() {
        this.pos += 8;
        return this.buffer.getFloat64(this.pos - 8, true);
    }
    readVector2() {
        return {
            x: this.readFloat(),
            y: this.readFloat()
        };
    }
    readVector3() {
        return {
            x: this.readFloat(),
            y: this.readFloat(),
            z: this.readFloat()
        };
    }
    readVector4() {
        return {
            x: this.readFloat(),
            y: this.readFloat(),
            z: this.readFloat(),
            w: this.readFloat()
        };
    }
    readString() {
        let length = this.readUint16();
        return new TextDecoder("utf-8").decode(this.readBytes(length));
    }
}
class Tag {
}
class TagBool {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readBool();
    }
}
class TagByte {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readUint8();
    }
}
class TagSByte {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readInt8();
    }
}
class TagShort {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readInt16();
    }
}
class TagUShort {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readUint16();
    }
}
class TagInt {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readInt32();
    }
}
class TagUInt {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readUint32();
    }
}
class TagLong {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readInt64();
    }
}
class TagULong {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readUint64();
    }
}
class TagFloat {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readFloat();
    }
}
class TagDouble {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readDouble();
    }
}
class TagVector2 {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readVector2();
    }
}
class TagVector3 {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readVector3();
    }
}
class TagVector4 {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readVector4();
    }
}
class TagQuaternion {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readVector4();
    }
}
class TagBoolArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readBool();
        }
    }
}
class TagByteArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = reader.readBytes(length);
    }
}
class TagSByteArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readInt8();
        }
        this.value = reader.readBytes(length);
    }
}
class TagShortArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Int16Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readInt16();
        }
    }
}
class TagUShortArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Uint16Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readUint16();
        }
    }
}
class TagIntArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Int32Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readInt32();
        }
    }
}
class TagUIntArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Uint32Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readUint32();
        }
    }
}
class TagLongArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new BigInt64Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readInt64();
        }
    }
}
class TagULongArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new BigUint64Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readUint64();
        }
    }
}
class TagFloatArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readFloat();
        }
    }
}
class TagDoubleArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Float64Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readDouble();
        }
    }
}
class TagVector2Array {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readVector2();
        }
    }
}
class TagVector3Array {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readVector3();
        }
    }
}
class TagVector4Array {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readVector4();
        }
    }
}
class TagStringArray {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        let length = reader.readInt32();
        this.value = new Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = reader.readString();
        }
    }
}
class TagString {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.value = reader.readString();
    }
    toString() {
        return this.value;
    }
}
class TagList {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        var type = reader.readUint8();
        var length = reader.readInt32();
        this.value = new Array(length);
        for (let i = 0; i < length; i++) {
            this.value[i] = readTag(reader, type);
        }
    }
    /**
     * 
     * @param {string} value 
     * @param {string} path 
     */
    search(value, path = "") {
        for (let i = 0; i < this.value.length; i++) {
            searchTag(value, this.value[i], `${path}[${i}]`);
        }
    }
}
export class TagCompound {
    /** @param {CW4NBTReader} reader */
    constructor(reader) {
        this.dict = new Map();
        while (true) {
            let id = reader.readUint8();
            if (id == 0) {
                break;
            }
            var key = reader.readString();
            var val = readTag(reader, id);
            this.dict.set(key, val);
        }
    }
    /**
     * 
     * @param {string} value 
     * @param {string} path 
     */
    search(value, path = "") {
        for (const [key, val] of this.dict) {
            searchTag(value, val, `${path}->${key}`);
        }
    }
}
/**
 * @param {string} value 
 * @param {TagCompound | TagList | TagString} val 
 * @param {string} path 
 */
function searchTag(value, val, path = "") {
    if (val instanceof TagCompound || val instanceof TagList) {
        val.search(value, path);
    }
    else if (val instanceof TagString) {
        if (val.value.toLowerCase().includes(value)) {
            debugger;
        }
    }
}
/**
 * 
 * @param {CW4NBTReader} reader 
 * @param {number} id 
 * @returns 
 */
function readTag(reader, id) {
    switch (id) {
        case 0x1: return new TagInt(reader);
        case 0x2: return new TagFloat(reader);
        case 0x3: return new TagString(reader);
        case 0x4: return new TagList(reader);
        case 0x5: return new TagShort(reader);
        case 0x6: return new TagDouble(reader);
        case 0x7: return new TagByteArray(reader);
        case 0x8: return new TagByte(reader);
        case 0x9: return new TagLong(reader);
        case 0xA: return new TagCompound(reader);
        case 0xB: return new TagIntArray(reader);
        case 0xE3: return new TagBoolArray(reader);
        case 0xE4: return new TagVector4Array(reader);
        case 0xE5: return new TagVector4(reader);
        case 0xE6: return new TagBool(reader);
        case 0xE7: return new TagStringArray(reader);
        case 0xE8: return new TagVector2Array(reader);
        case 0xE9: return new TagVector3Array(reader);
        case 0xEA: return new TagVector2(reader);
        case 0xEB: return new TagVector3(reader);
        case 0xEC: return new TagQuaternion(reader);
        case 0xEE: return new TagULongArray(reader);
        case 0xEF: return new TagUIntArray(reader);
        case 0xF0: return new TagUShortArray(reader);
        case 0xF1: return new TagSByteArray(reader);
        case 0xF2: return new TagDoubleArray(reader);
        case 0xF3: return new TagFloatArray(reader);
        case 0xF4: return new TagLongArray(reader);
        case 0xF7: return new TagShortArray(reader);
        case 0xF8: return new TagULong(reader);
        case 0xF9: return new TagUInt(reader);
        case 0xFA: return new TagUShort(reader);
        case 0xFB: return new TagSByte(reader);
        default:
            throw "Unknown tag";
    }
}