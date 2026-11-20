import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryStatus,
  Prisma,
  RouteProvider,
  VariationStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { formatDay, LatLng, nextDay, parseLatLng, toLatLng } from './geo.util';
import { RouteOptimizerService } from './route-optimizer.service';

export const UNASSIGNED_PARTNER_KEY = 'UNASSIGNED';

/** One route = one mess × one partner (or unassigned) × one variation × one day. */
export interface RouteScope {
  messId: string;
  partnerId: string | null;
  variationId: string;
  /** UTC midnight of the delivery day. */
  date: Date;
}

export type RoutePlanWithStops = Prisma.DeliveryRoutePlanGetPayload<{
  include: { stops: true };
}>;

type StopRow = Omit<Prisma.DeliveryRouteStopCreateManyInput, 'routePlanId'>;

interface ScopeStop {
  deliveryId: string;
  deliveryVariationId: string;
  status: VariationStatus;
  coords: LatLng | null;
}

export const ADDRESS_SELECT = {
  id: true,
  name: true,
  street: true,
  townOrcity: true,
  country: true,
  postcode: true,
  landmark: true,
  latitudeLogitude: true,
  locationLink: true,
  phone: true,
  email: true,
} satisfies Prisma.UserAddressSelect;

/** A stop is "done" for routing once its meal is no longer PENDING. */
export function isTerminal(status: VariationStatus) {
  return status !== VariationStatus.PENDING;
}

/**
 * The status a partner should see for one meal stop. A whole-day cancel by the mess
 * admin (DeliveriesService.cancelDelivery) sets Deliveries.status = CANCELLED but leaves
 * the variation rows PENDING, so the parent status wins in that case. Likewise a
 * whole-delivery override (owner-status COMPLETED/UNDELIVERED, or the agent's legacy
 * whole-delivery status update) finalises any meal still PENDING — the delivery
 * aggregate only reaches a terminal status on its own once every meal is terminal.
 */
export function effectiveStatus(
  deliveryStatus: DeliveryStatus | null,
  variationStatus: VariationStatus,
): VariationStatus {
  if (deliveryStatus === DeliveryStatus.CANCELLED)
    return VariationStatus.CANCELLED;
  if (
    variationStatus === VariationStatus.PENDING &&
    deliveryStatus &&
    deliveryStatus !== DeliveryStatus.PENDING
  ) {
    return VariationStatus[deliveryStatus];
  }
  return variationStatus;
}

/** Resolve customer coordinates: subscription address → its map link → profile. */
export function resolveStopCoords(delivery: {
  customer?: { latitude_logitude: string | null } | null;
  UserSubscriptions?: {
    UserAddress?: {
      latitudeLogitude: string | null;
      locationLink: string | null;
    } | null;
  } | null;
}): LatLng | null {
  const addr = delivery.UserSubscriptions?.UserAddress;
  return (
    parseLatLng(addr?.latitudeLogitude) ??
    parseLatLng(addr?.locationLink) ??
    parseLatLng(delivery.customer?.latitude_logitude)
  );
}

@Injectable()
export class DeliveryRouteService {
  private readonly logger = new Logger(DeliveryRouteService.name);
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly optimizer: RouteOptimizerService,
  ) {}

  partnerKey(partnerId: string | null) {
    return partnerId ?? UNASSIGNED_PARTNER_KEY;
  }

  /**
   * Returns the stored route for a scope, rebuilding it first if the set of in-scope
   * deliveries (or their coordinates) changed since it was last optimised — e.g. a new
   * subscription, a partner transfer, a pause or an order cancellation — or if `force`.
   *
   * On rebuild, stops already handled (delivered/undelivered/cancelled) keep their
   * relative order at the top, and only the still-PENDING stops are re-optimised,
   * starting from the last stop the partner actually visited (else the mess).
   */
  async ensureFresh(
    scope: RouteScope,
    opts: { force?: boolean } = {},
  ): Promise<RoutePlanWithStops> {
    const key = `${scope.messId}|${this.partnerKey(scope.partnerId)}|${scope.variationId}|${formatDay(scope.date)}`;
    return this.withLock(key, () => this.ensureFreshUnlocked(scope, opts));
  }

  private async ensureFreshUnlocked(
    scope: RouteScope,
    opts: { force?: boolean },
  ): Promise<RoutePlanWithStops> {
    const uniqueWhere = {
      messId_partnerKey_variationId_date: {
        messId: scope.messId,
        partnerKey: this.partnerKey(scope.partnerId),
        variationId: scope.variationId,
        date: scope.date,
      },
    };

    const [existing, scopeStops, mess] = await Promise.all([
      this.prisma.deliveryRoutePlan.findUnique({
        where: uniqueWhere,
        include: { stops: { orderBy: { sequence: 'asc' } } },
      }),
      this.loadScopeStops(scope),
      this.prisma.mess.findUnique({
        where: { id: scope.messId },
        select: { latitude: true, logitude: true },
      }),
    ]);

    const messOrigin = toLatLng(mess?.latitude, mess?.logitude);
    const fingerprint = this.fingerprint(messOrigin, scopeStops);

    if (existing && existing.fingerprint === fingerprint && !opts.force) {
      return existing;
    }

    // ── 1. Already-handled stops stay first, in the order they were on the old route.
    const oldSeq = new Map(
      (existing?.stops ?? []).map((s) => [s.deliveryId, s.sequence]),
    );
    const oldLegs = new Map(
      (existing?.stops ?? []).map((s) => [
        s.deliveryId,
        {
          distanceMeters: s.legDistanceMeters,
          durationSeconds: s.legDurationSeconds,
        },
      ]),
    );
    const done = scopeStops
      .filter((s) => isTerminal(s.status))
      .sort(
        (a, b) =>
          (oldSeq.get(a.deliveryId) ?? Number.MAX_SAFE_INTEGER) -
          (oldSeq.get(b.deliveryId) ?? Number.MAX_SAFE_INTEGER),
      );

    // ── 2. Re-optimise what's left, from where the partner last physically was.
    const pending = scopeStops.filter((s) => !isTerminal(s.status));
    const routablePending = pending.filter((s) => s.coords);
    const unroutablePending = pending.filter((s) => !s.coords);

    const lastVisited = [...done]
      .reverse()
      .find((s) => s.coords && s.status !== VariationStatus.CANCELLED)?.coords;
    const origin: LatLng | null =
      lastVisited ?? messOrigin ?? routablePending[0]?.coords ?? null;

    const optimized = origin
      ? await this.optimizer.optimize(
          origin,
          routablePending.map((s) => ({ id: s.deliveryId, ...s.coords! })),
        )
      : null;

    const byId = new Map(scopeStops.map((s) => [s.deliveryId, s]));
    const orderedPending = optimized
      ? optimized.order.map((id) => byId.get(id)!)
      : routablePending;

    const rows: StopRow[] = [];
    let seq = 1;
    for (const s of done) {
      const leg = oldLegs.get(s.deliveryId);
      rows.push(
        this.stopRow(
          s,
          seq++,
          leg?.distanceMeters ?? null,
          leg?.durationSeconds ?? null,
        ),
      );
    }
    for (const s of orderedPending) {
      const leg = optimized?.legs.get(s.deliveryId);
      rows.push(
        this.stopRow(
          s,
          seq++,
          leg?.distanceMeters ?? null,
          leg?.durationSeconds ?? null,
        ),
      );
    }
    for (const s of unroutablePending) {
      rows.push(this.stopRow(s, seq++, null, null));
    }

    const totalDistanceMeters = rows.reduce(
      (t, r) => t + (r.legDistanceMeters ?? 0),
      0,
    );
    const totalDurationSeconds = rows.reduce(
      (t, r) => t + (r.legDurationSeconds ?? 0),
      0,
    );
    const planData = {
      partnerId: scope.partnerId,
      fingerprint,
      provider: optimized?.provider ?? RouteProvider.HEURISTIC,
      originLat: messOrigin?.lat ?? origin?.lat ?? null,
      originLng: messOrigin?.lng ?? origin?.lng ?? null,
      totalDistanceMeters,
      totalDurationSeconds,
      polylines: optimized?.polylines ?? [],
      optimizedAt: new Date(),
    };

    const planId = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.deliveryRoutePlan.upsert({
        where: uniqueWhere,
        create: {
          messId: scope.messId,
          partnerKey: this.partnerKey(scope.partnerId),
          variationId: scope.variationId,
          date: scope.date,
          ...planData,
        },
        update: planData,
        select: { id: true },
      });
      await tx.deliveryRouteStop.deleteMany({
        where: { routePlanId: plan.id },
      });
      if (rows.length) {
        await tx.deliveryRouteStop.createMany({
          data: rows.map((r) => ({ ...r, routePlanId: plan.id })),
        });
      }
      return plan.id;
    });

    this.logger.log(
      `Route ${planData.provider} ${scope.messId}/${this.partnerKey(scope.partnerId)}/${scope.variationId}/${formatDay(scope.date)}: ${rows.length} stops (${pending.length} pending)`,
    );

    return this.prisma.deliveryRoutePlan.findUniqueOrThrow({
      where: { id: planId },
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });
  }

  /**
   * Every live meal stop in scope: the scope's variation on the partner's (or the
   * unassigned) deliveries of that mess and day. Inactive (cancelled order / ended
   * subscription) and soft-deleted deliveries drop out, which is what makes a route
   * reorder itself when an order ends.
   */
  private async loadScopeStops(scope: RouteScope): Promise<ScopeStop[]> {
    const rows = await this.prisma.deliveryVariation.findMany({
      where: {
        variationId: scope.variationId,
        deletedAt: null,
        delivery: {
          messId: scope.messId,
          partnerId: scope.partnerId,
          date: { gte: scope.date, lt: nextDay(scope.date) },
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        status: true,
        deliveryId: true,
        delivery: {
          select: {
            status: true,
            customer: { select: { latitude_logitude: true } },
            UserSubscriptions: {
              select: {
                UserAddress: {
                  select: { latitudeLogitude: true, locationLink: true },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((r) => ({
      deliveryId: r.deliveryId,
      deliveryVariationId: r.id,
      status: effectiveStatus(r.delivery.status, r.status),
      coords: resolveStopCoords(r.delivery),
    }));
  }

  /** Membership + coordinates only — status changes must not trigger a re-route. */
  private fingerprint(origin: LatLng | null, stops: ScopeStop[]) {
    const parts = stops
      .map(
        (s) =>
          `${s.deliveryId}|${s.coords ? `${s.coords.lat.toFixed(6)},${s.coords.lng.toFixed(6)}` : '-'}`,
      )
      .sort();
    const originPart = origin
      ? `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`
      : '-';
    return createHash('sha256')
      .update(`${originPart}#${parts.join(';')}`)
      .digest('hex');
  }

  private stopRow(
    s: ScopeStop,
    sequence: number,
    legDistanceMeters: number | null,
    legDurationSeconds: number | null,
  ): StopRow {
    return {
      deliveryId: s.deliveryId,
      deliveryVariationId: s.deliveryVariationId,
      sequence,
      latitude: s.coords?.lat ?? null,
      longitude: s.coords?.lng ?? null,
      routable: !!s.coords,
      legDistanceMeters,
      legDurationSeconds,
    };
  }

  /**
   * All distinct (partner, variation) route scopes that have deliveries for a mess on
   * a day — optionally narrowed to one partner, unassigned only, or one variation.
   */
  async discoverScopes(filter: {
    messId: string;
    date: Date;
    variationId?: string;
    partnerId?: string;
    unassignedOnly?: boolean;
  }): Promise<RouteScope[]> {
    const rows = await this.prisma.deliveryVariation.findMany({
      where: {
        deletedAt: null,
        ...(filter.variationId && { variationId: filter.variationId }),
        delivery: {
          messId: filter.messId,
          date: { gte: filter.date, lt: nextDay(filter.date) },
          isActive: true,
          deletedAt: null,
          ...(filter.unassignedOnly
            ? { partnerId: null }
            : filter.partnerId
              ? { partnerId: filter.partnerId }
              : {}),
        },
      },
      select: { variationId: true, delivery: { select: { partnerId: true } } },
    });

    const seen = new Map<string, RouteScope>();
    for (const r of rows) {
      const partnerId = r.delivery.partnerId ?? null;
      const k = `${this.partnerKey(partnerId)}|${r.variationId}`;
      if (!seen.has(k)) {
        seen.set(k, {
          messId: filter.messId,
          partnerId,
          variationId: r.variationId,
          date: filter.date,
        });
      }
    }
    return [...seen.values()];
  }

  /**
   * Route scopes whose stored stop list contains any of these deliveries — used to
   * refresh the *previous* partner's route after deliveries move to someone else.
   */
  async scopesContainingDeliveries(
    deliveryIds: string[],
  ): Promise<RouteScope[]> {
    if (deliveryIds.length === 0) return [];
    const stops = await this.prisma.deliveryRouteStop.findMany({
      where: { deliveryId: { in: deliveryIds } },
      select: {
        routePlan: {
          select: {
            messId: true,
            partnerId: true,
            variationId: true,
            date: true,
          },
        },
      },
    });
    const seen = new Map<string, RouteScope>();
    for (const { routePlan: p } of stops) {
      const k = `${p.messId}|${this.partnerKey(p.partnerId)}|${p.variationId}|${p.date.toISOString()}`;
      if (!seen.has(k)) seen.set(k, { ...p, partnerId: p.partnerId ?? null });
    }
    return [...seen.values()];
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    this.locks.set(key, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(key) === run) this.locks.delete(key);
    }
  }
}
