import { BadRequestException } from '@nestjs/common';
import { ScheduleType } from '@prisma/client';

/**
 * Resolves the weekly schedule (scheduleType + selectedDays) a subscription should be
 * created with, given the plan's own schedule (set by the mess owner at plan create/update)
 * and whatever the subscriber asked for. The plan's days act as a **default and a limit**,
 * not a hard override:
 *
 *  - If the plan is EVERYDAY (or CUSTOM with no days set), it places no restriction —
 *    whatever the subscriber requested is used as-is.
 *  - If the plan is CUSTOM with `availableDays` set, and the subscriber didn't ask for a
 *    matching CUSTOM selection, the plan's own days are used as the default.
 *  - If the plan is CUSTOM with `availableDays` set and the subscriber *did* ask for CUSTOM
 *    days, every requested day must be one the plan actually runs on — otherwise this
 *    throws.
 *
 * Used wherever a plan gets freshly assigned to a customer (choosePlan, admin
 * createSubscriptionForCustomer, CreateUser's inline first-subscription block) — see
 * CustomersService.computePlanPricing for the main call site.
 */
export function resolvePlanSchedule(
    plan: { scheduleType: ScheduleType; availableDays: unknown },
    requested: { scheduleType?: ScheduleType; selectedDays?: string[] },
): { scheduleType: ScheduleType; selectedDays?: string[] } {
    const planDays = Array.isArray(plan.availableDays) ? (plan.availableDays as string[]) : [];
    const planRestrictsDays = plan.scheduleType === ScheduleType.CUSTOM && planDays.length > 0;

    if (!planRestrictsDays) {
        return { scheduleType: requested.scheduleType ?? ScheduleType.EVERYDAY, selectedDays: requested.selectedDays };
    }

    const planDaysUpper = planDays.map((d) => String(d).toUpperCase());

    const requestedCustomDays =
        requested.scheduleType === ScheduleType.CUSTOM && (requested.selectedDays?.length ?? 0) > 0
            ? requested.selectedDays!
            : null;

    // No matching CUSTOM request from the subscriber — default to the plan's own days.
    if (!requestedCustomDays) {
        return { scheduleType: ScheduleType.CUSTOM, selectedDays: planDays };
    }

    // Subscriber picked their own days — must all fall within what the plan actually runs on.
    const invalid = requestedCustomDays.filter((d) => !planDaysUpper.includes(String(d).toUpperCase()));
    if (invalid.length > 0) {
        throw new BadRequestException(
            `This plan only delivers on: ${planDaysUpper.join(', ')}. Invalid day(s): ${invalid.join(', ')}`,
        );
    }

    return { scheduleType: ScheduleType.CUSTOM, selectedDays: requestedCustomDays };
}
