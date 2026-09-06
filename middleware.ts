import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, tokenValido } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const autenticado = await tokenValido(request.cookies.get(COOKIE_SESION)?.value);

  if (pathname === "/ingresar") {
    if (autenticado) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!autenticado) {
    const destino = new URL("/ingresar", request.url);
    // Se conserva el destino para volver alli despues de entrar.
    if (pathname !== "/") destino.searchParams.set("volver", pathname + search);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  // Se excluyen los archivos estaticos y el favicon; todo lo demas pasa por aqui.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)"],
};
