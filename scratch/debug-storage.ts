import { getDiskSpaceInfo, getAccountUsedSpace } from '../src/utils/file.utils.js';
import { config } from '../src/config/index.js';

const diskInfo = getDiskSpaceInfo(config.getAbsoluteUploadDir());
const accountUsedBytes = getAccountUsedSpace();
const totalUsedBytes = 36; // dari database files size

let usedOtherDiskBytes = 0;
if (accountUsedBytes > 0) {
  usedOtherDiskBytes = Math.max(0, accountUsedBytes - totalUsedBytes);
} else {
  usedOtherDiskBytes = Math.max(0, diskInfo.total - diskInfo.free - totalUsedBytes);
}

const totalStorageBytes = Math.max(0, diskInfo.total - usedOtherDiskBytes);

console.log('--- HASIL DI SERVER ---');
console.log('diskInfo.total:', diskInfo.total, `(${diskInfo.total / 1024**3} GB)`);
console.log('diskInfo.free:', diskInfo.free, `(${diskInfo.free / 1024**3} GB)`);
console.log('accountUsedBytes:', accountUsedBytes, `(${accountUsedBytes / 1024**3} GB)`);
console.log('usedOtherDiskBytes:', usedOtherDiskBytes, `(${usedOtherDiskBytes / 1024**3} GB)`);
console.log('totalStorageBytes:', totalStorageBytes, `(${totalStorageBytes / 1024**3} GB)`);
