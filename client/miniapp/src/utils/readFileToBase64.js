/**
 * 跨平台读取本地文件为 base64 字符串（适配 APP / 小程序 / H5）
 * - APP：优先使用 plus.io；Android10+ targetSdkVersion>=29 时若遇 code 15，先复制到应用沙盒再读
 * - 小程序：使用 uni.getFileSystemManager
 * - H5：blob URL 使用 fetch + FileReader
 * @param {string} filePath 本地路径或 blob URL
 * @returns {Promise<string>} 纯 base64 字符串（无 data:xxx;base64, 前缀）
 */

/** APP 内从 entry 读取为 base64 */
function readEntryAsBase64(entry, resolve, reject) {
  entry.file((file) => {
    const fileReader = new plus.io.FileReader();
    fileReader.onloadend = (e) => {
      let result = e.target.result || '';
      const base64 = (typeof result === 'string' && result.indexOf(',') >= 0) ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    fileReader.onerror = (e) => reject(e.target && e.target.error || new Error('plus.io.FileReader failed'));
    fileReader.readAsDataURL(file);
  }, (err) => reject(err || new Error('entry.file failed')));
}

/** APP 内先复制到沙盒再读（解决 Android10+ targetSdkVersion>=29 的 code 15，仅当能 resolve 到 sourceEntry 时有效） */
function copyToSandboxAndRead(pathToResolve, resolve, reject) {
  plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
    const name = (pathToResolve.split('/').pop() || 'file').replace(/[^.\w-]/g, '_');
    const tempName = 'temp_' + Date.now() + '_' + name;
    plus.io.resolveLocalFileSystemURL(pathToResolve, (sourceEntry) => {
      sourceEntry.copyTo(fs.root, tempName, (copiedEntry) => {
        readEntryAsBase64(copiedEntry, (base64) => {
          copiedEntry.remove(() => {}, () => {});
          resolve(base64);
        }, (err) => {
          copiedEntry.remove(() => {}, () => {});
          reject(err);
        });
      }, (err) => reject(err || new Error('copyTo failed')));
    }, (err) => {
      // resolve 阶段就 code 15：路径不可用，尝试 Android 原生按路径读（仅限本应用可读的路径）
      if (err && err.code === 15 && plus.os && plus.os.name === 'Android') {
        readFileByAndroidNative(pathToResolve, resolve, reject);
      } else {
        reject(err || new Error('resolveLocalFileSystemURL failed'));
      }
    });
  }, (err) => reject(err || new Error('requestFileSystem PRIVATE_DOC failed')));
}

/** Android 原生按路径读文件为 base64（兜底：resolve 不可用时，仅限本应用可读路径） */
function readFileByAndroidNative(pathOrUrl, resolve, reject) {
  try {
    const path = (pathOrUrl && pathOrUrl.replace) ? pathOrUrl.replace(/^file:\/\//, '') : pathOrUrl;
    if (!path) {
      reject(new Error('invalid path'));
      return;
    }
    const file = plus.android.newObject('java.io.File', path);
    if (!plus.android.invoke(file, 'exists')) {
      reject(new Error('file not exists'));
      return;
    }
    const fis = plus.android.newObject('java.io.FileInputStream', path);
    const buf = plus.android.newObject('byte[]', 8192);
    const baos = plus.android.newObject('java.io.ByteArrayOutputStream');
    let n;
    while ((n = plus.android.invoke(fis, 'read', buf)) !== -1) {
      plus.android.invoke(baos, 'write', buf, 0, n);
    }
    plus.android.invoke(fis, 'close');
    const bytes = plus.android.invoke(baos, 'toByteArray');
    const Base64 = plus.android.importClass('android.util.Base64');
    const base64Str = Base64.encodeToString(bytes, 2); // 2 = Base64.NO_WRAP，无换行
    resolve(base64Str || '');
  } catch (e) {
    reject(e || new Error('Android native read failed'));
  }
}

export function readFileToBase64(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // 1. APP：优先 plus.io（getFileSystemManager 在 APP 可能未实现）
      if (typeof plus !== 'undefined' && plus.io && plus.io.resolveLocalFileSystemURL) {
        let pathToResolve = filePath;
        if (typeof filePath === 'string' && filePath.charAt(0) === '/' && filePath.indexOf('file://') !== 0) {
          pathToResolve = 'file://' + filePath;
        }
        plus.io.resolveLocalFileSystemURL(pathToResolve, (entry) => {
          entry.file((file) => {
            const fileReader = new plus.io.FileReader();
            fileReader.onloadend = (e) => {
              let result = e.target.result || '';
              const base64 = (typeof result === 'string' && result.indexOf(',') >= 0) ? result.split(',')[1] : result;
              resolve(base64 || '');
            };
            fileReader.onerror = (e) => {
              const err = e.target && e.target.error;
              // Android10+ targetSdkVersion>=29：当前路径不支持，需改为应用运行路径
              if (err && err.code === 15) {
                copyToSandboxAndRead(pathToResolve, resolve, reject);
              } else {
                reject(err || new Error('plus.io.FileReader failed'));
              }
            };
            fileReader.readAsDataURL(file);
          }, (err) => {
            if (err && err.code === 15) {
              copyToSandboxAndRead(pathToResolve, resolve, reject);
            } else {
              reject(err || new Error('entry.file failed'));
            }
          });
        }, (err) => {
          if (err && err.code === 15) {
            copyToSandboxAndRead(pathToResolve, resolve, reject);
          } else {
            reject(err || new Error('resolveLocalFileSystemURL failed'));
          }
        });
        return;
      }

      // 2. 小程序等：uni.getFileSystemManager
      const fsm = uni.getFileSystemManager && uni.getFileSystemManager();
      if (fsm && typeof fsm.readFile === 'function') {
        fsm.readFile({
          filePath,
          encoding: 'base64',
          success: (res) => resolve(res.data),
          fail: (err) => reject(err || new Error('readFile failed'))
        });
        return;
      }

      // 3. H5：blob URL 用 fetch + FileReader
      if (typeof filePath === 'string' && filePath.startsWith('blob:')) {
        fetch(filePath)
          .then((r) => r.blob())
          .then((blob) => {
            const fr = new FileReader();
            fr.onload = () => {
              const dataUrl = fr.result;
              const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
              resolve(base64 || '');
            };
            fr.onerror = () => reject(fr.error || new Error('FileReader failed'));
            fr.readAsDataURL(blob);
          })
          .catch(reject);
        return;
      }

      reject(new Error('当前环境无法读取该文件路径'));
    } catch (e) {
      reject(e);
    }
  });
}
