import { Booking } from '../api';
import { format } from 'date-fns';

interface BookingCardProps {
  booking: Booking;
  onApprove?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
}

export function BookingCard({ booking, onApprove, onCancel }: BookingCardProps) {
  const start = format(new Date(booking.start), 'eee dd MMM • HH:mm');
  const end = format(new Date(booking.end), 'HH:mm');

  return (
    <div className="card booking-card">
      <header className="booking-card__header">
        <div>
          <strong className="booking-card__guest">{booking.customerName}</strong>
          <p className="help">
            Party of {booking.partySize} • Tables {booking.tableIds.join(', ')}
          </p>
        </div>
        <span className={`status-chip ${booking.status.toLowerCase()}`}>{booking.status}</span>
      </header>

      <div className="booking-card__schedule">
        <span className="booking-card__time">{start}</span>
        <span className="booking-card__time">ends {end}</span>
      </div>

      {booking.notes ? <p className="help">{booking.notes}</p> : null}

      <div className="actions booking-card__actions">
        {booking.status === 'PENDING' && onApprove ? (
          <button className="btn btn-primary" onClick={() => onApprove(booking)}>
            Approve
          </button>
        ) : null}
        {booking.status !== 'CANCELLED' && onCancel ? (
          <button className="btn btn-muted" onClick={() => onCancel(booking)}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
