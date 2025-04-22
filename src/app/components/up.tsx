"use client";

import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { FiDownload, FiInfo, FiSearch, FiCode } from 'react-icons/fi';
import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';

// 合约信息 - 根据实际情况替换
const PACKAGE_ID = "0x830281d4528f64ee7263150adea705a5cb6f713ae6ea15108738999118c57311"; // 替换为实际的包ID
const MODULE_NAME = "kuaidi"; // 替换为实际的模块名
const FUNCTION_NAME = "download_file"; // 替换为实际的函数名，这里需要更改为下载相关的函数

// 创建SUI客户端
const client = new SuiClient({ url: getFullnodeUrl("testnet") });

export function DownloadFileButton() {
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string>("");
  const [fileData, setFileData] = useState<any>(null);
  // 新增状态存储完整交易详情
  const [txDetails, setTxDetails] = useState<any>(null);
  const [showTxDetails, setShowTxDetails] = useState(false);
  
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [inspectResult, setInspectResult] = useState<any>(null);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleListDynamicFields();
    setFileId(e.target.value);
  };

  // 创建交易块的函数
  const createTransaction = () => {
    const txb = new Transaction();
    
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
      arguments: [
          txb.object("0x38c4c31808a910c983a8e7ef18a5ff46dfce77d739159fa4df48e31c9e1d1d62"),
          txb.pure.string(fileId),
      ],
    });
    
    return txb;
  };

  // 获取动态字段列表
  const handleListDynamicFields = async () => {
    try {
      const objectListResponse = await client.getDynamicFields({
        parentId: "0xb414c8b2696c93d0adbb8cb7de1c2c2dcb658655228f050ac90a4913955c5d9f",
      });
      console.log("动态字段列表:", objectListResponse);
      return objectListResponse;
    } catch (err) {
      console.error("获取动态字段列表失败:", err);
      return null;
    }
  };

  // 调用合约函数下载文件
  const handleDownloadFile = async () => {
    if (!fileId.trim()) {
      setError("请输入文件ID");
      return;
    }

    setLoading(true);
    setError(null);
    setTxResult(null);
    setFileData(null);
    setTxDetails(null); // 重置交易详情

    try {
      // 尝试获取动态字段列表（可选）
      // await handleListDynamicFields();

      // 创建交易块
      const txb = createTransaction();
 // 执行检查
 const txDetails = await suiClient.devInspectTransactionBlock({
  sender: "0xb84f4663b65048978bc61ca96cf91390f8e8df08855b3f8292413eb9d807cbc0",
  transactionBlock: txb,
});

// 保存结果
setInspectResult(txDetails);
console.log("交易检查结果:", txDetails);

// 打印结果
if (txDetails.results && txDetails.results[0]?.mutableReferenceOutputs?.[0]) {
  console.log("交易检查详情 (完整): " + JSON.stringify(txDetails.results[0].mutableReferenceOutputs[0][1], null, 2));
} else {
  console.log("交易检查详情 (完整): " + JSON.stringify(txDetails, null, 2));
}
} catch (err: any) {
setError(`交易检查失败: ${err.message}`);
console.error("交易检查错误:", err);
} finally {
setLoading(false);
}
};
  
  // 复制交易详情到剪贴板
  const copyTxDetailsToClipboard = () => {
    if (txDetails) {
      navigator.clipboard.writeText(JSON.stringify(txDetails, null, 2));
      alert('已复制交易详情到剪贴板');
    }
  };

  return (
    <div className="mb-6">
      <h3 className="text-white font-medium mb-4">查询和下载文件</h3>
      
      <div className="mb-4">
        <label className="block text-white mb-2">文件ID</label>
        <input 
          type="text" 
          value={fileId}
          onChange={handleInputChange}
          placeholder="请输入要下载的文件ID"
          className="w-full px-3 py-2 bg-indigo-900/30 border border-indigo-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      
      <button 
        onClick={handleDownloadFile}
        disabled={loading}
        className="flex items-center justify-center w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-md py-3 text-white font-medium mb-4 hover:shadow-lg transition-all disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            处理中...
          </span>
        ) : (
          <>
            <FiSearch className="mr-2" />
            查询并下载文件
          </>
        )}
      </button>
      
      {error && (
        <div className="text-red-300 text-sm mt-1 mb-3">
          <FiInfo className="inline-block mr-1" />
          {error}
        </div>
      )}
      
      {txResult && (
        <div className="mt-4 p-3 bg-white/10 rounded-md">
          <h3 className="text-white font-medium mb-2 flex items-center">
            <FiInfo className="mr-2" /> 交易结果
          </h3>
          <div className="text-white/80 text-sm space-y-1">
            <p>交易摘要: <span className="font-mono text-xs bg-white/10 p-1 rounded break-all">{txResult}</span></p>
            <p className="text-green-300">交易已成功提交到区块链</p>
          </div>
        </div>
      )}
      
      {fileData && (
        <div className="mt-4 p-3 bg-white/10 rounded-md">
          <h3 className="text-white font-medium mb-2 flex items-center">
            <FiDownload className="mr-2" /> 文件信息
          </h3>
          <div className="text-white/80 text-sm space-y-1">
            <p>文件ID: <span className="font-mono text-xs bg-white/10 p-1 rounded">{fileData.id}</span></p>
            <p>时间: {fileData.timestamp}</p>
            <p>状态: <span className="text-green-300">{fileData.status}</span></p>
            <button 
              className="mt-3 w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors"
              onClick={() => alert("下载功能待实现，可根据实际需求集成")}
            >
              <FiDownload className="mr-2" />
              下载文件
            </button>
          </div>
        </div>
      )}
      
      {/* 交易详情显示 */}
      {txDetails && (
        <div className="mt-4 bg-black/20 rounded-md overflow-hidden">
          <div 
            className="p-2 bg-indigo-900/30 flex justify-between items-center cursor-pointer" 
            onClick={() => setShowTxDetails(!showTxDetails)}
          >
            <span className="text-white flex items-center">
              <FiCode className="mr-2" /> 
              交易详细数据
            </span>
            <button className="text-white/70 text-sm">
              {showTxDetails ? "隐藏详情" : "显示详情"}
            </button>
          </div>
          
          {showTxDetails && (
            <div className="p-3 text-white/80 text-sm">
              <div className="mb-2">
                <button 
                  className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/40 py-1 px-2 rounded"
                  onClick={copyTxDetailsToClipboard}
                >
                  复制完整数据
                </button>
              </div>
              
              <pre className="bg-black/30 p-2 rounded-md overflow-auto max-h-60 text-xs">
                {JSON.stringify(txDetails, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}