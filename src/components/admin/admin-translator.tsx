"use client"

import * as React from "react"

import type { AdminLang } from "@/lib/admin-lang"

type Dict = Record<string, [string, string]>

/** Sentences with numbers or names inside: [pattern, Arabic, French] ($1, $2… = the captured parts). */
const PATTERNS: [RegExp, string, string][] = [
  [/^vs (.+) last week$/, "مقابل $1 الأسبوع الماضي", "vs $1 la semaine dernière"],
  [/^vs (.+) last month$/, "مقابل $1 الشهر الماضي", "vs $1 le mois dernier"],
  [/^vs (.+) last year$/, "مقابل $1 العام الماضي", "vs $1 l'an dernier"],
  [/^vs (.+)$/, "مقابل $1", "vs $1"],
  [/^· (\d+) sizes?$/, "· $1 مقاس", "· $1 taille(s)"],
  [/^− (.+) · \+ (.+) · 30 days$/, "− $1 · + $2 · 30 يوماً", "− $1 · + $2 · 30 jours"],
  [/^− (.+) · 30 days$/, "− $1 · 30 يوماً", "− $1 · 30 jours"],
  [/^· (.+)$/, "· $1", "· $1"],
  [/^Refunded (.+)$/, "مسترجع $1", "Remboursé $1"],
  [/^Collected (.+)$/, "محصّل $1", "Encaissé $1"],
  [/^(\d+) testimonial\(s\)$/, "$1 شهادة", "$1 témoignage(s)"],
  [/^(\d+)% of sign-ups · (\d+) account\(s\)$/, "$1% من التسجيلات · $2 حساب", "$1 % des inscriptions · $2 compte(s)"],
  [/^(\d+)% of sign-ups$/, "$1% من التسجيلات", "$1 % des inscriptions"],
  [/^(\d+) customers · (\d+) admin\(s\)$/, "$1 زبون · $2 مسؤول", "$1 clients · $2 admin(s)"],
  [/^(\d+) account\(s\) have ordered · (\d+) blocked$/, "$1 حساب طلبوا · $2 محظور", "$1 compte(s) ont commandé · $2 bloqué(s)"],
  [/^(.+) — prices per wilaya \((\d+)\/(\d+) with a home price\)$/, "$1 — الأسعار حسب الولاية ($2/$3 بسعر للمنزل)", "$1 — prix par wilaya ($2/$3 avec un prix domicile)"],
  [/^(.+) — stop desks \((\d+)\)$/, "$1 — مكاتب Stop desk ($2)", "$1 — stop desks ($2)"],
  [/^(\d+) low · (\d+) out$/, "$1 منخفض · $2 نفد", "$1 bas · $2 épuisé(s)"],
  [/^New order (\S+) — nobody was notified$/, "طلب جديد $1 — لم يُبلَّغ أحد", "Nouvelle commande $1 — personne n'a été prévenu"],
  [/^Order · (.+)$/, "الطلب · $1", "Commande · $1"],
  [/^\+ (.+) delivery$/, "+ $1 توصيل", "+ $1 de livraison"],
  [/^\+ delivery in (\S+)$/, "+ التوصيل في $1", "+ livraison dans $1"],
  [/^(\d+) orders?$/, "$1 طلب", "$1 commande(s)"],
  [/^(\d+) days?$/, "$1 يوم", "$1 jour(s)"],
  [/^Drop (.+) photos here, or$/, "اسحب صور $1 هنا، أو", "Déposez les photos $1 ici, ou"],
  [/^(.+) image$/, "صورة $1", "Image $1"],
  [/^Slideshow — look (\d+)$/, "العرض — الإطلالة $1", "Diaporama — look $1"],
  [/^(\d+) return\(s\) in (.+), (\S+) → (\S+)$/, "$1 إرجاع في $2، $3 ← $4", "$1 retour(s) à $2, $3 → $4"],
  [/^(\d+) exchange\(s\) in (.+), (\S+) → (\S+)$/, "$1 تبديل في $2، $3 ← $4", "$1 échange(s) à $2, $3 → $4"],
  [/^Save (\d+) changes?$/, "حفظ $1 تغيير", "Enregistrer $1 modification(s)"],
  [/^(\d+) wilayas?$/, "$1 ولاية", "$1 wilaya(s)"],
  [/^(.+) added in (\d+) size\(s\)\. Now enter its stock per size and add its photos\.$/, "أضيف $1 بـ $2 مقاس. أدخل الآن مخزونه لكل مقاس وأضف صوره.", "$1 ajoutée en $2 taille(s). Saisissez son stock par taille et ajoutez ses photos."],
  [/^(\d+) product\(s\) translated into Arabic, French and English\.$/, "تُرجم $1 منتج للعربية والفرنسية والإنجليزية.", "$1 produit(s) traduit(s) en arabe, français et anglais."],
]

/**
 * Shows the admin in French or Arabic. The admin is written in English; this swaps every visible
 * English text (and placeholders / labels for screen readers) for its translation from
 * src/lib/admin-i18n-dict.json, and keeps doing it as pages change. Data (names, products, numbers)
 * is never in the dictionary, so it stays as typed.
 */
export function AdminTranslator({ lang }: { lang: AdminLang }) {
  React.useEffect(() => {
    if (lang === "en") return
    let cancelled = false
    let observer: MutationObserver | null = null
    const col = lang === "ar" ? 0 : 1

    import("@/lib/admin-i18n-dict.json").then((mod) => {
      if (cancelled) return
      const dict = (mod.default ?? mod) as unknown as Dict
      const lookup = (raw: string) => {
        const key = raw.replace(/\s+/g, " ").trim()
        if (!key) return null
        const hit = dict[key]
        if (hit) return hit[col]
        for (const [re, ar, fr] of PATTERNS) {
          const m = key.match(re)
          if (m) return (col === 0 ? ar : fr).replace(/\$(\d)/g, (_, i: string) => {
            const part = m[Number(i)] ?? ""
            const inner = dict[part]
            return inner ? inner[col] : part
          })
        }
        // "Delete?" / "Saved." style variants: try without trailing punctuation.
        const bare = key.replace(/[.:?!…]+$/, "")
        const hit2 = bare !== key ? dict[bare] : undefined
        return hit2 ? hit2[col] + key.slice(bare.length) : null
      }
      const skip = (el: Element | null) => !!el?.closest("script,style,textarea,[data-no-translate],[contenteditable=true]")
      const text = (node: Text) => {
        if (skip(node.parentElement)) return
        const v = node.nodeValue ?? ""
        const t = lookup(v)
        if (t !== null) {
          const lead = v.match(/^\s*/)?.[0] ?? ""
          const trail = v.match(/\s*$/)?.[0] ?? ""
          const next = lead + t + trail
          if (next !== v) node.nodeValue = next
        }
      }
      const attrs = (el: Element) => {
        if (skip(el)) return
        for (const a of ["placeholder", "aria-label", "title"]) {
          const v = el.getAttribute(a)
          if (v) {
            const t = lookup(v)
            if (t !== null && t !== v) el.setAttribute(a, t)
          }
        }
      }
      const walk = (root: Node) => {
        if (root.nodeType === Node.TEXT_NODE) return text(root as Text)
        if (root.nodeType !== Node.ELEMENT_NODE) return
        attrs(root as Element)
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
        for (let n = tw.nextNode(); n; n = tw.nextNode()) {
          if (n.nodeType === Node.TEXT_NODE) text(n as Text)
          else attrs(n as Element)
        }
      }
      walk(document.body)
      observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "characterData") text(r.target as Text)
          else if (r.type === "attributes") attrs(r.target as Element)
          else r.addedNodes.forEach(walk)
        }
      })
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] })
    })
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [lang])
  return null
}
