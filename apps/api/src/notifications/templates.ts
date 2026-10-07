import type { DocType } from '@zinu/shared';

type Lang = 'en' | 'hi';
type Params = Record<string, string | number>;

export const DOC_LABELS: Record<DocType, Record<Lang, string>> = {
  DRIVING_LICENCE: { en: 'Driving licence', hi: 'ड्राइविंग लाइसेंस' },
  PROFILE_PHOTO: { en: 'Profile photo', hi: 'प्रोफ़ाइल फ़ोटो' },
  VEHICLE_RC: { en: 'Registration certificate (RC)', hi: 'रजिस्ट्रेशन सर्टिफ़िकेट (RC)' },
  INSURANCE: { en: 'Vehicle insurance', hi: 'गाड़ी का बीमा' },
  PUC: { en: 'Pollution certificate (PUC)', hi: 'प्रदूषण प्रमाणपत्र (PUC)' },
  PERMIT: { en: 'Permit', hi: 'परमिट' },
  VEHICLE_PHOTOS: { en: 'Vehicle photos', hi: 'गाड़ी की फ़ोटो' },
};

const T: Record<string, Record<Lang, (p: Params) => { title: string; body: string }>> = {
  'driver.application_received': {
    en: () => ({ title: 'Application received', body: 'Thanks! Our team is reviewing your driver profile and documents.' }),
    hi: () => ({ title: 'आवेदन मिल गया', body: 'धन्यवाद! हमारी टीम आपकी ड्राइवर प्रोफ़ाइल और दस्तावेज़ों की जाँच कर रही है।' }),
  },
  'driver.approved': {
    en: () => ({ title: 'You are approved to drive with ZINU', body: 'Welcome aboard! You can go online once ride requests open in your city.' }),
    hi: () => ({ title: 'ZINU के साथ ड्राइव करने के लिए आप स्वीकृत हैं', body: 'स्वागत है! आपके शहर में राइड शुरू होते ही आप ऑनलाइन जा सकते हैं।' }),
  },
  'driver.info_required': {
    en: (p) => ({ title: 'More information needed', body: String(p.message) }),
    hi: (p) => ({ title: 'अतिरिक्त जानकारी चाहिए', body: String(p.message) }),
  },
  'driver.rejected': {
    en: (p) => ({ title: 'Driver application not approved', body: String(p.reason) }),
    hi: (p) => ({ title: 'ड्राइवर आवेदन स्वीकृत नहीं हुआ', body: String(p.reason) }),
  },
  'driver.suspended': {
    en: (p) => ({ title: 'Your driver account is suspended', body: String(p.reason) }),
    hi: (p) => ({ title: 'आपका ड्राइवर अकाउंट निलंबित है', body: String(p.reason) }),
  },
  'driver.reinstated': {
    en: () => ({ title: 'Your driver account is active again', body: 'Your suspension has been lifted.' }),
    hi: () => ({ title: 'आपका ड्राइवर अकाउंट फिर से सक्रिय है', body: 'आपका निलंबन हटा दिया गया है।' }),
  },
  'document.approved': {
    en: (p) => ({ title: 'Document approved', body: `${p.doc} has been approved.` }),
    hi: (p) => ({ title: 'दस्तावेज़ स्वीकृत', body: `${p.doc} स्वीकृत हो गया है।` }),
  },
  'document.rejected': {
    en: (p) => ({ title: 'Document needs attention', body: `${p.doc}: ${p.reason}` }),
    hi: (p) => ({ title: 'दस्तावेज़ पर ध्यान दें', body: `${p.doc}: ${p.reason}` }),
  },
  'document.expiring': {
    en: (p) => ({ title: `${p.doc} expires in ${p.days} day${p.days === 1 ? '' : 's'}`, body: `It is valid until ${p.date}. Upload the renewed document in the ZINU app to keep driving.` }),
    hi: (p) => ({ title: `${p.doc} ${p.days} दिन में समाप्त हो रहा है`, body: `यह ${p.date} तक मान्य है। ड्राइव जारी रखने के लिए ZINU ऐप में नया दस्तावेज़ अपलोड करें।` }),
  },
  'document.expired': {
    en: (p) => ({ title: `${p.doc} has expired`, body: 'Upload the renewed document in the ZINU app. You may not be able to go online until it is approved.' }),
    hi: (p) => ({ title: `${p.doc} की समय-सीमा समाप्त`, body: 'ZINU ऐप में नया दस्तावेज़ अपलोड करें। स्वीकृत होने तक आप ऑनलाइन नहीं जा पाएँगे।' }),
  },
  'payout.verified': {
    en: () => ({ title: 'Payout details verified', body: 'Your bank/UPI details are verified for payouts.' }),
    hi: () => ({ title: 'पेआउट जानकारी सत्यापित', body: 'आपकी बैंक/UPI जानकारी पेआउट के लिए सत्यापित हो गई है।' }),
  },
  'payout.rejected': {
    en: (p) => ({ title: 'Payout details need attention', body: String(p.reason) }),
    hi: (p) => ({ title: 'पेआउट जानकारी पर ध्यान दें', body: String(p.reason) }),
  },
};

export type NotificationType = keyof typeof T;

export function render(type: NotificationType, lang: string, params: Params = {}) {
  const l: Lang = lang === 'hi' ? 'hi' : 'en';
  const docType = params.docType as DocType | undefined;
  const withDoc = docType ? { ...params, doc: DOC_LABELS[docType]?.[l] ?? docType } : params;
  return T[type]![l](withDoc);
}

export const notificationTypes = Object.keys(T);
