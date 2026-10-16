import { prisma } from "@/lib/prisma";
import { hostedMode } from "@/lib/hosted-platform";
import { hostedSleepEnabled } from "@/lib/hosted-lifecycle";
export async function GET(){try{await prisma.$queryRaw`SELECT 1`;return Response.json({status:"ok",hosted:hostedMode(),release:process.env.STUDIO_RELEASE||null,sleepProtocol:hostedSleepEnabled()?2:null},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({status:"unavailable"},{status:503});}}
