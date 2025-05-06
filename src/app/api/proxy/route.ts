import { NextRequest, NextResponse } from 'next/server';

// Walrus服务器地址
const PUBLISHER = "https://publisher.walrus-testnet.walrus.space";

export async function PUT(request: NextRequest) {
  try {
    // 获取请求体
    const blob = await request.blob();
    
    // 获取URL中的epochs参数
    const searchParams = request.nextUrl.searchParams;
    const epochs = searchParams.get('epochs');
    
    // 构建请求URL，如果有epochs参数则添加到URL中
    let requestUrl = `${PUBLISHER}/v1/blobs`;
    if (epochs) {
      requestUrl += `?epochs=${epochs}`;
    }
    
    // 向Walrus服务器转发请求
    const response = await fetch(requestUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    
    if (!response.ok) {
      console.error(`Walrus上传错误: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Walrus服务器返回错误: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // 获取响应数据并返回
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('代理上传请求出错:', error);
    return NextResponse.json(
      { error: '请求Walrus服务器时出错' },
      { status: 500 }
    );
  }
} 