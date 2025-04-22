"use client";

import React, { useState } from 'react';
import { FiSearch, FiInfo, FiFileText, FiDownload, FiLink } from 'react-icons/fi';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { inspectTransaction1 } from '@/utils/moveupload';
import { openDownloadLink, downloadAndSaveFile } from '@/utils/walrusupload';

export function SimpleDownloader() {
  const [blobId, setBlobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [processedData, setProcessedData] = useState<{filename: string, blobId?: string}[]>([]);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  // 添加日志
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prevLogs => [...prevLogs, message]);
  };
  
  // 处理输入变化
  const handleBlobIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBlobId(e.target.value);
    setError(null);
  };
  
  // 处理文件名变化
  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDownloadFilename(e.target.value);
  };
  
  // 将ASCII码数组转换为字符串
  const bytesToString = (bytes: number[]): string => {
    if (!Array.isArray(bytes)) return '非数组数据';
    return bytes.map(code => {
      // 只转换可打印ASCII字符
      if (code >= 32 && code <= 126) {
        return String.fromCharCode(code);
      }
      return `.`; // 用点替代不可打印字符
    }).join('');
  };
  
  // 解析文件信息
  const parseFileInfos = (values: any[]): {filename: string, blobId?: string}[] => {
    if (!Array.isArray(values)) return [];
    
    // 将ASCII码数组转换为完整字符串
    const fullText = values.map(code => String.fromCharCode(code)).join('');
    
    // 使用正则表达式匹配文件名和blobId
    // 格式: 文件名 + '@' + blobId(64字符)
    const regex = /([^@]+)@([a-zA-Z0-9]{64})/g;
    const fileInfos: {filename: string, blobId?: string}[] = [];
    
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      fileInfos.push({ 
        filename: match[1], 
        blobId: match[2] 
      });
    }
    
    return fileInfos;
  };

  // 查询ID信息
  const handleQueryBlobId = async () => {
    if (!blobId.trim()) {
      setError("请输入 Blob ID");
      return;
    }
    
    setLoading(true);
    setError(null);
    setProcessedData([]);
    addLog(`开始查询 ID: ${blobId.trim()}...`);
    
    try {
      // 传入钱包地址如果已连接，否则使用默认地址
      const senderAddress = currentAccount?.address || undefined;
      const result = await inspectTransaction1(suiClient, senderAddress, undefined, blobId.trim());
      
      // 记录基本查询结果
      addLog(`查询完成，状态: ${result.status || '未知'}`);
      
      // 处理返回值
      if (result?.results?.[0]?.returnValues?.[0]) {
        const returnValue = result.results[0].returnValues[0];
        
        // 如果返回值是数组，尝试处理为字符串
        if (Array.isArray(returnValue[0])) {
          const byteArray = returnValue[0];
          
          // 尝试将字节数组转换为字符串
          const stringValue = bytesToString(byteArray);
          addLog(`返回数据 (原始长度: ${byteArray.length}):`);
          addLog(stringValue);
          
          // 尝试将整个字符串作为一个ID处理
          if (stringValue && stringValue.trim() && !stringValue.includes('@')) {
            // 如果字符串不包含@符号，可能是一个ID本身
            const extractedId = stringValue.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
            if (extractedId.length >= 16) { // 假设有效ID至少16个字符
              addLog(`检测到可能的ID: ${extractedId}`);
              // 添加到处理结果中显示
              setProcessedData([{
                filename: '直接ID结果',
                blobId: extractedId
              }]);
              // 设置下载文件名的默认值
              setDownloadFilename('downloadedFile.dat');
            }
          } else {
            // 尝试解析文件信息
            const files = parseFileInfos(byteArray);
            if (files.length > 0) {
              setProcessedData(files);
              addLog(`成功解析到 ${files.length} 个文件信息:`);
              files.forEach((file, index) => {
                addLog(`[${index + 1}] 文件名: ${file.filename}, Blob ID: ${file.blobId}`);
              });
              // 设置第一个文件名作为默认下载文件名
              if (files[0].filename) {
                setDownloadFilename(files[0].filename);
              }
            } else {
              addLog("未能从返回数据中解析出文件信息");
            }
          }
        } else if (typeof returnValue[0] === 'string') {
          // 直接处理字符串类型的返回值
          const stringValue = returnValue[0];
          addLog(`返回字符串数据:`);
          addLog(stringValue);
          
          // 将字符串视为ID
          if (stringValue && stringValue.trim()) {
            const extractedId = stringValue.trim();
            addLog(`检测到直接返回的ID: ${extractedId}`);
            setProcessedData([{
              filename: '直接ID结果',
              blobId: extractedId
            }]);
            // 设置下载文件名的默认值
            setDownloadFilename('downloadedFile.dat');
          }
        } else {
          // 其他类型直接使用JSON序列化
          const jsonStr = JSON.stringify(returnValue, null, 2);
          addLog(`返回值: ${jsonStr}`);
          
          // 尝试从JSON中提取可能的ID
          try {
            const idMatch = jsonStr.match(/["']([a-zA-Z0-9_\-]{16,})["']/);
            if (idMatch && idMatch[1]) {
              addLog(`从JSON中提取可能的ID: ${idMatch[1]}`);
              setProcessedData([{
                filename: 'JSON提取结果',
                blobId: idMatch[1]
              }]);
              // 设置下载文件名的默认值
              setDownloadFilename('downloadedFile.dat');
            }
          } catch (err) {
            // 忽略解析错误
          }
        }
      } else {
        addLog("未找到返回值数据");
      }
    } catch (err) {
      console.error("查询ID时出错:", err);
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      addLog(`查询错误: ${errorMessage}`);
      setError(`查询失败: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 打开下载链接
  const handleOpenDownload = (downloadId: string) => {
    try {
      addLog(`正在打开文件下载链接: ${downloadId}`);
      openDownloadLink(downloadId);
      addLog("下载链接已打开，请在浏览器中查看");
    } catch (err) {
      console.error("打开下载链接时出错:", err);
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      addLog(`打开下载链接错误: ${errorMessage}`);
      setError(`打开下载链接失败: ${errorMessage}`);
    }
  };
  
  // 下载并保存文件
  const handleDownloadAndSave = async (downloadId: string, fileInfo: {filename: string, blobId?: string}) => {
    let filename = downloadFilename.trim();
    
    // 如果用户没有输入文件名，使用解析得到的文件名
    if (!filename) {
      // 对于直接ID结果或JSON提取结果，使用一个默认的文件名
      filename = fileInfo.filename === '直接ID结果' || fileInfo.filename === 'JSON提取结果' 
        ? 'downloadedFile.dat' 
        : fileInfo.filename;
    }
    
    setDownloadLoading(true);
    addLog(`开始下载文件，ID: ${downloadId}, 文件名: ${filename}`);
    
    try {
      const success = await downloadAndSaveFile(downloadId, filename);
      
      if (success) {
        addLog(`文件下载成功！已保存为: ${filename}`);
      } else {
        throw new Error("下载失败");
      }
    } catch (err) {
      console.error("下载文件时出错:", err);
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      addLog(`下载错误: ${errorMessage}`);
      setError(`下载失败: ${errorMessage}`);
    } finally {
      setDownloadLoading(false);
    }
  };
  
  // 获取当前检测到的ID
  const getDetectedId = (): string | undefined => {
    if (processedData.length > 0 && processedData[0].blobId) {
      return processedData[0].blobId;
    }
    return undefined;
  };
  
  // 是否有有效ID可下载
  const hasValidId = !!getDetectedId();
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">ID 查询</h2>
      
      {/* ID输入区域 */}
      <div className="space-y-3">
        {/* Blob ID 输入 */}
        <div>
          <label htmlFor="blobId" className="block text-sm font-medium text-indigo-200 mb-1">
            Blob ID
          </label>
          <input
            id="blobId"
            type="text"
            value={blobId}
            onChange={handleBlobIdChange}
            className="w-full px-4 py-2 bg-black/30 border border-indigo-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="输入要查询的ID..."
            disabled={loading}
          />
        </div>
        
        {/* 查询按钮 */}
        <button
          onClick={handleQueryBlobId}
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 text-white rounded-md font-medium flex items-center justify-center transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              查询中...
            </>
          ) : (
            <>
              <FiSearch className="mr-2" />
              查询ID信息
            </>
          )}
        </button>
      </div>
      
      {/* 提示信息 */}
      <div className="mb-4 p-4 bg-indigo-600/20 rounded-lg text-indigo-200 text-sm border border-indigo-500/30">
        <p className="flex items-center">
          <FiInfo className="mr-2 flex-shrink-0" />
          <span>输入Blob ID，点击查询按钮获取关联信息</span>
        </p>
      </div>
      
      {/* 解析结果显示 */}
      {processedData.length > 0 && (
        <div className="mb-4 p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
          <h3 className="text-sm font-medium text-purple-200 mb-2 flex items-center">
            <FiFileText className="mr-2" /> 解析结果
          </h3>
          <div className="space-y-2">
            {processedData.map((file, index) => (
              <div key={index} className="bg-black/30 rounded p-2 text-xs border border-white/10">
                <div className="text-white font-medium truncate" title={file.filename}>
                  {file.filename}
                </div>
                <div className="font-mono text-indigo-300/70 text-[10px] mt-1 bg-black/20 px-1.5 py-0.5 rounded truncate" title={file.blobId}>
                  {file.blobId}
                </div>
                {file.blobId && (
                  <div className="mt-2">
                    {file.filename === '直接ID结果' && (
                      <div className="mb-3 p-2 bg-indigo-900/30 rounded text-indigo-200 text-center text-xs">
                        <span className="font-medium">✓ 成功获取ID</span>
                      </div>
                    )}
                    
                    {/* 文件名输入 */}
                    <div className="mb-3">
                      <label htmlFor="downloadFilename" className="block text-xs font-medium text-indigo-200 mb-1">
                        下载文件名 <span className="text-indigo-300/50">(可选)</span>
                      </label>
                      <input
                        id="downloadFilename"
                        type="text"
                        value={downloadFilename}
                        onChange={handleFilenameChange}
                        className="w-full px-2 py-1 text-xs bg-black/40 border border-indigo-500/30 rounded text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={file.filename === '直接ID结果' || file.filename === 'JSON提取结果' ? "默认使用'downloadedFile.dat'" : `默认使用'${file.filename}'`}
                      />
                    </div>
                    
                    {/* 下载按钮组 */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenDownload(file.blobId!)}
                        className="flex-1 px-2 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-xs text-white flex items-center justify-center transition-colors"
                      >
                        <FiLink className="mr-1" />
                        打开链接
                      </button>
                      <button
                        onClick={() => handleDownloadAndSave(file.blobId!, file)}
                        disabled={downloadLoading}
                        className="flex-1 px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-purple-800/50 disabled:text-white/50 rounded text-xs text-white flex items-center justify-center transition-colors"
                      >
                        {downloadLoading ? (
                          <>
                            <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            下载中
                          </>
                        ) : (
                          <>
                            <FiDownload className="mr-1" />
                            下载保存
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 rounded-lg text-red-300 text-sm border border-red-500/30 flex items-start">
          <FiInfo className="mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {/* 日志输出 */}
      {logs.length > 0 && (
        <div className="p-3 bg-black/30 rounded-lg border border-indigo-500/20 max-h-80 overflow-auto">
          <div className="text-xs font-mono text-green-300">
            {logs.map((log, index) => (
              <div key={index} className="py-0.5 flex">
                <span className="text-indigo-400 mr-2 select-none">{`[${index+1}]`}</span> 
                <span className="whitespace-pre-wrap break-all">{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 