"use client";
import { createContext,useContext,useEffect,type ReactNode } from "react";
const HostedContext=createContext(false);
export function HostedRuntime({enabled,children}:{enabled:boolean;children:ReactNode}){
 useEffect(()=>{
  if(!enabled)return;
  let pending=false;
  const ping=()=>{if(pending)return;pending=true;void fetch("/api/hosted/activity",{method:"POST",cache:"no-store",signal:AbortSignal.timeout(10000)}).catch(()=>{}).finally(()=>{pending=false;});};
  ping();const timer=setInterval(ping,30000);
  window.addEventListener("focus",ping);window.addEventListener("pageshow",ping);
  return()=>{clearInterval(timer);window.removeEventListener("focus",ping);window.removeEventListener("pageshow",ping);};
 },[enabled]);
 return <HostedContext.Provider value={enabled}>{children}</HostedContext.Provider>;
}
export function useHostedMode(){return useContext(HostedContext);}
