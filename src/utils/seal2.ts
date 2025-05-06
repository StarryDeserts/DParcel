import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SessionKey, SealClient, SealCompatibleClient, getAllowlistedKeyServers } from '@mysten/seal';
import { SuiClient } from '@mysten/sui.js/client';
import config from '@/config/config';
import { ENCRYPTION_CONFIG, logger, base64ToBytes } from './seal';

// 初始化Sui客户端
const suiClient = new SuiClient({ 
  url: ENCRYPTION_CONFIG.NETWORK_URL
});

// 初始化Seal客户端
const sealClient = new SealClient({
  suiClient: suiClient as unknown as SealCompatibleClient,
  serverObjectIds: getAllowlistedKeyServers('testnet'),
  verifyKeyServers: true
});

/**
 * 解密配置选项
 */
export interface DecryptionOptions {
  ttlMin?: number;         // 会话有效期（分钟）
  isText?: boolean;        // 是否为文本内容
  objectId?: string;       // 对象ID
  logProgress?: boolean;   // 是否记录进度日志
}

/**
 * 解密结果
 */
export interface DecryptionResult {
  decryptedData: Uint8Array | string;
  isText: boolean;
  timestamp: number;
  mimeType?: string;       // 数据的MIME类型（如果已知）
  originalFilename?: string; // 原始文件名（如果已知）
  metadata?: Record<string, any>; // 任何附加的元数据
}

/**
 * 尝试检测二进制数据的类型
 * @param data 二进制数据
 * @returns MIME类型
 */
export const detectMimeType = (data: Uint8Array): string | undefined => {
  // 检查常见文件格式的头部特征
  if (data.length < 4) return undefined;
  
  // JPEG: 以FF D8 FF开头
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 以89 50 4E 47开头
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 以47 49 46 38开头
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return 'image/gif';
  }
  
  // PDF: 以25 50 44 46开头 (%PDF)
  if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) {
    return 'application/pdf';
  }
  
  // ZIP, DOCX, XLSX等: 以50 4B开头
  if (data[0] === 0x50 && data[1] === 0x4B) {
    return 'application/zip';
  }
  
  // 尝试检测是否为UTF-8文本
  try {
    // 检查数据有效性并且只含有合法的UTF-8字符
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data.slice(0, Math.min(100, data.length)));
    // 如果能成功解码并且不包含太多非打印字符，可能是文本
    const nonPrintableCount = [...text].filter(c => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0))).length;
    if (nonPrintableCount < text.length * 0.1) {
      return 'text/plain';
    }
  } catch (e) {
    // 不是有效的UTF-8文本
  }
  
  return 'application/octet-stream'; // 默认二进制类型
};

/**
 * 创建会话密钥（用于解密）
 * @param walletAddress 钱包地址
 * @param ttlMin 会话有效期（分钟）
 * @returns 会话密钥实例
 */
export const createSessionKey = (walletAddress: string, ttlMin: number = 10): SessionKey => {
  return new SessionKey({
    address: walletAddress,
    packageId: config.SuiPack,
    ttlMin,
  });
};

/**
 * 执行解密操作
 * @param encryptedData - 加密的数据（字符串或二进制）
 * @param accessCode - 取件码
 * @param walletAddress - 用户钱包地址
 * @param wallet - 钱包对象
 * @param options - 解密选项
 * @returns 解密后的数据
 */
export async function decryptData(
  encryptedData: string | Uint8Array, 
  accessCode: string,
  walletAddress: string, 
  wallet: any, 
  options?: DecryptionOptions
): Promise<DecryptionResult> {
  // 开始解密
  const startTime = Date.now();
  logger.clear(); // 清除之前的日志
  logger.info('开始解密操作');
  
  // 使用默认选项
  const {
    ttlMin = 10,
    isText = false,
    objectId = "0x99130710f132066c7a60282c0cfd9188387d645e94ffc6e0d51733d990248bcb",
    logProgress = true
  } = options || {};

  try {
    // 如果输入是字符串（可能是Base64编码），将其转换为Uint8Array
    const encryptedBytes = typeof encryptedData === 'string' 
      ? base64ToBytes(encryptedData) 
      : encryptedData;
      
    if (logProgress) {
      logger.info(`准备解密 ${encryptedBytes.length} 字节数据`);
      logger.info(`使用取件码: ${accessCode.substring(0, 3)}****`);
    }
      
    // 创建会话密钥
    const sessionKey = createSessionKey(walletAddress, ttlMin);
    
    if (logProgress) {
      logger.info(`已创建会话密钥，有效期: ${ttlMin}分钟`);
    }
    
    // 用户签名授权
    try {
      const message = sessionKey.getPersonalMessage();
      logger.info('请求钱包签名...');
      const { signature } = await wallet.signPersonalMessage({ message });
      sessionKey.setPersonalMessageSignature(signature);
      logger.info('钱包签名成功');
    } catch (error) {
      logger.error('钱包签名失败:', error);
      throw new Error(`钱包签名失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 创建验证交易
    const tx = new TransactionBlock();
    
    try {
      logger.info('创建验证交易...');
      tx.moveCall({
        target: `${config.SuiPack}::${config.MODULE_NAME}::seal_approve`,
        arguments: [
          tx.object(objectId),
          tx.pure.string(accessCode), // 用户输入的取件码
        ],
      });
      logger.info('验证交易创建成功');
    } catch (error) {
      logger.error('创建验证交易失败:', error);
      throw new Error(`创建验证交易失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 执行解密
    logger.info('执行解密...');
    const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
    
    const decryptedData = await sealClient.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes
    });
    
    const decryptionTime = Date.now() - startTime;
    logger.info(`解密完成，耗时: ${decryptionTime}ms，解密数据大小: ${decryptedData.length} 字节`);
    
    // 处理结果
    let result: Uint8Array | string = decryptedData;
    let detectedMime: string | undefined;
    
    // 如果是文本，转换为字符串
    if (isText) {
      logger.info('将解密数据作为文本处理');
      result = new TextDecoder().decode(decryptedData);
      detectedMime = 'text/plain';
    } else {
      // 尝试检测数据类型
      detectedMime = detectMimeType(decryptedData);
      logger.info(`检测到数据类型: ${detectedMime || '未知'}`);
    }
    
    return {
      decryptedData: result,
      isText,
      timestamp: Date.now(),
      mimeType: detectedMime
    };
  } catch (error) {
    logger.error('解密过程出错:', error);
    throw new Error(`解密失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建解密数据的下载链接
 * @param decryptedData 解密后的数据
 * @param filename 文件名
 * @param mimeType MIME类型
 * @returns 下载URL对象
 */
export const createDownloadLink = (
  decryptedData: Uint8Array | string,
  filename: string = 'decrypted_file',
  mimeType: string = 'application/octet-stream'
): { url: string, download: () => void } => {
  let blob: Blob;
  
  if (typeof decryptedData === 'string') {
    blob = new Blob([decryptedData], { type: 'text/plain' });
  } else {
    blob = new Blob([decryptedData], { type: mimeType });
  }
  
  const url = URL.createObjectURL(blob);
  
  const download = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 延迟释放URL以确保下载启动
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };
  
  return { url, download };
};

// 导出主要功能
export {
  suiClient,
  sealClient
};