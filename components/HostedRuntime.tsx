"use client";
import { createContext,useContext,type ReactNode } from "react";
const HostedContext=createContext(false);
export function HostedRuntime({enabled,children}:{enabled:boolean;children:ReactNode}){return <HostedContext.Provider value={enabled}>{children}</HostedContext.Provider>;}
export function useHostedMode(){return useContext(HostedContext);}
