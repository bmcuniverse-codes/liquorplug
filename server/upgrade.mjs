import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {upgradeSettings} from './content.mjs';

export async function minimumStock(db,minimum=10,actor='system:opening-stock') {
  const rows=await db.all('SELECT id,stock FROM products WHERE archived=0 AND stock<?',[minimum]);
  for(const row of rows){
    const delta=minimum-Number(row.stock);
    await db.query('UPDATE products SET stock=? WHERE id=?',[minimum,row.id]);
    await db.query('INSERT INTO stock_movements(id,product_id,delta,reason,actor,created_at) VALUES(?,?,?,?,?,?)',
      [randomUUID(),row.id,delta,'Opening stock confirmed by store owner',actor,Date.now()]);
  }
  return rows.length;
}

export async function upgradeStore(db) {
  if(await db.one('SELECT version FROM migrations WHERE version=2'))return;
  const catalogue=JSON.parse(await readFile(new URL('../data/catalogue.json',import.meta.url),'utf8'));
  await db.tx(async()=>{
    if(await db.one('SELECT version FROM migrations WHERE version=2'))return;
    for(const row of await db.all('SELECT id,data FROM content')){
      const before=JSON.parse(row.data);
      if(row.id==='published')await db.query('INSERT INTO content_versions(id,data,actor,created_at) VALUES(?,?,?,?)',
        [randomUUID(),row.data,'system:store-enhancements',Date.now()]);
      await db.query('UPDATE content SET data=?,updated_at=? WHERE id=?',[JSON.stringify(upgradeSettings(before)),Date.now(),row.id]);
    }
    await minimumStock(db);
    for(const product of catalogue.products||[])if(product.image&&product.image!=='/placeholder.svg'){
      await db.query("UPDATE products SET image=? WHERE slug=? AND (image='' OR image='/placeholder.svg')",[product.image,product.slug]);
    }
    await db.query('INSERT INTO migrations(version,applied_at) VALUES(2,?)',[Date.now()]);
  });
}
