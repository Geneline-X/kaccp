import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
function dbUrl(){
  let u=fs.readFileSync(".env","utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)![1].trim();
  const ip=fs.existsSync(".db-host-ip")?fs.readFileSync(".db-host-ip","utf8").trim():"";
  if(ip) u=u.replace(/@[^:/@]+:(\d+)/,`@${ip}:$1`);
  // one connection only, so this diagnostic never worsens the problem
  return u.includes("?") ? u+"&connection_limit=1" : u+"?connection_limit=1";
}
const p=new PrismaClient({datasources:{db:{url:dbUrl()}}});
(async()=>{
  const max:any = await p.$queryRawUnsafe(`SHOW max_connections`);
  const reserved:any = await p.$queryRawUnsafe(`SHOW superuser_reserved_connections`);
  console.log("max_connections           :", max[0].max_connections);
  console.log("superuser_reserved        :", reserved[0].superuser_reserved_connections);

  const total:any = await p.$queryRawUnsafe(`SELECT count(*)::int AS n FROM pg_stat_activity`);
  console.log("connections in use        :", total[0].n);

  console.log("\nby database / user / state:");
  const byState:any = await p.$queryRawUnsafe(`
    SELECT datname, usename, state, count(*)::int AS n
    FROM pg_stat_activity GROUP BY 1,2,3 ORDER BY n DESC`);
  byState.forEach((r:any)=>console.log(`  ${String(r.datname).padEnd(14)} ${String(r.usename).padEnd(10)} ${String(r.state).padEnd(20)} ${r.n}`));

  console.log("\nby application_name:");
  const byApp:any = await p.$queryRawUnsafe(`
    SELECT COALESCE(NULLIF(application_name,''),'(none)') AS app, count(*)::int AS n
    FROM pg_stat_activity GROUP BY 1 ORDER BY n DESC`);
  byApp.forEach((r:any)=>console.log(`  ${String(r.app).padEnd(30)} ${r.n}`));

  console.log("\nidle connections by age:");
  const idle:any = await p.$queryRawUnsafe(`
    SELECT state, count(*)::int AS n,
           max(EXTRACT(EPOCH FROM (now()-state_change)))::int AS oldest_sec
    FROM pg_stat_activity WHERE state LIKE 'idle%' GROUP BY 1 ORDER BY n DESC`);
  idle.forEach((r:any)=>console.log(`  ${String(r.state).padEnd(20)} n=${r.n}  oldest=${r.oldest_sec}s`));
  await p.$disconnect();
})().catch(e=>{console.error(String(e).split("\n").slice(0,6).join("\n"));process.exit(1);});
