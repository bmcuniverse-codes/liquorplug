import {PGlite} from '@electric-sql/pglite';
import {openDatabase} from '../../server/db.mjs';
export async function openPostgresTestDatabase(){
 const engine=new PGlite();
 await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 let tail=Promise.resolve();
 const query=async(sql,args=[])=>{
   const result=await engine.query(sql,args);
   for(const field of result.fields||[])if(field.dataTypeID===20)
     for(const row of result.rows)if(row[field.name]!==null)row[field.name]=Number(row[field.name]);
   return {rows:result.rows,rowCount:result.affectedRows??result.rows.length};
 };
 const pool={query,async connect(){const prior=tail;let release;tail=new Promise(r=>release=r);await prior;return{query,release};},end:()=>engine.close()};
 return openDatabase({pool});
}
