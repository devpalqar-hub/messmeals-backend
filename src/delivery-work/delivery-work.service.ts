import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  DeliveryWorkSession,
  DeliveryWorkSessionStatus,
  Prisma,
  Role,
  VariationStatus,
} from '@prisma/client';
import { DeliveriesService } from 'src/deliveries/deliveries.service';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DeliveryRouteService,
  effectiveStatus,
  resolveStopCoords,
  RoutePlanWithStops,
  RouteScope,
} from './delivery-route.service';
import { formatDay, LatLng, nextDay, parseDay, toLatLng } from './geo.util';
import { AdminRoutesQueryDto } from './dto/work-query.dto';
import {
  OptimizeRoutesDto,
  TransferDeliveriesDto,
} from './dto/admin-route.dto';
import { UpdateStopStatusDto } from './dto/update-stop-status.dto';

export interface AuthUser {
  id: string;
  role: Role;
  deliveryPartnerProfileId?: string;
  messId?: string;
  messIds?: string[];
}

type RouteView = Awaited<ReturnType<DeliveryWorkService['buildRouteView']>>;
type RouteStopView = RouteView['stops'][number];

const PENDING_DELIVERY: Prisma.DeliveriesWhereInput = {
  OR: [{ status: null }, { status: DeliveryStatus.PENDING }],
};

/** Customer address as saved by POST /customer/register-user (CustomerProfile). */
function customerAddress(c: {
  address: string | null;
  current_location: string | null;
  latitude_logitude: string | null;
}) {
  if (!c.address && !c.current_location && !c.latitude_logitude) return null;
  return {
    address: c.address,
    currentLocation: c.current_location,
    latitudeLongitude: c.latitude_logitude,
    formatted:
      [c.address, c.current_location]
        .filter((p) => p && String(p).trim())
        .join(', ') || null,
  };
}

function navigationUrl(loc: LatLng | null) {
  return loc
    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=two-wheeler`
    : null;
}

/** One map point of a route: the mess (start), then each delivery in visiting order. */
export interface RoutePoint {
  /** 0 = the mess (start); 1, 2, 3… = deliveries, same as `stops[].sequence`. */
  sequence: number;
  type: 'MESS' | 'DELIVERY';
  deliveryId: string | null;
  label: string | null;
  status: VariationStatus | null;
  latitude: number;
  longitude: number;
}

/**
 * Mess → first delivery → second delivery → … as plottable lat/lng points. Stops with
 * no known coordinates are left out (they can't be drawn); the mess point is left out
 * if the mess has no coordinates.
 */
function buildRoutePoints(
  mess: { id: string; name: string; location: LatLng | null } | null,
  stops: {
    sequence: number;
    deliveryId: string;
    label: string | null;
    status: VariationStatus | null;
    location: LatLng | null;
  }[],
): RoutePoint[] {
  const points: RoutePoint[] = [];
  if (mess?.location) {
    points.push({
      sequence: 0,
      type: 'MESS',
      deliveryId: null,
      label: mess.name,
      status: null,
      latitude: mess.location.lat,
      longitude: mess.location.lng,
    });
  }
  for (const s of stops) {
    if (!s.location) continue;
    points.push({
      sequence: s.sequence,
      type: 'DELIVERY',
      deliveryId: s.deliveryId,
      label: s.label,
      status: s.status,
      latitude: s.location.lat,
      longitude: s.location.lng,
    });
  }
  return points;
}

function stopLocation(s: {
  latitude: number | null;
  longitude: number | null;
}) {
  return s.latitude !== null && s.longitude !== null
    ? { lat: s.latitude, lng: s.longitude }
    : null;
}

@Injectable()
export class DeliveryWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routes: DeliveryRouteService,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  // ═══════════════════════════ Partner: plan the day ═══════════════════════════

  /** Variations the partner has stops for on a day, with progress + session state. */
  async listMyVariations(user: AuthUser, date?: string) {
    const partner = await this.requirePartner(user);
    const day = this.day(date);

    const [rows, sessions, activeSession] = await Promise.all([
      this.prisma.deliveryVariation.findMany({
        where: {
          deletedAt: null,
          delivery: {
            partnerId: partner.id,
            date: { gte: day, lt: nextDay(day) },
            isActive: true,
            deletedAt: null,
          },
        },
        select: {
          status: true,
          variationId: true,
          deliveryId: true,
          variation: {
            select: {
              id: true,
              title: true,
              description: true,
              createdAt: true,
            },
          },
          delivery: {
            select: {
              status: true,
              customer: { select: { user: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.deliveryWorkSession.findMany({
        where: { partnerId: partner.id, date: day },
      }),
      this.findActiveSession(partner.id),
    ]);

    const byVariation = new Map<
      string,
      {
        variation: {
          id: string;
          title: string;
          description: string | null;
          createdAt: Date;
        };
        counts: ReturnType<typeof emptyCounts>;
      }
    >();
    const stopInfo = new Map<
      string,
      { status: VariationStatus; label: string | null }
    >();
    for (const r of rows) {
      if (!byVariation.has(r.variationId)) {
        byVariation.set(r.variationId, {
          variation: r.variation,
          counts: emptyCounts(),
        });
      }
      const status = effectiveStatus(r.delivery.status, r.status);
      addToCounts(byVariation.get(r.variationId)!.counts, status);
      stopInfo.set(`${r.variationId}|${r.deliveryId}`, {
        status,
        label: r.delivery.customer?.user?.name ?? null,
      });
    }

    // Route order per variation (mess → 1st delivery → 2nd → …) with coordinates.
    // ensureFresh reuses the stored route unless its orders changed.
    const [mess, plans] = await Promise.all([
      this.prisma.mess.findUnique({
        where: { id: partner.messId },
        select: { id: true, name: true, latitude: true, logitude: true },
      }),
      Promise.all(
        [...byVariation.keys()].map((variationId) =>
          this.routes.ensureFresh({
            messId: partner.messId,
            partnerId: partner.id,
            variationId,
            date: day,
          }),
        ),
      ),
    ]);
    const messLocation = mess ? toLatLng(mess.latitude, mess.logitude) : null;
    const routeMess = mess
      ? { id: mess.id, name: mess.name, location: messLocation }
      : null;
    const planByVariation = new Map(plans.map((p) => [p.variationId, p]));

    const sessionByVariation = new Map(sessions.map((s) => [s.variationId, s]));
    const variations = [...byVariation.values()]
      .sort(
        (a, b) =>
          a.variation.createdAt.getTime() - b.variation.createdAt.getTime(),
      )
      .map(({ variation, counts }) => {
        const session = sessionByVariation.get(variation.id) ?? null;
        return {
          variation: {
            id: variation.id,
            title: variation.title,
            description: variation.description,
          },
          ...counts,
          completed: counts.totalStops > 0 && counts.pending === 0,
          /** Mess → 1st delivery → 2nd delivery → … with latitude / longitude. */
          points: buildRoutePoints(
            routeMess,
            (planByVariation.get(variation.id)?.stops ?? []).flatMap((s) => {
              const info = stopInfo.get(`${variation.id}|${s.deliveryId}`);
              return info
                ? [
                    {
                      sequence: s.sequence,
                      deliveryId: s.deliveryId,
                      label: info.label,
                      status: info.status,
                      location: stopLocation(s),
                    },
                  ]
                : [];
            }),
          ),
          session: session
            ? {
                id: session.id,
                status: session.status,
                startedAt: session.startedAt,
                completedAt: session.completedAt,
              }
            : null,
          canStart:
            counts.pending > 0 &&
            session?.status !== DeliveryWorkSessionStatus.IN_PROGRESS &&
            !activeSession,
        };
      });

    return {
      message: 'Work variations fetched successfully',
      date: formatDay(day),
      /** Where every route starts. */
      mess: mess
        ? {
            id: mess.id,
            name: mess.name,
            latitude: messLocation?.lat ?? null,
            longitude: messLocation?.lng ?? null,
          }
        : null,
      activeSession: activeSession
        ? {
            id: activeSession.id,
            variationId: activeSession.variationId,
            date: formatDay(activeSession.date),
            startedAt: activeSession.startedAt,
          }
        : null,
      variations,
    };
  }

  /**
   * The partner's deliveries for one variation, in optimised route order, with map
   * coordinates, legs/ETAs, polylines and live statuses. Works before a session is
   * started (preview) and during one.
   */
  async getMyRoute(user: AuthUser, variationId: string, date?: string) {
    const partner = await this.requirePartner(user);
    const day = this.day(date);
    const plan = await this.routes.ensureFresh({
      messId: partner.messId,
      partnerId: partner.id,
      variationId,
      date: day,
    });
    const view = await this.buildRouteView(plan);

    let session = await this.prisma.deliveryWorkSession.findUnique({
      where: {
        partnerId_variationId_date: {
          partnerId: partner.id,
          variationId,
          date: day,
        },
      },
    });
    if (session) session = await this.syncSession(session, view);

    return {
      message: 'Route fetched successfully',
      session: session ? this.sessionInfo(session) : null,
      ...view,
    };
  }

  // ═══════════════════════════ Partner: work session ═══════════════════════════

  async startSession(user: AuthUser, variationId: string, date?: string) {
    const partner = await this.requirePartner(user);
    const day = this.day(date);

    if (day.getTime() > this.day().getTime()) {
      throw new BadRequestException('You cannot start work for a future date');
    }

    const active = await this.findActiveSession(partner.id);
    if (
      active &&
      !(
        active.variationId === variationId &&
        active.date.getTime() === day.getTime()
      )
    ) {
      throw new ConflictException({
        message:
          'Another delivery run is already in progress. Complete or end it before starting a new one.',
        activeSession: {
          id: active.id,
          variationId: active.variationId,
          date: formatDay(active.date),
        },
      });
    }

    const plan = await this.routes.ensureFresh({
      messId: partner.messId,
      partnerId: partner.id,
      variationId,
      date: day,
    });
    if (plan.stops.length === 0) {
      throw new BadRequestException(
        'You have no deliveries for this variation on this date',
      );
    }
    const view = await this.buildRouteView(plan);

    const existing = await this.prisma.deliveryWorkSession.findUnique({
      where: {
        partnerId_variationId_date: {
          partnerId: partner.id,
          variationId,
          date: day,
        },
      },
    });

    let session: DeliveryWorkSession;
    if (!existing) {
      session = await this.prisma.deliveryWorkSession.create({
        data: {
          partnerId: partner.id,
          messId: partner.messId,
          variationId,
          date: day,
        },
      });
    } else if (
      existing.status !== DeliveryWorkSessionStatus.IN_PROGRESS &&
      view.summary.pending > 0
    ) {
      // Ended early, or new stops arrived after completion — reopen the run.
      session = await this.prisma.deliveryWorkSession.update({
        where: { id: existing.id },
        data: {
          status: DeliveryWorkSessionStatus.IN_PROGRESS,
          completedAt: null,
        },
      });
    } else {
      session = existing;
    }

    session = await this.syncSession(session, view);
    return {
      message:
        session.status === DeliveryWorkSessionStatus.COMPLETED
          ? 'All deliveries for this variation are already complete'
          : 'Delivery run started',
      ...this.sessionPayload(session, view),
    };
  }

  /** The partner's in-progress run (if any) — lets the app resume at the same stage. */
  async getActiveSession(user: AuthUser) {
    const partner = await this.requirePartner(user);
    const session = await this.findActiveSession(partner.id);
    if (!session) {
      return {
        message: 'No delivery run in progress',
        active: false,
        session: null,
      };
    }
    const { session: synced, view } = await this.refreshSession(session);
    return {
      message: 'Active delivery run fetched successfully',
      active: synced.status === DeliveryWorkSessionStatus.IN_PROGRESS,
      ...this.sessionPayload(synced, view),
    };
  }

  /** Current (next) stop of a run, or the job-completed summary once all are done. */
  async getCurrentStop(user: AuthUser, sessionId: string) {
    const session = await this.getOwnedSession(user, sessionId);
    const { session: synced, view } = await this.refreshSession(session);
    return {
      message:
        synced.status === DeliveryWorkSessionStatus.COMPLETED
          ? 'Job completed'
          : 'Current delivery fetched successfully',
      ...this.sessionPayload(synced, view),
    };
  }

  /**
   * Marks one stop DELIVERED / UNDELIVERED / CANCELLED for the run's variation, then
   * advances the run to the next pending stop on the route. When nothing is left the
   * run is marked COMPLETED and the response carries `jobCompleted: true` + summary.
   *
   * The status change itself goes through DeliveriesService.updateVariationStatus, so
   * the parent delivery's auto-complete and the daily-plan billing ledger behave
   * exactly as they do everywhere else.
   */
  async updateStopStatus(
    user: AuthUser,
    sessionId: string,
    deliveryId: string,
    dto: UpdateStopStatusDto,
  ) {
    const session = await this.getOwnedSession(user, sessionId);
    if (session.status !== DeliveryWorkSessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `This delivery run is already ${session.status.toLowerCase()}`,
      );
    }

    const plan = await this.routes.ensureFresh(this.scopeOf(session));
    if (!plan.stops.some((s) => s.deliveryId === deliveryId)) {
      throw new NotFoundException('This delivery is not part of this run');
    }

    const delivery = await this.prisma.deliveries.findUnique({
      where: { id: deliveryId },
      select: { status: true },
    });
    if (
      delivery?.status === DeliveryStatus.CANCELLED &&
      dto.status !== VariationStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'This delivery was cancelled by the mess and cannot be updated',
      );
    }

    await this.deliveriesService.updateVariationStatus(
      deliveryId,
      session.variationId,
      { status: dto.status },
      user.id,
    );

    const view = await this.buildRouteView(plan);
    const synced = await this.syncSession(session, view);
    const payload = this.sessionPayload(synced, view);

    return {
      message: payload.jobCompleted
        ? 'Delivery updated — all deliveries in this run are complete'
        : 'Delivery updated',
      updatedStop: view.stops.find((s) => s.deliveryId === deliveryId) ?? null,
      ...payload,
    };
  }

  /** Completion model for a run (also usable mid-run as a progress report). */
  async getSessionSummary(user: AuthUser, sessionId: string) {
    const session = await this.getOwnedSession(user, sessionId);
    const { session: synced, view } = await this.refreshSession(session);
    return {
      message: 'Delivery run summary fetched successfully',
      session: this.sessionInfo(synced),
      jobCompleted: synced.status === DeliveryWorkSessionStatus.COMPLETED,
      summary: this.completionSummary(synced, view),
    };
  }

  /** Close a run early (remaining stops stay PENDING; it can be restarted later). */
  async endSession(user: AuthUser, sessionId: string) {
    const session = await this.getOwnedSession(user, sessionId);
    const { session: synced, view } = await this.refreshSession(session);
    let result = synced;
    if (synced.status === DeliveryWorkSessionStatus.IN_PROGRESS) {
      result = await this.prisma.deliveryWorkSession.update({
        where: { id: synced.id },
        data: {
          status: DeliveryWorkSessionStatus.ENDED,
          completedAt: new Date(),
        },
      });
    }
    return {
      message: 'Delivery run ended',
      ...this.sessionPayload(result, view),
    };
  }

  // ═══════════════════════════ Order details ═══════════════════════════

  /**
   * Everything a partner needs at the door: customer name/phone, full address with
   * coordinates and a navigation link, plan, every meal of that delivery with its
   * status, subscription, mess contact and the stop's position on the route.
   */
  async getDeliveryDetails(
    user: AuthUser,
    deliveryId: string,
    variationId?: string,
  ) {
    const d = await this.prisma.deliveries.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        date: true,
        status: true,
        isActive: true,
        messId: true,
        partnerId: true,
        customer: {
          select: {
            id: true,
            address: true,
            current_location: true,
            latitude_logitude: true,
            user: { select: { name: true, phone: true, email: true } },
          },
        },
        plan: {
          select: {
            id: true,
            planName: true,
            description: true,
            isDailyPlan: true,
            isMonthlyPlan: true,
          },
        },
        mess: { select: { id: true, name: true, phone: true, address: true } },
        partner: {
          select: { id: true, user: { select: { name: true, phone: true } } },
        },
        UserSubscriptions: {
          select: {
            id: true,
            start_date: true,
            end_date: true,
            scheduleType: true,
            selectedDays: true,
          },
        },
        deliveryVariations: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            variation: { select: { id: true, title: true, description: true } },
          },
        },
      },
    });
    if (!d) throw new NotFoundException('Delivery not found');
    await this.assertDeliveryAccess(user, d);

    const location = resolveStopCoords(d);
    const variations = d.deliveryVariations.map((dv) => ({
      deliveryVariationId: dv.id,
      variationId: dv.variation.id,
      title: dv.variation.title,
      description: dv.variation.description,
      status: effectiveStatus(d.status, dv.status),
    }));

    let route: {
      routePlanId: string;
      sequence: number;
      totalStops: number;
      leg: { distanceMeters: number | null; durationSeconds: number | null };
    } | null = null;
    if (variationId) {
      const stop = await this.prisma.deliveryRouteStop.findFirst({
        where: { deliveryId, routePlan: { variationId } },
        orderBy: { routePlan: { optimizedAt: 'desc' } },
        select: {
          sequence: true,
          legDistanceMeters: true,
          legDurationSeconds: true,
          routePlan: {
            select: { id: true, _count: { select: { stops: true } } },
          },
        },
      });
      if (stop) {
        route = {
          routePlanId: stop.routePlan.id,
          sequence: stop.sequence,
          totalStops: stop.routePlan._count.stops,
          leg: {
            distanceMeters: stop.legDistanceMeters,
            durationSeconds: stop.legDurationSeconds,
          },
        };
      }
    }

    const phone = d.customer.user.phone;
    return {
      message: 'Delivery details fetched successfully',
      deliveryId: d.id,
      date: formatDay(d.date),
      deliveryStatus: d.status,
      isActive: d.isActive,
      customer: {
        id: d.customer.id,
        name: d.customer.user.name,
        phone,
        email: d.customer.user.email,
        callUrl: phone ? `tel:${phone}` : null,
      },
      address: customerAddress(d.customer),
      location,
      navigationUrl: navigationUrl(location),
      plan: d.plan,
      mess: d.mess,
      partner: d.partner
        ? {
            id: d.partner.id,
            name: d.partner.user.name,
            phone: d.partner.user.phone,
          }
        : null,
      subscription: d.UserSubscriptions
        ? {
            id: d.UserSubscriptions.id,
            startDate: d.UserSubscriptions.start_date,
            endDate: d.UserSubscriptions.end_date,
            scheduleType: d.UserSubscriptions.scheduleType,
            selectedDays: d.UserSubscriptions.selectedDays,
          }
        : null,
      variations,
      selectedVariation: variationId
        ? (variations.find((v) => v.variationId === variationId) ?? null)
        : null,
      route,
    };
  }

  // ═══════════════════════════ Admin: routes & transfers ═══════════════════════════

  /** Optimised routes for a mess/day, per partner (and unassigned) and variation. */
  async getRoutes(user: AuthUser, q: AdminRoutesQueryDto) {
    const messId = await this.resolveMessId(user, q.messId);
    const day = this.day(q.date);
    const scopes = await this.routes.discoverScopes({
      messId,
      date: day,
      variationId: q.variationId,
      partnerId: q.partnerId,
      unassignedOnly: q.unassigned,
    });

    const routes: RouteView[] = [];
    for (const scope of scopes) {
      routes.push(
        await this.buildRouteView(await this.routes.ensureFresh(scope)),
      );
    }
    routes.sort(
      (a, b) =>
        (a.partner?.name ?? '').localeCompare(b.partner?.name ?? '') ||
        (a.variation?.title ?? '').localeCompare(b.variation?.title ?? ''),
    );

    return {
      message: 'Delivery routes fetched successfully',
      messId,
      date: formatDay(day),
      count: routes.length,
      routes,
    };
  }

  /** Force a fresh optimisation (e.g. after bulk address fixes). */
  async optimizeRoutes(user: AuthUser, dto: OptimizeRoutesDto) {
    const messId = await this.resolveMessId(user, dto.messId);
    const day = this.day(dto.date);
    const scopes = await this.routes.discoverScopes({
      messId,
      date: day,
      variationId: dto.variationId,
      partnerId: dto.partnerId,
      unassignedOnly: dto.unassigned,
    });

    const results: ReturnType<typeof planSummary>[] = [];
    for (const scope of scopes) {
      results.push(
        planSummary(await this.routes.ensureFresh(scope, { force: true })),
      );
    }
    return {
      message: `Optimised ${results.length} route(s)`,
      messId,
      date: formatDay(day),
      routes: results,
    };
  }

  /**
   * Move a day's still-pending deliveries to another partner and immediately reorder
   * both the old and the new partner's routes. Only that day's deliveries move — the
   * subscription's default partner is not changed.
   */
  async transferDeliveries(user: AuthUser, dto: TransferDeliveriesDto) {
    const messId = await this.resolveMessId(user, dto.messId);
    const day = this.day(dto.date);

    const toPartner = await this.prisma.deliveryPartnerProfile.findUnique({
      where: { id: dto.toPartnerId },
      select: { id: true, messId: true },
    });
    if (!toPartner || toPartner.messId !== messId) {
      throw new BadRequestException(
        'Target delivery partner does not belong to this mess',
      );
    }
    if (dto.fromPartnerId && dto.fromPartnerId === dto.toPartnerId) {
      throw new BadRequestException('Source and target partner are the same');
    }

    const where: Prisma.DeliveriesWhereInput = {
      messId,
      date: { gte: day, lt: nextDay(day) },
      isActive: true,
      deletedAt: null,
      ...PENDING_DELIVERY,
      ...(dto.deliveryIds?.length && { id: { in: dto.deliveryIds } }),
      ...(dto.fromPartnerId
        ? { partnerId: dto.fromPartnerId }
        : !dto.deliveryIds?.length
          ? { partnerId: null }
          : {}),
    };
    const candidates = await this.prisma.deliveries.findMany({
      where,
      select: { id: true, partnerId: true },
    });
    const toMove = candidates.filter((c) => c.partnerId !== dto.toPartnerId);
    if (toMove.length === 0) {
      throw new BadRequestException('No pending deliveries found to transfer');
    }

    const movedIds = toMove.map((d) => d.id);
    const skippedIds = (dto.deliveryIds ?? []).filter(
      (id) => !movedIds.includes(id),
    );
    const previousPartners = [
      ...new Set(toMove.map((d) => d.partnerId ?? null)),
    ];
    const oldScopes = await this.routes.scopesContainingDeliveries(movedIds);

    await this.prisma.deliveries.updateMany({
      where: { id: { in: movedIds } },
      data: { partnerId: dto.toPartnerId },
    });

    // Reorder: every route the moved deliveries were on, whatever the previous
    // partner(s) still have that day, and the new partner's routes.
    const scopes = new Map<string, RouteScope>();
    const add = (s: RouteScope) =>
      scopes.set(
        `${s.messId}|${this.routes.partnerKey(s.partnerId)}|${s.variationId}|${s.date.toISOString()}`,
        s,
      );
    oldScopes.forEach(add);
    for (const partnerId of [...previousPartners, dto.toPartnerId]) {
      const found = await this.routes.discoverScopes({
        messId,
        date: day,
        ...(partnerId ? { partnerId } : { unassignedOnly: true }),
      });
      found.forEach(add);
    }

    const reoptimized: ReturnType<typeof planSummary>[] = [];
    for (const scope of scopes.values()) {
      reoptimized.push(planSummary(await this.routes.ensureFresh(scope)));
    }

    return {
      message: `Transferred ${movedIds.length} deliveries and reordered affected routes`,
      date: formatDay(day),
      toPartnerId: dto.toPartnerId,
      fromPartnerIds: previousPartners,
      movedCount: movedIds.length,
      movedDeliveryIds: movedIds,
      skippedDeliveryIds: skippedIds,
      routes: reoptimized,
    };
  }

  // ═══════════════════════════ View building ═══════════════════════════

  private async buildRouteView(plan: RoutePlanWithStops) {
    const ids = plan.stops.map((s) => s.deliveryId);
    const [deliveries, variation, partner, mess] = await Promise.all([
      this.prisma.deliveries.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          status: true,
          customer: {
            select: {
              id: true,
              address: true,
              current_location: true,
              latitude_logitude: true,
              user: { select: { name: true, phone: true } },
            },
          },
          plan: { select: { id: true, planName: true } },
          deliveryVariations: {
            where: { variationId: plan.variationId, deletedAt: null },
            select: { id: true, status: true },
          },
        },
      }),
      this.prisma.variation.findUnique({
        where: { id: plan.variationId },
        select: { id: true, title: true, description: true },
      }),
      plan.partnerId
        ? this.prisma.deliveryPartnerProfile.findUnique({
            where: { id: plan.partnerId },
            select: { id: true, user: { select: { name: true, phone: true } } },
          })
        : Promise.resolve(null),
      this.prisma.mess.findUnique({
        where: { id: plan.messId },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          latitude: true,
          logitude: true,
        },
      }),
    ]);

    const messLocation = mess ? toLatLng(mess.latitude, mess.logitude) : null;
    const byId = new Map(deliveries.map((d) => [d.id, d]));
    const counts = emptyCounts();
    let currentDeliveryId: string | null = null;
    let remainingDistanceMeters = 0;
    let remainingDurationSeconds = 0;

    const stops = plan.stops.flatMap((s) => {
      const d = byId.get(s.deliveryId);
      const dv = d?.deliveryVariations[0];
      if (!d || !dv) return [];

      const status = effectiveStatus(d.status, dv.status);
      addToCounts(counts, status);
      const pending = status === VariationStatus.PENDING;
      if (pending && !currentDeliveryId) currentDeliveryId = d.id;
      if (pending) {
        remainingDistanceMeters += s.legDistanceMeters ?? 0;
        remainingDurationSeconds += s.legDurationSeconds ?? 0;
      }
      const location = stopLocation(s);

      return [
        {
          sequence: s.sequence,
          deliveryId: d.id,
          deliveryVariationId: dv.id,
          status,
          deliveryStatus: d.status,
          isCurrent: false,
          customer: {
            id: d.customer.id,
            name: d.customer.user.name,
            phone: d.customer.user.phone,
          },
          plan: d.plan,
          address: customerAddress(d.customer),
          location,
          routable: s.routable,
          leg:
            s.legDistanceMeters !== null || s.legDurationSeconds !== null
              ? {
                  distanceMeters: s.legDistanceMeters,
                  durationSeconds: s.legDurationSeconds,
                }
              : null,
          /** Cumulative travel seconds from the partner's position (last visited stop, else the mess) to this stop — pending stops only. */
          etaSeconds: pending ? remainingDurationSeconds : null,
          navigationUrl: navigationUrl(location),
        },
      ];
    });
    for (const s of stops) s.isCurrent = s.deliveryId === currentDeliveryId;

    const points = buildRoutePoints(
      mess ? { id: mess.id, name: mess.name, location: messLocation } : null,
      stops.map((s) => ({
        sequence: s.sequence,
        deliveryId: s.deliveryId,
        label: s.customer.name,
        status: s.status,
        location: s.location,
      })),
    );

    return {
      routePlanId: plan.id,
      date: formatDay(plan.date),
      mess: mess
        ? {
            id: mess.id,
            name: mess.name,
            phone: mess.phone,
            address: mess.address,
            latitude: messLocation?.lat ?? null,
            longitude: messLocation?.lng ?? null,
          }
        : null,
      /** Route start — the mess. */
      start: messLocation
        ? { latitude: messLocation.lat, longitude: messLocation.lng }
        : null,
      /** Mess → 1st delivery → 2nd delivery → … in route order, for drawing the map. */
      points,
      partner: partner
        ? { id: partner.id, name: partner.user.name, phone: partner.user.phone }
        : null,
      unassigned: !plan.partnerId,
      variation,
      provider: plan.provider,
      optimizedAt: plan.optimizedAt,
      origin:
        plan.originLat !== null && plan.originLng !== null
          ? { lat: plan.originLat, lng: plan.originLng }
          : null,
      polylines: (plan.polylines as string[] | null) ?? [],
      summary: {
        ...counts,
        completed: counts.totalStops > 0 && counts.pending === 0,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        remainingDistanceMeters,
        remainingDurationSeconds,
      },
      currentDeliveryId: currentDeliveryId as string | null,
      stops,
    };
  }

  // ═══════════════════════════ Session helpers ═══════════════════════════

  private async refreshSession(session: DeliveryWorkSession) {
    const plan = await this.routes.ensureFresh(this.scopeOf(session));
    const view = await this.buildRouteView(plan);
    return { session: await this.syncSession(session, view), view };
  }

  /** Persist progress/current stop; auto-complete the run when nothing is pending. */
  private async syncSession(
    session: DeliveryWorkSession,
    view: RouteView,
  ): Promise<DeliveryWorkSession> {
    const s = view.summary;
    const finishing =
      session.status === DeliveryWorkSessionStatus.IN_PROGRESS &&
      s.totalStops > 0 &&
      s.pending === 0;

    const data = {
      totalStops: s.totalStops,
      deliveredCount: s.delivered,
      undeliveredCount: s.undelivered,
      cancelledCount: s.cancelled,
      currentDeliveryId: view.currentDeliveryId,
      ...(finishing && {
        status: DeliveryWorkSessionStatus.COMPLETED,
        completedAt: new Date(),
      }),
    };

    const unchanged =
      !finishing &&
      session.totalStops === data.totalStops &&
      session.deliveredCount === data.deliveredCount &&
      session.undeliveredCount === data.undeliveredCount &&
      session.cancelledCount === data.cancelledCount &&
      session.currentDeliveryId === data.currentDeliveryId;
    if (unchanged) return session;

    return this.prisma.deliveryWorkSession.update({
      where: { id: session.id },
      data,
    });
  }

  private sessionPayload(session: DeliveryWorkSession, view: RouteView) {
    const jobCompleted = session.status === DeliveryWorkSessionStatus.COMPLETED;
    const s = view.summary;
    const done = s.totalStops - s.pending;
    const currentStop: RouteStopView | null =
      session.status === DeliveryWorkSessionStatus.IN_PROGRESS
        ? (view.stops.find((st) => st.isCurrent) ?? null)
        : null;
    return {
      session: this.sessionInfo(session),
      variation: view.variation,
      progress: {
        totalStops: s.totalStops,
        completedStops: done,
        pending: s.pending,
        delivered: s.delivered,
        undelivered: s.undelivered,
        cancelled: s.cancelled,
        percent: s.totalStops ? Math.round((done / s.totalStops) * 100) : 0,
        remainingDistanceMeters: s.remainingDistanceMeters,
        remainingDurationSeconds: s.remainingDurationSeconds,
      },
      currentStop,
      nextStops: currentStop
        ? view.stops
            .filter(
              (st) => st.status === VariationStatus.PENDING && !st.isCurrent,
            )
            .slice(0, 3)
        : [],
      jobCompleted,
      completion: jobCompleted ? this.completionSummary(session, view) : null,
    };
  }

  private sessionInfo(session: DeliveryWorkSession) {
    return {
      id: session.id,
      status: session.status,
      date: formatDay(session.date),
      variationId: session.variationId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    };
  }

  private completionSummary(session: DeliveryWorkSession, view: RouteView) {
    const s = view.summary;
    const end = session.completedAt ?? new Date();
    const title = view.variation?.title ?? 'this variation';
    return {
      title:
        session.status === DeliveryWorkSessionStatus.COMPLETED
          ? 'Job completed'
          : 'Job in progress',
      message:
        session.status === DeliveryWorkSessionStatus.COMPLETED
          ? `All ${s.totalStops} ${title} deliveries are done.`
          : `${s.totalStops - s.pending} of ${s.totalStops} ${title} deliveries done.`,
      variation: view.variation,
      date: formatDay(session.date),
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      durationSeconds: Math.max(
        0,
        Math.round((end.getTime() - session.startedAt.getTime()) / 1000),
      ),
      totalStops: s.totalStops,
      delivered: s.delivered,
      undelivered: s.undelivered,
      cancelled: s.cancelled,
      pending: s.pending,
      plannedDistanceMeters: s.totalDistanceMeters,
      plannedDurationSeconds: s.totalDurationSeconds,
    };
  }

  private scopeOf(session: DeliveryWorkSession): RouteScope {
    return {
      messId: session.messId,
      partnerId: session.partnerId,
      variationId: session.variationId,
      date: session.date,
    };
  }

  private findActiveSession(partnerId: string) {
    return this.prisma.deliveryWorkSession.findFirst({
      where: { partnerId, status: DeliveryWorkSessionStatus.IN_PROGRESS },
      orderBy: { startedAt: 'desc' },
    });
  }

  private async getOwnedSession(user: AuthUser, sessionId: string) {
    const partner = await this.requirePartner(user);
    const session = await this.prisma.deliveryWorkSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.partnerId !== partner.id) {
      throw new NotFoundException('Delivery run not found');
    }
    return session;
  }

  // ═══════════════════════════ Access helpers ═══════════════════════════

  private async requirePartner(user: AuthUser) {
    if (user.role !== Role.DELIVERYAGENT || !user.deliveryPartnerProfileId) {
      throw new ForbiddenException(
        'Only delivery partners can use this endpoint',
      );
    }
    const partner = await this.prisma.deliveryPartnerProfile.findUnique({
      where: { id: user.deliveryPartnerProfileId },
      select: { id: true, messId: true },
    });
    if (!partner)
      throw new ForbiddenException('Delivery partner profile not found');
    return partner;
  }

  private async resolveMessId(user: AuthUser, messId?: string) {
    if (messId) {
      await assertMessAccess(this.prisma, user, messId);
      return messId;
    }
    if (user.role === Role.MESSADMIN) {
      if (user.messIds?.length === 1) return user.messIds[0];
      if (user.messId) return user.messId;
    }
    throw new BadRequestException('messId is required');
  }

  private async assertDeliveryAccess(
    user: AuthUser,
    d: { messId: string; partnerId: string | null },
  ) {
    if (user.role === Role.SUPERADMIN) return;
    if (user.role === Role.DELIVERYAGENT) {
      if (d.partnerId && d.partnerId === user.deliveryPartnerProfileId) return;
      throw new ForbiddenException('This delivery is not assigned to you');
    }
    if (user.role === Role.MESSADMIN) {
      await assertMessAccess(this.prisma, user, d.messId);
      return;
    }
    throw new ForbiddenException('You do not have access to this delivery');
  }

  private day(date?: string) {
    try {
      return parseDay(date);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}

// ─── small pure helpers ───────────────────────────────────────────────────

function emptyCounts() {
  return {
    totalStops: 0,
    pending: 0,
    delivered: 0,
    undelivered: 0,
    cancelled: 0,
  };
}

function addToCounts(
  c: ReturnType<typeof emptyCounts>,
  status: VariationStatus,
) {
  c.totalStops++;
  if (status === VariationStatus.PENDING) c.pending++;
  else if (
    status === VariationStatus.DELIVERED ||
    status === VariationStatus.COMPLETED
  )
    c.delivered++;
  else if (status === VariationStatus.UNDELIVERED) c.undelivered++;
  else if (status === VariationStatus.CANCELLED) c.cancelled++;
}

function planSummary(plan: RoutePlanWithStops) {
  return {
    routePlanId: plan.id,
    partnerId: plan.partnerId,
    unassigned: !plan.partnerId,
    variationId: plan.variationId,
    date: formatDay(plan.date),
    provider: plan.provider,
    stops: plan.stops.length,
    totalDistanceMeters: plan.totalDistanceMeters,
    totalDurationSeconds: plan.totalDurationSeconds,
    optimizedAt: plan.optimizedAt,
  };
}
