"use client";

import { useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { FiSend, FiInfo, FiCode } from 'react-icons/fi';

// 合约信息 - 根据实际情况替换
const PACKAGE_ID = "0x830281d4528f64ee7263150adea705a5cb6f713ae6ea15108738999118c57311"; 
const MODULE_NAME = "kuaidi"; 
const FUNCTION_NAME = "get_blob_id_from_pickup_code"; 

export function DevInspectTransaction() {
  const [loading, setLoading] = useState(false);
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>("test1");
  const [showDetails, setShowDetails] = useState(false);
  const suiClient = useSuiClient();
  
  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // 执行交易检查
  const handleInspectTransaction = async () => {
    if (!inputValue.trim()) {
      setError("请输入文件名");
      return;
    }

    setLoading(true);
    setError(null);
    setInspectResult(null);

    try {
      // 创建交易块
      const txb = new Transaction();
      
      // 配置交易调用
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
          txb.object("0x448474f7ef193bc090bc2506c45bf5b8a6e1ab9fd3a422cabafa73357dc64f99"),
          // txb.pure.address("0xb84f4663b65048978bc61ca96cf91390f8e8df08855b3f8292413eb9d807cbc0"),
          txb.pure.string("52a9926057838e401cfe849e3b52f5ee5a58e4a05dde8fef8f198f2916070d65"),
        ],
      });

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

  return (
    <div className="mb-6">
      <h3 className="text-white font-medium mb-4">Sui 交易检查工具</h3>
      
      <div className="mb-4">
        <label className="block text-white mb-2">文件名</label>
        <input 
          type="text" 
          value={inputValue}
          onChange={handleInputChange}
          placeholder="请输入文件名"
          className="w-full px-3 py-2 bg-indigo-900/30 border border-indigo-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      
      <button 
        onClick={handleInspectTransaction}
        disabled={loading}
        className="flex items-center justify-center w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-md py-3 text-white font-medium mb-4 hover:shadow-lg transition-all disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            检查中...
          </span>
        ) : (
          <>
            <FiCode className="mr-2" />
            检查交易
          </>
        )}
      </button>
      
      {error && (
        <div className="text-red-300 text-sm mt-1 mb-3 p-2 bg-red-900/20 rounded-md">
          <FiInfo className="inline-block mr-1" />
          {error}
        </div>
      )}
      
      {inspectResult && (
        <div className="mt-4 bg-black/20 rounded-md overflow-hidden">
          <div 
            className="p-2 bg-indigo-900/30 flex justify-between items-center cursor-pointer" 
            onClick={() => setShowDetails(!showDetails)}
          >
            <span className="text-white flex items-center">
              <FiCode className="mr-2" /> 
              交易检查结果
              {inspectResult.results?.length > 0 && 
                <span className="ml-2 bg-green-700 px-2 py-0.5 text-xs rounded-full">
                  成功
                </span>
              }
            </span>
            <button className="text-white/70 text-sm">
              {showDetails ? "隐藏详情" : "显示详情"}
            </button>
          </div>
          
          {showDetails && (
            <div className="p-3 text-white/80 text-sm">
              {/* 显示结果详情 */}
              {inspectResult.results?.length > 0 && inspectResult.results[0]?.mutableReferenceOutputs && (
                <div className="mb-3">
                  <h5 className="font-medium mb-1">引用输出:</h5>
                  <pre className="bg-black/30 p-2 rounded-md overflow-auto max-h-60 text-xs">
                    {JSON.stringify(inspectResult.results[0].mutableReferenceOutputs, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* 显示返回值 */}
              {inspectResult.results?.length > 0 && inspectResult.results[0]?.returnValues && (
                <div className="mb-3">
                  <h5 className="font-medium mb-1">返回值:</h5>
                  <pre className="bg-black/30 p-2 rounded-md overflow-auto max-h-40 text-xs">
                    {JSON.stringify(inspectResult.results[0].returnValues, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* 显示事件 */}
              {inspectResult.events?.length > 0 && (
                <div className="mb-3">
                  <h5 className="font-medium mb-1">事件:</h5>
                  <pre className="bg-black/30 p-2 rounded-md overflow-auto max-h-40 text-xs">
                    {JSON.stringify(inspectResult.events, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* 显示所有数据 */}
              <div className="mt-4">
                <button 
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectResult, null, 2));
                    alert('已复制完整结果到剪贴板');
                  }}
                >
                  复制完整结果
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 