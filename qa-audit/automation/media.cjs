const fs=require("fs"), path=require("path")
const BASE=process.env.BASE, TOKEN=fs.readFileSync(process.env.TOKENFILE,"utf8").trim(), D=process.env.MEDIA
const ip=()=>`10.5.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}`
const post=async(files)=>{const fd=new FormData();for(const f of files)fd.append("files",new Blob([fs.readFileSync(path.join(D,f))],{type:/png/.test(f)?"image/png":/webp/.test(f)?"image/webp":/gif/.test(f)?"image/gif":/svg/.test(f)?"image/svg+xml":/php/.test(f)?"application/x-php":"image/jpeg"}),f);const r=await fetch(BASE+"/api/admin/uploads",{method:"POST",headers:{cookie:`k253_session=${TOKEN}`,"x-forwarded-for":ip()},body:fd});let j={};try{j=await r.json()}catch{};return {status:r.status,...j}}
const made=[]; const rec=(id,name,ok,d="")=>console.log(`${ok?"PASS":"FAIL"}  ${id}  ${name}${d?"  → "+d:""}`)
;(async()=>{
 for (const [id,f,mustOk] of [["MED-01","ok.jpg",true],["MED-02","ok.png",true],["MED-03","ok.webp",true]]) { const r=await post([f]); rec(id,`Valid ${f} is accepted`,r.status===200&&r.urls?.[0]?.endsWith(".webp"),`${r.status} ${r.urls?.[0]||r.error}`); if(r.urls)made.push(...r.urls) }
 const bad=[["MED-04","ok.gif","GIF (not an allowed type)"],["MED-05","script.svg","SVG with a script"],["MED-06","shell.php","PHP file"],["MED-07","empty.jpg","empty file"],["MED-08","corrupt.jpg","corrupted JPEG"],["MED-09","fake.jpg","executable renamed .jpg"],["MED-10","huge.jpg","11 MB file (limit 10 MB)"],["MED-11","bomb.png","144-megapixel decompression bomb"]]
 for (const [id,f,label] of bad){ const r=await post([f]); rec(id,`Rejected: ${label}`,r.status>=400&&r.status<500&&!r.urls,`${r.status} ${r.error||""}`) }
 const pg=await post(["polyglot.jpg"]); rec("MED-12","JPEG+PHP polyglot: accepted only after re-encoding, PHP payload removed",pg.status===200?!fs.readFileSync(path.join(process.env.UPLOADS,pg.urls[0].replace("/media/",""))).includes("<?php"):pg.status>=400,`${pg.status} ${pg.urls?.[0]||pg.error}`); if(pg.urls)made.push(...pg.urls)
 // served file headers
 if(made[0]){const r=await fetch(BASE+made[0]);rec("MED-13","Uploaded image is served as image/webp with nosniff",r.headers.get("content-type")==="image/webp"&&r.headers.get("x-content-type-options")==="nosniff",`${r.status} ${r.headers.get("content-type")}`)}
 const many=await post(Array(13).fill("ok.jpg")); rec("MED-14","More than 12 files in one request is refused",many.status===400,`${many.status} ${many.error}`)
 const none=await post([]); rec("MED-15","Request with no file is refused",none.status===400,`${none.status}`)
 const r=await fetch(BASE+"/media/2026/10/does-not-exist.webp"); rec("MED-16","Missing image returns 404 (not a crash)",r.status===404,`${r.status}`)
 for(const u of made){ try{fs.unlinkSync(path.join(process.env.UPLOADS,u.replace("/media/","")))}catch{} }
 console.log("cleaned up",made.length,"test files")
})()
