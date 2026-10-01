import type { OrderRequest } from './checkout';

export function orderStatusCopy(request: OrderRequest) {
  const lifecycle = {
    accepted: { title: 'Seller accepted your order', pill: 'Accepted', description: 'Confirm the final schedule and pickup or delivery arrangements with the seller.' },
    scheduled: { title: 'Order scheduled', pill: 'Scheduled', description: 'Follow the confirmed pickup or delivery schedule.' },
    ready: { title: 'Livestock ready', pill: 'Ready', description: 'Your livestock is ready for the confirmed handover.' },
    'in-transit': { title: 'Livestock in transit', pill: 'In transit', description: 'Your delivery is on its way. Coordinate arrival details with the seller.' },
    completed: { title: 'Order completed', pill: 'Completed', description: 'The livestock handover has been recorded as complete.' },
    rejected: { title: 'Seller declined your request', pill: 'Declined', description: 'This request will not proceed. You can browse other livestock listings.' },
  };
  if (request.status in lifecycle) return lifecycle[request.status as keyof typeof lifecycle];
  if (request.status === 'cancelled') return {
    title: 'Order request cancelled', pill: 'Cancelled',
    description: 'This request was cancelled and will not proceed.',
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
  const stage = request.status === 'accepted' ? 1 : request.status === 'scheduled' ? 2
    : request.status === 'ready' || request.status === 'in-transit' ? 3 : request.status === 'completed' ? 4 : 0;
  return [first, ...next].map(([title, description], index) => ({
    title: index === 0 && stage > 0 ? 'Order request sent' : request.status === 'rejected' && index === 0 ? 'Order request declined' : title,
    description: index === 0 && stage > 0 ? 'Your request reached the seller.' : description, state: index === stage ? request.status === 'cancelled' || request.status === 'rejected' ? 'cancelled' as const
      : request.status === 'completed' ? 'complete' as const : 'current' as const : index < stage ? 'complete' as const : 'future' as const,
  }));
}

export function canCancelOrder(request: OrderRequest) { return ['saved-locally', 'awaiting-seller', 'accepted', 'scheduled'].includes(request.status); }
