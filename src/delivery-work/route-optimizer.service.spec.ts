import axios from 'axios';
import { RouteProvider } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RouteOptimizerService } from './route-optimizer.service';
import { parseDay, parseLatLng } from './geo.util';
import { DeliveryWorkModule } from './delivery-work.module';
import { DeliveryWorkService } from './delivery-work.service';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    __esModule: true,
    ...actual,
    default: { ...actual.default, post: jest.fn() },
  };
});
const mockedPost = axios.post as jest.Mock;

// A mess in Thiruvananthapuram and stops laid out roughly along a line going north,
// given in scrambled order.
const MESS = { lat: 8.5, lng: 76.95 };
const stop = (id: string, dLat: number) => ({
  id,
  lat: 8.5 + dLat,
  lng: 76.95,
});
const SCRAMBLED = [
  stop('c', 0.03),
  stop('a', 0.01),
  stop('e', 0.05),
  stop('b', 0.02),
  stop('d', 0.04),
];

describe('geo.util', () => {
  it('parses plain pairs, map links and rejects junk', () => {
    expect(parseLatLng('8.5241, 76.9366')).toEqual({
      lat: 8.5241,
      lng: 76.9366,
    });
    expect(parseLatLng('https://maps.google.com/?q=8.5241,76.9366')).toEqual({
      lat: 8.5241,
      lng: 76.9366,
    });
    expect(
      parseLatLng('https://www.google.com/maps/place/X/@8.5241,76.9366,17z'),
    ).toEqual({ lat: 8.5241, lng: 76.9366 });
    expect(parseLatLng('0,0')).toBeNull();
    expect(parseLatLng('near the temple')).toBeNull();
    expect(parseLatLng(null)).toBeNull();
  });

  it('parses days as UTC midnight', () => {
    expect(parseDay('2026-11-20').toISOString()).toBe(
      '2026-11-20T00:00:00.000Z',
    );
    expect(() => parseDay('nope')).toThrow();
  });
});

describe('RouteOptimizerService', () => {
  const svc = new RouteOptimizerService();
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  afterEach(() => {
    mockedPost.mockReset();
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it('orders stops by the local heuristic when no API key is set', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const r = await svc.optimize(MESS, SCRAMBLED);
    expect(r.order).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(r.provider).toBe(RouteProvider.HEURISTIC);
    expect(r.totalDistanceMeters).toBeGreaterThan(0);
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('2-opt removes a crossing that nearest-neighbour leaves in', () => {
    // NN from origin picks p1 then jumps around; 2-opt should give a non-crossing path.
    const pts = [
      { id: 'p1', lat: 0, lng: 1 },
      { id: 'p2', lat: 1, lng: 2 },
      { id: 'p3', lat: 0, lng: 2.1 },
      { id: 'p4', lat: 1, lng: 1.1 },
    ];
    const order = svc.heuristicOrder({ lat: 0, lng: 0 }, pts);
    const len = (o: typeof pts) =>
      o.reduce(
        (t, p, i) =>
          t +
          Math.hypot(
            p.lat - (i ? o[i - 1].lat : 0),
            p.lng - (i ? o[i - 1].lng : 0),
          ),
        0,
      );
    expect(len(order)).toBeLessThanOrEqual(len(pts) + 1e-9);
  });

  it('uses Google Routes (TWO_WHEELER) order, legs and polyline when available', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    mockedPost.mockImplementation((_url, body: any) => {
      const n = body.intermediates.length;
      // Pretend Google prefers the reverse of the intermediates it was given.
      return Promise.resolve({
        data: {
          routes: [
            {
              optimizedIntermediateWaypointIndex: [
                ...Array(n).keys(),
              ].reverse(),
              legs: Array.from({ length: n + 1 }, (_, i) => ({
                distanceMeters: 1000 + i,
                duration: `${60 + i}s`,
              })),
              polyline: { encodedPolyline: 'abc' },
            },
          ],
        },
      });
    });

    const r = await svc.optimize(MESS, SCRAMBLED);
    const body = mockedPost.mock.calls[0][1];
    expect(body.travelMode).toBe('TWO_WHEELER');
    expect(body.optimizeWaypointOrder).toBe(true);
    expect(mockedPost.mock.calls[0][2].headers['X-Goog-FieldMask']).toContain(
      'optimizedIntermediateWaypointIndex',
    );
    // Heuristic gave a,b,c,d,e → intermediates a..d reversed, destination e fixed.
    expect(r.order).toEqual(['d', 'c', 'b', 'a', 'e']);
    expect(r.provider).toBe(RouteProvider.GOOGLE);
    expect(r.polylines).toEqual(['abc']);
    expect(r.legs.get('d')).toEqual({
      distanceMeters: 1000,
      durationSeconds: 60,
    });
    expect(r.totalDurationSeconds).toBe(60 + 61 + 62 + 63 + 64);
  });

  it('retries with DRIVE on a 400, then falls back to the heuristic', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const badRequest = Object.assign(new Error('bad'), {
      isAxiosError: true,
      response: { status: 400, data: {} },
    });
    mockedPost.mockRejectedValue(badRequest);
    const r = await svc.optimize(MESS, SCRAMBLED);
    expect(mockedPost.mock.calls.map((c) => c[1].travelMode)).toEqual([
      'TWO_WHEELER',
      'DRIVE',
    ]);
    expect(r.provider).toBe(RouteProvider.HEURISTIC);
    expect(r.order).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('splits routes longer than 26 stops into chained Google requests', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    mockedPost.mockResolvedValue({ data: { routes: [{ legs: [] }] } });
    const many = Array.from({ length: 60 }, (_, i) =>
      stop(`s${i}`, 0.001 * (i + 1)),
    );
    const r = await svc.optimize(MESS, many);
    expect(mockedPost).toHaveBeenCalledTimes(3); // 26 + 26 + 8
    expect(r.order).toHaveLength(60);
    expect(new Set(r.order).size).toBe(60);
    // Each chunk starts where the previous one ended.
    const secondOrigin = mockedPost.mock.calls[1][1].origin.location.latLng;
    const firstDest = mockedPost.mock.calls[0][1].destination.location.latLng;
    expect(secondOrigin).toEqual(firstDest);
  });
});

describe('DeliveryWorkModule wiring', () => {
  it('resolves all providers (incl. the reused DeliveriesService)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, DeliveryWorkModule],
    }).compile();
    expect(moduleRef.get(DeliveryWorkService)).toBeDefined();
  });
});

describe('effectiveStatus', () => {
  it('lets whole-delivery cancels/overrides finalise pending meals only', () => {
    const { effectiveStatus } = jest.requireActual('./delivery-route.service');
    expect(effectiveStatus('CANCELLED', 'DELIVERED')).toBe('CANCELLED');
    expect(effectiveStatus('CANCELLED', 'PENDING')).toBe('CANCELLED');
    expect(effectiveStatus('COMPLETED', 'PENDING')).toBe('COMPLETED');
    expect(effectiveStatus('UNDELIVERED', 'PENDING')).toBe('UNDELIVERED');
    expect(effectiveStatus('COMPLETED', 'UNDELIVERED')).toBe('UNDELIVERED');
    expect(effectiveStatus('PENDING', 'PENDING')).toBe('PENDING');
    expect(effectiveStatus(null, 'DELIVERED')).toBe('DELIVERED');
  });
});
