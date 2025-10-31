import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import {
  ApiService,
  Booking,
  BookingPayload,
  DiscoveryRequest,
  WaitlistEntry,
  ResetResponse,
  StrategySummary,
  CatalogSummary,
  SectorSummary
} from './api';
import {
  DEFAULT_DATE,
  DEFAULT_RESTAURANT_ID,
  DEFAULT_SECTOR_ID
} from './config';
import { Section } from './components/Section';
import { BookingCard } from './components/BookingCard';
import { Toast } from './components/Toast';
import { DateTimeField } from './components/DateTimeField';

type Tab = 'dashboard' | 'discover' | 'bookings' | 'waitlist' | 'metrics' | 'settings';

type NavItem = { key: Tab; label: string; description: string; icon: string };

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Control center',
    description: 'Snapshot of the day with the most relevant signals at a glance.',
    icon: '✨'
  },
  {
    key: 'discover',
    label: 'Smart discovery',
    description: 'Let WokiBrain find the best seating combination in seconds.',
    icon: '🔍'
  },
  {
    key: 'bookings',
    label: 'Reservations',
    description: 'Review, approve, or cancel bookings for the selected service.',
    icon: '📅'
  },
  {
    key: 'waitlist',
    label: 'Waitlist',
    description: 'Capture guests that are waiting for a table and promote them fast.',
    icon: '🪑'
  },
  {
    key: 'metrics',
    label: 'Metrics',
    description: 'Operational indicators powered by the live Prometheus feed.',
    icon: '📈'
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Maintenance tools to reset the in-memory demo dataset.',
    icon: '⚙️'
  }
];

const defaultDiscovery: DiscoveryRequest = {
  restaurantId: DEFAULT_RESTAURANT_ID,
  sectorId: DEFAULT_SECTOR_ID,
  partySize: 4,
  date: DEFAULT_DATE
};

const defaultBooking: BookingPayload = {
  restaurantId: DEFAULT_RESTAURANT_ID,
  sectorId: DEFAULT_SECTOR_ID,
  partySize: 4,
  start: `${DEFAULT_DATE}T12:00:00.000Z`,
  customerName: 'Alex Johnson',
  notes: 'Prefer window seating'
};

const defaultWaitlist = {
  restaurantId: DEFAULT_RESTAURANT_ID,
  sectorId: DEFAULT_SECTOR_ID,
  partySize: 2,
  customerName: 'Jamie Doe',
  desiredTime: `${DEFAULT_DATE}T12:30:00.000Z`,
  customerContact: '',
  notes: ''
};

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SERVICE_WINDOWS = [
  { day: 0, startTime: '10:00', endTime: '22:00' },
  { day: 1, startTime: '11:00', endTime: '22:00' },
  { day: 2, startTime: '11:00', endTime: '22:00' },
  { day: 3, startTime: '11:00', endTime: '22:00' },
  { day: 4, startTime: '11:00', endTime: '23:00' },
  { day: 5, startTime: '10:00', endTime: '23:00' },
  { day: 6, startTime: '10:00', endTime: '23:00' }
];

const createDefaultRestaurantForm = () => ({
  id: '',
  name: '',
  timezone: 'UTC',
  sectors: [{ id: '', name: 'Main Dining' }],
  serviceWindows: DEFAULT_SERVICE_WINDOWS.map((window) => ({ ...window }))
});

const createDefaultTableForm = (restaurantId = '', sectorId = '') => ({
  id: '',
  restaurantId,
  sectorId,
  label: '',
  minCapacity: 2,
  maxCapacity: 4,
  combinableWith: ''
});

const WAITLIST_STATUS_COPY: Record<WaitlistEntry['status'], string> = {
  WAITING: 'Waiting',
  PROMOTED: 'Promoted',
  EXPIRED: 'Expired'
};

function parsePrometheusPayload(payload?: string) {
  if (!payload) return [];

  return payload
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const [name, value] = line.split(/\s+/);
      const numericValue = Number(value);
      return {
        name,
        value: Number.isFinite(numericValue) ? numericValue : value
      };
    });
}

function formatTimeRange(booking: Booking) {
  const start = format(new Date(booking.start), 'HH:mm');
  const end = format(new Date(booking.end), 'HH:mm');
  return `${start} – ${end}`;
}

function formatMetricValue(value: number | string): string {
  if (typeof value !== 'number') {
    return value;
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }
  if (Math.abs(value) >= 10_000_000_000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
      value
    );
  }
  const maximumFractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export default function App(): JSX.Element {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [discoveryForm, setDiscoveryForm] = useState(defaultDiscovery);
  const [bookingForm, setBookingForm] = useState(defaultBooking);
  const [waitlistForm, setWaitlistForm] = useState(defaultWaitlist);
  const [lastReset, setLastReset] = useState<ResetResponse | null>(null);
  const [newRestaurantForm, setNewRestaurantForm] = useState(createDefaultRestaurantForm());
  const [newTableForm, setNewTableForm] = useState(createDefaultTableForm());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error' | 'info'>('info');

  const activeNav = useMemo(
    () => NAV_ITEMS.find((item) => item.key === tab) ?? NAV_ITEMS[0],
    [tab]
  );

  const readableDate = useMemo(
    () => format(new Date(DEFAULT_DATE), "EEEE d 'de' MMMM yyyy"),
    []
  );

  function pushToast(message: string, tone: 'success' | 'error' | 'info' = 'info') {
    setToastMessage(message);
    setToastTone(tone);
  }

  const bookingsQuery = useQuery({
    queryKey: ['bookings', discoveryForm.restaurantId, discoveryForm.sectorId, DEFAULT_DATE],
    queryFn: async () =>
      (
        await ApiService.listBookings(
          DEFAULT_DATE,
          discoveryForm.restaurantId,
          discoveryForm.sectorId
        )
      ).data,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    staleTime: 0
  });

  const catalogQuery = useQuery({
    queryKey: ['settings', 'catalog'],
    queryFn: async () => (await ApiService.fetchCatalog()).data as CatalogSummary,
    refetchOnWindowFocus: false,
    staleTime: 0
  });

  const waitlistQuery = useQuery({
    queryKey: ['waitlist', discoveryForm.restaurantId, discoveryForm.sectorId],
    queryFn: async () =>
      (
        await ApiService.listWaitlist(
          discoveryForm.restaurantId,
          discoveryForm.sectorId
        )
      ).data,
    refetchInterval: 45_000,
    refetchOnReconnect: true,
    staleTime: 0
  });

  const metricsQuery = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => (await ApiService.metrics()).data as string,
    enabled: tab === 'metrics',
    refetchInterval: tab === 'metrics' ? 10_000 : false
  });

  const strategyQuery = useQuery({
    queryKey: ['settings', 'strategy'],
    queryFn: async () => (await ApiService.fetchStrategy()).data as StrategySummary,
    enabled: tab === 'settings',
    refetchOnWindowFocus: false,
    staleTime: 0
  });

  const restaurants = catalogQuery.data?.restaurants ?? [];
  const sectors = catalogQuery.data?.sectors ?? [];
  const tables = catalogQuery.data?.tables ?? [];

  const sectorsByRestaurant = useMemo(() => {
    const map: Record<string, SectorSummary[]> = {};
    for (const sector of sectors) {
      if (!map[sector.restaurantId]) {
        map[sector.restaurantId] = [];
      }
      map[sector.restaurantId].push(sector);
    }
    return map;
  }, [sectors]);

  useEffect(() => {
    if (!restaurants.length) {
      return;
    }

    const fallbackRestaurantId = restaurants[0].id;
    const ensureSelection = (restaurantId: string, sectorId: string) => {
      const validRestaurant = restaurants.some((restaurant) => restaurant.id === restaurantId)
        ? restaurantId
        : fallbackRestaurantId;
      const sectorsForRestaurant = sectorsByRestaurant[validRestaurant] ?? [];
      const validSector = sectorsForRestaurant.some((sector) => sector.id === sectorId)
        ? sectorId
        : sectorsForRestaurant[0]?.id ?? sectorId;
      return { restaurantId: validRestaurant, sectorId: validSector ?? sectorId };
    };

    setDiscoveryForm((current) => {
      const next = ensureSelection(current.restaurantId, current.sectorId);
      if (
        next.restaurantId === current.restaurantId &&
        (next.sectorId ?? current.sectorId) === current.sectorId
      ) {
        return current;
      }
      return { ...current, restaurantId: next.restaurantId, sectorId: next.sectorId ?? '' };
    });

    setBookingForm((current) => {
      const next = ensureSelection(current.restaurantId, current.sectorId);
      if (
        next.restaurantId === current.restaurantId &&
        (next.sectorId ?? current.sectorId) === current.sectorId
      ) {
        return current;
      }
      return { ...current, restaurantId: next.restaurantId, sectorId: next.sectorId ?? '' };
    });

    setWaitlistForm((current) => {
      const next = ensureSelection(current.restaurantId, current.sectorId);
      if (
        next.restaurantId === current.restaurantId &&
        (next.sectorId ?? current.sectorId) === current.sectorId
      ) {
        return current;
      }
      return { ...current, restaurantId: next.restaurantId, sectorId: next.sectorId ?? '' };
    });

    setNewTableForm((current) => {
      const next = ensureSelection(current.restaurantId, current.sectorId);
      if (
        (current.restaurantId || '') === next.restaurantId &&
        (current.sectorId || '') === (next.sectorId ?? '')
      ) {
        return current;
      }
      return {
        ...current,
        restaurantId: next.restaurantId,
        sectorId: next.sectorId ?? ''
      };
    });
  }, [restaurants, sectorsByRestaurant]);

  function resolveSectorId(restaurantId: string, preferredSectorId: string): string {
    const sectorsForRestaurant = sectorsByRestaurant[restaurantId] ?? [];
    if (sectorsForRestaurant.some((sector) => sector.id === preferredSectorId)) {
      return preferredSectorId;
    }
    return sectorsForRestaurant[0]?.id ?? '';
  }

  function applyRestaurantSelection(restaurantId: string): void {
    const discoverySector = resolveSectorId(restaurantId, discoveryForm.sectorId);
    const bookingSector = resolveSectorId(restaurantId, bookingForm.sectorId);
    const waitlistSector = resolveSectorId(restaurantId, waitlistForm.sectorId);
    const tableSector = resolveSectorId(restaurantId, newTableForm.sectorId);

    setDiscoveryForm((current) => ({ ...current, restaurantId, sectorId: discoverySector }));
    setBookingForm((current) => ({ ...current, restaurantId, sectorId: bookingSector }));
    setWaitlistForm((current) => ({ ...current, restaurantId, sectorId: waitlistSector }));
    setNewTableForm((current) => ({ ...current, restaurantId, sectorId: tableSector }));
  }

  function applySectorSelection(sectorId: string): void {
    setDiscoveryForm((current) => ({
      ...current,
      sectorId: resolveSectorId(current.restaurantId, sectorId)
    }));
    setBookingForm((current) => ({
      ...current,
      sectorId: resolveSectorId(current.restaurantId, sectorId)
    }));
    setWaitlistForm((current) => ({
      ...current,
      sectorId: resolveSectorId(current.restaurantId, sectorId)
    }));
    setNewTableForm((current) => ({
      ...current,
      sectorId: resolveSectorId(current.restaurantId, sectorId)
    }));
  }

  const discoveryMutation = useMutation({
    mutationFn: ApiService.discover,
    onSuccess: ({ data }) => {
      if (data.outcome === 'success' && data.candidate) {
        const { start } = data.candidate;
        setBookingForm((current) => ({
          ...current,
          start,
          partySize: discoveryForm.partySize
        }));
        pushToast('Found the best option. Complete the guest details to confirm.', 'success');
      } else {
        pushToast('No availability found for that request.', 'info');
      }
    },
    onError: () => pushToast('We could not search availability right now.', 'error')
  });

  const bookingMutation = useMutation({
    mutationFn: (payload: BookingPayload) => ApiService.createBooking(payload),
    onSuccess: ({ data }) => {
      pushToast(`Reservation confirmed for ${data.customerName}.`, 'success');
      queryClient.setQueryData<Booking[] | undefined>(
        ['bookings', discoveryForm.restaurantId, discoveryForm.sectorId, DEFAULT_DATE],
        (current) => (current ? [...current, data] : current)
      );
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => pushToast('The reservation could not be created.', 'error')
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approver }: { id: string; approver: string }) =>
      ApiService.approveBooking(id, approver),
    onSuccess: () => {
      pushToast('Reservation approved successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => pushToast('We could not approve the reservation.', 'error')
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ApiService.cancelBooking(id),
    onSuccess: () => {
      pushToast('Reservation cancelled.', 'info');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => pushToast('We could not cancel the reservation.', 'error')
  });

  const waitlistMutation = useMutation({
    mutationFn: ApiService.addToWaitlist,
    onSuccess: () => {
      pushToast('Guest added to the waitlist.', 'success');
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => pushToast('We could not add the guest to the waitlist.', 'error')
  });

  const repackMutation = useMutation({
    mutationFn: () =>
      ApiService.repack(
        DEFAULT_DATE,
        discoveryForm.restaurantId,
        discoveryForm.sectorId
      ),
    onSuccess: ({ data }) => {
      pushToast(`${data.moved} reservations were optimised.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => pushToast('No se pudo optimizar la distribución.', 'error')
  });

  const updateStrategyMutation = useMutation({
    mutationFn: (key: string) => ApiService.updateStrategy(key),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(['settings', 'strategy'], data);
      pushToast(`Capacity strategy switched to ${data.current.label}.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => pushToast('Unable to update the capacity strategy.', 'error')
  });

  const createRestaurantMutation = useMutation({
    mutationFn: ApiService.createRestaurant,
    onSuccess: ({ data }, variables) => {
      queryClient.setQueryData(['settings', 'catalog'], data);
      pushToast('Restaurant added successfully.', 'success');

      const newRestaurantId = variables?.id ?? '';
      const requestSectors = variables?.sectors ?? [];
      const newSectors = data.sectors.filter((sector) => sector.restaurantId === newRestaurantId);
      const primarySectorId =
        newSectors[0]?.id ?? requestSectors[0]?.id ?? `${newRestaurantId}-sector-main`;

      setNewRestaurantForm(createDefaultRestaurantForm());
      if (newRestaurantId) {
        setDiscoveryForm((current) => ({
          ...current,
          restaurantId: newRestaurantId,
          sectorId: primarySectorId
        }));
        setBookingForm((current) => ({
          ...current,
          restaurantId: newRestaurantId,
          sectorId: primarySectorId
        }));
        setWaitlistForm((current) => ({
          ...current,
          restaurantId: newRestaurantId,
          sectorId: primarySectorId
        }));
        setNewTableForm(createDefaultTableForm(newRestaurantId, primarySectorId));
      } else {
        setNewTableForm(createDefaultTableForm());
      }
    },
    onError: () => pushToast('Unable to create the restaurant.', 'error')
  });

  const createTableMutation = useMutation({
    mutationFn: ApiService.createTable,
    onSuccess: ({ data }, variables) => {
      queryClient.setQueryData(['settings', 'catalog'], data);
      pushToast('Table added successfully.', 'success');
      setNewTableForm(
        createDefaultTableForm(variables?.restaurantId ?? '', variables?.sectorId ?? '')
      );
    },
    onError: () => pushToast('Unable to create the table.', 'error')
  });

  const resetMutation = useMutation({
    mutationFn: ApiService.resetMemory,
    onSuccess: ({ data }) => {
      setLastReset(data);
      pushToast('Environment reset to defaults.', 'success');
      setDiscoveryForm(defaultDiscovery);
      setBookingForm(defaultBooking);
      setWaitlistForm(defaultWaitlist);
      setNewRestaurantForm(createDefaultRestaurantForm());
      setNewTableForm(createDefaultTableForm(DEFAULT_RESTAURANT_ID, DEFAULT_SECTOR_ID));
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'catalog'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'strategy'] });
    },
    onError: () => pushToast('Unable to reset the environment.', 'error')
  });

  const stats = useMemo(() => {
    const bookings = bookingsQuery.data ?? [];
    const confirmed = bookings.filter((b) => b.status === 'CONFIRMED').length;
    const pending = bookings.filter((b) => b.status === 'PENDING').length;
    const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
    const capacityUsed = bookings.reduce((total, booking) => total + booking.partySize, 0);
    return {
      total: bookings.length,
      confirmed,
      pending,
      cancelled,
      waitlist: waitlistQuery.data?.length ?? 0,
      capacityUsed
    };
  }, [bookingsQuery.data, waitlistQuery.data]);

  function handleDiscoverySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    discoveryMutation.mutate(discoveryForm);
  }

  function handleBookingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    bookingMutation.mutate(bookingForm);
  }

  function handleWaitlistSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    waitlistMutation.mutate(waitlistForm);
  }

  function renderDashboard(): JSX.Element {
    const latestPending = (bookingsQuery.data ?? []).find((booking) => booking.status === 'PENDING');

    return (
      <>
        <Section
          title="Today’s occupancy snapshot"
          description="WokiBrain keeps confirmations, pending approvals, and waitlist activity in sync."
          headerAction={
            <button
              className="btn btn-muted"
              type="button"
              onClick={() => bookingsQuery.refetch()}
            >
              Refresh data
            </button>
          }
        >
          <div className="pill-group">
            <div className="pill">
              <span>Total reservations</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="pill">
              <span>Confirmed</span>
              <strong>{stats.confirmed}</strong>
            </div>
            <div className="pill">
              <span>Pending approval</span>
              <strong>{stats.pending}</strong>
            </div>
            <div className="pill">
              <span>Waitlist</span>
              <strong>{stats.waitlist}</strong>
            </div>
            <div className="pill">
              <span>Covers seated</span>
              <strong>{stats.capacityUsed}</strong>
            </div>
          </div>
        </Section>

        <Section
          title="Next actions"
          description="Quick tools to keep the floor flowing."
          headerAction={
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => repackMutation.mutate()}
              disabled={repackMutation.isLoading}
            >
              {repackMutation.isLoading ? 'Optimising…' : 'Optimise seating'}
            </button>
          }
        >
          <div className="insight-cards">
            <article className="insight-card">
              <p className="insight-eyebrow">Pending approval</p>
              {latestPending ? (
                <>
                  <h3 className="insight-title">{latestPending.customerName}</h3>
                  <p className="insight-body">
                    Party of {latestPending.partySize} at {formatTimeRange(latestPending)}. Tap
                    approve once you have the go-ahead.
                  </p>
                  <div className="actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() =>
                        approveMutation.mutate({ id: latestPending.id, approver: 'Manager' })
                      }
                    >
                      Approve now
                    </button>
                    <button
                      className="btn btn-muted"
                      type="button"
                      onClick={() => cancelMutation.mutate(latestPending.id)}
                    >
                      Cancel slot
                    </button>
                  </div>
                </>
              ) : (
                <p className="insight-body">All caught up. No pending approvals right now.</p>
              )}
            </article>

            <article className="insight-card accent">
              <p className="insight-eyebrow">Auto-promotion</p>
              <h3 className="insight-title">WokiBrain handles the queue</h3>
              <p className="insight-body">
                Waitlist entries are scanned every five minutes. You will see successful promotions
                and conflicts right here.
              </p>
              <span className="insight-footnote">
                Last synced {waitlistQuery.isFetching ? 'just now…' : 'moments ago'}.
              </span>
            </article>
          </div>
        </Section>

        <Section
          title="Today’s timeline"
          description="A curated view of every reservation in chronological order."
        >
          <div className="booking-list">
            {(bookingsQuery.data ?? []).length === 0 ? (
              <div className="empty-state">
                No reservations yet. Use “Smart discovery” to create the first one.
              </div>
            ) : (
              bookingsQuery.data?.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onApprove={(b) => approveMutation.mutate({ id: b.id, approver: 'Manager' })}
                  onCancel={(b) => cancelMutation.mutate(b.id)}
                />
              ))
            )}
          </div>
        </Section>
      </>
    );
  }

  function renderDiscover(): JSX.Element {
    const discoverySectors = sectorsByRestaurant[discoveryForm.restaurantId] ?? [];
    const catalogLoaded = restaurants.length > 0;

    return (
      <>
        <Section
          title="Search availability"
          description="Tell WokiBrain who is visiting and we will pinpoint the best option."
        >
          <form className="form-grid" onSubmit={handleDiscoverySubmit}>
            <div className="grid-two">
              <div className="field">
                <label>Restaurant</label>
                <select
                  className="control"
                  value={discoveryForm.restaurantId}
                  disabled={!catalogLoaded}
                  onChange={(event) => {
                    applyRestaurantSelection(event.target.value);
                  }}
                >
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name} ({restaurant.id})
                    </option>
                  ))}
                </select>
                <p className="help">
                  Choose which venue to run the availability search against.
                </p>
              </div>
              <div className="field">
                <label>Sector</label>
                <select
                  className="control"
                  value={discoveryForm.sectorId}
                  disabled={!catalogLoaded || !discoverySectors.length}
                  onChange={(event) => applySectorSelection(event.target.value)}
                >
                  {discoverySectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name} ({sector.id})
                    </option>
                  ))}
                </select>
                <p className="help">Sectors update automatically when you switch restaurants.</p>
              </div>
            </div>
            <div className="grid-two">
              <div className="field">
                <label>Party size</label>
                <input
                  type="number"
                  min={1}
                  className="control"
                  value={discoveryForm.partySize}
                  onChange={(event) =>
                    setDiscoveryForm((current) => ({
                      ...current,
                      partySize: Number(event.target.value)
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min={60}
                  className="control"
                  value={discoveryForm.durationMinutes ?? ''}
                  onChange={(event) =>
                    setDiscoveryForm((current) => ({
                      ...current,
                      durationMinutes: event.target.value
                        ? Number(event.target.value)
                        : undefined
                    }))
                  }
                  placeholder="Automatic"
                />
              </div>
            </div>
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                className="control"
                value={discoveryForm.date}
                onChange={(event) =>
                  setDiscoveryForm((current) => ({
                    ...current,
                    date: event.target.value
                  }))
                }
              />
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={discoveryMutation.isLoading}>
                {discoveryMutation.isLoading ? 'Searching…' : 'Find availability'}
              </button>
            </div>
          </form>
        </Section>

        {discoveryMutation.data?.data.candidate ? (
          <Section
            title="Suggested option"
            description="Feel free to tweak the inputs before confirming the booking."
          >
            <div className="insight-card">
              <p className="insight-eyebrow">Recommended slot</p>
              <h3 className="insight-title">
                {new Date(discoveryMutation.data.data.candidate.start).toLocaleString()}
              </h3>
              <p className="insight-body">
                Tables {discoveryMutation.data.data.candidate.tableIds.join(', ')} • Capacity{' '}
                {discoveryMutation.data.data.candidate.capacity.min}–
                {discoveryMutation.data.data.candidate.capacity.max}
              </p>
            </div>
          </Section>
        ) : null}

        <Section
          title="Confirm reservation"
          description="Turn the suggestion into a live reservation by adding the guest details."
        >
          <form className="form-grid" onSubmit={handleBookingSubmit}>
            <div className="grid-two">
              <div className="field">
                <label>Guest name</label>
                <input
                  className="control"
                  value={bookingForm.customerName}
                  onChange={(event) =>
                    setBookingForm((current) => ({
                      ...current,
                      customerName: event.target.value
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Contact (optional)</label>
                <input
                  className="control"
                  value={bookingForm.customerContact ?? ''}
                  onChange={(event) =>
                    setBookingForm((current) => ({
                      ...current,
                      customerContact: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid-two">
              <div className="field">
                <label>Party size</label>
                <input
                  type="number"
                  className="control"
                  min={1}
                  value={bookingForm.partySize}
                  onChange={(event) =>
                    setBookingForm((current) => ({
                      ...current,
                      partySize: Number(event.target.value)
                    }))
                  }
                />
              </div>
              <DateTimeField
                id="booking-start"
                label="Start"
                value={bookingForm.start}
                onChange={(iso) =>
                  setBookingForm((current) => ({
                    ...current,
                    start: iso
                  }))
                }
                help="Pick the arrival date and time for the reservation."
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea
                className="control"
                rows={3}
                value={bookingForm.notes ?? ''}
                onChange={(event) =>
                  setBookingForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={bookingMutation.isLoading}>
                {bookingMutation.isLoading ? 'Saving…' : 'Create reservation'}
              </button>
            </div>
          </form>
        </Section>
      </>
    );
  }

  function renderBookings(): JSX.Element {
    return (
      <Section
        title="Reservations timeline"
        description="Every reservation for the selected day, including pending approvals."
        headerAction={
          <button className="btn btn-muted" onClick={() => bookingsQuery.refetch()}>
            Refresh
          </button>
        }
      >
        <div className="booking-list">
          {(bookingsQuery.data ?? []).length === 0 ? (
            <div className="empty-state">No reservations for this date yet.</div>
          ) : (
            bookingsQuery.data?.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onApprove={(b) => approveMutation.mutate({ id: b.id, approver: 'Manager' })}
                onCancel={(b) => cancelMutation.mutate(b.id)}
              />
            ))
          )}
        </div>
      </Section>
    );
  }

  function renderWaitlist(): JSX.Element {
    const waitlistEntries = waitlistQuery.data ?? [];

    return (
      <>
        <Section
          title="Register a guest"
          description="Collect their details so WokiBrain can auto-promote as soon as a gap appears."
        >
          <form className="form-grid" onSubmit={handleWaitlistSubmit}>
            <div className="grid-two">
              <div className="field">
                <label>Guest name</label>
                <input
                  className="control"
                  value={waitlistForm.customerName}
                  onChange={(event) =>
                    setWaitlistForm((current) => ({
                      ...current,
                      customerName: event.target.value
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Contact (optional)</label>
                <input
                  className="control"
                  value={waitlistForm.customerContact}
                  onChange={(event) =>
                    setWaitlistForm((current) => ({
                      ...current,
                      customerContact: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid-two">
              <div className="field">
                <label>Party size</label>
                <input
                  type="number"
                  min={1}
                  className="control"
                  value={waitlistForm.partySize}
                  onChange={(event) =>
                    setWaitlistForm((current) => ({
                      ...current,
                      partySize: Number(event.target.value)
                    }))
                  }
                />
              </div>
              <DateTimeField
                id="waitlist-desired"
                label="Preferred time"
                value={waitlistForm.desiredTime}
                onChange={(iso) =>
                  setWaitlistForm((current) => ({
                    ...current,
                    desiredTime: iso
                  }))
                }
                help="Optional: let us know when the guest would love to dine."
              />
            </div>
            <div className="field">
              <label>Internal notes</label>
              <textarea
                className="control"
                rows={3}
                value={waitlistForm.notes}
                onChange={(event) =>
                  setWaitlistForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={waitlistMutation.isLoading}>
                {waitlistMutation.isLoading ? 'Adding…' : 'Add to waitlist'}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Live queue"
          description="Entries are automatically promoted as capacity appears."
        >
          <div className="waitlist-list">
            {waitlistEntries.length === 0 ? (
              <div className="empty-state">The waitlist is currently empty.</div>
            ) : (
              waitlistEntries.map((entry) => (
                <article className="waitlist-card" key={entry.id}>
                  <header>
                    <strong>{entry.customerName}</strong>
                    <span className={`status-chip ${entry.status.toLowerCase()}`}>
                      {WAITLIST_STATUS_COPY[entry.status]}
                    </span>
                  </header>
                  <p className="help">
                    Party of {entry.partySize}{' '}
                    {entry.desiredTime
                      ? `• prefers ${new Date(entry.desiredTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`
                      : ''}
                  </p>
                  <p className="help">
                    Requested {new Date(entry.requestedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    , expires{' '}
                    {new Date(entry.expiresAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {entry.notes ? <p className="help">{entry.notes}</p> : null}
                </article>
              ))
            )}
          </div>
        </Section>
      </>
    );
  }

  function renderMetrics(): JSX.Element {
    const metrics = parsePrometheusPayload(metricsQuery.data);

    return (
      <Section
        title="Prometheus feed"
        description="Fast visual cues plus the raw text payload for integrations."
        headerAction={
          <button className="btn btn-muted" onClick={() => metricsQuery.refetch()}>
            Refresh
          </button>
        }
      >
        {metricsQuery.isLoading ? (
          <div className="empty-state">Loading metrics…</div>
        ) : (
          <>
            <div className="metric-grid">
              {metrics.map((metric) => (
                <div key={metric.name} className="metric-card">
                  <span className="help" title={metric.name}>
                    {metric.name}
                  </span>
                  <strong title={String(metric.value)}>
                    {formatMetricValue(metric.value)}
                  </strong>
                </div>
              ))}
            </div>
            <pre className="metrics-raw" aria-label="Prometheus raw payload">
              {metricsQuery.data}
            </pre>
          </>
        )}
      </Section>
    );
  }

  function renderSettings(): JSX.Element {
    const lastResetTimestamp = lastReset
      ? new Date(lastReset.timestamp).toLocaleString()
      : null;
    const strategySummary = strategyQuery.data;
    const strategyOptions = strategySummary?.available ?? [];
    const currentStrategyKey = strategySummary?.current.key ?? '';
    const currentStrategyDescription = strategySummary?.current.description ?? '';
    const isStrategyLoading = strategyQuery.isLoading && !strategySummary;

    return (
      <>
        <Section
          title="Capacity heuristic"
          description="Choose how WokiBrain merges table capacity when suggesting availability."
        >
          {isStrategyLoading ? (
            <div className="empty-state">Loading strategy options…</div>
          ) : strategySummary ? (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="strategy-select">Active strategy</label>
                <select
                  id="strategy-select"
                  className="control"
                  value={currentStrategyKey}
                  disabled={updateStrategyMutation.isLoading}
                  onChange={(event) => {
                    const selected = event.target.value;
                    if (!strategySummary || selected === strategySummary.current.key) {
                      return;
                    }
                    updateStrategyMutation.mutate(selected);
                  }}
                >
                  {strategyOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {currentStrategyDescription ? (
                  <p className="help">{currentStrategyDescription}</p>
                ) : null}
              </div>
              <div className="field">
                <label>What happens?</label>
                <p className="help">
                  WokiBrain immediately applies the selection to new discovery runs, repacks, and
                  waitlist auto-promotions.
                </p>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Could not load strategy information right now. Try refreshing the page.
            </div>
          )}
        </Section>

        <Section
          title="Add restaurant"
          description="Register a new venue and, optionally, its primary sector."
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedId = newRestaurantForm.id.trim();
              const trimmedName = newRestaurantForm.name.trim();
              if (!trimmedId || !trimmedName) {
                pushToast('Provide both restaurant ID and name.', 'error');
                return;
              }

              const timezone = newRestaurantForm.timezone.trim() || 'UTC';
              const baseSectorId = `${trimmedId}-sector-main`;

              const sectorsPayload = newRestaurantForm.sectors
                .map((sector, index) => {
                  const id = sector.id.trim() || (index === 0 ? baseSectorId : '');
                  const name = sector.name.trim() || (index === 0 ? 'Main Dining' : '');
                  return { id, name };
                })
                .filter((sector) => sector.id && sector.name);

              if (!sectorsPayload.length) {
                pushToast('Add at least one sector with id and name.', 'error');
                return;
              }

              const sectorIds = new Set<string>();
              for (const sector of sectorsPayload) {
                const key = sector.id.toLowerCase();
                if (sectorIds.has(key)) {
                  pushToast('Sector IDs must be unique.', 'error');
                  return;
                }
                sectorIds.add(key);
              }

              let invalidWindow = false;
              const serviceWindowsPayload = newRestaurantForm.serviceWindows.reduce(
                (acc, window) => {
                  const start = window.startTime.trim();
                  const end = window.endTime.trim();
                  if (!start && !end) {
                    return acc;
                  }
                  if (!start || !end) {
                    invalidWindow = true;
                    return acc;
                  }
                  acc.push({
                    day: window.day,
                    windows: [{ startTime: start, endTime: end }]
                  });
                  return acc;
                },
                [] as Array<{ day: number; windows: { startTime: string; endTime: string }[] }>
              );

              if (invalidWindow) {
                pushToast('Service windows require both start and end time.', 'error');
                return;
              }

              createRestaurantMutation.mutate({
                id: trimmedId,
                name: trimmedName,
                timezone,
                sectors: sectorsPayload,
                serviceWindows: serviceWindowsPayload
              });
            }}
          >
            <div className="grid-two">
              <div className="field">
                <label>Restaurant ID</label>
                <input
                  className="control"
                  value={newRestaurantForm.id}
                  onChange={(event) =>
                    setNewRestaurantForm((current) => ({
                      ...current,
                      id: event.target.value
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Name</label>
                <input
                  className="control"
                  value={newRestaurantForm.name}
                  onChange={(event) =>
                    setNewRestaurantForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid-two">
              <div className="field">
                <label>Timezone</label>
                <input
                  className="control"
                  value={newRestaurantForm.timezone}
                  onChange={(event) =>
                    setNewRestaurantForm((current) => ({
                      ...current,
                      timezone: event.target.value
                    }))
                  }
                />
                <p className="help">Any IANA timezone string, defaults to UTC.</p>
              </div>
            </div>

            <div className="field">
              <label>Sectors</label>
              <div className="sector-list">
                {newRestaurantForm.sectors.map((sector, index) => (
                  <div key={`sector-${index}`} className="sector-row">
                    <div className="field">
                      <label>ID</label>
                      <input
                        className="control"
                        value={sector.id}
                        onChange={(event) =>
                          setNewRestaurantForm((current) => ({
                            ...current,
                            sectors: current.sectors.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, id: event.target.value } : entry
                            )
                          }))
                        }
                        placeholder={index === 0 ? `${newRestaurantForm.id || 'resto'}-sector-main` : ''}
                      />
                    </div>
                    <div className="field">
                      <label>Name</label>
                      <input
                        className="control"
                        value={sector.name}
                        onChange={(event) =>
                          setNewRestaurantForm((current) => ({
                            ...current,
                            sectors: current.sectors.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, name: event.target.value } : entry
                            )
                          }))
                        }
                        placeholder={index === 0 ? 'Main Dining' : ''}
                      />
                    </div>
                    {newRestaurantForm.sectors.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-muted sector-remove"
                        onClick={() =>
                          setNewRestaurantForm((current) => ({
                            ...current,
                            sectors: current.sectors.filter((_, entryIndex) => entryIndex !== index)
                          }))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-muted"
                onClick={() =>
                  setNewRestaurantForm((current) => ({
                    ...current,
                    sectors: [...current.sectors, { id: '', name: '' }]
                  }))
                }
              >
                Add sector
              </button>
              <p className="help">
                Define as many sectors as needed. Leave the ID empty on the first row to auto-generate
                a `-sector-main` identifier.
              </p>
            </div>

            <div className="field">
              <label>Weekly service windows</label>
              <div className="service-schedule">
                {newRestaurantForm.serviceWindows.map((window) => (
                  <div key={window.day} className="service-row">
                    <span className="service-day">{WEEKDAY_LABELS[window.day]}</span>
                    <input
                      type="time"
                      className="control"
                      value={window.startTime}
                      onChange={(event) =>
                        setNewRestaurantForm((current) => ({
                          ...current,
                          serviceWindows: current.serviceWindows.map((entry) =>
                            entry.day === window.day
                              ? { ...entry, startTime: event.target.value }
                              : entry
                          )
                        }))
                      }
                    />
                    <input
                      type="time"
                      className="control"
                      value={window.endTime}
                      onChange={(event) =>
                        setNewRestaurantForm((current) => ({
                          ...current,
                          serviceWindows: current.serviceWindows.map((entry) =>
                            entry.day === window.day
                              ? { ...entry, endTime: event.target.value }
                              : entry
                          )
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="help">
                Set opening hours per weekday (HH:mm). Leave blank to keep the default schedule or
                provide both fields to override a day.
              </p>
            </div>

            <div className="actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={createRestaurantMutation.isLoading}
              >
                {createRestaurantMutation.isLoading ? 'Saving…' : 'Add restaurant'}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Add table"
          description="Extend an existing sector with additional seating."
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedId = newTableForm.id.trim();
              const trimmedLabel = newTableForm.label.trim();
              if (!trimmedId || !trimmedLabel || !newTableForm.restaurantId || !newTableForm.sectorId) {
                pushToast('Provide table ID, label, restaurant, and sector.', 'error');
                return;
              }
              const combinableWith = newTableForm.combinableWith
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
              createTableMutation.mutate({
                id: trimmedId,
                restaurantId: newTableForm.restaurantId,
                sectorId: newTableForm.sectorId,
                label: trimmedLabel,
                minCapacity: newTableForm.minCapacity,
                maxCapacity: newTableForm.maxCapacity,
                combinableWith
              });
            }}
          >
            <div className="grid-two">
              <div className="field">
                <label>Table ID</label>
                <input
                  className="control"
                  value={newTableForm.id}
                  onChange={(event) =>
                    setNewTableForm((current) => ({
                      ...current,
                      id: event.target.value
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Label</label>
                <input
                  className="control"
                  value={newTableForm.label}
                  onChange={(event) =>
                    setNewTableForm((current) => ({
                      ...current,
                      label: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid-two">
              <div className="field">
                <label>Restaurant</label>
                <select
                  className="control"
                  value={newTableForm.restaurantId}
                  onChange={(event) => {
                    const restaurantId = event.target.value;
                    const sectorId = resolveSectorId(restaurantId, newTableForm.sectorId);
                    setNewTableForm((current) => ({
                      ...current,
                      restaurantId,
                      sectorId
                    }));
                  }}
                >
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name} ({restaurant.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Sector</label>
                <select
                  className="control"
                  value={newTableForm.sectorId}
                  onChange={(event) =>
                    setNewTableForm((current) => ({
                      ...current,
                      sectorId: event.target.value
                    }))
                  }
                >
                  {(sectorsByRestaurant[newTableForm.restaurantId] ?? []).map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name} ({sector.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-two">
              <div className="field">
                <label>Min capacity</label>
                <input
                  type="number"
                  min={1}
                  className="control"
                  value={newTableForm.minCapacity}
                  onChange={(event) =>
                    setNewTableForm((current) => ({
                      ...current,
                      minCapacity: Number(event.target.value)
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Max capacity</label>
                <input
                  type="number"
                  min={1}
                  className="control"
                  value={newTableForm.maxCapacity}
                  onChange={(event) =>
                    setNewTableForm((current) => ({
                      ...current,
                      maxCapacity: Number(event.target.value)
                    }))
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>Combinable with</label>
              <input
                className="control"
                value={newTableForm.combinableWith}
                onChange={(event) =>
                  setNewTableForm((current) => ({
                    ...current,
                    combinableWith: event.target.value
                  }))
                }
                placeholder="Comma separated table IDs"
              />
              <p className="help">Optional: list existing table IDs to link for combos.</p>
            </div>
            <div className="actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={createTableMutation.isLoading || !restaurants.length}
              >
                {createTableMutation.isLoading ? 'Saving…' : 'Add table'}
              </button>
            </div>
          </form>
        </Section>

        <Section
          title="Reset demo data"
          description="Purge bookings, waitlist entries, locks, and idempotency caches to start from a clean slate."
        >
          <article className="insight-card accent">
            <p className="insight-eyebrow">One-click maintenance</p>
            <h3 className="insight-title">Restore the original seed dataset</h3>
            <p className="insight-body">
              Useful for demos or testing scenarios where you want to roll back to the exact state
              the engine ships with.
            </p>
            <div className="actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isLoading}
              >
                {resetMutation.isLoading ? 'Resetting…' : 'Reset memory'}
              </button>
              <button
                className="btn btn-muted"
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['bookings'] });
                  queryClient.invalidateQueries({ queryKey: ['waitlist'] });
                  queryClient.invalidateQueries({ queryKey: ['metrics'] });
                }}
              >
                Refresh data
              </button>
            </div>
            <p className="last-reset">
              {lastResetTimestamp
                ? `Last reset at ${lastResetTimestamp} • ${lastReset.seededTables} tables reloaded`
                : 'No manual resets yet in this session.'}
            </p>
          </article>
        </Section>

        <Section
          title="What gets restored?"
          description="Every reset reinstalls the deterministic dataset used across tests and documentation."
        >
          <div className="metric-grid">
            <div className="metric-card">
              <span className="help">Restaurants</span>
              <strong>{lastReset?.seededRestaurants ?? 1}</strong>
            </div>
            <div className="metric-card">
              <span className="help">Sectors</span>
              <strong>{lastReset?.seededSectors ?? 1}</strong>
            </div>
            <div className="metric-card">
              <span className="help">Tables</span>
              <strong>{lastReset?.seededTables ?? 3}</strong>
            </div>
          </div>
        </Section>
      </>
    );
  }

  function renderContent(): JSX.Element {
    switch (tab) {
      case 'dashboard':
        return renderDashboard();
      case 'discover':
        return renderDiscover();
      case 'bookings':
        return renderBookings();
      case 'waitlist':
        return renderWaitlist();
      case 'metrics':
        return renderMetrics();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🧠</span>
          <div>
            <strong>WokiBrain</strong>
            <p>Restaurant booking intelligence</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${item.key === tab ? 'active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              <span className="nav-icon" aria-hidden>{item.icon}</span>
              <div>
                <span className="nav-label">{item.label}</span>
                <span className="nav-description">{item.description}</span>
              </div>
            </button>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <p className="eyebrow">Today</p>
          <strong>{readableDate}</strong>
          <p className="sidebar-footnote">
            Engine status: <span className="status-chip confirmed">Online</span>
          </p>
        </footer>
      </aside>

      <div className="app-content">
        <header className="content-header">
          <div>
            <p className="eyebrow">Live service</p>
            <h1>{activeNav.label}</h1>
            <p className="header-summary">{activeNav.description}</p>
          </div>
          <div className="header-pills">
            <div className="pill">
              <span>Reservations</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="pill">
              <span>Pending</span>
              <strong>{stats.pending}</strong>
            </div>
            <div className="pill">
              <span>Waitlist</span>
              <strong>{stats.waitlist}</strong>
            </div>
          </div>
        </header>

        <main className="content-body">{renderContent()}</main>
      </div>

      <Toast message={toastMessage} tone={toastTone} onClear={() => setToastMessage(null)} />
    </div>
  );
}
