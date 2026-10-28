import dotenv from "dotenv";dotenv.config({path:".env.local"});dotenv.config();
import {readFile,mkdir,writeFile,stat} from "node:fs/promises";import path from "node:path";import {createHash,randomUUID} from "node:crypto";import pg from "pg";import sharp from "sharp";
const tables=["HostProfile","Caller","CallerAsset","Show","SoundEffect","QueueItem","ShowEvent","ShowPlan","CallerGenerationBatch","CallerCandidate"] as const;
if(process.env.HOSTED_MODE==="true"||process.env.HOSTED_INSTANCE_TOKEN||process.env.HOSTED_PLATFORM_URL)throw new Error("Import runs only on a self-hosted installation.");
if(!process.env.DATABASE_URL||!process.argv[2])throw new Error("Set DATABASE_URL and run npx tsx scripts/import-studio.ts PATH_TO_EXPORT.json against an empty migrated database.");
const file=path.resolve(process.argv[2]);if((await stat(file)).size>100*1024*1024)throw new Error("Export is too large.");
const snapshot=JSON.parse(await readFile(file,"utf8"));
if(snapshot.format!=="ai-phone-in-studio"||snapshot.version!==1||!snapshot.data||!snapshot.artwork)throw new Error("Unsupported export.");
const artwork:Array<[string,Buffer]>=[];
for(const [name,value] of Object.entries(snapshot.artwork)){
 if(!/^[a-f0-9]{64}\.webp$/.test(name)||typeof value!=="string")throw new Error("Invalid artwork entry.");
 const bytes=Buffer.from(value,"base64");if(bytes.length>5*1024*1024||createHash("sha256").update(bytes).digest("hex")+".webp"!==name)throw new Error("Artwork checksum failed.");
 const metadata=await sharp(bytes,{limitInputPixels:20_000_000}).metadata();if(metadata.format!=="webp"||(metadata.pages||1)>1)throw new Error("Invalid artwork image.");artwork.push([name,bytes]);
}
const schema=new URL(process.env.DATABASE_URL).searchParams.get("schema")||"public";
const relation=(table:string)=>'"'+schema.replaceAll('"','""')+'"."'+table+'"';
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 await db.query("BEGIN");
 // Refuse merges and destructive replacements. Existing login settings are preserved.
 await db.query("LOCK TABLE "+tables.map(relation).join(",")+" IN ACCESS EXCLUSIVE MODE");
 for(const table of tables){
  if(!Array.isArray(snapshot.data[table]))throw new Error("Missing creative table: "+table);
  if((await db.query("SELECT 1 FROM "+relation(table)+" LIMIT 1")).rows.length)throw new Error("The destination studio must be empty.");
 }
 for(const show of snapshot.data.Show){show.broadcastToken=randomUUID();show.broadcastPublic=false;show.status="DRAFT";show.broadcastState="SHOW_IDLE";show.currentQueueItemId=null;show.currentVisualAssetId=null;show.startedAt=null;show.endedAt=null;show.hostMode="HUMAN";}
 for(const caller of snapshot.data.Caller)if(caller.status==="LIVE")caller.status="APPROVED";
 for(const item of snapshot.data.QueueItem)if(["LIVE","CONNECTING"].includes(item.status))item.status="QUEUED";
 for(const batch of snapshot.data.CallerGenerationBatch)if(batch.status==="RUNNING")batch.status="PAUSED";
 for(const table of tables)await db.query("INSERT INTO "+relation(table)+" SELECT * FROM jsonb_populate_recordset(NULL::"+relation(table)+",$1::jsonb)",[JSON.stringify(snapshot.data[table])]);
 const directory=path.join(process.cwd(),"data","show-artwork");await mkdir(directory,{recursive:true});for(const[name,bytes]of artwork)await writeFile(path.join(directory,name),bytes);
 await db.query("COMMIT");console.log("Studio imported. Public broadcast links were rotated; optional modules remain disabled. Download browser recordings separately.");
}catch(error){await db.query("ROLLBACK");throw error;}finally{await db.end();}
