import { NextResponse,type NextRequest } from "next/server";
// Defense in depth: hosted installs never expose unmetered paid adapters.
const blocked=/^\/api\/(realtime|gemini|elevenlabs|fish|ai-host|caller-factory)(\/|$)|^\/api\/images\/generate\/?$/;
export function middleware(request:NextRequest){const hosted=process.env.HOSTED_MODE==="true"||Boolean(process.env.HOSTED_PLATFORM_URL)||Boolean(process.env.HOSTED_INSTANCE_TOKEN);if(hosted&&blocked.test(request.nextUrl.pathname))return NextResponse.json({error:"This provider or feature is not included in this hosted studio. Use GPT-Live and the Caller Workshop."},{status:403});return NextResponse.next();}
export const config={matcher:["/api/:path*"]};
