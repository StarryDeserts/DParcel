"use client";

import { useState, useEffect, useMemo } from 'react';
import { FiDownloadCloud, FiDatabase, FiRefreshCw, FiWifi } from 'react-icons/fi';
import { openDownloadLink } from '@/utils/walrusupload';
import { inspectTransaction } from '@/utils/moveupload';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';

// 文件列表查看器组件 - 独立自动获取数据版本
export default function FileListViewer() {
  const [parsedFiles, setParsedFiles] = useState<{filename: string, blobId?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnValues, setReturnValues] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  // 检查钱包连接状态
  useEffect(() => {
    setWalletConnected(!!currentAccount?.address);
  }, [currentAccount]);
  
  // 尝试从returnValues解析文件信息
  const parseFileInfos = (values: any[]): {filename: string, blobId?: string}[] => {
    if (!Array.isArray(values)) return [];
    
    const fileInfos: {filename: string, blobId?: string}[] = [];
    
    // 将ASCII码数组转换为完整字符串
    const fullText = values.map(code => String.fromCharCode(code)).join('');
    
    // 使用正则表达式匹配文件名和blobId
    // 格式: 文件名 + '@' + blobId(64字符)
    const regex = /([^@]+)@([a-zA-Z0-9]{64})/g;
    let match;
    
    while ((match = regex.exec(fullText)) !== null) {
      const filename = match[1];
      const blobId = match[2];
      
      if (filename && blobId) {
        fileInfos.push({ filename, blobId });
      }
    }
    
    if (fileInfos.length === 0) {
      // 尝试更宽松的匹配方式
      
      // 将ASCII码转换为字符串
      let currentString = "";
      
      for (let i = 0; i < values.length; i++) {
        if (values[i] >= 32 && values[i] <= 126) { // 可打印ASCII字符
          currentString += String.fromCharCode(values[i]);
        }
      }
      
      // 查找所有可能的文件名+@+blobid格式
      const matches = currentString.match(/([^@]+)@([a-zA-Z0-9]{64})/g);
      
      if (matches) {
        matches.forEach(item => {
          const parts = item.split('@');
          if (parts.length === 2) {
            const filename = parts[0];
            const blobId = parts[1];
            if (blobId.length === 64) {
              fileInfos.push({ filename, blobId });
            }
          }
        });
      }
    }
    
    return fileInfos;
  };
  
  // 下载指定文件
  const handleDownload = (blobId: string, filename: string) => {
    if (blobId) {
      openDownloadLink(blobId);
      console.log(`已打开下载链接: ${blobId} (${filename})`);
    }
  };
  
  // 自动获取数据
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    // 如果钱包未连接，显示提示信息
    if (!currentAccount?.address) {
      setLoading(false);
      setError("请先连接钱包后查看文件列表");
      return;
    }
    
    try {
      console.log("开始获取文件列表数据...");
      
      // 使用inspectTransaction获取链上数据，传入钱包地址
      const inspectResult = await inspectTransaction(suiClient, currentAccount.address);
      console.log("交易检查完成");
      
      // 提取并处理returnValues
      if (inspectResult && inspectResult.results && 
          inspectResult.results[0]?.returnValues && 
          inspectResult.results[0]?.returnValues[0]) {
        
        // 提取returnValues数据
        const extractedValues = inspectResult.results[0].returnValues[0][0];
        setReturnValues(extractedValues);
        
        console.log(`提取到returnValues数据, 长度: ${Array.isArray(extractedValues) ? extractedValues.length : 0}`);
        
        // 解析文件列表
        setTimeout(() => {
          const files = parseFileInfos(extractedValues);
          setParsedFiles(files);
          setLastUpdated(new Date());
          setLoading(false);
        }, 100);
      } else {
        console.log("未能提取到有效的返回值数据");
        setLoading(false);
        setError("未能从区块链获取到文件列表数据");
      }
    } catch (err) {
      console.error("获取数据失败:", err);
      setLoading(false);
      setError(err instanceof Error ? err.message : "获取数据时发生未知错误");
    }
  };
  
  // 组件加载时自动获取数据
  useEffect(() => {
    fetchData();
    
    // 可选：设置定时刷新
    const interval = setInterval(() => {
      fetchData();
    }, 60000); // 每分钟刷新一次
    
    return () => clearInterval(interval);
  }, [currentAccount]); // 添加currentAccount作为依赖，当钱包连接状态变化时重新获取数据
  
  // 统计信息
  const stats = useMemo(() => {
    return {
      total: parsedFiles.length,
      size: Array.isArray(returnValues) ? returnValues.length : 0
    };
  }, [parsedFiles, returnValues]);
  
  return (
    <div className="p-4 rounded-md bg-gray-900/50 overflow-hidden flex flex-col h-full min-h-[500px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-medium flex items-center">
          <FiDatabase className="mr-2" /> 文件列表
        </h3>
        
        <button 
          onClick={fetchData} 
          disabled={loading || !walletConnected}
          className="text-xs bg-indigo-900/60 hover:bg-indigo-800/60 text-white/80 hover:text-white py-1 px-2 rounded flex items-center transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>
      
      <div className="flex justify-between items-center mb-3 text-xs">
        <div className="bg-indigo-900/30 px-2 py-1 rounded">
          共 <span className="text-indigo-300 font-medium">{stats.total}</span> 个文件
        </div>
        <div className="bg-purple-900/30 px-2 py-1 rounded">
          {lastUpdated ? (
            <span>
              更新于: <span className="text-purple-300 font-medium">
                {lastUpdated.toLocaleTimeString()}
              </span>
            </span>
          ) : '数据加载中...'}
        </div>
      </div>
      
      {!walletConnected && (
        <div className="bg-blue-900/30 text-blue-300 text-xs p-3 mb-3 rounded flex items-center">
          <FiWifi className="mr-2 flex-shrink-0" />
          <span>请先连接钱包以查看文件列表</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-900/30 text-red-300 text-xs p-2 mb-3 rounded">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-indigo-400">数据加载中...</div>
        </div>
      ) : parsedFiles.length > 0 ? (
        <div className="bg-black/30 p-2 rounded-md flex-1 overflow-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-1">#</th>
                <th className="text-left p-1">文件名</th>
                <th className="text-left p-1">Blob ID</th>
                <th className="text-center p-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {parsedFiles.map((info, index) => (
                <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="p-1">{index+1}</td>
                  <td className="p-1 font-mono truncate max-w-[200px]" title={info.filename}>
                    {info.filename}
                  </td>
                  <td className="p-1 font-mono truncate max-w-[200px]" title={info.blobId}>
                    {info.blobId ? `${info.blobId.substring(0, 8)}...${info.blobId.substring(56)}` : 'N/A'}
                  </td>
                  <td className="p-1 text-center">
                    {info.blobId && (
                      <button
                        onClick={() => handleDownload(info.blobId!, info.filename)}
                        className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-indigo-900/30"
                        title="下载文件"
                      >
                        <FiDownloadCloud size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          {returnValues ? '没有找到文件数据' : '暂无数据'}
        </div>
      )}
    </div>
  );
} 