import { NextRequest, NextResponse } from 'next/server';

// Walrus服务器地址
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

// 正确处理NextJS App Router中的动态路由
export async function GET(
  request: NextRequest,
  context: { params: { blobId: string } }
) {
  // 从context中直接获取blobId
  const { blobId } = context.params;
  
  if (!blobId) {
    return NextResponse.json({ error: "缺少blobId参数" }, { status: 400 });
  }
  
  try {
    console.log(`代理下载请求: blobId=${blobId}`);
    
    // 向Walrus服务器转发请求
    const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
    
    if (!response.ok) {
      console.error(`Walrus服务器返回错误: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Walrus服务器返回错误: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // 获取原始blob数据
    const blob = await response.blob();
    console.log(`成功获取blob数据: ${blob.size} 字节`);
    
    // 返回blob数据
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': String(blob.size),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('代理请求出错:', error);
    return NextResponse.json(
      { error: '请求Walrus服务器时出错' },
      { status: 500 }
    );
  }
} 