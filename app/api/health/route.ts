import { prisma } from "@/lib/prisma";
import { hostedMode } from "@/lib/hosted-platform";
export async function GET(){try{await prisma.$queryRaw`SELECT 1`;return Response.json({status:"ok",hosted:hostedMode(),release:process.env.STUDIO_RELEASE||null},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({status:"unavailable"},{status:503});}}
