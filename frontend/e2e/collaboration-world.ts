import type { Page } from '@playwright/test';
import { runWorldAction } from './global-setup';

/** Per-journey world: owner qualification in another spec cannot change this actor. */
export async function withCollaborationWorld(page:Page, journey:()=>Promise<void>) {
  const world=runWorldAction<{world_file:string;env:Record<string,string>}>('seed');
  const previous=new Map(Object.keys(world.env).map(key=>[key,process.env[key]]));
  Object.assign(process.env,world.env);
  try { await journey(); }
  finally {
    // Unmount private loaders before deleting exactly this world's owned graph.
    await page.goto('about:blank');
    try { runWorldAction('clean',world.world_file); }
    finally { for(const [key,value] of previous) { if(value===undefined)delete process.env[key];else process.env[key]=value; } }
  }
}
