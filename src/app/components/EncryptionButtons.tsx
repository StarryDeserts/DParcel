"use client";

import { useState, useRef } from 'react';
import { FiUpload, FiDownload, FiInfo, FiFile, FiX, FiLock, FiUnlock, FiDownloadCloud } from 'react-icons/fi';
import CryptoJS from 'crypto-js';

// 环境变量 - 使用本地API代理
const API_PROXY = "/api/proxy";

// PBKDF2参数
const PBKDF2_ITERATIONS = 100000; // 迭代次数
const SALT_LENGTH = 16; // 盐长度（字节）
const IV_LENGTH = 16; // 初始向量长度（字节），对于AES必须是16字节

// Blob信息接口
interface BlobInfo {
  id: string;
  blobId: string;
  size: number;
  encodingType: string;
  certifiedEpoch: number;
  deletable: boolean;
}

// 生成随机字节数组
const generateRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

// 加密上传按钮组件
export function EncryptionStoreButton() {
  const [loading, setLoading] = useState(false);
  const [blob, setBlob] = useState<BlobInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // 添加日志函数
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prevLogs => [...prevLogs, message]);
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setLogs([]);
    if (selectedFile) {
      addLog(`已选择文件: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
    }
  };

  // 触发文件选择对话框
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // 清除选择的文件
  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setLogs([]);
  };

  // 加密文件并上传
  const handleStore = async () => {
    if (!file) {
      setError("请选择要上传的文件");
      return;
    }

    if (!password || password.length < 6) {
      setError("请输入至少6位的密码");
      return;
    }

    setLoading(true);
    setError(null);
    setLogs([]);
    
    try {
      // 读取文件内容
      addLog("开始读取文件内容...");
      const fileArrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(fileArrayBuffer);
      addLog(`文件读取完成，原始大小: ${formatFileSize(fileData.length)}`);
      
      try {
        // 生成随机盐和初始向量
        addLog("生成随机盐和初始向量...");
        const salt = generateRandomBytes(SALT_LENGTH);
        const iv = generateRandomBytes(IV_LENGTH);
        addLog(`盐值(十六进制): ${bytesToHex(salt)}`);
        addLog(`初始向量(十六进制): ${bytesToHex(iv)}`);
        
        // 将Uint8Array转换为WordArray (CryptoJS使用的格式)
        addLog("转换数据格式...");
        const fileWordArray = CryptoJS.lib.WordArray.create(fileData as any);
        const saltWordArray = CryptoJS.lib.WordArray.create(salt as any);
        const ivWordArray = CryptoJS.lib.WordArray.create(iv as any);
        
        // 从密码派生密钥
        addLog(`使用PBKDF2派生密钥 (迭代次数: ${PBKDF2_ITERATIONS})...`);
        const key = CryptoJS.PBKDF2(password, saltWordArray, {
          keySize: 256/32, // 256位密钥
          iterations: PBKDF2_ITERATIONS,
          hasher: CryptoJS.algo.SHA256
        });
        addLog(`派生的密钥(截断显示): ${key.toString().substring(0, 32)}...`);
        
        // 使用AES-CBC加密
        addLog("使用AES-CBC模式进行加密...");
        const encrypted = CryptoJS.AES.encrypt(fileWordArray, key, {
          iv: ivWordArray,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
        
        // 获取加密后的数据
        const encryptedData = CryptoJS.enc.Base64.parse(encrypted.toString());
        addLog(`加密完成，加密数据大小: ${formatFileSize(encryptedData.sigBytes)}`);
        
        // 将盐和IV与加密数据合并
        addLog("合并盐、初始向量和加密数据...");
        // 格式: [盐(16字节)][IV(16字节)][加密数据]
        const saltBytes = CryptoJS.enc.Hex.parse(saltWordArray.toString());
        const ivBytes = CryptoJS.enc.Hex.parse(ivWordArray.toString());
        
        const combinedData = CryptoJS.lib.WordArray.create();
        combinedData.concat(saltBytes);
        combinedData.concat(ivBytes);
        combinedData.concat(encryptedData);
        
        // 转换为Uint8Array
        const encryptedBytes = wordArrayToUint8Array(combinedData);
        addLog(`合并后数据大小: ${formatFileSize(encryptedBytes.length)}`);
        
        addLog(`准备上传加密文件: ${file.name}`);
        
        // 发送加密文件到API代理
        addLog("正在上传到服务器...");
        const response = await fetch(API_PROXY, {
          method: 'PUT',
          body: encryptedBytes,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "无法获取详细错误信息");
          console.error(`上传失败: 状态码 ${response.status}, 错误: ${errorText}`);
          throw new Error(`上传失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data?.newlyCreated?.blobObject) {
          addLog(`上传成功! Blob ID: ${data.newlyCreated.blobObject.blobId}`);
          setBlob(data.newlyCreated.blobObject);
          
          // 保存加密数据到sessionStorage，用于直接下载
          sessionStorage.setItem('lastEncryptedData', bytesToBase64(encryptedBytes));
          sessionStorage.setItem('lastEncryptedFileName', file.name + '.encrypted');
        } else {
          console.error("响应数据结构不符合预期:", data);
          throw new Error("响应格式不正确");
        }
      } catch (cryptoError) {
        console.error("加密过程中出现错误:", cryptoError);
        throw new Error("加密失败，请检查您的输入");
      }
    } catch (err) {
      console.error("加密或上传过程中出现错误:", err);
      addLog(`错误: ${err instanceof Error ? err.message : "加密或上传过程中发生错误"}`);
      setError(err instanceof Error ? err.message : "加密或上传过程中发生错误");
    } finally {
      setLoading(false);
    }
  };
  
  // 直接下载加密文件
  const downloadEncryptedFile = () => {
    const encryptedBase64 = sessionStorage.getItem('lastEncryptedData');
    const fileName = sessionStorage.getItem('lastEncryptedFileName');
    
    if (encryptedBase64 && fileName) {
      const encryptedBytes = base64ToBytes(encryptedBase64);
      const blob = new Blob([encryptedBytes]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      addLog(`已直接下载加密文件: ${fileName}`);
    } else {
      setError("没有可下载的加密文件");
    }
  };
  
  // 辅助函数：WordArray 转 Uint8Array
  const wordArrayToUint8Array = (wordArray: CryptoJS.lib.WordArray): Uint8Array => {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    
    for(let i = 0; i < sigBytes; i++) {
      const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      u8[i] = byte;
    }
    
    return u8;
  };
  
  // 辅助函数：字节数组转十六进制字符串
  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  
  // 辅助函数：字节数组转Base64
  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };
  
  // 辅助函数：Base64转字节数组
  const base64ToBytes = (base64: string): Uint8Array => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  // 文件大小格式化
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className="mb-6">
      <div className="mb-3">
        <label className="block text-white mb-2">选择要加密并上传的文件</label>
        
        {/* 隐藏的文件输入框 */}
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        
        {/* 自定义文件选择区域 */}
        {!file ? (
          <div 
            onClick={triggerFileInput}
            className="border-2 border-dashed border-indigo-600 rounded-md p-6 flex flex-col items-center justify-center bg-indigo-900/20 cursor-pointer hover:bg-indigo-900/30 transition-colors"
          >
            <FiUpload className="text-indigo-400 text-3xl mb-2" />
            <p className="text-white text-center">点击或拖放文件到此处</p>
            <p className="text-white/60 text-sm mt-1">选择一个文件进行加密上传</p>
          </div>
        ) : (
          <div className="bg-indigo-900/20 rounded-md p-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center mr-3">
                <FiFile className="text-white" />
              </div>
              <div>
                <p className="text-white font-medium truncate max-w-[180px]">{file.name}</p>
                <p className="text-white/60 text-sm">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button 
              onClick={clearFile}
              className="text-white/60 hover:text-white p-1"
            >
              <FiX />
            </button>
          </div>
        )}
      </div>
      
      {/* 加密密码输入 */}
      <div className="mb-4">
        <label htmlFor="passwordInput" className="block text-white mb-2">加密密码</label>
        <div className="relative">
          <input 
            id="passwordInput"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入加密密码（至少6位）"
            className="w-full bg-white/80 text-gray-800 pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 border border-indigo-700"
          />
          <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" />
        </div>
        <p className="text-white/60 text-xs mt-1">
          提示：请牢记此密码，它将用于解密文件。使用更复杂的密码可增强安全性。
        </p>
      </div>
      
      <button 
        onClick={handleStore}
        disabled={loading || !file || !password}
        className="flex items-center justify-center w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-md py-3 text-white font-medium mb-4 hover:shadow-lg transition-all disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            加密上传中...
          </span>
        ) : (
          <>
            <FiLock className="mr-2" />
            加密并上传
          </>
        )}
      </button>
      
      {/* 日志输出区域 */}
      {logs.length > 0 && (
        <div className="mb-4 p-2 bg-black/30 rounded-md max-h-40 overflow-auto">
          <div className="text-xs font-mono text-green-300">
            {logs.map((log, index) => (
              <div key={index} className="py-0.5">
                <span className="text-gray-400">[{index+1}]</span> {log}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-red-300 text-sm mt-1 mb-3">
          <FiInfo className="inline-block mr-1" />
          {error}
        </div>
      )}
      
      {blob && (
        <div className="mt-4 p-3 bg-white/10 rounded-md">
          <h3 className="text-white font-medium mb-2 flex items-center">
            <FiInfo className="mr-2" /> 加密文件已上传
          </h3>
          <div className="text-white/80 text-sm space-y-1">
            <p>Blob ID (用于下载): <span className="font-mono text-xs bg-white/10 p-1 rounded">{blob.blobId}</span></p>
            <p>ID: <span className="font-mono text-xs bg-white/10 p-1 rounded break-all">{blob.id}</span></p>
            <p>大小: {blob.size} 字节</p>
            <p>编码类型: {blob.encodingType}</p>
            <div className="mt-2 p-2 bg-yellow-900/30 rounded-md">
              <p className="text-yellow-300 text-xs">重要提示：请保存Blob ID和您的密码，两者都是解密文件所必需的！</p>
            </div>
            <div className="mt-2">
              <button 
                onClick={downloadEncryptedFile}
                className="flex items-center justify-center py-2 px-4 bg-indigo-800 hover:bg-indigo-700 rounded-md text-white text-sm transition-colors"
              >
                <FiDownloadCloud className="mr-2" />
                直接下载加密文件
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 解密下载按钮组件
export function EncryptionDownloadButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobId, setBlobId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Uint8Array | null>(null); // 存储原始加密数据

  // 添加日志函数
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prevLogs => [...prevLogs, message]);
  };

  // 处理解密下载
  const handleDecryptDownload = async () => {
    if (!blobId.trim()) {
      setError("请输入Blob ID");
      return;
    }

    if (!fileName.trim()) {
      setError("请输入文件名");
      return;
    }

    if (!password) {
      setError("请输入解密密码");
      return;
    }

    setLoading(true);
    setError(null);
    setDownloadComplete(false);
    setLogs([]);
    setRawData(null);
    
    try {
      // 使用本地API代理获取blob数据
      addLog(`尝试下载Blob ID: ${blobId}`);
      const response = await fetch(`${API_PROXY}?blobId=${encodeURIComponent(blobId)}`);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "无法获取详细错误信息");
        console.error(`下载失败: 状态码 ${response.status}, 错误: ${errorText}`);
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }
      
      // 获取加密文件内容
      addLog("正在获取加密数据...");
      const encryptedData = await response.arrayBuffer();
      if (!encryptedData || encryptedData.byteLength <= SALT_LENGTH + IV_LENGTH) {
        throw new Error("获取到的数据无效或损坏");
      }
      
      addLog(`获取到加密数据，大小: ${formatFileSize(encryptedData.byteLength)}`);
      
      try {
        // 转换ArrayBuffer为CryptoJS可用的格式
        const encryptedBytes = new Uint8Array(encryptedData);
        setRawData(encryptedBytes); // 保存原始加密数据
        
        // 从组合数据中分离出盐、IV和加密内容
        addLog("分离盐、初始向量和加密内容...");
        // 格式: [盐(16字节)][IV(16字节)][加密数据]
        const salt = encryptedBytes.slice(0, SALT_LENGTH);
        const iv = encryptedBytes.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const encryptedContent = encryptedBytes.slice(SALT_LENGTH + IV_LENGTH);
        
        addLog(`盐值(十六进制): ${bytesToHex(salt)}`);
        addLog(`初始向量(十六进制): ${bytesToHex(iv)}`);
        addLog(`加密内容大小: ${formatFileSize(encryptedContent.length)}`);
        
        // 转换为CryptoJS格式
        addLog("转换数据格式...");
        const saltWordArray = CryptoJS.lib.WordArray.create(salt as any);
        const ivWordArray = CryptoJS.lib.WordArray.create(iv as any);
        const encryptedWordArray = CryptoJS.lib.WordArray.create(encryptedContent as any);
        
        // 使用PBKDF2派生密钥
        addLog(`使用PBKDF2派生密钥 (迭代次数: ${PBKDF2_ITERATIONS})...`);
        const key = CryptoJS.PBKDF2(password, saltWordArray, {
          keySize: 256/32, // 256位密钥
          iterations: PBKDF2_ITERATIONS,
          hasher: CryptoJS.algo.SHA256
        });
        addLog(`派生的密钥(截断显示): ${key.toString().substring(0, 32)}...`);
        
        // 构建AES加密对象
        const encryptedObj = CryptoJS.lib.CipherParams.create({
          ciphertext: encryptedWordArray
        });
        
        // 解密
        addLog("开始解密...");
        const decrypted = CryptoJS.AES.decrypt(
          encryptedObj, 
          key, 
          {
            iv: ivWordArray,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );
        
        // 转换为Uint8Array
        const decryptedBytes = wordArrayToUint8Array(decrypted);
        addLog(`解密完成，解密后数据大小: ${formatFileSize(decryptedBytes.length)}`);
        
        // 创建Blob对象并下载
        addLog(`准备下载解密后的文件: ${fileName}`);
        const blob = new Blob([decryptedBytes]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        addLog("文件解密下载成功");
        setDownloadComplete(true);
      } catch (decryptError) {
        console.error("解密失败:", decryptError);
        addLog(`解密失败: ${decryptError instanceof Error ? decryptError.message : "未知错误"}`);
        throw new Error("解密失败，请检查密码是否正确");
      }
    } catch (err) {
      console.error("下载或解密过程中出现错误:", err);
      addLog(`错误: ${err instanceof Error ? err.message : "下载或解密过程中发生错误"}`);
      setError(err instanceof Error ? err.message : "下载或解密过程中发生错误");
    } finally {
      setLoading(false);
    }
  };
  
  // 下载原始加密文件
  const downloadRawEncryptedFile = () => {
    if (!rawData) {
      setError("没有可下载的加密文件");
      return;
    }
    
    const blob = new Blob([rawData]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${fileName || 'download'}.encrypted`;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    addLog(`已下载原始加密文件`);
  };
  
  // 辅助函数：WordArray 转 Uint8Array
  const wordArrayToUint8Array = (wordArray: CryptoJS.lib.WordArray): Uint8Array => {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    
    for(let i = 0; i < sigBytes; i++) {
      const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      u8[i] = byte;
    }
    
    return u8;
  };
  
  // 辅助函数：字节数组转十六进制字符串
  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  
  // 文件大小格式化
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div>
      <div className="mb-3">
        <label htmlFor="blobIdInput" className="block text-white mb-2">Blob ID</label>
        <input 
          id="blobIdInput"
          type="text"
          value={blobId}
          onChange={(e) => {
            setBlobId(e.target.value);
            setLogs([]);
            setRawData(null);
          }}
          placeholder="输入要下载的Blob ID"
          className="w-full bg-white/80 text-gray-800 font-medium rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-indigo-700 placeholder-gray-500"
        />
      </div>
      
      <div className="mb-3">
        <label htmlFor="fileNameInput" className="block text-white mb-2">文件名</label>
        <input 
          id="fileNameInput"
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          placeholder="输入保存的文件名"
          className="w-full bg-white/80 text-gray-800 font-medium rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-indigo-700 placeholder-gray-500"
        />
      </div>
      
      {/* 解密密码输入 */}
      <div className="mb-4">
        <label htmlFor="decryptPasswordInput" className="block text-white mb-2">解密密码</label>
        <div className="relative">
          <input 
            id="decryptPasswordInput"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入与加密时相同的密码"
            className="w-full bg-white/80 text-gray-800 pl-10 pr-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 border border-indigo-700"
          />
          <FiUnlock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" />
        </div>
      </div>
      
      <div className="flex space-x-2 mb-4">
        <button 
          onClick={handleDecryptDownload}
          disabled={loading}
          className="flex-1 flex items-center justify-center bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 rounded-md py-3 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              解密下载中...
            </span>
          ) : (
            <>
              <FiUnlock className="mr-2" />
              解密并下载
            </>
          )}
        </button>
        
        {rawData && (
          <button 
            onClick={downloadRawEncryptedFile}
            className="flex items-center justify-center py-3 px-4 bg-indigo-800 hover:bg-indigo-700 rounded-md text-white font-medium transition-colors"
          >
            <FiDownloadCloud className="mr-2" />
            下载加密文件
          </button>
        )}
      </div>
      
      {/* 日志输出区域 */}
      {logs.length > 0 && (
        <div className="mb-4 p-2 bg-black/30 rounded-md max-h-40 overflow-auto">
          <div className="text-xs font-mono text-green-300">
            {logs.map((log, index) => (
              <div key={index} className="py-0.5">
                <span className="text-gray-400">[{index+1}]</span> {log}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-red-300 text-sm mt-1 mb-3">
          <FiInfo className="inline-block mr-1" />
          {error}
        </div>
      )}
      
      {downloadComplete && (
        <div className="text-green-300 text-sm mt-1 mb-3 flex items-center">
          <FiInfo className="inline-block mr-1" />
          文件解密下载成功！
        </div>
      )}
    </div>
  );
} 