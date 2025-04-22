"use client";

import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { FiSend, FiInfo } from 'react-icons/fi';
import { TbTestPipe2Filled } from 'react-icons/tb';

// 合约信息 - 根据实际情况替换
const PACKAGE_ID = "0x830281d4528f64ee7263150adea705a5cb6f713ae6ea15108738999118c57311"; // 替换为实际的包ID
const MODULE_NAME = "kuaidi"; // 替换为实际的模块名
const FUNCTION_NAME = "upload_file"; // 替换为实际的函数名

export function SuiContractButton() {
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>("test1");
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // 调用合约函数
  const handleCallContract = async () => {
    if (!inputValue.trim()) {
      setError("请输入文件名");
      return;
    }

    setLoading(true);
    setError(null);
    setTxResult(null);

    try {
      // 创建交易块
      const txb = new Transaction();
      
      // 调用合约函数 - 根据实际合约方法修改参数
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
        arguments: [
            txb.object("0x448474f7ef193bc090bc2506c45bf5b8a6e1ab9fd3a422cabafa73357dc64f99"),
            txb.pure.string("testgo"),
            txb.pure.string(inputValue),
            txb.object("0x8")
        ], // 根据实际函数参数修改
      });

      // 签名并执行交易
      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: async (data: any) => {
            setTxResult(data.digest);
            console.log("交易成功:", data.digest);
            console.log("交易成功详情:", data);
          },
          onError: (err: Error) => {
            setError(`交易失败: ${err.message}`);
            console.error("交易错误:", err);
          },
          onSettled: () => {
            setLoading(false);
          }
        }
      );
    } catch (err: any) {
      setError(`创建交易失败: ${err.message}`);
      console.error("创建交易错误:", err);
      setLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <h3 className="text-white font-medium mb-4">调用 Sui 合约</h3>
      
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
        onClick={handleCallContract}
        disabled={loading}
        className="flex items-center justify-center w-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-md py-3 text-white font-medium mb-4 hover:shadow-lg transition-all disabled:opacity-50"
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
            <FiSend className="mr-2" />
            执行合约交易
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
    </div>
  );
} 