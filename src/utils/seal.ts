// 导入必要的库
import { getFullnodeUrl,SuiClient } from '@mysten/sui/client';
import { getAllowlistedKeyServers, SealClient, SealCompatibleClient } from '@mysten/seal';
import config from '@/config/config';

/**
 * 加密配置
 */
export const ENCRYPTION_CONFIG = {
  NETWORK_URL: 'https://fullnode.testnet.sui.io',
  DEFAULT_THRESHOLD: 2
};

/**
 * 简单的日志系统
 */
export const logger = {
  logs: [] as string[],
  info: (message: string) => {
    const logMessage = `[INFO] ${new Date().toISOString()}: ${message}`;
    console.log(logMessage);
    logger.logs.push(logMessage);
    // 触发自定义事件，通知前端更新日志
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:log', { detail: { type: 'info', message } }));
    }
    return logMessage;
  },
  error: (message: string, error?: any) => {
    const errorDetails = error ? `: ${error instanceof Error ? error.message : String(error)}` : '';
    const logMessage = `[ERROR] ${new Date().toISOString()}: ${message}${errorDetails}`;
    console.error(logMessage);
    logger.logs.push(logMessage);
    // 触发自定义事件，通知前端更新日志
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:log', { detail: { type: 'error', message: `${message}${errorDetails}` } }));
    }
    return logMessage;
  },
  warn: (message: string) => {
    const logMessage = `[WARN] ${new Date().toISOString()}: ${message}`;
    console.warn(logMessage);
    logger.logs.push(logMessage);
    // 触发自定义事件，通知前端更新日志
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:log', { detail: { type: 'warn', message } }));
    }
    return logMessage;
  },
  clear: () => {
    logger.logs = [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:log', { detail: { type: 'clear' } }));
    }
  },
  getLogs: () => {
    return [...logger.logs];
  }
};

// 1. 初始化Sui客户端
const suiClient = new SuiClient({ 
  url: getFullnodeUrl('testnet')
  });


// 2. 初始化Seal客户端
const sealClient = new SealClient({
  suiClient: suiClient,
  serverObjectIds: getAllowlistedKeyServers('testnet'),
});

/**
 * 将字符串转换为字节数组
 * @param str - 字符串或二进制数据
 * @returns Uint8Array
 */
export const stringToBytes = (str: string | Uint8Array | undefined): Uint8Array | undefined => {
  if (str === undefined) return undefined;
  
  if (typeof str === 'string') {
    return new TextEncoder().encode(str);
  }
  
  return str;
};

/**
 * 将Uint8Array转换为十六进制字符串
 * @param bytes - Uint8Array对象
 * @returns 十六进制字符串
 */
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * 将十六进制字符串转换为Uint8Array
 * @param hex - 十六进制字符串
 * @returns Uint8Array
 */
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

/**
 * 将Uint8Array转换为Base64字符串
 * @param bytes - Uint8Array对象
 * @returns Base64字符串
 */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * 将Base64字符串转换为Uint8Array
 * @param base64 - Base64字符串
 * @returns Uint8Array
 */
export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * 生成随机取件码
 * @param length - 取件码长度，默认为16
 * @returns 随机取件码
 */
export const generateAccessCode = (length: number = 16): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // 使用加密安全的随机数生成器（如果可用）
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    // 退回到不太安全的方法
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    logger.warn('使用非加密安全的随机数生成器生成取件码');
  }
  
  return result;
};

/**
 * 验证取件码格式是否合法
 * @param accessCode - 要验证的取件码
 * @returns 是否合法
 */
export const validateAccessCode = (accessCode: string): boolean => {
  // 验证取件码格式：字母数字组合，长度至少8位
  const regex = /^[A-Za-z0-9]{8,}$/;
  return regex.test(accessCode);
};

/**
 * 加密选项
 */
export interface EncryptionOptions {
  threshold?: number;      // 解密所需的密钥服务器数量
  logProgress?: boolean;   // 是否记录进度日志
  metadata?: {             // 元数据
    filename?: string;     // 原始文件名
    mimeType?: string;     // MIME类型
    timestamp?: number;    // 时间戳
    [key: string]: any;    // 其他自定义元数据
  };
}

/**
 * 加密结果
 */
export interface EncryptionResult {
  encryptedData: Uint8Array;
  backupKey: Uint8Array;
  base64Data: string;      // Base64编码的加密数据
  metadata?: {             // 元数据
    filename?: string;     // 原始文件名
    mimeType?: string;     // MIME类型
    timestamp: number;     // 加密时间戳
    [key: string]: any;    // 其他自定义元数据
  };
}

/**
 * 尝试检测文件类型（基于文件名或MIME类型）
 * @param filename 文件名
 * @param mimeType MIME类型
 * @returns 检测到的MIME类型
 */
export const detectFileType = (filename?: string, mimeType?: string): string => {
  // 如果提供了MIME类型，直接使用
  if (mimeType) return mimeType;
  
  // 如果有文件名，基于扩展名检测
  if (filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension) {
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'json': 'application/json',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'zip': 'application/zip'
      };
      return mimeTypes[extension] || 'application/octet-stream';
    }
  }
  
  // 默认二进制类型
  return 'application/octet-stream';
};

/**
 * 执行加密操作
 * @param data - 要加密的数据（字符串或二进制数据）
 * @param idString - 标识符/取件码（字符串）
 * @param options - 加密选项
 * @returns 加密对象和备份密钥
 */
export async function encryptData(
  data: string | Uint8Array | undefined, 
  idString: string,
  options?: EncryptionOptions
): Promise<EncryptionResult> {
  // 开始加密
  const startTime = Date.now();
  logger.clear(); // 清除之前的日志
  logger.info('开始加密操作');
  
  // 使用默认选项
  const {
    threshold = ENCRYPTION_CONFIG.DEFAULT_THRESHOLD,
    logProgress = true,
    metadata = {}
  } = options || {};
  
  try {
    // 准备数据
    const dataBytes = stringToBytes(data);
    
    if (!dataBytes) {
      const error = new Error("加密数据不能为空");
      logger.error("加密数据不能为空");
      throw error;
    }
    
    if (!idString) {
      const error = new Error("取件码不能为空");
      logger.error("取件码不能为空");
      throw error;
    }
    
    if (logProgress) {
      logger.info(`准备加密 ${dataBytes.length} 字节数据`);
      logger.info(`使用取件码: ${idString.substring(0, 3)}****`);
      logger.info(`使用阈值: ${threshold}（需要${threshold}个密钥服务器合作才能解密）`);
    }
  
  // 执行加密
    logger.info('开始加密过程...');
    console.log({
      threshold,
      packageId: config.SuiPack,
      id: idString,
      dataBytes,
      dataBytesType: Object.prototype.toString.call(dataBytes)
    });
  const { encryptedObject, key } = await sealClient.encrypt({
      threshold,                  // 需要多少个密钥服务器来解密
      packageId: config.SuiPack,  // 访问控制合约包ID
      id: idString,               // 标识符（取件码）
      data: dataBytes             // 要加密的数据
    });
    
    const encryptionTime = Date.now() - startTime;
    logger.info(`加密完成，耗时: ${encryptionTime}ms，加密数据大小: ${encryptedObject.length} 字节`);
    
    // 转换为Base64便于传输
    const base64Data = bytesToBase64(encryptedObject);
    logger.info(`生成Base64编码数据，长度: ${base64Data.length} 个字符`);
    
    // 合并元数据
    const resultMetadata = {
      ...metadata,
      timestamp: Date.now()
    };
    
    // 返回加密结果
    return {
      encryptedData: encryptedObject,
      backupKey: key,
      base64Data,
      metadata: resultMetadata
    };
  } catch (error) {
    logger.error('加密过程出错', error);
    throw new Error(`加密失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 加密文件
 * @param file 要加密的文件
 * @param accessCode 访问码/取件码
 * @param options 加密选项
 * @returns 加密结果
 */
export async function encryptFile(
  file: File,
  accessCode: string,
  options?: EncryptionOptions
): Promise<EncryptionResult> {
  try {
    logger.info(`开始处理文件: ${file.name}, 大小: ${file.size} 字节`);
    
    // 读取文件内容为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    // 检测文件类型
    const mimeType = file.type || detectFileType(file.name);
    logger.info(`文件类型: ${mimeType}`);
    
    // 构建元数据
    const metadata = {
      ...(options?.metadata || {}),
      filename: file.name,
      mimeType,
      fileSize: file.size
    };
    
    // 加密文件
    return await encryptData(fileData, accessCode, {
      ...(options || {}),
      metadata
    });
  } catch (error) {
    logger.error('加密文件过程出错', error);
    throw new Error(`加密文件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export {
  suiClient,
  sealClient
};