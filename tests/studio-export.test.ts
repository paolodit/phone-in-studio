import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),raw:vi.fn(),readdir:vi.fn(),readFile:vi.fn()}));
vi.mock("@/lib/auth",()=>({isAdminSession:mocks.auth}));
vi.mock("@/lib/prisma",()=>({prisma:{$transaction:(fn:any)=>fn({$queryRawUnsafe:mocks.raw})}}));
vi.mock("node:fs/promises",()=>({readdir:mocks.readdir,readFile:mocks.readFile}));
import {GET} from "@/app/api/studio/export/route";
import {CREATIVE_TABLES,quotedRelation} from "@/lib/studio-export";
describe("Portable studio export",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue(true);mocks.raw.mockResolvedValue([{data:[]}]);mocks.readdir.mockResolvedValue([]);});
 it("requires authentication before reading creative data",async()=>{mocks.auth.mockResolvedValue(false);expect((await GET()).status).toBe(401);expect(mocks.raw).not.toHaveBeenCalled();});
 it("exports only creative data and excludes credentials and payment records",async()=>{const response=await GET();const value=await response.json();expect(Object.keys(value.data)).toEqual([...CREATIVE_TABLES]);expect(value.data.User).toBeUndefined();expect(value.data.OptionalModuleSetting).toBeUndefined();expect(response.headers.get("Cache-Control")).toBe("no-store");expect(response.headers.get("Content-Disposition")).toContain("attachment");});
 it("restricts uploaded files to content-addressed webp names",async()=>{const name="a".repeat(64)+".webp";mocks.readdir.mockResolvedValue([".env","../secret",name]);mocks.readFile.mockResolvedValue(Buffer.from("image fixture"));const body=await (await GET()).json();expect(Object.keys(body.artwork)).toEqual([name]);expect(mocks.readFile).toHaveBeenCalledOnce();});
 it("quotes schema identifiers and rejects unlisted tables",()=>{expect(quotedRelation("Show",'schema";DROP')).toBe('"schema"";DROP"."Show"');expect(()=>quotedRelation("User" as any)).toThrow();});
});
