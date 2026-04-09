import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  
  // 允许跳过某些公开路由 (如果需要的话，目前全部拦截)
  // if (req.nextUrl.pathname.startsWith('/api/public')) return NextResponse.next();

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // 从环境变量读取，默认 fallback 为 admin/123456 用于本地测试
    const validUser = process.env.BASIC_AUTH_USER || 'admin';
    const validPass = process.env.BASIC_AUTH_PASSWORD || '123456';

    if (user === validUser && pwd === validPass) {
      return NextResponse.next();
    }
  }

  // 触发浏览器原生密码弹窗
  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Web3 Builder Hub Secure Area"',
    },
  });
}

export const config = {
  matcher: [
    // 拦截所有路由，排除静态文件和内部路由
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
