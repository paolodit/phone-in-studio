import { readdir,readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
export const CREATIVE_TABLES=["HostProfile","Caller","CallerAsset","Show","SoundEffect","QueueItem","ShowEvent","ShowPlan","CallerGenerationBatch","CallerCandidate"] as const;
export function quotedRelation(table:typeof CREATIVE_TABLES[number],schema="public"){if(!CREATIVE_TABLES.includes(table))throw new Error("Unsupported export table.");return '"'+schema.replaceAll('"','""')+'"."'+table+'"';}
export async function exportStudio(){
 const schema=new URL(process.env.DATABASE_URL||"postgresql://localhost/studio").searchParams.get("schema")||"public";
 const data=await prisma.$transaction(async tx=>{
  const result:Record<string,unknown[]>={};
  for(const table of CREATIVE_TABLES){const rows=await tx.$queryRawUnsafe<Array<{data:unknown[]}>>("SELECT COALESCE(jsonb_agg(t),'[]'::jsonb) AS data FROM "+quotedRelation(table,schema)+" t");result[table]=rows[0].data;}
  return result;
 },{isolationLevel:"RepeatableRead",timeout:30000});
 const artwork:Record<string,string>={};const directory=path.join(process.cwd(),"data","show-artwork");let total=0;
 for(const file of await readdir(directory).catch((error: NodeJS.ErrnoException)=>{if(error.code==="ENOENT")return [];throw error;})){
  if(!/^[a-f0-9]{64}\.webp$/.test(file))continue;const bytes=await readFile(path.join(directory,file));total+=bytes.length;
  if(total>50*1024*1024)throw new Error("Artwork exceeds the portable export limit. Ask your operator for a full backup.");
  artwork[file]=bytes.toString("base64");
 }
 return {format:"ai-phone-in-studio",version:1,exportedAt:new Date().toISOString(),data,artwork,excludes:["login credentials","payment balances","provider keys","module settings","browser recordings","externally hosted media"]};
}
