import type { OrderRequest } from './checkout';

export function orderStatusCopy(request: OrderRequest) {
  if (request.status === 'cancelled') return {
    title: 'Order request cancelled', pill: 'Cancelled',
    description: 'This request was cancelled in your current session. No seller notification or payment was sent.',
  };
  if (request.status === 'saved-locally') return {
    title: 'Order request saved', pill: 'Saved locally',
    description: 'Your demo request is saved in this session. The seller has not been notified. Confirm availability, the final price, and the schedule with the seller.',
  };
  return {
    title: 'Order request sent', pill: 'Waiting for seller',
    description: 'Waiting for seller confirmation. No payment is due until the livestock, price, and pickup or delivery details are confirmed.',
  };
}

export function orderProgress(request: OrderRequest) {
  const first = request.status === 'cancelled'
    ? ['Order request cancelled', 'This request will not proceed.']
    : request.status === 'saved-locally'
      ? ['Request saved locally', 'Seller notification is not connected in this demo.']
      : ['Order request sent', 'Waiting for the seller to confirm livestock availability.'];
  const next = request.draft.fulfillment === 'delivery' ? [
    ['Seller confirmation', 'Seller confirms availability, the price, and requested delivery.'],
    ['Transport quote confirmed', 'Buyer approves the final delivery fee and schedule.'],
    ['Livestock in transit', 'Transporter shares departure and arrival updates.'],
    ['Delivered', 'Buyer confirms the livestock was received.'],
  ] : [
    ['Seller confirmation', 'Seller confirms availability, the price, and pickup request.'],
    ['Pickup scheduled', 'Buyer and seller confirm the meeting details.'],
    ['Ready for pickup', 'Seller marks the livestock ready for collection.'],
    ['Completed', 'Buyer confirms the livestock was received.'],
  ];
  return [first, ...next].map(([title, description], index) => ({
    title, description, state: index === 0 ? request.status === 'cancelled' ? 'cancelled' as const : 'current' as const : 'future' as const,
  }));
}
