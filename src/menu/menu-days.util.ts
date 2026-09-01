import { DayOfWeek } from '@prisma/client';

/** Single source of truth mapping a menu DTO's lowercase day property to the DayOfWeek enum. */
export const MENU_WEEKDAYS: { key: MenuDayKey; day: DayOfWeek }[] = [
    { key: 'monday', day: DayOfWeek.MONDAY },
    { key: 'tuesday', day: DayOfWeek.TUESDAY },
    { key: 'wednesday', day: DayOfWeek.WEDNESDAY },
    { key: 'thursday', day: DayOfWeek.THURSDAY },
    { key: 'friday', day: DayOfWeek.FRIDAY },
    { key: 'saturday', day: DayOfWeek.SATURDAY },
    { key: 'sunday', day: DayOfWeek.SUNDAY },
];

export type MenuDayKey =
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
