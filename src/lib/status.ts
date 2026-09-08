// Unknown or negative statuses must not count as successful deliveries.
export function normalizeStatus(status: string): string {
  const s = String(status || '').trim().toLowerCase();
  if (['confirmed', 'مؤكدة', 'مؤكد'].includes(s)) return 'Confirmed';
  if (s === 'failed' || s.includes('فاشلة')) return 'Failed';
  if (s === 'waiting' || s.includes('انتظار')) return 'Waiting';
  if (s === 'pending' || s.includes('معلق') || s.includes('قيد المعالجة')) return 'Pending';
  return 'Unknown';
}

export function classifyTrackingStatus(status: string): 'delivered' | 'returned' | 'transit' | 'delivery' | 'others' {
  const s = String(status || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (['livré', 'livre', 'livrée', 'colis livré', 'delivered', 'مسلم', 'تم التسليم', 'تم التوصيل'].includes(s)) return 'delivered';
  if (/^(retour|retourné|retournée|colis retourné|refus|refusé|refused|رجع|مرجع|إرجاع|annulé|ملغى|ملغي)(\s|$)/.test(s)) return 'returned';
  if (['en livraison', 'en cours de livraison', 'out for delivery', 'قيد التوزيع', 'توزيع'].includes(s) || /^(tentative de livraison)(\s|\(|$)/.test(s)) return 'delivery';
  if (['en transit', 'transit', 'في الطريق', 'expédié', 'en route', 'ramassé', 'colis ramassé'].includes(s) || /^(en traitement)(\s|\(|$)/.test(s)) return 'transit';
  return 'others';
}
