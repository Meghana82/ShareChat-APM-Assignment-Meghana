const SOURCE_NAME_PATTERNS = [
  /नवभारत\s*टाइम्स/i,
  /navbharat\s*times/i,
  /अमर\s*उजाला/i,
  /amar\s*ujala/i,
  /दैनिक\s*भास्कर/i,
  /dainik\s*bhaskar/i,
  /दैनिक\s*जागरण/i,
  /dainik\s*jagran/i,
  /लाइव\s*हिंदुस्तान/i,
  /live\s*hindustan/i,
  /the\s*hindu/i,
  /moneycontrol/i,
  /espncricinfo/i,
  /outlook\s*india/i,
  /youtube/i,
  /reddit/i,
];

const CONCRETE_ENTITY_PATTERNS = [
  /मोदी|प्रधानमंत्री|पीएम|सरकार|योजना|चुनाव|संसद|कैबिनेट|मंत्रालय/i,
  /ipl|kkr|gt|csk|mi|rcb|dc|rr|srh|pbks|lsg|कोहली|रोहित|धोनी|गिल|बुमराह/i,
  /सोना|चांदी|पेट्रोल|डीजल|lpg|cng|महंगाई|टमाटर|प्याज/i,
  /neet|jee|cbse|upsc|ssc|nta|रिजल्ट|एडमिट|नौकरी/i,
  /वट|सावित्री|शनि|अमावस्या|सावन|छठ|दिवाली|होली|नवरात्रि/i,
  /फिल्म|ट्रेलर|ott|बॉलीवुड|भोजपुरी|गाना|भजन/i,
];

export function isPublisherOrSourceNameTopic(text: string): boolean {
  const normalized = text.replace(/_/g, " ");
  const sourceHit = SOURCE_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!sourceHit) return false;
  return !CONCRETE_ENTITY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function containsPublisherName(text: string): boolean {
  const normalized = text.replace(/_/g, " ");
  return SOURCE_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}
