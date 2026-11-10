const postgres=require("postgres");const sql=postgres(process.env.DATABASE_URL);
(async()=>{
 const r=await sql`select o.number, n.template, n.recipient, n.status, left(coalesce(n.error,''),60) err from notifications n join orders o on o.id=n.order_id where o.created_at > now() - interval '3 hours' order by o.created_at desc limit 8`
 console.table(r)
 const dup=await sql`select count(*)::int n from (select order_id,template from notifications where order_id is not null group by 1,2 having count(*)>1) x`
 console.log("orders with the same email type recorded twice:", dup[0].n)
 const st=await sql`select status, count(*)::int n from notifications group by 1`
 console.log("all notifications by status:", JSON.stringify(st))
 await sql.end()})()
