"use client"

import { useLocale } from "next-intl"

/*
 * Server messages (validation, stock, accounts) are written in English once,
 * on the server. The storefront shows them in the visitor's language here:
 * exact sentences first, then patterns for sentences with a name or number.
 * Anything unknown is shown as is.
 */

type Pair = [fr: string, ar: string]

const EXACT: Record<string, Pair> = {
  // Account confirmations
  "Your details are saved.": ["Tes informations sont enregistrées.", "تم حفظ معلوماتك."],
  "Your address was removed.": ["Ton adresse a été supprimée.", "تم حذف عنوانك."],
  "Password changed. Other devices were signed out.": ["Mot de passe changé. Les autres appareils sont déconnectés.", "تم تغيير كلمة المرور. تم تسجيل الخروج من الأجهزة الأخرى."],
  "Account deleted.": ["Compte supprimé.", "تم حذف الحساب."],
  "Order removed from your list.": ["Commande retirée de ta liste.", "تمت إزالة الطلب من قائمتك."],
  "Please check the highlighted fields.": ["Vérifie les champs en rouge.", "يرجى مراجعة الحقول المحددة."],
  "Please complete the form.": ["Complète le formulaire.", "يرجى إكمال النموذج."],
  "Please complete the review.": ["Complète ton avis.", "يرجى إكمال التقييم."],
  "Check your details.": ["Vérifie tes informations.", "راجع معلوماتك."],
  "Choose a size first.": ["Choisis d'abord une taille.", "اختر مقاسًا أولًا."],
  "Choose your wilaya.": ["Choisis ta wilaya.", "اختر ولايتك."],
  "Choose your commune.": ["Choisis ta commune.", "اختر بلديتك."],
  "Choose your wilaya from the list.": ["Choisis ta wilaya dans la liste.", "اختر ولايتك من القائمة."],
  "Choose your wilaya and commune too.": ["Choisis aussi ta wilaya et ta commune.", "اختر الولاية والبلدية أيضًا."],
  "Choose a stop desk.": ["Choisis un stop desk.", "اختر مكتب استلام."],
  "Choose one of the stop desks in the list.": ["Choisis un des stop desks de la liste.", "اختر أحد مكاتب الاستلام من القائمة."],
  "Enter your full name.": ["Entre ton nom complet.", "أدخل اسمك الكامل."],
  "Enter your name.": ["Entre ton nom.", "أدخل اسمك."],
  "Enter your phone number.": ["Entre ton numéro de téléphone.", "أدخل رقم هاتفك."],
  "Enter your street address.": ["Entre ton adresse.", "أدخل عنوانك."],
  "Enter a valid email address.": ["Entre une adresse email valide.", "أدخل بريدًا إلكترونيًا صحيحًا."],
  "Enter a valid Algerian mobile number (05, 06 or 07 followed by 8 digits).": [
    "Entre un numéro mobile algérien valide (05, 06 ou 07 suivi de 8 chiffres).",
    "أدخل رقم هاتف جزائري صحيحًا (05 أو 06 أو 07 متبوعًا بـ 8 أرقام).",
  ],
  "Enter your email or phone number.": ["Entre ton email ou ton numéro de téléphone.", "أدخل بريدك الإلكتروني أو رقم هاتفك."],
  "Enter an email or a phone number to sign in with.": ["Entre un email ou un numéro pour te connecter.", "أدخل بريدًا إلكترونيًا أو رقم هاتف لتسجيل الدخول."],
  "Enter the order number exactly as shown, e.g. KING253-20261004-001.": [
    "Entre le numéro de commande tel qu'affiché, ex. KING253-20261004-001.",
    "أدخل رقم الطلب كما هو، مثال KING253-20261004-001.",
  ],
  "Use at least 10 characters.": ["Utilise au moins 10 caractères.", "استخدم 10 أحرف على الأقل."],
  "That password is too long.": ["Ce mot de passe est trop long.", "كلمة المرور طويلة جدًا."],
  "Use letters and at least one number.": ["Utilise des lettres et au moins un chiffre.", "استخدم حروفًا ورقمًا واحدًا على الأقل."],
  "Tell us where you heard about us.": ["Dis-nous comment tu nous as connus.", "أخبرنا كيف تعرّفت علينا."],
  "Wrong password for this phone number.": ["Mauvais mot de passe pour ce numéro.", "كلمة مرور خاطئة لهذا الرقم."],
  "This phone number already has a KING 253 account. Enter its password to sign in, or tick “I forgot my password”.": [
    "Ce numéro a déjà un compte KING 253. Entre son mot de passe, ou coche « J'ai oublié mon mot de passe ».",
    "هذا الرقم لديه حساب في KING 253. أدخل كلمة المرور أو اختر «نسيت كلمة المرور».",
  ],
  "This email already has an account — sign in, or leave the email empty.": [
    "Cet email a déjà un compte — connecte-toi ou laisse l'email vide.",
    "هذا البريد لديه حساب — سجّل الدخول أو اترك البريد فارغًا.",
  ],
  "An account with this email already exists. Sign in instead.": ["Un compte existe déjà avec cet email. Connecte-toi.", "يوجد حساب بهذا البريد. سجّل الدخول."],
  "An account with this phone number already exists. Sign in instead.": ["Un compte existe déjà avec ce numéro. Connecte-toi.", "يوجد حساب بهذا الرقم. سجّل الدخول."],
  "Another account already uses this email.": ["Un autre compte utilise déjà cet email.", "حساب آخر يستخدم هذا البريد."],
  "Another account signs in with this phone number.": ["Un autre compte se connecte avec ce numéro.", "حساب آخر يسجّل الدخول بهذا الرقم."],
  "Keep your phone number — you sign in with it. Add an email first to remove it.": [
    "Garde ton numéro — tu te connectes avec. Ajoute d'abord un email pour le retirer.",
    "احتفظ برقم هاتفك — تسجّل الدخول به. أضف بريدًا إلكترونيًا أولًا لحذفه.",
  ],
  "Email/phone or password is incorrect.": ["Email/téléphone ou mot de passe incorrect.", "البريد/الهاتف أو كلمة المرور غير صحيحة."],
  "Your password is not correct.": ["Ton mot de passe est incorrect.", "كلمة المرور غير صحيحة."],
  "Your current password is not correct.": ["Ton mot de passe actuel est incorrect.", "كلمة المرور الحالية غير صحيحة."],
  "Please sign in again.": ["Reconnecte-toi.", "يرجى تسجيل الدخول مجددًا."],
  "Your bag is empty.": ["Ton panier est vide.", "سلتك فارغة."],
  "This item is no longer available.": ["Cet article n'est plus disponible.", "هذه القطعة لم تعد متوفرة."],
  "This size is out of stock.": ["Cette taille est en rupture.", "هذا المقاس نفد."],
  "This size is no longer available.": ["Cette taille n'est plus disponible.", "هذا المقاس لم يعد متوفرًا."],
  "No single shop has every item of your order in stock. Remove an item or lower a quantity.": [
    "Aucune boutique n'a toute ta commande en stock. Retire un article ou baisse une quantité.",
    "لا يوجد محل واحد يتوفر على كل طلبك. أزل قطعة أو قلّل الكمية.",
  ],
  "The shop you chose no longer has everything in your order. Please choose another shop.": [
    "La boutique choisie n'a plus toute ta commande. Choisis-en une autre.",
    "المحل الذي اخترته لم يعد يتوفر على كل طلبك. اختر محلًا آخر.",
  ],
  "Check the order number and phone.": ["Vérifie le numéro de commande et le téléphone.", "راجع رقم الطلب والهاتف."],
  "We couldn't find an order with this number and phone.": ["Aucune commande trouvée avec ce numéro et ce téléphone.", "لم نجد طلبًا بهذا الرقم وهذا الهاتف."],
  "We couldn't verify this order.": ["Impossible de vérifier cette commande.", "تعذّر التحقق من هذا الطلب."],
  "Order not found.": ["Commande introuvable.", "الطلب غير موجود."],
  "Your order can no longer be cancelled online — call us.": ["Ta commande ne peut plus être annulée en ligne — appelle-nous.", "لم يعد بالإمكان إلغاء طلبك عبر الموقع — اتصل بنا."],
  "Only cancelled orders, or orders fully returned and accepted by the shop, can be removed.": [
    "Seules les commandes annulées ou entièrement retournées peuvent être retirées.",
    "يمكن إزالة الطلبات الملغاة أو المرجعة بالكامل فقط.",
  ],
  "Too many attempts. Please wait a few minutes and try again.": ["Trop de tentatives. Patiente quelques minutes.", "محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة."],
  "Too many attempts. Please wait a few minutes.": ["Trop de tentatives. Patiente quelques minutes.", "محاولات كثيرة. انتظر بضع دقائق."],
  "Too many attempts. Wait 15 minutes and try again.": ["Trop de tentatives. Réessaie dans 15 minutes.", "محاولات كثيرة. أعد المحاولة بعد 15 دقيقة."],
  "Too many changes — wait a minute.": ["Trop de modifications — patiente une minute.", "تعديلات كثيرة — انتظر دقيقة."],
  "Too many new accounts from here. Try again later.": ["Trop de nouveaux comptes depuis ici. Réessaie plus tard.", "حسابات جديدة كثيرة من هنا. أعد المحاولة لاحقًا."],
  "Too many sign-ups from here. Try again later.": ["Trop d'inscriptions depuis ici. Réessaie plus tard.", "تسجيلات كثيرة من هنا. أعد المحاولة لاحقًا."],
  "Too many requests — wait a moment.": ["Trop de demandes — patiente un instant.", "طلبات كثيرة — انتظر لحظة."],
  "Slow down a little and try again.": ["Doucement, réessaie dans un instant.", "تمهّل قليلًا ثم أعد المحاولة."],
  "You've sent several reviews recently. Please try again later.": ["Tu as envoyé plusieurs avis récemment. Réessaie plus tard.", "أرسلت عدة تقييمات مؤخرًا. أعد المحاولة لاحقًا."],
  "Something went wrong while processing your request. Please try again.": ["Une erreur est survenue. Réessaie.", "حدث خطأ أثناء معالجة طلبك. أعد المحاولة."],
  "Quantity must be at least 1.": ["La quantité doit être d'au moins 1.", "يجب أن تكون الكمية 1 على الأقل."],
  "Maximum 20 per item.": ["Maximum 20 par article.", "20 كحد أقصى لكل قطعة."],
}

const PATTERNS: [RegExp, (m: RegExpMatchArray) => Pair][] = [
  [/^Only (\d+) left for (.+)\. Please lower the quantity\.$/, (m) => [`Plus que ${m[1]} pour ${m[2]}. Baisse la quantité.`, `بقي ${m[1]} فقط من ${m[2]}. قلّل الكمية.`]],
  [/^Only (\d+) left\. Please lower the quantity\.$/, (m) => [`Plus que ${m[1]}. Baisse la quantité.`, `بقي ${m[1]} فقط. قلّل الكمية.`]],
  [/^Only (\d+) left in this size\.$/, (m) => [`Plus que ${m[1]} dans cette taille.`, `بقي ${m[1]} فقط في هذا المقاس.`]],
  [/^(.+) is no longer available\.$/, (m) => [`${m[1]} n'est plus disponible.`, `${m[1]} لم يعد متوفرًا.`]],
  [/^(.+) cannot be ordered yet\.$/, (m) => [`${m[1]} ne peut pas encore être commandé.`, `${m[1]} غير متاح للطلب بعد.`]],
  [/^Only (\d+) left of (.+) \((.+)\)\. Update your bag\.$/, (m) => [`Plus que ${m[1]} de ${m[2]} (${m[3]}). Mets à jour ton panier.`, `بقي ${m[1]} فقط من ${m[2]} (${m[3]}). حدّث سلتك.`]],
  [/^Sorry, (.+) is no longer available\.$/, (m) => [`Désolé, ${m[1]} n'est plus disponible.`, `عذرًا، ${m[1]} لم يعد متوفرًا.`]],
  [/^Choose your commune in (.+)\.$/, (m) => [`Choisis ta commune à ${m[1]}.`, `اختر بلديتك في ${m[1]}.`]],
  [/^(.+) has no stop desk in (.+)\. Choose home delivery or another shop\.$/, (m) => [`${m[1]} n'a pas de stop desk à ${m[2]}. Choisis la livraison à domicile ou une autre boutique.`, `${m[1]} لا يملك مكتب استلام في ${m[2]}. اختر التوصيل إلى المنزل أو محلًا آخر.`]],
  [/^The shop is closed until (.+) — orders are paused\.$/, (m) => [`La boutique est fermée jusqu'au ${m[1]} — commandes en pause.`, `المتجر مغلق حتى ${m[1]} — الطلبات متوقفة.`]],
  [/^The shop is closed for now — orders are paused\.$/, () => ["La boutique est fermée pour le moment — commandes en pause.", "المتجر مغلق حاليًا — الطلبات متوقفة."]],
]

export function localizeError(message: string, locale: string): string {
  if (locale !== "fr" && locale !== "ar") return message
  const i = locale === "fr" ? 0 : 1
  const exact = EXACT[message]
  if (exact) return exact[i]
  for (const [re, make] of PATTERNS) {
    const m = message.match(re)
    if (m) return make(m)[i]
  }
  return message
}

/** (message) => message in the visitor's language. */
export function useErrorText() {
  const locale = useLocale()
  return (message: string) => localizeError(message, locale)
}
