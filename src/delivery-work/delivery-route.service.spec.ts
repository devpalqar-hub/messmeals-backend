import { DeliveryStatus, VariationStatus } from '@prisma/client';
import { DeliveryRouteService, RouteScope } from './delivery-route.service';
import { RouteOptimizerService } from './route-optimizer.service';

type Row = {
  deliveryId: string;
  status: VariationStatus;
  deliveryStatus: DeliveryStatus | null;
  latLng: string;
};

/** Minimal in-memory stand-in for the Prisma calls DeliveryRouteService makes. */
function setup(initial: Row[]) {
  let rows = initial;
  let plan: any = null;

  const prisma: any = {
    deliveryRoutePlan: {
      findUnique: jest.fn(async () => plan),
      findUniqueOrThrow: jest.fn(async () => plan),
    },
    deliveryVariation: {
      findMany: jest.fn(async () =>
        rows.map((r) => ({
          id: `dv-${r.deliveryId}`,
          status: r.status,
          deliveryId: r.deliveryId,
          delivery: {
            status: r.deliveryStatus,
            customer: { latitude_logitude: r.latLng },
          },
        })),
      ),
    },
    mess: {
      findUnique: jest.fn(async () => ({ latitude: '8.5', logitude: '76.95' })),
    },
    $transaction: jest.fn(async (fn: any) => {
      let pending: any = null;
      const tx = {
        deliveryRoutePlan: {
          upsert: jest.fn(async ({ create, update }: any) => {
            pending = {
              id: 'plan-1',
              ...(plan ?? create),
              ...update,
              stops: [],
            };
            return { id: 'plan-1' };
          }),
        },
        deliveryRouteStop: {
          deleteMany: jest.fn(async () => undefined),
          createMany: jest.fn(async ({ data }: any) => {
            pending.stops = data;
          }),
        },
      };
      const id = await fn(tx);
      plan = pending;
      return id;
    }),
  };

  const optimizer = new RouteOptimizerService();
  const optimizeSpy = jest.spyOn(optimizer, 'optimize');
  const svc = new DeliveryRouteService(prisma, optimizer);
  return {
    svc,
    optimizeSpy,
    setRows: (r: Row[]) => (rows = r),
    getRows: () => rows,
  };
}

const scope: RouteScope = {
  messId: 'm1',
  partnerId: 'p1',
  variationId: 'v1',
  date: new Date('2026-11-20T00:00:00.000Z'),
};
const row = (
  id: string,
  dLat: number,
  status: VariationStatus = 'PENDING',
): Row => ({
  deliveryId: id,
  status,
  deliveryStatus: 'PENDING',
  latLng: `${8.5 + dLat},76.95`,
});

describe('DeliveryRouteService — when a route is re-optimised', () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;
  beforeAll(() => delete process.env.GOOGLE_MAPS_API_KEY);
  afterAll(() => (process.env.GOOGLE_MAPS_API_KEY = originalKey));

  it('optimises once, then reuses the stored route while nothing changes', async () => {
    const t = setup([row('a', 0.01), row('b', 0.02)]);
    await t.svc.ensureFresh(scope);
    await t.svc.ensureFresh(scope);
    await t.svc.ensureFresh(scope);
    expect(t.optimizeSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-route when stops are marked DELIVERED / UNDELIVERED', async () => {
    const t = setup([row('a', 0.01), row('b', 0.02), row('c', 0.03)]);
    await t.svc.ensureFresh(scope);
    t.setRows([
      row('a', 0.01, 'DELIVERED'),
      row('b', 0.02, 'UNDELIVERED'),
      row('c', 0.03),
    ]);
    await t.svc.ensureFresh(scope);
    expect(t.optimizeSpy).toHaveBeenCalledTimes(1);
  });

  it('re-routes when a new order is added to the route', async () => {
    const t = setup([row('a', 0.01)]);
    await t.svc.ensureFresh(scope);
    t.setRows([...t.getRows(), row('new', 0.02)]);
    const plan = await t.svc.ensureFresh(scope);
    expect(t.optimizeSpy).toHaveBeenCalledTimes(2);
    expect(plan.stops.map((s) => s.deliveryId)).toEqual(['a', 'new']);
  });

  it('re-routes when an order leaves the route (transfer / ended / paused)', async () => {
    const t = setup([row('a', 0.01), row('b', 0.02)]);
    await t.svc.ensureFresh(scope);
    t.setRows([row('b', 0.02)]);
    const plan = await t.svc.ensureFresh(scope);
    expect(t.optimizeSpy).toHaveBeenCalledTimes(2);
    expect(plan.stops.map((s) => s.deliveryId)).toEqual(['b']);
  });

  it('re-routes on a partner CANCELLED and on an admin whole-delivery cancel', async () => {
    const t = setup([row('a', 0.01), row('b', 0.02), row('c', 0.03)]);
    await t.svc.ensureFresh(scope);

    t.setRows([row('a', 0.01), row('b', 0.02, 'CANCELLED'), row('c', 0.03)]);
    const plan = await t.svc.ensureFresh(scope);
    expect(t.optimizeSpy).toHaveBeenCalledTimes(2);
    // Cancelled stop moves out of the way; pending stops re-sorted after it.
    expect(plan.stops.map((s) => s.deliveryId)).toEqual(['b', 'a', 'c']);

    t.setRows([
      { ...row('a', 0.01), deliveryStatus: 'CANCELLED' },
      row('b', 0.02, 'CANCELLED'),
      row('c', 0.03),
    ]);
    await t.svc.ensureFresh(scope);
    expect(t.optimizeSpy).toHaveBeenCalledTimes(3);
  });

  it('keeps delivered stops in place and re-sorts only pending ones', async () => {
    const t = setup([row('a', 0.01), row('b', 0.02), row('c', 0.03)]);
    await t.svc.ensureFresh(scope);
    t.setRows([
      row('a', 0.01, 'DELIVERED'),
      row('b', 0.02),
      row('c', 0.03),
      row('d', 0.015),
    ]);
    const plan = await t.svc.ensureFresh(scope);
    expect(plan.stops[0].deliveryId).toBe('a');
    // Re-optimised from 'a' (last visited): d (0.015) is next, then b, c.
    expect(plan.stops.map((s) => s.deliveryId)).toEqual(['a', 'd', 'b', 'c']);
    expect(t.optimizeSpy.mock.calls[1][0]).toEqual({ lat: 8.51, lng: 76.95 });
  });
});
